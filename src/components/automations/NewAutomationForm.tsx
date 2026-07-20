"use client"

import { useState, useTransition, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Zap } from "lucide-react"
import { createAutomation } from "@/lib/automations/actions"
import { cn } from "@/lib/utils"
import type { AutomationTrigger } from "@/types/database"
import { AIEntryPanel } from "@/components/ai/AIEntryPanel"

const TRIGGER_OPTIONS: Array<{ value: AutomationTrigger; label: string; icon: string; desc: string }> = [
  { value: "booking_created",    label: "Agendamento criado",   icon: "📅", desc: "Assim que o agendamento entra" },
  { value: "booking_confirmed",  label: "Cliente confirmou",    icon: "✅", desc: "Quando o cliente confirma" },
  { value: "booking_24h_before", label: "1 dia antes",          icon: "⏰", desc: "Lembrete automático no dia anterior" },
  { value: "booking_completed",  label: "Serviço concluído",    icon: "🎉", desc: "Logo após o serviço ser feito" },
  { value: "booking_cancelled",  label: "Cancelamento",         icon: "❌", desc: "Quando um agendamento é cancelado" },
  { value: "booking_no_show",    label: "Não compareceu",       icon: "👻", desc: "Cliente não apareceu no horário" },
  { value: "payment_pending",    label: "Cobrança em aberto",   icon: "💳", desc: "Quando há pagamento pendente" },
  { value: "payment_received",   label: "Pagamento recebido",   icon: "💰", desc: "Quando o pagamento é confirmado" },
  { value: "lead_created",       label: "Novo contato",         icon: "✨", desc: "Quando um lead entra no sistema" },
  { value: "lead_inactive",      label: "Lead parado",          icon: "😴", desc: "Lead sem atividade recente" },
  { value: "customer_inactive",  label: "Cliente sumiu",        icon: "🔄", desc: "Sem serviço há 30 dias" },
]

const TEMPLATE_VARIABLES: Array<{ code: string; label: string }> = [
  { code: "{{customer_name}}",  label: "Nome do cliente" },
  { code: "{{business_name}}",  label: "Seu negócio" },
  { code: "{{service_name}}",   label: "Serviço" },
  { code: "{{scheduled_time}}", label: "Horário" },
  { code: "{{price}}",          label: "Preço" },
  { code: "{{pix_link}}",       label: "Link PIX" },
]

const DELAY_PRESETS = [
  { label: "Na hora",       minutes: 0 },
  { label: "30 min depois", minutes: 30 },
  { label: "1 hora depois", minutes: 60 },
  { label: "24h depois",    minutes: 1440 },
]

interface NewAutomationFormProps {
  businessId: string
  initialTrigger?: string
  initialName?: string
  initialMessage?: string
  initialDelayMinutes?: number
}

interface AutomationAIFields {
  name?: string
  trigger_type?: string
  message_template?: string
  delay_minutes?: number
}

export function NewAutomationForm({
  businessId,
  initialTrigger,
  initialName,
  initialMessage,
  initialDelayMinutes,
}: NewAutomationFormProps) {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resolvedTrigger: AutomationTrigger =
    TRIGGER_OPTIONS.some((o) => o.value === initialTrigger)
      ? (initialTrigger as AutomationTrigger)
      : "booking_created"

  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual")
  const [name, setName] = useState(initialName ?? "")
  const [triggerType, setTriggerType] = useState<AutomationTrigger>(resolvedTrigger)
  const [messageTemplate, setMessageTemplate] = useState(initialMessage ?? "")
  const [delayMinutes, setDelayMinutes] = useState(initialDelayMinutes ?? 0)
  const [customDelay, setCustomDelay] = useState(false)
  const [active, setActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAIFill(fields: Partial<AutomationAIFields>) {
    if (fields.name) setName(fields.name)
    if (fields.trigger_type && TRIGGER_OPTIONS.some(o => o.value === fields.trigger_type)) {
      setTriggerType(fields.trigger_type as AutomationTrigger)
    }
    if (fields.message_template) setMessageTemplate(fields.message_template)
    if (fields.delay_minutes != null) setDelayMinutes(fields.delay_minutes)
    setActiveTab("manual")
  }

  function insertVariable(code: string) {
    const el = textareaRef.current
    if (!el) { setMessageTemplate(p => p + code); return }
    const start = el.selectionStart ?? messageTemplate.length
    const end = el.selectionEnd ?? start
    const next = messageTemplate.slice(0, start) + code + messageTemplate.slice(end)
    setMessageTemplate(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + code.length, start + code.length)
    }, 0)
  }

  function handleDelayPreset(minutes: number) {
    setDelayMinutes(minutes)
    setCustomDelay(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError("Dê um nome para essa automação"); return }
    if (!messageTemplate.trim()) { setError("Escreva a mensagem que será enviada"); return }
    setError(null)
    startTransition(async () => {
      try {
        await createAutomation({
          business_id: businessId,
          name: name.trim(),
          trigger_type: triggerType,
          message_template: messageTemplate.trim(),
          delay_minutes: delayMinutes,
          active,
          conditions: {},
          run_count: 0,
          last_run_at: null,
        })
        router.push("/dashboard/automations")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Algo deu errado. Tente novamente.")
      }
    })
  }

  const selectedTrigger = TRIGGER_OPTIONS.find(o => o.value === triggerType)!
  const isPreset = DELAY_PRESETS.some(p => p.minutes === delayMinutes) && !customDelay

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-2xl">

        <Link
          href="/dashboard/automations"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-3 transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para automações
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink tracking-tight">Nova automação</h1>
          <p className="text-sm text-ink-3 mt-1">Configure uma mensagem que o WhatsApp envia sozinho, no momento certo.</p>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-surface-2 rounded-xl p-1 gap-1 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm text-center transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
              activeTab === "manual" ? "font-semibold bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"
            )}
          >
            Configurar eu mesmo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm text-center transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
              activeTab === "ai" ? "font-semibold bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"
            )}
          >
            <span className="text-brand">✦</span> Deixar a IA criar
          </button>
        </div>

        {activeTab === "ai" ? (
          <AIEntryPanel<AutomationAIFields>
            entityType="automation"
            placeholder="Ex: Enviar confirmação quando um agendamento for criado, com nome do cliente e horário"
            onFill={handleAIFill}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Step 1 — Name */}
            <section className="space-y-3">
              <div>
                <p className="text-sm font-bold text-ink">Como você quer chamar essa automação?</p>
                <p className="text-xs text-ink-3 mt-0.5">Só para você se organizar — o cliente não vê isso.</p>
              </div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Confirmação de agendamento, Cobrança de inadimplente…"
                className="w-full border border-border rounded-xl h-11 px-4 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </section>

            {/* Step 2 — Trigger */}
            <section className="space-y-3">
              <div>
                <p className="text-sm font-bold text-ink">Quando essa mensagem deve ser enviada?</p>
                <p className="text-xs text-ink-3 mt-0.5">Escolha o evento que vai disparar o envio.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TRIGGER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTriggerType(opt.value)}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-[border-color,background-color] duration-150 ease-brand-out",
                      triggerType === opt.value
                        ? "border-brand bg-tint"
                        : "border-border bg-surface hover:border-brand/30 hover:bg-surface-2"
                    )}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    <span className="text-xs font-semibold text-ink leading-tight">{opt.label}</span>
                    <span className="text-[10px] text-ink-4 leading-tight">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Step 3 — Message */}
            <section className="space-y-3">
              <div>
                <p className="text-sm font-bold text-ink">O que o WhatsApp vai dizer?</p>
                <p className="text-xs text-ink-3 mt-0.5">
                  Clique nas etiquetas abaixo para inserir informações dinâmicas na mensagem.
                </p>
              </div>

              {/* Variable chips */}
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map(v => (
                  <button
                    key={v.code}
                    type="button"
                    onClick={() => insertVariable(v.code)}
                    className="flex items-center gap-1 rounded-full border border-brand/25 bg-tint px-2.5 py-1 text-[11px] font-semibold text-brand hover:border-brand/60 hover:bg-tint-2 transition-colors"
                  >
                    + {v.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                  rows={7}
                  placeholder={`Olá, {{customer_name}}! Seu agendamento em *{{business_name}}* foi confirmado.\n\nServiço: {{service_name}}\nHorário: {{scheduled_time}}\n\nQualquer dúvida, é só chamar!`}
                  className="w-full border border-border rounded-xl px-4 py-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none leading-relaxed"
                />
                {messageTemplate && (
                  <div className="absolute bottom-2 right-2 text-[10px] text-ink-4 bg-surface px-1 rounded">
                    {messageTemplate.length} chars
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-surface-2 border border-border px-3 py-2 text-[11px] text-ink-3 leading-relaxed">
                💡 Use <span className="font-semibold">*texto*</span> para negrito no WhatsApp. As etiquetas como <span className="font-mono text-brand">{'{{customer_name}}'}</span> são trocadas automaticamente pelo nome real.
              </div>
            </section>

            {/* Step 4 — Delay */}
            <section className="space-y-3">
              <div>
                <p className="text-sm font-bold text-ink">Enviar quanto tempo depois do evento?</p>
                <p className="text-xs text-ink-3 mt-0.5">
                  Gatilho escolhido: <span className="font-semibold text-ink-2">{selectedTrigger.icon} {selectedTrigger.label}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {DELAY_PRESETS.map(preset => (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => handleDelayPreset(preset.minutes)}
                    className={cn(
                      "px-4 py-2 rounded-xl border text-sm font-medium transition-[border-color,background-color,color] duration-150 ease-brand-out",
                      !customDelay && delayMinutes === preset.minutes
                        ? "border-brand bg-tint text-brand"
                        : "border-border bg-surface text-ink-2 hover:border-brand/30"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomDelay(true)}
                  className={cn(
                    "px-4 py-2 rounded-xl border text-sm font-medium transition-[border-color,background-color,color] duration-150 ease-brand-out",
                    customDelay
                      ? "border-brand bg-tint text-brand"
                      : "border-border bg-surface text-ink-2 hover:border-brand/30"
                  )}
                >
                  Personalizado
                </button>
              </div>
              {customDelay && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <input
                    type="number"
                    min={0}
                    value={delayMinutes}
                    onChange={e => setDelayMinutes(Math.max(0, Number(e.target.value)))}
                    className="w-28 border border-border rounded-xl h-10 px-3 text-sm text-ink bg-surface focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <span className="text-sm text-ink-3">minutos após o evento</span>
                </div>
              )}
              {!customDelay && !isPreset && (
                <p className="text-xs text-ink-4">{delayMinutes} minuto{delayMinutes !== 1 ? "s" : ""} após o evento</p>
              )}
            </section>

            {/* Step 5 — Active */}
            <section>
              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface">
                <div>
                  <p className="text-sm font-semibold text-ink">Ligar agora?</p>
                  <p className="text-xs text-ink-3 mt-0.5">
                    {active ? "Esta automação começa a funcionar assim que você salvar." : "Você pode ativar depois, quando quiser."}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => setActive(v => !v)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors focus:outline-none",
                    active ? "bg-brand border-brand" : "bg-border border-border"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    active ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </button>
              </div>
            </section>

            {error && (
              <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 pb-8">
              <Link
                href="/dashboard/automations"
                className="rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-ink-2 transition hover:text-ink"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--brand-grad)" }}
              >
                <Zap className="h-4 w-4" />
                {isPending ? "Salvando…" : "Salvar automação"}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  )
}
