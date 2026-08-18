import { describe, it, expect } from 'vitest'
import { mockGetAuditFeed } from './auditFeed'
import { auditTimestampValue, shiftAuditSeries } from './auditClock'
import { AUDIT_ENTITY_TYPES } from '@/types/audit'

/**
 * The demo clock reaches all nine logs.
 *
 * A file of its own, and not a describe inside `auditFeed.spec.ts`, for a reason
 * worth keeping: that spec deletes audit rows to prove the feed and the cards share
 * one store, and it deletes them newest-first. Measuring freshness after those tests
 * reads a store they have already emptied of its newest entries — which is exactly
 * what happened on the first run of this check: batch came back 21 days old while its
 * real newest entry was yesterday. Vitest gives each file its own module registry, so
 * here the seeds are pristine.
 */

const ALL = { entityType: '', user: '', dateFrom: '', dateTo: '', search: '' }
const everything = () => mockGetAuditFeed(ALL, { page: 1, pageSize: 10_000 })

describe('every log ends today — the demo clock reaches all nine', () => {
  /**
   * Two days.
   *
   * `demoClock`'s contract is that a seeded series ends TODAY, so the tolerance is
   * for rounding and nothing else: `demoShiftDays` rounds whole days against local
   * midnight, and a stamp keeps the time of day it was written with, so a correctly
   * shifted series lands on today's date at that time — up to about a day away from
   * "now", plus a day of slack across a timezone boundary.
   *
   * It is deliberately not generous. A log that was missed is 14 to 580 days behind,
   * so a month-wide tolerance would pass the very thing this test exists to catch.
   */
  const MAX_AGE_DAYS = 2
  const DAY_MS = 86_400_000

  /**
   * Read through the FEED, not the seed modules.
   *
   * A check against the seeds would prove the seeds moved, not that the feed shows
   * it — and those are different claims, as `movement.auditLog` versus
   * `getOrCreateMovementAudit` already demonstrated: one of them the card never sees.
   */
  function newestPerEntityType(): Map<string, number> {
    const newest = new Map<string, number>()
    for (const row of everything().items) {
      const value = auditTimestampValue(row.timestamp)
      if (value > (newest.get(row.entityType) ?? 0)) newest.set(row.entityType, value)
    }
    return newest
  }

  it('all nine kinds appear in the feed', () => {
    expect([...newestPerEntityType().keys()].sort()).toEqual([
      'batch',
      'client',
      'deficit',
      'movement',
      'offcut',
      'order',
      'product',
      'stock',
      'supplier',
    ])
  })

  it.each(AUDIT_ENTITY_TYPES)('the newest %s entry is within two days of today', (entityType) => {
    const newest = newestPerEntityType().get(entityType)
    expect(newest, `no ${entityType} rows in the feed at all`).toBeDefined()

    const ageDays = (Date.now() - newest!) / DAY_MS
    expect(
      ageDays,
      `the newest ${entityType} entry is ${ageDays.toFixed(1)} days old — that log is not on the demo clock`,
    ).toBeLessThanOrEqual(MAX_AGE_DAYS)
  })

  // No assertion here about the MIX of kinds on the first page. The drift is fixed,
  // but what now decides that page is how densely each log wrote near its end — and
  // whether the result is honest or wants grouping is a decision not yet taken. A
  // test would freeze it before the conversation.
})

describe('the series lands on today whatever time of day it ended at', () => {
  /**
   * The one-day defect this guards.
   *
   * The shift used to be computed from the newest INSTANT while `demoShiftDays`
   * measures against local midnight, so a series ending after midday lost a whole day
   * to `Math.round` and arrived yesterday. The nine-log freshness check above cannot
   * see it: its two-day tolerance is exactly wide enough to swallow one day.
   */
  function seriesEndingAt(time: string) {
    return [
      { id: 'x-au-1', timestamp: `2025-05-10${time}`, ...WHO },
      { id: 'x-au-2', timestamp: `2025-01-15${time}`, ...WHO },
    ]
  }
  const WHO = {
    user: { ru: '', en: 'T', lt: '' },
    userInitials: 'T',
    property: { ru: '', en: 'p', lt: '' },
    oldValue: 'a',
    newValue: 'b',
  }
  const today = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }

  it.each([' 08:24', ' 13:17', ' 23:50', 'T10:00:00Z', 'T18:30:00Z'])(
    'a series ending at %s lands on today',
    (time) => {
      const log = seriesEndingAt(time)
      shiftAuditSeries([log])
      const newest = log.reduce((a, b) =>
        auditTimestampValue(a.timestamp) > auditTimestampValue(b.timestamp) ? a : b,
      )
      expect(newest.timestamp.slice(0, 10)).toBe(today())
    },
  )

  it('keeps the time of day and the exact stamp format', () => {
    const log = seriesEndingAt('T18:30:00.000Z')
    shiftAuditSeries([log])
    expect(log[0]!.timestamp.slice(10)).toBe('T18:30:00.000Z')
    const spaced = seriesEndingAt(' 13:17')
    shiftAuditSeries([spaced])
    expect(spaced[0]!.timestamp.slice(10)).toBe(' 13:17')
  })

  it('keeps the distances inside the series, in whole days', () => {
    // In DAYS, deliberately. Adding whole days to a local wall-clock stamp preserves
    // the calendar distance, not the absolute one: a pair that straddles a DST
    // boundary comes out an hour apart from where it started. `shiftDemoDate` has
    // always worked this way, and the guarantee worth asserting is the one the shift
    // actually makes — same order, same days between entries.
    const days = (a: string, b: string) =>
      Math.round((auditTimestampValue(a) - auditTimestampValue(b)) / 86_400_000)
    const log = seriesEndingAt(' 13:17')
    const before = days(log[0]!.timestamp, log[1]!.timestamp)
    shiftAuditSeries([log])
    expect(days(log[0]!.timestamp, log[1]!.timestamp)).toBe(before)
  })
})
