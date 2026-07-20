"use client"
import { useEffect, useState } from "react"

interface WorkItemRisk {
  no_show_risk: "low" | "medium" | "high"
  payment_risk: "low" | "medium" | "high"
  no_show_reason: string | null
  payment_reason: string | null
  overall_score: number
}

interface Props {
  workItemId: string
}

const RISK_EMOJI = { low: "🟢", medium: "🟡", high: "🔴" }
const RISK_LABEL = { low: "Baixo", medium: "Médio", high: "Alto" }

export function AIWorkItemRisk({ workItemId }: Props) {
  const [risk, setRisk] = useState<WorkItemRisk | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/ai/work-item-risk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workItemId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.risk) setRisk(data.risk as WorkItemRisk)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workItemId])

  if (!loading && !risk) return null

  const tooltip = risk
    ? [
        risk.no_show_reason ? `Não comparecimento: ${risk.no_show_reason}` : null,
        risk.payment_reason ? `Pagamento: ${risk.payment_reason}` : null,
      ]
        .filter(Boolean)
        .join(" | ") || undefined
    : undefined

  return (
    <div
      title={tooltip}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1"
    >
      {loading ? (
        <span className="text-xs text-ink-3 animate-pulse">Analisando risco...</span>
      ) : risk ? (
        <>
          <span>{RISK_EMOJI[risk.no_show_risk]}</span>
          <span className="text-xs text-ink-2">
            Risco:{" "}
            <span className="font-medium text-ink">{RISK_LABEL[risk.no_show_risk]}</span>
          </span>
          {risk.no_show_risk !== "low" && (
            <span className="font-mono text-[10px] text-brand">✦ IA</span>
          )}
        </>
      ) : null}
    </div>
  )
}
