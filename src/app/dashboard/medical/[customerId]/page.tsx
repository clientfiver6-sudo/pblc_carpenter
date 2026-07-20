import { redirect } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, Stethoscope } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBusinessId } from "@/lib/auth/actions"
import { getBusinessPlan } from "@/lib/auth/plan"
import { MedicalRecord } from "@/components/medical/MedicalRecord"
import type { MedicalNote, Anamnese, Prescription, ExamRequest } from "@/types/database"
import type { SupabaseClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

async function fetchMedical(db: SupabaseClient, table: string, businessId: string, customerId: string) {
  const { data } = await db.from(table as never).select("*")
    .eq("business_id", businessId).eq("customer_id", customerId)
    .order("created_at", { ascending: false })
  return (data ?? []) as never[]
}

export default async function PatientMedicalPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params
  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")

  const plan = await getBusinessPlan(businessId)
  if (plan !== "medical") redirect("/dashboard")

  const supabase = await createClient()
  const admin = createAdminClient() as unknown as SupabaseClient

  const { data: rawCustomer } = await supabase
    .from("customers").select("id,full_name")
    .eq("id", customerId).eq("business_id", businessId).single()

  if (!rawCustomer) redirect("/dashboard/medical")
  const customer = rawCustomer as { id: string; full_name: string }

  const [notes, anamnese, prescriptions, exams] = await Promise.all([
    fetchMedical(admin, "medical_notes", businessId, customerId),
    fetchMedical(admin, "anamnese", businessId, customerId),
    fetchMedical(admin, "prescriptions", businessId, customerId),
    fetchMedical(admin, "exam_requests", businessId, customerId),
  ])

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/medical" className="text-ink-3 hover:text-ink transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <p className="text-xs text-ink-3 font-medium flex items-center gap-1.5">
            <Stethoscope className="w-3.5 h-3.5" /> Prontuário
          </p>
          <h1 className="text-xl font-bold text-ink">{customer.full_name}</h1>
        </div>
      </div>

      <MedicalRecord
        customerId={customerId}
        customerName={customer.full_name}
        initialNotes={notes as MedicalNote[]}
        initialAnamnese={anamnese as Anamnese[]}
        initialPrescriptions={prescriptions as Prescription[]}
        initialExams={exams as ExamRequest[]}
      />
    </div>
  )
}
