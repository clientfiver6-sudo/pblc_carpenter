import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OnboardingWizard } from "./OnboardingWizard"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect("/login")

  // Already has a business → go to dashboard
  const { data: businessUser } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (businessUser) return redirect("/dashboard")

  return <OnboardingWizard />
}
