import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { executeToolCall } from "@/lib/ai/tool-executor"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: buRaw } = await supabase.from("business_users").select("business_id").eq("user_id", user.id).single()
  const bu = buRaw as { business_id: string } | null
  if (!bu) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { allowed } = await checkRateLimit(`approvals:${bu.business_id}`, 20, 60_000)
  if (!allowed) return NextResponse.json({ error: "Muitas requisições." }, { status: 429 })

  const body = await req.json() as { decision: "approved" | "rejected"; note?: string }
  const admin = createAdminClient()

  const { data: approval } = await admin
    .from("ai_approvals")
    .select("*")
    .eq("id", id)
    .eq("business_id", bu.business_id)
    .single()

  if (!approval) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await admin.from("ai_approvals").update({
    status: body.decision,
    resolution_note: body.note ?? null,
    resolved_at: new Date().toISOString(),
  } as never).eq("id", id)

  if (body.decision === "approved") {
    const a = approval as { tool_name: string; tool_input: Record<string, unknown>; business_id: string; conversation_id: string }
    await executeToolCall(a.tool_name, a.tool_input, { businessId: a.business_id, conversationId: a.conversation_id })
  }

  return NextResponse.json({ ok: true })
}
