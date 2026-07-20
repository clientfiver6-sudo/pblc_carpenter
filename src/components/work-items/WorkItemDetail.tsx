"use client"

import { useEffect, useState, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/work-items/StatusBadge"
import { StatusUpdater } from "@/components/work-items/StatusUpdater"
import {
  cn,
  formatCurrency,
  formatDateTime,
  formatRelative,
  getInitials,
} from "@/lib/utils"
import { updateWorkItem } from "@/lib/work-items/actions"
import { createClient } from "@/lib/supabase/client"
import type { WorkItemWithRelations, WorkItemStatus } from "@/types/database"
import {
  Clock,
  MapPin,
  AlertCircle,
  Check,
} from "lucide-react"
import { AIWorkItemRisk } from "@/components/ai/AIWorkItemRisk"

// ─── Status history entry ─────────────────────────────────────────────────────

interface StatusHistoryEntry {
  status: WorkItemStatus
  changed_at: string
  changed_by?: string
  notes?: string
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-3">
      {children}
    </h3>
  )
}

// ─── Payment status badge ─────────────────────────────────────────────────────

const PAYMENT_STATUS_CONFIG = {
  unpaid: { label: "Não Pago", className: "bg-danger/10 text-danger border-danger/20" },
  pending: { label: "Pendente", className: "bg-warning/10 text-warning border-warning/20" },
  paid: { label: "Pago", className: "bg-brand/10 text-brand border-brand/20" },
  refunded: { label: "Reembolsado", className: "bg-surface-2 text-ink-3 border-border" },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface WorkItemDetailProps {
  workItemId: string | null
  open: boolean
  onClose: () => void
  hideActions?: boolean
}

export function WorkItemDetail({ workItemId, open, onClose, hideActions = false }: WorkItemDetailProps) {
  const [item, setItem] = useState<WorkItemWithRelations | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [notesSaving, setNotesSaving] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!workItemId || !open) return

    setLoading(true)
    setError(null)

    const supabase = createClient()
    supabase
      .from("work_items")
      .select(
        `
        *,
        customer:customers(*),
        service:services(*),
        assigned_staff:staff(*)
        `
      )
      .eq("id", workItemId)
      .single()
      .then(({ data: rawData, error: err }) => {
        if (err) {
          setError("Não foi possível carregar os detalhes.")
          setLoading(false)
          return
        }
        const data = rawData as WorkItemWithRelations
        setItem(data)
        setNotes(data.notes ?? "")
        setLoading(false)
      })
  }, [workItemId, open])

  const handleNotesSave = async () => {
    if (!item) return
    setNotesSaving(true)
    try {
      await updateWorkItem(item.id, { notes })
    } catch {
      // silently fail — show indicator
    } finally {
      setNotesSaving(false)
    }
  }

  const handleStatusChange = (status: WorkItemStatus) => {
    if (item) setItem({ ...item, status })
  }

  const statusHistory: StatusHistoryEntry[] = (() => {
    if (!item?.metadata) return []
    const meta = item.metadata as Record<string, unknown>
    const hist = meta.status_history
    if (!Array.isArray(hist)) return []
    return hist as StatusHistoryEntry[]
  })()

  const paymentCfg = item
    ? PAYMENT_STATUS_CONFIG[item.payment_status]
    : null

  const isCompleted = item?.status === "completed"
  const isUnpaid = item?.payment_status === "unpaid"

  function getTimelineDotClass(status: WorkItemStatus): string {
    if (status === "completed") return "bg-moss"
    if (status === "cancelled" || status === "no_show") return "bg-danger"
    return "bg-brand"
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-surface border-l border-border overflow-y-auto p-0"
      >
        {loading && (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-2/3 bg-surface-2" />
            <Skeleton className="h-4 w-1/2 bg-surface-2" />
            <Skeleton className="h-24 w-full bg-surface-2" />
            <Skeleton className="h-20 w-full bg-surface-2" />
          </div>
        )}

        {error && (
          <div className="p-6 flex items-center gap-2 text-danger">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && item && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b border-border space-y-3">
              <div className="flex items-start justify-between gap-3">
                <SheetTitle className="text-ink text-base font-semibold leading-tight pr-2">
                  {item.title}
                </SheetTitle>
                <StatusBadge status={item.status} size="sm" />
              </div>
              {!hideActions && (
                <StatusUpdater
                  workItemId={item.id}
                  currentStatus={item.status}
                  onStatusChange={handleStatusChange}
                />
              )}
              <AIWorkItemRisk workItemId={item.id} />
            </SheetHeader>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Customer */}
              <section>
                <SectionHeading>Cliente</SectionHeading>
                {item.customer ? (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-tint text-brand-2 text-sm font-medium">
                        {getInitials(item.customer.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-ink font-medium text-sm">
                        {item.customer.full_name}
                      </p>
                      {item.customer.phone_number && (
                        <a
                          href={`tel:${item.customer.phone_number}`}
                          className="text-ink-3 text-xs font-mono hover:text-brand transition-colors"
                        >
                          {item.customer.phone_number}
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-ink-3 text-sm">Cliente não vinculado</p>
                )}
              </section>

              {/* Service + Staff */}
              <section>
                <SectionHeading>Serviço e Responsável</SectionHeading>
                <div className="space-y-2">
                  {item.service && (
                    <div className="flex items-center gap-2">
                      <span className="text-ink-3 text-xs w-24">Serviço</span>
                      <span className="text-ink text-sm">{item.service.name}</span>
                    </div>
                  )}
                  {item.assigned_staff && (
                    <div className="flex items-center gap-2">
                      <span className="text-ink-3 text-xs w-24">Responsável</span>
                      <span className="text-ink text-sm">{item.assigned_staff.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-ink-3 text-xs w-24">Tipo</span>
                    <span className="text-ink text-sm capitalize">{item.type.replace("_", " ")}</span>
                  </div>
                </div>
              </section>

              {/* Schedule */}
              <section>
                <SectionHeading>Agendamento</SectionHeading>
                <div className="space-y-2">
                  {item.scheduled_start && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-ink-3" />
                      <span className="text-ink text-sm font-mono">
                        {formatDateTime(item.scheduled_start)}
                      </span>
                    </div>
                  )}
                  {item.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-ink-3" />
                      <span className="text-ink text-sm">{item.address}</span>
                    </div>
                  )}
                  {!item.scheduled_start && !item.address && (
                    <p className="text-ink-3 text-sm">Não agendado</p>
                  )}
                </div>
              </section>

              {/* Financials */}
              <section>
                <SectionHeading>Financeiro</SectionHeading>
                <div className="space-y-2">
                  {item.price_estimate != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-ink-3 text-sm">Estimativa</span>
                      <span className="text-ink text-sm font-mono">
                        {formatCurrency(item.price_estimate)}
                      </span>
                    </div>
                  )}
                  {item.final_price != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-ink-3 text-sm">Valor final</span>
                      <span className="text-brand text-sm font-mono font-semibold">
                        {formatCurrency(item.final_price)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-ink-3 text-sm">Pagamento</span>
                    {paymentCfg && (
                      <Badge
                        className={cn(
                          "text-xs rounded-full border",
                          paymentCfg.className
                        )}
                      >
                        {paymentCfg.label}
                      </Badge>
                    )}
                  </div>
                  {isCompleted && isUnpaid && (
                    <Button
                      size="sm"
                      className="w-full mt-2 text-ink font-medium"
                      style={{ background: "var(--brand-grad)" }}
                    >
                      Gerar Pix
                    </Button>
                  )}
                </div>
              </section>

              {/* Notes */}
              <section>
                <SectionHeading>Observações</SectionHeading>
                <Textarea
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={handleNotesSave}
                  placeholder="Adicione observações sobre este atendimento..."
                  rows={4}
                  className="border-border bg-surface-2 text-ink placeholder:text-ink-3 resize-none text-sm focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                {notesSaving && (
                  <p className="text-xs text-ink-3 mt-1">Salvando...</p>
                )}
              </section>

              {/* Timeline */}
              {statusHistory.length > 0 && (
                <section>
                  <SectionHeading>Histórico</SectionHeading>
                  <div className="space-y-3">
                    {statusHistory.map((entry, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <div
                          className={cn(
                            "mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                            getTimelineDotClass(entry.status)
                          )}
                        >
                          <Check className="h-3 w-3 text-ink" />
                        </div>
                        <div>
                          <StatusBadge status={entry.status} size="sm" />
                          <p className="text-ink-3 text-xs mt-0.5 font-mono">
                            {formatRelative(entry.changed_at)}
                          </p>
                          {entry.notes && (
                            <p className="text-ink-3 text-xs mt-0.5">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Timestamps */}
              <div className="border-t border-border pt-4 space-y-1">
                <p className="text-ink-3 text-xs">
                  Criado em {formatDateTime(item.created_at)}
                </p>
                <p className="text-ink-3 text-xs">
                  Atualizado {formatRelative(item.updated_at)}
                </p>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
