import type { BccCategory, BccRecipient, BccRequest, BccEmailTemplate } from '@/types/bcc'
import { MOCK_SUPPLIERS } from './suppliers'

export const MOCK_BCC_CATEGORIES: BccCategory[] = [
  {
    id: 'sheets',
    name: 'Sheets',
    productCount: 4,
    children: [
      { id: 'sheet-2mm', name: 'Sheet 2mm', productCount: 0 },
      { id: 'sheet-3mm', name: 'Sheet 3mm', productCount: 0 },
      { id: 'sheet-5mm', name: 'Sheet 5mm', productCount: 0 },
      { id: 'sheet-10mm', name: 'Sheet 10mm', productCount: 0 },
    ],
  },
  {
    id: 'lintels',
    name: 'Lintels',
    productCount: 2,
    children: [
      { id: 'lintel-100', name: 'Lintel 100×100', productCount: 0 },
      { id: 'lintel-150', name: 'Lintel 150×150', productCount: 0 },
    ],
  },
  {
    id: 'beams',
    name: 'Beams',
    productCount: 3,
    children: [
      { id: 'beam-i20', name: 'I-Beam 20', productCount: 0 },
      { id: 'beam-i30', name: 'I-Beam 30', productCount: 0 },
      { id: 'beam-heb', name: 'HEB Beam', productCount: 0 },
    ],
  },
  {
    id: 'pipes',
    name: 'Pipes',
    productCount: 3,
    children: [
      { id: 'pipe-50', name: 'Pipe 50mm', productCount: 0 },
      { id: 'pipe-100', name: 'Pipe 100mm', productCount: 0 },
      { id: 'pipe-150', name: 'Pipe 150mm', productCount: 0 },
    ],
  },
  {
    id: 'rebars',
    name: 'Rebars',
    productCount: 3,
    children: [
      { id: 'rebar-12', name: 'Rebar 12mm', productCount: 0 },
      { id: 'rebar-16', name: 'Rebar 16mm', productCount: 0 },
      { id: 'rebar-20', name: 'Rebar 20mm', productCount: 0 },
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
    supplierName: 'MetalProm LLC',
    productId: 'sheet-2mm',
    productName: 'Sheet 2mm',
    source: 'BCC Tool',
    status: 'sent',
  },
  {
    id: 'evt-002',
    requestId: 'req-001',
    date: '2026-04-05',
    supplierId: 'sup-002',
    supplierName: 'SteelWorks Inc',
    productId: 'sheet-2mm',
    productName: 'Sheet 2mm',
    source: 'BCC Tool',
    status: 'sent',
  },
  {
    id: 'evt-003',
    requestId: 'req-001',
    date: '2026-04-05',
    supplierId: 'sup-004',
    supplierName: 'NordMetal Ltd',
    productId: 'sheet-2mm',
    productName: 'Sheet 2mm',
    source: 'BCC Tool',
    status: 'sent',
  },
  // Request 002 — I-Beam 20 with mixed responses
  {
    id: 'evt-004',
    requestId: 'req-002',
    date: '2026-04-02',
    supplierId: 'sup-002',
    supplierName: 'SteelWorks Inc',
    productId: 'beam-i20',
    productName: 'I-Beam 20',
    source: 'Email',
    status: 'responded',
    price: 85000,
    unit: 'ton',
  },
  {
    id: 'evt-005',
    requestId: 'req-002',
    date: '2026-04-02',
    supplierId: 'sup-004',
    supplierName: 'NordMetal Ltd',
    productId: 'beam-i20',
    productName: 'I-Beam 20',
    source: 'BCC Tool',
    status: 'no_response',
  },
  // Request 003 — Pipes Q1
  {
    id: 'evt-006',
    requestId: 'req-003',
    date: '2026-03-20',
    supplierId: 'sup-001',
    supplierName: 'MetalProm LLC',
    productId: 'pipe-100',
    productName: 'Pipe 100mm',
    source: 'Phone',
    status: 'sent',
  },
  {
    id: 'evt-007',
    requestId: 'req-003',
    date: '2026-03-20',
    supplierId: 'sup-004',
    supplierName: 'NordMetal Ltd',
    productId: 'pipe-100',
    productName: 'Pipe 100mm',
    source: 'BCC Tool',
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
  template: BccEmailTemplate
}): { requestId: string } {
  return { requestId: `req-${Date.now()}` }
}

export function mockLogBccRequest(_payload: {
  productIds: string[]
  recipientIds: string[]
  source: string
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
