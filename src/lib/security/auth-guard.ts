import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export type BusinessRole = 'owner' | 'manager' | 'staff'

export interface AuthContext {
  userId: string
  businessId: string
  role: BusinessRole
}

// Use in API routes: returns AuthContext or a 401/403 NextResponse
export async function requireBusinessAuth(
  requiredRoles: BusinessRole[] = ['owner', 'manager', 'staff']
): Promise<AuthContext | NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: bu } = await admin
    .from('business_users')
    .select('business_id, role')
    .eq('user_id', user.id)
    .single()

  if (!bu) {
    return NextResponse.json({ error: 'No business associated' }, { status: 403 })
  }

  const role = bu.role as BusinessRole
  if (!requiredRoles.includes(role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  return { userId: user.id, businessId: bu.business_id, role }
}

// Type guard — use after requireBusinessAuth to check if result is AuthContext
export function isAuthContext(result: AuthContext | NextResponse): result is AuthContext {
  return !('status' in result)
}

// Use in server actions: throws on failure
export async function getAuthContext(): Promise<AuthContext> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { data: bu } = await admin
    .from('business_users')
    .select('business_id, role')
    .eq('user_id', user.id)
    .single()

  if (!bu) throw new Error('No business associated')

  return { userId: user.id, businessId: bu.business_id, role: bu.role as BusinessRole }
}
