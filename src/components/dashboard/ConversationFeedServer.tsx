import { createClient } from "@/lib/supabase/server"
import { ConversationFeed } from "./ConversationFeed"
import type { ConversationWithCustomer } from "@/types/database"

export async function ConversationFeedServer({ businessId }: { businessId: string }) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("conversations")
    .select("*, customer:customers(*), last_message:messages(*)")
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false })
    .limit(5)

  const conversations = ((data ?? []) as ConversationWithCustomer[]).map((conv) => ({
    ...conv,
    customer: conv.customer ?? null,
    last_message: Array.isArray(conv.last_message)
      ? (conv.last_message[0] ?? null)
      : (conv.last_message ?? null),
  }))

  return <ConversationFeed conversations={conversations} />
}
