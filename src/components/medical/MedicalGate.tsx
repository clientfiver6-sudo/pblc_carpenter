import { getBusinessId } from "@/lib/auth/actions"
import { getBusinessPlan } from "@/lib/auth/plan"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Stethoscope, Check } from "lucide-react"

const MEDICAL_FEATURES = [
  "Tudo do Pro",
  "Prontuários SOAP com IA",
  "Anamnese do paciente",
  "Prescrições digitais",
  "Pedidos de exames",
  "Controle de convênios",
]

interface MedicalGateProps {
  children: React.ReactNode
}

export async function MedicalGate({ children }: MedicalGateProps) {
  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")
  const plan = await getBusinessPlan(businessId)
  if (plan === "medical") return <>{children}</>

  return (
    <div className="min-h-screen bg-bg flex items-start justify-center pt-16 pb-28 px-4">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-3">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-2"
            style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)" }}
          >
            <Stethoscope className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Módulo Médico
          </h1>
          <p className="text-sm text-ink-3 max-w-sm mx-auto">
            Prontuários eletrônicos, gravação de consultas, receituários e pedidos de exame — exclusivo do plano Medical.
          </p>
        </div>

        <div className="rounded-xl border-2 border-info bg-info/5 p-6 text-left space-y-4">
          <div>
            <p className="text-xs font-semibold text-info uppercase tracking-wide mb-1">Plano Medical</p>
            <p className="text-2xl font-bold text-ink">
              R$249,90<span className="text-sm font-normal text-ink-3">/mês</span>
            </p>
          </div>
          <ul className="space-y-2">
            {MEDICAL_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-ink">
                <Check className="w-4 h-4 text-info shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Link
            href="/dashboard/settings/subscription"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)" }}
          >
            Fazer upgrade para Medical
          </Link>
          <p className="text-xs text-ink-4 mt-3">Cancele quando quiser. Sem taxa de adesão.</p>
        </div>
      </div>
    </div>
  )
}
