import { createAdminClient } from "@/lib/supabase/admin"
import { getPlatformConfig } from "@/lib/platform-config"

export const dynamic = "force-dynamic"

import { CheckCircle2, XCircle, DollarSign, TrendingUp, Users, Repeat } from "lucide-react"
import { CopyButton, CreatePlansButton, TokenInputForm } from "./SetupActions"

const PLAN_PRICES = { pro: 199.90, starter: 149.90, medical: 249.90 } as const

function fmtBRL(amount: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
}

type BizRow = {
  id: string
  subscription_plan: string
  subscription_status: string
  created_at: string
}

export default async function AdminFinancialPage() {
  const admin = createAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [{ data }, accessToken, starterPlanId, proPlanId, medicalPlanId] = await Promise.all([
    admin.from("businesses").select("id,subscription_plan,subscription_status,created_at"),
    getPlatformConfig("mercadopago_platform_access_token"),
    getPlatformConfig("mercadopago_starter_plan_id"),
    getPlatformConfig("mercadopago_pro_plan_id"),
    getPlatformConfig("mercadopago_medical_plan_id"),
  ])

  const businesses = (data ?? []) as BizRow[]

  const activePro          = businesses.filter(b => b.subscription_plan === "pro"     && b.subscription_status === "active")
  const activeStarter      = businesses.filter(b => b.subscription_plan === "starter" && b.subscription_status === "active")
  const activeMedical      = businesses.filter(b => b.subscription_plan === "medical"  && b.subscription_status === "active")
  const trialing           = businesses.filter(b => b.subscription_status === "trialing")
  const pastDue            = businesses.filter(b => b.subscription_status === "past_due")
  const cancelledThisMonth = businesses.filter(b => b.subscription_status === "cancelled" && b.created_at >= thirtyDaysAgo)

  const mrr         = activePro.length * PLAN_PRICES.pro + activeStarter.length * PLAN_PRICES.starter + activeMedical.length * PLAN_PRICES.medical
  const arr         = mrr * 12
  const activeTotal = activePro.length + activeStarter.length + activeMedical.length
  const arpu        = activeTotal > 0 ? mrr / activeTotal : 0
  const potentialMrr = trialing.length * PLAN_PRICES.starter

  const hasToken        = !!accessToken
  const plansConfigured = !!starterPlanId && !!proPlanId && !!medicalPlanId
  const allConfigured   = hasToken && plansConfigured

  return (
    <div className="p-8 max-w-5xl space-y-8">

      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-3 mb-1">Admin</p>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Financeiro</h1>
      </div>

      {/* MRR cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "MRR",               value: fmtBRL(mrr),         icon: DollarSign, color: "text-moss",    bg: "bg-moss/8",    sub: "receita mensal recorrente" },
          { label: "ARR",               value: fmtBRL(arr),         icon: TrendingUp, color: "text-brand",   bg: "bg-brand/8",   sub: "projeção anual" },
          { label: "Assinantes ativos", value: String(activeTotal),  icon: Users,      color: "text-info",    bg: "bg-info/8",    sub: `${activePro.length} Pro · ${activeStarter.length} Starter · ${activeMedical.length} Medical` },
          { label: "ARPU",              value: fmtBRL(arpu),         icon: Repeat,     color: "text-warning", bg: "bg-warning/8", sub: "receita média por cliente" },
        ].map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-3">{label}</span>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-[11px] text-ink-4">{sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue breakdown + quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Plan breakdown */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <p className="text-sm font-semibold text-ink">Receita por plano</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--brand)" }} />
                <span className="text-sm text-ink-2">Pro — {activePro.length} empresa{activePro.length !== 1 ? "s" : ""}</span>
              </div>
              <span className="font-mono text-sm font-semibold text-ink">{fmtBRL(activePro.length * PLAN_PRICES.pro)}<span className="text-ink-4 font-normal">/mês</span></span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-ink-4" />
                <span className="text-sm text-ink-2">Starter — {activeStarter.length} empresa{activeStarter.length !== 1 ? "s" : ""}</span>
              </div>
              <span className="font-mono text-sm font-semibold text-ink">{fmtBRL(activeStarter.length * PLAN_PRICES.starter)}<span className="text-ink-4 font-normal">/mês</span></span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-info" />
                <span className="text-sm text-ink-2">Medical — {activeMedical.length} empresa{activeMedical.length !== 1 ? "s" : ""}</span>
              </div>
              <span className="font-mono text-sm font-semibold text-ink">{fmtBRL(activeMedical.length * PLAN_PRICES.medical)}<span className="text-ink-4 font-normal">/mês</span></span>
            </div>
            <div className="border-t border-border pt-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-3 uppercase tracking-wide">MRR Total</span>
              <span className="font-mono text-lg font-bold text-ink">{fmtBRL(mrr)}<span className="text-ink-4 text-sm font-normal">/mês</span></span>
            </div>
          </div>
          {trialing.length > 0 && (
            <div className="rounded-lg bg-info/5 border border-info/20 px-3 py-2.5 text-xs text-info">
              <span className="font-semibold">{trialing.length} em trial</span> — potencial de {fmtBRL(potentialMrr)}/mês se converterem
            </div>
          )}
          {pastDue.length > 0 && (
            <div className="rounded-lg bg-warning/5 border border-warning/20 px-3 py-2.5 text-xs text-warning">
              <span className="font-semibold">{pastDue.length} com pagamento vencido</span>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-1">
          <p className="text-sm font-semibold text-ink mb-3">Visão rápida</p>
          {[
            {
              label: "Conversão trial → pago",
              value: activeTotal + trialing.length === 0 ? "—"
                : trialing.length === 0 ? "100%"
                : `${Math.round((activeTotal / (activeTotal + trialing.length)) * 100)}%`,
            },
            { label: "Churn este mês",     value: `${cancelledThisMonth.length} empresa${cancelledThisMonth.length !== 1 ? "s" : ""}` },
            { label: "Pagamentos vencidos", value: `${pastDue.length} empresa${pastDue.length !== 1 ? "s" : ""}` },
            { label: "Ticket médio mensal", value: fmtBRL(arpu) },
            { label: "Mix Pro / Starter",   value: activeTotal > 0 ? `${Math.round((activePro.length / activeTotal) * 100)}% / ${Math.round((activeStarter.length / activeTotal) * 100)}%` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
              <span className="text-xs text-ink-3">{label}</span>
              <span className="text-sm font-semibold text-ink tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mercado Pago setup */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Mercado Pago</p>
            <p className="text-xs text-ink-3 mt-0.5">Conta de recebimento + planos de assinatura</p>
          </div>
          {allConfigured ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-moss bg-moss/8 border border-moss/20 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-warning bg-warning/8 border border-warning/20 px-3 py-1 rounded-full">
              <XCircle className="w-3.5 h-3.5" /> Pendente
            </span>
          )}
        </div>

        <div className="p-5 space-y-6">

          {/* Step 1 — Access Token */}
          <div className="flex items-start gap-4">
            <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5 ${hasToken ? "bg-moss/15 text-moss" : "bg-surface-2 text-ink-4 border border-border"}`}>
              {hasToken ? <CheckCircle2 className="w-4 h-4" /> : "1"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink mb-0.5">Access Token de produção</p>
              <p className="text-xs text-ink-3 leading-relaxed mb-3">
                Em <span className="font-medium text-ink">mercadopago.com.br → Desenvolvedores → Credenciais de produção</span>, copie o Access Token e cole abaixo.
              </p>
              {hasToken ? (
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-moss">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Token configurado
                  </span>
                  <p className="text-[11px] text-ink-4">Para atualizar, cole o novo token e salve.</p>
                  <TokenInputForm />
                </div>
              ) : (
                <TokenInputForm />
              )}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Step 2 — Create plans */}
          <div className="flex items-start gap-4">
            <div className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5 ${plansConfigured ? "bg-moss/15 text-moss" : "bg-surface-2 text-ink-4 border border-border"}`}>
              {plansConfigured ? <CheckCircle2 className="w-4 h-4" /> : "2"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink mb-0.5">Criar planos de assinatura</p>
              <p className="text-xs text-ink-3 mb-3">
                Cria automaticamente os planos Starter (R$149,90/mês), Pro (R$199,90/mês) e Medical (R$249,90/mês) na sua conta MP e salva os IDs no banco de dados.
              </p>

              {plansConfigured ? (
                <div className="space-y-2">
                  {[
                    { label: "Starter Plan ID", value: starterPlanId! },
                    { label: "Pro Plan ID",     value: proPlanId! },
                    { label: "Medical Plan ID", value: medicalPlanId! },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[11px] text-ink-3">{label}</p>
                        <p className="font-mono text-xs text-ink truncate">{value}</p>
                      </div>
                      <CopyButton text={value} />
                    </div>
                  ))}
                </div>
              ) : (
                <CreatePlansButton />
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
