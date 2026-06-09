import type { Order, OrderListItem, OrderItem, OrderService, OrderFile, OrderStatus, OrderDocumentType } from '@/types/order'
import type { StockAuditEntry } from '@/types/warehouse'
import type { PaginatedResponse, PaginationParams } from '@/types/api'
import { mockGetClients } from './clients'
import { STORE as PRODUCTS_STORE } from './products'
import { mockServices as MOCK_SERVICES_DATA } from '@/mocks/services'

interface StoreOrder extends Order {
  _nextLineSeq: number
  _nextServiceSeq: number
}

// ── Product catalog for generating realistic line items ────────────────────
interface ProductSpec {
  id: string
  name: string
  unit: string
  price: number
}

/**
 * Mulberry32 — a simple seeded PRNG that produces deterministic output
 * for the same seed value.
 */
function mulberry32(seed: number): () => number {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const PRODUCTS: ProductSpec[] = [
  { id: 'prod-001',  name: 'Steel Sheet 3mm',            unit: 'pcs', price: 120.50 },
  { id: 'prod-002',  name: 'Steel Pipe 50mm',            unit: 'm',   price: 45.00 },
  { id: 'prod-003',  name: 'Aluminum Profile 2m',        unit: 'pcs', price: 85.00 },
  { id: 'prod-004',  name: 'Stainless Coil 304',          unit: 'coil', price: 4500.00 },
  { id: 'prod-005',  name: 'Beam HEA 200',                unit: 'pcs', price: 320.00 },
  { id: 'prod-006',  name: 'Galvanized Sheet 2mm',       unit: 'pcs', price: 75.00 },
  { id: 'prod-007',  name: 'Rebar 12mm A500C',           unit: 'kg',  price: 0.85 },
  { id: 'prod-008',  name: 'Angle Bar 50x50mm',          unit: 'm',   price: 8.50 },
  { id: 'prod-009',  name: 'Flat Bar 30x5mm',            unit: 'm',   price: 4.20 },
  { id: 'prod-010', name: 'Square Tube 40x40x2mm',       unit: 'm',   price: 6.75 },
  { id: 'prod-011', name: 'Steel Sheet 5mm S355',       unit: 'pcs', price: 210.00 },
  { id: 'prod-012', name: 'Steel Sheet 8mm S355',       unit: 'pcs', price: 340.00 },
  { id: 'prod-013', name: 'Steel Sheet 10mm S235',      unit: 'pcs', price: 410.00 },
  { id: 'prod-014', name: 'Steel Sheet 12mm S355',      unit: 'pcs', price: 540.00 },
  { id: 'prod-015', name: 'Steel Sheet 16mm S355',      unit: 'pcs', price: 720.00 },
  { id: 'prod-016', name: 'Stainless Sheet AISI 304 2mm', unit: 'pcs', price: 380.00 },
  { id: 'prod-017', name: 'Aluminium Sheet AMg2 2mm',   unit: 'pcs', price: 195.00 },
  { id: 'prod-018', name: 'Aluminium Sheet D16 4mm',    unit: 'pcs', price: 280.00 },
  { id: 'prod-019', name: 'Steel Pipe 100x5',            unit: 'm',   price: 78.00 },
  { id: 'prod-020', name: 'Steel Pipe 25x3',             unit: 'm',   price: 18.50 },
  { id: 'prod-021', name: 'Steel Pipe 60x4',             unit: 'm',   price: 42.00 },
  { id: 'prod-022', name: 'Welding Wire 1.2mm',          unit: 'kg',  price: 3.50 },
  { id: 'prod-023', name: 'Beam IPE 300',                unit: 'pcs', price: 580.00 },
  { id: 'prod-024', name: 'Beam HEB 200',                unit: 'pcs', price: 460.00 },
  { id: 'prod-025', name: 'Channel UPN 200',             unit: 'pcs', price: 310.00 },
  { id: 'prod-026', name: 'Galvanized Sheet 1.5mm',      unit: 'pcs', price: 58.00 },
  { id: 'prod-027', name: 'Wire Rod 8mm',                unit: 'kg',  price: 0.72 },
  { id: 'prod-028', name: 'Mesh Reinforcement 100x100x6', unit: 'pcs', price: 95.00 },
  { id: 'prod-029', name: 'Round Bar 20mm',              unit: 'm',   price: 12.00 },
  { id: 'prod-030', name: 'Square Bar 15mm',             unit: 'm',   price: 9.80 },
]

const SERVICES_LIST = [
  { id: 'svc-001', name: 'Metal cutting',     cost: 5,   price: 12 },
  { id: 'svc-002', name: 'Delivery',          cost: 10,  price: 25 },
  { id: 'svc-003', name: 'Packaging',          cost: 2,   price: 5 },
  { id: 'svc-004', name: 'Metal bending',     cost: 8,   price: 18 },
  { id: 'svc-005', name: 'Welding',           cost: 15,  price: 35 },
]

// ── Generate 100 realistic orders (deterministic — same seed = same data) ────
const TOTAL_ORDERS = 100

function generateOrders(): StoreOrder[] {
  const clients = mockGetClients()
  const orders: StoreOrder[] = []
  const allStatuses: OrderStatus[] = ['new', 'confirmed', 'picking', 'packing', 'shipped', 'delivered', 'paid', 'cancelled']
  const statusWeights = [0.08, 0.10, 0.10, 0.08, 0.20, 0.28, 0.08, 0.08]

  for (let i = 0; i < TOTAL_ORDERS; i++) {
    const seq = String(i + 1).padStart(3, '0')
    const client = clients[i % clients.length]!
    const docType: OrderDocumentType = i % 2 === 0 ? 'local' : 'export'

    // Seeded PRNG — every order index always produces the same "random" values
    const rng = mulberry32(i * 9973 + 1)

    // Weighted random status
    const totalW = statusWeights.reduce((s, w) => s + w, 0)
    let r = rng() * totalW
    let statusIdx = 0
    for (let si = 0; si < statusWeights.length; si++) {
      r -= statusWeights[si]!
      if (r <= 0) { statusIdx = si; break }
    }
    const status = allStatuses[statusIdx]!

    // 1–4 line items
    const itemCount = 1 + Math.floor(rng() * 4)
    const usedIds = new Set<string>()
    const items: OrderItem[] = []
    for (let j = 0; j < itemCount; j++) {
      let prod = PRODUCTS[Math.floor(rng() * PRODUCTS.length)]!
      let attempts = 0
      while (usedIds.has(prod.id) && attempts < 30) {
        prod = PRODUCTS[Math.floor(rng() * PRODUCTS.length)]!
        attempts++
      }
      usedIds.add(prod.id)

      const fullProd = PRODUCTS_STORE.find((p) => p.id === prod.id)
      const initLang = typeof localStorage !== 'undefined' ? localStorage.getItem('flexiron_lang') || 'en' : 'en'
      const qty = prod.unit === 'kg' || prod.unit === 'm'
        ? Math.round((10 + rng() * 490) * 10) / 10
        : 1 + Math.floor(rng() * 50)
      const discount = rng() < 0.15 ? Math.round(rng() * 15) : 0
      const costRatio = 0.6 + rng() * 0.25  // 60–85% of selling price
      const unitCost = Math.round(prod.price * costRatio * 100) / 100
      const totalPrice = Math.round(qty * prod.price * (1 - discount / 100) * 100) / 100

      items.push({
        id: `oi-${i * 20 + j}`,
        lineNumber: j + 1,
        productId: prod.id,
        productName: fullProd?.name?.[initLang as keyof typeof fullProd.name] ?? fullProd?.name?.en ?? prod.name,
        quantity: qty,
        unit: prod.unit,
        unitPrice: prod.price,
        unitCost,
        discount,
        totalPrice,
        batchId: null,
        offcutId: null,
      })
    }

    // 0–1 services (30% chance)
    const services: OrderService[] = []
    if (rng() < 0.3) {
      const svc = SERVICES_LIST[Math.floor(rng() * SERVICES_LIST.length)]!
      const fullSvc = MOCK_SERVICES_DATA.find((s) => s.id === svc.id)
      const initLang = typeof localStorage !== 'undefined' ? localStorage.getItem('flexiron_lang') || 'en' : 'en'
      const serviceName = fullSvc?.name?.[initLang as keyof typeof fullSvc.name] ?? fullSvc?.name?.en ?? svc.name
      services.push({
        id: `os-${i * 10}`,
        serviceId: svc.id,
        serviceName,
        cost: svc.cost,
        price: svc.price,
        margin: svc.price - svc.cost,
        quantity: 1,
      })
    }

    const subTotal = items.reduce((s, it) => s + it.totalPrice, 0) +
      services.reduce((s, sv) => s + sv.price * sv.quantity, 0)
    const totalAmount = Math.round(subTotal * 100) / 100
    const totalVat = Math.round(totalAmount * 0.21 * 100) / 100
    const totalWeight = Math.round(items.reduce((s, it) => s + (typeof it.quantity === 'number' ? it.quantity : parseFloat(it.quantity)) * 0.4, 0) * 100) / 100

    // Spread dates from Jan 2026 to June 2026
    const dayOffset = Math.floor((i / TOTAL_ORDERS) * 180)
    const orderDate = new Date(2026, 0, 1 + dayOffset, 8 + Math.floor(rng() * 10), Math.floor(rng() * 60))
    const createdAt = orderDate.toISOString()

    const updatedOffset = status === 'delivered' || status === 'shipped'
      ? dayOffset + 1 + Math.floor(rng() * 5)
      : dayOffset
    const updatedDate = new Date(2026, 0, 1 + Math.min(updatedOffset, 180), 8 + Math.floor(rng() * 10), Math.floor(rng() * 60))
    const updatedAt = updatedDate.toISOString()

    const auditLog: StockAuditEntry[] = [
      { timestamp: createdAt.slice(0, 16).replace('T', ' '), user: { ru: 'Система', en: 'System', lt: 'Sistema' }, userInitials: 'SY', property: { ru: 'Заказ создан', en: 'Order created', lt: 'Užsakymas sukurtas' }, oldValue: '', newValue: `ORD-2026-${seq}` },
    ]
    if (status !== 'new') {
      auditLog.push({
        timestamp: updatedAt.slice(0, 16).replace('T', ' '),
        user: { ru: 'Иван Н.', en: 'Ivan N.', lt: 'Ivan N.' },
        userInitials: 'IN',
        property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
        oldValue: 'new',
        newValue: status,
      })
    }

    const notesPool: Array<string | null> = [
      null, null, null, null,
      'Urgent — priority processing',
      'Export documentation required',
      'Delivery to construction site required',
      'Quality certificate needed',
      'Weekend delivery requested',
      'Partial delivery allowed',
      'Consolidate with next week order',
      null, null, null,
    ]
    const note = notesPool[Math.floor(rng() * notesPool.length)]!

    orders.push({
      id: `ORD-${seq}`,
      orderNumber: `ORD-2026-${seq}`,
      clientId: client.id,
      clientName: client.name,
      clientVatCode: client.vatCode,
      clientAddress: client.address,
      documentType: docType,
      status,
      items,
      services,
      totalAmount,
      totalVat,
      totalWithVat: totalAmount + totalVat,
      totalWeight,
      currency: 'EUR',
      notes: note,
      documents: [],
      files: [],
      auditLog,
      createdAt,
      updatedAt,
      _nextLineSeq: items.length + 1,
      _nextServiceSeq: services.length + 1,
    })
  }

  return orders
}

const STORE: StoreOrder[] = generateOrders()

let nextSeq = TOTAL_ORDERS + 1

function nextId(): string {
  return `ORD-${String(nextSeq++).padStart(3, '0')}`
}

function recalcTotals(order: StoreOrder): void {
  order.totalAmount = order.items.reduce((sum, i) => sum + i.totalPrice, 0) +
    order.services.reduce((sum, s) => sum + s.price * s.quantity, 0)
  order.totalVat = Math.round(order.totalAmount * 0.21 * 100) / 100
  order.totalWithVat = order.totalAmount + order.totalVat
  order.totalWeight = order.items.reduce((sum, i) => sum + (parseFloat(String(i.quantity)) * 0.5), 0)
}

function clone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

// ─── List ───

export function mockGetOrders(
  filters: { search: string; status: string; clientId: string | null; dateFrom: string; dateTo: string; sortBy: string | null; sortDir: string },
  pagination: PaginationParams,
): PaginatedResponse<OrderListItem> {
  let filtered = STORE.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    clientId: o.clientId,
    clientName: o.clientName,
    status: o.status,
    totalAmount: o.totalAmount,
    currency: 'EUR',
    itemCount: o.items.length + o.services.length,
    createdAt: o.createdAt,
  }))

  const search = filters.search?.toLowerCase() ?? ''
  if (search) {
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(search) ||
        o.clientName.toLowerCase().includes(search),
    )
  }

  const status = filters.status ?? ''
  if (status && status !== 'all') {
    filtered = filtered.filter((o) => o.status === status)
  }

  if (filters.clientId) {
    filtered = filtered.filter((o) => o.clientId === filters.clientId)
  }

  // Apply sorting
  const sortBy = filters.sortBy
  const sortDir = filters.sortDir === 'desc' ? -1 : 1
  if (sortBy) {
    filtered.sort((a, b) => {
      let va: string | number
      let vb: string | number
      switch (sortBy) {
        case 'orderNumber': va = a.orderNumber; vb = b.orderNumber; break
        case 'clientName': va = a.clientName; vb = b.clientName; break
        case 'status': va = a.status; vb = b.status; break
        case 'totalAmount': va = a.totalAmount; vb = b.totalAmount; break
        case 'createdAt': va = a.createdAt; vb = b.createdAt; break
        default: return 0
      }
      if (va < vb) return -1 * sortDir
      if (va > vb) return 1 * sortDir
      return 0
    })
  } else {
    // Default sort by createdAt DESC
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  const page = pagination.page
  const pageSize = pagination.pageSize
  const start = (page - 1) * pageSize
  const items = filtered.slice(start, start + pageSize)

  return {
    items: clone(items),
    total: filtered.length,
    page,
    pageSize,
    totalPages: Math.ceil(filtered.length / pageSize),
  }
}

// ─── Single ───

export function mockGetOrder(id: string): Order | undefined {
  const order = STORE.find((o) => o.id === id)
  return order ? clone(order) : undefined
}

// ─── Create ───

export function mockCreateOrder(data: { clientId: string; documentType: 'local' | 'export' }): Order {
  const clients = mockGetClients()
  const client = clients.find((c) => c.id === data.clientId)
  if (!client) throw new Error('CLIENT_NOT_FOUND')

  const id = nextId()
  const seq = STORE.length + 1
  const orderNumber = `ORD-2026-${String(seq).padStart(3, '0')}`
  const order: StoreOrder = {
    id,
    orderNumber,
    clientId: data.clientId,
    clientName: client.name,
    clientVatCode: client.vatCode,
    clientAddress: client.address,
    documentType: data.documentType,
    status: 'new',
    items: [],
    services: [],
    totalAmount: 0,
    totalVat: 0,
    totalWithVat: 0,
    totalWeight: 0,
    currency: 'EUR',
    notes: null,
    documents: [],
    files: [],
    auditLog: [
      { timestamp: new Date().toISOString(), user: { ru: 'Система', en: 'System', lt: 'Sistema' }, userInitials: 'SY', property: { ru: 'Заказ создан', en: 'Order created', lt: 'Užsakymas sukurtas' }, oldValue: '', newValue: orderNumber } as StockAuditEntry,
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _nextLineSeq: 1,
    _nextServiceSeq: 1,
  }
  STORE.push(order)
  return clone(order)
}

// ─── Patch ───

export function mockPatchOrder(id: string, delta: Partial<Order>): Order {
  const idx = STORE.findIndex((o) => o.id === id)
  if (idx === -1) throw new Error('ORDER_NOT_FOUND')
  Object.assign(STORE[idx]!, delta)
  return clone(STORE[idx]!)
}

export function mockPatchOrderStatus(id: string, status: OrderStatus): Order {
  const order = STORE.find((o) => o.id === id)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const oldStatus = order.status
  order.status = status
  order.updatedAt = new Date().toISOString()
  order.auditLog.push({
    timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
    user: { ru: 'Система', en: 'System', lt: 'Sistema' },
    userInitials: 'SY',
    property: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
    oldValue: oldStatus,
    newValue: status,
  })
  return clone(order)
}

// ─── Delete ───

export function mockDeleteOrder(id: string): void {
  const idx = STORE.findIndex((o) => o.id === id)
  if (idx !== -1) STORE.splice(idx, 1)
}

// ─── Items ───

export function mockAddOrderItem(orderId: string, data: { productId: string; quantity: number; unit: string; unitPrice: number; batchId?: string | null }): OrderItem {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  // Look up product name from the full products STORE with current locale, fall back to local PRODUCTS catalog
  const currentLang = typeof localStorage !== 'undefined' ? localStorage.getItem('flexiron_lang') || 'en' : 'en'
  const fullProduct = PRODUCTS_STORE.find((p) => p.id === data.productId)
  let productName = fullProduct?.name?.[currentLang as keyof typeof fullProduct.name] ?? fullProduct?.name?.en
  if (!productName) {
    productName = PRODUCTS.find((p) => p.id === data.productId)?.name ?? data.productId
  }
  const item: OrderItem = {
    id: `oi-${order._nextLineSeq}`,
    lineNumber: order._nextLineSeq,
    productId: data.productId,
    productName: productName ?? data.productId,
    quantity: data.quantity,
    unit: data.unit,
    unitPrice: data.unitPrice,
    discount: 0,
    totalPrice: data.quantity * data.unitPrice,
    batchId: data.batchId ?? null,
    offcutId: null,
  }
  order._nextLineSeq++
  order.items.push(item)
  recalcTotals(order)
  return clone(item)
}

export function mockUpdateOrderItem(orderId: string, lineId: string, delta: Partial<OrderItem>): OrderItem {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const item = order.items.find((i) => i.id === lineId)
  if (!item) throw new Error('ORDER_ITEM_NOT_FOUND')
  Object.assign(item, delta)
  if (delta.quantity !== undefined || delta.unitPrice !== undefined || delta.discount !== undefined) {
    item.totalPrice = Math.round(item.quantity * item.unitPrice * (1 - item.discount / 100) * 100) / 100
    recalcTotals(order)
  }
  return clone(item)
}

export function mockDeleteOrderItem(orderId: string, lineId: string): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const idx = order.items.findIndex((i) => i.id === lineId)
  if (idx !== -1) {
    order.items.splice(idx, 1)
    recalcTotals(order)
  }
}

// ─── Services ───

export function mockAddOrderService(orderId: string, data: { serviceId: string; quantity: number; price?: number }): OrderService {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const svcEntry = SERVICES_LIST.find((s) => s.id === data.serviceId) ?? SERVICES_LIST[0]!
  const currentLang = typeof localStorage !== 'undefined' ? localStorage.getItem('flexiron_lang') || 'en' : 'en'
  const fullSvc = MOCK_SERVICES_DATA.find((s) => s.id === svcEntry.id)
  const serviceName = fullSvc?.name?.[currentLang as keyof typeof fullSvc.name] ?? fullSvc?.name?.en ?? svcEntry.name
  const service: OrderService = {
    id: `os-${order._nextServiceSeq}`,
    serviceId: data.serviceId,
    serviceName,
    cost: svcEntry.cost,
    price: data.price ?? svcEntry.price,
    margin: (data.price ?? svcEntry.price) - svcEntry.cost,
    quantity: data.quantity,
  }
  order._nextServiceSeq++
  order.services.push(service)
  recalcTotals(order)
  return clone(service)
}

export function mockDeleteOrderService(orderId: string, serviceId: string): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const idx = order.services.findIndex((s) => s.id === serviceId)
  if (idx !== -1) {
    order.services.splice(idx, 1)
    recalcTotals(order)
  }
}

// ─── Audit ───

export function mockDeleteOrderAuditEntry(orderId: string, entryIndex: number): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  if (entryIndex >= 0 && entryIndex < order.auditLog.length) {
    order.auditLog.splice(entryIndex, 1)
  }
}

// ─── Files ───

let fileSeq = 1

export function mockAddOrderFile(orderId: string, fileId: string, originalName?: string): OrderFile {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const file: OrderFile = {
    id: `ord-file-${fileSeq++}`,
    name: originalName ?? `File ${fileSeq - 1}`,
    fileId,
    url: '#',
    size: 0,
    mime: 'application/octet-stream',
    uploadedAt: new Date().toISOString(),
  }
  order.files.push(file)
  return structuredClone(file)
}

export function mockRemoveOrderFile(orderId: string, fileId: string): void {
  const order = STORE.find((o) => o.id === orderId)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const idx = order.files.findIndex((f) => f.fileId === fileId)
  if (idx !== -1) {
    order.files.splice(idx, 1)
  }
}
