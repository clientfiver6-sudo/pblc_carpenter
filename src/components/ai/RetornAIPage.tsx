"use client"
import { useState, useRef, useEffect } from "react"
import { Send, RotateCcw, ChevronRight, ChevronDown } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { DailyBriefing } from "@/app/dashboard/retornai/page"

interface Message {
  role: "user" | "assistant"
  content: string
  isQuestion?: boolean
}

interface ChoiceItem { id: string; name: string }

// Parse [CHOICES:services] / [CHOICES:staff] markers from AI question text
function parseQuestion(q: string) {
  return {
    text: q.replace(/\[CHOICES:services\]/g, "").replace(/\[CHOICES:staff\]/g, "").replace(/\s{2,}/g, " ").trim(),
    wantsServices: q.includes("[CHOICES:services]"),
    wantsStaff: q.includes("[CHOICES:staff]"),
  }
}

const CHIPS = [
  "Adicionar cliente",
  "Ver agenda de hoje",
  "Criar automação",
  "Ver pagamentos pendentes",
]

export function RetornAIPage({
  onboarded = true,
  isActive = true,
  services = [],
  staff = [],
}: {
  briefing: DailyBriefing
  onboarded?: boolean
  isActive?: boolean
  services?: ChoiceItem[]
  staff?: ChoiceItem[]
}) {
  const router = useRouter()
  const [history, setHistory] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  const [followUp, setFollowUp] = useState("")

  // Dropdown choice state
  const [selService, setSelService] = useState("")
  const [selStaff, setSelStaff] = useState("")
  const [customService, setCustomService] = useState("")
  const [customStaff, setCustomStaff] = useState("")

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const followUpRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" })
    }
  }, [history])

  async function send(msgs: Message[]) {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs.map(m => ({ role: m.role, content: m.content })) }),
      })
      if (!res.body) { setLoading(false); return }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let raw = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        raw += decoder.decode(value, { stream: true })
      }

      // Extract navigation sentinel
      const navMatch = raw.match(/\[NAV:([^\]]+)\]/)
      const text = raw.replace(/\[NAV:[^\]]+\]/g, "").trim()

      const isQuestion = text.startsWith("[Q]")
      const displayText = isQuestion ? text.slice(3).trim() : text

      const assistantMsg: Message = { role: "assistant", content: displayText, isQuestion }
      setHistory([...msgs, assistantMsg])

      if (isQuestion) {
        setPendingQuestion(displayText)
        setFollowUp("")
        setSelService("")
        setSelStaff("")
        setCustomService("")
        setCustomStaff("")
        setTimeout(() => followUpRef.current?.focus(), 80)
      } else {
        setPendingQuestion(null)
      }

      if (navMatch) {
        const href = navMatch[1]
        setTimeout(() => router.push(href), 800)
      }
    } catch {
      const errMsg: Message = { role: "assistant", content: "Erro de conexão. Tente novamente." }
      setHistory(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent, overrideInput?: string) {
    e.preventDefault()
    const text = (overrideInput ?? input).trim()
    if (!text || loading) return
    const userMsg: Message = { role: "user", content: text }
    const newHistory = [...history, userMsg]
    setHistory(newHistory)
    setInput("")
    setPendingQuestion(null)
    await send(newHistory)
  }

  function buildChoiceFollowUp(parsed: ReturnType<typeof parseQuestion>): string {
    const parts: string[] = []
    if (parsed.wantsServices && selService) {
      const name = selService === "__outro__"
        ? (customService.trim() || "Outro")
        : (services.find(s => s.id === selService)?.name ?? selService)
      parts.push(`Serviço: ${name}`)
    }
    if (parsed.wantsStaff && selStaff) {
      const name = selStaff === "__outro__"
        ? (customStaff.trim() || "Outro")
        : (staff.find(s => s.id === selStaff)?.name ?? selStaff)
      parts.push(`Responsável: ${name}`)
    }
    if (followUp.trim()) parts.push(followUp.trim())
    return parts.join(" / ")
  }

  async function handleFollowUp(e: React.FormEvent) {
    e.preventDefault()
    if (loading || !pendingQuestion) return
    const parsed = parseQuestion(pendingQuestion)
    const hasChoices = parsed.wantsServices || parsed.wantsStaff
    const text = hasChoices ? buildChoiceFollowUp(parsed) : followUp.trim()
    if (!text) return
    const userMsg: Message = { role: "user", content: text }
    const newHistory = [...history, userMsg]
    setHistory(newHistory)
    setFollowUp("")
    await send(newHistory)
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit(e as unknown as React.FormEvent)
    }
  }

  function handleFollowUpKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void handleFollowUp(e as unknown as React.FormEvent)
    }
  }

  const isEmpty = history.length === 0 && !loading

  // Subscription inactive — show locked state with renewal CTA
  if (!isActive) {
    return (
      <>
        <style>{`
          @keyframes orb-morph {
            0%,100%{ border-radius:60% 40% 30% 70%/60% 30% 70% 40%; }
            25%     { border-radius:40% 60% 55% 45%/50% 65% 35% 55%; }
            50%     { border-radius:30% 60% 70% 40%/50% 60% 30% 60%; }
            75%     { border-radius:55% 45% 40% 60%/45% 55% 60% 40%; }
          }
          @keyframes orb-pulse { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(1.06);opacity:0.92;} }
          .orb { animation: orb-morph 7s ease-in-out infinite, orb-pulse 4s ease-in-out infinite; }
        `}</style>
        <div className="flex flex-col bg-white overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
          <div className="shrink-0 flex flex-col items-center pt-6 pb-2">
            <div
              className="orb opacity-40"
              style={{ width: 160, height: 160, background: "var(--brand-grad)", boxShadow: "0 28px 72px -14px rgba(232,93,31,.25)" }}
            />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
            <div className="max-w-lg mx-auto">
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div
                  className="rounded-xl rounded-tl-sm border px-4 py-3 text-sm text-ink max-w-[90%]"
                  style={{
                    background: "radial-gradient(120% 100% at 100% 0%,#FFE7D6 0%,transparent 55%),linear-gradient(135deg,#FFF7EF 0%,#FFF1E5 100%)",
                    borderColor: "#F2D9C2",
                  }}
                >
                  <span className="text-brand font-bold mr-1.5">✦</span>
                  Sua assinatura está inativa. Renove o plano para continuar usando o assistente RetornAI.
                </div>
              </div>
            </div>
          </div>
          <div className="shrink-0 px-4 sm:px-6 pb-8 pt-3">
            <div className="max-w-lg mx-auto space-y-3">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-4 py-3 opacity-60 cursor-not-allowed select-none">
                <span className="flex-1 text-sm text-ink-4">Assistente bloqueado enquanto a assinatura estiver inativa…</span>
                <span className="text-ink-4 text-base">🔒</span>
              </div>
              <Link
                href="/dashboard/settings/subscription"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
                style={{ background: "var(--brand-grad)" }}
              >
                Renovar assinatura
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Not onboarded — chat UI with one pre-loaded message, input locked
  if (!onboarded) {
    return (
      <>
        <style>{`
          @keyframes orb-morph {
            0%,100%{ border-radius:60% 40% 30% 70%/60% 30% 70% 40%; }
            25%     { border-radius:40% 60% 55% 45%/50% 65% 35% 55%; }
            50%     { border-radius:30% 60% 70% 40%/50% 60% 30% 60%; }
            75%     { border-radius:55% 45% 40% 60%/45% 55% 60% 40%; }
          }
          @keyframes orb-pulse { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(1.06);opacity:0.92;} }
          .orb { animation: orb-morph 7s ease-in-out infinite, orb-pulse 4s ease-in-out infinite; }
        `}</style>
        <div className="flex flex-col bg-white overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
          {/* Orb */}
          <div className="shrink-0 flex flex-col items-center pt-6 pb-2">
            <div
              className="orb"
              style={{ width: 160, height: 160, background: "var(--brand-grad)", boxShadow: "0 28px 72px -14px rgba(232,93,31,.45)" }}
            />
          </div>

          {/* Single AI message */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4">
            <div className="max-w-lg mx-auto">
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div
                  className="rounded-xl rounded-tl-sm border px-4 py-3 text-sm text-ink max-w-[90%]"
                  style={{
                    background: "radial-gradient(120% 100% at 100% 0%,#FFE7D6 0%,transparent 55%),linear-gradient(135deg,#FFF7EF 0%,#FFF1E5 100%)",
                    borderColor: "#F2D9C2",
                  }}
                >
                  <span className="text-brand font-bold mr-1.5">✦</span>
                  Olá! Sou o seu assistente RetornAI. Estou pronto para gerenciar clientes, agendamentos, cobranças e muito mais — mas primeiro, configure sua conta para ativar tudo isso.
                </div>
              </div>
            </div>
          </div>

          {/* Locked input */}
          <div className="shrink-0 px-4 sm:px-6 pb-8 pt-3">
            <div className="max-w-lg mx-auto space-y-3">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-4 py-3 opacity-60 cursor-not-allowed select-none">
                <span className="flex-1 text-sm text-ink-4">Configure sua conta para conversar…</span>
                <span className="text-ink-4 text-base">🔒</span>
              </div>
              <Link
                href="/setup"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
                style={{ background: "var(--brand-grad)" }}
              >
                Configurar agora
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{`
        @keyframes orb-morph {
          0%,100%{ border-radius:60% 40% 30% 70%/60% 30% 70% 40%; }
          25%     { border-radius:40% 60% 55% 45%/50% 65% 35% 55%; }
          50%     { border-radius:30% 60% 70% 40%/50% 60% 30% 60%; }
          75%     { border-radius:55% 45% 40% 60%/45% 55% 60% 40%; }
        }
        @keyframes orb-pulse     { 0%,100%{transform:scale(1);   opacity:1;}   50%{transform:scale(1.06);opacity:0.92;} }
        @keyframes orb-pulse-fast{ 0%,100%{transform:scale(1);   opacity:1;}   50%{transform:scale(1.11);opacity:0.86;} }
        .orb      { animation: orb-morph 7s ease-in-out infinite, orb-pulse      4s   ease-in-out infinite; }
        .orb-busy { animation: orb-morph 3s ease-in-out infinite, orb-pulse-fast 1.2s ease-in-out infinite; }
      `}</style>

      <div className="flex flex-col bg-white overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>

        {isEmpty ? (
          /* ── Empty state: orb + input centered ── */
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 animate-in fade-in zoom-in-95 duration-300 overflow-y-auto py-6">

            <div className="flex flex-col items-center gap-2">
              <div
                className={loading ? "orb-busy" : "orb"}
                style={{
                  width: 160, height: 160,
                  background: "var(--brand-grad)",
                  boxShadow: "0 28px 72px -14px rgba(232,93,31,.45)",
                }}
              />
              <p className={`text-xs transition-opacity duration-200 ${loading ? "text-ink-3 opacity-100 animate-in fade-in duration-200" : "opacity-0"}`}>
                pensando…
              </p>
            </div>
            <div className="w-full max-w-lg space-y-4">
              <form onSubmit={handleSubmit}>
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Adicionar cliente, registrar evento, consultar dados…"
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink-4 focus:outline-none"
                    style={{ maxHeight: 120 }}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl text-white transition hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--brand-grad)" }}
                  >
                    {loading
                      ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-2 text-center text-xs text-ink-4">
                  Enter para enviar · Shift+Enter para nova linha
                </p>
              </form>
              <div className="grid grid-cols-2 gap-2">
                {CHIPS.map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={e => void handleSubmit(e, chip)}
                    className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink-2 hover:border-brand hover:text-brand transition-colors hover:scale-[1.03] active:scale-[0.98] transition-transform duration-150 text-left"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── Active conversation: orb top, scroll, controls bottom ── */
          <>
            <div className="shrink-0 flex flex-col items-center pt-6 pb-2">
              <div
                className={loading ? "orb-busy" : "orb"}
                style={{
                  width: 160, height: 160,
                  background: "var(--brand-grad)",
                  boxShadow: "0 28px 72px -14px rgba(232,93,31,.45)",
                }}
              />
              <p className={`mt-1.5 text-xs transition-opacity duration-200 ${loading ? "text-ink-3 opacity-100 animate-in fade-in duration-200" : "opacity-0"}`}>
                pensando…
              </p>
            </div>

            <div
              ref={logRef}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-2 scroll-smooth"
            >
              <div className="max-w-lg mx-auto flex flex-col gap-2">
                {history.map((msg, i) => {
                  if (msg.role === "user") {
                    return (
                      <div key={i} className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                        <span className="bg-ink text-white text-sm px-3 py-1.5 rounded-2xl rounded-tr-sm max-w-[85%]">
                          {msg.content}
                        </span>
                      </div>
                    )
                  }
                  if (msg.isQuestion) return null
                  return (
                    <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
                      <div
                        data-testid="ai-message"
                        className="rounded-xl rounded-tl-sm border px-4 py-2.5 text-sm text-ink max-w-[90%]"
                        style={{
                          background: "radial-gradient(120% 100% at 100% 0%,#FFE7D6 0%,transparent 55%),linear-gradient(135deg,#FFF7EF 0%,#FFF1E5 100%)",
                          borderColor: "#F2D9C2",
                        }}
                      >
                        <span className="text-brand font-bold mr-1">✦</span>
                        {msg.content}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="shrink-0 px-4 sm:px-6 pb-8 pt-3">
              <div className="max-w-lg mx-auto space-y-4">

            {/* Follow-up question box */}
            {pendingQuestion && (() => {
              const parsed = parseQuestion(pendingQuestion)
              const hasChoices = parsed.wantsServices || parsed.wantsStaff
              const canSubmit = !loading && (
                hasChoices
                  ? ((!parsed.wantsServices || selService) && (!parsed.wantsStaff || selStaff) &&
                     (selService !== "__outro__" || customService.trim()) &&
                     (selStaff !== "__outro__" || customStaff.trim()))
                  : followUp.trim().length > 0
              )

              return (
                <div
                  data-testid="ai-question"
                  className="rounded-xl border p-4 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-400"
                  style={{
                    background: "radial-gradient(120% 100% at 100% 0%,#FFE7D6 0%,transparent 55%),linear-gradient(135deg,#FFF7EF 0%,#FFF1E5 100%)",
                    borderColor: "#F2D9C2",
                  }}
                >
                  <p className="text-sm text-ink">
                    <span className="text-brand font-bold mr-1.5">✦</span>
                    {parsed.text}
                  </p>

                  <form onSubmit={handleFollowUp} className="space-y-2">
                    {/* Service dropdown */}
                    {parsed.wantsServices && services.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-ink-3">Serviço</p>
                        <div className="flex flex-wrap gap-2">
                          {services.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setSelService(s.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                selService === s.id
                                  ? "border-brand bg-brand text-white"
                                  : "border-border bg-white/80 text-ink-2 hover:border-brand/50"
                              }`}
                            >
                              {s.name}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setSelService("__outro__")}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              selService === "__outro__"
                                ? "border-brand bg-brand text-white"
                                : "border-border bg-white/80 text-ink-2 hover:border-brand/50"
                            }`}
                          >
                            Outro
                          </button>
                        </div>
                        {selService === "__outro__" && (
                          <input
                            autoFocus
                            type="text"
                            value={customService}
                            onChange={e => setCustomService(e.target.value)}
                            placeholder="Nome do serviço..."
                            className="w-full rounded-lg border bg-white/80 px-3 py-2 h-9 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/20"
                            style={{ borderColor: "#F2D9C2" }}
                          />
                        )}
                      </div>
                    )}

                    {/* Staff dropdown */}
                    {parsed.wantsStaff && staff.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-ink-3">Responsável</p>
                        <div className="flex flex-wrap gap-2">
                          {staff.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setSelStaff(s.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                selStaff === s.id
                                  ? "border-brand bg-brand text-white"
                                  : "border-border bg-white/80 text-ink-2 hover:border-brand/50"
                              }`}
                            >
                              {s.name}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setSelStaff("__outro__")}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              selStaff === "__outro__"
                                ? "border-brand bg-brand text-white"
                                : "border-border bg-white/80 text-ink-2 hover:border-brand/50"
                            }`}
                          >
                            Outro
                          </button>
                        </div>
                        {selStaff === "__outro__" && (
                          <input
                            autoFocus={!parsed.wantsServices}
                            type="text"
                            value={customStaff}
                            onChange={e => setCustomStaff(e.target.value)}
                            placeholder="Nome do responsável..."
                            className="w-full rounded-lg border bg-white/80 px-3 py-2 h-9 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/20"
                            style={{ borderColor: "#F2D9C2" }}
                          />
                        )}
                      </div>
                    )}

                    {/* Plain text input for non-choice questions */}
                    {!hasChoices && (
                      <div className="flex gap-2">
                        <input
                          ref={followUpRef}
                          value={followUp}
                          onChange={e => setFollowUp(e.target.value)}
                          onKeyDown={handleFollowUpKeyDown}
                          placeholder="Sua resposta..."
                          className="flex-1 rounded-lg border bg-white/80 px-3 py-2 h-11 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/20"
                          style={{ borderColor: "#F2D9C2" }}
                          disabled={loading}
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="w-full py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition"
                      style={{ background: "var(--brand-grad)" }}
                    >
                      {loading ? "…" : "Confirmar"}
                    </button>
                  </form>
                </div>
              )
            })()}

            {/* Main input */}
            {!pendingQuestion && (
              <form onSubmit={handleSubmit}>
                <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Adicionar cliente, registrar evento, consultar dados…"
                    rows={1}
                    className="flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink-4 focus:outline-none"
                    style={{ maxHeight: 120 }}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl text-white transition hover:opacity-90 disabled:opacity-40"
                    style={{ background: "var(--brand-grad)" }}
                  >
                    {loading
                      ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-2 text-center text-xs text-ink-4">
                  Enter para enviar · Shift+Enter para nova linha
                </p>
              </form>
            )}

            {/* Reset button */}
            {!loading && (
              <button
                type="button"
                onClick={() => { setHistory([]); setPendingQuestion(null); setFollowUp(""); setInput(""); }}
                className="flex items-center gap-1.5 mx-auto text-xs text-ink-4 hover:text-ink-2 transition-colors hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150"
              >
                <RotateCcw className="w-3 h-3" />
                Nova conversa
              </button>
            )}

              </div>
            </div>
          </>
        )}

      </div>
    </>
  )
}
