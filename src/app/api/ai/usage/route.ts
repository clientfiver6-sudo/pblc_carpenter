import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: buRaw } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", user.id)
      .single()
    const bu = buRaw as { business_id: string } | null
    if (!bu) return NextResponse.json({ error: "No business" }, { status: 403 })
    const businessId = bu.business_id

    const { allowed, resetAt } = await checkRateLimit(`ai_usage:${businessId}`, 60, 3_600_000)
    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: "Limite de requisições atingido. Tente novamente em breve." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      )
    }

    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get("days") ?? "30", 10)

    const admin = createAdminClient()

    const now = new Date()

    // Today boundaries
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    // Last 7 days
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Last 30 days (or custom days)
    const monthStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

    type UsageRow = {
      input_tokens: number
      output_tokens: number
      cost_usd_cents: number
      function_name: string
    }

    const [todayResult, weekResult, monthResult] = await Promise.all([
      admin
        .from("ai_usage_logs")
        .select("input_tokens, output_tokens, cost_usd_cents")
        .eq("business_id", businessId)
        .gte("created_at", todayStart),
      admin
        .from("ai_usage_logs")
        .select("input_tokens, output_tokens, cost_usd_cents")
        .eq("business_id", businessId)
        .gte("created_at", weekStart),
      admin
        .from("ai_usage_logs")
        .select("input_tokens, output_tokens, cost_usd_cents, function_name")
        .eq("business_id", businessId)
        .gte("created_at", monthStart),
    ])

    function aggregate(rows: UsageRow[]) {
      return rows.reduce(
        (acc, r) => ({
          input_tokens: acc.input_tokens + (r.input_tokens ?? 0),
          output_tokens: acc.output_tokens + (r.output_tokens ?? 0),
          cost_usd_cents: acc.cost_usd_cents + (r.cost_usd_cents ?? 0),
        }),
        { input_tokens: 0, output_tokens: 0, cost_usd_cents: 0 },
      )
    }

    const todayRows = (todayResult.data ?? []) as UsageRow[]
    const weekRows = (weekResult.data ?? []) as UsageRow[]
    const monthRows = (monthResult.data ?? []) as UsageRow[]

    // byFunction: aggregate over the full period
    const byFunctionMap: Record<string, { total_cost_usd_cents: number; call_count: number }> = {}
    for (const r of monthRows) {
      const fn = r.function_name
      if (!byFunctionMap[fn]) {
        byFunctionMap[fn] = { total_cost_usd_cents: 0, call_count: 0 }
      }
      byFunctionMap[fn].total_cost_usd_cents += r.cost_usd_cents ?? 0
      byFunctionMap[fn].call_count += 1
    }

    const byFunction = Object.entries(byFunctionMap)
      .map(([function_name, stats]) => ({ function_name, ...stats }))
      .sort((a, b) => b.total_cost_usd_cents - a.total_cost_usd_cents)

    return NextResponse.json({
      today: aggregate(todayRows),
      week: aggregate(weekRows),
      month: aggregate(monthRows),
      byFunction,
    })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
