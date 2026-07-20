import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/auth/cached";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { getBusinessPlan } from "@/lib/auth/plan";
import type { Business, BusinessUser } from "@/types/database";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) return redirect("/login");
  if (user.app_metadata?.is_admin) return redirect("/admin");

  const { data: rawBusinessUser } = await supabase
    .from("business_users")
    .select("business_id, role")
    .eq("user_id", user.id)
    .single();
  const businessUser = rawBusinessUser as BusinessUser | null;
  if (!businessUser) return redirect("/onboarding");

  const [{ data: rawBusiness }, plan, { data: unreadData }] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", businessUser.business_id).single(),
    getBusinessPlan(businessUser.business_id),
    supabase.from("conversations").select("unread_count")
      .eq("business_id", businessUser.business_id).gt("unread_count", 0),
  ]);

  const business = rawBusiness as Business | null;
  if (!business) return redirect("/onboarding");

  const unreadConversations = (unreadData ?? []).reduce(
    (sum, row) => sum + ((row as { unread_count: number }).unread_count ?? 0),
    0
  );

  return (
    <DashboardShell
      business={business}
      businessUser={businessUser}
      onboarded={business.onboarded}
      plan={plan}
      subscriptionStatus={business.subscription_status ?? "trialing"}
      unreadConversations={unreadConversations}
    >
      {children}
    </DashboardShell>
  );
}
