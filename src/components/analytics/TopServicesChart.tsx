"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export interface ServiceCount {
  name: string;
  count: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: ServiceCount }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-ink-3 text-[10px] font-mono mb-0.5">{item.payload.name}</p>
      <p className="text-ink text-sm font-mono font-bold">
        {item.value} {item.value === 1 ? "serviço" : "serviços"}
      </p>
    </div>
  );
}

interface TopServicesChartProps {
  data: ServiceCount[];
}

// Bar colors using design tokens in sequence: brand, moss, info, warning, ink-4
const BAR_COLORS = [
  "var(--brand)",
  "var(--moss)",
  "var(--info)",
  "var(--warning)",
  "var(--ink-4)",
];

export function TopServicesChart({ data }: TopServicesChartProps) {
  const hasData = data.length > 0 && data.some((d) => d.count > 0);

  // Truncate long names for display
  const chartData = data.map((d) => ({
    ...d,
    shortName: d.name.length > 18 ? d.name.slice(0, 16) + "…" : d.name,
  }));

  return (
    <Card className="bg-surface border border-border rounded-xl">
      <CardHeader className="pb-2 pt-5 px-5">
        <CardTitle className="text-ink text-sm font-semibold flex items-center gap-2">
          <Wrench className="w-4 h-4 text-warning" />
          Top 5 Serviços
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4">
        {!hasData ? (
          <div className="h-44 flex items-center justify-center">
            <p className="text-ink-4 text-sm">Sem serviços registrados</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              barCategoryGap="25%"
            >
              <XAxis
                type="number"
                tick={{ fill: "var(--ink-4)", fontSize: 10, fontFamily: "DM Mono, monospace" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                width={110}
                tick={{ fill: "var(--ink-4)", fontSize: 11, fontFamily: "DM Sans, sans-serif" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-2)" }} />
              <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={16}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={BAR_COLORS[index % BAR_COLORS.length]}
                    fillOpacity={1 - index * 0.1}
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
