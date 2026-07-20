import { NextResponse } from "next/server"
import { getBusinessId } from "@/lib/auth/actions"
import { createAdminClient } from "@/lib/supabase/admin"
import { getInstanceInfo } from "@/lib/whatsapp/client"

export async function GET() {
  const businessId = await getBusinessId()
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const instanceName = `business-${businessId}`

  let info: { state: string | null; phone: string | null; profileName: string | null }
  try {
    info = await getInstanceInfo(instanceName)
  } catch (err) {
    console.error("[connect-status] getInstanceInfo failed", err)
    return NextResponse.json({ connected: false, state: null, phone: null, profileName: null, error: "Evolution API unavailable" })
  }

  const { state, phone, profileName } = info
  const connected = state === "open"

  if (connected) {
    const admin = createAdminClient()

    const { data: biz } = await admin
      .from("businesses")
      .select("whatsapp_connected_at")
      .eq("id", businessId)
      .single()

    const wasAlreadyConnected = !!(biz as { whatsapp_connected_at?: string | null } | null)
      ?.whatsapp_connected_at

    await admin
      .from("businesses")
      .update({ whatsapp_connected_at: new Date().toISOString() } as never)
      .eq("id", businessId)

    // First-time connection → kick off history import as a background job.
    // Fire-and-forget: the import runs in its own serverless function invocation.
    if (!wasAlreadyConnected) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL
      const cronSecret = process.env.CRON_SECRET
      if (appUrl && cronSecret) {
        fetch(`${appUrl}/api/whatsapp/import-history`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({ businessId, instanceName }),
        }).catch(err =>
          console.error("[connect-status] import-history trigger failed", err)
        )
      }
    }
  }

  return NextResponse.json({ connected, state, phone, profileName, instanceName })
}
