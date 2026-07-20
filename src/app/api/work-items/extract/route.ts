import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import Anthropic from "@anthropic-ai/sdk"
import { selectModel, TaskComplexity } from "@/lib/ai/model-router"

const anthropic = new Anthropic()

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { allowed } = await checkRateLimit(`ai:${user.id}`, 30, 60_000)
  if (!allowed) return NextResponse.json({ error: "Limite atingido" }, { status: 429 })

  const body = await request.json() as {
    description: string
    context: {
      customers: Array<{ id: string; name: string }>
      services: Array<{ id: string; name: string; price: number }>
      staff?: Array<{ id: string; name: string; role: string }>
      openingHours?: Record<string, unknown> | null
    }
    followUp?: string
  }
  const { description, context, followUp } = body

  const now = new Date()
  const today = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Sao_Paulo",
  })
  // Calculate dates in São Paulo timezone
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
  const todayISO = spNow.toISOString().slice(0, 10)
  const tomorrowISO = new Date(spNow.getTime() + 86400000).toISOString().slice(0, 10)

  const customerList = context.customers.slice(0, 50).map(c => `${c.id}:${c.name}`).join(", ")
  const serviceList = context.services.slice(0, 30).map(s => `${s.id}:${s.name}(R$${s.price})`).join(", ")
  const staffList = (context.staff ?? []).slice(0, 20).map(m => `${m.id}:${m.name}${m.role ? `(${m.role})` : ""}`).join(", ")

  // Format opening hours for the prompt
  const dayNames: Record<string, string> = {
    mon: "Seg", monday: "Seg",
    tue: "Ter", tuesday: "Ter",
    wed: "Qua", wednesday: "Qua",
    thu: "Qui", thursday: "Qui",
    fri: "Sex", friday: "Sex",
    sat: "Sáb", saturday: "Sáb",
    sun: "Dom", sunday: "Dom",
  }
  let hoursText = "Não informado"
  if (context.openingHours && typeof context.openingHours === "object") {
    const lines = Object.entries(context.openingHours).map(([day, s]) => {
      const label = dayNames[day] ?? day
      if (!s || typeof s !== "object") return `${label}: Fechado`
      const sc = s as Record<string, unknown>
      return sc.open ? `${label}: ${sc.start}–${sc.end}` : `${label}: Fechado`
    })
    hoursText = lines.join(", ")
  }

  const prompt = `IMPORTANTE: Esta IA é exclusiva para criar chamados/agendamentos de serviço. Se a descrição não for sobre um atendimento, serviço, chamado ou agendamento, retorne JSON com "outOfScope": true, "question": "Não consigo fazer isso aqui. Descreva um chamado ou agendamento de serviço." e todos os outros campos como null.

Hoje é ${today} (fuso horário: Brasília, UTC-3).
Horários de funcionamento do negócio: ${hoursText}
Clientes disponíveis: ${customerList || "nenhum"}
Serviços disponíveis: ${serviceList || "nenhum"}
Colaboradores disponíveis: ${staffList || "nenhum"}

Descrição: "${description}"${followUp ? `\nInformação adicional: "${followUp}"` : ""}

Extraia do texto e retorne JSON com:
{
  "outOfScope": false,
  "customer_id": "uuid do cliente mais próximo ao nome mencionado ou null",
  "service_id": "uuid do serviço mais próximo ou null",
  "assigned_staff_id": "uuid do colaborador/responsável mencionado ou null",
  "scheduled_date": "YYYY-MM-DD ou null (amanhã=${tomorrowISO}, hoje=${todayISO})",
  "scheduled_time": "HH:MM ou null (10h=10:00, 14h30=14:30) — HORÁRIO DE BRASÍLIA",
  "title": "título curto descritivo ou null",
  "price_estimate": número em reais ou null,
  "notes": "observações extras ou null",
  "missing": ["lista de campos importantes que faltam"],
  "question": "Pergunte sobre TODOS os campos importantes que faltam em UMA pergunta natural. Prioridades: (1) Se horário fora do funcionamento, avise e peça novo horário. (2) customer_id null → 'Para qual cliente?'. (3) service_id null e há serviços → 'Qual serviço? Ex: [3 primeiros]'. (4) scheduled_date null → 'Para qual data?'. (5) scheduled_time null e data definida → 'A que horas?'. (6) Se o tipo for service_call ou job e não houver endereço na descrição → 'Qual o endereço do atendimento?'. (7) assigned_staff_id null e mais de 1 colaborador → 'Quem será o responsável? Ex: [3 primeiros]'. Combine tudo em uma frase só, curta e natural. Se tudo estiver preenchido, retorne null.",
  "preview": {
    "customerName": "nome do cliente identificado ou null",
    "serviceName": "nome do serviço identificado ou null",
    "staffName": "nome do colaborador identificado ou null",
    "date": "data formatada pt-BR ou null",
    "time": "horário formatado ou null",
    "price": "R$ formatado ou null"
  }
}
Responda APENAS com JSON válido.`

  try {
    const msg = await anthropic.messages.create({
      model: selectModel(TaskComplexity.SIMPLE),
      max_tokens: 700,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    })
    const text = msg.content[0].type === "text" ? msg.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: "Falha ao extrair" }, { status: 500 })
    const result = JSON.parse(jsonMatch[0]) as {
      outOfScope?: boolean
      customer_id?: string | null
      service_id?: string | null
      assigned_staff_id?: string | null
      scheduled_date?: string | null
      scheduled_time?: string | null
      title?: string | null
      price_estimate?: number | null
      notes?: string | null
      missing?: string[]
      question?: string | null
      preview?: {
        customerName?: string
        serviceName?: string
        staffName?: string
        date?: string
        time?: string
        price?: string
      }
    }
    if (result.outOfScope) {
      return NextResponse.json({
        fields: {},
        missing: [],
        question: result.question ?? "Não consigo fazer isso aqui. Descreva um chamado de serviço.",
        preview: {},
        outOfScope: true,
      })
    }
    return NextResponse.json({
      fields: {
        customer_id: result.customer_id ?? undefined,
        service_id: result.service_id ?? undefined,
        assigned_staff_id: result.assigned_staff_id ?? undefined,
        scheduled_date: result.scheduled_date ?? undefined,
        scheduled_time: result.scheduled_time ?? undefined,
        title: result.title ?? undefined,
        price_estimate: result.price_estimate ?? undefined,
        notes: result.notes ?? undefined,
      },
      missing: result.missing ?? [],
      question: result.question ?? null,
      preview: result.preview ?? {},
    })
  } catch {
    return NextResponse.json({ error: "Erro ao processar" }, { status: 500 })
  }
}
