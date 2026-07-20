import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAction =
  | 'customer.created' | 'customer.updated' | 'customer.deleted'
  | 'work_item.created' | 'work_item.updated' | 'work_item.deleted'
  | 'payment.created' | 'payment.received' | 'payment.cancelled'
  | 'staff.created' | 'staff.updated' | 'staff.deleted'
  | 'service.created' | 'service.updated' | 'service.deleted'
  | 'automation.created' | 'automation.updated' | 'automation.deleted'
  | 'data.exported' | 'account.deleted'
  | 'auth.login' | 'auth.logout'

interface AuditEvent {
  businessId?: string
  userId?: string
  action: AuditAction
  resourceType?: string
  resourceId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_logs' as never).insert({
      business_id: event.businessId ?? null,
      user_id: event.userId ?? null,
      action: event.action,
      resource_type: event.resourceType ?? null,
      resource_id: event.resourceId ?? null,
      old_values: event.oldValues ?? null,
      new_values: event.newValues ?? null,
      ip_address: event.ipAddress ?? null,
      user_agent: event.userAgent ?? null,
      metadata: event.metadata ?? {},
    } as never)
  } catch (err) {
    // Audit logging must never crash the main flow
    console.error('[audit] Failed to log event', event.action, err)
  }
}

// Helper to extract request metadata
export function getRequestMeta(request: Request) {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
  }
}
