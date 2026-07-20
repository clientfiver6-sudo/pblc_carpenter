"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTextMessage } from "@/lib/whatsapp/client";
import type { Customer, Business } from "@/types/database";

export type BulkTargetFilter =
  | { type: "all_active" }
  | { type: "upcoming_7_days" }
  | { type: "by_tag"; tag: string };

interface SendBulkMessageParams {
  businessId: string;
  message: string;
  targetFilter: BulkTargetFilter;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function interpolateMessage(
  template: string,
  customerName: string,
  businessName: string
): string {
  return template
    .replace(/\{\{nome\}\}/gi, customerName)
    .replace(/\{\{negocio\}\}/gi, businessName);
}

async function fetchTargetCustomers(
  businessId: string,
  filter: BulkTargetFilter
): Promise<Customer[]> {
  const admin = createAdminClient();

  if (filter.type === "all_active") {
    const { data } = await admin
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .eq("status", "active")
      .not("phone_number", "is", null);
    return (data as Customer[] | null) ?? [];
  }

  if (filter.type === "upcoming_7_days") {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find customers with work items scheduled in the next 7 days
    const { data: workItems } = await admin
      .from("work_items")
      .select("customer_id")
      .eq("business_id", businessId)
      .gte("scheduled_start", now.toISOString())
      .lte("scheduled_start", sevenDays.toISOString())
      .in("status", ["new", "scheduled", "pending_confirmation", "confirmed"])
      .not("customer_id", "is", null);

    const idSet = new Set(
      (workItems ?? [])
        .map((w) => w.customer_id)
        .filter((id): id is string => Boolean(id))
    );
    const customerIds = Array.from(idSet);

    if (customerIds.length === 0) return [];

    const { data } = await admin
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .in("id", customerIds)
      .not("phone_number", "is", null);
    return (data as Customer[] | null) ?? [];
  }

  if (filter.type === "by_tag") {
    const { data } = await admin
      .from("customers")
      .select("*")
      .eq("business_id", businessId)
      .contains("tags", [filter.tag])
      .not("phone_number", "is", null);
    return (data as Customer[] | null) ?? [];
  }

  return [];
}

export async function getTargetCustomerCount(
  businessId: string,
  filter: BulkTargetFilter
): Promise<number> {
  // Authenticate the caller
  const supabase = await createClient();
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

  const customers = await fetchTargetCustomers(businessId, filter);
  return customers.length;
}

export async function sendBulkMessage(
  data: SendBulkMessageParams
): Promise<{ sent: number; failed: number }> {
  const { businessId, message, targetFilter } = data;

  // Authenticate
  const supabase = await createClient();
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

  const admin = createAdminClient();

  // Fetch business WhatsApp credentials + name
  const { data: rawBusiness } = await admin
    .from("businesses")
    .select("name, whatsapp_phone_id")
    .eq("id", businessId)
    .single();
  const business = rawBusiness as Pick<Business, "name" | "whatsapp_phone_id"> | null;

  if (!business?.whatsapp_phone_id) {
    throw new Error(
      "WhatsApp não configurado. Configure nas Configurações > WhatsApp."
    );
  }

  const { whatsapp_phone_id: instanceName, name: businessName } = business;

  // Fetch target customers
  const customers = await fetchTargetCustomers(businessId, targetFilter);

  let sent = 0;
  let failed = 0;

  for (const customer of customers) {
    if (!customer.phone_number) {
      failed++;
      continue;
    }

    const finalMessage = interpolateMessage(message, customer.full_name, businessName);

    try {
      const whatsappMessageId = await sendTextMessage({
        to: customer.phone_number,
        text: finalMessage,
        instanceName,
      });

      // Upsert conversation record so message appears in inbox
      const { data: existingConvRaw } = await admin
        .from("conversations")
        .select("id")
        .eq("business_id", businessId)
        .eq("customer_id", customer.id)
        .eq("channel", "whatsapp")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const existingConv = existingConvRaw as { id: string } | null;

      const now = new Date().toISOString();
      let conversationId: string;

      if (existingConv) {
        conversationId = existingConv.id;
        await admin
          .from("conversations")
          .update({ last_message_at: now } as never)
          .eq("id", conversationId);
      } else {
        const { data: newConvRaw } = await admin
          .from("conversations")
          .insert({
            business_id: businessId,
            customer_id: customer.id,
            channel: "whatsapp",
            status: "open",
            ai_active: false,
            last_message_at: now,
            unread_count: 0,
            metadata: {},
          } as never)
          .select("id")
          .single();
        const newConv = newConvRaw as { id: string } | null;
        if (!newConv) {
          sent++;
          await sleep(500);
          continue;
        }
        conversationId = newConv.id;
      }

      // Insert outbound message record
      await admin.from("messages").insert({
        conversation_id: conversationId,
        business_id: businessId,
        direction: "outbound",
        content: finalMessage,
        message_type: "text",
        whatsapp_message_id: whatsappMessageId,
        status: "sent",
        sent_by: user.id,
        metadata: { bulk_send: true },
        sent_at: now,
      } as never);

      sent++;
    } catch (err) {
      console.error(`sendBulkMessage: failed for customer ${customer.id}`, err);
      failed++;
    }

    // Rate limit: 1 message per 500ms
    await sleep(500);
  }

  return { sent, failed };
}
