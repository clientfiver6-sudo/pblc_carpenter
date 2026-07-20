import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getBusinessId } from "@/lib/auth/actions"
import { EditAutomationForm } from "@/components/automations/EditAutomationForm"
import type { Automation } from "@/types/database"

export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")

  const supabase = await createClient()

  const { data: rawAutomation } = await supabase
    .from("automations")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .single()

  const automation = rawAutomation as Automation | null
  if (!automation) notFound()

  return <EditAutomationForm automation={automation} />
}
