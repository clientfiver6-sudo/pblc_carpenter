// POST: Create Pix payment link for a work item
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createPixPayment } from "@/lib/payments/mercadopago"
import { checkRateLimit } from "@/lib/rate-limit"
import { z } from "zod"

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const createPixSchema = z.object({
  workItemId: z.string().uuid("workItemId deve ser um UUID válido"),
  amount: z
    .number({ required_error: "amount é obrigatório" })
    .positive("amount deve ser positivo")
    .finite(),
  description: z.string().max(256).optional(),
})

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth check — requires logged-in user
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Não autorizado. Faça login para continuar." },
      { status: 401 }
    )
  }

  // 2. Parse + validate body
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 })
  }

  const parsed = createPixSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0].message },
      { status: 400 }
    )
  }

  const { workItemId, amount, description } = parsed.data

  // 3. Resolve businessId for the authenticated user
  const { data: rawBusinessUser, error: buError } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const businessUser = rawBusinessUser as { business_id: string } | null

  if (buError || !businessUser) {
    return NextResponse.json(
      { error: "Usuário não associado a nenhum negócio" },
      { status: 403 }
    )
  }

  const businessId = businessUser.business_id

  // 3b. Rate limit: max 10 Pix creation requests per business per minute
  const { allowed: pixAllowed, remaining: pixRemaining } = await checkRateLimit(`pix:${businessId}`, 10, 60_000)
  if (!pixAllowed) {
    return NextResponse.json(
      { error: "Muitas tentativas de criar pagamento. Aguarde um momento." },
      { status: 429 }
    )
  }

  // 4. Fetch work item to get customer info and verify ownership
  const admin = createAdminClient()
  const { data: workItem, error: wiError } = await admin
    .from("work_items")
    .select("id, business_id, customer_id, title, final_price, price_estimate")
    .eq("id", workItemId)
    .single()

  if (wiError || !workItem) {
    return NextResponse.json(
      { error: "Ordem de serviço não encontrada" },
      { status: 404 }
    )
  }

  // Ensure work item belongs to this business
  if (workItem.business_id !== businessId) {
    return NextResponse.json(
      { error: "Acesso negado a esta ordem de serviço" },
      { status: 403 }
    )
  }

  // 5. Optionally fetch customer info for personalised Pix
  let customerEmail: string | undefined
  let customerName: string | undefined
  let customerId: string | undefined

  if (workItem.customer_id) {
    customerId = workItem.customer_id
    const { data: customer } = await admin
      .from("customers")
      .select("full_name, email")
      .eq("id", workItem.customer_id)
      .single()

    if (customer) {
      customerEmail = customer.email ?? undefined
      customerName = customer.full_name
    }
  }

  // 6. Create the Pix payment via Mercado Pago
  let pixResult: Awaited<ReturnType<typeof createPixPayment>>
  try {
    pixResult = await createPixPayment({
      businessId,
      workItemId,
      customerId,
      amount,
      description: description ?? workItem.title ?? "Pagamento RetornAI",
      customerEmail,
      customerName,
    })
  } catch (err) {
    console.error("create-pix route error:", err)
    const message =
      err instanceof Error ? err.message : "Erro ao criar cobrança Pix"
    return NextResponse.json({ error: message }, { status: 502 })
  }

  // 7. Fetch the freshly created payment record to return to client
  const { data: payment, error: payFetchError } = await admin
    .from("payments")
    .select("*")
    .eq("mercadopago_payment_id", pixResult.paymentId)
    .eq("business_id", businessId)
    .single()

  if (payFetchError || !payment) {
    // Return the raw result instead of failing
    return NextResponse.json(
      {
        payment: null,
        pixLink: pixResult.pixLink,
        pixCopyPaste: pixResult.pixCopyPaste,
        pixQrCode: pixResult.pixQrCode,
      },
      { status: 201, headers: { "X-RateLimit-Remaining": String(pixRemaining) } }
    )
  }

  return NextResponse.json(
    {
      payment,
      pixLink: pixResult.pixLink,
      pixCopyPaste: pixResult.pixCopyPaste,
      pixQrCode: pixResult.pixQrCode,
    },
    { status: 201, headers: { "X-RateLimit-Remaining": String(pixRemaining) } }
  )
}
