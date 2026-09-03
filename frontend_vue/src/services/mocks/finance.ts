import type {
  FinancePayment,
  FinancePaymentListItem,
  PaymentDocument,
  FinanceDocumentArchiveItem,
  Receivable,
  FinanceListFilters,
} from '@/types/finance'
import { notifyPaymentOverdue } from './notifications'
import { orderReceivables } from './orders'

/**
 * Финансовый модуль демо-стенда.
 *
 * Пункт 13 плана `review-followups.md`: у одной суммы один владелец. «Входящие» —
 * это ПРЕДСТАВЛЕНИЕ над счетами заказов, своего хранилища у них нет; «Исходящие» —
 * самостоятельные записи, потому что заказа поставщику в системе не существует и
 * выводить их не из чего.
 *
 * Случайной генерации здесь нет ни одной. Раньше сумма, статус и дата оплаты
 * бросались `Math.random()`, но подписывались номером НАСТОЯЩЕГО заказа — и
 * страница показывала выдуманное число под реальным документом, не сходящееся с
 * самим заказом. Демо-данные держатся ровно тех же правил, что приложение.
 */

// ─── Helpers ───

function dateStr(daysOffset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysOffset)
  return d.toISOString()
}

function clone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.ceil(items.length / pageSize),
  }
}

// ─── Реестр входящих ────────────────────────────────────────────────────────

/**
 * Счета, о просрочке которых уведомление уже написано.
 *
 * Просрочка — состояние, а уведомление — событие: без этой памяти один и тот же
 * факт попадал бы в ленту при каждом открытии страницы, и колокольчик считал бы
 * не события, а обращения (см. `notifications.ts` — «каждый эмиттер зовётся на
 * переходе, а не на повторяющемся моменте»).
 */
const overdueNotified = new Set<string>()

function receivables(): Receivable[] {
  const rows = orderReceivables()
  for (const row of rows) {
    if (row.status !== 'overdue' || overdueNotified.has(row.id)) continue
    overdueNotified.add(row.id)
    notifyPaymentOverdue({
      paymentNumber: row.invoiceNumber,
      direction: 'incoming',
      dueDate: row.dueDate,
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      counterpartyId: row.clientId,
      counterpartyName: row.clientName,
    })
  }
  return rows
}

export function mockGetReceivables(
  params: FinanceListFilters & { page?: number; pageSize?: number },
): { items: Receivable[]; total: number; page: number; pageSize: number; totalPages: number } {
  let filtered = receivables()

  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter(
      (r) =>
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        r.orderNumber.toLowerCase().includes(q),
    )
  }
  if (params.status && params.status !== 'all') {
    filtered = filtered.filter((r) => r.status === params.status)
  }

  // Ближайший срок сверху: реестр читают, чтобы узнать, чем заняться сегодня.
  filtered.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return paginate(filtered, params.page ?? 1, params.pageSize ?? 25)
}

// ─── Исходящие платежи ──────────────────────────────────────────────────────

const SUPPLIERS = [
  { id: 'sup-001', name: 'ArcelorMittal', vatCode: 'LU12345678' },
  { id: 'sup-002', name: 'SSAB AB', vatCode: 'SE98765432' },
  { id: 'sup-003', name: 'ThyssenKrupp', vatCode: 'DE34567890' },
  { id: 'sup-004', name: 'voestalpine', vatCode: 'AT45678901' },
  { id: 'sup-005', name: 'UAB Metalo Importas', vatCode: 'LT809012345' },
]

function supplierDoc(seq: number, name: string, daysAgo: number): PaymentDocument {
  return {
    id: `pdoc-${seq}`,
    name,
    fileId: `file-fin-${seq}`,
    url: `#uploaded/file-fin-${seq}`,
    size: 120_000 + seq * 15_000,
    mime: 'application/pdf',
    uploadedAt: dateStr(-daysAgo),
  }
}

/**
 * Заданные вручную счета поставщиков.
 *
 * Даты относительные, а не календарные: фиксированная дата протухает сама по
 * себе, и через месяц «ожидается» стоит рядом со сроком в прошлом. Статус здесь
 * хранится — в отличие от входящих: выводить его не из чего, поступлений по
 * счёту поставщика система не знает. Поэтому seed самосогласован руками: у
 * оплаченных есть дата оплаты, у просроченных срок в прошлом и оплаты нет.
 */
const MOCK_PAYMENTS: FinancePayment[] = [
  {
    id: 'pay-out-1',
    paymentNumber: 'PAY-2026-001',
    direction: 'outgoing',
    status: 'completed',
    amount: 18450,
    currency: 'EUR',
    counterpartyId: SUPPLIERS[0]!.id,
    counterpartyName: SUPPLIERS[0]!.name,
    counterpartyVatCode: SUPPLIERS[0]!.vatCode,
    orderId: null,
    orderNumber: null,
    supplierInvoiceRef: 'INV-SUP-2026-014',
    description: `Payment to ${SUPPLIERS[0]!.name}`,
    dueDate: dateStr(-21),
    paidAt: dateStr(-19),
    documents: [
      supplierDoc(1, 'Invoice #INV-SUP-2026-014', 24),
      supplierDoc(2, 'CMR #CMR-2026-014', 22),
    ],
    notes: 'Paid by bank transfer, two days after the due date.',
    createdAt: dateStr(-30),
    updatedAt: dateStr(-19),
  },
  {
    id: 'pay-out-2',
    paymentNumber: 'PAY-2026-002',
    direction: 'outgoing',
    status: 'overdue',
    amount: 7320.5,
    currency: 'EUR',
    counterpartyId: SUPPLIERS[1]!.id,
    counterpartyName: SUPPLIERS[1]!.name,
    counterpartyVatCode: SUPPLIERS[1]!.vatCode,
    orderId: null,
    orderNumber: null,
    supplierInvoiceRef: 'INV-SUP-2026-021',
    description: `Payment to ${SUPPLIERS[1]!.name}`,
    dueDate: dateStr(-9),
    paidAt: null,
    documents: [supplierDoc(3, 'Invoice #INV-SUP-2026-021', 16)],
    notes: null,
    createdAt: dateStr(-16),
    updatedAt: dateStr(-9),
  },
  {
    id: 'pay-out-3',
    paymentNumber: 'PAY-2026-003',
    direction: 'outgoing',
    status: 'pending',
    amount: 24800,
    currency: 'EUR',
    counterpartyId: SUPPLIERS[2]!.id,
    counterpartyName: SUPPLIERS[2]!.name,
    counterpartyVatCode: SUPPLIERS[2]!.vatCode,
    orderId: null,
    orderNumber: null,
    supplierInvoiceRef: 'INV-SUP-2026-033',
    description: `Payment to ${SUPPLIERS[2]!.name}`,
    dueDate: dateStr(12),
    paidAt: null,
    documents: [supplierDoc(4, 'Invoice #INV-SUP-2026-033', 3)],
    notes: null,
    createdAt: dateStr(-3),
    updatedAt: dateStr(-3),
  },
  {
    id: 'pay-out-4',
    paymentNumber: 'PAY-2026-004',
    direction: 'outgoing',
    status: 'pending',
    amount: 5140.75,
    currency: 'EUR',
    counterpartyId: SUPPLIERS[3]!.id,
    counterpartyName: SUPPLIERS[3]!.name,
    counterpartyVatCode: SUPPLIERS[3]!.vatCode,
    orderId: null,
    orderNumber: null,
    supplierInvoiceRef: 'INV-SUP-2026-040',
    description: `Payment to ${SUPPLIERS[3]!.name}`,
    dueDate: dateStr(26),
    paidAt: null,
    documents: [],
    notes: null,
    createdAt: dateStr(-1),
    updatedAt: dateStr(-1),
  },
  {
    id: 'pay-out-5',
    paymentNumber: 'PAY-2026-005',
    direction: 'outgoing',
    status: 'completed',
    amount: 2980,
    currency: 'EUR',
    counterpartyId: SUPPLIERS[4]!.id,
    counterpartyName: SUPPLIERS[4]!.name,
    counterpartyVatCode: SUPPLIERS[4]!.vatCode,
    orderId: null,
    orderNumber: null,
    supplierInvoiceRef: 'INV-SUP-2026-007',
    description: `Payment to ${SUPPLIERS[4]!.name}`,
    dueDate: dateStr(-35),
    paidAt: dateStr(-35),
    documents: [supplierDoc(5, 'Invoice #INV-SUP-2026-007', 40)],
    notes: 'Prepaid on the day the invoice arrived.',
    createdAt: dateStr(-40),
    updatedAt: dateStr(-35),
  },
]

// ─── Архив документов ───────────────────────────────────────────────────────

/**
 * Архив наполняется вручную (пункт 13, «не берём сейчас — 5-C»): генератора
 * документов в системе нет, и рисовать его случайными числами — та же болезнь,
 * от которой лечится реестр. Записи фиксированные и ссылаются на существующие
 * сущности, а не на выдуманные номера.
 */
const MOCK_ARCHIVE: FinanceDocumentArchiveItem[] = [
  {
    id: 'arch-1',
    name: 'Invoice #ORD-2026-100/INV-1',
    type: 'invoice',
    relatedEntityType: 'order',
    relatedEntityId: 'ORD-100',
    relatedEntityNumber: 'ORD-2026-100',
    uploadedBy: 'Maxim V.',
    uploadedAt: dateStr(-2),
    fileId: 'file-arch-1',
    url: '#uploaded/file-arch-1',
    size: 184_000,
    mime: 'application/pdf',
  },
  {
    id: 'arch-2',
    name: 'Waybill #ORD-2026-100/WB-1',
    type: 'waybill',
    relatedEntityType: 'order',
    relatedEntityId: 'ORD-100',
    relatedEntityNumber: 'ORD-2026-100',
    uploadedBy: 'Maxim V.',
    uploadedAt: dateStr(-2),
    fileId: 'file-arch-2',
    url: '#uploaded/file-arch-2',
    size: 96_000,
    mime: 'application/pdf',
  },
  {
    id: 'arch-3',
    name: 'CMR #ORD-2026-100/CMR-1',
    type: 'cmr',
    relatedEntityType: 'order',
    relatedEntityId: 'ORD-100',
    relatedEntityNumber: 'ORD-2026-100',
    uploadedBy: 'Anna K.',
    uploadedAt: dateStr(-2),
    fileId: 'file-arch-3',
    url: '#uploaded/file-arch-3',
    size: 74_000,
    mime: 'application/pdf',
  },
  {
    id: 'arch-4',
    name: 'Invoice #ORD-2026-009/INV-1',
    type: 'invoice',
    relatedEntityType: 'order',
    relatedEntityId: 'ORD-009',
    relatedEntityNumber: 'ORD-2026-009',
    uploadedBy: 'Anna K.',
    uploadedAt: dateStr(-120),
    fileId: 'file-arch-4',
    url: '#uploaded/file-arch-4',
    size: 151_000,
    mime: 'application/pdf',
  },
  {
    id: 'arch-5',
    name: 'Invoice #INV-SUP-2026-014',
    type: 'invoice',
    relatedEntityType: 'payment',
    relatedEntityId: 'pay-out-1',
    relatedEntityNumber: 'PAY-2026-001',
    uploadedBy: 'John D.',
    uploadedAt: dateStr(-24),
    fileId: 'file-arch-5',
    url: '#uploaded/file-arch-5',
    size: 132_000,
    mime: 'application/pdf',
  },
  {
    id: 'arch-6',
    name: 'CMR #CMR-2026-014',
    type: 'cmr',
    relatedEntityType: 'payment',
    relatedEntityId: 'pay-out-1',
    relatedEntityNumber: 'PAY-2026-001',
    uploadedBy: 'John D.',
    uploadedAt: dateStr(-22),
    fileId: 'file-arch-6',
    url: '#uploaded/file-arch-6',
    size: 88_000,
    mime: 'application/pdf',
  },
  {
    id: 'arch-7',
    name: 'Invoice #INV-SUP-2026-021',
    type: 'invoice',
    relatedEntityType: 'supplier',
    relatedEntityId: 'sup-002',
    relatedEntityNumber: 'SSAB AB',
    uploadedBy: 'Laura S.',
    uploadedAt: dateStr(-16),
    fileId: 'file-arch-7',
    url: '#uploaded/file-arch-7',
    size: 119_000,
    mime: 'application/pdf',
  },
  {
    id: 'arch-8',
    name: 'Facture #FAC-2026-004',
    type: 'facture',
    relatedEntityType: 'client',
    relatedEntityId: 'CL-001',
    relatedEntityNumber: 'CL-001',
    uploadedBy: 'Laura S.',
    uploadedAt: dateStr(-45),
    fileId: 'file-arch-8',
    url: '#uploaded/file-arch-8',
    size: 102_000,
    mime: 'application/pdf',
  },
]

// ─── Mock Functions ───

export function mockGetPayments(params: {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}): {
  items: FinancePaymentListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
} {
  let filtered = [...MOCK_PAYMENTS]

  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter(
      (p) =>
        p.paymentNumber.toLowerCase().includes(q) ||
        p.counterpartyName.toLowerCase().includes(q) ||
        (p.supplierInvoiceRef !== null && p.supplierInvoiceRef.toLowerCase().includes(q)),
    )
  }
  if (params.status && params.status !== 'all') {
    filtered = filtered.filter((p) => p.status === params.status)
  }

  const page = paginate(filtered, params.page ?? 1, params.pageSize ?? 25)
  return {
    ...page,
    items: page.items.map((p) => ({
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
    })),
  }
}

/**
 * Копия, а не ссылка на запись хранилища (питфолл #13): карточка удаляет документ
 * из массива до нажатия Save, и на прямой ссылке это удаление доезжало бы до
 * «сервера» само, без сохранения и без возможности передумать.
 */
export function mockGetPayment(id: string): FinancePayment {
  const payment = MOCK_PAYMENTS.find((p) => p.id === id)
  if (!payment) throw new Error('PAYMENT_NOT_FOUND')
  return clone(payment)
}

export function mockGetArchive(params: {
  search?: string
  type?: string
  relatedEntityType?: string
  page?: number
  pageSize?: number
}): {
  items: FinanceDocumentArchiveItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
} {
  let filtered = [...MOCK_ARCHIVE]

  if (params.search) {
    const q = params.search.toLowerCase()
    filtered = filtered.filter(
      (d) => d.name.toLowerCase().includes(q) || d.relatedEntityNumber.toLowerCase().includes(q),
    )
  }
  if (params.type && params.type !== 'all') {
    filtered = filtered.filter((d) => d.type === params.type)
  }
  if (params.relatedEntityType && params.relatedEntityType !== 'all') {
    filtered = filtered.filter((d) => d.relatedEntityType === params.relatedEntityType)
  }

  return paginate(clone(filtered), params.page ?? 1, params.pageSize ?? 25)
}

/**
 * `resolveUpload` — метаданные загруженного файла из реестра аплоадов, который
 * держит `mocks/index.ts` (так же, как для файлов заказа). Без него имя и размер
 * документа пришлось бы выдумывать прямо здесь — то самое правдоподобное число
 * вместо настоящего, от которого лечится весь этот файл.
 */
export function mockPatchPayment(
  id: string,
  data: Partial<FinancePayment>,
  resolveUpload?: (fileId: string) => Omit<PaymentDocument, 'id' | 'fileId'> | undefined,
): FinancePayment {
  const idx = MOCK_PAYMENTS.findIndex((p) => p.id === id)
  if (idx === -1) throw new Error('PAYMENT_NOT_FOUND')
  const current = MOCK_PAYMENTS[idx]!
  const payload = data as Record<string, unknown>

  // Просрочка — переход, а не свойство: платёж, который УЖЕ был просрочен, при
  // правке заметки или документов события не порождает. Оба выхода функции
  // проходят через `commit`, иначе правило пришлось бы записать дважды и одна
  // из копий однажды отстала бы от другой.
  const wasOverdue = current.status === 'overdue'
  const commit = (updated: FinancePayment): FinancePayment => {
    MOCK_PAYMENTS[idx] = updated
    if (!wasOverdue && updated.status === 'overdue') notifyPaymentOverdue(updated)
    return clone(updated)
  }

  // Handle fileIds replace-semantics (common upload pattern: POST /api/uploads + PATCH with fileIds[])
  if (payload.fileIds && Array.isArray(payload.fileIds)) {
    const incomingFileIds = payload.fileIds as string[]
    const existingDocs = current.documents
    // Keep docs whose fileId is still in the incoming array
    const kept = existingDocs.filter((d) => incomingFileIds.includes(d.fileId))
    // Create stub docs for new fileIds
    const existingFileIds = new Set(existingDocs.map((d) => d.fileId))
    const newDocs: PaymentDocument[] = incomingFileIds
      .filter((fid) => !existingFileIds.has(fid))
      .map((fid) => {
        const meta = resolveUpload?.(fid)
        return {
          id: fid,
          fileId: fid,
          name: meta?.name ?? fid,
          url: meta?.url ?? `#uploaded/${fid}`,
          size: meta?.size ?? 0,
          mime: meta?.mime ?? 'application/octet-stream',
          uploadedAt: meta?.uploadedAt ?? new Date().toISOString(),
        }
      })
    const { fileIds: _, ...rest } = payload
    const updated: FinancePayment = {
      ...current,
      ...(rest as Partial<FinancePayment>),
      documents: [...kept, ...newDocs],
      updatedAt: new Date().toISOString(),
    }
    return commit(updated)
  }

  const updated: FinancePayment = { ...current, ...data, updatedAt: new Date().toISOString() }
  return commit(updated)
}
