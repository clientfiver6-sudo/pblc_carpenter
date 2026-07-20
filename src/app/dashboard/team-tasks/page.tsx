import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getTeamPageData } from "@/lib/team/actions"
import { TeamTasksClient } from "@/components/team/TeamTasksClient"
import { UpgradeGate } from "@/components/layout/UpgradeGate"

export default async function TeamTasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { staff, unassignedItems } = await getTeamPageData()

  return (
    <UpgradeGate>
      <div className="h-[calc(100vh-56px)] flex flex-col">
        <TeamTasksClient staff={staff} unassignedItems={unassignedItems} userId={user.id} />
      </div>
    </UpgradeGate>
  )
}
