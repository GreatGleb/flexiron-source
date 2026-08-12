/**
 * FINDING 24 — one number, two currencies.
 *
 * Owner's decision, 2026-08-08 (memory: batch-warehouse-cost, no-currency-conversion).
 * Currencies coexist and nothing converts, so the warehouse layer of a batch is
 * ALWAYS in the base currency, and the warehouse cost is DERIVED from the purchase:
 *
 *   purchase in base currency, same unit      → warehouse price = purchase price
 *   purchase in base currency, another unit   → the same money over the other unit
 *   purchase in another currency              → a human types the base-currency sum
 *   nothing typed                             → the batch HAS no cost; invent none
 *
 * Today the substitution runs the other way — `mockCreateBatch` does
 * `receivedUnitPrice = data.receivedUnitPrice ?? data.unitPrice` — and `currency`
 * on a batch is a free choice, which is what let 25 000 USD and 190,30 EUR be
 * added into one stock value of 25 190,30 with no currency on the row at all.
 *
 * Careful: `purchaseToWarehouseRate` is a UNIT factor (kg ↔ t), never an exchange
 * rate. Nothing here asserts a conversion, because there is none to assert.
 */
import { describe, it, expect } from 'vitest'
import { mockGetOrder, mockCreateOrder, mockAddOrderItem, mockGetOrders } from './orders'
import { mockGetClients } from './clients'
import {
  batchesForProduct,
  mockGetBatches,
  mockGetStockOverview,
  mockCreateBatch,
} from './warehouse'
import { STORE as PRODUCTS_STORE } from './products'
import { mockGetSettings } from './settings'
import { round2 } from '@/domain/orderPricing'
import type { BatchCreatePayload } from '@/types/warehouse'

const log: string[] = []
// NaN and undefined are the interesting answers here, and JSON.stringify hides
// both — one as `null`, the other as nothing at all.
const show = (x: unknown) =>
  typeof x === 'string' || typeof x === 'number' || x === undefined ? String(x) : JSON.stringify(x)
const say = (...p: unknown[]) => log.push(p.map(show).join(' '))
const report = (t: string) => `\n=== ${t} ===\n${log.join('\n')}\n`

const STOCK_FILTER = {
  search: '',
  categoryIds: '',
  unit: '',
  showDeficitOnly: false,
  showInStockOnly: false,
  sortBy: null,
  sortDir: 'asc',
} as unknown as Parameters<typeof mockGetStockOverview>[0]

/** The one currency the warehouse layer is allowed to speak. */
const BASE = mockGetSettings().currencies.find((c) => c.isDefault)!.code
const USD = mockGetSettings().currencies.find((c) => c.code === 'USD')!.id

const allBatches = async (): Promise<Awaited<ReturnType<typeof mockGetBatches>>['items']> =>
  (await mockGetBatches({ search: '' }, { page: 1, pageSize: 10000 })).items

/** A product an order already draws on, with stock on the shelf. */
function productWithBatches(min = 1): string {
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
    if (batchesForProduct(id).filter((b) => b.quantityRemaining > 0).length >= min) return id
  }
  throw new Error('none')
}

/** A product nothing has stocked yet — a receipt here disturbs no existing row. */
const fresh: string[] = PRODUCTS_STORE.filter((p) => batchesForProduct(p.id).length === 0).map(
  (p) => p.id,
)
let freshCursor = 0
const nextFresh = () => fresh[freshCursor++]!

const receipt = (extra: Partial<BatchCreatePayload> & { productId: string }) =>
  ({
    batchNumber: `AUDIT-24-${extra.productId}`,
    lotCode: 'AUDIT-24',
    unit: 'kg',
    receivedAt: '2020-01-01T00:00:00Z',
    ...extra,
  }) as unknown as BatchCreatePayload

describe('FINDING 24 — the warehouse layer is one currency', () => {
  it('every batch on the shelf is priced in the base currency', async () => {
    log.length = 0
    const batches = await allBatches()
    const strangers = batches
      .filter((b) => b.currency !== BASE)
      .map((b) => `${b.id} (${b.productId}) ${b.quantityRemaining} × ${b.unitPrice} ${b.currency}`)
    say('base currency                  :', BASE)
    say('batches in the store           :', batches.length)
    say('…not in the base currency      :', strangers.length)
    strangers.slice(0, 8).forEach((s) => say('  ' + s))

    expect(
      batches.length,
      report('FINDING 24 — no batches, so the sweep proves nothing'),
    ).toBeGreaterThan(0)
    expect(
      strangers,
      report(
        'FINDING 24 — a batch prices its stock in a currency the warehouse layer does not speak',
      ),
    ).toEqual([])
  })

  it('a purchase in the base currency derives the warehouse price', async () => {
    log.length = 0
    // Same unit: the warehouse price IS the purchase price. Nothing to decide,
    // so the field is not sent and the store must not leave the batch without one.
    const sameUnit = await mockCreateBatch(
      receipt({
        productId: nextFresh(),
        quantity: 40,
        unit: 'kg',
        receivedQuantity: 40,
        receivedUnitId: 'uom-kg',
        receivedUnitPrice: 7.5,
        receivedCurrencyId: 'cur-eur',
      }),
    )
    say('purchase 40 kg @ 7,50 EUR      :', `unitPrice=${sameUnit.unitPrice} ${sameUnit.currency}`)

    // Another unit: the same money over a different unit. A unit factor is
    // arithmetic, and arithmetic is the machine's job — but it must not change
    // how much money arrived.
    const otherUnit = await mockCreateBatch(
      receipt({
        productId: nextFresh(),
        quantity: 1,
        unit: 't',
        receivedQuantity: 1000,
        receivedUnitId: 'uom-kg',
        receivedUnitPrice: 2,
        receivedCurrencyId: 'cur-eur',
        purchaseToWarehouseRate: 1000,
      }),
    )
    say(
      'purchase 1000 kg @ 2,00 EUR    :',
      `unitPrice=${otherUnit.unitPrice} ${otherUnit.currency} per ${otherUnit.unit}`,
    )
    say('  money in                     :', round2(2 * 1000))
    say(
      '  money on the shelf           :',
      round2((otherUnit.unitPrice ?? NaN) * otherUnit.quantity),
    )

    expect(
      sameUnit.currency,
      report('FINDING 24 — a base-currency purchase landed in another currency'),
    ).toBe(BASE)
    expect(
      sameUnit.unitPrice,
      report(
        'FINDING 24 — the warehouse cost is derived from the purchase; a purchase in the base currency and the same unit IS the warehouse cost',
      ),
    ).toBe(7.5)
    expect(
      otherUnit.currency,
      report('FINDING 24 — a base-currency purchase landed in another currency'),
    ).toBe(BASE)
    expect(
      round2((otherUnit.unitPrice ?? NaN) * otherUnit.quantity),
      report(
        'FINDING 24 — converting the UNIT must not change the money: 1000 kg at 2,00 is 2 000,00 whether it is stored as kg or as t',
      ),
    ).toBe(2000)
  })

  it('a warehouse price is not copied backwards into a purchase that never happened', async () => {
    log.length = 0
    const batch = await mockCreateBatch(
      receipt({ productId: nextFresh(), quantity: 10, unitPrice: 300, currency: BASE }),
    )
    say('receipt with no purchase price :', batch.id)
    say('  unitPrice (warehouse)        :', batch.unitPrice, batch.currency)
    say('  receivedUnitPrice (purchase) :', batch.receivedUnitPrice)
    say('mockCreateBatch: `receivedUnitPrice = data.receivedUnitPrice ?? data.unitPrice`')
    say('The purchase is the fact and the warehouse cost is derived from it, so the')
    say('arrow only points one way. Pointing it back invents a supplier price that')
    say('was never paid — and that is what made a batch dollar-denominated.')

    expect(
      batch.receivedUnitPrice ?? null,
      report(
        'FINDING 24 — the store filled in a purchase price nobody entered, by copying the warehouse price',
      ),
    ).toBeNull()
  })

  it('a purchase in another currency never reaches the warehouse layer', async () => {
    log.length = 0
    const productId = productWithBatches(1)
    const before = batchesForProduct(productId).filter((b) => b.quantityRemaining > 0)
    say('product                        :', productId)
    say(
      'batches before                 :',
      before.map((b) => `${b.id} ${b.quantityRemaining}× ${b.unitPrice} ${b.currency}`),
    )

    // The buyer paid a supplier 250 USD a unit. There is no exchange rate in this
    // system and there never will be: either the store refuses the receipt until
    // somebody writes what that is worth in the base currency, or it stores a
    // base-currency batch. What it may not do is put USD on the shelf.
    let refused: string | null = null
    try {
      await mockCreateBatch(
        receipt({
          productId,
          quantity: 100,
          unit: before[0]!.unit,
          unitPrice: 250,
          currency: 'USD',
          receivedUnitPrice: 250,
          receivedCurrencyId: USD,
        }),
      )
    } catch (e) {
      refused = (e as Error).message
    }
    const after = batchesForProduct(productId).filter((b) => b.quantityRemaining > 0)
    say('receipt refused?               :', refused ?? 'no, it was accepted')
    say(
      'batches after                  :',
      after.map((b) => `${b.id} ${b.quantityRemaining}× ${b.unitPrice} ${b.currency}`),
    )

    const strangers = after
      .filter((b) => b.currency !== BASE)
      .map((b) => `${b.id} ${b.quantityRemaining} × ${b.unitPrice} ${b.currency}`)
    expect(
      strangers,
      report(
        'FINDING 24 — a foreign purchase price became the price of goods on the shelf; from here every sum over this product adds two currencies',
      ),
    ).toEqual([])
  })

  it('the value of stock, and the cost of a line, add one currency only', async () => {
    log.length = 0
    const rows = (await mockGetStockOverview(STOCK_FILTER, { page: 1, pageSize: 1000 })).items
    const bad: string[] = []
    for (const row of rows) {
      const batches = batchesForProduct(row.productId).filter((b) => b.quantityRemaining > 0)
      const currencies = [...new Set(batches.map((b) => b.currency))]
      if (currencies.some((c) => c !== BASE)) {
        bad.push(`${row.productId}: value ${row.totalValue} adds ${currencies.join(' + ')}`)
        continue
      }
      // Nothing else may reach the total either: a batch with no cost contributes
      // no money, it does not contribute NaN.
      const costed = round2(
        batches.reduce(
          (s, b) => s + (b.unitPrice == null ? 0 : b.quantityRemaining * b.unitPrice),
          0,
        ),
      )
      if (!Number.isFinite(row.totalValue) || Math.abs(row.totalValue - costed) > 0.05) {
        bad.push(`${row.productId}: value ${row.totalValue}, its costed batches say ${costed}`)
      }
    }
    say('stock rows                     :', rows.length)
    say('rows whose value is not one currency, or not the sum of its batches:', bad.length)
    bad.slice(0, 8).forEach((b) => say('  ' + b))
    say('(warehouse.ts:319 sums quantityRemaining × unitPrice over every batch,')
    say(' :328 divides it for the average, :382 sorts the whole list by it)')

    // The same money, seen from the order side: FIFO walks the same batches.
    const productId = productWithBatches(1)
    const order = mockCreateOrder({ clientId: mockGetClients()[0]!.id, documentType: 'local' })
    const line = mockAddOrderItem(order.id, {
      productId,
      quantity: 120,
      unit: batchesForProduct(productId)[0]!.unit,
      unitPrice: 400,
    })
    const ord = mockGetOrder(order.id)!
    say('')
    say('order line of 120 units:')
    say(
      '  breakdown                    :',
      line.allocations.map((a) => `${a.batchId} q=${a.quantity} @${a.unitCost} ${a.currency}`),
    )
    say('  unitCost stored on the line  :', line.unitCost, `(${line.costSource})`)
    say('  order currency / totalCost   :', ord.currency, '/', ord.totalCost)
    say('  actual margin %              :', ord.actualMarginPercent)

    expect(
      rows.length,
      report('FINDING 24 — no stock rows, so the sweep proves nothing'),
    ).toBeGreaterThan(0)
    expect(
      bad,
      report(
        'FINDING 24 — a stock value that adds two currencies, or that is not the sum of the batches behind it',
      ),
    ).toEqual([])
    expect(
      line.allocations
        .filter((a) => a.currency !== BASE)
        .map((a) => `${a.batchId} @${a.unitCost} ${a.currency}`),
      report(
        'FINDING 24 — the line averages two currencies into one unitCost and the order reports it as one figure',
      ),
    ).toEqual([])
  })

  it('a batch nobody priced has no cost — and no cost is not a number', async () => {
    log.length = 0
    // The currency case with the field left empty. Model §11.9 already covers it:
    // the line sells at the price it was given and its margin is "—".
    const batch = await mockCreateBatch(
      receipt({
        productId: nextFresh(),
        quantity: 100,
        receivedQuantity: 100,
        receivedUnitId: 'uom-kg',
        receivedUnitPrice: 250,
        receivedCurrencyId: USD,
      }),
    )
    say('purchase 100 × 250 USD, warehouse price left empty:')
    say('  unitPrice                    :', batch.unitPrice)
    say('  totalCost                    :', batch.totalCost)
    say('  currency                     :', batch.currency)

    expect(
      batch.unitPrice ?? null,
      report(
        'FINDING 24 — the foreign purchase price was taken as the warehouse cost; there is no exchange rate in this system',
      ),
    ).toBeNull()
    expect(
      batch.totalCost ?? null,
      report(
        'FINDING 24 — a batch with no cost must carry no total either; NaN or 0 both claim something that is not known',
      ),
    ).toBeNull()
  })
})
