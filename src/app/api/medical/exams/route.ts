import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getBusinessPlan } from "@/lib/auth/plan"
import type { ExamRequest } from "@/types/database"

const EXAM_TYPES = ["laboratorial", "imagem", "outro"] as const

type Guard =
  | { ok: true; userId: string; businessId: string }
  | { ok: false; res: NextResponse }

async function guard(): Promise<Guard> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, res: NextResponse.json({ error: "Não autorizado" }, { status: 401 }) }

  const { data: rawBu } = await supabase.from("business_users").select("business_id").eq("user_id", user.id).single()
  const bu = rawBu as { business_id: string } | null
  if (!bu) return { ok: false, res: NextResponse.json({ error: "Sem negócio" }, { status: 403 }) }

  const plan = await getBusinessPlan(bu.business_id)
  if (plan !== "medical") return { ok: false, res: NextResponse.json({ error: "Plano médico necessário" }, { status: 403 }) }

  return { ok: true, userId: user.id, businessId: bu.business_id }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const g = await guard()
  if (!g.ok) return g.res
  const { businessId } = g

  const admin = createAdminClient()
  const customerId = req.nextUrl.searchParams.get("customerId")
  let q = admin.from("exam_requests" as never).select("*").eq("business_id", businessId).order("created_at", { ascending: false }) as ReturnType<typeof admin.from>
  if (customerId) q = q.eq("customer_id", customerId) as typeof q

  const { data, error } = await q
  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  return NextResponse.json((data ?? []) as unknown as ExamRequest[])
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const g = await guard()
  if (!g.ok) return g.res
  const { userId, businessId } = g

  const body = await req.json() as Partial<ExamRequest>
  if (body.exam_type && !EXAM_TYPES.includes(body.exam_type)) {
    return NextResponse.json({ error: "exam_type inválido. Use: laboratorial, imagem ou outro" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("exam_requests" as never)
    .insert({ ...body, business_id: businessId, created_by: userId } as never)
    .select()
    .single()

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  return NextResponse.json(data as unknown as ExamRequest, { status: 201 })
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const g = await guard()
  if (!g.ok) return g.res
  const { businessId } = g

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Parâmetro 'id' obrigatório" }, { status: 400 })

  const body = await req.json() as Partial<ExamRequest>
  if (body.exam_type && !EXAM_TYPES.includes(body.exam_type)) {
    return NextResponse.json({ error: "exam_type inválido. Use: laboratorial, imagem ou outro" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("exam_requests" as never)
    .update(body as never)
    .eq("id", id)
    .eq("business_id", businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  return NextResponse.json(data as unknown as ExamRequest)
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const g = await guard()
  if (!g.ok) return g.res
  const { businessId } = g

  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Parâmetro 'id' obrigatório" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from("exam_requests" as never)
    .delete()
    .eq("id", id)
    .eq("business_id", businessId)
  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
