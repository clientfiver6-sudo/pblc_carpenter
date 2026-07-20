import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { AiReport } from "@/types/database"

export const dynamic = "force-dynamic"

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const bu = rawBu as { business_id: string } | null
  if (!bu) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { allowed } = await checkRateLimit(`ai_reports:${bu.business_id}`, 30, 3_600_000)
  if (!allowed) return NextResponse.json({ error: "Limite atingido. Tente novamente em breve." }, { status: 429 })

  const { data: reports, error } = await supabase
    .from("ai_reports")
    .select("id, business_id, title, prompt, html_content, created_by, created_at")
    .eq("business_id", bu.business_id)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 })

  return NextResponse.json({ reports: (reports ?? []) as AiReport[] })
}
