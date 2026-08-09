/**
 * FINDINGS 26 and 27 — the two "average" figures on the product card.
 *
 * 26. `avgCostPrice` is computed by an IIFE at products.ts load (13951-13965) from
 *     the raw `MOCK_BATCHES`. warehouse.ts:144-150 then rewrites every `unitPrice`
 *     in that same array through `_resolveBatchCost`, and warehouse imports
 *     products (not the other way round), so the card's average is permanently a
 *     weighted average of prices that no longer exist anywhere.
 *     RIGHT: avgCostPrice = Σ(unitPrice × quantityRemaining) ÷ Σ quantityRemaining
 *     over the batches that still hold stock, in the base currency — for EVERY
 *     stocked product, not on average.
 *
 * 27. `avgSalePrice = product.price ?? 0` — the field is labelled "средняя цена
 *     продажи" and nothing is ever averaged; a product with no price shows 0,00
 *     where it should show a dash.
 *     RIGHT (owner, 2026-08-08): Σ(net of what shipped) ÷ Σ(shipped quantity) over
 *     orders that were not cancelled, and `null` when nothing has shipped.
 *
 * Both fields are read on ProductCardPage.vue:398,408.
 */
import { describe, it, expect } from 'vitest'
import { STORE as PRODUCTS_STORE } from './products'
import { batchesForProduct } from './warehouse'
import { mockGetOrders, mockGetOrder } from './orders'
import { calcLine, round2 } from '@/domain/orderPricing'
import { toPricingLine } from '@/services/orderLines'

const log: string[] = []
const show = (x: unknown) =>
  typeof x === 'string' || typeof x === 'number' || x === undefined ? String(x) : JSON.stringify(x)
const say = (...p: unknown[]) => log.push(p.map(show).join(' '))
const report = (t: string) => `\n=== ${t} ===\n${log.join('\n')}\n`

/** What the warehouse would answer: weighted average over what is on the shelf. */
function costFromBatches(productId: string): number | null {
  // A batch nobody priced is left out of BOTH sums: an unknown cost is not a
  // cheap one, and averaging it in as zero would quietly write the shelf down.
  const batches = batchesForProduct(productId).filter(
    (b) => b.quantityRemaining > 0 && b.unitPrice !== null,
  )
  const qty = round2(batches.reduce((s, b) => s + b.quantityRemaining, 0))
  if (qty <= 0) return null
  return round2(batches.reduce((s, b) => s + b.quantityRemaining * b.unitPrice!, 0) / qty)
}

/** What the orders would answer: what this product actually sold for. */
function saleFromOrders(): Map<string, { qty: number; net: number }> {
  const per = new Map<string, { qty: number; net: number }>()
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
    { page: 1, pageSize: 1000 },
  )
  for (const row of page.items) {
    const order = mockGetOrder(row.id)!
    if (order.status === 'cancelled') continue
    for (const item of order.items) {
      // Only what really left the warehouse — a draft line is not a sale.
      if (item.shippedQuantity <= 0) continue
      const net = calcLine({ ...toPricingLine(item), quantity: item.shippedQuantity }).lineNet
      const cur = per.get(item.productId) ?? { qty: 0, net: 0 }
      cur.qty = round2(cur.qty + item.shippedQuantity)
      cur.net = round2(cur.net + net)
      per.set(item.productId, cur)
    }
  }
  return per
}

const stored = (id: string) =>
  PRODUCTS_STORE.find((p) => p.id === id) as (typeof PRODUCTS_STORE)[number] & {
    avgSalePrice?: number | null
  }

describe('FINDING 26 — the average cost on the product card', () => {
  it('every stocked product shows the average of its own batches', () => {
    log.length = 0
    let checked = 0
    let worst = 0
    const off: string[] = []
    for (const p of PRODUCTS_STORE) {
      const real = costFromBatches(p.id)
      if (real === null) continue
      checked++
      const card = p.avgCostPrice as number | null
      if (card === null || Math.abs(card - real) > 0.005) {
        const gap = Math.abs(round2((card ?? 0) - real))
        if (gap > worst) worst = gap
        off.push(`${p.id}: card says ${card}, its batches say ${real} (gap ${gap})`)
      }
    }
    say('products in the catalogue      :', PRODUCTS_STORE.length)
    say('…of which the warehouse stocks :', checked)
    say('cards disagreeing with their own batches:', off.length, `(worst gap ${worst})`)
    off.slice(0, 8).forEach((o) => say('  ' + o))
    say('')
    say('products.ts:13951 computes this at module load from the raw MOCK_BATCHES;')
    say('warehouse.ts:144-150 then rewrites every unitPrice in that same array.')
    say('warehouse imports products, so products always runs first and keeps the')
    say('prices that the reprice threw away.')

    expect(
      checked,
      report('FINDING 26 — nothing is stocked, so the sweep proves nothing'),
    ).toBeGreaterThan(0)
    expect(
      off,
      report(
        "FINDING 26 — the card quotes an average cost that none of the product's batches support",
      ),
    ).toEqual([])
  })

  it('a product with nothing on the shelf shows no average cost', () => {
    log.length = 0
    const wrong: string[] = []
    let checked = 0
    for (const p of PRODUCTS_STORE) {
      if (costFromBatches(p.id) !== null) continue
      checked++
      if (p.avgCostPrice !== null && p.avgCostPrice !== undefined) {
        wrong.push(`${p.id}: nothing on the shelf, card says ${p.avgCostPrice}`)
      }
    }
    say('products with no stock         :', checked)
    say('…that still quote a cost       :', wrong.length)
    wrong.slice(0, 8).forEach((w) => say('  ' + w))

    expect(
      checked,
      report('FINDING 26 — every product is stocked, so this proves nothing'),
    ).toBeGreaterThan(0)
    expect(
      wrong,
      report('FINDING 26 — an average over no batches is not a number, it is a dash'),
    ).toEqual([])
  })
})

describe('FINDING 27 — the average SALE price on the product card', () => {
  it('is the average of what was actually sold, not the catalogue price', () => {
    log.length = 0
    const sold = saleFromOrders()
    const off: string[] = []
    for (const [productId, s] of sold) {
      const p = stored(productId)
      if (!p) continue
      const real = round2(s.net / s.qty)
      const card = p.avgSalePrice ?? null
      if (card === null || Math.abs(card - real) > 0.005) {
        off.push(
          `${productId}: card says ${card}, ${s.qty} units really shipped for ${s.net} → ${real}` +
            ` (catalogue price ${p.price})`,
        )
      }
    }
    say('products with shipped sales    :', sold.size)
    say('…whose card disagrees          :', off.length)
    off.slice(0, 8).forEach((o) => say('  ' + o))
    say('')
    say('products.ts:13963 — `product.avgSalePrice = product.price ?? 0`. The price')
    say('list is what we ask; the average sale price is what we got, after every')
    say('discount and correction. They are two different questions.')

    expect(
      sold.size,
      report('FINDING 27 — nothing has shipped, so the sweep proves nothing'),
    ).toBeGreaterThan(0)
    expect(
      off,
      report('FINDING 27 — the card labels the catalogue price as an average sale price'),
    ).toEqual([])
  })

  it('a product that never sold shows no average sale price', () => {
    log.length = 0
    const sold = saleFromOrders()
    const wrong: string[] = []
    let checked = 0
    for (const p of PRODUCTS_STORE) {
      if (sold.has(p.id)) continue
      checked++
      const card = stored(p.id).avgSalePrice
      if (card !== null && card !== undefined) {
        wrong.push(`${p.id}: never shipped, card says ${card} (catalogue price ${p.price})`)
      }
    }
    say('products that never shipped    :', checked)
    say('…that still quote an average   :', wrong.length)
    wrong.slice(0, 8).forEach((w) => say('  ' + w))
    say('')
    say('0,00 is a claim: it says the goods went out for nothing. A product that has')
    say('never sold has no average, and the card shows a dash.')

    expect(
      checked,
      report('FINDING 27 — everything has sold, so this proves nothing'),
    ).toBeGreaterThan(0)
    expect(wrong, report('FINDING 27 — an average over no sales is not 0,00')).toEqual([])
  })
})
