import { NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { safeEncryptToken } from "@/lib/security/encrypt"
import { env } from "@/lib/env"

interface MpTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
  user_id: number
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const oauthError = searchParams.get("error")

  const paymentsUrl = `${env.NEXT_PUBLIC_APP_URL}/dashboard/settings/payments`

  if (oauthError || !code || !state) {
    return NextResponse.redirect(`${paymentsUrl}?mp=error`)
  }

  // Verify state token via Redis (CSRF protection)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${paymentsUrl}?mp=error`)

  let businessId: string
  const redis = getRedis()
  if (redis) {
    const stored = await redis.get<string>(`mp_oauth_state:${state}`)
    if (!stored) return NextResponse.redirect(`${paymentsUrl}?mp=error`)
    await redis.del(`mp_oauth_state:${state}`) // one-time use
    businessId = stored
  } else if (process.env.NODE_ENV === "production") {
    // No state store in production means we cannot validate the OAuth `state`
    // as one-time/origin-bound — fail closed rather than trust it as businessId.
    console.error("MP OAuth callback: Redis not configured in production — refusing to trust unverified state")
    return NextResponse.redirect(`${paymentsUrl}?mp=error`)
  } else {
    // Dev/local only: no Redis — fall back to the session ownership check below
    // (the business_users membership check still prevents cross-tenant writes).
    if (!state || state.length < 10) return NextResponse.redirect(`${paymentsUrl}?mp=error`)
    businessId = state
  }

  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", businessId)
    .single()
  if (!membership) return NextResponse.redirect(`${paymentsUrl}?mp=error`)

  if (!env.MERCADOPAGO_CLIENT_ID || !env.MERCADOPAGO_CLIENT_SECRET) {
    return NextResponse.redirect(`${paymentsUrl}?mp=error`)
  }

  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/integrations/mercadopago/callback`

  const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: env.MERCADOPAGO_CLIENT_ID,
      client_secret: env.MERCADOPAGO_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    console.error("MP OAuth token exchange failed:", await tokenRes.text())
    return NextResponse.redirect(`${paymentsUrl}?mp=error`)
  }

  const tokenData = (await tokenRes.json()) as MpTokenResponse
  const { access_token, refresh_token } = tokenData

  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from("businesses")
    .update({
      mercadopago_access_token: safeEncryptToken(access_token),
      mercadopago_refresh_token: safeEncryptToken(refresh_token ?? null),
    } as never)
    .eq("id", businessId)

  if (updateError) {
    console.error("Failed to save MP token:", updateError)
    return NextResponse.redirect(`${paymentsUrl}?mp=error`)
  }

  return NextResponse.redirect(`${paymentsUrl}?mp=connected`)
}
