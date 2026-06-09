import { apiGet, apiPost, apiPatch, apiDelete } from './api'
import type { Order, OrderListItem, OrderItem, OrderService, OrderFilters, OrderStatus, OrderDocumentType } from '@/types/order'
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
}): Promise<Order> {
  return apiPost('/api/orders', data)
}

export async function patchOrder(id: string, delta: Partial<Order>): Promise<Order> {
  return apiPatch(`/api/orders/${id}`, delta)
}

export async function patchOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  return apiPatch(`/api/orders/${id}/status`, { status })
}

export async function deleteOrder(id: string): Promise<void> {
  return apiDelete(`/api/orders/${id}`)
}

export async function addOrderItem(
  orderId: string,
  data: {
    productId: string
    quantity: number
    unit: string
    unitPrice: number
    batchId?: string | null
  },
): Promise<OrderItem> {
  return apiPost(`/api/orders/${orderId}/items`, data)
}

export async function updateOrderItem(
  orderId: string,
  lineId: string,
  delta: Partial<OrderItem>,
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
