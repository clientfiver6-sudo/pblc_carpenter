"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getBusinessId } from "@/lib/auth/actions"
import { z } from "zod"
import type { Service } from "@/types/database"

const serviceSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  duration_minutes: z.number().min(15).max(480),
  price: z.number().min(0).optional(),
  price_max: z.number().min(0).optional(),
  category: z.string().optional(),
  active: z.boolean().default(true),
})

type ServiceFormData = z.infer<typeof serviceSchema>

export async function createService(data: ServiceFormData): Promise<Service> {
  const parsed = serviceSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0].message)
  }

  const businessId = await getBusinessId()
  if (!businessId) throw new Error("Negócio não encontrado")

  const supabase = await createClient()
  const { data: rawService, error } = await supabase
    .from("services")
    .insert({
      business_id: businessId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      duration_minutes: parsed.data.duration_minutes,
      price: parsed.data.price ?? null,
      price_max: parsed.data.price_max ?? null,
      category: parsed.data.category ?? null,
      active: parsed.data.active,
    } as never)
    .select()
    .single()
  const service = rawService as Service | null

  if (error || !service) {
    throw new Error("Erro ao criar serviço")
  }

  revalidatePath("/staff")
  return service
}

export async function updateService(
  id: string,
  data: Partial<ServiceFormData>
): Promise<void> {
  const businessId = await getBusinessId()
  if (!businessId) throw new Error("Negócio não encontrado")

  const supabase = await createClient()
  const { error } = await supabase
    .from("services")
    .update({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.duration_minutes !== undefined && {
        duration_minutes: data.duration_minutes,
      }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.price_max !== undefined && { price_max: data.price_max }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.active !== undefined && { active: data.active }),
    } as never)
    .eq("id", id)
    .eq("business_id", businessId)

  if (error) {
    throw new Error("Erro ao atualizar serviço")
  }

  revalidatePath("/staff")
}

export async function toggleServiceActive(
  id: string,
  active: boolean
): Promise<void> {
  const businessId = await getBusinessId()
  if (!businessId) throw new Error("Negócio não encontrado")

  const supabase = await createClient()
  const { error } = await supabase
    .from("services")
    .update({ active } as never)
    .eq("id", id)
    .eq("business_id", businessId)

  if (error) {
    throw new Error("Erro ao atualizar status do serviço")
  }

  revalidatePath("/staff")
}

export async function deleteService(id: string): Promise<void> {
  const businessId = await getBusinessId()
  if (!businessId) throw new Error("Negócio não encontrado")

  const supabase = await createClient()
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId)

  if (error) {
    throw new Error("Erro ao excluir serviço")
  }

  revalidatePath("/staff")
}
