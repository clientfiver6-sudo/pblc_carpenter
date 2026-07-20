"use client";

import { formatCurrency, formatRelative } from "@/lib/utils";
import type { Customer } from "@/types/database";
import { TrendingUp, Calendar, Clock, BarChart2 } from "lucide-react";

interface CustomerStatsProps {
  customer: Customer;
}

interface StatBoxProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function StatBox({ label, value, icon }: StatBoxProps) {
  return (
    <div className="flex-1 min-w-0 rounded-lg bg-surface border border-border p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-brand">
        <span className="w-3.5 h-3.5 shrink-0">{icon}</span>
        <span className="text-xs font-semibold text-ink-3 uppercase tracking-wide truncate">{label}</span>
      </div>
      <p className="font-mono text-xl font-bold text-ink truncate">
        {value}
      </p>
    </div>
  );
}

export function CustomerStats({ customer }: CustomerStatsProps) {
  // total_spent is stored as decimal BRL (e.g. 150.00 = R$150)
  // formatCurrency expects cents, so multiply by 100
  const totalSpentFormatted = formatCurrency(customer.total_spent * 100);

  const ticketMedio =
    customer.visit_count > 0
      ? customer.total_spent / customer.visit_count
      : 0;

  const ticketMedioFormatted =
    ticketMedio > 0 ? formatCurrency(ticketMedio * 100) : "—";

  const ultimoAtendimento = customer.last_visit_at
    ? formatRelative(customer.last_visit_at)
    : "Nunca";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatBox
        label="Visitas totais"
        value={String(customer.visit_count)}
        icon={<Calendar className="w-3.5 h-3.5" />}
      />
      <StatBox
        label="Total gasto"
        value={totalSpentFormatted}
        icon={<TrendingUp className="w-3.5 h-3.5" />}
      />
      <StatBox
        label="Ticket médio"
        value={ticketMedioFormatted}
        icon={<BarChart2 className="w-3.5 h-3.5" />}
      />
      <StatBox
        label="Último atendimento"
        value={ultimoAtendimento}
        icon={<Clock className="w-3.5 h-3.5" />}
      />
    </div>
  );
}
