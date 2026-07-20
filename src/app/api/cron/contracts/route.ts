// Daily cron: auto-schedule work items from active maintenance contracts.
// Runs for contracts where auto_schedule=true and next_due_at <= now,
// then advances next_due_at by the contract frequency.
import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const FREQUENCY_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
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

  const { allowed, resetAt } = await checkRateLimit("cron:contracts", 10, 60_000)
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  const admin = createAdminClient()
  const now = new Date()
  const results = { scheduled: 0, errors: 0 }

  const { data: dueContracts, error: fetchError } = await admin
    .from("maintenance_contracts")
    .select("id, business_id, customer_id, service_id, title, frequency, price, auto_invoice")
    .eq("active", true)
    .eq("auto_schedule", true)
    .lte("next_due_at", now.toISOString())

  if (fetchError) {
    console.error("[cron/contracts] Failed to fetch due contracts:", fetchError)
    return NextResponse.json({ ok: false, error: fetchError.message }, { status: 500 })
  }

  for (const contract of dueContracts ?? []) {
    try {
      const { error: insertError } = await admin.from("work_items").insert({
        business_id: contract.business_id,
        customer_id: contract.customer_id,
        service_id: contract.service_id ?? null,
        type: "service",
        title: contract.title,
        status: "pending",
        payment_status: contract.auto_invoice ? "pending" : "unpaid",
        price_estimate: contract.price ?? null,
        metadata: { from_contract_id: contract.id },
      } as never)

      if (insertError) {
        console.error("[cron/contracts] Failed to insert work item:", { contractId: contract.id, error: insertError })
        results.errors++
        continue
      }

      // Advance next_due_at by frequency
      const months = FREQUENCY_MONTHS[contract.frequency] ?? 1
      const nextDue = new Date(now)
      nextDue.setMonth(nextDue.getMonth() + months)

      await admin
        .from("maintenance_contracts")
        .update({
          last_scheduled_at: now.toISOString(),
          next_due_at: nextDue.toISOString(),
        })
        .eq("id", contract.id)

      results.scheduled++
    } catch (err) {
      console.error("[cron/contracts] Unexpected error for contract:", contract.id, err)
      results.errors++
    }
  }

  return NextResponse.json({ ok: true, ...results, timestamp: now.toISOString() })
}
