import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Conversation,
  ConversationWithCustomer,
  Message,
  MessageInsert,
  ConversationChannel,
} from "@/types/database";

/**
 * Returns a conversation with its last N messages (default 30).
 * Uses the server Supabase client with RLS.
 */
export async function getConversationWithMessages(
  conversationId: string,
  limit = 30
): Promise<{ conversation: ConversationWithCustomer; messages: Message[] } | null> {
  try {
    const supabase = await createClient();

    const { data: conversation, error: convoError } = await supabase
      .from("conversations")
      .select(`id,business_id,customer_id,channel,status,last_message_at,unread_count,ai_active,trajectory_state,created_at,updated_at,customer:customers(id,full_name,phone_number,email,status,lead_status,tags,total_spent,visit_count,last_visit_at,address,city,notes,business_id,created_at)`)
      .eq("id", conversationId)
      .single();

    if (convoError) {
      if (convoError.code !== "PGRST116") {
        console.error(
          "getConversationWithMessages conversation error:",
          convoError
        );
      }
      return null;
    }

    if (!conversation) return null;

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("id,conversation_id,business_id,direction,content,message_type,status,sent_at,sent_by,whatsapp_message_id,created_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(limit);

    if (messagesError) {
      console.error(
        "getConversationWithMessages messages error:",
        messagesError
      );
    }

    // Return messages in chronological order (oldest first)
    const orderedMessages = (messages ?? []).reverse();

    return {
      conversation: conversation as ConversationWithCustomer,
      messages: orderedMessages,
    };
  } catch (err) {
    console.error("getConversationWithMessages unexpected error:", err);
    return null;
  }
}

/**
 * Find an existing open/waiting conversation for a customer, or create a new one.
 * Uses the admin client to bypass RLS (called from webhook handlers).
 */
export async function findOrCreateConversation(
  businessId: string,
  customerId: string,
  channel: ConversationChannel = "whatsapp"
): Promise<Conversation> {
  const admin = createAdminClient();

  const { data: existing, error: findError } = await admin
    .from("conversations")
    .select("id,business_id,customer_id,channel,status,last_message_at,unread_count,ai_active,trajectory_state,created_at,updated_at")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .in("status", ["open", "waiting", "bot"])
    .order("last_message_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing as unknown as Conversation;

  // PGRST116 = no rows found — expected; anything else is an error
  if (findError && findError.code !== "PGRST116") {
    console.error("findOrCreateConversation lookup error:", findError);
    throw new Error(`Failed to look up conversation: ${findError.message}`);
  }

  const { data: created, error: createError } = await admin
    .from("conversations")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      channel,
      status: "open",
      ai_active: true,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      metadata: {},
    })
    .select()
    .single();

  if (createError || !created) {
    console.error("findOrCreateConversation create error:", createError);
    throw new Error(
      `Failed to create conversation: ${createError?.message ?? "unknown error"}`
    );
  }

  return created;
}

/**
 * Returns all open and waiting conversations for a business, sorted by
 * last_message_at descending. Joins customer data.
 * Uses the server Supabase client with RLS.
 */
export async function getOpenConversations(
  businessId: string
): Promise<ConversationWithCustomer[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("conversations")
      .select(`id,business_id,customer_id,channel,status,last_message_at,unread_count,ai_active,trajectory_state,created_at,updated_at,customer:customers(id,full_name,phone_number,status,lead_status,tags)`)
      .eq("business_id", businessId)
      .in("status", ["open", "waiting"])
      .order("last_message_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("getOpenConversations error:", error);
      return [];
    }

    return (data as ConversationWithCustomer[]) ?? [];
  } catch (err) {
    console.error("getOpenConversations unexpected error:", err);
    return [];
  }
}

/**
 * Mark all messages in a conversation as read and reset unread_count to 0.
 * Uses the admin client to bypass RLS.
 */
export async function markConversationRead(
  conversationId: string
): Promise<void> {
  try {
    const admin = createAdminClient();

    const [convoResult, messagesResult] = await Promise.all([
      admin
        .from("conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId),
      admin
        .from("messages")
        .update({ status: "read" })
        .eq("conversation_id", conversationId)
        .eq("direction", "inbound")
        .neq("status", "read"),
    ]);

    if (convoResult.error) {
      console.error(
        "markConversationRead conversation update error:",
        convoResult.error
      );
    }

    if (messagesResult.error) {
      console.error(
        "markConversationRead messages update error:",
        messagesResult.error
      );
    }
  } catch (err) {
    console.error("markConversationRead unexpected error:", err);
  }
}

/**
 * Append a message to a conversation and update the conversation's last_message_at.
 * Uses the admin client to bypass RLS (safe for both webhook and server usage).
 */
export async function saveMessage(data: MessageInsert): Promise<Message> {
  const admin = createAdminClient();

  const { data: message, error: msgError } = await admin
    .from("messages")
    .insert(data)
    .select()
    .single();

  if (msgError || !message) {
    console.error("saveMessage insert error:", msgError);
    throw new Error(
      `Failed to save message: ${msgError?.message ?? "unknown error"}`
    );
  }

  // Update last_message_at and bump unread_count for inbound messages
  const conversationUpdate =
    data.direction === "inbound"
      ? admin
          .from("conversations")
          .update({ last_message_at: message.sent_at })
          .eq("id", data.conversation_id)
      : admin
          .from("conversations")
          .update({ last_message_at: message.sent_at })
          .eq("id", data.conversation_id);

  const { error: updateError } = await conversationUpdate;

  if (updateError) {
    console.error("saveMessage conversation update error:", updateError);
    // Non-fatal — the message was saved successfully
  }

  return message;
}
