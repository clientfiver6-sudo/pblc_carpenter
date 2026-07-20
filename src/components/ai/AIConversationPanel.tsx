"use client"
import { useEffect, useState } from "react"

interface ConversationInsight {
  intent: string
  sentiment: "positive" | "neutral" | "negative"
  urgency: "low" | "medium" | "high"
  suggested_reply: string
  summary: string
}

interface Props {
  conversationId: string
  onDraftReady?: (text: string) => void
}

const URGENCY_LABEL = { low: "Baixa", medium: "Média", high: "Alta" }
const URGENCY_COLOR = {
  low: "text-moss border-moss/30",
  medium: "text-warning border-warning/30",
  high: "text-danger border-danger/30",
}

export function AIConversationPanel({ conversationId, onDraftReady }: Props) {
  const [insight, setInsight] = useState<ConversationInsight | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/conversation-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        })
        if (!res.ok) {
          setLoading(false)
          return
        }
        const data = (await res.json()) as { insight: ConversationInsight }
        setInsight(data.insight)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [conversationId])

  if (!loading && !insight) return null

  return (
    <div
      className="mt-4 rounded-lg border p-4"
      style={{
        background: 'radial-gradient(120% 100% at 100% 0%, #FFE7D6 0%, transparent 55%), linear-gradient(135deg, #FFF7EF 0%, #FFF1E5 100%)',
        borderColor: '#F2D9C2',
        boxShadow: '0 8px 28px -16px rgba(232,93,31,.25)'
      }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white text-brand-2 border"
          style={{ borderColor: '#F2D9C2' }}
        >
          <span className="text-brand font-bold text-xs">✦</span>
          Análise da conversa
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="animate-pulse h-3 bg-surface-2 rounded w-full" />
          <div className="animate-pulse h-3 bg-surface-2 rounded w-3/4" />
          <div className="animate-pulse h-3 bg-surface-2 rounded w-1/2" />
        </div>
      ) : insight ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`rounded border px-2 py-0.5 text-xs font-medium ${URGENCY_COLOR[insight.urgency]}`}
            >
              {URGENCY_LABEL[insight.urgency]}
            </span>
          </div>
          <p className="text-xs text-ink-2">
            <span className="text-ink font-medium">Intenção:</span> {insight.intent}
          </p>
          {insight.summary && (
            <p className="text-xs text-ink-2">✦ {insight.summary}</p>
          )}
          {onDraftReady && insight.suggested_reply && (
            <button
              onClick={() => onDraftReady(insight.suggested_reply)}
              className="w-full rounded-md border py-2 text-xs font-medium text-ink-2 transition hover:bg-surface-2"
              style={{ borderColor: '#F2D9C2' }}
            >
              ✦ Usar rascunho
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
