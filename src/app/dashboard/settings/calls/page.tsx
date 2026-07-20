import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { CallReturnSettingsClient } from "./CallReturnSettingsClient"

export default async function CallReturnSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const bu = rawBu as { business_id: string } | null
  if (!bu) return redirect("/dashboard")

  const { data: rawBiz } = await supabase
    .from("businesses")
    .select("id, voice_number, call_return_enabled, call_return_template")
    .eq("id", bu.business_id)
    .single()
  const business = rawBiz as {
    id: string
    voice_number: string | null
    call_return_enabled: boolean | null
    call_return_template: string | null
  } | null

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-xl font-bold text-ink mb-1">Retorno de Ligações</h1>
      <p className="text-ink-3 text-sm mb-6">
        Quando alguém ligar para o seu número de voz e não for atendido, o RetornAI envia
        automaticamente uma mensagem no WhatsApp para o cliente.
      </p>
      <CallReturnSettingsClient
        voiceNumber={business?.voice_number ?? ""}
        enabled={business?.call_return_enabled ?? false}
        template={business?.call_return_template ?? ""}
      />
    </div>
  )
}
