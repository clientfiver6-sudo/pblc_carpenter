import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { SetupWizard } from "./SetupWizard"
import type { Business } from "@/types/database"

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .maybeSingle()
  const bu = rawBu as { business_id: string } | null
  if (!bu) return redirect("/login")

  const admin = createAdminClient()
  const { data: rawBiz } = await admin
    .from("businesses")
    .select("*")
    .eq("id", bu.business_id)
    .single()
  const business = rawBiz as Business | null
  if (!business) return redirect("/login")

  if (business.onboarded) return redirect("/dashboard")

  const userName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? ""

  return <SetupWizard businessId={business.id} userName={userName} currentName="" />
}
