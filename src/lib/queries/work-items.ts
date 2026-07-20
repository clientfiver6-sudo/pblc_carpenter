import { createClient } from "@/lib/supabase/server";
import { addMinutes, parseISO } from "date-fns";
import type { WorkItemWithRelations } from "@/types/database";
import { spDayRange } from "@/lib/utils/brazil-time";

// Day-of-week keys matching the working_hours JSON shape
// e.g. { "mon": { "start": "09:00", "end": "18:00" }, ... }
type WeekdayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

interface DayHours {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

type WorkingHours = Partial<Record<WeekdayKey, DayHours>>;

/** Parse "HH:mm" into { hours, minutes } */
function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(":").map(Number);
  return { hours: hours ?? 0, minutes: minutes ?? 0 };
}

/** Format a Date into "HH:mm" in America/Sao_Paulo timezone */
function toSaoPauloTimeString(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Brazil eliminated DST in 2019 — always UTC-3.
function getSaoPauloDateBounds(dateStr: string): { startISO: string; endISO: string } {
  const { start, end } = spDayRange(dateStr)
  return { startISO: start, endISO: end }
}

/**
 * Get today's date string in America/Sao_Paulo timezone as "YYYY-MM-DD".
 */
function getTodaySaoPauloDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const WORK_ITEM_WITH_RELATIONS_SELECT = `
  id,business_id,customer_id,service_id,assigned_staff_id,
  title,description,status,scheduled_start,scheduled_end,
  price_estimate,final_price,payment_status,notes,created_at,updated_at,
  customer:customers(id,full_name,phone_number,status),
  service:services(id,name,duration_minutes,price),
  assigned_staff:staff(id,name,role)
`;

/**
 * Returns work items scheduled for today (midnight to 23:59 America/Sao_Paulo).
 */
export async function getTodayWorkItems(
  businessId: string
): Promise<WorkItemWithRelations[]> {
  try {
    const supabase = await createClient();
    const todayStr = getTodaySaoPauloDate();
    const { startISO, endISO } = getSaoPauloDateBounds(todayStr);

    const { data, error } = await supabase
      .from("work_items")
      .select(WORK_ITEM_WITH_RELATIONS_SELECT)
      .eq("business_id", businessId)
      .gte("scheduled_start", startISO)
      .lte("scheduled_start", endISO)
      .order("scheduled_start", { ascending: true });

    if (error) {
      console.error("getTodayWorkItems error:", error);
      return [];
    }

    return (data as WorkItemWithRelations[]) ?? [];
  } catch (err) {
    console.error("getTodayWorkItems unexpected error:", err);
    return [];
  }
}

/**
 * Returns work items starting in the next N hours.
 */
export async function getUpcomingWorkItems(
  businessId: string,
  hours = 24
): Promise<WorkItemWithRelations[]> {
  try {
    const supabase = await createClient();
    const now = new Date();
    const until = addMinutes(now, hours * 60);

    const { data, error } = await supabase
      .from("work_items")
      .select(WORK_ITEM_WITH_RELATIONS_SELECT)
      .eq("business_id", businessId)
      .gte("scheduled_start", now.toISOString())
      .lte("scheduled_start", until.toISOString())
      .order("scheduled_start", { ascending: true });

    if (error) {
      console.error("getUpcomingWorkItems error:", error);
      return [];
    }

    return (data as WorkItemWithRelations[]) ?? [];
  } catch (err) {
    console.error("getUpcomingWorkItems unexpected error:", err);
    return [];
  }
}

/**
 * Returns a single work item with all relations (customer, service, staff).
 */
export async function getWorkItemWithRelations(
  id: string
): Promise<WorkItemWithRelations | null> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("work_items")
      .select(WORK_ITEM_WITH_RELATIONS_SELECT)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code !== "PGRST116") {
        console.error("getWorkItemWithRelations error:", error);
      }
      return null;
    }

    return (data as WorkItemWithRelations) ?? null;
  } catch (err) {
    console.error("getWorkItemWithRelations unexpected error:", err);
    return null;
  }
}

/**
 * Returns available time slots ("HH:mm") for a given staff member on a given date,
 * accounting for their working hours and already-booked work items.
 *
 * Slots are generated at 30-minute intervals; a slot is unavailable if a booked
 * work item's window [start, start + service_duration) overlaps with
 * [slot, slot + requested_service_duration).
 */
export async function getAvailableSlots(
  businessId: string,
  staffId: string,
  serviceId: string,
  date: string // "YYYY-MM-DD"
): Promise<string[]> {
  try {
    const supabase = await createClient();

    // Load service to get duration
    const { data: rawService, error: serviceError } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", serviceId)
      .single();
    const service = rawService as { duration_minutes: number } | null;

    if (serviceError || !service) {
      console.error("getAvailableSlots service error:", serviceError);
      return [];
    }

    const serviceDuration = service.duration_minutes;

    // Load staff working hours
    const { data: rawStaffRow, error: staffError } = await supabase
      .from("staff")
      .select("working_hours")
      .eq("id", staffId)
      .single();
    const staffRow = rawStaffRow as { working_hours: WorkingHours } | null;

    if (staffError || !staffRow) {
      console.error("getAvailableSlots staff error:", staffError);
      return [];
    }

    // Determine the weekday key for the target date
    // parseISO gives midnight UTC; shift to SP to get the correct day-of-week
    const targetDateMidnightUTC = parseISO(date);
    const spDayOfWeek = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short",
    })
      .format(targetDateMidnightUTC)
      .toLowerCase()
      .slice(0, 3) as WeekdayKey;

    const workingHours = staffRow.working_hours;
    const dayHours = workingHours[spDayOfWeek];

    if (!dayHours) {
      // Staff does not work on this weekday
      return [];
    }

    // Load existing bookings for this staff on this date
    const { startISO, endISO } = getSaoPauloDateBounds(date);

    const { data: existingBookings, error: bookingsError } = await supabase
      .from("work_items")
      .select("scheduled_start, scheduled_end, service_id, service:services(duration_minutes)")
      .eq("assigned_staff_id", staffId)
      .eq("business_id", businessId)
      .gte("scheduled_start", startISO)
      .lte("scheduled_start", endISO)
      .not("status", "in", '("cancelled","no_show")');

    if (bookingsError) {
      console.error("getAvailableSlots bookings error:", bookingsError);
      return [];
    }

    // Build set of booked minute-offsets from midnight SP
    // Each booking occupies [bookingStart, bookingStart + duration)
    interface BookingRow {
      scheduled_start: string | null;
      scheduled_end: string | null;
      service_id: string | null;
      service: { duration_minutes: number } | null;
    }

    const bookedRanges: Array<{ startMin: number; endMin: number }> = [];

    for (const booking of (existingBookings ?? []) as BookingRow[]) {
      if (!booking.scheduled_start) continue;

      const bookingStartUTC = new Date(booking.scheduled_start);
      const bookingStartSP = toSaoPauloTimeString(bookingStartUTC);
      const { hours: bHours, minutes: bMins } = parseTime(bookingStartSP);
      const bookingStartMin = bHours * 60 + bMins;

      // Prefer scheduled_end; fall back to service duration
      let bookingDuration: number;
      if (booking.scheduled_end) {
        const bookingEndUTC = new Date(booking.scheduled_end);
        const bookingEndSP = toSaoPauloTimeString(bookingEndUTC);
        const { hours: eHours, minutes: eMins } = parseTime(bookingEndSP);
        bookingDuration = eHours * 60 + eMins - bookingStartMin;
      } else if (booking.service?.duration_minutes) {
        bookingDuration = booking.service.duration_minutes;
      } else {
        bookingDuration = 60; // conservative default
      }

      bookedRanges.push({
        startMin: bookingStartMin,
        endMin: bookingStartMin + bookingDuration,
      });
    }

    // Generate all 30-minute slots within working hours
    const { hours: workStartHours, minutes: workStartMinutes } = parseTime(
      dayHours.start
    );
    const { hours: workEndHours, minutes: workEndMinutes } = parseTime(
      dayHours.end
    );

    const workStartMin = workStartHours * 60 + workStartMinutes;
    const workEndMin = workEndHours * 60 + workEndMinutes;

    const availableSlots: string[] = [];
    const SLOT_INTERVAL = 30;

    for (
      let slotStart = workStartMin;
      slotStart + serviceDuration <= workEndMin;
      slotStart += SLOT_INTERVAL
    ) {
      const slotEnd = slotStart + serviceDuration;

      // Check overlap with any booked range
      const isOverlapping = bookedRanges.some(
        (booked) => slotStart < booked.endMin && slotEnd > booked.startMin
      );

      if (!isOverlapping) {
        const slotHours = Math.floor(slotStart / 60);
        const slotMins = slotStart % 60;
        const slotStr = `${String(slotHours).padStart(2, "0")}:${String(
          slotMins
        ).padStart(2, "0")}`;
        availableSlots.push(slotStr);
      }
    }

    return availableSlots;
  } catch (err) {
    console.error("getAvailableSlots unexpected error:", err);
    return [];
  }
}
