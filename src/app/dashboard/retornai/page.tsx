import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBusinessId } from "@/lib/auth/actions"
import { RetornAIPage } from "@/components/ai/RetornAIPage"

export const dynamic = "force-dynamic"

export type DailyBriefing = {
  todayItems: { id: string; title: string; scheduled_start: string | null; status: string; customer_name: string | null }[]
  pendingPaymentsCount: number
  pendingPaymentsTotal: number
  unreadConversations: number
  totalActiveCustomers: number
}

export default async function RetornAIAssistantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const businessId = await getBusinessId()
  if (!businessId) return redirect("/onboarding")

  const admin = createAdminClient()

  // Fetch onboarded + subscription status
  const { data: bizRaw } = await admin
    .from("businesses")
    .select("onboarded, subscription_status")
    .eq("id", businessId)
    .single()
  const biz = bizRaw as { onboarded: boolean; subscription_status: string | null } | null
  const onboarded = biz?.onboarded ?? false
  const subStatus = biz?.subscription_status ?? "trialing"
  const isActive = subStatus === "active" || subStatus === "trialing"

  // Skip expensive queries for non-onboarded or inactive-subscription businesses
  if (!onboarded || !isActive) {
    const emptyBriefing: DailyBriefing = {
      todayItems: [],
      pendingPaymentsCount: 0,
      pendingPaymentsTotal: 0,
      unreadConversations: 0,
      totalActiveCustomers: 0,
    }
    return <RetornAIPage briefing={emptyBriefing} onboarded={onboarded} isActive={isActive} />
  }

  // Today's date range (UTC-based; close enough for a briefing)
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const [itemsRes, paymentsRes, convsRes, customersRes, servicesRes, staffRes] = await Promise.all([
    // Work items scheduled today (not cancelled/done)
    admin
      .from("work_items")
      .select("id,title,scheduled_start,status,customers(full_name)")
      .eq("business_id", businessId)
      .gte("scheduled_start", todayStart.toISOString())
      .lte("scheduled_start", todayEnd.toISOString())
      .not("status", "in", '("cancelled","completed")')
      .order("scheduled_start", { ascending: true })
      .limit(5),

    // Pending payments
    admin
      .from("payments")
      .select("id,amount")
      .eq("business_id", businessId)
      .eq("status", "pending"),

    // Unread conversations
    admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gt("unread_count", 0),

    // Total active customers
    admin
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),

    // Services for dropdowns
    admin
      .from("services")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name"),

    // Staff for dropdowns
    admin
      .from("staff")
      .select("id, name")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name"),
  ])

  const todayItems = ((itemsRes.data ?? []) as unknown as {
    id: string; title: string; scheduled_start: string | null; status: string;
    customers: { full_name: string } | null
  }[]).map(i => ({
    id: i.id,
    title: i.title,
    scheduled_start: i.scheduled_start,
    status: i.status,
    customer_name: i.customers?.full_name ?? null,
  }))

  const pendingPayments = (paymentsRes.data ?? []) as { id: string; amount: number }[]
  const pendingPaymentsTotal = pendingPayments.reduce((s, p) => s + p.amount, 0)

  const briefing: DailyBriefing = {
    todayItems,
    pendingPaymentsCount: pendingPayments.length,
    pendingPaymentsTotal,
    unreadConversations: convsRes.count ?? 0,
    totalActiveCustomers: customersRes.count ?? 0,
  }

  const services = ((servicesRes.data ?? []) as { id: string; name: string }[])
  const staffList = ((staffRes.data ?? []) as { id: string; name: string }[])

  return <RetornAIPage briefing={briefing} onboarded={true} isActive={true} services={services} staff={staffList} />
}
