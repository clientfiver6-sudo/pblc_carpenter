import { NextRequest, NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  triggerBooking24hBefore,
  triggerBookingCompleted,
  triggerBookingNoShow,
  triggerCustomerInactive,
  triggerLeadInactive,
  triggerPaymentPending,
} from "@/lib/automations/triggers"
import { createNotification } from "@/lib/notifications/actions"
import { checkRateLimit } from "@/lib/rate-limit"

// Vercel cron endpoint — runs every hour (see vercel.json)
export const dynamic = "force-dynamic"

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

  const { allowed, resetAt } = await checkRateLimit(`cron:automations`, 10, 60_000)
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  const admin = createAdminClient()
  const now = new Date()
  const results = {
    reminders: 0,
    noShows: 0,
    autoStarted: 0,
    autoCompleted: 0,
    reactivations: 0,
    staleLeads: 0,
    paymentReminders: 0,
    ambient: 0,
    errors: 0,
  }

  // ──────────────────────────────────────────────────────────────
  // 1. 24h reminder: confirmed work items starting in 23h–25h
  //    with metadata.reminder_24h_sent !== true
  // ──────────────────────────────────────────────────────────────
  try {
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString()
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString()

    const { data: upcomingItems, error: upcomingError } = await admin
      .from("work_items")
      .select("id, business_id, metadata")
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_start", windowStart)
      .lte("scheduled_start", windowEnd)

    if (upcomingError) {
      console.error("[cron/automations] Failed to fetch 24h reminder items:", upcomingError)
      results.errors++
    } else if (upcomingItems) {
      for (const item of upcomingItems) {
        try {
          const meta = (item.metadata ?? {}) as Record<string, unknown>

          // Atomic claim: update flag first, trigger only if this instance wins
          const { data: claimed } = await admin
            .from("work_items")
            .update({ metadata: { ...meta, reminder_24h_sent: true } })
            .eq("id", item.id)
            .filter("metadata->reminder_24h_sent", "is", null)
            .select("id")
          if (!claimed || claimed.length === 0) continue

          await triggerBooking24hBefore(item.id, item.business_id)
          results.reminders++
        } catch (err) {
          console.error(`[cron/automations] 24h reminder error for workItemId=${item.id}:`, err)
          results.errors++
        }
      }
    }
  } catch (err) {
    console.error("[cron/automations] Unexpected error in 24h reminder section:", err)
    results.errors++
  }

  // ──────────────────────────────────────────────────────────────
  // 2. No-show detection: confirmed items with scheduled_start > 2h ago
  // ──────────────────────────────────────────────────────────────
  try {
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()

    const { data: noShowCandidates, error: nsError } = await admin
      .from("work_items")
      .select("id, business_id")
      .in("status", ["scheduled", "confirmed"])
      .lt("scheduled_start", twoHoursAgo)
      .not("scheduled_start", "is", null)

    if (nsError) {
      console.error("[cron/automations] Failed to fetch no-show candidates:", nsError)
      results.errors++
    } else if (noShowCandidates) {
      for (const item of noShowCandidates) {
        try {
          // Update status to no_show
          await admin
            .from("work_items")
            .update({ status: "no_show" })
            .eq("id", item.id)

          await triggerBookingNoShow(item.id, item.business_id)
          results.noShows++
        } catch (err) {
          console.error(`[cron/automations] No-show processing error for workItemId=${item.id}:`, err)
          results.errors++
        }
      }
    }
  } catch (err) {
    console.error("[cron/automations] Unexpected error in no-show section:", err)
    results.errors++
  }

  // ──────────────────────────────────────────────────────────────
  // 3. Inactive customers: last_visit_at > 30 days, status = active
  //    Idempotency: check automation_logs for customer_inactive in last 30 days
  // ──────────────────────────────────────────────────────────────
  try {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: inactiveCustomers, error: icError } = await admin
      .from("customers")
      .select("id, business_id")
      .eq("status", "active")
      .lt("last_visit_at", thirtyDaysAgo)
      .not("last_visit_at", "is", null)

    if (icError) {
      console.error("[cron/automations] Failed to fetch inactive customers:", icError)
      results.errors++
    } else if (inactiveCustomers) {
      for (const customer of inactiveCustomers) {
        try {
          // Check if we already sent a customer_inactive automation in last 30 days
          const { data: recentLog } = await admin
            .from("automation_logs")
            .select("id")
            .eq("customer_id", customer.id)
            .eq("business_id", customer.business_id)
            .eq("status", "sent")
            .gte("executed_at", thirtyDaysAgo)
            .limit(1)
            .maybeSingle()

          if (recentLog) continue

          // Also check there's an active customer_inactive automation before triggering
          const { data: activeAutomation } = await admin
            .from("automations")
            .select("id")
            .eq("business_id", customer.business_id)
            .eq("trigger_type", "customer_inactive")
            .eq("active", true)
            .limit(1)
            .maybeSingle()

          if (!activeAutomation) continue

          await triggerCustomerInactive(customer.id, customer.business_id)
          results.reactivations++
        } catch (err) {
          console.error(
            `[cron/automations] Inactive customer error for customerId=${customer.id}:`,
            err
          )
          results.errors++
        }
      }
    }
  } catch (err) {
    console.error("[cron/automations] Unexpected error in inactive customers section:", err)
    results.errors++
  }

  // ──────────────────────────────────────────────────────────────
  // 3b. Stale leads: never converted (lead_status new/contacted/quoted),
  //     no visit recorded, created > 7 days ago, still active.
  //     Idempotency: only one lead_inactive send per lead, ever.
  // ──────────────────────────────────────────────────────────────
  try {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: staleLeads, error: slError } = await admin
      .from("customers")
      .select("id, business_id")
      .eq("status", "active")
      .eq("visit_count", 0)
      .in("lead_status", ["new", "contacted", "quoted"])
      .lt("created_at", sevenDaysAgo)

    if (slError) {
      console.error("[cron/automations] Failed to fetch stale leads:", slError)
      results.errors++
    } else if (staleLeads) {
      // Cache each business's active lead_inactive automation IDs (avoids re-querying per lead)
      const leadAutomationsByBusiness = new Map<string, string[]>()

      for (const lead of staleLeads) {
        try {
          let automationIds = leadAutomationsByBusiness.get(lead.business_id)
          if (automationIds === undefined) {
            const { data: autos } = await admin
              .from("automations")
              .select("id")
              .eq("business_id", lead.business_id)
              .eq("trigger_type", "lead_inactive")
              .eq("active", true)
            automationIds = (autos ?? []).map((a) => a.id)
            leadAutomationsByBusiness.set(lead.business_id, automationIds)
          }

          if (automationIds.length === 0) continue

          // Idempotency: a lead only ever gets one lead_inactive nudge. Filter logs
          // by the lead_inactive automation IDs so other triggers' sends don't suppress it.
          const { data: priorLog } = await admin
            .from("automation_logs")
            .select("id")
            .eq("customer_id", lead.id)
            .eq("status", "sent")
            .in("automation_id", automationIds)
            .limit(1)
            .maybeSingle()

          if (priorLog) continue

          await triggerLeadInactive(lead.id, lead.business_id)
          results.staleLeads++
        } catch (err) {
          console.error(`[cron/automations] Stale lead error for customerId=${lead.id}:`, err)
          results.errors++
        }
      }
    }
  } catch (err) {
    console.error("[cron/automations] Unexpected error in stale leads section:", err)
    results.errors++
  }

  // ──────────────────────────────────────────────────────────────
  // 4. Payment reminders: pending payments older than 24h
  //    Idempotency: check automation_logs — send only once per payment
  // ──────────────────────────────────────────────────────────────
  try {
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const { data: pendingPayments, error: ppError } = await admin
      .from("payments")
      .select("id, business_id")
      .eq("status", "pending")
      .lt("created_at", oneDayAgo)

    if (ppError) {
      console.error("[cron/automations] Failed to fetch pending payments:", ppError)
      results.errors++
    } else if (pendingPayments) {
      for (const payment of pendingPayments) {
        try {
          // Check that there's an active automation for payment_pending
          const { data: activeAutomation } = await admin
            .from("automations")
            .select("id")
            .eq("business_id", payment.business_id)
            .eq("trigger_type", "payment_pending")
            .eq("active", true)
            .limit(1)
            .maybeSingle()

          if (!activeAutomation) continue

          // Fetch current metadata to build updated value
          const { data: paymentData } = await admin
            .from("payments")
            .select("metadata")
            .eq("id", payment.id)
            .single()
          const paymentMeta = (paymentData?.metadata ?? {}) as Record<string, unknown>

          // Atomic claim: update flag first, trigger only if this instance wins
          const { data: claimedPmt } = await admin
            .from("payments")
            .update({ metadata: { ...paymentMeta, reminder_sent: true } })
            .eq("id", payment.id)
            .filter("metadata->reminder_sent", "is", null)
            .select("id")
          if (!claimedPmt || claimedPmt.length === 0) continue

          await triggerPaymentPending(payment.id, payment.business_id)
          results.paymentReminders++
        } catch (err) {
          console.error(
            `[cron/automations] Payment reminder error for paymentId=${payment.id}:`,
            err
          )
          results.errors++
        }
      }
    }
  } catch (err) {
    console.error("[cron/automations] Unexpected error in payment reminders section:", err)
    results.errors++
  }

  // ──────────────────────────────────────────────────────────────
  // 5. Auto-start: move active items to in_progress when scheduled_start ≤ now
  //    Statuses: new | scheduled | pending_confirmation | confirmed
  // ──────────────────────────────────────────────────────────────
  const AUTO_START_STATUSES = ["new", "scheduled", "pending_confirmation", "confirmed"] as const
  try {
    const { data: startCandidates, error: scErr } = await admin
      .from("work_items")
      .select("id, business_id")
      .in("status", AUTO_START_STATUSES)
      .lte("scheduled_start", now.toISOString())
      .not("scheduled_start", "is", null)

    if (scErr) {
      console.error("[cron/automations] Failed to fetch auto-start candidates:", scErr)
      results.errors++
    } else if (startCandidates) {
      for (const item of startCandidates) {
        try {
          const { data: claimed } = await admin
            .from("work_items")
            .update({ status: "in_progress", updated_at: now.toISOString() })
            .eq("id", item.id)
            .in("status", AUTO_START_STATUSES)
            .select("id")
          if (!claimed || claimed.length === 0) continue
          results.autoStarted++
        } catch (err) {
          console.error(`[cron/automations] Auto-start error for workItemId=${item.id}:`, err)
          results.errors++
        }
      }
    }
  } catch (err) {
    console.error("[cron/automations] Unexpected error in auto-start section:", err)
    results.errors++
  }

  // ──────────────────────────────────────────────────────────────
  // 6. Auto-complete: move in_progress items to completed once their
  //    duration has elapsed (scheduled_end, service duration, or 2h default).
  //    On completion: fire booking_completed automation + payment notification.
  // ──────────────────────────────────────────────────────────────
  try {
    const { data: inProgressItems, error: ipErr } = await admin
      .from("work_items")
      .select(`
        id, business_id, scheduled_start, scheduled_end,
        price_estimate, final_price, payment_status, metadata,
        customer:customers(full_name),
        service:services(duration_minutes)
      `)
      .eq("status", "in_progress")
      .not("scheduled_start", "is", null)

    if (ipErr) {
      console.error("[cron/automations] Failed to fetch in-progress items:", ipErr)
      results.errors++
    } else if (inProgressItems) {
      for (const rawItem of inProgressItems) {
        try {
          const item = rawItem as unknown as {
            id: string
            business_id: string
            scheduled_start: string
            scheduled_end: string | null
            price_estimate: number | null
            final_price: number | null
            payment_status: string
            metadata: Record<string, unknown> | null
            customer: { full_name: string } | null
            service: { duration_minutes: number } | null
          }

          // Determine when this work item should be considered done
          let completionTime: Date
          if (item.scheduled_end) {
            completionTime = new Date(item.scheduled_end)
          } else {
            const durationMs = (item.service?.duration_minutes ?? 120) * 60_000
            completionTime = new Date(new Date(item.scheduled_start).getTime() + durationMs)
          }

          if (completionTime > now) continue

          // Build updated metadata with status history
          const existingMeta = (item.metadata ?? {}) as Record<string, unknown>
          const existingHistory = Array.isArray(existingMeta.status_history)
            ? (existingMeta.status_history as unknown[])
            : []
          const newMeta = {
            ...existingMeta,
            status_history: [
              ...existingHistory,
              { status: "completed", changed_at: now.toISOString(), notes: "auto-completed" },
            ],
          }

          // Atomic claim: only update if still in_progress
          const { data: claimed } = await admin
            .from("work_items")
            .update({ status: "completed", updated_at: now.toISOString(), metadata: newMeta as never })
            .eq("id", item.id)
            .eq("status", "in_progress")
            .select("id")
          if (!claimed || claimed.length === 0) continue

          results.autoCompleted++

          // Fire booking_completed automation (best-effort)
          try {
            await triggerBookingCompleted(item.id, item.business_id)
          } catch { /* non-fatal */ }

          // Payment notification — check if business has Pix (MP token) configured
          try {
            const { data: biz } = await admin
              .from("businesses")
              .select("mercadopago_access_token")
              .eq("id", item.business_id)
              .single()

            const amount = item.final_price ?? item.price_estimate
            const customerName = item.customer?.full_name ?? "cliente"
            const amountStr = amount != null
              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount / 100)
              : null

            const hasPix = !!(biz as { mercadopago_access_token: string | null } | null)?.mercadopago_access_token

            await createNotification({
              businessId: item.business_id,
              type: "payment_due",
              title: `Cobrar ${customerName}`,
              body: hasPix
                ? `Atendimento concluído. Envie o Pix${amountStr ? ` de ${amountStr}` : ""} para ${customerName}.`
                : `Atendimento concluído. Cobrar${amountStr ? ` ${amountStr}` : ""} de ${customerName} em dinheiro.`,
              link: `/dashboard/work-items/${item.id}`,
              metadata: { work_item_id: item.id, amount, has_pix: hasPix },
            })
          } catch { /* non-fatal */ }
        } catch (err) {
          console.error(`[cron/automations] Auto-complete error for workItemId=${rawItem.id}:`, err)
          results.errors++
        }
      }
    }
  } catch (err) {
    console.error("[cron/automations] Unexpected error in auto-complete section:", err)
    results.errors++
  }

  // ──────────────────────────────────────────────────────────────
  // 7. Ambient intelligence — throttled internally per business to 2h
  // ──────────────────────────────────────────────────────────────
  try {
    const { runAmbientIntelligence } = await import("@/lib/ai/ambient")
    const { data: businesses } = await admin
      .from("businesses")
      .select("id")
      .limit(100)
    if (businesses) {
      await Promise.allSettled(
        (businesses as Array<{ id: string }>).map((b) => runAmbientIntelligence(b.id))
      )
      results.ambient = businesses.length
    }
  } catch (err) {
    console.error("[cron/automations] Ambient intelligence error:", err)
    results.errors++
  }

  return NextResponse.json({ ok: true, ...results, timestamp: now.toISOString() })
}
