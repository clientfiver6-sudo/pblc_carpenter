"use client"
import { useState } from "react"
import { Loader2 } from "lucide-react"

interface AIEntryPanelProps<T extends object> {
  entityType: string
  placeholder: string
  context?: object
  onFill: (fields: Partial<T>) => void
}

export function AIEntryPanel<T extends object>({
  entityType,
  placeholder,
  context,
  onFill,
}: AIEntryPanelProps<T>) {
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState<string | null>(null)
  const [followUp, setFollowUp] = useState("")
  const [preview, setPreview] = useState<Record<string, string> | null>(null)
  const [extractedFields, setExtractedFields] = useState<Partial<T> | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function extract(followUpAnswer?: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, description, context, followUp: followUpAnswer }),
      })
      const data = await res.json() as {
        fields: Partial<T>
        missing: string[]
        question: string | null
        preview: Record<string, string>
        error?: string
      }
      if (data.error) { setError(data.error); return }
      setExtractedFields(data.fields)
      setPreview(data.preview)
      if (data.question) {
        setQuestion(data.question)
        setFollowUp("")
      } else {
        setQuestion(null)
      }
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
        background: 'radial-gradient(120% 100% at 100% 0%, #FFE7D6 0%, transparent 55%), linear-gradient(135deg, #FFF7EF 0%, #FFF1E5 100%)',
        borderColor: '#F2D9C2',
        boxShadow: '0 8px 28px -16px rgba(232,93,31,.25)',
      }}
    >
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white text-brand-2 border mb-1"
        style={{ borderColor: '#F2D9C2' }}
      >
        <span className="text-brand font-bold text-xs">✦</span>
        Descrever com IA
      </span>

      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full border rounded-lg p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none"
        style={{ borderColor: '#F2D9C2', background: 'rgba(255,255,255,.8)' }}
      />

      <button
        type="button"
        onClick={() => void extract()}
        disabled={loading || !description.trim()}
        className="flex items-center gap-2 px-4 py-2 rounded-md text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
        style={{ background: 'var(--brand-grad)' }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="font-bold">✦</span>}
        {loading ? "Analisando..." : "Preencher campos"}
      </button>

      {error && <p className="text-danger text-xs">{error}</p>}

      {question && (
        <div
          className="bg-white border rounded-lg p-3 text-sm italic text-ink-2"
          style={{ borderColor: '#F2D9C2' }}
        >
          <span className="text-brand font-bold not-italic">✦</span>{" "}
          {question}
          <div className="flex gap-2 mt-3 not-italic">
            <input
              value={followUp}
              onChange={e => setFollowUp(e.target.value)}
              placeholder="Sua resposta..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              style={{ borderColor: '#F2D9C2', background: 'rgba(255,255,255,.8)' }}
            />
            <button
              type="button"
              onClick={() => void extract(followUp)}
              disabled={loading || !followUp.trim()}
              className="px-4 py-2 rounded-md text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
              style={{ background: 'var(--brand-grad)' }}
            >
              Responder
            </button>
          </div>
        </div>
      )}

      {preview && extractedFields && !question && (
        <div
          className="bg-white border rounded-lg p-4 space-y-2"
          style={{ borderColor: '#F2D9C2' }}
        >
          <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">Informações identificadas</p>
          <div className="space-y-1.5">
            {Object.entries(preview)
              .filter(([, v]) => v && v !== "null")
              .map(([label, value]) => (
                <div key={label} className="flex items-center gap-2 text-sm">
                  <span className="text-brand font-bold text-xs">✦</span>
                  <span className="text-ink-3">{label}:</span>
                  <span className="text-ink font-medium">{value}</span>
                </div>
              ))}
          </div>
          <button
            type="button"
            onClick={() => { if (extractedFields) onFill(extractedFields) }}
            className="w-full mt-3 px-4 py-2 rounded-md text-white text-sm font-semibold hover:opacity-90 transition-colors"
            style={{ background: 'var(--ink)' }}
          >
            Usar estes dados
          </button>
        </div>
      )}

      {loading && !preview && (
        <p className="text-brand text-sm animate-pulse">Analisando descrição...</p>
      )}
    </div>
  )
}
