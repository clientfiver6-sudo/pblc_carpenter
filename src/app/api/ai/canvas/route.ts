import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { generateCanvas } from "@/lib/ai/canvas"
import { checkRateLimit } from "@/lib/rate-limit"
import { saoPauloDayStartISO } from "@/lib/utils"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  const { allowed, resetAt } = await checkRateLimit(`ai_canvas:${bu.business_id}`, 20, 3_600_000)
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  const DAILY_LIMIT = 5
  const todayStartISO = saoPauloDayStartISO()

  const admin = createAdminClient()
  const { count } = await admin
    .from("ai_reports")
    .select("id", { count: "exact", head: true })
    .eq("business_id", bu.business_id)
    .gte("created_at", todayStartISO)

  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: `Limite diário de ${DAILY_LIMIT} relatórios atingido. Tente novamente amanhã.` },
      { status: 429 }
    )
  }

  const { prompt } = await req.json() as { prompt: string }
  if (!prompt?.trim()) return NextResponse.json({ error: "Prompt required" }, { status: 400 })

  const htmlChunks: string[] = []
  const sourceStream = await generateCanvas(bu.business_id, prompt)

  // Tee the stream: one branch to client, one to accumulate for DB
  const [clientStream, dbStream] = sourceStream.tee()

  // Accumulate for DB save (non-blocking)
  const decoder = new TextDecoder()
  const reader = dbStream.getReader()
  ;(async () => {
    let done = false
    while (!done) {
      const { value, done: d } = await reader.read()
      done = d
      if (value) htmlChunks.push(decoder.decode(value))
    }
    const fullHtml = htmlChunks.join("")
    if (fullHtml.trim()) {
      await admin.from("ai_reports").insert({
        business_id: bu.business_id,
        title: prompt.slice(0, 100),
        prompt,
        html_content: fullHtml,
        created_by: user.id,
      } as never)
    }
  })()

  return new NextResponse(clientStream, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
