# Security Audit — src/ Hardcoded Secrets

**Audit date:** 2026-05-22  
**Scope:** `src/` directory  
**Auditor:** Automated grep scan (patterns: `sk-ant-`, `Bearer <token>`, `password=`, `secret=`, `token=`, `apiKey`, `ACCESS_TOKEN`, embedded Supabase URLs with keys, JWT-like strings)

## Result

**No hardcoded secrets found in `src/` as of audit.**

All sensitive values are read exclusively from `process.env` and (after this hardening) from the `env` object exported by `src/lib/env.ts`.

## .gitignore Status

`.env*.local` and `.env` are both listed in `.gitignore`. ✓

## Notes

- The `src/app/api/dev/seed/route.ts` route is blocked in production (`NODE_ENV === 'production'` guard) — acceptable.
- `process.env.NODE_ENV` comparisons in error boundary components are not secrets — acceptable.
- Re-run this audit whenever new API integrations are added.
