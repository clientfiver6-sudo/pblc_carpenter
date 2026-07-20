"use client"

import { useEffect, useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StaffCard } from "@/components/staff/StaffCard"
import { StaffForm } from "@/components/staff/StaffForm"
import type { StaffFormData } from "@/components/staff/StaffForm"
import { ServiceCard } from "@/components/services/ServiceCard"
import { ServiceForm } from "@/components/services/ServiceForm"
import type { ServiceFormData } from "@/components/services/ServiceForm"
import {
  createStaff,
  updateStaff,
  toggleStaffActive,
} from "@/lib/staff/actions"
import {
  createService,
  updateService,
  deleteService,
} from "@/lib/services/actions"
import type { Staff, Service } from "@/types/database"
import { Plus, Users, Briefcase } from "lucide-react"

// Hardcoded suggested roles — in production these come from business config
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

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: number
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-5 py-4">
      <p className="text-xs text-ink-3 uppercase tracking-wider">{label}</p>
      <p className="mt-1 font-mono text-3xl font-semibold text-ink">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-ink-3">{sub}</p>}
    </div>
  )
}

function StaffSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-surface p-5 space-y-3"
        >
          <Skeleton className="h-14 w-14 rounded-full bg-surface-2" />
          <Skeleton className="h-4 w-3/4 bg-surface-2" />
          <Skeleton className="h-3 w-1/2 bg-surface-2" />
          <Skeleton className="h-8 w-full bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

function ServiceSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-surface p-5 space-y-3"
        >
          <Skeleton className="h-4 w-2/3 bg-surface-2" />
          <Skeleton className="h-3 w-1/2 bg-surface-2" />
          <Skeleton className="h-3 w-1/3 bg-surface-2" />
          <Skeleton className="h-8 w-full bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

export default function StaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [serviceList, setServiceList] = useState<Service[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [loadingServices, setLoadingServices] = useState(true)

  const [businessType, setBusinessType] = useState("")
  const [businessName, setBusinessName] = useState("")

  const [addStaffOpen, setAddStaffOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [addServiceOpen, setAddServiceOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)

  const [, startTransition] = useTransition()

  // Fetch business info for AI context
  useEffect(() => {
    async function loadBusiness() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: rawBu } = await supabase
        .from("business_users")
        .select("business_id")
        .eq("user_id", user.id)
        .single()
      const bu = rawBu as { business_id: string } | null
      if (!bu?.business_id) return
      const { data: rawBiz } = await supabase
        .from("businesses")
        .select("type, name")
        .eq("id", bu.business_id)
        .single()
      const biz = rawBiz as { type: string; name: string } | null
      if (biz) {
        setBusinessType(biz.type ?? "")
        setBusinessName(biz.name ?? "")
      }
    }
    loadBusiness()
  }, [])

  // Fetch staff
  useEffect(() => {
    fetch("/api/staff")
      .then((r) => r.json())
      .then((data: { staff: Staff[] }) => setStaffList(data.staff ?? []))
      .catch(() => setStaffList([]))
      .finally(() => setLoadingStaff(false))
  }, [])

  // Fetch services
  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data: { services: Service[] }) => setServiceList(data.services ?? []))
      .catch(() => setServiceList([]))
      .finally(() => setLoadingServices(false))
  }, [])

  // Staff handlers
  const handleCreateStaff = async (data: StaffFormData) => {
    const newStaff = await createStaff(data)
    setStaffList((prev) => [newStaff, ...prev])
    setAddStaffOpen(false)
  }

  const handleUpdateStaff = async (data: StaffFormData) => {
    if (!editingStaff) return
    await updateStaff(editingStaff.id, data)
    setStaffList((prev) =>
      prev.map((s) =>
        s.id === editingStaff.id ? { ...s, ...data } : s
      )
    )
    setEditingStaff(null)
  }

  const handleToggleStaff = (staff: Staff) => {
    startTransition(async () => {
      await toggleStaffActive(staff.id, !staff.active)
      setStaffList((prev) =>
        prev.map((s) =>
          s.id === staff.id ? { ...s, active: !staff.active } : s
        )
      )
    })
  }

  // Service handlers
  const handleCreateService = async (data: ServiceFormData) => {
    const newService = await createService(data)
    setServiceList((prev) => [newService, ...prev])
    setAddServiceOpen(false)
  }

  const handleUpdateService = async (data: ServiceFormData) => {
    if (!editingService) return
    await updateService(editingService.id, data)
    setServiceList((prev) =>
      prev.map((s) =>
        s.id === editingService.id ? { ...s, ...data } : s
      )
    )
    setEditingService(null)
  }

  const handleDeleteService = (service: Service) => {
    startTransition(async () => {
      await deleteService(service.id)
      setServiceList((prev) => prev.filter((s) => s.id !== service.id))
    })
  }

  const activeStaff = staffList.filter((s) => s.active).length
  const activeServices = serviceList.filter((s) => s.active).length

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-ink tracking-tight">
          Equipe &amp; Serviços
        </h2>
        <p className="mt-1 text-sm text-ink-3">
          Gerencie colaboradores, horários e catálogo de serviços
        </p>
      </div>

      <Tabs defaultValue="equipe">
        <TabsList className="bg-surface border border-border p-1">
          <TabsTrigger
            value="equipe"
            className="data-[state=active]:bg-ink data-[state=active]:text-white text-ink-2 hover:bg-surface-2 rounded-md px-4 py-2 text-sm font-semibold"
          >
            <Users className="h-4 w-4 mr-2" />
            Equipe
          </TabsTrigger>
          <TabsTrigger
            value="servicos"
            className="data-[state=active]:bg-ink data-[state=active]:text-white text-ink-2 hover:bg-surface-2 rounded-md px-4 py-2 text-sm"
          >
            <Briefcase className="h-4 w-4 mr-2" />
            Serviços
          </TabsTrigger>
        </TabsList>

        {/* ── EQUIPE TAB ── */}
        <TabsContent value="equipe" className="mt-6 space-y-5">
          {/* Stats + CTA */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex gap-3">
              <StatCard
                label="Total de colaboradores"
                value={staffList.length}
              />
              <StatCard
                label="Ativos"
                value={activeStaff}
                sub={`de ${staffList.length}`}
              />
            </div>

            <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
              <DialogTrigger asChild>
                <Button
                  className="text-white font-semibold gap-2"
                  style={{ background: "var(--brand-grad)" }}
                >
                  <Plus className="h-4 w-4" />
                  Novo Membro
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-surface border-border text-ink max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-ink">
                    Novo colaborador
                  </DialogTitle>
                </DialogHeader>
                <StaffForm
                  onSubmit={handleCreateStaff}
                  onCancel={() => setAddStaffOpen(false)}
                  suggestedRoles={SUGGESTED_ROLES}
                  businessType={businessType}
                  businessName={businessName}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit staff dialog */}
          <Dialog
            open={!!editingStaff}
            onOpenChange={(open) => !open && setEditingStaff(null)}
          >
            <DialogContent className="bg-surface border-border text-ink max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-ink">
                  Editar colaborador
                </DialogTitle>
              </DialogHeader>
              {editingStaff && (
                <StaffForm
                  staff={editingStaff}
                  onSubmit={handleUpdateStaff}
                  onCancel={() => setEditingStaff(null)}
                  suggestedRoles={SUGGESTED_ROLES}
                  businessType={businessType}
                  businessName={businessName}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Grid */}
          {loadingStaff ? (
            <StaffSkeletonGrid />
          ) : staffList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface py-16 text-center">
              <Users className="mx-auto h-8 w-8 text-ink-4" />
              <p className="mt-3 text-ink-3">
                Nenhum colaborador cadastrado
              </p>
              <Button
                className="mt-4 text-white font-semibold gap-2"
                style={{ background: "var(--brand-grad)" }}
                onClick={() => setAddStaffOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Adicionar o primeiro colaborador
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffList.map((staff) => (
                <StaffCard
                  key={staff.id}
                  staff={staff}
                  onEdit={() => setEditingStaff(staff)}
                  onToggle={() => handleToggleStaff(staff)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── SERVIÇOS TAB ── */}
        <TabsContent value="servicos" className="mt-6 space-y-5">
          {/* Stats + CTA */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex gap-3">
              <StatCard
                label="Total de serviços"
                value={serviceList.length}
              />
              <StatCard
                label="Ativos"
                value={activeServices}
                sub={`de ${serviceList.length}`}
              />
            </div>

            <Dialog open={addServiceOpen} onOpenChange={setAddServiceOpen}>
              <DialogTrigger asChild>
                <Button
                  className="text-white font-semibold gap-2"
                  style={{ background: "var(--brand-grad)" }}
                >
                  <Plus className="h-4 w-4" />
                  Novo Serviço
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-surface border-border text-ink max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-ink">
                    Novo serviço
                  </DialogTitle>
                </DialogHeader>
                <ServiceForm
                  onSubmit={handleCreateService}
                  onCancel={() => setAddServiceOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Edit service dialog */}
          <Dialog
            open={!!editingService}
            onOpenChange={(open) => !open && setEditingService(null)}
          >
            <DialogContent className="bg-surface border-border text-ink max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-ink">
                  Editar serviço
                </DialogTitle>
              </DialogHeader>
              {editingService && (
                <ServiceForm
                  service={editingService}
                  onSubmit={handleUpdateService}
                  onCancel={() => setEditingService(null)}
                />
              )}
            </DialogContent>
          </Dialog>

          {/* Grid */}
          {loadingServices ? (
            <ServiceSkeletonGrid />
          ) : serviceList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface py-16 text-center">
              <Briefcase className="mx-auto h-8 w-8 text-ink-4" />
              <p className="mt-3 text-ink-3">
                Nenhum serviço cadastrado
              </p>
              <Button
                className="mt-4 text-white font-semibold gap-2"
                style={{ background: "var(--brand-grad)" }}
                onClick={() => setAddServiceOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Criar primeiro serviço
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {serviceList.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onEdit={() => setEditingService(service)}
                  onDelete={() => handleDeleteService(service)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
