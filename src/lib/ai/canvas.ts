import Anthropic from "@anthropic-ai/sdk"
import { getBusinessContext } from "./brain"
import { createAdminClient } from "@/lib/supabase/admin"
import { TAG, delimit, DELIMITER_PREAMBLE } from "./delimiter"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Graph-ready analytics ──────────────────────────────────────────────────
// The canvas model can only draw graphs that "reflect the business" if it is
// given real, aggregated time-series — not just a point-in-time snapshot. This
// gathers 30 days of trends straight from the database (cents → reais).

const WORK_ITEM_STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  scheduled: "Agendado",
  pending_confirmation: "Aguardando confirmação",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  waiting_customer: "Aguardando cliente",
  waiting_parts: "Aguardando peças",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
}

interface CanvasAnalytics {
  periodDays: number
  revenue: { total: number; previous: number; paidCount: number; avgTicket: number }
  revenueByDay: Array<{ date: string; revenue: number }>
  itemsByDay: Array<{ date: string; count: number }>
  statusBreakdown: Array<{ status: string; label: string; count: number }>
  topServices: Array<{ name: string; count: number; revenue: number }>
  payments: { paidCount: number; paidTotal: number; pendingCount: number; pendingTotal: number }
  customers: { total: number; newThisMonth: number; returning: number }
  conversations: { total: number; open: number; aiHandled: number }
}

const toReais = (cents: number) => Math.round(cents) / 100

export async function getCanvasAnalytics(businessId: string, daysBack = 30): Promise<CanvasAnalytics> {
  const admin = createAdminClient()

  const now = new Date()
  const curStart = new Date(now); curStart.setDate(curStart.getDate() - daysBack); curStart.setHours(0, 0, 0, 0)
  const prevEnd = new Date(curStart)
  const prevStart = new Date(curStart); prevStart.setDate(prevStart.getDate() - daysBack)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const results = await Promise.allSettled([
    // 0: paid payments current period
    admin.from("payments").select("amount, paid_at").eq("business_id", businessId)
      .eq("status", "paid").gte("paid_at", curStart.toISOString()).order("paid_at", { ascending: true }),
    // 1: paid payments previous period
    admin.from("payments").select("amount").eq("business_id", businessId)
      .eq("status", "paid").gte("paid_at", prevStart.toISOString()).lt("paid_at", prevEnd.toISOString()),
    // 2: pending payments
    admin.from("payments").select("amount").eq("business_id", businessId).eq("status", "pending"),
    // 3: work items in current period (for items/day)
    admin.from("work_items").select("scheduled_start").eq("business_id", businessId)
      .neq("status", "cancelled").gte("scheduled_start", curStart.toISOString()),
    // 4: all work items (status breakdown)
    admin.from("work_items").select("status").eq("business_id", businessId),
    // 5: work items with service for top services
    admin.from("work_items").select("service_id").eq("business_id", businessId).not("service_id", "is", null),
    // 6: services (name + price)
    admin.from("services").select("id, name, price").eq("business_id", businessId),
    // 7: customers
    admin.from("customers").select("visit_count, created_at, status").eq("business_id", businessId),
    // 8: conversations
    admin.from("conversations").select("status, ai_active").eq("business_id", businessId),
  ])

  const val = <T,>(i: number): T[] =>
    results[i].status === "fulfilled" ? ((results[i] as PromiseFulfilledResult<{ data: T[] | null }>).value.data ?? []) : []

  const curPayments = val<{ amount: number; paid_at: string | null }>(0)
  const prevPayments = val<{ amount: number }>(1)
  const pendingPayments = val<{ amount: number }>(2)
  const itemsPeriod = val<{ scheduled_start: string | null }>(3)
  const allItems = val<{ status: string }>(4)
  const serviceItems = val<{ service_id: string | null }>(5)
  const services = val<{ id: string; name: string; price: number | null }>(6)
  const customers = val<{ visit_count: number | null; created_at: string; status: string }>(7)
  const conversations = val<{ status: string; ai_active: boolean }>(8)

  // Revenue
  const revenueTotal = curPayments.reduce((s, p) => s + (p.amount ?? 0), 0)
  const revenuePrev = prevPayments.reduce((s, p) => s + (p.amount ?? 0), 0)
  const paidCount = curPayments.length
  const avgTicket = paidCount > 0 ? Math.round(revenueTotal / paidCount) : 0

  // Daily series (zero-filled across the whole window so charts have a continuous axis)
  const revByDay: Record<string, number> = {}
  for (const p of curPayments) {
    if (!p.paid_at) continue
    const d = p.paid_at.slice(0, 10)
    revByDay[d] = (revByDay[d] ?? 0) + (p.amount ?? 0)
  }
  const itemByDay: Record<string, number> = {}
  for (const it of itemsPeriod) {
    if (!it.scheduled_start) continue
    const d = it.scheduled_start.slice(0, 10)
    itemByDay[d] = (itemByDay[d] ?? 0) + 1
  }
  const revenueByDay: Array<{ date: string; revenue: number }> = []
  const itemsByDay: Array<{ date: string; count: number }> = []
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    revenueByDay.push({ date: key, revenue: toReais(revByDay[key] ?? 0) })
    itemsByDay.push({ date: key, count: itemByDay[key] ?? 0 })
  }

  // Status breakdown
  const statusCounts: Record<string, number> = {}
  for (const w of allItems) statusCounts[w.status] = (statusCounts[w.status] ?? 0) + 1
  const statusBreakdown = Object.entries(statusCounts)
    .map(([status, count]) => ({ status, label: WORK_ITEM_STATUS_LABELS[status] ?? status, count }))
    .sort((a, b) => b.count - a.count)

  // Top services (count + estimated revenue from service price)
  const svcCount: Record<string, number> = {}
  for (const it of serviceItems) { if (it.service_id) svcCount[it.service_id] = (svcCount[it.service_id] ?? 0) + 1 }
  const svcMap = new Map(services.map(s => [s.id, s]))
  const topServices = Object.entries(svcCount)
    .map(([id, count]) => {
      const s = svcMap.get(id)
      return { name: s?.name ?? "Serviço", count, revenue: toReais((s?.price ?? 0) * count) }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Customers
  const totalCustomers = customers.length
  const newThisMonth = customers.filter(c => new Date(c.created_at) >= monthStart).length
  const returning = customers.filter(c => (c.visit_count ?? 0) > 1).length

  // Conversations
  const totalConversations = conversations.length
  const openConversations = conversations.filter(c => ["open", "waiting", "bot"].includes(c.status)).length
  const aiHandled = conversations.filter(c => c.ai_active).length

  return {
    periodDays: daysBack,
    revenue: { total: toReais(revenueTotal), previous: toReais(revenuePrev), paidCount, avgTicket: toReais(avgTicket) },
    revenueByDay,
    itemsByDay,
    statusBreakdown,
    topServices,
    payments: {
      paidCount,
      paidTotal: toReais(revenueTotal),
      pendingCount: pendingPayments.length,
      pendingTotal: toReais(pendingPayments.reduce((s, p) => s + (p.amount ?? 0), 0)),
    },
    customers: { total: totalCustomers, newThisMonth, returning },
    conversations: { total: totalConversations, open: openConversations, aiHandled },
  }
}

// ─── System prompt ──────────────────────────────────────────────────────────

const CANVAS_SYSTEM = `${DELIMITER_PREAMBLE}

Você é um designer de dashboards da RetornAI. Você retorna APENAS HTML puro autocontido. NENHUM markdown. NENHUM bloco de código. NENHUM texto antes ou depois. O output começa em <!DOCTYPE html> e termina em </html>.

USA APENAS INLINE STYLES (style="..."). NÃO use classes CSS externas. NÃO carregue nenhum CDN. NÃO use Chart.js nem <canvas> — gráficos SEMPRE em SVG puro.

IDENTIDADE VISUAL RETORNAI (tema claro e quente — use estes valores exatos em style=""):
- Fundo da página: background:#FBF8F3
- Fundo dos cards: background:#FFFFFF
- Fundo suave / destaque: background:#FFF1E8
- Bordas: border:1px solid #ECE5D8
- Texto principal: color:#181613
- Texto secundário: color:#4F4A42
- Texto terciário / labels: color:#8C857A
- Laranja da marca (accent principal, barras, linhas): #E85D1F
- Laranja escuro (hover/títulos de destaque): #C44A12
- Verde positivo (alta, sucesso): #2F7D5B
- Vermelho negativo (queda, cancelado): #C0392F
- Amarelo neutro (atenção): #C77E0A
- Azul informação: #2E6BAA
- Sombra dos cards: box-shadow:0 1px 2px rgba(30,20,10,.04)
- Raio das bordas: border-radius:14px (cards), 10px (elementos menores)
- Fonte: font-family:system-ui,-apple-system,'Segoe UI',sans-serif

ESTRUTURA DO ARQUIVO:
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório RetornAI</title></head>
<body style="margin:0;padding:28px;background:#FBF8F3;color:#181613;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;min-height:100vh">

... todo o conteúdo aqui dentro de <div style="max-width:900px;margin:0 auto"> com inline styles ...

</body>
</html>

COMPONENTES OBRIGATÓRIOS:

1. HEADER: linha (display:flex;align-items:center;justify-content:space-between;margin-bottom:28px) com o nome do negócio à esquerda (font-size:22px;font-weight:700;color:#181613) e um badge "✦ Gerado por IA" à direita (color:#E85D1F;font-size:11px;font-family:monospace;background:#FFF1E8;padding:5px 12px;border-radius:20px;border:1px solid #FEEBE0).

2. CARDS DE MÉTRICAS: um grid (display:flex;gap:16px;margin-bottom:28px) com 3–4 cards lado a lado. Cada card:
   style="background:#FFFFFF;border:1px solid #ECE5D8;border-radius:14px;padding:20px;flex:1;box-shadow:0 1px 2px rgba(30,20,10,.04)"
   Conteúdo: label pequeno (color:#8C857A;font-size:11px;text-transform:uppercase;letter-spacing:.06em), número grande (font-size:30px;font-weight:700;color:#181613;margin:8px 0), variação colorida (verde #2F7D5B se positiva com ▲, vermelha #C0392F se negativa com ▼).

3. GRÁFICOS EM SVG PURO — use SEMPRE os dados reais fornecidos:
   a) LINHA/ÁREA (receita por dia): use revenueByDay. Desenhe um <svg width="100%" viewBox="0 0 900 220" preserveAspectRatio="none"> com <polyline> (stroke:#E85D1F;stroke-width:2;fill:none) e uma área preenchida abaixo (fill com opacidade baixa, ex: fill:#E85D1F com fill-opacity:.08). Calcule os pontos proporcionalmente ao valor máximo. Mostre alguns rótulos de data no eixo X (color:#8C857A;font-size:10px).
   b) BARRAS (itens por dia, ou top serviços): <svg width="100%" height="200"> com um <rect> por barra (fill:#E85D1F;rx:4), <text> com o valor acima e o rótulo abaixo (color:#8C857A;font-size:10px). Alturas proporcionais ao máximo.
   c) ROSCA/PIZZA (statusBreakdown ou conversas): <circle> com stroke-dasharray, ou barras horizontais com <rect>. Alterne as cores: #E85D1F, #2F7D5B, #2E6BAA, #C77E0A, #C0392F, #8C857A.
   Cada gráfico vai dentro de um card (mesmo estilo dos cards de métrica) com um subtítulo. Se todos os valores forem zero, desenhe o eixo com barras/linha zeradas e escreva "Sem dados no período".

4. TABELA (top serviços ou clientes, se houver dados):
   style="width:100%;border-collapse:collapse;background:#FFFFFF;border:1px solid #ECE5D8;border-radius:14px;overflow:hidden"
   Cabeçalho: background:#FFF1E8;color:#4F4A42;font-size:11px;text-transform:uppercase. Células: padding:10px 14px;border-bottom:1px solid #ECE5D8;color:#181613;font-size:13px.

5. INSIGHTS: 1–3 cards com borda esquerda laranja (background:#FFFFFF;border:1px solid #ECE5D8;border-left:3px solid #E85D1F;border-radius:10px;padding:14px 16px) com uma recomendação curta e acionável baseada nos números reais.

LAYOUT GERAL:
- Espaço entre seções: margin-bottom:28px
- Subtítulos de seção: font-size:13px;font-weight:600;color:#8C857A;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px

REGRAS DE DADOS:
- Use SOMENTE os números reais do contexto. Valores monetários já vêm em reais (R$) — formate como "R$ 1.234,56". NUNCA invente dados. Se um valor for zero, exiba zero.
- Os gráficos devem refletir as séries reais (revenueByDay, itemsByDay, statusBreakdown, topServices). Não desenhe formas decorativas que não correspondam aos dados.
Termine com </body></html>.`

export async function generateCanvas(
  businessId: string,
  prompt: string,
): Promise<ReadableStream<Uint8Array>> {
  const [ctx, analytics] = await Promise.all([
    getBusinessContext(businessId),
    getCanvasAnalytics(businessId, 30),
  ])

  const contextData = JSON.stringify({
    business: { name: ctx.business.name, type: ctx.business.type, city: ctx.business.city },
    moeda: "BRL (valores em reais)",
    periodo: `últimos ${analytics.periodDays} dias`,
    metricasHoje: ctx.metrics,
    topClientes: ctx.topCustomers?.slice(0, 8).map(c => ({
      nome: c.full_name,
      total_gasto: toReais(c.total_spent),
      visitas: c.visit_count,
    })),
    analytics,
  })

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8000,
    system: CANVAS_SYSTEM,
    messages: [{
      role: "user",
      content: `Dados reais do negócio (use-os nos gráficos):\n${contextData}\n\n${delimit(TAG.userRequest, prompt)}`,
    }],
  })

  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }
      controller.close()
    },
  })
}
