import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

interface Props {
  businessName: string
  todayCount: number
  pendingPayCount: number
  pendingPayTotal: number
  unreadCount: number
  mode?: "morning" | "evening"
}

export async function DailySummaryAI({ businessName, todayCount, pendingPayCount, pendingPayTotal, unreadCount, mode = "morning" }: Props) {
  try {
    const fmtBRL = (cents: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)

    const context = [
      `Negócio: ${businessName}`,
      `Agendamentos hoje: ${todayCount}`,
      pendingPayCount > 0
        ? `Pagamentos pendentes: ${pendingPayCount} (total: ${fmtBRL(pendingPayTotal)})`
        : "Sem pagamentos pendentes",
      unreadCount > 0
        ? `Conversas não lidas: ${unreadCount}`
        : "Sem conversas não lidas",
    ].join(". ")

    const prompt = mode === "evening"
      ? `Você é o assistente do ${businessName}. Com base nos dados abaixo, escreva EXATAMENTE 2 frases curtas em português encerrando o dia do empresário: destaque o que foi realizado e deixe uma nota positiva para amanhã. Sem markdown, sem listas.\n\n${context}`
      : `Você é o assistente do ${businessName}. Com base nos dados abaixo, escreva EXATAMENTE 2 frases curtas em português resumindo o dia do empresário. Seja direto, útil e levemente motivador. Sem markdown, sem listas.\n\n${context}`

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    })

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : null
    if (!text) return null

    return (
      <p className="text-sm text-ink-2 leading-relaxed">
        {text}
      </p>
    )
  } catch {
    return null
  }
}

export function DailySummaryAISkeleton() {
  return (
    <div className="space-y-1.5 animate-pulse">
      <div className="h-3.5 bg-black/8 rounded-full w-full" />
      <div className="h-3.5 bg-black/8 rounded-full w-4/5" />
    </div>
  )
}
