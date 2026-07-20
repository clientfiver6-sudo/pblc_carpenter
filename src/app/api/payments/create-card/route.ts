// POST: Create a Mercado Pago Checkout Pro preference for card payments
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { safeDecryptToken } from "@/lib/security/encrypt"
import { createCheckoutPreference } from "@/lib/payments/mercadopago"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const createCardSchema = z.object({
  customerName: z.string().min(1, "Nome do cliente é obrigatório").max(200),
  workItemId: z.string().uuid().optional(),
  amount: z
    .number({ required_error: "Valor é obrigatório" })
    .positive("Valor deve ser positivo")
    .finite(),
  cardType: z.enum(["credit", "debit"]),
  installments: z.number().int().min(1).max(12).default(1),
  description: z.string().max(256).optional(),
})

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 })
  }

  const parsed = createCardSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { customerName, workItemId, amount, cardType, installments, description } = parsed.data

  const { data: rawBU } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const bu = rawBU as { business_id: string } | null

  if (!bu) {
    return NextResponse.json({ error: "Usuário não associado a nenhum negócio" }, { status: 403 })
  }

  const businessId = bu.business_id

  const { allowed } = await checkRateLimit(`card:${businessId}`, 20, 60_000)
  if (!allowed) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde um momento." }, { status: 429 })
  }

  const admin = createAdminClient()

  // Resolve customer by name (fuzzy match within this business)
  const { data: customers } = await admin
    .from("customers")
    .select("id, full_name")
    .eq("business_id", businessId)
    .ilike("full_name", `%${customerName}%`)
    .limit(1)

  const customerId = (customers as Array<{ id: string }> | null)?.[0]?.id ?? null

  // Resolve work item if provided
  let resolvedWorkItemId: string | null = null
  if (workItemId) {
    const { data: wi } = await admin
      .from("work_items")
      .select("id, business_id")
      .eq("id", workItemId)
      .eq("business_id", businessId)
      .single()

    if (wi) resolvedWorkItemId = workItemId
  }

  // ---------------------------------------------------------------------------
  // Fetch Mercado Pago access token for this business
  // ---------------------------------------------------------------------------

  const { data: bizData } = await admin
    .from("businesses")
    .select("mercadopago_access_token")
    .eq("id", businessId)
    .single()

  const mpToken = safeDecryptToken(
    (bizData as { mercadopago_access_token?: string | null } | null)?.mercadopago_access_token ?? null
  )

  if (!mpToken) {
    return NextResponse.json(
      { error: "Mercado Pago não configurado. Configure nas Configurações → Pagamentos." },
      { status: 422 }
    )
  }

  const resolvedDescription =
    description ?? `Cartão ${cardType === "credit" ? "crédito" : "débito"}${installments > 1 ? ` ${installments}x` : ""} — ${customerName}`

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""

  // ---------------------------------------------------------------------------
  // Insert payment record first so we have an ID to use as external_reference
  // ---------------------------------------------------------------------------

  const { data: rawPayment, error: insertError } = await admin
    .from("payments")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      work_item_id: resolvedWorkItemId,
      amount: Math.round(amount * 100),
      method: "card",
      status: "pending",
      description: resolvedDescription,
      metadata: {
        card_type: cardType,
        installments,
        customer_name_input: customerName,
      },
    } as never)
    .select()
    .single()

  if (insertError || !rawPayment) {
    console.error("[create-card] insert error:", insertError)
    return NextResponse.json(
      { error: "Erro ao registrar cobrança. Tente novamente." },
      { status: 500 }
    )
  }

  const paymentRecordId = (rawPayment as { id: string }).id

  // ---------------------------------------------------------------------------
  // Create Checkout Pro preference — embed record ID so card webhook can match back
  // ---------------------------------------------------------------------------

  let checkoutUrl: string
  let preferenceId: string

  try {
    const result = await createCheckoutPreference({
      accessToken: mpToken,
      amount,
      description: resolvedDescription,
      appUrl,
      externalReference: paymentRecordId,
      notificationUrl: `${appUrl}/api/webhooks/mercadopago-card/${businessId}`,
    })
    checkoutUrl = result.checkoutUrl
    preferenceId = result.preferenceId
  } catch (mpErr) {
    console.error("[create-card] Mercado Pago error:", mpErr)
    // Clean up the orphaned record
    await admin.from("payments").delete().eq("id", paymentRecordId)
    return NextResponse.json(
      { error: "Erro ao criar preferência de pagamento no Mercado Pago. Tente novamente." },
      { status: 502 }
    )
  }

  // Stamp the preference ID onto the record
  await admin
    .from("payments")
    .update({ mercadopago_preference_id: preferenceId } as never)
    .eq("id", paymentRecordId)

  return NextResponse.json({ payment: rawPayment, checkoutUrl }, { status: 201 })
}
