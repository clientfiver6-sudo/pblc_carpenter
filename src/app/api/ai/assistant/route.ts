import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { getBusinessContext } from "@/lib/ai/brain"
import { executeToolCall } from "@/lib/ai/tool-executor"
import { getCustomerWithHistory } from "@/lib/queries/customers"
import { getCalendarItems } from "@/lib/queries/calendar"
import { sendTextMessage } from "@/lib/whatsapp/client"
import { triggerBookingCreated, triggerBookingCompleted, triggerBookingCancelled } from "@/lib/automations/triggers"
import { aiMessageSchema, detectPromptInjection } from "@/lib/schemas"
import { spToday, spDayRange, formatSpTime } from "@/lib/utils/brazil-time"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "add_customer",
    description: "Adiciona um novo cliente ao sistema.",
    input_schema: {
      type: "object" as const,
      properties: {
        full_name:    { type: "string", description: "Nome completo" },
        phone_number: { type: "string", description: "Telefone (opcional)" },
        email:        { type: "string", description: "E-mail (opcional)" },
        notes:        { type: "string", description: "Observações (opcional)" },
      },
      required: ["full_name"],
    },
  },
  {
    name: "search_customers",
    description: "Busca clientes pelo nome ou telefone.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Nome ou telefone" },
      },
      required: ["query"],
    },
  },
  {
    name: "update_customer",
    description: "Atualiza dados de um cliente. Informe customer_name para buscar pelo nome OU customer_id se já tiver o ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_name: { type: "string", description: "Nome do cliente para buscar (use se não tiver o ID)" },
        customer_id:   { type: "string", description: "ID do cliente (opcional se customer_name for fornecido)" },
        phone_number:  { type: "string", description: "Novo telefone (opcional)" },
        email:         { type: "string", description: "Novo e-mail (opcional)" },
        address:       { type: "string", description: "Novo endereço (opcional)" },
        city:          { type: "string", description: "Nova cidade (opcional)" },
        notes:         { type: "string", description: "Novas observações (opcional)" },
        status:        { type: "string", enum: ["active", "inactive", "blocked"], description: "Novo status (opcional)" },
      },
      required: [],
    },
  },
  {
    name: "add_work_item",
    description: "Cria um agendamento, consulta, chamado ou ordem de serviço.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:           { type: "string",  description: "Título/descrição do serviço" },
        customer_name:   { type: "string",  description: "Nome do cliente (para buscar o ID)" },
        service_name:    { type: "string",  description: "Nome do serviço do catálogo (opcional) — vincula o agendamento ao serviço correto" },
        scheduled_start: { type: "string",  description: "Data/hora de início em ISO 8601 com offset de Brasília (ex: 2025-05-20T10:00:00-03:00). SEMPRE inclua -03:00 ao final." },
        scheduled_end:   { type: "string",  description: "Data/hora de término com offset de Brasília (ex: 2025-05-20T11:00:00-03:00). SEMPRE inclua -03:00 ao final." },
        price_estimate:  { type: "number",  description: "Valor estimado em centavos (opcional)" },
        notes:           { type: "string",  description: "Observações internas (opcional)" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_staff",
    description: "Adiciona um colaborador à equipe.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:  { type: "string", description: "Nome completo" },
        role:  { type: "string", description: "Cargo ou função (opcional)" },
        phone: { type: "string", description: "Telefone (opcional)" },
        email: { type: "string", description: "E-mail (opcional)" },
      },
      required: ["name"],
    },
  },
  {
    name: "add_service",
    description: "Adiciona um serviço ao catálogo do negócio.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:             { type: "string", description: "Nome do serviço" },
        description:      { type: "string", description: "Descrição (opcional)" },
        duration_minutes: { type: "number", description: "Duração em minutos" },
        price:            { type: "number", description: "Preço em centavos (opcional)" },
        category:         { type: "string", description: "Categoria (opcional)" },
      },
      required: ["name", "duration_minutes"],
    },
  },
  {
    name: "create_automation",
    description: "Cria uma automação de mensagem WhatsApp.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:             { type: "string", description: "Nome da automação" },
        trigger_type:     {
          type: "string",
          enum: [
            "booking_created","booking_confirmed","booking_24h_before","booking_completed",
            "booking_cancelled","booking_no_show","payment_pending","payment_received",
            "lead_created","lead_inactive","customer_inactive",
          ],
          description: "Gatilho da automação",
        },
        message_template: { type: "string", description: "Template da mensagem com variáveis {{customer_name}}, {{business_name}}, {{service_name}}, {{scheduled_time}}, {{price}}, {{pix_link}}" },
        delay_minutes:    { type: "number", description: "Atraso em minutos após o gatilho (0 = imediato)" },
      },
      required: ["name", "trigger_type", "message_template"],
    },
  },
  {
    name: "get_stats",
    description: "Retorna dados e métricas atuais do negócio.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_work_items",
    description: "Lista agendamentos/serviços do dia ou de um período.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Data no formato YYYY-MM-DD (padrão: hoje)" },
      },
      required: [],
    },
  },
  {
    name: "update_work_item_status",
    description: "Atualiza o status de um agendamento.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_item_id: { type: "string", description: "ID do agendamento" },
        status: {
          type: "string",
          enum: ["scheduled","confirmed","in_progress","completed","cancelled","no_show"],
          description: "Novo status",
        },
      },
      required: ["work_item_id", "status"],
    },
  },
  {
    name: "get_payments",
    description: "Lista pagamentos do negócio. Use para verificar se um PIX foi pago ou está pendente.",
    input_schema: {
      type: "object" as const,
      properties: {
        status:        { type: "string", enum: ["pending","paid","failed","expired"], description: "Filtrar por status (opcional)" },
        customer_name: { type: "string", description: "Filtrar por nome do cliente (opcional)" },
      },
      required: [],
    },
  },
  {
    name: "mark_payment_received",
    description: "Marca um pagamento PIX como recebido e automaticamente marca o serviço vinculado como concluído.",
    input_schema: {
      type: "object" as const,
      properties: {
        payment_id: { type: "string", description: "ID do pagamento a marcar como pago" },
      },
      required: ["payment_id"],
    },
  },
  {
    name: "reschedule_work_item",
    description: "Reagenda um agendamento para uma nova data/hora.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_item_id: { type: "string", description: "ID do agendamento" },
        new_start:    { type: "string", description: "Nova data/hora ISO 8601 com offset de Brasília (ex: 2025-05-21T15:00:00-03:00). SEMPRE inclua -03:00." },
      },
      required: ["work_item_id", "new_start"],
    },
  },
  {
    name: "get_available_slots",
    description: "Verifica horários disponíveis em uma data.",
    input_schema: {
      type: "object" as const,
      properties: {
        date:       { type: "string", description: "Data YYYY-MM-DD" },
        service_id: { type: "string", description: "ID do serviço (opcional)" },
        staff_id:   { type: "string", description: "ID do colaborador (opcional)" },
      },
      required: ["date"],
    },
  },
  {
    name: "create_pix_payment",
    description: "Gera uma cobrança PIX e envia o link via WhatsApp se o cliente tiver telefone.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount:       { type: "number", description: "Valor em reais (ex: 150.00)" },
        description:  { type: "string", description: "Descrição da cobrança" },
        work_item_id: { type: "string", description: "ID do agendamento vinculado (opcional)" },
      },
      required: ["amount", "description"],
    },
  },
  {
    name: "get_customer_history",
    description: "Retorna histórico completo de um cliente: agendamentos recentes, total gasto e visitas.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_name: { type: "string", description: "Nome do cliente" },
      },
      required: ["customer_name"],
    },
  },
  {
    name: "update_work_item",
    description: "Atualiza detalhes de um agendamento: valor, observações, colaborador ou horário.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_item_id:       { type: "string", description: "ID do agendamento" },
        price_estimate_brl: { type: "number", description: "Novo valor em reais (opcional)" },
        notes:              { type: "string", description: "Observações (opcional)" },
        assigned_staff_id:  { type: "string", description: "ID do colaborador (opcional)" },
        scheduled_start:    { type: "string", description: "Nova data/hora ISO 8601 com offset de Brasília (ex: 2025-05-21T15:00:00-03:00). SEMPRE inclua -03:00." },
      },
      required: ["work_item_id"],
    },
  },
  {
    name: "list_week_schedule",
    description: "Lista todos os agendamentos da semana atual ou de uma semana específica.",
    input_schema: {
      type: "object" as const,
      properties: {
        week_start: { type: "string", description: "Segunda-feira da semana YYYY-MM-DD (padrão: semana atual)" },
      },
      required: [],
    },
  },
  {
    name: "send_whatsapp_to_customer",
    description: "Envia uma mensagem WhatsApp diretamente para um cliente.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_name: { type: "string", description: "Nome do cliente" },
        message:       { type: "string", description: "Texto da mensagem" },
      },
      required: ["customer_name", "message"],
    },
  },
  {
    name: "navigate_to",
    description: "Navega o usuário para uma página do sistema.",
    input_schema: {
      type: "object" as const,
      properties: {
        href: {
          type: "string",
          enum: [
            "/dashboard", "/dashboard/work-items", "/dashboard/calendar",
            "/dashboard/customers", "/dashboard/conversations", "/dashboard/payments",
            "/dashboard/staff", "/dashboard/automations", "/dashboard/analytics",
            "/dashboard/approvals", "/dashboard/team-tasks",
          ],
          description: "Caminho da página",
        },
        label: { type: "string", description: "Nome legível da página (ex: Pagamentos)" },
      },
      required: ["href", "label"],
    },
  },
  {
    name: "assign_task",
    description: "Atribui um chamado/agendamento a um colaborador da equipe pelo nome.",
    input_schema: {
      type: "object" as const,
      properties: {
        staff_name:    { type: "string", description: "Nome do colaborador a atribuir" },
        work_item_id:  { type: "string", description: "ID do agendamento (opcional se customer_name for fornecido)" },
        customer_name: { type: "string", description: "Nome do cliente para localizar o agendamento (opcional)" },
      },
      required: ["staff_name"],
    },
  },
  {
    name: "message_team_member",
    description: "Envia uma mensagem interna para um colaborador da equipe.",
    input_schema: {
      type: "object" as const,
      properties: {
        staff_name: { type: "string", description: "Nome do colaborador" },
        message:    { type: "string", description: "Texto da mensagem" },
      },
      required: ["staff_name", "message"],
    },
  },
  {
    name: "update_staff",
    description: "Atualiza dados de um colaborador pelo nome (cargo, telefone, e-mail).",
    input_schema: {
      type: "object" as const,
      properties: {
        staff_name: { type: "string", description: "Nome do colaborador" },
        role:       { type: "string", description: "Novo cargo (opcional)" },
        phone:      { type: "string", description: "Novo telefone (opcional)" },
        email:      { type: "string", description: "Novo e-mail (opcional)" },
      },
      required: ["staff_name"],
    },
  },
  {
    name: "delete_staff",
    description: "Remove um colaborador da equipe pelo nome.",
    input_schema: {
      type: "object" as const,
      properties: {
        staff_name: { type: "string", description: "Nome do colaborador a remover" },
      },
      required: ["staff_name"],
    },
  },
  {
    name: "update_service",
    description: "Atualiza um serviço do catálogo pelo nome (preço, duração, descrição, ativo/inativo).",
    input_schema: {
      type: "object" as const,
      properties: {
        service_name:     { type: "string",  description: "Nome atual do serviço" },
        new_name:         { type: "string",  description: "Novo nome (opcional)" },
        description:      { type: "string",  description: "Nova descrição (opcional)" },
        duration_minutes: { type: "number",  description: "Nova duração em minutos (opcional)" },
        price_brl:        { type: "number",  description: "Novo preço em reais, ex: 65.00 (opcional)" },
        active:           { type: "boolean", description: "true = ativo, false = inativo (opcional)" },
      },
      required: ["service_name"],
    },
  },
  {
    name: "delete_service",
    description: "Remove um serviço do catálogo pelo nome.",
    input_schema: {
      type: "object" as const,
      properties: {
        service_name: { type: "string", description: "Nome do serviço a remover" },
      },
      required: ["service_name"],
    },
  },
  {
    name: "list_automations",
    description: "Lista todas as automações de mensagem do negócio com IDs e status.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "update_automation",
    description: "Atualiza uma automação pelo nome (mensagem, ativa/inativa, delay).",
    input_schema: {
      type: "object" as const,
      properties: {
        automation_name:  { type: "string",  description: "Nome da automação" },
        message_template: { type: "string",  description: "Novo template de mensagem (opcional)" },
        active:           { type: "boolean", description: "true = ativa, false = pausada (opcional)" },
        delay_minutes:    { type: "number",  description: "Novo atraso em minutos (opcional)" },
      },
      required: ["automation_name"],
    },
  },
  {
    name: "delete_automation",
    description: "Remove uma automação pelo nome.",
    input_schema: {
      type: "object" as const,
      properties: {
        automation_name: { type: "string", description: "Nome da automação a remover" },
      },
      required: ["automation_name"],
    },
  },
  {
    name: "list_faqs",
    description: "Lista as perguntas frequentes (FAQs) cadastradas no negócio.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "create_faq",
    description: "Adiciona uma nova pergunta frequente ao negócio.",
    input_schema: {
      type: "object" as const,
      properties: {
        question: { type: "string", description: "Pergunta" },
        answer:   { type: "string", description: "Resposta" },
      },
      required: ["question", "answer"],
    },
  },
  {
    name: "update_faq",
    description: "Atualiza uma FAQ existente pela pergunta.",
    input_schema: {
      type: "object" as const,
      properties: {
        question_search: { type: "string", description: "Trecho da pergunta para localizar a FAQ" },
        question:        { type: "string", description: "Nova pergunta (opcional)" },
        answer:          { type: "string", description: "Nova resposta (opcional)" },
      },
      required: ["question_search"],
    },
  },
  {
    name: "delete_faq",
    description: "Remove uma FAQ pela pergunta.",
    input_schema: {
      type: "object" as const,
      properties: {
        question_search: { type: "string", description: "Trecho da pergunta para localizar a FAQ" },
      },
      required: ["question_search"],
    },
  },
  {
    name: "list_skills",
    description: "Lista as instruções personalizadas (skills) configuradas para o assistente.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "create_skill",
    description: "Adiciona uma nova instrução personalizada ao assistente.",
    input_schema: {
      type: "object" as const,
      properties: {
        name:    { type: "string", description: "Nome da instrução" },
        content: { type: "string", description: "Conteúdo/texto da instrução" },
      },
      required: ["name", "content"],
    },
  },
  {
    name: "update_skill",
    description: "Atualiza uma instrução personalizada pelo nome (conteúdo, nome ou ativo/inativo).",
    input_schema: {
      type: "object" as const,
      properties: {
        skill_name: { type: "string", description: "Nome da instrução a atualizar" },
        name:       { type: "string", description: "Novo nome (opcional)" },
        content:    { type: "string", description: "Novo conteúdo (opcional)" },
        active:     { type: "boolean", description: "true = ativar instrução, false = desativar (opcional)" },
      },
      required: ["skill_name"],
    },
  },
  {
    name: "delete_skill",
    description: "Remove uma instrução personalizada pelo nome.",
    input_schema: {
      type: "object" as const,
      properties: {
        skill_name: { type: "string", description: "Nome da instrução a remover" },
      },
      required: ["skill_name"],
    },
  },
  {
    name: "toggle_conversation_ai",
    description: "Ativa ou desativa o bot de IA para a conversa de um cliente.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_name: { type: "string", description: "Nome do cliente" },
        enabled:       { type: "boolean", description: "true = ativar bot, false = desativar bot" },
      },
      required: ["customer_name", "enabled"],
    },
  },
  {
    name: "create_manual_payment",
    description: "Registra um pagamento manual (dinheiro, cartão, transferência) para um cliente.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_name: { type: "string", description: "Nome do cliente" },
        amount_brl:    { type: "number", description: "Valor em reais (ex: 150.00)" },
        description:   { type: "string", description: "Descrição do pagamento (opcional)" },
      },
      required: ["customer_name", "amount_brl"],
    },
  },
  {
    name: "list_services",
    description: "Lista todos os serviços disponíveis com ID, nome, duração e preço. Use antes de criar agendamentos para resolver o service_id correto.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_staff",
    description: "Lista todos os colaboradores com ID e nome. Use antes de criar agendamentos para resolver o staff_id correto.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "cancel_work_item",
    description: "Cancela um agendamento. Dispara automação de cancelamento se configurada.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_item_id: { type: "string", description: "ID do agendamento" },
        reason:       { type: "string", description: "Motivo do cancelamento (opcional)" },
      },
      required: ["work_item_id"],
    },
  },
  {
    name: "complete_work_item",
    description: "Marca um serviço como concluído. Atualiza automaticamente as visitas e total gasto do cliente. Dispara automação de conclusão se configurada.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_item_id: { type: "string", description: "ID do agendamento" },
        notes:        { type: "string", description: "Observações de conclusão (opcional)" },
      },
      required: ["work_item_id"],
    },
  },
  {
    name: "list_notifications",
    description: "Lista as últimas notificações do sistema (alertas de churn, no-shows, pagamentos pendentes, etc.).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "dismiss_notifications",
    description: "Marca todas as notificações não lidas como lidas.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "delete_work_item",
    description: "Apaga (remove permanentemente) um agendamento. SEMPRE confirme com o usuário antes de executar passando confirmed=true.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_item_id:  { type: "string", description: "ID do agendamento (use se já tiver)" },
        customer_name: { type: "string", description: "Nome do cliente para buscar o agendamento" },
        title_hint:    { type: "string", description: "Trecho do título para identificar o agendamento (opcional)" },
        confirmed:     { type: "boolean", description: "true = confirma a exclusão; omita ou false para pedir confirmação primeiro" },
      },
      required: [],
    },
  },
  {
    name: "list_customers",
    description: "Lista clientes com filtros. Use para 'clientes inativos', 'top clientes por gasto', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["active", "inactive", "blocked"], description: "Filtrar por status (opcional)" },
        sort:   { type: "string", enum: ["total_spent", "last_visit", "visits", "name"], description: "Ordenar por (padrão: last_visit)" },
        limit:  { type: "number", description: "Máximo de clientes a retornar (padrão: 10)" },
      },
      required: [],
    },
  },
  {
    name: "update_customer_tags",
    description: "Adiciona ou remove tags de um cliente. Tags são usadas para segmentar clientes.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_name: { type: "string", description: "Nome do cliente" },
        add_tags:      { type: "array", items: { type: "string" }, description: "Tags a adicionar (ex: [\"VIP\", \"fidelidade\"])" },
        remove_tags:   { type: "array", items: { type: "string" }, description: "Tags a remover" },
      },
      required: ["customer_name"],
    },
  },
  {
    name: "cancel_payment",
    description: "Cancela um pagamento pendente. Use quando o cliente desistiu ou a cobrança foi emitida errada.",
    input_schema: {
      type: "object" as const,
      properties: {
        payment_id:    { type: "string", description: "ID do pagamento (use se já tiver)" },
        customer_name: { type: "string", description: "Nome do cliente para localizar o pagamento pendente" },
      },
      required: [],
    },
  },
  {
    name: "get_work_item",
    description: "Retorna os detalhes completos de um agendamento específico: título, status, horário, notas, valor, colaborador.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_item_id:  { type: "string", description: "ID do agendamento (use se já tiver)" },
        customer_name: { type: "string", description: "Nome do cliente para buscar o agendamento mais recente" },
      },
      required: [],
    },
  },
  {
    name: "send_bulk_message",
    description: "Envia uma mensagem WhatsApp para um grupo de clientes filtrado por status ou tag. Máximo 50 clientes.",
    input_schema: {
      type: "object" as const,
      properties: {
        message:       { type: "string", description: "Texto da mensagem a enviar" },
        filter_status: { type: "string", enum: ["active", "inactive", "blocked"], description: "Enviar apenas para clientes com esse status (opcional)" },
        filter_tag:    { type: "string", description: "Enviar apenas para clientes com essa tag (opcional)" },
      },
      required: ["message"],
    },
  },
  {
    name: "read_conversation_messages",
    description: "Lê as últimas mensagens da conversa de um cliente. Use para 'o que Maria perguntou?', 'leia a última conversa com João'.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_name: { type: "string", description: "Nome do cliente" },
        limit:         { type: "number", description: "Número de mensagens a retornar (padrão: 15)" },
      },
      required: ["customer_name"],
    },
  },
  {
    name: "delete_customer",
    description: "Apaga permanentemente um cliente e todo o seu histórico. SEMPRE confirme com o usuário antes.",
    input_schema: {
      type: "object" as const,
      properties: {
        customer_name: { type: "string", description: "Nome do cliente a apagar" },
        confirmed:     { type: "boolean", description: "true = confirma a exclusão; omita ou false para pedir confirmação primeiro" },
      },
      required: ["customer_name"],
    },
  },
  {
    name: "list_conversations",
    description: "Lista conversas abertas ou recentes no WhatsApp. Use para 'quais conversas tenho?', 'tem alguém esperando?', 'mensagens não lidas'.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["open", "waiting", "bot", "resolved", "all"], description: "Filtrar por status (padrão: abertas)" },
        limit:  { type: "number", description: "Máximo de conversas (padrão: 10)" },
      },
      required: [],
    },
  },
]

// ─── Tool executor ────────────────────────────────────────────────────────────

import type { BusinessContext } from "@/lib/ai/brain"

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  businessId: string,
  ctx: BusinessContext,
): Promise<string> {
  const admin = createAdminClient()

  if (name === "add_customer") {
    const { full_name, phone_number, email, notes } = input as {
      full_name: string; phone_number?: string; email?: string; notes?: string
    }
    // Dedup: return existing customer if name matches exactly (case-insensitive)
    const { data: existing } = await admin
      .from("customers")
      .select("id, full_name")
      .eq("business_id", businessId)
      .ilike("full_name", full_name)
      .limit(1)
      .maybeSingle()
    if (existing) {
      const e = existing as { id: string; full_name: string }
      return `Cliente "${e.full_name}" já existe (ID:${e.id}). Use o cliente existente.`
    }
    const { data: newCust, error } = await admin
      .from("customers")
      .insert({
        business_id: businessId,
        full_name,
        phone_number: phone_number ?? null,
        email: email ?? null,
        notes: notes ?? null,
        status: "active",
        tags: [],
        total_spent: 0,
        visit_count: 0,
        metadata: {},
      } as never)
      .select("id")
      .single()
    if (error) return `Erro ao adicionar cliente: ${error.message}`
    return `Cliente "${full_name}" criado (ID:${(newCust as { id: string }).id}). Agora pode agendar normalmente.`
  }

  if (name === "search_customers") {
    const { query } = input as { query: string }
    const { data } = await admin
      .from("customers")
      .select("id, full_name, phone_number, email, status, visit_count, total_spent")
      .eq("business_id", businessId)
      .or(`full_name.ilike.%${query}%,phone_number.ilike.%${query}%`)
      .limit(5)
    if (!data || (data as unknown[]).length === 0) return "Nenhum cliente encontrado."
    return (data as Array<{ id: string; full_name: string; phone_number: string | null; visit_count: number; total_spent: number }>)
      .map(c => `ID:${c.id} | ${c.full_name}${c.phone_number ? ` (${c.phone_number})` : ""} | ${c.visit_count} visitas | R$${(c.total_spent / 100).toFixed(2)} gastos`)
      .join("\n")
  }

  if (name === "update_customer") {
    const { customer_id, customer_name, phone_number, email, address, city, notes, status } = input as {
      customer_id?: string; customer_name?: string; phone_number?: string; email?: string
      address?: string; city?: string; notes?: string; status?: string
    }
    let resolvedId = customer_id
    if (!resolvedId && customer_name) {
      const { data: found } = await admin.from("customers").select("id")
        .eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1).single()
      if (!found) return `Cliente "${customer_name}" não encontrado.`
      resolvedId = (found as { id: string }).id
    }
    if (!resolvedId) return "Informe o nome ou ID do cliente."
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (phone_number !== undefined) patch.phone_number = phone_number || null
    if (email !== undefined) patch.email = email || null
    if (address !== undefined) patch.address = address || null
    if (city !== undefined) patch.city = city || null
    if (notes !== undefined) patch.notes = notes || null
    if (status !== undefined) patch.status = status
    const { error } = await admin.from("customers").update(patch as never)
      .eq("id", resolvedId).eq("business_id", businessId)
    if (error) return `Erro ao atualizar cliente: ${error.message}`
    return "Cliente atualizado ✓"
  }

  // Treat datetime strings without timezone offset as Brasília time (UTC-3)
  function toBrazilISO(s: string | undefined | null): string | null {
    if (!s) return null
    if (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s).toISOString()
    return new Date(`${s}-03:00`).toISOString()
  }

  if (name === "add_work_item") {
    const { title, customer_name, service_name, scheduled_start, scheduled_end, price_estimate, notes } = input as {
      title: string; customer_name?: string; service_name?: string; scheduled_start?: string
      scheduled_end?: string; price_estimate?: number; notes?: string
    }
    let customerId: string | null = null
    if (customer_name) {
      const { data: found } = await admin
        .from("customers")
        .select("id, full_name")
        .eq("business_id", businessId)
        .ilike("full_name", `%${customer_name}%`)
        .limit(5)
      const matches = (found as Array<{ id: string; full_name: string }> | null) ?? []
      if (matches.length === 0) {
        return `CLIENTE_NAO_ENCONTRADO: Nenhum cliente com nome "${customer_name}" cadastrado. Confirme se o nome está correto ou se deve criar um novo cliente.`
      }
      if (matches.length > 1) {
        const list = matches.map(m => `"${m.full_name}" (ID:${m.id})`).join(", ")
        return `CLIENTE_MULTIPLOS: Encontrei ${matches.length} clientes com nomes parecidos: ${list}. Qual é o correto?`
      }
      customerId = matches[0].id
    }
    let serviceId: string | null = null
    if (service_name) {
      const { data: svc } = await admin
        .from("services")
        .select("id, price")
        .eq("business_id", businessId)
        .ilike("name", `%${service_name}%`)
        .limit(1)
        .single()
      if (svc) {
        const s = svc as { id: string; price: number | null }
        serviceId = s.id
        if (!price_estimate && s.price) {
          // auto-fill price from service catalog
          ;(input as Record<string, unknown>).price_estimate = s.price
        }
      }
    }

    const { data: newItem, error } = await admin
      .from("work_items")
      .insert({
        business_id: businessId,
        customer_id: customerId,
        service_id: serviceId,
        title,
        type: "service_call",
        status: "scheduled",
        payment_status: "unpaid",
        scheduled_start: toBrazilISO(scheduled_start),
        scheduled_end: toBrazilISO(scheduled_end),
        price_estimate: price_estimate ?? null,
        notes: notes ?? null,
        metadata: {},
      } as never)
      .select("id")
      .single()
    if (error) return `Erro ao criar agendamento: ${error.message}`
    const workItemId = (newItem as { id: string }).id
    triggerBookingCreated(workItemId, businessId).catch(() => {})
    return `Agendamento "${title}" criado para ${customer_name ?? "cliente"} ✓ (aparece em Chamados e Calendário)`
  }

  if (name === "add_staff") {
    const { name, role, phone, email } = input as {
      name: string; role?: string; phone?: string; email?: string
    }
    const { error } = await admin
      .from("staff")
      .insert({
        business_id: businessId,
        name,
        role: role ?? null,
        phone: phone ?? null,
        email: email ?? null,
        working_hours: {},
        services: [],
        color: "#6366f1",
        active: true,
      } as never)
    if (error) return `Erro ao adicionar colaborador: ${error.message}`
    return `Colaborador "${name}" adicionado à equipe.`
  }

  if (name === "add_service") {
    const { name, description, duration_minutes, price, category } = input as {
      name: string; description?: string; duration_minutes: number; price?: number; category?: string
    }
    const { error } = await admin
      .from("services")
      .insert({
        business_id: businessId,
        name,
        description: description ?? null,
        duration_minutes,
        price: price ?? null,
        price_max: null,
        category: category ?? null,
        active: true,
      } as never)
    if (error) return `Erro ao adicionar serviço: ${error.message}`
    return `Serviço "${name}" adicionado ao catálogo.`
  }

  if (name === "create_automation") {
    const { name, trigger_type, message_template, delay_minutes } = input as {
      name: string; trigger_type: string; message_template: string; delay_minutes?: number
    }
    const { error } = await admin
      .from("automations")
      .insert({
        business_id: businessId,
        name,
        trigger_type,
        message_template,
        delay_minutes: delay_minutes ?? 0,
        conditions: {},
        active: true,
        run_count: 0,
        last_run_at: null,
      } as never)
    if (error) return `Erro ao criar automação: ${error.message}`
    return `Automação "${name}" criada e ativa.`
  }

  if (name === "get_stats") {
    const m = ctx.metrics
    const fmt = (c: number) => `R$${(c / 100).toFixed(2)}`
    return `Hoje: ${m.todayItems} agendamentos, receita ${fmt(m.todayRevenue)}, ${m.openConversations} conversas abertas, ${m.pendingPayments} pagamentos pendentes. Total clientes: ${m.totalCustomers}.`
  }

  if (name === "navigate_to") {
    const { href } = input as { href: string }
    return `NAVIGATE:${href}`
  }

  if (name === "list_work_items") {
    const { date } = input as { date?: string }
    const targetDate = date ?? spToday()
    const { start, end } = spDayRange(targetDate)
    const { data } = await admin
      .from("work_items")
      .select("title, status, scheduled_start, customer_id")
      .eq("business_id", businessId)
      .gte("scheduled_start", start)
      .lte("scheduled_start", end)
      .neq("status", "cancelled")
      .order("scheduled_start", { ascending: true })
    if (!data || (data as unknown[]).length === 0) return `Nenhum agendamento em ${targetDate}.`
    type Row = { title: string; status: string; scheduled_start: string | null }
    return (data as Row[])
      .map(w => `- ${w.scheduled_start ? formatSpTime(w.scheduled_start) : "?"} | ${w.title} | ${w.status}`)
      .join("\n")
  }

  if (name === "update_work_item_status") {
    const { work_item_id, status } = input as { work_item_id: string; status: string }
    const { error } = await admin
      .from("work_items")
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("id", work_item_id)
      .eq("business_id", businessId)
    if (error) return `Erro ao atualizar status: ${error.message}`
    return `Status atualizado para "${status}".`
  }

  if (name === "get_payments") {
    const { status, customer_name } = input as { status?: string; customer_name?: string }
    let query = admin
      .from("payments")
      .select("id, amount, status, created_at, paid_at, work_item:work_items(id, title), customer:customers(full_name)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(15)
    if (status) query = (query as ReturnType<typeof admin.from>).eq("status", status) as typeof query
    const { data } = await query
    type PayRow = { id: string; amount: number; status: string; created_at: string; work_item: { id: string; title: string } | null; customer: { full_name: string } | null }
    let rows = ((data as PayRow[] | null) ?? [])
    if (customer_name) {
      const q = customer_name.toLowerCase()
      rows = rows.filter(p => p.customer?.full_name?.toLowerCase().includes(q))
    }
    if (rows.length === 0) return "Nenhum pagamento encontrado."
    return rows.map(p =>
      `ID:${p.id} | ${p.status.toUpperCase()} | R$${(p.amount / 100).toFixed(2)} | ${p.customer?.full_name ?? "?"} | ${p.work_item?.title ?? "sem serviço"}`
    ).join("\n")
  }

  if (name === "mark_payment_received") {
    const { payment_id } = input as { payment_id: string }
    const { data: payRaw } = await admin
      .from("payments")
      .select("id, work_item_id")
      .eq("id", payment_id)
      .eq("business_id", businessId)
      .single()
    const pay = payRaw as { id: string; work_item_id: string | null } | null
    if (!pay) return "Pagamento não encontrado."
    const now = new Date().toISOString()
    await admin.from("payments").update({ status: "paid", paid_at: now, updated_at: now } as never).eq("id", payment_id)
    if (pay.work_item_id) {
      await admin.from("work_items").update({ status: "completed", payment_status: "paid", updated_at: now } as never).eq("id", pay.work_item_id)
      return "Pagamento marcado como recebido e serviço marcado como concluído ✓"
    }
    return "Pagamento marcado como recebido ✓"
  }

  // ── Delegated to tool-executor (receptionist infra) ──────────────────────
  const DELEGATED = ["reschedule_work_item", "get_available_slots"]
  if (DELEGATED.includes(name)) {
    return await executeToolCall(name, input, { businessId, conversationId: "dashboard-assistant", approvalMode: false })
  }

  if (name === "create_pix_payment") {
    return await executeToolCall("create_payment_link", { ...input, payment_method: "pix" }, {
      businessId, conversationId: "dashboard-assistant", approvalMode: false,
    })
  }

  // ── Inline handlers ───────────────────────────────────────────────────────

  if (name === "get_customer_history") {
    const { customer_name } = input as { customer_name: string }
    const { data: found } = await admin.from("customers").select("id,full_name")
      .eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1).single()
    if (!found) return `Cliente "${customer_name}" não encontrado.`
    const c = found as { id: string; full_name: string }
    const history = await getCustomerWithHistory(c.id)
    if (!history) return "Histórico indisponível."
    const fmt = (cents: number) => `R$${(cents / 100).toFixed(2)}`
    type WItem = { title: string; status: string; scheduled_start: string | null; final_price: number | null }
    const lines = (history.workItems as WItem[]).slice(0, 8).map(w =>
      `- ${w.scheduled_start ? new Date(w.scheduled_start).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "?"} | ${w.title} | ${w.status}${w.final_price ? ` | ${fmt(w.final_price)}` : ""}`
    ).join("\n")
    const cu = history.customer as { full_name: string; visit_count: number; total_spent: number }
    return `${cu.full_name}: ${cu.visit_count} visitas, ${fmt(cu.total_spent)} gastos.\n${lines || "Sem histórico."}`
  }

  if (name === "update_work_item") {
    const { work_item_id, price_estimate_brl, notes, assigned_staff_id, scheduled_start } = input as {
      work_item_id: string; price_estimate_brl?: number; notes?: string
      assigned_staff_id?: string; scheduled_start?: string
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (price_estimate_brl != null) patch.price_estimate = Math.round(price_estimate_brl * 100)
    if (notes != null) patch.notes = notes
    if (assigned_staff_id != null) patch.assigned_staff_id = assigned_staff_id
    if (scheduled_start != null) patch.scheduled_start = toBrazilISO(scheduled_start)
    const { error } = await admin.from("work_items").update(patch as never)
      .eq("id", work_item_id).eq("business_id", businessId)
    if (error) return `Erro ao atualizar: ${error.message}`
    return "Agendamento atualizado ✓"
  }

  if (name === "list_week_schedule") {
    const { week_start } = input as { week_start?: string }
    const monday = week_start ?? (() => {
      const todayStr = spToday()
      const d = new Date(`${todayStr}T12:00:00-03:00`)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
    })()
    const items = await getCalendarItems(businessId, monday)
    if (!items.length) return `Nenhum agendamento na semana de ${monday}.`
    const tz = "America/Sao_Paulo"
    type CalItem = { scheduled_start: string | null; customer?: { full_name: string } | null; service?: { name: string } | null; status: string }
    return (items as CalItem[]).map(i =>
      `- ${i.scheduled_start ? new Date(i.scheduled_start).toLocaleString("pt-BR", { timeZone: tz, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "?"} | ${i.customer?.full_name ?? "?"} | ${i.service?.name ?? "?"} | ${i.status}`
    ).join("\n")
  }

  if (name === "send_whatsapp_to_customer") {
    const { customer_name, message } = input as { customer_name: string; message: string }
    const { data: custRaw } = await admin.from("customers").select("phone_number")
      .eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1).single()
    const cust = custRaw as { phone_number: string | null } | null
    if (!cust?.phone_number) return `Nenhum telefone cadastrado para "${customer_name}".`
    const { data: bizRaw } = await admin.from("businesses")
      .select("whatsapp_phone_id").eq("id", businessId).single()
    const biz = bizRaw as { whatsapp_phone_id: string | null } | null
    if (!biz?.whatsapp_phone_id)
      return "WhatsApp não configurado. Configure em Configurações → WhatsApp."
    try {
      await sendTextMessage({ to: cust.phone_number, text: message, instanceName: biz.whatsapp_phone_id })
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      return `Erro ao enviar: ${detail}`
    }
    return `Mensagem enviada para ${customer_name} ✓`
  }

  if (name === "update_staff") {
    const { staff_name, role, phone, email } = input as { staff_name: string; role?: string; phone?: string; email?: string }
    const { data: found } = await admin.from("staff").select("id").eq("business_id", businessId).ilike("name", `%${staff_name}%`).limit(1).single()
    if (!found) return `Colaborador "${staff_name}" não encontrado.`
    const patch: Record<string, unknown> = {}
    if (role != null) patch.role = role
    if (phone != null) patch.phone = phone
    if (email != null) patch.email = email
    if (!Object.keys(patch).length) return "Nenhum campo para atualizar informado."
    const { error } = await admin.from("staff").update(patch as never).eq("id", (found as { id: string }).id)
    if (error) return `Erro ao atualizar colaborador: ${error.message}`
    return `Colaborador "${staff_name}" atualizado ✓`
  }

  if (name === "delete_staff") {
    const { staff_name } = input as { staff_name: string }
    const { data: found } = await admin.from("staff").select("id").eq("business_id", businessId).ilike("name", `%${staff_name}%`).limit(1).single()
    if (!found) return `Colaborador "${staff_name}" não encontrado.`
    const { error } = await admin.from("staff").delete().eq("id", (found as { id: string }).id)
    if (error) return `Erro ao remover colaborador: ${error.message}`
    return `Colaborador "${staff_name}" removido da equipe ✓`
  }

  if (name === "update_service") {
    const { service_name, new_name, description, duration_minutes, price_brl, active } = input as {
      service_name: string; new_name?: string; description?: string
      duration_minutes?: number; price_brl?: number; active?: boolean
    }
    const { data: found } = await admin.from("services").select("id").eq("business_id", businessId).ilike("name", `%${service_name}%`).limit(1).single()
    if (!found) return `Serviço "${service_name}" não encontrado.`
    const patch: Record<string, unknown> = {}
    if (new_name != null) patch.name = new_name
    if (description != null) patch.description = description
    if (duration_minutes != null) patch.duration_minutes = duration_minutes
    if (price_brl != null) patch.price = Math.round(price_brl * 100)
    if (active != null) patch.active = active
    if (!Object.keys(patch).length) return "Nenhum campo para atualizar informado."
    const { error } = await admin.from("services").update(patch as never).eq("id", (found as { id: string }).id)
    if (error) return `Erro ao atualizar serviço: ${error.message}`
    return `Serviço "${service_name}" atualizado ✓`
  }

  if (name === "delete_service") {
    const { service_name } = input as { service_name: string }
    const { data: found } = await admin.from("services").select("id").eq("business_id", businessId).ilike("name", `%${service_name}%`).limit(1).single()
    if (!found) return `Serviço "${service_name}" não encontrado.`
    const { error } = await admin.from("services").delete().eq("id", (found as { id: string }).id)
    if (error) return `Erro ao remover serviço: ${error.message}`
    return `Serviço "${service_name}" removido do catálogo ✓`
  }

  if (name === "list_automations") {
    const { data } = await admin
      .from("automations")
      .select("id, name, trigger_type, active, delay_minutes, message_template")
      .eq("business_id", businessId)
      .order("name", { ascending: true })
    if (!data || (data as unknown[]).length === 0) return "Nenhuma automação cadastrada."
    type AutoRow = { id: string; name: string; trigger_type: string; active: boolean; delay_minutes: number; message_template: string }
    return (data as AutoRow[]).map(a =>
      `ID:${a.id} | ${a.name} | ${a.trigger_type} | ${a.active ? "ATIVA" : "PAUSADA"} | Delay: ${a.delay_minutes}min | Msg: "${a.message_template.slice(0, 60)}..."`
    ).join("\n")
  }

  if (name === "update_automation") {
    const { automation_name, message_template, active, delay_minutes } = input as {
      automation_name: string; message_template?: string; active?: boolean; delay_minutes?: number
    }
    const { data: found } = await admin.from("automations").select("id").eq("business_id", businessId).ilike("name", `%${automation_name}%`).limit(1).single()
    if (!found) return `Automação "${automation_name}" não encontrada.`
    const patch: Record<string, unknown> = {}
    if (message_template != null) patch.message_template = message_template
    if (active != null) patch.active = active
    if (delay_minutes != null) patch.delay_minutes = delay_minutes
    if (!Object.keys(patch).length) return "Nenhum campo para atualizar informado."
    const { error } = await admin.from("automations").update(patch as never).eq("id", (found as { id: string }).id)
    if (error) return `Erro ao atualizar automação: ${error.message}`
    return `Automação "${automation_name}" atualizada ✓`
  }

  if (name === "delete_automation") {
    const { automation_name } = input as { automation_name: string }
    const { data: found } = await admin.from("automations").select("id").eq("business_id", businessId).ilike("name", `%${automation_name}%`).limit(1).single()
    if (!found) return `Automação "${automation_name}" não encontrada.`
    const { error } = await admin.from("automations").delete().eq("id", (found as { id: string }).id)
    if (error) return `Erro ao remover automação: ${error.message}`
    return `Automação "${automation_name}" removida ✓`
  }

  if (name === "list_faqs") {
    const { data } = await admin
      .from("business_faqs")
      .select("id, question, answer, active")
      .eq("business_id", businessId)
      .order("question", { ascending: true })
    if (!data || (data as unknown[]).length === 0) return "Nenhuma FAQ cadastrada."
    type FaqRow = { id: string; question: string; answer: string; active: boolean }
    return (data as FaqRow[]).map(f =>
      `ID:${f.id} | ${f.active ? "✓" : "✗"} | P: ${f.question} | R: ${f.answer.slice(0, 80)}${f.answer.length > 80 ? "..." : ""}`
    ).join("\n")
  }

  if (name === "create_faq") {
    const { question, answer } = input as { question: string; answer: string }
    const { error } = await admin.from("business_faqs").insert({
      business_id: businessId, question, answer, active: true,
    } as never)
    if (error) return `Erro ao criar FAQ: ${error.message}`
    return `FAQ criada: "${question}" ✓`
  }

  if (name === "update_faq") {
    const { question_search, question, answer } = input as { question_search: string; question?: string; answer?: string }
    const { data: found } = await admin.from("business_faqs").select("id").eq("business_id", businessId).ilike("question", `%${question_search}%`).limit(1).single()
    if (!found) return `FAQ com "${question_search}" não encontrada.`
    const patch: Record<string, unknown> = {}
    if (question != null) patch.question = question
    if (answer != null) patch.answer = answer
    if (!Object.keys(patch).length) return "Nenhum campo para atualizar informado."
    const { error } = await admin.from("business_faqs").update(patch as never).eq("id", (found as { id: string }).id)
    if (error) return `Erro ao atualizar FAQ: ${error.message}`
    return `FAQ atualizada ✓`
  }

  if (name === "delete_faq") {
    const { question_search } = input as { question_search: string }
    const { data: found } = await admin.from("business_faqs").select("id, question").eq("business_id", businessId).ilike("question", `%${question_search}%`).limit(1).single()
    if (!found) return `FAQ com "${question_search}" não encontrada.`
    const { error } = await admin.from("business_faqs").delete().eq("id", (found as { id: string; question: string }).id)
    if (error) return `Erro ao remover FAQ: ${error.message}`
    return `FAQ "${(found as { id: string; question: string }).question}" removida ✓`
  }

  if (name === "list_skills") {
    const { data } = await admin
      .from("business_skills")
      .select("id, name, content, active")
      .eq("business_id", businessId)
      .order("order_index", { ascending: true })
    if (!data || (data as unknown[]).length === 0) return "Nenhuma instrução personalizada cadastrada."
    type SkillRow = { id: string; name: string; content: string; active: boolean }
    return (data as SkillRow[]).map(s =>
      `ID:${s.id} | ${s.active ? "✓" : "✗"} | ${s.name}: ${s.content.slice(0, 80)}${s.content.length > 80 ? "..." : ""}`
    ).join("\n")
  }

  if (name === "create_skill") {
    const { name: skillName, content } = input as { name: string; content: string }
    const { error } = await admin.from("business_skills").insert({
      business_id: businessId, name: skillName, content, active: true, order_index: 0,
    } as never)
    if (error) return `Erro ao criar instrução: ${error.message}`
    return `Instrução "${skillName}" adicionada ✓`
  }

  if (name === "update_skill") {
    const { skill_name, name: newName, content, active } = input as { skill_name: string; name?: string; content?: string; active?: boolean }
    const { data: found } = await admin.from("business_skills").select("id").eq("business_id", businessId).ilike("name", `%${skill_name}%`).limit(1).single()
    if (!found) return `Instrução "${skill_name}" não encontrada.`
    const patch: Record<string, unknown> = {}
    if (newName != null) patch.name = newName
    if (content != null) patch.content = content
    if (active != null) patch.active = active
    if (!Object.keys(patch).length) return "Nenhum campo para atualizar informado."
    const { error } = await admin.from("business_skills").update(patch as never).eq("id", (found as { id: string }).id)
    if (error) return `Erro ao atualizar instrução: ${error.message}`
    return `Instrução "${skill_name}" ${active != null ? (active ? "ativada" : "desativada") : "atualizada"} ✓`
  }

  if (name === "delete_skill") {
    const { skill_name } = input as { skill_name: string }
    const { data: found } = await admin.from("business_skills").select("id, name").eq("business_id", businessId).ilike("name", `%${skill_name}%`).limit(1).single()
    if (!found) return `Instrução "${skill_name}" não encontrada.`
    const { error } = await admin.from("business_skills").delete().eq("id", (found as { id: string; name: string }).id)
    if (error) return `Erro ao remover instrução: ${error.message}`
    return `Instrução "${(found as { id: string; name: string }).name}" removida ✓`
  }


  if (name === "toggle_conversation_ai") {
    const { customer_name, enabled } = input as { customer_name: string; enabled: boolean }
    const { data: cust } = await admin.from("customers").select("id").eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1).single()
    if (!cust) return `Cliente "${customer_name}" não encontrado.`
    const { data: conv } = await admin.from("conversations").select("id").eq("business_id", businessId).eq("customer_id", (cust as { id: string }).id).order("last_message_at", { ascending: false }).limit(1).single()
    if (!conv) return `Nenhuma conversa encontrada para "${customer_name}".`
    const { error } = await admin.from("conversations").update({ ai_active: enabled } as never).eq("id", (conv as { id: string }).id)
    if (error) return `Erro ao alterar bot: ${error.message}`
    return `Bot ${enabled ? "ativado" : "desativado"} para ${customer_name} ✓`
  }

  if (name === "create_manual_payment") {
    const { customer_name, amount_brl, description } = input as { customer_name: string; amount_brl: number; description?: string }
    const { data: cust } = await admin.from("customers").select("id, full_name").eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1).single()
    if (!cust) return `Cliente "${customer_name}" não encontrado.`
    const c = cust as { id: string; full_name: string }
    const now = new Date().toISOString()
    const { error } = await admin.from("payments").insert({
      business_id: businessId,
      customer_id: c.id,
      amount: Math.round(amount_brl * 100),
      status: "paid",
      description: description ?? "Pagamento manual",
      paid_at: now,
      metadata: { method: "manual" },
    } as never)
    if (error) return `Erro ao registrar pagamento: ${error.message}`
    await admin.from("customers").update({ total_spent: (await admin.from("customers").select("total_spent").eq("id", c.id).single().then(r => ((r.data as { total_spent: number } | null)?.total_spent ?? 0))) + Math.round(amount_brl * 100) } as never).eq("id", c.id)
    return `Pagamento de R$${amount_brl.toFixed(2)} registrado para ${c.full_name} ✓`
  }

  // ── list_services / list_staff — from BusinessContext, zero DB calls ──────
  if (name === "list_services") {
    if (!ctx.services.length) return "Nenhum serviço cadastrado."
    return ctx.services.map((s: { id: string; name: string; duration_minutes: number; price: number | null }) =>
      `- ${s.name} (ID: ${s.id}) | ${s.duration_minutes}min${s.price != null ? ` | R$${Number(s.price).toFixed(2)}` : ""}`
    ).join("\n")
  }

  if (name === "list_staff") {
    if (!ctx.staff.length) return "Nenhum colaborador cadastrado."
    return ctx.staff.map((s: { id: string; name: string; role: string | null }) =>
      `- ${s.name} (ID: ${s.id})${s.role ? ` | ${s.role}` : ""}`
    ).join("\n")
  }

  // ── cancel_work_item ───────────────────────────────────────────────────────
  if (name === "cancel_work_item") {
    const { work_item_id, reason } = input as { work_item_id: string; reason?: string }
    const { data: wi } = await admin.from("work_items")
      .select("metadata").eq("id", work_item_id).eq("business_id", businessId).single()
    if (!wi) return "Agendamento não encontrado."
    const meta = ((wi as { metadata: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>
    const history = [...((meta.status_history ?? []) as unknown[])]
    history.push({ status: "cancelled", changed_at: new Date().toISOString(), notes: reason })
    await admin.from("work_items").update({
      status: "cancelled", updated_at: new Date().toISOString(),
      metadata: { ...meta, status_history: history },
    } as never).eq("id", work_item_id)
    triggerBookingCancelled(work_item_id, businessId).catch(() => {})
    return "Agendamento cancelado ✓"
  }

  // ── complete_work_item ─────────────────────────────────────────────────────
  if (name === "complete_work_item") {
    const { work_item_id, notes } = input as { work_item_id: string; notes?: string }
    const { data: wi } = await admin.from("work_items")
      .select("customer_id, final_price, price_estimate, metadata")
      .eq("id", work_item_id).eq("business_id", businessId).single()
    if (!wi) return "Agendamento não encontrado."
    const wiRow = wi as { customer_id: string | null; final_price: number | null; price_estimate: number | null; metadata: Record<string, unknown> }
    const meta = (wiRow.metadata ?? {}) as Record<string, unknown>
    const history = [...((meta.status_history ?? []) as unknown[])]
    history.push({ status: "completed", changed_at: new Date().toISOString(), notes })
    await admin.from("work_items").update({
      status: "completed", updated_at: new Date().toISOString(),
      metadata: { ...meta, status_history: history },
    } as never).eq("id", work_item_id)
    // Update customer stats (visit_count, total_spent, last_visit_at)
    if (wiRow.customer_id) {
      const amount = (wiRow.final_price ?? wiRow.price_estimate ?? 0) as number
      const { data: customer } = await admin.from("customers")
        .select("total_spent, visit_count").eq("id", wiRow.customer_id).single()
      if (customer) {
        const c = customer as { total_spent: number; visit_count: number }
        await admin.from("customers").update({
          total_spent: (c.total_spent ?? 0) + amount,
          visit_count: (c.visit_count ?? 0) + 1,
          last_visit_at: new Date().toISOString(),
        } as never).eq("id", wiRow.customer_id)
      }
    }
    triggerBookingCompleted(work_item_id, businessId).catch(() => {})
    return "Serviço concluído ✓"
  }

  // ── list_notifications ─────────────────────────────────────────────────────
  if (name === "list_notifications") {
    const { data: notifs } = await admin.from("notifications")
      .select("title, body, read, created_at")
      .eq("business_id", businessId).order("created_at", { ascending: false }).limit(10)
    if (!notifs || !(notifs as unknown[]).length) return "Nenhuma notificação."
    const tz = "America/Sao_Paulo"
    type NotifRow = { title: string; body: string; read: boolean; created_at: string }
    return (notifs as NotifRow[]).map(n =>
      `${n.read ? "○" : "●"} [${new Date(n.created_at).toLocaleString("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" })}] ${n.title} — ${n.body}`
    ).join("\n")
  }

  // ── dismiss_notifications ──────────────────────────────────────────────────
  if (name === "dismiss_notifications") {
    await admin.from("notifications").update({ read: true } as never)
      .eq("business_id", businessId).eq("read", false)
    return "Todas as notificações marcadas como lidas ✓"
  }

  if (name === "delete_work_item") {
    const { work_item_id, customer_name, title_hint, confirmed } = input as {
      work_item_id?: string; customer_name?: string; title_hint?: string; confirmed?: boolean
    }
    let resolvedId = work_item_id
    if (!resolvedId && customer_name) {
      let q = admin.from("work_items").select("id, title, customer_id").eq("business_id", businessId).neq("status", "cancelled").order("scheduled_start", { ascending: false }).limit(5)
      if (title_hint) q = (q as ReturnType<typeof admin.from>).ilike("title", `%${title_hint}%`) as typeof q
      const { data: custRaw } = await admin.from("customers").select("id").eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1).single()
      if (custRaw) q = (q as ReturnType<typeof admin.from>).eq("customer_id", (custRaw as { id: string }).id) as typeof q
      const { data: items } = await q
      if (!items || !(items as unknown[]).length) return `Nenhum agendamento encontrado para "${customer_name}".`
      const first = (items as { id: string; title: string }[])[0]
      if (!confirmed) return `[Q] Confirma a exclusão permanente do agendamento "${first.title}"? Essa ação não pode ser desfeita.`
      resolvedId = first.id
    }
    if (!resolvedId) return "Informe o ID ou o nome do cliente do agendamento."
    if (!confirmed) {
      const { data: wi } = await admin.from("work_items").select("title").eq("id", resolvedId).single()
      return `[Q] Confirma a exclusão permanente de "${(wi as { title: string } | null)?.title ?? resolvedId}"? Essa ação não pode ser desfeita.`
    }
    const { error } = await admin.from("work_items").delete().eq("id", resolvedId).eq("business_id", businessId)
    if (error) return `Erro ao apagar agendamento: ${error.message}`
    return "Agendamento apagado permanentemente ✓"
  }

  if (name === "delete_customer") {
    const { customer_name, confirmed } = input as { customer_name: string; confirmed?: boolean }
    const { data: found } = await admin.from("customers").select("id, full_name").eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1).single()
    if (!found) return `Cliente "${customer_name}" não encontrado.`
    const c = found as { id: string; full_name: string }
    if (!confirmed) return `[Q] Confirma a exclusão permanente de "${c.full_name}" e todo o histórico? Essa ação não pode ser desfeita.`
    const { error } = await admin.from("customers").delete().eq("id", c.id).eq("business_id", businessId)
    if (error) return `Erro ao apagar cliente: ${error.message}`
    return `Cliente "${c.full_name}" apagado permanentemente ✓`
  }

  if (name === "list_conversations") {
    const { status, limit } = input as { status?: string; limit?: number }
    const lim = limit ?? 10
    let q = admin
      .from("conversations")
      .select("id, status, unread_count, last_message_at, ai_active, customers(full_name)")
      .eq("business_id", businessId)
      .order("last_message_at", { ascending: false })
      .limit(lim)
    if (!status || status === "all") {
      q = (q as ReturnType<typeof admin.from>).in("status", ["open", "waiting", "bot"]) as typeof q
    } else if (status !== "all") {
      q = (q as ReturnType<typeof admin.from>).eq("status", status) as typeof q
    }
    const { data } = await q
    if (!data || !(data as unknown[]).length) return "Nenhuma conversa encontrada."
    const tz = "America/Sao_Paulo"
    type ConvRow = { id: string; status: string; unread_count: number; last_message_at: string | null; ai_active: boolean; customers: { full_name: string } | null }
    return (data as unknown as ConvRow[]).map(c =>
      `${c.unread_count > 0 ? `🔴 ${c.unread_count} não lida${c.unread_count > 1 ? "s" : ""}` : "○"} | ${c.customers?.full_name ?? "?"} | ${c.status} | bot: ${c.ai_active ? "on" : "off"} | ${c.last_message_at ? new Date(c.last_message_at).toLocaleString("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" }) : "?"}`
    ).join("\n")
  }

  // ── list_customers ─────────────────────────────────────────────────────────
  if (name === "list_customers") {
    const { status, sort = "last_visit", limit = 10 } = input as {
      status?: string; sort?: string; limit?: number
    }
    const orderCol = sort === "total_spent" ? "total_spent" : sort === "visits" ? "visit_count" : sort === "name" ? "full_name" : "last_visit_at"
    const orderAsc = sort === "name"
    let q = admin.from("customers")
      .select("full_name, status, visit_count, total_spent, last_visit_at, tags")
      .eq("business_id", businessId)
      .order(orderCol, { ascending: orderAsc, nullsFirst: false })
      .limit(Math.min(Number(limit) || 10, 50))
    if (status) q = q.eq("status", status as never) as typeof q
    const { data } = await q
    if (!data || !(data as unknown[]).length) return status ? `Nenhum cliente com status "${status}".` : "Nenhum cliente cadastrado."
    const fmt = (c: number) => `R$${(c / 100).toFixed(2)}`
    type CRow = { full_name: string; status: string; visit_count: number; total_spent: number; last_visit_at: string | null; tags: string[] | null }
    return (data as unknown as CRow[]).map((c, i) =>
      `${i + 1}. ${c.full_name} | ${c.status} | ${c.visit_count} visitas | ${fmt(c.total_spent)} | última: ${c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "nunca"}${c.tags?.length ? ` | tags: ${c.tags.join(", ")}` : ""}`
    ).join("\n")
  }

  // ── update_customer_tags ───────────────────────────────────────────────────
  if (name === "update_customer_tags") {
    const { customer_name, add_tags, remove_tags } = input as {
      customer_name: string; add_tags?: string[]; remove_tags?: string[]
    }
    const { data: cust } = await admin.from("customers").select("id, full_name, tags").eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1).single()
    if (!cust) return `Cliente "${customer_name}" não encontrado.`
    const c = cust as { id: string; full_name: string; tags: string[] | null }
    let tags = [...(c.tags ?? [])]
    if (add_tags) tags = [...new Set([...tags, ...add_tags])]
    if (remove_tags) tags = tags.filter(t => !remove_tags.includes(t))
    const { error } = await admin.from("customers").update({ tags } as never).eq("id", c.id)
    if (error) return `Erro ao atualizar tags: ${error.message}`
    return `Tags de ${c.full_name} atualizadas: ${tags.length ? tags.join(", ") : "(nenhuma)"} ✓`
  }

  // ── cancel_payment ─────────────────────────────────────────────────────────
  if (name === "cancel_payment") {
    const { payment_id, customer_name } = input as { payment_id?: string; customer_name?: string }
    let targetId = payment_id
    if (!targetId) {
      if (!customer_name) return "Informe o ID do pagamento ou o nome do cliente."
      const { data: custs } = await admin.from("customers").select("id").eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1)
      const custId = (custs as Array<{ id: string }> | null)?.[0]?.id ?? null
      if (!custId) return `Cliente "${customer_name}" não encontrado.`
      const { data: pay } = await admin.from("payments").select("id").eq("business_id", businessId).eq("customer_id", custId).eq("status", "pending").order("created_at", { ascending: false }).limit(1).single()
      if (!pay) return `Nenhum pagamento pendente encontrado para "${customer_name}".`
      targetId = (pay as { id: string }).id
    }
    const { error } = await admin.from("payments").update({ status: "cancelled", updated_at: new Date().toISOString() } as never).eq("id", targetId).eq("business_id", businessId)
    if (error) return `Erro ao cancelar pagamento: ${error.message}`
    return "Pagamento cancelado ✓"
  }

  // ── get_work_item ──────────────────────────────────────────────────────────
  if (name === "get_work_item") {
    const { work_item_id, customer_name } = input as { work_item_id?: string; customer_name?: string }
    let q = admin.from("work_items")
      .select("id, title, status, scheduled_start, scheduled_end, price_estimate, final_price, notes, customer:customers(full_name), service:services(name), staff:staff(name)")
      .eq("business_id", businessId)
    if (work_item_id) {
      q = q.eq("id", work_item_id) as typeof q
    } else if (customer_name) {
      const { data: custs } = await admin.from("customers").select("id").eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1)
      const custId = (custs as Array<{ id: string }> | null)?.[0]?.id ?? null
      if (!custId) return `Cliente "${customer_name}" não encontrado.`
      q = q.eq("customer_id", custId).order("scheduled_start", { ascending: false }).limit(1) as typeof q
    } else {
      return "Informe o ID do agendamento ou o nome do cliente."
    }
    const { data: wi } = await (work_item_id ? q.single() : q.maybeSingle())
    if (!wi) return "Agendamento não encontrado."
    type WIDetail = { id: string; title: string; status: string; scheduled_start: string | null; scheduled_end: string | null; price_estimate: number | null; final_price: number | null; notes: string | null; customer: { full_name: string } | null; service: { name: string } | null; staff: { name: string } | null }
    const w = wi as unknown as WIDetail
    const tz = "America/Sao_Paulo"
    const fmtMoney = (c: number) => `R$${(c / 100).toFixed(2)}`
    return [
      `Título: ${w.title}`,
      `Status: ${w.status}`,
      w.customer ? `Cliente: ${w.customer.full_name}` : null,
      w.service ? `Serviço: ${w.service.name}` : null,
      w.staff ? `Colaborador: ${w.staff.name}` : null,
      w.scheduled_start ? `Início: ${new Date(w.scheduled_start).toLocaleString("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" })}` : null,
      w.scheduled_end ? `Fim: ${new Date(w.scheduled_end).toLocaleString("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" })}` : null,
      w.price_estimate ? `Valor estimado: ${fmtMoney(w.price_estimate)}` : null,
      w.final_price ? `Valor final: ${fmtMoney(w.final_price)}` : null,
      w.notes ? `Notas: ${w.notes}` : null,
      `ID: ${w.id}`,
    ].filter(Boolean).join("\n")
  }

  // ── send_bulk_message ──────────────────────────────────────────────────────
  if (name === "send_bulk_message") {
    const { message, filter_status, filter_tag } = input as {
      message: string; filter_status?: string; filter_tag?: string
    }
    const { data: bizRaw } = await admin.from("businesses")
      .select("whatsapp_phone_id").eq("id", businessId).single()
    const biz = bizRaw as { whatsapp_phone_id: string | null } | null
    if (!biz?.whatsapp_phone_id)
      return "WhatsApp não configurado. Configure em Configurações → WhatsApp antes de enviar mensagens em massa."
    let q = admin.from("customers")
      .select("full_name, phone_number, tags, status")
      .eq("business_id", businessId)
      .not("phone_number", "is", null)
      .limit(50)
    if (filter_status) q = q.eq("status", filter_status as never) as typeof q
    const { data: custs } = await q
    type CustRow = { full_name: string; phone_number: string | null; tags: string[] | null; status: string }
    let rows = (custs as unknown as CustRow[] | null) ?? []
    if (filter_tag) rows = rows.filter(c => (c.tags ?? []).includes(filter_tag))
    if (rows.length === 0) return "Nenhum cliente com telefone cadastrado encontrado para esse filtro."
    let sent = 0, noPhone = 0, failed = 0
    for (const c of rows) {
      if (!c.phone_number) { noPhone++; continue }
      try {
        await sendTextMessage({ to: c.phone_number, text: message, instanceName: biz.whatsapp_phone_id! })
        sent++
      } catch { failed++ }
    }
    const parts = [`${sent} mensagem${sent !== 1 ? "s" : ""} enviada${sent !== 1 ? "s" : ""}`]
    if (noPhone) parts.push(`${noPhone} sem telefone`)
    if (failed) parts.push(`${failed} com erro`)
    return parts.join(", ") + " ✓"
  }

  // ── read_conversation_messages ─────────────────────────────────────────────
  if (name === "read_conversation_messages") {
    const { customer_name, limit = 15 } = input as { customer_name: string; limit?: number }
    const { data: custs } = await admin.from("customers").select("id, full_name").eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1)
    const custRow = (custs as Array<{ id: string; full_name: string }> | null)?.[0] ?? null
    if (!custRow) return `Cliente "${customer_name}" não encontrado.`
    const { data: conv } = await admin.from("conversations").select("id").eq("business_id", businessId).eq("customer_id", custRow.id).order("last_message_at", { ascending: false }).limit(1).single()
    if (!conv) return `Nenhuma conversa encontrada para "${customer_name}".`
    const { data: msgs } = await admin.from("messages")
      .select("direction, content, sent_at")
      .eq("conversation_id", (conv as { id: string }).id)
      .order("sent_at", { ascending: false })
      .limit(Math.min(Number(limit) || 15, 30))
    if (!msgs || !(msgs as unknown[]).length) return "Conversa vazia."
    const tz = "America/Sao_Paulo"
    type MsgRow = { direction: string; content: string; sent_at: string }
    return (msgs as MsgRow[]).reverse().map(m => {
      const time = new Date(m.sent_at).toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" })
      const who = m.direction === "inbound" ? custRow.full_name : "Assistente"
      return `[${time}] ${who}: ${m.content}`
    }).join("\n")
  }

  // ── assign_task ────────────────────────────────────────────────────────────
  if (name === "assign_task") {
    const { staff_name, work_item_id, customer_name } = input as {
      staff_name: string; work_item_id?: string; customer_name?: string
    }
    // Resolve staff
    const { data: staffRow } = await admin.from("staff").select("id, name")
      .eq("business_id", businessId).ilike("name", `%${staff_name}%`).limit(1).single()
    if (!staffRow) return `Colaborador "${staff_name}" não encontrado.`
    const s = staffRow as { id: string; name: string }

    // Resolve work item
    let itemId = work_item_id
    if (!itemId && customer_name) {
      const { data: cust } = await admin.from("customers").select("id")
        .eq("business_id", businessId).ilike("full_name", `%${customer_name}%`).limit(1).single()
      if (!cust) return `Cliente "${customer_name}" não encontrado.`
      const { data: wi } = await admin.from("work_items").select("id")
        .eq("business_id", businessId).eq("customer_id", (cust as { id: string }).id)
        .not("status", "in", '("cancelled","completed")').order("created_at", { ascending: false }).limit(1).single()
      if (!wi) return `Nenhum agendamento ativo encontrado para "${customer_name}".`
      itemId = (wi as { id: string }).id
    }
    if (!itemId) return "Informe o ID do agendamento ou o nome do cliente."

    const { error } = await admin.from("work_items").update({ assigned_staff_id: s.id } as never)
      .eq("id", itemId).eq("business_id", businessId)
    if (error) return `Erro ao atribuir: ${error.message}`
    return `Agendamento atribuído a ${s.name} ✓`
  }

  // ── message_team_member ────────────────────────────────────────────────────
  if (name === "message_team_member") {
    const { staff_name, message } = input as { staff_name: string; message: string }
    const { data: staffRow } = await admin.from("staff").select("id, name")
      .eq("business_id", businessId).ilike("name", `%${staff_name}%`).limit(1).single()
    if (!staffRow) return `Colaborador "${staff_name}" não encontrado.`
    const s = staffRow as { id: string; name: string }

    // Need sender_user_id — get it from ctx or pass from route handler
    const { data: buRow } = await admin.from("business_users").select("user_id")
      .eq("business_id", businessId).limit(1).single()
    const senderId = buRow ? (buRow as { user_id: string }).user_id : businessId

    const { error } = await admin.from("team_messages").insert({
      business_id: businessId,
      staff_id: s.id,
      sender_user_id: senderId,
      content: message,
    } as never)
    if (error) return `Erro ao enviar mensagem: ${error.message}`
    return `Mensagem enviada para ${s.name} ✓`
  }

  return "Ferramenta desconhecida."
}

// ─── Route handler ────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: BusinessContext, now: Date, plan: "starter" | "pro" = "starter"): string {
  const tz = "America/Sao_Paulo"
  const todayStr = now.toLocaleDateString("pt-BR", { timeZone: tz, weekday: "long", year: "numeric", month: "long", day: "numeric" })
  const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" })
  const isoDate = now.toLocaleDateString("sv", { timeZone: tz })
  const fmt = (cents: number) => `R$${(cents / 100).toFixed(2)}`

  const planSection = plan === "pro"
    ? `Plano: Pro — acesso completo a todas as funcionalidades, incluindo Instruções de Time e Retorno de Ligações.`
    : `Plano: Starter.
Funcionalidades do Starter: Chamados/Agendamentos, Calendário, Clientes (CRM), Conversas WhatsApp, Pagamentos PIX, Equipe e Serviços.
Funcionalidades exclusivas do Pro (NÃO disponíveis neste plano): Automações WhatsApp, Análises avançadas, Instruções personalizadas (Skills), Canvas IA, Aprovações.
REGRA: Se o usuário perguntar sobre ou pedir para usar uma funcionalidade Pro, responda em no máximo 2 frases: explique que é exclusiva do plano Pro e indique que pode fazer upgrade em Configurações → Assinatura. Não execute ações Pro para usuários Starter.`

  const scheduleLines = ctx.upcomingItems.length > 0
    ? ctx.upcomingItems.map(i =>
        `- ${i.scheduled_start ? new Date(i.scheduled_start).toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }) : "?"} | ${i.customer_name ?? "?"} | ${i.service_name ?? i.title} | ${i.status} | ID:${i.id}`
      ).join("\n")
    : "Nenhum agendamento hoje."

  const paymentLines = ctx.recentPayments.length > 0
    ? ctx.recentPayments.map(p => `- ${p.status.toUpperCase()} | ${fmt(p.amount)} | ID:${p.id}`).join("\n")
    : "Sem pagamentos recentes."

  const skillsSection = ctx.skills.length > 0
    ? `\n\nInstruções do dono do negócio (siga sempre):\n${ctx.skills.map(s => `- ${s.name}: ${s.content}`).join("\n")}`
    : ""

  return `Você é o assistente de gestão do ${ctx.business.name} (tipo: ${ctx.business.type}). Você tem acesso total ao sistema RetornAI e executa ações reais dentro dele.${skillsSection}

${planSection}

ESCOPO RESTRITO — LEIA COM ATENÇÃO:
Você é EXCLUSIVAMENTE um assistente de gestão do negócio no RetornAI. Suas funções se limitam a: clientes, agendamentos, pagamentos, conversas WhatsApp, equipe, serviços e automações. Se o usuário perguntar qualquer coisa fora do sistema (pesquisa na internet, clima, notícias, política, matemática geral, receitas, informações externas ou qualquer assunto não relacionado ao negócio), responda APENAS: "Só consigo ajudar com a gestão do seu negócio aqui no RetornAI." Não faça buscas, não forneça informações gerais, não responda sobre o mundo externo.

Data e hora atual (Brasília): ${todayStr}, ${timeStr} — use para resolver "hoje", "amanhã", "agora", "mais tarde", etc.
Data ISO hoje: ${isoDate}

Agenda de hoje (do banco de dados, ao vivo):
${scheduleLines}

Pagamentos recentes:
${paymentLines}
Pendentes: ${ctx.metrics.pendingPayments} | Receita hoje: ${fmt(ctx.metrics.todayRevenue)}

Regras:
- Responda SEMPRE em português, máximo 2 frases curtas
- Extraia TODAS as informações da mensagem do usuário antes de perguntar qualquer coisa. Nome + data + hora NÃO são suficientes para criar um chamado — serviço e responsável também são necessários.
- Se precisar de informação que NÃO foi fornecida, comece sua resposta com [Q]. Nunca use [Q] se já tiver tudo.
- VERIFICAÇÃO DE CLIENTE (obrigatória): antes de qualquer ação que envolva um cliente específico (agendar, cobrar, enviar mensagem, atualizar), tente a ação normalmente. Se o resultado começar com CLIENTE_NAO_ENCONTRADO, responda com [Q] perguntando se o nome está correto ou se deve criar um novo. Se começar com CLIENTE_MULTIPLOS, responda com [Q] listando as opções e perguntando qual é o correto. Nunca invente ou assuma um cliente.
- Ao criar agendamento — CHECKLIST obrigatório ANTES de chamar add_work_item:
  1. SERVIÇO: se houver serviços cadastrados e nenhum foi mencionado → chame list_services e inclua [CHOICES:services] na pergunta [Q].
  2. RESPONSÁVEL: se houver mais de um colaborador e nenhum foi mencionado → chame list_staff e inclua [CHOICES:staff] na pergunta [Q].
  3. DATA/HORA: se não foram informadas → pergunte [Q].
  Combine em uma única pergunta [Q] se vários campos faltarem. Os marcadores [CHOICES:services] e [CHOICES:staff] exibem seletores na UI — não os omita quando serviço ou responsável estiverem faltando.
  Quando o usuário responder "Outro" para serviço ou responsável: crie o chamado normalmente com o nome informado, depois pergunte [Q] "Quer cadastrar '[nome]' como novo [serviço/colaborador] no sistema?". Se sim, use create_service ou add_staff.
  Se retornar CLIENTE_NAO_ENCONTRADO ou CLIENTE_MULTIPLOS, use [Q] para esclarecer antes de tentar novamente.
- Agendamentos criados aparecem automaticamente em Chamados e Calendário — não é necessário nenhuma ação extra.
- Quando um cliente confirmar que pagou o PIX: use get_payments para localizar o pagamento pelo nome, depois chame mark_payment_received — isso marca o pagamento como recebido e conclui o serviço automaticamente.
- Para criar cobrança PIX: use create_pix_payment — cria o PIX e envia via WhatsApp automaticamente se o cliente tiver telefone.
- Para reagendar: use reschedule_work_item com o ID do agendamento (visível na agenda acima).
- Para ver horários livres: use get_available_slots antes de criar um agendamento.
- Para ver a semana completa: use list_week_schedule.
- Para ver serviços (com IDs para agendamento): use list_services. Para ver colaboradores: use list_staff. SEMPRE use esses antes de criar agendamentos que precisam de service_id ou staff_id.
- Para cancelar um agendamento: use cancel_work_item. Para concluir: use complete_work_item (atualiza estatísticas do cliente automaticamente).
- Para atualizar dados de um cliente por nome: use update_customer com customer_name (telefone, email, endereço, status).
- Para colaboradores: update_staff / delete_staff pelo nome.
- Para serviços: update_service / delete_service pelo nome.
- Para automações: list_automations, update_automation, delete_automation.
- Para alertas e notificações do sistema: list_notifications / dismiss_notifications.
- Para perguntas frequentes: list_faqs, create_faq, update_faq, delete_faq.
- Para adicionar colaborador à equipe: add_staff. Após adicionar, ofereça navegar para Instruções de Time.
- Para atribuir um chamado a um colaborador: assign_task com staff_name e work_item_id ou customer_name.
- Para enviar mensagem interna a um colaborador: message_team_member.
- Para ver a página de instruções de time: navigate_to /dashboard/team-tasks.
- Para instruções do assistente: list_skills, create_skill, update_skill, delete_skill.
- Para conversas: resolve_conversation / toggle_conversation_ai pelo nome do cliente.
- Para registrar pagamento manual: create_manual_payment. Para cancelar um pagamento pendente: cancel_payment.
- Para listar clientes com filtro: list_customers (status: active/inactive/blocked, sort: total_spent/last_visit/visits/name).
- Para adicionar ou remover tags de um cliente: update_customer_tags.
- Para ver detalhes completos de um agendamento específico: get_work_item.
- Para criar agendamento vinculado ao serviço do catálogo: use service_name em add_work_item (auto-preenche preço e vincula service_id).
- Para enviar mensagem WhatsApp para um grupo de clientes: send_bulk_message (filter_status ou filter_tag, máx 50 clientes).
- Para ler a conversa de um cliente: read_conversation_messages.
- Para apagar um agendamento permanentemente: delete_work_item — SEMPRE use [Q] para confirmar antes. Se retornar CONFIRM:, use [Q] com a pergunta de confirmação.
- Para apagar um cliente permanentemente: delete_customer — SEMPRE use [Q] para confirmar antes. Se retornar CONFIRM:, use [Q] com a pergunta de confirmação.
- Para ativar ou desativar uma instrução do assistente: update_skill com active: true/false.
- Após executar uma ação, confirme brevemente (ex: "Consulta marcada para Maria amanhã às 17h ✓")
- Nunca diga que não consegue — faça ou pergunte o que precisa
- Sem formatação markdown, sem listas, sem headers — fale como humano`
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: buRaw } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", user.id)
      .single()
    const bu = buRaw as { business_id: string } | null
    if (!bu) return NextResponse.json({ error: "No business" }, { status: 403 })
    const businessId = bu.business_id

    const { allowed } = await checkRateLimit(`ai_assistant:${businessId}`, 60, 3_600_000)
    if (!allowed) return NextResponse.json({ error: "Limite atingido. Tente em 1 hora." }, { status: 429 })

    const rawBody = await request.json() as unknown
    const parsed = aiMessageSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 422 })
    }
    const { messages } = parsed.data

    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (lastUserMsg && detectPromptInjection(lastUserMsg.content)) {
      console.warn('[AI assistant] Possible prompt injection detected', { businessId })
      return new Response(
        new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('Só consigo ajudar com a gestão do seu negócio aqui no RetornAI.')); c.close() } }),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      )
    }

    const admin = createAdminClient()
    const ctx = await getBusinessContext(businessId)
    const { data: bizPlanRaw } = await admin.from("businesses").select("subscription_plan").eq("id", businessId).single()
    const plan = (((bizPlanRaw as { subscription_plan: string | null } | null)?.subscription_plan ?? "starter") === "pro" ? "pro" : "starter") as "starter" | "pro"
    const systemText = buildSystemPrompt(ctx, new Date(), plan)
    const cachedSystem: Anthropic.TextBlockParam[] = [
      { type: "text", text: systemText, cache_control: { type: "ephemeral" } },
    ]

    const history: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    // Agentic tool-use loop (max 5 iterations)
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: cachedSystem,
      tools: TOOLS,
      messages: history,
    })

    let iters = 0
    let navHref: string | null = null

    while (response.stop_reason === "tool_use" && iters < 5) {
      iters++
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      )
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (b) => {
          const result = await executeTool(b.name, b.input as Record<string, unknown>, businessId, ctx)
          // Capture navigation intent
          if (result.startsWith("NAVIGATE:")) {
            navHref = result.slice("NAVIGATE:".length)
          }
          return { type: "tool_result" as const, tool_use_id: b.id, content: result }
        })
      )
      history.push({ role: "assistant", content: response.content })
      history.push({ role: "user",      content: toolResults })
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        system: cachedSystem,
        tools: TOOLS,
        messages: history,
      })
    }

    let finalText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("")

    if (!finalText) finalText = "Pronto."
    // Append navigation sentinel so client can act on it
    if (navHref) finalText += ` [NAV:${navHref}]`

    const encoder = new TextEncoder()
    return new Response(
      new ReadableStream<Uint8Array>({
        start(c) { c.enqueue(encoder.encode(finalText)); c.close() },
      }),
      { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    )
  } catch (err) {
    console.error("[assistant]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
