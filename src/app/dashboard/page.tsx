import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBusinessId } from "@/lib/auth/actions";
import { StatsGrid } from "@/components/dashboard/StatsGrid";
import { TodayScheduleServer } from "@/components/dashboard/TodayScheduleServer";
import { RevenueChartServer } from "@/components/dashboard/RevenueChartServer";
import { ConversationFeedServer } from "@/components/dashboard/ConversationFeedServer";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { FadeUp } from "@/components/layout/PageTransition";
import { DailySummaryAI, DailySummaryAISkeleton } from "@/components/dashboard/DailySummaryAI";
import { Calendar, CreditCard, MessageCircle } from "lucide-react";
import type { Business } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const businessId = await getBusinessId();
  if (!businessId) redirect("/login");

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: rawBusiness } = await admin
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();
  const business = rawBusiness as Business | null;
  if (!business) redirect("/login");

  // Stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [todayItemsRes, openConvsRes, todayRevenueRes, pendingPayRes, todayItemsDetailRes, pendingPayDetailRes, unreadConvsRes] = await Promise.allSettled([
    supabase
      .from("work_items")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("scheduled_start", todayIso)
      .lte("scheduled_start", todayEnd.toISOString()),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .in("status", ["open", "waiting", "bot"]),
    supabase
      .from("payments")
      .select("amount")
      .eq("business_id", businessId)
      .eq("status", "paid")
      .gte("paid_at", todayIso),
    supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "pending"),
    // Briefing: today's items with details
    admin
      .from("work_items")
      .select("id,title,scheduled_start,customers(full_name)")
      .eq("business_id", businessId)
      .gte("scheduled_start", todayIso)
      .lte("scheduled_start", todayEnd.toISOString())
      .not("status", "in", '("cancelled","completed")')
      .order("scheduled_start", { ascending: true })
      .limit(4),
    // Briefing: pending payments with amounts
    supabase
      .from("payments")
      .select("amount")
      .eq("business_id", businessId)
      .eq("status", "pending"),
    // Briefing: unread conversations
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gt("unread_count", 0),
  ]);

  const todayRevenue =
    todayRevenueRes.status === "fulfilled" && todayRevenueRes.value.data
      ? (todayRevenueRes.value.data as { amount: number }[]).reduce((s, p) => s + (p.amount ?? 0), 0)
      : 0;

  const stats = {
    todayItems: todayItemsRes.status === "fulfilled" ? (todayItemsRes.value.count ?? 0) : 0,
    openConversations: openConvsRes.status === "fulfilled" ? (openConvsRes.value.count ?? 0) : 0,
    todayRevenue,
    pendingPayments: pendingPayRes.status === "fulfilled" ? (pendingPayRes.value.count ?? 0) : 0,
  };

  // Briefing data
  const briefingItems = (
    todayItemsDetailRes.status === "fulfilled"
      ? (todayItemsDetailRes.value.data ?? []) as unknown as { id: string; title: string; scheduled_start: string | null; customers: { full_name: string } | null }[]
      : []
  ).map(i => ({ id: i.id, title: i.title, time: i.scheduled_start, customer: i.customers?.full_name ?? null }));

  const pendingPayAmounts = pendingPayDetailRes.status === "fulfilled"
    ? (pendingPayDetailRes.value.data ?? []) as { amount: number }[]
    : [];
  const pendingPayTotal = pendingPayAmounts.reduce((s, p) => s + p.amount, 0);
  const pendingPayCount = pendingPayAmounts.length;
  const unreadCount = unreadConvsRes.status === "fulfilled" ? (unreadConvsRes.value.count ?? 0) : 0;

  function fmtTime(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function fmtBRL(cents: number) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  }

  const firstName = business.name.split(" ")[0];
  const currentHour = new Date().getHours();
  const isEvening = currentHour >= 17;

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28 space-y-6">
      {/* Header */}
      <FadeUp delay={0}>
        <h2 className="text-2xl font-bold text-ink tracking-tight">
          Olá, {firstName} 👋
        </h2>
        <p className="text-sm text-ink-3 mt-0.5">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </FadeUp>

      {/* Daily summary — with ambient gradient orbs for depth */}
      <FadeUp delay={0.06}>
      <div
        className="relative overflow-hidden rounded-2xl border p-5 space-y-4"
        style={{
          background: "radial-gradient(120% 100% at 100% 0%,#FFE7D6 0%,transparent 55%),linear-gradient(135deg,#FFF7EF 0%,#FFF1E5 100%)",
          borderColor: "#F2D9C2",
        }}
      >
        {/* Ambient orbs */}
        <div className="gradient-orb w-48 h-48 -top-12 -right-12 opacity-30" style={{ background: "#F97316" }} />
        <div className="gradient-orb w-32 h-32 bottom-0 left-8 opacity-20" style={{ background: "#D63E68" }} />
        <p className="text-sm font-bold text-ink">
          <span className="text-brand mr-1.5">✦</span>
          Resumo do dia
        </p>
        <Suspense fallback={<DailySummaryAISkeleton />}>
          <DailySummaryAI
            businessName={business.name}
            todayCount={stats.todayItems}
            pendingPayCount={pendingPayCount}
            pendingPayTotal={pendingPayTotal}
            unreadCount={unreadCount}
          />
        </Suspense>
        <div className="space-y-3">
          {/* Today's schedule */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3 mb-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Agenda de hoje
            </div>
            {briefingItems.length === 0 ? (
              <p className="text-sm text-ink-4 pl-5">Nenhum serviço agendado para hoje</p>
            ) : (
              <ul className="space-y-1 pl-5">
                {briefingItems.map(item => (
                  <li key={item.id} className="flex items-baseline gap-2 text-sm text-ink">
                    {item.time && (
                      <span className="shrink-0 text-xs font-mono text-ink-3 w-10">{fmtTime(item.time)}</span>
                    )}
                    <span className="font-medium truncate">{item.title}</span>
                    {item.customer && (
                      <span className="text-xs text-ink-4 shrink-0">· {item.customer}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Pills */}
          <div className="flex flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium" style={{ borderColor: "#F2D9C2", background: "rgba(255,255,255,0.6)", color: pendingPayCount > 0 ? "var(--brand)" : "var(--ink-3)" }}>
              <CreditCard className="w-3.5 h-3.5" />
              {pendingPayCount > 0
                ? `${pendingPayCount} pagamento${pendingPayCount > 1 ? "s" : ""} pendente${pendingPayCount > 1 ? "s" : ""} · ${fmtBRL(pendingPayTotal)}`
                : "Sem pagamentos pendentes"}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium" style={{ borderColor: "#F2D9C2", background: "rgba(255,255,255,0.6)", color: unreadCount > 0 ? "var(--brand)" : "var(--ink-3)" }}>
              <MessageCircle className="w-3.5 h-3.5" />
              {unreadCount > 0
                ? `${unreadCount} conversa${unreadCount > 1 ? "s" : ""} não lida${unreadCount > 1 ? "s" : ""}`
                : "Sem conversas não lidas"}
            </div>
          </div>
        </div>
      </div>
      </FadeUp>

      {/* Stats */}
      <FadeUp delay={0.12}>
        <StatsGrid stats={stats} businessType={business.type} />
      </FadeUp>

      {/* Quick actions */}
      <FadeUp delay={0.18}>
        <QuickActions businessType={business.type} />
      </FadeUp>

      {/* Schedule + Conversations */}
      <FadeUp delay={0.22}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<div className="bg-surface border border-border rounded-xl h-64 animate-pulse" />}>
            <TodayScheduleServer businessId={businessId} businessType={business.type} />
          </Suspense>
          <Suspense fallback={<div className="bg-surface border border-border rounded-xl h-64 animate-pulse" />}>
            <ConversationFeedServer businessId={businessId} />
          </Suspense>
        </div>
      </FadeUp>

      {/* Revenue chart */}
      <FadeUp delay={0.28}>
        <Suspense fallback={<div className="bg-surface border border-border rounded-xl h-52 animate-pulse" />}>
          <RevenueChartServer businessId={businessId} />
        </Suspense>
      </FadeUp>

      {/* End-of-day briefing — visible after 17h */}
      {isEvening && (
        <FadeUp delay={0.32}>
          <div
            className="relative overflow-hidden rounded-2xl border p-5 space-y-3"
            style={{
              background: "radial-gradient(120% 100% at 0% 100%,#E8F5E9 0%,transparent 55%),linear-gradient(135deg,#F4FAF5 0%,#EDF7EE 100%)",
              borderColor: "#C8E6CA",
            }}
          >
            <div className="gradient-orb w-40 h-40 -bottom-10 -left-10 opacity-20" style={{ background: "#22C55E" }} />
            <p className="text-sm font-bold text-ink">
              <span className="text-moss mr-1.5">✦</span>
              Encerramento do dia
            </p>
            <Suspense fallback={<DailySummaryAISkeleton />}>
              <DailySummaryAI
                businessName={business.name}
                todayCount={stats.todayItems}
                pendingPayCount={pendingPayCount}
                pendingPayTotal={pendingPayTotal}
                unreadCount={unreadCount}
                mode="evening"
              />
            </Suspense>
          </div>
        </FadeUp>
      )}
    </div>
  );
}
