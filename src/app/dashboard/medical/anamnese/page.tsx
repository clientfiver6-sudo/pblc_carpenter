import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBusinessId } from "@/lib/auth/actions"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { formatDate } from "@/lib/utils"

export const dynamic = "force-dynamic"

type AnamRow = {
  id: string
  customer_id: string
  queixas_principais?: string | null
  historico_medico?: string | null
  alergias?: string | null
  medicamentos_em_uso?: string | null
  antecedentes_familiares?: string | null
  habitos_vicios?: string | null
  created_at: string
  customers?: { full_name: string; id: string } | null
}

const SECTION_LABELS: Partial<Record<keyof AnamRow, string>> = {
  queixas_principais: "Queixas",
  historico_medico: "Histórico",
  alergias: "Alergias",
  medicamentos_em_uso: "Medicamentos",
  antecedentes_familiares: "Antecedentes",
  habitos_vicios: "Hábitos",
}

export default async function AnamnesePage() {
  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")

  const admin = createAdminClient()
  const { data } = await admin
    .from("anamnese" as never)
    .select("id,customer_id,queixas_principais,historico_medico,alergias,medicamentos_em_uso,antecedentes_familiares,habitos_vicios,created_at,customers(id,full_name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100)

  const rows = (data ?? []) as AnamRow[]

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Anamneses</h1>
        <p className="text-sm text-ink-3 mt-0.5">{rows.length} registro{rows.length !== 1 ? "s" : ""}</p>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-ink-3">
          <p className="text-sm">Nenhuma anamnese registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="rounded-xl border border-border bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">{row.customers?.full_name ?? "Paciente"}</p>
                  <p className="text-xs text-ink-3 font-mono mt-0.5">{formatDate(row.created_at)}</p>
                </div>
                {row.customers?.id && (
                  <Link
                    href={`/dashboard/customers/${row.customers.id}`}
                    className="flex items-center gap-1 text-xs text-brand hover:text-brand-2 transition-colors"
                  >
                    Perfil <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SECTION_LABELS) as Array<keyof AnamRow>)
                  .filter(k => row[k])
                  .map(k => (
                    <div key={k} className="space-y-0.5">
                      <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide">{SECTION_LABELS[k]}</p>
                      <p className="text-xs text-ink-2 line-clamp-2">{row[k] as string}</p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
