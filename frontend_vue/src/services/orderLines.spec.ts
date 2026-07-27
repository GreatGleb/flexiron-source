import { describe, it, expect } from 'vitest'
import {
  allocatedUnitCost,
  buildOrderItem,
  buildOrderService,
  marginFor,
  pricingSeedFor,
  splitAllocations,
  toPricingLine,
} from './orderLines'
import type { OrderLineAllocation } from '@/types/order'
import { calcLine, validateLine, round2 } from '@/domain/orderPricing'

describe('marginFor', () => {
  it('gives the markup that turns a cost into the wanted price', () => {
    expect(marginFor(100, 120)).toBe(20)
    expect(marginFor(80, 100)).toBe(25)
  })

  it('rebuilds the price exactly, even when the percentage is not round', () => {
    // Rounding the margin to 33.33% would rebuild 119.997 — a price nobody quoted.
    for (const [cost, price] of [
      [90, 120],
      [0.85, 1.2],
      [812.4, 1000],
      [3, 7],
    ] as Array<[number, number]>) {
      const rebuilt = cost * (1 + marginFor(cost, price) / 100)
      expect(round2(rebuilt)).toBe(round2(price))
    }
  })

  it('returns nothing to add when there is no cost to add it to', () => {
    // A free item has no percentage that produces a price — the caller sets the
    // price directly instead.
    expect(marginFor(0, 50)).toBe(0)
    expect(marginFor(-5, 50)).toBe(0)
  })
})

describe('buildOrderItem', () => {
  const seed = {
    id: 'l1',
    lineNumber: 1,
    productId: 'prod-001',
    productName: 'Steel Sheet 3mm',
    quantity: 10,
    unit: 'pcs',
    unitCost: 100,
    marginPercent: 20,
    receivedCurrency: 'cur-eur',
    exchangeRate: 1,
  }

  it('produces a line that is valid and already projected', () => {
    const item = buildOrderItem(seed)
    expect(() => validateLine(toPricingLine(item))).not.toThrow()
    expect(item.unitPrice).toBe(120)
    expect(item.totalPrice).toBe(1200)
    expect(item.discount).toBe(0)
    expect(item.state).toBe('draft')
    expect(item.allocations).toEqual([])
  })

  it('records the batch it was taken from when one is given', () => {
    const item = buildOrderItem({ ...seed, batchId: 'batch-a' })
    expect(item.allocations).toEqual([
      {
        batchId: 'batch-a',
        offcutId: null,
        quantity: 10,
        unitCost: 100,
        currency: 'cur-eur',
        exchangeRate: 1,
        source: 'stock',
      },
    ])
    expect(item.batchId).toBe('batch-a')
  })

  it('carries a weight when one is known, and null when none is', () => {
    expect(buildOrderItem({ ...seed, weightPerUnitKg: 7.85 }).weightPerUnitKg).toBe(7.85)
    expect(buildOrderItem(seed).weightPerUnitKg).toBeNull()
  })

  it('applies a starting discount', () => {
    const item = buildOrderItem({ ...seed, discountPercent: 10 })
    expect(item.unitPrice).toBe(108)
    expect(item.totalPrice).toBe(1080)
    expect(item.discount).toBe(10)
  })
})

describe('buildOrderService', () => {
  it('projects cost, price and margin in money', () => {
    const svc = buildOrderService({
      id: 's1',
      serviceId: 'svc-001',
      serviceName: 'Metal cutting',
      quantity: 3,
      unitCost: 5,
      marginPercent: 140,
    })
    expect(svc.cost).toBe(5)
    expect(svc.price).toBe(12)
    expect(svc.totalPrice).toBe(36)
    expect(svc.marginAmount).toBe(21) // 36 − 15
    expect(calcLine(toPricingLine(svc)).lineNet).toBe(36)
  })

  it('never ships — that is what the invoice freeze is for', () => {
    const svc = buildOrderService({
      id: 's1',
      serviceId: 'svc-001',
      serviceName: 'Metal cutting',
      quantity: 1,
      unitCost: 5,
      marginPercent: 140,
    })
    expect(svc.shippedQuantity).toBe(0)
    expect(svc.state).toBe('draft')
    expect(svc.documentIssued).toBe(false)
  })
})

describe('pricingSeedFor', () => {
  it('expresses the price as a markup when there is a cost to mark up', () => {
    const seed = pricingSeedFor(100, 120)
    expect(seed.marginPercent).toBe(20)
    expect(seed.manualUnitPrice).toBeNull()
  })

  it('states the price outright when there is no cost — never lets it fall to zero', () => {
    // A 0% margin on a cost of 0 gives a price of 0, so a service added without a
    // cost used to show up as free.
    const seed = pricingSeedFor(0, 12)
    expect(seed.manualUnitPrice).toBe(12)

    const svc = buildOrderService({
      id: 's1',
      serviceId: 'svc-001',
      serviceName: 'Metal cutting',
      quantity: 2,
      unitCost: 0,
      ...seed,
    })
    expect(svc.price).toBe(12)
    expect(svc.totalPrice).toBe(24)
  })

  it('does the same for goods with no known cost', () => {
    const item = buildOrderItem({
      id: 'l1',
      lineNumber: 1,
      productId: 'prod-001',
      productName: 'Steel Sheet 3mm',
      quantity: 4,
      unit: 'pcs',
      unitCost: 0,
      receivedCurrency: 'cur-eur',
      exchangeRate: 1,
      ...pricingSeedFor(0, 120.5),
    })
    expect(item.unitPrice).toBe(120.5)
    expect(item.totalPrice).toBe(482)
  })
})

describe('a price of zero', () => {
  it('is stated, not expressed as a markup of minus one hundred percent', () => {
    // (0 / 100 − 1) × 100 is exactly −100%, which the model calls impossible —
    // the line would be rejected at the door instead of showing the zero.
    const seed = pricingSeedFor(100, 0)
    expect(seed).toEqual({ marginPercent: 0, manualUnitPrice: 0 })
    const line = buildOrderItem({
      id: 'l1',
      lineNumber: 1,
      productId: 'p1',
      productName: 'Free of charge',
      quantity: 2,
      unit: 'pcs',
      unitCost: 100,
      ...seed,
      receivedCurrency: 'cur-eur',
      exchangeRate: 1,
    })
    expect(() => validateLine(toPricingLine(line))).not.toThrow()
    expect(line.unitPrice).toBe(0)
  })
})

describe('splitAllocations', () => {
  function allocation(over: Partial<OrderLineAllocation> = {}): OrderLineAllocation {
    return {
      batchId: 'b1',
      offcutId: null,
      quantity: 6,
      unitCost: 100,
      currency: 'cur-eur',
      exchangeRate: 1,
      source: 'stock',
      ...over,
    }
  }

  it('cuts at the quantity, oldest batches first', () => {
    const { shipped, remainder } = splitAllocations(
      [allocation({ batchId: 'old', quantity: 6 }), allocation({ batchId: 'new', quantity: 4 })],
      8,
    )
    expect(shipped.map((a) => [a.batchId, a.quantity])).toEqual([
      ['old', 6],
      ['new', 2],
    ])
    expect(remainder.map((a) => [a.batchId, a.quantity])).toEqual([['new', 2]])
  })

  it('drops an allocation that holds nothing instead of carrying it along', () => {
    // Degenerate data, but it must not end up as a zero-quantity row on the
    // shipped side, where it would look like a batch that was consumed.
    const { shipped, remainder } = splitAllocations(
      [allocation({ batchId: 'empty', quantity: 0 }), allocation({ batchId: 'real', quantity: 4 })],
      3,
    )
    expect(shipped.map((a) => [a.batchId, a.quantity])).toEqual([['real', 3]])
    expect(remainder.map((a) => [a.batchId, a.quantity])).toEqual([['real', 1]])
  })

  it('gives the whole breakdown to the shipped side when the cut is past its end', () => {
    const { shipped, remainder } = splitAllocations([allocation({ quantity: 4 })], 10)
    expect(shipped).toHaveLength(1)
    expect(remainder).toHaveLength(0)
  })

  it('reads a cost per unit off the breakdown, weighted by quantity', () => {
    expect(
      allocatedUnitCost([
        allocation({ quantity: 6, unitCost: 100 }),
        allocation({ quantity: 4, unitCost: 110 }),
      ]),
    ).toBe(104)
    // Nothing to read: the caller has to say what that means, not guess a zero.
    expect(allocatedUnitCost([])).toBeNull()
  })
})
