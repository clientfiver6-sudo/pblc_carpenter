"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { sendTextMessage } from "@/lib/whatsapp/client"
import { safeDecryptToken } from "@/lib/security/encrypt"

export async function sendMessage(conversationId: string, content: string): Promise<void> {
  const supabase = await createClient()

  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser()

  // Get conversation to obtain business_id and customer_id
  const { data: rawConv, error: convError } = await supabase
    .from("conversations")
    .select("business_id, customer_id, metadata")
    .eq("id", conversationId)
    .single()
  const conv = rawConv as { business_id: string; customer_id: string | null; metadata: unknown } | null

  if (convError || !conv) {
    throw new Error("Conversa não encontrada")
  }

  // Verify the authenticated user belongs to this conversation's business
  if (user) {
    const { data: rawBu } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", user.id)
      .single()
    const bu = rawBu as { business_id: string } | null
    if (!bu || bu.business_id !== conv.business_id) {
      throw new Error("Acesso negado")
    }
  }

  const now = new Date().toISOString()

  // Insert outbound message (initially with status "sending")
  const { data: rawMsg, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      business_id: conv.business_id,
      direction: "outbound",
      content,
      message_type: "text",
      status: "sending",
      sent_by: user?.id ?? null,
      metadata: {},
      sent_at: now,
    } as never)
    .select("id")
    .single()

  if (msgError) {
    throw new Error("Erro ao enviar mensagem")
  }

  const messageRow = rawMsg as { id: string } | null

  // Update conversation last_message_at
  await supabase
    .from("conversations")
    .update({ last_message_at: now } as never)
    .eq("id", conversationId)

  // Best-effort WhatsApp send
  if (messageRow?.id && conv.customer_id) {
    try {
      // Fetch the customer's phone number
      const { data: rawCustomer } = await supabase
        .from("customers")
        .select("phone_number")
        .eq("id", conv.customer_id)
        .single()
      const customer = rawCustomer as { phone_number: string | null } | null

      // Fetch the business WhatsApp credentials
      const { data: rawBusiness } = await supabase
        .from("businesses")
        .select("whatsapp_phone_id")
        .eq("id", conv.business_id)
        .single()
      const business = rawBusiness as {
        whatsapp_phone_id: string | null
      } | null

      if (
        customer?.phone_number &&
        business?.whatsapp_phone_id
      ) {
        // Normalize to E.164: strip non-digits, add Brazil code if missing
        const digits = customer.phone_number.replace(/\D/g, "")
        const to = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`

        const waMessageId = await sendTextMessage({
          to,
          text: content,
          instanceName: business.whatsapp_phone_id,
        })

        // Update message with WhatsApp message ID and confirmed status
        await supabase
          .from("messages")
          .update({ whatsapp_message_id: waMessageId, status: "sent" } as never)
          .eq("id", messageRow.id)
      }
    } catch (err) {
      console.error("sendMessage: WhatsApp send failed (non-fatal)", err)
      // Don't throw — the message is already persisted; WhatsApp delivery failure
      // should not break the UI.
    }
  }

  revalidatePath("/conversations")
}

export async function resolveConversation(conversationId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autenticado")

  const { data: rawBu } = await supabase
    .from("business_users").select("business_id").eq("user_id", user.id).single()
  const businessId = (rawBu as { business_id: string } | null)?.business_id
  if (!businessId) throw new Error("Sem negócio")

  const { error } = await supabase
    .from("conversations")
    .update({ status: "resolved" } as never)
    .eq("id", conversationId)
    .eq("business_id", businessId)

  if (error) {
    throw new Error("Erro ao resolver conversa")
  }

  revalidatePath("/conversations")
}

export async function toggleAI(conversationId: string): Promise<boolean> {
  const supabase = await createClient()

  // Get current value + conversation metadata for notification
  const { data: rawData, error: fetchError } = await supabase
    .from("conversations")
    .select("ai_active, business_id, metadata, customer_id")
    .eq("id", conversationId)
    .single()
  const data = rawData as {
    ai_active: boolean
    business_id: string
    metadata: unknown
    customer_id: string
  } | null

  if (fetchError || !data) {
    throw new Error("Conversa não encontrada")
  }

  const newValue = !data.ai_active

  if (newValue === false) {
    // Turning AI off — set status to "waiting" so staff know it needs human attention
    const { error } = await supabase
      .from("conversations")
      .update({ ai_active: false, status: "waiting" } as never)
      .eq("id", conversationId)

    if (error) {
      throw new Error("Erro ao alterar IA")
    }

    // Best-effort notification to assigned staff / business
    try {
      if (data.business_id) {
        const { createNotification } = await import("@/lib/notifications/actions")
        await createNotification({
          businessId: data.business_id,
          type: "handoff",
          title: "Conversa aguarda atendimento",
          body: "IA desativada — cliente aguarda resposta humana",
          link: `/dashboard/conversations?id=${conversationId}`,
        }).catch(() => {})
      }
    } catch {
      // Non-fatal — don't surface notification failures to the caller
    }
  } else {
    // Turning AI on — set status back to "bot"
    const { error } = await supabase
      .from("conversations")
      .update({ ai_active: true, status: "bot" } as never)
      .eq("id", conversationId)

    if (error) {
      throw new Error("Erro ao alterar IA")
    }
  }

  revalidatePath("/conversations")
  return newValue
}

export async function markAsRead(conversationId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: rawBu } = await supabase
    .from("business_users").select("business_id").eq("user_id", user.id).single()
  const businessId = (rawBu as { business_id: string } | null)?.business_id
  if (!businessId) return

  await supabase
    .from("conversations")
    .update({ unread_count: 0 } as never)
    .eq("id", conversationId)
    .eq("business_id", businessId)
}

export async function assignConversation(
  conversationId: string,
  staffId: string | null
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autenticado")

  const { data: rawBu } = await supabase
    .from("business_users").select("business_id").eq("user_id", user.id).single()
  const businessId = (rawBu as { business_id: string } | null)?.business_id
  if (!businessId) throw new Error("Sem negócio")

  // Get current metadata
  const { data: rawData2, error: fetchError } = await supabase
    .from("conversations")
    .select("metadata")
    .eq("id", conversationId)
    .eq("business_id", businessId)
    .single()
  const data2 = rawData2 as { metadata: unknown } | null

  if (fetchError || !data2) {
    throw new Error("Conversa não encontrada")
  }

  const existingMeta = (data2.metadata ?? {}) as Record<string, unknown>
  const updatedMeta = {
    ...existingMeta,
    assigned_staff_id: staffId,
  }

  const { error } = await supabase
    .from("conversations")
    .update({ metadata: updatedMeta } as never)
    .eq("id", conversationId)
    .eq("business_id", businessId)

  if (error) {
    throw new Error("Erro ao atribuir conversa")
  }

  revalidatePath("/conversations")
}

export async function sendPixInConversation(
  conversationId: string,
  amount: number,
  description: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Não autenticado" }

  const { data: rawConv } = await supabase
    .from("conversations")
    .select("business_id, customer_id")
    .eq("id", conversationId)
    .single()
  const conv = rawConv as { business_id: string; customer_id: string | null } | null
  if (!conv) return { ok: false, error: "Conversa não encontrada" }

  const { data: rawBiz } = await supabase
    .from("businesses")
    .select("whatsapp_phone_id, pix_key, pix_key_type, mercadopago_access_token")
    .eq("id", conv.business_id)
    .single()
  const biz = rawBiz as {
    whatsapp_phone_id: string | null
    pix_key: string | null
    pix_key_type: string | null
    mercadopago_access_token: string | null
  } | null
  if (!biz) return { ok: false, error: "Negócio não encontrado" }

  const { data: rawCustomer } = conv.customer_id
    ? await supabase.from("customers").select("phone_number, full_name, email").eq("id", conv.customer_id).single()
    : { data: null }
  const customer = rawCustomer as { phone_number: string | null; full_name: string; email: string | null } | null

  let messageText = ""

  // Try Mercado Pago first (check decrypted to confirm token actually exists)
  if (safeDecryptToken(biz.mercadopago_access_token)) {
    try {
      const { createPixPayment } = await import("@/lib/payments/mercadopago")
      const pix = await createPixPayment({
        businessId: conv.business_id,
        customerId: conv.customer_id ?? undefined,
        amount,
        description,
        customerEmail: customer?.email ?? undefined,
        customerName: customer?.full_name ?? undefined,
      })
      messageText = `*Pagamento via Pix*\n💰 Valor: R$ ${amount.toFixed(2)}\n📋 ${description}\n\n🔗 Pague pelo link:\n${pix.pixLink}\n\nOu copie o código Pix:\n${pix.pixCopyPaste}`

      // NOTE: createPixPayment() already inserted the payments row (in centavos).
      // Do NOT insert a second row here — that would double-count the charge.
    } catch {
      // fall through to PIX key
    }
  }

  // Fallback to PIX key
  if (!messageText && biz.pix_key) {
    messageText = `*Pagamento via Pix*\n💰 Valor: R$ ${amount.toFixed(2)}\n📋 ${description}\n\n🔑 Chave Pix (${biz.pix_key_type ?? ""}): ${biz.pix_key}`

    await supabase.from("payments").insert({
      business_id: conv.business_id,
      customer_id: conv.customer_id,
      amount: Math.round(amount * 100), // store in centavos, like every other payment insert
      description,
      method: "pix",
      status: "pending",
      metadata: { source: "conversation", conversation_id: conversationId },
    } as never)
  }

  if (!messageText) {
    return { ok: false, error: "Configure uma chave Pix ou Mercado Pago nas configurações primeiro." }
  }

  await sendMessage(conversationId, messageText)
  return { ok: true }
}
