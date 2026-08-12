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
import {
  type PricingLine,
  calcLine,
  isPriceLocked,
  round2,
  roundStored,
} from '@/domain/orderPricing'

// ─── Pricing bridge ─────────────────────────────────────────────────────────

/**
 * A stored line keeps the two meanings of "the price" in two fields, because the
 * rest of the app reads them: `manualUnitPrice` is the 🔒 — a price named by hand
 * that no longer follows the cost — and `namedUnitPrice` is a price that is
 * stored but still followed by the cost, which is what a catalogue price is.
 * The pricing module works with one field and a flag; this is the seam.
 */
export function toPricingLine(line: OrderItem | OrderService): PricingLine {
  const named = line.namedUnitPrice ?? null
  return {
    id: line.id,
    quantity: line.quantity,
    unitCost: line.unitCost,
    costSource: line.costSource,
    marginPercent: line.marginPercent,
    discountPercent: line.discountPercent,
    manualUnitPrice: line.manualUnitPrice ?? named,
    priceFollowsCost: line.manualUnitPrice === null && named !== null,
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
  // Which of the two fields the stored price belongs in is exactly the question
  // `isPriceLocked` answers — the lock is never inferred twice.
  const locked = isPriceLocked(pricing)
  line.manualUnitPrice = locked ? pricing.manualUnitPrice : null
  line.namedUnitPrice = locked ? null : pricing.manualUnitPrice
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
 * Kept at storage precision, not display precision: this is the rule the price is
 * rebuilt from when the COST moves, so rounding it to two places would move the
 * money. A cost of 90 and a price of 120 need 33.333…%, and a rounded 33.33%
 * rebuilds 119.997 — a price nobody quoted. Round it when showing it, never here.
 *
 * Ten digits are enough for the rule and not enough for the price: see
 * `pricingSeedFor`, which stores the price itself alongside it.
 */
export function marginFor(unitCost: number, sellingPrice: number): number {
  return unitCost > 0 ? roundStored((sellingPrice / unitCost - 1) * 100) : 0
}

/**
 * Turns "I know the cost and the price I want" into the fields a line stores.
 *
 * BOTH numbers are stored, and they are not the same statement (contract §7).
 * The price is what the line shows, totals and invoices — kept as a price,
 * because rebuilding it from a percentage lands a cent below the number that was
 * quoted, at any storage precision. The margin is the rule for where that price
 * goes when the warehouse cost actually moves, which is what keeps a draft
 * following FIFO. `priceFollowsCost` is what says the price is stored and NOT
 * locked — a catalogue line carries no 🔒.
 *
 * Without a cost there is nothing to mark up — a margin of 0% on a cost of 0
 * gives a price of 0, not the price asked for — so the price is stated outright
 * and the line is locked on it. Every caller must go through this, or a service
 * added without a cost quietly shows up as free.
 */
export function pricingSeedFor(
  unitCost: number,
  sellingPrice: number,
): { marginPercent: number; manualUnitPrice: number | null; priceFollowsCost?: boolean } {
  // A price of zero is a stated price, not a markup: expressing it as one gives
  // exactly −100%, which the model refuses as impossible — and the line would be
  // rejected at the door instead of showing the zero somebody actually entered.
  if (unitCost > 0 && sellingPrice > 0) {
    return {
      marginPercent: marginFor(unitCost, sellingPrice),
      manualUnitPrice: sellingPrice,
      priceFollowsCost: true,
    }
  }
  // The flag is left off rather than set to false: everywhere it is absent it
  // means the older reading — a stored price that also locks the line — and that
  // is exactly what a price named without a cost behind it is.
  return { marginPercent: 0, manualUnitPrice: sellingPrice }
}

/**
 * The currency a warehouse cost is stated in.
 *
 * There is exactly one right answer and it is not per product: the warehouse
 * layer speaks the base currency and no other — `mockCreateBatch` refuses a batch
 * in anything else (`BATCH_CURRENCY_NOT_BASE`), and `WarehouseBatch.currency` is
 * documented as "the base currency, and nothing else" (contract §7.1). So a
 * line's `receivedCurrency` — the caption on the cost it was seeded with — is the
 * base currency, in the form the warehouse and the order already use: the code.
 *
 * It used to be the literal `'cur-eur'` on the client and the PRODUCT's currency
 * on the server. A product's currency captions its SALE price, a different number
 * in a different place; putting it on a warehouse-derived cost is the same class
 * of error as adding 25 000 USD to 190,30 EUR.
 */
export function baseCurrencyOf(settings: {
  // Optional because the same fact is stated twice and either statement answers:
  // the directory flags its default, and the constants name it outright. A
  // settings object carrying only the second one is still answerable.
  currencies?: ReadonlyArray<{ code: string; isDefault: boolean }>
  constants: { defaultCurrency: string }
}): string {
  return settings.currencies?.find((c) => c.isDefault)?.code ?? settings.constants.defaultCurrency
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

/**
 * Where a seeded price lands: the 🔒 field when it was named outright, the
 * followed field when the cost is still allowed to reprice it. One decision in
 * one place, so goods and services cannot disagree about it.
 */
function storedPrice(seed: { manualUnitPrice?: number | null; priceFollowsCost?: boolean }): {
  manualUnitPrice: number | null
  namedUnitPrice: number | null
} {
  const price = seed.manualUnitPrice ?? null
  return seed.priceFollowsCost
    ? { manualUnitPrice: null, namedUnitPrice: price }
    : { manualUnitPrice: price, namedUnitPrice: null }
}

export interface OrderItemSeed {
  id: string
  lineNumber: number
  productId: string
  productName: string
  quantity: number
  unit: string
  /** Cost per unit. */
  unitCost: number
  marginPercent: number
  receivedCurrency: string
  batchId?: string | null
  /** The full FIFO breakdown, when it is known. Wins over `batchId`. */
  allocations?: OrderLineAllocation[]
  discountPercent?: number
  weightPerUnitKg?: number | null
  /** 'estimate' when the cost was guessed rather than read off a batch. */
  costSource?: CostSource
  /** The price the line was given, if it was given one — see pricingSeedFor. */
  manualUnitPrice?: number | null
  /** That price is stored but not locked: the cost still reprices it. */
  priceFollowsCost?: boolean
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
    ...storedPrice(seed),
    state: 'draft',
    shippedQuantity: 0,
    returnedQuantity: 0,
    documentIssued: false,
    weightPerUnitKg: seed.weightPerUnitKg ?? null,
    unitPrice: 0,
    totalPrice: 0,
    discount: 0,
    batchId: seed.batchId ?? null,
    offcutId: null,
    receivedCurrency: seed.receivedCurrency,
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
  /** The price the line was given, if it was given one — see pricingSeedFor. */
  manualUnitPrice?: number | null
  /** That price is stored but not locked: the cost still reprices it. */
  priceFollowsCost?: boolean
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
    ...storedPrice(seed),
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
