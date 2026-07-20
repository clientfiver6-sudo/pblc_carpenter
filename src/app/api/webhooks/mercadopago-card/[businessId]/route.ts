// POST /api/webhooks/mercadopago-card/[businessId]
//
// Card-payment-specific webhook. MercadoPago Checkout Pro fires here (instead
// of the generic /api/webhooks/mercadopago) because we embed this URL as
// `notification_url` inside each preference. That gives us businessId in the
// path, so we can fetch the right access token and look up the payment record
// by `external_reference` (= our payments.id) without scanning the whole table.
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { safeDecryptToken } from "@/lib/security/encrypt"
import { verifyMercadoPagoSignature } from "@/lib/security/webhook-verify"
import { getMpPaymentDetails, processWebhookEvent } from "@/lib/payments/mercadopago"
import { checkRateLimit } from "@/lib/rate-limit"

interface WebhookBody {
  action: string
  data: { id: string }
}

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return false
  const signatureHeader = req.headers.get("x-signature") ?? ""
  const requestId = req.headers.get("x-request-id") ?? ""
  let dataId = ""
  try {
    dataId = (JSON.parse(rawBody) as WebhookBody).data?.id ?? ""
  } catch {
    return false
  }
  return verifyMercadoPagoSignature(signatureHeader, requestId, dataId, secret)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
): Promise<NextResponse> {
  const { businessId } = await params

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed } = await checkRateLimit(`webhook-card:${ip}`, 500, 3_600_000)
  if (!allowed) {
    // Silently drop (200) so callers can't probe the limit, but log for monitoring
    console.error("[MP Card Webhook] Rate limit exceeded — dropping request", { ip, businessId })
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  if (!verifySignature(req, rawBody)) {
    console.warn("[MP Card Webhook] Invalid signature for business", businessId)
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: WebhookBody
  try {
    body = JSON.parse(rawBody) as WebhookBody
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  if (body.action !== "payment.updated") {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const mpPaymentId = body.data?.id
  if (!mpPaymentId) return NextResponse.json({ ok: true }, { status: 200 })

  try {
    const admin = createAdminClient()

    // 1. Fetch the business access token — we know businessId from the URL
    const { data: biz } = await admin
      .from("businesses")
      .select("mercadopago_access_token")
      .eq("id", businessId)
      .single()

    const accessToken = safeDecryptToken(
      (biz as { mercadopago_access_token: string | null } | null)?.mercadopago_access_token ?? null
    )
    if (!accessToken) {
      console.error("[MP Card Webhook] No token for business", businessId)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // 2. Fetch payment details from MP — get externalReference (= our payments.id)
    const { status, externalReference } = await getMpPaymentDetails(mpPaymentId, accessToken)

    if (!externalReference) {
      console.warn("[MP Card Webhook] Payment has no external_reference", mpPaymentId)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // 3. Look up our payment record by external_reference (= payments.id)
    const { data: paymentRecord } = await admin
      .from("payments")
      .select("id, status, mercadopago_payment_id")
      .eq("id", externalReference)
      .eq("business_id", businessId)
      .single()

    if (!paymentRecord) {
      // Not our record or wrong business
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const record = paymentRecord as { id: string; status: string; mercadopago_payment_id: string | null }

    // Idempotency: skip if already terminal
    if (record.status === "paid" || record.status === "failed") {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 })
    }

    // 4. If we don't have the MP payment ID stored yet, stamp it — this lets
    //    processWebhookEvent (which looks up by mercadopago_payment_id) find it.
    if (!record.mercadopago_payment_id) {
      await admin
        .from("payments")
        .update({ mercadopago_payment_id: mpPaymentId } as never)
        .eq("id", externalReference)
    }

    // 5. Bail early for non-terminal statuses to avoid unnecessary work
    if (status === "pending") {
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // 6. Delegate to the shared processor (handles work_item, customer stats,
    //    notifications, automations, email)
    await processWebhookEvent(mpPaymentId, accessToken, businessId)
  } catch (err) {
    console.error("[MP Card Webhook] Error:", err)
    // Always 200 so MP doesn't retry indefinitely
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
