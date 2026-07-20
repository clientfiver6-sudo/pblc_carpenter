"use client"

import { useEffect, useState } from "react"
import { Bot } from "lucide-react"

interface UsagePeriod {
  input_tokens: number
  output_tokens: number
  cost_usd_cents: number
}

interface ByFunctionEntry {
  function_name: string
  total_cost_usd_cents: number
  call_count: number
}

interface UsageData {
  today: UsagePeriod
  week: UsagePeriod
  month: UsagePeriod
  byFunction: ByFunctionEntry[]
}

function formatCostUSD(cents: number): string {
  return `US$ ${(cents / 100).toFixed(4)}`
}

function formatTokens(input: number, output: number): string {
  const total = input + output
  if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(1)}M tokens`
  if (total >= 1_000) return `${(total / 1_000).toFixed(1)}k tokens`
  return `${total} tokens`
}

export function AIUsageWidget() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/ai/usage")
      .then((r) => r.json())
      .then((d: UsageData) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-tint flex items-center justify-center">
            <Bot className="w-4 h-4 text-brand" />
          </div>
          <span className="text-ink font-semibold text-sm">Uso de IA</span>
        </div>
        <span className="text-[10px] font-mono text-brand bg-tint px-2 py-0.5 rounded-full">
          ✦ Gerado por IA
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-surface-2 rounded animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <p className="text-ink-3 text-xs">Dados indisponíveis.</p>
      ) : (
        <>
          {/* Period stats */}
          <div className="space-y-2 mb-4">
            {(
              [
                { label: "Hoje", period: data.today },
                { label: "Semana", period: data.week },
                { label: "Mês", period: data.month },
              ] as { label: string; period: UsagePeriod }[]
            ).map(({ label, period }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-ink-2 text-sm w-16">{label}</span>
                <span className="font-mono text-sm font-bold text-ink">
                  {formatTokens(period.input_tokens, period.output_tokens)}
                </span>
                <span className="font-mono text-xs text-ink-3">
                  {formatCostUSD(period.cost_usd_cents)}
                </span>
              </div>
            ))}
          </div>

          {/* By function */}
          {data.byFunction.length > 0 && (
            <>
              <div className="border-t border-border pt-3">
                <p className="text-ink-3 text-[10px] uppercase tracking-widest font-mono mb-2">
                  Por função
                </p>
                <div className="space-y-1.5">
                  {data.byFunction.slice(0, 6).map((fn) => (
                    <div key={fn.function_name} className="flex items-center justify-between">
                      <span className="text-ink-2 text-sm truncate max-w-[160px]">
                        {fn.function_name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-ink-4 text-[10px]">{fn.call_count}x</span>
                        <span className="font-mono text-sm font-bold text-ink">
                          {formatCostUSD(fn.total_cost_usd_cents)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
