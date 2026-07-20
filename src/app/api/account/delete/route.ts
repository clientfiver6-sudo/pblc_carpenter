import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'
import type { UserRole } from '@/types/database'

const CONFIRM_TEXT = 'DELETAR MINHA CONTA'

// LGPD Article 18 — right to erasure
// POST /api/account/delete
// Owner-only. Two-step: confirm=false returns preview, confirm=true deletes.

export async function POST(request: Request): Promise<NextResponse> {
  // ─── 1. Auth — owner role only ────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rawBu } = await supabase
    .from('business_users')
    .select('business_id, role')
    .eq('user_id', user.id)
    .single()
  const bu = rawBu as { business_id: string; role: UserRole } | null

  if (!bu) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (bu.role !== 'owner') {
    return NextResponse.json(
      { error: 'Apenas o proprietário pode excluir a conta.' },
      { status: 403 }
    )
  }

  const businessId = bu.business_id

  // ─── 2. Rate limit: 3 attempts per day ───────────────────────────────────
  const rl = await checkRateLimit(`account-delete:${businessId}`, 3, 24 * 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente amanhã.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  // ─── 3. Parse body ────────────────────────────────────────────────────────
  let body: { confirm?: boolean; confirmText?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { confirm, confirmText } = body

  const admin = createAdminClient()

  // ─── 4. Preview mode ──────────────────────────────────────────────────────
  if (!confirm) {
    const [
      customersRes,
      workItemsRes,
      paymentsRes,
      conversationsRes,
      staffRes,
      servicesRes,
      automationsRes,
    ] = await Promise.all([
      admin.from('customers').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      admin.from('work_items').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      admin.from('payments').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      admin.from('conversations').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      admin.from('staff').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      admin.from('services').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      admin.from('automations').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
    ])

    return NextResponse.json({
      preview: true,
      warning: 'Esta ação é irreversível. Todos os dados da sua conta serão permanentemente excluídos.',
      willDelete: {
        customers: customersRes.count ?? 0,
        workItems: workItemsRes.count ?? 0,
        payments: paymentsRes.count ?? 0,
        conversations: conversationsRes.count ?? 0,
        staff: staffRes.count ?? 0,
        services: servicesRes.count ?? 0,
        automations: automationsRes.count ?? 0,
      },
      confirmationRequired: `Para confirmar, envie { "confirm": true, "confirmText": "${CONFIRM_TEXT}" }`,
    })
  }

  // ─── 5. Validate confirmation text ───────────────────────────────────────
  if (confirmText !== CONFIRM_TEXT) {
    return NextResponse.json(
      { error: 'Texto de confirmação incorreto. Digite exatamente: ' + CONFIRM_TEXT },
      { status: 422 }
    )
  }

  // ─── 6. Log before deletion (while data still exists) ────────────────────
  const { ipAddress, userAgent } = getRequestMeta(request)
  void logAuditEvent({
    businessId,
    userId: user.id,
    action: 'account.deleted',
    resourceType: 'business',
    resourceId: businessId,
    ipAddress,
    userAgent,
    metadata: { initiatedBy: user.email ?? user.id },
  })

  // ─── 7. Delete in FK-safe order ───────────────────────────────────────────
  // Get all conversation IDs for this business first (needed for messages)
  const { data: convRows } = await admin
    .from('conversations')
    .select('id')
    .eq('business_id', businessId)
  const convIds = (convRows ?? []).map((c: { id: string }) => c.id)

  // messages → conversations → payments → work_items → customers
  // → automations → services → staff → business_faqs → business_skills
  // → business_users → businesses

  if (convIds.length > 0) {
    await admin.from('messages').delete().in('conversation_id', convIds)
  }
  await admin.from('conversations').delete().eq('business_id', businessId)
  await admin.from('payments').delete().eq('business_id', businessId)
  await admin.from('work_items').delete().eq('business_id', businessId)
  await admin.from('customers').delete().eq('business_id', businessId)
  await admin.from('automations').delete().eq('business_id', businessId)
  await admin.from('services').delete().eq('business_id', businessId)
  await admin.from('staff').delete().eq('business_id', businessId)
  await admin.from('business_faqs').delete().eq('business_id', businessId)
  await admin.from('business_skills').delete().eq('business_id', businessId)
  await admin.from('business_users').delete().eq('business_id', businessId)
  await admin.from('businesses').delete().eq('id', businessId)

  // ─── 8. Delete auth user (removes from auth.users entirely) ─────────────
  await admin.auth.admin.deleteUser(user.id)

  return NextResponse.json({
    deleted: true,
    message: 'Conta excluída com sucesso. Todos os dados foram permanentemente removidos.',
  })
}
