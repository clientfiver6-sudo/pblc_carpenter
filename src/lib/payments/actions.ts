"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Payment, PaymentMethod } from "@/types/database"

// ---------------------------------------------------------------------------
// notifyPaymentReceived — best-effort notification + automation when a payment
// is confirmed. Mirrors the MercadoPago webhook so manual/cash payments fire
// the same "payment received" flow. Never throws.
// ---------------------------------------------------------------------------

async function notifyPaymentReceived(
  businessId: string,
  paymentId: string,
  amountCents: number,
  method?: PaymentMethod | null
): Promise<void> {
  const admin = createAdminClient()
  const methodLabel =
    method === "pix" ? " via Pix" : method === "cash" ? " em dinheiro" : ""
  try {
    await admin.from("notifications").insert({
      business_id: businessId,
      type: "payment_received",
      title: "Pagamento recebido",
      body: `R$ ${(amountCents / 100).toFixed(2).replace(".", ",")} confirmado${methodLabel}`,
      link: `/dashboard/payments`,
      read: false,
      metadata: {} as import("@/types/database").Json,
    } as never)
  } catch {
    // notifications table may not exist yet
  }
  try {
    const { triggerPaymentReceived } = await import("@/lib/automations/triggers")
    await triggerPaymentReceived(paymentId, businessId)
  } catch {
    // automations module optional
  }
}

// ---------------------------------------------------------------------------
// markPaymentPaid
// ---------------------------------------------------------------------------

export async function markPaymentPaid(paymentId: string): Promise<void> {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autorizado")

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Fetch payment to get linked work_item_id and verify business ownership
  const { data: payment, error: fetchError } = await admin
    .from("payments")
    .select("id, business_id, work_item_id, customer_id, amount, method")
    .eq("id", paymentId)
    .single()

  if (fetchError || !payment) {
    throw new Error("Pagamento não encontrado")
  }

  // Verify user has access to this business
  const { data: businessUser } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", payment.business_id)
    .single()

  if (!businessUser) throw new Error("Acesso negado")

  // Update payment status
  const { error: updateError } = await admin
    .from("payments")
    .update({ status: "paid", paid_at: now })
    .eq("id", paymentId)

  if (updateError) throw new Error(`Erro ao atualizar pagamento: ${updateError.message}`)

  // Update linked work_item payment_status
  if (payment.work_item_id) {
    await admin
      .from("work_items")
      .update({ payment_status: "paid" })
      .eq("id", payment.work_item_id)
  }

  // Record the paid charge as a visit (atomic: total_spent + visit_count + last_visit_at)
  if (payment.customer_id) {
    await admin.rpc("add_customer_revenue_and_visit" as never, {
      p_customer_id: payment.customer_id,
      p_amount: payment.amount,
    } as never)
  }

  await notifyPaymentReceived(
    payment.business_id,
    payment.id,
    payment.amount,
    (payment as { method?: PaymentMethod | null }).method
  )

  revalidatePath("/payments")
  revalidatePath("/dashboard")
}

// ---------------------------------------------------------------------------
// createManualPayment
// ---------------------------------------------------------------------------

export async function createManualPayment(data: {
  workItemId: string
  amount: number
  method: PaymentMethod
  description?: string
}): Promise<Payment> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autorizado")

  const { data: rawBusinessUser, error: buError } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const businessUser = rawBusinessUser as { business_id: string } | null

  if (buError || !businessUser) throw new Error("Usuário não associado a nenhum negócio")

  const businessId = businessUser.business_id
  const admin = createAdminClient()

  // Fetch work item to get customer_id and verify ownership
  const { data: workItem, error: wiError } = await admin
    .from("work_items")
    .select("id, business_id, customer_id, title")
    .eq("id", data.workItemId)
    .single()

  if (wiError || !workItem) throw new Error("Ordem de serviço não encontrada")
  if (workItem.business_id !== businessId) throw new Error("Acesso negado")

  const now = new Date().toISOString()

  const { data: rawPayment, error: insertError } = await admin
    .from("payments")
    .insert({
      business_id: businessId,
      work_item_id: data.workItemId,
      customer_id: workItem.customer_id,
      amount: Math.round(data.amount * 100), // store in centavos
      method: data.method,
      status: "paid",
      paid_at: now,
      description: data.description ?? workItem.title ?? "Pagamento manual",
      metadata: {},
    } as never)
    .select()
    .single()
  const payment = rawPayment as Payment | null

  if (insertError || !payment) {
    throw new Error(`Erro ao criar pagamento: ${insertError?.message ?? "Erro desconhecido"}`)
  }

  // Update work_item payment_status
  await admin
    .from("work_items")
    .update({ payment_status: "paid" })
    .eq("id", data.workItemId)

  // Record the paid charge as a visit (atomic: total_spent + visit_count + last_visit_at)
  if (workItem.customer_id) {
    await admin.rpc("add_customer_revenue_and_visit" as never, {
      p_customer_id: workItem.customer_id,
      p_amount: payment.amount,
    } as never)
  }

  await notifyPaymentReceived(businessId, payment.id, payment.amount, data.method)

  revalidatePath("/payments")
  revalidatePath("/dashboard")

  return payment
}

// ---------------------------------------------------------------------------
// cancelPayment
// ---------------------------------------------------------------------------

export async function cancelPayment(paymentId: string): Promise<void> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Não autorizado")

  const admin = createAdminClient()

  const { data: payment, error: fetchError } = await admin
    .from("payments")
    .select("id, business_id, work_item_id, status")
    .eq("id", paymentId)
    .single()

  if (fetchError || !payment) throw new Error("Pagamento não encontrado")

  // Verify ownership
  const { data: businessUser } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", payment.business_id)
    .single()

  if (!businessUser) throw new Error("Acesso negado")

  // Only pending payments can be cancelled
  if (payment.status !== "pending") {
    throw new Error("Apenas pagamentos pendentes podem ser cancelados")
  }

  const { error: updateError } = await admin
    .from("payments")
    .update({ status: "failed" })
    .eq("id", paymentId)

  if (updateError) throw new Error(`Erro ao cancelar pagamento: ${updateError.message}`)

  // Revert work_item to unpaid if linked
  if (payment.work_item_id) {
    await admin
      .from("work_items")
      .update({ payment_status: "unpaid" })
      .eq("id", payment.work_item_id)
  }

  revalidatePath("/payments")
  revalidatePath("/dashboard")
}
