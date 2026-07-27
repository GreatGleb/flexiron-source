import { apiGet, apiPost, apiPatch, apiDelete } from './api'
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
  StatusTransitionPlan,
} from '@/types/order'
import type { LineEditDelta } from './orderLineEdits'
import type { StockReservation } from '@/types/warehouse'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

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

export async function patchOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  return apiPatch(`/api/orders/${id}/status`, { status })
}

export async function deleteOrder(id: string): Promise<void> {
  return apiDelete(`/api/orders/${id}`)
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
  },
): Promise<OrderItem> {
  return apiPost(`/api/orders/${orderId}/items`, data)
}

/**
 * One line edit. `LineEditDelta` is the honest shape of the wire format — it
 * carries `lineTotal` and `resetPrice`, which are edits rather than fields, and
 * a signature of `Partial<OrderItem>` would hide them from whoever implements
 * the real endpoint. Build it with `lineEditDelta`, never by hand.
 */
export async function updateOrderItem(
  orderId: string,
  lineId: string,
  delta: LineEditDelta,
): Promise<OrderItem> {
  return apiPatch(`/api/orders/${orderId}/items/${lineId}`, delta)
}

export async function deleteOrderItem(orderId: string, lineId: string): Promise<void> {
  return apiDelete(`/api/orders/${orderId}/items/${lineId}`)
}

export async function addOrderService(
  orderId: string,
  data: {
    serviceId: string
    quantity: number
    price?: number
    discountPercent?: number
  },
): Promise<OrderService> {
  return apiPost(`/api/orders/${orderId}/services`, data)
}

export async function deleteOrderService(orderId: string, serviceId: string): Promise<void> {
  return apiDelete(`/api/orders/${orderId}/services/${serviceId}`)
}

export async function deleteOrderAuditEntry(orderId: string, entryIndex: number): Promise<void> {
  return apiDelete(`/api/orders/${orderId}/audit/${entryIndex}`)
}

export async function addOrderFile(orderId: string, fileId: string): Promise<void> {
  return apiPost(`/api/orders/${orderId}/files`, { fileId })
}

export async function removeOrderFile(orderId: string, fileId: string): Promise<void> {
  return apiDelete(`/api/orders/${orderId}/files/${fileId}`)
}

// ─── Pricing, shipments, invoices, payments ─────────────────────────────────

export async function updateOrderService(
  orderId: string,
  serviceLineId: string,
  delta: LineEditDelta,
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
): Promise<{
  order: Order
  requestedGross: number
  achievedGross: number
  rows: Array<{ lineId: string; before: number; after: number }>
}> {
  return apiPost(`/api/orders/${orderId}/allocate-total`, { targetGross })
}

/** Cuts a partially shipped line into the shipped part and a free remainder. */
export async function splitOrderItem(
  orderId: string,
  lineId: string,
  shippedQuantity: number,
): Promise<{ shipped: OrderItem; remainder: OrderItem }> {
  return apiPost(`/api/orders/${orderId}/items/${lineId}/split`, { shippedQuantity })
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
  },
): Promise<Shipment> {
  return apiPost(`/api/orders/${orderId}/shipments`, data)
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
  data: { correctionReason?: string | null } = {},
): Promise<Shipment> {
  return apiPost(`/api/orders/${orderId}/shipments/${shipmentId}/cancel`, data)
}

export async function reserveOrderStock(orderId: string): Promise<StockReservation[]> {
  return apiPost(`/api/orders/${orderId}/reserve`, {})
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
  },
): Promise<Payment> {
  return apiPost(`/api/orders/${orderId}/payments`, data)
}

export async function deleteOrderPayment(orderId: string, paymentId: string): Promise<void> {
  return apiDelete(`/api/orders/${orderId}/payments/${paymentId}`)
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
  },
): Promise<Invoice> {
  return apiPost(`/api/orders/${orderId}/invoices`, data)
}
