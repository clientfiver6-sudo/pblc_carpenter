import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendSubscriptionConfirmationEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionPastDueEmail,
} from "@/lib/email";
import { getPlatformConfig } from "@/lib/platform-config";
import { checkRateLimit } from "@/lib/rate-limit";
import { createHmac } from "crypto";

interface MpSubscriptionWebhookBody {
  action?: string;
  data?: { id?: string };
  type?: string;
}

interface MpPreapproval {
  id: string;
  status: string;
  external_reference: string | null;
  preapproval_plan_id?: string;
  next_payment_date?: string;
  payer_id?: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // IP-based rate limiting for webhook endpoints
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed: ipAllowed, resetAt: ipResetAt } = await checkRateLimit(`webhook:${ip}`, 1000, 3_600_000)
  if (!ipAllowed) {
    const retryAfter = Math.ceil((ipResetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  // Verify Mercado Pago signature if secret is configured
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    // Fail closed: without the secret we cannot verify the sender, and
    // accepting unsigned requests would let anyone change subscription state.
    console.error("[MP Sub Webhook] MERCADOPAGO_WEBHOOK_SECRET not configured — rejecting webhook");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  if (secret) {
    const xSignature = req.headers.get("x-signature") ?? "";
    const xRequestId = req.headers.get("x-request-id") ?? "";
    const tsMatch = xSignature.match(/ts=([^,]+)/);
    const v1Match = xSignature.match(/v1=([^,]+)/);
    if (!tsMatch || !v1Match) {
      console.warn("[MP Sub Webhook] Missing or malformed signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const ts = tsMatch[1];
    const receivedHash = v1Match[1];
    let dataId = "";
    try {
      const parsed = JSON.parse(rawBody) as MpSubscriptionWebhookBody;
      dataId = parsed.data?.id ?? "";
    } catch {
      // ignore — signature check will fail on empty manifest
    }
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts}`;
    const expectedHash = createHmac("sha256", secret).update(manifest).digest("hex");
    if (expectedHash !== receivedHash) {
      console.warn("[MP Sub Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: MpSubscriptionWebhookBody;
  try {
    body = JSON.parse(rawBody) as MpSubscriptionWebhookBody;
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // MP sends preapproval events for subscription changes
  if (body.type !== "preapproval" && body.action !== "updated") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const preapprovalId = body.data?.id;
  if (!preapprovalId) return NextResponse.json({ ok: true }, { status: 200 });

  const [platformToken, starterPlanId, proPlanId, medicalPlanId] = await Promise.all([
    getPlatformConfig("mercadopago_platform_access_token"),
    getPlatformConfig("mercadopago_starter_plan_id"),
    getPlatformConfig("mercadopago_pro_plan_id"),
    getPlatformConfig("mercadopago_medical_plan_id"),
  ]);

  if (!platformToken) {
    console.error("[SubWebhook] mercadopago_platform_access_token not configured in platform_config");
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Fetch full preapproval from MP to get current status
  let preapproval: MpPreapproval;
  try {
    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${platformToken}` },
    });
    if (!res.ok) throw new Error(`MP returned ${res.status}`);
    preapproval = (await res.json()) as MpPreapproval;
  } catch (err) {
    console.error("[SubWebhook] Failed to fetch preapproval:", err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const admin = createAdminClient();

  // Map MP status to our status
  let subscriptionStatus: string;
  if (preapproval.status === "authorized") {
    subscriptionStatus = "active";
  } else if (preapproval.status === "cancelled" || preapproval.status === "paused") {
    subscriptionStatus = "cancelled";
  } else if (preapproval.status === "pending") {
    subscriptionStatus = "past_due";
  } else {
    subscriptionStatus = preapproval.status;
  }

  // Derive plan from the preapproval_plan_id returned by MP
  let subscriptionPlan: string | undefined;
  if (preapproval.preapproval_plan_id) {
    if (preapproval.preapproval_plan_id === starterPlanId)       subscriptionPlan = "starter";
    else if (preapproval.preapproval_plan_id === proPlanId)      subscriptionPlan = "pro";
    else if (preapproval.preapproval_plan_id === medicalPlanId)  subscriptionPlan = "medical";
  }

  const updatePayload: Record<string, unknown> = {
    subscription_status: subscriptionStatus,
    mp_subscription_id: preapprovalId,
  };

  if (subscriptionPlan) {
    updatePayload.subscription_plan = subscriptionPlan;
  }

  if (preapproval.payer_id) {
    updatePayload.mp_subscription_payer_id = String(preapproval.payer_id);
  }

  if (subscriptionStatus === "active") {
    updatePayload.onboarded = true;
    if (preapproval.next_payment_date) {
      updatePayload.subscription_ends_at = preapproval.next_payment_date;
    }
  }

  // Find business by mp_subscription_id or external_reference.
  // external_reference is echoed back from data we set at checkout, but it
  // travels through MP — so before trusting it, confirm the business exists
  // and isn't already bound to a *different* preapproval.
  let query = admin.from("businesses").update(updatePayload as never);

  if (preapproval.external_reference) {
    const { data: targetBiz } = await admin
      .from("businesses")
      .select("id, mp_subscription_id")
      .eq("id", preapproval.external_reference)
      .maybeSingle();
    if (!targetBiz) {
      console.warn("[SubWebhook] external_reference does not match any business — ignoring", { preapprovalId });
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    const boundId = (targetBiz as { mp_subscription_id: string | null }).mp_subscription_id;
    if (boundId && boundId !== preapprovalId) {
      console.warn("[SubWebhook] external_reference points to a business bound to a different subscription — ignoring", { preapprovalId });
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    query = query.eq("id", preapproval.external_reference);
  } else {
    query = query.eq("mp_subscription_id", preapprovalId);
  }

  const { data: updatedBiz, error } = await query.select("id,name,subscription_ends_at").single();
  if (error) {
    console.error("[SubWebhook] DB update error:", error);
  }

  // Send transactional email on subscription status change
  if (updatedBiz && (subscriptionStatus === "active" || subscriptionStatus === "cancelled" || subscriptionStatus === "past_due")) {
    try {
      const biz = updatedBiz as { id: string; name: string; subscription_ends_at?: string }
      const { data: bu } = await admin
        .from("business_users")
        .select("user_id")
        .eq("business_id", biz.id)
        .eq("role", "owner")
        .single()
      if (bu) {
        const { data: authUser } = await admin.auth.admin.getUserById(bu.user_id)
        const email = authUser.user?.email
        if (email) {
          if (subscriptionStatus === "active") {
            await sendSubscriptionConfirmationEmail({
              to: email,
              businessName: biz.name,
              plan: subscriptionPlan === "medical" ? "Medical" : subscriptionPlan === "pro" ? "Pro" : "Starter",
              endsAt: biz.subscription_ends_at,
            })
          } else if (subscriptionStatus === "cancelled") {
            await sendSubscriptionCancelledEmail({
              to: email,
              businessName: biz.name,
              plan: subscriptionPlan === "medical" ? "Medical" : subscriptionPlan === "pro" ? "Pro" : "Starter",
            })
          } else if (subscriptionStatus === "past_due") {
            await sendSubscriptionPastDueEmail({
              to: email,
              businessName: biz.name,
              plan: subscriptionPlan === "medical" ? "Medical" : subscriptionPlan === "pro" ? "Pro" : "Starter",
            })
          }
        }
      }
    } catch {
      // Never block webhook on email failure
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
