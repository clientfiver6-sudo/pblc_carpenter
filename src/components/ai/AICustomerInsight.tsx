"use client"
import { useEffect, useState } from "react"

interface CustomerInsight {
  segment: string
  ltv_estimate: number
  churn_risk: "low" | "medium" | "high"
  churn_reason: string | null
  upsell_suggestion: string | null
  summary: string
}

interface Props {
  customerId: string
}

const CHURN_COLOR = { low: "var(--moss)", medium: "var(--warning)", high: "var(--danger)" }
const CHURN_LABEL = { low: "Baixo", medium: "Médio", high: "Alto" }
const CHURN_TEXT_CLASS = { low: "text-moss", medium: "text-warning", high: "text-danger" }

export function AICustomerInsight({ customerId }: Props) {
  const [insight, setInsight] = useState<CustomerInsight | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/ai/customer-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.insight) setInsight(data.insight as CustomerInsight)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customerId])

  if (!loading && !insight) return null

  const fmt = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`

  return (
    <div
      className="rounded-lg border p-5"
      style={{
        background: 'radial-gradient(120% 100% at 100% 0%, #FFE7D6 0%, transparent 55%), linear-gradient(135deg, #FFF7EF 0%, #FFF1E5 100%)',
        borderColor: '#F2D9C2',
        boxShadow: '0 8px 28px -16px rgba(232,93,31,.25)'
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white text-brand-2 border"
          style={{ borderColor: '#F2D9C2' }}
        >
          <span className="text-brand font-bold text-xs">✦</span>
          Análise IA do cliente
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="animate-pulse h-4 bg-surface-2 rounded w-1/3" />
          <div className="animate-pulse h-3 bg-surface-2 rounded w-full" />
          <div className="animate-pulse h-3 bg-surface-2 rounded w-4/5" />
        </div>
      ) : insight ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="rounded-full bg-tint px-3 py-1 text-xs font-medium text-brand">
              {insight.segment}
            </span>
            <div className="flex items-center gap-1.5">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CHURN_COLOR[insight.churn_risk] }}
              />
              <span className="text-xs text-ink-2">
                Risco de churn:{" "}
                <span className={`font-medium ${CHURN_TEXT_CLASS[insight.churn_risk]}`}>
                  {CHURN_LABEL[insight.churn_risk]}
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-xs text-ink-3">LTV estimado</p>
              <p className="font-mono text-sm font-bold text-ink">
                {fmt(insight.ltv_estimate)}
              </p>
            </div>
            {insight.upsell_suggestion && (
              <div className="rounded-lg bg-surface-2 p-3">
                <p className="text-xs text-ink-3">Oportunidade</p>
                <p className="text-xs text-ink">{insight.upsell_suggestion}</p>
              </div>
            )}
          </div>

          {insight.summary && (
            <p className="text-xs text-ink-2">✦ {insight.summary}</p>
          )}
          {insight.churn_reason && (
            <p className="text-xs text-danger">⚠ {insight.churn_reason}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
