"use client"
import { useState, useEffect, useRef } from "react"
import { X, Send } from "lucide-react"

export function AskAI() {
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || loading) return
    setAnswer("")
    setLoading(true)
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      })
      if (!res.body) { setLoading(false); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setAnswer(prev => prev + decoder.decode(value, { stream: true }))
      }
    } catch {
      setAnswer("Erro ao processar sua pergunta. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => textareaRef.current?.focus(), 100) }}
        className="fixed bottom-7 right-7 flex items-center gap-2.5 h-14 px-5 rounded-full text-white font-semibold text-sm z-50 transition-transform hover:scale-[1.03] active:scale-[0.98]"
        style={{ background: 'var(--ink)', boxShadow: '0 16px 40px -10px rgba(24,22,19,.55)' }}
      >
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ background: 'var(--brand-grad)' }}
        >✦</span>
        Perguntar à IA
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-2xl rounded-xl border border-border bg-surface overflow-hidden"
            style={{ boxShadow: 'var(--shadow-3)' }}
          >
            {/* Brand top stripe */}
            <div className="h-1 rounded-t-xl" style={{ background: 'var(--brand-grad)' }} />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white text-brand-2 border"
                  style={{ borderColor: '#F2D9C2' }}
                >
                  <span className="text-brand font-bold text-xs">✦</span>
                  Perguntar à IA
                </span>
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-3 hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Ex: Como estão minhas vendas esta semana? Quem são meus melhores clientes?"
                rows={3}
                className="w-full resize-none rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <button
                type="submit"
                disabled={loading || !question.trim()}
                className="flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--brand-grad)' }}
              >
                <Send className="h-4 w-4" />
                {loading ? "Processando..." : "Perguntar"}
              </button>
            </form>

            {answer && (
              <div
                className="mx-6 mb-6 rounded-lg border p-5"
                style={{
                  background: 'radial-gradient(120% 100% at 100% 0%, #FFE7D6 0%, transparent 55%), linear-gradient(135deg, #FFF7EF 0%, #FFF1E5 100%)',
                  borderColor: '#F2D9C2',
                  boxShadow: '0 8px 28px -16px rgba(232,93,31,.25)'
                }}
              >
                <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">✦ {answer}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
