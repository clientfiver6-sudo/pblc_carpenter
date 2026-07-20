"use client"
import { useRouter } from "next/navigation"
import { ImportWizard } from "./ImportWizard"

export function ImportWizardSettingsWrapper({ businessId }: { businessId: string }) {
  const router = useRouter()
  return (
    <ImportWizard
      businessId={businessId}
      onComplete={() => router.push("/dashboard")}
      onSkip={() => router.push("/dashboard/settings")}
    />
  )
}
