"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  Customer,
  CustomerInsert,
  CustomerUpdate,
} from "@/types/database";

export async function createCustomer(data: CustomerInsert): Promise<Customer> {
  const supabase = await createClient();

  const { data: rawCustomer, error } = await supabase
    .from("customers")
    .insert(data as never)
    .select()
    .single();
  const customer = rawCustomer as Customer | null;

  if (error || !customer) {
    throw new Error(error?.message ?? "Erro ao criar cliente");
  }

  revalidatePath("/dashboard/customers");
  return customer;
}

export async function updateCustomer(
  id: string,
  data: CustomerUpdate
): Promise<Customer> {
  const supabase = await createClient();

  const { data: rawCustomer, error } = await supabase
    .from("customers")
    .update(data as never)
    .eq("id", id)
    .select()
    .single();
  const customer = rawCustomer as Customer | null;

  if (error || !customer) {
    throw new Error(error?.message ?? "Erro ao atualizar cliente");
  }

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
  return customer;
}

export async function updateCustomerTags(
  id: string,
  tags: string[]
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({ tags } as never)
    .eq("id", id);

  if (error) {
    throw new Error(error.message ?? "Erro ao atualizar etiquetas");
  }

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
}

export async function updateCustomerNotes(
  id: string,
  notes: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({ notes } as never)
    .eq("id", id);

  if (error) {
    throw new Error(error.message ?? "Erro ao atualizar observações");
  }

  revalidatePath("/dashboard/customers");
  revalidatePath(`/dashboard/customers/${id}`);
}

export async function sendQuickMessage(
  customerId: string,
  businessId: string,
  content: string
): Promise<void> {
  const supabase = await createClient();

  // Find or create conversation for this customer
  const { data: rawExistingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("customer_id", customerId)
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  const existingConv = rawExistingConv as { id: string } | null;

  let conversationId: string;

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: rawNewConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        business_id: businessId,
        customer_id: customerId,
        channel: "manual",
        status: "open",
        ai_active: false,
        last_message_at: new Date().toISOString(),
        unread_count: 0,
        metadata: {},
      } as never)
      .select()
      .single();
    const newConv = rawNewConv as { id: string } | null;

    if (convError || !newConv) {
      throw new Error("Erro ao criar conversa");
    }
    conversationId = newConv.id;
  }

  const { error: msgError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    business_id: businessId,
    direction: "outbound",
    content,
    message_type: "text",
    status: "sending",
    sent_at: new Date().toISOString(),
    metadata: {},
  } as never);

  if (msgError) {
    throw new Error(msgError.message ?? "Erro ao enviar mensagem");
  }

  revalidatePath(`/dashboard/customers/${customerId}`);
}
