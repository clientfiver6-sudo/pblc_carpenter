import type { WorkItemStatus } from "@/types/database"

type StatusInput = {
  status: WorkItemStatus
  scheduled_start: string | null
  scheduled_end: string | null
  service?: { duration_minutes?: number | null } | null
}

const AUTHORITATIVE_STATUSES: WorkItemStatus[] = [
  "completed", "cancelled", "no_show", "waiting_customer", "waiting_parts",
]

/**
 * Derives the real-time effective status from calendar times, mirroring the
 * hourly cron logic. This prevents the UI from lagging behind the cron tick.
 *
 * Manual/terminal states (completed, cancelled, no_show, waiting_*) are always
 * authoritative and are never overridden.
 */
export function getEffectiveStatus(item: StatusInput, now: Date): WorkItemStatus {
  const s = item.status

  if (AUTHORITATIVE_STATUSES.includes(s)) return s

  const start = item.scheduled_start ? new Date(item.scheduled_start) : null
  if (!start) return s

  const durationMs = (item.service?.duration_minutes ?? 120) * 60_000
  const end = item.scheduled_end
    ? new Date(item.scheduled_end)
    : new Date(start.getTime() + durationMs)

  if (end <= now) return "completed"
  if (start <= now) return "in_progress"
  return s
}
