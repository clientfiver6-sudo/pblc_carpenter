"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { Anamnese } from "@/types/database"

interface AnamneseDialogProps {
  open: boolean
  onClose: () => void
  customerId: string
  workItemId?: string
  onCreated: (record: Anamnese) => void
}

interface FormData {
  queixas_principais: string
  historico_medico: string
  alergias: string
  medicamentos_em_uso: string
  antecedentes_familiares: string
  habitos_vicios: string
}

const textaCls = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
const labelCls = "text-xs font-semibold text-ink-3 uppercase tracking-wide"

const FIELDS: { key: keyof FormData; label: string; placeholder: string }[] = [
  { key: "queixas_principais", label: "Queixas principais", placeholder: "Motivo da consulta, sintomas principais..." },
  { key: "historico_medico", label: "Histórico médico", placeholder: "Doenças anteriores, cirurgias, internações..." },
  { key: "alergias", label: "Alergias", placeholder: "Medicamentos, alimentos, substâncias..." },
  { key: "medicamentos_em_uso", label: "Medicamentos em uso", placeholder: "Nome, dose, frequência..." },
  { key: "antecedentes_familiares", label: "Antecedentes familiares", placeholder: "Doenças hereditárias, histórico familiar..." },
  { key: "habitos_vicios", label: "Hábitos e vícios", placeholder: "Tabagismo, etilismo, atividade física, alimentação..." },
]

export function AnamneseDialog({ open, onClose, customerId, workItemId, onCreated }: AnamneseDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset } = useForm<FormData>({
    defaultValues: { queixas_principais: "", historico_medico: "", alergias: "", medicamentos_em_uso: "", antecedentes_familiares: "", habitos_vicios: "" },
  })

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/medical/anamnese", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, customer_id: customerId, work_item_id: workItemId ?? null }),
      })
      const json = await res.json() as Anamnese & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar")
      onCreated(json)
      reset()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function handleClose() { reset(); setError(null); onClose() }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-surface border-border text-ink max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-ink">Nova Anamnese</DialogTitle>
        </DialogHeader>

        <form id="anamnese-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {FIELDS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <label className={labelCls}>{label}</label>
              <textarea rows={3} placeholder={placeholder} className={textaCls} {...register(key)} />
            </div>
          ))}
          {error && <p className="text-danger text-xs">{error}</p>}
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="anamnese-form" disabled={saving} style={{ background: "var(--brand-grad)", color: "#fff" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar anamnese"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
