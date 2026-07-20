"use client"
import { useEffect, useRef, useState } from "react"

interface Props {
  conversationId: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}

export function AITypingAssist({
  conversationId,
  value,
  onChange,
  placeholder,
  rows = 3,
}: Props) {
  const [suggestion, setSuggestion] = useState("")
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setSuggestion("")
    if (!value.trim() || value.length < 5) return

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/ai/draft-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId }),
        })
        if (!res.ok) return
        const data = (await res.json()) as { draft: string }
        if (data.draft && data.draft !== value) setSuggestion(data.draft)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }, 1500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, conversationId])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab" && suggestion) {
      e.preventDefault()
      onChange(suggestion)
      setSuggestion("")
    }
  }

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {loading && (
        <div className="absolute bottom-2 right-2 text-[10px] text-ink-4 animate-pulse">
          ✦ IA...
        </div>
      )}
      {!loading && suggestion && (
        <div className="mt-1 flex items-center gap-2">
          <p className="text-[10px] text-ink-3 truncate flex-1">
            ✦ Sugestão: {suggestion.slice(0, 60)}...
          </p>
          <button
            type="button"
            onClick={() => {
              onChange(suggestion)
              setSuggestion("")
            }}
            className="text-[10px] text-brand hover:underline flex-shrink-0"
          >
            Tab para aceitar
          </button>
        </div>
      )}
    </div>
  )
}
