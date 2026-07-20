import { z } from 'zod'

const envSchema = z.object({
  // ── Required (app crashes without these) ──────────────────────────────────
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  // Must be 64 hex chars (32 bytes). Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  // Last rotated: [REPLACE WITH DATE]
  ENCRYPTION_KEY: z.string().length(64).regex(/^[0-9a-f]+$/i),
  // Must be 32+ chars. Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  CRON_SECRET: z.string().min(32),

  // ── Upstash Redis (optional dev, required prod) ───────────────────────────
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // ── WhatsApp / Z-API (optional dev, required prod for messaging) ─────────
  WHATSAPP_API_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),

  // ── Mercado Pago (optional dev, required prod for payments) ──────────────
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().optional(),
  MERCADOPAGO_SUBSCRIPTION_WEBHOOK_SECRET: z.string().optional(),
  MERCADOPAGO_CLIENT_ID: z.string().optional(),
  MERCADOPAGO_CLIENT_SECRET: z.string().optional(),
  MERCADOPAGO_PLATFORM_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_STARTER_PLAN_ID: z.string().optional(),
  MERCADOPAGO_PRO_PLAN_ID: z.string().optional(),

  // ── Twilio (optional dev, required prod for voice) ────────────────────────
  TWILIO_ACCOUNT_SID: z.string().startsWith('AC').optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_DID_NUMBER: z.string().optional(),

  // ── Gmail SMTP (optional dev, required prod for email) ───────────────────
  EMAIL_USER: z.string().optional(),
  EMAIL_PASSWORD: z.string().optional(), // Google App Password (not your login password)

  // ── Cloudflare Turnstile (optional dev, required prod for captcha) ────────
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // ── Deepgram (optional dev, required prod for medical audio transcription) ─
  DEEPGRAM_API_KEY: z.string().optional(),

  // ── DeepSeek (optional — used for brain/analytics to cut AI costs ~10x) ───
  DEEPSEEK_API_KEY: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  parsed.error.errors.forEach(err => {
    console.error(`  ${err.path.join('.')}: ${err.message}`)
  })
  // In production, throw to crash immediately. In dev, warn but continue.
  // Skip the throw during `next build` (page-data collection imports every
  // route with NODE_ENV=production) so the app can build without env vars.
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('Missing or invalid environment variables. Check logs above.')
  }
}

export const env = parsed.success ? parsed.data : (process.env as unknown as z.infer<typeof envSchema>)

export const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL ?? "").replace(/\/+$/, "")
export const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? ""

if (!process.env.EVOLUTION_API_URL) {
  console.warn("[env] EVOLUTION_API_URL is not set — WhatsApp features will not work")
}
if (!process.env.EVOLUTION_API_KEY) {
  console.warn("[env] EVOLUTION_API_KEY is not set — WhatsApp features will not work")
}
