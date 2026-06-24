import type { BccCategory, BccRecipient, BccRequest } from '@/types/bcc'
import type { TranslatedString } from '@/types/i18n'
import { MOCK_SUPPLIERS } from './suppliers'

export const MOCK_BCC_CATEGORIES: BccCategory[] = [
  {
    id: 'sheets',
    name: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
    productCount: 4,
    children: [
      {
        id: 'sheet-2mm',
        name: { ru: 'Лист 2мм', en: 'Sheet 2mm', lt: 'Lakštas 2mm' },
        productCount: 0,
      },
      {
        id: 'sheet-3mm',
        name: { ru: 'Лист 3мм', en: 'Sheet 3mm', lt: 'Lakštas 3mm' },
        productCount: 0,
      },
      {
        id: 'sheet-5mm',
        name: { ru: 'Лист 5мм', en: 'Sheet 5mm', lt: 'Lakštas 5mm' },
        productCount: 0,
      },
      {
        id: 'sheet-10mm',
        name: { ru: 'Лист 10мм', en: 'Sheet 10mm', lt: 'Lakštas 10mm' },
        productCount: 0,
      },
    ],
  },
  {
    id: 'lintels',
    name: { ru: 'Перемычки', en: 'Lintels', lt: 'Sąramos' },
    productCount: 2,
    children: [
      {
        id: 'lintel-100',
        name: { ru: 'Перемычка 100×100', en: 'Lintel 100×100', lt: 'Sąrama 100×100' },
        productCount: 0,
      },
      {
        id: 'lintel-150',
        name: { ru: 'Перемычка 150×150', en: 'Lintel 150×150', lt: 'Sąrama 150×150' },
        productCount: 0,
      },
    ],
  },
  {
    id: 'beams',
    name: { ru: 'Балки', en: 'Beams', lt: 'Sijos' },
    productCount: 3,
    children: [
      {
        id: 'beam-i20',
        name: { ru: 'Двутавр 20', en: 'I-Beam 20', lt: 'Dvitėjis 20' },
        productCount: 0,
      },
      {
        id: 'beam-i30',
        name: { ru: 'Двутавр 30', en: 'I-Beam 30', lt: 'Dvitėjis 30' },
        productCount: 0,
      },
      {
        id: 'beam-heb',
        name: { ru: 'Балка HEB', en: 'HEB Beam', lt: 'HEB sija' },
        productCount: 0,
      },
    ],
  },
  {
    id: 'pipes',
    name: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' },
    productCount: 3,
    children: [
      {
        id: 'pipe-50',
        name: { ru: 'Труба 50мм', en: 'Pipe 50mm', lt: 'Vamzdis 50mm' },
        productCount: 0,
      },
      {
        id: 'pipe-100',
        name: { ru: 'Труба 100мм', en: 'Pipe 100mm', lt: 'Vamzdis 100mm' },
        productCount: 0,
      },
      {
        id: 'pipe-150',
        name: { ru: 'Труба 150мм', en: 'Pipe 150mm', lt: 'Vamzdis 150mm' },
        productCount: 0,
      },
    ],
  },
  {
    id: 'rebars',
    name: { ru: 'Арматура', en: 'Rebars', lt: 'Armatūra' },
    productCount: 3,
    children: [
      {
        id: 'rebar-12',
        name: { ru: 'Арматура 12мм', en: 'Rebar 12mm', lt: 'Armatūra 12mm' },
        productCount: 0,
      },
      {
        id: 'rebar-16',
        name: { ru: 'Арматура 16мм', en: 'Rebar 16mm', lt: 'Armatūra 16mm' },
        productCount: 0,
      },
      {
        id: 'rebar-20',
        name: { ru: 'Арматура 20мм', en: 'Rebar 20mm', lt: 'Armatūra 20mm' },
        productCount: 0,
      },
    ],
  },
]

// Product id → category name (matches MOCK_SUPPLIERS.categories entries).
// Auto-check logic: a supplier is "matching" if any of their categories covers at least one selected product.
const PRODUCT_CATEGORY: Record<string, string> = {
  'sheet-2mm': 'Sheets',
  'sheet-3mm': 'Sheets',
  'sheet-5mm': 'Sheets',
  'sheet-10mm': 'Sheets',
  'lintel-100': 'Lintels',
  'lintel-150': 'Lintels',
  'beam-i20': 'Beams',
  'beam-i30': 'Beams',
  'beam-heb': 'Beams',
  'pipe-50': 'Pipes',
  'pipe-100': 'Pipes',
  'pipe-150': 'Pipes',
  'rebar-12': 'Rebars',
  'rebar-16': 'Rebars',
  'rebar-20': 'Rebars',
}

export const MOCK_BCC_HISTORY: BccRequest[] = [
  // Request 001 — Sheet 2mm to 3 suppliers (all still pending)
  {
    id: 'evt-001',
    requestId: 'req-001',
    date: '2026-04-05',
    supplierId: 'sup-001',
    supplierName: { ru: 'MetalProm LLC', en: 'MetalProm LLC', lt: 'MetalProm LLC' },
    productId: 'sheet-2mm',
    productName: { ru: 'Лист 2мм', en: 'Sheet 2mm', lt: 'Lakštas 2mm' },
    source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
    status: 'sent',
  },
  {
    id: 'evt-002',
    requestId: 'req-001',
    date: '2026-04-05',
    supplierId: 'sup-002',
    supplierName: { ru: 'SteelWorks Inc', en: 'SteelWorks Inc', lt: 'SteelWorks Inc' },
    productId: 'sheet-2mm',
    productName: { ru: 'Лист 2мм', en: 'Sheet 2mm', lt: 'Lakštas 2mm' },
    source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
    status: 'sent',
  },
  {
    id: 'evt-003',
    requestId: 'req-001',
    date: '2026-04-05',
    supplierId: 'sup-004',
    supplierName: { ru: 'NordMetal Ltd', en: 'NordMetal Ltd', lt: 'NordMetal Ltd' },
    productId: 'sheet-2mm',
    productName: { ru: 'Лист 2мм', en: 'Sheet 2mm', lt: 'Lakštas 2mm' },
    source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
    status: 'sent',
  },
  // Request 002 — I-Beam 20 with mixed responses
  {
    id: 'evt-004',
    requestId: 'req-002',
    date: '2026-04-02',
    supplierId: 'sup-002',
    supplierName: { ru: 'SteelWorks Inc', en: 'SteelWorks Inc', lt: 'SteelWorks Inc' },
    productId: 'beam-i20',
    productName: { ru: 'Двутавр 20', en: 'I-Beam 20', lt: 'Dvitėjis 20' },
    source: { ru: 'Email', en: 'Email', lt: 'El. paštas' },
    status: 'responded',
    price: 85000,
    unit: 'ton',
  },
  {
    id: 'evt-005',
    requestId: 'req-002',
    date: '2026-04-02',
    supplierId: 'sup-004',
    supplierName: { ru: 'NordMetal Ltd', en: 'NordMetal Ltd', lt: 'NordMetal Ltd' },
    productId: 'beam-i20',
    productName: { ru: 'Двутавр 20', en: 'I-Beam 20', lt: 'Dvitėjis 20' },
    source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
    status: 'no_response',
  },
  // Request 003 — Pipes Q1
  {
    id: 'evt-006',
    requestId: 'req-003',
    date: '2026-03-20',
    supplierId: 'sup-001',
    supplierName: { ru: 'MetalProm LLC', en: 'MetalProm LLC', lt: 'MetalProm LLC' },
    productId: 'pipe-100',
    productName: { ru: 'Труба 100мм', en: 'Pipe 100mm', lt: 'Vamzdis 100mm' },
    source: { ru: 'Телефон', en: 'Phone', lt: 'Telefonas' },
    status: 'sent',
  },
  {
    id: 'evt-007',
    requestId: 'req-003',
    date: '2026-03-20',
    supplierId: 'sup-004',
    supplierName: { ru: 'NordMetal Ltd', en: 'NordMetal Ltd', lt: 'NordMetal Ltd' },
    productId: 'pipe-100',
    productName: { ru: 'Труба 100мм', en: 'Pipe 100mm', lt: 'Vamzdis 100mm' },
    source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' },
    status: 'sent',
  },
]

export function mockGetBccCategories(): BccCategory[] {
  return MOCK_BCC_CATEGORIES
}

export function mockGetBccRecipients(productIds: string[]): BccRecipient[] {
  // Always return ALL suppliers (derived from the shared MOCK_SUPPLIERS, so ids/emails
  // align with the suppliers list & card pages). The `selected` flag indicates whether
  // this supplier covers any of the currently-selected products — so matches float to
  // the top without hiding anyone.
  const selectedCategories = new Set<string>()
  productIds.forEach((pid) => {
    const cat = PRODUCT_CATEGORY[pid]
    if (cat) selectedCategories.add(cat)
  })
  return MOCK_SUPPLIERS.map((s) => ({
    id: s.id,
    company: s.company,
    email: s.email,
    contactPerson: s.contactPerson,
    selected: selectedCategories.size > 0 && s.categories.some((c) => selectedCategories.has(c)),
  }))
}

export function mockGetBccHistory(
  page = 1,
  pageSize = 25,
): {
  items: BccRequest[]
  total: number
  page: number
  pageSize: number
  totalPages: number
} {
  const total = MOCK_BCC_HISTORY.length
  const start = (page - 1) * pageSize
  return {
    items: MOCK_BCC_HISTORY.slice(start, start + pageSize),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export function mockSendBccRequest(_payload: {
  productIds: string[]
  recipientIds: string[]
  subject: TranslatedString | string
  body: TranslatedString | string
  fileIds?: string[]
}): { requestId: string } {
  return { requestId: `req-${Date.now()}` }
}

export function mockLogBccRequest(_payload: {
  productIds: string[]
  recipientIds: string[]
  source: TranslatedString | string
}): { requestId: string } {
  return { requestId: `req-${Date.now()}` }
}

export function mockAcceptResponse(
  eventId: string,
  payload: { price: number; unit: string },
): BccRequest | null {
  const src = MOCK_BCC_HISTORY.find((e) => e.id === eventId)
  if (!src) return null
  const next: BccRequest = {
    id: `evt-${Date.now()}`,
    requestId: src.requestId,
    date: new Date().toISOString().slice(0, 10),
    supplierId: src.supplierId,
    supplierName: src.supplierName,
    productId: src.productId,
    productName: src.productName,
    source: src.source,
    status: 'responded',
    price: payload.price,
    unit: payload.unit,
  }
  MOCK_BCC_HISTORY.unshift(next)
  return next
}

export function mockMarkNoResponse(eventId: string): BccRequest | null {
  const src = MOCK_BCC_HISTORY.find((e) => e.id === eventId)
  if (!src) return null
  const next: BccRequest = {
    id: `evt-${Date.now()}`,
    requestId: src.requestId,
    date: new Date().toISOString().slice(0, 10),
    supplierId: src.supplierId,
    supplierName: src.supplierName,
    productId: src.productId,
    productName: src.productName,
    source: src.source,
    status: 'no_response',
  }
  MOCK_BCC_HISTORY.unshift(next)
  return next
}
