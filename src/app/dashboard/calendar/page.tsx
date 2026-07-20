import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScheduleCalendar } from "@/components/calendar/ScheduleCalendar";
import type { BusinessUser, Staff } from "@/types/database";

export const metadata = {
  title: "Calendário | RetornAI",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: initialDate } = await searchParams
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: rawBusinessUser } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single();
  const businessUser = rawBusinessUser as BusinessUser | null;

  if (!businessUser) redirect("/onboarding");

  const businessId = businessUser.business_id;

  // Fetch staff + business settings in parallel
  const [{ data: rawStaff }, { data: rawBiz }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, role, phone, email, working_hours, services, color, active, created_at, business_id")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("businesses")
      .select("settings")
      .eq("id", businessId)
      .single(),
  ]);

  const staffList = (rawStaff as Staff[] | null) ?? [];
  const biz = rawBiz as { settings: Record<string, unknown> } | null;
  const workingHoursText = (biz?.settings?.working_hours as string | undefined) ?? "";

  return (
    <div className="flex flex-col h-full px-4 sm:px-6 md:px-8 pt-7">
      <div className="mb-5 shrink-0">
        <h1 className="text-ink text-2xl font-bold tracking-tight">Calendário</h1>
        <p className="text-ink-3 text-sm mt-0.5">
          Visualize e gerencie seus agendamentos da semana.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <ScheduleCalendar
          businessId={businessId}
          staffList={staffList}
          workingHoursText={workingHoursText}
          initialDate={initialDate}
        />
      </div>
    </div>
  );
}
