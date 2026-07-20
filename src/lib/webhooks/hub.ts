import crypto from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

const VALID_TRIGGER_TYPES = new Set([
  "booking_created", "booking_confirmed", "booking_24h_before", "booking_completed",
  "booking_cancelled", "booking_no_show", "payment_pending", "payment_received",
  "lead_created", "lead_inactive", "customer_inactive",
])

export function validateHmacSignature(
  secret: string,
  rawBody: string,
  signature: string,
): boolean {
  try {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export function mapEventToTrigger(
  eventType: string,
  eventMap: Record<string, string>,
): string | null {
  const trigger = eventMap[eventType]
  if (!trigger || !VALID_TRIGGER_TYPES.has(trigger)) return null
  return trigger
}

export async function processWebhookEvent(
  slug: string,
  rawBody: string,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; trigger?: string; error?: string }> {
  const admin = createAdminClient()

  const { data: rawEndpoint } = await admin
    .from("webhook_endpoints")
    .select("*")
    .eq("path_suffix", slug)
    .eq("active", true)
    .single()

  if (!rawEndpoint) return { ok: false, error: "Endpoint not found" }

  const endpoint = rawEndpoint as {
    id: string
    business_id: string
    secret: string | null
    event_map: Record<string, string>
    provider: string
  }

  // Validate signature if secret configured
  if (endpoint.secret) {
    const sigHeader = headers["x-webhook-signature"] ?? headers["x-hub-signature-256"] ?? ""
    const sig = sigHeader.replace("sha256=", "")
    if (!validateHmacSignature(endpoint.secret, rawBody, sig)) {
      return { ok: false, error: "Invalid signature" }
    }
  }

  // Extract event type from payload (provider-specific)
  const eventType = String(
    payload.event ?? payload.type ?? payload.event_type ?? payload.action ?? ""
  )

  const trigger = mapEventToTrigger(eventType, endpoint.event_map)
  if (!trigger) return { ok: true } // unknown event — silently accept

  // Log the webhook hit
  console.log(`[WebhookHub] ${endpoint.provider}/${slug} → trigger: ${trigger}`)

  return { ok: true, trigger }
}
