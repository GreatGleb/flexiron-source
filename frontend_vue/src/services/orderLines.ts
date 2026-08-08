/**
 * Building and projecting order lines.
 *
 * One construction path for the mock store, the composables and (later) the API
 * layer, so no call site can forget a field or invent its own defaults.
 *
 * The pricing fields are the truth. `unitPrice`, `totalPrice`, `discount`,
 * `cost` and `marginAmount` are projections computed by the pricing module —
 * they exist for the older parts of the UI and must never be assigned directly.
 */
import type { OrderItem, OrderService, OrderLineAllocation, CostSource } from '@/types/order'
import { type PricingLine, calcLine, round2, roundStored } from '@/domain/orderPricing'

// ─── Pricing bridge ─────────────────────────────────────────────────────────

export function toPricingLine(line: OrderItem | OrderService): PricingLine {
  return {
    id: line.id,
    quantity: line.quantity,
    unitCost: line.unitCost,
    costSource: line.costSource,
    marginPercent: line.marginPercent,
    discountPercent: line.discountPercent,
    manualUnitPrice: line.manualUnitPrice,
    state: line.state,
    shippedQuantity: line.shippedQuantity,
    documentIssued: line.documentIssued,
  }
}

/** Copies the pricing result back onto a line, leaving everything else alone. */
export function applyPricing(line: OrderItem | OrderService, pricing: PricingLine): void {
  line.quantity = pricing.quantity
  line.unitCost = pricing.unitCost
  line.costSource = pricing.costSource
  line.marginPercent = pricing.marginPercent
  line.discountPercent = pricing.discountPercent
  line.manualUnitPrice = pricing.manualUnitPrice
  line.state = pricing.state
  line.shippedQuantity = pricing.shippedQuantity
  line.documentIssued = pricing.documentIssued
}

export function projectItem(item: OrderItem): void {
  const totals = calcLine(toPricingLine(item))
  item.unitPrice = totals.unitPrice
  item.totalPrice = totals.lineNet
  item.discount = item.discountPercent
  item.batchId = item.allocations[0]?.batchId ?? item.batchId
  item.offcutId = item.allocations[0]?.offcutId ?? item.offcutId
}

export function projectService(svc: OrderService): void {
  const totals = calcLine(toPricingLine(svc))
  svc.cost = svc.unitCost
  svc.price = totals.unitPrice
  svc.marginAmount = totals.marginAmount
  svc.totalPrice = totals.lineNet
}

/**
 * Margin that turns a known cost into a known selling price.
 *
 * Kept at storage precision, not display precision: the price is rebuilt from
 * this value, so rounding it to two places would move the money. A cost of 90
 * and a price of 120 need 33.333…%, and a rounded 33.33% rebuilds 119.997 — a
 * price nobody quoted. Round it when showing it, never on the way in.
 */
export function marginFor(unitCost: number, sellingPrice: number): number {
  return unitCost > 0 ? roundStored((sellingPrice / unitCost - 1) * 100) : 0
}

/**
 * Turns "I know the cost and the price I want" into the fields a line stores.
 *
 * With a cost, the price is a markup on it. Without one there is nothing to mark
 * up — a margin of 0% on a cost of 0 gives a price of 0, not the price asked for
 * — so the price is stated outright instead. Every caller must go through this,
 * or a service added without a cost quietly shows up as free.
 */
export function pricingSeedFor(
  unitCost: number,
  sellingPrice: number,
): { marginPercent: number; manualUnitPrice: number | null } {
  // A price of zero is a stated price, not a markup: expressing it as one gives
  // exactly −100%, which the model refuses as impossible — and the line would be
  // rejected at the door instead of showing the zero somebody actually entered.
  if (unitCost > 0 && sellingPrice > 0) {
    return { marginPercent: marginFor(unitCost, sellingPrice), manualUnitPrice: null }
  }
  return { marginPercent: 0, manualUnitPrice: sellingPrice }
}

/**
 * The cost a new line starts with, read off what the warehouse could answer.
 *
 * A product with no batch behind it has NO cost — not "some share of the price".
 * Inventing one puts a made-up margin into every report, and inventing it in two
 * places puts a DIFFERENT made-up number on the card than on the server: the card
 * showed a cost of 0 "from stock" and the same line came back at 0.75 × price
 * "estimated", moving the order's cost and its margin the moment it was saved.
 *
 * The model already answers this case (section 11.9): a line without a cost is
 * sold at the price it was named at, its margin column reads "—", and percentages
 * leave it alone. Nothing has to be guessed.
 *
 * `fifoUnitCost` is null when the warehouse could not be asked at all, and zero
 * when it was asked and has nothing. Both mean the same thing here.
 */
export function stockCostFor(
  fifoUnitCost: number | null,
  hasShortage = false,
): { unitCost: number; costSource: CostSource } {
  if (fifoUnitCost === null || fifoUnitCost <= 0) return { unitCost: 0, costSource: 'estimate' }
  // Partly covered: the covered part has real batches, the gap is a guess, and
  // one line carries one source — so the whole line says "estimate".
  return { unitCost: round2(fifoUnitCost), costSource: hasShortage ? 'estimate' : 'stock' }
}

// ─── Allocations ────────────────────────────────────────────────────────────

/**
 * Cuts the batch breakdown at a quantity, oldest batches first — they are the
 * ones that physically left. Used when a line is split and when its quantity
 * shrinks; without it the shipped part would claim every batch and the
 * breakdown would exceed the line quantity.
 */
export function splitAllocations(
  allocations: OrderLineAllocation[],
  shippedQuantity: number,
): { shipped: OrderLineAllocation[]; remainder: OrderLineAllocation[] } {
  const shipped: OrderLineAllocation[] = []
  const remainder: OrderLineAllocation[] = []
  let left = shippedQuantity

  for (const allocation of allocations) {
    if (left <= 0) {
      remainder.push({ ...allocation })
      continue
    }
    const take = Math.min(allocation.quantity, left)
    if (take > 0) shipped.push({ ...allocation, quantity: take })
    const rest = round2(allocation.quantity - take)
    if (rest > 0) remainder.push({ ...allocation, quantity: rest })
    left = round2(left - take)
  }

  return { shipped, remainder }
}

/** Cost per unit implied by the batch breakdown, or null when there is none. */
export function allocatedUnitCost(allocations: OrderLineAllocation[]): number | null {
  const quantity = allocations.reduce((sum, a) => sum + a.quantity, 0)
  if (quantity <= 0) return null
  return round2(allocations.reduce((sum, a) => sum + a.quantity * a.unitCost, 0) / quantity)
}

// ─── Factories ──────────────────────────────────────────────────────────────

export interface OrderItemSeed {
  id: string
  lineNumber: number
  productId: string
  productName: string
  quantity: number
  unit: string
  /** Cost per unit in the order currency. */
  unitCost: number
  marginPercent: number
  receivedCurrency: string
  exchangeRate: number | null
  batchId?: string | null
  /** The full FIFO breakdown, when it is known. Wins over `batchId`. */
  allocations?: OrderLineAllocation[]
  discountPercent?: number
  weightPerUnitKg?: number | null
  /** 'estimate' when the cost was guessed rather than read off a batch. */
  costSource?: CostSource
  /** Set only when the price cannot be expressed as a markup — see pricingSeedFor. */
  manualUnitPrice?: number | null
}

export function buildOrderItem(seed: OrderItemSeed): OrderItem {
  const allocations: OrderLineAllocation[] = seed.allocations
    ? seed.allocations.map((a) => ({ ...a }))
    : seed.batchId
      ? [
          {
            batchId: seed.batchId,
            offcutId: null,
            quantity: seed.quantity,
            unitCost: seed.unitCost,
            currency: seed.receivedCurrency,
            exchangeRate: seed.exchangeRate,
            source: seed.costSource ?? 'stock',
          },
        ]
      : []

  const item: OrderItem = {
    id: seed.id,
    lineNumber: seed.lineNumber,
    productId: seed.productId,
    productName: seed.productName,
    quantity: seed.quantity,
    unit: seed.unit,
    unitCost: seed.unitCost,
    costSource: seed.costSource ?? 'stock',
    manualUnitCost: null,
    manualCostReason: null,
    allocations,
    marginPercent: seed.marginPercent,
    discountPercent: seed.discountPercent ?? 0,
    manualUnitPrice: seed.manualUnitPrice ?? null,
    state: 'draft',
    shippedQuantity: 0,
    documentIssued: false,
    weightPerUnitKg: seed.weightPerUnitKg ?? null,
    unitPrice: 0,
    totalPrice: 0,
    discount: 0,
    batchId: seed.batchId ?? null,
    offcutId: null,
    receivedCurrency: seed.receivedCurrency,
    exchangeRate: seed.exchangeRate,
  }
  projectItem(item)
  return item
}

export interface OrderServiceSeed {
  id: string
  serviceId: string
  serviceName: string
  quantity: number
  unitCost: number
  marginPercent: number
  discountPercent?: number
  /** Set only when the price cannot be expressed as a markup — see pricingSeedFor. */
  manualUnitPrice?: number | null
}

export function buildOrderService(seed: OrderServiceSeed): OrderService {
  const svc: OrderService = {
    id: seed.id,
    serviceId: seed.serviceId,
    serviceName: seed.serviceName,
    quantity: seed.quantity,
    unitCost: seed.unitCost,
    costSource: 'manual',
    manualUnitCost: null,
    manualCostReason: null,
    marginPercent: seed.marginPercent,
    discountPercent: seed.discountPercent ?? 0,
    manualUnitPrice: seed.manualUnitPrice ?? null,
    state: 'draft',
    // Services never ship; an issued invoice freezes them instead.
    shippedQuantity: 0,
    documentIssued: false,
    cost: 0,
    price: 0,
    marginAmount: 0,
    totalPrice: 0,
  }
  projectService(svc)
  return svc
}
