import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyTwilioSignature } from "@/lib/security/webhook-verify"
import { sendTextMessage } from "@/lib/whatsapp/client"

export const dynamic = "force-dynamic"

// Twilio "Call Status Changes" callback (application/x-www-form-urlencoded).
// Configure this URL as the StatusCallback on the business's Twilio number so we
// learn when a call ended without being answered.
async function parseForm(req: NextRequest): Promise<Record<string, string>> {
  const text = await req.text()
  const params = new URLSearchParams(text)
  const obj: Record<string, string> = {}
  for (const [k, v] of params.entries()) obj[k] = v
  return obj
}

// Call statuses that mean the caller did not reach a human.
const MISSED_STATUSES = new Set(["no-answer", "busy", "failed", "canceled"])

const DEFAULT_TEMPLATE =
  "Olá! Vimos que você ligou para {{negocio}} e não conseguimos atender. " +
  "Como podemos ajudar? Responda por aqui e retornaremos o mais rápido possível."

export async function POST(req: NextRequest): Promise<NextResponse> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`).replace(/\/+$/, "")
  const url = `${baseUrl}/api/webhooks/twilio/status`
  const form = await parseForm(req)
  const signature = req.headers.get("x-twilio-signature") ?? ""
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? ""

  // Verify signature when an auth token is configured (skip only in local dev).
  if (authToken) {
    if (!verifyTwilioSignature(url, form, signature, authToken)) {
      return new NextResponse("Invalid signature", { status: 403 })
    }
  }

  // The status that applies depends on whether the number forwarded the call.
  const callStatus = (form.DialCallStatus || form.CallStatus || "").toLowerCase()
  const callSid = form.CallSid ?? ""
  const from = form.From ?? ""
  const forwardedFrom = form.ForwardedFrom ?? ""

  // Extract digits-only and + prefix versions for database matching
  const toDigits = (form.To ?? "").replace(/\D/g, "")
  const forwardedDigits = forwardedFrom.replace(/\D/g, "")

  // Only act on genuinely missed calls; acknowledge everything else.
  if (!MISSED_STATUSES.has(callStatus) || !from || (!toDigits && !forwardedDigits)) {
    return NextResponse.json({ ok: true })
  }

  try {
    const admin = createAdminClient()

    // Match the business by its configured voice number, falling back to the
    // WhatsApp number. Check both digits-only and + prefix versions for forwarded
    // and dialed numbers.
    const numberFilters: string[] = []
    if (forwardedDigits) {
      numberFilters.push(
        `voice_number.eq.${forwardedDigits}`,
        `voice_number.eq.+${forwardedDigits}`,
        `whatsapp_number.eq.${forwardedDigits}`,
        `whatsapp_number.eq.+${forwardedDigits}`
      )
    }
    if (toDigits) {
      numberFilters.push(
        `voice_number.eq.${toDigits}`,
        `voice_number.eq.+${toDigits}`,
        `whatsapp_number.eq.${toDigits}`,
        `whatsapp_number.eq.+${toDigits}`
      )
    }

    const { data: rawBiz } = await admin
      .from("businesses")
      .select("id, name, call_return_enabled, call_return_template, whatsapp_number, whatsapp_phone_id, voice_number")
      .or(numberFilters.join(","))
      .maybeSingle()
    const business = rawBiz as {
      id: string
      name: string
      call_return_enabled: boolean | null
      call_return_template: string | null
      whatsapp_number: string | null
      whatsapp_phone_id: string | null
      voice_number: string | null
    } | null

    if (!business) return NextResponse.json({ ok: true })

    // Idempotency: bail if we already recorded this CallSid.
    if (callSid) {
      const { data: existing } = await admin
        .from("missed_calls")
        .select("id")
        .eq("call_sid", callSid)
        .maybeSingle()
      if (existing) return NextResponse.json({ ok: true, deduped: true })
    }

    // Link to an existing customer by phone (match on last 9 digits), if any.
    const { data: rawCustomer } = await admin
      .from("customers")
      .select("id")
      .eq("business_id", business.id)
      .ilike("phone_number", `%${from.replace(/\D/g, "").slice(-9)}`)
      .limit(1)
      .maybeSingle()
    const customer = rawCustomer as { id: string } | null

    // Record the missed call first so it is never lost, even if WhatsApp fails.
    const { data: rawInserted } = await admin
      .from("missed_calls")
      .insert({
        business_id: business.id,
        customer_id: customer?.id ?? null,
        call_sid: callSid || null,
        from_number: from,
        status: callStatus,
      } as never)
      .select("id")
      .single()
    const inserted = rawInserted as { id: string } | null

    // Send the automatic WhatsApp follow-up when the feature is enabled and the
    // business has a connected WhatsApp (Evolution) instance.
    if (business.call_return_enabled && inserted && business.whatsapp_phone_id) {
      const template = business.call_return_template?.trim() || DEFAULT_TEMPLATE
      const message = template.replace(/\{\{\s*negocio\s*\}\}/g, business.name)

      try {
        const messageId = await sendTextMessage({
          to: from,
          text: message,
          instanceName: business.whatsapp_phone_id,
        })
        await admin
          .from("missed_calls")
          .update({ whatsapp_sent: true, whatsapp_message_id: messageId } as never)
          .eq("id", inserted.id)
      } catch (sendErr) {
        console.error("[Twilio Status] WhatsApp follow-up failed:", sendErr)
      }
    }
  } catch (err) {
    // Never fail the webhook — Twilio would retry and we'd double-process.
    console.error("[Twilio Status] error processing missed call:", err)
  }

  return NextResponse.json({ ok: true })
}
