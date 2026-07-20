import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BusinessSkill } from "@/types/database";
import { checkRateLimit } from "@/lib/rate-limit";

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

  if (!bu?.business_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: rawSkills, error } = await admin
    .from("business_skills")
    .select("*")
    .eq("business_id", bu.business_id)
    .eq("active", true)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("api/skills GET: query error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const skills = (rawSkills as BusinessSkill[] | null) ?? [];
  return NextResponse.json({ skills });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  if (!bu?.business_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { allowed, resetAt } = await checkRateLimit(`skills:${user.id}`, 100, 3_600_000);
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const body = await request.json();
  const { name, content } = body as { name: string; content: string };

  if (!name || !content) {
    return NextResponse.json({ error: "name and content are required" }, { status: 400 });
  }

  const { data: rawSkill, error } = await supabase
    .from("business_skills")
    .insert({
      business_id: bu.business_id,
      name,
      content,
      active: true,
      order_index: 0,
    } as never)
    .select()
    .single();

  if (error) {
    console.error("api/skills POST: insert error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const skill = rawSkill as BusinessSkill;
  return NextResponse.json({ skill }, { status: 201 });
}
