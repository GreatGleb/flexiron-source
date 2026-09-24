import { describe, it, expect } from 'vitest'
import { mockGetOrder, mockDeleteOrder, mockReserveOrder, mockGetReservations } from './orders'
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
import { mockGetClientAudit } from './clients'
import { mockUpdateSupplierStatus, MOCK_SUPPLIERS } from './suppliers'
import { findReservations } from './reservations'
import type { ApiRequestError } from '@/types/api'

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
 * "the error was handled". The SHAPE of the refusal is `ApiRequestError`
 * everywhere in the mocks now — these assertions name the code, which is what
 * would survive a future change to the envelope.
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
    await expect(mockGetStockAudit(UNKNOWN)).rejects.toMatchObject({
      code: 'STOCK_NOT_FOUND',
      status: 404,
    })
    await expect(mockGetBatchAudit(UNKNOWN)).rejects.toMatchObject({
      code: 'BATCH_NOT_FOUND',
      status: 404,
    })
    await expect(mockGetOffcutAudit(UNKNOWN)).rejects.toMatchObject({
      code: 'OFFCUT_NOT_FOUND',
      status: 404,
    })
    await expect(mockGetDeficitAudit(UNKNOWN)).rejects.toMatchObject({
      code: 'DEFICIT_NOT_FOUND',
      status: 404,
    })
    // The movement log had no "no such movement" code at all: an unknown id got an
    // empty log invented for it, and the paired delete then blamed the entry.
    await expect(mockGetMovementAudit(UNKNOWN)).rejects.toMatchObject({
      code: 'MOVEMENT_NOT_FOUND',
      status: 404,
    })
    await expect(mockGetBatchAggregates(UNKNOWN)).rejects.toMatchObject({
      code: 'BATCH_NOT_FOUND',
      status: 404,
    })
    await expect(mockGetBatchActiveSales(UNKNOWN)).rejects.toMatchObject({
      code: 'BATCH_NOT_FOUND',
      status: 404,
    })
  })

  it('orders: reservations refuse an unknown order the same way reserving one does', () => {
    let reserveRefusal: ApiRequestError | undefined
    try {
      mockReserveOrder(UNKNOWN)
    } catch (e) {
      reserveRefusal = e as ApiRequestError
    }
    expect(reserveRefusal?.code).toBe('ORDER_NOT_FOUND')

    let reservationsRefusal: ApiRequestError | undefined
    try {
      mockGetReservations({ orderId: UNKNOWN })
    } catch (e) {
      reservationsRefusal = e as ApiRequestError
    }
    expect(reservationsRefusal?.code).toBe(reserveRefusal?.code)
    expect(reservationsRefusal?.status).toBe(reserveRefusal?.status)

    // Filtering by batchId only — no orderId given — is not a lookup of an order
    // and must keep working.
    expect(() => mockGetReservations({ batchId: 'no-such-batch' })).not.toThrow()
  })

  it('clients: the audit log of an unknown client is refused, not returned empty', () => {
    expect(() => mockGetClientAudit(UNKNOWN)).toThrow('CLIENT_NOT_FOUND')
    // A known client's log still comes back.
    expect(mockGetClientAudit('CL-001').length).toBeGreaterThan(0)
  })

  it('suppliers: a status change on an unknown supplier is refused, not a silent no-op', () => {
    let refusal: ApiRequestError | undefined
    try {
      mockUpdateSupplierStatus(UNKNOWN, 'active')
    } catch (e) {
      refusal = e as ApiRequestError
    }
    expect(refusal?.code).toBe('SUPPLIER_NOT_FOUND')
    // A known supplier's status still changes.
    mockUpdateSupplierStatus('2', 'active')
    expect(MOCK_SUPPLIERS.find((s) => s.id === '2')?.status).toBe('active')
  })

  it('reservations: an empty string in a filter field means "this id", not "no filter"', () => {
    const all = findReservations()
    expect(all.length).toBeGreaterThan(0)
    expect(findReservations({ orderId: '' })).toEqual([])
    expect(findReservations({ batchId: '' })).toEqual([])
    expect(findReservations({ lineId: '' })).toEqual([])
  })
})
