import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTextMessage, markAsRead } from "@/lib/whatsapp/client"
import { checkRateLimit } from "@/lib/rate-limit"
import { EVOLUTION_API_KEY } from "@/lib/env"
import { triggerLeadCreated } from "@/lib/automations/triggers"
import type { Customer, Conversation } from "@/types/database"

// Evolution API status → DB status mapping
const STATUS_MAP: Record<string, "sent" | "delivered" | "read"> = {
  PENDING: "sent",
  SERVER_ACK: "sent",
  DELIVERY_ACK: "delivered",
  READ: "read",
  PLAYED: "read",
}

// POST: Receive messages and status updates from Evolution API
export async function POST(req: NextRequest): Promise<Response> {
  // 0. IP-based rate limiting for webhook endpoints
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed: ipAllowed, resetAt: ipResetAt } = await checkRateLimit(`webhook:${ip}`, 1000, 3_600_000)
  if (!ipAllowed) {
    const retryAfter = Math.ceil((ipResetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Validate webhook came from our Evolution API server — fail closed if key not configured.
  if (!EVOLUTION_API_KEY) {
    console.error("[WhatsApp Webhook] EVOLUTION_API_KEY not set — rejecting request")
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 })
  }
  const incomingKey = String(req.headers.get("apikey") ?? payload.apikey ?? "")
  const keysMatch =
    incomingKey.length === EVOLUTION_API_KEY.length &&
    timingSafeEqual(Buffer.from(incomingKey), Buffer.from(EVOLUTION_API_KEY))
  if (!keysMatch) {
    console.warn("[WhatsApp Webhook] Invalid apikey rejected")
    return new Response("ok", { status: 200 }) // 200 so Evolution doesn't retry
  }

  const admin = createAdminClient()
  const instanceName: string = payload.instance
  if (!instanceName) return new Response("ok", { status: 200 })

  // Look up business by instanceName (stored in whatsapp_phone_id column)
  const { data: business } = await admin
    .from("businesses")
    .select("id, whatsapp_phone_id, whatsapp_ai_enabled")
    .eq("whatsapp_phone_id", instanceName)
    .single()

  if (!business) {
    // Unknown instance — return 200 silently to avoid Evolution API retries
    return new Response("ok", { status: 200 })
  }

  // ── Status updates ──────────────────────────────────────────────────────────
  if (payload.event === "messages.update") {
    for (const update of (payload.data ?? [])) {
      const msgId: string | undefined = update.key?.id
      const rawStatus: string | undefined = update.update?.status
      const dbStatus = rawStatus ? STATUS_MAP[rawStatus] : undefined
      if (msgId && dbStatus) {
        try {
          await admin
            .from("messages")
            .update({ status: dbStatus })
            .eq("whatsapp_message_id", msgId)
        } catch (err) {
          console.error("[WhatsApp Webhook] Failed to update message status", {
            businessId: business.id,
            messageId: msgId,
            status: rawStatus,
            error: err,
          })
        }
      }
    }
    return new Response("ok", { status: 200 })
  }

  // ── Connection state change ─────────────────────────────────────────────────
  if (payload.event === "connection.update") {
    const state = payload.data?.state
    if (state === "open") {
      const { data: biz } = await admin
        .from("businesses")
        .select("whatsapp_connected_at")
        .eq("id", business.id)
        .single()
      const wasConnected = !!(biz as { whatsapp_connected_at?: string | null } | null)?.whatsapp_connected_at

      await admin
        .from("businesses")
        .update({ whatsapp_connected_at: new Date().toISOString() } as never)
        .eq("id", business.id)

      // First connection → kick off history import
      if (!wasConnected) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL
        const cronSecret = process.env.CRON_SECRET
        if (appUrl && cronSecret) {
          fetch(`${appUrl}/api/whatsapp/import-history`, {
            method: "POST",
            headers: { "Content-Type": "application/json", authorization: `Bearer ${cronSecret}` },
            body: JSON.stringify({ businessId: business.id, instanceName }),
          }).catch(err => console.error("[webhook] import-history trigger failed", err))
        }
      }
    } else if (state === "close") {
      await admin
        .from("businesses")
        .update({ whatsapp_connected_at: null } as never)
        .eq("id", business.id)
    }
    return new Response("ok", { status: 200 })
  }

  // Silently ignore other non-message events
  if (payload.event !== "messages.upsert") {
    return new Response("ok", { status: 200 })
  }

  const data = payload.data

  // Skip messages sent by the business itself
  if (data?.key?.fromMe) return new Response("ok", { status: 200 })

  // ── Extract fields from Evolution API payload ───────────────────────────────
  const senderJid: string = data.key.remoteJid
  const senderPhone = senderJid.replace(/@s\.whatsapp\.net|@c\.us/g, "")
  const senderName: string = (data.pushName as string) ?? "Desconhecido"
  const messageId: string = data.key.id
  const timestamp = new Date(
    ((data.messageTimestamp as number) ?? Math.floor(Date.now() / 1000)) * 1000
  ).toISOString()

  // Determine message content
  const textBody: string | null =
    (data.message?.conversation as string) ??
    (data.message?.extendedTextMessage?.text as string) ??
    null

  const hasText = !!textBody
  const hasImage = data.messageType === "imageMessage" && !!data.message?.imageMessage
  const hasAudio = data.messageType === "audioMessage" && !!data.message?.audioMessage

  if (!hasText && !hasImage && !hasAudio) {
    // Unsupported payload type — ignore silently
    return new Response("ok", { status: 200 })
  }

  try {
    // Deduplication: skip if this message ID was already processed
    const { data: existingMsg } = await admin
      .from("messages")
      .select("id")
      .eq("whatsapp_message_id", messageId)
      .maybeSingle()
    if (existingMsg) return new Response("ok", { status: 200 })

    // Detect a brand-new lead (no customer row yet) before the upsert, so we can
    // fire the lead_created automation exactly once on first contact.
    const { data: priorCustomer } = await admin
      .from("customers")
      .select("id")
      .eq("business_id", business.id)
      .eq("phone_number", senderPhone)
      .maybeSingle()
    const isNewLead = !priorCustomer

    // Upsert customer — race-safe with unique constraint on (business_id, phone_number)
    const { data: rawCustomer } = await admin
      .from("customers")
      .upsert(
        {
          business_id: business.id,
          full_name: senderName,
          phone_number: senderPhone,
          lead_status: "new" as const,
          status: "active" as const,
          tags: [] as string[],
          total_spent: 0,
          visit_count: 0,
          metadata: {} as unknown as import("@/types/database").Json,
        } as unknown as import("@/types/database").CustomerInsert,
        { onConflict: "business_id,phone_number", ignoreDuplicates: false }
      )
      .select("id,full_name,phone_number,business_id")
      .single()
    const customer = rawCustomer as Customer | null

    if (!customer) {
      console.error("[WhatsApp Webhook] Failed to upsert customer", { businessId: business.id, senderPhone })
      return new Response("ok", { status: 200 })
    }

    // Fire lead_created automation on first contact (best-effort — never blocks the webhook)
    if (isNewLead) {
      void triggerLeadCreated(customer.id, business.id).catch((err) =>
        console.error("[WhatsApp Webhook] triggerLeadCreated failed:", err)
      )
    }

    // Find or create conversation — try-insert-or-reselect guards concurrent webhook calls
    let conversation: Conversation | null = null
    const { data: rawExistingConv } = await admin
      .from("conversations")
      .select("id,ai_active,unread_count,status")
      .eq("business_id", business.id)
      .eq("customer_id", customer.id)
      .in("status", ["open", "waiting", "bot"])
      .maybeSingle()
    conversation = rawExistingConv as Conversation | null

    if (!conversation) {
      const { data: rawNewConv, error: convErr } = await admin
        .from("conversations")
        .insert({
          business_id: business.id,
          customer_id: customer.id,
          channel: "whatsapp" as const,
          status: "bot" as const,
          ai_active: true,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
          metadata: {},
        })
        .select("id,ai_active,unread_count,status")
        .single()
      if (convErr && (convErr as { code?: string }).code === "23505") {
        const { data: raceWinner } = await admin
          .from("conversations")
          .select("id,ai_active,unread_count,status")
          .eq("business_id", business.id)
          .eq("customer_id", customer.id)
          .in("status", ["open", "waiting", "bot"])
          .maybeSingle()
        conversation = raceWinner as Conversation | null
      } else {
        conversation = rawNewConv as Conversation | null
      }
    }

    if (!conversation) {
      console.error("[WhatsApp Webhook] Failed to find or create conversation", {
        businessId: business.id,
        customerId: customer.id,
      })
      return new Response("ok", { status: 200 })
    }

    // Image magic-byte signatures: JPEG (FF D8 FF), PNG (89 50 4E 47), WebP (52 49 46 46)
    function isValidImageBytes(buf: Buffer): boolean {
      if (buf.length < 4) return false
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
      const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
      const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      return isJpeg || isPng || isWebp
    }

    // Audio magic-byte signatures: OGG (4F 67 67 53), MP4/M4A (ftyp at offset 4), OPUS
    function isValidAudioBytes(buf: Buffer): boolean {
      if (buf.length < 4) return false
      const isOgg = buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53
      const isMp4 = buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70
      return isOgg || isMp4
    }

    // ── Media: download from Evolution API URL and store in Supabase ───────────
    let imageStorageUrl: string | null = null
    if (hasImage && data.message?.imageMessage?.url) {
      const imgUrl = data.message.imageMessage.url as string
      const mediaController = new AbortController()
      const mediaTimeoutId = setTimeout(() => mediaController.abort(), 10_000)
      try {
        const mediaRes = await fetch(imgUrl, { signal: mediaController.signal })
        if (!mediaRes.ok) throw new Error(`Media fetch failed ${mediaRes.status}`)
        const contentLength = parseInt(mediaRes.headers.get("content-length") ?? "0", 10)
        if (contentLength > 10 * 1024 * 1024) throw new Error("Media file too large (>10MB)")
        const arrayBuffer = await mediaRes.arrayBuffer()
        const buf = Buffer.from(arrayBuffer)
        if (!isValidImageBytes(buf)) throw new Error("Image magic bytes invalid — rejecting")
        const contentType = mediaRes.headers.get("content-type") ?? "image/jpeg"
        const storagePath = `${business.id}/${messageId}.jpg`
        const { error: uploadError } = await admin.storage
          .from("whatsapp-media")
          .upload(storagePath, buf, { contentType, upsert: true })
        if (!uploadError) {
          const { data: { publicUrl } } = admin.storage.from("whatsapp-media").getPublicUrl(storagePath)
          imageStorageUrl = publicUrl
        }
      } catch (e) {
        console.error("[webhook] media download failed", { url: imgUrl, error: e })
        // continue without image — imageStorageUrl stays null
      } finally {
        clearTimeout(mediaTimeoutId)
      }
    }

    let audioStorageUrl: string | null = null
    if (hasAudio && data.message?.audioMessage?.url) {
      const audioUrl = data.message.audioMessage.url as string
      const audioController = new AbortController()
      const audioTimeoutId = setTimeout(() => audioController.abort(), 10_000)
      try {
        const mediaRes = await fetch(audioUrl, { signal: audioController.signal })
        if (!mediaRes.ok) throw new Error(`Media fetch failed ${mediaRes.status}`)
        const contentLength = parseInt(mediaRes.headers.get("content-length") ?? "0", 10)
        if (contentLength > 10 * 1024 * 1024) throw new Error("Media file too large (>10MB)")
        const arrayBuffer = await mediaRes.arrayBuffer()
        const buf = Buffer.from(arrayBuffer)
        if (!isValidAudioBytes(buf)) throw new Error("Audio magic bytes invalid — rejecting")
        const contentType = mediaRes.headers.get("content-type") ?? "audio/ogg"
        const storagePath = `${business.id}/${messageId}.ogg`
        const { error: uploadError } = await admin.storage
          .from("whatsapp-media")
          .upload(storagePath, buf, { contentType, upsert: true })
        if (!uploadError) {
          const { data: { publicUrl } } = admin.storage.from("whatsapp-media").getPublicUrl(storagePath)
          audioStorageUrl = publicUrl
        }
      } catch (e) {
        console.error("[webhook] media download failed", { url: audioUrl, error: e })
        // continue without audio — audioStorageUrl stays null
      } finally {
        clearTimeout(audioTimeoutId)
      }
    }

    // Determine effective message type and content for DB
    const messageType = hasText ? "text" : hasImage ? "image" : "audio"
    const imageCaption = data.message?.imageMessage?.caption as string | undefined
    const messageContent = textBody ?? imageCaption ?? ""
    const messageMetadata: Record<string, string> = {}
    if (imageStorageUrl) messageMetadata.media_url = imageStorageUrl
    if (audioStorageUrl) messageMetadata.media_url = audioStorageUrl
    if (hasImage && data.message?.imageMessage?.url) messageMetadata.original_url = data.message.imageMessage.url as string
    if (hasAudio && data.message?.audioMessage?.url) messageMetadata.original_url = data.message.audioMessage.url as string

    // Insert inbound message — unique index on whatsapp_message_id prevents duplicates on Evolution API retries
    const { error: insertErr } = await admin.from("messages").insert({
      conversation_id: conversation.id,
      business_id: business.id,
      direction: "inbound",
      content: messageContent,
      message_type: messageType as import("@/types/database").MessageType,
      whatsapp_message_id: messageId,
      sent_by: null,
      status: "delivered" as import("@/types/database").MessageStatus,
      sent_at: timestamp,
      metadata: messageMetadata as unknown as import("@/types/database").Json,
    })

    if (insertErr) {
      if ((insertErr as { code?: string }).code === "23505") {
        // Duplicate — Evolution API retry, ignore
        return new Response("ok", { status: 200 })
      }
      throw insertErr
    }

    // Update conversation (atomic unread increment avoids read-then-write race)
    await admin
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() } as unknown as import("@/types/database").ConversationUpdate)
      .eq("id", conversation.id)
    await admin.rpc("increment_conversation_unread" as never, { p_conversation_id: conversation.id } as never)

    // NOTE: inbound messages do NOT create a notification. Unread conversations
    // are surfaced as a live count in the notification bell + sidebar instead
    // (conversations.unread_count), so we don't spam the bell with one row per message.

    // Mark as read via Evolution API
    try {
      await markAsRead({ messageId, phone: senderPhone, fromMe: false, instanceName })
    } catch (e) {
      console.error("[WhatsApp Webhook] markAsRead error", {
        businessId: business.id,
        messageId,
        error: e,
      })
    }

    // Only run AI for text messages
    if (hasText && textBody) {
      // Throttle: skip if AI replied less than 2 minutes ago (handles double-taps)
      const { data: lastAiMsg } = await admin
        .from("messages")
        .select("sent_at")
        .eq("conversation_id", conversation.id)
        .eq("direction", "outbound")
        .eq("sent_by", "ai")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      const aiTooSoon = lastAiMsg?.sent_at
        ? Date.now() - new Date(lastAiMsg.sent_at).getTime() < 120_000
        : false

      const bizAiEnabled = (business as { whatsapp_ai_enabled?: boolean }).whatsapp_ai_enabled === true
      if (bizAiEnabled && conversation.ai_active && !aiTooSoon) {
        const { allowed: receptionistAllowed } = await checkRateLimit(`receptionist:${business.id}`, 150, 3_600_000)
        if (!receptionistAllowed) {
          console.warn(`[Receptionist] Hourly rate limit hit for business ${business.id}`)
        } else
        try {
          const { runReceptionist } = await import("@/lib/ai/receptionist").catch(() => ({
            runReceptionist: null,
          }))

          let aiReply: string | null = null
          if (runReceptionist) {
            aiReply = await runReceptionist({
              businessId: business.id,
              conversationId: conversation.id,
              inboundMessage: textBody,
              customerPhone: senderPhone,
            })
          }

          // __SKIP__ means the AI detected an off-topic message — stay silent
          if (aiReply && !aiReply.trim().startsWith("__SKIP__")) {
            // Save outbound message before sending (with sent_by:"ai" for UI styling)
            await admin.from("messages").insert({
              conversation_id: conversation.id,
              business_id: business.id,
              direction: "outbound",
              content: aiReply,
              message_type: "text" as import("@/types/database").MessageType,
              whatsapp_message_id: null,
              sent_by: "ai",
              status: "sending" as import("@/types/database").MessageStatus,
              sent_at: new Date().toISOString(),
              metadata: {} as unknown as import("@/types/database").Json,
            })

            try {
              const waId = await sendTextMessage({ to: senderPhone, text: aiReply, instanceName })

              // Update the saved outbound message with the WhatsApp message ID
              await admin
                .from("messages")
                .update({ whatsapp_message_id: waId, status: "sent" as import("@/types/database").MessageStatus })
                .eq("conversation_id", conversation.id)
                .eq("direction", "outbound")
                .eq("status", "sending")
                .order("sent_at", { ascending: false })
                .limit(1)
            } catch (err) {
              console.error("[WhatsApp Webhook] AI reply send failed", {
                instanceName,
                senderPhone,
                error: err instanceof Error ? err.message : err,
              })
              // intentionally not rethrowing — return 200 below
            }
          }
        } catch (err) {
          console.error("[WhatsApp Webhook] AI receptionist error", {
            businessId: business.id,
            conversationId: conversation.id,
            error: err,
          })
        }
      }
    }
  } catch (err) {
    console.error("[WhatsApp Webhook] Unhandled error processing message", {
      businessId: business.id,
      messageId,
      senderPhone,
      error: err,
    })
  }

  // Always return 200 — Evolution API retries on non-200
  return new Response("ok", { status: 200 })
}
