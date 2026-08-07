/**
 * When the demo's history happened.
 *
 * The seeded data was written against a fixed calendar — orders from January to
 * the end of June 2026, clients from 2025 into that June. Fixed dates go stale
 * on their own: a few weeks after they were written, "sales this month" and
 * "new clients this month" are permanently zero, and the demo shows a business
 * that stopped trading. The filters behind those numbers are right; there is
 * simply nothing in the current month to find.
 *
 * So the history is anchored to the day the demo is opened instead. Everything
 * seeded keeps its shape — the same intervals, the same order, the same
 * distance between an order and its shipment — and is moved forward as a whole
 * so that it ends today.
 *
 * The price of this is that a seeded date is not the same string tomorrow.
 * Nothing may assert one; assert distances and order instead.
 */

/** The last day the fixtures were written for: everything seeded ends here. */
const FIXTURE_END = new Date(2026, 5, 30)

const MS_PER_DAY = 86_400_000

/** Midnight today, in local time — the day the demo is being looked at. */
function today(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Whole days between the end of a seeded series and today.
 *
 * Each series says where it ends: the orders run to the end of June, the client
 * list stops earlier. Shifting both by the orders' distance would leave the
 * newest client weeks in the past and "new clients this month" at zero — the
 * very thing this is here to fix. Every series ends today, each by its own
 * distance.
 *
 * Never negative: a demo opened before the fixture end date keeps the dates it
 * was written with rather than inventing a future.
 */
export function demoShiftDays(fixtureEnd: Date = FIXTURE_END): number {
  return Math.max(0, Math.round((today().getTime() - fixtureEnd.getTime()) / MS_PER_DAY))
}

/** A fixed seeded date, moved with the rest of its series. */
export function shiftDemoDate(date: Date, fixtureEnd: Date = FIXTURE_END): Date {
  const moved = new Date(date)
  moved.setDate(moved.getDate() + demoShiftDays(fixtureEnd))
  return moved
}

/** The same, for the `YYYY-MM-DD` dates the seeded clients carry. */
export function shiftDemoDay(day: string, fixtureEnd: Date = FIXTURE_END): string {
  const parsed = new Date(day + 'T00:00:00')
  if (Number.isNaN(parsed.getTime())) return day
  const moved = shiftDemoDate(parsed, fixtureEnd)
  const month = String(moved.getMonth() + 1).padStart(2, '0')
  const dayOfMonth = String(moved.getDate()).padStart(2, '0')
  return `${moved.getFullYear()}-${month}-${dayOfMonth}`
}
