// Refreshes WhatsApp long-lived tokens for businesses whose token is 50+ days old.
// WhatsApp tokens expire after 60 days; we refresh early so there's no lapse.
import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { safeDecryptToken, safeEncryptToken } from "@/lib/security/encrypt"

export const runtime = "nodejs"

interface BizRow {
  id: string
  whatsapp_token: string
  whatsapp_connected_at: string
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization") ?? ""
  const cronSecret = process.env.CRON_SECRET ?? ""
  const expected = `Bearer ${cronSecret}`
  if (
    !cronSecret ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { allowed, resetAt } = await checkRateLimit(`cron:whatsapp-refresh`, 10, 60_000)
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) {
    return NextResponse.json({ error: "Facebook app credentials not configured" }, { status: 500 })
  }

  const admin = createAdminClient()

  // Find businesses whose token is 50+ days old (10 day buffer before 60-day expiry)
  const fiftyDaysAgo = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString()
  const { data: businesses, error } = await admin
    .from("businesses")
    .select("id, whatsapp_token, whatsapp_connected_at")
    .not("whatsapp_token", "is", null)
    .lte("whatsapp_connected_at", fiftyDaysAgo)

  if (error) {
    console.error("[WA Refresh] DB query failed:", error)
    return NextResponse.json({ error: "DB error" }, { status: 500 })
  }

  const rows = (businesses ?? []) as BizRow[]
  let refreshed = 0
  let failed = 0

  for (const biz of rows) {
    try {
      const plainToken = safeDecryptToken(biz.whatsapp_token)
      if (!plainToken) {
        console.error(`[WA Refresh] Could not decrypt token for business ${biz.id}`)
        failed++
        continue
      }
      const res = await fetch(
        `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${plainToken}`
      )
      const data = await res.json() as { access_token?: string; error?: { message: string } }

      if (!data.access_token) {
        console.error(`[WA Refresh] Failed for business ${biz.id}:`, data.error?.message)
        failed++
        // Notify the business that WhatsApp disconnected
        try {
          await admin.from("notifications").insert({
            business_id: biz.id,
            type: "system",
            title: "WhatsApp desconectado",
            body: "Não foi possível renovar o token do WhatsApp. Reconecte em Configurações.",
            link: "/dashboard/settings/whatsapp",
            read: false,
            metadata: {},
          })
        } catch {
          // Non-fatal
        }
        continue
      }

      await admin
        .from("businesses")
        .update({
          whatsapp_token: safeEncryptToken(data.access_token),
          whatsapp_connected_at: new Date().toISOString(),
        } as never)
        .eq("id", biz.id)

      console.log(`[WA Refresh] Refreshed token for business ${biz.id}`)
      refreshed++
    } catch (err) {
      console.error(`[WA Refresh] Exception for business ${biz.id}:`, err)
      failed++
    }
  }

  return NextResponse.json({ ok: true, checked: rows.length, refreshed, failed })
}
