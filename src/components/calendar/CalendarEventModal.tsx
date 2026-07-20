"use client"

import { useState } from "react"
import { Sparkles, PenLine, Check, AlertCircle, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { generateEventContent, createCalendarEvent } from "@/app/dashboard/calendar/actions"

interface CalendarEventModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  defaultDate?: string
  defaultTime?: string
}

export function CalendarEventModal({ open, onClose, onCreated, defaultDate, defaultTime }: CalendarEventModalProps) {
  const today = new Date().toISOString().slice(0, 10)

  const [tab, setTab] = useState<"manual" | "ai">("manual")

  // Form fields
  const [title, setTitle] = useState("")
  const [date, setDate] = useState(defaultDate ?? today)
  const [startTime, setStartTime] = useState(defaultTime ?? "09:00")
  const [endTime, setEndTime] = useState("")
  const [description, setDescription] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // AI state
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiFollowUp, setAiFollowUp] = useState("")
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiQuestion, setAiQuestion] = useState<string | null>(null)
  const [aiOutOfScope, setAiOutOfScope] = useState(false)
  const [aiExtracted, setAiExtracted] = useState<{ title?: string; description?: string } | null>(null)
  const [aiVerified, setAiVerified] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  function resetAll() {
    setTab("manual")
    setTitle("")
    setDate(defaultDate ?? today)
    setStartTime(defaultTime ?? "09:00")
    setEndTime("")
    setDescription("")
    setFormError(null)
    setAiPrompt("")
    setAiFollowUp("")
    setAiQuestion(null)
    setAiOutOfScope(false)
    setAiExtracted(null)
    setAiVerified(false)
    setAiError(null)
  }

  function handleClose() {
    resetAll()
    onClose()
  }

  async function handleAiGenerate() {
    const combined = aiFollowUp.trim()
      ? `${aiPrompt.trim()}\n${aiFollowUp.trim()}`
      : aiPrompt.trim()
    if (aiFollowUp.trim()) setAiPrompt(combined)
    setAiFollowUp("")
    setAiGenerating(true)
    setAiQuestion(null)
    setAiOutOfScope(false)
    setAiExtracted(null)
    setAiError(null)

    const result = await generateEventContent(combined)
    setAiGenerating(false)

    if (result.error) { setAiError(result.error); return }
    if (result.outOfScope) { setAiOutOfScope(true); return }
    if (result.question) { setAiQuestion(result.question); return }
    if (result.title ?? result.description) {
      setAiExtracted({ title: result.title, description: result.description })
    }
  }

  function handleVerify() {
    if (!aiExtracted) return
    if (aiExtracted.title) setTitle(aiExtracted.title)
    if (aiExtracted.description) setDescription(aiExtracted.description)
    setAiVerified(true)
    setTab("manual")
  }

  async function handleSubmit() {
    if (!title.trim()) { setFormError("Título obrigatório."); return }
    if (!date) { setFormError("Data obrigatória."); return }
    if (!startTime) { setFormError("Hora de início obrigatória."); return }

    setSubmitting(true)
    setFormError(null)

    const startAt = new Date(`${date}T${startTime}:00`).toISOString()
    const endAt = endTime ? new Date(`${date}T${endTime}:00`).toISOString() : undefined

    const result = await createCalendarEvent({
      title: title.trim(),
      description: description.trim() || undefined,
      startAt,
      endAt,
    })

    setSubmitting(false)
    if (result.error) { setFormError(result.error); return }

    resetAll()
    onCreated()
    onClose()
  }

  const inputCls = "w-full h-9 px-3 rounded-md border border-border bg-surface text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-[border-color,box-shadow] duration-150 ease-brand-out"
  const textareaCls = "w-full px-3 py-2 rounded-md border border-border bg-surface text-ink text-sm placeholder:text-ink-4 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand resize-none transition-[border-color,box-shadow] duration-150 ease-brand-out"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-surface border-border text-ink max-w-md">
        <DialogHeader>
          <DialogTitle className="text-ink">Novo Evento</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-surface-2 rounded-lg">
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-[background-color,color] duration-150 ease-brand-out",
              tab === "manual" ? "bg-surface text-ink shadow-1" : "text-ink-3 hover:text-ink"
            )}
          >
            <PenLine className="w-3.5 h-3.5" />
            Manual
          </button>
          <button
            type="button"
            onClick={() => { setTab("ai"); setAiVerified(false) }}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-[background-color,color] duration-150 ease-brand-out",
              tab === "ai" ? "bg-surface text-ink shadow-1" : "text-ink-3 hover:text-ink"
            )}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Descrever com IA
          </button>
        </div>

        {/* ── Manual tab ── */}
        {tab === "manual" && (
          <div className="space-y-3">
            {aiVerified && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-tint border border-brand/20 text-sm text-brand">
                <Check className="w-3.5 h-3.5 shrink-0" />
                Campos preenchidos pela IA — complete a data e horário.
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-ink-3 mb-1 block">Título *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Reunião de equipe"
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-3 mb-1 block">Data *</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-ink-3 mb-1 block">Início *</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-ink-3 mb-1 block">
                Hora fim <span className="text-ink-4 font-normal">(opcional)</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-3 mb-1 block">
                Descrição <span className="text-ink-4 font-normal">(opcional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Observações sobre o evento..."
                rows={3}
                className={textareaCls}
              />
            </div>
          </div>
        )}

        {/* ── AI tab ── */}
        {tab === "ai" && (
          <div className="space-y-3">
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Descreva o evento... Ex: reunião semanal de equipe toda segunda às 9h para alinhar a semana"
              rows={3}
              disabled={aiGenerating || !!aiExtracted}
              className={cn(textareaCls, "disabled:opacity-50")}
            />

            {aiQuestion && (
              <div className="space-y-2">
                <p className="text-sm text-ink-2">{aiQuestion}</p>
                <textarea
                  value={aiFollowUp}
                  onChange={e => setAiFollowUp(e.target.value)}
                  placeholder="Sua resposta..."
                  rows={2}
                  disabled={aiGenerating}
                  className={cn(textareaCls, "border-brand/40 bg-tint/30 disabled:opacity-50")}
                />
              </div>
            )}

            {aiOutOfScope && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Isso não parece um evento. Descreva uma reunião, visita técnica, lembrete ou outro compromisso do negócio.</p>
              </div>
            )}

            {aiError && <p className="text-xs text-red-500">{aiError}</p>}

            {aiExtracted ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-border bg-surface-2 space-y-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-4 mb-0.5">Título</p>
                    <p className="text-sm text-ink">{aiExtracted.title}</p>
                  </div>
                  {aiExtracted.description && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-4 mb-0.5">Descrição</p>
                      <p className="text-sm text-ink-2">{aiExtracted.description}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setAiExtracted(null); setAiQuestion(null); setAiPrompt(""); setAiFollowUp("") }}
                    className="flex-1 h-9 rounded-md border border-border text-sm text-ink-2 hover:bg-surface-2 transition-colors"
                  >
                    Refazer
                  </button>
                  <button
                    type="button"
                    onClick={handleVerify}
                    className="flex-1 h-9 rounded-md text-sm font-medium text-white flex items-center justify-center gap-1.5 active:scale-[0.97] transition-[opacity,transform] duration-150 ease-brand-out"
                    style={{ background: "var(--brand-grad)" }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Verificar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={aiGenerating || (!aiPrompt.trim() && !aiFollowUp.trim())}
                className="w-full h-9 rounded-md text-sm font-medium text-white disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.97] transition-[opacity,transform] duration-150 ease-brand-out"
                style={{ background: "var(--brand-grad)" }}
              >
                {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiGenerating ? "Gerando..." : aiQuestion ? "Responder" : "Gerar com IA"}
              </button>
            )}
          </div>
        )}

        {formError && <p className="text-xs text-red-500 mt-1">{formError}</p>}

        {tab === "manual" && (
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="h-9 px-4 rounded-md border border-border text-sm text-ink-2 hover:bg-surface-2 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="h-9 px-4 rounded-md text-sm font-medium text-white disabled:opacity-50 flex items-center gap-2 active:scale-[0.97] transition-[opacity,transform] duration-150 ease-brand-out"
              style={{ background: "var(--brand-grad)" }}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Criar Evento
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
