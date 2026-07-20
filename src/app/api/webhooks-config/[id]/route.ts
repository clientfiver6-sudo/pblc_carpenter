import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rate-limit"

// Fields a client is allowed to mutate via PATCH. Everything else (id,
// business_id, secret, path_suffix, created_at) is server-owned and must never
// be accepted from the request body (mass-assignment guard).
const UPDATABLE_FIELDS = ["name", "active", "event_map", "provider"] as const

// Resolve the caller's business and verify the target endpoint belongs to it.
// Returns the businessId on success, or a NextResponse to short-circuit with.
async function authorizeEndpoint(
  supabase: Awaited<ReturnType<typeof createClient>>,
  endpointId: string,
): Promise<{ businessId: string } | NextResponse> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: rawBu } = await supabase
    .from("business_users")
    .select("business_id")
    .eq("user_id", user.id)
    .single()
  const bu = rawBu as { business_id: string } | null
  if (!bu) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: rawEndpoint } = await supabase
    .from("webhook_endpoints")
    .select("business_id")
    .eq("id", endpointId)
    .single()
  const endpoint = rawEndpoint as { business_id: string } | null

  // 404 (not 403) so we don't leak whether the id exists for another tenant.
  if (!endpoint || endpoint.business_id !== bu.business_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return { businessId: bu.business_id }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const auth = await authorizeEndpoint(supabase, id)
  if (auth instanceof NextResponse) return auth

  const { allowed, resetAt } = await checkRateLimit(`webhooks-config:${auth.businessId}`, 100, 3_600_000)
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  // Scope the delete to the owning business as defense-in-depth alongside the check above.
  const { error } = await supabase
    .from("webhook_endpoints")
    .delete()
    .eq("id", id)
    .eq("business_id", auth.businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const auth = await authorizeEndpoint(supabase, id)
  if (auth instanceof NextResponse) return auth

  const { allowed, resetAt } = await checkRateLimit(`webhooks-config:${auth.businessId}`, 100, 3_600_000)
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: "Limite de requisições atingido. Tente novamente em breve." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  const body = await req.json() as Record<string, unknown>

  // Whitelist updatable fields — never trust client-supplied business_id/id/secret.
  const update: Record<string, unknown> = {}
  for (const field of UPDATABLE_FIELDS) {
    if (field in body) update[field] = body[field]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nenhum campo editável fornecido" }, { status: 400 })
  }

  const { error } = await supabase
    .from("webhook_endpoints")
    .update(update as never)
    .eq("id", id)
    .eq("business_id", auth.businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
