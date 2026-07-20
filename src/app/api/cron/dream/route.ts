import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { runNightlyDreaming } from "@/lib/ai/dreaming"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
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

  const { allowed, resetAt } = await checkRateLimit(`cron:dream`, 10, 60_000)
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  const admin = createAdminClient()
  const { data: rawBusinesses } = await admin
    .from("businesses")
    .select("id")
    .eq("onboarded", true)

  const businesses = rawBusinesses as Array<{ id: string }> | null
  if (!businesses || businesses.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  const results = await Promise.allSettled(
    businesses.map(b => runNightlyDreaming(b.id))
  )

  const summary = results.map((r, i) => ({
    businessId: businesses[i].id,
    status: r.status,
    ...(r.status === "fulfilled" ? r.value : { error: String((r as PromiseRejectedResult).reason) }),
  }))

  return NextResponse.json({ processed: businesses.length, summary })
}
