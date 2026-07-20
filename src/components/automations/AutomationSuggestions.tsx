"use client"

import { useState, useTransition } from "react"
import { MessageCircle, Clock, Star, UserX, Zap, CreditCard } from "lucide-react"
import { cn, formatRelative } from "@/lib/utils"
import { createAutomation, toggleAutomation } from "@/lib/automations/actions"
import type { Automation, AutomationTrigger } from "@/types/database"

// ─── Suggestion definitions ───────────────────────────────────────────────────

interface Suggestion {
  key: string
  name: string
  description: string
  trigger: AutomationTrigger
  template: string
  icon: React.ComponentType<{ className?: string }>
  delay_minutes?: number
}

const SUGGESTIONS: Suggestion[] = [
  {
    key: "booking_created",
    name: "Confirmação de Agendamento",
    description: "Avisa o cliente assim que um chamado é criado.",
    trigger: "booking_created",
    icon: Zap,
    template:
      "Olá, {{customer_name}}! Seu agendamento em *{{business_name}}* foi confirmado.\n\n*{{service_name}}*\n📅 {{scheduled_date}} às {{scheduled_time}}\n\nQualquer dúvida, é só falar!",
  },
  {
    key: "booking_24h_before",
    name: "Lembrete 24h Antes",
    description: "Lembra o cliente do agendamento no dia anterior.",
    trigger: "booking_24h_before",
    icon: Clock,
    template:
      "Oi, {{customer_name}}! Só passando para lembrar do seu atendimento *amanhã* em {{business_name}}.\n\n*{{service_name}}*\n⏰ {{scheduled_time}}\n\nAté lá! 😊",
  },
  {
    key: "booking_completed",
    name: "Avaliação Pós-Atendimento",
    description: "Pede feedback do cliente logo após o serviço.",
    trigger: "booking_completed",
    icon: Star,
    template:
      "Olá, {{customer_name}}! Foi ótimo te atender hoje em *{{business_name}}*. 🙏\n\nComo foi sua experiência? Seu feedback é muito importante pra gente!\n\nSe precisar de qualquer coisa, estamos aqui.",
  },
  {
    key: "customer_inactive",
    name: "Reativação de Cliente",
    description: "Envia uma mensagem para clientes sem visita há 30 dias.",
    trigger: "customer_inactive",
    icon: UserX,
    template:
      "Olá, {{customer_name}}! Sentimos sua falta em *{{business_name}}*. 💙\n\nFaz um tempo que não nos vemos — que tal agendar um horário? Estamos com ótimas novidades te esperando!",
  },
  {
    key: "booking_no_show",
    name: "Quando Cliente Não Comparece",
    description: "Segue com o cliente quando ele não aparece no horário.",
    trigger: "booking_no_show",
    icon: MessageCircle,
    template:
      "Oi, {{customer_name}}! Notamos que você não pôde comparecer hoje em *{{business_name}}*.\n\nSem problema — quando quiser remarcar é só nos chamar! 😊",
  },
  {
    key: "payment_pending",
    name: "Lembrete de Pagamento",
    description: "Lembra o cliente de um pagamento em aberto após 24h.",
    trigger: "payment_pending",
    icon: CreditCard,
    template:
      "Olá, {{customer_name}}! Lembramos que há um pagamento pendente referente ao seu atendimento em *{{business_name}}*.\n\nValor: *{{payment_amount}}*\n\nQualquer dúvida, é só falar! 🙏",
    delay_minutes: 1440,
  },
]

// ─── VAR rendering ────────────────────────────────────────────────────────────

const VAR_LABELS: Record<string, string> = {
  customer_name: "Nome",
  business_name: "Empresa",
  service_name: "Serviço",
  scheduled_time: "Horário",
  scheduled_date: "Data",
  payment_amount: "Valor",
}

function TemplatePreview({ template }: { template: string }) {
  const MAX = 130
  const text = template.length > MAX ? template.slice(0, MAX) + "…" : template
  const parts = text.split(/(\{\{[^}]+\}\})/g)
  return (
    <p className="text-xs leading-relaxed text-ink-3">
      {parts.map((part, i) => {
        if (/^\{\{[^}]+\}\}$/.test(part)) {
          const key = part.replace(/^\{\{|\}\}$/g, "").trim()
          const label = VAR_LABELS[key] ? `(${VAR_LABELS[key]})` : `(${key})`
          return (
            <span key={i} className="inline-flex items-center rounded-full bg-tint px-1.5 py-0.5 text-[10px] font-semibold text-brand mx-0.5">
              {label}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </p>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ active, disabled, onToggle }: { active: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-50",
        active ? "bg-brand" : "bg-border"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200",
          active ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  suggestion: Suggestion
  existing: Automation | null
  businessId: string
}

function SuggestionCard({ suggestion, existing, businessId }: CardProps) {
  const [automation, setAutomation] = useState<Automation | null>(existing)
  const [isPending, startTransition] = useTransition()

  const isActive = automation?.active ?? false

  function handleToggle() {
    startTransition(async () => {
      if (!automation) {
        // Create the automation and activate it
        const created = await createAutomation({
          business_id: businessId,
          name: suggestion.name,
          trigger_type: suggestion.trigger,
          message_template: suggestion.template,
          delay_minutes: suggestion.delay_minutes ?? 0,
          active: true,
          conditions: [],
          last_run_at: null,
          run_count: 0,
        })
        setAutomation(created)
      } else {
        const next = !automation.active
        setAutomation((prev) => prev ? { ...prev, active: next } : prev)
        try {
          await toggleAutomation(automation.id, next)
        } catch {
          setAutomation((prev) => prev ? { ...prev, active: !next } : prev)
        }
      }
    })
  }

  const Icon = suggestion.icon

  return (
    <div className={cn(
      "rounded-xl border bg-surface p-5 transition-all duration-200",
      isActive ? "border-brand/30 shadow-1" : "border-border"
    )}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isActive ? "bg-tint" : "bg-surface-2"
          )}>
            <Icon className={cn("h-4 w-4", isActive ? "text-brand" : "text-ink-3")} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink leading-tight">{suggestion.name}</p>
            <p className="text-xs text-ink-3 mt-0.5">{suggestion.description}</p>
          </div>
        </div>
        <Toggle active={isActive} disabled={isPending} onToggle={handleToggle} />
      </div>

      <div className="rounded-lg bg-surface-2 px-3 py-2.5">
        <TemplatePreview template={suggestion.template} />
      </div>

      {automation?.run_count ? (
        <p className="mt-2 text-[11px] text-ink-4">
          {automation.run_count} envio{automation.run_count !== 1 ? "s" : ""}
          {automation.last_run_at && <> · {formatRelative(automation.last_run_at)}</>}
        </p>
      ) : null}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  automations: Automation[]
  businessId: string
}

export function AutomationSuggestions({ automations, businessId }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SUGGESTIONS.map((s) => {
          const existing = automations.find(
            (a) => a.trigger_type === s.trigger
          ) ?? null
          return (
            <SuggestionCard
              key={s.key}
              suggestion={s}
              existing={existing}
              businessId={businessId}
            />
          )
        })}
      </div>

      {/* Coming soon note */}
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-5 py-4">
        <Zap className="h-4 w-4 text-ink-4 shrink-0" />
        <p className="text-sm text-ink-3">
          Mais automações em breve — cobranças automáticas, sequências de follow-up, e muito mais.
        </p>
      </div>
    </div>
  )
}
