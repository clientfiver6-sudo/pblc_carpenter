"use server";

import { getBusinessId } from "@/lib/auth/actions";
import { createCustomer } from "@/lib/customers/actions";
import { triggerLeadCreated } from "@/lib/automations/triggers";
import type { Customer } from "@/types/database";

export async function createCustomerWithAuth(data: {
  full_name: string;
  phone_number?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
}): Promise<Customer> {
  const businessId = await getBusinessId();
  if (!businessId) throw new Error("Não autenticado");

  const customer = await createCustomer({
    business_id: businessId,
    full_name: data.full_name,
    phone_number: data.phone_number || null,
    email: data.email || null,
    address: data.address || null,
    city: data.city || null,
    notes: data.notes || null,
    tags: [],
    status: "active",
    lead_status: "new",
    total_spent: 0,
    visit_count: 0,
    last_visit_at: null,
    metadata: {},
  });

  // Fire lead_created automation (best-effort — never blocks customer creation)
  void triggerLeadCreated(customer.id, businessId).catch((err) =>
    console.error("createCustomerWithAuth triggerLeadCreated failed:", err)
  );

  return customer;
}
