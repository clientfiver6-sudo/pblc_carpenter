import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: buRaw } = await supabase.from("business_users").select("business_id").eq("user_id", user.id).single()
  const bu = buRaw as { business_id: string } | null
  if (!bu) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { allowed } = await checkRateLimit(`ai_approvals:${bu.business_id}`, 60, 3_600_000)
  if (!allowed) return NextResponse.json({ error: "Limite atingido. Tente novamente em breve." }, { status: 429 })

  const admin = createAdminClient()
  const { data: rawData } = await admin
    .from("ai_approvals")
    .select("*, conversations(id)")
    .eq("business_id" as never, bu.business_id)
    .order("created_at" as never, { ascending: false })
    .limit(50)

  return NextResponse.json({ approvals: rawData ?? [] })
}
