const PROMO_CODES: Record<string, { plan: "starter" | "pro" | "medical"; months: number }> = {
  STARTERFREE:  { plan: "starter",  months: 1 },
  PROFREE:      { plan: "pro",      months: 1 },
  MEDICALFREE:  { plan: "medical",  months: 1 },
}

export function resolvePromo(code: string | undefined | null): {
  plan: "starter" | "pro" | "medical"
  status: "active" | "trialing"
  endsAt: string | null
} | null {
  if (!code?.trim()) return null
  const grant = PROMO_CODES[code.trim().toUpperCase()]
  if (!grant) return null
  const endsAt = new Date(Date.now() + grant.months * 30 * 24 * 60 * 60 * 1000).toISOString()
  return { plan: grant.plan, status: "active", endsAt }
}
