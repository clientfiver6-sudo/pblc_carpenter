import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { deleteInstance } from "@/lib/whatsapp/client"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { allowed, resetAt } = await checkRateLimit(`whatsapp-disconnect:${user.id}`, 10, 3_600_000)
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

  // Fetch stored instance name to try both canonical and stored names
  const { data: rawBiz } = await supabase
    .from("businesses")
    .select("whatsapp_phone_id")
    .eq("id", bu.business_id)
    .single()
  const storedInstanceName = (rawBiz as { whatsapp_phone_id?: string | null } | null)?.whatsapp_phone_id

  const namesToTry = Array.from(new Set([
    `business-${bu.business_id}`,
    ...(storedInstanceName ? [storedInstanceName] : []),
  ]))

  for (const name of namesToTry) {
    try {
      await deleteInstance(name)
    } catch {
      // Instance may not exist under this name — continue
    }
  }

  const clearFields = {
    whatsapp_phone_id: null,
    whatsapp_token: null,
    whatsapp_connected_at: null,
  }

  // Use user's session client for the update (same pattern as settings/actions.ts)
  const { error } = await supabase
    .from("businesses")
    .update(clearFields as never)
    .eq("id", bu.business_id)

  if (error) {
    // Fallback: try with admin client in case of RLS edge case
    try {
      const admin = createAdminClient()
      const { error: adminErr } = await admin
        .from("businesses")
        .update(clearFields as never)
        .eq("id", bu.business_id)
      if (adminErr) {
        console.error("[disconnect] Both update attempts failed", { userErr: error, adminErr })
        return NextResponse.json({ error: "Erro ao desconectar. Tente novamente." }, { status: 500 })
      }
    } catch (e) {
      console.error("[disconnect] Admin fallback threw", e)
      return NextResponse.json({ error: "Erro ao desconectar. Tente novamente." }, { status: 500 })
    }
  }

  // Clear WhatsApp conversation history (messages cascade via FK) + notifications.
  try {
    const admin = createAdminClient()
    await admin
      .from("conversations")
      .delete()
      .eq("business_id", bu.business_id)
      .eq("channel", "whatsapp")
    await admin
      .from("notifications")
      .delete()
      .eq("business_id", bu.business_id)
  } catch (e) {
    console.error("[disconnect] conversation/notification clear failed (non-fatal)", e)
  }

  return NextResponse.json({ ok: true })
}
