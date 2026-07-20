import { CustomerProfile } from "@/components/customers/CustomerProfile";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/auth/actions";
import { getBusinessConfig } from "@/lib/config/business-types";
import { getBusinessPlan } from "@/lib/auth/plan";
import type { BusinessType } from "@/lib/config/business-types";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;

  const businessId = await getBusinessId();
  if (!businessId) redirect("/login");

  const supabase = await createClient();

  // Fetch business type + plan in parallel
  const [{ data: rawBusiness }, plan] = await Promise.all([
    supabase.from("businesses").select("type,name").eq("id", businessId).single(),
    getBusinessPlan(businessId),
  ]);
  const business = rawBusiness as { type: import("@/types/database").BusinessType; name: string } | null;

  const businessType = (business?.type ?? "other_service_business") as BusinessType;
  const config = getBusinessConfig(businessType);

  // Fetch customer (scoped to business for security)
  const { data: rawCustomer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();
  const customer = rawCustomer as import("@/types/database").Customer | null;

  if (error || !customer) {
    notFound();
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto bg-bg min-h-screen">
      {/* Breadcrumb / back */}
      <nav className="flex items-center gap-2 text-sm text-ink-3">
        <Link
          href="/dashboard/customers"
          className="hover:text-ink transition-colors"
        >
          {config.customerLabel}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-ink-2 truncate max-w-xs">
          {customer!.full_name}
        </span>
      </nav>

      {/* Profile */}
      <CustomerProfile customer={customer!} businessType={businessType} plan={plan} businessName={business?.name ?? ""} />

    </div>
  );
}
