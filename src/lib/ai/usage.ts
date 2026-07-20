import { createAdminClient } from "@/lib/supabase/admin"

const PRICING: Record<string, { inputPerM: number; outputPerM: number }> = {
  "claude-sonnet-4-20250514": { inputPerM: 300, outputPerM: 1500 },
  "claude-haiku-4-5-20251001": { inputPerM: 25, outputPerM: 125 },
  "deepseek-chat": { inputPerM: 27, outputPerM: 110 },
}

export function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-20250514"]
  return Math.round((inputTokens / 1_000_000) * p.inputPerM + (outputTokens / 1_000_000) * p.outputPerM)
}

export async function logUsage(
  businessId: string,
  functionName: string,
  usage: { input_tokens: number; output_tokens: number },
  model: string,
  conversationId?: string,
): Promise<void> {
  try {
    const admin = createAdminClient()
    const cost = calculateCostCents(model, usage.input_tokens, usage.output_tokens)
    await admin.from("ai_usage_logs").insert({
      business_id: businessId,
      function_name: functionName,
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cost_usd_cents: cost,
      conversation_id: conversationId ?? null,
    } as never)
  } catch {
    // Non-fatal — never let usage logging break core flows
  }
}
