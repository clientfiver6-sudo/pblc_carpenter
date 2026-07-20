"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { WorkItemStatus } from "@/types/database"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { useState, useEffect, useCallback } from "react"

interface ScheduleWorkItem {
  id: string
  title: string
  scheduled_start: string | null
  scheduled_end: string | null
  status: WorkItemStatus
  customer_name: string | null
  service_name: string | null
}

const STATUS_LABELS: Record<WorkItemStatus, string> = {
  new: "Novo",
  scheduled: "Agendado",
  pending_confirmation: "Aguardando",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  waiting_customer: "Aguardando cliente",
  waiting_parts: "Aguardando peças",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
}

const STATUS_COLORS: Record<WorkItemStatus, string> = {
  new: "border-info/40 text-info bg-info/10",
  scheduled: "border-brand/40 text-brand bg-tint",
  pending_confirmation: "border-warning/40 text-warning bg-warning/10",
  confirmed: "border-brand/40 text-brand bg-tint",
  in_progress: "border-brand/40 text-brand-2 bg-tint",
  waiting_customer: "border-warning/40 text-warning bg-warning/10",
  waiting_parts: "border-warning/40 text-warning bg-warning/10",
  completed: "border-ink-4/40 text-ink-3 bg-surface-2",
  cancelled: "border-danger/40 text-danger bg-danger/10",
  no_show: "border-danger/40 text-danger bg-danger/10",
}

const WEEK_DAYS = [
  { key: 0, label: "Dom" },
  { key: 1, label: "Seg" },
  { key: 2, label: "Ter" },
  { key: 3, label: "Qua" },
  { key: 4, label: "Qui" },
  { key: 5, label: "Sex" },
  { key: 6, label: "Sáb" },
]

function getWeekBounds(offset: number): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay() // 0 = Sunday
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1 + offset * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function formatWeekLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }
  const s = start.toLocaleDateString("pt-BR", opts)
  const e = end.toLocaleDateString("pt-BR", opts)
  return `${s} – ${e}`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface StaffScheduleProps {
  staffId: string
}

export function StaffSchedule({ staffId }: StaffScheduleProps) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [items, setItems] = useState<ScheduleWorkItem[]>([])
  const [loading, setLoading] = useState(true)

  const { start, end } = getWeekBounds(weekOffset)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        staffId,
        start: start.toISOString(),
        end: end.toISOString(),
      })
      const res = await fetch(`/api/staff/schedule?${params.toString()}`)
      if (res.ok) {
        const data = (await res.json()) as ScheduleWorkItem[]
        setItems(data)
      }
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false)
    }
  }, [staffId, start, end])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  // Group items by day-of-week
  const grouped = WEEK_DAYS.map(({ key, label }) => {
    const dayItems = items.filter((item) => {
      if (!item.scheduled_start) return false
      return new Date(item.scheduled_start).getDay() === key
    })
    const dateForDay = new Date(start)
    dateForDay.setDate(start.getDate() + (key === 0 ? 6 : key - 1))
    return { key, label, date: dateForDay, items: dayItems }
  })

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink-3">
          <Calendar className="h-4 w-4" />
          <span className="text-sm font-mono">{formatWeekLabel(start, end)}</span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-border text-ink-3 hover:text-ink hover:bg-surface-2"
            onClick={() => setWeekOffset((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-ink-3 hover:text-ink"
              onClick={() => setWeekOffset(0)}
            >
              Hoje
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 border-border text-ink-3 hover:text-ink hover:bg-surface-2"
            onClick={() => setWeekOffset((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-3">
        {grouped.map(({ key, label, date, items: dayItems }) => {
          const isToday =
            date.toDateString() === new Date().toDateString()

          return (
            <div key={key}>
              {/* Day header */}
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={cn(
                    "text-xs font-semibold uppercase tracking-wider",
                    isToday ? "text-brand" : "text-ink-2"
                  )}
                >
                  {label}
                </span>
                <span className="text-xs text-ink-3 font-mono">
                  {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </span>
                {isToday && (
                  <span className="text-xs bg-tint text-brand border border-brand/20 rounded px-1.5 py-0.5">
                    Hoje
                  </span>
                )}
              </div>

              {loading ? (
                <div className="h-10 rounded-lg bg-surface-2 animate-pulse" />
              ) : dayItems.length === 0 ? (
                <p className="text-xs text-ink-4 pl-1 py-1">
                  Nenhum agendamento
                </p>
              ) : (
                <div className="space-y-1.5">
                  {dayItems
                    .sort((a, b) =>
                      (a.scheduled_start ?? "").localeCompare(b.scheduled_start ?? "")
                    )
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                      >
                        <span className="font-mono text-sm font-bold text-ink w-12 shrink-0">
                          {item.scheduled_start
                            ? formatTime(item.scheduled_start)
                            : "—"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">
                            {item.customer_name ?? item.title}
                          </p>
                          {item.service_name && (
                            <p className="text-xs text-ink-3 truncate">
                              {item.service_name}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs shrink-0",
                            STATUS_COLORS[item.status]
                          )}
                        >
                          {STATUS_LABELS[item.status]}
                        </Badge>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
