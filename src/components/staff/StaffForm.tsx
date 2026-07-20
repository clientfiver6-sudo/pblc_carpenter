"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { Staff } from "@/types/database"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Check, Sparkles, PenLine, Loader2, AlertCircle } from "lucide-react"
import { getBusinessOpeningHours, generateStaffHours, generatePaymentInfo } from "@/lib/staff/actions"
import { generateStepContent } from "@/app/setup/actions"

const WEEKDAYS = [
  { key: "mon", label: "Segunda" },
  { key: "tue", label: "Terça" },
  { key: "wed", label: "Quarta" },
  { key: "thu", label: "Quinta" },
  { key: "fri", label: "Sexta" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
]

const workingHoursDaySchema = z.object({
  open: z.boolean().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
})

const staffFormSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  role: z.string().optional(),
  phone: z.string().optional(),
  working_hours: z.record(workingHoursDaySchema).optional(),
  compensation_type: z.enum(["salary", "commission", "other"]).optional(),
  monthly_salary_cents: z.number().int().nonnegative().nullable().optional(),
  commission_rate: z.number().min(0).max(100).nullable().optional(),
  payment_day: z.number().int().min(1).max(31).nullable().optional(),
  payment_method: z.string().nullable().optional(),
  payment_reminder: z.boolean().optional(),
})

export type StaffFormData = z.infer<typeof staffFormSchema>

interface StaffFormProps {
  staff?: Staff
  onSubmit: (data: StaffFormData) => void
  onCancel: () => void
  suggestedRoles: string[]
  businessType?: string
  businessName?: string
}

function buildDefaultWorkingHours(): Record<string, { open: boolean; start: string; end: string }> {
  return Object.fromEntries(
    WEEKDAYS.map(({ key }) => [
      key,
      { open: ["mon", "tue", "wed", "thu", "fri"].includes(key), start: "09:00", end: "18:00" },
    ])
  )
}

function parseExistingHours(raw: unknown): Record<string, { open: boolean; start: string; end: string }> {
  const defaults = buildDefaultWorkingHours()
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults
  const obj = raw as Record<string, { open?: boolean; start?: string; end?: string }>
  return Object.fromEntries(
    WEEKDAYS.map(({ key }) => [
      key,
      {
        open: obj[key]?.open ?? defaults[key].open,
        start: obj[key]?.start ?? defaults[key].start,
        end: obj[key]?.end ?? defaults[key].end,
      },
    ])
  )
}

function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length >= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length >= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length >= 1) return `(${d}`
  return ""
}

function isPhoneValid(phone: string): boolean {
  const d = phone.replace(/\D/g, "")
  return d.length === 10 || d.length === 11
}

export function StaffForm({ staff, onSubmit, onCancel, suggestedRoles, businessType, businessName }: StaffFormProps) {
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual")

  // Inline AI state (onboarding-style flow)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiQuestion, setAiQuestion] = useState("")
  const [aiFollowUp, setAiFollowUp] = useState("")
  const [aiOutOfScope, setAiOutOfScope] = useState(false)
  const [aiHasResult, setAiHasResult] = useState(false)
  const [aiVerified, setAiVerified] = useState(false)
  const [aiResultName, setAiResultName] = useState("")
  const [aiResultRole, setAiResultRole] = useState("")
  const [aiError, setAiError] = useState("")

  const [phoneVal, setPhoneVal] = useState(staff?.phone ? maskPhone(staff.phone) : "")
  const [phoneConfirm, setPhoneConfirm] = useState(staff?.phone ? maskPhone(staff.phone) : "")
  const [phoneError, setPhoneError] = useState("")

  const [hoursMode, setHoursMode] = useState<"manual" | "ai">("manual")
  const [hoursAiPrompt, setHoursAiPrompt] = useState("")
  const [hoursAiFollowUp, setHoursAiFollowUp] = useState("")
  const [hoursAiGenerating, setHoursAiGenerating] = useState(false)
  const [hoursAiQuestion, setHoursAiQuestion] = useState("")
  const [hoursAiOutOfScope, setHoursAiOutOfScope] = useState(false)
  const [hoursAiText, setHoursAiText] = useState("")
  const [hoursAiParsed, setHoursAiParsed] = useState<Record<string, { open: boolean; start: string; end: string }> | null>(null)
  const [hoursAiVerified, setHoursAiVerified] = useState(false)
  const [hoursAiResultReady, setHoursAiResultReady] = useState(false)
  const [hoursAiError, setHoursAiError] = useState("")

  // Compensation state
  const [compensationType, setCompensationType] = useState<"salary" | "commission" | "other">(
    (staff?.compensation_type as "salary" | "commission" | "other") ?? "salary"
  )
  const [salaryVal, setSalaryVal] = useState(
    staff?.monthly_salary_cents ? String(Math.round(staff.monthly_salary_cents / 100)) : ""
  )
  const [commissionVal, setCommissionVal] = useState(
    staff?.commission_rate ? String(staff.commission_rate) : ""
  )

  // Payment details state
  const [paymentMode, setPaymentMode] = useState<"manual" | "ai">("manual")
  const [paymentDayVal, setPaymentDayVal] = useState(staff?.payment_day ? String(staff.payment_day) : "")
  const [paymentMethodVal, setPaymentMethodVal] = useState(staff?.payment_method ?? "")
  const [paymentReminderVal, setPaymentReminderVal] = useState(staff?.payment_reminder ?? false)

  // Payment AI state
  const [paymentAiPrompt, setPaymentAiPrompt] = useState("")
  const [paymentAiFollowUp, setPaymentAiFollowUp] = useState("")
  const [paymentAiGenerating, setPaymentAiGenerating] = useState(false)
  const [paymentAiQuestion, setPaymentAiQuestion] = useState("")
  const [paymentAiOutOfScope, setPaymentAiOutOfScope] = useState(false)
  const [paymentAiResultReady, setPaymentAiResultReady] = useState(false)
  const [paymentAiError, setPaymentAiError] = useState("")

  const staffHasHours = staff?.working_hours && Object.keys(staff.working_hours as object).length > 0

  const {
    handleSubmit,
    register,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
      name: staff?.name ?? "",
      role: staff?.role ?? "",
      working_hours: staff ? parseExistingHours(staff.working_hours) : buildDefaultWorkingHours(),
    },
  })

  const workingHours = watch("working_hours") ?? {}
  const watchedName = watch("name")

  useEffect(() => {
    if (staffHasHours) return
    getBusinessOpeningHours()
      .then((biz) => {
        if (biz && Object.keys(biz).length > 0) setValue("working_hours", parseExistingHours(biz))
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetAiState() {
    setAiQuestion("")
    setAiFollowUp("")
    setAiOutOfScope(false)
    setAiHasResult(false)
    setAiVerified(false)
    setAiResultName("")
    setAiResultRole("")
    setAiError("")
  }

  function switchToManual() {
    setActiveTab("manual")
    resetAiState()
    setAiPrompt("")
  }

  function applyAiResult() {
    if (aiResultName) setValue("name", aiResultName, { shouldDirty: true })
    if (aiResultRole) setValue("role", aiResultRole, { shouldDirty: true })
    switchToManual()
  }

  async function handleAiGenerate() {
    setAiGenerating(true)
    setAiQuestion("")
    setAiOutOfScope(false)
    setAiError("")
    setAiHasResult(false)

    const combined = aiFollowUp.trim()
      ? `${aiPrompt.trim()}\n${aiFollowUp.trim()}`
      : aiPrompt.trim()
    if (aiFollowUp.trim()) setAiPrompt(combined)
    setAiFollowUp("")

    const result = await generateStepContent(
      "team",
      businessType ?? "other_service_business",
      businessName ?? "",
      combined || undefined
    )
    setAiGenerating(false)

    if (result.outOfScope) { setAiOutOfScope(true); return }
    if (result.question) { setAiQuestion(result.question); return }
    if (result.error) { setAiError(result.error); return }
    if (result.content) {
      const firstLine = result.content.split("\n")[0] ?? ""
      const match = firstLine.match(/^(.+?)\s*[—\-–]\s*(.+)$/)
      if (match) {
        setAiResultName(match[1].trim())
        setAiResultRole(match[2].trim())
        setAiHasResult(true)
        setAiVerified(false)
      }
    }
  }

  function resetHoursAi() {
    setHoursAiText("")
    setHoursAiParsed(null)
    setHoursAiVerified(false)
    setHoursAiQuestion("")
    setHoursAiFollowUp("")
    setHoursAiOutOfScope(false)
    setHoursAiResultReady(false)
    setHoursAiError("")
  }

  async function handleHoursGenerate() {
    setHoursAiGenerating(true)
    setHoursAiQuestion("")
    setHoursAiOutOfScope(false)
    setHoursAiError("")

    const combined = hoursAiFollowUp.trim()
      ? `${hoursAiPrompt.trim()}\n${hoursAiFollowUp.trim()}`
      : hoursAiPrompt.trim()
    if (hoursAiFollowUp.trim()) setHoursAiPrompt(combined)
    setHoursAiFollowUp("")

    const result = await generateStaffHours(combined)
    setHoursAiGenerating(false)

    if (result.outOfScope) { setHoursAiOutOfScope(true); return }
    if (result.error) { setHoursAiError(result.error); return }
    if (result.question) { setHoursAiQuestion(result.question); return }
    if (result.content && result.parsed) {
      setHoursAiText(result.content)
      setHoursAiParsed(result.parsed)
      setHoursAiResultReady(true)
    }
  }

  function applyHoursAndVerify() {
    if (!hoursAiParsed) return
    const full = buildDefaultWorkingHours()
    for (const [k, v] of Object.entries(hoursAiParsed)) {
      if (full[k] !== undefined) full[k] = { open: v.open, start: v.start, end: v.end }
    }
    setValue("working_hours", full, { shouldDirty: true })
    setHoursAiVerified(true)
  }

  function resetPaymentAi() {
    setPaymentAiPrompt("")
    setPaymentAiFollowUp("")
    setPaymentAiQuestion("")
    setPaymentAiOutOfScope(false)
    setPaymentAiResultReady(false)
    setPaymentAiError("")
  }

  async function handlePaymentGenerate() {
    setPaymentAiGenerating(true)
    setPaymentAiQuestion("")
    setPaymentAiOutOfScope(false)
    setPaymentAiError("")

    const combined = paymentAiFollowUp.trim()
      ? `${paymentAiPrompt.trim()}\n${paymentAiFollowUp.trim()}`
      : paymentAiPrompt.trim()
    if (paymentAiFollowUp.trim()) setPaymentAiPrompt(combined)
    setPaymentAiFollowUp("")

    const result = await generatePaymentInfo(combined, watchedName || undefined)
    setPaymentAiGenerating(false)

    if (result.outOfScope) { setPaymentAiOutOfScope(true); return }
    if (result.question) { setPaymentAiQuestion(result.question); return }
    if (result.error) { setPaymentAiError(result.error); return }
    if (result.content) {
      if (result.content.payment_day != null) setPaymentDayVal(String(result.content.payment_day))
      if (result.content.payment_method != null) setPaymentMethodVal(result.content.payment_method)
      if (result.content.payment_reminder != null) setPaymentReminderVal(result.content.payment_reminder)
      setPaymentAiResultReady(true)
      setPaymentMode("manual")
    }
  }

  function handleFormSubmit(data: StaffFormData) {
    const phoneFilled = phoneVal.replace(/\D/g, "").length > 0
    if (phoneFilled) {
      if (!isPhoneValid(phoneVal)) {
        setPhoneError("Telefone inválido. Use o formato (XX) XXXXX-XXXX.")
        return
      }
      if (phoneVal !== phoneConfirm) {
        setPhoneError("Os telefones não coincidem.")
        return
      }
    }
    setPhoneError("")

    const monthlySalaryCents =
      compensationType === "salary" && salaryVal.trim()
        ? Math.round(parseFloat(salaryVal.replace(/\./g, "").replace(",", ".")) * 100)
        : null
    const commissionRate =
      compensationType === "commission" && commissionVal.trim()
        ? parseFloat(commissionVal.replace(",", "."))
        : null
    const paymentDay = paymentDayVal ? parseInt(paymentDayVal, 10) : null

    onSubmit({
      ...data,
      phone: phoneFilled ? phoneVal : undefined,
      compensation_type: compensationType,
      monthly_salary_cents: monthlySalaryCents,
      commission_rate: commissionRate,
      payment_day: paymentDay && !isNaN(paymentDay) ? paymentDay : null,
      payment_method: paymentMethodVal || null,
      payment_reminder: paymentReminderVal,
    })
  }

  const inputCls = "border-border bg-surface text-ink placeholder:text-ink-4 focus-visible:ring-brand/20 focus-visible:border-brand h-10"

  return (
    <div className="space-y-4">
      {!staff && (
        <div className="flex bg-surface-2 rounded-md p-1 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={cn(
              "flex-1 py-2 rounded text-sm text-center cursor-pointer transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
              activeTab === "manual" ? "font-semibold bg-surface text-ink" : "text-ink-3 hover:text-ink-2"
            )}
            style={activeTab === "manual" ? { boxShadow: "var(--shadow-1)" } : undefined}
          >
            Preencher manualmente
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ai")}
            className={cn(
              "flex-1 py-2 rounded text-sm text-center cursor-pointer transition-[color,background-color,box-shadow] duration-150 ease-brand-out",
              activeTab === "ai" ? "font-semibold bg-surface text-ink" : "text-ink-3 hover:text-ink-2"
            )}
            style={activeTab === "ai" ? { boxShadow: "var(--shadow-1)" } : undefined}
          >
            <span className="text-brand">✦</span> Descrever com IA
          </button>
        </div>
      )}

      {activeTab === "ai" && !staff ? (
        <div className="space-y-3">
          {!aiHasResult && (
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ex: João Silva, instalador de ar-condicionado, atende segunda a sexta"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
            />
          )}

          {aiQuestion && !aiHasResult && (
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-surface-2 border border-border text-sm text-ink leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                <span>{aiQuestion}</span>
              </div>
              <textarea
                value={aiFollowUp}
                onChange={(e) => setAiFollowUp(e.target.value)}
                placeholder="Sua resposta..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
                autoFocus
              />
            </div>
          )}

          {aiOutOfScope && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-danger/8 border border-danger/25 text-sm text-danger leading-relaxed">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Isso está fora do assunto. Por favor, descreva apenas os membros da sua equipe.</span>
            </div>
          )}

          {aiError && <p className="text-xs text-danger">{aiError}</p>}

          {!aiHasResult && (
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiGenerating || !aiPrompt.trim()}
              className="w-full py-2.5 rounded-xl border border-brand/30 bg-tint text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint/80 transition-colors disabled:opacity-50"
            >
              {aiGenerating ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> {aiQuestion ? "Gerar com minha resposta" : "Descrever com IA"}</>
              )}
            </button>
          )}

          {aiHasResult && (
            <div className="rounded-xl bg-tint border border-brand/20 p-3 space-y-3">
              <div className="text-sm text-ink">
                <p className="font-semibold">{aiResultName}</p>
                {aiResultRole && <p className="text-ink-2">{aiResultRole}</p>}
              </div>
              {aiVerified ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-moss font-medium">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    Verificado — preencha os horários e salve
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { resetAiState(); setAiPrompt("") }}
                      className="flex-1 py-2 rounded-lg border border-brand/30 bg-surface text-brand text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-tint transition-colors"
                    >
                      <Sparkles className="w-3 h-3" /> Gerar novamente
                    </button>
                    <button
                      type="button"
                      onClick={applyAiResult}
                      className="flex-1 py-2 rounded-lg border border-border bg-surface text-ink-2 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-surface-2 transition-colors"
                    >
                      <PenLine className="w-3 h-3" /> Editar e continuar
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAiVerified(true)}
                    className="flex-1 py-2 rounded-lg border-2 border-moss bg-moss/8 text-moss text-sm font-semibold flex items-center justify-center gap-2 hover:bg-moss/15 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" /> Verificar
                  </button>
                  <button
                    type="button"
                    onClick={() => { resetAiState(); setAiPrompt("") }}
                    className="flex-1 py-2 rounded-lg border border-border bg-surface text-ink-2 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-surface-2 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Gerar novamente
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">
              Nome <span className="text-danger">*</span>
            </Label>
            <Input {...register("name")} placeholder="Nome do colaborador" className={inputCls} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          {/* Cargo */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">Cargo</Label>
            <Input
              {...register("role")}
              list="suggested-roles"
              placeholder="Ex: Técnico"
              className={inputCls}
            />
            <datalist id="suggested-roles">
              {suggestedRoles.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>

          {/* Telefone + confirmação */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5">Telefone</Label>
            <Input
              value={phoneVal}
              onChange={(e) => { setPhoneVal(maskPhone(e.target.value)); setPhoneError("") }}
              placeholder="(11) 99999-9999"
              inputMode="numeric"
              className={cn(inputCls, "font-mono")}
            />
            {phoneVal && (
              <Input
                value={phoneConfirm}
                onChange={(e) => { setPhoneConfirm(maskPhone(e.target.value)); setPhoneError("") }}
                placeholder="Confirme o telefone"
                inputMode="numeric"
                className={cn(
                  inputCls,
                  "font-mono",
                  phoneConfirm && phoneVal !== phoneConfirm && "border-danger focus-visible:border-danger focus-visible:ring-danger/20"
                )}
              />
            )}
            {phoneError && <p className="text-xs text-danger">{phoneError}</p>}
            {!phoneError && phoneVal && phoneConfirm && phoneVal !== phoneConfirm && (
              <p className="text-xs text-danger">Os telefones não coincidem.</p>
            )}
          </div>

          {/* Remuneração */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Remuneração</Label>
            <div className="flex gap-1.5">
              {(["salary", "commission", "other"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCompensationType(type)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                    compensationType === type
                      ? "border-brand bg-tint text-brand"
                      : "border-border bg-surface text-ink-3 hover:text-ink hover:border-ink-3"
                  )}
                >
                  {type === "salary" ? "Salário Fixo" : type === "commission" ? "Comissão" : "Outro"}
                </button>
              ))}
            </div>
            {compensationType === "salary" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-3 shrink-0 w-6">R$</span>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={salaryVal}
                  onChange={(e) => setSalaryVal(e.target.value)}
                  placeholder="3000"
                  className={cn(inputCls, "font-mono")}
                />
                <span className="text-xs text-ink-3 shrink-0">/ mês</span>
              </div>
            )}
            {compensationType === "commission" && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={commissionVal}
                  onChange={(e) => setCommissionVal(e.target.value)}
                  placeholder="10"
                  className={cn(inputCls, "font-mono")}
                />
                <span className="text-sm text-ink-3 shrink-0">%</span>
              </div>
            )}
          </div>

          {/* Detalhes de Pagamento — AI Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Detalhes de Pagamento</Label>
              <div className="flex gap-1 border border-border rounded-md p-0.5 bg-surface-2">
                <button
                  type="button"
                  onClick={() => { setPaymentMode("manual"); resetPaymentAi() }}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded transition-[color,background-color,box-shadow] duration-150",
                    paymentMode === "manual" ? "font-semibold bg-surface text-ink shadow-1" : "text-ink-3 hover:text-ink-2"
                  )}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("ai")}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded transition-[color,background-color,box-shadow] duration-150",
                    paymentMode === "ai" ? "font-semibold bg-surface text-ink shadow-1" : "text-ink-3 hover:text-ink-2"
                  )}
                >
                  <span className="text-brand">✦</span> IA
                </button>
              </div>
            </div>

            {paymentMode === "ai" ? (
              <div className="space-y-3">
                {!paymentAiResultReady && (
                  <textarea
                    value={paymentAiPrompt}
                    onChange={(e) => setPaymentAiPrompt(e.target.value)}
                    placeholder={`Quando e como ${watchedName || "o colaborador"} recebe? Ex: todo dia 5, via PIX, quero lembrete`}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
                  />
                )}

                {paymentAiQuestion && !paymentAiResultReady && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-surface-2 border border-border text-sm text-ink leading-relaxed">
                      <Sparkles className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                      <span>{paymentAiQuestion}</span>
                    </div>
                    <textarea
                      value={paymentAiFollowUp}
                      onChange={(e) => setPaymentAiFollowUp(e.target.value)}
                      placeholder="Sua resposta..."
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
                      autoFocus
                    />
                  </div>
                )}

                {paymentAiOutOfScope && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-danger/8 border border-danger/25 text-sm text-danger leading-relaxed">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Isso está fora do assunto. Descreva apenas os detalhes de pagamento.</span>
                  </div>
                )}

                {paymentAiError && <p className="text-xs text-danger">{paymentAiError}</p>}

                {!paymentAiResultReady && (
                  <button
                    type="button"
                    onClick={handlePaymentGenerate}
                    disabled={paymentAiGenerating || (!paymentAiPrompt.trim() && !paymentAiFollowUp.trim())}
                    className="w-full py-2.5 rounded-xl border border-brand/30 bg-tint text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint/80 transition-colors disabled:opacity-50"
                  >
                    {paymentAiGenerating ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /> {paymentAiQuestion ? "Gerar com minha resposta" : "Analisar pagamento"}</>
                    )}
                  </button>
                )}

                {paymentAiResultReady && (
                  <div className="rounded-xl bg-tint border border-brand/20 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-moss font-medium">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      Detalhes aplicados — confira abaixo
                    </div>
                    <button
                      type="button"
                      onClick={resetPaymentAi}
                      className="text-xs text-brand hover:underline"
                    >
                      Descrever novamente
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-ink-3">Dia do mês</p>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={paymentDayVal}
                      onChange={(e) => setPaymentDayVal(e.target.value)}
                      placeholder="Ex: 5"
                      className={cn(inputCls, "font-mono")}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-ink-3">Forma de pagamento</p>
                    <Input
                      value={paymentMethodVal}
                      onChange={(e) => setPaymentMethodVal(e.target.value)}
                      list="payment-methods"
                      placeholder="PIX, dinheiro..."
                      className={inputCls}
                    />
                    <datalist id="payment-methods">
                      <option value="PIX" />
                      <option value="Dinheiro" />
                      <option value="Transferência bancária" />
                      <option value="Cartão" />
                    </datalist>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentReminderVal((v) => !v)}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <div className={cn(
                    "h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shrink-0",
                    paymentReminderVal ? "bg-brand border-brand" : "border-border bg-surface"
                  )}>
                    {paymentReminderVal && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-sm text-ink">Lembrete de pagamento</span>
                  {paymentReminderVal && paymentDayVal && (
                    <span className="text-xs text-ink-3">— aviso no dia {paymentDayVal}</span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Horários de trabalho */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Horários de trabalho</Label>
              <div className="flex gap-1 border border-border rounded-md p-0.5 bg-surface-2">
                <button
                  type="button"
                  onClick={() => { setHoursMode("manual"); resetHoursAi() }}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded transition-[color,background-color,box-shadow] duration-150",
                    hoursMode === "manual" ? "font-semibold bg-surface text-ink shadow-1" : "text-ink-3 hover:text-ink-2"
                  )}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setHoursMode("ai")}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded transition-[color,background-color,box-shadow] duration-150",
                    hoursMode === "ai" ? "font-semibold bg-surface text-ink shadow-1" : "text-ink-3 hover:text-ink-2"
                  )}
                >
                  <span className="text-brand">✦</span> IA
                </button>
              </div>
            </div>

            {hoursMode === "ai" ? (
              <div className="space-y-3">
                {!hoursAiResultReady && (
                  <textarea
                    value={hoursAiPrompt}
                    onChange={(e) => setHoursAiPrompt(e.target.value)}
                    placeholder="Ex: Segunda a sexta das 8h às 18h, sábado das 8h às 13h"
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
                  />
                )}

                {hoursAiQuestion && !hoursAiResultReady && (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-surface-2 border border-border text-sm text-ink leading-relaxed">
                      <Sparkles className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" />
                      <span>{hoursAiQuestion}</span>
                    </div>
                    <textarea
                      value={hoursAiFollowUp}
                      onChange={(e) => setHoursAiFollowUp(e.target.value)}
                      placeholder="Sua resposta..."
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-surface text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
                      autoFocus
                    />
                  </div>
                )}

                {hoursAiOutOfScope && !hoursAiResultReady && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-danger/8 border border-danger/25 text-sm text-danger leading-relaxed">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Isso está fora do assunto. Por favor, descreva apenas os horários de trabalho do colaborador.</span>
                  </div>
                )}

                {hoursAiError && <p className="text-xs text-danger">{hoursAiError}</p>}

                {!hoursAiResultReady && (
                  <button
                    type="button"
                    onClick={handleHoursGenerate}
                    disabled={hoursAiGenerating || (!hoursAiPrompt.trim() && !hoursAiFollowUp.trim())}
                    className="w-full py-2.5 rounded-xl border border-brand/30 bg-tint text-brand text-sm font-semibold flex items-center justify-center gap-2 hover:bg-tint/80 transition-colors disabled:opacity-50"
                  >
                    {hoursAiGenerating ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" /> {hoursAiQuestion ? "Gerar com minha resposta" : "Gerar horários"}</>
                    )}
                  </button>
                )}

                {hoursAiResultReady && (
                  <div className="rounded-xl bg-tint border border-brand/20 p-3 space-y-3">
                    <pre className="text-xs text-ink whitespace-pre-wrap leading-relaxed">{hoursAiText}</pre>
                    {hoursAiVerified ? (
                      <>
                        <div className="flex items-center gap-2 text-xs text-moss font-medium">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          Verificado — aplicado ao formulário
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={resetHoursAi}
                            className="flex-1 py-2 rounded-lg border border-brand/30 bg-surface text-brand text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-tint transition-colors"
                          >
                            <Sparkles className="w-3 h-3" /> Gerar novamente
                          </button>
                          <button
                            type="button"
                            onClick={() => { setHoursMode("manual"); resetHoursAi() }}
                            className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink transition-colors px-3"
                          >
                            <PenLine className="w-3 h-3" /> Editar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={applyHoursAndVerify}
                          className="flex-1 py-2 rounded-lg border-2 border-moss bg-moss/8 text-moss text-sm font-semibold flex items-center justify-center gap-2 hover:bg-moss/15 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Verificar
                        </button>
                        <button
                          type="button"
                          onClick={resetHoursAi}
                          className="flex-1 py-2 rounded-lg border border-border bg-surface text-ink-2 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-surface-2 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Gerar novamente
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface overflow-hidden">
                {WEEKDAYS.map(({ key, label }, idx) => {
                  const dayHours = workingHours[key] ?? { open: false, start: "09:00", end: "18:00" }
                  const isOpen = dayHours.open ?? false
                  return (
                    <div
                      key={key}
                      className={cn("flex items-center gap-3 px-4 py-2.5", idx !== WEEKDAYS.length - 1 && "border-b border-border")}
                    >
                      <label className="flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={isOpen}
                          onChange={() => setValue(`working_hours.${key}.open`, !isOpen, { shouldDirty: true })}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            "h-4 w-4 rounded border-2 flex items-center justify-center transition-colors",
                            isOpen ? "bg-brand border-brand" : "border-border bg-surface"
                          )}
                        >
                          {isOpen && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </div>
                      </label>

                      <span className={cn("w-12 text-sm font-medium shrink-0", isOpen ? "text-ink" : "text-ink-3")}>
                        {label}
                      </span>

                      {isOpen ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={dayHours.start ?? "09:00"}
                            onChange={(e) => setValue(`working_hours.${key}.start`, e.target.value, { shouldDirty: true })}
                            className="font-mono text-xs border border-border rounded-md px-2 py-1.5 bg-surface text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 h-8"
                          />
                          <span className="text-ink-3 text-xs shrink-0">até</span>
                          <input
                            type="time"
                            value={dayHours.end ?? "18:00"}
                            onChange={(e) => setValue(`working_hours.${key}.end`, e.target.value, { shouldDirty: true })}
                            className="font-mono text-xs border border-border rounded-md px-2 py-1.5 bg-surface text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 h-8"
                          />
                        </div>
                      ) : (
                        <span className="text-ink-4 text-xs">Fechado</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-border bg-surface text-ink-2 hover:bg-surface-2"
              onClick={onCancel}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 text-white font-semibold disabled:opacity-50"
              style={{ background: "var(--brand-grad)" }}
            >
              {isSubmitting ? "Salvando..." : staff ? "Salvar alterações" : "Adicionar colaborador"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
