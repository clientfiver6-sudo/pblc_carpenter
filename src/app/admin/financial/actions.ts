"use server"

import { getPlatformConfig, setPlatformConfig } from "@/lib/platform-config"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.app_metadata?.is_admin) throw new Error("Forbidden")
}

export async function saveMercadoPagoToken(token: string): Promise<{ error?: string }> {
  await requireAdmin()
  const t = token.trim()
  if (!t) return { error: "Token não pode ser vazio." }
  if (!t.startsWith("APP_USR-")) return { error: "Token inválido — deve começar com APP_USR-" }
  await setPlatformConfig("mercadopago_platform_access_token", t)
  revalidatePath("/admin/financial")
  return {}
}

export async function createMercadoPagoPlans(): Promise<{
  starterId?: string
  proId?: string
  medicalId?: string
  error?: string
}> {
  await requireAdmin()
  const token = await getPlatformConfig("mercadopago_platform_access_token")
  if (!token) return { error: "Access Token não configurado. Salve o token primeiro." }

  async function createPlan(reason: string, amount: number) {
    const res = await fetch("https://api.mercadopago.com/preapproval_plan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        reason,
        auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: amount, currency_id: "BRL" },
        back_url: `${APP_URL}/dashboard/settings/subscription?sub=success`,
        payment_methods_allowed: { payment_types: [{ id: "credit_card" }] },
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message ?? `MP error ${res.status}`)
    return data.id as string
  }

  try {
    const [starterId, proId, medicalId] = await Promise.all([
      createPlan("RetornAI Starter", 149.90),
      createPlan("RetornAI Pro", 199.90),
      createPlan("RetornAI Medical", 249.90),
    ])
    await Promise.all([
      setPlatformConfig("mercadopago_starter_plan_id", starterId),
      setPlatformConfig("mercadopago_pro_plan_id", proId),
      setPlatformConfig("mercadopago_medical_plan_id", medicalId),
    ])
    revalidatePath("/admin/financial")
    return { starterId, proId, medicalId }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao criar planos no Mercado Pago." }
  }
}
