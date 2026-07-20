import Anthropic from "@anthropic-ai/sdk"
import { createAdminClient } from "@/lib/supabase/admin"
import { selectModel, TaskComplexity } from "./model-router"
import { getBusinessContext, invalidateContext } from "./brain"
import { TAG, delimit } from "./delimiter"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function runNightlyDreaming(businessId: string): Promise<{
  summarized: number
  insightsGenerated: number
  errors: string[]
}> {
  const errors: string[] = []
  const results = await Promise.allSettled([
    consolidateCustomerSummaries(businessId),
    generateWeeklyInsight(businessId),
    preWarmCaches(businessId),
  ])

  let summarized = 0
  let insightsGenerated = 0

  for (const r of results) {
    if (r.status === "rejected") {
      errors.push(String(r.reason))
    }
  }
  if (results[0].status === "fulfilled") summarized = results[0].value as number
  if (results[1].status === "fulfilled") insightsGenerated = results[1].value as number

  return { summarized, insightsGenerated, errors }
}

async function consolidateCustomerSummaries(businessId: string): Promise<number> {
  const admin = createAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const { data: rawData } = await admin
    .from("customers")
    .select("id, full_name")
    .eq("business_id", businessId)
    .eq("status", "active")
    .gte("last_visit_at", sevenDaysAgo)
    .limit(30)

  const customers = rawData as Array<{ id: string; full_name: string }> | null
  if (!customers || customers.length === 0) return 0

  let count = 0
  await Promise.allSettled(
    customers.map(async (c) => {
      try {
        const { data: msgData } = await admin
          .from("messages")
          .select("direction, content, sent_at")
          .eq("business_id", businessId)
          .order("sent_at", { ascending: false })
          .limit(10)

        const msgs = msgData as Array<{ direction: string; content: string; sent_at: string }> | null
        if (!msgs || msgs.length === 0) return

        const history = msgs.reverse().map(m => `${m.direction === "inbound" ? "Cliente" : "IA"}: ${m.content}`).join("\n")

        const msg = await anthropic.messages.create({
          model: selectModel(TaskComplexity.SIMPLE),
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `Resuma em 2 frases o perfil e interações recentes deste cliente:\n${c.full_name}\n\n${delimit(TAG.conversationHistory, history)}`,
          }],
        })

        const summary = msg.content[0].type === "text" ? msg.content[0].text : ""
        if (summary) {
          await admin.from("customers").update({
            metadata: { ai_summary: summary, ai_summary_at: new Date().toISOString() },
          } as never).eq("id", c.id)
          count++
        }
      } catch {
        // non-fatal per customer
      }
    }),
  )

  return count
}

async function generateWeeklyInsight(businessId: string): Promise<number> {
  const admin = createAdminClient()
  const periodEnd = new Date()
  const periodStart = new Date(Date.now() - 7 * 86400000)

  const { data: rawMetrics } = await admin
    .from("work_items")
    .select("id, status, final_price, payment_status")
    .eq("business_id", businessId)
    .gte("created_at", periodStart.toISOString())
    .lte("created_at", periodEnd.toISOString())

  const metrics = rawMetrics as Array<{ id: string; status: string; final_price: number; payment_status: string }> | null
  if (!metrics || metrics.length === 0) return 0

  const completed = metrics.filter(m => m.status === "completed").length
  const revenue = metrics.filter(m => m.payment_status === "paid").reduce((s, m) => s + (m.final_price ?? 0), 0)

  const msg = await anthropic.messages.create({
    model: selectModel(TaskComplexity.COMPLEX),
    max_tokens: 400,
    messages: [{
      role: "user",
      content: `Gere uma narrativa semanal de negócios em português. Dados da semana: ${metrics.length} atendimentos registrados, ${completed} concluídos, R$ ${(revenue / 100).toFixed(2)} em receita confirmada. Escreva 3-4 frases com análise e recomendações.`,
    }],
  })

  const content = msg.content[0].type === "text" ? msg.content[0].text : ""
  if (!content) return 0

  await admin.from("business_insights").insert({
    business_id: businessId,
    insight_type: "weekly_narrative",
    content,
    period_start: periodStart.toISOString().split("T")[0],
    period_end: periodEnd.toISOString().split("T")[0],
  } as never)

  return 1
}

async function preWarmCaches(businessId: string): Promise<void> {
  invalidateContext(businessId)
  await getBusinessContext(businessId)
}
