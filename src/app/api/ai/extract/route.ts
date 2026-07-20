import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { detectPromptInjection } from "@/lib/schemas"
import Anthropic from "@anthropic-ai/sdk"
import { selectModel, TaskComplexity } from "@/lib/ai/model-router"
import { z } from "zod"
import { TAG, delimit } from "@/lib/ai/delimiter"

const bodySchema = z.object({
  entityType: z.enum(['customer', 'lead', 'staff', 'service', 'automation']),
  description: z.string().min(1).max(2000).trim(),
  context: z.record(z.unknown()).optional(),
  followUp: z.string().max(500).optional(),
})

const anthropic = new Anthropic()

type EntityType = "customer" | "lead" | "staff" | "service" | "automation"

const SCOPE_LABELS: Record<EntityType, string> = {
  customer: "adicionar ou descrever um cliente",
  lead: "adicionar ou descrever um lead/prospecto",
  staff: "adicionar ou descrever um colaborador da equipe",
  service: "adicionar ou descrever um serviço do catálogo",
  automation: "criar uma automação de mensagem WhatsApp",
}

function buildPrompt(
  entityType: EntityType,
  description: string,
  context: Record<string, unknown>,
  followUp?: string
): string {
  const extra = followUp ? `\n${delimit(TAG.userInput, followUp)}` : ""
  const scopeLabel = SCOPE_LABELS[entityType]

  const scopeCheck = `IMPORTANTE: Esta IA é dedicada a ${scopeLabel}. Se a descrição abaixo não for sobre isso, retorne JSON com "outOfScope": true e "question": "Não consigo fazer isso aqui. Descreva ${scopeLabel}." e todos os outros campos como null.

`

  switch (entityType) {
    case "customer":
      return `${scopeCheck}Extraia informações de um novo cliente a partir da descrição abaixo.

Descrição:\n${delimit(TAG.userInput, description)}${extra}

Retorne JSON com:
{
  "full_name": "nome completo ou null",
  "phone_number": "telefone ou null",
  "email": "e-mail ou null",
  "address": "endereço ou null",
  "city": "cidade ou null",
  "notes": "observações ou null",
  "missing": ["campos importantes que faltam"],
  "question": "pergunta em português se faltar o nome completo, senão null",
  "preview": {
    "Nome": "nome identificado ou null",
    "Telefone": "telefone formatado ou null",
    "E-mail": "e-mail ou null",
    "Cidade": "cidade ou null"
  }
}
Responda APENAS com JSON válido.`

    case "lead":
      return `${scopeCheck}Extraia informações de um novo lead/prospecto a partir da descrição abaixo.

Descrição:\n${delimit(TAG.userInput, description)}${extra}

Retorne JSON com:
{
  "full_name": "nome completo ou null",
  "phone": "telefone ou null",
  "service_interest": "serviço de interesse ou null",
  "quote_value": número decimal em reais ou null,
  "notes": "observações ou null",
  "missing": ["campos importantes que faltam"],
  "question": "pergunta em português se faltar o nome, senão null",
  "preview": {
    "Nome": "nome identificado ou null",
    "Telefone": "telefone ou null",
    "Interesse": "serviço de interesse ou null",
    "Orçamento": "valor formatado R$ ou null"
  }
}
Responda APENAS com JSON válido.`

    case "staff": {
      const rolesCtx = Array.isArray(context?.roles) && (context.roles as string[]).length > 0
        ? `\nCargos existentes: ${(context.roles as string[]).join(", ")}`
        : ""
      return `${scopeCheck}Extraia informações de um colaborador a partir da descrição abaixo.${rolesCtx}

Descrição:\n${delimit(TAG.userInput, description)}${extra}

Retorne JSON com:
{
  "name": "nome completo ou null",
  "role": "cargo ou função ou null",
  "phone": "telefone ou null",
  "missing": ["campos importantes que faltam"],
  "question": "pergunta em português se faltar o nome, senão null",
  "preview": {
    "Nome": "nome identificado ou null",
    "Cargo": "cargo ou null",
    "Telefone": "telefone ou null"
  }
}
Responda APENAS com JSON válido.`
    }

    case "service":
      return `${scopeCheck}Extraia informações de um serviço a partir da descrição abaixo.

Descrição:\n${delimit(TAG.userInput, description)}${extra}

Retorne JSON com:
{
  "name": "nome do serviço ou null",
  "description": "descrição curta ou null",
  "duration_minutes": número inteiro de minutos ou null (1h=60, 30min=30, 1h30=90),
  "price": número decimal em reais ou null (R$50=50.0),
  "category": "categoria ou null",
  "missing": ["campos importantes que faltam"],
  "question": "pergunta em português se faltar o nome do serviço, senão null",
  "preview": {
    "Nome": "nome do serviço ou null",
    "Duração": "duração formatada em minutos ou null",
    "Preço": "valor formatado R$ ou null",
    "Categoria": "categoria ou null"
  }
}
Responda APENAS com JSON válido.`

    case "automation": {
      const triggerList = [
        "booking_created", "booking_confirmed", "booking_24h_before",
        "booking_completed", "booking_cancelled", "booking_no_show",
        "payment_pending", "payment_received", "lead_created",
        "lead_inactive", "customer_inactive",
      ].join(", ")
      return `${scopeCheck}Extraia informações para criar uma automação de mensagem WhatsApp.

Gatilhos disponíveis: ${triggerList}
Variáveis disponíveis: {{customer_name}}, {{business_name}}, {{service_name}}, {{scheduled_time}}, {{price}}, {{pix_link}}

Descrição:\n${delimit(TAG.userInput, description)}${extra}

Retorne JSON com:
{
  "name": "nome descritivo da automação ou null",
  "trigger_type": "um dos gatilhos acima ou null",
  "message_template": "mensagem WhatsApp em português com variáveis {{}} ou null",
  "delay_minutes": número inteiro ou 0,
  "missing": ["campos importantes que faltam"],
  "question": "pergunta em português se faltar informações essenciais, senão null",
  "preview": {
    "Nome": "nome da automação ou null",
    "Gatilho": "gatilho escolhido ou null",
    "Atraso": "atraso em minutos ou null"
  }
}
Responda APENAS com JSON válido.`
    }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { allowed } = await checkRateLimit(`ai_extract:${user.id}`, 30, 60_000)
  if (!allowed) return NextResponse.json({ error: "Limite atingido" }, { status: 429 })

  const rawBody = await request.json() as unknown
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors }, { status: 422 })
  }
  const { entityType, description, context = {}, followUp } = parsed.data

  if (detectPromptInjection(description)) {
    console.warn('[AI extract] Possible prompt injection detected', { entityType })
    return NextResponse.json({
      fields: {},
      missing: [],
      question: 'Não consigo processar essa descrição.',
      preview: {},
    })
  }

  const prompt = buildPrompt(entityType, description, context, followUp)

  try {
    const msg = await anthropic.messages.create({
      model: selectModel(TaskComplexity.SIMPLE),
      max_tokens: 600,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    })
    const text = msg.content[0].type === "text" ? msg.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: "Falha ao extrair" }, { status: 500 })

    const result = JSON.parse(jsonMatch[0]) as {
      outOfScope?: boolean
      missing?: string[]
      question?: string | null
      preview?: Record<string, string>
      [key: string]: unknown
    }
    const { outOfScope, missing, question, preview, ...fields } = result
    if (outOfScope) {
      return NextResponse.json({
        fields: {},
        missing: [],
        question: question ?? "Não consigo fazer isso aqui.",
        preview: {},
        outOfScope: true,
      })
    }
    return NextResponse.json({
      fields,
      missing: missing ?? [],
      question: question ?? null,
      preview: preview ?? {},
    })
  } catch {
    return NextResponse.json({ error: "Erro ao processar" }, { status: 500 })
  }
}
