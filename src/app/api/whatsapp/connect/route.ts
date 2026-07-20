import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "Meta OAuth no longer supported. Use Z-API." }, { status: 410 })
}
