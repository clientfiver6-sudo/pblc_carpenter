"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getBusinessId } from "@/lib/auth/actions"
import type { WorkItemStatus, WorkItemUpdate } from "@/types/database"

export interface CreateWorkItemData {
  customer_id?: string | null
  service_id?: string | null
  assigned_staff_id?: string | null
  title: string
  scheduled_date?: Date
  scheduled_time?: string
  address?: string | null
  price_estimate?: number | null
  notes?: string | null
}

export async function createWorkItem(data: CreateWorkItemData): Promise<void> {
  const businessId = await getBusinessId()
  if (!businessId) throw new Error("Negócio não encontrado")

  const supabase = await createClient()

  let scheduledStart: string | null = null
  let scheduledEnd: string | null = null

  if (data.scheduled_date) {
    const dateStr = data.scheduled_date.toISOString().slice(0, 10)
    const time = data.scheduled_time ?? "00:00"
    // Treat input as São Paulo time (UTC-3, no DST in Brazil since 2019)
    scheduledStart = new Date(`${dateStr}T${time}:00-03:00`).toISOString()

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

  const { data: created, error } = await supabase.from("work_items").insert({
    business_id: businessId,
    customer_id: data.customer_id ?? null,
    service_id: data.service_id ?? null,
    assigned_staff_id: data.assigned_staff_id ?? null,
    type: "service_call",
    title: data.title,
    scheduled_start: scheduledStart,
    scheduled_end: scheduledEnd,
    address: data.address ?? null,
    price_estimate: data.price_estimate != null ? Math.round(data.price_estimate * 100) : null,
    notes: data.notes ?? null,
    status: initialStatus,
    payment_status: "unpaid" as const,
    metadata: { status_history: [{ status: initialStatus, changed_at: new Date().toISOString() }] },
  } as never).select("id").single()

  if (error) throw new Error("Erro ao criar o chamado. Tente novamente.")

  // Fire booking_created automation (best-effort — must not fail the creation)
  if (created) {
    try {
      const { triggerBookingCreated } = await import("@/lib/automations/triggers")
      triggerBookingCreated((created as { id: string }).id, businessId).catch(() => {})
    } catch { /* non-fatal */ }
  }

  revalidatePath("/dashboard/work-items")
  revalidatePath("/dashboard/calendar")
}

export async function updateWorkItemStatus(
  workItemId: string,
  status: WorkItemStatus,
  notes?: string
): Promise<void> {
  const supabase = await createClient()

  // Fetch current item to build history
  const { data: rawCurrent, error: fetchErr } = await supabase
    .from("work_items")
    .select("status, metadata")
    .eq("id", workItemId)
    .single()
  const current = rawCurrent as { status: string; metadata: unknown } | null

  if (fetchErr || !current) {
    throw new Error("Não foi possível encontrar o item de trabalho.")
  }

  // Build updated status history
  const existingMeta =
    current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
      ? (current.metadata as Record<string, unknown>)
      : {}

  const existingHistory = Array.isArray(existingMeta.status_history)
    ? (existingMeta.status_history as unknown[])
    : []

  const newHistory = [
    ...existingHistory,
    {
      status,
      changed_at: new Date().toISOString(),
      ...(notes ? { notes } : {}),
    },
  ]

  const { error } = await supabase
    .from("work_items")
    .update({
      status,
      metadata: { ...existingMeta, status_history: newHistory },
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", workItemId)

  if (error) {
    throw new Error("Erro ao atualizar o status. Tente novamente.")
  }

  // Fire the matching automation for terminal/confirmation transitions.
  // Best-effort: automation errors must never fail the status update.
  const STATUS_TRIGGERS: Partial<Record<WorkItemStatus, string>> = {
    confirmed: "triggerBookingConfirmed",
    completed: "triggerBookingCompleted",
    cancelled: "triggerBookingCancelled",
    no_show: "triggerBookingNoShow",
  }
  const triggerName = STATUS_TRIGGERS[status]
  if (triggerName) {
    try {
      const { data: rawWi } = await supabase
        .from("work_items")
        .select("id, business_id, price_estimate, final_price, customer:customers(full_name)")
        .eq("id", workItemId)
        .single()
      const wi = rawWi as {
        business_id: string
        price_estimate: number | null
        final_price: number | null
        customer: { full_name: string } | null
      } | null
      if (wi) {
        const triggers = await import("@/lib/automations/triggers")
        const trigger = triggers[triggerName as keyof typeof triggers] as
          | ((workItemId: string, businessId: string) => Promise<void>)
          | undefined
        if (trigger) await trigger(workItemId, wi.business_id)

        // When manually completed, create a payment notification
        if (status === "completed") {
          try {
            const { createNotification } = await import("@/lib/notifications/actions")
            const { createAdminClient } = await import("@/lib/supabase/admin")
            const admin = createAdminClient()
            const { data: biz } = await admin
              .from("businesses")
              .select("mercadopago_access_token")
              .eq("id", wi.business_id)
              .single()
            const hasPix = !!(biz as { mercadopago_access_token: string | null } | null)?.mercadopago_access_token
            const amount = wi.final_price ?? wi.price_estimate
            const customerName = wi.customer?.full_name ?? "cliente"
            const amountStr = amount != null
              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount / 100)
              : null
            await createNotification({
              businessId: wi.business_id,
              type: "payment_due",
              title: `Cobrar ${customerName}`,
              body: hasPix
                ? `Atendimento concluído. Envie o Pix${amountStr ? ` de ${amountStr}` : ""} para ${customerName}.`
                : `Atendimento concluído. Cobrar${amountStr ? ` ${amountStr}` : ""} de ${customerName} em dinheiro.`,
              link: `/dashboard/work-items/${workItemId}`,
              metadata: { work_item_id: workItemId, amount, has_pix: hasPix },
            })
          } catch { /* non-fatal */ }
        }
      }
    } catch {
      // automation errors must not fail status update
    }
  }

  // Cancelled chamados are deleted immediately after the trigger fires
  if (status === "cancelled") {
    try {
      await supabase.from("work_items").delete().eq("id", workItemId)
    } catch { /* non-fatal */ }
  }

  revalidatePath("/dashboard/work-items")
  revalidatePath("/dashboard/calendar")
}

export async function updateWorkItem(
  id: string,
  data: Partial<WorkItemUpdate>
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("work_items")
    .update({ ...data, updated_at: new Date().toISOString() } as never)
    .eq("id", id)

  if (error) {
    throw new Error("Erro ao salvar as alterações. Tente novamente.")
  }

  revalidatePath("/dashboard/work-items")
}

export async function deleteWorkItem(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("work_items")
    .delete()
    .eq("id", id)

  if (error) {
    throw new Error("Erro ao excluir o item. Tente novamente.")
  }

  revalidatePath("/dashboard/work-items")
}
