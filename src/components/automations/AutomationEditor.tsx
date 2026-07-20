"use client"

import { useState, useTransition } from "react"
import { Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import type { Automation } from "@/types/database"
import { updateAutomation } from "@/lib/automations/actions"

const TEMPLATE_VARIABLES = [
  { key: "customer_name", label: "Nome do cliente" },
  { key: "business_name", label: "Nome do negócio" },
  { key: "service_name", label: "Nome do serviço" },
  { key: "scheduled_time", label: "Horário agendado" },
  { key: "price", label: "Valor" },
  { key: "pix_link", label: "Link Pix" },
] as const

const DELAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Imediatamente" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 360, label: "6 horas" },
  { value: 720, label: "12 horas" },
  { value: 1440, label: "1 dia" },
]

interface AutomationEditorProps {
  automation: Automation
  onSave: () => void
  onCancel: () => void
  onUpdate: (updated: Automation) => void
}

export function AutomationEditor({
  automation,
  onSave,
  onCancel,
  onUpdate,
}: AutomationEditorProps) {
  const [name, setName] = useState(automation.name)
  const [template, setTemplate] = useState(automation.message_template)
  const [delayMinutes, setDelayMinutes] = useState(automation.delay_minutes)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function insertVariable(key: string) {
    const token = `{{${key}}}`
    setTemplate((prev) => prev + token)
  }

  function handleSave() {
    if (!name.trim()) {
      setError("O nome é obrigatório")
      return
    }
    if (!template.trim()) {
      setError("A mensagem é obrigatória")
      return
    }

    setError(null)

    startTransition(async () => {
      try {
        await updateAutomation(automation.id, {
          name: name.trim(),
          message_template: template.trim(),
          delay_minutes: delayMinutes,
        })

        onUpdate({
          ...automation,
          name: name.trim(),
          message_template: template.trim(),
          delay_minutes: delayMinutes,
        })

        onSave()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar")
      }
    })
  }

  return (
    <div className="mt-3 space-y-4 rounded-xl border border-border bg-surface-2 p-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor={`name-${automation.id}`} className="text-xs text-ink-2">
          Nome da automação
        </Label>
        <Input
          id={`name-${automation.id}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Confirmação de agendamento"
          className="border-border bg-surface text-ink placeholder:text-ink-4 focus-visible:ring-brand/20 focus-visible:border-brand h-9"
        />
      </div>

      {/* Template */}
      <div className="space-y-2">
        <Label htmlFor={`template-${automation.id}`} className="text-xs text-ink-2">
          Mensagem
        </Label>

        {/* Variable chips */}
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVariable(v.key)}
              className="rounded-full border border-brand/20 px-2.5 py-0.5 font-mono text-[10px] font-medium text-brand-2 bg-tint transition hover:border-brand/60"
              title={`Inserir ${v.label}`}
            >
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>

        <Textarea
          id={`template-${automation.id}`}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          rows={5}
          placeholder="Escreva a mensagem. Use as variáveis acima para personalizar."
          className="resize-none border-border bg-surface font-mono text-xs text-ink placeholder:text-ink-4 focus-visible:ring-brand/20 focus-visible:border-brand"
        />

        <p className="text-[10px] text-ink-3">
          As variáveis entre{" "}
          <span className="font-mono text-brand">{"{{"}chaves{"}}"}</span> são substituídas
          automaticamente ao enviar.
        </p>
      </div>

      {/* Delay */}
      <div className="space-y-1.5">
        <Label htmlFor={`delay-${automation.id}`} className="text-xs text-ink-2">
          Enviar após
        </Label>
        <select
          id={`delay-${automation.id}`}
          value={delayMinutes}
          onChange={(e) => setDelayMinutes(Number(e.target.value))}
          className={cn(
            "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink",
            "focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand",
            "appearance-none"
          )}
        >
          {DELAY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-danger">{error}</p>}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-1.5 text-xs font-semibold text-ink-2 transition hover:text-ink disabled:opacity-50 h-9"
        >
          <X className="h-3 w-3" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50 h-9"
          style={{ background: "var(--brand-grad)" }}
        >
          <Check className="h-3 w-3" />
          {isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  )
}
