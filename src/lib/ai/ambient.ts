import { createAdminClient } from "@/lib/supabase/admin"
import { logUsage } from "./usage"
import { dsCreate, DS_MODEL } from "./deepseek"

const ambientRunLog = new Map<string, number>() // businessId → last run timestamp
const AMBIENT_MIN_INTERVAL_MS = 2 * 60 * 60 * 1000 // 2 hours between runs per business

export async function runAmbientIntelligence(businessId: string): Promise<void> {
  const lastRun = ambientRunLog.get(businessId) ?? 0
  if (Date.now() - lastRun < AMBIENT_MIN_INTERVAL_MS) return // skip if ran recently
  ambientRunLog.set(businessId, Date.now())

  await Promise.allSettled([
    refreshChurnRisk(businessId),
    predictTomorrowNoShows(businessId),
    detectRevenueGaps(businessId),
  ])
}

// ── Private helpers ───────────────────────────────────────────────────────────

// NOTE: We intentionally do NOT create notifications for unread/waiting
// conversations. Unread conversations are surfaced as a live count in the
// notification bell + sidebar (conversations.unread_count) instead.

async function refreshChurnRisk(businessId: string): Promise<void> {
  const admin = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: rawData } = await admin
    .from("customers")
    .select("id, full_name")
    .eq("business_id", businessId)
    .eq("status", "active")
    .lt("last_visit_at", thirtyDaysAgo)
    .order("total_spent", { ascending: false })
    .limit(10)

  const customers = rawData as Array<{ id: string; full_name: string }> | null
  if (!customers || customers.length < 5) return

  await admin
    .from("notifications")
    .insert({
      business_id: businessId,
      type: "work_item_overdue",
      title: `${customers.length} clientes sem visitar há 30+ dias`,
      body: `Clientes em risco de churn incluem: ${customers.slice(0, 3).map((c) => c.full_name).join(", ")}`,
      metadata: { customer_ids: customers.map((c) => c.id) },
      read: false,
    } as never)
}

async function predictTomorrowNoShows(businessId: string): Promise<void> {
  const admin = createAdminClient()

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 0, 0).toISOString()
  const tEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59).toISOString()

  const { data: rawData } = await admin
    .from("work_items")
    .select("id, customer:customers(full_name, visit_count)")
    .eq("business_id", businessId)
    .gte("scheduled_start", tStart)
    .lte("scheduled_start", tEnd)
    .neq("status", "cancelled")
    .limit(20)

  const items = rawData as Array<{
    id: string
    customer: { full_name: string; visit_count: number } | null
  }> | null

  if (!items || items.length === 0) return

  const highRisk = items.filter((i) => i.customer?.visit_count === 0)
  if (highRisk.length === 0) return

  // Generate the alert text via DeepSeek. Guarded so a missing DEEPSEEK_API_KEY
  // or a DS outage never throws — we fall back to a static message instead.
  let claudeResponse = "Atenção: clientes novos agendados amanhã."
  try {
    const response = await dsCreate({
      max_tokens: 150,
      system: `Você é assistente de ${businessId}. Responda em português, de forma natural e direta.`,
      messages: [
        {
          role: "user",
          content: `Amanhã temos ${items.length} agendamentos. ${highRisk.length} são de clientes novos (primeira visita). Gere 1 frase de alerta para o gestor.`,
        },
      ],
    })
    void logUsage(businessId, "ambient.predictTomorrowNoShows", response.usage, DS_MODEL)
    claudeResponse = response.content[0].text || claudeResponse
  } catch (err) {
    console.warn("[ambient] predictTomorrowNoShows: DeepSeek unavailable, using default text:", err)
  }

  await admin
    .from("notifications")
    .insert({
      business_id: businessId,
      type: "work_item_overdue",
      title: "Risco de não comparecimento amanhã",
      body: claudeResponse,
      metadata: { item_ids: highRisk.map((i) => i.id) },
      read: false,
    } as never)
}

async function detectRevenueGaps(businessId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: rawData } = await admin
    .from("work_items")
    .select("id, final_price")
    .eq("business_id", businessId)
    .eq("status", "completed")
    .eq("payment_status", "unpaid")
    .gt("final_price", 0)
    .order("final_price", { ascending: false })
    .limit(10)

  const unpaid = rawData as Array<{ id: string; final_price: number }> | null
  if (!unpaid || unpaid.length === 0) return

  const totalUnpaid = unpaid.reduce((sum, i) => sum + i.final_price, 0)
  if (totalUnpaid <= 10000) return

  await admin
    .from("notifications")
    .insert({
      business_id: businessId,
      type: "payment_received",
      title: `R$ ${(totalUnpaid / 100).toFixed(2)} em receita não cobrada`,
      body: `${unpaid.length} serviços concluídos ainda sem pagamento registrado.`,
      metadata: { item_ids: unpaid.map((i) => i.id) },
      read: false,
    } as never)
}

