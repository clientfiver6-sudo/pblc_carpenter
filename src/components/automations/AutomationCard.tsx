"use client"

import { useState, useTransition } from "react"
import { Zap, Clock, MessageCircle, Edit2, Check, X, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn, formatRelative } from "@/lib/utils"
import type { Automation, AutomationTrigger } from "@/types/database"
import { toggleAutomation } from "@/lib/automations/actions"

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  booking_created: "Quando agendamento é criado",
  booking_confirmed: "Quando agendamento é confirmado",
  booking_24h_before: "24h antes do agendamento",
  booking_completed: "Quando serviço é concluído",
  booking_cancelled: "Quando agendamento é cancelado",
  booking_no_show: "Quando cliente não comparece",
  payment_pending: "Pagamento pendente",
  payment_received: "Pagamento recebido",
  lead_created: "Novo lead criado",
  lead_inactive: "Lead inativo",
  customer_inactive: "Cliente inativo (30 dias)",
}

interface AutomationCardProps {
  automation: Automation
  onDelete?: (id: string) => void
}

const VAR_LABELS: Record<string, string> = {
  customer_name: "Nome",
  business_name: "Empresa",
  service_name: "Serviço",
  scheduled_time: "Horário",
  scheduled_date: "Data",
  appointment_date: "Data",
  payment_amount: "Valor",
  payment_link: "Link de pagamento",
  technician_name: "Técnico",
  booking_date: "Data",
  booking_time: "Horário",
}

function humanizeVar(raw: string): string {
  const key = raw.replace(/^\{\{|\}\}$/g, "").trim()
  return VAR_LABELS[key] ? `(${VAR_LABELS[key]})` : `(${key})`
}

function TemplatePreview({ template }: { template: string }) {
  const MAX = 120
  const text = template.length > MAX ? template.slice(0, MAX) + "…" : template
  const parts = text.split(/(\{\{[^}]+\}\})/g)

  return (
    <p className="text-xs leading-relaxed text-ink-3">
      {parts.map((part, i) =>
        /^\{\{[^}]+\}\}$/.test(part) ? (
          <span key={i} className="inline-flex items-center rounded-full bg-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand mx-0.5">
            {humanizeVar(part)}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  )
}

export function AutomationCard({ automation: initial, onDelete }: AutomationCardProps) {
  const [automation, setAutomation] = useState<Automation>(initial)
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleToggle() {
    startTransition(async () => {
      const next = !automation.active
      setAutomation((prev) => ({ ...prev, active: next }))
      try {
        await toggleAutomation(automation.id, next)
      } catch {
        // Revert on error
        setAutomation((prev) => ({ ...prev, active: !next }))
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-1 transition hover:border-border-2">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            automation.active ? "bg-tint" : "bg-surface-2"
          )}
        >
          <Zap
            className={cn("h-4 w-4", automation.active ? "text-brand" : "text-ink-3")}
          />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{automation.name}</span>
            <Badge
              className={cn(
                "rounded-full border px-2 py-0 text-[10px] font-medium",
                automation.active
                  ? "bg-moss/10 text-moss border-moss/30"
                  : "bg-surface-2 text-ink-3 border-border"
              )}
            >
              {automation.active ? "Ativa" : "Inativa"}
            </Badge>
          </div>

          <p className="mb-3 text-xs text-ink-3">
            {TRIGGER_LABELS[automation.trigger_type]}
            {automation.delay_minutes > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-warning">
                <Clock className="h-3 w-3" />
                {automation.delay_minutes >= 1440
                  ? `${automation.delay_minutes / 1440}d de atraso`
                  : automation.delay_minutes >= 60
                  ? `${automation.delay_minutes / 60}h de atraso`
                  : `${automation.delay_minutes}min de atraso`}
              </span>
            )}
          </p>

          {/* Template preview */}
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <TemplatePreview template={automation.message_template} />
          </div>

          {/* Stats row */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-3">
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {automation.run_count} envios
            </span>
            {automation.last_run_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelative(automation.last_run_at)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Delete button — two-step confirm */}
          {onDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-danger font-medium">Confirmar?</span>
                <button
                  type="button"
                  onClick={() => onDelete(automation.id)}
                  disabled={isPending}
                  className="flex h-7 items-center rounded-lg border border-danger/40 bg-danger/10 px-2.5 text-xs font-semibold text-danger transition hover:bg-danger/20 disabled:opacity-50"
                  aria-label="Confirmar exclusão"
                >
                  Excluir
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="flex h-7 items-center rounded-lg border border-border px-2 text-xs text-ink-3 transition hover:text-ink"
                  aria-label="Cancelar exclusão"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-3 transition hover:border-danger/40 hover:text-danger disabled:opacity-50"
                aria-label="Excluir automação"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )
          )}

          {/* Edit link to dedicated edit page */}
          <a
            href={`/dashboard/automations/${automation.id}`}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-ink-3 transition hover:border-border-2 hover:text-ink"
            aria-label="Editar automação"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Editar
          </a>

          {/* Toggle button */}
          <button
            onClick={handleToggle}
            disabled={isPending}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition disabled:opacity-50",
              automation.active
                ? "border-danger/30 text-danger hover:bg-danger/10"
                : "border-moss/30 text-moss hover:bg-moss/10"
            )}
            aria-label={automation.active ? "Desativar automação" : "Ativar automação"}
          >
            {automation.active ? (
              <>
                <X className="h-3 w-3" />
                Pausar
              </>
            ) : (
              <>
                <Check className="h-3 w-3" />
                Ativar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
