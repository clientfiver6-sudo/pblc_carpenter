import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const form = await req.formData()
    const file = form.get("file") as File | null
    const businessId = form.get("businessId") as string | null

    if (!file || !businessId) {
      return NextResponse.json({ error: "file e businessId são obrigatórios" }, { status: 400 })
    }

    // Verify business belongs to user
    const { data: bu } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", user.id)
      .eq("business_id", businessId)
      .single()
    if (!bu) return NextResponse.json({ error: "Acesso negado" }, { status: 403 })

    const { allowed, resetAt } = await checkRateLimit(`doc-upload:${user.id}`, 20, 3_600_000)
    if (!allowed) {
      const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
      return NextResponse.json(
        { error: "Limite de requisições atingido. Tente novamente em breve." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      )
    }

    // Validate file type and size before touching storage.
    const ALLOWED_TYPES = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
      "text/csv",
    ])
    const MAX_BYTES = 20 * 1024 * 1024 // 20 MB
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Arquivo excede o limite de 20 MB" }, { status: 400 })
    }

    const admin = createAdminClient()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_")
    const fileName = `${Date.now()}-${safeName}`
    const storagePath = `${businessId}/${fileName}`

    const { error: uploadError } = await admin.storage
      .from("business-documents")
      .upload(storagePath, file, { contentType: file.type })

    if (uploadError) {
      return NextResponse.json({ error: "Erro ao fazer upload do arquivo" }, { status: 500 })
    }

    const { data: urlData } = admin.storage
      .from("business-documents")
      .getPublicUrl(storagePath)

    const { data: doc, error: insertError } = await admin
      .from("business_documents")
      .insert({
        business_id: businessId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: file.type,
        storage_path: storagePath,
        analyzed: false,
      } as never)
      .select("id")
      .single()

    if (insertError) {
      return NextResponse.json({ error: "Erro ao salvar documento" }, { status: 500 })
    }

    // Fire-and-forget analysis — authenticate as internal service call.
    void fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/documents/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.CRON_SECRET ?? ""}`,
      },
      body: JSON.stringify({ documentId: (doc as { id: string }).id, storagePath, businessId }),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Erro ao processar upload" }, { status: 500 })
  }
}
