import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
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

    const admin = createAdminClient()

    // Return cached insight if < 30 min old and no new unread messages
    const { data: conv } = await admin
      .from("conversations")
      .select("metadata, unread_count")
      .eq("id", conversationId)
      .eq("business_id", businessId)
      .single()

    const cached = (conv?.metadata as Record<string, unknown> | null)?.ai_analysis as
      { insight: unknown; cached_at: string } | undefined
    const cacheAge = cached ? Date.now() - new Date(cached.cached_at).getTime() : Infinity

    if (cached && cacheAge < 30 * 60_000 && (conv?.unread_count ?? 0) === 0) {
      return NextResponse.json({ insight: cached.insight })
    }

    const insight = await analyzeConversation(businessId, conversationId)

    // Persist to conversation metadata so next open is instant
    const existingMeta = (conv?.metadata as Record<string, unknown>) ?? {}
    await admin.from("conversations").update({
      metadata: { ...existingMeta, ai_analysis: { insight, cached_at: new Date().toISOString() } } as unknown as import("@/types/database").Json,
    }).eq("id", conversationId)

    return NextResponse.json({ insight })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
