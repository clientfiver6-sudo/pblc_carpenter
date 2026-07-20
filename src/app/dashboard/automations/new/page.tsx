import { redirect } from "next/navigation"
import { getBusinessId } from "@/lib/auth/actions"
import { NewAutomationPageClient } from "@/components/automations/NewAutomationPageClient"

export default async function NewAutomationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")

  const resolved = await searchParams
  const initialTrigger = typeof resolved.trigger === "string" ? resolved.trigger : undefined

  return <NewAutomationPageClient businessId={businessId} initialTrigger={initialTrigger} />
}
