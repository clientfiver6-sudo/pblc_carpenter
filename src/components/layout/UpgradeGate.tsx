import { getBusinessId } from "@/lib/auth/actions";
import { getBusinessPlan, hasPlanAccess } from "@/lib/auth/plan";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";

const STARTER_FEATURES = [
  "Clientes e CRM",
  "Agenda e chamados",
  "Conversas + WhatsApp IA",
  "Pagamentos e cobranças",
  "Equipe e serviços",
];

const PRO_FEATURES = [
  "Tudo do Starter",
  "Automações",
  "Personalize sua IA como quiser",
  "Analytics completo",
  "Gráficos com IA",
  "Aprovações da IA",
  "Assistente RetornAI",
];

interface UpgradeGateProps {
  children: React.ReactNode;
  requiredPlan?: "pro" | "medical";
}

export async function UpgradeGate({ children, requiredPlan = "pro" }: UpgradeGateProps) {
  const businessId = await getBusinessId();
  if (!businessId) redirect("/login");

  const plan = await getBusinessPlan(businessId);

  if (hasPlanAccess(plan, requiredPlan)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-bg flex items-start justify-center pt-16 pb-28 px-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 text-xl"
            style={{ background: "var(--brand-grad)" }}
          >
            ✦
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Funcionalidade exclusiva do plano Pro
          </h1>
          <p className="text-sm text-ink-3 max-w-sm mx-auto">
            Faça upgrade para desbloquear esta e todas as outras funcionalidades avançadas do RetornAI.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4">
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide mb-1">Plano atual</p>
              <p className="text-xl font-bold text-ink">Starter</p>
              <p className="text-2xl font-bold text-ink mt-1">
                R$149,90<span className="text-sm font-normal text-ink-3">/mês</span>
              </p>
            </div>
            <ul className="space-y-2">
              {STARTER_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-3">
                  <Check className="w-4 h-4 text-moss shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border-2 border-brand bg-tint/30 p-5 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-brand text-white uppercase tracking-wide">
                Recomendado
              </span>
            </div>
            <div className="mb-4">
              <p className="text-xs font-semibold text-brand uppercase tracking-wide mb-1">Upgrade para</p>
              <p className="text-xl font-bold text-ink">Pro</p>
              <p className="text-2xl font-bold text-ink mt-1">
                R$199,90<span className="text-sm font-normal text-ink-3">/mês</span>
              </p>
            </div>
            <ul className="space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink">
                  <Check className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/dashboard/settings/subscription"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--brand-grad)" }}
          >
            Fazer upgrade para Pro
          </Link>
          <p className="text-xs text-ink-4 mt-3">Cancele quando quiser. Sem taxa de adesão.</p>
        </div>
      </div>
    </div>
  );
}
