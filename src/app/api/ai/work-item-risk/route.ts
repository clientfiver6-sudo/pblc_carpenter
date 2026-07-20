import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { predictWorkItemRisk } from "@/lib/ai/brain"

export async function POST(request: Request) {
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

    const { workItemId } = await request.json() as { workItemId: string }
    if (!workItemId) return NextResponse.json({ error: "workItemId required" }, { status: 400 })

    const risk = await predictWorkItemRisk(businessId, workItemId)
    return NextResponse.json({ risk })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
