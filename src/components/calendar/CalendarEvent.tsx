"use client";

import { cn, getInitials } from "@/lib/utils";
import type { WorkItemWithRelations, WorkItemStatus } from "@/types/database";

// ─── Status palette ────────────────────────────────────────────────────────────

const STATUS_GRADIENTS: Record<WorkItemStatus, { from: string; to: string; text: string; accent: string }> = {
  new:                  { from: "#7C3AED", to: "#4F46E5", text: "#fff", accent: "#C4B5FD" },
  scheduled:            { from: "#2563EB", to: "#1D4ED8", text: "#fff", accent: "#93C5FD" },
  pending_confirmation: { from: "#D97706", to: "#B45309", text: "#fff", accent: "#FCD34D" },
  confirmed:            { from: "#0891B2", to: "#0E7490", text: "#fff", accent: "#67E8F9" },
  in_progress:          { from: "#EA580C", to: "#C2410C", text: "#fff", accent: "#FDBA74" },
  waiting_customer:     { from: "#CA8A04", to: "#A16207", text: "#fff", accent: "#FDE68A" },
  waiting_parts:        { from: "#9A3412", to: "#7C2D12", text: "#fff", accent: "#FCA5A5" },
  completed:            { from: "#059669", to: "#047857", text: "#fff", accent: "#6EE7B7" },
  cancelled:            { from: "#374151", to: "#1F2937", text: "#9CA3AF", accent: "#6B7280" },
  no_show:              { from: "#DC2626", to: "#B91C1C", text: "#fff", accent: "#FCA5A5" },
};

export const STATUS_COLORS: Record<WorkItemStatus, string> = {
  new: "#7C3AED",
  scheduled: "#2563EB",
  pending_confirmation: "#D97706",
  confirmed: "#0891B2",
  in_progress: "#EA580C",
  waiting_customer: "#CA8A04",
  waiting_parts: "#9A3412",
  completed: "#059669",
  cancelled: "#374151",
  no_show: "#DC2626",
};

export const STATUS_LABELS: Record<WorkItemStatus, string> = {
  new: "Novo",
  scheduled: "Agendado",
  pending_confirmation: "Aguardando",
  confirmed: "Confirmado",
  in_progress: "Em Andamento",
  waiting_customer: "Ag. Cliente",
  waiting_parts: "Ag. Peças",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não Compareceu",
};

const CANCELLED_STATUSES: WorkItemStatus[] = ["cancelled", "no_show"];

// Derive a gradient from a hex staff color
function staffGradient(hex: string): { from: string; to: string } {
  // darken the color ~20% for the "to" stop
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 40);
  const g = Math.max(0, ((n >> 8) & 0xff) - 40);
  const b = Math.max(0, (n & 0xff) - 40);
  return {
    from: hex,
    to: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`,
  };
}

interface CalendarEventProps {
  item: WorkItemWithRelations;
  compact?: boolean;
  onClick: (id: string) => void;
}

export function CalendarEvent({ item, compact = false, onClick }: CalendarEventProps) {
  const isEvent = (item as { type?: string }).type === "event";
  const isCancelled = CANCELLED_STATUSES.includes(item.status);

  const customerName = isEvent ? item.title : (item.customer?.full_name ?? "Sem cliente");
  const serviceName = isEvent ? (item.notes ?? "") : (item.service?.name ?? item.title);
  const staffInitials = item.assigned_staff ? getInitials(item.assigned_staff.name) : null;

  // Color source: staff color > status gradient
  const staffColor = item.assigned_staff?.color ?? null;
  const palette = STATUS_GRADIENTS[item.status];

  let fromColor: string;
  let toColor: string;
  let textColor: string;
  let accentColor: string;

  if (staffColor && !isCancelled) {
    const g = staffGradient(staffColor);
    fromColor = g.from;
    toColor = g.to;
    textColor = "#fff";
    accentColor = "rgba(255,255,255,0.65)";
  } else {
    fromColor = palette.from;
    toColor = palette.to;
    textColor = palette.text;
    accentColor = palette.accent;
  }

  const startTime = item.scheduled_start
    ? new Date(item.scheduled_start).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  const endTime = item.scheduled_end
    ? new Date(item.scheduled_end).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : null;

  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      className={cn(
        "w-full h-full text-left overflow-hidden rounded-lg transition-all duration-150 group relative",
        "focus:outline-none focus:ring-2 focus:ring-white/40",
        isCancelled ? "opacity-50" : "opacity-100",
        "hover:brightness-110 hover:scale-[1.01] active:scale-[0.99]"
      )}
      style={{
        background: isCancelled
          ? `linear-gradient(160deg, ${fromColor}, ${toColor})`
          : `linear-gradient(160deg, ${fromColor} 0%, ${toColor} 100%)`,
        boxShadow: isCancelled
          ? "none"
          : `0 2px 8px ${fromColor}55, inset 0 1px 0 rgba(255,255,255,0.15)`,
      }}
    >
      {/* Shine highlight at top */}
      {!isCancelled && (
        <div
          className="absolute inset-x-0 top-0 h-px rounded-t-lg"
          style={{ background: "rgba(255,255,255,0.35)" }}
        />
      )}

      {/* Diagonal gloss overlay */}
      {!isCancelled && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%)",
          }}
        />
      )}

      <div className="relative px-2 py-1.5 flex flex-col h-full min-h-0 gap-0.5">
        {/* Time range */}
        {startTime && (
          <span
            className="text-[10px] font-mono leading-none shrink-0 font-semibold"
            style={{ color: accentColor }}
          >
            {startTime}{endTime ? ` – ${endTime}` : ""}
          </span>
        )}

        {/* Customer name */}
        <span
          className={cn(
            "text-[11px] font-bold leading-tight truncate",
            isCancelled ? "line-through" : ""
          )}
          style={{ color: textColor }}
        >
          {customerName}
        </span>

        {/* Service name */}
        {!compact && serviceName && (
          <span
            className="text-[10px] leading-tight truncate"
            style={{ color: accentColor, opacity: 0.9 }}
          >
            {serviceName}
          </span>
        )}

        {/* Staff badge pinned to bottom-right */}
        {staffInitials && !compact && (
          <span
            className="absolute bottom-1 right-1.5 text-[9px] font-bold font-mono leading-none px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(0,0,0,0.25)",
              color: "#fff",
              backdropFilter: "blur(4px)",
            }}
          >
            {staffInitials}
          </span>
        )}
      </div>
    </button>
  );
}
