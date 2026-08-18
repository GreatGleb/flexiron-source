import { demoShiftDays } from './demoClock'
import type { StockAuditEntry } from '@/types/warehouse'

/**
 * When the seeded audit history happened.
 *
 * `demoClock` moves each seeded series so that it ends on the day the demo is
 * opened. The nine audit logs were left out of that, and they had drifted apart by
 * almost eighteen months: the newest entry was 2026-06-01 for clients and
 * 2025-01-15 for movements. Only the orders rode the clock, so the merged feed
 * (Настройки → Логи) was solid orders for its first two pages, and the gap widened
 * by a day every day.
 *
 * **Each log gets its own end.** `demoShiftDays` takes the series end as a
 * parameter precisely for this. Run all eight through one shared `FIXTURE_END` and
 * movements would land in January 2025 plus that shift — still a year and a half
 * behind, with the work spent for nothing.
 *
 * The end is never written down as a number: it is read from the log itself, so a
 * later edit to the seeds cannot silently drag one back into the past.
 */

/**
 * An audit stamp as an instant.
 *
 * Two shapes live in these logs — `2026-04-23 13:17` and full ISO — and sorted as
 * text they interleave wrongly, because `T` sorts after a space. One definition,
 * here, used by both the shifter and the feed: two copies of this is how the two
 * formats start disagreeing again.
 */
export function auditTimestampValue(timestamp: string): number {
  const direct = Date.parse(timestamp)
  if (!Number.isNaN(direct)) return direct
  const normalized = Date.parse(timestamp.replace(' ', 'T'))
  return Number.isNaN(normalized) ? 0 : normalized
}

/** `YYYY-MM-DD` plus whole days, as text. */
function addDaysToDatePart(datePart: string, days: number): string {
  const moved = new Date(`${datePart}T00:00:00`)
  if (Number.isNaN(moved.getTime())) return datePart
  moved.setDate(moved.getDate() + days)
  const month = String(moved.getMonth() + 1).padStart(2, '0')
  const day = String(moved.getDate()).padStart(2, '0')
  return `${moved.getFullYear()}-${month}-${day}`
}

/**
 * Moves one log series so its newest entry lands today, and returns the shift.
 *
 * Only the first ten characters are rewritten — the date — and everything after
 * them is left byte-identical: ` 13:17`, `T08:00:00Z`, `T13:17:00.000Z`. Passing the
 * stamps through `Date` and re-serialising would quietly normalise one shape into
 * the other, which is the mixed-format sorting hazard described above. The shift is
 * whole days, so date-part arithmetic loses nothing.
 *
 * The logs are passed by reference and mutated: the caller hands over the canonical
 * arrays the cards read, so that one deletion, one edit and one shift are all seen
 * by both the card and the feed.
 */
export function shiftAuditSeries(logs: (StockAuditEntry[] | undefined | null)[]): number {
  const entries = logs.flatMap((log) => log ?? [])
  if (entries.length === 0) return 0

  let newest = 0
  for (const entry of entries) {
    const value = auditTimestampValue(entry.timestamp)
    if (value > newest) newest = value
  }
  if (newest === 0) return 0

  const shift = demoShiftDays(new Date(newest))
  if (shift === 0) return 0

  for (const entry of entries) {
    const datePart = entry.timestamp.slice(0, 10)
    const rest = entry.timestamp.slice(10)
    entry.timestamp = addDaysToDatePart(datePart, shift) + rest
  }
  return shift
}
