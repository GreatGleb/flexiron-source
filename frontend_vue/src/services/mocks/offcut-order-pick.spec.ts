import { describe, it, expect } from 'vitest'
import {
  batchById,
  mockCreateOffcut,
  mockGetMovements,
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
  mockCreateReturn,
  mockCreateShipment,
  mockDeleteOrderItem,
  mockGetOrder,
  mockPlanOrderShipment,
  mockReserveOrder,
  mockUpdateOrderItem,
} from './orders'
import { splitsWholePiece } from '@/services/orderLines'
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

/** Запас партии сверх куска — чтобы смешанной строке было чем добрать остаток. */
const TAIL = 5

/**
 * Свежий кусок, отрезанный специально под один тест.
 *
 * Кусок одноразов: тест, который его продал, забрал его у всех следующих, а в сидах
 * кусков конечное число — на все тесты отгрузки и возврата их не хватает, и тогда
 * порядок тестов решал бы, какой из них упадёт. Поэтому каждый тест режет себе свой:
 * из настоящей партии и настоящей формы, скопированной с сидового куска.
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
describe('металл куска ушёл с партии ровно один раз', () => {
  /**
   * ПОСЫЛКА правила `movesOffcut`, проверенная на данных, а не принятая на слово.
   *
   * Правило говорит: движение, назвавшее кусок, партию не двигает, потому что кусок
   * ушёл с неё раньше — движением `offcut`, то есть самой резкой. Пока это писали
   * словами, в сидах его не было у десяти кусков из тринадцати: у трёх резка записана
   * как `production`/`write-off`, у семи не записана никак. Их количество оставалось и
   * в остатке партии, и на полке отдельной штукой, а `mockGetOffcutOffers` предлагала
   * такой кусок в заказ — то есть одну и ту же сталь продавали дважды.
   *
   * Размер считает та же функция, что зовёт `mockCreateOffcut` при живой резке и
   * `offcutAllocation` при продаже: сойтись они обязаны по построению, а не по совпадению.
   */
  it('у каждого куска ровно одно движение резки — со своей партии и на свой размер', async () => {
    const offcuts = (await mockGetOffcuts({ search: '' }, ALL)).items
    const movements = (await mockGetMovements({ search: '' }, { page: 1, pageSize: 100000 })).items
    expect(offcuts.length).toBeGreaterThan(0)

    const wrong: string[] = []
    for (const row of offcuts) {
      const offcut = await mockGetOffcut(row.id)
      const batch = batchById(offcut.batchId)
      if (!batch) {
        wrong.push(`${offcut.id}: партии ${offcut.batchId} нет`)
        continue
      }
      const material = resolveOffcutMaterial(offcut, batch.uomId)
      if (!material.ok) {
        wrong.push(`${offcut.id}: размер в единице партии не выражается (${material.reason})`)
        continue
      }
      const cuts = movements.filter((m) => m.type === 'offcut' && m.offcutId === offcut.id)
      if (cuts.length !== 1) {
        wrong.push(`${offcut.id}: движений резки ${cuts.length}, а должно быть ровно одно`)
        continue
      }
      const cut = cuts[0]!
      if (cut.batchId !== offcut.batchId) {
        wrong.push(`${offcut.id}: резка списана с ${cut.batchId}, а кусок от ${offcut.batchId}`)
      }
      if (cut.quantity !== material.material) {
        wrong.push(`${offcut.id}: списано ${cut.quantity}, а размер куска ${material.material}`)
      }
    }
    expect(wrong).toEqual([])
  })

  /**
   * И следствие, ради которого посылка нужна: партия и её куски вместе не обещают
   * больше металла, чем в партию пришло. Утверждение отдельное от предыдущего — то
   * сверяет журнал с формулой, это сверяет полку с приходом.
   */
  it('партия и её свободные куски вместе не превышают прихода', async () => {
    const offcuts = (await mockGetOffcuts({ search: '' }, ALL)).items
    const perBatch = new Map<string, number>()
    for (const row of offcuts) {
      if (row.status !== 'available') continue
      const offcut = await mockGetOffcut(row.id)
      const batch = batchById(offcut.batchId)
      if (!batch) continue
      const material = resolveOffcutMaterial(offcut, batch.uomId)
      if (!material.ok) continue
      perBatch.set(offcut.batchId, round2((perBatch.get(offcut.batchId) ?? 0) + material.material))
    }
    expect(perBatch.size).toBeGreaterThan(0)

    const over: string[] = []
    for (const [batchId, onShelf] of perBatch) {
      const batch = batchById(batchId)!
      const promised = round2(batch.quantityRemaining + onShelf)
      if (promised > round2(batch.quantity) + 1e-9) {
        over.push(
          `${batchId}: приход ${batch.quantity}, остаток ${batch.quantityRemaining} + куски ${onShelf} = ${promised}`,
        )
      }
    }
    expect(over).toEqual([])
  })
})

describe('отгрузка строки, покрытой обрезком', () => {
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
  it('диалог не предлагает количество, которое разрежет кусок', async () => {
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

    const planned = mockPlanOrderShipment(orderId).find((l) => l.lineId === line.id)!
    // Кусок стоит первым в разбивке, значит занимает отрезок от нуля до своего размера.
    expect(planned.wholePieces).toEqual([{ from: 0, to: offer.material }])

    // Отрезок назван не для красоты: середина его действительно отклоняется записью.
    const inside = round2(offer.material / 2)
    expect(inside).toBeGreaterThan(0)
    expect(inside).toBeLessThan(offer.material)
    expect(splitsWholePiece(inside, planned.wholePieces)).toBe(true)
    expect(() =>
      mockCreateShipment(orderId, { lines: [{ lineId: line.id, quantity: inside }] }),
    ).toThrow('SHIPMENT_EXCEEDS_STOCK')

    // А границы отрезка и предложенное количество запретом не считаются и проходят.
    expect(splitsWholePiece(offer.material, planned.wholePieces)).toBe(false)
    expect(splitsWholePiece(planned.shippable, planned.wholePieces)).toBe(false)
    mockCreateShipment(orderId, { lines: [{ lineId: line.id, quantity: planned.shippable }] })
  })

  it('куска нет на полке — предложено ноль, а не остаток партии за ним', async () => {
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
    await mockPatchOffcut(offer.id, { status: 'scrapped' })

    // Разбивку потребляют префиксом, поэтому за недоступным куском не добраться и до
    // партии, стоящей следом. «Остаток минус недостача» называл здесь TAIL — число,
    // которого план сам никогда не видел и которое запись отклоняет.
    const planned = mockPlanOrderShipment(orderId).find((l) => l.lineId === line.id)!
    expect(planned.shippable).toBe(0)
    expect(() =>
      mockCreateShipment(orderId, { lines: [{ lineId: line.id, quantity: TAIL }] }),
    ).toThrow('SHIPMENT_EXCEEDS_STOCK')
  })
})

describe('возврат строки, покрытой обрезком', () => {
  const REASON = 'client refused the piece'

  it('бракованный возврат уносит кусок в утиль, а не кладёт его обратно на полку', async () => {
    const { offer, orderId, line } = await lineCoveredByPiece()
    mockCreateShipment(orderId, { lines: [{ lineId: line.id, quantity: offer.material }] })
    expect((await mockGetOffcut(offer.id)).status).toBe('sold')

    mockCreateReturn(orderId, {
      reason: REASON,
      lines: [
        { lineId: line.id, quantity: offer.material, condition: 'defective', compensated: false },
      ],
    })

    // Возврат кладёт кусок на полку, акт списания следом уносит его в утиль — и статус
    // читает ВТОРУЮ запись, а не первую. У партии тот же сценарий сходился в ноль сам:
    // количество вернулось и ушло. У куска количества нет — его остаток и есть статус.
    expect((await mockGetOffcut(offer.id)).status).toBe('scrapped')
    expect(mockGetOffcutOffers(offer.productId).some((o) => o.id === offer.id)).toBe(false)
  })

  it('годный возврат кладёт кусок обратно на полку целиком', async () => {
    const { offer, orderId, line } = await lineCoveredByPiece()
    mockCreateShipment(orderId, { lines: [{ lineId: line.id, quantity: offer.material }] })

    mockCreateReturn(orderId, {
      reason: REASON,
      lines: [{ lineId: line.id, quantity: offer.material, condition: 'good', compensated: true }],
    })

    expect((await mockGetOffcut(offer.id)).status).toBe('available')
  })

  it('половину куска вернуть нельзя: класть её некуда', async () => {
    const { offer, orderId, line } = await lineCoveredByPiece()
    mockCreateShipment(orderId, { lines: [{ lineId: line.id, quantity: offer.material }] })
    const half = round2(offer.material / 2)
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(offer.material)

    expect(() =>
      mockCreateReturn(orderId, {
        reason: REASON,
        lines: [{ lineId: line.id, quantity: half, condition: 'good', compensated: true }],
      }),
    ).toThrow('RETURN_SPLITS_OFFCUT')
    // Отказ ничего не записал: кусок как уехал, так и уехал.
    expect((await mockGetOffcut(offer.id)).status).toBe('sold')
    expect(mockGetOrder(orderId)!.returns).toEqual([])
  })

  it('частичный возврат смешанной строки берёт металл партии, а куска не трогает', async () => {
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
    mockCreateShipment(orderId, { lines: [{ lineId: line.id, quantity }] })

    // Меньше куска — значит вернули не кусок, а металл партии, уехавшей той же машиной.
    const back = round2(offer.material / 2)
    expect(back).toBeGreaterThan(0)
    expect(back).toBeLessThan(offer.material)
    expect(back).toBeLessThanOrEqual(TAIL)
    const parentBefore = batchById(offer.batchId)!.quantityRemaining

    const ret = mockCreateReturn(orderId, {
      reason: REASON,
      lines: [{ lineId: line.id, quantity: back, condition: 'good', compensated: true }],
    })

    // Ни одна ступенька возврата не назвала куска, а вернулось ровно количество.
    expect(ret.lines[0]!.restored!.map((r) => r.offcutId)).toEqual([null])
    expect(round2(ret.lines[0]!.restored!.reduce((sum, r) => sum + r.quantity, 0))).toBe(back)
    expect((await mockGetOffcut(offer.id)).status).toBe('sold')
    expect(batchById(offer.batchId)!.quantityRemaining).toBe(round2(parentBefore + back))
  })
})

/**
 * Четвёртое место, где кусок обязан остаться целым: ПРАВКА КОЛИЧЕСТВА строки.
 *
 * Три остальных были закрыты раньше — добавление строки (`OFFCUTS_EXCEED_QUANTITY`),
 * отгрузка (кусок берётся только целиком) и возврат (`RETURN_SPLITS_OFFCUT`). Правка
 * количества обходила их все: `splitAllocations` резала разбивку по числу, не спрашивая,
 * попал ли разрез внутрь куска, и молча оставляла в заказе половину куска. Дальше это
 * доезжало до склада: план видел уже усечённую аллокацию и считал её целым куском —
 * продажа списывала половину, кусок помечался `sold` целиком, а вторая половина металла
 * исчезала без единой записи.
 *
 * Проверяется поэтому не «правка отклонена», а обе половины: отказ, и то, что после
 * отказа строка и кусок остались ровно такими же, какими были.
 */
describe('правка количества строки, покрытой обрезком', () => {
  /** Строка «кусок + хвост партии» и её текущая версия — на каждую правку своя. */
  async function mixedLine() {
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
    // Посылка теста: кусок стоит первым, значит занимает отрезок (0; material) — именно
    // тот, внутрь которого целится правка ниже. Без этой строки тест мог бы «пройти» на
    // строке, где куска нет вовсе.
    expect(line.allocations[0]!.offcutId).toBe(offer.id)
    expect(line.allocations[0]!.quantity).toBe(offer.material)
    return { offer, orderId, line, quantity }
  }

  const shown = (orderId: string, lineId: string) =>
    mockGetOrder(orderId)!
      .items.find((i) => i.id === lineId)!
      .allocations.map((a) => [a.offcutId, a.batchId, a.quantity])

  it('количество внутрь куска отклонено, и разбивка осталась прежней', async () => {
    const { offer, orderId, line } = await mixedLine()
    const before = shown(orderId, line.id)
    const inside = round2(offer.material / 2)
    expect(inside).toBeGreaterThan(0)
    expect(inside).toBeLessThan(offer.material)

    expect(() =>
      mockUpdateOrderItem(orderId, line.id, {
        quantity: inside,
        version: mockGetOrder(orderId)!.version,
      }),
    ).toThrow('QUANTITY_SPLITS_OFFCUT')

    // Отказ ничего не записал: ни количества, ни урезанной аллокации.
    expect(shown(orderId, line.id)).toEqual(before)
    expect(mockGetOrder(orderId)!.items.find((i) => i.id === line.id)!.quantity).toBe(
      round2(offer.material + TAIL),
    )
  })

  it('после отказа кусок уезжает целым, а не половиной', async () => {
    const { offer, orderId, line } = await mixedLine()
    const inside = round2(offer.material / 2)
    expect(() =>
      mockUpdateOrderItem(orderId, line.id, {
        quantity: inside,
        version: mockGetOrder(orderId)!.version,
      }),
    ).toThrow('QUANTITY_SPLITS_OFFCUT')

    // Вторая половина утверждения, ради которой отказ и нужен. С усечением план назвал бы
    // куском половину: wholePieces [0; material/2] и shippable в половину размера, а
    // отгрузка списала бы половину и пометила кусок `sold` целиком — остальной металл
    // исчезал бы без записи.
    const planned = mockPlanOrderShipment(orderId).find((l) => l.lineId === line.id)!
    expect(planned.wholePieces).toEqual([{ from: 0, to: offer.material }])
    expect(planned.shippable).toBe(round2(offer.material + TAIL))

    const shipment = mockCreateShipment(orderId, {
      lines: [{ lineId: line.id, quantity: planned.shippable }],
    })
    const sold = mockGetMovementsFor('order-shipment', shipment.id).filter(
      (m) => m.type === 'sale' && m.offcutId === offer.id,
    )
    expect(sold.map((m) => m.quantity)).toEqual([offer.material])
    expect((await mockGetOffcut(offer.id)).status).toBe('sold')
  })

  it('количество ровно в кусок и больше куска проходят — режется только хвост партии', async () => {
    const { offer, orderId, line } = await mixedLine()

    // Больше куска: разрез попадает в партию, металл делится, кусок цел.
    const overPiece = round2(offer.material + 1)
    mockUpdateOrderItem(orderId, line.id, {
      quantity: overPiece,
      version: mockGetOrder(orderId)!.version,
    })
    expect(shown(orderId, line.id)).toEqual([
      [offer.id, null, offer.material],
      [null, line.allocations[1]!.batchId, 1],
    ])

    // Ровно в кусок: граница отрезка запретом не считается, хвост партии уходит целиком.
    mockUpdateOrderItem(orderId, line.id, {
      quantity: offer.material,
      version: mockGetOrder(orderId)!.version,
    })
    expect(shown(orderId, line.id)).toEqual([[offer.id, null, offer.material]])
  })
})
