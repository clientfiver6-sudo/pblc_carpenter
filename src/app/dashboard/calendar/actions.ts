"use server"

import { revalidatePath } from "next/cache"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { getBusinessId } from "@/lib/auth/actions"

export async function generateEventContent(
  userPrompt: string
): Promise<{ title?: string; description?: string; question?: string; outOfScope?: boolean; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: "API não configurada." }

  const autoPrompt = `PERGUNTA: Que tipo de evento você quer criar? Pode ser uma reunião de equipe, visita técnica, lembrete, etc.`

  const extractPrompt = `O usuário quer criar um evento de calendário para um negócio. Informações fornecidas (pode conter descrição inicial seguida de respostas a perguntas):

${userPrompt}

REGRAS OBRIGATÓRIAS:
- Se o conteúdo não for sobre um evento de agenda ou negócio (ex: receitas, notícias, tópicos aleatórios), responda APENAS com: FORA_DO_ASSUNTO
- Se não houver informações suficientes para criar um evento com título claro, responda APENAS com: PERGUNTA: [uma pergunta direta em português]
- Se houver informação suficiente, retorne APENAS um JSON:
{"title":"Título do evento","description":"Descrição breve do evento"}
Somente o JSON, sem explicação.`

  const prompt = userPrompt.trim() ? extractPrompt : autoPrompt

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    })
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : ""
    if (!text) return { error: "Resposta vazia. Tente novamente." }
    if (text.startsWith("FORA_DO_ASSUNTO")) return { outOfScope: true }
    if (text.startsWith("PERGUNTA:")) return { question: text.replace(/^PERGUNTA:\s*/, "").trim() }
    try {
      const m = text.match(/\{[\s\S]*\}/)
      if (m) {
        const parsed = JSON.parse(m[0]) as { title?: string; description?: string }
        return { title: parsed.title?.trim(), description: parsed.description?.trim() }
      }
    } catch {}
    return { error: "Não foi possível interpretar. Tente novamente." }
  } catch {
    return { error: "Erro ao gerar. Tente novamente." }
  }
}

export async function createCalendarEvent(data: {
  title: string
  description?: string
  startAt: string
  endAt?: string
}): Promise<{ error?: string }> {
  const businessId = await getBusinessId()
  if (!businessId) return { error: "Negócio não encontrado" }

  const supabase = await createClient()
  const { error } = await supabase.from("work_items").insert({
    business_id: businessId,
    type: "event",
    title: data.title,
    notes: data.description ?? null,
    scheduled_start: data.startAt,
    scheduled_end: data.endAt ?? null,
    status: "new",
    payment_status: "unpaid",
    metadata: { status_history: [{ status: "new", changed_at: new Date().toISOString() }] },
  } as never)

  if (error) return { error: "Erro ao criar evento." }

  revalidatePath("/dashboard/calendar")
  return {}
}
