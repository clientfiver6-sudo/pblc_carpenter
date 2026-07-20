import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const anthropic = new Anthropic();

type StepType = "business_info" | "services" | "staff" | "hours" | "terminology" | "staff_payment" | "payment_preferences";

interface ExtractRequest {
  step: StepType;
  description: string;
  businessType?: string;
  context?: string;
}

interface DayHours {
  open: boolean;
  start: string;
  end: string;
}

interface ServiceExtracted {
  name: string;
  duration_minutes: number;
  price: number;
}

interface StaffExtracted {
  name: string;
  role: string;
  phone?: string;
}

interface BusinessInfoExtracted {
  name?: string;
  phone?: string;
  whatsapp_number?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
}

interface ServicesExtracted {
  services: ServiceExtracted[];
}

interface StaffListExtracted {
  staff: StaffExtracted[];
}

interface HoursExtracted {
  opening_hours: Record<string, DayHours>;
}

interface TerminologyExtracted {
  terminology: {
    clientSingular: string;
    clientPlural: string;
    workItemSingular: string;
    workItemPlural: string;
    appointmentVerb: string;
    aiPersonality: string;
  };
}

interface StaffPaymentExtracted {
  staff_payment: {
    compensation_type?: string | null;
    monthly_salary_cents?: number | null;
    commission_rate?: number | null;
    payment_day?: number | null;
    payment_method?: string | null;
    payment_reminder?: boolean | null;
  };
  skipped?: boolean;
}

interface PaymentPreferencesExtracted {
  payment_preferences: {
    payment_methods: string[];
    charge_timing: string | null;
    auto_payment_reminder: boolean | null;
  };
  skipped?: boolean;
}

type ExtractedData =
  | BusinessInfoExtracted
  | ServicesExtracted
  | StaffListExtracted
  | HoursExtracted
  | TerminologyExtracted
  | StaffPaymentExtracted
  | PaymentPreferencesExtracted;

interface ExtractResponse {
  data: ExtractedData;
  missing: string[];
  question?: string;
}

const SYSTEM_PROMPT = `Você é um assistente que extrai informações de texto em JSON para um sistema de gestão de negócios no Brasil.
Responda APENAS com JSON válido, sem explicações. Datas/horários no formato HH:MM. Preços como números decimais (ex: 150.00).
Se informação estiver faltando, inclua "missing" array com os campos ausentes e "question" com uma pergunta em português.`;

function buildUserPrompt(step: StepType, description: string, businessType?: string, context?: string): string {
  const businessCtx = businessType ? ` O tipo de negócio é: ${businessType}.` : "";
  const extraCtx = context ? ` Contexto adicional: ${context}.` : "";

  switch (step) {
    case "business_info":
      return `Extraia as informações do negócio do texto abaixo.${businessCtx}${extraCtx}
Retorne JSON com esta estrutura:
{
  "data": {
    "name": "string ou null",
    "phone": "string ou null",
    "whatsapp_number": "string ou null",
    "address": "string ou null",
    "city": "string ou null",
    "state": "sigla do estado ou null",
    "zip_code": "string ou null"
  },
  "missing": ["campo1", "campo2"],
  "question": "pergunta em português se algum campo crítico estiver faltando, caso contrário omita"
}
Campos críticos: name, city. Se name estiver ausente, question deve ser "Qual é o nome do negócio?". Se city estiver ausente (e name presente), question deve ser "Em qual cidade fica o negócio?".
Texto: "${description}"`;

    case "services":
      return `Extraia os serviços oferecidos do texto abaixo.${businessCtx}${extraCtx}
Converta: "R$ 150" → 150.00, "30 min" → 30, "1 hora" → 60, "hora e meia" → 90, "2 horas" → 120.
Retorne JSON com esta estrutura:
{
  "data": {
    "services": [
      { "name": "string", "duration_minutes": number, "price": number }
    ]
  },
  "missing": [],
  "question": "pergunta se nenhum serviço encontrado"
}
Se nenhum serviço for encontrado, "question" deve ser "Quais serviços você oferece e qual o preço?".
Texto: "${description}"`;

    case "staff":
      return `Extraia os membros da equipe do texto abaixo.${businessCtx}${extraCtx}
Retorne JSON com esta estrutura:
{
  "data": {
    "staff": [
      { "name": "string", "role": "string", "phone": "string ou null" }
    ]
  },
  "missing": [],
  "question": "pergunta se nenhum membro encontrado"
}
Texto: "${description}"`;

    case "hours":
      return `Extraia os horários de funcionamento do texto abaixo.${businessCtx}${extraCtx}
Use as chaves: mon, tue, wed, thu, fri, sat, sun.
Exemplo: "Segunda a sexta das 9 às 18" → mon/tue/wed/thu/fri com open=true, start="09:00", end="18:00"; sat/sun com open=false.
Retorne JSON com esta estrutura:
{
  "data": {
    "opening_hours": {
      "mon": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
      "tue": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
      "wed": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
      "thu": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
      "fri": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
      "sat": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
      "sun": { "open": boolean, "start": "HH:MM", "end": "HH:MM" }
    }
  },
  "missing": [],
  "question": "pergunta se horários não encontrados"
}
Texto: "${description}"`;

    case "staff_payment":
      return `Extraia informações de remuneração e pagamento dos colaboradores do texto abaixo.${businessCtx}${extraCtx}

Se o usuário quiser pular (palavras como "pular", "skip", "depois", "não sei", "passar"), retorne:
{"data": {"staff_payment": {}, "skipped": true}, "missing": []}

Caso contrário, extraia:
- compensation_type: "salary" (salário fixo), "commission" (comissão) ou "other"
- monthly_salary_cents: valor em centavos (ex: R$ 3000 → 300000, R$ 1.500 → 150000)
- commission_rate: percentual numérico (ex: 10% → 10, 15% → 15)
- payment_day: dia do mês (número 1-31)
- payment_method: forma de pagamento em texto (PIX, dinheiro, transferência bancária, etc.)
- payment_reminder: true se o usuário quer lembrete, false se não quer

Retorne JSON com esta estrutura:
{
  "data": {
    "staff_payment": {
      "compensation_type": "salary" | "commission" | "other" | null,
      "monthly_salary_cents": número ou null,
      "commission_rate": número ou null,
      "payment_day": número ou null,
      "payment_method": "texto" ou null,
      "payment_reminder": true ou false ou null
    }
  },
  "missing": [],
  "question": "pergunta em português se quando e como são pagos não estiver claro"
}
Inclua "question" apenas se faltarem informações críticas sobre quando e como são pagos. Se o usuário não mencionar lembrete, assuma false.
Texto: "${description}"`;

    case "payment_preferences":
      return `Extraia as preferências de cobrança de clientes do texto abaixo.${businessCtx}${extraCtx}

Se o usuário quiser pular (palavras como "pular", "skip", "depois", "não sei", "passar"), retorne:
{"data": {"payment_preferences": {"payment_methods": [], "charge_timing": null, "auto_payment_reminder": null}, "skipped": true}, "missing": []}

Caso contrário, extraia:
- payment_methods: array com zero ou mais de ["pix", "card", "cash", "transfer"] conforme o que o usuário mencionou
- charge_timing: "before" (cobra antes do serviço), "after" (cobra depois), "link_auto" (envia link automaticamente ao concluir), ou null se não mencionado
- auto_payment_reminder: true se mencionou cobrar/lembrar automaticamente, false se não quer, null se não mencionou

Retorne JSON com esta estrutura:
{
  "data": {
    "payment_preferences": {
      "payment_methods": ["pix", "cash"],
      "charge_timing": "after",
      "auto_payment_reminder": null
    }
  },
  "missing": []
}
Texto: "${description}"`;

    case "terminology": {
      const typeCtx = businessType
        ? ` O tipo de negócio é "${businessType}".`
        : "";
      const nameCtx = description ? ` O nome do negócio é "${description}".` : "";
      const answerCtx = context ? ` O usuário respondeu: "${context}".` : "";
      return `Determine a terminologia correta em português para um negócio brasileiro.${typeCtx}${nameCtx}${answerCtx}

Regras:
- Para "ac_residential": clientSingular="cliente", clientPlural="clientes", workItemSingular="chamado", workItemPlural="chamados", appointmentVerb="abrir chamado"
- Para "ac_commercial": clientSingular="cliente", clientPlural="clientes", workItemSingular="ordem de serviço", workItemPlural="ordens de serviço", appointmentVerb="solicitar"
- Para "refrigeration": clientSingular="cliente", clientPlural="clientes", workItemSingular="chamado", workItemPlural="chamados", appointmentVerb="abrir chamado"
- Para "electrician": clientSingular="cliente", clientPlural="clientes", workItemSingular="chamado", workItemPlural="chamados", appointmentVerb="abrir chamado"
- Para "plumber": clientSingular="cliente", clientPlural="clientes", workItemSingular="chamado", workItemPlural="chamados", appointmentVerb="abrir chamado"
- Para "locksmith": clientSingular="cliente", clientPlural="clientes", workItemSingular="chamado", workItemPlural="chamados", appointmentVerb="abrir chamado"
- Para "cleaning": clientSingular="cliente", clientPlural="clientes", workItemSingular="agendamento", workItemPlural="agendamentos", appointmentVerb="agendar"
- Para "pest_control": clientSingular="cliente", clientPlural="clientes", workItemSingular="chamado", workItemPlural="chamados", appointmentVerb="agendar"
- Para "other_service_business": tente inferir pelo nome do negócio. Se ambíguo e não houver resposta do usuário, defina question.
- Sempre retorne todos os 6 campos. Nunca inclua campos em "missing".
- aiPersonality deve ser uma instrução curta em português para o tom do atendente de IA (ex: "Seja empático e acolhedor com os pacientes.").

Retorne JSON com esta estrutura exata:
{
  "data": {
    "terminology": {
      "clientSingular": "string",
      "clientPlural": "string",
      "workItemSingular": "string",
      "workItemPlural": "string",
      "appointmentVerb": "string",
      "aiPersonality": "string"
    }
  },
  "missing": [],
  "question": "Como você chama seus clientes e seus atendimentos?"
}
Inclua "question" APENAS se o tipo for "other_service_business" E o nome não deixar claro o tipo de negócio E não houver resposta do usuário. Em todos os outros casos, omita "question".`;
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Rate limit: 20 requests per minute per user
    const rateLimitKey = `onboarding-extract:${user.id}`;
    const { allowed } = await checkRateLimit(rateLimitKey, 20, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um momento." },
        { status: 429 }
      );
    }

    const body = (await req.json()) as ExtractRequest;
    const { step, description, businessType, context } = body;

    if (!step || !description) {
      return NextResponse.json(
        { error: "Campos obrigatórios: step, description" },
        { status: 400 }
      );
    }

    const validSteps: StepType[] = ["business_info", "services", "staff", "hours", "terminology", "staff_payment", "payment_preferences"];
    if (!validSteps.includes(step)) {
      return NextResponse.json({ error: "Step inválido" }, { status: 400 });
    }

    const userPrompt = buildUserPrompt(step, description, businessType, context);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawContent = message.content[0];
    if (rawContent.type !== "text") {
      return NextResponse.json({ error: "Erro ao processar" }, { status: 500 });
    }

    // Strip markdown code fences if present
    let jsonText = rawContent.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
    }

    const parsed = JSON.parse(jsonText) as ExtractResponse;

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Erro ao processar" }, { status: 500 });
  }
}
