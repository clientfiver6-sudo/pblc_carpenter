import { createAdminClient } from "@/lib/supabase/admin"
import { SubscriptionsTable, type SubRow } from "./SubscriptionsTable"
import { CreditCard, TrendingUp, AlertCircle, XCircle, Stethoscope } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminSubscriptionsPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from("businesses")
    .select("id,name,city,state,subscription_plan,subscription_status,subscription_ends_at,created_at")
    .order("created_at", { ascending: false })

  const businesses = (data ?? []) as SubRow[]

  const active    = businesses.filter(b => b.subscription_status === "active")
  const trialing  = businesses.filter(b => b.subscription_status === "trialing")
  const pastDue   = businesses.filter(b => b.subscription_status === "past_due")
  const cancelled = businesses.filter(b => b.subscription_status === "cancelled")
  const pro       = businesses.filter(b => b.subscription_plan === "pro"     && b.subscription_status !== "cancelled")
  const medical   = businesses.filter(b => b.subscription_plan === "medical" && b.subscription_status !== "cancelled")

  const total = businesses.length

  return (
    <div className="p-8 max-w-6xl space-y-8">

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-3 mb-1">Admin</p>
        <h1 className="text-2xl font-bold text-ink tracking-tight">Assinaturas</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Ativas",     value: active.length,    icon: CreditCard,    color: "text-moss",    bg: "bg-moss/8" },
          { label: "Pro",        value: pro.length,       icon: TrendingUp,    color: "text-brand",   bg: "bg-brand/8" },
          { label: "Medical",    value: medical.length,   icon: Stethoscope,   color: "text-info",    bg: "bg-info/8" },
          { label: "Vencidas",   value: pastDue.length,   icon: AlertCircle,   color: "text-warning", bg: "bg-warning/8" },
          { label: "Canceladas", value: cancelled.length, icon: XCircle,       color: "text-danger",  bg: "bg-danger/8" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-3">{label}</span>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Plan split bar */}
      {total > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-ink">Distribuição de planos</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {pro.length > 0 && (
              <div
                style={{ width: `${(pro.length / total) * 100}%`, background: "var(--brand)" }}
                title={`Pro: ${pro.length}`}
              />
            )}
            {medical.length > 0 && (
              <div
                className="bg-info"
                style={{ width: `${(medical.length / total) * 100}%` }}
                title={`Medical: ${medical.length}`}
              />
            )}
            {(total - pro.length - medical.length) > 0 && (
              <div className="flex-1 bg-surface-2" title={`Starter: ${total - pro.length - medical.length}`} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-ink-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--brand)" }} />
              Pro — {pro.length} ({total > 0 ? Math.round((pro.length / total) * 100) : 0}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-info" />
              Medical — {medical.length} ({total > 0 ? Math.round((medical.length / total) * 100) : 0}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-surface-2 border border-border" />
              Starter — {total - pro.length - medical.length} ({total > 0 ? Math.round(((total - pro.length - medical.length) / total) * 100) : 0}%)
            </span>
            {trialing.length > 0 && (
              <span className="flex items-center gap-1.5 text-info">
                <span className="w-2 h-2 rounded-full bg-info/40" />
                Em trial — {trialing.length}
              </span>
            )}
          </div>
        </div>
      )}

      <SubscriptionsTable businesses={businesses} />
    </div>
  )
}
