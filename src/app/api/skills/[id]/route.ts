import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { BusinessSkill } from "@/types/database";
import { checkRateLimit } from "@/lib/rate-limit";

async function getBusinessId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single();
  const bu = rawBu as { business_id: string } | null;

  return bu?.business_id ?? null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const businessId = await getBusinessId(supabase);

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, resetAt } = await checkRateLimit(`skills:${businessId}`, 100, 3_600_000);
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const { name, content } = body as { name?: string; content?: string };

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (content !== undefined) updateData.content = content;

  const { data: rawSkill, error } = await supabase
    .from("business_skills")
    .update(updateData as never)
    .eq("id", id)
    .eq("business_id", businessId)
    .select()
    .single();

  if (error) {
    console.error("api/skills PUT: update error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  const skill = rawSkill as BusinessSkill;
  return NextResponse.json({ skill });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const supabase = await createClient();
  const businessId = await getBusinessId(supabase);

  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, resetAt } = await checkRateLimit(`skills:${businessId}`, 100, 3_600_000);
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const { id } = await params;

  const { error } = await supabase
    .from("business_skills")
    .delete()
    .eq("id", id)
    .eq("business_id", businessId);

  if (error) {
    console.error("api/skills DELETE: delete error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
