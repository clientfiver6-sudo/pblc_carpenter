"use client"

import { Badge } from "@/components/ui/badge"
import type { WorkItemStatus } from "@/types/database"

interface StatusBadgeProps {
  status: WorkItemStatus
  size?: "sm" | "md"
}

const STATUS_VARIANT: Record<
  WorkItemStatus,
  { label: string; variant: "secondary" | "amber" | "info" | "warm" | "moss" | "destructive" }
> = {
  new: { label: "Novo", variant: "secondary" },
  scheduled: { label: "Agendado", variant: "info" },
  pending_confirmation: { label: "Aguardando", variant: "amber" },
  confirmed: { label: "Confirmado", variant: "info" },
  in_progress: { label: "Em Andamento", variant: "warm" },
  waiting_customer: { label: "Aguardando Cliente", variant: "amber" },
  waiting_parts: { label: "Aguardando Peças", variant: "amber" },
  completed: { label: "Concluído", variant: "moss" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  no_show: { label: "Não Compareceu", variant: "destructive" },
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = STATUS_VARIANT[status] ?? STATUS_VARIANT.new

  return (
    <Badge
      variant={config.variant}
      className={
        size === "sm"
          ? "text-xs px-2 py-0.5 font-medium rounded-full select-none"
          : "text-xs px-2.5 py-1 font-medium rounded-full select-none"
      }
    >
      {config.label}
    </Badge>
  )
}
