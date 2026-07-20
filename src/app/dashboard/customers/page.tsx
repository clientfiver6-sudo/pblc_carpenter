import { Button } from "@/components/ui/button";
import { CustomerList } from "@/components/customers/CustomerList";
import { CustomerPageActions } from "@/components/customers/CustomerPageActions";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/auth/actions";
import { getBusinessConfig } from "@/lib/config/business-types";
import type { BusinessType } from "@/lib/config/business-types";
import type { Customer } from "@/types/database";
import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const businessId = await getBusinessId();
  if (!businessId) redirect("/login");

  const supabase = await createClient();

  // Fetch business type
  const { data: rawBusiness } = await supabase
    .from("businesses")
    .select("type")
    .eq("id", businessId)
    .single();
  const business = rawBusiness as { type: import("@/types/database").BusinessType } | null;

  const businessType = (business?.type ?? "other_service_business") as BusinessType;
  const config = getBusinessConfig(businessType);

  // Count total customers
  const { count } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId);

  const total = count ?? 0;

  // Fetch initial 20 customers
  const { data: rawCustomers } = await supabase
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .order("last_visit_at", { ascending: false, nullsFirst: false })
    .range(0, 19);
  const customers = rawCustomers as Customer[] | null;

  // Collect distinct tags for BulkMessageDialog
  const tagSet = new Set((customers ?? []).flatMap((c) => c.tags ?? []));
  const allTags = Array.from(tagSet).sort();

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight">
            {config.customerLabel}
          </h2>
          <p className="text-sm text-ink-3 mt-0.5">
            <span className="font-mono font-semibold">{total}</span> clientes cadastrados
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CustomerPageActions
            businessId={businessId}
            availableTags={allTags}
          />
          <Button
            asChild
            className="text-white font-semibold gap-2 hover:opacity-90"
            style={{ background: "var(--brand-grad)" }}
          >
            <Link href="/dashboard/customers/new">
              <Plus className="w-4 h-4" />
              Novo
            </Link>
          </Button>
        </div>
      </div>

      {/* List */}
      <CustomerList
        initialCustomers={customers ?? []}
        businessType={businessType}
        total={total}
      />
    </div>
  );
}
