import { createAdminClient } from "@/lib/supabase/admin";

export type Plan = "starter" | "pro" | "medical";

export function hasPlanAccess(userPlan: Plan, required: "pro" | "medical"): boolean {
  if (required === "pro") return userPlan === "pro" || userPlan === "medical";
  return userPlan === "medical";
}

export async function getBusinessPlan(businessId: string): Promise<Plan> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("businesses")
    .select("subscription_plan, subscription_status")
    .eq("id", businessId)
    .single();

  if (!data) return "starter";

  const biz = data as unknown as { subscription_plan: string; subscription_status: string };

  const isAccessible = biz.subscription_status === "active" || biz.subscription_status === "trialing";
  if (!isAccessible) return "starter";

  if (biz.subscription_plan === "medical") return "medical";
  return biz.subscription_plan === "pro" ? "pro" : "starter";
}
