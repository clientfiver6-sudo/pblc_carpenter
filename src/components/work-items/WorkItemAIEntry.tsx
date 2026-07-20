"use client"
import { useState } from "react"
import { Loader2, Sparkles, Check, AlertCircle, PenLine } from "lucide-react"

interface AIExtractedFields {
  customer_id?: string
  service_id?: string
  assigned_staff_id?: string
  scheduled_date?: string
  scheduled_time?: string
  title?: string
  price_estimate?: number
  notes?: string
}

interface Preview {
  customerName?: string
  serviceName?: string
  staffName?: string
  date?: string
  time?: string
  price?: string
}

interface Props {
  customers: Array<{ id: string; full_name: string; phone_number: string | null }>
  services: Array<{ id: string; name: string; price: number | null }>
  staff: Array<{ id: string; name: string; role: string | null }>
  openingHours?: Record<string, unknown>
  onFill: (fields: AIExtractedFields) => void
}

const inputCls = "w-full border rounded-lg p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
const inputStyle = { borderColor: "#F2D9C2", background: "rgba(255,255,255,.8)" }

export function WorkItemAIEntry({ customers, services, staff, openingHours, onFill }: Props) {
  const [description, setDescription] = useState("")
  const [followUp, setFollowUp] = useState("")
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState<string | null>(null)
  const [outOfScope, setOutOfScope] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [extractedFields, setExtractedFields] = useState<AIExtractedFields | null>(null)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setQuestion(null)
    setOutOfScope(false)
    setPreview(null)
    setExtractedFields(null)
    setVerified(false)
    setFollowUp("")
    setError(null)
  }

  async function extract() {
    setLoading(true)
    setError(null)
    setOutOfScope(false)

    // Context accumulation: merge follow-up into description before calling
    const combinedDescription = followUp.trim()
      ? `${description.trim()}\n${followUp.trim()}`
      : description.trim()
    if (followUp.trim()) setDescription(combinedDescription)
    setFollowUp("")

    try {
      const res = await fetch("/api/work-items/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: combinedDescription,
          context: {
            customers: customers.map(c => ({ id: c.id, name: c.full_name })),
            services: services.map(s => ({ id: s.id, name: s.name, price: s.price ?? 0 })),
            staff: staff.map(m => ({ id: m.id, name: m.name, role: m.role ?? "" })),
            openingHours: openingHours ?? null,
          },
        }),
      })
      const data = await res.json() as {
        fields: AIExtractedFields
        missing: string[]
        question: string | null
        preview: Preview
        outOfScope?: boolean
        error?: string
      }
      if (data.error) { setError(data.error); return }
      if (data.outOfScope) { setOutOfScope(true); setQuestion(data.question ?? null); return }
      setExtractedFields(data.fields)
      setPreview(data.preview)
      setQuestion(data.question ?? null)
    } catch {
      setError("Erro ao conectar com a IA")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded-lg border p-5 space-y-4"
      style={{
        background: "radial-gradient(120% 100% at 100% 0%, #FFE7D6 0%, transparent 55%), linear-gradient(135deg, #FFF7EF 0%, #FFF1E5 100%)",
        borderColor: "#F2D9C2",
        boxShadow: "0 8px 28px -16px rgba(232,93,31,.25)",
      }}
    >
      {/* AI chip */}
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white text-brand-2 border mb-1"
        style={{ borderColor: "#F2D9C2" }}
      >
        <span className="text-brand font-bold text-xs">✦</span>
        Descrever com IA
      </span>

      {/* Main textarea */}
      {!(preview && extractedFields && !question) && (
        <textarea
          value={description}
          onChange={e => { setDescription(e.target.value); reset() }}
          placeholder="Ex: Chamado da Maria Silva amanhã às 10h para instalação de ar, cobrar R$ 200"
          rows={3}
          className={inputCls}
          style={inputStyle}
        />
      )}

      {/* Out-of-scope warning */}
      {outOfScope && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-danger/8 border border-danger/25 text-sm text-danger leading-relaxed">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Isso está fora do assunto. Por favor, descreva um chamado ou agendamento de serviço.</span>
        </div>
      )}

      {/* Follow-up question */}
      {question && !outOfScope && !preview && (
        <div className="bg-white border rounded-lg p-3 text-sm text-ink-2 space-y-3" style={{ borderColor: "#F2D9C2" }}>
          <div className="flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
            <span>{question}</span>
          </div>
          <textarea
            value={followUp}
            onChange={e => setFollowUp(e.target.value)}
            placeholder="Sua resposta..."
            rows={2}
            className={inputCls}
            style={inputStyle}
            autoFocus
          />
        </div>
      )}

      {error && <p className="text-danger text-xs">{error}</p>}

      {/* Extract button */}
      {!(preview && extractedFields && !question) && (
        <button
          type="button"
          onClick={extract}
          disabled={loading || (!description.trim() && !followUp.trim())}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
          style={{ background: "var(--brand-grad)" }}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="font-bold">✦</span>}
          {loading ? "Analisando..." : question ? "Gerar com minha resposta" : "Preencher campos"}
        </button>
      )}

      {/* Preview card */}
      {preview && extractedFields && !question && (
        <div className="bg-white border rounded-lg p-4 space-y-3" style={{ borderColor: "#F2D9C2" }}>
          <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Informações identificadas</p>
          <div className="space-y-1.5">
            {preview.customerName && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-brand font-bold text-xs">✦</span>
                <span className="text-ink-3">Cliente:</span>
                <span className="text-ink font-medium">{preview.customerName}</span>
              </div>
            )}
            {preview.serviceName && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-brand font-bold text-xs">✦</span>
                <span className="text-ink-3">Serviço:</span>
                <span className="text-ink font-medium">{preview.serviceName}</span>
              </div>
            )}
            {preview.staffName && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-brand font-bold text-xs">✦</span>
                <span className="text-ink-3">Responsável:</span>
                <span className="text-ink font-medium">{preview.staffName}</span>
              </div>
            )}
            {preview.date && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-brand font-bold text-xs">✦</span>
                <span className="text-ink-3">Data:</span>
                <span className="text-ink font-medium">{preview.date}</span>
              </div>
            )}
            {preview.time && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-brand font-bold text-xs">✦</span>
                <span className="text-ink-3">Horário:</span>
                <span className="text-ink font-medium">{preview.time}</span>
              </div>
            )}
            {preview.price && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-brand font-bold text-xs">✦</span>
                <span className="text-ink-3">Valor:</span>
                <span className="text-ink font-medium font-mono">{preview.price}</span>
              </div>
            )}
          </div>

          {verified ? (
            <>
              <div className="flex items-center gap-2 text-xs text-moss font-medium">
                <Check className="w-3.5 h-3.5 shrink-0" />
                Verificado — pode continuar para o formulário
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { reset(); setDescription("") }}
                  className="flex-1 py-2 rounded-lg border border-brand/30 bg-white text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint transition-colors"
                >
                  <span className="font-bold">✦</span> Descrever novamente
                </button>
                <button
                  type="button"
                  onClick={() => onFill(extractedFields)}
                  className="flex-1 py-2 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  style={{ background: "var(--brand-grad)" }}
                >
                  Usar estes dados
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVerified(true)}
                className="flex-1 py-2 rounded-lg border-2 border-moss bg-moss/8 text-moss text-sm font-semibold flex items-center justify-center gap-2 hover:bg-moss/15 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Verificar
              </button>
              <button
                type="button"
                onClick={() => { reset() }}
                className="flex-1 py-2 rounded-lg border border-border bg-white text-ink-2 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-surface-2 transition-colors"
              >
                <PenLine className="w-3.5 h-3.5" /> Editar descrição
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
