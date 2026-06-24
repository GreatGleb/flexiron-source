import { mergeTranslatedString } from '@/types/i18n'
import type { Supplier, SupplierCardData, SupplierFilters } from '@/types/supplier'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: '1',
    company: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' },
    contactPerson: { ru: 'Андрес Тамм', en: 'Andres Tamm', lt: 'Andres Tamm' },
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
    currency: 'EUR',
    createdAt: '2020-03-15',
    updatedAt: '2026-04-01',
  },
  {
    id: '2',
    company: { ru: 'Metal Trade LT', en: 'Metal Trade LT', lt: 'Metal Trade LT' },
    contactPerson: { ru: 'Йонас Казлаускас', en: 'Jonas Kazlauskas', lt: 'Jonas Kazlauskas' },
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
    currency: 'EUR',
    createdAt: '2019-07-20',
    updatedAt: '2026-03-28',
  },
  {
    id: '3',
    company: { ru: 'Nordic Steel AB', en: 'Nordic Steel AB', lt: 'Nordic Steel AB' },
    contactPerson: { ru: 'Эрик Йоханссон', en: 'Erik Johansson', lt: 'Erik Johansson' },
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
    currency: 'EUR',
    createdAt: '2021-01-10',
    updatedAt: '2026-02-14',
  },
  {
    id: '4',
    company: { ru: 'Baltic Metal Group', en: 'Baltic Metal Group', lt: 'Baltic Metal Group' },
    contactPerson: { ru: 'Янис Берзиньш', en: 'Jānis Bērziņš', lt: 'Jānis Bērziņš' },
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
    currency: 'EUR',
    createdAt: '2026-01-05',
    updatedAt: '2026-04-05',
  },
  {
    id: '5',
    company: { ru: 'Euro Metal GmbH', en: 'Euro Metal GmbH', lt: 'Euro Metal GmbH' },
    contactPerson: { ru: 'Клаус Мюллер', en: 'Klaus Müller', lt: 'Klaus Müller' },
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
    currency: 'EUR',
    createdAt: '2018-11-22',
    updatedAt: '2026-04-10',
  },
  {
    id: '6',
    company: { ru: 'IronBridge Corp', en: 'IronBridge Corp', lt: 'IronBridge Corp' },
    contactPerson: { ru: 'Майкл Уилсон', en: 'Michael Wilson', lt: 'Michael Wilson' },
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
    currency: 'EUR',
    createdAt: '2020-08-14',
    updatedAt: '2026-03-15',
  },
]

const supplier1 = MOCK_SUPPLIERS.find((s) => s.id === '1')!

const MOCK_CARD: Record<string, SupplierCardData> = {
  '1': {
    ...supplier1,
    statusReason: {
      ru: 'Аудит пройден. Надёжность повышена до 5 звёзд.',
      en: 'Audit passed. Reliability rating upgraded to 5 stars.',
      lt: 'Auditas išlaikytas. Patikimumas padidintas iki 5 žvaigždučių.',
    },
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
        name: { ru: 'Андрес Тамм', en: 'Andres Tamm', lt: 'Andres Tamm' },
        role: { ru: 'Менеджер по продажам', en: 'Sales Manager', lt: 'Pardavimų vadybininkas' },
        email: 'info@steelplus.ee',
        phone: '+372 51234567',
      },
      {
        name: { ru: 'Мари Каск', en: 'Mari Kask', lt: 'Mari Kask' },
        role: { ru: 'Логистика', en: 'Logistics', lt: 'Logistika' },
        email: 'logistics@steelplus.ee',
        phone: '+372 51234568',
      },
    ],
    files: [
      {
        id: 'f1',
        name: { ru: 'Контракт 2024 Q1', en: 'Contract_2024_Q1.pdf', lt: 'Sutartis 2024 Q1' },
        size: 245000,
        type: 'application/pdf',
        uploadedAt: '2024-02-15',
      },
      {
        id: 'f2',
        name: { ru: 'Сертификат НДС', en: 'VAT_Certificate.png', lt: 'PVM sertifikatas' },
        size: 120000,
        type: 'image/png',
        uploadedAt: '2024-02-20',
      },
    ],
    history: [
      {
        date: '2026-04-01',
        action: { ru: 'Отправлен BCC', en: 'BCC Sent', lt: 'BCC išsiųstas' },
        user: { ru: 'Администратор', en: 'Admin', lt: 'Administratorius' },
        details: {
          ru: 'Запрос цен на листы',
          en: 'Price request for Sheets',
          lt: 'Kainų užklausa lakštams',
        },
      },
      {
        date: '2026-03-15',
        action: { ru: 'Рейтинг обновлён', en: 'Rating Updated', lt: 'Įvertinimas atnaujintas' },
        user: { ru: 'Администратор', en: 'Admin', lt: 'Administratorius' },
        details: { ru: 'Рейтинг: 4 → 5', en: 'Rating: 4 → 5', lt: 'Įvertinimas: 4 → 5' },
      },
    ],
    priceHistory: [
      {
        date: '04.04',
        product: { ru: 'Лист 10мм', en: 'Sheet 10mm', lt: 'Lakštas 10mm' },
        stock: '22.0 t',
        price: 1.05,
        unit: { ru: 'кг', en: 'kg', lt: 'kg' },
        source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC Įrankis' },
        status: 'replied',
      },
      {
        date: '02.04',
        product: { ru: 'Листы 20т', en: 'Sheets 20t', lt: 'Lakštai 20t' },
        stock: '—',
        price: null,
        unit: null,
        source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC Įrankis' },
        status: 'pending',
      },
      {
        date: '28.03',
        product: { ru: 'Труба 100x100', en: 'Pipe 100x100', lt: 'Vamzdis 100x100' },
        stock: '8.5 t',
        price: 1.34,
        unit: { ru: 'кг', en: 'kg', lt: 'kg' },
        source: { ru: 'Эл. почта', en: 'Email', lt: 'El. paštas' },
        status: 'replied',
      },
      {
        date: '25.03',
        product: { ru: 'Строительный 5т', en: 'Structural 5t', lt: 'Konstrukcinis 5t' },
        stock: '—',
        price: null,
        unit: null,
        source: { ru: 'Эл. почта', en: 'Email', lt: 'El. paštas' },
        status: 'pending',
      },
    ],
    auditLog: [
      {
        timestamp: '2026-04-05 01:10',
        user: { ru: 'Максим В.', en: 'Maxim V.', lt: 'Maxim V.' },
        userInitials: 'MV',
        property: { ru: 'Условия оплаты', en: 'Payment Terms', lt: 'Mokėjimo sąlygos' },
        oldValue: 'Prepayment',
        newValue: '30 Days Net',
      },
      {
        timestamp: '2026-04-01 10:25',
        user: { ru: 'Алекс З.', en: 'Alex Z.', lt: 'Alex Z.' },
        userInitials: 'AZ',
        property: { ru: 'Мин. заказ', en: 'Min. Order', lt: 'Min. užsakymas' },
        oldValue: '1000 EUR',
        newValue: '2500 EUR',
      },
    ],
  },
}

function applyFilters(list: Supplier[], filters: SupplierFilters): Supplier[] {
  return list.filter((s) => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const matchesSearch =
        s.company.ru?.toLowerCase().includes(q) ||
        s.company.en?.toLowerCase().includes(q) ||
        s.company.lt?.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      if (!matchesSearch) return false
    }
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
  if (MOCK_CARD[id]) return JSON.parse(JSON.stringify(MOCK_CARD[id])) as SupplierCardData
  const base = MOCK_SUPPLIERS.find((s) => s.id === id)
  if (!base) throw new Error(`Supplier ${id} not found`)
  const card: SupplierCardData = {
    ...base,
    statusReason: { ru: '', en: '', lt: '' },
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
    contacts: [
      {
        name: base.contactPerson,
        role: { ru: 'Контакт', en: 'Contact', lt: 'Kontaktas' },
        email: base.email,
        phone: base.phone,
      },
    ],
    files: [],
    history: [
      {
        date: base.updatedAt,
        action: { ru: 'Профиль обновлён', en: 'Profile Updated', lt: 'Profilis atnaujintas' },
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        details: {
          ru: 'Контактная информация обновлена',
          en: 'Contact info refreshed',
          lt: 'Kontaktinė informacija atnaujinta',
        },
      },
      {
        date: base.createdAt,
        action: { ru: 'Поставщик создан', en: 'Supplier Created', lt: 'Tiekėjas sukurtas' },
        user: { ru: 'Администратор', en: 'Admin', lt: 'Administratorius' },
        details: {
          ru: `Статус: ${base.status}`,
          en: `Status: ${base.status}`,
          lt: `Būsena: ${base.status}`,
        },
      },
    ],
    priceHistory: [
      {
        date: base.updatedAt.slice(5, 10).replace('-', '.'),
        product: {
          ru: base.categories[0] ?? 'Общее',
          en: base.categories[0] ?? 'General',
          lt: base.categories[0] ?? 'Bendras',
        },
        stock: '10 t',
        price: 1.2,
        unit: { ru: 'кг', en: 'kg', lt: 'kg' },
        source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC Įrankis' },
        status: 'replied',
      },
      {
        date: (base.lastBccDate ?? base.updatedAt).slice(5, 10).replace('-', '.'),
        product: {
          ru: base.categories.join(' + ') || 'Запрос цен',
          en: base.categories.join(' + ') || 'Price request',
          lt: base.categories.join(' + ') || 'Kainų užklausa',
        },
        stock: '—',
        price: null,
        unit: null,
        source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC Įrankis' },
        status: 'sent',
      },
    ],
    auditLog: [
      {
        timestamp: base.updatedAt + ' 10:00',
        user: { ru: 'Система', en: 'System', lt: 'Sistema' },
        userInitials: 'SY',
        property: { ru: 'Рейтинг', en: 'Rating', lt: 'Įvertinimas' },
        oldValue: '—',
        newValue: String(base.rating),
      },
      {
        timestamp: base.createdAt + ' 09:00',
        user: { ru: base.contactPerson.ru, en: base.contactPerson.en, lt: base.contactPerson.lt },
        userInitials: buildInitials(base.contactPerson.ru),
        property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
        oldValue: '—',
        newValue: base.status,
      },
    ],
  }
  // Cache the card so subsequent mutations (e.g. audit delete) find it
  MOCK_CARD[id] = card
  return JSON.parse(JSON.stringify(card)) as SupplierCardData
}

export function mockPatchSupplier(id: string, patch: Partial<SupplierCardData>): SupplierCardData {
  const base = mockGetSupplier(id)
  // Merge TranslatedString fields to preserve existing locales
  const merged = {
    ...base,
    ...patch,
    company: patch.company ? mergeTranslatedString(base.company, patch.company) : base.company,
    contactPerson: patch.contactPerson
      ? mergeTranslatedString(base.contactPerson, patch.contactPerson)
      : base.contactPerson,
    statusReason: patch.statusReason
      ? mergeTranslatedString(base.statusReason, patch.statusReason)
      : base.statusReason,
  }
  // Persist full merged card back to MOCK_CARD
  MOCK_CARD[id] = merged

  // Update the list entry with all shared fields so the suppliers list reflects changes
  const listItem = MOCK_SUPPLIERS.find((s) => s.id === id)
  if (listItem) {
    listItem.company = merged.company
    listItem.contactPerson = merged.contactPerson
    listItem.email = merged.email
    listItem.phone = merged.phone
    listItem.status = merged.status
    listItem.categories = merged.categories
    listItem.rating = merged.rating
    listItem.country = merged.country
    listItem.city = merged.city
    listItem.tags = merged.tags
    listItem.notes = merged.notes
    listItem.leadTime = merged.leadTime
    listItem.lastBccDate = merged.lastBccDate
    listItem.hasDeficit = merged.hasDeficit
    listItem.createdAt = merged.createdAt
    listItem.updatedAt = merged.updatedAt
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
    company: payload.company ?? { ru: '', en: '', lt: '' },
    contactPerson: payload.contactPerson ?? { ru: '', en: '', lt: '' },
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
    currency: payload.currency ?? 'EUR',
    createdAt: today,
    updatedAt: today,
  }
  MOCK_SUPPLIERS.push(s)

  const card: SupplierCardData = {
    ...s,
    statusReason: payload.statusReason ?? { ru: '', en: '', lt: '' },
    contractDate: payload.contractDate ?? '',
    vatCode: payload.vatCode ?? '',
    currency: payload.currency ?? 'EUR',
    paymentTerms: payload.paymentTerms ?? '30 Days Net',
    minOrder: payload.minOrder ?? null,
    bccEmails: payload.bccEmails ?? [],
    addresses: payload.addresses ?? [{ type: 'Legal', line1: '', city: '', country: '', zip: '' }],
    contacts: payload.contacts ?? [],
    files: payload.files ?? [],
    history: [
      {
        date: today,
        action: { ru: '', en: '', lt: '' },
        user: { ru: '', en: '', lt: '' },
        details: { ru: '', en: '', lt: '' },
      },
    ],
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
      s.company.ru,
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
