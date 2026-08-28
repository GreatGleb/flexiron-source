import { describe, it, expect } from 'vitest'
import {
  batchById,
  mockCreateOffcut,
  mockFifoAllocation,
  mockGetMovementsFor,
  mockGetOffcut,
  mockGetOffcutOffers,
  mockGetOffcuts,
  mockOffcutAllocations,
  mockPatchOffcut,
} from './warehouse'
import {
  mockAddOrderItem,
  mockCancelShipment,
  mockCreateOrder,
  mockCreateShipment,
  mockDeleteOrderItem,
  mockGetOrder,
  mockPlanOrderShipment,
  mockReserveOrder,
} from './orders'
import { mockGetClients } from './clients'
import { resolveOffcutMaterial } from '@/domain/cutting'
import { round2 } from '@/domain/orderPricing'
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

/**
 * Вторая половина пункта 7: выбранный кусок должен ПРОДАВАТЬСЯ.
 *
 * Требование ТЗ (Process 4.5) — «обрезки становятся доступны для продажи другим
 * менеджерам». Выбрать кусок и не суметь его отгрузить значит запереть его вне рынка
 * навсегда: из предложений он ушёл, а со строки не уезжает. Поэтому здесь проверяется не
 * «отгрузка не упала», а что уехал именно кусок и что партия-родитель при этом устояла.
 */
describe('отгрузка строки, покрытой обрезком', () => {
  /** Запас партии сверх куска — чтобы смешанной строке было чем добрать остаток. */
  const TAIL = 5

  /**
   * Свежий кусок, отрезанный специально под один тест.
   *
   * Кусок одноразов: тест, который его продал, забрал его у всех следующих, а в сидах
   * кусков конечное число — на весь этот describe их не хватает, и тогда порядок тестов
   * решал бы, какой из них упадёт. Поэтому каждый тест режет себе свой: из настоящей
   * партии и настоящей формы, скопированной с сидового куска.
   *
   * Форма выбирается по СЧИТАННОМУ материалу, а не наугад. Количество строки округляется
   * до двух знаков (`round2`), материал куска — нет: лист 0.405 м² даёт строку 0.41, и
   * покрыт куском она будет не целиком. Тестам ниже нужна строка ровно в кусок, поэтому
   * берётся форма, у которой «ровно» выразимо. Материал считает та же функция, что
   * считает его склад, — второй формулы здесь не заводится.
   */
  async function wholeOffer(): Promise<OffcutOffer> {
    const rows = (await mockGetOffcuts({ search: '' }, ALL)).items
    for (const row of rows) {
      // Полная запись, а не строка списка: в списке нет толщины, а без неё материал
      // куска из партии в килограммах не выражается вовсе.
      const shape = await mockGetOffcut(row.id)
      const batch = batchById(shape.batchId)
      if (!batch) continue
      const material = resolveOffcutMaterial(shape, batch.uomId)
      if (!material.ok) continue
      if (round2(material.material) !== material.material) continue
      if (material.material + TAIL > batch.quantityRemaining) continue
      const created = await mockCreateOffcut({
        batchId: shape.batchId,
        offcutType: shape.offcutType,
        lengthMm: shape.lengthMm,
        widthMm: shape.widthMm,
        thicknessMm: shape.thicknessMm,
        // Партия в килограммах считает материал куска по ВЕСУ, а не по геометрии:
        // без него у скопированной формы нет размера вовсе.
        weightKg: shape.weightKg,
        quantity: shape.quantity,
        uomId: shape.uomId,
        location: shape.location,
      })
      const offer = mockGetOffcutOffers(created.productId).find((o) => o.id === created.id)
      if (offer) return offer
    }
    throw new Error('не из чего отрезать кусок под тест: подходящей партии нет')
  }

  /** Заказ со строкой ровно в размер куска: партий в разбивке нет вовсе. */
  async function lineCoveredByPiece() {
    const offer = await wholeOffer()
    const orderId = freshOrder()
    const line = mockAddOrderItem(orderId, {
      productId: offer.productId,
      quantity: offer.material,
      unit: 'pcs',
      unitPrice: 100,
      offcutIds: [offer.id],
    })
    expect(line.allocations.map((a) => a.offcutId)).toEqual([offer.id])
    return { offer, orderId, line }
  }

  it('кусок уезжает, а партия-родитель второй раз не списывается', async () => {
    const { offer, orderId, line } = await lineCoveredByPiece()
    const parentBefore = batchById(offer.batchId)!.quantityRemaining

    const planned = mockPlanOrderShipment(orderId).find((l) => l.lineId === line.id)!
    expect(planned.shippable).toBe(offer.material)

    const shipment = mockCreateShipment(orderId, {
      lines: [{ lineId: line.id, quantity: offer.material }],
    })

    expect(mockGetOrder(orderId)!.items.find((i) => i.id === line.id)!.shippedQuantity).toBe(
      offer.material,
    )
    // Кусок ушёл с полки — и знает об этом сам, а не только заказ.
    expect((await mockGetOffcut(offer.id)).status).toBe('sold')
    // Движение записано против родительской партии (без неё у движения нет ни номера,
    // ни единицы, ни цены) и названо куском.
    const sales = mockGetMovementsFor('order-shipment', shipment.id).filter(
      (m) => m.type === 'sale',
    )
    expect(sales.map((m) => [m.offcutId, m.batchId, m.quantity])).toEqual([
      [offer.id, offer.batchId, offer.material],
    ])
    // И главное: металл куска ушёл с партии ещё при резке, поэтому остаток партии стоит.
    expect(batchById(offer.batchId)!.quantityRemaining).toBe(parentBefore)
  })

  it('смешанная строка увозит и кусок, и партию — обещанное планом количество', async () => {
    const offer = await wholeOffer()
    const orderId = freshOrder()
    const quantity = round2(offer.material + TAIL)
    const line = mockAddOrderItem(orderId, {
      productId: offer.productId,
      quantity,
      unit: 'pcs',
      unitPrice: 100,
      offcutIds: [offer.id],
    })
    const fromBatches = line.allocations.filter((a) => a.batchId !== null)
    expect(fromBatches.length).toBeGreaterThan(0)

    // План и запись — одна машина: диалог не имеет права предложить количество, которое
    // списание потом отклонит. Именно это и ломалось: план обещал партийную половину,
    // а запись отказывала всей строке.
    const planned = mockPlanOrderShipment(orderId).find((l) => l.lineId === line.id)!
    expect(planned.shippable).toBe(quantity)

    const shipment = mockCreateShipment(orderId, {
      lines: [{ lineId: line.id, quantity: planned.shippable }],
    })
    const sales = mockGetMovementsFor('order-shipment', shipment.id).filter(
      (m) => m.type === 'sale',
    )
    // Уехало ровно то, что обещано, и кусок среди уехавшего ровно один.
    expect(round2(sales.reduce((sum, m) => sum + m.quantity, 0))).toBe(quantity)
    expect(sales.filter((m) => m.offcutId === offer.id).length).toBe(1)
    expect(sales.filter((m) => m.batchId !== null && m.offcutId === null).length).toBe(
      fromBatches.length,
    )
  })

  it('на погрузке кусок не режут: половина строки не уедет', async () => {
    const { offer, orderId, line } = await lineCoveredByPiece()
    const half = Math.round((offer.material / 2) * 100) / 100
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(offer.material)

    expect(() =>
      mockCreateShipment(orderId, { lines: [{ lineId: line.id, quantity: half }] }),
    ).toThrow('SHIPMENT_EXCEEDS_STOCK')
    // Отказ ничего не увёз и куска не тронул.
    expect(mockGetOrder(orderId)!.items.find((i) => i.id === line.id)!.shippedQuantity).toBe(0)
    expect((await mockGetOffcut(offer.id)).status).toBe('available')
  })

  it('куска нет на полке — строка не отгружается, а не отгружается пустотой', async () => {
    const { offer, orderId, line } = await lineCoveredByPiece()
    // Кладовщик отправил кусок в утиль между выбором и приездом машины.
    await mockPatchOffcut(offer.id, { status: 'scrapped' })

    const planned = mockPlanOrderShipment(orderId).find((l) => l.lineId === line.id)!
    expect(planned.shippable).toBe(0)
    expect(() =>
      mockCreateShipment(orderId, { lines: [{ lineId: line.id, quantity: offer.material }] }),
    ).toThrow('SHIPMENT_EXCEEDS_STOCK')
  })

  it('отменённая отгрузка кладёт кусок обратно на полку', async () => {
    const { offer, orderId, line } = await lineCoveredByPiece()
    const shipment = mockCreateShipment(orderId, {
      lines: [{ lineId: line.id, quantity: offer.material }],
    })
    expect((await mockGetOffcut(offer.id)).status).toBe('sold')

    mockCancelShipment(orderId, shipment.id)

    expect((await mockGetOffcut(offer.id)).status).toBe('available')
    expect(mockGetOrder(orderId)!.items.find((i) => i.id === line.id)!.shippedQuantity).toBe(0)
    // Вернулся не только статус: строку снова можно отгрузить тем же куском.
    expect(mockPlanOrderShipment(orderId).find((l) => l.lineId === line.id)!.shippable).toBe(
      offer.material,
    )
  })
})
