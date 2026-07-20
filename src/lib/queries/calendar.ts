import { createClient } from "@/lib/supabase/server";
import type { WorkItemWithRelations } from "@/types/database";
import { spToISO } from "@/lib/utils/brazil-time";

const CALENDAR_SELECT = `
  *,
  customer:customers(id, full_name, phone_number),
  service:services(id, name, duration_minutes),
  assigned_staff:staff(id, name, role, color)
`;

/**
 * Fetch work items with scheduled_start within the given week.
 * weekStart: "YYYY-MM-DD" — Monday of the target week (UTC-neutral date string)
 */
export async function getCalendarItems(
  businessId: string,
  weekStart: string,
  staffId?: string
): Promise<WorkItemWithRelations[]> {
  try {
    const supabase = await createClient();

    // Brazil is always UTC-3 (no DST since 2019).
    // Monday midnight SP → 7 days later.
    const weekStartUTC = new Date(spToISO(weekStart, "00:00"));
    const weekEndUTC   = new Date(weekStartUTC.getTime() + 7 * 24 * 60 * 60 * 1000);

    let query = supabase
      .from("work_items")
      .select(CALENDAR_SELECT)
      .eq("business_id", businessId)
      .gte("scheduled_start", weekStartUTC.toISOString())
      .lt("scheduled_start", weekEndUTC.toISOString())
      .order("scheduled_start", { ascending: true });

    if (staffId) {
      query = query.eq("assigned_staff_id", staffId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("getCalendarItems error:", error);
      return [];
    }

    return (data as WorkItemWithRelations[]) ?? [];
  } catch (err) {
    console.error("getCalendarItems unexpected error:", err);
    return [];
  }
}
