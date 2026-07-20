import { Suspense } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PaymentWithRelations, BusinessUser } from "@/types/database"
import { PaymentList } from "@/components/payments/PaymentList"
import { ExportButton } from "@/components/customers/ExportButton"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/utils"
import { DollarSign, Clock, CheckCircle2, CreditCard } from "lucide-react"
import { NewChargeDropdown } from "@/components/payments/NewChargeDropdown"
import { AIPaymentRecovery } from "@/components/ai/AIPaymentRecovery"
import { RevenueChartServer } from "@/components/dashboard/RevenueChartServer"
import { PaymentMethodsPanel } from "@/components/payments/PaymentMethodsPanel"

// ---------------------------------------------------------------------------
// Types for stats
// ---------------------------------------------------------------------------

interface PaymentStats {
  receivedToday: number
  pendingTotal: number
  receivedThisMonth: number
  activeCount: number
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getPaymentsData(
  businessId: string,
  filter: string
): Promise<{ payments: PaymentWithRelations[]; stats: PaymentStats }> {
  const admin = createAdminClient()

  // Fetch all payments with relations for this business
  const { data: payments, error } = await admin
    .from("payments")
    .select(
      `
      *,
      work_item:work_items(id, title, type, status),
      customer:customers(id, full_name, phone_number, email)
      `
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("getPaymentsData error:", error)
    return { payments: [], stats: { receivedToday: 0, pendingTotal: 0, receivedThisMonth: 0, activeCount: 0 } }
  }

  const allPayments = (payments as unknown as PaymentWithRelations[] | null) ?? []

  // --- Stats ---
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const receivedToday = allPayments
    .filter((p) => p.status === "paid" && p.paid_at && p.paid_at >= todayStart)
    .reduce((sum, p) => sum + p.amount, 0)

  const pendingTotal = allPayments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0)

  const receivedThisMonth = allPayments
    .filter((p) => p.status === "paid" && p.paid_at && p.paid_at >= monthStart)
    .reduce((sum, p) => sum + p.amount, 0)

  const activeCount = allPayments.filter((p) => p.status === "pending").length

  const stats: PaymentStats = { receivedToday, pendingTotal, receivedThisMonth, activeCount }

  // --- Filter ---
  let filtered = allPayments
  if (filter === "pendentes") filtered = allPayments.filter((p) => p.status === "pending")
  else if (filter === "recebidos") filtered = allPayments.filter((p) => p.status === "paid")
  else if (filter === "falhas") filtered = allPayments.filter((p) => p.status === "failed" || p.status === "expired")

  return { payments: filtered, stats }
}

// ---------------------------------------------------------------------------
// Stats card
// ---------------------------------------------------------------------------

interface StatsCardProps {
  title: string
  value: string
  icon: React.ReactNode
  accent?: "green" | "amber" | "default"
}

function StatsCard({ title, value, icon, accent = "default", delay }: StatsCardProps & { delay?: number }) {
  const accentClass =
    accent === "green"
      ? "text-moss"
      : accent === "amber"
        ? "text-warning"
        : "text-ink"

  return (
    <div
      className="bg-surface border border-border rounded-lg p-4 animate-in fade-in slide-in-from-bottom-2 duration-300 hover:-translate-y-0.5 hover:shadow-2 transition-[transform,box-shadow] duration-200 ease-brand-out"
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">{title}</p>
        <div className="text-ink-3">{icon}</div>
      </div>
      <p className={`font-mono font-bold text-2xl ${accentClass}`}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter tabs (client shell would be ideal but keeping as server link tabs)
// ---------------------------------------------------------------------------

interface FilterTab {
  key: string
  label: string
}

const FILTER_TABS: FilterTab[] = [
  { key: "todos", label: "Todos" },
  { key: "pendentes", label: "Pendentes" },
  { key: "recebidos", label: "Recebidos" },
  { key: "falhas", label: "Falhas" },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

export default async function PaymentsPage({ searchParams }: PageProps) {
  const { filter: rawFilter } = await searchParams
  const filter = FILTER_TABS.some((t) => t.key === rawFilter) ? (rawFilter ?? "todos") : "todos"

  // Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: rawBusinessUser } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const businessUser = rawBusinessUser as BusinessUser | null

  if (!businessUser) return redirect("/onboarding")

  const businessId = businessUser.business_id

  const { data: rawBiz } = await supabase
    .from("businesses")
    .select("mercadopago_access_token, pix_key")
    .eq("id", businessId)
    .single()
  const biz = rawBiz as { mercadopago_access_token: string | null; pix_key: string | null } | null
  const mpConnected = Boolean(biz?.mercadopago_access_token)
  const hasPixKey = Boolean(biz?.pix_key)
  const isSetup = mpConnected || hasPixKey

  // Show setup gate if no payment method configured
  if (!isSetup) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-400">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-tint flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-brand" />
              </div>
              <div className="absolute inset-0 rounded-2xl blur-2xl opacity-25 -z-10" style={{ background: "var(--brand-grad)" }} />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-ink tracking-tight">Configure seu recebimento</h2>
            <p className="text-sm text-ink-3 leading-relaxed max-w-sm mx-auto">
              Escolha como quer receber — Pix, Mercado Pago, ou os dois. Leva menos de 1 minuto.
            </p>
          </div>

          <PaymentMethodsPanel hasPixKey={false} mpConnected={false} />
        </div>
      </div>
    )
  }

  const { payments, stats } = await getPaymentsData(businessId, filter)

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight">Pagamentos</h2>
          <p className="text-sm text-ink-3 mt-0.5">
            Gerencie cobranças Pix e acompanhe recebimentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            endpoint="/api/export/payments"
            label="Exportar CSV"
          />
          <NewChargeDropdown />
        </div>
      </div>

      {/* Payment methods management — always visible so user can add/remove either */}
      <PaymentMethodsPanel hasPixKey={hasPixKey} mpConnected={mpConnected} />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="Recebido Hoje"
          value={formatCurrency(stats.receivedToday)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          accent="green"
        />
        <StatsCard
          title="Pendente"
          value={formatCurrency(stats.pendingTotal)}
          icon={<Clock className="h-4 w-4" />}
          accent="amber"
          delay={75}
        />
        <StatsCard
          title="Total do Mês"
          value={formatCurrency(stats.receivedThisMonth)}
          icon={<DollarSign className="h-4 w-4" />}
          accent="green"
          delay={150}
        />
        <StatsCard
          title="Pagamentos Ativos"
          value={String(stats.activeCount)}
          icon={<CreditCard className="h-4 w-4" />}
          delay={200}
        />
      </div>

      {/* Revenue chart */}
      <Suspense fallback={<div className="h-48 rounded-xl bg-surface-2 border border-border animate-pulse" />}>
        <RevenueChartServer businessId={businessId} />
      </Suspense>

      {/* AI Payment Recovery */}
      <AIPaymentRecovery businessId={businessId} />

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {FILTER_TABS.map((tab) => (
          <a
            key={tab.key}
            href={`/dashboard/payments?filter=${tab.key}`}
            className={
              filter === tab.key
                ? "bg-ink text-white rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-200 ease-out"
                : "border border-border text-ink-2 rounded-full px-3 py-1.5 text-sm hover:bg-surface-2 transition-colors duration-200 ease-out"
            }
          >
            {tab.label}
          </a>
        ))}
      </div>

      {/* Payment list */}
      <Suspense
        fallback={
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 bg-surface border border-border rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        }
      >
        <PaymentList payments={payments} />
      </Suspense>
    </div>
  )
}
