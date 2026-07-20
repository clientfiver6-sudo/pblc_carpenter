"use client"

import { useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2 } from "lucide-react"
import type { Prescription } from "@/types/database"

interface PrescriptionDialogProps {
  open: boolean
  onClose: () => void
  customerId: string
  workItemId?: string
  onCreated: (record: Prescription) => void
}

interface MedForm { name: string; dose: string; frequency: string; duration: string }
interface FormData { crm_number: string; medications: MedForm[]; notes: string }

const inputCls = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
const labelCls = "text-xs font-semibold text-ink-3 uppercase tracking-wide"

export function PrescriptionDialog({ open, onClose, customerId, workItemId, onCreated }: PrescriptionDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, control, reset } = useForm<FormData>({
    defaultValues: { crm_number: "", medications: [{ name: "", dose: "", frequency: "", duration: "" }], notes: "" },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "medications" })

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const meds = data.medications.filter(m => m.name.trim())
      const res = await fetch("/api/medical/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crm_number: data.crm_number || null,
          medications: meds,
          notes: data.notes || null,
          customer_id: customerId,
          work_item_id: workItemId ?? null,
          issued_at: new Date().toISOString(),
        }),
      })
      const json = await res.json() as Prescription & { error?: string }
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
          <DialogTitle className="text-ink">Nova Prescrição</DialogTitle>
        </DialogHeader>

        <form id="prescription-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5 py-2">
          <div className="space-y-1.5">
            <label className={labelCls}>CRM do médico</label>
            <input type="text" placeholder="CRM/SP 123456" className={inputCls} {...register("crm_number")} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Medicamentos</label>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-brand"
                onClick={() => append({ name: "", dose: "", frequency: "", duration: "" })}>
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </Button>
            </div>
            {fields.map((field, i) => (
              <div key={field.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-3">Medicamento {i + 1}</span>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(i)} className="text-danger hover:opacity-70">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input placeholder="Nome do medicamento" className={inputCls} {...register(`medications.${i}.name`)} />
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="Dose (ex: 500mg)" className={inputCls} {...register(`medications.${i}.dose`)} />
                  <input placeholder="Frequência (ex: 8/8h)" className={inputCls} {...register(`medications.${i}.frequency`)} />
                  <input placeholder="Duração (ex: 7 dias)" className={inputCls} {...register(`medications.${i}.duration`)} />
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Observações</label>
            <textarea rows={2} placeholder="Instruções adicionais, observações..." className={`${inputCls} resize-none`} {...register("notes")} />
          </div>

          {error && <p className="text-danger text-xs">{error}</p>}
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="prescription-form" disabled={saving} style={{ background: "var(--brand-grad)", color: "#fff" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar prescrição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
