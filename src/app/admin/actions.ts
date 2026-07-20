"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { logAuditEvent } from "@/lib/audit"
import { revalidatePath } from "next/cache"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.app_metadata?.is_admin) throw new Error("Forbidden")
  return user
}

export async function approveBusiness(id: string) {
  const user = await requireAdmin()
  const admin = createAdminClient()
  await admin.from("businesses").update({ onboarded: true } as never).eq("id", id)
  void logAuditEvent({ userId: user.id, action: "admin.business_approved" as never, resourceType: "business", resourceId: id })
  revalidatePath("/admin/businesses")
  revalidatePath("/admin")
}

export async function suspendBusiness(id: string) {
  const user = await requireAdmin()
  const admin = createAdminClient()
  await admin.from("businesses").update({ onboarded: false } as never).eq("id", id)
  void logAuditEvent({ userId: user.id, action: "admin.business_suspended" as never, resourceType: "business", resourceId: id })
  revalidatePath("/admin/businesses")
  revalidatePath("/admin")
}

export async function setBusinessPlan(id: string, plan: "starter" | "pro" | "medical") {
  const user = await requireAdmin()
  const admin = createAdminClient()
  await admin
    .from("businesses")
    .update({ subscription_plan: plan, subscription_status: "active" } as never)
    .eq("id", id)
  void logAuditEvent({ userId: user.id, action: "admin.plan_changed" as never, resourceType: "business", resourceId: id, newValues: { plan } })
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin")
}

export async function setSubscriptionStatus(id: string, status: "active" | "cancelled" | "trialing") {
  const user = await requireAdmin()
  const admin = createAdminClient()
  await admin
    .from("businesses")
    .update({ subscription_status: status } as never)
    .eq("id", id)
  void logAuditEvent({ userId: user.id, action: "admin.subscription_status_changed" as never, resourceType: "business", resourceId: id, newValues: { status } })
  revalidatePath("/admin/subscriptions")
  revalidatePath("/admin")
}
