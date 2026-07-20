import type Anthropic from "@anthropic-ai/sdk"

export const RECEPTIONIST_TOOLS: Anthropic.Tool[] = [
  {
    name: "lookup_customer",
    description: "Busca cliente pelo número de telefone no sistema",
    input_schema: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Número de telefone com DDI (ex: 5511999990001)",
        },
      },
      required: ["phone"],
    },
  },
  {
    name: "create_customer",
    description: "Cria novo cliente no sistema quando não encontrado",
    input_schema: {
      type: "object",
      properties: {
        full_name: {
          type: "string",
          description: "Nome completo do cliente",
        },
        phone_number: {
          type: "string",
          description: "Número de telefone com DDI",
        },
        email: {
          type: "string",
          description: "E-mail do cliente (opcional)",
        },
        address: {
          type: "string",
          description: "Endereço do cliente (opcional)",
        },
      },
      required: ["full_name", "phone_number"],
    },
  },
  {
    name: "get_available_slots",
    description: "Retorna horários disponíveis para agendamento em uma data específica",
    input_schema: {
      type: "object",
      properties: {
        service_id: {
          type: "string",
          description: "ID do serviço desejado",
        },
        staff_id: {
          type: "string",
          description: "ID do profissional preferido (opcional)",
        },
        date: {
          type: "string",
          description: "Data desejada no formato YYYY-MM-DD",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "create_work_item",
    description: "Agenda consulta, serviço, cria chamado ou ordem de serviço para o cliente. OBRIGATÓRIO: sempre inclua service_id e staff_id. Se o cliente não informou o serviço, pergunte antes de chamar esta ferramenta. Se o cliente não informou o profissional, pergunte ou use o único disponível.",
    input_schema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "ID do cliente no sistema",
        },
        type: {
          type: "string",
          enum: ["appointment", "job", "repair", "quote", "order", "consultation", "service_call"],
          description: "Tipo de item de trabalho",
        },
        title: {
          type: "string",
          description: "Título descritivo, ex: 'Consulta de Retorno - João Silva'",
        },
        service_id: {
          type: "string",
          description: "ID do serviço. Obrigatório — pergunte ao cliente qual serviço deseja antes de agendar",
        },
        staff_id: {
          type: "string",
          description: "ID do profissional responsável. Obrigatório — pergunte ao cliente com quem prefere ou use o único disponível",
        },
        scheduled_start: {
          type: "string",
          description: "Data e hora de início no formato ISO 8601, ex: 2025-01-15T10:00:00-03:00",
        },
        description: {
          type: "string",
          description: "Descrição detalhada do serviço ou problema",
        },
        address: {
          type: "string",
          description: "Endereço para serviços externos (encanador, eletricista, etc.)",
        },
      },
      required: ["customer_id", "type", "title", "service_id", "staff_id"],
    },
  },
  {
    name: "reschedule_work_item",
    description: "Remarca agendamento ou serviço existente para nova data e hora",
    input_schema: {
      type: "object",
      properties: {
        work_item_id: {
          type: "string",
          description: "ID do agendamento a ser remarcado",
        },
        new_start: {
          type: "string",
          description: "Nova data e hora no formato ISO 8601",
        },
      },
      required: ["work_item_id", "new_start"],
    },
  },
  {
    name: "cancel_work_item",
    description: "Cancela agendamento ou serviço a pedido do cliente",
    input_schema: {
      type: "object",
      properties: {
        work_item_id: {
          type: "string",
          description: "ID do agendamento a ser cancelado",
        },
        reason: {
          type: "string",
          description: "Motivo do cancelamento (opcional)",
        },
      },
      required: ["work_item_id"],
    },
  },
  {
    name: "get_customer_work_items",
    description: "Busca agendamentos e serviços do cliente, com opção de filtrar por status",
    input_schema: {
      type: "object",
      properties: {
        customer_id: {
          type: "string",
          description: "ID do cliente",
        },
        status_filter: {
          type: "string",
          enum: ["upcoming", "all", "completed"],
          description: "Filtro de status: upcoming = próximos agendamentos, all = todos, completed = concluídos",
        },
      },
      required: ["customer_id"],
    },
  },
  {
    name: "create_payment_link",
    description: "Gera cobrança e envia diretamente ao cliente via WhatsApp. Para Pix: envia QR Code e código copia-e-cola. Para cartão: envia link de checkout.",
    input_schema: {
      type: "object",
      properties: {
        payment_method: {
          type: "string",
          enum: ["pix", "card"],
          description: "Método de pagamento: 'pix' (padrão, envia QR Code + copia-e-cola) ou 'card' (envia link de checkout para cartão)",
        },
        work_item_id: {
          type: "string",
          description: "ID do serviço ou agendamento relacionado ao pagamento (opcional)",
        },
        amount: {
          type: "number",
          description: "Valor em reais (ex: 150.00)",
        },
        description: {
          type: "string",
          description: "Descrição do pagamento",
        },
      },
      required: ["amount", "description"],
    },
  },
  {
    name: "get_payment_status",
    description:
      "Verifica o status de pagamento de um agendamento ou serviço do cliente. Use quando o cliente perguntar se o pagamento foi recebido, se está pendente, ou o histórico de pagamentos.",
    input_schema: {
      type: "object",
      properties: {
        work_item_id: {
          type: "string",
          description: "ID do agendamento específico (use quando souber o ID)",
        },
        customer_id: {
          type: "string",
          description: "ID do cliente para buscar últimos 3 pagamentos",
        },
      },
      required: [],
    },
  },
  {
    name: "answer_faq",
    description: "Responde dúvidas frequentes sobre o negócio consultando a base de conhecimento",
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "Pergunta do cliente",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "handoff_to_human",
    description:
      "Transfere a conversa para um atendente humano quando o cliente solicita ou quando a situação é complexa demais para o AI",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Motivo da transferência para atendimento humano",
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high", "emergency"],
          description: "Nível de urgência: low = baixa, medium = média, high = alta, emergency = emergência",
        },
      },
      required: ["reason"],
    },
  },
  {
    name: "update_work_item_status",
    description: "Atualiza o status de um agendamento ou serviço (confirmar, concluir, cancelar, marcar no-show)",
    input_schema: {
      type: "object" as const,
      properties: {
        work_item_id: { type: "string", description: "ID do agendamento a ser atualizado" },
        status: {
          type: "string",
          enum: ["confirmed", "in_progress", "completed", "cancelled", "no_show"],
          description: "Novo status do agendamento"
        },
        notes: { type: "string", description: "Observações opcionais sobre a mudança de status" }
      },
      required: ["work_item_id", "status"]
    }
  },
]
