import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  valueColor?: string;
  trend?: {
    value: number;
    label: string;
  };
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  subLabel,
  icon: Icon,
  iconColor = "text-brand",
  iconBg = "bg-tint",
  valueColor,
  trend,
  loading = false,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-20 bg-surface-2 rounded-full animate-pulse" />
          <div className="w-9 h-9 bg-surface-2 rounded-xl animate-pulse" />
        </div>
        <div className="mt-auto pt-3">
          <div className="h-8 w-24 bg-surface-2 rounded-lg animate-pulse mb-2" />
          <div className="h-2.5 w-16 bg-surface-2 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  const displayValue = value === "" || value === null || value === undefined ? "—" : value;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3 relative overflow-hidden hover:shadow-sm transition-shadow duration-200">
      {/* Top row: label + icon */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-ink-4 text-[11px] font-semibold uppercase tracking-widest leading-tight truncate">
          {label}
        </p>
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            iconBg
          )}
        >
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </div>

      {/* Bottom: value + subLabel/trend */}
      <div className="mt-auto">
        <p
          className={cn(
            "text-[2rem] font-bold leading-none tracking-tight",
            valueColor ?? "text-ink"
          )}
        >
          {displayValue}
        </p>

        {subLabel && (
          <p className="text-ink-4 text-xs mt-1.5 truncate">{subLabel}</p>
        )}

        {trend && (
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className={cn(
                "inline-flex items-center text-[11px] font-bold px-1.5 py-0.5 rounded-full",
                trend.value > 0
                  ? "text-moss bg-moss/10"
                  : trend.value < 0
                    ? "text-danger bg-danger/10"
                    : "text-ink-4 bg-surface-2"
              )}
            >
              {trend.value > 0 ? "↑" : trend.value < 0 ? "↓" : "→"}{" "}
              {Math.abs(trend.value).toFixed(1)}%
            </span>
            <span className="text-ink-4 text-xs">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
