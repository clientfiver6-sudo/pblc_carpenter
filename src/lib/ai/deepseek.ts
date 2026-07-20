const DEEPSEEK_BASE = "https://api.deepseek.com"
export const DS_MODEL = "deepseek-chat"

type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

interface DSResponse {
  choices: Array<{ message: { content: string } }>
  usage: { prompt_tokens: number; completion_tokens: number }
}

export interface DSMessage {
  content: [{ type: "text"; text: string }]
  usage: { input_tokens: number; output_tokens: number }
}

function getKey(): string {
  const key = process.env.DEEPSEEK_API_KEY
  if (!key) throw new Error("DEEPSEEK_API_KEY not set")
  return key
}

export async function dsCreate(params: {
  model?: string
  max_tokens: number
  system: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
}): Promise<DSMessage> {
  const body: ChatMessage[] = [
    { role: "system", content: params.system },
    ...params.messages,
  ]

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model: params.model ?? DS_MODEL,
      max_tokens: params.max_tokens,
      messages: body,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    throw new Error(`DeepSeek ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as DSResponse
  return {
    content: [{ type: "text", text: data.choices[0].message.content }],
    usage: {
      input_tokens: data.usage.prompt_tokens,
      output_tokens: data.usage.completion_tokens,
    },
  }
}

export async function dsStream(params: {
  max_tokens: number
  system: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
  onUsage?: (u: { input_tokens: number; output_tokens: number }) => void
}): Promise<ReadableStream<Uint8Array>> {
  const body: ChatMessage[] = [
    { role: "system", content: params.system },
    ...params.messages,
  ]

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model: DS_MODEL,
      max_tokens: params.max_tokens,
      messages: body,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) throw new Error(`DeepSeek stream ${res.status}: ${await res.text()}`)
  if (!res.body) throw new Error("No response body from DeepSeek")

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const reader = res.body.getReader()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let promptTokens = 0
      let completionTokens = 0
      let buf = ""
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split("\n")
          buf = lines.pop() ?? ""
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || trimmed === "data: [DONE]") continue
            if (!trimmed.startsWith("data: ")) continue
            try {
              const json = JSON.parse(trimmed.slice(6)) as {
                choices: Array<{ delta: { content?: string } }>
                usage?: { prompt_tokens: number; completion_tokens: number }
              }
              const delta = json.choices[0]?.delta?.content
              if (delta) controller.enqueue(encoder.encode(delta))
              if (json.usage) {
                promptTokens = json.usage.prompt_tokens
                completionTokens = json.usage.completion_tokens
              }
            } catch { /* skip malformed SSE lines */ }
          }
        }
      } finally {
        reader.releaseLock()
        params.onUsage?.({ input_tokens: promptTokens, output_tokens: completionTokens })
        controller.close()
      }
    },
  })
}
