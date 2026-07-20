# RetornAI

AI-native business management platform ("OS") for Brazilian small service businesses — barbershops, HVAC technicians, clinics, and other service providers. Customers manage bookings, clients, payments, WhatsApp conversations and automations from one dashboard, with an AI assistant (Claude) wired into every workflow.

**Language:** the entire UI and all customer-facing copy are in Brazilian Portuguese (pt-BR). Code, comments and docs are in English.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) · React 19 · TypeScript 5 (strict) |
| UI | Tailwind CSS 3 · Radix UI · Lucide icons · Sonner toasts · Zustand |
| Database & Auth | Supabase (Postgres + GoTrue JWT auth + Row-Level Security + Storage) |
| AI | Anthropic Claude (`@anthropic-ai/sdk`) · optional DeepSeek for low-cost background jobs |
| WhatsApp | [Evolution API](https://github.com/EvolutionAPI/evolution-api) (self-hosted gateway) |
| Payments | Mercado Pago — Pix charges + recurring subscriptions (real money, no sandbox by default) |
| Email | Nodemailer (Gmail SMTP) + Resend |
| Rate limiting | Upstash Redis (in-memory fallback in dev) |
| Voice (optional) | Twilio |
| Transcription (optional) | Deepgram (medical plan) |
| Tests | Playwright E2E (`tests/ai-ball.spec.ts`) |

## Getting started

### 1. Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- An [Anthropic API key](https://console.anthropic.com)
- For WhatsApp features: a deployed [Evolution API](https://github.com/EvolutionAPI/evolution-api) instance (Railway/Render/VPS)
- For payments: a [Mercado Pago developer application](https://www.mercadopago.com.br/developers)

### 2. Database setup

Apply the SQL migrations in `supabase/migrations/` (001 → 036, in filename order) to your Supabase project. Either:

- **Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`, or
- **Dashboard:** paste each file into the SQL Editor in order.

Migration 002_enable_rls.sql turns on Row-Level Security — multi-tenancy is enforced at the database layer, not in application code. Don't skip it.

### 3. Environment

```bash
cp .env.local.example .env.local
```

Fill in the values — every variable is documented inline in `.env.local.example`. Minimum to boot the app: the three Supabase keys, `ANTHROPIC_API_KEY`, `ENCRYPTION_KEY`, `CRON_SECRET`, and `NEXT_PUBLIC_APP_URL`. Everything else degrades gracefully in dev (WhatsApp, payments, email and captcha features are disabled until their keys are present).

### 4. Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run lint
npm run test:ai    # Playwright E2E suite (needs a running app + seeded data)
```

To create demo businesses/data, set `SEED_SECRET` and `SEED_DEMO_PASSWORD` and call `GET /api/dev/seed?token=<SEED_SECRET>` (blocked in production).

## Architecture

```
src/
├── app/
│   ├── (marketing pages, login, register, onboarding, setup)
│   ├── dashboard/          # main app — one folder per feature
│   ├── admin/              # platform admin
│   └── api/                # ~80 route handlers
│       ├── ai/             # assistant, briefing, canvas, extract, reports…
│       ├── webhooks/       # whatsapp, mercadopago(-card/-subscription), twilio, hub/[slug]
│       ├── cron/           # automations, dream, contracts, whatsapp-refresh/-reminders
│       ├── integrations/   # Mercado Pago OAuth connect/callback
│       └── …               # customers, staff, services, payments, medical, exports
├── lib/
│   ├── ai/                 # brain.ts (business context), tool-executor.ts, prompts.ts,
│   │                       # model-router.ts, memory.ts (vector), dreaming.ts, receptionist.ts
│   ├── automations/        # engine.ts + triggers.ts (event → rule → WhatsApp action)
│   ├── payments/           # mercadopago.ts (Pix + subscriptions)
│   ├── whatsapp/           # client.ts (Evolution API wrapper)
│   ├── supabase/           # server/client/admin Supabase factories
│   ├── auth/               # session helpers (getBusinessId etc.)
│   ├── security/           # token encryption (AES, ENCRYPTION_KEY)
│   └── rate-limit.ts       # Upstash sliding window w/ in-memory dev fallback
├── components/             # React components (Radix + Tailwind)
└── supabase/migrations/    # 36 ordered SQL migrations — the schema source of truth
```

### Key concepts

- **Multi-tenancy:** every table carries `business_id`; RLS policies restrict reads/writes to the caller's business. Server routes that use the service-role client (`createAdminClient()`) must filter by `business_id` explicitly — grep for that pattern before writing new routes.
- **AI assistant** (`/api/ai/assistant`): streaming Claude chat with tool use (create bookings, customers, work items…). Rate-limited 60/hour per business. Tool calls execute through `src/lib/ai/tool-executor.ts`.
- **Automations:** rules stored per business; triggers fire from app events (`src/lib/automations/triggers.ts`) and from the hourly cron. Actions send templated WhatsApp messages (`{{customer_name}}`, `{{pix_link}}`, …).
- **Crons:** GitHub Actions (`.github/workflows/crons.yml`) hit `/api/cron/*` endpoints with `Authorization: Bearer CRON_SECRET`. If you deploy elsewhere, replicate the schedule with your host's cron.
- **Secrets at rest:** per-business third-party tokens (Mercado Pago, WhatsApp) are AES-encrypted with `ENCRYPTION_KEY` before storage (`src/lib/security/encrypt.ts`).

## Deployment

A `render.yaml` is included for [Render](https://render.com) (Node 20). The app also deploys cleanly to Vercel or any Node host:

1. Set every production env var from `.env.local.example` in your host's dashboard (never commit env files).
2. Upstash Redis is **required** in production — without it, rate limits are per-instance only.
3. Register webhook URLs with the providers: Evolution API → `/api/webhooks/whatsapp`, Mercado Pago → `/api/webhooks/mercadopago*`.
4. Configure the cron schedule (GitHub Actions workflow included, or use the host's cron).
5. Work through the **Production Launch Checklist** in [SECURITY.md](./SECURITY.md) before going live.

## Known gaps & roadmap

Honest status of what's done and what needs work before/after launch:

### Needs attention before production
- **Security headers** — CSP, HSTS, X-Frame-Options not yet configured in `next.config.ts`.
- **Mercado Pago production setup** — subscription plan IDs (`MERCADOPAGO_*_PLAN_ID`) must be created in the MP dashboard per environment; charges are real, test carefully.
- **Upstash Redis** — mandatory in prod (rate limiting + OAuth CSRF state). The app logs errors but does not hard-fail without it (except the MP OAuth flow, which fails closed).
- **Monitoring** — no Sentry/uptime monitoring wired up yet.
- **Generic webhooks hub** (`/api/webhooks/hub/[slug]`) — endpoint exists with per-business config (`webhooks-config` routes, migration 010), but inbound event processing is minimal; verify it does what you need or finish it.

### Feature gaps
- **WhatsApp** — fully functional via Evolution API (QR connect, send/receive, status tracking, history import, AI receptionist), but depends on a self-hosted Evolution instance; there is no Meta Cloud API path. Consider hardening reconnection handling.
- **No unit tests** — only the Playwright E2E suite. Business logic in `src/lib/` would benefit from unit coverage.
- **Webhook idempotency** — WhatsApp dedup relies on `whatsapp_message_id`; provider retries with new ids could duplicate messages.
- **Prompt-injection defense** — pattern-based tripwire only (see SECURITY.md backlog).

### Recently completed (June 2026)
- All launch-gap features (rate limiting, audit logs, LGPD export/delete, transactional email)
- `lead_created` / `lead_inactive` automation triggers
- Payment collection preferences in onboarding
- Pre-handoff security audit — 10 issues fixed (see SECURITY.md)

## Security

See [SECURITY.md](./SECURITY.md) for the security policy, the June 2026 audit results, the remaining backlog, LGPD compliance notes, and the production launch checklist.
