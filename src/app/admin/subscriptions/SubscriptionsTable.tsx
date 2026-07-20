"use client"

import { useState } from "react"
import { Search, ChevronDown } from "lucide-react"
import { PlanActions } from "./PlanActions"

const PAGE_SIZE = 10

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: "Ativo",     cls: "bg-moss/10 text-moss border-moss/20" },
    trialing:  { label: "Trial",     cls: "bg-info/10 text-info border-info/20" },
    past_due:  { label: "Vencido",   cls: "bg-warning/10 text-warning border-warning/20" },
    cancelled: { label: "Cancelado", cls: "bg-surface-2 text-ink-4 border-border" },
  }
  const { label, cls } = map[status] ?? { label: status, cls: "bg-surface-2 text-ink-4 border-border" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {label}
    </span>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pro:     { label: "Pro",     cls: "bg-brand/8 text-brand border-brand/20" },
    medical: { label: "Medical", cls: "bg-info/10 text-info border-info/20" },
    starter: { label: "Starter", cls: "bg-surface-2 text-ink-3 border-border" },
  }
  const { label, cls } = map[plan] ?? { label: plan, cls: "bg-surface-2 text-ink-3 border-border" }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {label}
    </span>
  )
}

export type SubRow = {
  id: string; name: string;
  city: string | null; state: string | null;
  subscription_plan: string; subscription_status: string;
  subscription_ends_at: string | null; created_at: string;
}

export function SubscriptionsTable({ businesses }: { businesses: SubRow[] }) {
  const [query, setQuery] = useState("")
  const [shown, setShown] = useState(PAGE_SIZE)

  const filtered = businesses.filter(b =>
    b.name.toLowerCase().includes(query.toLowerCase()) ||
    (b.city ?? "").toLowerCase().includes(query.toLowerCase()) ||
    b.subscription_plan.toLowerCase().includes(query.toLowerCase()) ||
    b.subscription_status.toLowerCase().includes(query.toLowerCase())
  )
  const visible = filtered.slice(0, shown)
  const hasMore = filtered.length > shown

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-4 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar empresa, plano, status…"
          value={query}
          onChange={e => { setQuery(e.target.value); setShown(PAGE_SIZE) }}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-surface text-sm text-ink focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Empresa", "Localidade", "Plano", "Status", "Vencimento", "Cadastro", "Ações"].map(col => (
                <th key={col} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-4">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((b, i) => (
              <tr key={b.id} className={`hover:bg-surface-2 transition-colors ${i < visible.length - 1 ? "border-b border-border" : ""}`}>
                <td className="px-5 py-3 font-medium text-ink max-w-[200px] truncate">{b.name}</td>
                <td className="px-5 py-3 text-xs text-ink-3">{[b.city, b.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-5 py-3"><PlanBadge plan={b.subscription_plan} /></td>
                <td className="px-5 py-3"><StatusBadge status={b.subscription_status} /></td>
                <td className="px-5 py-3 font-mono text-xs text-ink-4">{fmtDate(b.subscription_ends_at)}</td>
                <td className="px-5 py-3 font-mono text-xs text-ink-4">{fmtDate(b.created_at)}</td>
                <td className="px-5 py-3"><PlanActions id={b.id} plan={b.subscription_plan} status={b.subscription_status} /></td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-ink-4">
                  {query ? "Nenhuma empresa encontrada" : "Nenhuma empresa cadastrada"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mostrar mais */}
      {hasMore && (
        <button
          type="button"
          onClick={() => setShown(s => s + PAGE_SIZE)}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl border border-border bg-surface text-sm font-medium text-ink-3 hover:text-ink hover:border-brand/40 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
          Mostrar mais ({filtered.length - shown} restantes)
        </button>
      )}
    </div>
  )
}
