import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'

// UUID v4 regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// LGPD — export a single customer's full record
// GET /api/customers/[id]/export
// Rate limit: 20 per hour per business

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  // ─── 1. Validate UUID param ───────────────────────────────────────────────
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid customer ID' }, { status: 400 })
  }

  // ─── 2. Auth ───────────────────────────────────────────────────────────────
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

  // ─── 3. Rate limit: 20 per hour per business ──────────────────────────────
  const rl = await checkRateLimit(`customer-export:${businessId}`, 20, 60 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Limite de exportações atingido. Tente novamente em uma hora.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  // ─── 4. Query customer (must belong to user's business) ───────────────────
  const admin = createAdminClient()

  const { data: customerData, error: customerError } = await admin
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  if (customerError || !customerData) {
    // Generic message — don't reveal whether the id exists in another tenant
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ─── 5. Query work_items, payments, and conversation count ────────────────
  const [workItemsRes, paymentsRes, conversationsRes] = await Promise.all([
    admin
      .from('work_items')
      .select('*')
      .eq('customer_id', id)
      .eq('business_id', businessId)
      .order('created_at'),
    admin
      .from('payments')
      .select('*')
      .eq('customer_id', id)
      .eq('business_id', businessId)
      .order('created_at'),
    admin
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', id)
      .eq('business_id', businessId),
  ])

  const workItems = (workItemsRes.data as unknown[]) ?? []
  const payments = (paymentsRes.data as unknown[]) ?? []
  const conversationCount = conversationsRes.count ?? 0

  // ─── 6. Return as JSON attachment ─────────────────────────────────────────
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
  const customerName = (customerData as Record<string, unknown>).full_name as string

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      customer: customerData,
      summary: {
        workItems: workItems.length,
        payments: payments.length,
        conversationCount,
      },
      workItems,
      payments,
      conversationCount,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="cliente-${customerName.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '-')}-${today}.json"`,
        'Cache-Control': 'no-store',
      },
    }
  )
}
