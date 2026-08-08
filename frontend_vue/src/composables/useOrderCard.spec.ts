/**
 * Applying the order's percentages to every line.
 *
 * The rule this file exists to hold: it is a LINE EDIT, not a server action. It
 * reaches lines that have never been saved, it writes nothing until Save, and
 * Discard takes it back off — the same contract as typing a margin into the
 * table by hand. It used to be a write-then-reload, which could not be done at
 * all while an unsaved line was on screen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

const toasts = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
vi.mock('@/composables/useToast', () => ({ useToast: () => toasts }))

vi.mock('@/composables/useTranslatedData', () => ({
  useTranslatedField: () => ({ tf: (v: unknown) => String(v) }),
}))

vi.mock('@/composables/useSettings', () => ({
  useSettings: () => ({
    settings: {
      constants: {
        vatRate: 21,
        defaultMargin: 15,
        defaultCurrency: 'EUR',
        defaultDiscountPercent: 0,
      },
    },
  }),
}))

/** Every write the card could make, in the order it made them. */
const calls: Array<{ fn: string; lineId?: string; payload?: Record<string, unknown> }> = []

let stored: import('@/types/order').Order

/** Makes the next line-edit request fail, the way a dropped connection would. */
const failUpdateOnce = { on: false }

vi.mock('@/services/ordersService', () => ({
  getOrder: vi.fn(async () => structuredClone(stored)),
  patchOrder: vi.fn(async (_id: string, payload: Record<string, unknown>) => {
    calls.push({ fn: 'patchOrder', payload })
    Object.assign(stored, payload)
    return {}
  }),
  addOrderItem: vi.fn(async (_id: string, payload: Record<string, unknown>) => {
    calls.push({ fn: 'addOrderItem', payload })
    return { id: 'item-server' }
  }),
  updateOrderItem: vi.fn(async (_id: string, lineId: string, payload: Record<string, unknown>) => {
    if (failUpdateOnce.on) {
      failUpdateOnce.on = false
      throw new Error('NETWORK_DOWN')
    }
    calls.push({ fn: 'updateOrderItem', lineId, payload })
    return {}
  }),
  updateOrderService: vi.fn(
    async (_id: string, lineId: string, payload: Record<string, unknown>) => {
      calls.push({ fn: 'updateOrderService', lineId, payload })
      return {}
    },
  ),
  addOrderService: vi.fn(async () => ({ id: 'svc-server' })),
  deleteOrderItem: vi.fn(async (_id: string, lineId: string) => {
    calls.push({ fn: 'deleteOrderItem', lineId })
    return {}
  }),
  deleteOrderService: vi.fn(async (_id: string, lineId: string) => {
    calls.push({ fn: 'deleteOrderService', lineId })
    return {}
  }),
  deleteOrder: vi.fn(async () => ({})),
  deleteOrderAuditEntry: vi.fn(async () => ({})),
  addOrderFile: vi.fn(async () => ({})),
  removeOrderFile: vi.fn(async () => ({})),
  patchOrderStatus: vi.fn(async () => ({})),
  planOrderStatus: vi.fn(async () => ({})),
  planOrderShipment: vi.fn(async () => []),
  getOrderShipments: vi.fn(async () => []),
  createOrderShipment: vi.fn(async () => ({})),
  cancelOrderShipment: vi.fn(async () => ({})),
  createOrderInvoice: vi.fn(async () => ({})),
  addOrderPayment: vi.fn(async () => ({})),
  deleteOrderPayment: vi.fn(async () => ({})),
  reserveOrderStock: vi.fn(async () => ({})),
  splitOrderItem: vi.fn(async () => ({})),
  correctOrderLine: vi.fn(async (_id: string, lineId: string, payload: Record<string, unknown>) => {
    calls.push({ fn: 'correctOrderLine', lineId, payload })
    return {}
  }),
  allocateOrderTotal: vi.fn(async () => ({})),
}))

vi.mock('@/services/warehouseService', () => ({
  // No batch for the new line: it falls back to the cost the picker passed.
  getBatchCostBreakdown: vi.fn(async () => {
    throw new Error('NO_STOCK')
  }),
}))

import { useOrderCard } from './useOrderCard'
import { buildOrderItem } from '@/services/orderLines'
import type { Order } from '@/types/order'

/** A line agreed by hand: 40% margin, no discount. The defaults are 15% / 10%. */
function savedOrder(): Order {
  const item = buildOrderItem({
    id: 'item-1',
    lineNumber: 1,
    productId: 'prod-alu',
    productName: 'Aluminium Pipe 25x2',
    quantity: 10,
    unit: 'm',
    unitCost: 8,
    marginPercent: 40,
    discountPercent: 0,
    receivedCurrency: 'cur-eur',
    exchangeRate: 1,
  })
  return {
    id: 'ORD-1',
    orderNumber: 'ORD-1',
    clientId: 'cli-1',
    clientName: 'Client',
    clientVatCode: '',
    clientAddress: '',
    documentType: 'local',
    status: 'new',
    items: [item],
    services: [],
    defaultMarginPercent: 15,
    defaultDiscountPercent: 10,
    vatMode: 'standard',
    vatPercent: 21,
    currency: 'EUR',
    totalCost: 0,
    totalAmount: 0,
    totalVat: 0,
    totalWithVat: 0,
    actualMarginPercent: 0,
    effectiveDiscountPercent: 0,
    paidAmount: 0,
    paidPercent: 0,
    outstandingAmount: 0,
    totalWeight: 0,
    shipments: [],
    invoices: [],
    payments: [],
    notes: null,
    documents: [],
    files: [],
    auditLog: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  }
}

const COPPER = {
  productId: 'prod-cu',
  productName: 'Copper Pipe 15x1',
  quantity: 2,
  unit: 'm',
  unitPrice: 30,
  unitCost: 20,
}

async function loadedCard() {
  const card = useOrderCard('ORD-1')
  await card.load()
  return card
}

beforeEach(() => {
  failUpdateOnce.on = false
  calls.length = 0
  toasts.error.mockClear()
  toasts.success.mockClear()
  stored = savedOrder()
})

describe('applying the order percentages to every line', () => {
  it('reaches a line that has not been saved yet, and writes nothing', async () => {
    const card = await loadedCard()
    await card.handleAddItemDirect(COPPER)
    expect(card.order.value!.items).toHaveLength(2)
    calls.length = 0

    card.requestApplyDefaults()

    expect(toasts.error).not.toHaveBeenCalled()
    // Both lines — the saved one and the one still only on screen.
    expect(card.defaultsPreview.value?.lineCount).toBe(2)

    card.applyDefaultsToAllLines()

    for (const line of card.order.value!.items) {
      expect(line.marginPercent).toBe(15)
      expect(line.discountPercent).toBe(10)
      // A margin is a rule, so the price goes back to being computed.
      expect(line.manualUnitPrice).toBeNull()
      expect(line.unitPrice).toBeCloseTo(line.unitCost * 1.15 * 0.9, 6)
    }
    // Nothing reached the server: this is an edit, not an action.
    expect(calls).toEqual([])
  })

  it('promises the total it then produces', async () => {
    const card = await loadedCard()
    await card.handleAddItemDirect(COPPER)

    card.requestApplyDefaults()
    const { before, after: promised } = card.defaultsPreview.value!
    // A 40% line dropping to 15% less 10% is a real move, so the check below is
    // about the promise and not about two numbers that were equal anyway.
    expect(promised).toBeLessThan(before)

    card.applyDefaultsToAllLines()

    expect(card.totals.value.totalGross).toBeCloseTo(promised, 6)
    expect(before).toBeCloseTo(
      // What it was: the hand-agreed line at 10 × 8 +40%, and the new one at
      // 2 × 20 marked up to the picker's 30 and then given the order's default
      // 10% discount on the way in. Plus VAT.
      (10 * 8 * 1.4 + 2 * 20 * 1.5 * 0.9) * 1.21,
      2,
    )
  })

  it('refuses out-of-range percentages before it moves a single line', async () => {
    const card = await loadedCard()
    const priceBefore = card.order.value!.items[0]!.unitPrice

    card.form.value.defaultDiscountPercent = 150
    card.requestApplyDefaults()

    expect(card.defaultsPreview.value).toBeNull()
    expect(toasts.error).toHaveBeenCalledWith('orders.error_discount_range')
    expect(card.order.value!.items[0]!.unitPrice).toBe(priceBefore)
  })

  it('goes out with Save: the new line is created, then both lines are repriced', async () => {
    const card = await loadedCard()
    await card.handleAddItemDirect(COPPER)
    card.requestApplyDefaults()
    card.applyDefaultsToAllLines()
    calls.length = 0

    await card.save()

    expect(calls.map((c) => c.fn)).toEqual([
      'addOrderItem',
      'updateOrderItem',
      'updateOrderItem',
      'updateOrderItem',
      'updateOrderItem',
    ])
    // The edits on the new line go to the id the server issued, not the temp one.
    const targets = calls.filter((c) => c.fn === 'updateOrderItem').map((c) => c.lineId)
    expect(new Set(targets)).toEqual(new Set(['item-1', 'item-server']))
    // Discount first, margin second — the order is what leaves the price computed.
    for (const id of ['item-1', 'item-server']) {
      const forLine = calls.filter((c) => c.lineId === id).map((c) => c.payload)
      expect(forLine).toEqual([{ discountPercent: 10 }, { marginPercent: 15 }])
    }
  })

  it('is taken back off by Discard', async () => {
    const card = await loadedCard()
    card.requestApplyDefaults()
    card.applyDefaultsToAllLines()
    expect(card.order.value!.items[0]!.marginPercent).toBe(15)

    await card.discard()

    expect(card.order.value!.items[0]!.marginPercent).toBe(40)
    expect(card.hasPendingChanges.value).toBe(false)
  })

  it('leaves alone a line that has no cost to mark up, and says how many', async () => {
    stored.items.push(
      buildOrderItem({
        id: 'item-2',
        lineNumber: 2,
        productId: 'prod-x',
        productName: 'Priced outright',
        quantity: 1,
        unit: 'pcs',
        unitCost: 0,
        marginPercent: 0,
        manualUnitPrice: 99,
        receivedCurrency: 'cur-eur',
        exchangeRate: 1,
      }),
    )
    const card = await loadedCard()

    card.requestApplyDefaults()
    expect(card.defaultsPreview.value).toMatchObject({ lineCount: 1, skipped: 1 })

    card.applyDefaultsToAllLines()

    const untouched = card.order.value!.items.find((i) => i.id === 'item-2')!
    expect(untouched.manualUnitPrice).toBe(99)
    expect(untouched.discountPercent).toBe(0)
  })

  it('can be applied again after the percentages change', async () => {
    const card = await loadedCard()
    card.requestApplyDefaults()
    card.applyDefaultsToAllLines()

    card.form.value.defaultMarginPercent = 25
    card.form.value.defaultDiscountPercent = 0
    card.requestApplyDefaults()
    card.applyDefaultsToAllLines()

    const line = card.order.value!.items[0]!
    expect(line.marginPercent).toBe(25)
    expect(line.discountPercent).toBe(0)
    // The second pass replaces the first rather than compounding on top of it.
    expect(line.unitPrice).toBeCloseTo(8 * 1.25, 6)
    expect(card.totals.value.totalNet).toBeCloseTo(10 * 8 * 1.25, 2)
  })
})

describe('a line the server created during a save that then failed', () => {
  it('is deleted by the id the server issued, not by the one on screen', async () => {
    const card = await loadedCard()
    await card.handleAddItemDirect(COPPER)
    const onScreenId = card.order.value!.items[1]!.id
    expect(onScreenId).toMatch(/^temp-/)
    // An edit to the line that was already there, so the save has somewhere to fail.
    card.editLine('item-1', 'item', { field: 'quantity', value: 12 })

    failUpdateOnce.on = true
    await card.save()

    // The new line exists on the server now; its pending entry is gone, so
    // nothing here can still tell that the row on screen was never saved.
    expect(calls.filter((c) => c.fn === 'addOrderItem')).toHaveLength(1)
    expect(card.pendingItems.value).toHaveLength(0)
    expect(toasts.error).toHaveBeenCalled()

    // The admin gives up on the line and removes it.
    calls.length = 0
    card.handleDeleteItem(onScreenId)
    await card.save()

    const deletion = calls.find((c) => c.fn === 'deleteOrderItem')
    // Sent raw, this named an id nobody had issued: the server accepted it as a
    // no-op, the card said "saved", and the reload brought the line back with the
    // order's total still counting it.
    expect(deletion?.lineId).toBe('item-server')
  })
})

describe('adding a product the warehouse cannot cost', () => {
  it('prices it outright instead of inventing a cost the server would not agree with', async () => {
    const card = await loadedCard()
    // No batches and no cost from the picker — the FIFO lookup has nothing to say.
    await card.handleAddItemDirect({
      productId: 'prod-none',
      productName: 'Never been in stock',
      quantity: 4,
      unit: 'pcs',
      unitPrice: 245,
    })

    const line = card.order.value!.items[1]!
    // Not 0.7 × 245 called "from stock" here and 0.75 × 245 called an estimate on
    // the server: the cost of the order, its margin and the 🔒 on the row all
    // moved the moment this line was saved.
    expect(line.unitCost).toBe(0)
    expect(line.costSource).toBe('estimate')
    expect(line.manualUnitPrice).toBe(245)
    expect(line.totalPrice).toBe(980)
    // The order's default discount is 10%, and a line with no cost takes none.
    expect(line.discountPercent).toBe(0)
    expect(card.pendingItems.value[0]!.discountPercent).toBe(0)
    // It stays out of the percentages, and the button says so.
    card.requestApplyDefaults()
    expect(card.defaultsPreview.value).toMatchObject({ lineCount: 1, skipped: 1 })
  })
})

describe('a line the freeze covers', () => {
  /** The saved line, shipped and on a document the client is holding. */
  function frozen() {
    stored.items[0]!.shippedQuantity = 10
    stored.items[0]!.state = 'shipped'
    stored.items[0]!.documentIssued = true
  }

  it('cannot be removed, and the refusal names what is in the way', async () => {
    frozen()
    const card = await loadedCard()

    card.handleDeleteItem('item-1')

    // It used to go: the order fell by the line while the waybill, the stock
    // movements and the client's invoice went on naming it.
    expect(card.order.value!.items).toHaveLength(1)
    expect(card.pendingItemDeletions.value).toEqual([])
    expect(toasts.error).toHaveBeenCalledWith('orders.error_line_has_shipment')
  })

  it('is removed freely again once nothing is holding it', async () => {
    const card = await loadedCard()
    card.handleDeleteItem('item-1')
    expect(card.order.value!.items).toHaveLength(0)
    expect(card.pendingItemDeletions.value).toEqual(['item-1'])
  })

  it('goes to the server for a correction, with the reason attached', async () => {
    frozen()
    const card = await loadedCard()
    calls.length = 0

    const ok = await card.correctLine('item-1', { unitPrice: 9, reason: 'Agreed at 9,00' })

    expect(ok).toBe(true)
    expect(calls.find((c) => c.fn === 'correctOrderLine')).toMatchObject({
      lineId: 'item-1',
      payload: { unitPrice: 9, reason: 'Agreed at 9,00' },
    })
  })

  it('will not correct on top of edits the server has not seen', async () => {
    frozen()
    const card = await loadedCard()
    await card.handleAddItemDirect(COPPER)
    calls.length = 0

    const ok = await card.correctLine('item-1', { unitPrice: 9, reason: 'Agreed at 9,00' })

    // The correction is measured against the price the server holds, and issues a
    // document from it. Run over an unsaved table, it would correct a figure
    // nobody has.
    expect(ok).toBe(false)
    expect(calls.filter((c) => c.fn === 'correctOrderLine')).toEqual([])
    expect(toasts.error).toHaveBeenCalledWith('orders.error_save_lines_first')
  })
})
