"use client"

import { useState } from "react"
import { Search, Wifi, WifiOff, ChevronDown } from "lucide-react"
import { ActionButtons } from "./ActionButtons"

const PAGE_SIZE = 10

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtType(t: string) {
  const map: Record<string, string> = {
    ac_residential: "Ar-condicionado", ac_commercial: "Climatização", refrigeration: "Refrigeração",
    electrician: "Elétrica", plumber: "Hidráulica", locksmith: "Serralheria",
    cleaning: "Limpeza", pest_control: "Dedetização", other_service_business: "Outro Serviço",
    clinic: "Clínica", dental_clinic: "Odontologia", aesthetic_clinic: "Estética",
    veterinary_clinic: "Veterinária", beauty_salon: "Salão de Beleza",
    auto_repair: "Oficina", bike_shop: "Bicicletas", retail_store: "Varejo", repair_shop: "Consertos",
  }
  return map[t] ?? t
}

function PlanBadge({ plan, status }: { plan: string; status: string }) {
  const isPro = plan === "pro"
  const isActive = status === "active" || status === "trialing"
  if (!isActive) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface-2 text-ink-4 border border-border">
        {status === "cancelled" ? "cancelado" : status === "past_due" ? "vencido" : status}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${isPro ? "bg-brand/8 text-brand border-brand/20" : "bg-surface-2 text-ink-3 border-border"}`}>
      {isPro ? "Pro" : "Starter"}
    </span>
  )
}

function OnboardBadge({ onboarded }: { onboarded: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${onboarded ? "text-moss" : "text-warning"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${onboarded ? "bg-moss" : "bg-warning"}`} />
      {onboarded ? "Ativo" : "Pendente"}
    </span>
  )
}

export type BizRow = {
  id: string; name: string; type: string;
  city: string | null; state: string | null;
  onboarded: boolean;
  whatsapp_connected_at: string | null;
  mercadopago_access_token: string | null;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
}

export function BusinessesTable({ businesses }: { businesses: BizRow[] }) {
  const [query, setQuery] = useState("")
  const [shown, setShown] = useState(PAGE_SIZE)

  const filtered = businesses.filter(b =>
    b.name.toLowerCase().includes(query.toLowerCase()) ||
    fmtType(b.type).toLowerCase().includes(query.toLowerCase()) ||
    (b.city ?? "").toLowerCase().includes(query.toLowerCase()) ||
    (b.state ?? "").toLowerCase().includes(query.toLowerCase())
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
          placeholder="Buscar empresa, cidade, tipo…"
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
              {["Empresa", "Tipo", "Cidade", "Status", "WhatsApp", "MercadoPago", "Plano", "Cadastro", "Ações"].map(col => (
                <th key={col} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-4">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((b, i) => (
              <tr key={b.id} className={`hover:bg-surface-2 transition-colors ${i < visible.length - 1 ? "border-b border-border" : ""}`}>
                <td className="px-5 py-3 font-medium text-ink max-w-[180px] truncate">{b.name}</td>
                <td className="px-5 py-3 text-xs text-ink-3">{fmtType(b.type)}</td>
                <td className="px-5 py-3 text-ink-3 text-xs">{[b.city, b.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="px-5 py-3"><OnboardBadge onboarded={b.onboarded} /></td>
                <td className="px-5 py-3">
                  {b.whatsapp_connected_at ? <Wifi className="w-4 h-4 text-moss" /> : <WifiOff className="w-4 h-4 text-ink-4" />}
                </td>
                <td className="px-5 py-3">
                  {b.mercadopago_access_token
                    ? <span className="text-[11px] font-medium text-moss">conectado</span>
                    : <span className="text-[11px] text-ink-4">—</span>}
                </td>
                <td className="px-5 py-3"><PlanBadge plan={b.subscription_plan} status={b.subscription_status} /></td>
                <td className="px-5 py-3 font-mono text-xs text-ink-4">{fmtDate(b.created_at)}</td>
                <td className="px-5 py-3"><ActionButtons id={b.id} onboarded={b.onboarded} /></td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm text-ink-4">
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
