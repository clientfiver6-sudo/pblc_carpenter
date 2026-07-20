"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface RevenueDataPoint {
  date: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[] | null;
}

interface TooltipPayload {
  value: number;
  payload: RevenueDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0];
  return (
    <div
      className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-ink"
      style={{ boxShadow: "var(--shadow-2)" }}
    >
      <p className="text-xs text-ink-3 font-mono mb-1">
        {formatDate(point.payload.date, "dd/MM")}
      </p>
      <p className="text-sm font-bold text-ink font-mono">
        {formatCurrency(point.value)}
      </p>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card className="bg-surface border border-border rounded-lg shadow-1">
      <CardHeader className="pb-3 pt-5 px-5">
        <div className="h-4 w-32 bg-surface-2 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="bg-surface-2 animate-pulse rounded-md h-48 w-full" />
      </CardContent>
    </Card>
  );
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (data === null) {
    return <ChartSkeleton />;
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <Card className="bg-surface border border-border rounded-lg shadow-1">
      <CardHeader className="flex items-center justify-between px-5 py-4 border-b border-border pb-4 pt-4">
        <CardTitle className="text-base font-bold text-ink flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-moss" />
          Receita — Últimos 30 dias
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4 pt-4">
        {data.length === 0 || maxRevenue === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-ink-3 text-sm">Sem dados de receita no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={192}>
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="2 4"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={(val: string) => formatDate(val, "dd/MM")}
                tick={{ fill: "var(--ink-4)", fontSize: 10, fontFamily: "DM Mono, monospace" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(val: number) =>
                  val === 0
                    ? "R$0"
                    : `R$${(val / 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`
                }
                tick={{ fill: "var(--ink-4)", fontSize: 10, fontFamily: "DM Mono, monospace" }}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "var(--surface-2)" }}
              />
              <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={24}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.revenue > 0 ? "var(--brand)" : "var(--border)"}
                    fillOpacity={1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
