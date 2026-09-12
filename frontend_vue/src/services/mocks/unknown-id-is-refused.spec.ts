import { describe, it, expect } from 'vitest'
import { mockGetOrder, mockDeleteOrder } from './orders'
import { mockPatchCategory, mockPutCategoryFields } from './categories'
import { mockPatchProduct } from './products'
import { mockUpdateField, mockUpdateSection } from './config'
import { mockAcceptResponse, mockMarkNoResponse } from './bcc'
import { mockMarkAsRead } from './notifications'
import {
  mockGetStockAudit,
  mockGetBatchAudit,
  mockGetOffcutAudit,
  mockGetMovementAudit,
  mockGetDeficitAudit,
  mockGetBatchAggregates,
  mockGetBatchActiveSales,
} from './warehouse'

/**
 * An id nobody knows is a refusal — in every domain, on reads as well as writes.
 *
 * Eight mocks used to answer it with `undefined`, `null` or a plain success. Each
 * of those is an undeclared error code: the mock router hands the empty value on
 * as a SUCCESSFUL response, the caller's signature promises an entity, and the
 * client dereferences it. What reached the user was a TypeError nobody could name
 * — or worse, a "saved" toast over an edit that went nowhere.
 *
 * The point of this file is that the error path exists at all. A branch with no
 * `throw` is a branch no test can reach: green meant "there was no error", not
 * "the error was handled". The SHAPE of the refusal (bare `Error` today,
 * `ApiRequestError` once the mock moves to the common envelope) is a separate
 * job — these assertions name the code, which survives that move.
 */

const UNKNOWN = 'no-such-id-ever'

describe('an unknown id is refused, not answered with emptiness', () => {
  it('orders: reading and deleting both answer ORDER_NOT_FOUND', () => {
    expect(() => mockGetOrder(UNKNOWN)).toThrow('ORDER_NOT_FOUND')
    // The delete refuses BEFORE it looks at the version: a stale request against
    // an order somebody else has already removed is a miss, not a conflict.
    expect(() => mockDeleteOrder(UNKNOWN)).toThrow('ORDER_NOT_FOUND')
    expect(() => mockDeleteOrder(UNKNOWN, 7)).toThrow('ORDER_NOT_FOUND')
  })

  it('categories: PATCH and PUT answer the code their own delete already used', () => {
    expect(() => mockPatchCategory(UNKNOWN, { description: null })).toThrow('CATEGORY_NOT_FOUND')
    expect(() => mockPutCategoryFields(UNKNOWN, [])).toThrow('CATEGORY_NOT_FOUND')
  })

  it('products: PATCH answers PRODUCT_NOT_FOUND', async () => {
    await expect(mockPatchProduct(UNKNOWN, { sku: 'x' })).rejects.toThrow('PRODUCT_NOT_FOUND')
  })

  it('config: the field and the section each get a code of their own', () => {
    expect(() => mockUpdateField(UNKNOWN, { required: true })).toThrow('FIELD_NOT_FOUND')
    expect(() => mockUpdateSection(UNKNOWN, { collapsed: true })).toThrow('SECTION_NOT_FOUND')
    // Neither code contains the other, so a caller matching on the code cannot
    // confuse them — §2 of the contract conventions.
    expect('FIELD_NOT_FOUND'.includes('SECTION_NOT_FOUND')).toBe(false)
    expect('SECTION_NOT_FOUND'.includes('FIELD_NOT_FOUND')).toBe(false)
  })

  it('bcc: an unknown event is refused instead of landing in the feed as null', () => {
    expect(() => mockAcceptResponse(UNKNOWN, { price: 1, unit: 'kg' })).toThrow(
      'BCC_EVENT_NOT_FOUND',
    )
    expect(() => mockMarkNoResponse(UNKNOWN)).toThrow('BCC_EVENT_NOT_FOUND')
  })

  it('notifications: marking a record nobody has is refused, not silently fine', () => {
    expect(() => mockMarkAsRead(UNKNOWN)).toThrow('NOTIFICATION_NOT_FOUND')
  })

  it('warehouse: the five logs and both aggregates refuse what their deletes refuse', async () => {
    await expect(mockGetStockAudit(UNKNOWN)).rejects.toThrow('STOCK_NOT_FOUND')
    await expect(mockGetBatchAudit(UNKNOWN)).rejects.toThrow('BATCH_NOT_FOUND')
    await expect(mockGetOffcutAudit(UNKNOWN)).rejects.toThrow('OFFCUT_NOT_FOUND')
    await expect(mockGetDeficitAudit(UNKNOWN)).rejects.toThrow('DEFICIT_NOT_FOUND')
    // The movement log had no "no such movement" code at all: an unknown id got an
    // empty log invented for it, and the paired delete then blamed the entry.
    await expect(mockGetMovementAudit(UNKNOWN)).rejects.toThrow('MOVEMENT_NOT_FOUND')
    await expect(mockGetBatchAggregates(UNKNOWN)).rejects.toThrow('BATCH_NOT_FOUND')
    await expect(mockGetBatchActiveSales(UNKNOWN)).rejects.toThrow('BATCH_NOT_FOUND')
  })
})
