"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Zap, Trash2, Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { updateAutomation, deleteAutomation, toggleAutomation } from "@/lib/automations/actions"
import { cn } from "@/lib/utils"
import type { Automation, AutomationTrigger } from "@/types/database"

const TRIGGER_OPTIONS: Array<{ value: AutomationTrigger; label: string }> = [
  { value: "booking_created", label: "Agendamento criado" },
  { value: "booking_confirmed", label: "Agendamento confirmado" },
  { value: "booking_24h_before", label: "24h antes do agendamento" },
  { value: "booking_completed", label: "Agendamento concluído" },
  { value: "booking_cancelled", label: "Agendamento cancelado" },
  { value: "booking_no_show", label: "Cliente não compareceu" },
  { value: "payment_pending", label: "Pagamento pendente" },
  { value: "payment_received", label: "Pagamento recebido" },
  { value: "lead_created", label: "Novo lead criado" },
  { value: "lead_inactive", label: "Lead inativo" },
  { value: "customer_inactive", label: "Cliente inativo" },
]

const TEMPLATE_VARIABLES = [
  "{{customer_name}}",
  "{{business_name}}",
  "{{service_name}}",
  "{{scheduled_time}}",
  "{{price}}",
  "{{pix_link}}",
]

interface EditAutomationFormProps {
  automation: Automation
}

export function EditAutomationForm({ automation: initial }: EditAutomationFormProps) {
  const router = useRouter()

  const [name, setName] = useState(initial.name)
  const [triggerType, setTriggerType] = useState<AutomationTrigger>(initial.trigger_type)
  const [messageTemplate, setMessageTemplate] = useState(initial.message_template)
  const [delayMinutes, setDelayMinutes] = useState(initial.delay_minutes)
  const [active, setActive] = useState(initial.active)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [isSaving, startSaveTransition] = useTransition()
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isToggling, startToggleTransition] = useTransition()

  function insertVariable(variable: string) {
    setMessageTemplate((prev) => prev + variable)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      setError("O nome da automação é obrigatório")
      return
    }
    if (!messageTemplate.trim()) {
      setError("A mensagem WhatsApp é obrigatória")
      return
    }

    setError(null)

    startSaveTransition(async () => {
      try {
        await updateAutomation(initial.id, {
          name: name.trim(),
          trigger_type: triggerType,
          message_template: messageTemplate.trim(),
          delay_minutes: delayMinutes,
          active,
        })
        router.push("/dashboard/automations")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar automação")
      }
    })
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        await deleteAutomation(initial.id)
        router.push("/dashboard/automations")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao excluir automação")
        setDeleteOpen(false)
      }
    })
  }

  function handleToggle() {
    const next = !active
    startToggleTransition(async () => {
      try {
        await toggleAutomation(initial.id, next)
        setActive(next)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao alterar status")
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="mx-auto max-w-2xl">
        {/* Back link */}
        <Link
          href="/dashboard/automations"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-3 transition hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Automações
        </Link>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-tint">
              <Zap className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-ink">Editar Automação</h1>
              <p className="text-sm text-ink-3">Modifique as configurações desta automação</p>
            </div>
          </div>

          {/* Toggle status inline */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={isToggling}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50",
              active
                ? "border-danger/30 text-danger hover:bg-danger/10"
                : "border-moss/30 text-moss hover:bg-moss/10"
            )}
          >
            {active ? (
              <>
                <X className="h-3 w-3" />
                {isToggling ? "Alterando..." : "Pausar"}
              </>
            ) : (
              <>
                <Check className="h-3 w-3" />
                {isToggling ? "Alterando..." : "Ativar"}
              </>
            )}
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className="rounded-xl border border-border bg-surface p-6 space-y-5 shadow-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
                Nome da automação <span className="text-danger">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Confirmação de agendamento"
                className="border-border bg-surface text-ink placeholder:text-ink-4 focus-visible:ring-brand/20 focus-visible:border-brand"
                required
              />
            </div>

            {/* Trigger type */}
            <div className="space-y-1.5">
              <Label htmlFor="trigger_type" className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
                Gatilho <span className="text-danger">*</span>
              </Label>
              <select
                id="trigger_type"
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as AutomationTrigger)}
                className={cn(
                  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink",
                  "focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand appearance-none"
                )}
              >
                {TRIGGER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Message template */}
            <div className="space-y-2">
              <Label htmlFor="message_template" className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
                Mensagem WhatsApp <span className="text-danger">*</span>
              </Label>

              {/* Variable chips */}
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <button
                    key={variable}
                    type="button"
                    onClick={() => insertVariable(variable)}
                    className="rounded-full border border-brand/20 px-2.5 py-0.5 font-mono text-[10px] font-medium text-brand-2 bg-tint transition hover:border-brand/60"
                    title={`Inserir ${variable}`}
                  >
                    {variable}
                  </button>
                ))}
              </div>

              <Textarea
                id="message_template"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={6}
                placeholder="Escreva a mensagem. Use as variáveis acima para personalizar."
                className="resize-none border-border bg-surface font-mono text-xs text-ink placeholder:text-ink-4 focus-visible:ring-brand/20 focus-visible:border-brand"
                required
              />

              <p className="text-[10px] text-ink-3">
                Variáveis disponíveis:{" "}
                {TEMPLATE_VARIABLES.map((v, i) => (
                  <span key={v}>
                    <span className="font-mono text-brand">{v}</span>
                    {i < TEMPLATE_VARIABLES.length - 1 && ", "}
                  </span>
                ))}
              </p>
            </div>

            {/* Delay minutes */}
            <div className="space-y-1.5">
              <Label htmlFor="delay_minutes" className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
                Atraso (minutos)
              </Label>
              <Input
                id="delay_minutes"
                type="number"
                min={0}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Math.max(0, Number(e.target.value)))}
                className="border-border bg-surface text-ink placeholder:text-ink-4 focus-visible:ring-brand/20 focus-visible:border-brand font-mono"
              />
              <p className="text-[10px] text-ink-3">
                0 = enviar imediatamente. Use 1440 para 1 dia, 60 para 1 hora.
              </p>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">Ativa</p>
                <p className="text-xs text-ink-3">
                  {active ? "Esta automação está ativa" : "Esta automação está pausada"}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={active}
                onClick={() => setActive((v) => !v)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20 focus:ring-offset-2 focus:ring-offset-surface",
                  active ? "bg-brand border-brand" : "bg-border border-border"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    active ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="rounded-xl border border-border bg-surface px-5 py-4 shadow-1">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">Estatísticas</p>
            <div className="flex gap-6">
              <div>
                <p className="font-mono text-lg font-bold text-ink">{initial.run_count}</p>
                <p className="text-xs text-ink-3">envios totais</p>
              </div>
              {initial.last_run_at && (
                <div>
                  <p className="text-sm font-medium text-ink">
                    {new Date(initial.last_run_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-ink-3">último envio</p>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            {/* Delete */}
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-danger/30 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/automations"
                className="rounded-lg border border-border bg-surface px-5 py-2 text-sm font-semibold text-ink-2 transition hover:text-ink"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--brand-grad)" }}
              >
                {isSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-surface border-border text-ink">
          <DialogHeader>
            <DialogTitle className="text-ink">Excluir automação?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-ink-3 py-2">
            Esta ação não pode ser desfeita. A automação{" "}
            <span className="font-semibold text-ink">{initial.name}</span> será
            permanentemente removida.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="border-border text-ink hover:bg-surface-2"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-danger text-white hover:bg-danger/90 font-semibold"
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
