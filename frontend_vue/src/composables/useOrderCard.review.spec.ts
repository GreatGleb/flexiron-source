/**
 * Regressions from the card review — `roo_code/plans/bugs/3.1-orders-card-bugs.md`.
 *
 * Stand: a real `useOrderCard` against the real mock store, so "what the card
 * shows" and "what the server holds" are compared directly rather than described.
 *
 * The trap in this stand, inherited from the concurrency spec next door:
 * `isDirty` is set inside a `watchEffect`, so an edit to `card.form.value.*`
 * needs an `await nextTick()` before anything that reads it — without one the
 * test reports agreement it never checked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
const toasts = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
vi.mock('@/composables/useToast', () => ({ useToast: () => toasts }))
vi.mock('@/composables/useTranslatedData', () => ({
  useTranslatedField: () => ({ tf: (v: unknown) => String(v) }),
}))
vi.mock('@/composables/useSettings', () => ({
  useSettings: () => ({
    settings: {
      constants: { vatRate: 21, defaultMargin: 15, defaultCurrency: 'EUR' },
    },
  }),
}))
/** How many times the card asked the server for the whole order — see БАГ-13. */
const calls = vi.hoisted(() => ({ getOrder: 0 }))

vi.mock('@/services/ordersService', async () => {
  const m = await import('@/services/mocks/orders')
  const wrap =
    <A extends unknown[], R>(fn: (...a: A) => R) =>
    async (...a: A) =>
      fn(...a)
  return {
    getOrder: async (id: string) => {
      calls.getOrder += 1
      return m.mockGetOrder(id)
    },
    createOrder: wrap(m.mockCreateOrder),
    patchOrder: wrap(m.mockPatchOrder),
    patchOrderStatus: wrap(m.mockPatchOrderStatus),
    planOrderStatus: wrap(m.mockPlanStatusTransition),
    deleteOrder: wrap(m.mockDeleteOrder),
    addOrderItem: wrap(m.mockAddOrderItem),
    updateOrderItem: wrap(m.mockUpdateOrderItem),
    deleteOrderItem: wrap(m.mockDeleteOrderItem),
    addOrderService: wrap(m.mockAddOrderService),
    updateOrderService: wrap(m.mockUpdateOrderService),
    deleteOrderService: wrap(m.mockDeleteOrderService),
    deleteOrderAuditEntry: wrap(m.mockDeleteOrderAuditEntry),
    addOrderFile: wrap(m.mockAddOrderFile),
    removeOrderFile: wrap(m.mockRemoveOrderFile),
    allocateOrderTotal: wrap(m.mockAllocateOrderTotal),
    splitOrderItem: wrap(m.mockSplitOrderItem),
    correctOrderLine: wrap(m.mockCorrectOrderLine),
    planOrderShipment: wrap(m.mockPlanOrderShipment),
    getOrderShipments: wrap(m.mockGetShipments),
    createOrderShipment: wrap(m.mockCreateShipment),
    cancelOrderShipment: wrap(m.mockCancelShipment),
    reserveOrderStock: wrap(m.mockReserveOrder),
    getOrderReservations: wrap(m.mockGetReservations),
    getOrderPayments: wrap(m.mockGetOrderPayments),
    addOrderPayment: wrap(m.mockAddOrderPayment),
    deleteOrderPayment: wrap(m.mockDeleteOrderPayment),
    getOrderInvoices: wrap(m.mockGetInvoices),
    createOrderInvoice: wrap(m.mockCreateInvoice),
  }
})
vi.mock('@/services/warehouseService', async () => {
  const w = await import('@/services/mocks/warehouse')
  return { getBatchCostBreakdown: async (p: string, q: number) => w.mockCalculateFifoCost(p, q) }
})

import { useOrderCard } from './useOrderCard'
import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockAddOrderService,
  mockCreateShipment,
  mockCreateInvoice,
  mockPatchOrder,
} from '@/services/mocks/orders'
import { mockGetClients } from '@/services/mocks/clients'

beforeEach(() => {
  for (const kind of ['success', 'error', 'info', 'warning'] as const) toasts[kind].mockClear()
})

function freshOrder(): string {
  const client = mockGetClients()[0]!
  return mockCreateOrder({ clientId: client.id, documentType: 'local' }).id
}

async function cardFor(orderId: string) {
  const card = useOrderCard(orderId)
  await card.load()
  return card
}

// ─── БАГ-04 — an emptied number field ───────────────────────────────────────

describe('a number field the admin cleared', () => {
  /**
   * `v-model.number` stores `NaN` for an empty box, and that value is both what
   * the rollup reads and what the save sends.
   *
   * It does not show up as `NaN` on screen — `roundTo` returns 0 for anything
   * non-finite, so a cleared VAT rate reads as a perfectly plausible "VAT 0.00,
   * gross = net". That is the quiet version of the fault, and the loud one is
   * the request: `useDirtyCheck.diff()` compares through JSON but RETURNS the
   * raw value, so the `NaN` itself goes out.
   */
  it('keeps the form fields numbers when a box is emptied', async () => {
    const orderId = freshOrder()
    const card = await cardFor(orderId)

    // What the browser writes into these fields when the boxes are emptied.
    card.form.value.vatPercent = Number.NaN
    card.form.value.defaultMarginPercent = Number.NaN
    card.form.value.defaultDiscountPercent = Number.NaN
    card.form.value.totalWeight = Number.NaN
    await nextTick()

    expect(Number.isFinite(card.form.value.vatPercent)).toBe(true)
    expect(Number.isFinite(card.form.value.defaultMarginPercent)).toBe(true)
    expect(Number.isFinite(card.form.value.defaultDiscountPercent)).toBe(true)
    expect(Number.isFinite(card.form.value.totalWeight)).toBe(true)
  })

  it('never sends NaN to the server', async () => {
    const orderId = freshOrder()
    const card = await cardFor(orderId)

    card.form.value.totalWeight = Number.NaN
    card.form.value.defaultMarginPercent = Number.NaN
    await nextTick()
    await card.save()

    // Refused input is refused input — but this must not be one, because there
    // is nothing wrong with clearing a box.
    expect(toasts.error).not.toHaveBeenCalled()
    const stored = mockGetOrder(orderId)!
    expect(Number.isFinite(stored.totalWeight)).toBe(true)
    expect(Number.isFinite(stored.defaultMarginPercent!)).toBe(true)
  })
})

// ─── БАГ-05 — actions that reload on top of unsaved work ────────────────────

describe('a server action that reloads the card', () => {
  /**
   * `load()` replaces the order, rewrites the form and re-captures the dirty
   * baseline. Three actions ran it on top of whatever the admin had typed: the
   * note vanished, the save bar went out, and nobody was told.
   */
  it('does not lose an unsaved note to a status change', async () => {
    const orderId = freshOrder()
    const card = await cardFor(orderId)

    card.form.value.notes = 'Ring the client before dispatch'
    await nextTick()
    expect(card.isDirty.value).toBe(true)

    await card.handleChangeStatus('confirmed')

    expect(mockGetOrder(orderId)!.status).toBe('confirmed')
    expect(mockGetOrder(orderId)!.notes).toBe('Ring the client before dispatch')
    expect(card.form.value.notes).toBe('Ring the client before dispatch')
  })

  it('does not lose an unsaved note to a reservation', async () => {
    const orderId = freshOrder()
    mockAddOrderItem(orderId, {
      productId: 'prod-001',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 100,
    })
    const card = await cardFor(orderId)

    card.form.value.notes = 'Hold for pickup'
    await nextTick()
    await card.reserveStock()

    expect(mockGetOrder(orderId)!.notes).toBe('Hold for pickup')
    expect(card.form.value.notes).toBe('Hold for pickup')
  })

  it('refuses a status change while lines are still pending, rather than reloading over them', async () => {
    const orderId = freshOrder()
    const card = await cardFor(orderId)

    await card.handleAddItemDirect({
      productId: 'prod-001',
      productName: 'Steel',
      quantity: 3,
      unit: 'pcs',
      unitPrice: 100,
    })
    expect(card.hasPendingChanges.value).toBe(true)

    await card.handleChangeStatus('confirmed')

    // Nothing happened, and the pending line is still on screen and still pending.
    expect(mockGetOrder(orderId)!.status).toBe('new')
    expect(card.hasPendingChanges.value).toBe(true)
    expect(card.order.value!.items.length).toBe(1)
    expect(toasts.error).toHaveBeenCalledWith('orders.error_save_lines_first')
  })
})

// ─── БАГ-11 — services nobody can invoice ───────────────────────────────────

describe('services no live document has charged for', () => {
  /**
   * Contract §4.6: a regular invoice carrying nothing but unbilled services
   * stands on its own — services do not ship, so there is no waybill to demand
   * of them. The server has accepted that since the service-invoicing finding
   * was closed; the card had no way to ask for it, so on an order whose
   * deliveries were all invoiced the service money could not be put on any
   * document at all.
   */
  it('can be invoiced from the card once every delivery is already billed', async () => {
    const orderId = freshOrder()
    const lineId = mockAddOrderItem(orderId, {
      productId: 'prod-001',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 100,
    }).id
    const shipment = mockCreateShipment(orderId, { lines: [{ lineId, quantity: 2 }] })
    mockCreateInvoice(orderId, { shipmentId: shipment.id })
    // Added afterwards — model §6 allows it, and this is the service that used
    // to end up with nowhere to go.
    mockAddOrderService(orderId, { serviceId: 'svc-001', quantity: 1, price: 250 })

    const card = await cardFor(orderId)
    expect(card.unbilledServices.value.length).toBe(1)

    expect(await card.issueServicesInvoice()).toBe(true)
    expect(card.unbilledServices.value.length).toBe(0)

    const invoices = mockGetOrder(orderId)!.invoices
    expect(invoices.length).toBe(2)
    expect(invoices[1]!.kind).toBe('regular')
    expect(invoices[1]!.shipmentId).toBeNull()
    expect(invoices[1]!.coveredServiceIds.length).toBe(1)
  })
})

// ─── БАГ-13 — the history comes with the order ──────────────────────────────

describe('loading the card', () => {
  /**
   * `loadAudit()` used to fetch the whole order a second time for one field that
   * `GET /orders/:id` already carries (§2, §4.1). Besides the round trip it was
   * a second read: between the two the order can move, and the history on screen
   * would then belong to a version other than the one `order.value` and
   * `orderVersion` are holding.
   */
  it('reads the history off the order it just fetched, without asking twice', async () => {
    const orderId = freshOrder()
    calls.getOrder = 0
    const card = await cardFor(orderId)

    expect(calls.getOrder).toBe(1)
    expect(card.auditLog.value.length).toBeGreaterThan(0)
    expect(card.auditLog.value).toEqual(mockGetOrder(orderId)!.auditLog)
  })
})

// ─── Contract §3 — the card counts along with the server ────────────────────

describe('the version the card is writing against', () => {
  /**
   * The card does not re-read the order between the requests of one save: it
   * knows the version it is on because the server steps once per accepted write
   * and answers one request at a time. Now that all twenty mutations CHECK the
   * version, that bookkeeping has teeth — a card one step out of phase refuses
   * its own next request as a conflict that never happened.
   *
   * So the test is a sequence of the operations that step the counter without
   * reloading, followed by a save that must simply work.
   */
  it('stays in step across payments, invoices and history deletions', async () => {
    const orderId = freshOrder()
    mockAddOrderItem(orderId, {
      productId: 'prod-001',
      quantity: 2,
      unit: 'pcs',
      unitPrice: 100,
    })
    const card = await cardFor(orderId)

    // Three writes that merge the answer in rather than reloading.
    expect(await card.addPayment({ amount: 50, purpose: 'advance' })).toBe(true)
    expect(await card.issueAdvanceInvoice(100)).toBe(true)
    await card.deleteAuditEntry(card.auditLog.value[0]!.id)

    card.form.value.notes = 'still in step'
    await nextTick()
    await card.save()

    expect(toasts.error).not.toHaveBeenCalled()
    expect(mockGetOrder(orderId)!.notes).toBe('still in step')
  })

  it('says so and reloads when somebody else got there first', async () => {
    const orderId = freshOrder()
    const card = await cardFor(orderId)

    // The other tab writes while this card is being edited.
    mockPatchOrder(orderId, { notes: 'theirs' })

    card.form.value.notes = 'mine'
    await nextTick()
    await card.save()

    expect(toasts.error).toHaveBeenCalledWith('orders.error_version_conflict')
    // The refused write left the server entirely theirs, and the card is put
    // back on what it actually holds rather than claiming "saved".
    expect(mockGetOrder(orderId)!.notes).toBe('theirs')
    expect(card.form.value.notes).toBe('theirs')
  })
})
