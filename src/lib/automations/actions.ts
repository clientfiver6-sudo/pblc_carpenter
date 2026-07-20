"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { Automation, AutomationInsert, AutomationUpdate } from "@/types/database"

export async function createAutomation(data: AutomationInsert): Promise<Automation> {
  const supabase = await createClient()

  const { data: rawAutomation, error } = await supabase
    .from("automations")
    .insert(data as never)
    .select()
    .single()
  const automation = rawAutomation as Automation | null

  if (error || !automation) {
    console.error("[actions/createAutomation] error:", error)
    throw new Error("Erro ao criar automação")
  }

  revalidatePath("/automations")
  return automation
}

export async function updateAutomation(
  id: string,
  data: Partial<AutomationUpdate>
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("automations")
    .update(data as never)
    .eq("id", id)

  if (error) {
    console.error(`[actions/updateAutomation] id=${id} error:`, error)
    throw new Error("Erro ao atualizar automação")
  }

  revalidatePath("/automations")
}

export async function toggleAutomation(id: string, active: boolean): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("automations")
    .update({ active } as never)
    .eq("id", id)

  if (error) {
    console.error(`[actions/toggleAutomation] id=${id} error:`, error)
    throw new Error("Erro ao alterar status da automação")
  }

  revalidatePath("/automations")
}

export async function deleteAutomation(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("automations")
    .delete()
    .eq("id", id)

  if (error) {
    console.error(`[actions/deleteAutomation] id=${id} error:`, error)
    throw new Error("Erro ao excluir automação")
  }

  revalidatePath("/automations")
}
