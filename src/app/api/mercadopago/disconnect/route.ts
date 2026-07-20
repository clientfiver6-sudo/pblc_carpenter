import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { allowed, resetAt } = await checkRateLimit(`mp-disconnect:${user.id}`, 10, 3_600_000)
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
  if (!bu?.business_id) return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 })

  const { error } = await supabase
    .from("businesses")
    .update({ mercadopago_access_token: null, mercadopago_refresh_token: null } as never)
    .eq("id", bu.business_id)

  if (error) return NextResponse.json({ error: "Erro ao desconectar" }, { status: 500 })

  return NextResponse.json({ ok: true })
}
