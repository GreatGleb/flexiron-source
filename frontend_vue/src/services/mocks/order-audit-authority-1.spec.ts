/**
 * The mock as a server: what may a client dictate?
 *
 * This file is no longer a report — it is the acceptance criterion for the
 * findings it was written to describe. A test that is red here names a finding
 * that is still open; a test that is green guards a result that was checked and
 * found correct, and must stay correct.
 *
 *   red   — 9  (POST /items takes the cost from the client, around the right)
 *   red   — 10 (PATCH /items takes the whole batch breakdown from the client)
 *   red   — 11 (a non-finite number passes every guard)
 *   red   — 12 (an unknown productId is accepted; an unknown serviceId is not)
 *   green — derived totals and status are not writable through PATCH /orders/:id
 *   green — a document may only point at its own order
 *   green — negative quantity, negative price, discount out of range
 *
 * Rights live next door in `order-audit-authority-2.spec.ts`; this file never
 * touches the settings, so the two cannot interfere.
 */
import { describe, it, expect } from 'vitest'
import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockUpdateOrderItem,
  mockAddOrderPayment,
  mockCreateShipment,
  mockCreateInvoice,
  mockPatchOrder,
  mockGetOrders,
} from './orders'
import { mockGetClients } from './clients'
import { batchesForProduct, batchById } from './warehouse'
import { round2 } from '@/domain/orderPricing'
import type { Order } from '@/types/order'

const log: string[] = []
const say = (...p: unknown[]) =>
  log.push(p.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
/** The report the investigation used to print — now the failure message. */
const why = (t: string) => `\n=== ${t} ===\n` + log.join('\n') + '\n'

function fresh(): Order {
  return mockCreateOrder({ clientId: mockGetClients()[0]!.id, documentType: 'local' })
}
function stocked(min: number): string {
  const page = mockGetOrders(
    {
      search: '',
      status: 'all',
      clientId: null,
      dateFrom: '',
      dateTo: '',
      sortBy: null,
      sortDir: 'asc',
    },
    { page: 1, pageSize: 200 },
  )
  const ids = new Set<string>()
  for (const r of page.items) for (const i of mockGetOrder(r.id)!.items) ids.add(i.productId)
  for (const id of ids) {
    if (batchesForProduct(id).reduce((s, b) => s + b.quantityRemaining, 0) >= min) return id
  }
  throw new Error('none')
}
/** Runs a request and says what the server answered, without deciding anything. */
function attempt(label: string, fn: () => unknown): string {
  let verdict: string
  try {
    fn()
    verdict = 'ACCEPTED'
  } catch (e) {
    verdict = String(e).replace(/^\w*Error: /, '')
  }
  say(`${label.padEnd(52)} ${verdict}`)
  return verdict
}

describe('AUTHORITY — what a client may dictate', () => {
  // ── 1. Cost. Contract §4.2: "Добавление строки не берёт себестоимость от
  //    клиента как истину: сервер считает её FIFO по доступным партиям."
  it('a line marked `stock` carries the warehouse figure, never the one asked for', () => {
    log.length = 0
    const productId = stocked(20)
    const o1 = fresh()
    const honest = mockAddOrderItem(o1.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 500 })
    say('FIFO cost the warehouse gives  :', honest.unitCost, `(${honest.costSource})`)

    attempt('POST /items with unitCost=0.01', () =>
      mockAddOrderItem(o1.id, {
        productId,
        quantity: 2,
        unit: 'pcs',
        unitPrice: 500,
        unitCost: 0.01,
      }),
    )
    const stored = mockGetOrder(o1.id)!.items
    for (const i of stored) {
      say(
        '  stored line                  :',
        `${i.id} cost=${i.unitCost} (${i.costSource})`,
        'manualUnitCost=',
        i.manualUnitCost,
        'reason=',
        i.manualCostReason,
      )
    }
    say('order totalCost                :', mockGetOrder(o1.id)!.totalCost)
    say('')
    say('Two fixes are both acceptable: refuse `unitCost` on POST, or take it only')
    say('behind the manualCost right and store it as `manual` with a reason. What is')
    say('not acceptable is a client figure wearing the label `stock`.')

    // Whichever door the fix chooses, this must hold: a cost that says it came
    // off the shelf is the cost that came off the shelf.
    const pretending = stored
      .filter((i) => i.costSource === 'stock' && i.unitCost !== honest.unitCost)
      .map((i) => `${i.id} says stock but holds ${i.unitCost}, warehouse says ${honest.unitCost}`)
    expect(pretending, why('AUTHORITY — cost')).toEqual([])
    // And a cost the client dictated is never silently unmarked.
    const unmarked = stored
      .filter((i) => i.costSource === 'manual' && !i.manualCostReason)
      .map((i) => `${i.id} is manual with no reason`)
    expect(unmarked, why('AUTHORITY — cost')).toEqual([])
  })

  // ── 2. The batch breakdown — warehouse data, written through the orders API.
  it('the batch breakdown stays warehouse data: real batches, and the cost that follows from them', () => {
    log.length = 0
    const productId = stocked(20)
    const o2 = fresh()
    const line = mockAddOrderItem(o2.id, { productId, quantity: 4, unit: 'pcs', unitPrice: 100 })
    say(
      'breakdown as FIFO built it     :',
      line.allocations.map((a) => `${a.batchId} q=${a.quantity} @${a.unitCost}`),
    )
    attempt('PATCH allocations = a batch that does not exist', () =>
      mockUpdateOrderItem(o2.id, line.id, {
        allocations: [
          {
            batchId: 'whb-does-not-exist',
            offcutId: null,
            quantity: 4,
            unitCost: 0.01,
            currency: 'EUR',
            source: 'stock',
          },
        ],
      }),
    )
    const after = mockGetOrder(o2.id)!.items[0]!
    say(
      'breakdown now                  :',
      after.allocations.map((a) => `${a.batchId} q=${a.quantity} @${a.unitCost}`),
    )
    say('line unitCost / costSource     :', after.unitCost, after.costSource)
    say('')
    say('A line whose breakdown names a batch nobody has cannot ship — planShipment')
    say('skips the unknown batch — and nothing anywhere says why.')

    const phantom = after.allocations
      .filter((a) => a.batchId !== null && !batchById(a.batchId))
      .map((a) => a.batchId)
    expect(phantom, why('AUTHORITY — breakdown')).toEqual([])

    // The breakdown and the unit cost are one fact stored twice; they must agree.
    const covered = after.allocations.reduce((s, a) => s + a.quantity, 0)
    if (covered > 0) {
      const weighted = round2(
        after.allocations.reduce((s, a) => s + a.quantity * a.unitCost, 0) / covered,
      )
      say('weighted cost of the breakdown :', weighted, 'vs line unitCost', after.unitCost)
      expect(round2(after.unitCost), why('AUTHORITY — breakdown')).toBe(weighted)
    }
  })

  // ── 3. Derived fields on the order. Checked, and correct — a guard.
  it('PATCH /orders/:id ignores every derived field, and the status too', () => {
    log.length = 0
    const productId = stocked(20)
    const o3 = fresh()
    mockAddOrderItem(o3.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    const before = mockGetOrder(o3.id)!
    mockPatchOrder(o3.id, {
      totalAmount: 999999,
      totalWithVat: 999999,
      paidPercent: 100,
      actualMarginPercent: 99,
      effectiveDiscountPercent: 99,
      status: 'delivered',
    } as Partial<Order>)
    const now = mockGetOrder(o3.id)!
    const derived = [
      'totalAmount',
      'totalWithVat',
      'paidPercent',
      'actualMarginPercent',
      'effectiveDiscountPercent',
      'status',
    ] as const
    for (const k of derived)
      say(`${k.padEnd(26)} : ${JSON.stringify(before[k])} -> ${JSON.stringify(now[k])}`)
    say('')
    say('Status has its own endpoint, with the stock check behind it (§4.5).')

    const moved = derived.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(now[k]))
    expect(moved, why('AUTHORITY — derived fields')).toEqual([])
  })

  // ── 4. Cross-order references. Checked, and correct — a guard.
  it('a document may only point at its own order, and a line id means the line of THIS order', () => {
    log.length = 0
    const productId = stocked(20)
    const o4 = fresh()
    const foreign = mockAddOrderItem(o4.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    const o5 = fresh()
    const own = mockAddOrderItem(o5.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    say(
      'line id in order A / in order B:',
      foreign.id,
      '/',
      own.id,
      '— the same string, see finding 20',
    )

    // Line ids are unique inside their order and repeat across orders, so this
    // request is not "ship another order's line": it names THIS order's line.
    // What must never happen is order A's line moving because B was shipped.
    const shippedByB = attempt('SHIP order B naming that id', () =>
      mockCreateShipment(o5.id, { lines: [{ lineId: foreign.id, quantity: 1 }] }),
    )
    say('order A line shippedQuantity   :', mockGetOrder(o4.id)!.items[0]!.shippedQuantity)
    say('order B line shippedQuantity   :', mockGetOrder(o5.id)!.items[0]!.shippedQuantity)
    expect(shippedByB, why('AUTHORITY — references')).toBe('ACCEPTED')
    expect(mockGetOrder(o4.id)!.items[0]!.shippedQuantity, why('AUTHORITY — references')).toBe(0)
    expect(mockGetOrder(o5.id)!.items[0]!.shippedQuantity, why('AUTHORITY — references')).toBe(1)

    // Document ids, by contrast, are global — and must still be refused across orders.
    const shp = mockCreateShipment(o4.id, { lines: [{ lineId: foreign.id, quantity: 1 }] })
    const invoiceVerdict = attempt("INVOICE another order's shipment", () =>
      mockCreateInvoice(o5.id, { kind: 'regular', shipmentId: shp.id }),
    )
    const inv = mockCreateInvoice(o4.id, { kind: 'regular', shipmentId: shp.id })
    const paymentVerdict = attempt("PAYMENT against another order's invoice", () =>
      mockAddOrderPayment(o5.id, { amount: 10, invoiceId: inv.id }),
    )
    expect(invoiceVerdict, why('AUTHORITY — references')).toContain('SHIPMENT_NOT_FOUND')
    expect(paymentVerdict, why('AUTHORITY — references')).toContain('PAYMENT_INVOICE_NOT_FOUND')
  })

  // ── 5. Values a server must never take. Checked, and correct — a guard.
  it('refuses a negative quantity, a negative price and a discount out of range', () => {
    log.length = 0
    const productId = stocked(20)
    const o6 = fresh()
    const good = mockAddOrderItem(o6.id, { productId, quantity: 1, unit: 'pcs', unitPrice: 100 })

    const negativeQty = attempt('POST item quantity = -5', () =>
      mockAddOrderItem(o6.id, { productId, quantity: -5, unit: 'pcs', unitPrice: 100 }),
    )
    const negativePrice = attempt('POST item unitPrice = -100', () =>
      mockAddOrderItem(o6.id, { productId, quantity: 1, unit: 'pcs', unitPrice: -100 }),
    )
    const discount = attempt('PATCH discountPercent = 150', () =>
      mockUpdateOrderItem(o6.id, good.id, { discountPercent: 150 }),
    )
    expect(negativeQty, why('AUTHORITY — values')).toMatch(/quantity/)
    expect(negativePrice, why('AUTHORITY — values')).toMatch(/price/)
    expect(discount, why('AUTHORITY — values')).toContain('DISCOUNT_OUT_OF_RANGE')

    // Not asserted, only recorded: quantity 0 is taken on POST although the
    // domain throws ZERO_QUANTITY for it elsewhere. Nobody has ruled on it yet.
    attempt('POST item quantity = 0 (recorded, not asserted)', () =>
      mockAddOrderItem(o6.id, { productId, quantity: 0, unit: 'pcs', unitPrice: 100 }),
    )
    say('')
    say('These three are the shape every other check in this file should have.')
  })

  // Finding 12 — the same rule as for services, which do refuse (SERVICE_NOT_FOUND).
  it('refuses an unknown productId exactly as it refuses an unknown serviceId', () => {
    log.length = 0
    const productId = stocked(20)
    const o7 = fresh()
    mockAddOrderItem(o7.id, { productId, quantity: 1, unit: 'pcs', unitPrice: 100 })
    const snapshot = JSON.stringify(mockGetOrder(o7.id))

    const verdict = attempt('POST item with an unknown productId', () =>
      mockAddOrderItem(o7.id, { productId: 'prod-nope', quantity: 1, unit: 'pcs', unitPrice: 100 }),
    )
    say(
      'lines stored                   :',
      JSON.stringify(
        mockGetOrder(o7.id)!.items.map(
          (i) => `${i.productId} "${i.productName}" cost=${i.unitCost}`,
        ),
      ),
    )
    say('')
    say('One rule written for services and forgotten next door: the unknown product')
    say('becomes a line whose name is its own id and whose cost is zero.')
    expect(verdict, why('AUTHORITY — unknown id')).toMatch(/NOT_FOUND/)
    expect(JSON.stringify(mockGetOrder(o7.id)), why('AUTHORITY — unknown id')).toBe(snapshot)
  })

  // Finding 11 — every guard here is a comparison, and a comparison with NaN is
  // false, so NaN walks through all of them.
  it('refuses a quantity that is not a finite number, and writes nothing when it does', () => {
    log.length = 0
    const productId = stocked(20)
    const o8 = fresh()
    mockAddOrderItem(o8.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    const before = JSON.stringify(mockGetOrder(o8.id))

    const verdict = attempt('POST item quantity = NaN', () =>
      mockAddOrderItem(o8.id, { productId, quantity: Number.NaN, unit: 'pcs', unitPrice: 100 }),
    )
    say(
      'order after it                 :',
      JSON.stringify({
        lines: mockGetOrder(o8.id)!.items.map((i) => `${i.id} q=${i.quantity} p=${i.unitPrice}`),
        total: mockGetOrder(o8.id)!.totalAmount,
      }),
    )
    say(
      'serialises to JSON as          :',
      JSON.stringify(mockGetOrder(o8.id)!.items.map((i) => i.quantity)),
    )
    say('')
    say('A line with quantity NaN goes on the wire as `null`, and the order it landed')
    say('in collapses to a total of 0. For a NOT NULL numeric column that is a 500 —')
    say('or, worse, a row that was written. The whole table is in authority-2.')
    expect(verdict, why('AUTHORITY — NaN')).not.toBe('ACCEPTED')
    expect(JSON.stringify(mockGetOrder(o8.id)), why('AUTHORITY — NaN')).toBe(before)
  })
})
