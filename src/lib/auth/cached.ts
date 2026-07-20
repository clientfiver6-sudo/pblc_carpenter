import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

export const getCachedUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getCachedBusinessId = cache(async () => {
  const user = await getCachedUser()
  if (!user) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  return (data as { business_id: string } | null)?.business_id ?? null
})
