import type { StockAuditEntry } from './warehouse'

export type OrderDocumentType = 'local' | 'export'

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'picking'
  | 'packing'
  | 'shipped'
  | 'delivered'
  | 'paid'
  | 'cancelled'

export interface OrderListItem {
  id: string
  orderNumber: string
  clientId: string
  clientName: string
  status: OrderStatus
  totalAmount: number
  currency: string
  itemCount: number
  createdAt: string
}

export interface OrderItem {
  id: string
  lineNumber: number
  productId: string
  productName: string
  quantity: number
  unit: string
  unitPrice: number
  unitCost?: number
  discount: number
  totalPrice: number
  batchId: string | null
  offcutId: string | null
  receivedCurrency: string     // UUID of batch's original currency
  exchangeRate: number | null  // rate from receivedCurrency → order.currency
}

export interface OrderService {
  id: string
  serviceId: string
  serviceName: string
  cost: number
  price: number
  margin: number
  quantity: number
}

export interface OrderDocument {
  id: string
  type: string
  generatedAt: string
  generatedBy: string
  url: string
}

export interface Order {
  id: string
  orderNumber: string
  clientId: string
  clientName: string
  clientVatCode: string
  clientAddress: string
  documentType: OrderDocumentType
  status: OrderStatus
  items: OrderItem[]
  services: OrderService[]
  totalAmount: number
  totalVat: number
  totalWithVat: number
  totalWeight: number
  currency: string
  vatPercent: number
  marginPercent: number
  notes: string | null
  documents: OrderDocument[]
  files: OrderFile[]
  auditLog: StockAuditEntry[]
  createdAt: string
  updatedAt: string
}

export interface OrderFile {
  id: string
  name: string
  fileId: string
  url: string
  size: number
  mime: string
  uploadedAt: string
}

export interface OrderFilters {
  search: string
  status: string
  clientId: string | null
  dateFrom: string
  dateTo: string
  sortBy: string | null
  sortDir: string
}
