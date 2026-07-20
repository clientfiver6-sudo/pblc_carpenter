"use client"

import { useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn, getInitials } from "@/lib/utils"
import type { Staff } from "@/types/database"
import { Edit, Phone, Banknote } from "lucide-react"

interface WorkingHourDay {
  open?: boolean
  start?: string
  end?: string
}

type WorkingHours = Record<string, WorkingHourDay>

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
const DAY_LABELS_SHORT: Record<string, string> = {
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sáb: "Sáb",
  sat: "Sáb",
  dom: "Dom",
  sun: "Dom",
}

function parseWorkingHours(raw: unknown): WorkingHours {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as WorkingHours
}

function getWorkingSummary(raw: unknown): string {
  const hours = parseWorkingHours(raw)
  const openDays = DAY_ORDER.filter((d) => hours[d]?.open === true)
  if (openDays.length === 0) return "Sem horário definido"

  // Try to detect a contiguous range
  const first = openDays[0]
  const last = openDays[openDays.length - 1]
  const firstLabel = DAY_LABELS_SHORT[first] ?? first
  const lastLabel = DAY_LABELS_SHORT[last] ?? last

  const start = hours[first]?.start ?? "—"
  const end = hours[first]?.end ?? "—"

  if (openDays.length === 1) {
    return `${firstLabel}, ${start}–${end}`
  }

  return `${firstLabel}–${lastLabel}, ${start}–${end}`
}

interface StaffCardProps {
  staff: Staff
  onEdit?: () => void
  onToggle?: () => void
}

export function StaffCard({ staff, onEdit, onToggle }: StaffCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const initials = getInitials(staff.name)
  const workingSummary = getWorkingSummary(staff.working_hours)

  return (
    <Card className="bg-surface border border-border hover:shadow-2 hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 ease-brand-out">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Avatar + Status dot */}
          <div className="relative shrink-0 mt-4">
            <Avatar className="h-10 w-10">
              <AvatarFallback
                className="font-semibold text-sm"
                style={{ backgroundColor: staff.color }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface",
                staff.active ? "bg-brand" : "bg-ink-4"
              )}
            />
          </div>

          {/* Edit button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-ink-3 hover:text-ink hover:bg-surface-2"
            onClick={onEdit}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>

        {/* Name + Role */}
        <div className="mt-3 space-y-1.5">
          <h3 className="font-bold text-sm text-ink leading-tight">
            {staff.name}
          </h3>
          {staff.role && (
            <Badge
              variant="outline"
              className="border-border text-ink-3 text-xs font-normal"
            >
              {staff.role}
            </Badge>
          )}
        </div>

        {/* Phone */}
        {staff.phone && (
          <div className="mt-3 flex items-center gap-1.5 text-ink-4">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="font-mono text-xs">{staff.phone}</span>
          </div>
        )}

        {/* Compensation */}
        {(staff.monthly_salary_cents || staff.commission_rate) && (
          <div className="mt-2 flex items-center gap-1.5 text-ink-3">
            <Banknote className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">
              {staff.compensation_type === "commission" && staff.commission_rate
                ? `${staff.commission_rate}% comissão`
                : staff.monthly_salary_cents
                ? `R$ ${(staff.monthly_salary_cents / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`
                : null}
            </span>
            {staff.payment_reminder && staff.payment_day && (
              <span className="text-xs text-brand/70">· dia {staff.payment_day}</span>
            )}
          </div>
        )}

        {/* Working hours summary */}
        <div className="mt-2 flex items-center gap-1.5 text-ink-3">
          <svg
            className="h-3.5 w-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="font-mono text-xs">{workingSummary}</span>
        </div>

        {/* Toggle active */}
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "mt-4 w-full text-xs border",
            staff.active
              ? "border-border text-ink-3 hover:text-danger hover:border-danger/40 hover:bg-danger/5"
              : "border-brand/30 text-brand hover:bg-tint"
          )}
          onClick={() => staff.active ? setConfirmOpen(true) : onToggle?.()}
        >
          {staff.active ? "Desativar" : "Ativar"}
        </Button>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="bg-surface border-border text-ink">
            <DialogHeader>
              <DialogTitle className="text-ink">Desativar colaborador?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-ink-3 py-2">
              <span className="font-semibold text-ink">{staff.name}</span> não aparecerá mais para novos agendamentos. Você pode reativar a qualquer momento.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} className="border-border text-ink-2">
                Cancelar
              </Button>
              <Button
                className="bg-danger text-white font-semibold hover:bg-danger/90"
                onClick={() => { setConfirmOpen(false); onToggle?.() }}
              >
                Desativar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
