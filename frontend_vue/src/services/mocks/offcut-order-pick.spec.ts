import { describe, it, expect } from 'vitest'
import {
  mockFifoAllocation,
  mockGetOffcutOffers,
  mockGetOffcuts,
  mockOffcutAllocations,
} from './warehouse'
import {
  mockAddOrderItem,
  mockCreateOrder,
  mockDeleteOrderItem,
  mockGetOrder,
  mockReserveOrder,
} from './orders'
import { mockGetClients } from './clients'
import type { OffcutOffer } from '@/types/warehouse'

/**
 * Пункт 7 плана `review-followups.md`: обрезок стало возможно назвать в строке заказа.
 *
 * Проверяется не «экран отрисовался», а решение, которое пункт принял: обрезки в
 * автоматический FIFO не попадают, а попадают в строку ТОЛЬКО выбором руками — и
 * выбранный кусок доходит до аллокации, а не теряется по дороге.
 */

const ALL = { page: 1, pageSize: 1000 }

/** Первый товар, у которого вообще есть свободный обрезок. Данные не зашиты. */
async function firstOffer(): Promise<OffcutOffer> {
  const offcuts = (await mockGetOffcuts({ search: '' }, ALL)).items
  for (const offcut of offcuts) {
    const offers = mockGetOffcutOffers(offcut.productId)
    const found = offers.find((o) => o.id === offcut.id)
    if (found) return found
  }
  throw new Error('в сидах нет ни одного свободного обрезка — проверять нечего')
}

function freshOrder(): string {
  const client = mockGetClients()[0]!
  return mockCreateOrder({ clientId: client.id, documentType: 'local' }).id
}

describe('обрезок в строке заказа', () => {
  it('предлагает только свободные куски своего товара', async () => {
    const offer = await firstOffer()
    const offers = mockGetOffcutOffers(offer.productId)
    const all = (await mockGetOffcuts({ search: '' }, ALL)).items

    expect(offers.length).toBeGreaterThan(0)
    const wrong = offers
      .map((o) => all.find((row) => row.id === o.id)!)
      .filter((row) => row.productId !== offer.productId || row.status !== 'available')
      .map((row) => `${row.id}: ${row.productId}/${row.status}`)
    expect(wrong).toEqual([])

    // И обратное: свободный кусок этого товара не пропущен. Без этой половины
    // утверждение выше устраивал бы пустой список (питфолл #68).
    //
    // Равенство снимается ПЕРВЫМ в файле и только поэтому обходится без вычитания
    // занятого: куски в заказы берут тесты ниже, а сиды не берут ни одного. Правило
    // «занятый кусок не предлагается» проверяет следующий тест, а не этот.
    const expected = all
      .filter((row) => row.productId === offer.productId && row.status === 'available')
      .map((row) => row.id)
      .sort()
    expect(offers.map((o) => o.id).sort()).toEqual(expected)
  })

  it('взятый в строку кусок уходит из предложений — и уходит ровно он один', async () => {
    const offer = await firstOffer()
    const before = mockGetOffcutOffers(offer.productId)
      .map((o) => o.id)
      .sort()
    expect(before).toContain(offer.id)

    const orderId = freshOrder()
    mockAddOrderItem(orderId, {
      productId: offer.productId,
      quantity: Math.round((offer.material + 5) * 100) / 100,
      unit: 'pcs',
      unitPrice: 100,
      offcutIds: [offer.id],
    })

    const after = mockGetOffcutOffers(offer.productId)
      .map((o) => o.id)
      .sort()
    // Ровно один ушёл, и ровно тот. Утверждение «не содержит» устроил бы и пустой
    // список, то есть правило, выкосившее заодно чужие куски (питфолл #68).
    expect(after).toEqual(before.filter((id) => id !== offer.id))
  })

  it('второй заказ тот же кусок взять не может', async () => {
    const offer = await firstOffer()
    const quantity = Math.round((offer.material + 5) * 100) / 100
    const first = freshOrder()
    mockAddOrderItem(first, {
      productId: offer.productId,
      quantity,
      unit: 'pcs',
      unitPrice: 100,
      offcutIds: [offer.id],
    })

    const second = freshOrder()
    expect(() =>
      mockAddOrderItem(second, {
        productId: offer.productId,
        quantity,
        unit: 'pcs',
        unitPrice: 100,
        offcutIds: [offer.id],
      }),
    ).toThrow('OFFCUT_NOT_AVAILABLE')
    // Отказ ничего не оставил после себя: строки, покрытой чужим куском, нет.
    expect(mockGetOrder(second)!.items).toEqual([])
  })

  it('удалённая строка возвращает кусок в продажу', async () => {
    const offer = await firstOffer()
    const orderId = freshOrder()
    const line = mockAddOrderItem(orderId, {
      productId: offer.productId,
      quantity: Math.round((offer.material + 5) * 100) / 100,
      unit: 'pcs',
      unitPrice: 100,
      offcutIds: [offer.id],
    })
    expect(mockGetOffcutOffers(offer.productId).some((o) => o.id === offer.id)).toBe(false)

    mockDeleteOrderItem(orderId, line.id)

    // Занятость выводится из того, кто на куске стоит, поэтому отдельного
    // «освободить кусок» нет и забыть его негде.
    expect(mockGetOffcutOffers(offer.productId).some((o) => o.id === offer.id)).toBe(true)
  })

  it('в автоматический FIFO обрезки не попадают', async () => {
    const offer = await firstOffer()
    // Заведомо больше, чем лежит на полке: FIFO раздаст всё, что у него есть.
    const fifo = mockFifoAllocation(offer.productId, 1_000_000)

    expect(fifo.allocations.length).toBeGreaterThan(0)
    expect(fifo.allocations.filter((a) => a.offcutId !== null)).toEqual([])
  })

  it('выбранный кусок становится аллокацией строки, а остальное добирает FIFO', async () => {
    const offer = await firstOffer()
    const orderId = freshOrder()
    const quantity = Math.round((offer.material + 5) * 100) / 100

    const line = mockAddOrderItem(orderId, {
      productId: offer.productId,
      quantity,
      unit: 'pcs',
      unitPrice: 100,
      offcutIds: [offer.id],
    })

    const stored = mockGetOrder(orderId)!.items.find((i) => i.id === line.id)!
    const fromOffcut = stored.allocations.filter((a) => a.offcutId === offer.id)
    expect(fromOffcut.length).toBe(1)
    expect(fromOffcut[0]!.quantity).toBe(offer.material)
    expect(fromOffcut[0]!.unitCost).toBe(offer.unitCost)
    // Партии здесь нет намеренно: материал куска ушёл с неё в момент резки, и
    // названная партия вычла бы его второй раз.
    expect(fromOffcut[0]!.batchId).toBeNull()
    // Кусок стоит первым — его выбрали руками, и подменять его партией нельзя.
    expect(stored.allocations[0]!.offcutId).toBe(offer.id)
    // Остаток строки добрал FIFO из партий.
    expect(stored.allocations.some((a) => a.batchId !== null)).toBe(true)
  })

  it('отказывает, когда выбранные куски не помещаются в количество строки', async () => {
    const offer = await firstOffer()
    const orderId = freshOrder()
    const tooSmall = Math.round((offer.material / 2) * 100) / 100
    expect(tooSmall).toBeGreaterThan(0)
    expect(tooSmall).toBeLessThan(offer.material)

    expect(() =>
      mockAddOrderItem(orderId, {
        productId: offer.productId,
        quantity: tooSmall,
        unit: 'pcs',
        unitPrice: 100,
        offcutIds: [offer.id],
      }),
    ).toThrow('OFFCUTS_EXCEED_QUANTITY')
    // Отказ ничего не оставил после себя.
    expect(mockGetOrder(orderId)!.items).toEqual([])
  })

  it('отказывает куску чужого товара и куску, которого нет', async () => {
    const offer = await firstOffer()
    const foreign = (await mockGetOffcuts({ search: '' }, ALL)).items.find(
      (o) => o.productId !== offer.productId,
    )!
    expect(foreign).toBeDefined()

    expect(() => mockOffcutAllocations(offer.productId, [foreign.id])).toThrow(
      'OFFCUT_PRODUCT_MISMATCH',
    )
    expect(() => mockOffcutAllocations(offer.productId, ['who-does-not-exist'])).toThrow(
      'OFFCUT_NOT_FOUND',
    )
  })

  it('резервирование держит именно этот кусок, а не его партию', async () => {
    const offer = await firstOffer()
    const orderId = freshOrder()
    const quantity = Math.round((offer.material + 5) * 100) / 100
    const line = mockAddOrderItem(orderId, {
      productId: offer.productId,
      quantity,
      unit: 'pcs',
      unitPrice: 100,
      offcutIds: [offer.id],
    })

    const held = mockReserveOrder(orderId).filter((r) => r.lineId === line.id)
    const onOffcut = held.filter((r) => r.offcutId === offer.id)
    expect(onOffcut.length).toBe(1)
    expect(onOffcut[0]!.batchId).toBeNull()
    expect(onOffcut[0]!.quantity).toBe(offer.material)
  })
})
