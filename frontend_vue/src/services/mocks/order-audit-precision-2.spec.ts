/**
 * Layer 7b — does the cent reach a real order, and where is the cliff?
 *
 * Acceptance criteria for finding 16. The first and the third `it` state what the
 * money must be and are red until a named price is stored as a price; the second
 * is a guard over a result that already holds.
 */
import { describe, it, expect } from 'vitest'
import {
  mockGetOrder,
  mockCreateOrder,
  mockAddOrderItem,
  mockCreateShipment,
  mockCreateInvoice,
  mockGetOrders,
} from './orders'
import { mockGetClients } from './clients'
import { batchesForProduct } from './warehouse'
import {
  type PricingLine,
  calcLine,
  round2,
  round4,
  roundTo,
  allocateTotal,
} from '@/domain/orderPricing'
import { pricingSeedFor } from '@/services/orderLines'

const log: string[] = []
const say = (...p: unknown[]) => log.push(p.map(String).join(' '))
/** The narration, as an assertion message. */
const why = (title: string) => `\n=== ${title} ===\n` + log.join('\n') + '\n'

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

describe('LAYER 7b', () => {
  it('the price named on a real order reaches the line, the order and the invoice', () => {
    log.length = 0
    const productId = stocked(80)
    const order = mockCreateOrder({
      clientId: mockGetClients()[0]!.id,
      documentType: 'local',
    })
    // The case the fuzz found: catalogue price 963,13, quantity 72,5. The cost is
    // whatever the shelf holds this product at — the orders API takes none from
    // the client — and the question here is about the PRICE, which must arrive at
    // the document as it was named whatever the cost behind it turns out to be.
    const price = 963.13
    const qty = 72.5
    const honest = round2(price * qty) // 69 826,93
    const line = mockAddOrderItem(order.id, {
      productId,
      quantity: qty,
      unit: 'pcs',
      unitPrice: price,
    })
    say(`the cost the warehouse answers : ${line.unitCost} (${line.costSource})`)
    say(`catalogue price × quantity     : ${price} × ${qty} = ${honest}`)
    say(`margin the line stores         : ${line.marginPercent} % (10 decimals — contract §7)`)
    say(`the price it shows             : ${line.unitPrice}`)
    say(`line total in the order        : ${line.totalPrice}`)
    say(`order net                      : ${mockGetOrder(order.id)!.totalAmount}`)
    say(`difference                     : ${round2(line.totalPrice - honest)}`)

    const shp = mockCreateShipment(order.id, { lines: [{ lineId: line.id, quantity: qty }] })
    const inv = mockCreateInvoice(order.id, { kind: 'regular', shipmentId: shp.id })
    say(`the invoice the client gets    : ${inv.amountNet}`)
    say('')
    say('The price the client was quoted must arrive at the document unchanged. It')
    say('is stored as a markup instead — see pricingSeedFor() — and rebuilt from the')
    say('cost every time, which lands a cent below the price that was named.')

    expect(
      {
        unitPrice: line.unitPrice,
        lineTotal: line.totalPrice,
        orderNet: mockGetOrder(order.id)!.totalAmount,
        invoiceNet: inv.amountNet,
      },
      why('LAYER 7b — the named price in a real order'),
    ).toEqual({
      unitPrice: price,
      lineTotal: honest,
      orderNet: honest,
      invoiceNet: honest,
    })
  })

  it('GUARD: a spread total survives 10 stored decimals at any quantity we can order', () => {
    log.length = 0
    const QUANTITIES = [10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000]
    const missed: string[] = []
    let tried = 0
    for (const qty of QUANTITIES) {
      let broken = 0
      const N = 400
      for (let i = 0; i < N; i++) {
        // Two lines so the residual lands somewhere and the division is awkward.
        const lines: PricingLine[] = [
          {
            id: 'a',
            quantity: qty,
            unitCost: 3.37,
            costSource: 'stock',
            marginPercent: 17.3,
            discountPercent: 0,
            manualUnitPrice: null,
            state: 'draft',
            shippedQuantity: 0,
            documentIssued: false,
          },
          {
            id: 'b',
            quantity: qty / 3,
            unitCost: 11.11,
            costSource: 'stock',
            marginPercent: 23.7,
            discountPercent: 0,
            manualUnitPrice: null,
            state: 'draft',
            shippedQuantity: 0,
            documentIssued: false,
          },
        ]
        const target = round2(1000 + i * 977.13)
        let res
        try {
          res = allocateTotal(lines, target)
        } catch {
          continue
        }
        tried++
        const persisted = res.lines.map((l) => ({
          ...l,
          manualUnitPrice: l.manualUnitPrice === null ? null : roundTo(l.manualUnitPrice, 10),
        }))
        const after = persisted.reduce((s, l) => round2(s + calcLine(l).lineNet), 0)
        if (after !== target) broken++
      }
      say(`quantity ${String(qty).padStart(10)} : ${broken} of ${N} spread totals miss by a cent`)
      if (broken !== 0) missed.push(`quantity ${qty}: ${broken}`)
    }
    say('')
    say('The stored price genuinely carries up to 17 decimals, and the slack a')
    say('10-decimal column leaves is 1e-10 × quantity — this fixes the quantity at')
    say('which that slack would first cost a cent. There is no such quantity yet.')

    expect(tried, why('LAYER 7b — the cliff')).toBeGreaterThan(2500)
    expect(missed.join(' | '), why('LAYER 7b — the cliff')).toBe('')
  })

  it('a catalogue price reaches the line total on every catalogue-shaped combination', () => {
    log.length = 0
    // Costs and prices as the catalogue actually holds them: two decimals.
    let worst = 0
    let sample = ''
    let count = 0
    let tried = 0
    let priceOff = 0
    for (let c = 1; c <= 60; c++) {
      for (let p = 1; p <= 60; p++) {
        const cost = round2(c * 6.73 + 0.07)
        const price = round2(cost * (1 + p / 37))
        const seed = pricingSeedFor(cost, price)
        for (const qty of [7.5, 72.5, 333, 1250]) {
          tried++
          // Built and read the way an order builds and reads it: the criterion is
          // the money on the line, not the field the line keeps it in.
          const totals = calcLine({
            id: 'c',
            quantity: qty,
            unitCost: cost,
            costSource: 'stock',
            marginPercent: seed.marginPercent,
            discountPercent: 0,
            manualUnitPrice: seed.manualUnitPrice,
            state: 'draft',
            shippedQuantity: 0,
            documentIssued: false,
          })
          const honest = round2(price * qty)
          if (totals.unitPrice !== round4(price)) priceOff++
          if (totals.lineNet !== honest) {
            count++
            const gap = Math.abs(round2(totals.lineNet - honest))
            if (gap > worst) {
              worst = gap
              sample = `cost ${cost}, price ${price}, qty ${qty}: order says ${totals.lineNet}, the price says ${honest}`
            }
          }
        }
      }
    }
    say(`catalogue-shaped combinations  : ${tried}`)
    say(`unit price not the one named   : ${priceOff}`)
    say(`line total ≠ price × quantity  : ${count} (${((count / tried) * 100).toFixed(2)}%)`)
    say(`worst gap                      : ${worst}`)
    say(`worst case                     : ${sample || '—'}`)
    say('')
    say('Two-decimal costs and two-decimal prices — the shape of every real')
    say('catalogue row. None of them may lose a cent on the way to the line total.')

    expect(tried, why('LAYER 7b — catalogue-shaped data')).toBe(14400)
    expect(
      `${priceOff} lost the named price, ${count} lost the total (worst ${worst})`,
      why('LAYER 7b — catalogue-shaped data'),
    ).toBe('0 lost the named price, 0 lost the total (worst 0)')
  })
})
