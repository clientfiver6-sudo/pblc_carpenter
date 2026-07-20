import { createAdminClient } from "@/lib/supabase/admin"

async function createEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return []
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    })
    const json = await res.json()
    return (json.data?.[0]?.embedding as number[]) ?? []
  } catch {
    return []
  }
}

export async function storeMemory(
  businessId: string,
  customerId: string,
  content: string,
  memoryType: "conversation_summary" | "preference" | "complaint" | "note" = "conversation_summary",
): Promise<void> {
  if (!process.env.OPENAI_API_KEY) return
  try {
    const embedding = await createEmbedding(content)
    const admin = createAdminClient()
    await admin.from("customer_memories").insert({
      business_id: businessId,
      customer_id: customerId,
      content,
      embedding: embedding.length > 0 ? (embedding as unknown as never) : null,
      memory_type: memoryType,
    } as never)
  } catch {
    // non-fatal
  }
}

export async function recallMemories(
  customerId: string,
  query: string,
  limit = 5,
): Promise<Array<{ content: string; memory_type: string; created_at: string }>> {
  if (!process.env.OPENAI_API_KEY) return []
  try {
    const embedding = await createEmbedding(query)
    if (embedding.length === 0) return []
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as unknown as any).rpc("match_customer_memories", {
      query_embedding: embedding,
      customer_id_filter: customerId,
      match_count: limit,
    })
    return (data as unknown as Array<{ content: string; memory_type: string; created_at: string }>) ?? []
  } catch {
    return []
  }
}
