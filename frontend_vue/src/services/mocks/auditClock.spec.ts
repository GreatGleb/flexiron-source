import { describe, it, expect } from 'vitest'
import { mockGetAuditFeed } from './auditFeed'
import { auditTimestampValue } from './auditClock'
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

  it('no single kind owns the whole first page', () => {
    // The symptom the shift was for: orders used to fill the first two pages on
    // their own. Kept as a symptom check, below the mechanism checks above.
    const kinds = new Set(
      mockGetAuditFeed(ALL, { page: 1, pageSize: 25 }).items.map((r) => r.entityType),
    )
    expect(kinds.size).toBeGreaterThan(1)
  })
})
