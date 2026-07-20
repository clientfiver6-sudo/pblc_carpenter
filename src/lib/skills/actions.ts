"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { invalidateContext } from "@/lib/ai/brain";

async function getAuthenticatedBusinessId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single();
  const bu = rawBu as { business_id: string } | null;

  if (!bu?.business_id) throw new Error("Negócio não encontrado");
  return bu.business_id;
}

export async function createSkill(data: { name: string; content: string; order_index?: number }): Promise<{ error?: string }> {
  try {
    const businessId = await getAuthenticatedBusinessId();
    const supabase = await createClient();
    const { error } = await supabase.from("business_skills").insert({
      business_id: businessId,
      name: data.name,
      content: data.content,
      active: true,
      order_index: data.order_index ?? 0,
    } as never);
    if (error) return { error: `Erro ao criar instrução: ${error.message}` };
    invalidateContext(businessId);
    revalidatePath("/dashboard/settings/skills");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar instrução" };
  }
}

export async function updateSkill(
  id: string,
  data: { name?: string; content?: string }
): Promise<{ error?: string }> {
  try {
    const businessId = await getAuthenticatedBusinessId();
    const supabase = await createClient();
    const { error } = await supabase
      .from("business_skills")
      .update(data as never)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) return { error: `Erro ao atualizar instrução: ${error.message}` };
    invalidateContext(businessId);
    revalidatePath("/dashboard/settings/skills");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao atualizar instrução" };
  }
}

export async function deleteSkill(id: string): Promise<{ error?: string }> {
  try {
    const businessId = await getAuthenticatedBusinessId();
    const supabase = await createClient();
    const { error } = await supabase
      .from("business_skills")
      .delete()
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) return { error: `Erro ao excluir instrução: ${error.message}` };
    invalidateContext(businessId);
    revalidatePath("/dashboard/settings/skills");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao excluir instrução" };
  }
}

export async function toggleSkillActive(id: string, active: boolean): Promise<{ error?: string }> {
  try {
    const businessId = await getAuthenticatedBusinessId();
    const supabase = await createClient();
    const { error } = await supabase
      .from("business_skills")
      .update({ active } as never)
      .eq("id", id)
      .eq("business_id", businessId);
    if (error) return { error: `Erro ao alterar status: ${error.message}` };
    invalidateContext(businessId);
    revalidatePath("/dashboard/settings/skills");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao alterar status" };
  }
}
