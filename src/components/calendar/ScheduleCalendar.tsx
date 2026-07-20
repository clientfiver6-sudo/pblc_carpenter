"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, ChevronDown, Wrench, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarEvent } from "./CalendarEvent";
import { StaffFilter } from "./StaffFilter";
import { WorkItemDetail } from "@/components/work-items/WorkItemDetail";
import { createClient } from "@/lib/supabase/client";
import type { WorkItemWithRelations, Staff } from "@/types/database";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { CalendarEventModal } from "./CalendarEventModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_START_HOUR = 8;   // 08:00
const DAY_END_HOUR = 20;    // 20:00
const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60; // 720 min
const SLOT_HEIGHT_PX = 48;  // height of each 30-min slot
const TOTAL_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * 2; // 24 slots

// ─── Working hours parser ─────────────────────────────────────────────────────

export interface DayHours {
  open: boolean;
  startMin: number; // minutes since DAY_START_HOUR
  endMin: number;
}

// Maps normalised Portuguese day names → JS weekday (0=Sun, 1=Mon … 6=Sat)
const PT_DAY: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, terca_feira: 2,
  quarta: 3, quarta_feira: 3, quinta: 4, quinta_feira: 4,
  sexta: 5, sexta_feira: 5, sabado: 6,
};

function normDay(s: string): string {
  return s.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]/g, "_");
}

export function parseWorkingHoursText(text: string): Record<number, DayHours> {
  const result: Record<number, DayHours> = {};
  if (!text) return result;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;

    const dayPart = normDay(line.slice(0, colon));
    const hoursPart = line.slice(colon + 1).trim().toLowerCase();

    // Resolve days for this line
    const days: number[] = [];
    const rangeMatch = dayPart.match(/^(.+?)_a_(.+)$/);
    if (rangeMatch) {
      const from = PT_DAY[rangeMatch[1]!];
      const to = PT_DAY[rangeMatch[2]!];
      // Walk Mon→Sun order: 1 2 3 4 5 6 0
      const order = [1, 2, 3, 4, 5, 6, 0];
      const fi = order.indexOf(from ?? -1);
      const ti = order.indexOf(to ?? -1);
      if (fi !== -1 && ti !== -1 && fi <= ti) {
        for (let i = fi; i <= ti; i++) days.push(order[i]!);
      }
    } else {
      const d = PT_DAY[dayPart];
      if (d !== undefined) days.push(d);
    }
    if (days.length === 0) continue;

    if (/fech/.test(hoursPart)) {
      for (const d of days) result[d] = { open: false, startMin: 0, endMin: 0 };
      continue;
    }

    const m = hoursPart.match(/(\d+)h?(?::(\d+))?\s*(?:às|as|ao|[-–—])\s*(\d+)h?(?::(\d+))?/);
    if (m) {
      const startH = parseInt(m[1]!, 10);
      const startMn = parseInt(m[2] ?? "0", 10);
      const endH = parseInt(m[3]!, 10);
      const endMn = parseInt(m[4] ?? "0", 10);
      const startMin = (startH - DAY_START_HOUR) * 60 + startMn;
      const endMin = (endH - DAY_START_HOUR) * 60 + endMn;
      for (const d of days) result[d] = { open: true, startMin, endMin };
    }
  }
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SP_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const SP_WEEKDAY_FORMAT = new Intl.DateTimeFormat("en", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
});

/** "YYYY-MM-DD" for a Date in America/Sao_Paulo timezone */
function toDateString(date: Date): string {
  return SP_DATE_FORMAT.format(date);
}

const DAY_FROM_MONDAY: Record<string, number> = {
  Sun: 6, Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5,
};

/**
 * Get Monday of the week containing `date`, expressed as a Date whose
 * UTC midnight corresponds to that Monday in SP timezone.
 */
function getWeekStart(date: Date): Date {
  const spDateStr = SP_DATE_FORMAT.format(date); // "YYYY-MM-DD"
  const weekdayShort = SP_WEEKDAY_FORMAT.format(date); // "Mon", "Tue", …
  const daysFromMonday = DAY_FROM_MONDAY[weekdayShort] ?? 0;

  const [y, m, d] = spDateStr.split("-").map(Number);
  // Use noon UTC so SP_DATE_FORMAT.format() always returns the correct SP date
  // (UTC midnight = 9pm the *previous* day in SP, which would shift all columns by -1)
  const mondayUTC = new Date(Date.UTC(y!, m! - 1, d! - daysFromMonday, 12, 0, 0));
  return mondayUTC;
}

/**
 * Returns minutes since DAY_START_HOUR (08:00) in America/Sao_Paulo.
 * Negative means before the window; > TOTAL_MINUTES means after.
 */
function getSaoPauloMinutesSince8am(isoString: string): number {
  const date = new Date(isoString);
  const spTime = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hStr, mStr] = spTime.split(":");
  const hours = parseInt(hStr ?? "0", 10);
  const mins = parseInt(mStr ?? "0", 10);
  return (hours - DAY_START_HOUR) * 60 + mins;
}

/** Format a Date to SP date string "YYYY-MM-DD" */
function toSaoPauloDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Check if a work item's scheduled_start falls on a given calendar date (in SP timezone) */
function itemIsOnDate(item: WorkItemWithRelations, dateStr: string): boolean {
  if (!item.scheduled_start) return false;
  return toSaoPauloDateString(new Date(item.scheduled_start)) === dateStr;
}

// ─── Overlap layout ───────────────────────────────────────────────────────────

interface LayoutEvent {
  item: WorkItemWithRelations;
  column: number;
  totalColumns: number;
  top: number;   // px
  height: number; // px
}

function layoutEvents(items: WorkItemWithRelations[]): LayoutEvent[] {
  if (items.length === 0) return [];

  // Sort by start time
  const sorted = [...items].filter((i) => i.scheduled_start).sort(
    (a, b) =>
      new Date(a.scheduled_start!).getTime() -
      new Date(b.scheduled_start!).getTime()
  );

  // Assign columns via overlap detection
  const result: LayoutEvent[] = [];
  const groups: WorkItemWithRelations[][] = [];

  for (const item of sorted) {
    const startMin = getSaoPauloMinutesSince8am(item.scheduled_start!);
    let durationMin = 120;
    if (item.scheduled_end) {
      durationMin = getSaoPauloMinutesSince8am(item.scheduled_end) - startMin;
      if (durationMin <= 0) durationMin = 120;
    } else if (item.service?.duration_minutes) {
      durationMin = item.service.duration_minutes;
    }

    const endMin = startMin + durationMin;
    const top = (Math.max(0, startMin) / TOTAL_MINUTES) * (TOTAL_SLOTS * SLOT_HEIGHT_PX);
    const height = Math.max(
      (Math.min(durationMin, TOTAL_MINUTES - Math.max(0, startMin)) / TOTAL_MINUTES) *
        (TOTAL_SLOTS * SLOT_HEIGHT_PX),
      SLOT_HEIGHT_PX / 2
    );

    // Find group(s) this item overlaps with
    let placed = false;
    for (const group of groups) {
      const overlaps = group.some((g) => {
        const gStart = getSaoPauloMinutesSince8am(g.scheduled_start!);
        let gDur = 120;
        if (g.scheduled_end) {
          gDur = getSaoPauloMinutesSince8am(g.scheduled_end) - gStart;
          if (gDur <= 0) gDur = 120;
        } else if (g.service?.duration_minutes) {
          gDur = g.service.duration_minutes;
        }
        const gEnd = gStart + gDur;
        return startMin < gEnd && endMin > gStart;
      });

      if (overlaps) {
        group.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push([item]);
    }

    result.push({ item, column: 0, totalColumns: 1, top, height });
  }

  // Assign column positions within each group
  for (const group of groups) {
    const n = group.length;
    group.forEach((item, colIdx) => {
      const ev = result.find((r) => r.item.id === item.id);
      if (ev) {
        ev.column = colIdx;
        ev.totalColumns = n;
      }
    });
  }

  return result;
}

// ─── Time labels ──────────────────────────────────────────────────────────────

function TimeLabels() {
  const labels: string[] = [];
  for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
    labels.push(`${String(h).padStart(2, "0")}:00`);
    labels.push("");
  }

  return (
    <div
      className="flex flex-col shrink-0 w-14"
      style={{ height: TOTAL_SLOTS * SLOT_HEIGHT_PX }}
    >
      {labels.map((label, i) => (
        <div
          key={i}
          className="flex items-start justify-end pr-2 text-[10px] font-mono text-ink-4 leading-none shrink-0"
          style={{ height: SLOT_HEIGHT_PX }}
        >
          {label && <span className="-mt-1.5">{label}</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Day column ───────────────────────────────────────────────────────────────

interface DayColumnProps {
  date: Date;
  items: WorkItemWithRelations[];
  onEventClick: (id: string) => void;
  onSlotClick: (day: Date, slotIndex: number) => void;
  currentTimeMinutes: number | null;
  dayHours?: DayHours;
}

function DayColumn({ date, items, onEventClick, onSlotClick, currentTimeMinutes, dayHours }: DayColumnProps) {
  const dateStr = toDateString(date);
  const dayItems = items.filter((i) => itemIsOnDate(i, dateStr));
  const layouted = layoutEvents(dayItems);
  const totalHeight = TOTAL_SLOTS * SLOT_HEIGHT_PX;

  // Compute closed overlays: before open, after close, or full day if closed
  const closedRanges: Array<{ topPx: number; heightPx: number }> = [];
  if (dayHours) {
    if (!dayHours.open) {
      closedRanges.push({ topPx: 0, heightPx: totalHeight });
    } else {
      const clampedStart = Math.max(0, dayHours.startMin);
      const clampedEnd = Math.min(TOTAL_MINUTES, dayHours.endMin);
      if (clampedStart > 0) {
        closedRanges.push({
          topPx: 0,
          heightPx: (clampedStart / TOTAL_MINUTES) * totalHeight,
        });
      }
      if (clampedEnd < TOTAL_MINUTES) {
        const top = (clampedEnd / TOTAL_MINUTES) * totalHeight;
        closedRanges.push({ topPx: top, heightPx: totalHeight - top });
      }
    }
  }

  return (
    <div className="relative flex-1 min-w-0" style={{ height: totalHeight }}>
      {/* Closed-hours overlay (behind slots) */}
      {closedRanges.map((r, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 pointer-events-none z-0"
          style={{
            top: r.topPx,
            height: r.heightPx,
            background: "repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(0,0,0,0.025) 6px, rgba(0,0,0,0.025) 12px)",
            backgroundColor: "rgba(0,0,0,0.04)",
          }}
        />
      ))}

      {/* Grid lines — clickable slots */}
      {Array.from({ length: TOTAL_SLOTS }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSlotClick(date, i)}
          className="absolute left-0 right-0 border-b border-border/50 w-full cursor-pointer hover:bg-tint/30 transition-colors group"
          style={{ top: i * SLOT_HEIGHT_PX, height: SLOT_HEIGHT_PX }}
          aria-label={`Criar agendamento às ${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 === 0 ? "00" : "30"}`}
        >
          <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <Plus className="h-3 w-3 text-brand/50" />
          </span>
        </button>
      ))}

      {/* Hour lines (darker) */}
      {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-b border-border"
          style={{ top: i * SLOT_HEIGHT_PX * 2, height: 0 }}
        />
      ))}

      {/* Current time indicator */}
      {currentTimeMinutes !== null &&
        currentTimeMinutes >= 0 &&
        currentTimeMinutes <= TOTAL_MINUTES && (
          <div
            className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
            style={{
              top: (currentTimeMinutes / TOTAL_MINUTES) * totalHeight - 1,
            }}
          >
            <div className="w-2 h-2 rounded-full bg-brand -ml-1 shrink-0" />
            <div className="h-px bg-brand flex-1" />
          </div>
        )}

      {/* Events */}
      {layouted.map(({ item, column, totalColumns, top, height }) => {
        const colWidth = 100 / totalColumns;
        return (
          <div
            key={item.id}
            className="absolute z-10 p-0.5"
            style={{
              top,
              height,
              left: `${column * colWidth}%`,
              width: `${colWidth}%`,
            }}
          >
            <CalendarEvent
              item={item}
              compact={height < SLOT_HEIGHT_PX}
              onClick={onEventClick}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Mobile list view ─────────────────────────────────────────────────────────

function MobileListView({
  weekDays,
  items,
  onEventClick,
}: {
  weekDays: Date[];
  items: WorkItemWithRelations[];
  onEventClick: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {weekDays.map((day) => {
        const dateStr = toDateString(day);
        const dayItems = items
          .filter((i) => itemIsOnDate(i, dateStr))
          .sort(
            (a, b) =>
              new Date(a.scheduled_start ?? 0).getTime() -
              new Date(b.scheduled_start ?? 0).getTime()
          );
        const isToday = isSameDay(day, new Date());

        return (
          <div key={dateStr}>
            <div
              className={cn(
                "text-xs font-semibold uppercase tracking-wide mb-2 px-1",
                isToday ? "text-brand" : "text-ink-3"
              )}
            >
              {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
              {isToday && (
                <span className="ml-2 text-[10px] bg-tint text-brand px-1.5 py-0.5 rounded-full">
                  Hoje
                </span>
              )}
            </div>
            {dayItems.length === 0 ? (
              <div className="text-ink-4 text-xs px-2 py-3 rounded-lg border border-border text-center">
                Nenhum agendamento
              </div>
            ) : (
              <div className="space-y-1.5">
                {dayItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onEventClick(item.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-border bg-surface hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-medium truncate">
                          {item.customer?.full_name ?? "Sem cliente"}
                        </p>
                        <p className="text-ink-3 text-xs truncate">
                          {item.service?.name ?? item.title}
                        </p>
                      </div>
                      {item.scheduled_start && (
                        <span className="text-xs font-mono text-ink-3 shrink-0">
                          {new Date(item.scheduled_start).toLocaleTimeString(
                            "pt-BR",
                            {
                              timeZone: "America/Sao_Paulo",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            }
                          )}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-8 bg-surface-2" />
        ))}
      </div>
      <div className="flex gap-2">
        <Skeleton className="w-14 h-[600px] bg-surface-2" />
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-[600px] bg-surface-2" />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ScheduleCalendarProps {
  businessId: string;
  staffList: Staff[];
  workingHoursText?: string;
  initialDate?: string; // YYYY-MM-DD — open to the week containing this date
}

export function ScheduleCalendar({ businessId, staffList, workingHoursText = "", initialDate }: ScheduleCalendarProps) {
  const parsedHours = parseWorkingHoursText(workingHoursText);
  const router = useRouter();

  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    if (initialDate) {
      // Use noon so no timezone edge cases shift the date
      return getWeekStart(new Date(`${initialDate}T12:00:00`));
    }
    return getWeekStart(new Date());
  });
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [items, setItems] = useState<WorkItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkItemId, setSelectedWorkItemId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number | null>(null);

  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const [eventModalOpen, setEventModalOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click-outside
  useEffect(() => {
    if (!newMenuOpen) return;
    function handler(e: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [newMenuOpen]);

  // Compute current time indicator
  useEffect(() => {
    function update() {
      const now = new Date();
      const spTime = now.toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const [hStr, mStr] = spTime.split(":");
      const hours = parseInt(hStr ?? "0", 10);
      const mins = parseInt(mStr ?? "0", 10);
      setCurrentTimeMinutes((hours - DAY_START_HOUR) * 60 + mins);
    }
    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current && currentTimeMinutes !== null && currentTimeMinutes > 0) {
      const totalHeight = TOTAL_SLOTS * SLOT_HEIGHT_PX;
      const scrollTo =
        (currentTimeMinutes / TOTAL_MINUTES) * totalHeight - 200;
      scrollRef.current.scrollTop = Math.max(0, scrollTo);
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch data when week or staff filter changes
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const weekStartStr = toDateString(currentWeekStart);
      // Compute week end (Sunday)
      const weekEndDate = addDays(currentWeekStart, 7);
      const weekEndStr = toDateString(weekEndDate);

      // Build SP-midnight UTC bounds for the week
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      const getSpMidnightUTC = (dateStr: string): Date => {
        const [y, mo, d] = dateStr.split("-").map(Number);
        for (const offset of [3, 2, 4]) {
          const candidate = new Date(
            Date.UTC(y!, mo! - 1, d!, offset, 0, 0, 0)
          );
          if (formatter.format(candidate) === dateStr) return candidate;
        }
        return new Date(`${dateStr}T03:00:00.000Z`);
      };

      const startUTC = getSpMidnightUTC(weekStartStr);
      const endUTC = new Date(getSpMidnightUTC(weekEndStr).getTime() - 1);

      const supabase = createClient();
      let query = supabase
        .from("work_items")
        .select(
          `
          *,
          customer:customers(id, full_name, phone_number),
          service:services(id, name, duration_minutes),
          assigned_staff:staff(id, name, role, color)
          `
        )
        .eq("business_id", businessId)
        .gte("scheduled_start", startUTC.toISOString())
        .lte("scheduled_start", endUTC.toISOString())
        .order("scheduled_start", { ascending: true });

      if (selectedStaffId) {
        query = query.eq("assigned_staff_id", selectedStaffId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("ScheduleCalendar fetch error:", error);
        setItems([]);
      } else {
        setItems((data as WorkItemWithRelations[]) ?? []);
      }
    } catch (err) {
      console.error("ScheduleCalendar unexpected error:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [businessId, currentWeekStart, selectedStaffId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Navigation
  function goToPrevWeek() {
    setCurrentWeekStart((d) => addDays(d, -7));
  }
  function goToNextWeek() {
    setCurrentWeekStart((d) => addDays(d, 7));
  }
  function goToToday() {
    const today = new Date();
    setCurrentWeekStart(getWeekStart(today));
    setSelectedDay(today);
  }

  function handleEventClick(id: string) {
    setSelectedWorkItemId(id);
    setDetailOpen(true);
  }

  function handleSlotClick(day: Date, slotIndex: number) {
    const hours = 8 + Math.floor(slotIndex / 2);
    const minutes = slotIndex % 2 === 0 ? "00" : "30";
    const dateStr = SP_DATE_FORMAT.format(day);
    const timeStr = `${String(hours).padStart(2, "0")}:${minutes}`;
    router.push(`/dashboard/work-items/new?date=${dateStr}&time=${timeStr}`);
  }

  // Build the 7 days of the week
  const weekDays = Array.from({ length: 7 }).map((_, i) =>
    addDays(currentWeekStart, i)
  );

  // For day view, show only the selected day
  const visibleDays = viewMode === "week" ? weekDays : [selectedDay];

  // Week label
  const weekEnd = addDays(currentWeekStart, 6);
  const weekLabel =
    format(currentWeekStart, "d 'de' MMM", { locale: ptBR }) +
    " – " +
    format(weekEnd, "d 'de' MMM yyyy", { locale: ptBR });

  // Is the current week the one being shown?
  const isCurrentWeek = isSameDay(currentWeekStart, getWeekStart(new Date()));

  const DAY_NAMES_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  const today = new Date();

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        {/* Left: nav */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-border bg-surface text-ink-3 hover:text-ink hover:bg-surface-2"
            onClick={goToPrevWeek}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-ink text-sm font-medium min-w-[180px] text-center">
            {weekLabel}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-border bg-surface text-ink-3 hover:text-ink hover:bg-surface-2"
            onClick={goToNextWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {!isCurrentWeek && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs border-border bg-surface text-ink-2 hover:text-ink hover:bg-surface-2"
              onClick={goToToday}
            >
              Hoje
            </Button>
          )}
        </div>

        {/* Right: view toggle + staff filter + new button */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex border border-border rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "px-3 h-8 text-xs transition-colors",
                viewMode === "week"
                  ? "bg-ink text-white"
                  : "text-ink-2 hover:bg-surface-2"
              )}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={cn(
                "px-3 h-8 text-xs transition-colors border-l border-border",
                viewMode === "day"
                  ? "bg-ink text-white"
                  : "text-ink-2 hover:bg-surface-2"
              )}
            >
              Dia
            </button>
          </div>

          {/* Staff filter */}
          {staffList.length > 0 && (
            <StaffFilter
              staffList={staffList}
              selectedStaffId={selectedStaffId}
              onChange={setSelectedStaffId}
            />
          )}

          {/* New button — dropdown */}
          <div ref={newMenuRef} className="relative">
            <Button
              size="sm"
              className="h-8 text-xs hover:opacity-90 text-white font-medium gap-1.5"
              style={{ background: "var(--brand-grad)" }}
              onClick={() => setNewMenuOpen((v) => !v)}
            >
              <Plus className="h-3.5 w-3.5" />
              Novo
              <ChevronDown className="h-3 w-3 ml-0.5 opacity-80" />
            </Button>

            {newMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-border bg-surface overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
                <button
                  type="button"
                  onClick={() => { setNewMenuOpen(false); router.push("/dashboard/work-items?new=1") }}
                  className="flex items-center gap-3 px-3.5 py-2.5 text-sm text-ink hover:bg-surface-2 transition-colors w-full text-left"
                >
                  <Wrench className="h-3.5 w-3.5 text-ink-3 shrink-0" />
                  Chamado
                </button>
                <button
                  type="button"
                  onClick={() => { setNewMenuOpen(false); setEventModalOpen(true) }}
                  className="flex items-center gap-3 px-3.5 py-2.5 text-sm text-ink hover:bg-surface-2 transition-colors w-full text-left border-t border-border"
                >
                  <CalendarDays className="h-3.5 w-3.5 text-ink-3 shrink-0" />
                  Outro Evento
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Loading state ── */}
      {loading && <CalendarSkeleton />}

      {/* ── Mobile list view (hidden on md+) ── */}
      {!loading && (
        <div className="md:hidden">
          <MobileListView
            weekDays={weekDays}
            items={items}
            onEventClick={handleEventClick}
          />
        </div>
      )}

      {/* ── Week grid (hidden on mobile) ── */}
      {!loading && (
        <div className="hidden md:flex flex-col flex-1 min-h-0">
          {/* Day header row */}
          <div className="flex shrink-0 border-b border-border">
            {/* Spacer for time labels */}
            <div className="w-14 shrink-0" />

            {/* Day headers */}
            {visibleDays.map((day) => {
              const isToday = isSameDay(day, today);
              const dayIndex = (day.getDay() + 6) % 7; // 0=Mon … 6=Sun
              const isSelectedDay = viewMode === "day" && isSameDay(day, selectedDay);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => {
                    setSelectedDay(day);
                    if (viewMode === "week") setViewMode("day");
                  }}
                  className={cn(
                    "flex-1 py-2 text-center transition-colors min-w-0",
                    isToday ? "bg-tint/30" : "",
                    isSelectedDay ? "border-b-2 border-brand" : ""
                  )}
                >
                  <div
                    className={cn(
                      "text-[10px] uppercase tracking-wide font-semibold",
                      isToday ? "text-brand" : "text-ink-3"
                    )}
                  >
                    {viewMode === "week" ? DAY_NAMES_SHORT[dayIndex] : format(day, "EEEE", { locale: ptBR })}
                  </div>
                  <div
                    className={cn(
                      "text-base font-bold mt-0.5 mx-auto w-7 h-7 rounded-full flex items-center justify-center",
                      isToday
                        ? "bg-ink text-white"
                        : "text-ink"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Scrollable grid */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overflow-x-auto"
          >
            <div className="flex min-w-0" style={{ minHeight: TOTAL_SLOTS * SLOT_HEIGHT_PX }}>
              {/* Time labels */}
              <TimeLabels />

              {/* Day columns */}
              {visibleDays.map((day) => {
                const isToday = isSameDay(day, today);
                const jsWeekday = day.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "flex-1 relative border-l border-border min-w-0",
                      isToday ? "bg-tint/[0.02]" : ""
                    )}
                  >
                    <DayColumn
                      date={day}
                      items={items}
                      onEventClick={handleEventClick}
                      onSlotClick={handleSlotClick}
                      currentTimeMinutes={isToday ? currentTimeMinutes : null}
                      dayHours={parsedHours[jsWeekday]}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Work item detail sheet ── */}
      <WorkItemDetail
        workItemId={selectedWorkItemId}
        open={detailOpen}
        hideActions
        onClose={() => {
          setDetailOpen(false);
          void fetchData();
        }}
      />

      {/* ── Calendar event modal ── */}
      <CalendarEventModal
        open={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onCreated={() => void fetchData()}
      />
    </div>
  );
}
