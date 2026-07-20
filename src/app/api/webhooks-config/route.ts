import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: bu } = await supabase.from("business_users").select("business_id").eq("user_id", user.id).single()
  if (!bu) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data } = await supabase
    .from("webhook_endpoints")
    .select("id, name, provider, path_suffix, active, event_map, created_at")
    .eq("business_id", (bu as { business_id: string }).business_id)
    .order("created_at", { ascending: false })

  return NextResponse.json({ endpoints: data ?? [] })
}
