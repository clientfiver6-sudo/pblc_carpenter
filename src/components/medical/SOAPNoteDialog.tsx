"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { MicRecorder, type SOAPResult } from "@/components/medical/MicRecorder"
import type { MedicalNote } from "@/types/database"

interface SOAPNoteDialogProps {
  open: boolean
  onClose: () => void
  customerId: string
  workItemId?: string
  onCreated: (note: MedicalNote) => void
}

interface FormData {
  subjective: string
  objective: string
  assessment: string
  plan_text: string
  raw_note: string
}

const textaCls = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
const labelCls = "text-xs font-semibold text-ink-3 uppercase tracking-wide"

export function SOAPNoteDialog({ open, onClose, customerId, workItemId, onCreated }: SOAPNoteDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const { register, handleSubmit, setValue, reset } = useForm<FormData>({
    defaultValues: { subjective: "", objective: "", assessment: "", plan_text: "", raw_note: "" },
  })

  function handleSOAPResult(result: SOAPResult) {
    setAudioUrl(result.audioUrl)
    setValue("subjective", result.soap.subjective)
    setValue("objective", result.soap.objective)
    setValue("assessment", result.soap.assessment)
    setValue("plan_text", result.soap.plan_text)
    setValue("raw_note", result.transcript)
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/medical/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, customer_id: customerId, work_item_id: workItemId ?? null, audio_url: audioUrl }),
      })
      const json = await res.json() as MedicalNote & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar")
      onCreated(json)
      reset()
      setAudioUrl(null)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() {
    reset()
    setAudioUrl(null)
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-surface border-border text-ink max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-ink">Nova Consulta — Nota SOAP</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <MicRecorder
            customerId={customerId}
            workItemId={workItemId}
            onResult={handleSOAPResult}
            onError={setError}
          />

          <form id="soap-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {[
              { key: "subjective" as const, label: "S — Subjetivo", placeholder: "Queixa principal, sintomas relatados pelo paciente..." },
              { key: "objective" as const, label: "O — Objetivo", placeholder: "Sinais vitais, exame físico, achados objetivos..." },
              { key: "assessment" as const, label: "A — Avaliação", placeholder: "Diagnóstico, hipóteses diagnósticas..." },
              { key: "plan_text" as const, label: "P — Plano", placeholder: "Conduta, tratamento, retorno..." },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <label className={labelCls}>{label}</label>
                <textarea rows={3} placeholder={placeholder} className={textaCls} {...register(key)} />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className={labelCls}>Transcrição completa (opcional)</label>
              <textarea rows={2} placeholder="Transcrição bruta da consulta..." className={textaCls} {...register("raw_note")} />
            </div>
          </form>

          {error && <p className="text-danger text-xs">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="soap-form" disabled={saving} style={{ background: "var(--brand-grad)", color: "#fff" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar nota"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
