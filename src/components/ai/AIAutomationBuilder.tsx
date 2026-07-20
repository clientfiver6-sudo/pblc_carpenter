"use client"
import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface AutomationConfig {
  name: string
  trigger_type: string
  message_template: string
  delay_minutes: number
}

interface Props {
  onResult: (config: AutomationConfig) => void
}

const TRIGGER_LABELS: Record<string, string> = {
  booking_created: "Agendamento criado",
  booking_confirmed: "Agendamento confirmado",
  booking_24h_before: "24h antes do agendamento",
  booking_completed: "Agendamento concluído",
  booking_cancelled: "Agendamento cancelado",
  booking_no_show: "Cliente não compareceu",
  payment_pending: "Pagamento pendente",
  payment_received: "Pagamento recebido",
  lead_created: "Novo lead criado",
  lead_inactive: "Lead inativo",
  customer_inactive: "Cliente inativo",
}

export function AIAutomationBuilder({ onResult }: Props) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<AutomationConfig | null>(null)

  async function handleGenerate() {
    if (!description.trim() || loading) return
    setLoading(true)
    setPreview(null)
    try {
      const res = await fetch("/api/ai/build-automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      })
      if (!res.ok) return
      const data = (await res.json()) as { automation: AutomationConfig }
      if (data.automation) setPreview(data.automation)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="mb-6 rounded-lg border overflow-hidden"
      style={{
        background: 'radial-gradient(120% 100% at 100% 0%, #FFE7D6 0%, transparent 55%), linear-gradient(135deg, #FFF7EF 0%, #FFF1E5 100%)',
        borderColor: '#F2D9C2',
        boxShadow: '0 8px 28px -16px rgba(232,93,31,.25)'
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-surface-2"
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white text-brand-2 border"
            style={{ borderColor: '#F2D9C2' }}
          >
            <span className="text-brand font-bold text-xs">✦</span>
            Criar com IA
          </span>
          <span className="text-sm font-medium text-ink">Gerado por IA</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-ink-3" />
        ) : (
          <ChevronDown className="h-4 w-4 text-ink-3" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-5 py-4 space-y-4" style={{ borderColor: '#F2D9C2' }}>
          <div className="flex gap-2">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Enviar confirmação 24h antes do agendamento"
              className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void handleGenerate()
                }
              }}
            />
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={loading || !description.trim()}
              className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--brand-grad)' }}
            >
              {loading ? "Gerando..." : "Gerar"}
            </button>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="animate-pulse h-4 bg-surface-2 rounded w-1/3" />
              <div className="animate-pulse h-3 bg-surface-2 rounded w-full" />
              <div className="animate-pulse h-3 bg-surface-2 rounded w-4/5" />
            </div>
          )}

          {preview && (
            <div className="rounded-lg border bg-white p-4 space-y-2" style={{ borderColor: '#F2D9C2' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium text-ink">{preview.name}</p>
                  <p className="text-xs text-ink-3">
                    Gatilho:{" "}
                    <span className="text-ink">
                      {TRIGGER_LABELS[preview.trigger_type] ?? preview.trigger_type}
                    </span>
                    {preview.delay_minutes > 0 && ` · ${preview.delay_minutes} min de atraso`}
                  </p>
                  <p className="text-xs text-ink-2 font-mono leading-relaxed border-l-2 pl-3 mt-2" style={{ borderColor: '#F2D9C2' }}>
                    {preview.message_template}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onResult(preview)
                  setOpen(false)
                }}
                className="w-full rounded-md border py-2 text-xs font-semibold text-ink-2 transition hover:bg-surface-2"
                style={{ borderColor: '#F2D9C2' }}
              >
                Usar esta configuração
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
