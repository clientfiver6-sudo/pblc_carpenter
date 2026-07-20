import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateCsv, formatCurrencyCsv, formatDateBr } from "@/lib/export/csv"

export async function GET(): Promise<NextResponse> {
  // Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const bu = rawBu as { business_id: string } | null

  if (!bu) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: rawItems } = await admin
    .from("work_items")
    .select("title, status, scheduled_start, scheduled_end, price_estimate, payment_status, created_at, customer:customers(full_name), service:services(name)")
    .eq("business_id", bu.business_id)
    .order("created_at", { ascending: false })

  const items = rawItems as Array<{
    title: string
    status: string
    scheduled_start: string | null
    scheduled_end: string | null
    price_estimate: number | null
    payment_status: string
    created_at: string
    customer: { full_name: string } | null
    service: { name: string } | null
  }> | null

  const headers = [
    "Título",
    "Cliente",
    "Serviço",
    "Status",
    "Início Agendado",
    "Fim Agendado",
    "Valor Estimado (R$)",
    "Status Pagamento",
    "Criado em",
  ]

  const rows = (items ?? []).map((item) => [
    item.title,
    item.customer?.full_name ?? "",
    item.service?.name ?? "",
    item.status,
    item.scheduled_start ? formatDateBr(item.scheduled_start) : "",
    item.scheduled_end ? formatDateBr(item.scheduled_end) : "",
    item.price_estimate != null ? formatCurrencyCsv(item.price_estimate) : "",
    item.payment_status,
    formatDateBr(item.created_at),
  ])

  const csv = generateCsv(headers, rows)
  const filename = `ordens-servico-${new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
