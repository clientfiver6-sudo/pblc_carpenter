import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { EditWorkItemForm } from "./EditWorkItemForm"
import type { BusinessUser, WorkItemWithRelations } from "@/types/database"
import { ChevronLeft } from "lucide-react"

interface EditWorkItemPageProps {
  params: Promise<{ id: string }>
}

export default async function EditWorkItemPage({ params }: EditWorkItemPageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Get businessId
  const { data: rawBusinessUser } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const businessUser = rawBusinessUser as BusinessUser | null

  if (!businessUser) redirect("/onboarding")

  const businessId = businessUser.business_id

  // Fetch work item with relations — security: must belong to this business
  const { data: rawItem, error } = await supabase
    .from("work_items")
    .select(
      `
      *,
      customer:customers(*),
      service:services(*),
      assigned_staff:staff(*)
      `
    )
    .eq("id", id)
    .eq("business_id", businessId)
    .single()

  if (error || !rawItem) {
    redirect("/dashboard/work-items")
  }

  const item = rawItem as WorkItemWithRelations

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 md:px-8 py-7 pb-28">
      {/* Back link */}
      <Link
        href="/dashboard/work-items"
        className="text-sm text-ink-3 hover:text-ink flex items-center gap-1 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Atendimentos
      </Link>

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-ink tracking-tight">
          Editar Atendimento
        </h2>
        <p className="text-sm text-ink-3 mt-0.5">
          Atualize os dados do atendimento abaixo.
        </p>
      </div>

      {/* Form card */}
      <div className="bg-surface border border-border rounded-lg p-6 shadow-1 max-w-2xl">
        <EditWorkItemForm item={item} />
      </div>
    </div>
  )
}
