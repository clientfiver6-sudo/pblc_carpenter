"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WorkItemStatus } from "@/types/database";

export async function bulkUpdateStatus(
  workItemIds: string[],
  status: WorkItemStatus,
  businessId: string
): Promise<void> {
  if (!workItemIds.length) return;

  const supabase = await createClient();

  // Authenticate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single();
  const bu = rawBu as { business_id: string } | null;
  if (!bu || bu.business_id !== businessId) throw new Error("Proibido");

  const now = new Date().toISOString();

  if (status === "cancelled") {
    // Cancelled items are permanently deleted
    const { error } = await supabase
      .from("work_items")
      .delete()
      .eq("business_id", businessId)
      .in("id", workItemIds);
    if (error) {
      console.error("bulkUpdateStatus: delete error", error);
      throw new Error("Erro ao cancelar os itens. Tente novamente.");
    }
  } else {
    // Batch update — only items that belong to this business (security: double-filter)
    const { error } = await supabase
      .from("work_items")
      .update({ status, updated_at: now } as never)
      .eq("business_id", businessId)
      .in("id", workItemIds);

    if (error) {
      console.error("bulkUpdateStatus: update error", error);
      throw new Error("Erro ao atualizar os itens. Tente novamente.");
    }
  }

  revalidatePath("/dashboard/work-items");
  revalidatePath("/dashboard/calendar");
}
