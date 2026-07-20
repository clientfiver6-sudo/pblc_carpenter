"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

interface Action { label: string; href: string; description: string }
interface Props { businessId: string }

function boldNumbers(text: string): React.ReactNode[] {
  const parts = text.split(/(R\$\s*[\d.,]+|[\d]+(?:[.,]\d+)*(?:\s*%)?)/g)
  return parts.map((part, i) =>
    /\d/.test(part)
      ? <strong key={i} className="font-semibold text-ink">{part}</strong>
      : part
  )
}

export function AICommandCenter({ businessId }: Props) {
  const router = useRouter()
  const [briefing, setBriefing] = useState<string | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [now] = useState(() => new Date())

  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })
    .replace(".", "").replace(/^\w/, c => c.toUpperCase())

  useEffect(() => {
    const bKey = `ai_briefing_${businessId}`
    const aKey = `ai_actions_${businessId}`
    const cached = sessionStorage.getItem(bKey)
    const cachedActions = sessionStorage.getItem(aKey)

    if (cached && cachedActions) {
      setBriefing(cached)
      setActions(JSON.parse(cachedActions) as Action[])
      setLoading(false)
      return
    }

    Promise.all([
      fetch("/api/ai/briefing").then(r => r.ok ? r.json() : null),
      fetch("/api/ai/actions").then(r => r.ok ? r.json() : null),
    ]).then(([briefingData, actionsData]) => {
      if (briefingData?.briefing) {
        setBriefing(briefingData.briefing as string)
        sessionStorage.setItem(bKey, briefingData.briefing as string)
      }
      if (actionsData?.actions) {
        setActions(actionsData.actions as Action[])
        sessionStorage.setItem(aKey, JSON.stringify(actionsData.actions))
      }
    }).catch(() => {}).finally(() => setLoading(false))
  }, [businessId])

  if (!loading && !briefing && actions.length === 0) return null

  // Split "Bom dia." from the rest of the sentence
  const greeting = briefing?.startsWith("Bom dia") ? "Bom dia." : null
  const body = greeting && briefing
    ? briefing.slice(briefing.indexOf(". ") + 2)
    : briefing ?? ""

  return (
    <div
      className="mb-6 rounded-xl border flex gap-5 items-start"
      style={{
        padding: "20px 24px",
        background: "radial-gradient(120% 100% at 100% 0%, #FFE7D6 0%, transparent 55%), linear-gradient(135deg, #FFF7EF 0%, #FFF1E5 100%)",
        borderColor: "#F2D9C2",
        boxShadow: "0 6px 24px -12px rgba(232,93,31,.22)",
      }}
    >
      {/* Left sphere */}
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xl font-bold shrink-0 mt-0.5"
        style={{ background: "var(--brand-grad)" }}
      >
        ✦
      </div>

      {/* Right content */}
      <div className="flex-1 min-w-0" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

        {/* Meta row */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white border"
            style={{ borderColor: "#F2D9C2", color: "var(--brand-2)" }}
          >
            Resumo da manhã · {timeStr}
          </span>
          <span
            className="text-[11px] px-2 py-0.5 rounded-full border"
            style={{ borderColor: "#F2D9C2", color: "#A07050", background: "rgba(255,255,255,0.5)" }}
          >
            {dateStr}
          </span>
        </div>

        {/* Headline */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-5 rounded w-full bg-white/40" />
            <div className="h-5 rounded w-4/5 bg-white/40" />
          </div>
        ) : (
          <p style={{ fontSize: "24px", lineHeight: "1.3", color: "#1a1a1a", margin: 0 }}>
            {greeting && (
              <span className="font-serif italic" style={{ color: "var(--brand-2)" }}>
                {greeting}{" "}
              </span>
            )}
            <span className="font-semibold">{boldNumbers(body)}</span>
          </p>
        )}

        {/* Action row */}
        {!loading && (
          <div className="flex flex-wrap items-center gap-2">
            {actions[0] && (
              <button
                onClick={() => router.push(actions[0].href)}
                title={actions[0].description}
                className="text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
                style={{ background: "var(--brand-grad)", height: 36, paddingInline: 16 }}
              >
                {actions[0].label}
              </button>
            )}
            {actions[1] && (
              <button
                onClick={() => router.push(actions[1].href)}
                title={actions[1].description}
                className="text-sm font-semibold rounded-lg bg-white border hover:bg-orange-50 transition-colors"
                style={{ borderColor: "#F2D9C2", color: "#7A5035", height: 36, paddingInline: 16 }}
              >
                {actions[1].label}
              </button>
            )}
            <button
              onClick={() => router.push("/dashboard/work-items")}
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--brand-2)", height: 36, paddingInline: 4 }}
            >
              Ver agenda de hoje &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
