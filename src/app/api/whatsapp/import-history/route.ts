import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBusinessId } from "@/lib/auth/actions"
import { checkRateLimit } from "@/lib/rate-limit"
import { fetchChats, fetchMessages, type EvolutionChat } from "@/lib/whatsapp/client"

// Allow up to 5 minutes for large imports on Vercel Pro
export const maxDuration = 300

// Returns true when the string looks like a raw phone number, not a real name
function looksLikePhone(s: string): boolean {
  return /^\+?[\d\s\-().]+$/.test(s.trim())
}

// Picks the best display name from the data available
function resolveName(chatName: string, pushName?: string, phone?: string): string {
  if (chatName && !looksLikePhone(chatName)) return chatName
  if (pushName && !looksLikePhone(pushName)) return pushName
  return phone ?? chatName
}

type ImportStats = { customers: number; conversations: number; messages: number }

async function processChat(
  chat: EvolutionChat,
  businessId: string,
  instanceName: string,
  admin: ReturnType<typeof createAdminClient>,
  stats: ImportStats
): Promise<void> {
  const jid = chat.id
  const rawPhone = jid.replace(/@s\.whatsapp\.net|@c\.us/g, "")
  const contactName = resolveName(chat.name, chat.lastMessage?.pushName, rawPhone)

  const messages = await fetchMessages(instanceName, jid, 50)

  // Only import text messages — skip media (audio/image) for history
  const textMessages = messages.filter(m => {
    const text = m.message?.conversation ?? m.message?.extendedTextMessage?.text
    return !!text
  })

  if (textMessages.length === 0) return

  // ── Customer ────────────────────────────────────────────────────────────────
  const { data: existingRaw } = await admin
    .from("customers")
    .select("id, full_name")
    .eq("business_id", businessId)
    .eq("phone_number", rawPhone)
    .maybeSingle()

  const existing = existingRaw as { id: string; full_name: string } | null
  let customerId: string

  if (existing) {
    customerId = existing.id
    // Update name only when the stored name is just a phone number
    if (looksLikePhone(existing.full_name) && !looksLikePhone(contactName)) {
      await admin
        .from("customers")
        .update({ full_name: contactName } as never)
        .eq("id", customerId)
    }
  } else {
    const inboundCount = textMessages.filter(m => !m.key.fromMe).length
    const { data: newRaw } = await admin
      .from("customers")
      .insert({
        business_id: businessId,
        full_name: contactName,
        phone_number: rawPhone,
        lead_status: "completed" as const,
        status: "active" as const,
        tags: [] as string[],
        total_spent: 0,
        visit_count: inboundCount,
        metadata: {} as never,
      } as never)
      .select("id")
      .single()
    if (!newRaw) return
    customerId = (newRaw as { id: string }).id
    stats.customers++
  }

  // ── Conversation ────────────────────────────────────────────────────────────
  const { data: existingConvRaw } = await admin
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .maybeSingle()

  let conversationId: string

  const latestTs = textMessages.reduce(
    (max, m) => Math.max(max, m.messageTimestamp ?? 0),
    0
  )
  const lastMessageAt = new Date(latestTs * 1000).toISOString()

  if (existingConvRaw) {
    conversationId = (existingConvRaw as { id: string }).id
    // Refresh last_message_at if historical data is newer
    await admin
      .from("conversations")
      .update({ last_message_at: lastMessageAt } as never)
      .eq("id", conversationId)
  } else {
    const { data: newConvRaw } = await admin
      .from("conversations")
      .insert({
        business_id: businessId,
        customer_id: customerId,
        channel: "whatsapp" as const,
        status: "open" as const,
        ai_active: false,
        last_message_at: lastMessageAt,
        unread_count: 0,
        metadata: {},
      })
      .select("id")
      .single()
    if (!newConvRaw) return
    conversationId = (newConvRaw as { id: string }).id
    stats.conversations++
  }

  // ── Messages (batch upsert, duplicates ignored) ────────────────────────────
  const msgRows = textMessages.map(m => {
    const text = m.message?.conversation ?? m.message?.extendedTextMessage?.text ?? ""
    const sentAt = new Date((m.messageTimestamp ?? 0) * 1000).toISOString()
    return {
      conversation_id: conversationId,
      business_id: businessId,
      direction: m.key.fromMe ? "outbound" : "inbound",
      content: text,
      message_type: "text" as const,
      whatsapp_message_id: m.key.id,
      sent_by: null,
      status: "read" as const,
      sent_at: sentAt,
      metadata: {} as never,
    }
  })

  const { data: inserted } = await admin
    .from("messages")
    .upsert(msgRows as never, { onConflict: "whatsapp_message_id", ignoreDuplicates: true })
    .select("id")

  stats.messages += (inserted as unknown[] | null)?.length ?? 0
}

// POST: Import WhatsApp chat history for a business.
// Auth: user session OR internal trigger via Authorization: Bearer <CRON_SECRET>
export async function POST(req: NextRequest): Promise<NextResponse> {
  let businessId: string | null = null
  let instanceName: string | null = null

  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const body = await req.json().catch(() => ({})) as { businessId?: string; instanceName?: string }
    businessId = body.businessId ?? null
    instanceName = body.instanceName ?? null
  } else {
    businessId = await getBusinessId()
  }

  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Imports are expensive (up to 200 contacts × 50 messages of Evolution API
  // calls + bulk inserts) — cap per business even for cron-authenticated calls.
  const { allowed } = await checkRateLimit(`whatsapp-import:${businessId}`, 5, 3_600_000)
  if (!allowed) {
    return NextResponse.json({ error: "Limite de importações atingido. Tente novamente em 1 hora." }, { status: 429 })
  }

  const admin = createAdminClient()

  if (!instanceName) {
    const { data: biz } = await admin
      .from("businesses")
      .select("whatsapp_phone_id")
      .eq("id", businessId)
      .single()
    instanceName = (biz as { whatsapp_phone_id?: string } | null)?.whatsapp_phone_id ?? null
  }

  if (!instanceName) {
    return NextResponse.json({ error: "WhatsApp not configured" }, { status: 422 })
  }

  const bizId = businessId // narrowed for closures

  const chats = await fetchChats(instanceName)

  // Individual contacts only — skip groups (@g.us) and broadcast lists
  const contacts = chats
    .filter(c => c.id.endsWith("@s.whatsapp.net"))
    .slice(0, 200)

  const stats: ImportStats = { customers: 0, conversations: 0, messages: 0 }

  // Process 5 contacts in parallel to balance speed vs API load
  const CHUNK = 5
  for (let i = 0; i < contacts.length; i += CHUNK) {
    const batch = contacts.slice(i, i + CHUNK)
    await Promise.allSettled(
      batch.map(chat =>
        processChat(chat, bizId, instanceName!, admin, stats).catch(err =>
          console.error("[import-history] processChat error", { jid: chat.id, err })
        )
      )
    )
  }

  console.log("[import-history] done", { businessId: bizId, ...stats })
  return NextResponse.json({ ok: true, chats: contacts.length, ...stats })
}
