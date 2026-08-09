import { describe, it, expect } from 'vitest'
import {
  applyLineEdit,
  canEditLineField,
  deltaToOps,
  lineEditDelta,
  lineEditErrorKey,
  lineKindOf,
  type LineEditOp,
} from './orderLineEdits'
import {
  mockAddOrderItem,
  mockAddOrderService,
  mockCreateOrder,
  mockGetOrder,
  mockPatchOrder,
  mockUpdateOrderItem,
  mockUpdateOrderService,
} from './mocks/orders'
import { mockGetClients } from './mocks/clients'
import { batchesForProduct } from './mocks/warehouse'
import type { Order, OrderItem, OrderService } from '@/types/order'
import type { PricingLine } from '@/domain/orderPricing'

/**
 * The shelf these fixtures price against.
 *
 * A cost is the warehouse's answer and the orders API takes none from the body
 * (contract §4.2), so the 100,00 every line here has always been costed at is
 * stated where a cost actually lives: on the batches behind the product. The
 * lines below then get exactly the same figure they used to be handed, only by
 * the route a real client has.
 */
const STOCK_UNIT_COST = 100
for (const batch of batchesForProduct('prod-001')) {
  batch.unitPrice = STOCK_UNIT_COST
  batch.totalCost = batch.quantity * STOCK_UNIT_COST
}

/**
 * A catalogue product the warehouse holds nothing of.
 *
 * It has to be a real one: an id the catalogue does not know is refused outright
 * (`CATALOG_PRODUCT_NOT_FOUND`), so "no stock" cannot be expressed by inventing
 * a product — only by naming one whose shelf is empty.
 */
const PRODUCT_OUT_OF_STOCK = 'prod-043'

function freshOrder(): Order {
  const client = mockGetClients()[0]!
  return mockCreateOrder({ clientId: client.id, documentType: 'local' })
}

/** An order with one goods line and one service line, both untouched. */
function orderWithLines(quantity = 10, unitPrice = 120) {
  const created = freshOrder()
  const item = mockAddOrderItem(created.id, {
    productId: 'prod-001',
    quantity,
    unit: 'pcs',
    unitPrice,
  })
  const svc = mockAddOrderService(created.id, { serviceId: 'svc-001', quantity: 2, price: 60 })
  return { orderId: created.id, item, svc }
}

/** A line whose cost has a batch behind it — the only kind a reset can undo. */
function orderWithBatchLine() {
  const created = freshOrder()
  const itemWithBatch = mockAddOrderItem(created.id, {
    productId: 'prod-001',
    quantity: 10,
    unit: 'pcs',
    unitPrice: 120,
  })
  return { orderId: created.id, itemWithBatch }
}

function copy<T>(value: T): T {
  return structuredClone(value)
}

/**
 * The invariant the editable table stands on: the client applies an edit locally
 * for immediate feedback, and sends the same edit on Save. If those two ever
 * disagreed, a deferred save would hide it until the next reload.
 */
function expectSameOnBothSides(op: LineEditOp, quantity = 10, unitPrice = 120) {
  const { orderId, item } = orderWithLines(quantity, unitPrice)
  const local = copy(item)

  applyLineEdit(local, op, { defaultDiscountPercent: 0 })
  const stored = mockUpdateOrderItem(orderId, item.id, lineEditDelta(op, 'item'))

  expect(local).toEqual(stored)
}

describe('one edit, applied the same way on both sides', () => {
  it('quantity', () => {
    expectSameOnBothSides({ field: 'quantity', value: 4 })
  })

  it('unit price', () => {
    expectSameOnBothSides({ field: 'unitPrice', value: 111.5 })
  })

  it('line total', () => {
    expectSameOnBothSides({ field: 'lineTotal', value: 999.99 })
  })

  it('discount', () => {
    expectSameOnBothSides({ field: 'discountPercent', value: 7.5 })
  })

  it('planned margin', () => {
    expectSameOnBothSides({ field: 'marginPercent', value: 33.5 })
  })

  it('manual cost with a reason', () => {
    expectSameOnBothSides({ field: 'unitCost', value: 105, reason: 'Supplier invoice' })
  })

  it('reset to the computed price, re-applying the order default', () => {
    const { orderId, item } = orderWithLines()
    // The order default is what "computed" means, and the server reads it from
    // its own copy — which is why the card saves the fields before the edits.
    mockPatchOrder(orderId, { defaultDiscountPercent: 3 })
    mockUpdateOrderItem(orderId, item.id, lineEditDelta({ field: 'unitPrice', value: 90 }, 'item'))
    const priced = mockGetOrder(orderId)!.items[0]!
    expect(priced.manualUnitPrice).not.toBeNull()

    const local = copy(priced)
    applyLineEdit(local, { field: 'resetPrice' }, { defaultDiscountPercent: 3 })
    const stored = mockUpdateOrderItem(
      orderId,
      item.id,
      lineEditDelta({ field: 'resetPrice' }, 'item'),
    )

    expect(local).toEqual(stored)
    expect(stored.manualUnitPrice).toBeNull()
    expect(stored.discountPercent).toBe(3)
  })

  it('reset of a manual cost, back to the warehouse figure', () => {
    const { orderId, itemWithBatch } = orderWithBatchLine()
    mockUpdateOrderItem(orderId, itemWithBatch.id, {
      manualUnitCost: 140,
      manualCostReason: 'Typed by hand',
    })
    const manual = mockGetOrder(orderId)!.items[0]!
    expect(manual.costSource).toBe('manual')
    expect(manual.unitCost).toBe(140)

    const local = copy(manual)
    applyLineEdit(local, { field: 'resetCost' }, { defaultDiscountPercent: 0 })
    const stored = mockUpdateOrderItem(orderId, itemWithBatch.id, { manualUnitCost: null })

    expect(local).toEqual(stored)
    expect(stored.manualCostReason).toBeNull()
    expect(stored.costSource).toBe('stock')
    expect(stored.unitCost).toBe(100)
  })

  it('a second cost edit keeps the reason already on the line', () => {
    // The reason says why this cost is hand-entered at all, not what the exact
    // number is, so a follow-up correction does not have to repeat it. The card
    // still shows it prefilled, which is where it gets rewritten.
    const { orderId, item } = orderWithLines()
    mockUpdateOrderItem(orderId, item.id, {
      manualUnitCost: 120,
      manualCostReason: 'Batch not booked in',
    })
    const first = mockGetOrder(orderId)!.items[0]!

    const local = copy(first)
    const op: LineEditOp = { field: 'unitCost', value: 130 }
    applyLineEdit(local, op, { defaultDiscountPercent: 0 })
    const stored = mockUpdateOrderItem(orderId, item.id, lineEditDelta(op, 'item'))

    expect(local).toEqual(stored)
    expect(stored.unitCost).toBe(130)
    expect(stored.manualCostReason).toBe('Batch not booked in')
  })

  it('a service line — same rules, cost taken directly', () => {
    const { orderId, svc } = orderWithLines()
    const op: LineEditOp = { field: 'unitCost', value: 25 }
    const local = copy(svc)

    applyLineEdit(local, op, { defaultDiscountPercent: 0 })
    const stored = mockUpdateOrderService(orderId, svc.id, lineEditDelta(op, 'service'))

    expect(local).toEqual(stored)
    expect(stored.unitCost).toBe(25)
    expect(stored.cost).toBe(25)
  })

  it('a shrinking quantity trims the batch breakdown on both sides', () => {
    const { orderId, itemWithBatch } = orderWithBatchLine()
    expect(itemWithBatch.allocations.length).toBeGreaterThan(0)
    const local = copy(itemWithBatch)

    applyLineEdit(local, { field: 'quantity', value: 3 }, { defaultDiscountPercent: 0 })
    const stored = mockUpdateOrderItem(orderId, itemWithBatch.id, { quantity: 3 })

    expect(local).toEqual(stored)
    const allocated = stored.allocations.reduce((sum, a) => sum + a.quantity, 0)
    expect(allocated).toBeLessThanOrEqual(3)
  })
})

describe('the order of edits is part of the edit', () => {
  it('margin then price keeps the manual price; price then margin clears it', () => {
    const { item } = orderWithLines()

    const marginFirst = copy(item)
    applyLineEdit(marginFirst, { field: 'marginPercent', value: 50 }, { defaultDiscountPercent: 0 })
    applyLineEdit(marginFirst, { field: 'unitPrice', value: 130 }, { defaultDiscountPercent: 0 })

    const priceFirst = copy(item)
    applyLineEdit(priceFirst, { field: 'unitPrice', value: 130 }, { defaultDiscountPercent: 0 })
    applyLineEdit(priceFirst, { field: 'marginPercent', value: 50 }, { defaultDiscountPercent: 0 })

    expect(marginFirst.manualUnitPrice).toBe(130)
    expect(marginFirst.unitPrice).toBe(130)
    // A margin edit is a rule, not a price: it releases the lock and reprices.
    expect(priceFirst.manualUnitPrice).toBeNull()
    expect(priceFirst.unitPrice).toBe(150)
  })

  it('is why edits go out one at a time and not as one accumulated delta', () => {
    const { orderId, item } = orderWithLines()
    // Sent as a single delta, the server can only apply a documented order —
    // margin before price — whatever the admin actually did.
    const stored = mockUpdateOrderItem(orderId, item.id, {
      marginPercent: 50,
      manualUnitPrice: 130,
    })
    expect(stored.manualUnitPrice).toBe(130)
  })
})

describe('a refused edit changes nothing', () => {
  it('leaves the local line untouched when the price is frozen', () => {
    const { item } = orderWithLines()
    const frozen = { ...copy(item), documentIssued: true }
    const before = copy(frozen)

    expect(() =>
      applyLineEdit(frozen, { field: 'unitPrice', value: 99 }, { defaultDiscountPercent: 0 }),
    ).toThrow('PRICE_FROZEN_BY_SHIPMENT')
    expect(frozen).toEqual(before)
  })

  it('writes no manual-cost marker when the reason is missing', () => {
    const { item } = orderWithLines()
    const local = copy(item)

    expect(() =>
      applyLineEdit(local, { field: 'unitCost', value: 130 }, { defaultDiscountPercent: 0 }),
    ).toThrow('MANUAL_COST_REASON_REQUIRED')
    expect(local.manualUnitCost).toBeNull()
    expect(local.manualCostReason).toBeNull()
    expect(local.unitCost).toBe(100)
  })

  it('keeps the stored line whole when one edit in a delta is refused', () => {
    const { orderId, item } = orderWithLines()

    expect(() =>
      mockUpdateOrderItem(orderId, item.id, { marginPercent: 40, discountPercent: 150 }),
    ).toThrow('DISCOUNT_OUT_OF_RANGE')

    const after = mockGetOrder(orderId)!.items[0]!
    expect(after.marginPercent).toBe(item.marginPercent)
    expect(after.discountPercent).toBe(item.discountPercent)
    expect(after.unitPrice).toBe(item.unitPrice)
  })

  it('refuses to reset a cost with no warehouse figure behind it', () => {
    // ORD-007's case: the batch was never booked in, which is exactly why the
    // cost was typed. Clearing the marker would leave a hand-typed number
    // claiming to come from the warehouse.
    const created = freshOrder()
    const item = mockAddOrderItem(created.id, {
      productId: PRODUCT_OUT_OF_STOCK,
      quantity: 10,
      unit: 'pcs',
      unitPrice: 120,
    })
    const orderId = created.id
    mockUpdateOrderItem(orderId, item.id, { manualUnitCost: 140, manualCostReason: 'No batch yet' })
    const manual = mockGetOrder(orderId)!.items[0]!
    expect(manual.allocations).toEqual([])

    const local = copy(manual)
    expect(() =>
      applyLineEdit(local, { field: 'resetCost' }, { defaultDiscountPercent: 0 }),
    ).toThrow('NO_STOCK_COST')
    expect(local.manualUnitCost).toBe(140)
    expect(local.manualCostReason).toBe('No batch yet')
    expect(() => mockUpdateOrderItem(orderId, item.id, { manualUnitCost: null })).toThrow(
      'NO_STOCK_COST',
    )
  })

  it('refuses to reset the cost of a line that has shipped', () => {
    const { orderId, itemWithBatch } = orderWithBatchLine()
    mockUpdateOrderItem(orderId, itemWithBatch.id, {
      manualUnitCost: 140,
      manualCostReason: 'Typed by hand',
    })
    const frozen = { ...copy(mockGetOrder(orderId)!.items[0]!), documentIssued: true }
    const before = copy(frozen)

    expect(() =>
      applyLineEdit(frozen, { field: 'resetCost' }, { defaultDiscountPercent: 0 }),
    ).toThrow('COST_FROZEN_BY_SHIPMENT')
    expect(frozen).toEqual(before)
  })

  it('refuses to reset a cost a service never read off the warehouse', () => {
    const { svc } = orderWithLines()
    const local = copy(svc)
    expect(() =>
      applyLineEdit(local, { field: 'resetCost' }, { defaultDiscountPercent: 0 }),
    ).toThrow('RESET_COST_NOT_SUPPORTED')
  })
})

describe('which cells the table opens', () => {
  const draft: PricingLine = {
    id: 'l1',
    quantity: 10,
    unitCost: 100,
    costSource: 'stock',
    marginPercent: 20,
    discountPercent: 0,
    manualUnitPrice: null,
    state: 'draft',
    shippedQuantity: 0,
    documentIssued: false,
  }

  it('opens everything on a draft line', () => {
    for (const field of [
      'quantity',
      'unitPrice',
      'lineTotal',
      'discountPercent',
      'marginPercent',
      'unitCost',
      'resetPrice',
      'resetCost',
    ] as const) {
      expect(canEditLineField(draft, field)).toBe(true)
    }
  })

  it('keeps the quantity open on a partially shipped line, but not the money', () => {
    const partial: PricingLine = { ...draft, state: 'partially_shipped', shippedQuantity: 6 }
    expect(canEditLineField(partial, 'quantity')).toBe(true)
    expect(canEditLineField(partial, 'unitPrice')).toBe(false)
    expect(canEditLineField(partial, 'discountPercent')).toBe(false)
    expect(canEditLineField(partial, 'unitCost')).toBe(false)
  })

  it('closes everything once the line has fully shipped', () => {
    const shipped: PricingLine = { ...draft, state: 'shipped', shippedQuantity: 10 }
    expect(canEditLineField(shipped, 'quantity')).toBe(false)
    expect(canEditLineField(shipped, 'unitPrice')).toBe(false)
    expect(canEditLineField(shipped, 'unitCost')).toBe(false)
  })

  it('closes the percentages on a line priced outright, keeps price and quantity', () => {
    // No cost means no computed price, and both percentages are shares of it.
    const noCost: PricingLine = { ...draft, unitCost: 0, marginPercent: 0, manualUnitPrice: 5 }
    expect(canEditLineField(noCost, 'marginPercent')).toBe(false)
    expect(canEditLineField(noCost, 'discountPercent')).toBe(false)
    expect(canEditLineField(noCost, 'resetPrice')).toBe(false)
    expect(canEditLineField(noCost, 'unitPrice')).toBe(true)
    expect(canEditLineField(noCost, 'lineTotal')).toBe(true)
    expect(canEditLineField(noCost, 'quantity')).toBe(true)
  })

  it('closes the money on a service whose invoice is out', () => {
    const invoiced: PricingLine = { ...draft, documentIssued: true }
    expect(canEditLineField(invoiced, 'unitPrice')).toBe(false)
    expect(canEditLineField(invoiced, 'unitCost')).toBe(false)
    // The document covers the quantity too (contract §4.2). This line used to say
    // the opposite — "nothing has shipped, so the quantity is still a live
    // question" — which is true of goods and false of a service: a service never
    // ships, so shipped quantity was never going to close it. The invoiced 302,50
    // service could be set to zero, leaving the order at 200,00 against a document
    // for 502,50 the client is holding.
    expect(canEditLineField(invoiced, 'quantity')).toBe(false)
  })
})

describe('the wire format round-trips', () => {
  const ops: LineEditOp[] = [
    { field: 'quantity', value: 4 },
    { field: 'unitPrice', value: 111.5 },
    { field: 'lineTotal', value: 900 },
    { field: 'discountPercent', value: 7.5 },
    { field: 'marginPercent', value: 33.5 },
    { field: 'unitCost', value: 105, reason: 'Supplier invoice' },
    { field: 'resetPrice' },
    { field: 'resetCost' },
  ]

  it('turns every goods edit into a delta and back', () => {
    for (const op of ops) {
      expect(deltaToOps(lineEditDelta(op, 'item'), 'item')).toEqual([op])
    }
  })

  it('turns every service edit into a delta and back', () => {
    for (const op of ops.filter((o) => o.field !== 'resetCost')) {
      const expected = op.field === 'unitCost' ? [{ field: 'unitCost', value: op.value }] : [op]
      expect(deltaToOps(lineEditDelta(op, 'service'), 'service')).toEqual(expected)
    }
  })

  it('reads a null price as no edit at all, not as an unlock', () => {
    expect(deltaToOps({ manualUnitPrice: null }, 'item')).toEqual([])
  })

  it('reads a multi-field delta in the documented order', () => {
    expect(deltaToOps({ manualUnitPrice: 130, quantity: 5, marginPercent: 40 }, 'item')).toEqual([
      { field: 'quantity', value: 5 },
      { field: 'marginPercent', value: 40 },
      { field: 'unitPrice', value: 130 },
    ])
  })

  it('tells goods from services without being told', () => {
    const { item, svc } = orderWithLines()
    expect(lineKindOf(item as OrderItem)).toBe('item')
    expect(lineKindOf(svc as OrderService)).toBe('service')
  })
})

describe('every refusal reaches the admin as a sentence', () => {
  it.each([
    ['PRICE_FROZEN_BY_SHIPMENT', 'orders.error_line_price_frozen'],
    ['COST_FROZEN_BY_SHIPMENT', 'orders.error_line_cost_frozen'],
    ['LINE_FULLY_SHIPPED', 'orders.error_line_fully_shipped'],
    ['BELOW_SHIPPED_QUANTITY', 'orders.error_below_shipped'],
    ['DISCOUNT_OUT_OF_RANGE', 'orders.error_discount_range'],
    ['MARGIN_OUT_OF_RANGE', 'orders.error_margin_range'],
    ['ZERO_QUANTITY', 'orders.error_zero_quantity'],
    ['MANUAL_COST_REASON_REQUIRED', 'orders.error_cost_reason_required'],
    ['RESET_COST_NOT_SUPPORTED', 'orders.error_reset_cost_unsupported'],
    ['SPLIT_MUST_MATCH_SHIPPED', 'orders.error_split_not_possible'],
    ['INVALID_SPLIT_QUANTITY', 'orders.error_split_not_possible'],
    ['NEGATIVE_QUANTITY', 'orders.error_negative_value'],
    ['NEGATIVE_PRICE', 'orders.error_negative_value'],
    ['NEGATIVE_COST', 'orders.error_negative_value'],
  ])('%s', (code, key) => {
    expect(lineEditErrorKey(new Error(code))).toBe(key)
  })

  it('falls back to a generic save error rather than showing a code', () => {
    expect(lineEditErrorKey(new Error('SOMETHING_NOBODY_MAPPED'))).toBe('orders.toast_error_save')
    expect(lineEditErrorKey('a string nobody mapped')).toBe('orders.toast_error_save')
  })
})
