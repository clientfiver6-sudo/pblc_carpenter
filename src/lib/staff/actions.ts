"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getBusinessId } from "@/lib/auth/actions"
import { z } from "zod"
import type { Staff } from "@/types/database"
import Anthropic from "@anthropic-ai/sdk"

const staffSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  role: z.string().optional(),
  phone: z.string().optional(),
  working_hours: z
    .record(
      z.object({
        open: z.boolean().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      })
    )
    .optional(),
  compensation_type: z.enum(["salary", "commission", "other"]).optional(),
  monthly_salary_cents: z.number().int().nonnegative().nullable().optional(),
  commission_rate: z.number().min(0).max(100).nullable().optional(),
  payment_day: z.number().int().min(1).max(31).nullable().optional(),
  payment_method: z.string().nullable().optional(),
  payment_reminder: z.boolean().optional(),
})

export type StaffFormData = z.infer<typeof staffSchema>

export async function createStaff(data: StaffFormData): Promise<Staff> {
  const parsed = staffSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0].message)
  }

  const businessId = await getBusinessId()
  if (!businessId) throw new Error("Negócio não encontrado")

  const supabase = await createClient()
  const { data: rawStaff, error } = await supabase
    .from("staff")
    .insert({
      business_id: businessId,
      name: parsed.data.name,
      role: parsed.data.role ?? null,
      phone: parsed.data.phone ?? null,
      color: "#E85D1F",
      working_hours: (parsed.data.working_hours ?? {}) as unknown as import("@/types/database").Json,
      services: [] as string[],
      active: true,
      compensation_type: parsed.data.compensation_type ?? "salary",
      monthly_salary_cents: parsed.data.monthly_salary_cents ?? null,
      commission_rate: parsed.data.commission_rate ?? null,
      payment_day: parsed.data.payment_day ?? null,
      payment_method: parsed.data.payment_method ?? null,
      payment_reminder: parsed.data.payment_reminder ?? false,
    } as never)
    .select()
    .single()
  const staff = rawStaff as Staff | null

  if (error || !staff) {
    throw new Error("Erro ao criar colaborador")
  }

  revalidatePath("/staff")
  return staff
}

export async function updateStaff(
  id: string,
  data: Partial<StaffFormData>
): Promise<void> {
  const businessId = await getBusinessId()
  if (!businessId) throw new Error("Negócio não encontrado")

  const supabase = await createClient()
  const { error } = await supabase
    .from("staff")
    .update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.working_hours !== undefined && { working_hours: data.working_hours }),
      ...(data.compensation_type !== undefined && { compensation_type: data.compensation_type }),
      ...(data.monthly_salary_cents !== undefined && { monthly_salary_cents: data.monthly_salary_cents }),
      ...(data.commission_rate !== undefined && { commission_rate: data.commission_rate }),
      ...(data.payment_day !== undefined && { payment_day: data.payment_day }),
      ...(data.payment_method !== undefined && { payment_method: data.payment_method }),
      ...(data.payment_reminder !== undefined && { payment_reminder: data.payment_reminder }),
    } as never)
    .eq("id", id)
    .eq("business_id", businessId)

  if (error) {
    throw new Error("Erro ao atualizar colaborador")
  }

  revalidatePath("/staff")
  revalidatePath(`/staff/${id}`)
}

export async function toggleStaffActive(
  id: string,
  active: boolean
): Promise<void> {
  const businessId = await getBusinessId()
  if (!businessId) throw new Error("Negócio não encontrado")

  const supabase = await createClient()
  const { error } = await supabase
    .from("staff")
    .update({ active } as never)
    .eq("id", id)
    .eq("business_id", businessId)

  if (error) {
    throw new Error("Erro ao atualizar status do colaborador")
  }

  revalidatePath("/staff")
  revalidatePath(`/staff/${id}`)
}

export async function deleteStaff(id: string): Promise<void> {
  const businessId = await getBusinessId()
  if (!businessId) throw new Error("Negócio não encontrado")

  const supabase = await createClient()
  const { error } = await supabase
    .from("staff")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId)

  if (error) {
    throw new Error("Erro ao excluir colaborador")
  }

  revalidatePath("/staff")
}

type OpeningHoursDay = { open: boolean; start: string; end: string }

const PT_TO_WEEKDAY: Record<string, string> = {
  segunda: "mon", terca: "tue", quarta: "wed",
  quinta: "thu", sexta: "fri", sabado: "sat", domingo: "sun",
}
const WEEKDAY_ORDER_LIST = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

function normalizeStr(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ")
}

function parseHoursText(text: string): Record<string, OpeningHoursDay> {
  const result: Record<string, OpeningHoursDay> = {}
  if (!text) return result
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue
    const colon = line.indexOf(":")
    if (colon === -1) continue
    const dayRaw = normalizeStr(line.slice(0, colon))
    const hoursRaw = line.slice(colon + 1).trim().toLowerCase()
    const keys: string[] = []
    const rangeMatch = dayRaw.match(/^(.+?)\s+a\s+(.+)$/)
    if (rangeMatch) {
      const from = PT_TO_WEEKDAY[normalizeStr(rangeMatch[1]!)]
      const to = PT_TO_WEEKDAY[normalizeStr(rangeMatch[2]!)]
      if (from && to) {
        const fi = WEEKDAY_ORDER_LIST.indexOf(from)
        const ti = WEEKDAY_ORDER_LIST.indexOf(to)
        if (fi !== -1 && ti !== -1 && fi <= ti) {
          for (let i = fi; i <= ti; i++) keys.push(WEEKDAY_ORDER_LIST[i]!)
        }
      }
    } else {
      const k = PT_TO_WEEKDAY[dayRaw]
      if (k) keys.push(k)
    }
    if (keys.length === 0) continue
    if (/fech/.test(hoursRaw)) {
      for (const k of keys) result[k] = { open: false, start: "08:00", end: "18:00" }
      continue
    }
    const m = hoursRaw.match(/(\d+)h?(?::(\d+))?\s*(?:às|as|[-–—])\s*(\d+)h?(?::(\d+))?/)
    if (m) {
      const startH = parseInt(m[1]!, 10)
      const startMin = parseInt(m[2] ?? "0", 10)
      const endH = parseInt(m[3]!, 10)
      const endMin = parseInt(m[4] ?? "0", 10)
      const start = `${String(startH).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`
      const end = `${String(endH).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`
      for (const k of keys) result[k] = { open: true, start, end }
    }
  }
  return result
}

export async function getBusinessOpeningHours(): Promise<Record<string, OpeningHoursDay> | null> {
  const businessId = await getBusinessId()
  if (!businessId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("businesses")
    .select("opening_hours")
    .eq("id", businessId)
    .single()
  const raw = (data as { opening_hours?: unknown } | null)?.opening_hours
  if (!raw || typeof raw !== "object") return null
  return raw as Record<string, OpeningHoursDay>
}

export async function generateStaffHours(
  userPrompt: string
): Promise<{ content?: string; parsed?: Record<string, OpeningHoursDay>; question?: string; outOfScope?: boolean; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: "API não configurada." }

  const prompt = `Informações fornecidas sobre horários de trabalho de um colaborador (pode conter descrição inicial seguida de respostas a perguntas anteriores):

${userPrompt}

REGRAS OBRIGATÓRIAS:
- Se o conteúdo acima não for sobre horários de trabalho (ex: pesquisa, receitas, notícias, animais, tópicos aleatórios), responda APENAS com: FORA_DO_ASSUNTO
- Formate APENAS os horários mencionados explicitamente. NUNCA invente horários não mencionados.
- Se não houver horários específicos identificáveis (ex: "horário comercial" sem horas exatas), responda APENAS com: PERGUNTA: [pergunta direta em português para descobrir os horários específicos]
- Se houver horários identificáveis, formate assim:
Segunda a Sexta: 8h às 18h
Sábado: 8h às 13h
Domingo: Fechado
Somente os horários. Sem cabeçalho.`

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    })
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : ""
    if (!text) return { error: "Resposta vazia. Tente novamente." }
    if (text === "FORA_DO_ASSUNTO" || text.startsWith("FORA_DO_ASSUNTO")) return { outOfScope: true }
    if (text.startsWith("PERGUNTA:")) return { question: text.replace(/^PERGUNTA:\s*/, "").trim() }
    const parsed = parseHoursText(text)
    return { content: text, parsed }
  } catch {
    return { error: "Erro ao gerar sugestão. Tente novamente." }
  }
}

export type PaymentInfo = {
  payment_day?: number | null
  payment_method?: string | null
  payment_reminder?: boolean
}

export async function generatePaymentInfo(
  userPrompt: string,
  staffName?: string
): Promise<{ content?: PaymentInfo; question?: string; outOfScope?: boolean; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: "API não configurada." }

  const nameCtx = staffName ? ` do colaborador ${staffName}` : ""
  const prompt = `Informações fornecidas sobre pagamento${nameCtx} (pode conter descrição inicial seguida de respostas a perguntas anteriores):

${userPrompt}

REGRAS OBRIGATÓRIAS:
- Se o conteúdo não for sobre pagamento ou remuneração de colaborador (ex: pesquisa, receitas, outros assuntos), responda APENAS: FORA_DO_ASSUNTO
- Extraia: dia do mês de pagamento (número 1-31), forma de pagamento (texto: PIX, dinheiro, transferência, etc.), se quer lembrete (true/false)
- Se não houver informação suficiente sobre quando e como é pago, responda APENAS: PERGUNTA: [pergunta direta em português pedindo o que falta — dia do pagamento, forma de pagamento ou se quer lembrete]
- Se houver informação suficiente, responda APENAS com JSON válido:
{"payment_day": número ou null, "payment_method": "texto" ou null, "payment_reminder": true ou false}`

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    })
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : ""
    if (!text) return { error: "Resposta vazia. Tente novamente." }
    if (text === "FORA_DO_ASSUNTO" || text.startsWith("FORA_DO_ASSUNTO")) return { outOfScope: true }
    if (text.startsWith("PERGUNTA:")) return { question: text.replace(/^PERGUNTA:\s*/, "").trim() }
    let jsonText = text
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim()
    }
    const parsed = JSON.parse(jsonText) as PaymentInfo
    return { content: parsed }
  } catch {
    return { error: "Erro ao analisar pagamento. Tente novamente." }
  }
}
