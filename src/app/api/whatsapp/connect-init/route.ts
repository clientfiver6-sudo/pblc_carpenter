import { NextResponse } from "next/server"
import { getBusinessId } from "@/lib/auth/actions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createInstance, deleteInstance, getQRCode } from "@/lib/whatsapp/client"

export async function POST() {
  const businessId = await getBusinessId()
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error("[connect-init] NEXT_PUBLIC_APP_URL is not set")
    return NextResponse.json({ error: "Configuração incompleta no servidor (APP_URL)" }, { status: 500 })
  }
  const webhookUrl = `${appUrl}/api/webhooks/whatsapp`

  const instanceName = `business-${businessId}`

  try {
    // Delete any existing instance first — avoids "already exists" errors on retry
    try { await deleteInstance(instanceName) } catch { /* not found, fine */ }

    const result = await createInstance(instanceName, webhookUrl)
    let qr = result.qrcode?.base64 ?? null
    if (!qr) qr = await getQRCode(instanceName)

    const admin = createAdminClient()
    const { error: updateErr } = await admin.from("businesses")
      .update({ whatsapp_phone_id: instanceName, whatsapp_token: null } as never)
      .eq("id", businessId)
    if (updateErr) {
      console.error("[connect-init] DB update failed", updateErr)
      return NextResponse.json({ error: "Falha ao salvar configuração" }, { status: 500 })
    }

    return NextResponse.json({ qr })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("connect-init error", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
