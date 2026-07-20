"use server"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

function generatePathSuffix(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export async function createWebhookEndpoint(data: {
  name: string
  provider: string
  event_map: Record<string, string>
  secret?: string
}): Promise<{ error?: string; id?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { data: bu } = await supabase.from("business_users").select("business_id").eq("user_id", user.id).single()
  if (!bu) return { error: "Negócio não encontrado" }

  const { data: result, error } = await supabase
    .from("webhook_endpoints")
    .insert({
      business_id: (bu as { business_id: string }).business_id,
      name: data.name,
      provider: data.provider,
      path_suffix: generatePathSuffix(),
      secret: data.secret ?? null,
      event_map: data.event_map as never,
      active: true,
    } as never)
    .select("id")
    .single()

  if (error) return { error: error.message }
  revalidatePath("/dashboard/settings/webhooks")
  return { id: (result as { id: string }).id }
}

export async function deleteWebhookEndpoint(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { error } = await supabase.from("webhook_endpoints").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/settings/webhooks")
  return {}
}

export async function toggleWebhookActive(id: string, active: boolean): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autorizado" }

  const { error } = await supabase.from("webhook_endpoints").update({ active } as never).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/settings/webhooks")
  return {}
}
