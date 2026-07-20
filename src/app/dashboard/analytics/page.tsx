import { Suspense } from "react";
import Link from "next/link";
import { UpgradeGate } from "@/components/layout/UpgradeGate";
import { redirect } from "next/navigation";
import {
  TrendingUp,
  DollarSign,
  Briefcase,
  Users,
  MessageSquare,
  CheckCircle2,
  BarChart3,
  Bot,
  UserCheck,
  RefreshCcw,
  Ticket,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/auth/actions";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import nextDynamic from "next/dynamic";
import { MetricCard } from "@/components/analytics/MetricCard";
import type { RevenueDataPoint } from "@/components/analytics/RevenueChart";
import { TopCustomersTable } from "@/components/analytics/TopCustomersTable";
import type { TopCustomerRow } from "@/components/analytics/TopCustomersTable";
import type { ServiceCount } from "@/components/analytics/TopServicesChart";
import { AnalyticsAIChat } from "@/components/analytics/AnalyticsAIChat";

const RevenueChart = nextDynamic(
  () => import("@/components/analytics/RevenueChart").then(m => ({ default: m.RevenueChart })),
  { loading: () => <div className="h-64 animate-pulse bg-surface-2 rounded-xl" /> }
);
const StatusDonut = nextDynamic(
  () => import("@/components/analytics/StatusDonut").then(m => ({ default: m.StatusDonut })),
  { loading: () => <div className="h-48 animate-pulse bg-surface-2 rounded-xl" /> }
);
const TopServicesChart = nextDynamic(
  () => import("@/components/analytics/TopServicesChart").then(m => ({ default: m.TopServicesChart })),
  { loading: () => <div className="h-48 animate-pulse bg-surface-2 rounded-xl" /> }
);
import type {
  Payment,
  WorkItem,
  Customer,
  Conversation,
  Service,
} from "@/types/database";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateRange(daysBack: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  start.setHours(0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getPreviousRange(daysBack: number): { start: string; end: string } {
  const end = new Date();
  end.setDate(end.getDate() - daysBack);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);
  start.setHours(0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString(), end: now.toISOString() };
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface AnalyticsData {
  // Revenue
  revenueThisPeriod: number;
  revenuePrevPeriod: number;
  revenueByDay: RevenueDataPoint[];
  paidPaymentsCount: number;
  avgTicket: number;
  daysBack: number;

  // Work Items
  totalWorkItems: number;
  completedWorkItems: number;
  cancelledWorkItems: number;
  workItemStatusBreakdown: Record<string, number>;
  topServices: ServiceCount[];

  // Customers
  totalCustomers: number;
  newCustomersThisMonth: number;
  returningCustomers: number;
  topCustomers: TopCustomerRow[];

  // Conversations
  totalConversations: number;
  openConversations: number;
  resolvedConversations: number;
  aiHandledConversations: number;
}

async function fetchAnalyticsData(businessId: string, daysBack: number): Promise<AnalyticsData> {
  const supabase = await createClient();

  const { start: currentStart } = getDateRange(daysBack);
  const { start: prevStart, end: prevEnd } = getPreviousRange(daysBack);
  const { start: monthStart } = getMonthRange();

  const [
    paymentsCurrentResult,
    paymentsPrevResult,
    workItemsResult,
    workItemsServiceResult,
    servicesResult,
    customersResult,
    conversationsResult,
  ] = await Promise.allSettled([
    // 1. Paid payments — current period
    supabase
      .from("payments")
      .select("amount, paid_at")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .gte("paid_at", currentStart)
      .order("paid_at", { ascending: true }),

    // 2. Paid payments — previous period
    supabase
      .from("payments")
      .select("amount, paid_at")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .gte("paid_at", prevStart)
      .lte("paid_at", prevEnd),

    // 3. All work items
    supabase
      .from("work_items")
      .select("id, status")
      .eq("business_id", businessId),

    // 4. Work items with service_id for top services
    supabase
      .from("work_items")
      .select("service_id")
      .eq("business_id", businessId)
      .not("service_id", "is", null),

    // 5. Services list
    supabase
      .from("services")
      .select("id, name")
      .eq("business_id", businessId),

    // 6. All customers
    supabase
      .from("customers")
      .select("id, full_name, total_spent, visit_count, status, created_at")
      .eq("business_id", businessId)
      .order("total_spent", { ascending: false }),

    // 7. Conversations
    supabase
      .from("conversations")
      .select("id, status, ai_active")
      .eq("business_id", businessId),
  ]);

  // ---- Revenue ----
  const currentPayments: Pick<Payment, "amount" | "paid_at">[] =
    paymentsCurrentResult.status === "fulfilled" && paymentsCurrentResult.value.data
      ? (paymentsCurrentResult.value.data as Pick<Payment, "amount" | "paid_at">[])
      : [];

  const prevPaymentsFull: Pick<Payment, "amount" | "paid_at">[] =
    paymentsPrevResult.status === "fulfilled" && paymentsPrevResult.value.data
      ? (paymentsPrevResult.value.data as Pick<Payment, "amount" | "paid_at">[])
      : [];

  const revenueThisPeriod = currentPayments.reduce((s, p) => s + (p.amount ?? 0), 0);
  const revenuePrevPeriod = prevPaymentsFull.reduce((s, p) => s + (p.amount ?? 0), 0);
  const paidPaymentsCount = currentPayments.length;
  const avgTicket = paidPaymentsCount > 0 ? Math.round(revenueThisPeriod / paidPaymentsCount) : 0;

  // Build daily revenue for chart — current period
  const revByDay: Record<string, number> = {};
  const prevRevByDay: Record<string, number> = {};

  for (const p of currentPayments) {
    if (!p.paid_at) continue;
    const day = p.paid_at.slice(0, 10);
    revByDay[day] = (revByDay[day] ?? 0) + (p.amount ?? 0);
  }

  // Previous period by day (offset by daysBack to overlay on chart)
  for (const p of prevPaymentsFull) {
    if (!p.paid_at) continue;
    const origDate = new Date(p.paid_at);
    origDate.setDate(origDate.getDate() + daysBack); // shift to overlay on current period
    const day = origDate.toISOString().slice(0, 10);
    prevRevByDay[day] = (prevRevByDay[day] ?? 0) + (p.amount ?? 0);
  }

  const revenueByDay: RevenueDataPoint[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    revenueByDay.push({
      date: key,
      revenue: revByDay[key] ?? 0,
      prevRevenue: prevRevByDay[key] ?? 0,
    });
  }

  // ---- Work Items ----
  const workItems: Pick<WorkItem, "id" | "status">[] =
    workItemsResult.status === "fulfilled" && workItemsResult.value.data
      ? (workItemsResult.value.data as Pick<WorkItem, "id" | "status">[])
      : [];

  const totalWorkItems = workItems.length;
  const completedWorkItems = workItems.filter((w) => w.status === "completed").length;
  const cancelledWorkItems = workItems.filter((w) => w.status === "cancelled").length;

  const workItemStatusBreakdown: Record<string, number> = {};
  for (const w of workItems) {
    workItemStatusBreakdown[w.status] = (workItemStatusBreakdown[w.status] ?? 0) + 1;
  }

  // Top 5 services
  const serviceItems: { service_id: string | null }[] =
    workItemsServiceResult.status === "fulfilled" && workItemsServiceResult.value.data
      ? (workItemsServiceResult.value.data as { service_id: string | null }[])
      : [];

  const services: Pick<Service, "id" | "name">[] =
    servicesResult.status === "fulfilled" && servicesResult.value.data
      ? (servicesResult.value.data as Pick<Service, "id" | "name">[])
      : [];

  const serviceCountMap: Record<string, number> = {};
  for (const item of serviceItems) {
    if (!item.service_id) continue;
    serviceCountMap[item.service_id] = (serviceCountMap[item.service_id] ?? 0) + 1;
  }

  const serviceNameMap: Record<string, string> = {};
  for (const s of services) {
    serviceNameMap[s.id] = s.name;
  }

  const topServices: ServiceCount[] = Object.entries(serviceCountMap)
    .map(([id, count]) => ({ name: serviceNameMap[id] ?? "Serviço desconhecido", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ---- Customers ----
  const customers: Pick<Customer, "id" | "full_name" | "total_spent" | "visit_count" | "status" | "created_at">[] =
    customersResult.status === "fulfilled" && customersResult.value.data
      ? (customersResult.value.data as Pick<Customer, "id" | "full_name" | "total_spent" | "visit_count" | "status" | "created_at">[])
      : [];

  const totalCustomers = customers.length;

  const newCustomersThisMonth = customers.filter(
    (c) => c.created_at >= monthStart
  ).length;

  const returningCustomers = customers.filter((c) => (c.visit_count ?? 0) > 1).length;

  const topCustomers: TopCustomerRow[] = customers.slice(0, 10).map((c) => ({
    id: c.id,
    full_name: c.full_name,
    total_spent: c.total_spent ?? 0,
    visit_count: c.visit_count ?? 0,
    status: c.status,
  }));

  // ---- Conversations ----
  const conversations: Pick<Conversation, "id" | "status" | "ai_active">[] =
    conversationsResult.status === "fulfilled" && conversationsResult.value.data
      ? (conversationsResult.value.data as Pick<Conversation, "id" | "status" | "ai_active">[])
      : [];

  const totalConversations = conversations.length;
  const openConversations = conversations.filter(
    (c) => c.status === "open" || c.status === "waiting" || c.status === "bot"
  ).length;
  const resolvedConversations = conversations.filter((c) => c.status === "resolved").length;
  const aiHandledConversations = conversations.filter((c) => c.ai_active).length;

  return {
    revenueThisPeriod,
    revenuePrevPeriod,
    revenueByDay,
    paidPaymentsCount,
    avgTicket,
    daysBack,

    totalWorkItems,
    completedWorkItems,
    cancelledWorkItems,
    workItemStatusBreakdown,
    topServices,

    totalCustomers,
    newCustomersThisMonth,
    returningCustomers,
    topCustomers,

    totalConversations,
    openConversations,
    resolvedConversations,
    aiHandledConversations,
  };
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function MetricsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="bg-surface border border-border rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="h-3 w-24 bg-surface-2 rounded animate-pulse mb-3" />
                <div className="h-7 w-20 bg-surface-2 rounded animate-pulse mb-2" />
                <div className="h-2.5 w-16 bg-surface-2 rounded animate-pulse" />
              </div>
              <div className="w-10 h-10 bg-surface-2 rounded-xl animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton({ height = "h-52" }: { height?: string }) {
  return (
    <Card className="bg-surface border border-border rounded-xl">
      <CardContent className="p-5">
        <div className="h-4 w-40 bg-surface-2 rounded animate-pulse mb-4" />
        <Skeleton className={`${height} w-full bg-surface-2 rounded-lg`} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section components (rendered inside Suspense boundaries)
// ---------------------------------------------------------------------------

interface SectionProps {
  data: AnalyticsData;
}

function RevenueSection({ data }: SectionProps) {
  const momChange =
    data.revenuePrevPeriod > 0
      ? ((data.revenueThisPeriod - data.revenuePrevPeriod) / data.revenuePrevPeriod) * 100
      : data.revenueThisPeriod > 0
        ? 100
        : 0;

  return (
    <section>
      <h2 className="text-base font-bold text-ink mb-4">
        Receita — Últimos {data.daysBack} dias
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Receita Total"
          value={data.revenueThisPeriod > 0 ? formatCurrency(data.revenueThisPeriod) : "--"}
          icon={DollarSign}
          iconColor="text-brand"
          iconBg="bg-tint"
          valueColor="text-brand"
          trend={
            data.revenuePrevPeriod > 0 || data.revenueThisPeriod > 0
              ? { value: momChange, label: "vs período anterior" }
              : undefined
          }
        />
        <MetricCard
          label="Receita Período Anterior"
          value={data.revenuePrevPeriod > 0 ? formatCurrency(data.revenuePrevPeriod) : "--"}
          icon={TrendingUp}
          iconColor="text-info"
          iconBg="bg-info/10"
          subLabel={`${data.daysBack} dias anteriores`}
        />
        <MetricCard
          label="Pagamentos Confirmados"
          value={data.paidPaymentsCount}
          icon={CheckCircle2}
          iconColor="text-moss"
          iconBg="bg-moss/10"
          subLabel="no período"
        />
        <MetricCard
          label="Ticket Médio"
          value={data.avgTicket > 0 ? formatCurrency(data.avgTicket) : "--"}
          icon={Ticket}
          iconColor="text-warning"
          iconBg="bg-warning/10"
          subLabel="por pagamento"
        />
      </div>

      <RevenueChart data={data.revenueByDay} showComparison />
    </section>
  );
}

function WorkItemsSection({ data }: SectionProps) {
  const eligible = data.totalWorkItems - data.cancelledWorkItems;
  const completionRate =
    eligible > 0 ? Math.round((data.completedWorkItems / eligible) * 100) : 0;

  // Build status slices with warm colours
  const STATUS_COLORS: Record<string, string> = {
    new: "#E85D1F",           // brand
    scheduled: "#2E6BAA",     // info
    pending_confirmation: "#C77E0A", // warning
    confirmed: "#2E6BAA",     // info
    in_progress: "#C77E0A",   // warning
    waiting_customer: "#C77E0A", // warning
    waiting_parts: "#C77E0A",    // warning
    completed: "#2F7D5B",     // moss
    cancelled: "#C0392F",     // danger
    no_show: "#C0392F",       // danger
  };

  const STATUS_LABELS: Record<string, string> = {
    new: "Novo",
    scheduled: "Agendado",
    pending_confirmation: "Aguardando confirmação",
    confirmed: "Confirmado",
    in_progress: "Em andamento",
    waiting_customer: "Aguardando cliente",
    waiting_parts: "Aguardando peças",
    completed: "Concluído",
    cancelled: "Cancelado",
    no_show: "Não compareceu",
  };

  const statusSlices = Object.entries(data.workItemStatusBreakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      label: STATUS_LABELS[k] ?? k,
      value: v,
      color: STATUS_COLORS[k] ?? "#B5AE9F",
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <section>
      <h2 className="text-base font-bold text-ink mb-4">
        Itens de Trabalho
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total de Itens"
          value={data.totalWorkItems}
          icon={Briefcase}
          iconColor="text-info"
          iconBg="bg-info/10"
          subLabel="todos os tempos"
        />
        <MetricCard
          label="Taxa de Conclusão"
          value={eligible > 0 ? `${completionRate}%` : "--"}
          icon={CheckCircle2}
          iconColor={completionRate >= 80 ? "text-moss" : "text-warning"}
          iconBg={completionRate >= 80 ? "bg-moss/10" : "bg-warning/10"}
          valueColor={completionRate >= 80 ? "text-moss" : "text-warning"}
          subLabel={`${data.completedWorkItems} de ${eligible} elegíveis`}
        />
        <MetricCard
          label="Concluídos"
          value={data.completedWorkItems}
          icon={CheckCircle2}
          iconColor="text-moss"
          iconBg="bg-moss/10"
          subLabel="status concluído"
        />
        <MetricCard
          label="Cancelados"
          value={data.cancelledWorkItems}
          icon={RefreshCcw}
          iconColor={data.cancelledWorkItems > 0 ? "text-danger" : "text-ink-4"}
          iconBg={data.cancelledWorkItems > 0 ? "bg-danger/10" : "bg-surface-2"}
          subLabel="itens cancelados"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusDonut
          title="Status dos Itens"
          icon={<Briefcase className="w-4 h-4 text-info" />}
          data={statusSlices}
        />
        <TopServicesChart data={data.topServices} />
      </div>
    </section>
  );
}

function CustomersSection({ data }: SectionProps) {
  const retentionRate =
    data.totalCustomers > 0
      ? Math.round((data.returningCustomers / data.totalCustomers) * 100)
      : 0;

  return (
    <section>
      <h2 className="text-base font-bold text-ink mb-4">
        Clientes
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total de Clientes"
          value={data.totalCustomers}
          icon={Users}
          iconColor="text-brand"
          iconBg="bg-tint"
          subLabel="base total"
        />
        <MetricCard
          label="Novos este Mês"
          value={data.newCustomersThisMonth}
          icon={Users}
          iconColor="text-brand"
          iconBg="bg-tint"
          subLabel="cadastrados no mês"
        />
        <MetricCard
          label="Clientes Recorrentes"
          value={data.returningCustomers}
          icon={UserCheck}
          iconColor="text-info"
          iconBg="bg-info/10"
          subLabel="mais de 1 visita"
        />
        <MetricCard
          label="Taxa de Retenção"
          value={data.totalCustomers > 0 ? `${retentionRate}%` : "--"}
          icon={RefreshCcw}
          iconColor={retentionRate >= 50 ? "text-moss" : "text-warning"}
          iconBg={retentionRate >= 50 ? "bg-moss/10" : "bg-warning/10"}
          valueColor={retentionRate >= 50 ? "text-moss" : "text-warning"}
          subLabel="clientes recorrentes"
        />
      </div>

      <TopCustomersTable customers={data.topCustomers} />
    </section>
  );
}

function ConversationsSection({ data }: SectionProps) {
  const aiRatio =
    data.totalConversations > 0
      ? Math.round((data.aiHandledConversations / data.totalConversations) * 100)
      : 0;

  const conversationSlices = [
    {
      label: "Abertas",
      value: data.openConversations,
      color: "#2E6BAA", // info
    },
    {
      label: "Outras",
      value: Math.max(
        0,
        data.totalConversations - data.openConversations
      ),
      color: "#B5AE9F", // ink-4
    },
  ].filter((s) => s.value > 0);

  return (
    <section>
      <h2 className="text-base font-bold text-ink mb-4">
        Conversas
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Total de Conversas"
          value={data.totalConversations}
          icon={MessageSquare}
          iconColor="text-info"
          iconBg="bg-info/10"
          subLabel="todos os tempos"
        />
        <MetricCard
          label="Abertas"
          value={data.openConversations}
          icon={MessageSquare}
          iconColor={data.openConversations > 0 ? "text-warning" : "text-ink-4"}
          iconBg={data.openConversations > 0 ? "bg-warning/10" : "bg-surface-2"}
          subLabel="aguardando resposta"
        />
        <MetricCard
          label="Atendidas pela IA"
          value={data.totalConversations > 0 ? `${aiRatio}%` : "--"}
          icon={Bot}
          iconColor="text-brand"
          iconBg="bg-tint"
          valueColor="text-brand"
          subLabel={`${data.aiHandledConversations} conversas`}
        />
      </div>

      <div className="max-w-sm">
        <StatusDonut
          title="Status das Conversas"
          icon={<MessageSquare className="w-4 h-4 text-info" />}
          data={conversationSlices}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main async content
// ---------------------------------------------------------------------------

type TabKey = "revenue" | "work" | "customers" | "conversations" | "ai";

async function AnalyticsContent({ businessId, daysBack, tab }: { businessId: string; daysBack: number; tab: TabKey }) {
  const data = await fetchAnalyticsData(businessId, daysBack);

  const eligible = data.totalWorkItems - data.cancelledWorkItems;
  const completionRate = eligible > 0 ? Math.round((data.completedWorkItems / eligible) * 100) : 0;
  const retentionRate = data.totalCustomers > 0 ? Math.round((data.returningCustomers / data.totalCustomers) * 100) : 0;
  const aiRatio = data.totalConversations > 0 ? Math.round((data.aiHandledConversations / data.totalConversations) * 100) : 0;

  const summary = {
    period: `últimos ${daysBack} dias`,
    revenue: { current: data.revenueThisPeriod, previous: data.revenuePrevPeriod, paid_count: data.paidPaymentsCount, avg_ticket: data.avgTicket },
    work_items: { total: data.totalWorkItems, completed: data.completedWorkItems, cancelled: data.cancelledWorkItems, completion_rate: completionRate },
    customers: { total: data.totalCustomers, new_this_month: data.newCustomersThisMonth, returning: data.returningCustomers, retention_rate: retentionRate },
    conversations: { total: data.totalConversations, open: data.openConversations, resolved: data.resolvedConversations, ai_handled: data.aiHandledConversations, ai_ratio: aiRatio },
    top_services: data.topServices,
  };

  return (
    <div className="space-y-6">
      {tab === "revenue"        && <RevenueSection data={data} />}
      {tab === "work"           && <WorkItemsSection data={data} />}
      {tab === "customers"      && <CustomersSection data={data} />}
      {tab === "conversations"  && <ConversationsSection data={data} />}
      {tab === "ai"             && <AnalyticsAIChat summary={summary} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function AnalyticsLoadingFallback() {
  return (
    <div className="space-y-10">
      {/* Revenue */}
      <div>
        <div className="h-3 w-48 bg-surface-2 rounded animate-pulse mb-4" />
        <MetricsSkeleton count={4} />
        <div className="mt-6">
          <ChartSkeleton height="h-52" />
        </div>
      </div>

      {/* Work items */}
      <div>
        <div className="h-3 w-40 bg-surface-2 rounded animate-pulse mb-4" />
        <MetricsSkeleton count={4} />
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton height="h-44" />
          <ChartSkeleton height="h-44" />
        </div>
      </div>

      {/* Customers */}
      <div>
        <div className="h-3 w-32 bg-surface-2 rounded animate-pulse mb-4" />
        <MetricsSkeleton count={4} />
        <div className="mt-6">
          <ChartSkeleton height="h-64" />
        </div>
      </div>

      {/* Conversations */}
      <div>
        <div className="h-3 w-36 bg-surface-2 rounded animate-pulse mb-4" />
        <MetricsSkeleton count={4} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const VALID_TABS = ["revenue", "work", "customers", "conversations", "ai"] as const;
type TabKeyPage = typeof VALID_TABS[number];

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; tab?: string }>
}) {
  const businessId = await getBusinessId();
  if (!businessId) redirect("/login");

  const { range, tab: tabParam } = await searchParams;
  const daysBack = range === "7" ? 7 : range === "90" ? 90 : 30;
  const activeTab: TabKeyPage = VALID_TABS.includes(tabParam as TabKeyPage) ? (tabParam as TabKeyPage) : "revenue";

  const TAB_LABELS: Record<TabKeyPage, string> = {
    revenue: "Receita",
    work: "Serviços",
    customers: "Clientes",
    conversations: "Conversas",
    ai: "✦ Análise IA",
  };

  return (
    <UpgradeGate>
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-tint flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5 text-brand" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-ink tracking-tight">Análises</h2>
          <p className="text-ink-3 text-xs font-mono mt-0.5">
            Visão geral do seu negócio — últimos {daysBack} dias
          </p>
        </div>
      </div>

      {/* Tab bar + date range */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Section tabs */}
        <div className="flex items-center gap-0.5 p-1 bg-surface border border-border rounded-lg overflow-x-auto scrollbar-none">
          {VALID_TABS.map((t) => (
            <Link
              key={t}
              href={`?tab=${t}&range=${daysBack}`}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors shrink-0",
                activeTab === t
                  ? t === "ai" ? "text-white" : "bg-ink text-white"
                  : t === "ai" ? "text-brand hover:bg-tint" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              )}
              style={activeTab === t && t === "ai" ? { background: "var(--brand-grad)" } : undefined}
            >
              {TAB_LABELS[t]}
            </Link>
          ))}
        </div>

        {/* Date range picker — hidden on AI tab */}
        {activeTab !== "ai" && (
          <div className="flex items-center gap-0.5 p-1 bg-surface border border-border rounded-lg">
            {[
              { label: "7 dias", value: "7" },
              { label: "30 dias", value: "30" },
              { label: "90 dias", value: "90" },
            ].map((r) => (
              <Link
                key={r.value}
                href={`?tab=${activeTab}&range=${r.value}`}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-semibold transition-colors",
                  String(daysBack) === r.value
                    ? "bg-brand/10 text-brand"
                    : "text-ink-3 hover:bg-surface-2 hover:text-ink-2"
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Data */}
      <Suspense fallback={<AnalyticsLoadingFallback />}>
        <AnalyticsContent businessId={businessId} daysBack={daysBack} tab={activeTab} />
      </Suspense>
    </div>
    </UpgradeGate>
  );
}
