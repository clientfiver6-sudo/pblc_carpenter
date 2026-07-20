import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import Link from "next/link"
import { WorkItemEntryTabs } from "@/components/work-items/WorkItemEntryTabs"
import type { WorkItemFormData } from "@/components/work-items/WorkItemForm"
import { createClient } from "@/lib/supabase/server"
import { getBusinessConfig } from "@/lib/config/business-types"
import type { BusinessType, BusinessUser, Business } from "@/types/database"
import { ChevronLeft } from "lucide-react"

// ─── Server Action ────────────────────────────────────────────────────────────

async function createWorkItem(
  businessId: string,
  data: WorkItemFormData
): Promise<void> {
  "use server"

  const supabase = await createClient()

  // Combine date + time into a single ISO timestamp.
  // Always treat the input as São Paulo time (UTC-3, no DST in Brazil since 2019)
  // so "10:00" entered by the user is stored as 13:00 UTC and displayed as 10:00 SP.
  let scheduledStart: string | null = null
  let scheduledEnd: string | null = null

  if (data.scheduled_date) {
    const dateStr = typeof data.scheduled_date === "string"
      ? data.scheduled_date
      : data.scheduled_date.toISOString().slice(0, 10)
    const time = data.scheduled_time ?? "00:00"
    scheduledStart = new Date(`${dateStr}T${time}:00-03:00`).toISOString()

    // Derive end time from service duration if service is selected
    if (data.service_id) {
      const { data: svc } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("id", data.service_id)
        .single()
      const durationMs = ((svc as { duration_minutes: number } | null)?.duration_minutes ?? 120) * 60_000
      scheduledEnd = new Date(new Date(scheduledStart).getTime() + durationMs).toISOString()
    }
  }

  const initialStatus = scheduledStart ? "scheduled" : "new"

  const { error } = await supabase.from("work_items").insert({
    business_id: businessId,
    customer_id: data.customer_id ?? null,
    service_id: data.service_id ?? null,
    assigned_staff_id: data.assigned_staff_id ?? null,
    type: data.type,
    title: data.title,
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    address: data.address ?? null,
    price_estimate:
      data.price_estimate != null
        ? Math.round(data.price_estimate * 100)
        : null,
    notes: data.notes ?? null,
    status: initialStatus,
    payment_status: "unpaid" as const,
    metadata: {
      status_history: [
        { status: initialStatus, changed_at: new Date().toISOString() },
      ],
    },
  } as never)

  if (error) {
    throw new Error("Erro ao criar o item. Tente novamente.")
  }

  // Fire booking_created automation (best-effort)
  try {
    const { data: created } = await supabase
      .from("work_items")
      .select("id")
      .eq("business_id", businessId)
      .eq("title", data.title)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
    if (created) {
      const { triggerBookingCreated } = await import("@/lib/automations/triggers")
      triggerBookingCreated((created as { id: string }).id, businessId).catch(() => {})
    }
  } catch { /* non-fatal */ }

  revalidatePath("/dashboard/work-items")
  revalidatePath("/dashboard/calendar")
  const calendarDate = scheduledStart ? `?date=${scheduledStart.slice(0, 10)}` : ""
  redirect(`/dashboard/calendar${calendarDate}`)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function NewWorkItemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()

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
    .select("id, name, type, opening_hours")
    .eq("id", businessId)
    .single()
  const business = rawBusiness as Pick<Business, "id" | "name" | "type"> & { opening_hours?: Record<string, unknown> } | null

  if (!business) return redirect("/onboarding")

  const businessType = business.type as BusinessType
  const config = getBusinessConfig(businessType)

  // Fetch selects data
  const [{ data: customers }, { data: services }, { data: staff }] =
    await Promise.all([
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

  const boundCreateWorkItem = createWorkItem.bind(null, businessId)

  // Pre-fill date/time/type from query params
  const resolvedParams = await searchParams
  const dateParam = typeof resolvedParams.date === "string" ? resolvedParams.date : undefined
  const timeParam = typeof resolvedParams.time === "string" ? resolvedParams.time : undefined
  const typeParam = typeof resolvedParams.type === "string" ? resolvedParams.type : undefined

  const prefilledDate = dateParam ? new Date(`${dateParam}T12:00:00`) : undefined
  const prefilledTime = timeParam ?? undefined

  const VALID_TYPES = ["appointment", "job", "repair", "quote", "order", "consultation", "service_call"] as const
  type WorkItemType = typeof VALID_TYPES[number]
  const prefilledType: WorkItemType | undefined = VALID_TYPES.includes(typeParam as WorkItemType)
    ? (typeParam as WorkItemType)
    : undefined

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28">
      {/* Back link */}
      <Link
        href="/dashboard/work-items"
        className="text-sm text-ink-3 hover:text-ink flex items-center gap-1 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        {config.workItemLabel}
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-ink tracking-tight">
          Novo {config.workItemSingular}
        </h2>
        <p className="text-sm text-ink-3 mt-0.5">
          Preencha os dados para criar um novo {config.workItemSingular.toLowerCase()}.
        </p>
      </div>

      {/* Form card */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-1 max-w-2xl">
        <WorkItemEntryTabs
          onSubmit={boundCreateWorkItem}
          customers={customers ?? []}
          services={services ?? []}
          staff={staff ?? []}
          openingHours={business.opening_hours}
          defaultValues={{
            ...(prefilledDate ? { scheduled_date: prefilledDate } : {}),
            ...(prefilledTime ? { scheduled_time: prefilledTime } : {}),
            ...(prefilledType ? { type: prefilledType } : {}),
          }}
        />
      </div>
    </div>
  )
}
