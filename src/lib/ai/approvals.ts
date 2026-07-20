import { createAdminClient } from "@/lib/supabase/admin"

export const APPROVAL_REQUIRED_TOOLS = new Set(["cancel_work_item", "handoff_to_human"])

export async function requestApproval(
  businessId: string,
  conversationId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<string> {
  try {
    const admin = createAdminClient()
    const { data: approval } = await admin
      .from("ai_approvals")
      .insert({
        business_id: businessId,
        conversation_id: conversationId,
        tool_name: toolName,
        tool_input: toolInput as never,
        status: "pending",
      } as never)
      .select("id")
      .single()

    // Fire notification to business owner
    if (approval) {
      await admin.from("notifications").insert({
        business_id: businessId,
        type: "work_item_overdue",
        title: "Aprovação necessária",
        body: `A IA solicitou executar "${toolName}" e aguarda sua confirmação.`,
        metadata: { approval_id: (approval as { id: string }).id, conversation_id: conversationId },
        read: false,
        link: `/dashboard/approvals`,
      } as never)
    }
  } catch {
    // non-fatal
  }
  return JSON.stringify({
    approval_pending: true,
    message: "Ação enviada para aprovação do gestor. Aguardando confirmação antes de prosseguir.",
  })
}
