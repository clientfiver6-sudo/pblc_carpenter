import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, resetAt } = await checkRateLimit(`equipment:${user.id}`, 100, 3_600_000);
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const body = await req.json();
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("equipment")
    .select("business_id")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", existing.business_id)
    .single();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await admin
    .from("equipment")
    .update({ ...body, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ equipment: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, resetAt } = await checkRateLimit(`equipment:${user.id}`, 100, 3_600_000);
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("equipment")
    .select("business_id")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", existing.business_id)
    .single();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await admin.from("equipment").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
