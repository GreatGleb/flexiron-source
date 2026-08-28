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

/**
 * Фильтры списка финансового раздела — одни и те же для реестра входящих и для
 * счетов поставщиков: обе страницы фильтруют по строке поиска и по статусу.
 *
 * Направления здесь больше нет: «Входящие» и «Исходящие» — разные сущности с
 * разными эндпоинтами, а не одна таблица с флагом.
 */
export interface FinanceListFilters {
  search: string
  status: string
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

// ─── Реестр входящих: представление над счетами заказов ─────────────────────

/**
 * Статус счёта к получению. Хранилища у него нет — он выводится из суммы счёта,
 * привязанных к нему платежей и срока (`domain/receivable.ts`).
 *
 * `cancelled` здесь нет намеренно: счёт, отозванный корректировкой, в реестре не
 * показывается вовсе, а отменённого счёта в модели заказа не существует.
 */
export type ReceivableStatus = 'pending' | 'overdue' | 'completed'

/**
 * Строка реестра «Входящие» — это счёт заказа, а не отдельная запись.
 *
 * Своего хранилища у реестра нет: номер, дата и сумма берутся со счёта, срок — из
 * условий оплаты клиента, а поступления — из платежей заказа. Пункт 13 плана
 * `review-followups.md`.
 */
export interface Receivable {
  /** Идентификатор счёта заказа — своего id у строки реестра нет. */
  id: string
  invoiceNumber: string
  issuedAt: string
  dueDate: string
  orderId: string
  orderNumber: string
  clientId: string
  clientName: string
  currency: string
  /** Сумма счёта с НДС, включая корректировки, которые её уже поправили. */
  amount: number
  /** Сколько по этому счёту пришло — сумма привязанных к нему платежей. */
  paidAmount: number
  /** Остаток к оплате; отрицательным не бывает — переплата остаётся нулём. */
  outstandingAmount: number
  /** Дата платежа, который закрыл счёт; пока не закрыт — `null`. */
  paidAt: string | null
  status: ReceivableStatus
}
