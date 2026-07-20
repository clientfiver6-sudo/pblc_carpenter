"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: DonutSlice }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="bg-surface border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-ink-3 text-[10px] font-mono mb-0.5">{item.name}</p>
      <p className="text-ink text-sm font-mono font-bold">{item.value}</p>
    </div>
  );
}

interface LegendPayload {
  value?: string;
  color?: string;
}

function renderLegend(props: { payload?: LegendPayload[] }) {
  const { payload } = props;
  if (!payload) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
      {payload.map((entry, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: entry.color ?? "var(--ink-4)" }}
          />
          <span className="text-ink-3 text-xs font-mono">{entry.value ?? ""}</span>
        </li>
      ))}
    </ul>
  );
}

interface StatusDonutProps {
  title: string;
  icon?: React.ReactNode;
  data: DonutSlice[];
}

export function StatusDonut({ title, icon, data }: StatusDonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const hasData = total > 0;

  return (
    <Card className="bg-surface border border-border rounded-xl">
      <CardHeader className="pb-2 pt-5 px-5">
        <CardTitle className="text-ink text-sm font-semibold flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4">
        {!hasData ? (
          <div className="h-44 flex items-center justify-center">
            <p className="text-ink-4 text-sm">Sem dados no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="45%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderLegend} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
