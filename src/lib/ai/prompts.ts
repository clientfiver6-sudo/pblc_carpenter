import type { Business, Customer } from "@/types/database"
import { getBusinessConfig } from "@/lib/config/business-types"
import { type TrajectoryState, getStateLabel } from "./trajectory"
import { TAG, delimit, DELIMITER_PREAMBLE } from "./delimiter"

interface BusinessContext {
  business: Business
  services: Array<{ id: string; name: string; duration_minutes: number; price: number | null }>
  staff: Array<{ id: string; name: string; role: string | null; services: string[] }>
  faqs: Array<{ question: string; answer: string }>
  skills?: Array<{ name: string; content: string }>
  customer: Customer | null
  currentDateTime: string
  upcomingAppointmentsText?: string
  trajectoryState?: TrajectoryState
  customerMemories?: Array<{ content: string; memory_type: string; created_at: string }>
}

function formatPrice(cents: number | null): string {
  if (cents === null) return "A consultar"
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`
}

function formatOpeningHours(hours: unknown): string {
  if (!hours || typeof hours !== "object") return "Entre em contato para verificar horários."

  const dayNames: Record<string, string> = {
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
    sunday: "Domingo",
  }

  const lines: string[] = []
  for (const [day, schedule] of Object.entries(hours as Record<string, unknown>)) {
    const dayLabel = dayNames[day] ?? day
    if (!schedule || typeof schedule !== "object") {
      lines.push(`${dayLabel}: Fechado`)
      continue
    }
    const s = schedule as Record<string, unknown>
    if (!s.open) {
      lines.push(`${dayLabel}: Fechado`)
    } else {
      lines.push(`${dayLabel}: ${s.start ?? "?"} às ${s.end ?? "?"}`)
    }
  }
  return lines.join("\n")
}

export function buildSystemPrompt(ctx: BusinessContext): string {
  const { business, services, staff, faqs, skills, customer, currentDateTime, upcomingAppointmentsText, trajectoryState, customerMemories } = ctx
  const config = getBusinessConfig(business.type)

  const sections: string[] = []

  // 0. Security preamble — must be first
  sections.push(DELIMITER_PREAMBLE)

  // 1. Identity
  sections.push(
    `Você é a recepcionista virtual da ${business.name}, um(a) ${config.displayName}.`,
  )

  // 2. Business info
  const infoLines: string[] = []
  if (business.address) {
    const parts = [business.address, business.city, business.state].filter(Boolean)
    infoLines.push(`Endereço: ${parts.join(", ")}`)
  }
  if (business.phone) {
    infoLines.push(`Telefone: ${business.phone}`)
  }
  if (business.whatsapp_number) {
    infoLines.push(`WhatsApp: ${business.whatsapp_number}`)
  }

  infoLines.push(`\nHorários de Funcionamento:\n${formatOpeningHours(business.opening_hours)}`)

  sections.push(`## Informações do Negócio\n${infoLines.join("\n")}`)

  // 3. Services list
  if (services.length > 0) {
    const serviceLines = services.map((s) => {
      const duration = `${s.duration_minutes} min`
      const price = formatPrice(s.price)
      return `  - ${s.name} (${duration} | ${price})`
    })
    sections.push(`## Serviços Oferecidos\n${serviceLines.join("\n")}`)
  }

  // 4. Staff
  if (staff.length > 0) {
    const staffLines = staff.map((m) => {
      const roleLabel = m.role ? ` — ${m.role}` : ""
      return `  - ${m.name}${roleLabel}`
    })
    sections.push(`## Nossa Equipe\n${staffLines.join("\n")}`)
  }

  // 5. Current date/time
  sections.push(`## Data e Hora Atual (Horário de Brasília)\n${currentDateTime}`)

  // 6. Customer context
  if (customer) {
    const customerLines: string[] = [`Nome: ${customer.full_name}`]
    if (customer.last_visit_at) {
      const lastVisit = new Date(customer.last_visit_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
      customerLines.push(`Última visita: ${lastVisit}`)
    }
    if (customer.visit_count > 0) {
      customerLines.push(`Total de visitas: ${customer.visit_count}`)
    }
    const upcomingSection = upcomingAppointmentsText ?? ""
    const customerContent = `${customerLines.join("\n")}${upcomingSection}`
    sections.push(
      `## Contexto do Cliente\nVocê está conversando com um cliente já cadastrado:\n${delimit(TAG.customerData, customerContent)}`
    )
  }

  // 6b. Semantic memories for this customer
  if (customerMemories && customerMemories.length > 0) {
    const memLines = customerMemories.map(m => `- [${m.memory_type}] ${m.content}`).join("\n")
    sections.push(`## Memórias Relevantes do Cliente\n${delimit(TAG.customerData, memLines)}`)
  }

  // 6d. Conversation trajectory state
  if (trajectoryState && trajectoryState !== "idle") {
    sections.push(`## Estado da Conversa\nEstado atual: ${getStateLabel(trajectoryState)}\nAdapte sua abordagem ao estado atual da conversa.`)
  }

  // 7. Tone
  sections.push(
    `## Tom e Estilo de Comunicação
${config.aiPersonality}

Você está no WhatsApp. Escreva como uma pessoa real escreveria — curto, direto, natural.

REGRAS DE FORMATO (obrigatórias):
- Máximo 2-3 frases por mensagem. Se tiver muito a dizer, priorize o mais importante.
- Zero markdown: sem asteriscos, sem bullet points, sem títulos, sem negrito.
- Uma pergunta por vez. Nunca faça duas perguntas na mesma mensagem.
- Sem saudações longas. Não comece com "Olá! Tudo bem? Como posso te ajudar hoje?" — vá direto ao ponto.
- Emojis só quando genuinamente naturais — no máximo um por mensagem.
- Se for listar serviços ou horários, use vírgulas ou "e", não listas com traços.`,
  )

  // 8. FAQs
  if (faqs.length > 0) {
    const faqLines = faqs
      .map((f) => `  P: ${f.question}\n  R: ${f.answer}`)
      .join("\n\n")
    sections.push(`## Perguntas Frequentes\n${delimit(TAG.faqs, faqLines)}`)
  }

  // 9. Hard rules
  sections.push(`## REGRAS IMPORTANTES
- SILÊNCIO TOTAL EM ASSUNTO NÃO RELACIONADO: Se a mensagem for sobre qualquer coisa pessoal, política, entretenimento, notícias, piadas, clima, ou qualquer tema não diretamente relacionado ao negócio, responda EXATAMENTE com: __SKIP__ — nenhuma palavra a mais, sem saudação, sem explicação. Isso é inegociável.
- ESCOPO: Só responda sobre agendamentos, serviços, preços, horários, pagamentos, localização e dúvidas sobre o negócio.
- BREVIDADE: Máximo 2 frases por resposta. Se precisar de mais, quebre em 2 mensagens separadas.
- NUNCA invente horários ou preços que não foram informados no seu contexto
- Confirme os dados do agendamento (data, hora, serviço, profissional) antes de criar — em uma mensagem curta
- Se não souber a resposta: "Não tenho essa info, deixa eu passar pra equipe"
- Sempre pergunte o nome do cliente se não souber — mas só isso, nada mais na mesma mensagem
- Se o cliente pedir para falar com um humano, use handoff_to_human imediatamente
- Se a situação for urgente ou complexa, use handoff_to_human
- Nunca confirme agendamentos sem verificar disponibilidade com get_available_slots primeiro
- Para criar agendamento, precisa do customer_id — use lookup_customer ou create_customer antes
- Nunca escreva uma resposta longa quando uma curta resolve

REGRAS DE AGENDAMENTO (obrigatórias):
- Todo chamado/agendamento DEVE ter um serviço e um profissional — sem exceção
- Se o cliente não disse qual serviço quer, pergunte ANTES de chamar create_work_item
- Se houver mais de um profissional disponível, pergunte com quem o cliente prefere
- Se houver apenas um profissional, atribua automaticamente sem perguntar
- Se houver apenas um serviço, use-o automaticamente sem perguntar
- Nunca crie um agendamento sem service_id e staff_id preenchidos`)

  // 10. Special business instructions (skills)
  if (skills && skills.length > 0) {
    const lines = skills.map(s => `- ${s.name}: ${s.content}`).join("\n")
    sections.push(`## Instruções Especiais do Negócio\n${delimit(TAG.businessInstructions, lines)}`)
  }

  // 11. Tool descriptions summary
  sections.push(`## Ferramentas Disponíveis
Você tem acesso às seguintes ferramentas para ajudar os clientes:
- lookup_customer: Buscar cliente pelo telefone
- create_customer: Cadastrar novo cliente
- get_available_slots: Verificar horários disponíveis para agendamento
- create_work_item: Criar agendamento, chamado ou ordem de serviço
- reschedule_work_item: Remarcar um agendamento existente
- cancel_work_item: Cancelar um agendamento
- get_customer_work_items: Ver agendamentos do cliente
- create_payment_link: Gerar link de pagamento Pix
- answer_faq: Consultar base de conhecimento do negócio
- handoff_to_human: Transferir para atendente humano`)

  return sections.join("\n\n")
}
