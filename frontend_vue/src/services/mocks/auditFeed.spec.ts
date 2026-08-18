import { describe, it, expect } from 'vitest'
import { mockGetAuditFeed, mockGetAuditFeedUsers, auditTimestampValue } from './auditFeed'
import { mockGetBatchAudit, mockDeleteBatchAuditEntry } from './warehouse'
import { mockGetProduct, mockDeleteProductAuditEntry } from './products'
import { auditRowKey, withoutRow, type AuditFeedRow } from '@/types/audit'

/**
 * The feed is a view over the nine logs, not a tenth store.
 *
 * Everything below is about that one property. If a record could be deleted in
 * the feed and still be shown by the card — or the other way round — the two
 * would be reading different things, and no amount of extra tests would fix it.
 */

const ALL = { entityType: '', user: '', dateFrom: '', dateTo: '', search: '' }
const everything = () => mockGetAuditFeed(ALL, { page: 1, pageSize: 10_000 })

describe('audit feed — merge', () => {
  it('gathers all nine entity kinds into one list', () => {
    const kinds = new Set(everything().items.map((r) => r.entityType))
    expect([...kinds].sort()).toEqual(
      [
        'batch',
        'client',
        'deficit',
        'movement',
        'offcut',
        'order',
        'product',
        'stock',
        'supplier',
      ].filter((k) => kinds.has(k as never)),
    )
    // Nine entities keep a history; every one of them has seeded records.
    expect(kinds.size).toBe(9)
  })

  it('sorts by the instant, not by the string', () => {
    // Two stamp formats live in these logs — `2026-04-23 13:17` and full ISO.
    // Sorted as text they interleave wrongly; sorted as time they do not.
    const items = everything().items
    const times = items.map((r) => auditTimestampValue(r.timestamp))
    for (let i = 1; i < times.length; i++) expect(times[i - 1]!).toBeGreaterThanOrEqual(times[i]!)

    expect(auditTimestampValue('2026-04-23 13:17')).toBe(auditTimestampValue('2026-04-23T13:17:00'))
  })

  it('paginates after the merge, not per entity', () => {
    const all = everything()
    const pageSize = 7
    const first = mockGetAuditFeed(ALL, { page: 1, pageSize })
    const second = mockGetAuditFeed(ALL, { page: 2, pageSize })

    expect(first.total).toBe(all.total)
    expect(first.items).toHaveLength(pageSize)
    // Page 2 continues page 1 in one order — it is a slice of the merged list.
    expect(second.items.map(auditRowKey)).toEqual(
      all.items.slice(pageSize, pageSize * 2).map(auditRowKey),
    )
    // And no page holds a record newer than the page before it.
    const lastOfFirst = auditTimestampValue(first.items.at(-1)!.timestamp)
    const firstOfSecond = auditTimestampValue(second.items[0]!.timestamp)
    expect(lastOfFirst).toBeGreaterThanOrEqual(firstOfSecond)
  })
})

describe('audit feed — filters', () => {
  it('by entity kind', () => {
    const batches = mockGetAuditFeed({ ...ALL, entityType: 'batch' }, { page: 1, pageSize: 100 })
    expect(batches.items.length).toBeGreaterThan(0)
    expect(batches.items.every((r) => r.entityType === 'batch')).toBe(true)
    expect(batches.total).toBeLessThan(everything().total)
  })

  it('by user, using the key the filter list hands out', () => {
    const users = mockGetAuditFeedUsers()
    expect(users.length).toBeGreaterThan(1)
    const someone = users[0]!
    const mine = mockGetAuditFeed({ ...ALL, user: someone.key }, { page: 1, pageSize: 1000 })
    expect(mine.items.length).toBeGreaterThan(0)
    expect(mine.items.every((r) => r.user.en === someone.key)).toBe(true)
  })

  it('by date range, inclusive on both ends', () => {
    const all = everything().items
    const day = all[Math.floor(all.length / 2)]!.timestamp.slice(0, 10)
    const onThatDay = mockGetAuditFeed(
      { ...ALL, dateFrom: day, dateTo: day },
      { page: 1, pageSize: 1000 },
    )
    expect(onThatDay.items.length).toBeGreaterThan(0)
    expect(onThatDay.items.every((r) => r.timestamp.slice(0, 10) === day)).toBe(true)
  })

  it('by search over property, old value, new value', () => {
    const sample = everything().items.find((r) => r.newValue.length > 3)!
    const found = mockGetAuditFeed(
      { ...ALL, search: sample.newValue.slice(0, 4) },
      { page: 1, pageSize: 1000 },
    )
    expect(found.items.length).toBeGreaterThan(0)
    expect(found.total).toBeLessThan(everything().total)
    expect(found.items.map(auditRowKey)).toContain(auditRowKey(sample))
  })
})

describe('audit feed — one source of truth', () => {
  it('a row deleted in the feed is gone from the entity card', async () => {
    const row = everything().items.find((r) => r.entityType === 'batch')!
    const before = await mockGetBatchAudit(row.entityId)
    expect(before.map((e) => e.id)).toContain(row.entryId)

    // Deletion goes to the entity's own endpoint — the one the card calls.
    await mockDeleteBatchAuditEntry(row.entityId, row.entryId)

    expect((await mockGetBatchAudit(row.entityId)).map((e) => e.id)).not.toContain(row.entryId)
    expect(everything().items.map(auditRowKey)).not.toContain(auditRowKey(row))
  })

  it('a row deleted on the card is gone from the feed', async () => {
    const product = (await mockGetProduct('prod-006'))!
    const target = product.auditLog[0]!
    const key = auditRowKey({ entityType: 'product', entityId: product.id, entryId: target.id })
    expect(everything().items.map(auditRowKey)).toContain(key)

    mockDeleteProductAuditEntry(product.id, target.id)

    expect(everything().items.map(auditRowKey)).not.toContain(key)
  })

  it('reading the feed cannot edit the logs it reads', async () => {
    const row = everything().items.find((r) => r.entityType === 'batch')!
    const before = await mockGetBatchAudit(row.entityId)
    const originalProperty = before.find((e) => e.id === row.entryId)!.property.en

    row.property.en = 'TAMPERED'
    row.oldValue = 'TAMPERED'

    const after = await mockGetBatchAudit(row.entityId)
    expect(after.find((e) => e.id === row.entryId)!.property.en).toBe(originalProperty)
  })
})

describe('audit feed — a row is named by three things', () => {
  it('the same entry id appears under different entities', () => {
    // This is the whole reason a row cannot be keyed by entryId: ids are unique
    // inside ONE log, so `bch-au-1` exists on every batch that has a history.
    const byEntry = new Map<string, AuditFeedRow[]>()
    for (const row of everything().items) {
      byEntry.set(row.entryId, [...(byEntry.get(row.entryId) ?? []), row])
    }
    const shared = [...byEntry.values()].find((rows) => rows.length > 1)!
    expect(shared.length).toBeGreaterThan(1)
    expect(new Set(shared.map((r) => `${r.entityType}:${r.entityId}`)).size).toBe(shared.length)

    // Named by all three, they are distinct.
    expect(new Set(shared.map(auditRowKey)).size).toBe(shared.length)
  })

  it('deleting one of two rows that share an entry id leaves the other alone', async () => {
    const rows = everything().items.filter((r) => r.entityType === 'batch')
    const first = rows[0]!
    const twin = rows.find((r) => r.entryId === first.entryId && r.entityId !== first.entityId)!
    expect(twin).toBeDefined()

    await mockDeleteBatchAuditEntry(first.entityId, first.entryId)

    const keys = everything().items.map(auditRowKey)
    expect(keys).not.toContain(auditRowKey(first))
    // The twin carries the SAME entryId and must be untouched.
    expect(keys).toContain(auditRowKey(twin))
    expect((await mockGetBatchAudit(twin.entityId)).map((e) => e.id)).toContain(twin.entryId)
  })

  it('every key in one page of the feed is unique', () => {
    const page = mockGetAuditFeed(ALL, { page: 1, pageSize: 100 })
    const keys = page.items.map(auditRowKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('optimistic removal is keyed by all three parts', () => {
  /** Two rows that share an entry id — the everyday case, not a contrived one. */
  function twins(): [AuditFeedRow, AuditFeedRow] {
    const rows = mockGetAuditFeed(ALL, { page: 1, pageSize: 10_000 }).items
    const byEntry = new Map<string, AuditFeedRow[]>()
    for (const row of rows) byEntry.set(row.entryId, [...(byEntry.get(row.entryId) ?? []), row])
    const pair = [...byEntry.values()].find((group) => group.length > 1)!
    return [pair[0]!, pair[1]!]
  }

  it('drops the row that was deleted and nothing else', () => {
    const [first, second] = twins()
    expect(first.entryId).toBe(second.entryId)

    const after = withoutRow([first, second], first)

    expect(after).toHaveLength(1)
    expect(auditRowKey(after[0]!)).toBe(auditRowKey(second))
  })

  it('keeps rows of the same entity that merely sit nearby', () => {
    const rows = mockGetAuditFeed(ALL, { page: 1, pageSize: 10_000 }).items
    const sameEntity = rows.filter(
      (r) => r.entityType === rows[0]!.entityType && r.entityId === rows[0]!.entityId,
    )
    if (sameEntity.length < 2) return

    const after = withoutRow(sameEntity, sameEntity[0]!)

    expect(after.map(auditRowKey)).toEqual(sameEntity.slice(1).map(auditRowKey))
  })
})
