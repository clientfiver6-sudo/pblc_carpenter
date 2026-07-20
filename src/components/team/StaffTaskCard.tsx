"use client"

import { cn, formatCurrency } from "@/lib/utils"
import type { StaffWithStats } from "@/types/database"
import { CheckCircle2, Circle, MessageCircle } from "lucide-react"

interface StaffTaskCardProps {
  staff: StaffWithStats
  selected: boolean
  onClick: () => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase()
}

export function StaffTaskCard({ staff, selected, onClick }: StaffTaskCardProps) {
  const openCount = staff.assigned_items.length
  const hasUnread = staff.unread_messages > 0

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-[border-color,background-color,box-shadow,transform] duration-150 ease-brand-out",
        selected
          ? "border-brand/40 bg-tint shadow-1"
          : "border-border bg-surface hover:shadow-1 hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ background: staff.color }}
        >
          {getInitials(staff.name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-ink font-semibold text-sm truncate">{staff.name}</span>
            {hasUnread && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-brand bg-tint px-1.5 py-0.5 rounded-full border border-brand/20 shrink-0">
                <MessageCircle className="w-2.5 h-2.5" />
                {staff.unread_messages}
              </span>
            )}
          </div>
          {staff.role && (
            <p className="text-ink-4 text-xs mt-0.5 truncate">{staff.role}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-border bg-surface-2 text-ink-3">
          <Circle className="w-3 h-3 shrink-0" />
          {openCount} em aberto
        </span>
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-border bg-surface-2 text-ink-3">
          <CheckCircle2 className="w-3 h-3 shrink-0 text-success" />
          {staff.completed_count} concluídas
        </span>
        {staff.payments_due_cents > 0 && (
          <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-warning/30 bg-warning/10 text-warning font-mono">
            {formatCurrency(staff.payments_due_cents)}
          </span>
        )}
      </div>
    </button>
  )
}
