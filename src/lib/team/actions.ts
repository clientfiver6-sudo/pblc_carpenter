"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getBusinessId } from "@/lib/auth/actions"
import type { WorkItemWithRelations, Staff, TeamMessage, StaffWithStats, WorkItemStatus } from "@/types/database"

const OPEN_STATUSES: WorkItemStatus[] = [
  "new", "scheduled", "pending_confirmation", "confirmed", "in_progress", "waiting_customer", "waiting_parts"
]

export async function getTeamPageData(): Promise<{
  staff: StaffWithStats[]
  unassignedItems: WorkItemWithRelations[]
}> {
  const supabase = await createClient()
  const businessId = await getBusinessId()
  if (!businessId) return { staff: [], unassignedItems: [] }

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all active staff
  const { data: staffRows } = await supabase
    .from("staff")
    .select("*")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("name", { ascending: true })

  const allStaff = (staffRows as Staff[] | null) ?? []

  // Fetch all non-cancelled work items with relations
  const { data: workItemRows } = await supabase
    .from("work_items")
    .select(`
      *,
      customer:customers(id, full_name, phone_number, email),
      service:services(id, name, price, duration_minutes),
      assigned_staff:staff(id, name, role, color)
    `)
    .eq("business_id", businessId)
    .not("status", "in", '("cancelled")')
    .order("scheduled_start", { ascending: true })

  const allItems = (workItemRows as WorkItemWithRelations[] | null) ?? []

  // Fetch unread message counts per staff
  const staffIds = allStaff.map(s => s.id)
  const unreadByStaff: Record<string, number> = {}
  if (staffIds.length > 0) {
    const { data: unreadRows } = await supabase
      .from("team_messages")
      .select("staff_id")
      .eq("business_id", businessId)
      .eq("read", false)
      .in("staff_id", staffIds)
      .neq("sender_user_id", user?.id ?? "")

    const rows = (unreadRows as Array<{ staff_id: string }> | null) ?? []
    for (const row of rows) {
      unreadByStaff[row.staff_id] = (unreadByStaff[row.staff_id] ?? 0) + 1
    }
  }

  // Aggregate stats per staff member
  const staffWithStats: StaffWithStats[] = allStaff.map(member => {
    const assigned = allItems.filter(i => i.assigned_staff_id === member.id)
    const assignedOpen = assigned.filter(i => OPEN_STATUSES.includes(i.status))
    const completedCount = assigned.filter(i => i.status === "completed").length
    const paymentsDue = assignedOpen.reduce((sum, i) => sum + (i.price_estimate ?? 0), 0)

    return {
      ...member,
      assigned_items: assignedOpen,
      completed_count: completedCount,
      payments_due_cents: paymentsDue,
      unread_messages: unreadByStaff[member.id] ?? 0,
    }
  })

  const unassignedItems = allItems.filter(
    i => !i.assigned_staff_id && OPEN_STATUSES.includes(i.status)
  )

  return { staff: staffWithStats, unassignedItems }
}

export async function assignWorkItem(workItemId: string, staffId: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const businessId = await getBusinessId()
  if (!businessId) return { error: "Negócio não encontrado" }

  const { error } = await supabase
    .from("work_items")
    .update({ assigned_staff_id: staffId } as never)
    .eq("id", workItemId)
    .eq("business_id", businessId)

  if (error) return { error: "Erro ao atribuir tarefa" }

  revalidatePath("/dashboard/team-tasks")
  revalidatePath("/dashboard/work-items")
  return {}
}

export async function sendTeamMessage(staffId: string, content: string): Promise<{ error?: string; message?: TeamMessage }> {
  const supabase = await createClient()
  const businessId = await getBusinessId()
  if (!businessId) return { error: "Negócio não encontrado" }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { data, error } = await supabase
    .from("team_messages")
    .insert({
      business_id: businessId,
      staff_id: staffId,
      sender_user_id: user.id,
      content: content.trim(),
    } as never)
    .select()
    .single()

  if (error) return { error: "Erro ao enviar mensagem" }
  return { message: data as TeamMessage }
}

export async function getStaffMessages(staffId: string, limit = 50): Promise<TeamMessage[]> {
  const supabase = await createClient()
  const businessId = await getBusinessId()
  if (!businessId) return []

  const { data } = await supabase
    .from("team_messages")
    .select("*")
    .eq("business_id", businessId)
    .eq("staff_id", staffId)
    .order("created_at", { ascending: true })
    .limit(limit)

  return (data as TeamMessage[] | null) ?? []
}

export async function markMessagesRead(staffId: string): Promise<void> {
  const supabase = await createClient()
  const businessId = await getBusinessId()
  if (!businessId) return

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("team_messages")
    .update({ read: true, read_at: new Date().toISOString() } as never)
    .eq("business_id", businessId)
    .eq("staff_id", staffId)
    .eq("read", false)
    .neq("sender_user_id", user.id)
}

export async function getUnreadTeamMessageCount(): Promise<number> {
  const supabase = await createClient()
  const businessId = await getBusinessId()
  if (!businessId) return 0

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  const { count } = await supabase
    .from("team_messages")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("read", false)
    .neq("sender_user_id", user.id)

  return count ?? 0
}
