import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Phone, Settings, MessageSquare, Check, Mic } from "lucide-react"

interface MissedCallRow {
  id: string
  from_number: string
  status: string
  whatsapp_sent: boolean
  created_at: string
  customers: { full_name: string } | null
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  })
}

export default async function CallsPage() {
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

  const { data: rawCalls } = await supabase
    .from("missed_calls")
    .select("id, from_number, status, whatsapp_sent, created_at, customers(full_name)")
    .eq("business_id", bu.business_id)
    .order("created_at", { ascending: false })
    .limit(100)
  const calls = (rawCalls ?? []) as unknown as MissedCallRow[]

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-tint flex items-center justify-center">
            <Phone className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink tracking-tight">Retorno de Ligações</h1>
            <p className="text-ink-3 text-sm">Chamadas perdidas e retornos automáticos por WhatsApp.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/settings/voice"
            className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink border border-border rounded-lg px-3 py-2"
          >
            <Mic className="w-4 h-4" />
            Canal de Voz
          </Link>
          <Link
            href="/dashboard/settings/calls"
            className="flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink border border-border rounded-lg px-3 py-2"
          >
            <Settings className="w-4 h-4" />
            Configurar
          </Link>
        </div>
      </div>

      {calls.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center">
          <p className="text-ink-2 font-medium">Nenhuma chamada perdida registrada ainda.</p>
          <p className="text-ink-3 text-sm mt-1">
            Configure seu número de voz em{" "}
            <Link href="/dashboard/settings/calls" className="text-brand hover:underline">Configurar</Link>{" "}
            para começar a registrar e responder chamadas perdidas automaticamente.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl divide-y divide-border">
          {calls.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {c.customers?.full_name ?? c.from_number}
                </p>
                <p className="text-xs text-ink-3 font-mono">{c.from_number} · {formatWhen(c.created_at)}</p>
              </div>
              <div className="shrink-0">
                {c.whatsapp_sent ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full bg-tint text-brand border border-brand/20">
                    <Check className="w-3 h-3" /> WhatsApp enviado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full bg-surface-2 text-ink-3 border border-border">
                    <MessageSquare className="w-3 h-3" /> Sem retorno
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
