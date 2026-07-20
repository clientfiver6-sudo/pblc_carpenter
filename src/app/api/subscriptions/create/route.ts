import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformConfig } from "@/lib/platform-config";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { businessId?: string; plan?: string };
  const { businessId, plan = "pro" } = body;
  if (!businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

  // Verify user owns this business
  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", businessId)
    .single();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Guard against double-click: reject if already active
  const admin = createAdminClient();
  const { data: existingSub } = await admin
    .from("businesses")
    .select("mp_subscription_id, subscription_status")
    .eq("id", businessId)
    .single();
  if (existingSub?.mp_subscription_id && existingSub.subscription_status === "active") {
    return NextResponse.json({ error: "Já possui assinatura ativa" }, { status: 409 });
  }

  const { allowed, resetAt } = await checkRateLimit(`subscription:${user.id}`, 10, 3_600_000);
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const [platformToken, starterPlanId, proPlanId, medicalPlanId] = await Promise.all([
    getPlatformConfig("mercadopago_platform_access_token"),
    getPlatformConfig("mercadopago_starter_plan_id"),
    getPlatformConfig("mercadopago_pro_plan_id"),
    getPlatformConfig("mercadopago_medical_plan_id"),
  ]);

  const planId =
    plan === "starter" ? starterPlanId :
    plan === "medical" ? medicalPlanId :
    proPlanId;

  if (!platformToken || !planId) {
    return NextResponse.json({ error: "Subscription not configured" }, { status: 503 });
  }

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${platformToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      preapproval_plan_id: planId,
      payer_email: user.email,
      back_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings/subscription?sub=success`,
      external_reference: businessId,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Subscription] MP preapproval error:", text);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 502 });
  }

  const data = (await res.json()) as { id: string; init_point: string };

  await admin
    .from("businesses")
    .update({ mp_subscription_id: data.id, subscription_plan: plan } as never)
    .eq("id", businessId);

  return NextResponse.json({ url: data.init_point });
}
