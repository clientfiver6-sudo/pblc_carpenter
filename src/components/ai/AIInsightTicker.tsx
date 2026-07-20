"use client"
import { useState, useEffect } from "react"

interface Props { briefing: string }

export function AIInsightTicker({ briefing }: Props) {
  const sentences = briefing.split(/(?<=[.!?])\s+/).filter(s => s.length > 10)
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (sentences.length <= 1) return
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setCurrent(prev => (prev + 1) % sentences.length)
        setVisible(true)
      }, 400)
    }, 5000)
    return () => clearInterval(interval)
  }, [sentences.length])

  if (sentences.length === 0) return null

  return (
    <div className="mb-4 flex items-center gap-2 overflow-hidden">
      <span
        className="text-sm text-ink-2 transition-opacity duration-400"
        style={{ opacity: visible ? 1 : 0 }}
      >
        ✦ {sentences[current]}
      </span>
    </div>
  )
}
