import { NextResponse } from "next/server"
export async function POST() {
  return NextResponse.json({ error: "Use /api/whatsapp/connect-init instead" }, { status: 410 })
}
