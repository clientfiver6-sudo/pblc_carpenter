// Brazil is permanently UTC-3 (no DST since 2019).
const TZ = "America/Sao_Paulo"
const OFFSET = "-03:00"

/** Current date string in SP timezone as "YYYY-MM-DD" */
export function spToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ })
}

/** Convert a SP-local datetime string to a UTC ISO string.
 *  e.g. spToISO("2025-05-28", "17:00") → "2025-05-28T20:00:00.000Z"
 */
export function spToISO(dateStr: string, timeStr = "00:00"): string {
  return new Date(`${dateStr}T${timeStr}:00${OFFSET}`).toISOString()
}

/** Full-day UTC range for a given SP calendar date.
 *  Use for DB .gte / .lte queries that filter by a single day.
 */
export function spDayRange(dateStr: string): { start: string; end: string } {
  const start = spToISO(dateStr, "00:00")
  const end   = spToISO(dateStr, "23:59") // 23:59 SP = next day 02:59 UTC
  return { start, end }
}

/** Format a UTC ISO string for display in SP timezone */
export function formatSpTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export function formatSpDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  })
}
