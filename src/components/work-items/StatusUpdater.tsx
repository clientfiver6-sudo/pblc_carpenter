"use client"

import { useOptimistic, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { updateWorkItemStatus } from "@/lib/work-items/actions"
import type { WorkItemStatus } from "@/types/database"

interface NextAction {
  label: string
  targetStatus: WorkItemStatus
  variant?: "default" | "destructive" | "outline"
}

const NEXT_ACTIONS: Record<WorkItemStatus, NextAction[]> = {
  new: [
    { label: "Confirmar Pendente", targetStatus: "pending_confirmation", variant: "outline" },
  ],
  scheduled: [
    { label: "Confirmar", targetStatus: "confirmed", variant: "default" },
  ],
  pending_confirmation: [
    { label: "Confirmar", targetStatus: "confirmed", variant: "default" },
  ],
  confirmed: [
    { label: "Iniciar", targetStatus: "in_progress", variant: "default" },
    { label: "Não Compareceu", targetStatus: "no_show", variant: "outline" },
  ],
  in_progress: [
    { label: "Concluir", targetStatus: "completed", variant: "default" },
    { label: "Aguardar Cliente", targetStatus: "waiting_customer", variant: "outline" },
    { label: "Aguardar Peças", targetStatus: "waiting_parts", variant: "outline" },
  ],
  waiting_customer: [
    { label: "Retomar", targetStatus: "in_progress", variant: "default" },
  ],
  waiting_parts: [
    { label: "Retomar", targetStatus: "in_progress", variant: "default" },
  ],
  completed: [],
  cancelled: [],
  no_show: [],
}

interface StatusUpdaterProps {
  workItemId: string
  currentStatus: WorkItemStatus
  onStatusChange?: (status: WorkItemStatus) => void
}

export function StatusUpdater({
  workItemId,
  currentStatus,
  onStatusChange,
}: StatusUpdaterProps) {
  const [isPending, startTransition] = useTransition()
  const [optimisticStatus, addOptimisticStatus] = useOptimistic(
    currentStatus,
    (_state: WorkItemStatus, next: WorkItemStatus) => next
  )

  const handleUpdate = (targetStatus: WorkItemStatus) => {
    startTransition(async () => {
      addOptimisticStatus(targetStatus)
      try {
        await updateWorkItemStatus(workItemId, targetStatus)
        onStatusChange?.(targetStatus)
      } catch {
        // reverter ao status anterior em caso de erro é automático via useOptimistic
      }
    })
  }

  const nextActions = NEXT_ACTIONS[optimisticStatus] ?? []
  const isFinal =
    optimisticStatus === "completed" ||
    optimisticStatus === "cancelled" ||
    optimisticStatus === "no_show"

  return (
    <div className="flex flex-wrap gap-2">
      {nextActions.map((action) => (
        <Button
          key={action.targetStatus}
          size="sm"
          disabled={isPending}
          onClick={() => handleUpdate(action.targetStatus)}
          className={cn(
            action.variant === "default" &&
              "bg-ink text-white rounded-md h-9 px-4 text-sm font-semibold hover:bg-ink/90 border-0",
            action.variant === "outline" &&
              "border border-border bg-surface text-ink-2 hover:bg-surface-2 rounded-md h-9 px-4 text-sm font-semibold"
          )}
        >
          {action.label}
        </Button>
      ))}

      {!isFinal && (
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => handleUpdate("cancelled")}
          className="bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 rounded-md h-9 px-4 text-sm font-semibold"
        >
          Cancelar
        </Button>
      )}
    </div>
  )
}
