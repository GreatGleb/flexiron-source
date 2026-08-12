/**
 * Rights on the create path, and numbers that are not numbers.
 *
 * The acceptance criterion for two findings and the guards around them:
 *
 *   red   — 9  (the manualCost right guards PATCH and not POST, so the same
 *               figure walks in through the other door, unmarked and unlogged)
 *   red   — 11 (NaN and +Infinity pass every guard, because every guard is a
 *               comparison and a comparison with NaN is false)
 *   red   — 12 (an unknown productId is accepted; an unknown serviceId is not)
 *   green — the manualCost right itself: refused for a role without it, a reason
 *           required from a role with it, and the legitimate route marks the
 *           line `manual` and leaves a history entry
 *
 * -Infinity is the accident that makes the hole visible: the line endpoints and
 * the shipment refuse it, because `< 0` happens to be true for it, while the
 * payment and allocate-total take it — `round2(-Infinity)` is NaN, and the
 * comparison that was supposed to catch it is false again.
 *
 * Contract §1: "право проверяется в той же функции, что и запись", and "число
 * обязано быть конечным числом, а не просто «не отрицательным»".
 */
import { describe, it, expect } from 'vitest'
import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockAddOrderService,
  mockUpdateOrderItem,
  mockAddOrderPayment,
  mockCreateShipment,
  mockAllocateOrderTotal,
  mockGetOrders,
} from './orders'
import { mockGetClients } from './clients'
import { allServices } from './services'
import { mockGetSettings, mockSaveSettings } from './settings'
import { batchesForProduct } from './warehouse'
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
function verdictOf(fn: () => unknown): string {
  try {
    fn()
    return 'ACCEPTED'
  } catch (e) {
    return String(e).replace(/^\w*Error: /, '')
  }
}
function attempt(label: string, fn: () => unknown): string {
  const verdict = verdictOf(fn)
  say(`${label.padEnd(46)} ${verdict}`)
  return verdict
}

describe('AUTHORITY 2 — the right, and non-numbers', () => {
  it('the manualCost right is checked in the function that writes the cost, both of them', () => {
    log.length = 0
    const productId = stocked(20)
    const full = mockGetSettings()
    const asRole = (role: string) =>
      mockSaveSettings({ ...full, profile: { ...full.profile, role } } as typeof full)

    try {
      const o = fresh()
      const line = mockAddOrderItem(o.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 500 })
      say('warehouse cost                 :', line.unitCost, `(${line.costSource})`)
      say('manualCost right belongs to    :', JSON.stringify(full.orderPermissions.manualCost))

      asRole('manager')
      say('acting as: manager')
      const patchedAsManager = attempt('  PATCH manualUnitCost + reason', () =>
        mockUpdateOrderItem(o.id, line.id, { manualUnitCost: 0.01, manualCostReason: 'because' }),
      )
      const postedAsManager = attempt('  POST /items with unitCost=0.01', () =>
        mockAddOrderItem(o.id, {
          productId,
          quantity: 2,
          unit: 'pcs',
          unitPrice: 500,
          unitCost: 0.01,
        }),
      )
      const lines = mockGetOrder(o.id)!.items
      const sneaked = lines[lines.length - 1]!
      say(
        '  last line stored             :',
        sneaked.unitCost,
        `(${sneaked.costSource})`,
        'manualUnitCost=',
        sneaked.manualUnitCost,
        'reason=',
        sneaked.manualCostReason,
      )
      say(
        '  audit entries naming a cost  :',
        mockGetOrder(o.id)!.auditLog.filter((a) => a.property.en.toLowerCase().includes('cost'))
          .length,
      )

      asRole('owner')
      say('acting as: owner')
      const noReason = attempt('  PATCH manualUnitCost, no reason', () =>
        mockUpdateOrderItem(o.id, line.id, { manualUnitCost: 0.01 }),
      )
      const withReason = attempt('  PATCH manualUnitCost + reason', () =>
        mockUpdateOrderItem(o.id, line.id, {
          manualUnitCost: 0.01,
          manualCostReason: 'stock was wrong',
        }),
      )
      const corrected = mockGetOrder(o.id)!.items[0]!
      const costEntries = mockGetOrder(o.id)!.auditLog.filter((a) =>
        a.property.en.toLowerCase().includes('cost'),
      )
      say(
        '  line after the legitimate one:',
        corrected.unitCost,
        `(${corrected.costSource})`,
        'reason=',
        corrected.manualCostReason,
      )
      say('  audit entries naming a cost  :', costEntries.length)
      say('')
      say('The right, the reason, the `manual` mark and the history entry are one act.')
      say('POST /items pays for none of them: same figure, same effect, no trace.')

      // Guards: the door that is watched must stay watched.
      expect(patchedAsManager, why('AUTHORITY 2 — the right')).toContain('FORBIDDEN_MANUALCOST')
      expect(noReason, why('AUTHORITY 2 — the right')).toContain('MANUAL_COST_REASON_REQUIRED')
      // And the legitimate route works, marks the line and leaves a trace.
      expect(withReason, why('AUTHORITY 2 — the right')).toBe('ACCEPTED')
      expect(corrected.costSource, why('AUTHORITY 2 — the right')).toBe('manual')
      expect(corrected.manualCostReason, why('AUTHORITY 2 — the right')).toBe('stock was wrong')
      expect(costEntries.length, why('AUTHORITY 2 — the right')).toBeGreaterThan(0)
      // Finding 9: the unwatched door.
      expect(postedAsManager, why('AUTHORITY 2 — the right')).toContain('FORBIDDEN_MANUALCOST')
    } finally {
      mockSaveSettings(full)
    }
  })

  it('every endpoint that takes a number refuses one that is not finite, and writes nothing', () => {
    log.length = 0
    const productId = stocked(20)

    /**
     * Each case builds its own untouched order first and hands back the single
     * hostile request, so what is measured is that request and nothing else.
     */
    const cases: Array<{
      label: string
      prepare: (value: number) => { orderId: string; fire: () => void }
    }> = []
    const withOrder = (
      label: string,
      fire: (orderId: string, lineId: string, value: number) => void,
      seedLine = true,
    ) =>
      cases.push({
        label,
        prepare: (v) => {
          const o = fresh()
          const l = seedLine
            ? mockAddOrderItem(o.id, { productId, quantity: 2, unit: 'pcs', unitPrice: 100 }).id
            : ''
          return { orderId: o.id, fire: () => fire(o.id, l, v) }
        },
      })
    withOrder(
      'POST item quantity',
      (o, _l, v) =>
        void mockAddOrderItem(o, { productId, quantity: v, unit: 'pcs', unitPrice: 100 }),
      false,
    )
    withOrder(
      'POST item unitPrice',
      (o, _l, v) => void mockAddOrderItem(o, { productId, quantity: 1, unit: 'pcs', unitPrice: v }),
      false,
    )
    withOrder('PATCH quantity', (o, l, v) => void mockUpdateOrderItem(o, l, { quantity: v }))
    withOrder(
      'PATCH manualUnitPrice',
      (o, l, v) => void mockUpdateOrderItem(o, l, { manualUnitPrice: v }),
    )
    withOrder(
      'PATCH discountPercent',
      (o, l, v) => void mockUpdateOrderItem(o, l, { discountPercent: v }),
    )
    withOrder(
      'PATCH marginPercent',
      (o, l, v) => void mockUpdateOrderItem(o, l, { marginPercent: v }),
    )
    withOrder('POST payment amount', (o, _l, v) => void mockAddOrderPayment(o, { amount: v }))
    withOrder('POST allocate-total', (o, _l, v) => void mockAllocateOrderTotal(o, v))
    withOrder(
      'POST shipment quantity',
      (o, l, v) => void mockCreateShipment(o, { lines: [{ lineId: l, quantity: v }] }),
    )

    const values: Array<[string, number]> = [
      ['NaN', Number.NaN],
      ['+Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
    ]

    const accepted: string[] = []
    for (const [name, value] of values) {
      for (const c of cases) {
        const { orderId, fire } = c.prepare(value)
        const before = JSON.stringify(mockGetOrder(orderId))
        const verdict = attempt(`${c.label} = ${name}`, fire)
        const after = JSON.stringify(mockGetOrder(orderId))
        if (verdict === 'ACCEPTED') accepted.push(`${c.label} = ${name}`)
        else if (before !== after) accepted.push(`${c.label} = ${name} — refused, and wrote anyway`)
      }
    }

    say('')
    say('A line with quantity NaN serialises to JSON as `null`; the order it belongs')
    say('to reports a total of 0; the payment row exists with an amount of 0. On a')
    say('server every one of those columns is NOT NULL numeric.')
    expect(accepted, why('AUTHORITY 2 — non-finite numbers')).toEqual([])
  })

  it('an unknown id is refused for goods exactly as it is for services', () => {
    log.length = 0
    const u = fresh()
    const productVerdict = attempt('POST item, productId that does not exist', () =>
      mockAddOrderItem(u.id, { productId: 'prod-nope', quantity: 1, unit: 'pcs', unitPrice: 100 }),
    )
    const serviceVerdict = attempt('POST service, serviceId that does not exist', () =>
      mockAddOrderService(u.id, { serviceId: 'svc-nope', quantity: 1, price: 100 }),
    )
    say(
      'goods lines stored             :',
      JSON.stringify(
        mockGetOrder(u.id)!.items.map(
          (i) => `${i.productId} "${i.productName}" cost=${i.unitCost}`,
        ),
      ),
    )
    say(
      'services stored                :',
      JSON.stringify(mockGetOrder(u.id)!.services.map((s) => s.serviceName)),
    )
    say('catalogue is not empty         :', allServices().length > 0)
    say('')
    say('Contract §1: "ссылка на справочник обязана разрешаться: неизвестный товар')
    say('отклоняется ровно так же, как неизвестная услуга".')

    expect(serviceVerdict, why('AUTHORITY 2 — unknown id')).toContain('SERVICE_NOT_FOUND')
    expect(productVerdict, why('AUTHORITY 2 — unknown id')).toMatch(/NOT_FOUND/)
    expect(mockGetOrder(u.id)!.items, why('AUTHORITY 2 — unknown id')).toEqual([])
  })
})
