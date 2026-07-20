import { NextResponse } from "next/server"
import { getBusinessId } from "@/lib/auth/actions"
import { createAdminClient } from "@/lib/supabase/admin"
import { getInstanceState } from "@/lib/whatsapp/client"

export async function GET() {
  const businessId = await getBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const report: Record<string, unknown> = {
    checked_at: new Date().toISOString(),
  }

  // 1. Env vars
  report.evolution_url_set = !!process.env.EVOLUTION_API_URL
  report.evolution_key_set = !!process.env.EVOLUTION_API_KEY
  report.evolution_url = process.env.EVOLUTION_API_URL
    ? process.env.EVOLUTION_API_URL.replace(/\/+$/, "") // trim trailing slash
    : null
  report.webhook_url = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`
    : null

  // 2. DB — instance name and connected_at
  const admin = createAdminClient()
  const { data: biz, error: bizErr } = await admin
    .from("businesses")
    .select("whatsapp_phone_id, whatsapp_connected_at")
    .eq("id", businessId)
    .single()

  if (bizErr) {
    report.db_error = bizErr.message
  } else {
    report.instance_name = biz?.whatsapp_phone_id ?? null
    report.db_connected_at = biz?.whatsapp_connected_at ?? null
  }

  // 3. Live Evolution API state
  if (biz?.whatsapp_phone_id) {
    try {
      const state = await getInstanceState(biz.whatsapp_phone_id)
      report.instance_state = state
      report.instance_reachable = true
    } catch (err) {
      report.instance_state = null
      report.instance_reachable = false
      report.instance_error = err instanceof Error ? err.message : String(err)
    }
  } else {
    report.instance_state = null
    report.instance_reachable = null
    report.instance_error = "No instance configured"
  }

  // 4. Overall status
  report.ready = (
    report.evolution_url_set &&
    report.evolution_key_set &&
    report.instance_name !== null &&
    report.instance_state === "open"
  )

  return NextResponse.json(report, { status: 200 })
}
