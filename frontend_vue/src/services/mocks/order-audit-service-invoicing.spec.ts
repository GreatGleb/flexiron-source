/**
 * Services and the documents that have to be able to carry them.
 *
 * Findings 4 and 7 are one hole seen from two ends. `coversServices` is handed
 * out ONCE (`orders.ts:2476`) and `mockAddOrderService` never asks whether a live
 * invoice already carries the services (`orders.ts:1559`), so:
 *
 *  - a service added after the first regular invoice can never reach a document
 *    (finding 7), and
 *  - a service whose carrying invoice was withdrawn with its shipment cannot be
 *    put back on one either (finding 4).
 *
 * The fix these checks are written for: `coversServices` stops being a one-shot
 * flag. An invoice carries the services that are NOT yet billed at the moment it
 * is issued, so any live regular invoice can pick up an unbilled service, and the
 * money always ends up on a document of the right kind. Model §6 explicitly
 * allows adding lines to a live order.
 *
 * These checks assert MONEY and the ABILITY TO BILL, never the internal flags —
 * how the fix stores "already billed" is the implementer's business.
 */
import { describe, it, expect } from 'vitest'
import {
  mockGetOrder,
  mockGetOrders,
  mockCreateOrder,
  mockAddOrderItem,
  mockAddOrderService,
  mockDeleteOrderItem,
  mockDeleteOrderService,
  mockCorrectOrderLine,
  mockCreateShipment,
  mockCancelShipment,
  mockCreateInvoice,
  mockPlanOrderShipment,
} from './orders'
import { mockGetClients } from './clients'
import { allServices } from './services'
import { batchesForProduct } from './warehouse'
import { calcLine, round2 } from '@/domain/orderPricing'
import { toPricingLine } from '@/services/orderLines'
import type { Order } from '@/types/order'

// ─── Stand ──────────────────────────────────────────────────────────────────

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
  for (const row of page.items) for (const i of mockGetOrder(row.id)!.items) ids.add(i.productId)
  for (const id of ids) {
    if (batchesForProduct(id).reduce((s, b) => s + b.quantityRemaining, 0) >= min) return id
  }
  throw new Error('no stocked product')
}

/** What the order says it is worth, from its own lines. */
function netOf(order: Order): number {
  return [...order.items, ...order.services].reduce(
    (sum, l) => round2(sum + calcLine(toPricingLine(l)).lineNet),
    0,
  )
}

/**
 * What the client has been asked for on paper, net.
 *
 * Every document counts, corrections included: a withdrawal is the mirror of the
 * invoice it takes back, so the two come to zero on their own and no separate
 * notion of "live" is needed to add the money up.
 */
function billedNet(order: Order): number {
  return round2(order.invoices.reduce((sum, i) => round2(sum + i.amountNet), 0))
}

function say(log: string[], label: string, value: unknown): void {
  log.push(`${label.padEnd(40)} ${typeof value === 'string' ? value : JSON.stringify(value)}`)
}

/**
 * Everything an admin can legitimately do to get the order onto documents, using
 * ORDINARY invoices only: ship what is left, then invoice every delivery that
 * does not already have a live document.
 *
 * Advance invoices are deliberately not used. An advance is a different kind of
 * document — the workaround the audit found, and the reason finding 4 is a
 * finding rather than an inconvenience.
 */
function billEverythingWithRegularInvoices(orderId: string, log: string[]): void {
  const shippable = mockPlanOrderShipment(orderId)
    .filter((l) => l.shippable > 0)
    .map((l) => ({ lineId: l.lineId, quantity: l.shippable }))
  if (shippable.length > 0) {
    const shipment = mockCreateShipment(orderId, { lines: shippable })
    say(log, 'shipped the remainder', shipment.number)
  }
  for (const shipment of mockGetOrder(orderId)!.shipments) {
    if (shipment.cancelled) continue
    try {
      const invoice = mockCreateInvoice(orderId, { kind: 'regular', shipmentId: shipment.id })
      say(log, `regular invoice for ${shipment.number}`, invoice.amountNet)
    } catch (e) {
      say(log, `regular invoice for ${shipment.number}`, `refused: ${(e as Error).message}`)
    }
  }
}

const HOW = [
  '',
  'The order must end up entirely on ordinary documents. Either an invoice',
  'issued while a service is unbilled carries it, or the withdrawal that',
  'unbilled it puts it back on a document that can. An advance invoice does',
  'not count: it is a document of a different kind.',
].join('\n')

// ─── Finding 7 — a service added after the first invoice ────────────────────

describe('FINDING 7 — a service added after the services invoice', () => {
  it('reaches a document like any other line', () => {
    const log: string[] = []
    const productId = stocked(4)
    const svc = allServices()[0]!.id
    const order = fresh()

    const a = mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    const b = mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    mockAddOrderService(order.id, { serviceId: svc, quantity: 1, price: 100 })

    const shipA = mockCreateShipment(order.id, { lines: [{ lineId: a.id, quantity: 2 }] })
    const inv1 = mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shipA.id })
    say(log, 'invoice 1 (goods 200 + service 100)', inv1.amountNet)

    // Model §6: a live order may grow. For goods this works — the new line
    // leaves on its own truck and lands on its own invoice.
    mockAddOrderService(order.id, { serviceId: svc, quantity: 1, price: 450 })
    say(log, 'service added after invoice 1', 450)

    const shipB = mockCreateShipment(order.id, { lines: [{ lineId: b.id, quantity: 2 }] })
    const inv2 = mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shipB.id })
    say(log, 'invoice 2 (goods 200 + ?)', inv2.amountNet)

    const after = mockGetOrder(order.id)!
    say(log, 'order', after.totalAmount)
    say(log, 'billed', billedNet(after))
    say(log, 'nothing left to ship', mockPlanOrderShipment(order.id).length === 0)

    expect(after.totalAmount, 'the order is worth its own lines').toBe(netOf(after))
    expect(
      billedNet(after),
      `everything shipped and invoiced, yet the order is not on paper:\n${log.join('\n')}${HOW}`,
    ).toBe(after.totalAmount)
  })

  /**
   * The second head of the same finding. A correction anywhere in the order runs
   * `refreshDocumentFreeze`, which freezes EVERY service as soon as any live
   * invoice says `coversServices` — including one added after that invoice was
   * issued, which it never charged for. The line then cannot be removed or
   * repriced, and the money on it is on no document.
   */
  it('leaves a service no document has charged for editable', () => {
    const log: string[] = []
    const productId = stocked(4)
    const svc = allServices()[0]!.id
    const order = fresh()

    const a = mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    mockAddOrderService(order.id, { serviceId: svc, quantity: 1, price: 100 })
    const shipA = mockCreateShipment(order.id, { lines: [{ lineId: a.id, quantity: 2 }] })
    say(
      log,
      'invoice 1 (goods 200 + service 100)',
      mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shipA.id }).amountNet,
    )

    const late = mockAddOrderService(order.id, { serviceId: svc, quantity: 1, price: 450 })
    say(log, 'service added after invoice 1', 450)

    // Any correction in the order re-derives the freeze.
    mockCorrectOrderLine(order.id, a.id, { unitPrice: 110, reason: 'the price was agreed lower' })
    const after = mockGetOrder(order.id)!
    say(log, 'after a price correction, order', after.totalAmount)
    say(log, 'billed', billedNet(after))

    expect(
      billedNet(after) < after.totalAmount,
      `the stand is wrong — the late service is expected to be unbilled here:\n${log.join('\n')}`,
    ).toBe(true)
    expect(
      () => mockDeleteOrderService(order.id, late.id),
      `no document has charged for this service, yet it is frozen as if one had:\n${log.join('\n')}\n` +
        '\nA document freezes the lines it billed and no others. Whichever way the\n' +
        'fix records "already billed", it has to be per service — a flag derived\n' +
        'from "some live invoice covers services" freezes lines that invoice\n' +
        'predates.',
    ).not.toThrow()
  })
})

// ─── Finding 4 — the carrying invoice is withdrawn ──────────────────────────

describe('FINDING 4 — the invoice that carried the service is withdrawn', () => {
  it('leaves the service billable on an ordinary invoice', () => {
    const log: string[] = []
    const productId = stocked(4)
    const order = fresh()

    const a = mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    const b = mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    mockAddOrderService(order.id, { serviceId: allServices()[0]!.id, quantity: 1, price: 302.5 })

    const shipA = mockCreateShipment(order.id, { lines: [{ lineId: a.id, quantity: 2 }] })
    const inv1 = mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shipA.id })
    say(log, 'invoice 1 (goods 200 + service 302,50)', inv1.amountNet)
    const shipB = mockCreateShipment(order.id, { lines: [{ lineId: b.id, quantity: 2 }] })
    const inv2 = mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shipB.id })
    say(log, 'invoice 2 (goods 200)', inv2.amountNet)

    // The first delivery comes back. Its document is withdrawn by a correcting
    // one, and the service it carried is unbilled again.
    mockCancelShipment(order.id, shipA.id, { correctionReason: 'the client refused the delivery' })
    say(log, 'shipment 1 cancelled, invoice 1 withdrawn', billedNet(mockGetOrder(order.id)!))
    mockDeleteOrderItem(order.id, a.id)
    say(log, 'the returned line deleted, order', mockGetOrder(order.id)!.totalAmount)

    billEverythingWithRegularInvoices(order.id, log)

    const after = mockGetOrder(order.id)!
    say(log, 'order', after.totalAmount)
    say(log, 'billed', billedNet(after))

    expect(after.totalAmount, 'the order is worth its own lines').toBe(netOf(after))
    expect(
      billedNet(after),
      `the service cannot be put on any ordinary invoice:\n${log.join('\n')}${HOW}`,
    ).toBe(after.totalAmount)
  })
})

// ─── Guards — what already works and the fix must not break ─────────────────

describe('services on documents — what already holds', () => {
  it('bills a service exactly once when the order ships in two deliveries', () => {
    const log: string[] = []
    const productId = stocked(4)
    const order = fresh()
    const a = mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    const b = mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })
    mockAddOrderService(order.id, { serviceId: allServices()[0]!.id, quantity: 1, price: 302.5 })

    const shipA = mockCreateShipment(order.id, { lines: [{ lineId: a.id, quantity: 2 }] })
    say(
      log,
      'invoice 1',
      mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shipA.id }).amountNet,
    )
    const shipB = mockCreateShipment(order.id, { lines: [{ lineId: b.id, quantity: 2 }] })
    say(
      log,
      'invoice 2',
      mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shipB.id }).amountNet,
    )

    const after = mockGetOrder(order.id)!
    say(log, 'order', after.totalAmount)
    say(log, 'billed', billedNet(after))
    expect(
      billedNet(after),
      `a service must be billed once, not twice and not never:\n${log.join('\n')}`,
    ).toBe(after.totalAmount)
  })
})
