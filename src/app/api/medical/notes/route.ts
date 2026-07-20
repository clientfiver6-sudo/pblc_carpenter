import { NextRequest, NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBusinessPlan } from "@/lib/auth/plan"
import type { MedicalNote } from "@/types/database"

type Guard = { ok: true; user: { id: string }; businessId: string; db: SupabaseClient } | { ok: false; res: NextResponse }

async function guard(): Promise<Guard> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }

  const { data: rawBu } = await supabase.from("business_users").select("business_id").eq("user_id", user.id).single()
  const bu = rawBu as { business_id: string } | null
  if (!bu) return { ok: false, res: NextResponse.json({ error: "Sem negócio" }, { status: 403 }) }
  const businessId = bu.business_id

  const plan = await getBusinessPlan(businessId)
  if (plan !== "medical") return { ok: false, res: NextResponse.json({ error: "Plano médico necessário" }, { status: 403 }) }

  const db = createAdminClient() as unknown as SupabaseClient
  return { ok: true, user, businessId, db }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const g = await guard()
  if (!g.ok) return g.res
  const { businessId, db } = g

  const customerId = req.nextUrl.searchParams.get("customerId")
  let query = db.from("medical_notes").select("*").eq("business_id", businessId).order("created_at", { ascending: false })
  if (customerId) {
    // Confirm the customer belongs to this business before filtering, so the
    // response can't be used to probe customer ids from other tenants
    const { data: owned } = await db.from("customers").select("id").eq("id", customerId).eq("business_id", businessId).maybeSingle()
    if (!owned) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
    query = query.eq("customer_id", customerId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  return NextResponse.json(data as MedicalNote[])
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const g = await guard()
  if (!g.ok) return g.res
  const { user, businessId, db } = g

  const body = await req.json() as Partial<MedicalNote>
  if (body.customer_id) {
    const { data: owned } = await db.from("customers").select("id").eq("id", body.customer_id).eq("business_id", businessId).maybeSingle()
    if (!owned) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  }
  const { data, error } = await db
    .from("medical_notes")
    .insert({ ...body, business_id: businessId, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const g = await guard()
  if (!g.ok) return g.res
  const { businessId, db } = g

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Parâmetro 'id' obrigatório" }, { status: 400 })

  const body = await req.json() as Partial<MedicalNote>
  const { data, error } = await db
    .from("medical_notes")
    .update(body)
    .eq("id", id)
    .eq("business_id", businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const g = await guard()
  if (!g.ok) return g.res
  const { businessId, db } = g

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Parâmetro 'id' obrigatório" }, { status: 400 })

  const { error } = await db.from("medical_notes").delete().eq("id", id).eq("business_id", businessId)
  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
