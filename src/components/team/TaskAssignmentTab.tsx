"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { assignWorkItem } from "@/lib/team/actions"
import { StatusBadge } from "@/components/work-items/StatusBadge"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { StaffWithStats, WorkItemWithRelations } from "@/types/database"
import { Clock, DollarSign, Plus, X, ClipboardList } from "lucide-react"

interface TaskAssignmentTabProps {
  staff: StaffWithStats
  unassignedItems: WorkItemWithRelations[]
}

function WorkItemRow({
  item,
  action,
  actionLabel,
  actionVariant = "default",
  onAction,
  isPending,
}: {
  item: WorkItemWithRelations
  action: () => void
  actionLabel: string
  actionVariant?: "default" | "ghost"
  onAction?: () => void
  isPending: boolean
}) {
  void onAction
  const customerName = item.customer?.full_name ?? "Cliente não informado"

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:bg-surface-2 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-ink text-sm font-medium truncate">{customerName}</p>
        <p className="text-ink-3 text-xs truncate">{item.service?.name ?? item.title}</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {item.scheduled_start && (
            <span className="flex items-center gap-1 text-ink-4 text-xs">
              <Clock className="w-3 h-3 shrink-0" />
              {formatDateTime(item.scheduled_start)}
            </span>
          )}
          {item.price_estimate != null && (
            <span className="flex items-center gap-1 text-ink-4 text-xs font-mono">
              <DollarSign className="w-3 h-3 shrink-0" />
              {formatCurrency(item.price_estimate)}
            </span>
          )}
          <StatusBadge status={item.status} size="sm" />
        </div>
      </div>
      <Button
        size="sm"
        variant={actionVariant === "ghost" ? "ghost" : "outline"}
        className="shrink-0 text-xs h-7 gap-1"
        disabled={isPending}
        onClick={action}
      >
        {actionLabel === "Atribuir" ? <Plus className="w-3 h-3" /> : <X className="w-3 h-3" />}
        {actionLabel}
      </Button>
    </div>
  )
}

export function TaskAssignmentTab({ staff, unassignedItems }: TaskAssignmentTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function assign(workItemId: string) {
    startTransition(async () => {
      await assignWorkItem(workItemId, staff.id)
      router.refresh()
    })
  }

  function unassign(workItemId: string) {
    startTransition(async () => {
      await assignWorkItem(workItemId, null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {/* Member's assigned tasks */}
      <div>
        <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2">
          Tarefas de {staff.name}
        </h4>
        {staff.assigned_items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <ClipboardList className="w-8 h-8 text-ink-4" />
            <p className="text-ink-4 text-sm">Nenhuma tarefa atribuída</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staff.assigned_items.map(item => (
              <WorkItemRow
                key={item.id}
                item={item}
                action={() => unassign(item.id)}
                actionLabel="Remover"
                actionVariant="ghost"
                isPending={isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Unassigned pool */}
      {unassignedItems.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2">
            Tarefas Disponíveis ({unassignedItems.length})
          </h4>
          <div className="space-y-2">
            {unassignedItems.map(item => (
              <WorkItemRow
                key={item.id}
                item={item}
                action={() => assign(item.id)}
                actionLabel="Atribuir"
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
