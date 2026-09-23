import { describe, it, expect } from 'vitest'
import { ApiRequestError } from '@/types/api'
import { mockGetProduct, mockPatchProduct, mockDeleteProductAuditEntry } from './products'
import { mockGetSupplier, mockDeleteAuditEntry } from './suppliers'

const UNKNOWN = 'no-such-id-ever'

/**
 * §2 of the conventions: a refusal carries a code, not text — the code belongs
 * in `ApiRequestError.code`, the field the real server fills, not in `message`
 * where a bare `Error` used to hide it. These seven throws were the last ones
 * in products/suppliers still shaped as a bare `Error`; this spec pins the
 * `code`/`status` shape so a regression back to `throw new Error(...)` is red.
 */
describe('products and suppliers refusals carry a machine code, not just text', () => {
  it('mockGetProduct: unknown id refuses with PRODUCT_NOT_FOUND / 404', async () => {
    await expect(mockGetProduct(UNKNOWN)).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      status: 404,
    })
    await expect(mockGetProduct(UNKNOWN)).rejects.toBeInstanceOf(ApiRequestError)
  })

  it('mockPatchProduct: unknown id refuses with PRODUCT_NOT_FOUND / 404', async () => {
    await expect(mockPatchProduct(UNKNOWN, { sku: 'x' })).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      status: 404,
    })
    await expect(mockPatchProduct(UNKNOWN, { sku: 'x' })).rejects.toBeInstanceOf(ApiRequestError)
  })

  it('mockDeleteProductAuditEntry: unknown product refuses with PRODUCT_NOT_FOUND / 404', () => {
    try {
      mockDeleteProductAuditEntry(UNKNOWN, 'entry-1')
      throw new Error('expected mockDeleteProductAuditEntry to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiRequestError)
      expect((e as ApiRequestError).code).toBe('PRODUCT_NOT_FOUND')
      expect((e as ApiRequestError).status).toBe(404)
    }
  })

  it('mockDeleteProductAuditEntry: unknown entry refuses with AUDIT_ENTRY_NOT_FOUND / 404', () => {
    try {
      mockDeleteProductAuditEntry('prod-001', UNKNOWN)
      throw new Error('expected mockDeleteProductAuditEntry to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiRequestError)
      expect((e as ApiRequestError).code).toBe('AUDIT_ENTRY_NOT_FOUND')
      expect((e as ApiRequestError).status).toBe(404)
    }
  })

  it('mockGetSupplier: unknown id refuses with SUPPLIER_NOT_FOUND / 404', () => {
    try {
      mockGetSupplier(UNKNOWN)
      throw new Error('expected mockGetSupplier to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiRequestError)
      expect((e as ApiRequestError).code).toBe('SUPPLIER_NOT_FOUND')
      expect((e as ApiRequestError).status).toBe(404)
    }
  })

  it('mockDeleteAuditEntry: unknown supplier refuses with SUPPLIER_NOT_FOUND / 404', () => {
    try {
      mockDeleteAuditEntry(UNKNOWN, 'entry-1')
      throw new Error('expected mockDeleteAuditEntry to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiRequestError)
      expect((e as ApiRequestError).code).toBe('SUPPLIER_NOT_FOUND')
      expect((e as ApiRequestError).status).toBe(404)
    }
  })

  it('mockDeleteAuditEntry: unknown entry refuses with AUDIT_ENTRY_NOT_FOUND / 404', () => {
    try {
      mockDeleteAuditEntry('1', UNKNOWN)
      throw new Error('expected mockDeleteAuditEntry to throw')
    } catch (e) {
      expect(e).toBeInstanceOf(ApiRequestError)
      expect((e as ApiRequestError).code).toBe('AUDIT_ENTRY_NOT_FOUND')
      expect((e as ApiRequestError).status).toBe(404)
    }
  })
})
