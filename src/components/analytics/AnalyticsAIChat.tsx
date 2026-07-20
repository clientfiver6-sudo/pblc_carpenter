"use client"

import { useState, useRef } from "react"
import { Send, RotateCcw, Lock } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

export interface AnalyticsSummary {
  period: string
  revenue: { current: number; previous: number; paid_count: number; avg_ticket: number }
  work_items: { total: number; completed: number; cancelled: number; completion_rate: number }
  customers: { total: number; new_this_month: number; returning: number; retention_rate: number }
  conversations: { total: number; open: number; resolved: number; ai_handled: number; ai_ratio: number }
  top_services: { name: string; count: number }[]
}

export function AnalyticsAIChat({ summary }: { summary: AnalyticsSummary }) {
  const [history, setHistory] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function send(msgs: Message[]) {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, summary }),
      })
      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let text = ""

      setHistory([...msgs, { role: "assistant", content: "" }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setHistory([...msgs, { role: "assistant", content: text }])
      }
    } catch {
      setHistory(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: "assistant", content: "Erro de conexão. Tente novamente." }
        return copy
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    const userMsg: Message = { role: "user", content: text }
    const newHistory = [...history, userMsg]
    setHistory(newHistory)
    setInput("")
    await send(newHistory)
  }

  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{
        background: "radial-gradient(120% 100% at 100% 0%,#FFE7D6 0%,transparent 55%),linear-gradient(135deg,#FFF7EF 0%,#FFF1E5 100%)",
        borderColor: "#F2D9C2",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-brand font-bold text-base">✦</span>
          <p className="text-sm font-bold text-ink">Análise com IA</p>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-4 bg-surface border border-border rounded-full px-2 py-0.5">
            <Lock className="w-2.5 h-2.5" />
            só análises
          </span>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={() => { setHistory([]); setInput("") }}
            className="flex items-center gap-1 text-xs text-ink-4 hover:text-ink-2 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Limpar
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {history.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "user" ? (
                <span className="bg-ink text-white text-sm px-3 py-1.5 rounded-xl rounded-tr-sm max-w-[80%]">
                  {msg.content}
                </span>
              ) : (
                <div className="text-sm text-ink max-w-[90%] bg-white/60 rounded-xl rounded-tl-sm px-3 py-2" style={{ borderColor: "#F2D9C2" }}>
                  {msg.content || <span className="w-3 h-3 rounded-full border-2 border-brand/30 border-t-brand animate-spin inline-block" />}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pergunte sobre receita, clientes, serviços…"
          className="flex-1 rounded-xl border bg-white/70 px-4 py-2 h-10 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/20"
          style={{ borderColor: "#F2D9C2" }}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--brand-grad)" }}
        >
          {loading
            ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}
