import { NextResponse } from "next/server"
import { processWebhookEvent } from "@/lib/webhooks/hub"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed: ipAllowed, resetAt: ipResetAt } = await checkRateLimit(`webhook:${ip}`, 1000, 3_600_000)
  if (!ipAllowed) {
    const retryAfter = Math.ceil((ipResetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  const { slug } = await params
  const rawBody = await req.text()

  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    // non-JSON body — treat as empty payload
  }

  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => { headers[key] = value })

  const result = await processWebhookEvent(slug, rawBody, headers, payload)

  if (!result.ok && result.error === "Invalid signature") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const challenge = url.searchParams.get("challenge")
  if (challenge) {
    return new Response(challenge, { headers: { "Content-Type": "text/plain" } })
  }
  return NextResponse.json({ ok: true })
}
