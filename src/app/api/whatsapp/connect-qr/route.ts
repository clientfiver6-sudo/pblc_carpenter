import { NextResponse } from "next/server"
import { getBusinessId } from "@/lib/auth/actions"
import { getQRCode } from "@/lib/whatsapp/client"

export async function GET() {
  const businessId = await getBusinessId()
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const qr = await getQRCode(`business-${businessId}`)
  return NextResponse.json({ qr })
}
