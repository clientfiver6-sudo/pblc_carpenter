import { processAutomation } from "./engine"

export async function triggerByTrajectoryState(
  conversationId: string,
  businessId: string,
  newState: string,
): Promise<void> {
  if (newState !== "escalated") return
  try {
    const { createNotification } = await import("@/lib/notifications/actions")
    await createNotification({
      businessId,
      type: "handoff" as never,
      title: "Conversa escalada para humano",
      body: "A IA escalou uma conversa para atendimento humano.",
      link: `/dashboard/conversations`,
      metadata: { conversation_id: conversationId },
    })
  } catch {
    // non-fatal
  }
}

export async function triggerBookingCreated(workItemId: string, businessId: string): Promise<void> {
  await processAutomation("booking_created", { businessId, workItemId })
}

export async function triggerBookingConfirmed(workItemId: string, businessId: string): Promise<void> {
  await processAutomation("booking_confirmed", { businessId, workItemId })
}

export async function triggerBookingCompleted(workItemId: string, businessId: string): Promise<void> {
  await processAutomation("booking_completed", { businessId, workItemId })
}

export async function triggerBookingNoShow(workItemId: string, businessId: string): Promise<void> {
  await processAutomation("booking_no_show", { businessId, workItemId })
}

export async function triggerBookingCancelled(workItemId: string, businessId: string): Promise<void> {
  await processAutomation("booking_cancelled", { businessId, workItemId })
}

export async function triggerPaymentReceived(paymentId: string, businessId: string): Promise<void> {
  await processAutomation("payment_received", { businessId, paymentId })
}

export async function triggerPaymentPending(paymentId: string, businessId: string): Promise<void> {
  await processAutomation("payment_pending", { businessId, paymentId })
}

export async function triggerCustomerInactive(customerId: string, businessId: string): Promise<void> {
  await processAutomation("customer_inactive", { businessId, customerId })
}

export async function triggerLeadCreated(customerId: string, businessId: string): Promise<void> {
  await processAutomation("lead_created", { businessId, customerId })
}

export async function triggerLeadInactive(customerId: string, businessId: string): Promise<void> {
  await processAutomation("lead_inactive", { businessId, customerId })
}

export async function triggerBooking24hBefore(workItemId: string, businessId: string): Promise<void> {
  await processAutomation("booking_24h_before", { businessId, workItemId })
}
