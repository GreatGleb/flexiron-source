import type { Page, Route } from '@playwright/test'
import { mockBatches } from '../../../src/mocks/warehouse-batches'
import { mockOffcuts } from '../../../src/mocks/warehouse-offcuts'
import { mockMovements } from '../../../src/mocks/warehouse-movements'
import { mockDeficit } from '../../../src/mocks/warehouse-deficit'
import { mockStockOverview } from '../../../src/mocks/warehouse-stock'

// ─── Product mock data for batch/offcut create pages ─────────────────────────
const MOCK_PRODUCTS_FOR_CREATE: Array<{
  id: string
  name: { en: string; ru: string; lt: string }
  categoryId: string
  categoryName: { en: string; ru: string; lt: string }
}> = [
  {
    id: 'prod-001',
    name: { en: 'Steel Sheet 3mm', ru: 'Стальной лист 3мм', lt: 'Plieno lakštas 3mm' },
    categoryId: 'cat-2',
    categoryName: { en: 'Sheets', ru: 'Листы', lt: 'Lakštai' },
  },
  {
    id: 'prod-002',
    name: { en: 'Aluminium Sheet 2mm', ru: 'Алюминиевый лист 2мм', lt: 'Aliuminio lakštas 2mm' },
    categoryId: 'cat-2',
    categoryName: { en: 'Sheets', ru: 'Листы', lt: 'Lakštai' },
  },
  {
    id: 'prod-003',
    name: { en: 'Steel Beam IPE 200', ru: 'Стальная балка IPE 200', lt: 'Plieninė sija IPE 200' },
    categoryId: 'cat-1',
    categoryName: { en: 'Metal Products', ru: 'Металлопрокат', lt: 'Metalo gaminiai' },
  },
]

const MOCK_PRODUCT_DETAIL: Record<string, Record<string, unknown>> = {
  'prod-001': {
    id: 'prod-001',
    name: { en: 'Steel Sheet 3mm', ru: 'Стальной лист 3мм', lt: 'Plieno lakštas 3mm' },
    categoryId: 'cat-2',
    categoryName: { en: 'Sheets', ru: 'Листы', lt: 'Lakštai' },
    sku: 'SS-3-1000',
    description: 'Hot-rolled steel sheet, 1000x2000mm',
    price: 120.50,
    minStock: 50,
    priceUnit: 'EUR/kg',
    createdAt: '2025-01-15',
    fieldValues: [],
    linkedSuppliers: [
      { id: '1', name: { en: 'Steel Plus OÜ', ru: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 115.00, priceUnit: 'EUR/kg', leadDays: 7 },
    ],
    auditLog: [],
  },
}

const MOCK_SUPPLIERS_LIST = [
  { id: 'sup-001', company: 'Steel Plus OÜ' },
  { id: 'sup-002', company: 'Metal Trade LT' },
]

// ─── Product/Supplier mock helpers ────────────────────────────────────────────

function isSingleProductRequest(url: URL): boolean {
  const match = url.pathname.match(/^\/api\/products\/([^/]+)$/)
  return match !== null && match[1] !== undefined
}

/**
 * Mock GET /api/products (paginated product list)
 */
export async function mockProductList(page: Page, data = MOCK_PRODUCTS_FOR_CREATE, status?: number) {
  await page.route('**/api/products**', async (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== 'GET') return route.fallback()
    if (isSingleProductRequest(url)) return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill(jsonResponse(paginate(data, url))(route))
  })
}

/**
 * Mock GET /api/products/:id (single product detail)
 */
export async function mockProductDetail(page: Page, productId: string, status?: number) {
  await page.route(`**/api/products/${productId}**`, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    const product = MOCK_PRODUCT_DETAIL[productId] ?? null
    return route.fulfill({ status: product ? 200 : 404, contentType: 'application/json', body: JSON.stringify(product) })
  })
}

/**
 * Mock GET /api/suppliers/list (supplier dropdown list)
 */
export async function mockSupplierList(page: Page, data = MOCK_SUPPLIERS_LIST, status?: number) {
  await page.route('**/api/suppliers/list', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill(jsonResponse(data)(route))
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function paginate<T>(items: T[], url: URL): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
  const pageSize = Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10))
  const total = items.length
  const totalPages = Math.ceil(total / pageSize)
  const start = (page - 1) * pageSize
  const paged = items.slice(start, start + pageSize)
  return { items: paged, total, page, pageSize, totalPages }
}

function jsonResponse(data: unknown, status = 200) {
  return (route: Route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
}

function isSingleBatchRequest(url: URL): boolean {
  // /api/warehouse/batches/{id} — but NOT /api/warehouse/batches?...
  const path = url.pathname
  const match = path.match(/\/api\/warehouse\/batches\/([^/]+)$/)
  return match !== null && match[1] !== undefined
}

function isSingleDeficitRequest(url: URL): boolean {
  const path = url.pathname
  const match = path.match(/\/api\/warehouse\/deficit\/([^/]+)$/)
  return match !== null && match[1] !== undefined
}

function isSingleOffcutRequest(url: URL): boolean {
  // /api/warehouse/offcuts/{id} — but NOT /api/warehouse/offcuts?...
  const path = url.pathname
  const match = path.match(/\/api\/warehouse\/offcuts\/([^/]+)$/)
  return match !== null && match[1] !== undefined
}

function isSingleMovementRequest(url: URL): boolean {
  // /api/warehouse/movements/{id} — but NOT /api/warehouse/movements?...
  const path = url.pathname
  const match = path.match(/\/api\/warehouse\/movements\/([^/]+)$/)
  return match !== null && match[1] !== undefined
}

function isSingleStockRequest(url: URL): boolean {
  // /api/warehouse/stock/{id} — but NOT /api/warehouse/stock?...
  const path = url.pathname
  const match = path.match(/\/api\/warehouse\/stock\/([^/]+)$/)
  return match !== null && match[1] !== undefined
}

function extractId(url: URL): string | null {
  const segments = url.pathname.split('/')
  return segments[segments.length - 1] || null
}

// ─── Granular mock functions ──────────────────────────────────────────────────

/**
 * Mock GET /api/warehouse/stock (list) or GET /api/warehouse/stock/:productId (single)
 */
export async function mockStockList(page: Page, data = mockStockOverview, status?: number) {
  await page.route('**/api/warehouse/stock**', async (route) => {
    const url = new URL(route.request().url())
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    if (isSingleStockRequest(url)) {
      const id = extractId(url)
      const item = data.find((s) => s.productId === id) ?? null
      return route.fulfill({ status: item ? 200 : 404, contentType: 'application/json', body: JSON.stringify(item) })
    }
    return route.fulfill(jsonResponse(paginate(data, url))(route))
  })
}

/**
 * Mock GET /api/warehouse/batches (list) or GET /api/warehouse/batches/:id (single)
 */
export async function mockBatchesList(page: Page, data = mockBatches, status?: number) {
  await page.route('**/api/warehouse/batches**', async (route) => {
    const url = new URL(route.request().url())
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    if (isSingleBatchRequest(url)) {
      const id = extractId(url)
      const batch = data.find((b) => b.id === id) ?? null
      return route.fulfill({ status: batch ? 200 : 404, contentType: 'application/json', body: JSON.stringify(batch) })
    }
    return route.fulfill(jsonResponse(paginate(data, url))(route))
  })
}

/**
 * Mock GET /api/warehouse/batches/:id (single batch detail)
 */
export async function mockBatchDetail(page: Page, batchId: string, data?: unknown, status?: number) {
  await page.route(`**/api/warehouse/batches/${batchId}**`, async (route) => {
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    const batch = data ?? mockBatches.find((b) => b.id === batchId) ?? null
    return route.fulfill({ status: batch ? 200 : 404, contentType: 'application/json', body: JSON.stringify(batch) })
  })
}

/**
 * Mock POST /api/warehouse/batches (create batch)
 */
export async function mockCreateBatch(page: Page, response?: unknown, status?: number) {
  await page.route('**/api/warehouse/batches', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(response ?? { id: 'whb-new', ...route.request().postDataJSON() }) })
  })
}

/**
 * Mock PATCH /api/warehouse/batches/:id (update batch)
 */
export async function mockUpdateBatch(page: Page, batchId: string, status?: number) {
  await page.route(`**/api/warehouse/batches/${batchId}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: batchId, ...route.request().postDataJSON() }) })
  })
}

/**
 * Mock DELETE /api/warehouse/batches/:id (delete batch)
 */
export async function mockDeleteBatch(page: Page, batchId: string, status?: number) {
  await page.route(`**/api/warehouse/batches/${batchId}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })
}

/**
 * Mock GET /api/warehouse/offcuts (list) or GET /api/warehouse/offcuts/:id (single)
 */
export async function mockOffcutsList(page: Page, data = mockOffcuts, status?: number) {
  await page.route('**/api/warehouse/offcuts**', async (route) => {
    const url = new URL(route.request().url())
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    if (isSingleOffcutRequest(url)) {
      const id = extractId(url)
      const offcut = data.find((o) => o.id === id) ?? null
      return route.fulfill({ status: offcut ? 200 : 404, contentType: 'application/json', body: JSON.stringify(offcut) })
    }
    return route.fulfill(jsonResponse(paginate(data, url))(route))
  })
}

/**
 * Mock POST /api/warehouse/offcuts (create offcut)
 */
export async function mockCreateOffcut(page: Page, response?: unknown, status?: number) {
  await page.route('**/api/warehouse/offcuts', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(response ?? { id: 'who-new', ...route.request().postDataJSON() }) })
  })
}

/**
 * Mock DELETE /api/warehouse/offcuts/:id (delete offcut)
 */
export async function mockDeleteOffcut(page: Page, offcutId: string, status?: number) {
  await page.route(`**/api/warehouse/offcuts/${offcutId}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })
}

/**
 * Mock GET /api/warehouse/movements (list) or GET /api/warehouse/movements/:id (single)
 */
export async function mockMovementsList(page: Page, data = mockMovements, status?: number) {
  await page.route('**/api/warehouse/movements**', async (route) => {
    const url = new URL(route.request().url())
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    if (isSingleMovementRequest(url)) {
      const id = extractId(url)
      const movement = data.find((m) => m.id === id) ?? null
      return route.fulfill({ status: movement ? 200 : 404, contentType: 'application/json', body: JSON.stringify(movement) })
    }
    return route.fulfill(jsonResponse(paginate(data, url))(route))
  })
}

/**
 * Mock POST /api/warehouse/movements (create movement)
 */
export async function mockCreateMovement(page: Page, response?: unknown, status?: number) {
  await page.route('**/api/warehouse/movements', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(response ?? { id: 'whm-new', ...route.request().postDataJSON() }) })
  })
}

/**
 * Mock POST /api/warehouse/cutting (execute cutting)
 */
export async function mockCutting(page: Page, response?: unknown, status?: number) {
  await page.route('**/api/warehouse/cutting', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(response ?? { id: 'cut-new', success: true }) })
  })
}

/**
 * Mock GET /api/warehouse/deficit
 */
export async function mockDeficitList(page: Page, data = mockDeficit, status?: number) {
  await page.route('**/api/warehouse/deficit**', async (route) => {
    const url = new URL(route.request().url())
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    if (isSingleDeficitRequest(url)) {
      const id = extractId(url)
      const item = data.find((d) => d.id === id) ?? null
      return route.fulfill({ status: item ? 200 : 404, contentType: 'application/json', body: JSON.stringify(item) })
    }
    return route.fulfill(jsonResponse(paginate(data, url))(route))
  })
}

/**
 * Mock POST /api/warehouse/deficit (create deficit item)
 */
export async function mockCreateDeficit(page: Page, response?: unknown, status?: number) {
  await page.route('**/api/warehouse/deficit', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(response ?? { id: 'whd-new', ...route.request().postDataJSON() }) })
  })
}

/**
 * Mock PATCH /api/warehouse/deficit/:id (update deficit item)
 */
export async function mockUpdateDeficit(page: Page, deficitId: string, status?: number) {
  await page.route(`**/api/warehouse/deficit/${deficitId}`, async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: deficitId, ...route.request().postDataJSON() }) })
  })
}

/**
 * Mock DELETE /api/warehouse/deficit/:id (delete deficit item)
 */
export async function mockDeleteDeficit(page: Page, deficitId: string, status?: number) {
  await page.route(`**/api/warehouse/deficit/${deficitId}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  })
}

/**
 * Mock GET /api/warehouse/stock/:productId (single stock item)
 */
export async function mockStockDetail(page: Page, productId: string, data?: unknown, status?: number) {
  await page.route(`**/api/warehouse/stock/${productId}**`, async (route) => {
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    const stock = data ?? null
    return route.fulfill({ status: stock ? 200 : 404, contentType: 'application/json', body: JSON.stringify(stock) })
  })
}

// ─── All-in-one setup ─────────────────────────────────────────────────────────

/**
 * Mock all warehouse API endpoints at once.
 * Calls every granular mock function to register route handlers.
 */
export async function mockWarehouseEndpoints(page: Page) {
  await mockStockList(page)
  await mockBatchesList(page)
  await mockOffcutsList(page)
  await mockMovementsList(page)
  await mockDeficitList(page)
  await mockCreateBatch(page)
  await mockCreateOffcut(page)
  await mockCreateMovement(page)
  await mockCutting(page)
  await mockCreateDeficit(page)
  await mockUpdateDeficit(page, 'whd-001')
  await mockDeleteBatch(page, 'whb-001')
  await mockDeleteOffcut(page, 'who-001')
  await mockDeleteDeficit(page, 'whd-001')
  await mockUpdateBatch(page, 'whb-001')
  await mockBatchDetail(page, 'whb-001')
}
