import type {
  FinancePayment,
  FinancePaymentListItem,
  PaymentDocument,
  FinanceDocumentArchiveItem,
  PaymentDirection,
  PaymentStatus,
  ArchiveDocumentType,
} from '@/types/finance'

// ─── Helpers ───
function rnd(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function pick<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function dateStr(daysOffset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString()
}

// ─── Counterparties ───
const CLIENTS = [
  { id: 'CL-001', name: 'UAB Metalica', vatCode: 'LT304567890' },
  { id: 'CL-002', name: 'AB Plienas', vatCode: 'LT401234567' },
  { id: 'CL-003', name: 'UAB Konstrukcija', vatCode: 'LT509876543' },
  { id: 'CL-004', name: 'MB Metalo Darbai', vatCode: 'LT607890123' },
  { id: 'CL-005', name: 'UAB Vamzdynas', vatCode: 'LT708901234' },
]

const SUPPLIERS = [
  { id: 'sup-001', name: 'ArcelorMittal', vatCode: 'LU12345678' },
  { id: 'sup-002', name: 'SSAB AB', vatCode: 'SE98765432' },
  { id: 'sup-003', name: 'ThyssenKrupp', vatCode: 'DE34567890' },
  { id: 'sup-004', name: 'voestalpine', vatCode: 'AT45678901' },
  { id: 'sup-005', name: 'UAB Metalo Importas', vatCode: 'LT809012345' },
]

const ORDERS = [
  { id: 'ORD-001', number: 'ORD-2026-001' },
  { id: 'ORD-002', number: 'ORD-2026-002' },
  { id: 'ORD-005', number: 'ORD-2026-005' },
  { id: 'ORD-008', number: 'ORD-2026-008' },
  { id: 'ORD-012', number: 'ORD-2026-012' },
]

// ─── Generate PaymentDocuments ───
function generateDocuments(count: number): PaymentDocument[] {
  const docs: PaymentDocument[] = []
  for (let i = 0; i < count; i++) {
    const isInvoice = Math.random() > 0.5
    const seq = Math.floor(Math.random() * 100)
    docs.push({
      id: `pdoc-${Date.now()}-${i}`,
      name: isInvoice
        ? `Invoice #INV-2026-${String(seq).padStart(3, '0')}`
        : `Facture #FAC-2026-${String(seq).padStart(3, '0')}`,
      fileId: `file-${Date.now()}-${i}`,
      url: `#uploaded/file-${Date.now()}-${i}`,
      size: Math.floor(Math.random() * 500000) + 50000,
      mime: 'application/pdf',
      uploadedAt: dateStr(-Math.floor(Math.random() * 30)),
    })
  }
  return docs
}

// ─── Generate Payments ───
const MOCK_PAYMENTS: FinancePayment[] = [
  ...CLIENTS.slice(0, 4).map((cl, idx) => ({
    id: `pay-in-${idx + 1}`,
    paymentNumber: `PAY-2026-${String(idx + 1).padStart(3, '0')}`,
    direction: 'incoming' as PaymentDirection,
    status: pick(['pending', 'completed', 'overdue'] as PaymentStatus[]),
    amount: rnd(500, 15000),
    currency: 'EUR',
    counterpartyId: cl.id,
    counterpartyName: cl.name,
    counterpartyVatCode: cl.vatCode,
    orderId: ORDERS[idx]!.id,
    orderNumber: ORDERS[idx]!.number,
    supplierInvoiceRef: null,
    description: `Payment for order ${ORDERS[idx]!.number}`,
    dueDate: dateStr(-idx * 3),
    paidAt: Math.random() > 0.5 ? dateStr(-idx * 5) : null,
    documents: generateDocuments(Math.floor(Math.random() * 3) + 1),
    notes: Math.random() > 0.7 ? `Client confirmed payment via bank transfer.` : null,
    createdAt: dateStr(-20),
    updatedAt: dateStr(-1),
  })),
  ...SUPPLIERS.slice(0, 3).map((sp, idx) => ({
    id: `pay-out-${idx + 1}`,
    paymentNumber: `PAY-2026-${String(idx + 5).padStart(3, '0')}`,
    direction: 'outgoing' as PaymentDirection,
    status: pick(['pending', 'completed', 'overdue'] as PaymentStatus[]),
    amount: rnd(2000, 50000),
    currency: 'EUR',
    counterpartyId: sp.id,
    counterpartyName: sp.name,
    counterpartyVatCode: sp.vatCode,
    orderId: null,
    orderNumber: null,
    supplierInvoiceRef: `INV-SUP-2026-${String(Math.floor(Math.random() * 100)).padStart(3, '0')}`,
    description: `Payment to ${sp.name}`,
    dueDate: dateStr(idx * 5),
    paidAt: Math.random() > 0.6 ? dateStr(idx * 2) : null,
    documents: generateDocuments(Math.floor(Math.random() * 2) + 1),
    notes: null,
    createdAt: dateStr(-15),
    updatedAt: dateStr(-1),
  })),
]

// ─── Generate Archive Documents ───
const ARCHIVE_TYPES: ArchiveDocumentType[] = ['invoice', 'facture', 'waybill', 'cmr']
const RELATED_TYPES = ['order', 'payment', 'supplier', 'client'] as const

const MOCK_ARCHIVE: FinanceDocumentArchiveItem[] = Array.from({ length: 15 }, (_, i): FinanceDocumentArchiveItem => {
  const type = pick(ARCHIVE_TYPES)
  const relatedType = pick(RELATED_TYPES)
  const seq = String(Math.floor(Math.random() * 100)).padStart(3, '0')
  const entityNumber =
    relatedType === 'order'
      ? `ORD-2026-${seq}`
      : relatedType === 'payment'
        ? `PAY-2026-${seq}`
        : relatedType === 'supplier'
          ? `SUP-${seq}`
          : `CL-${seq}`
  return {
    id: `arch-${i + 1}`,
    name: type === 'invoice'
      ? `Invoice #INV-2026-${seq}`
      : type === 'facture'
        ? `Facture #FAC-2026-${seq}`
        : type === 'waybill'
          ? `Waybill #WB-2026-${seq}`
          : `CMR #CMR-2026-${seq}`,
    type,
    fileId: `file-arch-${i}`,
    url: `#uploaded/file-arch-${i}`,
    size: Math.floor(Math.random() * 800000) + 50000,
    mime: 'application/pdf',
    relatedEntityType: relatedType,
    relatedEntityId: `${relatedType}-${i}`,
    relatedEntityNumber: entityNumber,
    uploadedAt: dateStr(-Math.floor(Math.random() * 60)),
    uploadedBy: pick(['Maxim V.', 'Anna K.', 'John D.', 'Laura S.']),
  }
})

// ─── Mock Functions ───

export function mockGetPayments(
  direction: PaymentDirection | 'all',
  params: { search?: string; status?: string; counterpartyId?: string | null; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number },
): { items: FinancePaymentListItem[]; total: number; page: number; pageSize: number; totalPages: number } {
  let filtered = MOCK_PAYMENTS.filter((p) => direction === 'all' || p.direction === direction)

  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter(
      (p) =>
        p.paymentNumber.toLowerCase().includes(q) ||
        p.counterpartyName.toLowerCase().includes(q) ||
        (p.orderNumber && p.orderNumber.toLowerCase().includes(q)),
    )
  }
  if (params.status && params.status !== 'all') {
    filtered = filtered.filter((p) => p.status === params.status)
  }
  if (params.counterpartyId) {
    filtered = filtered.filter((p) => p.counterpartyId === params.counterpartyId)
  }

  const total = filtered.length
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize).map((p) => ({
    id: p.id,
    paymentNumber: p.paymentNumber,
    direction: p.direction,
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    counterpartyName: p.counterpartyName,
    orderNumber: p.orderNumber,
    supplierInvoiceRef: p.supplierInvoiceRef,
    dueDate: p.dueDate,
    paidAt: p.paidAt,
    documentCount: p.documents.length,
  }))

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export function mockGetPayment(id: string): FinancePayment {
  const payment = MOCK_PAYMENTS.find((p) => p.id === id)
  if (!payment) throw new Error('PAYMENT_NOT_FOUND')
  return payment
}

export function mockGetArchive(
  params: { search?: string; type?: string; relatedEntityType?: string; page?: number; pageSize?: number },
): { items: FinanceDocumentArchiveItem[]; total: number; page: number; pageSize: number; totalPages: number } {
  let filtered = [...MOCK_ARCHIVE]

  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter((d) => d.name.toLowerCase().includes(q) || d.relatedEntityNumber.toLowerCase().includes(q))
  }
  if (params.type && params.type !== 'all') {
    filtered = filtered.filter((d) => d.type === params.type)
  }
  if (params.relatedEntityType && params.relatedEntityType !== 'all') {
    filtered = filtered.filter((d) => d.relatedEntityType === params.relatedEntityType)
  }

  const total = filtered.length
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export function mockAddPaymentDocument(paymentId: string, document: PaymentDocument): FinancePayment {
  const payment = MOCK_PAYMENTS.find((p) => p.id === paymentId)
  if (!payment) throw new Error('PAYMENT_NOT_FOUND')
  payment.documents.push(document)
  return payment
}

export function mockRemovePaymentDocument(paymentId: string, documentId: string): FinancePayment {
  const payment = MOCK_PAYMENTS.find((p) => p.id === paymentId)
  if (!payment) throw new Error('PAYMENT_NOT_FOUND')
  payment.documents = payment.documents.filter((d) => d.id !== documentId)
  return payment
}

export function mockPatchPayment(id: string, data: Partial<FinancePayment>): FinancePayment {
  const idx = MOCK_PAYMENTS.findIndex((p) => p.id === id)
  if (idx === -1) throw new Error('PAYMENT_NOT_FOUND')
  const updated: FinancePayment = { ...MOCK_PAYMENTS[idx]!, ...data, updatedAt: new Date().toISOString() }
  MOCK_PAYMENTS[idx] = updated
  return updated
}
