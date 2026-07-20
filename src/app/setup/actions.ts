"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import Anthropic from "@anthropic-ai/sdk"
import { resolvePromo } from "@/lib/subscription/promo"
import { sendSetupCompleteEmail } from "@/lib/email"
import { getPlatformConfig } from "@/lib/platform-config"

export async function checkPhoneAvailable(
  phone: string,
  currentBusinessId: string
): Promise<{ available: boolean }> {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 10) return { available: true }

  const admin = createAdminClient()
  const { data } = await admin
    .from("businesses")
    .select("id, phone")
    .neq("id", currentBusinessId)
    .not("phone", "is", null)

  if (!data) return { available: true }

  const taken = (data as Array<{ id: string; phone: string | null }>).some(
    (b) => (b.phone ?? "").replace(/\D/g, "") === digits
  )
  return { available: !taken }
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  ac_residential: "ar-condicionado residencial",
  ac_commercial: "climatização comercial",
  refrigeration: "refrigeração",
  electrician: "eletricista",
  plumber: "encanador",
  locksmith: "serralheiro",
  cleaning: "limpeza",
  pest_control: "dedetização",
  other_service_business: "prestação de serviços",
}

export async function generateStepContent(
  step: "services" | "hours" | "team" | "clients",
  businessType: string,
  businessName: string,
  userPrompt?: string
): Promise<{ content?: string; question?: string; outOfScope?: boolean; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: "API não configurada." }

  const typeLabel = BUSINESS_TYPE_LABELS[businessType] ?? businessType

  const autoPrompts: Record<"services" | "hours" | "team" | "clients", string> = {
    services: `Liste de 5 a 7 serviços típicos com preços aproximados (em reais) para uma empresa de ${typeLabel} chamada "${businessName}" no Brasil.
Formato exato, um serviço por linha:
Nome do serviço — R$ valor
Somente a lista. Sem cabeçalho, sem explicação.`,

    hours: `Escreva os horários de atendimento típicos para uma empresa de ${typeLabel} no Brasil.
Formato exato:
Segunda a Sexta: 8h às 18h
Sábado: 8h às 13h
Domingo: Fechado
Somente os horários. Sem cabeçalho, sem explicação.`,

    team: `Liste uma equipe típica para uma pequena empresa de ${typeLabel} no Brasil com 2 a 4 pessoas.
Formato exato, uma pessoa por linha:
Nome — Função
Use nomes brasileiros reais. Somente a lista.`,

    clients: `PERGUNTA: Quais são os nomes e telefones dos seus clientes existentes? Liste um por linha (ex: João Silva — (11) 99999-8888).`,
  }

  const extractionPrompts: Record<"services" | "hours" | "team" | "clients", string> = {
    services: `Informações fornecidas pelo dono do negócio sobre seus serviços (pode conter descrição inicial seguida de respostas a perguntas anteriores):

${userPrompt}

REGRAS OBRIGATÓRIAS:
- Se o conteúdo acima não for sobre serviços de um negócio (ex: pesquisa acadêmica, receitas, notícias, animais, tópicos aleatórios), responda APENAS com: FORA_DO_ASSUNTO
- Se não houver serviços específicos identificáveis (ex: "faço vários serviços", "tenho serviços"), responda APENAS com: PERGUNTA: [uma pergunta direta em português para descobrir quais serviços específicos o negócio oferece]
- Extraia APENAS os serviços mencionados explicitamente. NUNCA invente ou adicione serviços não mencionados.
- Se qualquer serviço identificado não tiver preço explicitamente mencionado, responda APENAS com: PERGUNTA: Quais são os preços dos seus serviços? Liste os serviços que identificou e informe o valor de cada um em reais (ex: Instalação R$ 200, Manutenção R$ 80).
- Se todos os serviços tiverem preço, formate a lista:
Nome do serviço — R$ valor
Somente a lista. Sem cabeçalho, sem explicação.`,

    hours: `Informações fornecidas pelo dono do negócio sobre horários de atendimento (pode conter descrição inicial seguida de respostas a perguntas anteriores):

${userPrompt}

REGRAS OBRIGATÓRIAS:
- Se o conteúdo acima não for sobre horários de atendimento de um negócio (ex: pesquisa, receitas, notícias, animais, tópicos aleatórios), responda APENAS com: FORA_DO_ASSUNTO
- Formate APENAS os horários mencionados explicitamente. NUNCA invente horários não mencionados.
- Se não houver horários específicos identificáveis (ex: "horário comercial", "aberto todo dia" sem horas exatas), responda APENAS com: PERGUNTA: [uma pergunta direta em português para descobrir os horários específicos]
- Se houver horários identificáveis, formate assim:
Segunda a Sexta: 8h às 18h
Sábado: 8h às 13h
Domingo: Fechado
Somente os horários. Sem cabeçalho.`,

    team: `Informações fornecidas pelo dono do negócio sobre sua equipe (pode conter descrição inicial seguida de respostas a perguntas anteriores):

${userPrompt}

REGRAS OBRIGATÓRIAS:
- Se o conteúdo acima não for sobre membros da equipe de um negócio (ex: pesquisa, receitas, notícias, animais, tópicos aleatórios), responda APENAS com: FORA_DO_ASSUNTO
- Extraia APENAS os membros mencionados explicitamente. NUNCA invente nomes ou funções não mencionados.
- Se não houver membros identificáveis (ex: "tenho funcionários", "somos uma equipe" sem nomes ou funções), responda APENAS com: PERGUNTA: [uma pergunta direta em português para descobrir os nomes e funções das pessoas]
- Se houver pelo menos um membro identificável, formate a lista:
Nome — Função
Somente a lista. Sem cabeçalho.`,

    clients: `Informações fornecidas pelo dono do negócio sobre seus clientes existentes (pode conter descrição inicial seguida de respostas a perguntas anteriores):

${userPrompt}

REGRAS OBRIGATÓRIAS:
- Se o conteúdo acima não for sobre clientes de um negócio (ex: pesquisa, receitas, notícias, animais, tópicos aleatórios), responda APENAS com: FORA_DO_ASSUNTO
- Extraia APENAS os clientes mencionados explicitamente. NUNCA invente nomes ou telefones.
- Se não houver clientes identificáveis, responda APENAS com: PERGUNTA: [uma pergunta direta em português para descobrir os nomes e telefones dos clientes]
- Se houver pelo menos um cliente identificável, formate a lista:
Nome — Telefone (se tiver telefone)
ou apenas: Nome (se não tiver telefone)
Somente a lista. Sem cabeçalho.`,
  }

  const prompt = userPrompt?.trim() ? extractionPrompts[step] : autoPrompts[step]

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    })
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : ""
    if (!text) return { error: "Resposta vazia. Tente novamente." }
    if (text === "FORA_DO_ASSUNTO" || text.startsWith("FORA_DO_ASSUNTO")) {
      return { outOfScope: true }
    }
    if (text.startsWith("PERGUNTA:")) {
      return { question: text.replace(/^PERGUNTA:\s*/, "").trim() }
    }
    return { content: text }
  } catch {
    return { error: "Erro ao gerar sugestão. Tente novamente." }
  }
}

// ── Document analysis for setup wizard ────────────────────────────────────────

export async function analyzeDocumentsForSetup(
  formData: FormData
): Promise<{ services?: string; hours?: string; team?: string; name?: string; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: "API não configurada." }

  const businessId = (formData.get("businessId") as string | null) ?? null

  // Collect all files from FormData
  const fileEntries: Array<{ file: File; description: string }> = []
  let i = 0
  while (formData.has(`file_${i}`)) {
    const file = formData.get(`file_${i}`) as File | null
    const desc = (formData.get(`desc_${i}`) as string | null) ?? ""
    if (file) fileEntries.push({ file, description: desc })
    i++
  }

  if (fileEntries.length === 0) return {}

  // Read text content for AI extraction (skip binary files)
  const textDocs: Array<{ text: string; description: string }> = []
  for (const { file, description } of fileEntries) {
    try {
      const text = await file.text()
      if (text && !text.includes("\x00")) {
        textDocs.push({ text: text.slice(0, 4000), description })
      }
    } catch {
      // skip unreadable
    }
  }

  // Storage upload task — uploads all files to Supabase and fires analyze trigger
  const storageTask = businessId
    ? (async () => {
        const admin = createAdminClient()
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
        for (const { file } of fileEntries) {
          try {
            const fileName = `${Date.now()}-${file.name}`
            const storagePath = `${businessId}/${fileName}`
            const bytes = await file.arrayBuffer()
            const { error: uploadError } = await admin.storage
              .from("business-documents")
              .upload(storagePath, bytes, { contentType: file.type || "application/octet-stream" })
            if (uploadError) continue
            const { data: urlData } = admin.storage
              .from("business-documents")
              .getPublicUrl(storagePath)
            const { data: doc } = await admin
              .from("business_documents")
              .insert({
                business_id: businessId,
                file_name: file.name,
                file_url: urlData.publicUrl,
                file_type: file.type || "application/octet-stream",
                storage_path: storagePath,
                analyzed: false,
              } as never)
              .select("id")
              .single()
            if (doc) {
              void fetch(`${appUrl}/api/documents/analyze`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${process.env.CRON_SECRET ?? ""}`,
                },
                body: JSON.stringify({ documentId: (doc as { id: string }).id, storagePath, businessId }),
              })
            }
          } catch {
            // non-critical
          }
        }
      })()
    : Promise.resolve()

  if (textDocs.length === 0) {
    await storageTask
    return {}
  }

  const docBlocks = textDocs.map((d, idx) => {
    const label = d.description.trim() ? `Documento ${idx + 1} (${d.description})` : `Documento ${idx + 1}`
    return `=== ${label} ===\n${d.text}`
  }).join("\n\n")

  const prompt = `Analise os documentos abaixo de um negócio brasileiro e extraia as informações.

${docBlocks}

Retorne APENAS um JSON com esta estrutura (omita campos que não encontrar):
{
  "name": "Nome do negócio (se encontrar)",
  "services": "Lista de serviços, um por linha no formato: Nome do serviço — R$ valor",
  "hours": "Horários de atendimento, um por linha no formato: Segunda a Sexta: 8h às 18h",
  "team": "Equipe, uma pessoa por linha no formato: Nome — Função"
}

Retorne apenas o JSON, sem explicação.`

  try {
    const [aiResult] = await Promise.allSettled([
      new Anthropic({ apiKey }).messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
      storageTask,
    ])
    if (aiResult.status === "rejected") return {}
    const raw = aiResult.value.content[0]?.type === "text" ? aiResult.value.content[0].text.trim() : ""
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return {}
    const parsed = JSON.parse(jsonMatch[0]) as {
      name?: string; services?: string; hours?: string; team?: string
    }
    return {
      name: parsed.name?.trim() || undefined,
      services: parsed.services?.trim() || undefined,
      hours: parsed.hours?.trim() || undefined,
      team: parsed.team?.trim() || undefined,
    }
  } catch {
    return {}
  }
}

// ── Payment method normalization ──────────────────────────────────────────────

const PAYMENT_LABEL_TO_CODE: Record<string, string> = {
  "PIX": "pix", "Pix": "pix",
  "Cartão de crédito": "card", "Cartão de débito": "card", "Cartão": "card",
  "Dinheiro": "cash",
  "Boleto": "boleto",
  "Transferência": "transfer", "Transferência bancária": "transfer",
  "Cheque": "cash",
}

function normalizePaymentMethods(methods: string[]): string[] {
  const codes = methods.map(m => PAYMENT_LABEL_TO_CODE[m] ?? m.toLowerCase())
  return [...new Set(codes)]
}

// ── Parsing helpers for finalizeBusiness ──────────────────────────────────────

type OpeningHoursDay = { open: boolean; start: string; end: string }
type OpeningHours = Record<string, OpeningHoursDay>

const PT_TO_WEEKDAY: Record<string, string> = {
  segunda: "mon", terca: "tue", quarta: "wed",
  quinta: "thu", sexta: "fri", sabado: "sat", domingo: "sun",
}
const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

function normalizePt(s: string): string {
  return s.trim().toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
}

function parseHoursToJson(text: string): OpeningHours {
  const result: OpeningHours = {}
  if (!text) return result

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (!line) continue
    const colon = line.indexOf(":")
    if (colon === -1) continue

    const dayRaw = normalizePt(line.slice(0, colon))
    const hoursRaw = line.slice(colon + 1).trim().toLowerCase()

    // Resolve weekday keys for this line
    const keys: string[] = []
    const rangeMatch = dayRaw.match(/^(.+?)\s+a\s+(.+)$/)
    if (rangeMatch) {
      const from = PT_TO_WEEKDAY[normalizePt(rangeMatch[1]!)]
      const to = PT_TO_WEEKDAY[normalizePt(rangeMatch[2]!)]
      if (from && to) {
        const fi = WEEKDAY_ORDER.indexOf(from)
        const ti = WEEKDAY_ORDER.indexOf(to)
        if (fi !== -1 && ti !== -1 && fi <= ti) {
          for (let i = fi; i <= ti; i++) keys.push(WEEKDAY_ORDER[i]!)
        }
      }
    } else {
      const k = PT_TO_WEEKDAY[dayRaw]
      if (k) keys.push(k)
    }
    if (keys.length === 0) continue

    if (/fech/.test(hoursRaw)) {
      for (const k of keys) result[k] = { open: false, start: "08:00", end: "18:00" }
      continue
    }

    const m = hoursRaw.match(/(\d+)h?(?::(\d+))?\s*(?:às|as|[-–—])\s*(\d+)h?(?::(\d+))?/)
    if (m) {
      const startH = parseInt(m[1]!, 10)
      const startMin = parseInt(m[2] ?? "0", 10)
      const endH = parseInt(m[3]!, 10)
      const endMin = parseInt(m[4] ?? "0", 10)
      const start = `${String(startH).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`
      const end = `${String(endH).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`
      for (const k of keys) result[k] = { open: true, start, end }
    }
  }
  return result
}

function parseServicesToInserts(
  text: string,
  businessId: string
): Array<{ name: string; price: number; duration_minutes: number; active: boolean; business_id: string }> {
  const rows = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const m = trimmed.match(/^(.+?)\s*[—\-–]\s*R\$\s*([\d.,]+)/)
    if (m) {
      const name = m[1]!.trim()
      const priceStr = m[2]!.replace(/\./g, "").replace(",", ".")
      const price = parseFloat(priceStr)
      if (name && !isNaN(price)) {
        rows.push({ name, price, duration_minutes: 60, active: true, business_id: businessId })
      }
    }
  }
  return rows
}

function parseTeamToInserts(
  text: string,
  businessId: string
): Array<{ name: string; role: string; active: boolean; business_id: string; color: string; working_hours: Record<string, never>; services: string[] }> {
  const rows = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || /trabalho sozinho/i.test(trimmed)) continue
    const m = trimmed.match(/^(.+?)\s*[—\-–]\s*(.+)$/)
    if (m) {
      const name = m[1]!.trim()
      const role = m[2]!.trim()
      if (name && role) {
        rows.push({ name, role, active: true, business_id: businessId, color: "#E85D1F", working_hours: {}, services: [] })
      }
    }
  }
  return rows
}

function parseClientsToInserts(
  text: string,
  businessId: string
): Array<{ full_name: string; phone_number: string | null; business_id: string }> {
  const rows = []
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const m = trimmed.match(/^(.+?)\s*[—\-–]\s*(.+)$/)
    if (m) {
      const name = m[1]!.trim()
      const phone = m[2]!.trim()
      if (name) rows.push({ full_name: name, phone_number: phone || null, business_id: businessId })
    } else {
      rows.push({ full_name: trimmed, phone_number: null, business_id: businessId })
    }
  }
  return rows
}

// ── Finalize ──────────────────────────────────────────────────────────────────

export type FinalizeResult = { error?: string }

export interface FinalizeData {
  businessId: string
  type: string
  name: string
  address: string
  phone: string
  services: string
  workingHours: string
  team: string
  clients?: string
  paymentMethods: string[]
  cnpj: string
  plan: "starter" | "pro" | "medical"
  // location
  city?: string
  state?: string
  zipCode?: string
  // legal step
  companyType?: string
  legalName?: string
  cpfOwner?: string
  stateRegistration?: string
  municipalRegistration?: string
  // checkout step
  pixKey?: string
  pixKeyType?: string
  promoCode?: string
}

export async function finalizeBusiness(data: FinalizeData): Promise<FinalizeResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { data: bu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", data.businessId)
    .maybeSingle()
  if (!bu) return { error: "Negócio não encontrado" }

  const admin = createAdminClient()

  // Idempotency: if already onboarded (e.g. double-submit), redirect immediately
  const { data: existingBiz } = await admin
    .from("businesses")
    .select("onboarded")
    .eq("id", data.businessId)
    .single()
  if (existingBiz?.onboarded) redirect("/dashboard")

  // Phone uniqueness guard
  if (data.phone.trim()) {
    const phoneDigits = data.phone.replace(/\D/g, "")
    const { data: existing } = await admin
      .from("businesses")
      .select("id, phone")
      .neq("id", data.businessId)
      .not("phone", "is", null)
    if (existing) {
      const taken = (existing as Array<{ id: string; phone: string | null }>).some(
        (b) => (b.phone ?? "").replace(/\D/g, "") === phoneDigits
      )
      if (taken) return { error: "Este telefone já está cadastrado em outro negócio." }
    }
  }

  // Parse structured data from text fields
  const openingHours = parseHoursToJson(data.workingHours)

  // Resolve promo code — promo overrides selected plan and grants active status
  const promo = resolvePromo(data.promoCode)
  const effectivePlan = promo?.plan ?? data.plan
  const subscriptionStatus = promo?.status ?? "trialing"
  const subscriptionEndsAt = promo?.endsAt ?? null

  const { error } = await admin
    .from("businesses")
    .update({
      name: data.name.trim(),
      type: data.type as never,
      address: data.address.trim() || null,
      phone: data.phone.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      zip_code: data.zipCode?.trim() || null,
      pix_key: data.pixKey?.trim() || null,
      pix_key_type: data.pixKeyType?.trim() || null,
      subscription_plan: effectivePlan,
      subscription_status: subscriptionStatus,
      subscription_ends_at: subscriptionEndsAt,
      onboarded: true,
      opening_hours: Object.keys(openingHours).length > 0 ? openingHours as never : undefined,
      settings: {
        address: data.address.trim(),
        services_text: data.services.trim(),
        working_hours: data.workingHours.trim(),
        team_text: data.team.trim(),
        payment_methods: normalizePaymentMethods(data.paymentMethods),
        cnpj: data.cnpj.trim() || null,
        company_type: data.companyType || null,
        legal_name: data.legalName?.trim() || null,
        cpf_owner: data.cpfOwner?.trim() || null,
        state_registration: data.stateRegistration?.trim() || null,
        municipal_registration: data.municipalRegistration?.trim() || null,
        promo_code: data.promoCode?.trim() || null,
      },
    } as never)
    .eq("id", data.businessId)

  if (error) return { error: "Erro ao salvar configurações. Tente novamente." }

  // Insert services into services table (non-blocking — never let errors block redirect)
  const serviceRows = parseServicesToInserts(data.services, data.businessId)
  if (serviceRows.length > 0) {
    try { await admin.from("services").insert(serviceRows as never) } catch {}
  }

  // Insert staff into staff table (non-blocking)
  const staffRows = parseTeamToInserts(data.team, data.businessId)
  if (staffRows.length > 0) {
    try { await admin.from("staff").insert(staffRows as never) } catch {}
  }

  // Insert existing clients into customers table (non-blocking)
  if (data.clients?.trim()) {
    const clientRows = parseClientsToInserts(data.clients, data.businessId)
    if (clientRows.length > 0) {
      try { await admin.from("customers").insert(clientRows as never) } catch {}
    }
  }

  if (user.email) {
    sendSetupCompleteEmail({
      to: user.email,
      businessName: data.name.trim(),
      plan: effectivePlan === "medical" ? "Medical" : effectivePlan === "pro" ? "Pro" : "Starter",
    }).catch(() => {})
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

// ── Subscribe + save (paid path, no promo code) ───────────────────────────────

export async function saveAndSubscribe(
  data: FinalizeData
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Não autenticado" }

  const { data: bu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", data.businessId)
    .maybeSingle()
  if (!bu) return { error: "Negócio não encontrado" }

  const admin = createAdminClient()
  const openingHours = parseHoursToJson(data.workingHours)

  const { error } = await admin
    .from("businesses")
    .update({
      name: data.name.trim(),
      type: data.type as never,
      address: data.address.trim() || null,
      phone: data.phone.trim() || null,
      city: data.city?.trim() || null,
      state: data.state?.trim() || null,
      zip_code: data.zipCode?.trim() || null,
      pix_key: data.pixKey?.trim() || null,
      pix_key_type: data.pixKeyType?.trim() || null,
      subscription_plan: data.plan,
      subscription_status: "pending",
      onboarded: false,
      opening_hours: Object.keys(openingHours).length > 0 ? openingHours as never : undefined,
      settings: {
        address: data.address.trim(),
        services_text: data.services.trim(),
        working_hours: data.workingHours.trim(),
        team_text: data.team.trim(),
        payment_methods: normalizePaymentMethods(data.paymentMethods),
        cnpj: data.cnpj.trim() || null,
        company_type: data.companyType || null,
        legal_name: data.legalName?.trim() || null,
        cpf_owner: data.cpfOwner?.trim() || null,
        state_registration: data.stateRegistration?.trim() || null,
        municipal_registration: data.municipalRegistration?.trim() || null,
        promo_code: null,
      },
    } as never)
    .eq("id", data.businessId)

  if (error) return { error: "Erro ao salvar. Tente novamente." }

  const serviceRows = parseServicesToInserts(data.services, data.businessId)
  if (serviceRows.length > 0) {
    try { await admin.from("services").insert(serviceRows as never) } catch {}
  }
  const staffRows = parseTeamToInserts(data.team, data.businessId)
  if (staffRows.length > 0) {
    try { await admin.from("staff").insert(staffRows as never) } catch {}
  }

  if (data.clients?.trim()) {
    const clientRows = parseClientsToInserts(data.clients, data.businessId)
    if (clientRows.length > 0) {
      try { await admin.from("customers").insert(clientRows as never) } catch {}
    }
  }

  const [apiKey, starterPlanId, proPlanId, medicalPlanId] = await Promise.all([
    getPlatformConfig("mercadopago_platform_access_token"),
    getPlatformConfig("mercadopago_starter_plan_id"),
    getPlatformConfig("mercadopago_pro_plan_id"),
    getPlatformConfig("mercadopago_medical_plan_id"),
  ])
  const planId =
    data.plan === "starter" ? starterPlanId :
    data.plan === "medical" ? medicalPlanId :
    proPlanId
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // Dev / unconfigured — activate directly without payment
  if (!apiKey || !planId) {
    await admin
      .from("businesses")
      .update({ onboarded: true, subscription_status: "active" } as never)
      .eq("id", data.businessId)
    revalidatePath("/", "layout")
    return { url: "/dashboard" }
  }

  try {
    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preapproval_plan_id: planId,
        payer_email: user.email,
        back_url: `${appUrl}/dashboard`,
        external_reference: data.businessId,
      }),
    })

    if (!res.ok) {
      console.error("[saveAndSubscribe] MP preapproval failed:", res.status)
      return { error: "Erro ao processar pagamento. Tente novamente." }
    }

    const mp = (await res.json()) as { id: string; init_point: string }
    await admin
      .from("businesses")
      .update({ mp_subscription_id: mp.id } as never)
      .eq("id", data.businessId)

    return { url: mp.init_point }
  } catch {
    return { error: "Erro ao conectar com o serviço de pagamento." }
  }
}
