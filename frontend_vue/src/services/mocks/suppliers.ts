import type { Supplier, SupplierCardData, SupplierFilters } from '@/types/supplier'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: '1',
    company: 'Steel Plus OÜ',
    contactPerson: 'Andres Tamm',
    email: 'info@steelplus.ee',
    phone: '+372 51234567',
    status: 'active',
    categories: ['Sheets', 'Pipes'],
    rating: 5,
    country: 'Estonia',
    city: 'Tallinn',
    tags: ['certified', 'fast'],
    notes: 'Reliable partner since 2020',
    leadTime: 7,
    lastBccDate: '2026-01-15',
    hasDeficit: false,
    createdAt: '2020-03-15',
    updatedAt: '2026-04-01',
  },
  {
    id: '2',
    company: 'Metal Trade LT',
    contactPerson: 'Jonas Kazlauskas',
    email: 'sales@metaltrade.lt',
    phone: '+370 61234567',
    status: 'preferred',
    categories: ['Beams', 'Rebars'],
    rating: 4,
    country: 'Lithuania',
    city: 'Vilnius',
    tags: ['preferred', 'bulk'],
    notes: 'Good for large volume orders',
    leadTime: 5,
    lastBccDate: '2026-01-10',
    hasDeficit: true,
    createdAt: '2019-07-20',
    updatedAt: '2026-03-28',
  },
  {
    id: '3',
    company: 'Nordic Steel AB',
    contactPerson: 'Erik Johansson',
    email: 'order@nordicsteel.se',
    phone: '+46 81234567',
    status: 'active',
    categories: ['Sheets'],
    rating: 4,
    country: 'Sweden',
    city: 'Stockholm',
    tags: [],
    notes: '',
    leadTime: 10,
    lastBccDate: '2026-01-05',
    hasDeficit: false,
    createdAt: '2021-01-10',
    updatedAt: '2026-02-14',
  },
  {
    id: '4',
    company: 'Baltic Metal Group',
    contactPerson: 'Jānis Bērziņš',
    email: 'contact@balticmetal.lv',
    phone: '+371 21234567',
    status: 'new',
    categories: ['Pipes', 'Lintels'],
    rating: 3,
    country: 'Latvia',
    city: 'Riga',
    tags: ['new'],
    notes: 'New supplier, under evaluation',
    leadTime: 14,
    lastBccDate: null,
    hasDeficit: false,
    createdAt: '2026-01-05',
    updatedAt: '2026-04-05',
  },
  {
    id: '5',
    company: 'Euro Metal GmbH',
    contactPerson: 'Klaus Müller',
    email: 'info@eurometal.de',
    phone: '+49 301234567',
    status: 'under_review',
    categories: ['Beams'],
    rating: 2,
    country: 'Germany',
    city: 'Berlin',
    tags: ['review'],
    notes: 'Delivery delays in Q1 2026',
    leadTime: 21,
    lastBccDate: '2025-12-20',
    hasDeficit: false,
    createdAt: '2018-11-22',
    updatedAt: '2026-04-10',
  },
  {
    id: '6',
    company: 'IronBridge Corp',
    contactPerson: 'Michael Wilson',
    email: 'tender@ironbridge.net',
    phone: '+44 201234567',
    status: 'active',
    categories: ['Lintels', 'Rebars'],
    rating: 4,
    country: 'UK',
    city: 'London',
    tags: ['certified'],
    notes: '',
    leadTime: 9,
    lastBccDate: '2026-02-18',
    hasDeficit: false,
    createdAt: '2020-08-14',
    updatedAt: '2026-03-15',
  },
]

const supplier1 = MOCK_SUPPLIERS.find((s) => s.id === '1')!

const MOCK_CARD: Record<string, SupplierCardData> = {
  '1': {
    ...supplier1,
    statusReason: 'Audit passed. Reliability rating upgraded to 5 stars.',
    contractDate: '2024-02-15',
    vatCode: 'LT100001234567',
    currency: 'EUR',
    paymentTerms: '30 Days Net',
    minOrder: 2500,
    bccEmails: ['sales@steelplus.ee', 'tender@steelplus.ee'],
    addresses: [
      { type: 'Legal', line1: 'Pärnu mnt 10', city: 'Tallinn', country: 'Estonia', zip: '10148' },
    ],
    contacts: [
      {
        name: 'Andres Tamm',
        role: 'Sales Manager',
        email: 'info@steelplus.ee',
        phone: '+372 51234567',
      },
      {
        name: 'Mari Kask',
        role: 'Logistics',
        email: 'logistics@steelplus.ee',
        phone: '+372 51234568',
      },
    ],
    files: [
      {
        id: 'f1',
        name: 'Contract_2024_Q1.pdf',
        size: 245000,
        type: 'application/pdf',
        uploadedAt: '2024-02-15',
      },
      {
        id: 'f2',
        name: 'VAT_Certificate.png',
        size: 120000,
        type: 'image/png',
        uploadedAt: '2024-02-20',
      },
    ],
    history: [
      {
        date: '2026-04-01',
        action: 'BCC Sent',
        user: 'Admin',
        details: 'Price request for Sheets',
      },
      { date: '2026-03-15', action: 'Rating Updated', user: 'Admin', details: 'Rating: 4 → 5' },
    ],
    priceHistory: [
      {
        date: '04.04',
        product: 'Sheet 10mm',
        stock: '22.0 t',
        price: 1.05,
        unit: 'kg',
        source: 'BCC Tool',
        status: 'replied',
      },
      {
        date: '02.04',
        product: 'Sheets 20t',
        stock: '—',
        price: null,
        unit: null,
        source: 'BCC Tool',
        status: 'pending',
      },
      {
        date: '28.03',
        product: 'Pipe 100x100',
        stock: '8.5 t',
        price: 1.34,
        unit: 'kg',
        source: 'Email',
        status: 'replied',
      },
      {
        date: '25.03',
        product: 'Structural 5t',
        stock: '—',
        price: null,
        unit: null,
        source: 'Email',
        status: 'pending',
      },
    ],
    auditLog: [
      {
        timestamp: '2026-04-05 01:10',
        user: 'Maxim V.',
        userInitials: 'MV',
        property: 'Payment Terms',
        oldValue: 'Prepayment',
        newValue: '30 Days Net',
      },
      {
        timestamp: '2026-04-01 10:25',
        user: 'Alex Z.',
        userInitials: 'AZ',
        property: 'Min. Order',
        oldValue: '1000 EUR',
        newValue: '2500 EUR',
      },
    ],
  },
}

function applyFilters(list: Supplier[], filters: SupplierFilters): Supplier[] {
  return list.filter((s) => {
    if (filters.search && !s.company.toLowerCase().includes(filters.search.toLowerCase()))
      return false
    if (filters.status !== 'all' && s.status !== filters.status) return false
    if (filters.rating > 0 && s.rating !== filters.rating) return false
    if (filters.categories.length > 0) {
      const has = filters.categories.some((c) => s.categories.includes(c))
      if (!has) return false
    }
    return true
  })
}

export function mockGetSuppliers(
  filters: SupplierFilters,
  pagination: PaginationParams,
): PaginatedResponse<Supplier> {
  const filtered = applyFilters(MOCK_SUPPLIERS, filters)
  const start = (pagination.page - 1) * pagination.pageSize
  const items = filtered.slice(start, start + pagination.pageSize)
  return {
    items,
    total: filtered.length,
    page: pagination.page,
    pageSize: pagination.pageSize,
    totalPages: Math.ceil(filtered.length / pagination.pageSize),
  }
}

function buildInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function mockGetSupplier(id: string): SupplierCardData {
  if (MOCK_CARD[id]) return MOCK_CARD[id]
  const base = MOCK_SUPPLIERS.find((s) => s.id === id)
  if (!base) throw new Error(`Supplier ${id} not found`)
  return {
    ...base,
    statusReason: '',
    contractDate: base.createdAt,
    vatCode: '',
    currency: 'EUR',
    paymentTerms: '30 Days Net',
    minOrder: null,
    bccEmails: [base.email],
    addresses: [
      {
        type: 'Legal',
        line1: `${base.city}, ${base.country}`,
        city: base.city,
        country: base.country,
        zip: '',
      },
    ],
    contacts: [{ name: base.contactPerson, role: 'Contact', email: base.email, phone: base.phone }],
    files: [],
    history: [
      {
        date: base.updatedAt,
        action: 'Profile Updated',
        user: 'System',
        details: 'Contact info refreshed',
      },
      {
        date: base.createdAt,
        action: 'Supplier Created',
        user: 'Admin',
        details: `Status: ${base.status}`,
      },
    ],
    priceHistory: [
      {
        date: base.updatedAt.slice(5, 10).replace('-', '.'),
        product: base.categories[0] ?? 'General',
        stock: '10 t',
        price: 1.2,
        unit: 'kg',
        source: 'BCC Tool',
        status: 'replied',
      },
      {
        date: (base.lastBccDate ?? base.updatedAt).slice(5, 10).replace('-', '.'),
        product: base.categories.join(' + ') || 'Price request',
        stock: '—',
        price: null,
        unit: null,
        source: 'BCC Tool',
        status: 'sent',
      },
    ],
    auditLog: [
      {
        timestamp: base.updatedAt + ' 10:00',
        user: 'System',
        userInitials: 'SY',
        property: 'Rating',
        oldValue: '—',
        newValue: String(base.rating),
      },
      {
        timestamp: base.createdAt + ' 09:00',
        user: base.contactPerson,
        userInitials: buildInitials(base.contactPerson),
        property: 'Status',
        oldValue: '—',
        newValue: base.status,
      },
    ],
  }
}

export function mockPatchSupplier(id: string, patch: Partial<SupplierCardData>): SupplierCardData {
  const base = mockGetSupplier(id)
  // Merge — only provided keys override. Propagate status changes back to the list mock too.
  const merged = { ...base, ...patch }
  if (patch.status && patch.status !== base.status) {
    const listItem = MOCK_SUPPLIERS.find((s) => s.id === id)
    if (listItem) listItem.status = patch.status as Supplier['status']
  }
  return merged
}

export function mockUpdateSupplierStatus(id: string, status: string): void {
  const s = MOCK_SUPPLIERS.find((sup) => sup.id === id)
  if (s) s.status = status as Supplier['status']
}

export function mockDeleteAuditEntry(supplierId: string, entryIndex: number): void {
  const card = MOCK_CARD[supplierId]
  if (!card) return
  if (entryIndex >= 0 && entryIndex < card.auditLog.length) {
    card.auditLog.splice(entryIndex, 1)
  }
}

export function mockCreateSupplier(payload: Partial<SupplierCardData>): SupplierCardData {
  const newId = String(Math.max(...MOCK_SUPPLIERS.map((s) => Number(s.id))) + 1)
  const today = new Date().toISOString().slice(0, 10)
  const s: Supplier = {
    id: newId,
    company: payload.company ?? 'New Supplier',
    contactPerson: payload.contactPerson ?? '',
    email: payload.email ?? '',
    phone: payload.phone ?? '',
    status: payload.status ?? 'new',
    categories: payload.categories ?? [],
    rating: payload.rating ?? 0,
    country: payload.country ?? '',
    city: payload.city ?? '',
    tags: payload.tags ?? [],
    notes: payload.notes ?? '',
    leadTime: payload.leadTime ?? 0,
    lastBccDate: null,
    hasDeficit: false,
    createdAt: today,
    updatedAt: today,
  }
  MOCK_SUPPLIERS.push(s)

  const card: SupplierCardData = {
    ...s,
    statusReason: payload.statusReason ?? '',
    contractDate: payload.contractDate ?? '',
    vatCode: payload.vatCode ?? '',
    currency: payload.currency ?? 'EUR',
    paymentTerms: payload.paymentTerms ?? '30 Days Net',
    minOrder: payload.minOrder ?? null,
    bccEmails: payload.bccEmails ?? [],
    addresses: payload.addresses ?? [{ type: 'Legal', line1: '', city: '', country: '', zip: '' }],
    contacts: payload.contacts ?? [],
    files: payload.files ?? [],
    history: [{ date: today, action: 'Supplier created', user: 'Admin', details: '' }],
    priceHistory: [],
    auditLog: [],
  }
  MOCK_CARD[newId] = card
  // JSON roundtrip — not structuredClone — because the composable hands us a Vue
  // reactive Proxy (`supplier.value`) whose nested arrays are Proxies too, and
  // structuredClone rejects Proxy objects with a DataCloneError.
  return JSON.parse(JSON.stringify(card)) as SupplierCardData
}

export function mockExportSuppliersCsv(filters: SupplierFilters): string {
  const filtered = applyFilters(MOCK_SUPPLIERS, filters)
  const header = 'id,company,email,phone,status,rating,leadTime,categories'
  const rows = filtered.map((s) =>
    [
      s.id,
      s.company,
      s.email,
      s.phone,
      s.status,
      s.rating,
      s.leadTime,
      s.categories.join(';'),
    ].join(','),
  )
  return [header, ...rows].join('\n')
}
