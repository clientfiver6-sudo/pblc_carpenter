"use client"

import { useTransition, useOptimistic } from "react"
import { StatusBadge } from "@/components/work-items/StatusBadge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn, formatCurrency, formatDateTime, getInitials } from "@/lib/utils"
import { updateWorkItemStatus } from "@/lib/work-items/actions"
import { Clock, MapPin, DollarSign, AlertCircle } from "lucide-react"
import type { BusinessType } from "@/lib/config/business-types"
import type { WorkItemWithRelations, WorkItemStatus } from "@/types/database"

interface WorkItemCardProps {
  item: WorkItemWithRelations
  businessType: BusinessType
  onClick?: () => void
}

const FINAL_STATUSES: WorkItemStatus[] = ["completed", "cancelled", "no_show"]

export function WorkItemCard({ item, onClick }: WorkItemCardProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticStatus, addOptimisticStatus] = useOptimistic(
    item.status,
    (_: WorkItemStatus, next: WorkItemStatus) => next,
  )

  const showAddress = item.type === "service_call" || item.type === "job"
  const customerName = item.customer?.full_name ?? "Cliente não informado"
  const isFinal = FINAL_STATUSES.includes(optimisticStatus)

  function handleAction(targetStatus: WorkItemStatus, e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(async () => {
      addOptimisticStatus(targetStatus)
      await updateWorkItemStatus(item.id, targetStatus)
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className="bg-surface border border-border rounded-lg px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:border-brand/30 hover:bg-surface-2/40 transition-colors"
    >
      {/* Avatar */}
      <Avatar className="h-9 w-9 shrink-0 self-start mt-0.5">
        <AvatarFallback className="bg-tint text-brand-2 text-xs font-semibold rounded-full">
          {getInitials(customerName)}
        </AvatarFallback>
      </Avatar>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Customer + service */}
        <div>
          <p className="text-ink font-semibold text-sm truncate">{customerName}</p>
          {item.service && (
            <p className="text-ink-3 text-xs truncate">{item.service.name}</p>
          )}
          {!item.service && (
            <p className="text-ink-3 text-xs truncate">{item.title}</p>
          )}
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.scheduled_start && (
            <span className="flex items-center gap-1 text-ink-4 text-xs font-mono">
              <Clock className="h-3 w-3 shrink-0" />
              {formatDateTime(item.scheduled_start)}
            </span>
          )}

          {item.assigned_staff ? (
            <span
              className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border"
              style={{
                borderColor: item.assigned_staff.color + "60",
                backgroundColor: item.assigned_staff.color + "18",
                color: item.assigned_staff.color,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.assigned_staff.color }} />
              {item.assigned_staff.name}
            </span>
          ) : (
            !FINAL_STATUSES.includes(item.status) && (
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning">
                <AlertCircle className="h-3 w-3 shrink-0" />
                Sem responsável
              </span>
            )
          )}

          {item.price_estimate != null && (
            <span className="flex items-center gap-1 text-ink-4 text-xs font-mono">
              <DollarSign className="h-3 w-3 shrink-0" />
              {formatCurrency(item.price_estimate)}
            </span>
          )}

          {showAddress && item.address && (
            <span className="flex items-center gap-1 text-ink-4 text-xs truncate max-w-[180px]">
              <MapPin className="h-3 w-3 shrink-0" />
              {item.address}
            </span>
          )}
        </div>
      </div>

      {/* Right column: status + quick actions */}
      <div
        className="shrink-0 flex flex-col items-end gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <StatusBadge status={optimisticStatus} size="sm" />

        {!isFinal && (
          <div className={cn("flex flex-col gap-1.5", isPending && "opacity-50 pointer-events-none")}>
            <button
              type="button"
              onClick={(e) => handleAction("no_show", e)}
              className="text-[11px] font-semibold text-warning border border-warning/30 bg-warning/8 hover:bg-warning/15 px-2.5 py-1 rounded-md transition-colors whitespace-nowrap"
            >
              Não compareceu
            </button>
            <button
              type="button"
              onClick={(e) => handleAction("cancelled", e)}
              className="text-[11px] font-semibold text-danger border border-danger/30 bg-danger/8 hover:bg-danger/15 px-2.5 py-1 rounded-md transition-colors whitespace-nowrap"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
