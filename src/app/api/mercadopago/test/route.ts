// POST /api/mercadopago/test — validate the stored Mercado Pago access token
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { safeDecryptToken } from "@/lib/security/encrypt"

export async function POST(): Promise<NextResponse> {
  // 1. Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Não autorizado. Faça login para continuar." },
      { status: 401 }
    )
  }

  // 2. Resolve business_id
  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const bu = rawBu as { business_id: string } | null

  if (!bu?.business_id) {
    return NextResponse.json(
      { error: "Usuário não associado a nenhum negócio" },
      { status: 403 }
    )
  }

  const businessId = bu.business_id

  // 3. Rate limit: max 5 test attempts per business per minute
  const { allowed } = await checkRateLimit(`mp-test:${businessId}`, 5, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um momento e tente novamente." },
      { status: 429 }
    )
  }

  // 4. Fetch the access token via admin client (bypasses RLS)
  const admin = createAdminClient()
  const { data: rawBiz } = await admin
    .from("businesses")
    .select("mercadopago_access_token")
    .eq("id", businessId)
    .single()
  const biz = rawBiz as { mercadopago_access_token: string | null } | null

  const token = safeDecryptToken(biz?.mercadopago_access_token ?? null)

  // 5. No token stored yet
  if (!token) {
    return NextResponse.json({ ok: false, error: "Token não configurado" })
  }

  // 6. Probe the MP API with a lightweight endpoint
  let mpResponse: Response
  try {
    mpResponse = await fetch("https://api.mercadopago.com/v1/payment_methods", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
  } catch {
    return NextResponse.json({ ok: false, error: "Erro de rede ao contatar Mercado Pago" })
  }

  if (mpResponse.ok) {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: "Token inválido ou sem permissão" })
}
