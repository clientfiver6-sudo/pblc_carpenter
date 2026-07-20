import { getBusinessId } from "@/lib/auth/actions"
import { redirect } from "next/navigation"
import { ImportWizardSettingsWrapper } from "@/components/onboarding/ImportWizardSettingsWrapper"

export default async function ImportPage() {
  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink tracking-tight">Importar dados</h1>
        <p className="text-ink-2 text-sm mt-1">
          Traga seus clientes, histórico e serviços de outros sistemas.
        </p>
      </div>
      <ImportWizardSettingsWrapper businessId={businessId} />
    </div>
  )
}
