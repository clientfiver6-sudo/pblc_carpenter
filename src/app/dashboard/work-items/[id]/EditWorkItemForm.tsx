"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { updateWorkItem } from "@/lib/work-items/actions"
import type { WorkItemWithRelations, WorkItemStatus } from "@/types/database"
import { AlertCircle, ChevronDown, ChevronRight, Lock } from "lucide-react"

// ─── Ficha de Atendimento types ───────────────────────────────────────────────

interface WorkItemRecord {
  findings: string
  procedure: string
  materials: string
  instructions: string
  followUp: string
  [key: string]: string
}

function extractRecord(metadata: unknown): WorkItemRecord {
  if (
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    "record" in metadata
  ) {
    const rec = (metadata as Record<string, unknown>).record
    if (rec && typeof rec === "object" && !Array.isArray(rec)) {
      const r = rec as Record<string, unknown>
      return {
        findings: typeof r.findings === "string" ? r.findings : "",
        procedure: typeof r.procedure === "string" ? r.procedure : "",
        materials: typeof r.materials === "string" ? r.materials : "",
        instructions: typeof r.instructions === "string" ? r.instructions : "",
        followUp: typeof r.followUp === "string" ? r.followUp : "",
      }
    }
  }
  return { findings: "", procedure: "", materials: "", instructions: "", followUp: "" }
}

// ─── Status options ───────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: WorkItemStatus; label: string }[] = [
  { value: "new", label: "Novo" },
  { value: "scheduled", label: "Agendado" },
  { value: "pending_confirmation", label: "Aguardando confirmação" },
  { value: "confirmed", label: "Confirmado" },
  { value: "in_progress", label: "Em andamento" },
  { value: "waiting_customer", label: "Aguardando cliente" },
  { value: "waiting_parts", label: "Aguardando peças" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
  { value: "no_show", label: "Não compareceu" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert ISO string to datetime-local input value (YYYY-MM-DDTHH:mm) */
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Convert centavos to reais string for display */
function centavosToReais(centavos: number | null | undefined): string {
  if (centavos == null) return ""
  return (centavos / 100).toFixed(2)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EditWorkItemFormProps {
  item: WorkItemWithRelations
}

export function EditWorkItemForm({ item }: EditWorkItemFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [title, setTitle] = useState(item.title)
  const [status, setStatus] = useState<WorkItemStatus>(item.status)
  const [scheduledStart, setScheduledStart] = useState(
    toDatetimeLocal(item.scheduled_start)
  )
  const [scheduledEnd, setScheduledEnd] = useState(
    toDatetimeLocal(item.scheduled_end)
  )
  const [priceEstimate, setPriceEstimate] = useState(
    centavosToReais(item.price_estimate)
  )
  const [notes, setNotes] = useState(item.notes ?? "")
  const [internalNotes, setInternalNotes] = useState(item.internal_notes ?? "")
  const [fichaOpen, setFichaOpen] = useState(false)
  const initialRecord = extractRecord(item.metadata)
  const [findings, setFindings] = useState(initialRecord.findings)
  const [procedure, setProcedure] = useState(initialRecord.procedure)
  const [materials, setMaterials] = useState(initialRecord.materials)
  const [instructions, setInstructions] = useState(initialRecord.instructions)
  const [followUp, setFollowUp] = useState(initialRecord.followUp)

  const inputClass =
    "w-full border border-border rounded-md h-10 px-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
  const labelClass =
    "text-xs font-semibold text-ink-2 uppercase tracking-wide mb-1.5"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        // Build update payload
        const priceInCentavos =
          priceEstimate.trim() !== ""
            ? Math.round(parseFloat(priceEstimate) * 100)
            : null

        // Build ficha record — preserve existing metadata keys (e.g. status_history)
        const existingMeta =
          item.metadata &&
          typeof item.metadata === "object" &&
          !Array.isArray(item.metadata)
            ? (item.metadata as Record<string, unknown>)
            : {}

        const fichaRecord: WorkItemRecord = {
          findings: findings.trim(),
          procedure: procedure.trim(),
          materials: materials.trim(),
          instructions: instructions.trim(),
          followUp: followUp.trim(),
        }

        const updatedMetadata = { ...existingMeta, record: fichaRecord }

        await updateWorkItem(item.id, {
          title: title.trim(),
          status,
          scheduled_start: scheduledStart ? new Date(scheduledStart).toISOString() : null,
          scheduled_end: scheduledEnd ? new Date(scheduledEnd).toISOString() : null,
          price_estimate: priceInCentavos,
          notes: notes.trim() || null,
          internal_notes: internalNotes.trim() || null,
          metadata: updatedMetadata,
        })

        router.push("/dashboard/work-items")
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao salvar as alterações."
        )
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Title */}
        <div className="space-y-1.5 md:col-span-2">
          <Label className={labelClass}>Título</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Consulta - João Silva"
            required
            className={inputClass}
          />
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className={labelClass}>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as WorkItemStatus)}
          >
            <SelectTrigger className="border-border bg-surface text-ink h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border shadow-2">
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-ink">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price estimate */}
        <div className="space-y-1.5">
          <Label className={labelClass}>Valor estimado (R$)</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-sm font-mono">
              R$
            </span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={priceEstimate}
              onChange={(e) => setPriceEstimate(e.target.value)}
              placeholder="0,00"
              className={`${inputClass} pl-9 font-mono`}
            />
          </div>
        </div>

        <hr className="md:col-span-2 border-t border-border my-1" />

        {/* Scheduled start */}
        <div className="space-y-1.5">
          <Label className={labelClass}>Início agendado</Label>
          <Input
            type="datetime-local"
            value={scheduledStart}
            onChange={(e) => setScheduledStart(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Scheduled end */}
        <div className="space-y-1.5">
          <Label className={labelClass}>Término agendado</Label>
          <Input
            type="datetime-local"
            value={scheduledEnd}
            onChange={(e) => setScheduledEnd(e.target.value)}
            className={inputClass}
          />
        </div>

        <hr className="md:col-span-2 border-t border-border my-1" />

        {/* Notes */}
        <div className="space-y-1.5 md:col-span-2">
          <Label className={labelClass}>Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Informações adicionais sobre o atendimento..."
            rows={4}
            className="w-full border border-border rounded-md min-h-[100px] py-2.5 px-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
          />
        </div>

        {/* Internal Notes */}
        <div className="space-y-1.5 md:col-span-2">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-ink-3" />
            <Label className={labelClass}>Notas internas</Label>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-3 bg-surface-2 border border-border rounded px-1.5 py-0.5 ml-1">
              Interno
            </span>
          </div>
          <Textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Visível apenas para a equipe. Não enviado ao cliente."
            rows={3}
            className="w-full border border-border rounded-md min-h-[80px] py-2.5 px-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
          />
        </div>
      </div>

      {/* Ficha de Atendimento */}
      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <button
          type="button"
          onClick={() => setFichaOpen((o) => !o)}
          className="flex items-center gap-2 w-full text-left"
        >
          {fichaOpen ? (
            <ChevronDown className="h-4 w-4 text-ink-3" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-3" />
          )}
          <span className="text-sm font-semibold text-ink">Ficha de Atendimento</span>
          {!fichaOpen && (
            <span className="text-xs text-ink-3 ml-1">(clique para expandir)</span>
          )}
        </button>

        {fichaOpen && (
          <div className="space-y-4 pt-1">
            {/* Findings */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-ink-2">
                Achados / Diagnóstico
              </Label>
              <Textarea
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                placeholder="Ex: Cárie na face oclusal do dente 36, tensão muscular na região lombar..."
                rows={3}
                className="w-full border border-border rounded-md min-h-[80px] py-2.5 px-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>

            {/* Procedure */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-ink-2">
                Procedimento realizado
              </Label>
              <Textarea
                value={procedure}
                onChange={(e) => setProcedure(e.target.value)}
                placeholder="Ex: Restauração composta, mobilização articular, troca do filtro de óleo..."
                rows={3}
                className="w-full border border-border rounded-md min-h-[80px] py-2.5 px-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>

            {/* Materials */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-ink-2">
                Materiais utilizados
              </Label>
              <Textarea
                value={materials}
                onChange={(e) => setMaterials(e.target.value)}
                placeholder="Ex: Resina composta A2, fio guia 0.25mm, filtro Bosch F026407169..."
                rows={2}
                className="w-full border border-border rounded-md min-h-[60px] py-2.5 px-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>

            {/* Instructions */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-ink-2">
                Instruções pós-atendimento
              </Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Ex: Evitar mastigar no lado direito por 24h, aplicar gelo 3x ao dia..."
                rows={3}
                className="w-full border border-border rounded-md min-h-[80px] py-2.5 px-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>

            {/* Follow-up */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-ink-2">
                Retorno / Próximos passos
              </Label>
              <Textarea
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder="Ex: Retorno em 7 dias para reavaliação, agendar revisão em 6 meses..."
                rows={2}
                className="w-full border border-border rounded-md min-h-[60px] py-2.5 px-3 text-sm text-ink bg-surface placeholder:text-ink-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Read-only info */}
      {(item.customer || item.service || item.assigned_staff) && (
        <div className="rounded-md bg-surface-2 border border-border p-4 space-y-2">
          <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">
            Informações vinculadas
          </p>
          {item.customer && (
            <div className="flex gap-2 text-sm">
              <span className="text-ink-3 w-24 shrink-0">Cliente</span>
              <span className="text-ink">{item.customer.full_name}</span>
            </div>
          )}
          {item.service && (
            <div className="flex gap-2 text-sm">
              <span className="text-ink-3 w-24 shrink-0">Serviço</span>
              <span className="text-ink">{item.service.name}</span>
            </div>
          )}
          {item.assigned_staff && (
            <div className="flex gap-2 text-sm">
              <span className="text-ink-3 w-24 shrink-0">Responsável</span>
              <span className="text-ink">{item.assigned_staff.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-danger/10 border border-danger/20 px-4 py-3 text-danger text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/work-items")}
          disabled={isPending}
          className="border-border text-ink-2 hover:text-ink hover:bg-surface-2"
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isPending || !title.trim()}
          className="h-11 px-6 rounded-md text-white font-semibold hover:opacity-90 transition-opacity"
          style={{ background: "var(--brand-grad)" }}
        >
          {isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  )
}
