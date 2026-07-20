import Anthropic from "@anthropic-ai/sdk"
import { createAdminClient } from "@/lib/supabase/admin"
import { selectModel, withFallback, TaskComplexity } from "./model-router"
import { logUsage } from "./usage"
import { TAG, delimit } from "./delimiter"
import { dsCreate, dsStream, DS_MODEL, type DSMessage } from "./deepseek"

const contextCache = new Map<string, { data: BusinessContext; expiresAt: number }>()
const briefingCache = new Map<string, { text: string; expiresAt: number }>()
const actionsCache = new Map<string, { actions: Array<{ label: string; href: string; description: string }>; expiresAt: number }>()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Exported Types ────────────────────────────────────────────────────────────

export interface BusinessContext {
  business: {
    id: string
    name: string
    type: string
    phone: string | null
    whatsapp_number: string | null
    address: string | null
    city: string | null
    opening_hours: unknown
    settings: unknown
  }
  services: Array<{ id: string; name: string; duration_minutes: number; price: number }>
  staff: Array<{ id: string; name: string; role: string }>
  faqs: Array<{ question: string; answer: string }>
  skills: Array<{ name: string; content: string }>
  metrics: {
    todayItems: number
    openConversations: number
    todayRevenue: number
    pendingPayments: number
    totalCustomers: number
  }
  topCustomers: Array<{ id: string; full_name: string; total_spent: number; visit_count: number }>
  recentPayments: Array<{ id: string; amount: number; status: string; created_at: string }>
  upcomingItems: Array<{
    id: string
    title: string
    status: string
    scheduled_start: string | null
    customer_name: string | null
    service_name: string | null
  }>
  recentEquipment: Array<{ id: string; name: string; brand: string | null; model: string | null; customer_name: string | null; condition: string }>
  documents: Array<{ id: string; title: string | null; description: string | null; category: string | null; file_name: string; analyzed: boolean }>
}

export interface CustomerInsight {
  segment: string
  ltv_estimate: number
  churn_risk: "low" | "medium" | "high"
  churn_reason: string | null
  upsell_suggestion: string | null
  summary: string
}

export interface ConversationInsight {
  intent: string
  sentiment: "positive" | "neutral" | "negative"
  urgency: "low" | "medium" | "high"
  suggested_reply: string
  summary: string
}

export interface WorkItemRisk {
  no_show_risk: "low" | "medium" | "high"
  payment_risk: "low" | "medium" | "high"
  no_show_reason: string | null
  payment_reason: string | null
  overall_score: number
}

export interface AutomationConfig {
  name: string
  trigger_type: string
  message_template: string
  delay_minutes: number
}

// ─── Business-type domain knowledge ───────────────────────────────────────────

function getBusinessTypeContext(type: string): string {
  const map: Record<string, string> = {
    clinic: `
CONTEXTO DO NEGÓCIO — CLÍNICA MÉDICA
Serviços típicos: consultas, retornos, pequenos procedimentos, laudos, atestados, encaminhamentos.
Comportamento do paciente: retornos regulares para crônicos (hipertensos, diabéticos), agendamento espontâneo para agudos. Segunda-feira e pós-feriado têm pico de demanda.
Taxa de no-show: alta (~20-30%). Pacientes costumam cancelar no dia ou simplesmente não aparecer. Confirmação por WhatsApp reduz significativamente.
Ticket médio: R$ 150–400 por consulta particular. Convênios têm valor tabelado menor.
Receita: mix entre particular e convênio. Procedimentos e laudos têm margem maior.
Sinal de churn: paciente que não retorna em 90+ dias após consulta com retorno agendado.
Upsell natural: check-up completo, pacotes de consultas, exames complementares.
Urgências reais: dor aguda, febre alta, sintomas graves. Priorize comunicação imediata.
Métricas-chave: taxa de ocupação da agenda, no-show rate, receita por procedimento, retorno de pacientes crônicos.`,

    dental_clinic: `
CONTEXTO DO NEGÓCIO — CLÍNICA ODONTOLÓGICA
Serviços típicos: limpeza/profilaxia, restauração, extração, canal, clareamento, implante, aparelho ortodôntico, prótese.
Comportamento do paciente: tratamentos longos (canal, ortodontia, implante) geram múltiplos retornos programados. Medo de dentista é real — confirmação acolhedora reduz faltas.
Taxa de no-show: média (~15-25%). Pacientes com medo tendem a evitar o retorno.
Ticket médio: R$ 80 (limpeza) a R$ 5.000+ (implante). Ortodontia e implantes são os maiores geradores de receita.
Receita: tratamentos parcelados são comuns. Implante e aparelho podem ser parcelados em 12–24x.
Sinal de churn: interrupção de tratamento em andamento (canal incompleto, aparelho abandonado) — risco alto de reclamação e perda de receita futura.
Upsell natural: clareamento pós-limpeza, protetor bucal para bruxismo, profilaxia semestral.
Sazonalidade: menos consultas em dezembro-janeiro (férias). Pico em março e agosto.
Métricas-chave: tratamentos iniciados x concluídos, inadimplência em parcelamentos, taxa de retorno pós-procedimento.`,

    aesthetic_clinic: `
CONTEXTO DO NEGÓCIO — CLÍNICA ESTÉTICA
Serviços típicos: botox, preenchimento labial/facial, limpeza de pele, peeling, laser, radiofrequência, depilação a laser, criolipólise, drenagem linfática.
Comportamento do cliente: majoritariamente feminino, retorno mensal ou bimestral para manutenção. Alta influência de redes sociais e indicação entre amigas.
Taxa de no-show: baixa a média (~10-15%). Cliente valoriza o horário mas pode cancelar por motivos estéticos (ex: "estou de TPM").
Ticket médio: R$ 200 (limpeza de pele) a R$ 3.000+ (pacote de laser ou criolipólise).
Receita: pacotes antecipados são comuns e melhoram fluxo de caixa. Fidelização é altíssima quando resultado é bom.
Sinal de churn: ausência por 60+ dias após procedimento que requer manutenção. Clientes insatisfeitas com resultado tendem a sumir sem reclamar.
Upsell natural: pacotes de sessões (10% de desconto), combinação de procedimentos no mesmo dia, produtos home care.
Sazonalidade: pico em outubro-dezembro (verão, festas de fim de ano, Carnaval). Baixa em julho.
Métricas-chave: pacotes vendidos x sessões realizadas, ticket médio por cliente, retenção mensal.`,

    veterinary_clinic: `
CONTEXTO DO NEGÓCIO — CLÍNICA VETERINÁRIA
Serviços típicos: consultas clínicas, vacinação, castração, banho e tosa, internação, cirurgias, exames (sangue, raio-x, ultrassom), emergências.
Comportamento do tutor: alta carga emocional — o pet é tratado como filho. Tutor pode ser difícil de lidar em situações graves. Urgências fora de horário são frequentes.
Taxa de no-show: baixa para consultas agendadas (~5-10%). Tutores comprometidos com a saúde do pet.
Ticket médio: R$ 100 (consulta) a R$ 5.000+ (cirurgia/internação). Internação e cirurgia têm ticket mais alto mas também maior risco de inadimplência pós-serviço.
Receita: vacinação e banho/tosa geram volume. Cirurgias e internações geram receita pontual alta.
Sinal de churn: tutor que não trouxe o pet para vacina anual ou check-up de rotina nos últimos 12 meses.
Upsell natural: plano de saúde pet, pacotes de banho mensal, consulta nutricional, microchipagem.
Urgências reais: animal vomitando sangue, convulsão, trauma, dificuldade respiratória — devem ser tratadas como emergência imediata.
Métricas-chave: consultas por especialidade, taxa de retorno vacinal, ticket médio de internação, agendamentos de banho recorrentes.`,

    plumber: `
CONTEXTO DO NEGÓCIO — ENCANADOR / HIDRÁULICA
Serviços típicos: desentupimento de pia, vaso e esgoto, conserto de vazamento, instalação de torneira/chuveiro/vaso, reformas hidráulicas, detecção de vazamento oculto.
Comportamento do cliente: quase sempre urgente — vazamento ou entupimento não espera. Cliente está estressado quando liga. Orçamento presencial é padrão antes de executar.
Taxa de no-show: não se aplica da mesma forma. O risco é o cliente fechar com outro profissional antes da visita de orçamento.
Ticket médio: R$ 150–300 (serviços simples) a R$ 2.000+ (reformas hidráulicas). Mão de obra + material.
Receita: serviços pontuais, raramente recorrentes no curto prazo. Indicação é o principal canal de aquisição.
Sinal de churn: não existe fidelidade natural — cliente só volta ou indica se ficou satisfeito. Avaliações online são decisivas.
Upsell natural: instalação de registro geral, revisão preventiva de tubulação, aquecedor a gás.
Sazonalidade: mais chamados em período de chuva (vazamentos estruturais) e fim de ano (reformas).
Métricas-chave: tempo médio de atendimento, taxa de conversão de orçamento, ticket médio por tipo de serviço, origem dos leads.`,

    electrician: `
CONTEXTO DO NEGÓCIO — ELETRICISTA
Serviços típicos: instalação elétrica residencial e comercial, troca de disjuntor, chuveiro elétrico, tomadas e interruptores, quadro de distribuição, SPDA (para-raios), laudos e ARTs, automação residencial.
Comportamento do cliente: urgente quando há risco (cheiro de queimado, luz apagada, choque). Para instalações novas, há mais tempo para decidir. Desconfia de quem não tem documentação.
Taxa de no-show: baixa para urgências. Para orçamentos de obra/reforma, o cliente pode sumir antes de fechar.
Ticket médio: R$ 200 (serviço simples) a R$ 10.000+ (instalação elétrica completa de imóvel). Laudo e ART têm valor fixo.
Receita: serviços pontuais predominam. Obras e reformas geram receita maior mas com prazo estendido.
Sinal de churn: cliente que pediu orçamento mas não respondeu em 48h provavelmente fechou com outro.
Upsell natural: instalação de ponto de câmera/portão, tomadas USB, circuito exclusivo para ar-condicionado, revisão preventiva do quadro.
Sazonalidade: pico em outubro-março (verão, mais aparelhos ligados, mais sobrecargas). Obras aumentam em jan-fev.
Métricas-chave: taxa de conversão de orçamento, ticket médio, tempo de execução, documentação (ART emitida).`,

    bike_shop: `
CONTEXTO DO NEGÓCIO — BICICLETARIA
Serviços típicos: revisão completa, troca de câmara/pneu, ajuste de freio e câmbio, limpeza e lubrificação, troca de corrente/catraca, customização, venda de acessórios e peças.
Comportamento do cliente: dois perfis — ciclista urbano (utilitário, baixo ticket) e entusiasta/esportista (alta fidelidade, alto ticket). Fim de semana é pico de movimento.
Taxa de no-show: baixa. Cliente geralmente deixa a bike e busca depois.
Ticket médio: R$ 50 (reparo simples) a R$ 800+ (revisão completa + peças de alto nível).
Receita: serviço + venda de peças/acessórios. Marge em peças importadas pode ser alta.
Sinal de churn: cliente esportista que não trouxe a bike para revisão há mais de 3 meses (eles pedalam muito e desgastam rápido).
Upsell natural: kit de ferramentas emergência, capacete, iluminação LED, revisão pré-temporada.
Sazonalidade: pico na primavera/verão. Queda no inverno e período de chuva.
Métricas-chave: bikes em serviço por dia, tempo médio de reparo, vendas de acessórios, retenção de clientes esportistas.`,

    auto_repair: `
CONTEXTO DO NEGÓCIO — OFICINA MECÂNICA / AUTO REPAIR
Serviços típicos: troca de óleo e filtros, revisão periódica, freios, suspensão, diagnóstico eletrônico, embreagem, câmbio, ar-condicionado, alinhamento e balanceamento, escapamento.
Comportamento do cliente: apreensivo — sem carro pode não trabalhar. Confiança no mecânico é construída ao longo do tempo. Primeiro contato costuma ser por indicação ou emergência.
Taxa de no-show: muito baixa. Quem agendar mecânico geralmente aparece — o carro precisa do serviço.
Ticket médio: R$ 150 (troca de óleo) a R$ 3.000+ (revisão completa com peças). Peças representam 40-60% do custo total.
Receita: serviço + peças. Margem em peças de qualidade é importante para saúde financeira.
Sinal de churn: cliente que não voltou para a revisão prometida (ex: "volte em 5.000km"). Isso é o principal motor de retenção.
Upsell natural: revisão preventiva dos freios ao trocar óleo, filtro de ar, limpeza de bicos, revisão pré-viagem.
Sazonalidade: pico antes de feriados prolongados e temporada de viagens (julho, dezembro). Revisões de óleo são estáveis o ano todo.
Métricas-chave: retorno programado por quilometragem, ticket médio com peças, taxa de aprovação de orçamento, avaliações online.`,

    beauty_salon: `
CONTEXTO DO NEGÓCIO — SALÃO DE BELEZA
Serviços típicos: corte feminino e masculino, coloração, mechas, escova/progressiva, manicure, pedicure, depilação, design de sobrancelha, maquiagem para eventos.
Comportamento do cliente: fidelidade alta quando há boa conexão com o profissional. Cliente feminina retorna a cada 30-45 dias. WhatsApp é o principal canal de agendamento.
Taxa de no-show: média (~15-20%). Cancelamento de última hora é comum — especialmente para coloração (serviço longo).
Ticket médio: R$ 60 (corte masculino) a R$ 800+ (coloração completa com mechas). Serviços combinados têm ticket médio alto.
Receita: volume de agendamentos x ticket médio. Sábado pela manhã é o horário mais rentável.
Sinal de churn: cliente que não agendou em 60+ dias após serviço de coloração (coloração precisa de manutenção frequente).
Upsell natural: hidratação capilar pós-coloração, escova após corte, design de sobrancelha junto com maquiagem.
Sazonalidade: pico em dezembro (festas), junho (festa junina), e véspera de casamentos. Baixa em janeiro.
Métricas-chave: ocupação da agenda por profissional, ticket médio por serviço, taxa de retorno em 45 dias, agendamentos por canal.`,

    retail_store: `
CONTEXTO DO NEGÓCIO — LOJA DE VAREJO
Serviços típicos: venda de produtos físicos (presencial e/ou online), trocas e devoluções, atendimento ao cliente, gestão de estoque.
Comportamento do cliente: compra por impulso (presencial) ou pesquisa intensiva (online). Preço e disponibilidade são os principais drivers de decisão.
Taxa de no-show: não se aplica diretamente. Risco é carrinho abandonado (online) ou cliente que pediu reserva e não buscou.
Ticket médio: varia muito por segmento. Foco em aumentar itens por compra (cross-sell) e frequência de retorno.
Receita: venda direta. Margem depende de categoria e mix de produtos.
Sinal de churn: cliente que comprou e não voltou em 90 dias (para varejo de consumo recorrente como alimentação, beleza, pet).
Upsell natural: produto complementar no momento da compra, programa de fidelidade, cupom de desconto para próxima compra.
Sazonalidade: pico em Black Friday (novembro), Natal (dezembro), Dia das Mães (maio), Dia dos Pais (agosto). Janeiro é tipicamente fraco.
Métricas-chave: ticket médio, itens por compra, taxa de retorno em 90 dias, produtos mais vendidos, estoque crítico.`,

    repair_shop: `
CONTEXTO DO NEGÓCIO — ASSISTÊNCIA TÉCNICA
Serviços típicos: reparo de celular (tela, bateria, conector), notebook (HD, teclado, placa), tablet, console de videogame, eletrodomésticos pequenos, TV.
Comportamento do cliente: ansioso pela devolução — celular é essencial para trabalho e comunicação. Desconfiado com orçamento — medo de pagar caro ou de não recuperar o aparelho.
Taxa de no-show: baixa para entrega (cliente vem buscar). Risco é abandono de aparelho sem pagar.
Ticket médio: R$ 100 (troca de bateria) a R$ 800+ (troca de tela de iPhone/Samsung top). Peças importadas podem atrasar.
Receita: mão de obra + peça. Margem em peças de terceiros é importante.
Sinal de churn: cliente que não buscou o aparelho em 30+ dias (risco de abandono e prejuízo).
Upsell natural: película protetora após troca de tela, limpeza de memória, backup antes do reparo, capa protetora.
Sazonalidade: pico pós-Natal (presentes que quebraram) e pós-carnaval (aparelhos molhados). Relativamente estável o ano todo.
Métricas-chave: aparelhos em estoque aguardando peça, prazo médio de reparo, taxa de abandono, ticket médio por tipo de reparo.`,

    other_service_business: `
CONTEXTO DO NEGÓCIO — SERVIÇO GERAL
Este negócio presta serviços diversos. Foque em: qualidade do atendimento, pontualidade, comunicação proativa com o cliente, e fidelização através de experiência positiva.
Métricas universais: taxa de retorno de clientes, ticket médio, conversas respondidas em menos de 1 hora, agendamentos cumpridos no prazo.`,
  }

  return map[type] ?? map["other_service_business"]
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function buildBrainSystemPrompt(ctx: BusinessContext): string {
  const fmt = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`
  const equipmentSection = ctx.recentEquipment.length > 0
    ? ctx.recentEquipment.slice(0, 10).map(e => `- ${e.name}${e.brand ? ` (${e.brand}${e.model ? " " + e.model : ""})` : ""} | ${e.customer_name ?? "sem cliente"} | condição: ${e.condition}`).join("\n")
    : "Nenhum equipamento registrado"
  const documentsSection = ctx.documents.length > 0
    ? ctx.documents.slice(0, 10).map(d => `- ${d.title ?? d.file_name}${d.category ? ` [${d.category}]` : ""}${d.description ? `: ${d.description}` : ""}${d.analyzed ? "" : " (em análise)"}`).join("\n")
    : "Nenhum documento registrado"

  return `Você é o assistente de ${ctx.business.name}, localizado em ${ctx.business.city ?? "Brasil"}.
${getBusinessTypeContext(ctx.business.type)}

Dados do dia:
- Agendamentos hoje: ${ctx.metrics.todayItems}
- Conversas abertas: ${ctx.metrics.openConversations}
- Receita hoje: ${fmt(ctx.metrics.todayRevenue)}
- Pagamentos pendentes: ${ctx.metrics.pendingPayments}
- Total de clientes ativos: ${ctx.metrics.totalCustomers}

Agenda de hoje:
${ctx.upcomingItems.map(i => `- ${i.scheduled_start ? new Date(i.scheduled_start).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "?"} | ${i.title} | ${i.customer_name ?? "sem cliente"} | ${i.status}`).join("\n") || "Nenhum agendamento"}

Top clientes:
${ctx.topCustomers.map(c => `- ${c.full_name}: ${fmt(c.total_spent)} total, ${c.visit_count} visitas`).join("\n") || "Nenhum"}

Equipamentos registrados (${ctx.recentEquipment.length}):
${equipmentSection}

Documentos do negócio (${ctx.documents.length}):
${documentsSection}

Responda sempre em português brasileiro. Escreva de forma natural e humana — direto ao ponto, sem jargões de IA, sem enrolação. Respostas de texto devem ter no máximo 2-3 frases. Para campos JSON de texto, seja conciso.`
}

function cachedSystemPrompt(ctx: BusinessContext): Anthropic.TextBlockParam[] {
  return [{ type: "text", text: buildBrainSystemPrompt(ctx), cache_control: { type: "ephemeral" } }]
}

function stripCodeFences(text: string): string {
  return text.replace(/```json\n?|\n?```/g, "").trim()
}

function extractText(msg: DSMessage): string {
  return msg.content[0].text
}

async function claudeCreate(params: {
  max_tokens: number
  system: Anthropic.TextBlockParam[]
  messages: Array<{ role: "user" | "assistant"; content: string }>
}): Promise<DSMessage> {
  const msg = await anthropic.messages.create({
    model: selectModel(TaskComplexity.COMPLEX),
    max_tokens: params.max_tokens,
    system: params.system,
    messages: params.messages,
  })
  const block = msg.content[0] as Anthropic.TextBlock
  return {
    content: [{ type: "text", text: block.text }],
    usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens },
  }
}

// ─── getBusinessContext ────────────────────────────────────────────────────────

export async function getBusinessContext(businessId: string): Promise<BusinessContext> {
  const cached = contextCache.get(businessId)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data
  }

  const admin = createAdminClient()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()
  const results = await Promise.allSettled([
    // 0: business
    admin
      .from("businesses")
      .select("id,name,type,phone,whatsapp_number,address,city,opening_hours,settings")
      .eq("id", businessId)
      .single(),
    // 1: services
    admin
      .from("services")
      .select("id,name,duration_minutes,price")
      .eq("business_id", businessId)
      .eq("active", true),
    // 2: staff
    admin
      .from("staff")
      .select("id,name,role")
      .eq("business_id", businessId)
      .eq("active", true),
    // 3: business_faqs
    admin
      .from("business_faqs")
      .select("question,answer")
      .eq("business_id", businessId)
      .eq("active", true),
    // 4: work_items count today (not cancelled)
    admin
      .from("work_items")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .neq("status", "cancelled")
      .gte("scheduled_start", todayStart)
      .lt("scheduled_start", todayEnd),
    // 5: conversations count (open/waiting/bot)
    admin
      .from("conversations")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["open", "waiting", "bot"]),
    // 6: payments today (paid)
    admin
      .from("payments")
      .select("amount")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .gte("paid_at", todayStart)
      .lt("paid_at", todayEnd),
    // 7: payments pending count
    admin
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "pending"),
    // 8: customers active count
    admin
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "active"),
    // 9: top customers by total_spent
    admin
      .from("customers")
      .select("id,full_name,total_spent,visit_count")
      .eq("business_id", businessId)
      .order("total_spent", { ascending: false })
      .limit(5),
    // 11: recent payments
    admin
      .from("payments")
      .select("id,amount,status,created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(5),
    // 12: upcoming work_items today with customer/service joins
    admin
      .from("work_items")
      .select("id,title,status,scheduled_start,customer:customers(full_name),service:services(name)")
      .eq("business_id", businessId)
      .gte("scheduled_start", todayStart)
      .neq("status", "cancelled")
      .order("scheduled_start", { ascending: true })
      .limit(10),
    // 13: active skills/instructions
    admin
      .from("business_skills")
      .select("name,content")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("order_index", { ascending: true }),
    // 13: recent equipment with customer join
    admin
      .from("equipment")
      .select("id,name,brand,model,condition,customer:customers(full_name)")
      .eq("business_id", businessId)
      .order("updated_at", { ascending: false })
      .limit(20),
    // 14: business_documents
    admin
      .from("business_documents")
      .select("id,title,description,category,file_name,analyzed")
      .eq("business_id", businessId)
      .order("uploaded_at", { ascending: false })
      .limit(20),
  ])

  // Extract each result safely
  const businessData =
    results[0].status === "fulfilled"
      ? (results[0].value.data as {
          id: string
          name: string
          type: string
          phone: string | null
          whatsapp_number: string | null
          address: string | null
          city: string | null
          opening_hours: unknown
          settings: unknown
        } | null)
      : null

  const servicesData =
    results[1].status === "fulfilled"
      ? (results[1].value.data as Array<{
          id: string
          name: string
          duration_minutes: number
          price: number | null
        }> | null)
      : null

  const staffData =
    results[2].status === "fulfilled"
      ? (results[2].value.data as Array<{ id: string; name: string; role: string | null }> | null)
      : null

  const faqsData =
    results[3].status === "fulfilled"
      ? (results[3].value.data as Array<{ question: string; answer: string }> | null)
      : null

  const skillsData =
    results[12].status === "fulfilled"
      ? (results[12].value.data as Array<{ name: string; content: string }> | null)
      : null

  const todayItemsCount =
    results[4].status === "fulfilled" ? (results[4].value.count ?? 0) : 0

  const openConversationsCount =
    results[5].status === "fulfilled" ? (results[5].value.count ?? 0) : 0

  const todayPaymentsData =
    results[6].status === "fulfilled"
      ? (results[6].value.data as Array<{ amount: number }> | null)
      : null

  const pendingPaymentsCount =
    results[7].status === "fulfilled" ? (results[7].value.count ?? 0) : 0

  const totalCustomersCount =
    results[8].status === "fulfilled" ? (results[8].value.count ?? 0) : 0

  const topCustomersData =
    results[9].status === "fulfilled"
      ? (results[9].value.data as Array<{
          id: string
          full_name: string
          total_spent: number
          visit_count: number
        }> | null)
      : null

  const recentPaymentsData =
    results[10].status === "fulfilled"
      ? (results[10].value.data as Array<{
          id: string
          amount: number
          status: string
          created_at: string
        }> | null)
      : null

  type UpcomingRaw = {
    id: string
    title: string
    status: string
    scheduled_start: string | null
    customer: { full_name: string } | null
    service: { name: string } | null
  }
  const upcomingRaw =
    results[11].status === "fulfilled"
      ? (results[11].value.data as UpcomingRaw[] | null)
      : null

  type EquipmentRaw = { id: string; name: string; brand: string | null; model: string | null; condition: string; customer: { full_name: string } | null }
  const recentEquipmentRaw =
    results[13].status === "fulfilled"
      ? (results[13].value.data as EquipmentRaw[] | null)
      : null

  type DocumentRaw = { id: string; title: string | null; description: string | null; category: string | null; file_name: string; analyzed: boolean }
  const documentsRaw =
    results[14].status === "fulfilled"
      ? (results[14].value.data as DocumentRaw[] | null)
      : null

  const todayRevenue = (todayPaymentsData ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)

  const ctx: BusinessContext = {
    business: businessData ?? {
      id: businessId,
      name: "Negócio",
      type: "other_service_business",
      phone: null,
      whatsapp_number: null,
      address: null,
      city: null,
      opening_hours: null,
      settings: null,
    },
    services: (servicesData ?? []).map(s => ({
      id: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      price: s.price ?? 0,
    })),
    staff: (staffData ?? []).map(s => ({
      id: s.id,
      name: s.name,
      role: s.role ?? "",
    })),
    faqs: faqsData ?? [],
    skills: skillsData ?? [],
    metrics: {
      todayItems: todayItemsCount,
      openConversations: openConversationsCount,
      todayRevenue,
      pendingPayments: pendingPaymentsCount,
      totalCustomers: totalCustomersCount,
    },
    topCustomers: topCustomersData ?? [],
    recentPayments: recentPaymentsData ?? [],
    upcomingItems: (upcomingRaw ?? []).map(item => ({
      id: item.id,
      title: item.title,
      status: item.status,
      scheduled_start: item.scheduled_start,
      customer_name: item.customer?.full_name ?? null,
      service_name: item.service?.name ?? null,
    })),
    recentEquipment: (recentEquipmentRaw ?? []).map(e => ({
      id: e.id,
      name: e.name,
      brand: e.brand,
      model: e.model,
      condition: e.condition,
      customer_name: e.customer?.full_name ?? null,
    })),
    documents: (documentsRaw ?? []).map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      category: d.category,
      file_name: d.file_name,
      analyzed: d.analyzed,
    })),
  }

  contextCache.set(businessId, { data: ctx, expiresAt: Date.now() + 30 * 60 * 1000 })
  return ctx
}

// ─── invalidateContext ─────────────────────────────────────────────────────────

export function invalidateContext(businessId: string): void {
  contextCache.delete(businessId)
  briefingCache.delete(businessId)
  actionsCache.delete(businessId)
}

// ─── getDailyBriefing ─────────────────────────────────────────────────────────

export async function getDailyBriefing(businessId: string): Promise<string> {
  // L1: in-memory (warm path)
  const memCached = briefingCache.get(businessId)
  if (memCached && Date.now() < memCached.expiresAt) return memCached.text

  const todayDate = new Date().toLocaleDateString("sv", { timeZone: "America/Sao_Paulo" })
  const cacheKey = `daily:${businessId}`

  // L2: DB cache (survives deploys — valid for the whole calendar day)
  const admin = createAdminClient()
  const { data: dbCached } = await admin
    .from("briefing_cache")
    .select("content")
    .eq("business_id", businessId)
    .eq("cache_key", cacheKey)
    .eq("cached_date", todayDate)
    .maybeSingle()

  if (dbCached) {
    briefingCache.set(businessId, { text: dbCached.content, expiresAt: Date.now() + 15 * 60_000 })
    return dbCached.content
  }

  // L3: DeepSeek (Claude as fallback)
  const ctx = await getBusinessContext(businessId)
  const briefingMessages = [{ role: "user" as const, content: "Escreva exatamente 1 frase com os dados do dia. Formato obrigatório: comece com o número de agendamentos de hoje, mencione a receita esperada e os pagamentos pendentes se houver. Exemplo: 'Você tem 3 agendamentos hoje, R$ 450 em receita esperada e 1 pagamento pendente.' Use apenas fatos dos dados fornecidos. Português correto e formal. Sem emojis, sem gírias, sem frases motivacionais, sem saudação, sem ponto de exclamação." }]
  const msg = await withFallback(
    () => dsCreate({ max_tokens: 300, system: buildBrainSystemPrompt(ctx), messages: briefingMessages }),
    () => claudeCreate({ max_tokens: 300, system: cachedSystemPrompt(ctx), messages: briefingMessages }),
    "getDailyBriefing",
  )
  void logUsage(businessId, "getDailyBriefing", msg.usage, DS_MODEL)
  const text = extractText(msg)
  briefingCache.set(businessId, { text, expiresAt: Date.now() + 15 * 60_000 })
  void admin.from("briefing_cache").upsert(
    { business_id: businessId, cache_key: cacheKey, content: text, cached_date: todayDate },
    { onConflict: "business_id,cache_key,cached_date" },
  )
  return text
}

// ─── getNextBestActions ───────────────────────────────────────────────────────

export async function getNextBestActions(
  businessId: string,
): Promise<Array<{ label: string; href: string; description: string }>> {
  const cached = actionsCache.get(businessId)
  if (cached && Date.now() < cached.expiresAt) return cached.actions

  const ctx = await getBusinessContext(businessId)

  const fallback = [
    { label: "Ver agenda", href: "/dashboard/work-items", description: "Confira os agendamentos do dia" },
    { label: "Conversas", href: "/dashboard/conversations", description: "Responda clientes aguardando" },
    { label: "Pagamentos", href: "/dashboard/payments", description: "Verifique cobranças pendentes" },
  ]

  try {
    const actionsMessages = [{ role: "user" as const, content: `Com base nos dados do negócio, sugira exatamente 3 ações prioritárias agora. Retorne SOMENTE um array JSON com 3 objetos {label, href, description}. Use apenas estes hrefs disponíveis: /dashboard, /dashboard/work-items, /dashboard/conversations, /dashboard/customers, /dashboard/payments, /dashboard/analytics. Exemplo: [{"label":"Ver agenda","href":"/dashboard/work-items","description":"..."}]` }]
    const msg = await withFallback(
      () => dsCreate({ max_tokens: 300, system: buildBrainSystemPrompt(ctx), messages: actionsMessages }),
      () => claudeCreate({ max_tokens: 300, system: cachedSystemPrompt(ctx), messages: actionsMessages }),
      "getNextBestActions",
    )
    void logUsage(businessId, "getNextBestActions", msg.usage, DS_MODEL)
    const text = stripCodeFences(extractText(msg))
    const actions = JSON.parse(text) as Array<{ label: string; href: string; description: string }>
    actionsCache.set(businessId, { actions, expiresAt: Date.now() + 15 * 60 * 1000 })
    return actions
  } catch {
    return fallback
  }
}

// ─── analyzeCustomer ──────────────────────────────────────────────────────────

export async function analyzeCustomer(
  businessId: string,
  customerId: string,
): Promise<CustomerInsight> {
  const admin = createAdminClient()

  const [ctx, customerResult, historyResult] = await Promise.all([
    getBusinessContext(businessId),
    admin.from("customers").select("*").eq("id", customerId).single(),
    admin
      .from("work_items")
      .select("status,final_price,scheduled_start")
      .eq("customer_id", customerId)
      .eq("business_id", businessId)
      .order("scheduled_start", { ascending: false })
      .limit(10),
  ])

  type CustomerRow = {
    id: string
    full_name: string
    total_spent: number
    visit_count: number
    last_visit_at: string | null
    notes: string | null
    tags: string[]
    status: string
    lead_status: string
    created_at: string
  }
  type HistoryRow = { status: string; final_price: number | null; scheduled_start: string | null }

  const customer = customerResult.data as CustomerRow | null
  const history = (historyResult.data as HistoryRow[] | null) ?? []

  const noShows = history.filter(w => w.status === "no_show").length
  const daysSinceLast = customer?.last_visit_at
    ? Math.floor((Date.now() - new Date(customer.last_visit_at).getTime()) / 86_400_000)
    : 999

  const fallback: CustomerInsight = {
    segment: "Regular",
    ltv_estimate: customer?.total_spent ?? 0,
    churn_risk: daysSinceLast > 60 ? "high" : daysSinceLast > 30 ? "medium" : "low",
    churn_reason: null,
    upsell_suggestion: null,
    summary: "Análise indisponível no momento.",
  }

  if (!customer) return fallback

  const historySummary = history
    .map(
      w =>
        `- Status: ${w.status}, Valor: ${w.final_price != null ? `R$ ${(w.final_price / 100).toFixed(2)}` : "N/A"}, Data: ${w.scheduled_start ?? "?"}`,
    )
    .join("\n")

  const customerDataBlock = [
    `Nome: ${customer.full_name}`,
    `Status: ${customer.status}`,
    `Lead status: ${customer.lead_status}`,
    `Total gasto: R$ ${(customer.total_spent / 100).toFixed(2)}`,
    `Visitas: ${customer.visit_count}`,
    `Última visita: ${customer.last_visit_at ? new Date(customer.last_visit_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Nunca"}`,
    `Dias desde última visita: ${daysSinceLast}`,
    `Faltas (no-show): ${noShows}`,
    `Tags: ${customer.tags.join(", ") || "nenhuma"}`,
    `Notas: ${customer.notes ?? "nenhuma"}`,
    `\nHistórico recente:\n${historySummary || "Sem histórico"}`,
  ].join("\n")

  const analyzeCustomerPrompt = `Analise este cliente e retorne SOMENTE JSON no formato {segment, ltv_estimate, churn_risk, churn_reason, upsell_suggestion, summary}.

${delimit(TAG.customerData, customerDataBlock)}

churn_risk deve ser "low", "medium" ou "high". ltv_estimate em centavos (inteiro).`

  try {
    const customerMessages = [{ role: "user" as const, content: analyzeCustomerPrompt }]
    const msg = await withFallback(
      () => dsCreate({ max_tokens: 400, system: buildBrainSystemPrompt(ctx), messages: customerMessages }),
      () => claudeCreate({ max_tokens: 400, system: cachedSystemPrompt(ctx), messages: customerMessages }),
      "analyzeCustomer",
    )
    void logUsage(businessId, "analyzeCustomer", msg.usage, DS_MODEL)
    const text = stripCodeFences(extractText(msg))
    return JSON.parse(text) as CustomerInsight
  } catch {
    return fallback
  }
}

// ─── analyzeConversation ──────────────────────────────────────────────────────

export async function analyzeConversation(
  businessId: string,
  conversationId: string,
): Promise<ConversationInsight> {
  const admin = createAdminClient()

  const [ctx, messagesResult] = await Promise.all([
    getBusinessContext(businessId),
    admin
      .from("messages")
      .select("direction,content,sent_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(10),
  ])

  type MessageRow = { direction: string; content: string; sent_at: string }
  const messages = ((messagesResult.data as MessageRow[] | null) ?? []).reverse()

  const fallback: ConversationInsight = {
    intent: "indefinido",
    sentiment: "neutral",
    urgency: "low",
    suggested_reply: "",
    summary: "Análise indisponível.",
  }

  if (messages.length === 0) return fallback

  const history = messages
    .map(m => `[${m.direction === "inbound" ? "Cliente" : "Negócio"}] ${m.content}`)
    .join("\n")

  const analyzeConversationPrompt = `Analise esta conversa e retorne SOMENTE JSON no formato {intent, sentiment, urgency, suggested_reply, summary}.

sentiment deve ser "positive", "neutral" ou "negative".
urgency deve ser "low", "medium" ou "high".

${delimit(TAG.conversationHistory, history)}`

  try {
    const convMessages = [{ role: "user" as const, content: analyzeConversationPrompt }]
    const msg = await withFallback(
      () => dsCreate({ max_tokens: 400, system: buildBrainSystemPrompt(ctx), messages: convMessages }),
      () => claudeCreate({ max_tokens: 400, system: cachedSystemPrompt(ctx), messages: convMessages }),
      "analyzeConversation",
    )
    void logUsage(businessId, "analyzeConversation", msg.usage, DS_MODEL)
    const text = stripCodeFences(extractText(msg))
    return JSON.parse(text) as ConversationInsight
  } catch {
    return fallback
  }
}

// ─── predictWorkItemRisk ──────────────────────────────────────────────────────

export async function predictWorkItemRisk(
  businessId: string,
  workItemId: string,
): Promise<WorkItemRisk> {
  const admin = createAdminClient()

  const workItemResult = await admin
    .from("work_items")
    .select("id,title,status,scheduled_start,price_estimate,final_price,payment_status,customer:customers(id,full_name,visit_count,total_spent,last_visit_at),service:services(name)")
    .eq("id", workItemId)
    .single()

  type WorkItemFull = {
    id: string
    title: string
    status: string
    scheduled_start: string | null
    price_estimate: number | null
    final_price: number | null
    payment_status: string
    customer: { id: string; full_name: string; visit_count: number; total_spent: number; last_visit_at: string | null } | null
    service: { name: string } | null
  }

  const workItem = workItemResult.data as WorkItemFull | null

  const [ctx, historyResult] = await Promise.all([
    getBusinessContext(businessId),
    workItem?.customer?.id
      ? admin
          .from("work_items")
          .select("status")
          .eq("customer_id", workItem.customer.id)
          .eq("business_id", businessId)
          .order("scheduled_start", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ])

  type HistoryStatusRow = { status: string }
  const history = (historyResult.data as HistoryStatusRow[] | null) ?? []
  const noShows = history.filter(w => w.status === "no_show").length

  const fallback: WorkItemRisk = {
    no_show_risk: noShows >= 3 ? "high" : noShows >= 1 ? "medium" : "low",
    payment_risk: "low",
    no_show_reason: noShows > 0 ? `${noShows} faltas anteriores` : null,
    payment_reason: null,
    overall_score: noShows >= 3 ? 80 : noShows >= 1 ? 50 : 20,
  }

  if (!workItem) return fallback

  const workItemDataBlock = [
    `Agendamento: ${workItem.title}`,
    `Data: ${workItem.scheduled_start ?? "?"}`,
    `Status: ${workItem.status}`,
    `Serviço: ${workItem.service?.name ?? "?"}`,
    `Valor estimado: ${workItem.price_estimate != null ? `R$ ${(workItem.price_estimate / 100).toFixed(2)}` : "?"}`,
    `Status pagamento: ${workItem.payment_status}`,
    `Cliente: ${workItem.customer?.full_name ?? "desconhecido"}`,
    `Visitas anteriores: ${workItem.customer?.visit_count ?? 0}`,
    `Total gasto: ${workItem.customer?.total_spent != null ? `R$ ${(workItem.customer.total_spent / 100).toFixed(2)}` : "?"}`,
    `Última visita: ${workItem.customer?.last_visit_at ? new Date(workItem.customer.last_visit_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "nunca"}`,
    `Faltas (no-show) anteriores: ${noShows}`,
  ].join("\n")

  const predictWorkItemRiskPrompt = `Avalie o risco deste agendamento e retorne SOMENTE JSON no formato {no_show_risk, payment_risk, no_show_reason, payment_reason, overall_score}.

no_show_risk e payment_risk: "low", "medium" ou "high".
overall_score: número de 0 a 100 (100 = maior risco).

${delimit(TAG.customerData, workItemDataBlock)}`

  try {
    const riskMessages = [{ role: "user" as const, content: predictWorkItemRiskPrompt }]
    const msg = await withFallback(
      () => dsCreate({ max_tokens: 300, system: buildBrainSystemPrompt(ctx), messages: riskMessages }),
      () => claudeCreate({ max_tokens: 300, system: cachedSystemPrompt(ctx), messages: riskMessages }),
      "predictWorkItemRisk",
    )
    void logUsage(businessId, "predictWorkItemRisk", msg.usage, DS_MODEL)
    const text = stripCodeFences(extractText(msg))
    return JSON.parse(text) as WorkItemRisk
  } catch {
    return fallback
  }
}

// ─── generateReport ───────────────────────────────────────────────────────────

export async function generateReport(
  businessId: string,
  question: string,
): Promise<ReadableStream<Uint8Array>> {
  const ctx = await getBusinessContext(businessId)
  return dsStream({
    max_tokens: 1000,
    system: buildBrainSystemPrompt(ctx),
    messages: [{ role: "user", content: question }],
    onUsage: (u) => void logUsage(businessId, "generateReport", u, DS_MODEL),
  })
}

// ─── buildAutomationFromDescription ──────────────────────────────────────────

export async function buildAutomationFromDescription(
  businessId: string,
  description: string,
): Promise<AutomationConfig> {
  const ctx = await getBusinessContext(businessId)

  const fallback: AutomationConfig = {
    name: description.slice(0, 50),
    trigger_type: "booking_created",
    message_template: `Olá {{customer_name}}, tudo bem? ${ctx.business.name} aqui. Seu agendamento foi confirmado! Qualquer dúvida, é só chamar.`,
    delay_minutes: 0,
  }

  const buildAutomationPrompt = `Crie uma automação de mensagem baseada nesta descrição: "${description}"

Retorne SOMENTE JSON no formato {name, trigger_type, message_template, delay_minutes}.

trigger_type deve ser um destes valores: booking_created, booking_confirmed, booking_24h_before, booking_completed, booking_cancelled, booking_no_show, payment_pending, payment_received, lead_created, lead_inactive, customer_inactive.

Variáveis disponíveis no template: {{customer_name}}, {{business_name}}, {{service_name}}, {{scheduled_time}}, {{price}}, {{pix_link}}.

delay_minutes: número inteiro de minutos de atraso após o trigger (0 = imediato).`

  try {
    const automationMessages = [{ role: "user" as const, content: buildAutomationPrompt }]
    const msg = await withFallback(
      () => dsCreate({ max_tokens: 400, system: buildBrainSystemPrompt(ctx), messages: automationMessages }),
      () => claudeCreate({ max_tokens: 400, system: cachedSystemPrompt(ctx), messages: automationMessages }),
      "buildAutomationFromDescription",
    )
    void logUsage(businessId, "buildAutomationFromDescription", msg.usage, DS_MODEL)
    const text = stripCodeFences(extractText(msg))
    return JSON.parse(text) as AutomationConfig
  } catch {
    return fallback
  }
}

// ─── getStaffDayBriefing ──────────────────────────────────────────────────────

export async function getStaffDayBriefing(
  businessId: string,
  staffId: string,
): Promise<string> {
  const admin = createAdminClient()

  // L1: in-memory
  const l1Key = `staff:${businessId}:${staffId}`
  const memCached = briefingCache.get(l1Key)
  if (memCached && Date.now() < memCached.expiresAt) return memCached.text

  const todayDate = new Date().toLocaleDateString("sv", { timeZone: "America/Sao_Paulo" })
  const cacheKey = `staff:${staffId}`

  // L2: DB cache
  const { data: dbCached } = await admin
    .from("briefing_cache")
    .select("content")
    .eq("business_id", businessId)
    .eq("cache_key", cacheKey)
    .eq("cached_date", todayDate)
    .maybeSingle()

  if (dbCached) {
    briefingCache.set(l1Key, { text: dbCached.content, expiresAt: Date.now() + 15 * 60_000 })
    return dbCached.content
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [ctx, staffResult, itemsResult] = await Promise.all([
    getBusinessContext(businessId),
    admin.from("staff").select("name,role").eq("id", staffId).single(),
    admin
      .from("work_items")
      .select("title,scheduled_start,status,customer:customers(full_name)")
      .eq("business_id", businessId)
      .eq("assigned_staff_id", staffId)
      .gte("scheduled_start", todayStart)
      .neq("status", "cancelled")
      .order("scheduled_start", { ascending: true }),
  ])

  type StaffRow = { name: string; role: string | null }
  type StaffWorkItem = {
    title: string
    scheduled_start: string | null
    status: string
    customer: { full_name: string } | null
  }

  const staffMember = staffResult.data as StaffRow | null
  const items = (itemsResult.data as StaffWorkItem[] | null) ?? []

  const agendaText = items
    .map(
      i =>
        `- ${i.scheduled_start ? new Date(i.scheduled_start).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "?"} | ${i.title} | ${i.customer?.full_name ?? "sem cliente"}`,
    )
    .join("\n") || "Sem agendamentos para hoje."

  const staffBriefingPrompt = `Gere um briefing motivacional de exatamente 3 frases para o(a) funcionário(a) ${staffMember?.name ?? "colaborador"} (${staffMember?.role ?? "equipe"}).

Agenda de hoje:
${agendaText}

Seja encorajador, mencione quantos atendimentos há e deseje um bom dia.`

  try {
    const staffMessages = [{ role: "user" as const, content: staffBriefingPrompt }]
    const msg = await withFallback(
      () => dsCreate({ max_tokens: 200, system: buildBrainSystemPrompt(ctx), messages: staffMessages }),
      () => claudeCreate({ max_tokens: 200, system: cachedSystemPrompt(ctx), messages: staffMessages }),
      "getStaffDayBriefing",
    )
    void logUsage(businessId, "getStaffDayBriefing", msg.usage, DS_MODEL)
    const text = extractText(msg)
    briefingCache.set(l1Key, { text, expiresAt: Date.now() + 15 * 60_000 })
    void admin.from("briefing_cache").upsert(
      { business_id: businessId, cache_key: cacheKey, content: text, cached_date: todayDate },
      { onConflict: "business_id,cache_key,cached_date" },
    )
    return text
  } catch {
    return `Bom dia, ${staffMember?.name ?? "colaborador"}! Você tem ${items.length} atendimento(s) hoje. Tenha um excelente dia de trabalho!`
  }
}
