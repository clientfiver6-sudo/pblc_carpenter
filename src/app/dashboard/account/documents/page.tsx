import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBusinessId } from "@/lib/auth/actions"
import { DocumentsClient, type BusinessDocument } from "@/components/documents/DocumentsClient"
import { FileText } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DocumentsPage() {
  const businessId = await getBusinessId()
  if (!businessId) redirect("/login")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const admin = createAdminClient()
  const { data: rawDocs } = await admin
    .from("business_documents")
    .select("id, file_name, file_url, file_type, storage_path, uploaded_at, analyzed, title, description, category")
    .eq("business_id", businessId)
    .order("uploaded_at", { ascending: false })

  const docs = (rawDocs ?? []) as unknown as BusinessDocument[]

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand/8 flex items-center justify-center shrink-0">
          <FileText className="w-4.5 h-4.5 text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink tracking-tight">Documentos</h1>
          <p className="text-xs text-ink-3 mt-0.5">A IA classifica e descreve cada arquivo automaticamente</p>
        </div>
      </div>
      <DocumentsClient businessId={businessId} initialDocs={docs} />
    </div>
  )
}
