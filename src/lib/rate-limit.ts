// Rate limiter: uses Upstash Redis in production (multi-instance safe),
// falls back to in-memory when UPSTASH_REDIS_REST_URL is not set.
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// ─── In-memory fallback (single-instance dev / no Redis configured) ───────────

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

// Evict expired buckets every 5 minutes to prevent unbounded growth
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) {
    if (now > b.resetAt) buckets.delete(k)
  }
}, 5 * 60 * 1000).unref?.()

function inMemoryCheck(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: maxRequests - 1, resetAt }
  }
  if (bucket.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt }
  }
  bucket.count++
  return { allowed: true, remaining: maxRequests - bucket.count, resetAt: bucket.resetAt }
}

// ─── Upstash Redis (multi-instance production) ────────────────────────────────

let redis: Redis | null = null
const limiters = new Map<string, Ratelimit>()

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

function getLimiter(maxRequests: number, windowMs: number): Ratelimit | null {
  const r = getRedis()
  if (!r) return null
  const cacheKey = `${maxRequests}:${windowMs}`
  if (limiters.has(cacheKey)) return limiters.get(cacheKey)!
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
    analytics: false,
  })
  limiters.set(cacheKey, limiter)
  return limiter
}

// ─── Public API (same signature as before) ────────────────────────────────────

let warnedMissingRedis = false

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const limiter = getLimiter(maxRequests, windowMs)
  if (!limiter) {
    if (process.env.NODE_ENV === "production" && !warnedMissingRedis) {
      warnedMissingRedis = true
      console.error(
        "[rate-limit] Upstash Redis not configured in production — falling back to per-instance " +
        "in-memory limits. With N instances, effective limits are N× the configured values. " +
        "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
      )
    }
    return inMemoryCheck(key, maxRequests, windowMs)
  }
  const { success, remaining, reset } = await limiter.limit(key)
  return { allowed: success, remaining, resetAt: reset }
}
