"use client"
import { useEffect, useState } from "react"

interface Props { staffId: string }

export function MyDayBriefing({ staffId }: Props) {
  const [briefing, setBriefing] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/ai/my-day?staffId=${staffId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.briefing) setBriefing(data.briefing as string) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [staffId])

  if (loading) {
    return (
      <div
        className="rounded-lg border px-3 py-2.5 flex gap-2.5 items-center animate-pulse"
        style={{ background: 'rgba(0,229,160,0.04)', borderColor: 'rgba(0,229,160,0.12)' }}
      >
        <span className="text-brand text-xs font-bold shrink-0">✦</span>
        <div className="h-3 rounded w-3/4" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>
    )
  }

  if (!briefing) return null

  return (
    <div
      className="rounded-lg border px-3 py-2.5 flex gap-2.5 items-start"
      style={{ background: 'rgba(0,229,160,0.04)', borderColor: 'rgba(0,229,160,0.12)' }}
    >
      <span className="text-brand text-xs font-bold mt-0.5 shrink-0">✦</span>
      <p className="text-[13px] font-light tracking-wide text-ink-2 leading-relaxed">{briefing}</p>
    </div>
  )
}
