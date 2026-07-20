import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendTextMessage } from "@/lib/whatsapp/client"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { to, message } = await request.json() as { to: string; message: string }
  if (!to || !message) {
    return NextResponse.json({ error: "Campos 'to' e 'message' são obrigatórios" }, { status: 400 })
  }

  const { allowed, resetAt } = await checkRateLimit(`whatsapp-test:${user.id}`, 10, 60_000)
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const bu = rawBu as { business_id: string } | null
  if (!bu) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 })

  const { data: rawBusiness } = await supabase
    .from("businesses")
    .select("whatsapp_phone_id")
    .eq("id", bu.business_id)
    .single()
  const business = rawBusiness as { whatsapp_phone_id: string | null } | null

  if (!business?.whatsapp_phone_id) {
    return NextResponse.json(
      { error: "Credenciais do WhatsApp não configuradas. Salve o Phone ID antes de testar." },
      { status: 400 }
    )
  }

  try {
    await sendTextMessage({
      to,
      text: message,
      instanceName: business.whatsapp_phone_id,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao enviar mensagem"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
