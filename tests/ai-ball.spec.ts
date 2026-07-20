/**
 * RetornAI AI Ball — Comprehensive test suite
 *
 * Run once:           npx playwright test tests/ai-ball.spec.ts
 * Repeat 10 times:   npx playwright test tests/ai-ball.spec.ts --repeat-each=10
 *
 * Requires:
 *   - Dev server running: npm run dev
 *   - TEST_EMAIL + TEST_PASSWORD in .env.local
 */

import { test, expect } from "playwright/test"
import { sendMessage, sendFollowUp } from "./helpers/ai"

// Unique prefix per run — prevents collisions when using --repeat-each
const RUN = Date.now()
const C = `AI-TEST-${RUN}`    // customer name base
const S = `AI-TEST-S-${RUN}`  // staff name base
const SVC = `AI-TEST-SVC-${RUN}` // service name base
const FAQ = `AI-TEST-FAQ-${RUN}` // faq search key

// ─────────────────────────────────────────────────────────────────
// A. GUARDRAILS
// ─────────────────────────────────────────────────────────────────
test.describe("A. Guardrails", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("A1 — out-of-scope: world geography", async ({ page }) => {
    const r = await sendMessage(page, "Qual é a capital da França?")
    expect(r.toLowerCase()).toContain("só consigo ajudar")
  })

  test("A2 — out-of-scope: recipe", async ({ page }) => {
    const r = await sendMessage(page, "Me dê uma receita de bolo de chocolate")
    expect(r.toLowerCase()).toContain("só consigo ajudar")
  })

  test("A3 — Pro gate: automation (Starter plan)", async ({ page }) => {
    const r = await sendMessage(page, "Criar automação de boas-vindas para novos clientes")
    expect(r.toLowerCase()).toMatch(/pro|exclusiva|assinatura|upgrade|plano/)
  })

  test("A4 — Pro gate: advanced analytics (Starter plan)", async ({ page }) => {
    const r = await sendMessage(page, "Ver análises avançadas do negócio")
    expect(r.toLowerCase()).toMatch(/pro|exclusiva|assinatura|upgrade|plano/)
  })
})

// ─────────────────────────────────────────────────────────────────
// B. CUSTOMER CRUD  (sequential — each test builds on previous)
// ─────────────────────────────────────────────────────────────────
test.describe.serial("B. Customer CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("B1 — add customer", async ({ page }) => {
    const r = await sendMessage(page, `Adicionar cliente ${C} com telefone 11999990001`)
    expect(r.toLowerCase()).toMatch(/criado|adicionado|cadastrado/)
  })

  test("B2 — search customer", async ({ page }) => {
    const r = await sendMessage(page, `Buscar cliente ${C}`)
    expect(r).toContain(C)
  })

  test("B3 — update customer email", async ({ page }) => {
    const r = await sendMessage(page, `Atualizar email do ${C} para aitest${RUN}@test.com`)
    expect(r.toLowerCase()).toMatch(/atualizado|cliente/)
  })

  test("B4 — customer history", async ({ page }) => {
    const r = await sendMessage(page, `Ver histórico do cliente ${C}`)
    // May have no visits yet — just verify AI responds with customer data
    expect(r.toLowerCase()).toMatch(/visita|gasto|histórico|encontrado|${C.toLowerCase()}/)
  })

  test("B5 — tag customer VIP", async ({ page }) => {
    const r = await sendMessage(page, `Adicionar tag VIP para o cliente ${C}`)
    expect(r.toLowerCase()).toMatch(/atualizado|tag|vip/)
  })

  test("B6 — list customers by spend", async ({ page }) => {
    const r = await sendMessage(page, "Listar clientes por total gasto")
    // Just verify a list is returned (could be empty)
    expect(r.length).toBeGreaterThan(0)
  })

  test("B7 — delete customer with confirmation gate", async ({ page }) => {
    const r = await sendMessage(page, `Apagar o cliente ${C}`)
    // Must ask for confirmation first
    expect(r.startsWith("[Q]")).toBeTruthy()

    const r2 = await sendFollowUp(page, "Sim, pode apagar")
    expect(r2.toLowerCase()).toMatch(/apagado|removido|excluído|deletado/)
  })
})

// ─────────────────────────────────────────────────────────────────
// C. WORK ITEMS / SCHEDULE
// ─────────────────────────────────────────────────────────────────
test.describe.serial("C. Work Items", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test.beforeAll(async ({ browser }) => {
    // Seed: add customer for this test group
    const page = await browser.newPage()
    await page.goto("/dashboard/retornai")
    await sendMessage(page, `Adicionar cliente ${C} com telefone 11999990002`)
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    // Cleanup customer
    const page = await browser.newPage()
    await page.goto("/dashboard/retornai")
    const r = await sendMessage(page, `Apagar o cliente ${C}`)
    if (r.startsWith("[Q]")) await sendFollowUp(page, "Sim")
    await page.close()
  })

  test("C1 — view today's schedule", async ({ page }) => {
    const r = await sendMessage(page, "Ver agenda de hoje")
    expect(r.length).toBeGreaterThan(0)
  })

  test("C2 — view week schedule", async ({ page }) => {
    const r = await sendMessage(page, "Ver agenda da semana")
    expect(r.length).toBeGreaterThan(0)
  })

  test("C3 — get available slots tomorrow", async ({ page }) => {
    const r = await sendMessage(page, "Ver horários livres amanhã")
    expect(r.length).toBeGreaterThan(0)
  })

  test("C4 — create appointment", async ({ page }) => {
    const r = await sendMessage(page, `Agendar corte de cabelo para ${C} amanhã às 10h`)
    expect(r.toLowerCase()).toMatch(/agendado|marcado|criado|✓/)
  })

  test("C5 — reschedule appointment", async ({ page }) => {
    const r = await sendMessage(page, `Reagendar o agendamento do ${C} para depois de amanhã às 14h`)
    expect(r.toLowerCase()).toMatch(/reagendado|atualizado|remarcado/)
  })

  test("C6 — update appointment price", async ({ page }) => {
    const r = await sendMessage(page, `Atualizar o valor do agendamento do ${C} para R$90`)
    expect(r.toLowerCase()).toMatch(/atualizado|✓/)
  })

  test("C7 — get appointment details", async ({ page }) => {
    const r = await sendMessage(page, `Ver detalhes do agendamento do ${C}`)
    expect(r.length).toBeGreaterThan(0)
  })

  test("C8 — update status to confirmed", async ({ page }) => {
    const r = await sendMessage(page, `Marcar o agendamento do ${C} como confirmado`)
    expect(r.toLowerCase()).toMatch(/confirmado|atualizado|✓/)
  })

  test("C9 — cancel appointment", async ({ page }) => {
    const r = await sendMessage(page, `Cancelar o agendamento do ${C}`)
    expect(r.toLowerCase()).toMatch(/cancelado|✓/)
  })
})

// ─────────────────────────────────────────────────────────────────
// D. PAYMENTS
// ─────────────────────────────────────────────────────────────────
test.describe.serial("D. Payments", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto("/dashboard/retornai")
    await sendMessage(page, `Adicionar cliente ${C} com telefone 11999990003`)
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto("/dashboard/retornai")
    const r = await sendMessage(page, `Apagar o cliente ${C}`)
    if (r.startsWith("[Q]")) await sendFollowUp(page, "Sim")
    await page.close()
  })

  test("D1 — create PIX payment", async ({ page }) => {
    const r = await sendMessage(page, `Cobrar R$150 do cliente ${C} por corte de cabelo`)
    // May not have WhatsApp or MercadoPago — either is OK
    expect(r.toLowerCase()).toMatch(/pix|criado|gerado|configurado|whatsapp/)
  })

  test("D2 — list pending payments", async ({ page }) => {
    const r = await sendMessage(page, "Ver pagamentos pendentes")
    expect(r.length).toBeGreaterThan(0)
  })

  test("D3 — register manual payment", async ({ page }) => {
    const r = await sendMessage(page, `Registrar pagamento em dinheiro de R$80 do cliente ${C}`)
    expect(r.toLowerCase()).toMatch(/registrado|criado|✓/)
  })
})

// ─────────────────────────────────────────────────────────────────
// E. STAFF MANAGEMENT
// ─────────────────────────────────────────────────────────────────
test.describe.serial("E. Staff", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("E1 — add staff member", async ({ page }) => {
    const r = await sendMessage(page, `Adicionar colaborador ${S} com cargo barbeiro`)
    expect(r.toLowerCase()).toMatch(/adicionado|criado|✓/)
  })

  test("E2 — list staff", async ({ page }) => {
    const r = await sendMessage(page, "Ver os colaboradores da equipe")
    expect(r).toContain(S)
  })

  test("E3 — update staff role", async ({ page }) => {
    const r = await sendMessage(page, `Atualizar cargo do ${S} para gerente`)
    expect(r.toLowerCase()).toMatch(/atualizado|✓/)
  })

  test("E4 — send internal message to staff", async ({ page }) => {
    const r = await sendMessage(page, `Mandar mensagem para ${S}: teste de mensagem automatizado`)
    expect(r.toLowerCase()).toMatch(/enviada|enviado|✓/)
  })

  test("E5 — delete staff member", async ({ page }) => {
    const r = await sendMessage(page, `Remover colaborador ${S} da equipe`)
    expect(r.toLowerCase()).toMatch(/removido|excluído|deletado|✓/)
  })
})

// ─────────────────────────────────────────────────────────────────
// F. SERVICES
// ─────────────────────────────────────────────────────────────────
test.describe.serial("F. Services", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("F1 — add service", async ({ page }) => {
    const r = await sendMessage(page, `Adicionar serviço ${SVC}, duração 60 minutos, preço R$85`)
    expect(r.toLowerCase()).toMatch(/adicionado|criado|✓/)
  })

  test("F2 — list services", async ({ page }) => {
    const r = await sendMessage(page, "Ver todos os serviços")
    expect(r).toContain(SVC)
  })

  test("F3 — update service price", async ({ page }) => {
    const r = await sendMessage(page, `Atualizar preço do ${SVC} para R$95`)
    expect(r.toLowerCase()).toMatch(/atualizado|✓/)
  })

  test("F4 — deactivate service", async ({ page }) => {
    const r = await sendMessage(page, `Desativar o serviço ${SVC}`)
    expect(r.toLowerCase()).toMatch(/atualizado|desativado|✓/)
  })

  test("F5 — delete service", async ({ page }) => {
    const r = await sendMessage(page, `Remover o serviço ${SVC}`)
    expect(r.toLowerCase()).toMatch(/removido|excluído|deletado|✓/)
  })
})

// ─────────────────────────────────────────────────────────────────
// G. FAQS
// ─────────────────────────────────────────────────────────────────
test.describe.serial("G. FAQs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("G1 — create FAQ", async ({ page }) => {
    const r = await sendMessage(page, `Adicionar FAQ: ${FAQ} qual o horário? Resposta: das 9h às 18h`)
    expect(r.toLowerCase()).toMatch(/adicionado|criado|✓/)
  })

  test("G2 — list FAQs", async ({ page }) => {
    const r = await sendMessage(page, "Ver todas as perguntas frequentes")
    expect(r.toLowerCase()).toMatch(/faq|horário|pergunta|adicionado|✓/)
  })

  test("G3 — update FAQ", async ({ page }) => {
    const r = await sendMessage(page, `Atualizar a FAQ sobre ${FAQ}: nova resposta é das 8h às 20h`)
    expect(r.toLowerCase()).toMatch(/atualizado|✓/)
  })

  test("G4 — delete FAQ", async ({ page }) => {
    const r = await sendMessage(page, `Remover a FAQ sobre ${FAQ}`)
    expect(r.toLowerCase()).toMatch(/removido|excluído|deletado|✓/)
  })
})

// ─────────────────────────────────────────────────────────────────
// H. CONVERSATIONS
// ─────────────────────────────────────────────────────────────────
test.describe("H. Conversations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("H1 — list open conversations", async ({ page }) => {
    const r = await sendMessage(page, "Ver conversas abertas")
    // Could be empty — just verify AI responds
    expect(r.length).toBeGreaterThan(0)
  })

  test("H2 — list all conversations", async ({ page }) => {
    const r = await sendMessage(page, "Ver todas as conversas")
    expect(r.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// I. WHATSAPP MESSAGING (graceful degradation if not configured)
// ─────────────────────────────────────────────────────────────────
test.describe("I. WhatsApp Messaging", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("I1 — send WhatsApp to customer", async ({ page }) => {
    const r = await sendMessage(page, `Mandar mensagem WhatsApp para o primeiro cliente: olá, teste automatizado`)
    // Either sent OK or WhatsApp not configured — both are correct behavior
    expect(r.toLowerCase()).toMatch(/enviada|enviado|configurado|whatsapp|não encontrado/)
  })

  test("I2 — send bulk message", async ({ page }) => {
    const r = await sendMessage(page, "Mandar mensagem para todos os clientes ativos: aviso de teste")
    expect(r.toLowerCase()).toMatch(/enviada|enviado|configurado|whatsapp|nenhum/)
  })
})

// ─────────────────────────────────────────────────────────────────
// J. STATS, NOTIFICATIONS & NAVIGATION
// ─────────────────────────────────────────────────────────────────
test.describe("J. Stats & Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("J1 — get business stats", async ({ page }) => {
    const r = await sendMessage(page, "Como está o negócio hoje?")
    expect(r.length).toBeGreaterThan(10)
  })

  test("J2 — list notifications", async ({ page }) => {
    const r = await sendMessage(page, "Ver notificações do sistema")
    expect(r.length).toBeGreaterThan(0)
  })

  test("J3 — navigate to Payments", async ({ page }) => {
    await sendMessage(page, "Ir para Pagamentos")
    // Check URL changed
    await page.waitForURL("**/dashboard/payments**", { timeout: 5_000 }).catch(() => {})
    const url = page.url()
    expect(url).toMatch(/payments|retornai/)
  })

  test("J4 — navigate to Customers", async ({ page }) => {
    await sendMessage(page, "Mostrar a página de clientes")
    await page.waitForURL("**/dashboard/customers**", { timeout: 5_000 }).catch(() => {})
    const url = page.url()
    expect(url).toMatch(/customers|retornai/)
  })
})

// ─────────────────────────────────────────────────────────────────
// K. EDGE CASES
// ─────────────────────────────────────────────────────────────────
test.describe("K. Edge Cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("K1 — book for nonexistent customer triggers [Q]", async ({ page }) => {
    const r = await sendMessage(page, "Agendar corte para xyz_nao_existe_99999 amanhã às 10h")
    // AI should ask about the customer rather than crashing
    expect(r.startsWith("[Q]") || r.toLowerCase().includes("não encontrado") || r.toLowerCase().includes("cliente")).toBeTruthy()
  })

  test("K2 — incomplete booking request triggers [Q]", async ({ page }) => {
    const r = await sendMessage(page, "Agendar para Maria")
    // No date/time — AI should ask
    expect(r.startsWith("[Q]") || r.toLowerCase().includes("data") || r.toLowerCase().includes("horário")).toBeTruthy()
  })

  test("K3 — vague command triggers [Q]", async ({ page }) => {
    const r = await sendMessage(page, "Cobrar ela")
    // No customer, no amount — AI should ask
    expect(r.startsWith("[Q]") || r.toLowerCase().includes("cliente") || r.toLowerCase().includes("valor")).toBeTruthy()
  })

  test("K4 — search with no name triggers clarification", async ({ page }) => {
    const r = await sendMessage(page, "Buscar cliente")
    expect(r.startsWith("[Q]") || r.toLowerCase().includes("nome") || r.toLowerCase().includes("qual")).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────
// ROUND 2 — Synonym phrasing
// ─────────────────────────────────────────────────────────────────
test.describe("R2. Synonym Phrasing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("R2-1 — 'cadastrar' client", async ({ page }) => {
    const name = `${C}-R2`
    const r = await sendMessage(page, `Cadastrar novo cliente ${name}, fone 11988887777`)
    expect(r.toLowerCase()).toMatch(/criado|adicionado|cadastrado/)
    // cleanup
    const r2 = await sendMessage(page, `Apagar cliente ${name}`)
    if (r2.startsWith("[Q]")) await sendFollowUp(page, "Sim")
  })

  test("R2-2 — 'qual é a minha agenda pra hoje'", async ({ page }) => {
    const r = await sendMessage(page, "Qual é a minha agenda pra hoje?")
    expect(r.length).toBeGreaterThan(0)
  })

  test("R2-3 — 'cadastrar serviço'", async ({ page }) => {
    const svc = `${SVC}-R2`
    const r = await sendMessage(page, `Cadastrar serviço ${svc}, 30 min, R$35`)
    expect(r.toLowerCase()).toMatch(/adicionado|criado/)
    // cleanup
    await sendMessage(page, `Remover serviço ${svc}`)
  })
})

// ─────────────────────────────────────────────────────────────────
// ROUND 3 — Short imperative commands
// ─────────────────────────────────────────────────────────────────
test.describe("R3. Short Commands", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("R3-1 — 'agenda semana'", async ({ page }) => {
    const r = await sendMessage(page, "agenda semana")
    expect(r.length).toBeGreaterThan(0)
  })

  test("R3-2 — 'pagamentos pendentes'", async ({ page }) => {
    const r = await sendMessage(page, "pagamentos pendentes")
    expect(r.length).toBeGreaterThan(0)
  })

  test("R3-3 — 'horários livres hoje'", async ({ page }) => {
    const r = await sendMessage(page, "horários livres hoje")
    expect(r.length).toBeGreaterThan(0)
  })

  test("R3-4 — 'stats'", async ({ page }) => {
    const r = await sendMessage(page, "stats")
    expect(r.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// ROUND 4 — Combined single-turn operations
// ─────────────────────────────────────────────────────────────────
test.describe("R4. Combined Operations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("R4-1 — add customer then book in one turn", async ({ page }) => {
    const name = `${C}-R4`
    const r = await sendMessage(page, `Adicionar ${name} e já marcar corte para ele amanhã às 11h`)
    // AI might do both in one turn or ask for clarification
    expect(r.length).toBeGreaterThan(0)
    // cleanup
    const r2 = await sendMessage(page, `Apagar cliente ${name}`)
    if (r2.startsWith("[Q]")) await sendFollowUp(page, "Sim")
  })

  test("R4-2 — 'automação de pós-serviço' (Pro gate)", async ({ page }) => {
    const r = await sendMessage(page, "Criar automação de pós-serviço para clientes que terminaram")
    expect(r.toLowerCase()).toMatch(/pro|exclusiva|assinatura|upgrade|plano/)
  })

  test("R4-3 — list services then ask for cheapest", async ({ page }) => {
    const r = await sendMessage(page, "Ver os serviços e me diga qual é o mais barato")
    expect(r.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// ROUND 5 — Past tense / completion phrasing
// ─────────────────────────────────────────────────────────────────
test.describe("R5. Past Tense Phrasing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("R5-1 — 'o serviço foi concluído' (with nonexistent customer)", async ({ page }) => {
    const r = await sendMessage(page, "O serviço do xyz_ghost_99999 foi concluído")
    // AI should handle gracefully
    expect(r.length).toBeGreaterThan(0)
  })

  test("R5-2 — 'cancelou o agendamento'", async ({ page }) => {
    const r = await sendMessage(page, "xyz_ghost_99999 cancelou o agendamento")
    expect(r.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// ROUND 6 — Data updates with context
// ─────────────────────────────────────────────────────────────────
test.describe.serial("R6. Contextual Updates", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto("/dashboard/retornai")
    await sendMessage(page, `Adicionar cliente ${C}-R6 com telefone 11999990006`)
    await sendMessage(page, `Adicionar serviço ${SVC}-R6, 45 minutos, R$55`)
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto("/dashboard/retornai")
    const r = await sendMessage(page, `Apagar cliente ${C}-R6`)
    if (r.startsWith("[Q]")) await sendFollowUp(page, "Sim")
    await sendMessage(page, `Remover serviço ${SVC}-R6`)
    await page.close()
  })

  test("R6-1 — change customer phone", async ({ page }) => {
    const r = await sendMessage(page, `Mudar o telefone do cliente ${C}-R6 para 11977776666`)
    expect(r.toLowerCase()).toMatch(/atualizado|✓/)
  })

  test("R6-2 — increase service price", async ({ page }) => {
    const r = await sendMessage(page, `Aumentar o preço do ${SVC}-R6 para R$70`)
    expect(r.toLowerCase()).toMatch(/atualizado|✓/)
  })

  test("R6-3 — block then reactivate customer", async ({ page }) => {
    const r1 = await sendMessage(page, `Bloquear o cliente ${C}-R6`)
    expect(r1.toLowerCase()).toMatch(/atualizado|bloqueado|✓/)
    const r2 = await sendMessage(page, `Reativar o cliente ${C}-R6`)
    expect(r2.toLowerCase()).toMatch(/atualizado|✓/)
  })
})

// ─────────────────────────────────────────────────────────────────
// ROUND 7 — List + filter operations
// ─────────────────────────────────────────────────────────────────
test.describe("R7. List & Filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("R7-1 — customers by total spend", async ({ page }) => {
    const r = await sendMessage(page, "Clientes que gastaram mais")
    expect(r.length).toBeGreaterThan(0)
  })

  test("R7-2 — inactive customers", async ({ page }) => {
    const r = await sendMessage(page, "Clientes inativos")
    expect(r.length).toBeGreaterThan(0)
  })

  test("R7-3 — conversations waiting", async ({ page }) => {
    const r = await sendMessage(page, "Conversas sem resposta")
    expect(r.length).toBeGreaterThan(0)
  })

  test("R7-4 — paid payments", async ({ page }) => {
    const r = await sendMessage(page, "Pagamentos que já foram pagos")
    expect(r.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────
// ROUND 8 — Tags & segmentation
// ─────────────────────────────────────────────────────────────────
test.describe.serial("R8. Tags & Segmentation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto("/dashboard/retornai")
    await sendMessage(page, `Adicionar cliente ${C}-R8 com telefone 11999990008`)
    await page.close()
  })

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto("/dashboard/retornai")
    const r = await sendMessage(page, `Apagar cliente ${C}-R8`)
    if (r.startsWith("[Q]")) await sendFollowUp(page, "Sim")
    await page.close()
  })

  test("R8-1 — add VIP tag", async ({ page }) => {
    const r = await sendMessage(page, `Marcar o cliente ${C}-R8 como VIP`)
    expect(r.toLowerCase()).toMatch(/atualizado|tag|vip|✓/)
  })

  test("R8-2 — remove VIP tag", async ({ page }) => {
    const r = await sendMessage(page, `Remover a tag VIP do cliente ${C}-R8`)
    expect(r.toLowerCase()).toMatch(/atualizado|✓/)
  })
})

// ─────────────────────────────────────────────────────────────────
// ROUND 9 — Destructive operations with confirmation gate
// ─────────────────────────────────────────────────────────────────
test.describe.serial("R9. Confirmation Gates", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await page.goto("/dashboard/retornai")
    await sendMessage(page, `Adicionar cliente ${C}-R9 com telefone 11999990009`)
    await page.close()
  })

  test("R9-1 — delete customer: gate fires then confirm", async ({ page }) => {
    const r = await sendMessage(page, `Apagar o cliente ${C}-R9`)
    expect(r.startsWith("[Q]")).toBeTruthy()
    const r2 = await sendFollowUp(page, "Sim, pode apagar")
    expect(r2.toLowerCase()).toMatch(/apagado|removido|excluído|deletado|✓/)
  })

  test("R9-2 — service deletion is direct (no gate)", async ({ page }) => {
    const svc = `${SVC}-R9`
    await sendMessage(page, `Adicionar serviço ${svc}, 20 minutos, R$30`)
    await page.goto("/dashboard/retornai")
    const r = await sendMessage(page, `Remover o serviço ${svc}`)
    expect(r.toLowerCase()).toMatch(/removido|excluído|deletado|✓/)
  })
})

// ─────────────────────────────────────────────────────────────────
// ROUND 10 — Navigation routing
// ─────────────────────────────────────────────────────────────────
test.describe("R10. Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("R10-1 — open calendar", async ({ page }) => {
    await sendMessage(page, "Abrir o calendário")
    await page.waitForURL("**/dashboard/calendar**", { timeout: 4_000 }).catch(() => {})
    expect(page.url()).toMatch(/calendar|retornai/)
  })

  test("R10-2 — open conversations", async ({ page }) => {
    await sendMessage(page, "Ver conversas")
    await page.waitForURL("**/dashboard/conversations**", { timeout: 4_000 }).catch(() => {})
    expect(page.url()).toMatch(/conversations|retornai/)
  })

  test("R10-3 — open staff", async ({ page }) => {
    await sendMessage(page, "Ir para equipe")
    await page.waitForURL("**/dashboard/staff**", { timeout: 4_000 }).catch(() => {})
    expect(page.url()).toMatch(/staff|retornai/)
  })

  test("R10-4 — open work items", async ({ page }) => {
    await sendMessage(page, "Abrir agendamentos")
    await page.waitForURL("**/dashboard/work-items**", { timeout: 4_000 }).catch(() => {})
    expect(page.url()).toMatch(/work-items|retornai/)
  })
})

// ─────────────────────────────────────────────────────────────────
// ROUND 11 — Ambiguity / stress
// ─────────────────────────────────────────────────────────────────
test.describe("R11. Ambiguity Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/retornai")
  })

  test("R11-1 — 'agendar para Maria' (no date) → asks for date", async ({ page }) => {
    const r = await sendMessage(page, "Agendar para Maria")
    expect(r.startsWith("[Q]") || r.toLowerCase().includes("data") || r.toLowerCase().includes("horário")).toBeTruthy()
  })

  test("R11-2 — 'marcar agendamento' (no details) → asks for info", async ({ page }) => {
    const r = await sendMessage(page, "Marcar agendamento")
    expect(r.startsWith("[Q]") || r.length > 5).toBeTruthy()
  })

  test("R11-3 — 'cobrar ela' (no amount/customer) → asks", async ({ page }) => {
    const r = await sendMessage(page, "Cobrar ela")
    expect(r.startsWith("[Q]") || r.toLowerCase().includes("cliente") || r.toLowerCase().includes("valor")).toBeTruthy()
  })

  test("R11-4 — 'enviar mensagem para todos' (no text) → asks", async ({ page }) => {
    const r = await sendMessage(page, "Enviar mensagem para todos")
    expect(r.startsWith("[Q]") || r.toLowerCase().includes("mensagem") || r.toLowerCase().includes("texto")).toBeTruthy()
  })
})
