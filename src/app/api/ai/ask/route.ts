import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { generateReport } from "@/lib/ai/brain"
import { checkRateLimit } from "@/lib/rate-limit"

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

    const { allowed } = await checkRateLimit(`ai_ask:${businessId}`, 10, 3_600_000) // 10 streaming asks per hour per business
    if (!allowed) {
      return NextResponse.json({ error: "Limite de perguntas atingido. Tente novamente em 1 hora." }, { status: 429 })
    }

    const { question } = await request.json() as { question: string }
    if (!question?.trim()) return NextResponse.json({ error: "Question required" }, { status: 400 })

    const stream = await generateReport(businessId, question)
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
