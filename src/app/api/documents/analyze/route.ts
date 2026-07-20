import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { timingSafeEqual } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"
import { TAG, delimit, DELIMITER_PREAMBLE } from "@/lib/ai/delimiter"

const anthropic = new Anthropic()

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { documentId, storagePath, businessId } = await req.json() as {
      documentId: string
      storagePath: string
      businessId: string
    }

    if (!documentId || !storagePath || !businessId) {
      return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 })
    }

    // Accept either an internal service call (CRON_SECRET) or a user session.
    const authHeader = req.headers.get("authorization") ?? ""
    const cronSecret = process.env.CRON_SECRET ?? ""
    const expected = `Bearer ${cronSecret}`
    const isInternalCall =
      cronSecret.length > 0 &&
      authHeader.length === expected.length &&
      timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))

    if (!isInternalCall) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

      // Verify caller owns this business.
      const { data: bu } = await supabase
        .from("business_users")
        .select("business_id")
        .eq("user_id", user.id)
        .eq("business_id", businessId)
        .single()
      if (!bu) return NextResponse.json({ error: "Acesso negado" }, { status: 403 })
    }

    const { allowed } = await checkRateLimit(`doc-analyze:${businessId}`, 10, 86_400_000)
    if (!allowed) return NextResponse.json({ error: "Limite de análises atingido por hoje." }, { status: 429 })

    const admin = createAdminClient()

    // Verify the document belongs to the claimed business and fetch file_type.
    const { data: docCheck } = await admin
      .from("business_documents" as never)
      .select("id, file_type")
      .eq("id", documentId)
      .eq("business_id", businessId)
      .single()
    if (!docCheck) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 })
    const fileType = (docCheck as { id: string; file_type: string }).file_type

    // Download file from storage
    const { data: fileData, error: downloadError } = await admin.storage
      .from("business-documents")
      .download(storagePath)

    if (downloadError || !fileData) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 })
    }

    const isImage = fileType.startsWith("image/")

    const EXTRACTION_PROMPT = `Extraia as informações do documento e retorne JSON com esta estrutura:
{
  "classification": {
    "title": "título curto e descritivo para o documento (máx. 60 chars)",
    "description": "1-2 frases resumindo o conteúdo do documento",
    "category": "preco|cardapio|contrato|manual|portfolio|relatorio|ficha_tecnica|outro"
  },
  "business_name": "string ou null",
  "services": [{ "name": "string", "duration_minutes": number, "price": number }],
  "staff": [{ "name": "string", "role": "string" }],
  "opening_hours": {
    "mon": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
    "tue": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
    "wed": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
    "thu": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
    "fri": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
    "sat": { "open": boolean, "start": "HH:MM", "end": "HH:MM" },
    "sun": { "open": boolean, "start": "HH:MM", "end": "HH:MM" }
  }
}
Categorias: preco=tabela de preços/serviços, cardapio=menu/cardápio, contrato=contrato/acordo, manual=manual/instrução, portfolio=portfólio/catálogo, relatorio=relatório/análise, ficha_tecnica=especificação técnica, outro=qualquer outro.
Arrays vazios se não encontrado. null para campos de texto não encontrados.`

    type ImageMediaType = "image/jpeg" | "image/png" | "image/webp"
    type UserContent = Anthropic.MessageParam["content"]

    let userContent: UserContent
    if (isImage) {
      const buffer = await fileData.arrayBuffer()
      const base64 = Buffer.from(buffer).toString("base64")
      userContent = [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: fileType as ImageMediaType,
            data: base64,
          },
        },
        { type: "text", text: EXTRACTION_PROMPT },
      ]
    } else {
      const text = await fileData.text()
      userContent = `${EXTRACTION_PROMPT}\n\n${delimit(TAG.documentContent, text.slice(0, 8000))}`
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      temperature: 0,
      system: `${DELIMITER_PREAMBLE}

Você é um assistente que extrai informações de documentos de negócios brasileiros.
Analise o documento e extraia as seguintes informações quando disponíveis.
Responda APENAS com JSON válido, sem explicações adicionais.
Preços como números decimais (ex: 150.00). Durações em minutos.`,
      messages: [{ role: "user", content: userContent }],
    })

    const raw = message.content[0]
    if (raw.type !== "text") throw new Error("Unexpected response type")

    let jsonText = raw.text.trim()
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim()
    }

    const extracted = JSON.parse(jsonText) as {
      classification?: { title?: string; description?: string; category?: string }
      business_name?: string | null
      services?: Array<{ name: string; duration_minutes: number; price: number }>
      staff?: Array<{ name: string; role: string }>
      opening_hours?: Record<string, unknown>
    }

    // Apply extracted data to business
    const updates: Record<string, unknown> = {}
    if (extracted.business_name) updates.name = extracted.business_name
    if (extracted.opening_hours && Object.keys(extracted.opening_hours).length > 0) {
      updates.opening_hours = extracted.opening_hours
    }

    if (Object.keys(updates).length > 0) {
      await admin.from("businesses").update(updates as never).eq("id", businessId)
    }

    if (extracted.services && extracted.services.length > 0) {
      await admin.from("services").insert(
        extracted.services.map(s => ({
          business_id: businessId,
          name: s.name,
          duration_minutes: s.duration_minutes ?? 60,
          price: Math.round((s.price ?? 0) * 100),
        })) as never
      )
    }

    if (extracted.staff && extracted.staff.length > 0) {
      await admin.from("staff").insert(
        extracted.staff.map(s => ({
          business_id: businessId,
          name: s.name,
          role: s.role ?? "Colaborador",
        })) as never
      )
    }

    // Save classification + mark analyzed
    const docUpdate: Record<string, unknown> = { analyzed: true }
    if (extracted.classification?.title) docUpdate.title = extracted.classification.title
    if (extracted.classification?.description) docUpdate.description = extracted.classification.description
    if (extracted.classification?.category) docUpdate.category = extracted.classification.category
    await admin.from("business_documents" as never).update(docUpdate as never).eq("id", documentId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Erro ao analisar documento" }, { status: 500 })
  }
}
