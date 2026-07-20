import { createHmac } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildGatherTwiML, buildSayTwiML, buildHangupTwiML } from "@/lib/voice/twilio"
import { runReceptionist } from "@/lib/ai/receptionist"
import { checkRateLimit } from "@/lib/rate-limit"

function verifyTwilioSignature(authToken: string, signature: string, url: string, params: Record<string, string>): boolean {
  // Twilio HMAC-SHA1: sort params alphabetically, concatenate key+value to URL, then sign
  const sortedStr = Object.keys(params).sort().reduce((acc, key) => acc + key + params[key], url)
  const expected = createHmac("sha1", authToken).update(sortedStr).digest("base64")
  return expected === signature
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed: ipAllowed, resetAt: ipResetAt } = await checkRateLimit(`webhook:${ip}`, 1000, 3_600_000)
  if (!ipAllowed) {
    const retryAfter = Math.ceil((ipResetAt - Date.now()) / 1000)
    return new Response("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    })
  }

  const formData = await req.formData()
  const params = Object.fromEntries(formData.entries()) as Record<string, string>

  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = req.headers.get("x-twilio-signature") ?? ""
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/voice`

  // Verify signature when an auth token is configured (skip in local dev).
  if (authToken && signature) {
    if (!verifyTwilioSignature(authToken, signature, url, params)) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  const callSid = params.CallSid
  const to = params.To
  const from = params.From
  const speechResult = params.SpeechResult ?? null
  const forwardedFrom = params.ForwardedFrom ?? null

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get("host")}`
  const actionUrl = `${baseUrl}/api/webhooks/twilio/voice`

  if (!callSid || !to) {
    return new Response(buildHangupTwiML("Desculpe, ocorreu um erro técnico."), {
      headers: { "Content-Type": "text/xml" },
    })
  }

  // Initial call — no speech yet
  if (!speechResult) {
    return new Response(buildGatherTwiML(actionUrl), {
      headers: { "Content-Type": "text/xml" },
    })
  }

  try {
    const admin = createAdminClient()

    // Find business by dialed or forwarded phone number
    const cleanTo = to.replace(/\D/g, "")
    const cleanForwarded = forwardedFrom ? forwardedFrom.replace(/\D/g, "") : null

    const { data: rawBusinesses } = await admin
      .from("businesses")
      .select("id, whatsapp_number, voice_number, settings")
      .limit(200)

    const businesses = rawBusinesses as Array<{
      id: string
      whatsapp_number: string | null
      voice_number: string | null
      settings: Record<string, unknown> | null
    }> | null

    const business = businesses?.find((b) => {
      // 1. If forwarded, match business's voice_number or whatsapp_number with the forwarded number
      if (cleanForwarded) {
        const vNum = String(b.voice_number ?? "").replace(/\D/g, "")
        if (vNum && cleanForwarded.endsWith(vNum.slice(-10))) return true

        const waNum = String(b.whatsapp_number ?? "").replace(/\D/g, "")
        if (waNum && cleanForwarded.endsWith(waNum.slice(-10))) return true
      }

      // 2. Match with settings twilio_phone_number or voice_number or whatsapp_number using cleanTo
      const twNum = String(b.settings?.twilio_phone_number ?? "").replace(/\D/g, "")
      if (twNum && cleanTo.endsWith(twNum.slice(-10))) return true

      const vNum = String(b.voice_number ?? "").replace(/\D/g, "")
      if (vNum && cleanTo.endsWith(vNum.slice(-10))) return true

      const waNum = String(b.whatsapp_number ?? "").replace(/\D/g, "")
      if (waNum && cleanTo.endsWith(waNum.slice(-10))) return true

      return false
    })

    if (!business) {
      return new Response(buildHangupTwiML("Desculpe, não encontramos esse negócio em nosso sistema."), {
        headers: { "Content-Type": "text/xml" },
      })
    }

    // Get or create voice conversation
    const { data: existingConv } = await admin
      .from("conversations")
      .select("id")
      .eq("business_id", business.id)
      .contains("metadata", { call_sid: callSid } as never)
      .limit(1)
      .single()

    let conversationId: string

    if (existingConv) {
      conversationId = (existingConv as { id: string }).id
    } else {
      const { data: newConv } = await admin
        .from("conversations")
        .insert({
          business_id: business.id,
          channel: "phone" as never,
          status: "bot",
          ai_active: true,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          metadata: { call_sid: callSid } as never,
        } as never)
        .select("id")
        .single()

      if (!newConv) {
        return new Response(buildHangupTwiML("Erro ao iniciar conversa."), {
          headers: { "Content-Type": "text/xml" },
        })
      }
      conversationId = (newConv as { id: string }).id

      // Save inbound message
      await admin.from("messages").insert({
        conversation_id: conversationId,
        business_id: business.id,
        direction: "inbound",
        content: speechResult,
        message_type: "text",
        status: "received",
        sent_at: new Date().toISOString(),
        metadata: { channel: "voice" } as never,
      } as never)
    }

    const aiResponse = await runReceptionist({
      businessId: business.id,
      conversationId,
      inboundMessage: speechResult,
      customerPhone: from,
    })

    return new Response(buildSayTwiML(aiResponse, actionUrl), {
      headers: { "Content-Type": "text/xml" },
    })
  } catch (err) {
    console.error("[Voice] Error:", err)
    return new Response(buildHangupTwiML("Desculpe, tive um problema técnico. Por favor, ligue novamente."), {
      headers: { "Content-Type": "text/xml" },
    })
  }
}
