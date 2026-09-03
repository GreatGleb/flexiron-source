import { describe, it, expect } from 'vitest'
import { getOffcutOffers } from '@/services/warehouseService'
import { mockGetOffcuts } from './warehouse'

/**
 * Л3: у каждого вызванного маршрута есть мок (питфолл #40). Спрашивается именно через
 * сервисный слой, а не напрямую функцию мока: `/offcuts/offers` подходит под шаблон
 * карточки обрезка `/offcuts/:id`, и порядок проверок в диспетчере — это то, что здесь
 * доказывается.
 */
describe('GET /api/warehouse/offcuts/offers', () => {
  it('доходит до мока, а не до карточки обрезка', async () => {
    const offcuts = (await mockGetOffcuts({ search: '' }, { page: 1, pageSize: 1000 })).items
    const withOffers = offcuts.find((o) => o.status === 'available')!
    expect(withOffers).toBeDefined()

    const offers = await getOffcutOffers(withOffers.productId)
    expect(Array.isArray(offers)).toBe(true)
    expect(offers.map((o) => o.id)).toContain(withOffers.id)
  })

  it('на неизвестный товар отвечает пустым списком, а не ошибкой карточки', async () => {
    await expect(getOffcutOffers('prod-does-not-exist')).resolves.toEqual([])
  })
})
