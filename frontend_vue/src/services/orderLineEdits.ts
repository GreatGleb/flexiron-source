/**
 * One line edit — applied identically on the client and on the server.
 *
 * The card applies the edit locally so the row and the totals move at once, and
 * sends the same edit on Save. Both go through `applyLineEdit`, so "what I saw"
 * and "what was stored" cannot drift apart — with a deferred save that drift
 * would stay hidden until the next reload.
 *
 * ONE edit per call, in the order the admin made them. An accumulated delta
 * cannot express order, and order decides the outcome: margin-then-price keeps
 * the manual price, price-then-margin clears the lock and reprices.
 */
import type { OrderItem, OrderService } from '@/types/order'
import {
  applyCostChange,
  applyDiscountEdit,
  applyLineTotalEdit,
  applyMarginEdit,
  applyPriceEdit,
  applyQuantityEdit,
  canEditPrice,
  canEditQuantity,
  isCostFrozen,
  resetLinePrice,
  type PricingLine,
} from '@/domain/orderPricing'
import {
  allocatedUnitCost,
  applyPricing,
  projectItem,
  projectService,
  splitAllocations,
  splitsWholePiece,
  toPricingLine,
  wholePieceRanges,
} from './orderLines'

export type LineEditField =
  | 'quantity'
  | 'unitPrice'
  | 'lineTotal'
  | 'discountPercent'
  | 'marginPercent'
  | 'unitCost'
  | 'resetPrice'
  | 'resetCost'

export type LineEditOp =
  | { field: 'quantity'; value: number }
  | { field: 'unitPrice'; value: number }
  | { field: 'lineTotal'; value: number }
  | { field: 'discountPercent'; value: number }
  | { field: 'marginPercent'; value: number }
  /** A cost entered by hand. On goods the reason is mandatory — see below. */
  | { field: 'unitCost'; value: number; reason?: string }
  | { field: 'resetPrice' }
  | { field: 'resetCost' }

/** Wire shape of a line edit — what `PATCH .../items/:id` accepts. */
export type LineEditDelta = Partial<OrderItem & OrderService> & {
  lineTotal?: number
  resetPrice?: boolean
}

export type LineKind = 'item' | 'service'

export interface LineEditContext {
  /** What "reset to computed" re-applies. The order's default, not the line's. */
  defaultDiscountPercent: number
}

function isGoods(line: OrderItem | OrderService): line is OrderItem {
  return 'productId' in line
}

export function lineKindOf(line: OrderItem | OrderService): LineKind {
  return isGoods(line) ? 'item' : 'service'
}

/**
 * A cost typed by hand overrides a warehouse figure, so goods carry a mandatory
 * reason: months later the only way to tell a corrected supplier price from a
 * typo is the sentence someone wrote at the time.
 *
 * Services have no warehouse figure to override — their cost is hand-entered by
 * definition — so they take the number directly and `manualUnitCost` stays unused.
 */
function applyManualCost(
  line: OrderItem | OrderService,
  pricing: PricingLine,
  value: number,
  reason: string | undefined,
): PricingLine {
  if (!isGoods(line)) return applyCostChange(pricing, value, 'manual')

  if (!reason && !line.manualCostReason) throw new Error('MANUAL_COST_REASON_REQUIRED')
  // Throws before anything is written, so a refused edit leaves no marker behind.
  const next = applyCostChange(pricing, value, 'manual')
  line.manualUnitCost = value
  if (reason) line.manualCostReason = reason
  return next
}

/**
 * Back to the warehouse figure the batch breakdown implies.
 *
 * Refuses rather than half-doing it. Dropping the marker while the hand-typed
 * number stays would leave a cost that claims to come from the warehouse and
 * no longer says who typed it — the provenance the reason exists to record.
 */
function clearManualCost(line: OrderItem | OrderService, pricing: PricingLine): PricingLine {
  if (!isGoods(line)) throw new Error('RESET_COST_NOT_SUPPORTED')
  // The cost on a shipped line may not move at all.
  if (isCostFrozen(pricing)) throw new Error('COST_FROZEN_BY_SHIPMENT')

  const fromStock = allocatedUnitCost(line.allocations)
  // Nothing to go back to: the batch was never booked in, which is usually why
  // the cost was typed in the first place.
  if (fromStock === null) throw new Error('NO_STOCK_COST')

  const next = applyCostChange(pricing, fromStock, 'stock')
  line.manualUnitCost = null
  line.manualCostReason = null
  return next
}

/**
 * Applies one edit to a line in place, including the projection the older parts
 * of the UI read. Throws on anything the model refuses, and throws BEFORE
 * writing anything, so a rejected edit leaves the line exactly as it was.
 */
export function applyLineEdit(
  line: OrderItem | OrderService,
  op: LineEditOp,
  ctx: LineEditContext,
): void {
  const before = toPricingLine(line)
  let pricing = before

  switch (op.field) {
    case 'quantity':
      pricing = applyQuantityEdit(before, op.value)
      // Fewer goods need fewer batches: trim the breakdown, oldest kept first.
      //
      // У партии обрезать аллокацию можно — металл делится. У куска нельзя: он один
      // предмет на полке, и `splitAllocations`, срезав его до количества строки,
      // оставила бы в заказе половину куска, которого в природе нет. Дальше это
      // доезжает до склада молча: план видит уже усечённую аллокацию, считает её целым
      // куском, продажа списывает половину, а кусок помечается `sold` целиком — вторая
      // половина металла исчезает без единой записи.
      //
      // Поэтому отказ, а не усечение — то же решение, что при добавлении строки
      // (`OFFCUTS_EXCEED_QUANTITY`), при отгрузке и при возврате
      // (`RETURN_SPLITS_OFFCUT`). Кусок целиком не нужен — его убирает количество,
      // которое до него не доходит или проходит его насквозь: разрез ЗА границей куска
      // отбрасывает аллокацию целиком и возвращает кусок в продажу.
      if (isGoods(line)) {
        if (splitsWholePiece(op.value, wholePieceRanges(line.allocations))) {
          throw new Error('QUANTITY_SPLITS_OFFCUT')
        }
        line.allocations = splitAllocations(line.allocations, op.value).shipped
      }
      break
    case 'unitPrice':
      pricing = applyPriceEdit(before, op.value)
      break
    case 'lineTotal':
      pricing = applyLineTotalEdit(before, op.value)
      break
    case 'discountPercent':
      pricing = applyDiscountEdit(before, op.value)
      break
    case 'marginPercent':
      pricing = applyMarginEdit(before, op.value)
      break
    case 'resetPrice':
      pricing = resetLinePrice(before, ctx.defaultDiscountPercent)
      break
    case 'unitCost':
      pricing = applyManualCost(line, before, op.value, op.reason)
      break
    case 'resetCost':
      pricing = clearManualCost(line, before)
      break
  }

  applyPricing(line, pricing)
  if (isGoods(line)) projectItem(line)
  else projectService(line)
}

/** What goes on the wire for one edit. */
export function lineEditDelta(op: LineEditOp, kind: LineKind): LineEditDelta {
  switch (op.field) {
    case 'quantity':
      return { quantity: op.value }
    case 'unitPrice':
      return { manualUnitPrice: op.value }
    case 'lineTotal':
      return { lineTotal: op.value }
    case 'discountPercent':
      return { discountPercent: op.value }
    case 'marginPercent':
      return { marginPercent: op.value }
    case 'resetPrice':
      return { resetPrice: true }
    case 'unitCost':
      return kind === 'item'
        ? { manualUnitCost: op.value, manualCostReason: op.reason ?? null }
        : { unitCost: op.value }
    case 'resetCost':
      return { manualUnitCost: null }
  }
}

/**
 * The inverse: a delta off the wire, read as edits in a fixed, documented order.
 *
 * The order matters and is the one the model describes — quantity first, then the
 * rules (margin, discount), then a price that overrides them, then the cost. A
 * caller that needs a different order sends the edits one request at a time.
 */
export function deltaToOps(delta: LineEditDelta, kind: LineKind): LineEditOp[] {
  const ops: LineEditOp[] = []
  if (delta.quantity !== undefined) ops.push({ field: 'quantity', value: delta.quantity })
  if (delta.resetPrice) ops.push({ field: 'resetPrice' })
  if (delta.marginPercent !== undefined) {
    ops.push({ field: 'marginPercent', value: delta.marginPercent })
  }
  if (delta.discountPercent !== undefined) {
    ops.push({ field: 'discountPercent', value: delta.discountPercent })
  }
  // null is not an edit — a price is unlocked with resetPrice, which also says
  // what happens to the discount that came with it.
  if (delta.manualUnitPrice !== undefined && delta.manualUnitPrice !== null) {
    ops.push({ field: 'unitPrice', value: delta.manualUnitPrice })
  }
  if (delta.lineTotal !== undefined) ops.push({ field: 'lineTotal', value: delta.lineTotal })

  if (kind === 'item') {
    if (delta.manualUnitCost !== undefined) {
      ops.push(
        delta.manualUnitCost === null
          ? { field: 'resetCost' }
          : {
              field: 'unitCost',
              value: delta.manualUnitCost,
              ...(delta.manualCostReason ? { reason: delta.manualCostReason } : {}),
            },
      )
    }
  } else if (delta.unitCost !== undefined) {
    ops.push({ field: 'unitCost', value: delta.unitCost })
  }

  return ops
}

/** Which cells the table may let the admin into. */
export function canEditLineField(line: PricingLine, field: LineEditField): boolean {
  switch (field) {
    case 'quantity':
      return canEditQuantity(line)
    case 'unitCost':
    case 'resetCost':
      return !isCostFrozen(line)
    // All three go through the computed price, and there is no cost here to
    // compute one from — the price on such a line was stated outright. Only the
    // price itself, the line total and the quantity remain.
    case 'marginPercent':
    case 'discountPercent':
    case 'resetPrice':
      return canEditPrice(line) && line.unitCost > 0
    default:
      return canEditPrice(line)
  }
}

/**
 * Whether the line can be removed from the order at all.
 *
 * Removal is not an edit, it is the strongest edit there is, and the freeze has to
 * cover it too. A line that has left the warehouse is named by a waybill, by the
 * 'sale' movements that emptied the shelf, and possibly by an invoice the client
 * is holding; deleting it left all three pointing at nothing — the order total
 * dropped to zero while the invoice still asked for the full amount.
 *
 * There is a way back and it is the same one as everywhere else: cancel the
 * shipment, which returns the goods by opposite movements and withdraws the
 * document, and the line deletes freely afterwards.
 */
export function canDeleteLine(line: PricingLine): boolean {
  return line.shippedQuantity <= 0 && !line.documentIssued
}

/**
 * Every refusal the model can produce, as a message the admin can act on.
 * Matched by substring so a thrown Error, a rejected promise and a string all work.
 */
const ERROR_KEYS: Array<[string, string]> = [
  ['PRICE_FROZEN_BY_SHIPMENT', 'orders.error_line_price_frozen'],
  ['COST_FROZEN_BY_SHIPMENT', 'orders.error_line_cost_frozen'],
  ['LINE_FULLY_SHIPPED', 'orders.error_line_fully_shipped'],
  ['LINE_HAS_SHIPMENT', 'orders.error_line_has_shipment'],
  ['LINE_ON_INVOICE', 'orders.error_line_on_invoice'],
  ['BELOW_SHIPPED_QUANTITY', 'orders.error_below_shipped'],
  ['DISCOUNT_OUT_OF_RANGE', 'orders.error_discount_range'],
  ['MARGIN_OUT_OF_RANGE', 'orders.error_margin_range'],
  ['ZERO_QUANTITY', 'orders.error_zero_quantity'],
  ['MANUAL_COST_REASON_REQUIRED', 'orders.error_cost_reason_required'],
  ['RESET_COST_NOT_SUPPORTED', 'orders.error_reset_cost_unsupported'],
  ['NO_STOCK_COST', 'orders.error_no_stock_cost'],
  ['NO_COST_TO_MARK_UP', 'orders.error_no_cost_to_mark_up'],
  ['STATUS_BLOCKED_BY_STOCK', 'orders.error_status_blocked_by_stock'],
  ['SHIPMENT_EXCEEDS_STOCK', 'orders.error_shipment_exceeds_stock'],
  ['SHIPMENT_EXCEEDS_REMAINING', 'orders.error_shipment_exceeds_remaining'],
  ['DUPLICATE_SHIPMENT_LINE', 'orders.error_duplicate_shipment_line'],
  ['SHIPMENT_ALREADY_INVOICED', 'orders.error_shipment_already_invoiced'],
  ['SHIPMENT_ALREADY_CANCELLED', 'orders.error_shipment_already_cancelled'],
  ['SPLIT_MUST_MATCH_SHIPPED', 'orders.error_split_not_possible'],
  ['INVALID_SPLIT_QUANTITY', 'orders.error_split_not_possible'],
  // Money. `SHIPMENT_CANCELLED` sits after the shipment codes above on purpose:
  // the match is by substring, so a code that is contained in another has to come
  // second — here they only look alike, but the next one added may not.
  ['PAYMENT_AMOUNT_REQUIRED', 'orders.error_payment_amount_required'],
  ['PAYMENT_NOT_FOUND', 'orders.error_payment_not_found'],
  ['PAYMENT_INVOICE_NOT_FOUND', 'orders.error_original_invoice_not_found'],
  ['REFUND_MUST_BE_NEGATIVE', 'orders.error_refund_must_be_negative'],
  ['REFUND_INVOICE_REQUIRED', 'orders.error_refund_invoice_required'],
  ['INVOICE_NEEDS_SHIPMENT', 'orders.error_invoice_needs_shipment'],
  ['ADVANCE_HAS_NO_SHIPMENT', 'orders.error_advance_has_no_shipment'],
  ['CORRECTION_NEEDS_ORIGINAL', 'orders.error_correction_needs_original'],
  ['CORRECTION_NEEDS_KIND', 'orders.error_correction_needs_kind'],
  ['CORRECTION_REASON_REQUIRED', 'orders.error_correction_reason_required'],
  ['CORRECTION_NEEDS_CHANGE', 'orders.error_correction_needs_change'],
  ['LINE_NOT_FROZEN', 'orders.error_line_not_frozen'],
  ['ORIGINAL_INVOICE_NOT_FOUND', 'orders.error_original_invoice_not_found'],
  ['CANNOT_CORRECT_A_CORRECTION', 'orders.error_cannot_correct_a_correction'],
  ['INVOICE_ALREADY_CORRECTED', 'orders.error_invoice_already_corrected'],
  ['INVOICE_AMOUNT_AMBIGUOUS', 'orders.error_invoice_amount_ambiguous'],
  ['INVOICE_AMOUNT_REQUIRED', 'orders.error_invoice_amount_required'],
  ['SHIPMENT_CANCELLED', 'orders.error_shipment_cancelled_no_invoice'],
  ['FORBIDDEN_MANUALCOST', 'orders.error_forbidden_manual_cost'],
  ['FORBIDDEN_CORRECTION', 'orders.error_forbidden_correction'],
  ['ORDER_HAS_INVOICE', 'orders.error_order_has_invoice'],
  ['ORDER_HAS_SHIPMENT', 'orders.error_order_has_shipment'],
  ['ORDER_HAS_PAYMENT', 'orders.error_order_has_payment'],
  ['NEGATIVE_QUANTITY', 'orders.error_negative_value'],
  ['NEGATIVE_PRICE', 'orders.error_negative_value'],
  ['NEGATIVE_COST', 'orders.error_negative_value'],
  // Not found. Every one of these used to fall through to "could not save" —
  // which is the outcome contract §3 describes as the bad one: the person is told
  // that something went wrong and nothing about what.
  ['ORDER_AUDIT_ENTRY_NOT_FOUND', 'orders.error_order_audit_entry_not_found'],
  ['ORDER_FILE_NOT_FOUND', 'orders.error_order_file_not_found'],
  ['ORDER_ITEM_NOT_FOUND', 'orders.error_order_item_not_found'],
  ['ORDER_SERVICE_NOT_FOUND', 'orders.error_order_service_not_found'],
  ['ORDER_NOT_FOUND', 'orders.error_order_not_found'],
  ['CLIENT_NOT_FOUND', 'orders.error_client_not_found'],
  ['CATALOG_PRODUCT_NOT_FOUND', 'orders.error_catalog_product_not_found'],
  ['CATALOG_SERVICE_NOT_FOUND', 'orders.error_catalog_service_not_found'],
  ['ALLOCATION_LINE_NOT_FOUND', 'orders.error_allocation_line_not_found'],
  ['SHIPMENT_BATCH_NOT_FOUND', 'orders.error_shipment_batch_not_found'],
  ['SHIPMENT_HAS_NO_LINES', 'orders.error_shipment_has_no_lines'],
  ['SHIPMENT_QUANTITY_MUST_BE_POSITIVE', 'orders.error_shipment_quantity_positive'],
  ['SHIPMENT_NOT_FOUND', 'orders.error_shipment_not_found'],
  // Input the server refuses before it writes anything.
  ['ORDER_VERSION_CONFLICT', 'orders.error_version_conflict'],
  ['ALLOCATIONS_NOT_ACCEPTED', 'orders.error_allocations_not_accepted'],
  ['NUMBER_NOT_FINITE', 'orders.error_number_not_finite'],
  ['UNKNOWN_SORT_KEY', 'orders.error_unknown_sort_key'],
  ['UNKNOWN_SORT_DIRECTION', 'orders.error_unknown_sort_direction'],
  ['INVALID_PAGE', 'orders.error_invalid_page'],
  ['INVALID_DATE_FILTER', 'orders.error_invalid_date_filter'],
  // Spreading a total by hand. `BELOW_FROZEN_MINIMUM` and `NO_EDITABLE_LINES` are
  // also matched by substring in the card's total preview, so the backend has to
  // return these exact strings — §6 says so now.
  ['BELOW_FROZEN_MINIMUM', 'orders.error_below_frozen_minimum'],
  ['NO_EDITABLE_LINES', 'orders.error_no_editable_lines'],
  ['ZERO_BASE_TOTAL', 'orders.error_zero_base_total'],
  ['NEGATIVE_TARGET', 'orders.error_negative_target'],
  // Returns.
  ['RETURN_HAS_NO_LINES', 'orders.error_return_has_no_lines'],
  ['RETURN_REASON_REQUIRED', 'orders.error_return_reason_required'],
  ['RETURN_QUANTITY_MUST_BE_POSITIVE', 'orders.error_return_quantity_positive'],
  ['DUPLICATE_RETURN_LINE', 'orders.error_duplicate_return_line'],
  ['RETURN_EXCEEDS_SHIPPED', 'orders.error_return_exceeds_shipped'],
  ['RETURN_BATCH_NOT_FOUND', 'orders.error_return_batch_not_found'],
  ['RETURN_SPLITS_OFFCUT', 'orders.error_return_splits_offcut'],
  ['QUANTITY_SPLITS_OFFCUT', 'orders.error_quantity_splits_offcut'],
  ['CORRECTION_EXCEEDS_ORIGINAL', 'orders.error_correction_exceeds_original'],
  ['UNKNOWN_ORDER_STATUS', 'orders.error_unknown_order_status'],
  // Обрезки, выбранные руками. Каждый отказ свой: кусок исчез, кусок чужого товара,
  // кусок уже занят — это разные события, и «не удалось сохранить» на все три говорит
  // менеджеру ровно ничего.
  ['OFFCUTS_EXCEED_QUANTITY', 'orders.error_offcuts_exceed_quantity'],
  ['OFFCUTS_WITH_BATCH', 'orders.error_offcuts_with_batch'],
  ['OFFCUT_NOT_FOUND', 'orders.error_offcut_not_found'],
  ['OFFCUT_PRODUCT_MISMATCH', 'orders.error_offcut_product_mismatch'],
  ['OFFCUT_NOT_AVAILABLE', 'orders.error_offcut_not_available'],
  ['OFFCUT_SIZE_NOT_EXPRESSIBLE', 'orders.error_offcut_size_not_expressible'],
  // Internal invariants — a bug in the server, not something the person did. They
  // are here so the sentence is honest rather than absent; on a real server they
  // are a 500 and the code itself must not travel outwards.
  ['INVALID_LINE', 'orders.error_internal_invariant'],
  ['DUPLICATE_LINE_ID', 'orders.error_internal_invariant'],
  ['ALLOCATION_EXCEEDS_QUANTITY', 'orders.error_internal_invariant'],
  ['INVALID_VAT_RATE', 'orders.error_internal_invariant'],
]

/**
 * `fallback` is for callers whose failure is not a save: "could not save" on a
 * refused deletion is a message about the wrong operation.
 */
export function lineEditErrorKey(error: unknown, fallback = 'orders.toast_error_save'): string {
  const message = error instanceof Error ? error.message : String(error)
  for (const [code, key] of ERROR_KEYS) {
    if (message.includes(code)) return key
  }
  return fallback
}
