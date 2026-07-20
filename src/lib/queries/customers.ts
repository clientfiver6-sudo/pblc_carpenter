import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Customer,
  WorkItemWithRelations,
  Message,
} from "@/types/database";

/**
 * Search customers by full_name or phone_number with pagination.
 * Uses the server Supabase client with RLS.
 */
export async function searchCustomers(
  businessId: string,
  query: string,
  limit = 20
): Promise<Customer[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("customers")
      .select("id,business_id,full_name,phone_number,email,status,lead_status,tags,total_spent,visit_count,last_visit_at,created_at")
      .eq("business_id", businessId)
      .or(`full_name.ilike.%${query}%,phone_number.ilike.%${query}%`)
      .order("full_name", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("searchCustomers error:", error);
      return [];
    }

    return data ?? [];
  } catch (err) {
    console.error("searchCustomers unexpected error:", err);
    return [];
  }
}

/**
 * Returns a full customer profile with work item history and recent messages.
 * Uses the server Supabase client with RLS.
 */
export async function getCustomerWithHistory(customerId: string): Promise<{
  customer: Customer;
  workItems: WorkItemWithRelations[];
  recentMessages: Message[];
} | null> {
  try {
    const supabase = await createClient();

    const { data: rawCustomer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();
    const customer = rawCustomer as Customer | null;

    if (customerError) {
      if (customerError.code !== "PGRST116") {
        console.error("getCustomerWithHistory customer error:", customerError);
      }
      return null;
    }

    if (!customer) return null;

    const [workItemsResult, messagesResult] = await Promise.all([
      supabase
        .from("work_items")
        .select(
          `id,title,status,scheduled_start,scheduled_end,price_estimate,final_price,payment_status,notes,created_at,updated_at,business_id,customer_id,service_id,assigned_staff_id,customer:customers(id,full_name,phone_number),service:services(id,name,duration_minutes,price),assigned_staff:staff(id,name,role)`
        )
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("messages")
        .select("id,conversation_id,direction,content,message_type,status,sent_at,sent_by,created_at")
        .eq("business_id", customer.business_id)
        .in(
          "conversation_id",
          (
            (
              await supabase
                .from("conversations")
                .select("id")
                .eq("customer_id", customerId)
            ).data as Array<{ id: string }> | null
          )?.map((c) => c.id) ?? []
        )
        .order("sent_at", { ascending: false })
        .limit(50),
    ]);

    if (workItemsResult.error) {
      console.error(
        "getCustomerWithHistory work_items error:",
        workItemsResult.error
      );
    }

    if (messagesResult.error) {
      console.error(
        "getCustomerWithHistory messages error:",
        messagesResult.error
      );
    }

    return {
      customer,
      workItems: (workItemsResult.data as WorkItemWithRelations[]) ?? [],
      recentMessages: messagesResult.data ?? [],
    };
  } catch (err) {
    console.error("getCustomerWithHistory unexpected error:", err);
    return null;
  }
}

/**
 * Find a customer by phone number or create a new one.
 * Used by the webhook handler. Uses the admin client to bypass RLS.
 */
export async function findOrCreateCustomerByPhone(
  businessId: string,
  phoneNumber: string,
  name?: string
): Promise<Customer> {
  const admin = createAdminClient();

  const { data: rawExisting, error: findError } = await admin
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .eq("phone_number", phoneNumber)
    .single();
  const existing = rawExisting as Customer | null;

  if (existing) return existing;

  // PGRST116 = row not found, which is expected — any other error is a real problem
  if (findError && findError.code !== "PGRST116") {
    console.error("findOrCreateCustomerByPhone lookup error:", findError);
    throw new Error(`Failed to look up customer: ${findError.message}`);
  }

  const { data: rawCreated, error: createError } = await admin
    .from("customers")
    .insert({
      business_id: businessId,
      phone_number: phoneNumber,
      full_name: name ?? phoneNumber,
      tags: [],
      status: "active",
      lead_status: "new",
      total_spent: 0,
      visit_count: 0,
      metadata: {},
    } as never)
    .select()
    .single();
  const created = rawCreated as Customer | null;

  if (createError || !created) {
    console.error(
      "findOrCreateCustomerByPhone create error:",
      createError
    );
    throw new Error(
      `Failed to create customer: ${createError?.message ?? "unknown error"}`
    );
  }

  return created;
}
