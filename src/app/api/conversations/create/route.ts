import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const bu = rawBu as { business_id: string } | null
  if (!bu) return NextResponse.json({ error: "Sem negócio" }, { status: 403 })
  const businessId = bu.business_id

  const { allowed, resetAt } = await checkRateLimit(`conv-create:${businessId}`, 100, 3_600_000)
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  const body = await req.json().catch(() => ({})) as { customerId?: string }
  const { customerId } = body
  if (!customerId) return NextResponse.json({ error: "customerId obrigatório" }, { status: 400 })

  const admin = createAdminClient()

  // Check if a conversation already exists for this customer
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .not("status", "eq", "archived")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ conversationId: existing.id, created: false })
  }

  // Create new conversation
  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      channel: "whatsapp",
      status: "open",
      ai_active: true,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      metadata: {},
    })
    .select("id")
    .single()

  if (error || !created) {
    return NextResponse.json({ error: "Erro ao criar conversa" }, { status: 500 })
  }

  return NextResponse.json({ conversationId: created.id, created: true })
}
