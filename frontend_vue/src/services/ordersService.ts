import { apiGet, apiPost, apiPatch, apiDelete, newIdempotencyKey } from './api'
import type {
  Order,
  OrderListItem,
  OrderItem,
  OrderService,
  OrderFilters,
  OrderStatus,
  OrderDocumentType,
  Shipment,
  Invoice,
  Payment,
  InvoiceKind,
  PaymentPurpose,
  ShippableLine,
  OrderReturn,
  ReturnableLine,
  ReturnCondition,
  StatusTransitionPlan,
  SalesCrmStats,
  LineEditEnvelope,
} from '@/types/order'
import type { LineEditDelta } from './orderLineEdits'

/**
 * The body of `PATCH .../items/:id` as it really goes out: the edit, plus the
 * two things an edit needs that are not fields of the line — the order version
 * it was made against and, for `resetPrice`, the default it resets to.
 *
 * Kept as its own name so whoever implements the endpoint sees both halves.
 */
export type LineEditPayload = LineEditDelta & LineEditEnvelope

/**
 * The precondition for a request with no body.
 *
 * `undefined` means the caller never read a version and so cannot state one —
 * the header is left off entirely rather than sent empty, which is the same
 * distinction `withVersion` makes on the card for bodies.
 */
function ifMatch(version?: number): { headers: Record<string, string> } | undefined {
  return version === undefined ? undefined : { headers: { 'If-Match': String(version) } }
}
import type { StockReservation } from '@/types/warehouse'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

/**
 * The sales dashboard's four numbers.
 *
 * A separate call on purpose: they are counts and sums over every order and
 * every client, and a page of the orders list cannot produce them.
 */
export async function getSalesCrmStats(): Promise<SalesCrmStats> {
  return apiGet('/api/sales-crm/stats')
}

export async function getOrders(
  filters: OrderFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<OrderListItem>> {
  return apiGet('/api/orders', {
    ...filters,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  } as Record<string, string>)
}

export async function getOrder(id: string): Promise<Order> {
  return apiGet(`/api/orders/${id}`)
}

export async function createOrder(data: {
  clientId: string
  documentType: OrderDocumentType
  currency?: string
}): Promise<Order> {
  return apiPost('/api/orders', data)
}

export async function patchOrder(id: string, delta: Partial<Order>): Promise<Order> {
  return apiPatch(`/api/orders/${id}`, delta)
}

/**
 * What changing the status would do to the warehouse, without doing it.
 *
 * The settings let one status hold the remainder and one write it off, so for an
 * ordinary order the status change IS the shipping workflow. It must not be
 * silent: the card shows this plan, and refuses the change when the goods are
 * not there.
 */
export async function planOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<StatusTransitionPlan> {
  return apiGet(`/api/orders/${id}/status-plan`, { status })
}

export async function patchOrderStatus(
  id: string,
  status: OrderStatus,
  version?: number,
): Promise<Order> {
  return apiPatch(`/api/orders/${id}/status`, { status, version })
}

/**
 * A DELETE carries no body, so the version it is written against travels as
 * `If-Match` — contract §3 names that header for exactly this. Everything else
 * states it in the payload; the precondition is the same either way.
 */
export async function deleteOrder(id: string, version?: number): Promise<void> {
  return apiDelete(`/api/orders/${id}`, ifMatch(version))
}

/**
 * Adds a line. The cost is the server's to read off the warehouse; what goes out
 * from here is the admin's decision — a price from the catalogue, or a markup
 * when the product carries no price, plus the discount the chosen add-mode implies.
 */
export async function addOrderItem(
  orderId: string,
  data: {
    productId: string
    quantity: number
    unit: string
    unitPrice: number
    marginPercent?: number
    discountPercent?: number
    batchId?: string | null
    /**
     * Обрезки, выбранные руками, — куски, с которых строка начинает своё покрытие.
     * В FIFO обрезки не попадают: их выбирают глазами по размеру (пункт 7 плана
     * `review-followups.md`), поэтому назвать их можно только здесь.
     */
    offcutIds?: string[]
    /** The order version this line is being added to — contract §3. */
    version?: number
  },
): Promise<OrderItem> {
  return apiPost(`/api/orders/${orderId}/items`, data)
}

/**
 * One line edit. `LineEditPayload` is the honest shape of the wire format — it
 * carries `lineTotal` and `resetPrice`, which are edits rather than fields, the
 * default `resetPrice` is settled against, and the order version the edit was
 * made against; a signature of `Partial<OrderItem>` would hide all four from
 * whoever implements the real endpoint. Build the edit itself with
 * `lineEditDelta`, never by hand.
 */
export async function updateOrderItem(
  orderId: string,
  lineId: string,
  delta: LineEditPayload,
): Promise<OrderItem> {
  return apiPatch(`/api/orders/${orderId}/items/${lineId}`, delta)
}

export async function deleteOrderItem(
  orderId: string,
  lineId: string,
  version?: number,
): Promise<void> {
  return apiDelete(`/api/orders/${orderId}/items/${lineId}`, ifMatch(version))
}

export async function addOrderService(
  orderId: string,
  data: {
    serviceId: string
    quantity: number
    price?: number
    discountPercent?: number
    /** The order version this line is being added to — contract §3. */
    version?: number
  },
): Promise<OrderService> {
  return apiPost(`/api/orders/${orderId}/services`, data)
}

export async function deleteOrderService(
  orderId: string,
  serviceId: string,
  version?: number,
): Promise<void> {
  return apiDelete(`/api/orders/${orderId}/services/${serviceId}`, ifMatch(version))
}

export async function deleteOrderAuditEntry(
  orderId: string,
  entryId: string,
  version?: number,
): Promise<void> {
  return apiDelete(`/api/orders/${orderId}/audit/${entryId}`, ifMatch(version))
}

export async function addOrderFile(
  orderId: string,
  fileId: string,
  version?: number,
): Promise<void> {
  return apiPost(`/api/orders/${orderId}/files`, { fileId, version })
}

export async function removeOrderFile(
  orderId: string,
  fileId: string,
  version?: number,
): Promise<void> {
  return apiDelete(`/api/orders/${orderId}/files/${fileId}`, ifMatch(version))
}

// ─── Pricing, shipments, invoices, payments ─────────────────────────────────

export async function updateOrderService(
  orderId: string,
  serviceLineId: string,
  delta: LineEditPayload,
): Promise<OrderService> {
  return apiPatch(`/api/orders/${orderId}/services/${serviceLineId}`, delta)
}

/**
 * Spreads a manually entered gross total across the editable lines. Returns the
 * per-line preview and the total the order will really come to — some gross
 * amounts are unreachable once VAT is rounded to cents.
 */
export async function allocateOrderTotal(
  orderId: string,
  targetGross: number,
  version?: number,
): Promise<{
  order: Order
  requestedGross: number
  achievedGross: number
  rows: Array<{ lineId: string; before: number; after: number }>
}> {
  return apiPost(`/api/orders/${orderId}/allocate-total`, { targetGross, version })
}

/** Cuts a partially shipped line into the shipped part and a free remainder. */
export async function splitOrderItem(
  orderId: string,
  lineId: string,
  shippedQuantity: number,
  version?: number,
): Promise<{ shipped: OrderItem; remainder: OrderItem }> {
  return apiPost(`/api/orders/${orderId}/items/${lineId}/split`, { shippedQuantity, version })
}

/**
 * Corrects a frozen line — the only way past the freeze (model, sections 6 and 12).
 *
 * Needs the `correction` right and a reason, both enforced by the server, and it
 * issues a correcting invoice for the difference wherever the client is holding a
 * document that named the line. The warehouse is not touched: this fixes a figure,
 * not a delivery.
 */
export async function correctOrderLine(
  orderId: string,
  lineId: string,
  data: { unitPrice?: number; unitCost?: number; reason: string; version?: number },
): Promise<OrderItem | OrderService> {
  return apiPost(`/api/orders/${orderId}/items/${lineId}/correct`, data)
}

/** Which lines can go on a truck right now, and how much of each. */
export async function planOrderShipment(orderId: string): Promise<ShippableLine[]> {
  return apiGet(`/api/orders/${orderId}/ship-plan`)
}

export async function getOrderShipments(orderId: string): Promise<Shipment[]> {
  return apiGet(`/api/orders/${orderId}/shipments`)
}

export async function createOrderShipment(
  orderId: string,
  data: {
    lines: Array<{ lineId: string; quantity: number }>
    carrier?: string | null
    vehicle?: string | null
    waybillNumber?: string | null
    shippedAt?: string
    /** The order version this shipment is written against — contract §3. */
    version?: number
  },
): Promise<Shipment> {
  // Contract §3: mandatory here. A retry — a slow answer, a double click, a
  // reconnect — must not put a second truck on the road: the key lets the server
  // recognise the repeat and hand back the first answer instead of shipping
  // again. Sending it is the client's half of the deal, and a server that can
  // accept the header is no use if nobody ever sends one.
  return apiPost(`/api/orders/${orderId}/shipments`, data, {
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  })
}

/** Reverse movements, never a deletion — warehouse history has to add up. */
/**
 * `correctionReason` is required to cancel a delivery the client has an invoice
 * for — the server issues the correcting invoice and returns the goods in one
 * call, so the document and the warehouse can never disagree.
 */
export async function cancelOrderShipment(
  orderId: string,
  shipmentId: string,
  data: { correctionReason?: string | null; version?: number } = {},
): Promise<Shipment> {
  return apiPost(`/api/orders/${orderId}/shipments/${shipmentId}/cancel`, data)
}

// ─── Returns ────────────────────────────────────────────────────────────────

export async function getOrderReturns(orderId: string): Promise<OrderReturn[]> {
  return apiGet(`/api/orders/${orderId}/returns`)
}

/** What can still come back: shipped, already returned, and the difference. */
export async function planOrderReturn(orderId: string): Promise<ReturnableLine[]> {
  return apiGet(`/api/orders/${orderId}/return-plan`)
}

/**
 * Goods coming back from the client.
 *
 * Not the same operation as cancelling a shipment: that one says the delivery
 * never effectively happened, this one says it happened and was reversed. Each
 * line states two things independently — whether the goods are sellable, and
 * whether the money goes back — because a damaged return can still be refunded
 * and a sound one can be kept against a debt.
 */
export async function createOrderReturn(
  orderId: string,
  data: {
    lines: Array<{
      lineId: string
      quantity: number
      condition: ReturnCondition
      compensated: boolean
    }>
    reason: string
    returnedAt?: string
    /** The order version this return is written against — contract §3. */
    version?: number
  },
): Promise<OrderReturn> {
  // Same deal as the shipment above: a repeat — a slow answer, a double click, a
  // reconnect — must not put the goods back on the shelf twice and issue two
  // credit notes for one lot of returned steel.
  return apiPost(`/api/orders/${orderId}/returns`, data, {
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  })
}

export async function reserveOrderStock(
  orderId: string,
  version?: number,
): Promise<StockReservation[]> {
  return apiPost(`/api/orders/${orderId}/reserve`, { version })
}

export async function getOrderReservations(orderId: string): Promise<StockReservation[]> {
  return apiGet(`/api/orders/${orderId}/reservations`)
}

export async function getOrderPayments(orderId: string): Promise<Payment[]> {
  return apiGet(`/api/orders/${orderId}/payments`)
}

export async function addOrderPayment(
  orderId: string,
  data: {
    amount: number
    purpose?: PaymentPurpose
    paidAt?: string
    invoiceId?: string | null
    note?: string | null
    /** The order version this payment is written against — contract §3. */
    version?: number
  },
): Promise<Payment> {
  // Same as the shipment above, and for the same money: two payments of 500 sent
  // twice read as 1000 received (contract §3).
  return apiPost(`/api/orders/${orderId}/payments`, data, {
    headers: { 'Idempotency-Key': newIdempotencyKey() },
  })
}

export async function deleteOrderPayment(
  orderId: string,
  paymentId: string,
  version?: number,
): Promise<void> {
  return apiDelete(`/api/orders/${orderId}/payments/${paymentId}`, ifMatch(version))
}

export async function getOrderInvoices(orderId: string): Promise<Invoice[]> {
  return apiGet(`/api/orders/${orderId}/invoices`)
}

export async function createOrderInvoice(
  orderId: string,
  data: {
    kind?: InvoiceKind
    shipmentId?: string | null
    correctsInvoiceId?: string | null
    amountNet?: number
    /** What the client pays. The server turns it into net — VAT is its arithmetic. */
    amountGross?: number
    reason?: string | null
    /** The order version this invoice is written against — contract §3. */
    version?: number
  },
): Promise<Invoice> {
  return apiPost(`/api/orders/${orderId}/invoices`, data)
}
