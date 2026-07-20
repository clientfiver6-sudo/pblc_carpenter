import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Staff } from "@/types/database";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

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

  const { data: rawStaff, error } = await supabase
    .from("staff")
    .select("*")
    .eq("id", id)
    .eq("business_id", bu.business_id)
    .single();

  if (error || !rawStaff) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const staff = rawStaff as Staff;

  return NextResponse.json({ staff });
}
