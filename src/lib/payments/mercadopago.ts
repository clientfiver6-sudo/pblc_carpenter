// Mercado Pago Pix payment integration
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPaymentReceivedEmail } from "@/lib/email"
import { safeDecryptToken } from "@/lib/security/encrypt"
import type { PaymentTransactionStatus } from "@/types/database"
import { createHash } from "crypto"

const MP_BASE_URL = "https://api.mercadopago.com"

// ---------------------------------------------------------------------------
// Input / output types
// ---------------------------------------------------------------------------

interface CreatePixPaymentInput {
  businessId: string
  workItemId?: string
  customerId?: string
  amount: number // in BRL decimal (not cents) e.g. 150.00
  description: string
  customerEmail?: string
  customerName?: string
  customerCpf?: string // optional for Pix
}

interface PixPaymentResult {
  paymentId: string
  pixLink: string       // ticket_url — the Pix payment page
  pixQrCode: string     // qr_code base64 PNG
  pixCopyPaste: string  // qr_code text string (copy-paste Pix code)
  expiresAt: Date
}

// ---------------------------------------------------------------------------
// Mercado Pago API response types (typed inline — no `any`)
// ---------------------------------------------------------------------------

interface MercadoPagoPayerIdentification {
  type: string
  number: string
}

interface MercadoPagoPayer {
  email: string
  first_name?: string
  last_name?: string
  identification?: MercadoPagoPayerIdentification
}

interface MercadoPagoTransactionData {
  qr_code: string
  qr_code_base64: string
  ticket_url: string
}

interface MercadoPagoPointOfInteraction {
  type: string
  transaction_data: MercadoPagoTransactionData
}

interface MercadoPagoPaymentResponse {
  id: number
  status: string
  status_detail: string
  transaction_amount: number
  description: string
  payment_method_id: string
  date_of_expiration: string | null
  external_reference: string | null
  point_of_interaction: MercadoPagoPointOfInteraction
  payer: MercadoPagoPayer
}

interface MercadoPagoErrorResponse {
  message: string
  error: string
  status: number
  cause: Array<{ code: number; description: string; data: string | null }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseMpName(fullName?: string): { first_name: string; last_name: string } {
  if (!fullName) return { first_name: "Cliente", last_name: "RetornAI" }
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { first_name: parts[0], last_name: "" }
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") }
}

function mapMpStatus(status: string): PaymentTransactionStatus {
  switch (status) {
    case "approved":
      return "paid"
    case "rejected":
    case "cancelled":
      return "failed"
    case "in_process":
    case "pending":
    default:
      return "pending"
  }
}

// ---------------------------------------------------------------------------
// createPixPayment
// ---------------------------------------------------------------------------

export async function createPixPayment(input: CreatePixPaymentInput): Promise<PixPaymentResult> {
  const admin = createAdminClient()

  // 1. Fetch business mercadopago_access_token
  const { data: business, error: bizError } = await admin
    .from("businesses")
    .select("mercadopago_access_token")
    .eq("id", input.businessId)
    .single()

  if (bizError || !business?.mercadopago_access_token) {
    throw new Error(
      `Negócio não possui token do Mercado Pago configurado: ${bizError?.message ?? "token ausente"}`
    )
  }

  const accessToken = safeDecryptToken(business.mercadopago_access_token)
  if (!accessToken) {
    throw new Error("Falha ao descriptografar token do Mercado Pago")
  }

  // 2. Build payer object
  const { first_name, last_name } = parseMpName(input.customerName)
  const payer: MercadoPagoPayer = {
    email: input.customerEmail ?? "customer@retornai.com.br",
    first_name,
    last_name,
    ...(input.customerCpf
      ? { identification: { type: "CPF", number: input.customerCpf.replace(/\D/g, "") } }
      : {}),
  }

  // Expiry: 24 hours from now
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const body = {
    transaction_amount: input.amount,
    payment_method_id: "pix",
    description: input.description,
    payer,
    date_of_expiration: expiresAt.toISOString(),
  }

  // 3. POST to Mercado Pago
  // Deterministic idempotency key: same request within 5 min → same key → MP returns cached response
  const pixIdempotencyKey = createHash("sha256")
    .update(`pix:${input.businessId}:${input.customerId ?? "anon"}:${input.amount}:${input.description}:${Math.floor(Date.now() / 300_000)}`)
    .digest("hex")
    .slice(0, 36)

  const response = await fetch(`${MP_BASE_URL}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": pixIdempotencyKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errBody = (await response.json()) as MercadoPagoErrorResponse
    throw new Error(
      `Mercado Pago API error ${response.status}: ${errBody.message ?? errBody.error ?? "Erro desconhecido"}`
    )
  }

  const mpPayment = (await response.json()) as MercadoPagoPaymentResponse
  const txData = mpPayment.point_of_interaction.transaction_data

  const pixLink = txData.ticket_url
  const pixQrCode = txData.qr_code_base64
  const pixCopyPaste = txData.qr_code
  const paymentId = String(mpPayment.id)

  // 4. Insert into payments table
  const { error: insertError } = await admin.from("payments").insert({
    business_id: input.businessId,
    work_item_id: input.workItemId ?? null,
    customer_id: input.customerId ?? null,
    amount: Math.round(input.amount * 100), // store in centavos for consistency
    method: "pix",
    status: "pending",
    pix_link: pixLink,
    pix_qr_code: pixQrCode,
    pix_copy_paste: pixCopyPaste,
    mercadopago_payment_id: paymentId,
    description: input.description,
    expires_at: expiresAt.toISOString(),
    metadata: {},
  } as never)

  if (insertError) {
    console.error("Erro ao salvar pagamento:", insertError)
    // Don't throw — Pix was already created in MP; best-effort DB write
  }

  // 5. If workItemId: update work_item.payment_status = 'pending'
  if (input.workItemId) {
    const { error: wiError } = await admin
      .from("work_items")
      .update({ payment_status: "pending" })
      .eq("id", input.workItemId)

    if (wiError) {
      console.error("Erro ao atualizar work_item payment_status:", wiError)
    }
  }

  // 6. Return result
  return { paymentId, pixLink, pixQrCode, pixCopyPaste, expiresAt }
}

// ---------------------------------------------------------------------------
// createCheckoutPreference (Checkout Pro — card payments)
// ---------------------------------------------------------------------------

interface CreateCheckoutPreferenceInput {
  accessToken: string
  amount: number        // BRL decimal e.g. 150.00
  description: string
  appUrl: string        // NEXT_PUBLIC_APP_URL
  customerId?: string
  workItemId?: string
  externalReference?: string   // our payments.id — used by the card webhook to match the record
  notificationUrl?: string     // per-preference webhook URL (includes businessId for card detection)
}

interface CheckoutPreferenceResult {
  checkoutUrl: string
  preferenceId: string
}

interface MercadoPagoPreferenceResponse {
  id: string
  init_point: string
}

export async function createCheckoutPreference(
  input: CreateCheckoutPreferenceInput
): Promise<CheckoutPreferenceResult> {
  const { accessToken, amount, description, appUrl, externalReference, notificationUrl } = input

  const body: Record<string, unknown> = {
    items: [
      {
        title: description,
        quantity: 1,
        unit_price: amount,
        currency_id: "BRL",
      },
    ],
    back_urls: {
      success: `${appUrl}/payment/success`,
      failure: `${appUrl}/payment/failure`,
    },
    auto_return: "approved",
    ...(externalReference ? { external_reference: externalReference } : {}),
    ...(notificationUrl ? { notification_url: notificationUrl } : {}),
  }

  // Deterministic idempotency key scoped to access token + request content + 5-min window
  const checkoutIdempotencyKey = createHash("sha256")
    .update(`checkout:${accessToken.slice(-8)}:${amount}:${description}:${Math.floor(Date.now() / 300_000)}`)
    .digest("hex")
    .slice(0, 36)

  const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": checkoutIdempotencyKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errBody = (await response.json()) as MercadoPagoErrorResponse
    throw new Error(
      `Mercado Pago Checkout Pro error ${response.status}: ${errBody.message ?? errBody.error ?? "Erro desconhecido"}`
    )
  }

  const mpData = (await response.json()) as MercadoPagoPreferenceResponse

  return {
    checkoutUrl: mpData.init_point,
    preferenceId: mpData.id,
  }
}

// ---------------------------------------------------------------------------
// getPaymentStatus
// ---------------------------------------------------------------------------

export async function getPaymentStatus(
  paymentId: string,
  accessToken: string
): Promise<PaymentTransactionStatus> {
  const mp = await getMpPaymentDetails(paymentId, accessToken)
  return mapMpStatus(mp.status)
}

export async function getMpPaymentDetails(
  paymentId: string,
  accessToken: string
): Promise<{ status: PaymentTransactionStatus; externalReference: string | null }> {
  const response = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })

  if (!response.ok) {
    const errBody = (await response.json()) as MercadoPagoErrorResponse
    throw new Error(
      `Mercado Pago getMpPaymentDetails error ${response.status}: ${errBody.message ?? errBody.error ?? "Erro desconhecido"}`
    )
  }

  const mpPayment = (await response.json()) as MercadoPagoPaymentResponse
  return {
    status: mapMpStatus(mpPayment.status),
    externalReference: mpPayment.external_reference ?? null,
  }
}

// ---------------------------------------------------------------------------
// processWebhookEvent
// ---------------------------------------------------------------------------

export async function processWebhookEvent(
  paymentId: string,
  accessToken: string,
  businessId: string
): Promise<void> {
  const admin = createAdminClient()

  // 1. Get current status from MP
  const newStatus = await getPaymentStatus(paymentId, accessToken)

  // 2. Fetch existing payment record to get amount + work_item_id + customer_id
  const { data: payment, error: fetchError } = await admin
    .from("payments")
    .select("id, amount, work_item_id, customer_id, status, description")
    .eq("mercadopago_payment_id", paymentId)
    .eq("business_id", businessId)
    .single()

  if (fetchError || !payment) {
    console.error("processWebhookEvent: pagamento não encontrado", fetchError)
    return
  }

  // Atomic conditional update — only proceeds if status hasn't already been set by a concurrent call
  const now = new Date().toISOString()
  const updatePayload =
    newStatus === "paid"
      ? { status: "paid" as const, paid_at: now }
      : { status: newStatus as "failed" | "expired" }

  const { data: updated } = await admin
    .from("payments")
    .update(updatePayload as never)
    .eq("id", payment.id)
    .neq("status", newStatus)
    .select("id")
  if (!updated || updated.length === 0) return // another process already handled this event

  if (newStatus === "paid") {

    // Update linked work_item
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

    // Send confirmation email to customer (best-effort)
    if (payment.customer_id) {
      try {
        const { data: customer } = await admin
          .from("customers")
          .select("full_name, email")
          .eq("id", payment.customer_id)
          .single()
        const { data: business } = await admin
          .from("businesses")
          .select("name")
          .eq("id", businessId)
          .single()
        if (customer?.email && business?.name) {
          await sendPaymentReceivedEmail({
            to: customer.email,
            customerName: customer.full_name,
            businessName: business.name,
            amount: payment.amount,
            description: (payment as { description?: string }).description ?? "Serviço",
            paymentId,
          })
        }
      } catch {
        // Never block the webhook on email failure
      }
    }

    // Create payment_received notification (best-effort)
    try {
      await admin
        .from("notifications")
        .insert({
          business_id: businessId,
          type: "payment_received",
          title: "Pagamento recebido",
          body: `R$ ${(payment.amount / 100).toFixed(2).replace(".", ",")} confirmado via Pix`,
          link: `/dashboard/payments`,
          read: false,
          metadata: {} as import("@/types/database").Json,
        })
    } catch {
      // Notifications table may not exist yet
    }

    // Try to trigger payment_received automation (best-effort)
    try {
      const { triggerPaymentReceived } = await import("@/lib/automations/triggers")
      await triggerPaymentReceived(paymentId, businessId)
    } catch {
      // Automations module may not be present yet — ignore
    }
  } else if (newStatus === "failed" || newStatus === "expired") {
    // Payment status already updated atomically above
    if (payment.work_item_id) {
      await admin
        .from("work_items")
        .update({ payment_status: "unpaid" })
        .eq("id", payment.work_item_id)
    }
  }
}
