-- Atomic increment functions to prevent read-then-write race conditions
-- and a deduplication index to prevent duplicate WhatsApp message rows.

-- Atomic: add amount to customer.total_spent
CREATE OR REPLACE FUNCTION add_customer_total_spent(p_customer_id uuid, p_amount bigint)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE customers SET total_spent = COALESCE(total_spent, 0) + p_amount WHERE id = p_customer_id;
$$;

-- Atomic: increment conversation unread_count
CREATE OR REPLACE FUNCTION increment_conversation_unread(p_conversation_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE conversations SET unread_count = unread_count + 1 WHERE id = p_conversation_id;
$$;

-- Atomic: increment automation run_count and update last_run_at
CREATE OR REPLACE FUNCTION increment_automation_run_count(p_automation_id uuid, p_last_run_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE automations SET run_count = run_count + 1, last_run_at = p_last_run_at WHERE id = p_automation_id;
$$;

-- Deduplicate inbound WhatsApp messages.
-- Partial index so NULLs (outbound / manual messages without a WA ID) are still allowed.
CREATE UNIQUE INDEX IF NOT EXISTS messages_whatsapp_message_id_unique
  ON messages (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;
