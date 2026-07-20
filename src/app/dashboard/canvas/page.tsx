import { UpgradeGate } from "@/components/layout/UpgradeGate"
import { CanvasClient } from "./CanvasClient"

export default function CanvasPage() {
  return (
    <UpgradeGate>
      <CanvasClient />
    </UpgradeGate>
  )
}
