import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { checkRateLimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

    const { businessId, field, value } = await req.json() as {
      businessId: string
      field: string
      value: unknown
    }

    if (!businessId || !field) {
      return NextResponse.json({ error: "Campos obrigatórios: businessId, field" }, { status: 400 })
    }

    // Verify business belongs to user
    const { data: bu } = await supabase
      .from("business_users")
      .select("business_id")
      .eq("user_id", user.id)
      .eq("business_id", businessId)
      .single()
    if (!bu) return NextResponse.json({ error: "Acesso negado" }, { status: 403 })

    const { allowed } = await checkRateLimit(`onboarding-save:${user.id}`, 10, 60_000)
    if (!allowed) return NextResponse.json({ error: "Muitas requisições." }, { status: 429 })

    const admin = createAdminClient()

    if (field === "services") {
      const services = value as Array<{ name: string; duration_minutes: number; price: number }>
      if (Array.isArray(services) && services.length > 0) {
        // Delete existing services first
        await admin.from("services").delete().eq("business_id", businessId)
        await admin.from("services").insert(
          services.map(s => ({
            business_id: businessId,
            name: s.name,
            duration_minutes: s.duration_minutes ?? 60,
            price: Math.round((s.price ?? 0) * 100),
          })) as never
        )
      }
      return NextResponse.json({ ok: true })
    }

    if (field === "staff") {
      const staff = value as Array<{ name: string; role: string; phone?: string }>
      if (Array.isArray(staff) && staff.length > 0) {
        await admin.from("staff").delete().eq("business_id", businessId)
        await admin.from("staff").insert(
          staff.map(s => ({
            business_id: businessId,
            name: s.name,
            role: s.role ?? "Colaborador",
            phone: s.phone ?? null,
          })) as never
        )
      }
      return NextResponse.json({ ok: true })
    }

    if (field === "staff_payment") {
      const payment = value as {
        compensation_type?: string | null
        monthly_salary_cents?: number | null
        commission_rate?: number | null
        payment_day?: number | null
        payment_method?: string | null
        payment_reminder?: boolean | null
      }
      if (payment && typeof payment === "object" && Object.keys(payment).length > 0) {
        const update: Record<string, unknown> = {}
        if (payment.compensation_type != null) update.compensation_type = payment.compensation_type
        if (payment.monthly_salary_cents != null) update.monthly_salary_cents = payment.monthly_salary_cents
        if (payment.commission_rate != null) update.commission_rate = payment.commission_rate
        if (payment.payment_day != null) update.payment_day = payment.payment_day
        if (payment.payment_method != null) update.payment_method = payment.payment_method
        if (payment.payment_reminder != null) update.payment_reminder = payment.payment_reminder
        if (Object.keys(update).length > 0) {
          await admin.from("staff").update(update as never).eq("business_id", businessId)
        }
      }
      return NextResponse.json({ ok: true })
    }

    if (field === "payment_preferences") {
      const prefs = value as { payment_methods?: string[]; charge_timing?: string | null; auto_payment_reminder?: boolean | null }
      if (prefs && typeof prefs === "object") {
        const { data: biz } = await admin.from("businesses").select("settings").eq("id", businessId).single()
        const existing = (biz?.settings ?? {}) as Record<string, unknown>
        const updated: Record<string, unknown> = { ...existing }
        if (Array.isArray(prefs.payment_methods)) updated.payment_methods = prefs.payment_methods
        if (prefs.charge_timing != null) updated.charge_timing = prefs.charge_timing
        if (prefs.auto_payment_reminder != null) updated.auto_payment_reminder = prefs.auto_payment_reminder
        await admin.from("businesses").update({ settings: updated } as never).eq("id", businessId)
      }
      return NextResponse.json({ ok: true })
    }

    // Always merge settings instead of overwrite to preserve payment_preferences etc.
    if (field === "settings") {
      const { data: biz } = await admin.from("businesses").select("settings").eq("id", businessId).single()
      const existing = (biz?.settings ?? {}) as Record<string, unknown>
      const merged = { ...existing, ...(value as Record<string, unknown>) }
      await admin.from("businesses").update({ settings: merged } as never).eq("id", businessId)
      return NextResponse.json({ ok: true })
    }

    const allowedFields = ["name", "type", "opening_hours", "whatsapp_number", "pix_key", "onboarded"]
    if (!allowedFields.includes(field)) {
      return NextResponse.json({ error: "Campo inválido" }, { status: 400 })
    }

    await admin.from("businesses").update({ [field]: value } as never).eq("id", businessId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 })
  }
}
