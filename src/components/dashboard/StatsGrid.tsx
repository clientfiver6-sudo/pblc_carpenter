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
  gradientTo?: string;
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
  gradientTo,
}: StatCardProps) {
  return (
    <Link href={href} className="group block">
      <div
        className={cn(
          "bg-white border border-border/75 rounded-2xl p-5 shadow-sm",
          "hover:-translate-y-1 hover:shadow-md hover:border-brand/20 transition-all duration-300 ease-brand-out",
          "animate-in fade-in slide-in-from-bottom-2 relative overflow-hidden group"
        )}
        style={{
          animationDelay: delay ? `${delay}ms` : undefined,
          background: gradientTo ? `linear-gradient(135deg, #ffffff 0%, ${gradientTo} 100%)` : undefined,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        
        <div className="flex items-start justify-between mb-4">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-inner", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
          <ChevronRight className="w-4 h-4 text-ink-4 opacity-0 group-hover:opacity-100 group-hover:text-ink-3 transition-all duration-200 ease-brand-out mt-0.5 translate-x-[-4px] group-hover:translate-x-0" />
        </div>
        
        <div className={cn("text-2xl sm:text-3xl font-extrabold tracking-tight font-mono leading-none mb-1.5", valueColor ?? "text-ink")}>
          {value}
        </div>
        <p className="text-[10.5px] font-extrabold text-ink-3 uppercase tracking-wider">{label}</p>
        {subLabel && <p className="text-xs text-ink-4 mt-0.5 font-medium">{subLabel}</p>}
      </div>
    </Link>
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-surface-2 animate-pulse rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-border rounded-xl" />
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
        gradientTo="rgba(232,93,31,0.02)"
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
        gradientTo="rgba(46,107,170,0.02)"
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
        gradientTo="rgba(47,125,91,0.02)"
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
        gradientTo={stats.pendingPayments > 0 ? "rgba(199,126,10,0.02)" : undefined}
      />
    </div>
  );
}
