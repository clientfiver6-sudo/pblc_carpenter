import { createClient } from "@/lib/supabase/server"
import { RevenueChart } from "./RevenueChart"
import type { Payment } from "@/types/database"

export async function RevenueChartServer({ businessId }: { businessId: string }) {
  const supabase = await createClient()
  const d = new Date()
  d.setDate(d.getDate() - 29)
  d.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = d.toISOString()

  const { data } = await supabase
    .from("payments")
    .select("amount, paid_at")
    .eq("business_id", businessId)
    .eq("status", "paid")
    .gte("paid_at", thirtyDaysAgo)
    .order("paid_at", { ascending: true })

  const revenueByDay: Record<string, number> = {}
  for (const p of (data ?? []) as Pick<Payment, "amount" | "paid_at">[]) {
    if (!p.paid_at) continue
    const day = p.paid_at.slice(0, 10)
    revenueByDay[day] = (revenueByDay[day] ?? 0) + (p.amount ?? 0)
  }

  const revenueData: { date: string; revenue: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const dt = new Date()
    dt.setDate(dt.getDate() - i)
    const key = dt.toISOString().slice(0, 10)
    revenueData.push({ date: key, revenue: revenueByDay[key] ?? 0 })
  }

  return <RevenueChart data={revenueData} />
}
