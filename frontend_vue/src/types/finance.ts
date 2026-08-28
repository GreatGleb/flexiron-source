export type PaymentDirection = 'incoming' | 'outgoing'

export type PaymentStatus = 'pending' | 'completed' | 'overdue' | 'cancelled'

export interface PaymentDocument {
  id: string
  name: string
  fileId: string
  url: string
  size: number
  mime: string
  uploadedAt: string
}

export interface FinancePayment {
  id: string
  paymentNumber: string
  direction: PaymentDirection
  status: PaymentStatus
  amount: number
  currency: string
  counterpartyId: string
  counterpartyName: string
  counterpartyVatCode: string
  orderId: string | null
  orderNumber: string | null
  supplierInvoiceRef: string | null
  description: string | null
  dueDate: string
  paidAt: string | null
  documents: PaymentDocument[]
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface FinancePaymentListItem {
  id: string
  paymentNumber: string
  direction: PaymentDirection
  status: PaymentStatus
  amount: number
  currency: string
  counterpartyName: string
  orderNumber: string | null
  supplierInvoiceRef: string | null
  dueDate: string
  paidAt: string | null
  documentCount: number
}

export interface FinancePaymentFilters {
  search: string
  status: string
  counterpartyId: string | null
  dateFrom: string
  dateTo: string
  direction: PaymentDirection | 'all'
}

export type ArchiveDocumentType = 'invoice' | 'facture' | 'waybill' | 'cmr' | 'other'

export interface FinanceDocumentArchiveItem {
  id: string
  name: string
  type: ArchiveDocumentType
  fileId: string
  url: string
  size: number
  mime: string
  relatedEntityType: 'order' | 'payment' | 'supplier' | 'client'
  relatedEntityId: string
  relatedEntityNumber: string
  uploadedAt: string
  uploadedBy: string
}
