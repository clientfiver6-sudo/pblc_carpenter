import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single();
  const bu = rawBu as { business_id: string } | null;

  if (!bu) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staffId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!staffId || !start || !end) {
    return NextResponse.json(
      { error: "Missing required params: staffId, start, end" },
      { status: 400 }
    );
  }

  const { data: rawItems, error } = await supabase
    .from("work_items")
    .select("*, customers(full_name), services(name)")
    .eq("business_id", bu.business_id)
    .eq("assigned_staff_id", staffId)
    .gte("scheduled_start", start)
    .lte("scheduled_start", end)
    .order("scheduled_start", { ascending: true });

  if (error) {
    console.error("api/staff/schedule: query error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  // Flatten joined relations into the shape StaffSchedule.tsx expects
  const items = ((rawItems ?? []) as Array<Record<string, unknown>>).map((item) => {
    const customer = item.customers as { full_name: string } | null;
    const service = item.services as { name: string } | null;
    return {
      id: item.id,
      title: item.title,
      scheduled_start: item.scheduled_start,
      scheduled_end: item.scheduled_end,
      status: item.status,
      customer_name: customer?.full_name ?? null,
      service_name: service?.name ?? null,
    };
  });

  return NextResponse.json(items);
}
