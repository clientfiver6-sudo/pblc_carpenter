"use client"
import { useState, useRef, useEffect } from "react"
import { Send } from "lucide-react"
import { BUSINESS_TYPE_OPTIONS, type BusinessType } from "@/lib/config/business-types"
import { ImportWizard } from "@/components/onboarding/ImportWizard"

interface ChatMessage {
  role: "ai" | "user"
  content: string
  showTypeCards?: boolean
  showDropzone?: boolean
}

interface InterviewStep {
  question: string
  field: string
  extractType?: "business_info" | "services" | "staff" | "hours" | "staff_payment" | "payment_preferences"
  cards?: boolean
}

const STEPS: InterviewStep[] = [
  { question: "Olá! 👋 Qual é o nome do seu negócio?", field: "name" },
  { question: "Legal! Que tipo de negócio é o seu?", field: "type", cards: true },
  { question: "Quais serviços você oferece? Me conta o nome e quanto cobra por cada um.", field: "services", extractType: "services" },
  { question: "Perfeito! E como você costuma cobrar seus clientes? Me conta quais formas aceita (Pix, cartão, dinheiro, transferência) e se prefere cobrar antes ou depois do serviço. (Digite \"pular\" se preferir configurar depois)", field: "payment_preferences", extractType: "payment_preferences" },
  { question: "Quantas pessoas trabalham com você? Me diz os nomes (e a função, se quiser).", field: "staff", extractType: "staff" },
  { question: "Ótimo! Como seus colaboradores são remunerados? Me conta o tipo (salário fixo ou comissão), quando e como são pagos — pode ser para todos ou individualmente. (Digite \"pular\" se preferir configurar depois)", field: "staff_payment", extractType: "staff_payment" },
  { question: "Que dias e horários vocês atendem?", field: "opening_hours", extractType: "hours" },
  { question: "Qual é o número de WhatsApp de contato para os clientes?", field: "whatsapp_number" },
  { question: "Qual é a sua chave PIX? (CPF, CNPJ, e-mail ou telefone)", field: "pix_key" },
]

async function saveField(businessId: string, field: string, value: unknown) {
  await fetch("/api/onboarding/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, field, value }),
  })
}

async function extractData(step: InterviewStep, text: string, businessType?: string) {
  if (!step.extractType) return null
  const res = await fetch("/api/onboarding/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step: step.extractType, description: text, businessType }),
  })
  if (!res.ok) return null
  return res.json() as Promise<{ data: Record<string, unknown>; missing: string[]; question?: string }>
}

async function extractTerminology(businessType: string, businessName: string, context?: string) {
  const res = await fetch("/api/onboarding/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step: "terminology",
      description: businessName,
      businessType,
      context,
    }),
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    data: { terminology: Record<string, unknown> }
    missing: string[]
    question?: string
  }>
}

interface OnboardingInterviewProps {
  businessId: string
  onComplete: () => void
}

export function OnboardingInterview({ businessId, onComplete }: OnboardingInterviewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: STEPS[0].question },
  ])
  const [stepIndex, setStepIndex] = useState(0)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null)
  const [done, setDone] = useState(false)
  const [businessName, setBusinessName] = useState("")
  const [terminologyData, setTerminologyData] = useState<Record<string, unknown> | null>(null)
  const [awaitingTerminology, setAwaitingTerminology] = useState(false)
  const [awaitingPayment, setAwaitingPayment] = useState(false)
  const [paymentContext, setPaymentContext] = useState("")
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages, done])

  const isAtDropzone = stepIndex >= STEPS.length

  function addAiMessage(content: string, extra?: Partial<ChatMessage>) {
    setMessages(prev => [...prev, { role: "ai", content, ...extra }])
  }

  async function handleComplete() {
    if (terminologyData) {
      await saveField(businessId, "settings", { terminology: terminologyData })
    }
    await saveField(businessId, "onboarded", true)
    setShowSuccess(true)
    setTimeout(() => {
      setShowSuccess(false)
      onComplete()
    }, 2500)
  }

  async function advanceStep(currentStepIndex: number, savedField: string, rawValue: string) {
    const nextIndex = currentStepIndex + 1

    if (nextIndex >= STEPS.length) {
      // All steps done — show dropzone
      addAiMessage("Ótimo! Antes de ir ao painel, quer importar seus dados de outros sistemas? 📥", { showDropzone: true })
      setStepIndex(nextIndex)
      setDone(true)
      return
    }

    const nextStep = STEPS[nextIndex]
    setStepIndex(nextIndex)

    if (nextStep.cards) {
      addAiMessage(nextStep.question, { showTypeCards: true })
    } else {
      addAiMessage(nextStep.question)
    }

    setTimeout(() => inputRef.current?.focus(), 80)
    void savedField; void rawValue
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading || isAtDropzone) return

    const text = input.trim()
    setInput("")
    setLoading(true)

    // If awaiting terminology clarification, use this answer to finalize terminology
    if (awaitingTerminology && selectedType) {
      setMessages(prev => [...prev, { role: "user", content: text }])
      try {
        const result = await extractTerminology(selectedType, businessName, text)
        if (result?.data?.terminology) {
          setTerminologyData(result.data.terminology as Record<string, unknown>)
        }
      } finally {
        setAwaitingTerminology(false)
        setLoading(false)
      }
      // Now advance to the next step after type selection (index 2 = services)
      await advanceStep(1, "type", selectedType)
      return
    }

    // If awaiting payment clarification, combine with prior context and re-extract
    if (awaitingPayment) {
      setMessages(prev => [...prev, { role: "user", content: text }])
      const combined = `${paymentContext}\n${text}`
      const paymentStep = STEPS.find(s => s.field === "staff_payment")!
      try {
        const extracted = await extractData(paymentStep, combined, selectedType ?? undefined)
        const paymentData = (extracted?.data as Record<string, unknown> | null)?.["staff_payment"]
        if (extracted?.question) {
          setPaymentContext(combined)
          addAiMessage(extracted.question)
          setLoading(false)
          setTimeout(() => inputRef.current?.focus(), 80)
          return
        }
        if (paymentData && typeof paymentData === "object" && Object.keys(paymentData).length > 0) {
          await saveField(businessId, "staff_payment", paymentData)
        }
      } finally {
        setAwaitingPayment(false)
        setPaymentContext("")
        setLoading(false)
      }
      const paymentStepIndex = STEPS.findIndex(s => s.field === "staff_payment")
      await advanceStep(paymentStepIndex, "staff_payment", combined)
      return
    }

    const step = STEPS[stepIndex]
    setMessages(prev => [...prev, { role: "user", content: text }])

    try {
      if (step.extractType) {
        const extracted = await extractData(step, text, selectedType ?? undefined)

        // For staff_payment, handle follow-up questions
        if (step.field === "staff_payment" && extracted?.question) {
          setPaymentContext(text)
          setAwaitingPayment(true)
          addAiMessage(extracted.question)
          setLoading(false)
          setTimeout(() => inputRef.current?.focus(), 80)
          return
        }

        if (extracted?.data) {
          const dataKey = step.extractType === "hours" ? "opening_hours" : step.extractType
          const val = (extracted.data as Record<string, unknown>)[dataKey] ?? extracted.data
          await saveField(businessId, step.field, val)
        } else {
          await saveField(businessId, step.field, text)
        }
      } else {
        await saveField(businessId, step.field, text)
        // Capture business name from step 0
        if (step.field === "name") {
          setBusinessName(text)
        }
      }
    } finally {
      setLoading(false)
    }

    await advanceStep(stepIndex, step.field, text)
  }

  async function handleTypeSelect(type: BusinessType, label: string) {
    if (loading) return
    setSelectedType(type)
    setLoading(true)
    setMessages(prev => [...prev, { role: "user", content: label }])
    await saveField(businessId, "type", type)

    // Silently extract terminology
    try {
      const result = await extractTerminology(type, businessName)
      if (result?.data?.terminology) {
        setTerminologyData(result.data.terminology as Record<string, unknown>)
        // If AI needs clarification (only for ambiguous other_service_business)
        if (result.question) {
          setLoading(false)
          setAwaitingTerminology(true)
          addAiMessage(result.question)
          setTimeout(() => inputRef.current?.focus(), 80)
          return
        }
      }
    } catch {
      // Terminology extraction failed silently — fall back to config defaults
    }

    setLoading(false)
    await advanceStep(stepIndex, "type", type)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      void handleSubmit(e as unknown as React.FormEvent)
    }
  }

  const progress = Math.min((stepIndex / STEPS.length) * 100, 100)

  return (
    <>
      {/* Success animation overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle
              cx="60" cy="60" r="54" fill="none" stroke="#22c55e" strokeWidth="6"
              strokeDasharray="339.3" strokeDashoffset="339.3"
              style={{ animation: "draw-circle 0.8s ease forwards", transformOrigin: "center", transform: "rotate(-90deg)" }}
            />
            <polyline
              points="36,62 52,78 84,42" fill="none" stroke="#22c55e" strokeWidth="6"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="80" strokeDashoffset="80"
              style={{ animation: "draw-check 0.4s ease 0.7s forwards" }}
            />
          </svg>
          <p className="mt-6 text-xl font-bold text-ink" style={{ animation: "fade-in 0.4s ease 1.2s both" }}>
            Seu negócio está no ar
          </p>
          <style>{`
            @keyframes draw-circle { to { stroke-dashoffset: 0; } }
            @keyframes draw-check  { to { stroke-dashoffset: 0; } }
            @keyframes fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
          `}</style>
        </div>
      )}

      {/* WhatsApp-style interview */}
      <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "#ECE5DD" }}>
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-1 transition-all duration-500"
            style={{ width: `${progress}%`, background: "#25D366" }}
          />
        </div>

        {/* WhatsApp header */}
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: "#075E54" }}>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold text-white shrink-0"
            style={{ background: "var(--brand-grad)" }}
          >
            ✦
          </div>
          <div>
            <p className="font-semibold text-sm text-white">RetornAI</p>
            <p className="text-xs text-white/70">online agora</p>
          </div>
        </div>

        {/* Message log */}
        <div ref={logRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.showDropzone ? (
                <ImportWizard
                  businessId={businessId}
                  onComplete={handleComplete}
                  onSkip={handleComplete}
                  embedded={true}
                />
              ) : msg.showTypeCards ? (
                <div className="bg-white rounded-xl p-3 shadow-sm max-w-[90%] space-y-2">
                  <p className="text-sm text-gray-800 mb-2">{msg.content}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {BUSINESS_TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => void handleTypeSelect(opt.value, opt.label)}
                        disabled={loading || selectedType !== null}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors hover:border-brand/50 hover:bg-tint/30 disabled:opacity-50"
                        style={{ borderColor: selectedType === opt.value ? "var(--brand)" : "#e5e7eb" }}
                      >
                        <span className="text-base">{opt.icon}</span>
                        <span className="text-gray-800 leading-tight">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "text-gray-800"
                      : "bg-white text-gray-800 shadow-sm"
                  }`}
                  style={msg.role === "user" ? { background: "#DCF8C6" } : {}}
                >
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-xl px-3 py-2.5 shadow-sm flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-gray-400"
                    style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input area — hidden when at dropzone step */}
        {!isAtDropzone && !done && (
          <form onSubmit={handleSubmit} className="px-3 py-2 flex gap-2" style={{ background: "#F0F0F0" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={STEPS[stepIndex]?.cards && !awaitingTerminology ? "" : "Escreva sua resposta..."}
              disabled={loading || (STEPS[stepIndex]?.cards && !awaitingTerminology)}
              className="flex-1 rounded-full px-4 py-2 text-sm bg-white text-gray-800 placeholder:text-gray-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || !input.trim() || (STEPS[stepIndex]?.cards && !awaitingTerminology)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 disabled:opacity-40 transition-opacity"
              style={{ background: "#25D366" }}
            >
              {loading
                ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                : <Send className="w-4 h-4" />}
            </button>
          </form>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  )
}
