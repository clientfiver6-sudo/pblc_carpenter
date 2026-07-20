import { createAdminClient } from "@/lib/supabase/admin"
import type { Customer, CustomerInsert, Staff, Service, WorkItem, WorkItemInsert, Business, BusinessFaq, Json, PaymentInsert } from "@/types/database"
import { APPROVAL_REQUIRED_TOOLS, requestApproval } from "./approvals"
import { createPixPayment } from "@/lib/payments/mercadopago"
import { safeDecryptToken } from "@/lib/security/encrypt"
import { spDayRange } from "@/lib/utils/brazil-time"
import { sendTextMessage, sendImageMessage } from "@/lib/whatsapp/client"

interface ToolInput {
  [key: string]: unknown
}

interface ExecutorContext {
  businessId: string
  conversationId: string
  approvalMode?: boolean
}

export async function executeToolCall(
  toolName: string,
  toolInput: ToolInput,
  context: ExecutorContext,
): Promise<string> {
  const { businessId, conversationId } = context

  if (context.approvalMode && APPROVAL_REQUIRED_TOOLS.has(toolName)) {
    return requestApproval(
      businessId,
      conversationId,
      toolName,
      toolInput,
    )
  }

  try {
    switch (toolName) {
      case "lookup_customer":
        return await lookupCustomer(toolInput, businessId)
      case "create_customer":
        return await createCustomer(toolInput, businessId)
      case "get_available_slots":
        return await getAvailableSlots(toolInput, businessId)
      case "create_work_item":
        return await createWorkItem(toolInput, businessId)
      case "reschedule_work_item":
        return await rescheduleWorkItem(toolInput, businessId)
      case "cancel_work_item":
        return await cancelWorkItem(toolInput, businessId)
      case "get_customer_work_items":
        return await getCustomerWorkItems(toolInput, businessId)
      case "create_payment_link":
        return await createPaymentLink(toolInput, businessId, conversationId)
      case "get_payment_status":
        return await getPaymentStatus(toolInput, businessId)
      case "answer_faq":
        return await answerFaq(toolInput, businessId)
      case "handoff_to_human":
        return await handoffToHuman(toolInput, conversationId, businessId)
      case "update_work_item_status":
        return await updateWorkItemStatus(toolInput, businessId)
      default:
        return `Ferramenta desconhecida: ${toolName}`
    }
  } catch (err) {
    console.error(`[AI Tool Error] businessId=${businessId} tool=${toolName}`, err)
    return `Ocorreu um erro ao executar a ação. Por favor, tente novamente ou solicite atendimento humano.`
  }
}

// ── Tool implementations ─────────────────────────────────────────────────────

async function lookupCustomer(input: ToolInput, businessId: string): Promise<string> {
  const phone = String(input.phone ?? "").trim()
  if (!phone) return "Número de telefone não informado."

  const admin = createAdminClient()

  // Normalize: strip non-digits then match suffix to handle different DDI formats
  const digits = phone.replace(/\D/g, "")
  const { data: rawData, error } = await admin
    .from("customers")
    .select("id, full_name, phone_number, email, visit_count, last_visit_at, status")
    .eq("business_id", businessId)
    .ilike("phone_number", `%${digits.slice(-9)}`)
    .limit(1)
    .single()
  const data = rawData as Customer | null

  if (error || !data) {
    return JSON.stringify({ found: false, message: "Cliente não encontrado no sistema." })
  }

  return JSON.stringify({
    found: true,
    customer_id: data.id,
    full_name: data.full_name,
    phone_number: data.phone_number,
    email: data.email,
    visit_count: data.visit_count,
    last_visit_at: data.last_visit_at,
    status: data.status,
  })
}

async function createCustomer(input: ToolInput, businessId: string): Promise<string> {
  const fullName = String(input.full_name ?? "").trim()
  const phoneNumber = String(input.phone_number ?? "").trim()

  if (!fullName) return "Nome completo é obrigatório para cadastrar o cliente."
  if (!phoneNumber) return "Número de telefone é obrigatório para cadastrar o cliente."

  const admin = createAdminClient()
  const { data: rawData, error } = await admin
    .from("customers")
    .insert({
      business_id: businessId,
      full_name: fullName,
      phone_number: phoneNumber,
      email: input.email ? String(input.email) : null,
      address: input.address ? String(input.address) : null,
      status: "active" as const,
      lead_status: "new" as const,
      tags: [] as string[],
      total_spent: 0,
      visit_count: 0,
      metadata: {} as Json,
    } as unknown as CustomerInsert)
    .select("id, full_name, phone_number")
    .single()
  const data = rawData as Customer | null

  if (error || !data) {
    console.error("[AI Tool] create_customer error:", error)
    return "Erro ao cadastrar o cliente. Tente novamente."
  }

  return JSON.stringify({
    success: true,
    customer_id: data.id,
    full_name: data.full_name,
    phone_number: data.phone_number,
    message: `Cliente ${data.full_name} cadastrado com sucesso!`,
  })
}

async function getAvailableSlots(input: ToolInput, businessId: string): Promise<string> {
  const date = String(input.date ?? "").trim()
  if (!date) return "Data não informada."

  const admin = createAdminClient()

  // Build query for staff members
  let staffQuery = admin
    .from("staff")
    .select("id, name, working_hours, services")
    .eq("business_id", businessId)
    .eq("active", true)

  if (input.staff_id) {
    staffQuery = staffQuery.eq("id", String(input.staff_id))
  }

  const { data: rawStaffList, error: staffError } = await staffQuery
  const staffList = rawStaffList as Staff[] | null
  if (staffError || !staffList || staffList.length === 0) {
    return "Nenhum profissional disponível encontrado."
  }

  // Get service duration if service_id provided
  let serviceDuration = 60
  if (input.service_id) {
    const { data: rawService } = await admin
      .from("services")
      .select("duration_minutes, name")
      .eq("id", String(input.service_id))
      .eq("business_id", businessId)
      .single()
    const service = rawService as Service | null
    if (service) serviceDuration = service.duration_minutes
  }

  // Get existing bookings for that date (SP timezone)
  const { start: dateStart, end: dateEnd } = spDayRange(date)
  const { data: rawExistingItems } = await admin
    .from("work_items")
    .select("assigned_staff_id, scheduled_start, scheduled_end")
    .eq("business_id", businessId)
    .gte("scheduled_start", dateStart)
    .lte("scheduled_start", dateEnd)
    .not("status", "in", '("cancelled","no_show")')
  const existingItems = rawExistingItems as Pick<WorkItem, "assigned_staff_id" | "scheduled_start" | "scheduled_end">[] | null

  const bookedSlots = existingItems ?? []

  // Generate available slots per staff member
  const slots: Array<{ staff_id: string; staff_name: string; time: string; datetime: string }> = []
  const dayOfWeek = new Date(`${date}T12:00:00-03:00`).toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Sao_Paulo" }).toLowerCase()

  for (const member of staffList) {
    const workingHours = member.working_hours as Record<string, { open?: boolean; start?: string; end?: string }> | null
    const todayHours = workingHours?.[dayOfWeek]

    if (!todayHours?.open || !todayHours.start || !todayHours.end) continue

    // Parse start/end hours
    const [startHour, startMin] = todayHours.start.split(":").map(Number)
    const [endHour, endMin] = todayHours.end.split(":").map(Number)

    // Generate slots every 30 minutes
    let slotHour = startHour
    let slotMin = startMin
    const endTotalMin = endHour * 60 + endMin

    while (slotHour * 60 + slotMin + serviceDuration <= endTotalMin) {
      const timeStr = `${String(slotHour).padStart(2, "0")}:${String(slotMin).padStart(2, "0")}`
      // Build as SP-local datetime so comparisons with stored UTC values are correct
      const slotDatetime = new Date(`${date}T${timeStr}:00-03:00`).toISOString()
      const slotEndDatetime = new Date(
        new Date(slotDatetime).getTime() + serviceDuration * 60000,
      ).toISOString()

      // Check if slot conflicts with existing bookings for this staff member
      const isConflict = bookedSlots.some(
        (b) =>
          b.assigned_staff_id === member.id &&
          b.scheduled_start &&
          new Date(b.scheduled_start) < new Date(slotEndDatetime) &&
          new Date(b.scheduled_start) >= new Date(slotDatetime),
      )

      if (!isConflict) {
        slots.push({
          staff_id: member.id,
          staff_name: member.name,
          time: timeStr,
          datetime: slotDatetime,
        })
      }

      // Advance 30 min
      slotMin += 30
      if (slotMin >= 60) {
        slotMin -= 60
        slotHour++
      }
    }
  }

  if (slots.length === 0) {
    return JSON.stringify({
      available: false,
      message: `Não há horários disponíveis para ${date}. Tente outra data.`,
    })
  }

  // Return first 10 slots to keep context manageable
  const limited = slots.slice(0, 10)
  return JSON.stringify({
    available: true,
    date,
    slots: limited,
    total_slots: slots.length,
    message: `Encontrei ${limited.length} horários disponíveis para ${date}.`,
  })
}

async function createWorkItem(input: ToolInput, businessId: string): Promise<string> {
  const customerId = String(input.customer_id ?? "").trim()
  const type = String(input.type ?? "appointment")
  const title = String(input.title ?? "").trim()

  if (!customerId) return "ID do cliente é obrigatório."
  if (!title) return "Título do agendamento é obrigatório."

  const admin = createAdminClient()

  // ── Resolve service_id ────────────────────────────────────────────────────
  let resolvedServiceId: string | null = input.service_id ? String(input.service_id) : null
  if (!resolvedServiceId) {
    const { data: services } = await admin
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name")
    const list = (services ?? []) as Array<{ id: string; name: string; duration_minutes: number; price: number | null }>
    if (list.length === 0) {
      return "Nenhum serviço cadastrado. Cadastre os serviços do negócio antes de agendar."
    }
    if (list.length === 1) {
      resolvedServiceId = list[0].id
    } else {
      const opts = list.map(s => `${s.name} (ID: ${s.id})`).join(", ")
      return `Qual serviço o cliente deseja? Opções disponíveis: ${opts}. Pergunte ao cliente e chame create_work_item novamente com o service_id correto.`
    }
  }

  // ── Resolve staff_id ──────────────────────────────────────────────────────
  let resolvedStaffId: string | null = input.staff_id ? String(input.staff_id) : null
  if (!resolvedStaffId) {
    const { data: staffList } = await admin
      .from("staff")
      .select("id, name, role, services")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("name")
    const list = (staffList ?? []) as Array<{ id: string; name: string; role: string | null; services: string[] | null }>
    // Filter to staff who handle this service, or all staff if service has no restriction
    const eligible = resolvedServiceId
      ? list.filter(m => !m.services || m.services.length === 0 || m.services.includes(resolvedServiceId!))
      : list
    const candidates = eligible.length > 0 ? eligible : list
    if (candidates.length === 0) {
      return "Nenhum profissional ativo cadastrado. Cadastre a equipe antes de agendar."
    }
    if (candidates.length === 1) {
      resolvedStaffId = candidates[0].id
    } else {
      const opts = candidates.map(m => `${m.name}${m.role ? ` (${m.role})` : ""} — ID: ${m.id}`).join(", ")
      return `Com qual profissional o cliente prefere? Opções disponíveis: ${opts}. Pergunte ao cliente e chame create_work_item novamente com o staff_id correto.`
    }
  }

  // Calculate scheduled_end if we have start and service
  let scheduledEnd: string | null = null
  if (input.scheduled_start && resolvedServiceId) {
    const { data: rawService } = await admin
      .from("services")
      .select("duration_minutes")
      .eq("id", resolvedServiceId)
      .single()
    const service = rawService as Service | null
    if (service) {
      scheduledEnd = new Date(
        new Date(String(input.scheduled_start)).getTime() + service.duration_minutes * 60000,
      ).toISOString()
    }
  }

  // Booked with a time slot → "scheduled"; no time yet → "pending_confirmation"
  const initialStatus = input.scheduled_start ? "scheduled" : "pending_confirmation"

  const { data: rawData, error } = await admin
    .from("work_items")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      type: type as "appointment" | "job" | "repair" | "quote" | "order" | "consultation" | "service_call",
      title,
      service_id: resolvedServiceId,
      assigned_staff_id: resolvedStaffId,
      scheduled_start: input.scheduled_start ? String(input.scheduled_start) : null,
      scheduled_end: scheduledEnd,
      description: input.description ? String(input.description) : null,
      address: input.address ? String(input.address) : null,
      status: initialStatus,
      payment_status: "unpaid" as const,
      notes: null,
      internal_notes: null,
      metadata: {
        status_history: [{ status: initialStatus, changed_at: new Date().toISOString() }],
      } as Json,
    } as unknown as WorkItemInsert)
    .select("id, title, scheduled_start, status")
    .single()
  const data = rawData as WorkItem | null

  if (error || !data) {
    console.error("[AI Tool] create_work_item error:", error)
    return "Erro ao criar o agendamento. Tente novamente."
  }

  const formattedDate = data.scheduled_start
    ? new Date(data.scheduled_start).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "A definir"

  // Notify business owner + fire booking_created automation (customer confirmation message)
  try {
    const { createNotification } = await import("@/lib/notifications/actions")
    await createNotification({
      businessId,
      type: "new_work_item",
      title: "Agendamento criado pela IA",
      body: `${data.title} — ${formattedDate}`,
      link: `/dashboard/work-items/${data.id}`,
    })
  } catch {
    // Non-fatal
  }
  try {
    const { triggerBookingCreated } = await import("@/lib/automations/triggers")
    triggerBookingCreated(data.id, businessId).catch(() => {})
  } catch {
    // Non-fatal
  }

  return JSON.stringify({
    success: true,
    work_item_id: data.id,
    title: data.title,
    scheduled_start: data.scheduled_start,
    formatted_date: formattedDate,
    status: data.status,
    message: `Agendamento "${data.title}" criado com sucesso para ${formattedDate}. Aguardando confirmação.`,
  })
}

async function rescheduleWorkItem(input: ToolInput, businessId: string): Promise<string> {
  const workItemId = String(input.work_item_id ?? "").trim()
  const newStart = String(input.new_start ?? "").trim()

  if (!workItemId) return "ID do agendamento é obrigatório."
  if (!newStart) return "Nova data e hora são obrigatórias."

  const admin = createAdminClient()

  // Verify work item belongs to this business
  const { data: rawExisting } = await admin
    .from("work_items")
    .select("id, title, service_id, status")
    .eq("id", workItemId)
    .eq("business_id", businessId)
    .single()
  const existing = rawExisting as WorkItem | null

  if (!existing) return "Agendamento não encontrado."
  if (existing.status === "cancelled") return "Este agendamento já foi cancelado."
  if (existing.status === "completed") return "Não é possível remarcar um agendamento já concluído."

  // Calculate new end time
  let newEnd: string | null = null
  if (existing.service_id) {
    const { data: rawService } = await admin
      .from("services")
      .select("duration_minutes")
      .eq("id", existing.service_id)
      .single()
    const service = rawService as Service | null
    if (service) {
      newEnd = new Date(
        new Date(newStart).getTime() + service.duration_minutes * 60000,
      ).toISOString()
    }
  }

  const { error } = await admin
    .from("work_items")
    .update({ scheduled_start: newStart, scheduled_end: newEnd })
    .eq("id", workItemId)
    .eq("business_id", businessId)

  if (error) {
    console.error("[AI Tool] reschedule_work_item error:", error)
    return "Erro ao remarcar o agendamento. Tente novamente."
  }

  const formattedDate = new Date(newStart).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })

  try {
    const { createNotification } = await import("@/lib/notifications/actions")
    await createNotification({
      businessId,
      type: "new_work_item",
      title: "Agendamento remarcado pela IA",
      body: `${existing.title} → ${formattedDate}`,
      link: `/dashboard/work-items/${workItemId}`,
    })
  } catch {
    // Non-fatal
  }

  return JSON.stringify({
    success: true,
    work_item_id: workItemId,
    new_start: newStart,
    message: `Agendamento "${existing.title}" remarcado com sucesso para ${formattedDate}.`,
  })
}

async function cancelWorkItem(input: ToolInput, businessId: string): Promise<string> {
  const workItemId = String(input.work_item_id ?? "").trim()
  if (!workItemId) return "ID do agendamento é obrigatório."

  const admin = createAdminClient()

  // Verify work item belongs to this business
  const { data: rawExisting } = await admin
    .from("work_items")
    .select("id, title, status")
    .eq("id", workItemId)
    .eq("business_id", businessId)
    .single()
  const existing = rawExisting as WorkItem | null

  if (!existing) return "Agendamento não encontrado."
  if (existing.status === "cancelled") return "Este agendamento já foi cancelado anteriormente."
  if (existing.status === "completed") return "Não é possível cancelar um agendamento já concluído."

  const notes = input.reason ? `Cancelado pelo cliente. Motivo: ${String(input.reason)}` : "Cancelado pelo cliente via chat."

  const { error } = await admin
    .from("work_items")
    .update({ status: "cancelled", internal_notes: notes })
    .eq("id", workItemId)
    .eq("business_id", businessId)

  if (error) {
    console.error("[AI Tool] cancel_work_item error:", error)
    return "Erro ao cancelar o agendamento. Tente novamente."
  }

  try {
    const { createNotification } = await import("@/lib/notifications/actions")
    await createNotification({
      businessId,
      type: "new_work_item",
      title: "Agendamento cancelado pelo cliente",
      body: existing.title,
      link: `/dashboard/work-items/${workItemId}`,
    })
  } catch {
    // Non-fatal
  }

  return JSON.stringify({
    success: true,
    work_item_id: workItemId,
    message: `Agendamento "${existing.title}" cancelado com sucesso. Lamentamos não poder atendê-lo desta vez.`,
  })
}

async function getCustomerWorkItems(input: ToolInput, businessId: string): Promise<string> {
  const customerId = String(input.customer_id ?? "").trim()
  if (!customerId) return "ID do cliente é obrigatório."

  const admin = createAdminClient()
  const statusFilter = String(input.status_filter ?? "upcoming")

  let query = admin
    .from("work_items")
    .select("id, type, title, scheduled_start, status, payment_status, description")
    .eq("business_id", businessId)
    .eq("customer_id", customerId)
    .order("scheduled_start", { ascending: false })
    .limit(10)

  if (statusFilter === "upcoming") {
    query = query
      .gte("scheduled_start", new Date().toISOString())
      .not("status", "in", '("cancelled","completed","no_show")')
  } else if (statusFilter === "completed") {
    query = query.eq("status", "completed")
  }
  // "all" = no additional filter

  const { data: rawData, error } = await query
  const data = rawData as WorkItem[] | null

  if (error) {
    console.error("[AI Tool] get_customer_work_items error:", error)
    return "Erro ao buscar agendamentos do cliente."
  }

  if (!data || data.length === 0) {
    const label =
      statusFilter === "upcoming"
        ? "próximos agendamentos"
        : statusFilter === "completed"
          ? "serviços concluídos"
          : "agendamentos"
    return JSON.stringify({ found: false, message: `Nenhum ${label} encontrado.` })
  }

  const items = data.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    scheduled_start: item.scheduled_start,
    formatted_date: item.scheduled_start
      ? new Date(item.scheduled_start).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
      : null,
    status: item.status,
    payment_status: item.payment_status,
  }))

  return JSON.stringify({ found: true, items, total: items.length })
}

async function createPaymentLink(input: ToolInput, businessId: string, conversationId: string): Promise<string> {
  const amount = Number(input.amount ?? 0)
  const description = String(input.description ?? "").trim()
  const paymentMethod = String(input.payment_method ?? "pix") as "pix" | "card"

  if (!amount || amount <= 0) return "Valor do pagamento inválido."
  if (!description) return "Descrição do pagamento é obrigatória."

  const admin = createAdminClient()
  const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`

  // Fetch business credentials in parallel
  const [{ data: rawBusiness }, { data: convData }] = await Promise.all([
    admin
      .from("businesses")
      .select("mercadopago_access_token, pix_key, pix_key_type, name, whatsapp_phone_id")
      .eq("id", businessId)
      .single(),
    admin
      .from("conversations")
      .select("customer:customers(id, phone_number)")
      .eq("id", conversationId)
      .single(),
  ])

  const business = rawBusiness as (Business & { whatsapp_phone_id: string | null }) | null
  if (!business) return "Negócio não encontrado."

  // Decrypt token once for use in payment operations
  const mpAccessToken = safeDecryptToken(business.mercadopago_access_token)

  const customer = (convData?.customer as unknown as { id: string; phone_number: string } | null)
  const canSendWA = !!(customer?.phone_number && business.whatsapp_phone_id)

  const saveOutbound = async (content: string, type = "text") => {
    await admin.from("messages").insert({
      conversation_id: conversationId,
      business_id: businessId,
      direction: "outbound",
      content,
      message_type: type,
      sent_by: "ai",
      status: "sent",
      sent_at: new Date().toISOString(),
      metadata: {},
    } as never)
  }

  // ── PIX via MercadoPago ────────────────────────────────────────────────────
  if (paymentMethod === "pix" && mpAccessToken) {
    try {
      const pixResult = await createPixPayment({
        businessId,
        workItemId: input.work_item_id ? String(input.work_item_id) : undefined,
        customerId: customer?.id,
        amount,
        description,
      })

      if (canSendWA) {
        const phone = customer!.phone_number
        const instanceName = business.whatsapp_phone_id!

        // Send QR code image
        try {
          await sendImageMessage({ to: phone, mediaUrl: pixResult.pixLink, caption: `*Pix — ${fmt(amount)}*\n${description}`, instanceName })
          await saveOutbound(`[QR Code Pix — ${fmt(amount)}]`, "image")
        } catch (imgErr) {
          console.error("[createPaymentLink] QR image send failed, sending copy-paste only", imgErr)
        }

        // Send copia-e-cola
        const copyText = `*Pix Copia e Cola — ${fmt(amount)}:*\n${pixResult.pixCopyPaste}`
        await sendTextMessage({ to: phone, text: copyText, instanceName })
        await saveOutbound(copyText)
      }

      return JSON.stringify({ success: true, sent_via_whatsapp: canSendWA, amount, message: canSendWA ? "QR Code e código Pix enviados diretamente para o WhatsApp do cliente." : `Link Pix: ${pixResult.pixLink}` })
    } catch (err) {
      console.error("[AI Tool] createPixPayment error:", err)
      // Fall through to manual pix
    }
  }

  // ── Card via MercadoPago Checkout Pro ──────────────────────────────────────
  if (paymentMethod === "card" && mpAccessToken) {
    try {
      const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${mpAccessToken}` },
        body: JSON.stringify({
          items: [{ title: description, quantity: 1, unit_price: amount, currency_id: "BRL" }],
          back_urls: {
            success: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/payment/success`,
            failure: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/payment/failure`,
          },
          auto_return: "approved",
        }),
      })

      if (mpRes.ok) {
        const mpData = (await mpRes.json()) as { init_point?: string; id?: string }
        if (mpData.init_point) {
          await admin.from("payments").insert({
            business_id: businessId,
            work_item_id: input.work_item_id ? String(input.work_item_id) : null,
            customer_id: customer?.id ?? null,
            amount: Math.round(amount * 100),
            method: "card",
            status: "pending",
            mercadopago_preference_id: mpData.id ?? null,
            description,
            metadata: {},
          } as unknown as PaymentInsert)

          if (canSendWA) {
            const text = `*Pagamento — ${fmt(amount)}*\n${description}\n\nClique para pagar com cartão ou Pix:\n${mpData.init_point}`
            await sendTextMessage({ to: customer!.phone_number, text, instanceName: business.whatsapp_phone_id! })
            await saveOutbound(text)
          }

          return JSON.stringify({ success: true, sent_via_whatsapp: canSendWA, amount, message: canSendWA ? "Link de pagamento enviado para o WhatsApp do cliente." : `Link de pagamento: ${mpData.init_point}` })
        }
      }
    } catch (cardErr) {
      console.error("[AI Tool] Card checkout error:", cardErr)
    }
  }

  // ── Manual PIX key fallback ────────────────────────────────────────────────
  if (business.pix_key) {
    const keyLabel: Record<string, string> = { cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Telefone", random: "Chave Aleatória" }
    const label = keyLabel[business.pix_key_type ?? ""] ?? "Chave Pix"
    const text = `*Pix — ${fmt(amount)}*\n${description}\n\n${label}: *${business.pix_key}*\n\nApós o pagamento, envie o comprovante aqui.`

    if (canSendWA) {
      await sendTextMessage({ to: customer!.phone_number, text, instanceName: business.whatsapp_phone_id! })
      await saveOutbound(text)
    }

    return JSON.stringify({ success: true, sent_via_whatsapp: canSendWA, payment_method: "pix_manual", pix_key: business.pix_key, amount, message: canSendWA ? "Dados do Pix enviados para o WhatsApp do cliente." : text })
  }

  return "Não foi possível gerar o pagamento. Configure o Mercado Pago ou uma chave Pix nas configurações."
}

async function getPaymentStatus(input: ToolInput, businessId: string): Promise<string> {
  const workItemId = input.work_item_id ? String(input.work_item_id).trim() : undefined
  const customerId = input.customer_id ? String(input.customer_id).trim() : undefined

  const admin = createAdminClient()

  let query = admin
    .from("payments")
    .select("id, amount, status, method, created_at, paid_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })

  if (workItemId) {
    query = query.eq("work_item_id", workItemId)
  } else if (customerId) {
    query = (query.eq("customer_id", customerId) as typeof query).limit(3)
  } else {
    return "Não foi possível verificar o pagamento. Por favor, informe mais detalhes."
  }

  const { data: rawData, error } = await query
  const payments = rawData as Array<{
    id: string
    amount: number
    status: string
    method: string
    created_at: string
    paid_at: string | null
  }> | null

  if (error || !payments || payments.length === 0) {
    return "Nenhum pagamento encontrado para este agendamento/cliente."
  }

  const lines = payments.map((p) => {
    const amount = (p.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    const statusLabel =
      p.status === "paid" ? "✅ Pago" : p.status === "pending" ? "⏳ Pendente" : "❌ Cancelado"
    const date = p.paid_at ?? p.created_at
    const dateStr = new Date(date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    return `${amount} — ${statusLabel} (${dateStr})`
  })

  return lines.join("\n")
}

async function answerFaq(input: ToolInput, businessId: string): Promise<string> {
  const question = String(input.question ?? "").trim()
  if (!question) return "Pergunta não informada."

  const admin = createAdminClient()

  // Search FAQs with case-insensitive LIKE on question
  const searchTerms = question.split(/\s+/).filter((w) => w.length > 3)
  let query = admin
    .from("business_faqs")
    .select("question, answer")
    .eq("business_id", businessId)
    .eq("active", true)

  if (searchTerms.length > 0) {
    // Use the first significant word for the ilike search
    query = query.ilike("question", `%${searchTerms[0]}%`)
  }

  const { data: rawData, error } = await query.limit(3)
  const data = rawData as BusinessFaq[] | null

  if (error) {
    console.error("[AI Tool] answer_faq error:", error)
    return "Erro ao consultar a base de conhecimento."
  }

  if (!data || data.length === 0) {
    return JSON.stringify({
      found: false,
      message: "Não encontrei uma resposta específica para isso na nossa base de conhecimento.",
    })
  }

  const results = data.map((faq) => ({ question: faq.question, answer: faq.answer }))
  return JSON.stringify({ found: true, faqs: results })
}

async function handoffToHuman(input: ToolInput, conversationId: string, businessId: string): Promise<string> {
  const reason = String(input.reason ?? "Solicitado pelo cliente").trim()
  const urgency = String(input.urgency ?? "medium")

  const admin = createAdminClient()

  // Set status to "waiting" (human needed) and disable AI
  const { error } = await admin
    .from("conversations")
    .update({ status: "waiting", ai_active: false } as never)
    .eq("id", conversationId)

  if (error) {
    console.error("[AI Tool] handoff_to_human error:", error)
    return "Erro ao transferir para atendimento humano. Tente novamente."
  }

  // Best-effort notification
  try {
    const { createNotification } = await import("@/lib/notifications/actions")
    await createNotification({
      businessId,
      type: "handoff",
      title: "Conversa requer atendimento humano",
      body: `Motivo: ${reason}. Urgência: ${urgency}.`,
      link: `/dashboard/conversations?id=${conversationId}`,
    })
  } catch {
    // Non-fatal
  }

  return JSON.stringify({
    success: true,
    transferred: true,
    urgency,
    reason,
    message: "Entendido! Vou passar você para um de nossos atendentes. Aguarde um momento, por favor.",
  })
}

async function updateWorkItemStatus(input: ToolInput, businessId: string): Promise<string> {
  const work_item_id = String(input.work_item_id ?? "").trim()
  const status = String(input.status ?? "").trim()
  const notes = input.notes ? String(input.notes) : undefined

  if (!work_item_id) return "ID do agendamento é obrigatório."
  if (!status) return "Novo status é obrigatório."

  const admin = createAdminClient()

  const updateData: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (notes) updateData.notes = notes

  const { error } = await admin
    .from("work_items")
    .update(updateData as never)
    .eq("id", work_item_id)
    .eq("business_id", businessId)

  if (error) {
    console.error("[AI Tool] update_work_item_status error:", error)
    return JSON.stringify({ success: false, error: error.message })
  }

  return JSON.stringify({ success: true, message: `Status atualizado para "${status}" com sucesso.` })
}
