import { getBusinessId } from "@/lib/auth/actions";
import { getBusinessPlan } from "@/lib/auth/plan";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";

const MEDICAL_FEATURES = [
  "Tudo do Pro",
  "Consultas SOAP com IA",
  "Anamnese do paciente",
  "Prescrições digitais",
  "Pedidos de exames",
  "Controle de convênios",
];

interface MedicalGateProps {
  children: React.ReactNode;
}

export async function MedicalGate({ children }: MedicalGateProps) {
  const businessId = await getBusinessId();
  if (!businessId) redirect("/login");

  const plan = await getBusinessPlan(businessId);

  if (plan === "medical") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-bg flex items-start justify-center pt-16 pb-28 px-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 text-2xl"
            style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)" }}
          >
            🩺
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Funcionalidade exclusiva do plano Medical
          </h1>
          <p className="text-sm text-ink-3 max-w-sm mx-auto">
            Faça upgrade para o plano Medical e desbloqueie ferramentas criadas especialmente para clínicas e profissionais de saúde.
          </p>
        </div>

        <div className="rounded-xl border-2 border-info bg-info/5 p-6 relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-info text-white uppercase tracking-wide">
              Plano Medical
            </span>
          </div>
          <div className="mb-5 text-center">
            <p className="text-2xl font-bold text-ink mt-1">
              R$249,90<span className="text-sm font-normal text-ink-3">/mês</span>
            </p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MEDICAL_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-ink">
                <Check className="w-4 h-4 text-info shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center">
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
  );
}
