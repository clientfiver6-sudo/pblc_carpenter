import { z } from 'zod'

// ── Common validators ─────────────────────────────────────────────────────────

// Brazilian phone: allows +55 11 99999-9999 and similar formats
const phoneSchema = z.string()
  .regex(/^\+?[\d\s\-\(\)]{8,20}$/, 'Telefone inválido')
  .transform(v => v.replace(/[\s\-\(\)]/g, ''))
  .optional()

const uuidSchema = z.string().uuid('ID inválido')

const monetaryBRL = z.number()
  .min(0, 'Valor não pode ser negativo')
  .max(1_000_000, 'Valor excede o máximo permitido')
  .optional()

// XSS check helper — applied via .refine() BEFORE any .min() chain so that
// .min() is called on a plain ZodString (not a ZodEffects), avoiding the
// "Property 'min' does not exist on ZodEffects" error.
// Usage: build the full chain FIRST (max + trim + min), then add the XSS refine.
const noXss = (v: string) => !/<script|javascript:|data:text\/html|onerror=/i.test(v)
const noXssMsg = 'Conteúdo não permitido'

// safeText returns a ZodEffects — it is only used in positions where no further
// chaining is needed (optional fields). For required fields with .min() use
// safeTextMin() or inline the pattern.
const safeText = (maxLen: number) =>
  z.string().max(maxLen).trim().refine(noXss, noXssMsg)

// safeTextMin: produces a ZodEffects that validates max, trim, min, then XSS.
const safeTextMin = (maxLen: number, minLen: number, minMsg?: string) =>
  z.string().max(maxLen).trim().min(minLen, minMsg).refine(noXss, noXssMsg)

// ── Customer ──────────────────────────────────────────────────────────────────

export const createCustomerSchema = z.object({
  full_name: safeTextMin(100, 2, 'Nome deve ter pelo menos 2 caracteres'),
  phone_number: phoneSchema,
  email: z.string().email('E-mail inválido').max(200).optional().or(z.literal('')),
  address: safeText(500).optional(),
  city: safeText(100).optional(),
  notes: safeText(2000).optional(),
  tags: z.array(safeText(50)).max(20).optional(),
})

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
})

// ── Work Item ─────────────────────────────────────────────────────────────────

export const createWorkItemSchema = z.object({
  customer_id: uuidSchema.optional(),
  service_id: uuidSchema.optional(),
  assigned_staff_id: uuidSchema.optional(),
  type: z.enum(['appointment', 'job', 'repair', 'quote', 'order', 'consultation', 'service_call', 'service']).default('service'),
  title: safeTextMin(200, 2, 'Título deve ter pelo menos 2 caracteres'),
  description: safeText(2000).optional(),
  scheduled_start: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).optional()),
  scheduled_end: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/).optional()),
  price_estimate: monetaryBRL,
  notes: safeText(2000).optional(),
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).default('scheduled'),
})

export const updateWorkItemSchema = createWorkItemSchema.partial()

// ── Payment ───────────────────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  work_item_id: uuidSchema.optional(),
  customer_id: uuidSchema.optional(),
  amount: z.number().min(1, 'Valor mínimo R$ 0,01').max(100_000_00, 'Valor máximo R$ 100.000'),
  description: safeText(500).optional(),
  payment_method: z.enum(['pix', 'credit_card', 'debit_card', 'cash', 'transfer', 'manual']).optional(),
})

// ── Staff ─────────────────────────────────────────────────────────────────────

export const createStaffSchema = z.object({
  name: safeTextMin(100, 2, 'Nome deve ter pelo menos 2 caracteres'),
  role: safeText(100).optional(),
  phone: phoneSchema,
  email: z.string().email('E-mail inválido').max(200).optional().or(z.literal('')),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida').default('#6366f1'),
  working_hours: z.record(z.object({
    open: z.boolean().optional(),
    start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })).optional(),
  services: z.array(uuidSchema).optional(),
  active: z.boolean().default(true),
})

export const updateStaffSchema = createStaffSchema.partial()

// ── Service ───────────────────────────────────────────────────────────────────

export const createServiceSchema = z.object({
  name: safeTextMin(200, 1, 'Nome é obrigatório'),
  description: safeText(1000).optional(),
  duration_minutes: z.number().int().min(5).max(480),
  price: z.number().min(0).max(100_000).optional(),
  price_max: z.number().min(0).max(100_000).optional(),
  category: safeText(100).optional(),
  active: z.boolean().default(true),
})

export const updateServiceSchema = createServiceSchema.partial()

// ── Automation ────────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  'booking_created', 'booking_confirmed', 'booking_24h_before', 'booking_completed',
  'booking_cancelled', 'booking_no_show', 'payment_pending', 'payment_received',
  'lead_created', 'lead_inactive', 'customer_inactive',
] as const

export const createAutomationSchema = z.object({
  name: safeTextMin(200, 2),
  trigger_type: z.enum(TRIGGER_TYPES),
  message_template: safeTextMin(2000, 10, 'Mensagem muito curta'),
  delay_minutes: z.number().int().min(0).max(43200).default(0), // max 30 days
  active: z.boolean().default(true),
})

export const updateAutomationSchema = createAutomationSchema.partial()

// ── AI message ────────────────────────────────────────────────────────────────

// Patterns that suggest prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore (previous|all|the above) instruction/i,
  /system:/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /jailbreak/i,
  /pretend you are/i,
  /act as (a|an) (different|evil|unrestricted)/i,
]

export function detectPromptInjection(text: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(text))
}

export const aiMessageSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(10_000, 'Mensagem muito longa'),
  })).min(1).max(50),
})

// ── FAQ ───────────────────────────────────────────────────────────────────────

export const createFaqSchema = z.object({
  question: safeTextMin(500, 5),
  answer: safeTextMin(2000, 5),
})

export const updateFaqSchema = createFaqSchema.partial()

// ── Skill / Custom instruction ────────────────────────────────────────────────

export const createSkillSchema = z.object({
  name: safeTextMin(200, 2),
  content: safeTextMin(5000, 10),
  active: z.boolean().default(true),
})

// ── WhatsApp message ──────────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  customer_id: uuidSchema,
  message: safeTextMin(4096, 1),
})
