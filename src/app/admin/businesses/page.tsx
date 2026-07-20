import { createAdminClient } from "@/lib/supabase/admin"
import { BusinessesTable, type BizRow } from "./BusinessesTable"

export const dynamic = "force-dynamic"

export default async function AdminBusinessesPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from("businesses")
    .select("id,name,type,city,state,onboarded,whatsapp_connected_at,mercadopago_access_token,subscription_plan,subscription_status,created_at")
    .order("created_at", { ascending: false })

  const businesses = (data ?? []) as BizRow[]

  return (
    <div className="p-8 max-w-7xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-3 mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Empresas</h1>
        </div>
        <p className="text-sm text-ink-4">{businesses.length} registros</p>
      </div>

      <BusinessesTable businesses={businesses} />
    </div>
  )
}
