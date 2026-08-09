/**
 * The card driven against the REAL mock server.
 *
 * The question this file exists to ask: does what the card SHOWS equal what the
 * server STORED, after any sequence of edits pushed through the deferred save?
 *
 * Two runs of the same fuzzer. The first is a guard over the operations that
 * already agree to the cent — it must stay green. The second adds "reset to
 * computed" and is red until finding 8 is fixed; kept apart so the guard is not
 * drowned by a defect that is already known.
 */
import { describe, it, expect, vi } from 'vitest'

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

// The real mock store behind the real service surface — one truth for both sides.
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
  return {
    getBatchCostBreakdown: async (productId: string, quantity: number) =>
      w.mockCalculateFifoCost(productId, quantity),
  }
})

import { useOrderCard } from './useOrderCard'
import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockAddOrderService,
  mockGetOrders,
} from '@/services/mocks/orders'
import { mockGetClients } from '@/services/mocks/clients'
import { allServices } from '@/services/mocks/services'
import { batchesForProduct } from '@/services/mocks/warehouse'
import { calcLine, round2 } from '@/domain/orderPricing'
import { toPricingLine } from '@/services/orderLines'
import type { Order } from '@/types/order'

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function productIds(): string[] {
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
  return [...ids].filter(
    (id) => batchesForProduct(id).reduce((s, b) => s + b.quantityRemaining, 0) > 10,
  )
}
function netOf(o: Order): number {
  return [...o.items, ...o.services].reduce(
    (s, l) => round2(s + calcLine(toPricingLine(l)).lineNet),
    0,
  )
}

/**
 * One pass of the fuzzer: 600 orders × 20 random operations, and after every
 * save the card and the server are compared to the cent.
 *
 * `resetPrice` is a switch because "reset to computed" is finding 8 and is still
 * open: the card computes `resetLinePrice(line, form.defaultDiscountPercent)` at
 * the moment the button is pressed, the wire carries `{ resetPrice: true }` with
 * no number, and the server applies ITS OWN `order.defaultDiscountPercent` —
 * which `save()` has already overwritten, because the order fields go out first.
 * Mixed into the guard, that one operation would drown every other disagreement
 * the guard exists to catch.
 */
async function fuzz(opts: { resetPrice: boolean }): Promise<string[]> {
  const products = productIds()
  const svcs = allServices()
  const clientId = mockGetClients()[0]!.id
  const problems: string[] = []

  for (let run = 0; run < 600 && problems.length < 8; run++) {
    const r = rng(500 + run)
    const seeded = mockCreateOrder({ clientId, documentType: 'local' })
    // Two saved lines and a service to start from.
    mockAddOrderItem(seeded.id, {
      productId: products[Math.floor(r() * products.length)]!,
      quantity: round2(1 + r() * 5),
      unit: 'pcs',
      unitPrice: round2(10 + r() * 300),
    })
    mockAddOrderItem(seeded.id, {
      productId: products[Math.floor(r() * products.length)]!,
      quantity: round2(1 + r() * 5),
      unit: 'pcs',
      unitPrice: round2(10 + r() * 300),
    })
    if (r() < 0.6) {
      mockAddOrderService(seeded.id, {
        serviceId: svcs[Math.floor(r() * svcs.length)]!.id,
        quantity: 1 + Math.floor(r() * 3),
        price: round2(10 + r() * 200),
      })
    }

    const card = useOrderCard(seeded.id)
    await card.load()
    const trail: string[] = []

    for (let step = 0; step < 20; step++) {
      const o = card.order.value
      if (!o) break
      const item = o.items.length ? o.items[Math.floor(r() * o.items.length)]! : undefined
      const svc = o.services.length ? o.services[Math.floor(r() * o.services.length)]! : undefined

      switch (Math.floor(r() * 14)) {
        case 0:
          if (!item) break
          trail.push(`price ${item.id}`)
          card.editLine(item.id, 'item', { field: 'unitPrice', value: round2(1 + r() * 400) })
          break
        case 1:
          if (!item) break
          trail.push(`qty ${item.id}`)
          card.editLine(item.id, 'item', { field: 'quantity', value: round2(0.5 + r() * 9) })
          break
        case 2:
          if (!item) break
          trail.push(`discount ${item.id}`)
          card.editLine(item.id, 'item', { field: 'discountPercent', value: round2(r() * 40) })
          break
        case 3:
          if (!item) break
          trail.push(`margin ${item.id}`)
          card.editLine(item.id, 'item', { field: 'marginPercent', value: round2(r() * 60) })
          break
        case 4:
          if (!item) break
          trail.push(`lineTotal ${item.id}`)
          card.editLine(item.id, 'item', { field: 'lineTotal', value: round2(10 + r() * 3000) })
          break
        case 5:
          if (!svc) break
          trail.push(`svc price ${svc.id}`)
          card.editLine(svc.id, 'service', { field: 'unitPrice', value: round2(1 + r() * 300) })
          break
        case 6: {
          trail.push('addItem')
          const p = products[Math.floor(r() * products.length)]!
          await card.handleAddItemDirect(
            {
              productId: p,
              productName: p,
              quantity: round2(1 + r() * 4),
              unit: 'pcs',
              unitPrice: round2(10 + r() * 200),
            },
            card.addModes.value.includes('order_terms') && r() < 0.5 ? 'order_terms' : null,
          )
          break
        }
        case 7: {
          trail.push('addService')
          const s = svcs[Math.floor(r() * svcs.length)]!
          card.handleAddServiceDirect({
            serviceId: s.id,
            serviceName: s.id,
            quantity: 1 + Math.floor(r() * 2),
            price: round2(10 + r() * 200),
            cost: s.costPrice ?? 0,
          })
          break
        }
        case 8:
          if (!item) break
          trail.push(`delete ${item.id}`)
          card.handleDeleteItem(item.id)
          break
        case 10: {
          // "Keep the total": the preview promises the order will not move.
          trail.push('keepTotal')
          const p = products[Math.floor(r() * products.length)]!
          const before = card.totals.value.totalNet
          await card.handleAddItemDirect(
            {
              productId: p,
              productName: p,
              quantity: round2(1 + r() * 3),
              unit: 'pcs',
              unitPrice: round2(10 + r() * 200),
            },
            'keep_total',
          )
          if (card.keepTotalPreview.value) {
            card.confirmKeepTotal()
            if (card.totals.value.totalNet !== before) {
              problems.push(
                `run ${run} step ${step}: keep_total promised ${before}, card shows ${card.totals.value.totalNet}`,
              )
            }
          }
          break
        }
        case 11: {
          // The manual total: the preview reports the gross it will really reach.
          trail.push('allocateTotal')
          const target = round2(50 + r() * 5000)
          const warn = card.previewTotal(target)
          if (!warn && card.allocationPreview.value) {
            const promised = card.allocationPreview.value.achievedGross
            await card.confirmAllocation()
            if (card.totals.value.totalGross !== promised) {
              problems.push(
                `run ${run} step ${step}: allocate promised ${promised}, card shows ${card.totals.value.totalGross}`,
              )
            }
            const srv = mockGetOrder(seeded.id)!
            if (srv.totalWithVat !== promised) {
              problems.push(
                `run ${run} step ${step}: allocate promised ${promised}, SERVER stored ${srv.totalWithVat}`,
              )
            }
          }
          break
        }
        case 12:
          // "Reset to computed" — finding 8, and only in the run that asks for it.
          if (!opts.resetPrice || !item) break
          trail.push(`resetPrice ${item.id}`)
          card.editLine(item.id, 'item', { field: 'resetPrice' })
          break
        case 13:
          if (!svc) break
          trail.push(`deleteService ${svc.id}`)
          card.handleDeleteService(svc.id)
          break
        case 9:
          trail.push('applyDefaults')
          card.form.value.defaultDiscountPercent = round2(r() * 20)
          card.form.value.defaultMarginPercent = round2(5 + r() * 40)
          card.requestApplyDefaults()
          if (card.defaultsPreview.value) {
            const promised = card.defaultsPreview.value.after
            card.applyDefaultsToAllLines()
            // The preview promised a total; the card must now show it.
            if (card.totals.value.totalGross !== promised) {
              problems.push(
                `run ${run} step ${step}: applyDefaults promised ${promised}, card shows ${card.totals.value.totalGross}`,
              )
            }
          }
          break
      }
    }

    // What the card shows right before Save.
    const shownGross = card.totals.value.totalGross
    const shownNet = card.totals.value.totalNet
    const shownLines = new Map(
      [...(card.order.value?.items ?? []), ...(card.order.value?.services ?? [])].map((l) => [
        l.id,
        calcLine(toPricingLine(l)).lineNet,
      ]),
    )

    await card.save()
    const stored = mockGetOrder(seeded.id)!

    if (stored.totalAmount !== shownNet) {
      problems.push(
        `run ${run}: card showed net ${shownNet}, server stored ${stored.totalAmount} (diff ${round2(stored.totalAmount - shownNet)})\n    ${trail.join(' | ')}`,
      )
    } else if (stored.totalWithVat !== shownGross) {
      problems.push(
        `run ${run}: card showed gross ${shownGross}, server stored ${stored.totalWithVat}`,
      )
    }
    if (stored.totalAmount !== netOf(stored)) {
      problems.push(
        `run ${run}: server total ${stored.totalAmount} != its own lines ${netOf(stored)}`,
      )
    }
    // Every line the card showed must exist server-side at the same money.
    if (stored.items.length + stored.services.length !== shownLines.size) {
      problems.push(
        `run ${run}: card showed ${shownLines.size} lines, server has ${stored.items.length + stored.services.length}\n    ${trail.join(' | ')}`,
      )
    }
  }

  return problems
}

describe('the card against the real server', () => {
  it('shows to the cent what gets stored, after any sequence of edits', async () => {
    const problems = await fuzz({ resetPrice: false })
    expect(
      problems.join('\n'),
      'the card and the server disagree — what an admin approved on screen is not\n' +
        'what the order ended up worth:\n' +
        problems.join('\n'),
    ).toBe('')
  })

  it('shows to the cent what gets stored, "reset to computed" included', async () => {
    const problems = await fuzz({ resetPrice: true })
    expect(
      problems.join('\n'),
      'FINDING 8. "Reset to computed" is worked out on the card and sent as a bare\n' +
        '`{ resetPrice: true }`, so the server redoes it against its own\n' +
        '`defaultDiscountPercent` — the one this very save has just written. The\n' +
        'number the admin approved and the number stored are different:\n' +
        problems.join('\n'),
    ).toBe('')
  })
})
