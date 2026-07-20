import { createClient } from "@/lib/supabase/server"
import { getBusinessId } from "@/lib/auth/actions"
import { redirect } from "next/navigation"
import { Zap, MessageCircle, Clock } from "lucide-react"
import type { Automation } from "@/types/database"
import { AutomationSuggestions } from "@/components/automations/AutomationSuggestions"
import { formatRelative } from "@/lib/utils"

export default async function AutomationsPage() {
  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")

  const supabase = await createClient()

  const [{ data: automations }, { data: logsThisMonth }] = await Promise.all([
    supabase
      .from("automations")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),

    supabase
      .from("automation_logs")
      .select("id, executed_at")
      .eq("business_id", businessId)
      .eq("status", "sent")
      .gte(
        "executed_at",
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      ),
  ])

  const list: Automation[] = automations ?? []
  const activeCount = list.filter((a) => a.active).length
  const messagesThisMonth = logsThisMonth?.length ?? 0

  const lastTriggered = list
    .filter((a) => a.last_run_at)
    .sort((a, b) => (a.last_run_at! > b.last_run_at! ? -1 : 1))[0]?.last_run_at ?? null

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-ink">Automações</h2>
        <p className="mt-1 text-sm text-ink-3">
          Ative mensagens automáticas pelo WhatsApp para cada etapa do atendimento.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-1">
          <div className="flex items-center gap-2 text-ink-3">
            <Zap className="h-4 w-4 text-brand" />
            <span className="text-xs font-semibold uppercase tracking-wide">Ativas</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{activeCount}</p>
          <p className="text-xs text-ink-3">de 6 disponíveis</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-1">
          <div className="flex items-center gap-2 text-ink-3">
            <MessageCircle className="h-4 w-4 text-brand" />
            <span className="text-xs font-semibold uppercase tracking-wide">Mensagens este mês</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{messagesThisMonth}</p>
          <p className="text-xs text-ink-3">enviadas com sucesso</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-1">
          <div className="flex items-center gap-2 text-ink-3">
            <Clock className="h-4 w-4 text-brand" />
            <span className="text-xs font-semibold uppercase tracking-wide">Última execução</span>
          </div>
          <p className="mt-2 text-lg font-bold text-ink">
            {lastTriggered ? formatRelative(lastTriggered) : "—"}
          </p>
          <p className="text-xs text-ink-3">mais recente</p>
        </div>
      </div>

      {/* Suggestion cards */}
      <AutomationSuggestions automations={list} businessId={businessId} />
    </div>
  )
}
