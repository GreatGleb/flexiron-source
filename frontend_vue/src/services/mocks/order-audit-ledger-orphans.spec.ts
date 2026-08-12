/**
 * Layers 11 & 12 — the ledger as a whole, and what a delete leaves behind.
 *
 * Layer 11 is a green guard: every batch in the store reconciles with its own
 * movements, no hold outlives the line it was taken for, and nothing is promised
 * that the shelf cannot back.
 *
 * Layer 12 is the acceptance criterion for FINDING 22 — a shortage record has to
 * disappear with the line that filed it and with the order it belongs to, exactly
 * as its reservation already does. The deficit list is the buying list; a record
 * left behind asks somebody to purchase goods for an order that no longer exists.
 */
import { describe, it, expect } from 'vitest'
import {
  mockGetOrder,
  mockGetOrders,
  mockCreateOrder,
  mockAddOrderItem,
  mockDeleteOrderItem,
  mockDeleteOrder,
  mockReserveOrder,
  mockGetReservations,
  mockCreateShipment,
  mockCancelShipment,
} from './orders'
import { mockGetClients } from './clients'
import {
  batchesForProduct,
  batchById,
  mockGetBatches,
  mockGetDeficitList,
  mockGetMovements,
} from './warehouse'
import { findReservations, reservedOn } from './reservations'
import { round2 } from '@/domain/orderPricing'

const log: string[] = []
const say = (...p: unknown[]) =>
  log.push(p.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
const report = (t: string) => `\n=== ${t} ===\n${log.join('\n')}\n`

/**
 * "No filter at all" — spelled as the parameter the endpoint really takes.
 *
 * Cast to the endpoint's own signature rather than to the domain filter type:
 * the mock's list endpoints read every filter off the query string, so their
 * parameter is a bag of strings, and casting to the richer domain type made the
 * two silently disagree.
 */
const NO_FILTER = {
  search: '',
  status: '',
  priority: '',
  unit: '',
  categoryIds: '',
  sortBy: undefined,
  sortDir: 'asc',
} as unknown as Parameters<typeof mockGetMovements>[0] & Parameters<typeof mockGetDeficitList>[0]

/** Copied from `writeMovement` (warehouse.ts:827+), not guessed at. */
const OUT = [
  'sale',
  'expense',
  'write-off',
  'production',
  'return-to-supplier',
  'storage',
  'offcut',
]
const IN = ['return']

function allOrderIds(): string[] {
  return mockGetOrders(
    {
      search: '',
      status: 'all',
      clientId: null,
      dateFrom: '',
      dateTo: '',
      sortBy: null,
      sortDir: 'asc',
    },
    { page: 1, pageSize: 5000 },
  ).items.map((o) => o.id)
}
function stocked(min: number): string {
  const ids = new Set<string>()
  for (const id of allOrderIds()) for (const i of mockGetOrder(id)!.items) ids.add(i.productId)
  for (const id of ids) {
    if (batchesForProduct(id).reduce((s, b) => s + b.quantityRemaining, 0) >= min) return id
  }
  throw new Error('none')
}
const clientId = () => mockGetClients()[0]!.id

/** Every shortage the store knows, with the order it names (`recordShortage`). */
async function deficits(): Promise<Awaited<ReturnType<typeof mockGetDeficitList>>['items']> {
  return (await mockGetDeficitList(NO_FILTER, { page: 1, pageSize: 5000 })).items
}
const ORDER_NOTE = /^Order (.+)$/
const deficitsFor = async (orderId: string) =>
  (await deficits()).filter((d) => d.notes === `Order ${orderId}`)

describe('LAYER 11 — the ledger as a whole', () => {
  it('every batch holds exactly what its own movements leave behind', async () => {
    log.length = 0
    const movements = await mockGetMovements(NO_FILTER, { page: 1, pageSize: 100000 })
    const byBatch = new Map<string, Map<string, number>>()
    for (const m of movements.items) {
      if (!m.batchId) continue
      if (!byBatch.has(m.batchId)) byBatch.set(m.batchId, new Map())
      const per = byBatch.get(m.batchId)!
      per.set(m.type, round2((per.get(m.type) ?? 0) + m.quantity))
    }
    say('movements in the store         :', movements.items.length)
    say('types seen                     :', [...new Set(movements.items.map((m) => m.type))])

    // Every batch in the store, not only the ones an order happens to touch.
    const batches = (await mockGetBatches({ search: '' }, { page: 1, pageSize: 10000 })).items
    const off: string[] = []
    for (const b of batches) {
      const per = byBatch.get(b.id) ?? new Map<string, number>()
      const out = round2(OUT.reduce((s, t) => s + (per.get(t) ?? 0), 0))
      const back = round2(IN.reduce((s, t) => s + (per.get(t) ?? 0), 0))
      const expected = round2(b.quantity - out + back)
      if (Math.abs(expected - b.quantityRemaining) >= 0.005) {
        off.push(
          `${b.id}: received ${b.quantity}, out ${out}, back ${back} → expected ${expected}, stored ${round2(b.quantityRemaining)}`,
        )
      }
    }
    say('batches checked                :', batches.length)
    say('do not reconcile               :', off.length)
    off.slice(0, 8).forEach((o) => say('  ' + o))
    say('')
    say('Model §7: "Остаток партии и её статус не хранятся как отдельная правда,')
    say('а выводятся из движений."')

    expect(batches.length, report('LAYER 11 — nothing to check')).toBeGreaterThan(0)
    expect(off, report('LAYER 11 — batch vs movements')).toEqual([])
  })

  it('nothing is reserved anywhere that the shelf cannot back', () => {
    log.length = 0
    // Make the sweep mean something: put real holds in the store first.
    const productId = stocked(20)
    const order = mockCreateOrder({ clientId: clientId(), documentType: 'local' })
    mockAddOrderItem(order.id, { productId, quantity: 6, unit: 'pcs', unitPrice: 100 })
    mockAddOrderItem(order.id, { productId, quantity: 4, unit: 'pcs', unitPrice: 100 })
    mockReserveOrder(order.id)

    const holds = findReservations()
    const perBatch = new Map<string, number>()
    for (const r of holds) {
      if (!r.batchId) continue
      perBatch.set(r.batchId, round2((perBatch.get(r.batchId) ?? 0) + r.quantity))
    }
    const over: string[] = []
    for (const [batchId, held] of perBatch) {
      const b = batchById(batchId)
      if (!b) {
        over.push(`${batchId}: ${held} reserved on a batch that does not exist`)
        continue
      }
      if (held > round2(b.quantityRemaining) + 1e-9) {
        over.push(`${batchId}: ${held} reserved, ${round2(b.quantityRemaining)} on the shelf`)
      }
    }
    const nonPositive = holds.filter((r) => r.quantity <= 0)
    say('reservation records            :', holds.length)
    say('batches carrying a hold        :', perBatch.size)
    say('over-promised batches          :', over.length ? over.slice(0, 6) : '—')
    say('negative or zero-quantity holds:', nonPositive.length)

    expect(
      perBatch.size,
      report('LAYER 11 — no holds were created, so the sweep proves nothing'),
    ).toBeGreaterThan(0)
    expect(over, report('LAYER 11 — reservations across the store')).toEqual([])
    expect(nonPositive, report('LAYER 11 — a hold for nothing, or for less than nothing')).toEqual(
      [],
    )

    mockDeleteOrder(order.id)
  })

  it('every hold still belongs to a line that exists', () => {
    log.length = 0
    const productId = stocked(20)
    // A line that is removed, and a whole order that is removed: both used to be
    // the way a hold outlived its owner, so both happen before the sweep.
    const kept = mockCreateOrder({ clientId: clientId(), documentType: 'local' })
    const keptLine = mockAddOrderItem(kept.id, {
      productId,
      quantity: 5,
      unit: 'pcs',
      unitPrice: 100,
    })
    const doomedLine = mockAddOrderItem(kept.id, {
      productId,
      quantity: 3,
      unit: 'pcs',
      unitPrice: 100,
    })
    mockReserveOrder(kept.id)
    mockDeleteOrderItem(kept.id, doomedLine.id)

    const doomed = mockCreateOrder({ clientId: clientId(), documentType: 'local' })
    mockAddOrderItem(doomed.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    mockReserveOrder(doomed.id)
    mockDeleteOrder(doomed.id)

    const live = new Set<string>()
    for (const id of allOrderIds()) {
      for (const i of mockGetOrder(id)!.items) live.add(`${id}|${i.id}`)
    }
    const holds = findReservations()
    const orphans = holds
      .filter((r) => !live.has(`${r.orderId}|${r.lineId}`))
      .map((o) => `${o.orderId} / ${o.lineId} / ${o.batchId} × ${o.quantity}`)
    say('reservation records            :', holds.length)
    say('deleted a line                 :', `${kept.id} / ${doomedLine.id}`)
    say('deleted a whole order          :', doomed.id)
    say('pointing at a line that is gone:', orphans.length)
    orphans.slice(0, 5).forEach((o) => say('  ' + o))

    expect(
      holds.length,
      report('LAYER 11 — no holds at all, so the sweep proves nothing'),
    ).toBeGreaterThan(0)
    expect(
      holds.some((r) => r.orderId === kept.id && r.lineId === keptLine.id),
      report('LAYER 11 — the surviving line lost its hold, so nothing was really tested'),
    ).toBe(true)
    expect(orphans, report('LAYER 11 — orphaned holds')).toEqual([])

    mockDeleteOrder(kept.id)
  })
})

describe('LAYER 12 — what a delete leaves behind', () => {
  it('deleting a line takes back its shortage, the way it takes back its hold', async () => {
    log.length = 0
    const productId = stocked(10)
    const onShelf = batchesForProduct(productId).reduce((s, b) => s + b.quantityRemaining, 0)
    const order = mockCreateOrder({ clientId: clientId(), documentType: 'local' })
    const line = mockAddOrderItem(order.id, {
      productId,
      quantity: round2(onShelf + 25),
      unit: 'pcs',
      unitPrice: 100,
    })
    mockReserveOrder(order.id)
    say('an order asks for more than the shelf holds:')
    say('  deficit records for it       :', (await deficitsFor(order.id)).length)
    say('  reservation records          :', mockGetReservations({ orderId: order.id }).length)
    expect(
      (await deficitsFor(order.id)).length,
      report('LAYER 12 — no shortage was filed, so the delete proves nothing'),
    ).toBe(1)

    mockDeleteOrderItem(order.id, line.id)
    const heldAfter = mockGetReservations({ orderId: order.id }).length
    const shortAfter = await deficitsFor(order.id)
    say('after DELETE the line          :')
    say('  deficit records for it       :', shortAfter.length)
    say('  reservation records          :', heldAfter)
    shortAfter.forEach((d) =>
      say(`    ${d.id} ${d.deficitAmount} ${d.unit} "${d.notes}" status=${d.status}`),
    )

    expect(heldAfter, report('LAYER 12 — a deleted line kept its reservation')).toBe(0)
    expect(
      shortAfter.map((d) => `${d.id} ${d.deficitAmount} ${d.unit} "${d.notes}"`),
      report(
        'LAYER 12 — FINDING 22: the line is gone and its shortage is still on the buying list',
      ),
    ).toEqual([])

    mockDeleteOrder(order.id)
  })

  it('deleting an order takes back its shortages, the way it takes back its holds', async () => {
    log.length = 0
    const productId = stocked(10)
    const onShelf = batchesForProduct(productId).reduce((s, b) => s + b.quantityRemaining, 0)
    const order = mockCreateOrder({ clientId: clientId(), documentType: 'local' })
    mockAddOrderItem(order.id, {
      productId,
      quantity: round2(onShelf + 25),
      unit: 'pcs',
      unitPrice: 100,
    })
    mockReserveOrder(order.id)
    expect(
      (await deficitsFor(order.id)).length,
      report('LAYER 12 — no shortage was filed, so the delete proves nothing'),
    ).toBe(1)

    mockDeleteOrder(order.id)
    const heldAfter = mockGetReservations({ orderId: order.id }).length
    const shortAfter = await deficitsFor(order.id)
    say('after DELETE the whole order   :', order.id)
    say('  order still readable?        :', mockGetOrder(order.id) !== undefined)
    say('  deficit records for it       :', shortAfter.length)
    say('  reservation records          :', heldAfter)
    shortAfter.forEach((d) =>
      say(`    ${d.id} ${d.deficitAmount} ${d.unit} "${d.notes}" status=${d.status}`),
    )

    expect(mockGetOrder(order.id), report('LAYER 12 — the order did not delete')).toBeUndefined()
    expect(heldAfter, report('LAYER 12 — a deleted order kept its reservations')).toBe(0)
    expect(
      shortAfter.map((d) => `${d.id} ${d.deficitAmount} ${d.unit} "${d.notes}"`),
      report(
        'LAYER 12 — FINDING 22: the order is gone and its shortage still asks somebody to buy for it',
      ),
    ).toEqual([])
  })

  it('no shortage on the buying list names an order that does not exist', async () => {
    log.length = 0
    const live = new Set(allOrderIds())
    const all = await deficits()
    const named = all.filter((d) => ORDER_NOTE.test(d.notes ?? ''))
    const dangling = named
      .filter((d) => !live.has(ORDER_NOTE.exec(d.notes!)![1]!))
      .map((d) => `${d.id} ${d.deficitAmount} ${d.unit} "${d.notes}" status=${d.status}`)
    say('deficit records in the store   :', all.length)
    say('…filed by an order             :', named.length)
    say('…whose order is gone           :', dangling.length)
    dangling.slice(0, 8).forEach((d) => say('  ' + d))

    expect(
      dangling,
      report(
        'LAYER 12 — FINDING 22: the buying list asks for goods for orders that no longer exist',
      ),
    ).toEqual([])
  })

  it('a cancelled shipment gives the shelf back exactly', () => {
    log.length = 0
    const productId = stocked(10)
    const order = mockCreateOrder({ clientId: clientId(), documentType: 'local' })
    const line = mockAddOrderItem(order.id, { productId, quantity: 6, unit: 'pcs', unitPrice: 100 })
    const batchId = line.allocations[0]!.batchId!
    const before = round2(batchById(batchId)!.quantityRemaining)
    mockReserveOrder(order.id)
    const heldAfterReserve = reservedOn(batchId)
    const shp = mockCreateShipment(order.id, { lines: [{ lineId: line.id, quantity: 4 }] })
    const whileShipped = round2(batchById(batchId)!.quantityRemaining)
    say('shelf before / after shipping  :', before, '/', whileShipped)
    mockCancelShipment(order.id, shp.id)
    const after = round2(batchById(batchId)!.quantityRemaining)
    say('shelf after cancelling         :', after)
    say('holds on that batch, after reserve / now:', heldAfterReserve, '/', reservedOn(batchId))
    say('line shippedQuantity           :', mockGetOrder(order.id)!.items[0]!.shippedQuantity)

    expect(
      whileShipped,
      report(
        'LAYER 12 — shipping did not take the goods off the shelf, so the cancel proves nothing',
      ),
    ).toBe(round2(before - 4))
    expect(after, report('LAYER 12 — cancel did not restore the shelf')).toBe(before)
    expect(
      mockGetOrder(order.id)!.items[0]!.shippedQuantity,
      report('LAYER 12 — the line still counts a cancelled shipment'),
    ).toBe(0)
    expect(reservedOn(batchId), report('LAYER 12 — cancel did not put the hold back')).toBe(
      heldAfterReserve,
    )

    mockDeleteOrder(order.id)
  })
})
