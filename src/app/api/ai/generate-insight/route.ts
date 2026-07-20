import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { runNightlyDreaming } from "@/lib/ai/dreaming"
import { checkRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

export async function POST() {
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

    const { allowed } = await checkRateLimit(`generate-insight:${bu.business_id}`, 3, 86_400_000)
    if (!allowed) return NextResponse.json({ error: "Limite atingido por hoje." }, { status: 429 })

    await runNightlyDreaming(bu.business_id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
