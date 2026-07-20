"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2 } from "lucide-react"
import type { ExamRequest } from "@/types/database"

interface ExamRequestDialogProps {
  open: boolean
  onClose: () => void
  customerId: string
  workItemId?: string
  onCreated: (record: ExamRequest) => void
}

interface ExamForm { name: string; instructions: string }
interface FormData { exam_type: "laboratorial" | "imagem" | "outro"; exams: ExamForm[]; clinical_justification: string }

const inputCls = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
const labelCls = "text-xs font-semibold text-ink-3 uppercase tracking-wide"
const selectCls = `${inputCls} cursor-pointer`

export function ExamRequestDialog({ open, onClose, customerId, workItemId, onCreated }: ExamRequestDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, control, reset } = useForm<FormData>({
    defaultValues: { exam_type: "laboratorial", exams: [{ name: "", instructions: "" }], clinical_justification: "" },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "exams" })

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const exams = data.exams.filter(e => e.name.trim())
      const res = await fetch("/api/medical/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_type: data.exam_type,
          exams_requested: exams,
          clinical_justification: data.clinical_justification || null,
          customer_id: customerId,
          work_item_id: workItemId ?? null,
          issued_at: new Date().toISOString(),
        }),
      })
      const json = await res.json() as ExamRequest & { error?: string }
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
      <DialogContent className="bg-surface border-border text-ink max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-ink">Solicitação de Exames</DialogTitle>
        </DialogHeader>

        <form id="exam-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
          <div className="space-y-1.5">
            <label className={labelCls}>Tipo de exame</label>
            <select className={selectCls} {...register("exam_type")}>
              <option value="laboratorial">Laboratorial</option>
              <option value="imagem">Imagem</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Exames solicitados</label>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-brand"
                onClick={() => append({ name: "", instructions: "" })}>
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </Button>
            </div>
            {fields.map((field, i) => (
              <div key={field.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-3">Exame {i + 1}</span>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(i)} className="text-danger hover:opacity-70">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input placeholder="Nome do exame (ex: Hemograma completo)" className={inputCls} {...register(`exams.${i}.name`)} />
                <input placeholder="Instruções de preparo (opcional)" className={inputCls} {...register(`exams.${i}.instructions`)} />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Justificativa clínica</label>
            <textarea rows={2} placeholder="Hipótese diagnóstica, indicação clínica..." className={`${inputCls} resize-none`} {...register("clinical_justification")} />
          </div>

          {error && <p className="text-danger text-xs">{error}</p>}
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="exam-form" disabled={saving} style={{ background: "var(--brand-grad)", color: "#fff" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Solicitar exames"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
