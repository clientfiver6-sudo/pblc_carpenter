import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { getStaffDayBriefing } from "@/lib/ai/brain"

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

    const { allowed } = await checkRateLimit(`ai:${businessId}`, 30, 60_000)
    if (!allowed) return NextResponse.json({ error: "Limite atingido. Aguarde 1 minuto." }, { status: 429 })

    const staffId = new URL(request.url).searchParams.get("staffId")
    if (!staffId) return NextResponse.json({ error: "staffId required" }, { status: 400 })

    const admin = createAdminClient()
    const { data: staffCheck } = await admin
      .from("staff").select("id").eq("id", staffId).eq("business_id", businessId).maybeSingle()
    if (!staffCheck) return NextResponse.json({ error: "Staff not found" }, { status: 404 })

    const briefing = await getStaffDayBriefing(businessId, staffId)
    return NextResponse.json({ briefing })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
