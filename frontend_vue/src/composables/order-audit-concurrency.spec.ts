/**
 * Layer 8 — two clients on one order.
 *
 * Contract §8: "Блокировок при одновременной работе двух менеджеров [в моке нет].
 * На сервере это обязательно." Nothing in the payload or the endpoints carries a
 * version, so there is nothing for the backend to build that lock out of.
 *
 * These are acceptance criteria for that fix, written against what a person can
 * SEE — who ends up holding the money, and whether anybody was told. The name of
 * the field that carries the version (`version`, `If-Match`, a precondition on
 * `updatedAt`) is the implementer's choice and is deliberately not asserted.
 *
 * Stand: two real `useOrderCard`s against the real mock store, so "shown" and
 * "stored" can be compared directly.
 *
 * The trap in this stand: `isDirty` is set inside a `watchEffect`, so an edit to
 * `card.form.value.*` needs an `await nextTick()` before `save()` — without it
 * `saveFormFields` sees nothing and the test reports agreement it never checked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, isRef } from 'vue'

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
import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockGetOrders,
  mockPatchOrderStatus,
  mockDeleteOrderAuditEntry,
} from '@/services/mocks/orders'
import { mockGetClients } from '@/services/mocks/clients'
import { batchesForProduct } from '@/services/mocks/warehouse'
import { round2 } from '@/domain/orderPricing'
import type { StockAuditEntry } from '@/types/warehouse'

const log: string[] = []
const say = (...p: unknown[]) =>
  log.push(p.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
const report = (t: string) => `\n=== ${t} ===\n${log.join('\n')}\n`

function clearToasts() {
  for (const kind of ['success', 'error', 'info', 'warning'] as const) toasts[kind].mockClear()
}

beforeEach(() => {
  log.length = 0
  clearToasts()
})

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

/**
 * Was the person told that their save did not land as they meant it to?
 *
 * Counted generously, because the fix may say it either way: an alarming toast,
 * or a flag on the card whose name says "conflict". Success toasts do not count
 * — "saved" is what a lost update says today.
 */
function toldAboutConflict(card: object): string[] {
  const heard: string[] = []
  for (const kind of ['error', 'warning', 'info'] as const) {
    for (const call of toasts[kind].mock.calls) heard.push(`toast.${kind}(${String(call[0])})`)
  }
  for (const [key, value] of Object.entries(card)) {
    if (!/conflict|stale|outdated|overwritten/i.test(key)) continue
    const held: unknown = isRef(value) ? value.value : value
    const raised = Array.isArray(held) ? held.length > 0 : Boolean(held)
    if (raised) heard.push(`${key} = ${JSON.stringify(held)}`)
  }
  return heard
}

describe('LAYER 8 — two managers, one order', () => {
  /**
   * FINDING 17. Two tabs, one line, two different prices. One of the two writes
   * has to lose — that is unavoidable — but it may not be lost in silence.
   */
  it('does not let the second save overwrite the first without telling anybody', async () => {
    const productId = stocked(20)
    const order = mockCreateOrder({ clientId: mockGetClients()[0]!.id, documentType: 'local' })
    mockAddOrderItem(order.id, { productId, quantity: 10, unit: 'pcs', unitPrice: 100 })

    // Two tabs, both open on the same order at the same moment.
    const anna = useOrderCard(order.id)
    const boris = useOrderCard(order.id)
    await anna.load()
    await boris.load()
    const lineId = anna.order.value!.items[0]!.id
    say('both loaded, line at           :', anna.order.value!.items[0]!.unitPrice, '×', 10)

    anna.editLine(lineId, 'item', { field: 'unitPrice', value: 130 })
    boris.editLine(lineId, 'item', { field: 'unitPrice', value: 80 })
    say('Anna negotiates                :', 130, '→ her card shows', anna.totals.value.totalNet)
    say('Boris negotiates               :', 80, '→ his card shows', boris.totals.value.totalNet)

    await anna.save()
    const afterAnna = mockGetOrder(order.id)!.totalAmount
    say('Anna saves. Server now         :', afterAnna)
    expect(afterAnna, 'the stand is wrong — the first save must land').toBe(1300)

    // From here on, anything anybody is told is about the second save.
    clearToasts()
    await boris.save()
    const afterBoris = mockGetOrder(order.id)!
    say('Boris saves. Server now        :', afterBoris.totalAmount)
    const heard = toldAboutConflict(boris)
    say('anybody told                   :', heard.length ? heard : 'nothing at all')
    say('Anna s card still shows        :', anna.totals.value.totalNet)

    // Whichever way it goes, the order is worth its own lines: a mutation
    // refused as a conflict writes nothing at all, not half of itself. Checked
    // first so it keeps its meaning both before and after the fix.
    expect(
      afterBoris.totalAmount,
      report('FINDING 17 — a refused save must write nothing') +
        '\nThe order no longer equals its own lines, so the conflicting save was\n' +
        'part-applied.',
    ).toBe(round2(afterBoris.items.reduce((s, i) => s + i.totalPrice, 0)))

    // And a write made against a stale read may not disappear quietly. Either
    // the second save is refused as a conflict and the first stands, or it is
    // merged — but "saved" said to both while one of the numbers is gone is not
    // an outcome anybody can act on.
    expect(
      heard.length,
      report('FINDING 17 — the lost update') +
        '\nTwo tabs wrote the same field to different values and both were told\n' +
        '"saved". A mutation sent from a stale version has to be refused with a\n' +
        'conflict (writing nothing), or merged and reported. The version can be\n' +
        'carried however the backend likes — this only asks that somebody hears\n' +
        'about it.',
    ).toBeGreaterThan(0)
  })

  /**
   * The positive result beside finding 17, and the guard the version work must
   * not break: `saveFormFields` sends only its own diff, so two tabs editing
   * DIFFERENT order fields do not overwrite each other. It is the LINE edits
   * above that do not merge.
   */
  it('merges the order fields by field across tabs', async () => {
    const productId = stocked(20)
    const order = mockCreateOrder({ clientId: mockGetClients()[0]!.id, documentType: 'local' })
    mockAddOrderItem(order.id, { productId, quantity: 5, unit: 'pcs', unitPrice: 100 })
    const anna = useOrderCard(order.id)
    const boris = useOrderCard(order.id)
    await anna.load()
    await boris.load()

    anna.form.value.vatMode = 'export_zero'
    boris.form.value.defaultDiscountPercent = 15
    // `isDirty` is raised in a watchEffect — without this the saves below send
    // nothing and this test would pass without testing anything.
    await nextTick()

    await anna.save()
    const one = mockGetOrder(order.id)!
    say(
      'after Anna (vatMode=export_zero):',
      JSON.stringify({
        vatMode: one.vatMode,
        defaultDiscount: one.defaultDiscountPercent,
        gross: one.totalWithVat,
      }),
    )
    expect(one.vatMode, 'the stand is wrong — Anna s field must land').toBe('export_zero')

    clearToasts()
    await boris.save()
    const two = mockGetOrder(order.id)!
    say(
      'after Boris (defaultDiscount=15):',
      JSON.stringify({
        vatMode: two.vatMode,
        defaultDiscount: two.defaultDiscountPercent,
        gross: two.totalWithVat,
      }),
    )
    const heard = toldAboutConflict(boris)
    say('anybody told                   :', heard.length ? heard : 'nothing at all')

    // The claim: Boris never sent `vatMode`, so he cannot have undone it.
    expect(
      two.vatMode,
      report('LAYER 8 — order fields merge by field') +
        '\nBoris edited a different field, so the deferred save must not carry\n' +
        'Anna s value back to what his tab loaded.',
    ).toBe('export_zero')
    // And his own field landed — or he was told why it did not.
    expect(
      two.defaultDiscountPercent === 15 || heard.length > 0,
      report('LAYER 8 — order fields merge by field') +
        '\nBoris s own edit neither landed nor was refused out loud.',
    ).toBe(true)
  })

  /**
   * FINDING 18. `DELETE /orders/:id/audit/:index` addresses a record by its place
   * in a list. Two clients holding the same list delete different records, and
   * the second deletion lands on whatever slid into the index it read. (The
   * contract lists no audit endpoint at all — §4.)
   */
  it('deletes the audit entry that was asked for, not the one at that position', () => {
    const productId = stocked(20)
    const order = mockCreateOrder({ clientId: mockGetClients()[0]!.id, documentType: 'local' })
    mockAddOrderItem(order.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 })

    // Another manager moves the order along; every status change appends.
    mockPatchOrderStatus(order.id, 'confirmed')
    mockPatchOrderStatus(order.id, 'picking')
    mockPatchOrderStatus(order.id, 'packing')

    // Two clients, both looking at this same four-entry log.
    const seen = mockGetOrder(order.id)!.auditLog
    say(
      'what both clients are looking at:',
      seen.map((e, i) => `${i}:${e.property.en}=${e.newValue}`),
    )
    expect(seen.length, 'the stand is wrong — four entries are needed').toBe(4)

    const aTarget = seen[1]!
    const bTarget = seen[2]!
    const bystander = seen[3]!
    say('A deletes                      :', `${aTarget.property.en}=${aTarget.newValue}`)
    mockDeleteOrderAuditEntry(order.id, handle(aTarget, 1))
    say('B deletes                      :', `${bTarget.property.en}=${bTarget.newValue}`)
    mockDeleteOrderAuditEntry(order.id, handle(bTarget, 2))

    const left = mockGetOrder(order.id)!.auditLog
    say(
      'log left                       :',
      left.map((e) => `${e.property.en}=${e.newValue}`),
    )

    const message =
      report('FINDING 18 — the audit log is addressed by position') +
      '\nA history record has to be addressed by an identifier of its own, so a\n' +
      'deletion removes the record that was asked for however many other\n' +
      'deletions happened between the read and the write. Give the entry an `id`\n' +
      'and this check picks it up on its own; with only an index to send, what B\n' +
      'read at 2 had already slid to 1 and B deleted its neighbour instead.'
    expect(same(left, aTarget), `A s record survived A s own deletion.${message}`).toBe(false)
    expect(same(left, bTarget), `B s record survived B s own deletion.${message}`).toBe(false)
    expect(same(left, bystander), `a record nobody asked to delete is gone.${message}`).toBe(true)
  })
})

/**
 * How a client names the entry it read.
 *
 * By the entry's own id — which is now what the endpoint takes. The fallback to
 * the index it was read at is kept deliberately: it is what this check used to
 * exercise, and it still describes the defect exactly. A position is not a name
 * for a record other people are deleting from.
 */
function handle(entry: StockAuditEntry, readAt: number): string {
  const id = (entry as StockAuditEntry & { id?: string }).id
  return id ?? String(readAt)
}

/** Is that same record still in the log? Entries carry no id, so by content. */
function same(logEntries: StockAuditEntry[], entry: StockAuditEntry): boolean {
  const key = (e: StockAuditEntry) =>
    `${e.timestamp}|${e.property.en}|${e.oldValue}|${e.newValue}|${e.userInitials}`
  return logEntries.some((e) => key(e) === key(entry))
}
