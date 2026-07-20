import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { Redis } from "@upstash/redis"
import { createClient } from "@/lib/supabase/server"
import { env } from "@/lib/env"

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

export async function GET() {
  if (!env.MERCADOPAGO_CLIENT_ID) {
    return NextResponse.json({ error: "MERCADOPAGO_CLIENT_ID not configured" }, { status: 500 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL("/login", env.NEXT_PUBLIC_APP_URL))

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const bu = rawBu as { business_id: string } | null
  if (!bu?.business_id) {
    return NextResponse.json({ error: "Negócio não encontrado" }, { status: 404 })
  }

  // Generate a random, unguessable state token and store it in Redis for 10 min
  let state: string = randomUUID()
  const redis = getRedis()
  if (redis) {
    await redis.set(`mp_oauth_state:${state}`, bu.business_id, { ex: 600 })
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed: without a server-side state store the OAuth flow has no
    // CSRF protection in production.
    console.error("[MP OAuth] Upstash not configured in production — refusing to start OAuth flow without CSRF state store")
    return NextResponse.json({ error: "Serviço temporariamente indisponível" }, { status: 503 })
  } else {
    // Dev/local only: callback resolves businessId from state directly and
    // re-verifies session membership, so pass the business id as state.
    console.warn("[MP OAuth] Upstash not configured — dev fallback, state carries businessId")
    state = bu.business_id
  }

  const redirectUri = `${env.NEXT_PUBLIC_APP_URL}/api/integrations/mercadopago/callback`

  const authUrl = new URL("https://auth.mercadopago.com.br/authorization")
  authUrl.searchParams.set("client_id", env.MERCADOPAGO_CLIENT_ID)
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("platform_id", "mp")
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("state", state)

  return NextResponse.redirect(authUrl.toString())
}
