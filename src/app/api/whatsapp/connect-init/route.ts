import { NextResponse } from "next/server"
import { getBusinessId } from "@/lib/auth/actions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createInstance, deleteInstance, getQRCode } from "@/lib/whatsapp/client"
import { EVOLUTION_API_URL, EVOLUTION_API_KEY } from "@/lib/env"

async function forceDeleteInstance(instanceName: string): Promise<void> {
  // Try to logout first (Evolution API often requires this before delete)
  try {
    await fetch(`${EVOLUTION_API_URL}/instance/logout/${instanceName}`, {
      method: "DELETE",
      headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
    })
  } catch {
    // logout failed, continue anyway
  }

  // Small delay to let logout propagate
  await new Promise((r) => setTimeout(r, 1000))

  // Now try to delete
  try {
    await deleteInstance(instanceName)
  } catch (err) {
    console.warn("[connect-init] delete after logout also failed:", err instanceof Error ? err.message : String(err))
  }
}

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
    // Force-delete any existing instance (logout first, then delete)
    await forceDeleteInstance(instanceName)

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

    // If create failed because instance already exists, try to just fetch the QR
    if (msg.includes("already in use")) {
      console.warn("[connect-init] Instance exists, fetching existing QR code...")
      try {
        const qr = await getQRCode(instanceName)
        return NextResponse.json({ qr })
      } catch (qrErr) {
        console.error("[connect-init] Failed to fetch QR for existing instance:", qrErr)
      }
    }

    console.error("connect-init error", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
