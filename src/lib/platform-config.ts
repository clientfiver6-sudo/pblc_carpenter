import { createAdminClient } from "@/lib/supabase/admin"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (t: string) => any }

const cache = new Map<string, { value: string; exp: number }>()
const TTL_MS = 5 * 60 * 1000

export async function getPlatformConfig(key: string): Promise<string | null> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.exp > now) return hit.value

  const admin = createAdminClient() as unknown as AnyClient
  const { data } = await admin.from("platform_config").select("value").eq("key", key).single() as
    { data: { value: string } | null }
  if (data?.value) {
    cache.set(key, { value: data.value, exp: now + TTL_MS })
    return data.value
  }
  return null
}

export async function setPlatformConfig(key: string, value: string): Promise<void> {
  const admin = createAdminClient() as unknown as AnyClient
  await admin
    .from("platform_config")
    .upsert({ key, value, updated_at: new Date().toISOString() })
  cache.set(key, { value, exp: Date.now() + TTL_MS })
}
