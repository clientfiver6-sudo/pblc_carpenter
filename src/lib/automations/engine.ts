import { createAdminClient } from "@/lib/supabase/admin"
import type { Automation, AutomationTrigger, AutomationLogInsert } from "@/types/database"
import { sendTextMessage } from "@/lib/whatsapp/client"

interface Condition {
  field: string
  operator: "eq" | "neq" | "contains" | "gt" | "lt"
  value: string | number
}

function evaluateConditions(conditions: unknown[], ctx: Record<string, unknown>): boolean {
  return (conditions as Condition[]).every((c) => {
    const actual = ctx[c.field]
    switch (c.operator) {
      case "eq": return String(actual) === String(c.value)
      case "neq": return String(actual) !== String(c.value)
      case "contains": return String(actual).toLowerCase().includes(String(c.value).toLowerCase())
      case "gt": return Number(actual) > Number(c.value)
      case "lt": return Number(actual) < Number(c.value)
      default: return true
    }
  })
}

// Template variable replacement: {{customer_name}}, {{business_name}}, {{service_name}}, {{scheduled_time}}, {{price}}, {{pix_link}}
function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`)
}

export interface AutomationPayload {
  businessId: string
  customerId?: string
  workItemId?: string
  paymentId?: string
  // resolved context
  customerName?: string
  serviceName?: string
  scheduledTime?: string
  price?: string
  pixLink?: string
}

export async function loadAutomationContext(
  payload: AutomationPayload
): Promise<Record<string, string>> {
  const admin = createAdminClient()
  const ctx: Record<string, string> = {}

  // Load business
  const { data: business } = await admin
    .from("businesses")
    .select("name, pix_key")
    .eq("id", payload.businessId)
    .single()

  if (business) {
    ctx.business_name = business.name
    if (business.pix_key) ctx.pix_link = business.pix_key
  }

  // Prefer pre-resolved values from payload
  if (payload.customerName) ctx.customer_name = payload.customerName
  if (payload.serviceName) ctx.service_name = payload.serviceName
  if (payload.scheduledTime) ctx.scheduled_time = payload.scheduledTime
  if (payload.price) ctx.price = payload.price
  if (payload.pixLink) ctx.pix_link = payload.pixLink

  // Load customer
  if (payload.customerId && !ctx.customer_name) {
    const { data: customer } = await admin
      .from("customers")
      .select("full_name")
      .eq("id", payload.customerId)
      .single()
    if (customer) ctx.customer_name = customer.full_name
  }

  // Load work item + related service and customer
  if (payload.workItemId) {
    const { data: wi } = await admin
      .from("work_items")
      .select("title, scheduled_start, price_estimate, final_price, customer_id, service_id")
      .eq("id", payload.workItemId)
      .single()

    if (wi) {
      if (!ctx.service_name) ctx.service_name = wi.title

      if (wi.scheduled_start && !ctx.scheduled_time) {
        const d = new Date(wi.scheduled_start)
        ctx.scheduled_date = d.toLocaleDateString("pt-BR", {
          day: "2-digit", month: "2-digit", year: "numeric",
          timeZone: "America/Sao_Paulo",
        })
        ctx.scheduled_time = d.toLocaleTimeString("pt-BR", {
          hour: "2-digit", minute: "2-digit",
          timeZone: "America/Sao_Paulo",
        })
        // full datetime alias kept for backward compat
        ctx.booking_date = ctx.scheduled_date
        ctx.booking_time = ctx.scheduled_time
      }

      if (!ctx.price) {
        const priceVal = wi.final_price ?? wi.price_estimate
        if (priceVal !== null) {
          ctx.price = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(priceVal / 100)
          ctx.payment_amount = ctx.price
        }
      }

      if (wi.customer_id && !ctx.customer_name) {
        const { data: customer } = await admin
          .from("customers")
          .select("full_name")
          .eq("id", wi.customer_id)
          .single()
        if (customer) ctx.customer_name = customer.full_name
      }
    }
  }

  // Load payment
  if (payload.paymentId) {
    const { data: payment } = await admin
      .from("payments")
      .select("amount, pix_link, customer_id, work_item_id")
      .eq("id", payload.paymentId)
      .single()

    if (payment) {
      if (!ctx.price) {
        ctx.price = new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(payment.amount / 100)
        ctx.payment_amount = ctx.price
      }

      if (payment.pix_link && !ctx.pix_link) {
        ctx.pix_link = payment.pix_link
      }

      if (payment.customer_id && !ctx.customer_name) {
        const { data: customer } = await admin
          .from("customers")
          .select("full_name")
          .eq("id", payment.customer_id)
          .single()
        if (customer) ctx.customer_name = customer.full_name
      }
    }
  }

  return ctx
}

async function sendWhatsAppMessage(
  phone: string,
  message: string,
  business: { whatsapp_phone_id: string | null }
): Promise<void> {
  if (!business.whatsapp_phone_id) {
    console.warn("[automations] WhatsApp credentials not configured, skipping send")
    return
  }

  await sendTextMessage({ to: phone, text: message, instanceName: business.whatsapp_phone_id })
}

export async function processAutomation(
  trigger: AutomationTrigger,
  payload: AutomationPayload
): Promise<void> {
  const admin = createAdminClient()

  // 1. Query active automations matching trigger_type and business_id
  const { data: automations, error: fetchError } = await admin
    .from("automations")
    .select("id,business_id,name,trigger_type,active,conditions,message_template,delay_minutes,run_count,last_run_at")
    .eq("business_id", payload.businessId)
    .eq("trigger_type", trigger)
    .eq("active", true)

  if (fetchError) {
    console.error(`[automations] Failed to fetch automations for businessId=${payload.businessId} trigger=${trigger}:`, fetchError)
    return
  }

  if (!automations || automations.length === 0) return

  // Load business credentials once (shared across all automations)
  const { data: business } = await admin
    .from("businesses")
    .select("whatsapp_phone_id")
    .eq("id", payload.businessId)
    .single()

  // Resolve customer phone
  const customerId =
    payload.customerId ??
    (payload.workItemId
      ? await resolveCustomerIdFromWorkItem(admin, payload.workItemId)
      : null) ??
    (payload.paymentId
      ? await resolveCustomerIdFromPayment(admin, payload.paymentId)
      : null)

  let customerPhone: string | null = null
  if (customerId) {
    const { data: customer } = await admin
      .from("customers")
      .select("phone_number")
      .eq("id", customerId)
      .single()
    customerPhone = customer?.phone_number ?? null
  }

  // Load template context
  const context = await loadAutomationContext({ ...payload, customerId: customerId ?? undefined })

  // 2. Process each automation individually — one failure must not stop others
  for (const automation of automations as Automation[]) {
    try {
      // a. Check conditions (empty array = always run)
      const conditions = Array.isArray(automation.conditions) ? automation.conditions : []
      if (conditions.length > 0 && !evaluateConditions(conditions, context as Record<string, unknown>)) {
        console.log(`[automations] Skipping automation ${automation.id} — conditions not met`)
        continue
      }

      // b. Delay handling: for delay_minutes > 0 we log it but run immediately
      //    (a proper queue/scheduler would be a separate service)
      if (automation.delay_minutes > 0) {
        console.log(
          `[automations] automation=${automation.id} has delay=${automation.delay_minutes}min — running immediately (no queue)`
        )
      }

      // c. Render message
      const message = renderTemplate(automation.message_template, context)

      // d. Send
      let logStatus: "sent" | "failed" | "skipped" = "skipped"
      let logError: string | null = null

      if (!customerPhone) {
        console.warn(
          `[automations] No phone for customer, skipping send. automationId=${automation.id} businessId=${payload.businessId}`
        )
        logStatus = "skipped"
      } else if (!business) {
        console.error(
          `[automations] Could not load business credentials. automationId=${automation.id} businessId=${payload.businessId}`
        )
        logStatus = "skipped"
      } else {
        try {
          await sendWhatsAppMessage(customerPhone, message, business)
          logStatus = "sent"
        } catch (sendErr) {
          console.error(
            `[automations] WhatsApp send failed. automationId=${automation.id} businessId=${payload.businessId}:`,
            sendErr
          )
          logStatus = "failed"
          logError = sendErr instanceof Error ? sendErr.message : String(sendErr)
        }
      }

      // g. Log result
      await admin.from("automation_logs").insert({
        automation_id: automation.id,
        business_id: payload.businessId,
        customer_id: customerId ?? null,
        work_item_id: payload.workItemId ?? null,
        status: logStatus,
        message_sent: logStatus === "sent" ? message : null,
        error: logError,
      } as unknown as AutomationLogInsert)

      // h. Update automation stats (atomic increment avoids read-then-write race)
      if (logStatus === "sent") {
        await admin.rpc("increment_automation_run_count" as never, {
          p_automation_id: automation.id,
          p_last_run_at: new Date().toISOString(),
        } as never)
      }
    } catch (err) {
      console.error(
        `[automations] Unexpected error processing automationId=${automation.id} businessId=${payload.businessId}:`,
        err
      )

      // Log the failure so it's visible
      const logInsert = admin.from("automation_logs").insert({
        automation_id: automation.id,
        business_id: payload.businessId,
        customer_id: customerId ?? null,
        work_item_id: payload.workItemId ?? null,
        status: "failed",
        message_sent: null,
        error: err instanceof Error ? err.message : String(err),
      } as unknown as AutomationLogInsert)
      await logInsert.then(() => undefined, () => undefined) // swallow secondary errors
    }
  }
}

// Helper: resolve customer_id from a work_item row
async function resolveCustomerIdFromWorkItem(
  admin: ReturnType<typeof createAdminClient>,
  workItemId: string
): Promise<string | null> {
  const { data } = await admin
    .from("work_items")
    .select("customer_id")
    .eq("id", workItemId)
    .single()
  return data?.customer_id ?? null
}

// Helper: resolve customer_id from a payment row
async function resolveCustomerIdFromPayment(
  admin: ReturnType<typeof createAdminClient>,
  paymentId: string
): Promise<string | null> {
  const { data } = await admin
    .from("payments")
    .select("customer_id")
    .eq("id", paymentId)
    .single()
  return data?.customer_id ?? null
}
