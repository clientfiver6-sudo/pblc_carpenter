"use client"

import { useEffect, useState, useTransition } from "react"
import { useParams, useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { StaffForm } from "@/components/staff/StaffForm"
import type { StaffFormData } from "@/components/staff/StaffForm"
import { StaffSchedule } from "@/components/staff/StaffSchedule"
import { updateStaff, toggleStaffActive } from "@/lib/staff/actions"
import { cn, getInitials, formatPhone } from "@/lib/utils"
import type { Staff } from "@/types/database"
import { ArrowLeft, Edit, Phone, Clock } from "lucide-react"

const SUGGESTED_ROLES = [
  "Cabeleireiro(a)",
  "Manicure",
  "Esteticista",
  "Recepcionista",
  "Gerente",
  "Técnico",
  "Médico(a)",
  "Dentista",
  "Veterinário(a)",
]

const WEEKDAY_LABELS: Record<string, string> = {
  mon: "Segunda-feira",
  tue: "Terça-feira",
  wed: "Quarta-feira",
  thu: "Quinta-feira",
  fri: "Sexta-feira",
  sat: "Sábado",
  sun: "Domingo",
}

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

interface DayHours {
  open?: boolean
  start?: string
  end?: string
}

function parseWorkingHours(raw: unknown): Record<string, DayHours> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as Record<string, DayHours>
}

export default function StaffProfilePage() {
  const params = useParams()
  const router = useRouter()
  const staffId = params.id as string

  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [, startTransition] = useTransition()

  useEffect(() => {
    fetch(`/api/staff/${staffId}`)
      .then((r) => r.json())
      .then((data: Staff) => setStaff(data))
      .catch(() => setStaff(null))
      .finally(() => setLoading(false))
  }, [staffId])

  const handleUpdate = async (data: StaffFormData) => {
    if (!staff) return
    await updateStaff(staff.id, data)
    setStaff((prev) => (prev ? { ...prev, ...data } : prev))
    setEditOpen(false)
  }

  const handleToggleActive = () => {
    if (!staff) return
    startTransition(async () => {
      await toggleStaffActive(staff.id, !staff.active)
      setStaff((prev) => (prev ? { ...prev, active: !prev.active } : prev))
    })
  }

  if (loading) {
    return (
      <div className="max-w-[860px] mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-5">
        <Skeleton className="h-8 w-40 bg-surface-2" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-xl bg-surface-2" />
          </div>
          <div className="lg:col-span-2">
            <Skeleton className="h-96 rounded-xl bg-surface-2" />
          </div>
        </div>
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-ink-3">Colaborador não encontrado</p>
          <Button
            variant="ghost"
            className="mt-3 text-ink-3 hover:text-ink"
            onClick={() => router.push("/staff")}
          >
            Voltar para equipe
          </Button>
        </div>
      </div>
    )
  }

  const workingHours = parseWorkingHours(staff.working_hours)
  const openDays = WEEKDAY_ORDER.filter((d) => workingHours[d]?.open === true)

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-5">
      {/* Header / Back */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-ink-3 hover:text-ink hover:bg-surface-2"
          onClick={() => router.push("/staff")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight">{staff.name}</h2>
          {staff.role && (
            <p className="text-sm text-ink-3">{staff.role}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "flex items-center gap-1.5 text-sm",
              staff.active ? "text-brand" : "text-ink-3"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                staff.active ? "bg-brand" : "bg-ink-4"
              )}
            />
            {staff.active ? "Ativo" : "Inativo"}
          </span>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT: Profile card */}
        <div className="space-y-4">
          <Card className="bg-surface border border-border shadow-1">
            <CardContent className="p-6">
              {/* Avatar */}
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback
                      className="font-bold text-2xl bg-tint text-brand-2"
                    >
                      {getInitials(staff.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-surface",
                      staff.active ? "bg-brand" : "bg-ink-4"
                    )}
                  />
                </div>
                <h2 className="mt-3 font-semibold text-ink text-lg">
                  {staff.name}
                </h2>
                {staff.role && (
                  <Badge
                    variant="outline"
                    className="mt-1 border-border text-ink-3 text-xs"
                  >
                    {staff.role}
                  </Badge>
                )}
              </div>

              <Separator className="my-4 bg-border" />

              {/* Info */}
              <div className="space-y-3">
                {staff.phone && (
                  <div className="flex items-center gap-2 text-ink-3">
                    <Phone className="h-4 w-4 shrink-0" />
                    <span className="font-mono text-sm">{formatPhone(staff.phone)}</span>
                  </div>
                )}

                {openDays.length > 0 && (
                  <div className="flex items-start gap-2 text-ink-3">
                    <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      {openDays.map((d) => (
                        <p key={d} className="font-mono text-xs">
                          <span className="text-ink">
                            {WEEKDAY_LABELS[d]}:
                          </span>{" "}
                          {workingHours[d]?.start ?? "?"} –{" "}
                          {workingHours[d]?.end ?? "?"}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-4 bg-border" />

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  className="w-full gap-2"
                  style={{ background: "var(--brand-grad)" }}
                  onClick={() => setEditOpen(true)}
                >
                  <Edit className="h-4 w-4" />
                  <span className="text-white font-semibold">Editar perfil</span>
                </Button>

                <Button
                  variant="outline"
                  className={cn(
                    "w-full text-xs border",
                    staff.active
                      ? "border-border text-ink-3 hover:text-danger hover:border-danger/40 hover:bg-danger/5"
                      : "border-brand/30 text-brand hover:bg-tint"
                  )}
                  onClick={handleToggleActive}
                >
                  {staff.active ? "Desativar colaborador" : "Ativar colaborador"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Schedule */}
        <div className="lg:col-span-2">
          <Card className="bg-surface border border-border shadow-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-ink text-base font-semibold">
                Agenda da semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StaffSchedule staffId={staffId} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-surface border-border text-ink max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-ink">
              Editar colaborador
            </DialogTitle>
          </DialogHeader>
          <StaffForm
            staff={staff}
            onSubmit={handleUpdate}
            onCancel={() => setEditOpen(false)}
            suggestedRoles={SUGGESTED_ROLES}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
