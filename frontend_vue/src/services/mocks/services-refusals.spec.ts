import { describe, it, expect } from 'vitest'
import { ApiRequestError } from '@/types/api'
import { mockCreateService, mockPatchService, mockGetService } from '@/services/mocks/services'

/**
 * Отказы каталога услуг несут код и статус полями `ApiRequestError`, а не текстом
 * (§2 соглашений, `roo_code/roo-context/api/00-conventions.md:80-85`). Голый
 * `throw new Error(<код>)` проходил бы `servicePricing.spec.ts` (тот ловит по тексту), но
 * эту спеку красит: `code`/`status` у обычного `Error` нет.
 */

describe('отказы каталога услуг несут code и status', () => {
  it('SERVICE_CURRENCY_NOT_FOUND — создание, 422', async () => {
    await expect(
      mockCreateService({
        name: 'x',
        costPrice: 1,
        sellingPrice: 2,
        currencyId: 'cur-nope',
        uomId: 'uom-pcs',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_CURRENCY_NOT_FOUND',
      status: 422,
    } satisfies Partial<ApiRequestError>)
  })

  it('SERVICE_UOM_NOT_FOUND — создание, 422', async () => {
    await expect(
      mockCreateService({
        name: 'x',
        costPrice: 1,
        sellingPrice: 2,
        currencyId: 'cur-eur',
        uomId: 'uom-nope',
      }),
    ).rejects.toMatchObject({
      code: 'SERVICE_UOM_NOT_FOUND',
      status: 422,
    } satisfies Partial<ApiRequestError>)
  })

  it('CATALOG_SERVICE_NOT_FOUND — чтение, 404', async () => {
    await expect(mockGetService('svc-does-not-exist')).rejects.toMatchObject({
      code: 'CATALOG_SERVICE_NOT_FOUND',
      status: 404,
    } satisfies Partial<ApiRequestError>)
  })

  it('CATALOG_SERVICE_NOT_FOUND — правка, 404', async () => {
    await expect(mockPatchService('svc-does-not-exist', { costPrice: 5 })).rejects.toMatchObject({
      code: 'CATALOG_SERVICE_NOT_FOUND',
      status: 404,
    } satisfies Partial<ApiRequestError>)
  })

  it('каждый отказ — экземпляр ApiRequestError, а не голый Error', async () => {
    let caught: unknown
    try {
      await mockGetService('svc-does-not-exist')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ApiRequestError)
  })
})
