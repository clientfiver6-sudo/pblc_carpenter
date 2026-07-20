// Daily cron: send booking reminders and payment follow-ups via WhatsApp.
// Only runs for businesses that have WhatsApp connected but no custom automation
// configured for that trigger type — the automations engine handles the rest.
import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendTextMessage } from "@/lib/whatsapp/client"
import { templateBookingReminder, templatePaymentReminder } from "@/lib/whatsapp/templates"
import { checkRateLimit } from "@/lib/rate-limit"
import { spToday, spDayRange } from "@/lib/utils/brazil-time"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization") ?? ""
  const cronSecret = process.env.CRON_SECRET ?? ""
  const expected = `Bearer ${cronSecret}`
  if (
    !cronSecret ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const results = { bookingReminders: 0, paymentReminders: 0, errors: 0 }

  // ── 1. Booking reminders: work items starting tomorrow (SP), status = confirmed ─
  const tomorrowSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }))
  tomorrowSP.setDate(tomorrowSP.getDate() + 1)
  const tomorrowStr = tomorrowSP.toISOString().slice(0, 10)
  const { start: tomorrowStart, end: tomorrowEnd } = spDayRange(tomorrowStr)

  const { data: upcomingItems } = await admin
    .from("work_items")
    .select("id, business_id, customer_id, title, scheduled_start, metadata")
    .eq("status", "confirmed")
    .gte("scheduled_start", tomorrowStart)
    .lte("scheduled_start", tomorrowEnd)
    .not("customer_id", "is", null)

  for (const item of upcomingItems ?? []) {
    try {
      const meta = (item.metadata ?? {}) as Record<string, unknown>

      const { allowed } = await checkRateLimit(`wa-reminder-biz:${item.business_id}`, 50, 3_600_000)
      if (!allowed) continue

      const [{ data: biz }, { data: customer }] = await Promise.all([
        admin.from("businesses")
          .select("name, whatsapp_phone_id")
          .eq("id", item.business_id)
          .single(),
        admin.from("customers")
          .select("full_name, phone_number")
          .eq("id", item.customer_id!)
          .single(),
      ])

      if (!biz?.whatsapp_phone_id || !customer?.phone_number) continue

      // Check business has automations that would cover this — if so, skip (avoid duplicates)
      const { count: automationCount } = await admin
        .from("automations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", item.business_id)
        .eq("trigger_type", "booking_24h_before")
        .eq("active", true)
      if ((automationCount ?? 0) > 0) continue

      // Atomic claim: update flag first, send only if this instance wins
      const { data: claimed } = await admin.from("work_items")
        .update({ metadata: { ...meta, reminder_24h_sent: true } } as never)
        .eq("id", item.id)
        .filter("metadata->reminder_24h_sent", "is", null)
        .select("id")
      if (!claimed || claimed.length === 0) continue

      const scheduledAt = item.scheduled_start
        ? new Date(item.scheduled_start).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "amanhã"

      const text = templateBookingReminder({
        customerName: customer.full_name,
        businessName: biz.name,
        serviceName: item.title,
        scheduledTime: scheduledAt,
      })

      const digits = customer.phone_number.replace(/\D/g, "")
      const to = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`

      await sendTextMessage({ to, text, instanceName: biz.whatsapp_phone_id })
      results.bookingReminders++
    } catch (err) {
      console.error("[wa-reminders] booking reminder failed", { workItemId: item.id, error: err })
      results.errors++
    }
  }

  // ── 2. Payment reminders: pending payments older than 3 days ──────────────
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: pendingPayments } = await admin
    .from("payments")
    .select("id, business_id, customer_id, amount, metadata")
    .eq("status", "pending")
    .lte("created_at", threeDaysAgo)
    .not("customer_id", "is", null)

  for (const payment of pendingPayments ?? []) {
    try {
      const meta = (payment.metadata ?? {}) as Record<string, unknown>

      const { allowed } = await checkRateLimit(`wa-reminder-biz:${payment.business_id}`, 50, 3_600_000)
      if (!allowed) continue

      const [{ data: biz }, { data: customer }] = await Promise.all([
        admin.from("businesses")
          .select("name, whatsapp_phone_id")
          .eq("id", payment.business_id)
          .single(),
        admin.from("customers")
          .select("full_name, phone_number")
          .eq("id", payment.customer_id!)
          .single(),
      ])

      if (!biz?.whatsapp_phone_id || !customer?.phone_number) continue

      const { count: automationCount } = await admin
        .from("automations")
        .select("id", { count: "exact", head: true })
        .eq("business_id", payment.business_id)
        .eq("trigger_type", "payment_pending")
        .eq("active", true)
      if ((automationCount ?? 0) > 0) continue

      // Atomic claim: update flag first, send only if this instance wins
      const { data: claimedPmt } = await admin.from("payments")
        .update({ metadata: { ...meta, payment_reminder_sent: true } } as never)
        .eq("id", payment.id)
        .filter("metadata->payment_reminder_sent", "is", null)
        .select("id")
      if (!claimedPmt || claimedPmt.length === 0) continue

      const amountFormatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
        .format(payment.amount / 100)

      const text = templatePaymentReminder({
        customerName: customer.full_name,
        businessName: biz.name,
        amount: amountFormatted,
      })

      const digits = customer.phone_number.replace(/\D/g, "")
      const to = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`

      await sendTextMessage({ to, text, instanceName: biz.whatsapp_phone_id })
      results.paymentReminders++
    } catch (err) {
      console.error("[wa-reminders] payment reminder failed", { paymentId: payment.id, error: err })
      results.errors++
    }
  }

  return NextResponse.json({ ok: true, ...results })
}
