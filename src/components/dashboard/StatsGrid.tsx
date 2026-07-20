import { Calendar, MessageCircle, DollarSign, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { getBusinessConfig, type BusinessType } from "@/lib/config/business-types";

interface Stats {
  todayItems: number;
  openConversations: number;
  todayRevenue: number;
  pendingPayments: number;
}

interface StatsGridProps {
  stats: Stats | null;
  businessType: BusinessType;
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  iconColor: string;
  iconBg: string;
  valueColor?: string;
  subLabel?: string;
  href: string;
  delay?: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconColor,
  iconBg,
  valueColor,
  subLabel,
  href,
  delay,
}: StatCardProps) {
  return (
    <Link href={href} className="group block">
      <div
        className="bg-surface border border-border rounded-lg p-5 hover:-translate-y-0.5 hover:shadow-2 transition-[transform,box-shadow] duration-200 ease-brand-out animate-in fade-in slide-in-from-bottom-2 group"
        style={delay ? { animationDelay: `${delay}ms` } : undefined}
      >
        {/* Top row: icon glyph + hover arrow */}
        <div className="flex items-start justify-between mb-4">
          <div className={cn("w-10 h-10 rounded-md flex items-center justify-center", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
          <ChevronRight className="w-4 h-4 text-ink-4 opacity-0 group-hover:opacity-100 group-hover:text-ink-3 transition-[opacity,color] duration-150 ease-brand-out mt-0.5" />
        </div>
        {/* Big number */}
        <div className={cn("text-2xl sm:text-[32px] font-extrabold tracking-tight font-mono leading-none mb-1", valueColor ?? "text-ink")}>
          {value}
        </div>
        {/* Label */}
        <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide">{label}</p>
        {subLabel && <p className="text-xs text-ink-4 mt-0.5">{subLabel}</p>}
      </div>
    </Link>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-surface-2 animate-pulse rounded-lg p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-border rounded-md" />
      </div>
      <div className="h-8 w-20 bg-border rounded mb-2" />
      <div className="h-3 w-28 bg-border rounded" />
    </div>
  );
}

export function StatsGrid({ stats, businessType }: StatsGridProps) {
  const config = getBusinessConfig(businessType);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        icon={Calendar}
        label={`${config.workItemLabel} Hoje`}
        value={stats.todayItems}
        iconColor="text-brand"
        iconBg="bg-tint"
        subLabel={stats.todayItems === 1 ? config.workItemSingular : config.workItemLabel}
        href="/dashboard/work-items?date=today"
      />
      <StatCard
        icon={MessageCircle}
        label="Conversas Abertas"
        value={stats.openConversations}
        iconColor="text-info"
        iconBg="bg-info/10"
        subLabel={stats.openConversations > 0 ? "com mensagens não lidas" : "tudo em dia"}
        href="/dashboard/conversations?status=open"
        delay={75}
      />
      <StatCard
        icon={DollarSign}
        label="Receita Hoje"
        value={formatCurrency(stats.todayRevenue)}
        iconColor="text-moss"
        iconBg="bg-moss/10"
        subLabel="pagamentos confirmados"
        href="/dashboard/payments?filter=paid"
        delay={150}
      />
      <StatCard
        icon={Clock}
        label="Pagamentos Pendentes"
        value={stats.pendingPayments}
        iconColor={stats.pendingPayments > 0 ? "text-warning" : "text-ink-4"}
        iconBg={stats.pendingPayments > 0 ? "bg-warning/10" : "bg-surface-2"}
        valueColor={stats.pendingPayments > 0 ? "text-warning" : undefined}
        subLabel={stats.pendingPayments > 0 ? "aguardando pagamento" : "nenhum pendente"}
        href="/dashboard/payments?filter=pending"
        delay={200}
      />
    </div>
  );
}
