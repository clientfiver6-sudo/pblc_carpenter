import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "Webhook verify token no longer used." }, { status: 410 })
}
