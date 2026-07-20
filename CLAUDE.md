# CLAUDE.md — Development guide for RetornAI

Read README.md first for setup and architecture. This file covers conventions and gotchas for working in this codebase.

## Commands

```bash
npm run dev        # dev server on :3000
npm run build      # must pass before committing significant changes
npm run lint       # ESLint 9 + Next.js rules
npm run test:ai    # Playwright E2E (needs running app + seeded demo data)
```

## Conventions

- **Language split:** all UI strings, error messages and customer-facing copy in Brazilian Portuguese (pt-BR). Code, comments, commits in English.
- **No ORM:** raw Supabase JS client. Three factories in `src/lib/supabase/`:
  - `createClient()` (server) — user-scoped, RLS applies. Default choice.
  - `createAdminClient()` — service role, **bypasses RLS**. Every query MUST filter `.eq("business_id", businessId)` explicitly. This is the #1 source of potential tenant-isolation bugs.
  - browser client — for client components.
- **Auth pattern in API routes:** get the session user, look up their business via `business_users`, then scope everything to that `business_id`. See `src/app/api/medical/notes/route.ts` (`guard()`) for the canonical pattern, or `getBusinessId()` in `src/lib/auth/actions`.
- **Cron/internal routes** authenticate with `Authorization: Bearer ${CRON_SECRET}`. The seed route uses a separate `SEED_SECRET` and is disabled in production.
- **Validation:** Zod schemas in `src/lib/schemas`. AI inputs go through `aiMessageSchema` + `detectPromptInjection`.
- **Rate limiting:** `checkRateLimit(key, max, windowMs)` from `src/lib/rate-limit.ts`. Add it to any new endpoint that hits paid APIs (Anthropic, Evolution, MP) or does heavy DB work.
- **Webhooks:** always verify signatures (see `src/app/api/webhooks/mercadopago-subscription/route.ts` for the MP HMAC pattern). Fail closed in production if the secret env var is missing. Return 200 for events you ignore — providers retry on non-2xx.
- **Encrypted tokens:** per-business MP/WhatsApp tokens are encrypted with `safeEncryptToken` (`src/lib/security/encrypt.ts`) before DB writes.

## Gotchas

- **Timezones:** business logic uses São Paulo time, not UTC. Use `spToday()`, `spDayRange()`, `formatSpTime()` from `src/lib/utils/brazil-time.ts` for any "today"/day-boundary logic. Mixing UTC day boundaries in has caused real bugs.
- **Module-load crashes:** `next build` imports every route during page-data collection. Never throw at module top-level for a missing env var — check it inside the handler (this broke the production build once; see `/api/dev/seed`).
- **RLS is the real guard:** middleware only redirects unauthenticated dashboard visits. Data protection lives in Postgres RLS + explicit business_id filters on admin-client queries.
- **Migrations:** append-only, numbered (`NNN_name.sql`) in `supabase/migrations/`. Never edit an applied migration; add a new one.
- **AI costs:** Claude calls are metered per business (`src/lib/ai/usage.ts`); the model router (`src/lib/ai/model-router.ts`) picks Haiku/Sonnet by task, and background/ambient jobs can route to DeepSeek. Don't hardcode model ids in feature code — go through the router.
- **Demo seed ids:** demo businesses use fixed UUIDs (`b1…0001`, `b2…0002`, `b3…0003`) — handy for manual testing.

## Where things live

| Concern | Path |
|---|---|
| AI assistant endpoint (streaming + tools) | `src/app/api/ai/assistant/route.ts` |
| AI business context builder | `src/lib/ai/brain.ts` |
| AI tool definitions / execution | `src/lib/ai/tools.ts`, `src/lib/ai/tool-executor.ts` |
| Automations engine + event triggers | `src/lib/automations/engine.ts`, `triggers.ts` |
| WhatsApp gateway client | `src/lib/whatsapp/client.ts` |
| WhatsApp inbound webhook (incl. AI receptionist) | `src/app/api/webhooks/whatsapp/route.ts` |
| Mercado Pago Pix + subscriptions | `src/lib/payments/mercadopago.ts` |
| Transactional email | `src/lib/email.ts` |
| Audit logging | `src/lib/audit.ts` |
| LGPD export/delete | `src/app/api/account/export-data`, `account/delete` |

## Testing changes

1. `npm run build` — catches type errors and module-load issues across all routes.
2. `npm run lint`.
3. For UI/flow changes: run the app and walk the flow manually, or run the relevant Playwright specs (`npm run test:ai`).
4. For webhook changes: curl the endpoint locally with a forged-then-valid signature to confirm both rejection and acceptance paths.
