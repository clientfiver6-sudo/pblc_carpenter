"use client"

import { formatCurrency, formatDateTime } from "@/lib/utils"
import { StatusBadge } from "@/components/work-items/StatusBadge"
import type { StaffWithStats } from "@/types/database"
import { DollarSign, Clock, Receipt } from "lucide-react"

interface StaffPaymentsTabProps {
  staff: StaffWithStats
}

export function StaffPaymentsTab({ staff }: StaffPaymentsTabProps) {
  const itemsWithPrice = staff.assigned_items.filter(i => i.price_estimate != null)

  if (itemsWithPrice.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Receipt className="w-8 h-8 text-ink-4" />
        <p className="text-ink-4 text-sm">Nenhum valor em aberto</p>
        <p className="text-ink-4 text-xs">Valores dos serviços atribuídos aparecerão aqui.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Total summary */}
      <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
        <p className="text-xs text-ink-4 mb-0.5">Valor dos Serviços Atribuídos</p>
        <p className="text-2xl font-bold text-ink font-mono">
          {formatCurrency(staff.payments_due_cents)}
        </p>
        <p className="text-xs text-ink-4 mt-0.5">
          {itemsWithPrice.length} serviço{itemsWithPrice.length !== 1 ? "s" : ""} em aberto
        </p>
      </div>

      {/* Item list */}
      <div className="space-y-2">
        {itemsWithPrice.map(item => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface"
          >
            <div className="flex-1 min-w-0">
              <p className="text-ink text-sm font-medium truncate">
                {item.customer?.full_name ?? "Cliente não informado"}
              </p>
              <p className="text-ink-3 text-xs truncate">{item.service?.name ?? item.title}</p>
              {item.scheduled_start && (
                <span className="flex items-center gap-1 text-ink-4 text-xs mt-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  {formatDateTime(item.scheduled_start)}
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="flex items-center gap-1 text-ink font-semibold text-sm font-mono">
                <DollarSign className="w-3 h-3 text-ink-3" />
                {formatCurrency(item.price_estimate!)}
              </span>
              <StatusBadge status={item.status} size="sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
