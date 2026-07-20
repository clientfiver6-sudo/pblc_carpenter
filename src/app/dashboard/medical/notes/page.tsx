import { redirect } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBusinessId } from "@/lib/auth/actions"
import { SOAPNote } from "@/components/medical/SOAPNote"
import type { MedicalNote } from "@/components/medical/SOAPNote"

export const dynamic = "force-dynamic"

export default async function MedicalNotesPage() {
  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")

  const admin = createAdminClient()
  const { data } = await admin
    .from("medical_notes" as never)
    .select("id,customer_id,subjective,objective,assessment,plan_text,transcript,audio_url,created_at,customers(full_name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(100)

  const notes = (data ?? []) as MedicalNote[]

  // Group by customer
  const grouped = notes.reduce<Record<string, { name: string; notes: MedicalNote[] }>>((acc, n) => {
    const cid = n.customer_id
    if (!acc[cid]) acc[cid] = { name: n.customers?.full_name ?? "Paciente", notes: [] }
    acc[cid].notes.push(n)
    return acc
  }, {})

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Notas SOAP</h1>
        <p className="text-sm text-ink-3 mt-0.5">{notes.length} nota{notes.length !== 1 ? "s" : ""} no total</p>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-16 text-ink-3">
          <p className="text-sm">Nenhuma nota de consulta registrada ainda.</p>
          <p className="text-xs mt-1">Use o Gravador de Consulta no perfil do paciente para criar a primeira.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([, { name, notes: pNotes }]) => (
            <div key={name} className="space-y-3">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">{name}</p>
              <div className="space-y-2">
                {pNotes.map(n => <SOAPNote key={n.id} note={n} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
