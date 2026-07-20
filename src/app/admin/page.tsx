import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic"
import Link from "next/link";
import {
  Building2, Users, MessageCircle, DollarSign,
  ArrowUpRight, Wifi, WifiOff, TrendingUp,
} from "lucide-react";

function fmtCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function fmtType(t: string) {
  const map: Record<string, string> = {
    ac_residential: "Ar-condicionado",
    ac_commercial: "Climatização",
    refrigeration: "Refrigeração",
    electrician: "Elétrica",
    plumber: "Hidráulica",
    locksmith: "Serralheria",
    cleaning: "Limpeza",
    pest_control: "Dedetização",
    other_service_business: "Outro",
    clinic: "Clínica",
    dental_clinic: "Odonto",
    aesthetic_clinic: "Estética",
    veterinary_clinic: "Veterinária",
    beauty_salon: "Salão",
    auto_repair: "Auto",
    bike_shop: "Bicicletas",
    retail_store: "Varejo",
    repair_shop: "Consertos",
  };
  return map[t] ?? t;
}

function PlanBadge({ plan, status }: { plan: string; status: string }) {
  const isPro = plan === "pro";
  const isActive = status === "active" || status === "trialing";
  if (!isActive) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-2 text-ink-4 border border-border">
        {status === "cancelled" ? "cancelado" : "vencido"}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
        isPro
          ? "bg-brand/8 text-brand border-brand/20"
          : "bg-surface-2 text-ink-3 border-border"
      }`}
    >
      {isPro ? "Pro" : "Starter"}
    </span>
  );
}

type BizRow = {
  id: string; name: string; type: string;
  city: string | null; state: string | null;
  whatsapp_connected_at: string | null;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
};

export default async function AdminPage() {
  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [bizRes, custRes, convRes, payRes, allBizRes] = await Promise.all([
    admin.from("businesses").select("id", { count: "exact", head: true }),
    admin.from("customers").select("id", { count: "exact", head: true }),
    admin.from("conversations").select("id", { count: "exact", head: true }),
    admin.from("payments").select("amount").eq("status", "paid"),
    admin.from("businesses")
      .select("id,name,type,city,state,whatsapp_connected_at,subscription_plan,subscription_status,created_at")
      .order("created_at", { ascending: false }),
  ]);

  const allBiz = (allBizRes.data ?? []) as BizRow[];
  const totalRevenue = ((payRes.data ?? []) as { amount: number }[]).reduce((s, p) => s + (p.amount ?? 0), 0);

  const proCount = allBiz.filter(b => b.subscription_plan === "pro" && (b.subscription_status === "active" || b.subscription_status === "trialing")).length;
  const starterCount = allBiz.filter(b => b.subscription_plan === "starter" && b.subscription_status === "active").length;
  const waConnected = allBiz.filter(b => b.whatsapp_connected_at).length;
  const newThisMonth = allBiz.filter(b => b.created_at >= thirtyDaysAgo).length;
  const recent = allBiz.slice(0, 8);

  // Type distribution
  const typeCounts: Record<string, number> = {};
  for (const b of allBiz) typeCounts[b.type] = (typeCounts[b.type] ?? 0) + 1;
  const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTypeCount = topTypes[0]?.[1] ?? 1;

  return (
    <div className="p-8 max-w-6xl space-y-8">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-3 mb-1">Admin</p>
          <h1 className="text-2xl font-bold text-ink tracking-tight">Visão geral</h1>
        </div>
        <p className="text-sm text-ink-4 font-mono">
          {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Primary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Empresas",       value: String(bizRes.count ?? 0),  icon: Building2,     color: "text-brand",   bg: "bg-brand/8" },
          { label: "Clientes",       value: String(custRes.count ?? 0), icon: Users,         color: "text-info",    bg: "bg-info/8" },
          { label: "Conversas",      value: String(convRes.count ?? 0), icon: MessageCircle, color: "text-moss",    bg: "bg-moss/8" },
          { label: "Receita total",  value: fmtCurrency(totalRevenue),  icon: DollarSign,    color: "text-warning", bg: "bg-warning/8" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-surface border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-3">{label}</span>
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-ink tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Plano Pro",         value: String(proCount),       sub: "assinaturas ativas", color: "text-brand" },
          { label: "Plano Starter",     value: String(starterCount),   sub: "assinaturas ativas", color: "text-ink-2" },
          { label: "WhatsApp ativo",    value: String(waConnected),    sub: `de ${allBiz.length} empresas`, color: "text-moss" },
          { label: "Novas este mês",    value: String(newThisMonth),   sub: "últimos 30 dias", color: "text-info" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-surface border border-border rounded-xl px-5 py-4">
            <p className="text-xs font-medium text-ink-3 mb-1">{label}</p>
            <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-[11px] text-ink-4 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Two-col: type breakdown + recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Type distribution */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-ink-3" />
            <p className="text-sm font-semibold text-ink">Tipos de negócio</p>
          </div>
          <div className="space-y-3">
            {topTypes.length === 0 && (
              <p className="text-sm text-ink-4">Sem dados</p>
            )}
            {topTypes.map(([type, count]) => (
              <div key={type} className="space-y-1">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-ink-2 font-medium">{fmtType(type)}</span>
                  <span className="text-ink-4 tabular-nums font-mono">{count}</span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / maxTypeCount) * 100}%`,
                      background: "var(--brand)",
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent businesses */}
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold text-ink">Empresas recentes</p>
            <Link
              href="/admin/businesses"
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-brand"
              style={{ color: "var(--ink-3)" }}
            >
              Ver todas <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                {["Empresa", "Tipo", "Plano", "WA", "Cadastro"].map(col => (
                  <th
                    key={col}
                    className="text-left px-5 py-2.5 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--ink-4)" }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((b, i) => (
                <tr
                  key={b.id}
                  className={`hover:bg-surface-2 transition-colors ${i < recent.length - 1 ? "border-b" : ""}`}
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-5 py-3 font-medium text-ink max-w-[160px] truncate">{b.name}</td>
                  <td className="px-5 py-3 text-xs text-ink-3">{fmtType(b.type)}</td>
                  <td className="px-5 py-3">
                    <PlanBadge plan={b.subscription_plan} status={b.subscription_status} />
                  </td>
                  <td className="px-5 py-3">
                    {b.whatsapp_connected_at
                      ? <Wifi className="w-3.5 h-3.5 text-moss" />
                      : <WifiOff className="w-3.5 h-3.5 text-ink-4" />
                    }
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-ink-4">{fmtDate(b.created_at)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink-4">
                    Nenhuma empresa cadastrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
