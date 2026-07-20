"use client";

import { cn } from "@/lib/utils";

export interface DayHours {
  open: boolean;
  start: string;
  end: string;
}

export type OpeningHours = Record<string, DayHours>;

interface OpeningHoursEditorProps {
  value: OpeningHours;
  onChange: (v: OpeningHours) => void;
}

const DAYS = [
  { key: "monday", label: "Seg" },
  { key: "tuesday", label: "Ter" },
  { key: "wednesday", label: "Qua" },
  { key: "thursday", label: "Qui" },
  { key: "friday", label: "Sex" },
  { key: "saturday", label: "Sáb" },
  { key: "sunday", label: "Dom" },
];

function buildTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
}

const TIME_OPTIONS = buildTimeOptions();

export default function OpeningHoursEditor({ value, onChange }: OpeningHoursEditorProps) {
  function getDay(key: string): DayHours {
    return value[key] ?? { open: false, start: "08:00", end: "18:00" };
  }

  function updateDay(key: string, patch: Partial<DayHours>) {
    onChange({ ...value, [key]: { ...getDay(key), ...patch } });
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {DAYS.map(({ key, label }, idx) => {
        const day = getDay(key);
        return (
          <div
            key={key}
            className={cn(
              "flex items-center gap-4 px-4 py-3",
              idx < DAYS.length - 1 && "border-b border-border"
            )}
          >
            {/* Day label */}
            <span className="w-10 text-sm font-semibold text-ink shrink-0">{label}</span>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => updateDay(key, { open: !day.open })}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:ring-offset-1",
                day.open ? "bg-brand" : "bg-border"
              )}
              aria-pressed={day.open}
              aria-label={`${label} ${day.open ? "aberto" : "fechado"}`}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200",
                  day.open ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>

            {/* Open label */}
            <span
              className={cn(
                "w-14 text-xs shrink-0 transition-colors",
                day.open ? "text-brand" : "text-ink-4"
              )}
            >
              {day.open ? "Aberto" : "Fechado"}
            </span>

            {/* Time selects */}
            <div
              className={cn(
                "flex items-center gap-2 transition-opacity",
                !day.open && "opacity-40 pointer-events-none"
              )}
            >
              <select
                value={day.start}
                onChange={(e) => updateDay(key, { start: e.target.value })}
                disabled={!day.open}
                className="border-border bg-surface text-ink rounded-md h-9 px-2 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <span className="text-xs text-ink-3">até</span>
              <select
                value={day.end}
                onChange={(e) => updateDay(key, { end: e.target.value })}
                disabled={!day.open}
                className="border-border bg-surface text-ink rounded-md h-9 px-2 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
