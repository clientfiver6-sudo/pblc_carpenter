import Link from "next/link"
import { redirect } from "next/navigation"
import { WorkItemList } from "@/components/work-items/WorkItemList"
import { ExportButton } from "@/components/customers/ExportButton"
import { NewWorkItemButton } from "@/components/work-items/NewWorkItemButton"
import { createClient } from "@/lib/supabase/server"
import { getBusinessConfig } from "@/lib/config/business-types"
import { spToday, spToISO, spDayRange } from "@/lib/utils/brazil-time"
import { getEffectiveStatus } from "@/lib/work-items/effective-status"
import type { WorkItemWithRelations, BusinessType, WorkItemStatus, BusinessUser, Business, Customer, Service, Staff } from "@/types/database"

// ─── Date filter helpers (all in São Paulo timezone, UTC-3) ──────────────────

function getDateRange(filter: string): { from: string; to: string } | null {
  if (filter === "today") {
    const { start, end } = spDayRange(spToday())
    return { from: start, to: end }
  }

  if (filter === "week") {
    const todayStr = spToday()
    // Parse as SP midnight to get correct day-of-week
    const todaySP = new Date(`${todayStr}T00:00:00-03:00`)
    const dow = todaySP.getDay() // 0 = Sunday
    const weekStart = new Date(todaySP.getTime() - dow * 86_400_000)
    const weekEnd   = new Date(weekStart.getTime() + 6 * 86_400_000)
    const startStr = weekStart.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    const endStr   = weekEnd.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    return { from: spToISO(startStr, "00:00"), to: spToISO(endStr, "23:59") }
  }

  if (filter === "month") {
    const todayStr = spToday()
    const [year, month] = todayStr.split("-").map(Number)
    const startStr = `${year}-${String(month).padStart(2, "0")}-01`
    const lastDay  = new Date(year, month, 0).getDate()
    const endStr   = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    return { from: spToISO(startStr, "00:00"), to: spToISO(endStr, "23:59") }
  }

  return null
}

// ─── Stats helper ─────────────────────────────────────────────────────────────

function computeStats(items: WorkItemWithRelations[]) {
  const now = new Date()
  const enriched = items.map((i) => ({ ...i, status: getEffectiveStatus(i, now) }))

  const active = enriched.filter((i) =>
    (["new", "scheduled", "pending_confirmation", "confirmed"] as WorkItemStatus[]).includes(i.status)
  ).length
  const inProgress = enriched.filter((i) =>
    (["in_progress", "waiting_customer", "waiting_parts"] as WorkItemStatus[]).includes(i.status)
  ).length
  const completed = enriched.filter((i) => i.status === "completed").length
  const revenue = enriched
    .filter((i) => i.status === "completed" && i.final_price != null)
    .reduce((sum, i) => sum + (i.final_price ?? 0), 0)
  const unassigned = enriched.filter(
    (i) =>
      !i.assigned_staff_id &&
      !(["completed", "cancelled", "no_show"] as WorkItemStatus[]).includes(i.status)
  ).length

  return { active, inProgress, completed, revenue, unassigned }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string | number
  mono?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3 shadow-1">
      <p className="text-ink-3 text-xs mb-1">{label}</p>
      <p
        className={`text-ink text-xl font-semibold ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface SearchParams {
  date?: string
  new?: string
}

export default async function WorkItemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const params = await searchParams

  // Auth + business
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: rawBusinessUser } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const businessUser = rawBusinessUser as BusinessUser | null

  if (!businessUser) return redirect("/onboarding")

  const businessId = businessUser.business_id

  const { data: rawBusiness } = await supabase
    .from("businesses")
    .select("id, name, type")
    .eq("id", businessId)
    .single()
  const business = rawBusiness as Pick<Business, "id" | "name" | "type"> | null

  if (!business) return redirect("/onboarding")

  const businessType = business.type as BusinessType
  const config = getBusinessConfig(businessType)

  // Build work items query
  let query = supabase
    .from("work_items")
    .select(
      `
      *,
      customer:customers(id, full_name, phone_number, email),
      service:services(id, name, price, duration_minutes),
      assigned_staff:staff(id, name, role, color)
      `
    )
    .eq("business_id", businessId)
    .order("scheduled_start", { ascending: true })

  const dateFilter = params.date ?? "all"
  const openNew = !!params.new
  const range = getDateRange(dateFilter)
  if (range) {
    query = query
      .gte("scheduled_start", range.from)
      .lte("scheduled_start", range.to)
  }

  // Fetch data for the "new chamado" dialog alongside work items
  const [{ data: workItems, error }, { data: customers }, { data: services }, { data: staffList }] =
    await Promise.all([
      query,
      supabase
        .from("customers")
        .select("id, full_name, phone_number, email, address, city, notes, tags, status, lead_status, total_spent, visit_count, last_visit_at, metadata, created_at, updated_at, business_id")
        .eq("business_id", businessId)
        .eq("status", "active")
        .order("full_name"),
      supabase
        .from("services")
        .select("id, name, description, duration_minutes, price, price_max, category, active, created_at, business_id")
        .eq("business_id", businessId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("staff")
        .select("id, name, role, phone, email, working_hours, services, color, active, created_at, business_id")
        .eq("business_id", businessId)
        .eq("active", true)
        .order("name"),
    ])

  const items = (workItems as WorkItemWithRelations[] | null) ?? []
  const stats = computeStats(items)

  const formatRevenue = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
      cents / 100
    )

  const DATE_FILTER_LABELS: Record<string, string> = {
    all: "Todos",
    today: "Hoje",
    week: "Esta Semana",
    month: "Este Mês",
  }

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight">
            {config.workItemLabel}
          </h2>
          <p className="text-sm text-ink-3 mt-0.5">Gerencie e acompanhe {config.workItemLabel.toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            endpoint="/api/export/work-items"
            label="Exportar CSV"
          />
          <NewWorkItemButton
            customers={(customers ?? []) as Customer[]}
            services={(services ?? []) as Service[]}
            staff={(staffList ?? []) as Staff[]}
            label={config.workItemSingular}
            initialOpen={openNew}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Ativos" value={stats.active} />
        <StatCard label="Em Andamento" value={stats.inProgress} />
        <StatCard label="Concluídos" value={stats.completed} />
        <StatCard label="Receita" value={formatRevenue(stats.revenue)} mono />
        <StatCard label="Sem Responsável" value={stats.unassigned} />
      </div>

      {/* Date filter */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "today", "week", "month"] as const).map((f) => (
          <Link key={f} href={`/dashboard/work-items?date=${f}`}>
            <button
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                dateFilter === f
                  ? "bg-ink border-ink text-white"
                  : "border-border text-ink-3 hover:text-ink-2 bg-surface"
              }`}
            >
              {DATE_FILTER_LABELS[f]}
            </button>
          </Link>
        ))}
      </div>

      {/* List */}
      <WorkItemList
        items={items}
        businessType={businessType}
        businessId={businessId}
      />

      {error && (
        <p className="text-danger text-sm text-center">
          Erro ao carregar os dados. Tente recarregar a página.
        </p>
      )}
    </div>
  )
}
