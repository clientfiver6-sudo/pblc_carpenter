import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/types/database";

export async function GET(): Promise<NextResponse> {
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

  const { data: rawServices, error } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", bu.business_id)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("api/services: query error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const services = (rawServices as Service[] | null) ?? [];

  return NextResponse.json({ services });
}
