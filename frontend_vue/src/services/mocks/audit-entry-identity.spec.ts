import { describe, it, expect } from 'vitest'
import { mockGetProduct, mockDeleteProductAuditEntry } from './products'
import { mockGetClient, mockDeleteClientAuditEntry, mockGetClientAudit } from './clients'
import { mockGetSupplier, mockDeleteAuditEntry } from './suppliers'
import {
  mockGetBatchAudit,
  mockDeleteBatchAuditEntry,
  mockGetStockAudit,
  mockDeleteStockAuditEntry,
  mockGetOffcutAudit,
  mockDeleteOffcutAuditEntry,
  mockGetMovementAudit,
  mockDeleteMovementAuditEntry,
  mockGetDeficitAudit,
  mockDeleteDeficitAuditEntry,
} from './warehouse'

/**
 * An audit record is named, never counted.
 *
 * A position always names *something*, so a stale one deletes whatever slid into
 * it — and it goes stale on the first deletion, without any concurrency at all.
 * The order card met this first (`OrderAuditEntry`); these are the other eight.
 *
 * The shape of every test below is the same, and it is the one that fails under
 * positional addressing: delete the FIRST entry, then delete the one that used
 * to be THIRD. Under indices the second call would carry a 2 that now points at
 * a different record, and the wrong one would disappear in silence.
 */

/** Delete the first, then the erstwhile third — by name. */
async function deleteFirstThenFormerThird(
  read: () => Promise<Array<{ id: string }>> | Array<{ id: string }>,
  remove: (entryId: string) => Promise<void> | void,
) {
  const before = await read()
  expect(before.length).toBeGreaterThanOrEqual(3)
  const [first, second, third] = before

  await remove(first!.id)
  await remove(third!.id)

  const after = await read()
  expect(after.map((e) => e.id)).toEqual([second!.id, ...before.slice(3).map((e) => e.id)])
  return after
}

describe('audit entries are addressed by id, not by position', () => {
  it('product: deleting the first then the former third removes exactly those two', async () => {
    const product = (await mockGetProduct('prod-004'))!
    expect(product.auditLog.length).toBeGreaterThanOrEqual(3)

    await deleteFirstThenFormerThird(
      async () => (await mockGetProduct('prod-004'))!.auditLog,
      (entryId) => mockDeleteProductAuditEntry('prod-004', entryId),
    )
  })

  it('client: the same, through its own endpoint', async () => {
    const client = mockGetClient('CL-001')!
    expect(client.auditLog?.length ?? 0).toBeGreaterThanOrEqual(3)

    await deleteFirstThenFormerThird(
      () => mockGetClientAudit('CL-001'),
      (entryId) => mockDeleteClientAuditEntry('CL-001', entryId),
    )
  })

  it('batch: the same', async () => {
    await deleteFirstThenFormerThird(
      () => mockGetBatchAudit('whb-001'),
      (entryId) => mockDeleteBatchAuditEntry('whb-001', entryId),
    )
  })

  it('stock: with four entries the wrong record would go silently', async () => {
    // Four is the length where positional addressing fails QUIETLY rather than
    // loudly: delete the first, and a stale "third" still points at something —
    // the fourth. With three entries it merely runs off the end and throws, which
    // is the same bug wearing a warning label.
    const before = await mockGetStockAudit('prod-001')
    expect(before.length).toBeGreaterThanOrEqual(4)

    await mockDeleteStockAuditEntry('prod-001', before[0]!.id)
    await mockDeleteStockAuditEntry('prod-001', before[2]!.id)

    const after = await mockGetStockAudit('prod-001')
    expect(after.map((e) => e.id)).toEqual([before[1]!.id, ...before.slice(3).map((e) => e.id)])
  })

  it('every entry in a seeded log carries a readable, unique id', async () => {
    const log = await mockGetBatchAudit('whb-025')
    expect(log.length).toBeGreaterThan(0)
    for (const entry of log) expect(entry.id).toMatch(/^bch-au-\d+$/)
    expect(new Set(log.map((e) => e.id)).size).toBe(log.length)
  })

  it('an unknown id is an error, not a silent no-op and not "delete the last"', async () => {
    const before = await mockGetBatchAudit('whb-077')
    await expect(mockDeleteBatchAuditEntry('whb-077', 'bch-au-9999')).rejects.toThrow(
      'AUDIT_ENTRY_NOT_FOUND',
    )
    // Nothing was removed in passing.
    expect((await mockGetBatchAudit('whb-077')).length).toBe(before.length)
  })

  it('a numeric position is not an id — it deletes nothing', async () => {
    const before = await mockGetBatchAudit('whb-077')
    if (before.length === 0) return
    await expect(mockDeleteBatchAuditEntry('whb-077', '0')).rejects.toThrow('AUDIT_ENTRY_NOT_FOUND')
    expect((await mockGetBatchAudit('whb-077')).length).toBe(before.length)
  })
})

describe('every one of the nine deletes by id', () => {
  it('supplier', async () => {
    const card = mockGetSupplier('1')
    const target = card.auditLog[0]!
    mockDeleteAuditEntry('1', target.id)
    expect(mockGetSupplier('1').auditLog.map((e) => e.id)).not.toContain(target.id)
  })

  it('stock, offcut, movement and deficit', async () => {
    const stock = await mockGetStockAudit('prod-002')
    if (stock.length) {
      await mockDeleteStockAuditEntry('prod-002', stock[0]!.id)
      expect((await mockGetStockAudit('prod-002')).map((e) => e.id)).not.toContain(stock[0]!.id)
    }

    const offcut = await mockGetOffcutAudit('who-001')
    if (offcut.length) {
      await mockDeleteOffcutAuditEntry('who-001', offcut[0]!.id)
      expect((await mockGetOffcutAudit('who-001')).map((e) => e.id)).not.toContain(offcut[0]!.id)
    }

    const movement = await mockGetMovementAudit('whm-001')
    if (movement.length) {
      await mockDeleteMovementAuditEntry('whm-001', movement[0]!.id)
      expect((await mockGetMovementAudit('whm-001')).map((e) => e.id)).not.toContain(
        movement[0]!.id,
      )
    }

    const deficit = await mockGetDeficitAudit('whd-001')
    if (deficit.length) {
      await mockDeleteDeficitAuditEntry('whd-001', deficit[0]!.id)
      expect((await mockGetDeficitAudit('whd-001')).map((e) => e.id)).not.toContain(deficit[0]!.id)
    }
  })
})
