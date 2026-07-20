import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBusinessPlan } from "@/lib/auth/plan"
import { checkRateLimit } from "@/lib/rate-limit"
import { transcribeAudio } from "@/lib/voice/stt"
import { selectModel, TaskComplexity } from "@/lib/ai/model-router"
import { logUsage } from "@/lib/ai/usage"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const { data: rawBu } = await supabase.from("business_users").select("business_id").eq("user_id", user.id).single()
  const bu = rawBu as { business_id: string } | null
  if (!bu) return NextResponse.json({ error: "Sem negócio" }, { status: 403 })
  const businessId = bu.business_id

  const plan = await getBusinessPlan(businessId)
  if (plan !== "medical") return NextResponse.json({ error: "Plano médico necessário" }, { status: 403 })

  const { allowed } = await checkRateLimit(`medical_transcribe:${businessId}`, 20, 3_600_000)
  if (!allowed) return NextResponse.json({ error: "Limite atingido. Tente em 1 hora." }, { status: 429 })

  const admin = createAdminClient()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 })
  }

  const audio = formData.get("audio")
  const customerId = formData.get("customerId")
  const workItemId = formData.get("workItemId") ?? null

  if (!(audio instanceof File)) return NextResponse.json({ error: "Campo 'audio' obrigatório" }, { status: 400 })
  if (typeof customerId !== "string" || !customerId) return NextResponse.json({ error: "Campo 'customerId' obrigatório" }, { status: 400 })
  if (audio.size > 50 * 1024 * 1024) return NextResponse.json({ error: "Arquivo muito grande (máximo 50 MB)" }, { status: 400 })

  const path = `${businessId}/${Date.now()}-${audio.name}`
  const { error: uploadError } = await admin.storage.from("medical-audio").upload(path, audio)
  if (uploadError) return NextResponse.json({ error: "Falha ao fazer upload do áudio" }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from("medical-audio").getPublicUrl(path)

  const transcript = await transcribeAudio(publicUrl)
  if (!transcript) return NextResponse.json({ error: "Não foi possível transcrever o áudio" }, { status: 422 })

  let soap: { subjective: string; objective: string; assessment: string; plan_text: string }
  try {
    const model = selectModel(TaskComplexity.COMPLEX)
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: "Você é um assistente médico. Gere uma nota SOAP estruturada em português brasileiro.",
      messages: [
        {
          role: "user",
          content: `Transcrição da consulta: ${transcript}\n\nGere JSON: { "subjective": "...", "objective": "...", "assessment": "...", "plan_text": "..." }`,
        },
      ],
    })
    void logUsage(businessId, "medical.transcribe", msg.usage, model)

    const text = msg.content[0].type === "text" ? msg.content[0].text : ""
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("No JSON in response")
    soap = JSON.parse(jsonMatch[0]) as typeof soap
  } catch {
    return NextResponse.json({ error: "Falha ao gerar nota SOAP" }, { status: 500 })
  }

  return NextResponse.json({ audioUrl: publicUrl, transcript, soap, customerId, workItemId })
}
