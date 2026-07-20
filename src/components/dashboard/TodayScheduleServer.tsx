import { createClient } from "@/lib/supabase/server"
import { TodaySchedule } from "./TodaySchedule"
import type { WorkItemWithRelations } from "@/types/database"

export async function TodayScheduleServer({
  businessId,
  businessType,
}: {
  businessId: string
  businessType: string
}) {
  const supabase = await createClient()
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  const { data } = await supabase
    .from("work_items")
    .select("*, customer:customers(*), service:services(*), assigned_staff:staff(*)")
    .eq("business_id", businessId)
    .neq("status", "cancelled")
    .gte("scheduled_start", start)
    .lt("scheduled_start", end)
    .order("scheduled_start", { ascending: true })

  const items = (data ?? []) as WorkItemWithRelations[]

  return <TodaySchedule items={items} businessType={businessType as never} />
}
