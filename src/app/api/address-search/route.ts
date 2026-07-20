import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"

interface NominatimResult {
  address: {
    road?: string
    house_number?: string
    suburb?: string
    neighbourhood?: string
    city?: string
    town?: string
    village?: string
    municipality?: string
    "ISO3166-2-lvl4"?: string
    postcode?: string
  }
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const { allowed } = await checkRateLimit(`address-search:${ip}`, 60, 60_000)
  if (!allowed) return NextResponse.json([], { status: 429 })

  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 3) return NextResponse.json([])

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(q)}` +
      `&format=json&addressdetails=1&countrycodes=br&limit=5&accept-language=pt-BR`

    const res = await fetch(url, {
      headers: {
        "User-Agent": "RetornAI/1.0 (contato@retorn.ai)",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
      next: { revalidate: 300 },
    })

    if (!res.ok) return NextResponse.json([])

    const items = (await res.json()) as NominatimResult[]

    const suggestions = items
      .map((r) => {
        const a = r.address
        const road = [a.road, a.house_number].filter(Boolean).join(", ")
        const neighbourhood = a.suburb || a.neighbourhood || ""
        const city = a.city || a.town || a.village || a.municipality || ""
        const stateCode = (a["ISO3166-2-lvl4"] ?? "").replace("BR-", "")
        const zipCode = (a.postcode ?? "").replace(/\D/g, "")

        if (!road && !city) return null

        const main = road || city
        const secondaryParts = [neighbourhood, city, stateCode].filter(Boolean)
        const secondary = secondaryParts.join(", ")

        const fullParts = [road, neighbourhood, city, stateCode].filter(Boolean)
        const fullAddress = fullParts.join(", ")

        return { main, secondary, fullAddress, city, state: stateCode, zipCode }
      })
      .filter(Boolean)

    return NextResponse.json(suggestions)
  } catch {
    return NextResponse.json([])
  }
}
