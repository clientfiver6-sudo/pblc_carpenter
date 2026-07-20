# Security Policy — RetornAI

## Reporting Vulnerabilities

**Do NOT open a public GitHub issue for security vulnerabilities.**

Email: security@retornai.example (replace with the project's security contact)  
Subject: `[SECURITY] RetornAI — <brief description>`

Please include:
- Description of the vulnerability and affected component
- Steps to reproduce
- Potential impact
- Any suggested mitigations

You will receive a response within 48 hours. We commit to investigating all reports and releasing patches for confirmed vulnerabilities promptly.

---

## Penetration Test Checklist

### AUTH TESTS

- [ ] Register with SQL injection in email field → should fail validation
- [ ] Login with 11 wrong passwords → account lock (Supabase handles this via GoTrue)
- [x] Access /dashboard without session → redirects to /login (middleware enforced)
- [ ] Access /api/* without auth → returns 401
- [ ] JWT with modified business_id claim → rejected by RLS (Postgres enforces `auth.uid()`)
- [ ] Access DELETE /api/account/delete as non-owner role → returns 403

### DATA ISOLATION (Multi-tenant)

- [ ] Business A cannot fetch Business B's customers → blocked by RLS policies
- [ ] Business A cannot update Business B's work items → blocked by RLS policies
- [ ] Business A cannot access Business B's audit logs → blocked by RLS `audit_logs_select` policy
- [ ] Test by manually changing business_id in API request body — admin routes must still verify via session

### INJECTION

- [ ] HTML injection in customer name → sanitized by Zod schema on write
- [x] SQL injection in text fields → parameterized queries via Supabase client (no raw SQL)
- [ ] Oversized strings (10,000 chars) → rejected by max length validation
- [ ] Prompt injection in AI messages → detected and blocked by AI assistant

### RATE LIMITS

- [ ] POST /api/ai/assistant: 60/hour per business
- [ ] POST /api/ai/extract: 30/minute per user
- [x] GET /api/account/export-data: 5/day per business (implemented)
- [x] POST /api/account/delete: 3/day per business (implemented)
- [x] GET /api/customers/[id]/export: 20/hour per business (implemented)
- [ ] POST /api/webhooks/*: 1000/hour per IP
- [ ] Cron routes: require Bearer CRON_SECRET

### WEBHOOK SECURITY

- [ ] WhatsApp webhook without X-Hub-Signature-256 → 401
- [ ] Mercado Pago webhook without valid x-signature → 401
- [ ] Cron request without Authorization header → 401
- [ ] Replay attack on webhook (duplicate event ID) → idempotency check passes

### LGPD / DATA RIGHTS

- [x] GET /api/account/export-data → full JSON export of all business data (Article 18 — portability)
- [x] POST /api/account/delete → permanent erasure of all data (Article 18 — right to erasure)
- [x] GET /api/customers/[id]/export → individual customer data export
- [x] Audit log written for every export and deletion event

### TRANSPORT & HEADERS

- [ ] App served over HTTPS in production (no HTTP)
- [ ] HSTS header present in production responses
- [ ] Content-Security-Policy header configured
- [ ] X-Frame-Options: DENY (clickjacking prevention)
- [ ] Sensitive endpoints return Cache-Control: no-store

### SECRETS & ENV

- [ ] No secrets committed to git (check with `git log -p --all | grep -i secret`)
- [ ] SUPABASE_SERVICE_ROLE_KEY not exposed to browser (server-only)
- [ ] ANTHROPIC_API_KEY not exposed to browser (server-only)
- [ ] CRON_SECRET not exposed to browser (server-only)
- [ ] All production env vars set in hosting provider (not in .env files in repo)

---

## Pre-Handoff Security Audit (June 2026)

A full audit was performed before the project handoff. The following issues were **fixed**:

| Severity | Issue | Fix |
|----------|-------|-----|
| Critical | Seed route (`/api/dev/seed`) authenticated with the shared `CRON_SECRET` | Now requires a dedicated `SEED_SECRET`; route is also blocked entirely in production |
| Critical | MP subscription webhook trusted `external_reference` from Mercado Pago to pick the target business | Now verifies the business exists and isn't bound to a different preapproval before updating |
| Critical | MP subscription webhook accepted unsigned requests if `MERCADOPAGO_WEBHOOK_SECRET` was unset | Fails closed (500) in production when the secret is missing |
| High | MP OAuth connect silently degraded CSRF protection without Redis | Returns 503 in production without a state store; dev fallback documented in code |
| High | No per-business rate limit on WhatsApp history import | Capped at 5 imports/hour per business |
| High | Missing Redis in production silently fell back to per-instance rate limits | Loud `console.error` on first fallback in production |
| Medium | MP card webhook silently dropped rate-limited requests with no trace | Drops are now logged with IP + businessId |
| Medium | Medical notes accepted unvalidated `customerId`/`customer_id` | Customer ownership verified against the business before filtering/inserting |
| Low | Customer export leaked id existence via distinct error messages | Generic "Not found" |
| Low | Customer export filename unbounded | Name truncated to 50 chars |

### Remaining security backlog (prioritized)

1. **In-memory rate-limit fallback is per-instance** — with N serverless instances, effective limits are N× configured values. Mitigation in place: production logs an error. Proper fix: make Upstash Redis mandatory in production (fail closed).
2. **Prompt-injection detection is pattern-based** (`detectPromptInjection` in `src/lib/schemas`). It is a tripwire, not a guarantee. The per-business 60/hour rate limit on `/api/ai/assistant` bounds the damage. Consider model-level guardrails and per-conversation tool-call budgets.
3. **WhatsApp webhook idempotency relies on `whatsapp_message_id` uniqueness** (`src/app/api/webhooks/whatsapp/route.ts`). If Evolution API retries with a new message id, duplicates are possible. Consider a content-hash idempotency key.
4. **Security headers** (CSP, HSTS, X-Frame-Options) are not yet configured in `next.config.ts` — see Production Launch Checklist below.

---

## Secret Rotation Schedule

All API keys and secrets must be rotated every **90 days** or immediately upon suspected compromise.

| Secret | Location | Last Rotation |
|--------|----------|---------------|
| SUPABASE_SERVICE_ROLE_KEY | Supabase Dashboard → Settings → API | - |
| ANTHROPIC_API_KEY | Anthropic Console | - |
| UPSTASH_REDIS_REST_TOKEN | Upstash Dashboard | - |
| CRON_SECRET | Hosting env vars | - |
| RESEND_API_KEY | Resend Dashboard | - |
| WhatsApp Token (whatsapp_token) | Per-business in DB, rotated by Meta | Per Meta policy |
| Mercado Pago tokens | Per-business in DB | Per MP policy |

Rotation procedure:
1. Generate new secret in the provider dashboard
2. Update the hosting environment variable
3. Redeploy the application
4. Verify the new secret works in staging before retiring the old one
5. Record the rotation date in this table

---

## LGPD Rights — Implemented Endpoints

Brazil's Lei Geral de Proteção de Dados (LGPD) grants data subjects the following rights, served by these endpoints:

| LGPD Right | Article | Endpoint | Notes |
|------------|---------|----------|-------|
| Right to access / portability | Art. 18, VI | GET /api/account/export-data | Full JSON export; rate-limited to 5/day |
| Right to erasure | Art. 18, VI | POST /api/account/delete | Owner-only; requires confirmation text; irreversible |
| Individual data portability | Art. 18, VI | GET /api/customers/[id]/export | Single customer export including work history |
| Audit trail (accountability) | Art. 6, X | audit_logs table | Immutable; written on every sensitive action |

All export endpoints:
- Require authenticated session
- Strip sensitive third-party tokens (WhatsApp, Mercado Pago) before export
- Write to the audit_logs table
- Return Cache-Control: no-store

---

## Production Launch Checklist

### Infrastructure
- [ ] Production Supabase project separate from staging
- [ ] RLS enabled on ALL tables (verify with `SELECT tablename FROM pg_tables WHERE schemaname = 'public'` and check each)
- [ ] Supabase migration `20250522000001_audit_logs.sql` applied
- [ ] Upstash Redis configured (rate limiting multi-instance safe)
- [ ] Resend email configured for transactional emails

### Environment Variables (production)
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] ANTHROPIC_API_KEY
- [ ] UPSTASH_REDIS_REST_URL
- [ ] UPSTASH_REDIS_REST_TOKEN
- [ ] CRON_SECRET
- [ ] RESEND_API_KEY
- [ ] ADMIN_EMAIL
- [ ] NEXT_PUBLIC_APP_URL (no trailing slash)

### Webhooks
- [ ] WhatsApp webhook URL registered with Meta and verified
- [ ] Mercado Pago IPN URL registered and signature validation tested
- [ ] Cron jobs registered with hosting provider (Vercel Cron / external)

### Security Headers
- [ ] Configure `next.config.js` security headers for production
- [ ] Verify HTTPS is enforced (no plain HTTP in production)

### Monitoring
- [ ] Error monitoring configured (e.g. Sentry)
- [ ] Uptime monitoring configured
- [ ] Alert on spike in 4xx/5xx responses
- [ ] Alert on audit_log entries for `account.deleted`

### LGPD Documentation
- [ ] Privacy policy published at /privacidade
- [ ] Terms of service published at /termos
- [ ] Cookie policy published (if using cookies beyond session)
- [ ] Data Processing Agreement (DPA) available for enterprise customers
- [ ] Appointed Data Protection Officer (DPO) or equivalent contact

### Final Checks
- [ ] Run OWASP ZAP or equivalent scan against staging
- [ ] Manual pen test of auth flows (see checklist above)
- [ ] Verify data export includes all user data (spot-check)
- [ ] Verify account deletion removes all records (spot-check with admin)
- [ ] Load test key endpoints (AI assistant, webhooks) at 2x expected peak
