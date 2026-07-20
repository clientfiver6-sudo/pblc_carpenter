import { redirect } from "next/navigation"
import Link from "next/link"
import { Stethoscope, User, ChevronRight } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBusinessId } from "@/lib/auth/actions"
import { getBusinessPlan } from "@/lib/auth/plan"
import { Card, CardContent } from "@/components/ui/card"
import type { SupabaseClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export default async function MedicalHubPage() {
  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")

  const plan = await getBusinessPlan(businessId)
  if (plan !== "medical") redirect("/dashboard")

  const supabase = await createClient()
  const admin = createAdminClient() as unknown as SupabaseClient

  // Customers who have at least one medical note, plus their note count and last visit
  const { data: rawNotes } = await admin
    .from("medical_notes" as never)
    .select("customer_id, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })

  const notes = (rawNotes ?? []) as { customer_id: string; created_at: string }[]

  // Unique customer IDs ordered by most recent note
  const seen = new Set<string>()
  const orderedCustomerIds: string[] = []
  const countByCustomer: Record<string, number> = {}
  const lastVisitByCustomer: Record<string, string> = {}

  for (const n of notes) {
    countByCustomer[n.customer_id] = (countByCustomer[n.customer_id] ?? 0) + 1
    if (!seen.has(n.customer_id)) {
      seen.add(n.customer_id)
      orderedCustomerIds.push(n.customer_id)
      lastVisitByCustomer[n.customer_id] = n.created_at
    }
  }

  // Fetch customer names
  const { data: rawCustomers } = await supabase
    .from("customers").select("id,full_name,phone_number")
    .eq("business_id", businessId).in("id", orderedCustomerIds.length > 0 ? orderedCustomerIds : ["00000000-0000-0000-0000-000000000000"])

  const customerMap = new Map((rawCustomers ?? []).map((c: { id: string; full_name: string; phone_number: string | null }) => [c.id, c]))

  // Also get all active customers (for search / quick access)
  const { data: allCustomers } = await supabase
    .from("customers").select("id,full_name,phone_number")
    .eq("business_id", businessId).eq("status", "active")
    .order("full_name").limit(50)

  const allC = (allCustomers ?? []) as { id: string; full_name: string; phone_number: string | null }[]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-grad)" }}>
          <Stethoscope className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink">Medical Hub</h1>
          <p className="text-xs text-ink-3">Prontuários eletrônicos dos seus pacientes</p>
        </div>
      </div>

      {orderedCustomerIds.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-2">Consultas recentes</h2>
          <Card className="bg-surface border border-border shadow-1">
            <CardContent className="p-0">
              {orderedCustomerIds.slice(0, 10).map((cid, i) => {
                const c = customerMap.get(cid)
                if (!c) return null
                return (
                  <Link key={cid} href={`/dashboard/medical/${cid}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors border-b border-border last:border-0">
                    <div className="w-8 h-8 rounded-full bg-tint border border-brand/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{c.full_name}</p>
                      <p className="text-xs text-ink-3">
                        {countByCustomer[cid]} consulta{countByCustomer[cid] !== 1 ? "s" : ""} · última em{" "}
                        {new Date(lastVisitByCustomer[cid]).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-ink-4 shrink-0" />
                  </Link>
                )
              })}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-2">Todos os pacientes</h2>
        {allC.length === 0 ? (
          <Card className="bg-surface border border-border shadow-1">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Stethoscope className="w-10 h-10 text-ink-4" />
              <p className="text-ink-3 text-sm">Nenhum paciente cadastrado</p>
              <Link href="/dashboard/customers/new" className="text-brand text-sm hover:underline">Adicionar paciente</Link>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-surface border border-border shadow-1">
            <CardContent className="p-0">
              {allC.map(c => (
                <Link key={c.id} href={`/dashboard/medical/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors border-b border-border last:border-0">
                  <div className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-ink-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{c.full_name}</p>
                    {c.phone_number && <p className="text-xs text-ink-3">{c.phone_number}</p>}
                  </div>
                  <span className="text-xs text-ink-4 shrink-0">Ver prontuário</span>
                  <ChevronRight className="w-4 h-4 text-ink-4 shrink-0" />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
