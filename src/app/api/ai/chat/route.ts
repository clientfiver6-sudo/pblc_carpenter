import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildSystemPrompt } from "@/lib/ai/prompts"
import { checkRateLimit } from "@/lib/rate-limit"
import { selectModel, TaskComplexity } from "@/lib/ai/model-router"

interface ChatRequestBody {
  conversationId: string
  businessId: string
}

/**
 * POST /api/ai/chat
 *
 * Generates an AI draft reply for human review in the dashboard composer.
 * Does NOT save the response to the messages table — it is a read-only draft.
 *
 * Body: { conversationId: string, businessId: string }
 * Returns: { draft: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: ChatRequestBody

  try {
    body = (await req.json()) as ChatRequestBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { conversationId, businessId } = body

  if (!conversationId || typeof conversationId !== "string") {
    return NextResponse.json({ error: "conversationId is required" }, { status: 400 })
  }
  if (!businessId || typeof businessId !== "string") {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: rawBu } = await supabase
    .from("business_users").select("business_id").eq("user_id", user.id).single()
  const bu = rawBu as { business_id: string } | null
  if (!bu || bu.business_id !== businessId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { allowed, remaining } = await checkRateLimit(`ai:${businessId}`, 30, 60_000)
  if (!allowed) {
    return NextResponse.json(
      { error: "Limite de requisições atingido. Aguarde 1 minuto." },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    )
  }

  try {
    const admin = createAdminClient()
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    // Load business context in parallel
    const [businessResult, servicesResult, staffResult, faqsResult] = await Promise.all([
      admin.from("businesses").select("*").eq("id", businessId).single(),
      admin
        .from("services")
        .select("id, name, duration_minutes, price")
        .eq("business_id", businessId)
        .eq("active", true),
      admin
        .from("staff")
        .select("id, name, role, services")
        .eq("business_id", businessId)
        .eq("active", true),
      admin
        .from("business_faqs")
        .select("question, answer")
        .eq("business_id", businessId)
        .eq("active", true),
    ])

    if (!businessResult.data) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }

    // Load conversation to get customer phone
    const { data: conversation } = await admin
      .from("conversations")
      .select("customer_id")
      .eq("id", conversationId)
      .eq("business_id", businessId)
      .single()

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    // Load customer if available
    let customer = null
    if (conversation.customer_id) {
      const { data: c } = await admin
        .from("customers")
        .select("*")
        .eq("id", conversation.customer_id)
        .single()
      customer = c
    }

    // Load recent conversation history (last 20 messages, oldest first)
    const { data: messagesRaw } = await admin
      .from("messages")
      .select("direction, content, sent_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(20)

    if (!messagesRaw || messagesRaw.length === 0) {
      return NextResponse.json(
        { error: "No messages found in conversation" },
        { status: 422 },
      )
    }

    // Build system prompt (same as receptionist, but draft-oriented)
    const systemPrompt =
      buildSystemPrompt({
        business: businessResult.data,
        services: servicesResult.data ?? [],
        staff: (staffResult.data ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          role: s.role,
          services: s.services ?? [],
        })),
        faqs: faqsResult.data ?? [],
        customer: customer ?? null,
        currentDateTime: new Date().toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
      }) +
      "\n\n## MODO RASCUNHO\nVocê está gerando um rascunho de resposta para revisão humana. Gere uma resposta completa e natural que o atendente possa enviar ou editar antes de enviar. Não use ferramentas — apenas componha a melhor resposta possível com base no contexto disponível."

    // Build message history (oldest first)
    const messages: Anthropic.MessageParam[] = (messagesRaw ?? [])
      .slice()
      .reverse()
      .map((m) => ({
        role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
        content: m.content,
      }))

    const cachedSystem: Anthropic.TextBlockParam[] = [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
    ]

    // Single-turn call — no tool use needed for draft generation
    const response = await anthropic.messages.create({
      model: selectModel(TaskComplexity.SIMPLE),
      max_tokens: 1024,
      system: cachedSystem,
      messages,
    })

    const draft = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()

    if (!draft) {
      return NextResponse.json(
        { error: "AI returned an empty response" },
        { status: 500 },
      )
    }

    return NextResponse.json({ draft }, { headers: { "X-RateLimit-Remaining": String(remaining) } })
  } catch (err) {
    console.error(
      `[API /ai/chat] Error generating draft for businessId=${businessId} conversationId=${conversationId}:`,
      err,
    )
    return NextResponse.json(
      { error: "Internal server error while generating draft" },
      { status: 500 },
    )
  }
}
