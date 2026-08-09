/**
 * Audit pass four — "reset to computed" is settled against the order default as
 * it is at SAVE time, not as it was when the button was pressed.
 *
 * Drop into frontend_vue/src/composables/ and run:
 *   npx vitest run src/composables/zz-reset-repro.spec.ts
 */
import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))
const toasts = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }
vi.mock('@/composables/useToast', () => ({ useToast: () => toasts }))
vi.mock('@/composables/useTranslatedData', () => ({
  useTranslatedField: () => ({ tf: (v: unknown) => String(v) }),
}))
vi.mock('@/composables/useSettings', () => ({
  useSettings: () => ({
    settings: { constants: { vatRate: 21, defaultMargin: 15, defaultCurrency: 'EUR' } },
  }),
}))
vi.mock('@/services/ordersService', async () => {
  const m = await import('@/services/mocks/orders')
  const wrap =
    <A extends unknown[], R>(fn: (...a: A) => R) =>
    async (...a: A) =>
      fn(...a)
  return {
    getOrder: wrap(m.mockGetOrder),
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
import { mockGetOrder, mockCreateOrder, mockAddOrderItem } from '@/services/mocks/orders'
import { mockGetClients } from '@/services/mocks/clients'

async function cardWithOneLine(defaultDiscount = 0) {
  const order = mockCreateOrder({ clientId: mockGetClients()[0]!.id, documentType: 'local' })
  // A catalogue price of 120,00 over whatever the shelf costs — the cost is the
  // server's to read (contract §4.2), and it used to be stated here, which was
  // finding 9 being used as a convenience. What this check is about is the
  // PRICE: 120,00 computed, and 96,00 once a 20% default reaches it.
  mockAddOrderItem(order.id, {
    productId: 'prod-001',
    quantity: 10,
    unit: 'pcs',
    unitPrice: 120,
  })
  const card = useOrderCard(order.id)
  await card.load()
  if (defaultDiscount) {
    card.form.value.defaultDiscountPercent = defaultDiscount
    await nextTick()
  }
  return { card, orderId: order.id, lineId: card.order.value!.items[0]!.id }
}

describe('FINDING 8 — "reset to computed" is settled at save time', () => {
  it('the default RAISED after the reset must not reach the line', async () => {
    const { card, orderId, lineId } = await cardWithOneLine()
    card.editLine(lineId, 'item', { field: 'unitPrice', value: 90 }) // 🔒
    card.editLine(lineId, 'item', { field: 'resetPrice' }) // back to 120,00
    // Only now does the admin type a default discount "for new lines".
    card.form.value.defaultDiscountPercent = 20
    await nextTick()

    const shown = card.totals.value.totalNet
    await card.save()
    const stored = mockGetOrder(orderId)!
    expect(shown).toBe(1200)
    expect(
      stored.totalAmount,
      `card showed ${shown}; the header percent is "for new lines" and must not reach this one`,
    ).toBe(shown)
  })

  it('the default LOWERED after the reset must not reach it either', async () => {
    const { card, orderId, lineId } = await cardWithOneLine(20)
    card.editLine(lineId, 'item', { field: 'unitPrice', value: 90 })
    card.editLine(lineId, 'item', { field: 'resetPrice' }) // card: 120 × 0,8 = 96,00
    card.form.value.defaultDiscountPercent = 0
    await nextTick()

    const shown = card.totals.value.totalNet
    await card.save()
    const stored = mockGetOrder(orderId)!
    expect(shown).toBe(960)
    expect(stored.totalAmount, `card showed ${shown}`).toBe(shown)
  })
})
