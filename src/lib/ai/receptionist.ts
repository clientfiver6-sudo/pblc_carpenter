import Anthropic from "@anthropic-ai/sdk"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildSystemPrompt } from "./prompts"
import { RECEPTIONIST_TOOLS } from "./tools"
import { executeToolCall } from "./tool-executor"
import { type TrajectoryState, getNextState } from "./trajectory"
import { selectModel, TaskComplexity } from "./model-router"
import { logUsage } from "./usage"
import { storeMemory, recallMemories } from "./memory"

export interface ReceptionistInput {
  businessId: string
  conversationId: string
  inboundMessage: string
  customerPhone: string
}

const APOLOGY_MESSAGE = "Ops, tive um probleminha técnico. Pode repetir?"

export async function runReceptionist(input: ReceptionistInput): Promise<string> {
  const { businessId, conversationId, inboundMessage, customerPhone } = input

  try {
    const admin = createAdminClient()
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

    // 1. Load business context (parallel queries)
    const [businessResult, servicesResult, staffResult, faqsResult, skillsResult] = await Promise.all([
      admin.from("businesses").select("id,name,type,phone,whatsapp_number,whatsapp_phone_id,address,city,opening_hours,pix_key,settings").eq("id", businessId).single(),
      admin.from("services").select("id, name, duration_minutes, price").eq("business_id", businessId).eq("active", true),
      admin.from("staff").select("id, name, role, services").eq("business_id", businessId).eq("active", true),
      admin.from("business_faqs").select("question, answer").eq("business_id", businessId).eq("active", true),
      admin.from("business_skills").select("name, content").eq("business_id", businessId).eq("active", true).order("order_index", { ascending: true }),
    ])

    if (!businessResult.data) {
      console.error(`[Receptionist] Business not found: ${businessId}`)
      return APOLOGY_MESSAGE
    }

    const skills = (skillsResult.data as Array<{ name: string; content: string }> | null) ?? []

    // 2. Load conversation (trajectory_state + history)
    const { data: rawConversation } = await admin
      .from("conversations")
      .select("trajectory_state")
      .eq("id", conversationId)
      .single()

    let currentState: TrajectoryState = (rawConversation?.trajectory_state as TrajectoryState) ?? "idle"


    const { data: messagesRaw } = await admin
      .from("messages")
      .select("direction, content, sent_at")
      .eq("conversation_id", conversationId)
      .order("sent_at", { ascending: false })
      .limit(20)

    // 3. Look up customer by phone
    const { data: customer } = await admin
      .from("customers")
      .select("id,full_name,phone_number,email,status,lead_status,tags,total_spent,visit_count,last_visit_at,address,city,notes")
      .eq("business_id", businessId)
      .ilike("phone_number", `%${customerPhone.replace(/\D/g, "").slice(-9)}`)
      .limit(1)
      .single()

    // 3b. Fetch customer-specific context (appointments, equipment)
    let upcomingAppointmentsText = ""
    if (customer) {
      try {
        const nowIso = new Date().toISOString()
        const [itemsResult, equipmentResult] = await Promise.allSettled([
          admin
            .from("work_items")
            .select("title, scheduled_start, status, staff:staff(name)")
            .eq("business_id", businessId)
            .eq("customer_id", customer.id)
            .gte("scheduled_start", nowIso)
            .not("status", "in", '("cancelled","no_show")')
            .order("scheduled_start", { ascending: true })
            .limit(3),
          admin
            .from("equipment")
            .select("name, brand, model, location, condition")
            .eq("business_id", businessId)
            .eq("customer_id", customer.id)
            .order("name", { ascending: true })
            .limit(10),
        ])

        const items = itemsResult.status === "fulfilled"
          ? (itemsResult.value.data as Array<{ title: string; scheduled_start: string | null; status: string; staff: { name: string } | null }> | null)
          : null

        if (items && items.length > 0) {
          upcomingAppointmentsText +=
            "\n\nPróximos agendamentos deste cliente:\n" +
            items.map((i) => {
              const dateStr = i.scheduled_start
                ? new Date(i.scheduled_start).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })
                : "data a confirmar"
              return `- ${i.title} em ${dateStr}${i.staff ? ` com ${i.staff.name}` : ""} (${i.status})`
            }).join("\n")
        }

        const equipmentRows = equipmentResult.status === "fulfilled"
          ? (equipmentResult.value.data as Array<{ name: string; brand: string | null; model: string | null; location: string | null; condition: string }> | null)
          : null

        if (equipmentRows && equipmentRows.length > 0) {
          upcomingAppointmentsText +=
            "\n\nEquipamentos registrados deste cliente:\n" +
            equipmentRows.map((e) => {
              const desc = [e.brand, e.model].filter(Boolean).join(" ")
              return `- ${e.name}${desc ? ` (${desc})` : ""}${e.location ? ` — ${e.location}` : ""} | condição: ${e.condition}`
            }).join("\n")
        }
      } catch {
        // Non-fatal — proceed without enriched customer context
      }
    }

    // Recall semantic memories for this customer
    const customerMemories = customer
      ? await recallMemories(customer.id, inboundMessage, 5)
      : []

    // 4. Build system prompt
    const systemPrompt = buildSystemPrompt({
      business: businessResult.data as never,
      services: servicesResult.data ?? [],
      staff: (staffResult.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        role: s.role,
        services: s.services ?? [],
      })),
      faqs: faqsResult.data ?? [],
      skills,
      customer: (customer ?? null) as never,
      currentDateTime: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      upcomingAppointmentsText,
      trajectoryState: currentState,
      customerMemories,
    })

    // 5. Build message history for Claude (reverse so oldest is first)
    const messageHistory: Anthropic.MessageParam[] = (messagesRaw ?? [])
      .slice()
      .reverse()
      .map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content,
      }))

    // Add the current inbound message
    messageHistory.push({ role: "user", content: inboundMessage })

    // 6. Agentic loop: call Claude, execute tools, repeat until final response
    // First turn (iterations = 0): use simpler model for intent detection
    // Later turns (iterations >= 1): use complex model for booking/payment
    let iterations = 0
    const MAX_ITERATIONS = 10 // safety cap to prevent infinite loops

    // Cache the system prompt server-side — same business prompt hits cache across all conversations
    const cachedSystem: Anthropic.TextBlockParam[] = [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
    ]

    const initialModel = iterations <= 1 ? selectModel(TaskComplexity.SIMPLE) : selectModel(TaskComplexity.COMPLEX)
    let response = await anthropic.messages.create({
      model: initialModel,
      max_tokens: 1024,
      system: cachedSystem,
      tools: RECEPTIONIST_TOOLS,
      messages: messageHistory,
    })
    void logUsage(businessId, "receptionist", response.usage, initialModel, conversationId)

    // Keep a local copy of the conversation for the tool loop
    const loopMessages: Anthropic.MessageParam[] = [...messageHistory]

    while (response.stop_reason === "tool_use" && iterations < MAX_ITERATIONS) {
      iterations++

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      )

      // Execute all tool calls in parallel
      const toolResultContents = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const result = await executeToolCall(
            block.name,
            block.input as Record<string, unknown>,
            { businessId, conversationId, approvalMode: true },
          )
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: result,
          }
        }),
      )

      // Update trajectory state based on tool calls
      for (const block of toolUseBlocks) {
        const nextState = getNextState(block.name, block.input as Record<string, unknown>, currentState)
        if (nextState && nextState !== currentState) {
          currentState = nextState
          void admin.from("conversations")
            .update({ trajectory_state: nextState } as never)
            .eq("id", conversationId)
            .then() // fire and forget
        }
      }

      // Append assistant turn and tool results to loop messages
      loopMessages.push({ role: "assistant", content: response.content })
      loopMessages.push({ role: "user", content: toolResultContents })

      // Call Claude again with tool results — use complex model for deeper turns
      const loopModel = iterations <= 1 ? selectModel(TaskComplexity.SIMPLE) : selectModel(TaskComplexity.COMPLEX)
      response = await anthropic.messages.create({
        model: loopModel,
        max_tokens: 1024,
        system: cachedSystem,
        tools: RECEPTIONIST_TOOLS,
        messages: loopMessages,
      })
      void logUsage(businessId, "receptionist", response.usage, loopModel, conversationId)
    }

    // 7. Extract final text response
    const finalText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()

    if (!finalText) {
      console.error(`[Receptionist] Empty response after ${iterations} iterations for conversation ${conversationId}`)
      return APOLOGY_MESSAGE
    }

    // NOTE: Message persistence is handled by the caller (webhook/chat route)
    // so the receptionist only returns the text here.

    // Store conversation summary as memory (non-blocking, skip sentinel replies)
    if (customer && finalText && !finalText.trim().startsWith("__SKIP__")) {
      void storeMemory(
        businessId,
        customer.id,
        `[${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}] Cliente: "${inboundMessage.slice(0, 200)}" → IA: "${finalText.slice(0, 200)}"`,
        "conversation_summary",
      )
    }

    // 9. Update conversation last_message_at
    await admin
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() } as unknown as { last_message_at: string })
      .eq("id", conversationId)

    return finalText
  } catch (err) {
    console.error(
      `[Receptionist] Unhandled error for businessId=${businessId} conversationId=${conversationId}:`,
      err,
    )
    return APOLOGY_MESSAGE
  }
}
