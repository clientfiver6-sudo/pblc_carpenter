"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolvePromo } from "@/lib/subscription/promo"

export async function applyPromoCode(
  code: string
): Promise<{ success?: boolean; plan?: string; error?: string }> {
  const promo = resolvePromo(code)
  if (!promo) return { error: "Código promocional inválido." }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado." }

  const { data: bu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  if (!bu) return { error: "Negócio não encontrado." }

  const { business_id: businessId } = bu as { business_id: string }

  const admin = createAdminClient()
  const { error } = await admin
    .from("businesses")
    .update({
      subscription_plan: promo.plan,
      subscription_status: promo.status,
      subscription_ends_at: promo.endsAt,
    } as never)
    .eq("id", businessId)

  if (error) return { error: "Erro ao aplicar código. Tente novamente." }
  return { success: true, plan: promo.plan }
}
