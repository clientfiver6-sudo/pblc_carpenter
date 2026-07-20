"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface RevenueDataPoint {
  date: string; // YYYY-MM-DD
  revenue: number; // cents
  prevRevenue?: number; // cents — previous period overlay
}

interface TooltipPayload {
  value: number;
  name: string;
  payload: RevenueDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2.5 shadow-xl space-y-1.5">
      <p className="font-mono text-ink-3 text-[10px]">
        {formatDate(payload[0].payload.date, "dd/MM/yyyy")}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: entry.name === "revenue" ? "var(--brand)" : "var(--ink-4)" }}
          />
          <span className="font-mono text-ink text-sm font-bold">
            {formatCurrency(entry.value)}
          </span>
          {entry.name === "prevRevenue" && (
            <span className="text-ink-4 text-[10px]">período anterior</span>
          )}
        </div>
      ))}
    </div>
  );
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  showComparison?: boolean;
}

export function RevenueChart({ data, showComparison = false }: RevenueChartProps) {
  const hasData = data.some((d) => d.revenue > 0);

  return (
    <Card className="bg-surface border border-border rounded-xl">
      <CardHeader className="pb-2 pt-5 px-5">
        <CardTitle className="text-ink text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand" />
          Receita Diária — Últimos 30 dias
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4">
        {!hasData ? (
          <div className="h-52 flex items-center justify-center">
            <p className="text-ink-4 text-sm">Sem dados de receita no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={208}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--brand)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--ink-4)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--ink-4)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
                width={60}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)" }} />
              {showComparison && (
                <Area
                  type="monotone"
                  dataKey="prevRevenue"
                  stroke="var(--ink-4)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  fill="url(#prevGrad)"
                  dot={false}
                  activeDot={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--brand)"
                strokeWidth={2}
                fill="url(#revGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "var(--brand)", stroke: "var(--surface)", strokeWidth: 2 }}
              />
              <ReferenceLine y={0} stroke="var(--border)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
