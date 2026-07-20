import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { analyzeConversation } from "@/lib/ai/brain"

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

    const { conversationId } = await request.json() as { conversationId: string }
    if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 })

    const insight = await analyzeConversation(businessId, conversationId)
    return NextResponse.json({ draft: insight.suggested_reply })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
