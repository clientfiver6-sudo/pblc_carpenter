import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const businessId = searchParams.get("businessId");
  if (!customerId || !businessId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", businessId)
    .single();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("equipment")
    .select("*")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ equipment: data });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { businessId, customerId, name, brand, model, serialNumber, installationDate, location, condition, notes } = body;

  if (!businessId || !customerId || !name) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", businessId)
    .single();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { allowed, resetAt } = await checkRateLimit(`equipment:${user.id}`, 100, 3_600_000);
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("equipment")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      name,
      brand: brand ?? null,
      model: model ?? null,
      serial_number: serialNumber ?? null,
      installation_date: installationDate ?? null,
      location: location ?? null,
      condition: condition ?? "good",
      notes: notes ?? null,
    } as never)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ equipment: data }, { status: 201 });
}
