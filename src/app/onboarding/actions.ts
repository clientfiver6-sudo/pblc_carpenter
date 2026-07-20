"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { safeEncryptToken } from "@/lib/security/encrypt"

export async function setupBusiness(data: {
  name: string
  type: string
  whatsapp_token?: string
  whatsapp_phone_id?: string
  // cnpj?: string  // CNPJ GATING: uncomment when enabling review flow
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { data: existingBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (existingBu) return {}

  // CNPJ GATING: when enabling review flow, set onboarded: false and
  // store cnpj in settings: { cnpj: data.cnpj }
  const { data: rawBusiness, error: bizError } = await admin
    .from("businesses")
    .insert({
      name: data.name,
      type: data.type,
      onboarded: true,
      opening_hours: {},
      settings: {},
      whatsapp_token: safeEncryptToken(data.whatsapp_token ?? null),
      whatsapp_phone_id: data.whatsapp_phone_id ?? null,
    } as never)
    .select("id")
    .single()

  if (bizError || !rawBusiness) {
    console.error("setupBusiness error:", bizError)
    return { error: "Erro ao criar negócio. Tente novamente." }
  }

  const business = rawBusiness as { id: string }

  const { error: buError } = await admin.from("business_users").insert({
    business_id: business.id,
    user_id: user.id,
    role: "owner",
  } as never)

  if (buError) {
    console.error("setupBusiness business_users error:", buError)
    return { error: "Erro ao vincular usuário ao negócio." }
  }

  return {}
}
