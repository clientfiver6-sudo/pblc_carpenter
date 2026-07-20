import { UpgradeGate } from "@/components/layout/UpgradeGate"
import { ApprovalsClient } from "./ApprovalsClient"

export default function ApprovalsPage() {
  return (
    <UpgradeGate>
      <ApprovalsClient />
    </UpgradeGate>
  )
}
