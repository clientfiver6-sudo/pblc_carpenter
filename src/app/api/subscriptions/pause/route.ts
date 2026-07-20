import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformConfig } from "@/lib/platform-config";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = (await req.json()) as { businessId?: string };
  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", businessId)
    .single();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { allowed, resetAt } = await checkRateLimit(`subscription:${user.id}`, 10, 3_600_000);
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const admin = createAdminClient();
  const { data: rawBiz } = await admin
    .from("businesses")
    .select("mp_subscription_id")
    .eq("id", businessId)
    .single();
  const biz = rawBiz as { mp_subscription_id: string | null } | null;

  if (!biz?.mp_subscription_id) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
  }

  const platformToken = await getPlatformConfig("mercadopago_platform_access_token");
  if (!platformToken) {
    return NextResponse.json({ error: "Subscription not configured" }, { status: 503 });
  }

  const res = await fetch(`https://api.mercadopago.com/preapproval/${biz.mp_subscription_id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${platformToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "paused" }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Subscription] MP pause error:", text);
    return NextResponse.json({ error: "Failed to pause subscription" }, { status: 502 });
  }

  await admin
    .from("businesses")
    .update({ subscription_status: "paused" } as never)
    .eq("id", businessId);

  return NextResponse.json({ ok: true });
}
