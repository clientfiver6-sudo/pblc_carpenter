import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const admin = createAdminClient()

  // Verify ownership via business_users
  const { data: docRaw } = await admin
    .from("business_documents")
    .select("storage_path, business_id")
    .eq("id", id)
    .single()
  if (!docRaw) return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 })
  const doc = docRaw as unknown as { business_id: string; storage_path: string | null }

  const { data: membership } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("business_id", doc.business_id)
    .single()
  if (!membership) return NextResponse.json({ error: "Proibido" }, { status: 403 })

  const storagePath = doc.storage_path
  if (storagePath) {
    await admin.storage.from("business-documents").remove([storagePath])
  }

  await admin.from("business_documents").delete().eq("id", id)

  return NextResponse.json({ ok: true })
}
