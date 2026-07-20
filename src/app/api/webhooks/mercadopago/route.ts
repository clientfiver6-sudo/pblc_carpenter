// POST: Mercado Pago webhook notifications
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { processWebhookEvent } from "@/lib/payments/mercadopago"
import { safeDecryptToken } from "@/lib/security/encrypt"
import { verifyMercadoPagoSignature } from "@/lib/security/webhook-verify"
import { checkRateLimit } from "@/lib/rate-limit"

// ---------------------------------------------------------------------------
// Webhook body types
// ---------------------------------------------------------------------------

interface MercadoPagoWebhookBody {
  action: string
  api_version?: string
  data: {
    id: string
  }
  date_created?: string
  id?: number
  live_mode?: boolean
  type?: string
  user_id?: string
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifyMpSignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return false // Fail closed — reject unsigned webhooks

  const signatureHeader = req.headers.get("x-signature") ?? ""
  const requestId = req.headers.get("x-request-id") ?? ""

  // Parse data.id from body for the HMAC manifest
  let dataId = ""
  try {
    const parsed = JSON.parse(rawBody) as MercadoPagoWebhookBody
    dataId = parsed.data?.id ?? ""
  } catch {
    return false
  }

  // Delegate to the shared, constant-time (timingSafeEqual) verifier.
  return verifyMercadoPagoSignature(signatureHeader, requestId, dataId, secret)
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed: ipAllowed, resetAt: ipResetAt } = await checkRateLimit(`webhook:${ip}`, 1000, 3_600_000)
  if (!ipAllowed) {
    const retryAfter = Math.ceil((ipResetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    // Always return 200 to prevent MP retries
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  if (!verifyMpSignature(req, rawBody)) {
    console.warn("[MP Webhook] Invalid or missing signature — rejecting request")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: MercadoPagoWebhookBody
  try {
    body = JSON.parse(rawBody) as MercadoPagoWebhookBody
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // 2. Only process payment.updated actions
  if (body.action !== "payment.updated") {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const mpPaymentId = body.data?.id
  if (!mpPaymentId) {
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  try {
    const admin = createAdminClient()

    // 3. Find business by mercadopago_payment_id — webhook doesn't include businessId
    const { data: paymentRecord, error: findError } = await admin
      .from("payments")
      .select("business_id")
      .eq("mercadopago_payment_id", mpPaymentId)
      .single()

    if (findError || !paymentRecord) {
      // Payment not found — might be from a different system; ignore silently
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const businessId = paymentRecord.business_id

    // Fetch full payment record to check terminal state (idempotency guard)
    const { data: localPayment } = await admin
      .from("payments")
      .select("status")
      .eq("mercadopago_payment_id", mpPaymentId)
      .eq("business_id", businessId)
      .single()

    // Skip reprocessing if already in a terminal state
    if (localPayment && (localPayment.status === "paid" || localPayment.status === "failed")) {
      console.log(`[MP Webhook] Payment ${mpPaymentId} already in terminal state ${localPayment.status}, skipping`)
      return NextResponse.json({ ok: true, skipped: true })
    }

    // Fetch access token for this business
    const { data: business, error: bizError } = await admin
      .from("businesses")
      .select("mercadopago_access_token")
      .eq("id", businessId)
      .single()

    if (bizError || !business?.mercadopago_access_token) {
      console.error("mercadopago webhook: token não encontrado para business", businessId)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const accessToken = safeDecryptToken(business.mercadopago_access_token)
    if (!accessToken) {
      console.error("mercadopago webhook: falha ao descriptografar token para business", businessId)
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // 5. Process the event
    await processWebhookEvent(mpPaymentId, accessToken, businessId)
  } catch (err) {
    console.error("mercadopago webhook processamento erro:", err)
    // Always return 200 to prevent MP retries
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
