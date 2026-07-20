import { createClient } from "@/lib/supabase/server"
import { getBusinessId } from "@/lib/auth/actions"
import { checkRateLimit } from "@/lib/rate-limit"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response("Unauthorized", { status: 401 })

  const businessId = await getBusinessId()
  if (!businessId) return new Response("No business", { status: 403 })

  const { allowed } = await checkRateLimit(`ai_analytics:${businessId}`, 20, 3_600_000)
  if (!allowed) return new Response("Limite atingido. Tente novamente em breve.", { status: 429 })

  const { messages, summary } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[]
    summary: Record<string, unknown>
  }

  const system = `Você é um analista de dados especializado neste negócio. Responda APENAS perguntas sobre os dados de desempenho: receita, serviços, clientes, conversas e métricas operacionais.

Se o usuário pedir qualquer coisa fora de análise de dados (cadastrar cliente, enviar mensagem, criar serviço, etc.), recuse com cortesia: "Este espaço é exclusivo para análise de dados. Para outras ações, use o assistente RetornAI."

Seja conciso, direto e fundamente suas respostas nos dados fornecidos. Use formatação simples (sem markdown excessivo).

Dados atuais do negócio:
${JSON.stringify(summary, null, 2)}`

  const stream = await anthropic.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
