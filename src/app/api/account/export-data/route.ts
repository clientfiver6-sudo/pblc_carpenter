import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { logAuditEvent, getRequestMeta } from '@/lib/audit'

// LGPD Article 18 — right to data portability
// GET /api/account/export-data
// Rate limit: 5 exports per day per business

export async function GET(request: Request): Promise<NextResponse> {
  // ─── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: rawBu } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('user_id', user.id)
    .single()
  const bu = rawBu as { business_id: string } | null

  if (!bu) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const businessId = bu.business_id

  // ─── 2. Rate limit: 5 per day per business ────────────────────────────────
  const rl = await checkRateLimit(`export-data:${businessId}`, 5, 24 * 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Limite de exportações atingido. Tente novamente amanhã.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  // ─── 3. Query all tables using admin client (bypasses RLS) ────────────────
  const admin = createAdminClient()

  const [
    businessRes,
    customersRes,
    workItemsRes,
    paymentsRes,
    conversationsRes,
    staffRes,
    servicesRes,
    automationsRes,
  ] = await Promise.all([
    admin.from('businesses').select('*').eq('id', businessId).single(),
    admin.from('customers').select('*').eq('business_id', businessId).order('created_at'),
    admin.from('work_items').select('*').eq('business_id', businessId).order('created_at'),
    admin.from('payments').select('*').eq('business_id', businessId).order('created_at'),
    admin
      .from('conversations')
      .select('id, business_id, customer_id, channel, status, created_at, updated_at')
      .eq('business_id', businessId)
      .order('created_at'),
    admin.from('staff').select('*').eq('business_id', businessId).order('name'),
    admin.from('services').select('*').eq('business_id', businessId).order('name'),
    admin.from('automations').select('*').eq('business_id', businessId).order('created_at'),
  ])

  if (businessRes.error) {
    console.error('export-data: business query error', businessRes.error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }

  // Strip sensitive tokens from business record before export
  const businessData = businessRes.data as Record<string, unknown>
  const sanitizedBusiness = { ...businessData }
  delete sanitizedBusiness.mercadopago_access_token
  delete sanitizedBusiness.mercadopago_refresh_token
  delete sanitizedBusiness.whatsapp_token
  delete sanitizedBusiness.whatsapp_phone_id

  const customers = (customersRes.data as unknown[]) ?? []
  const workItems = (workItemsRes.data as unknown[]) ?? []
  const payments = (paymentsRes.data as unknown[]) ?? []
  const conversations = (conversationsRes.data as unknown[]) ?? []
  const staff = (staffRes.data as unknown[]) ?? []
  const services = (servicesRes.data as unknown[]) ?? []
  const automations = (automationsRes.data as unknown[]) ?? []

  // ─── 4. Log the export event ──────────────────────────────────────────────
  const { ipAddress, userAgent } = getRequestMeta(request)
  void logAuditEvent({
    businessId,
    userId: user.id,
    action: 'data.exported',
    resourceType: 'business',
    resourceId: businessId,
    ipAddress,
    userAgent,
    metadata: {
      exportVersion: '1.0',
      counts: {
        customers: customers.length,
        workItems: workItems.length,
        payments: payments.length,
        conversations: conversations.length,
        staff: staff.length,
        services: services.length,
        automations: automations.length,
      },
    },
  })

  // ─── 5. Return as JSON attachment ─────────────────────────────────────────
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      business: sanitizedBusiness,
      summary: {
        customers: customers.length,
        workItems: workItems.length,
        payments: payments.length,
        conversations: conversations.length,
        staff: staff.length,
        services: services.length,
        automations: automations.length,
      },
      customers,
      workItems,
      payments,
      // Conversations included without message content for privacy
      conversations,
      staff,
      services,
      automations,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="retornai-data-${today}.json"`,
        'Cache-Control': 'no-store',
      },
    }
  )
}
