import type { Page, Route } from '@playwright/test'
import { mockBatches } from '../../../src/mocks/warehouse-batches'
import { mockOffcuts } from '../../../src/mocks/warehouse-offcuts'
import { mockMovements } from '../../../src/mocks/warehouse-movements'
import { mockDeficit } from '../../../src/mocks/warehouse-deficit'
import { mockStockOverview } from '../../../src/mocks/warehouse-stock'

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

function extractId(url: URL): string | null {
  const segments = url.pathname.split('/')
  return segments[segments.length - 1] || null
}

// ─── Granular mock functions ──────────────────────────────────────────────────

/**
 * Mock GET /api/warehouse/stock
 */
export async function mockStockList(page: Page, data = mockStockOverview, status?: number) {
  await page.route('**/api/warehouse/stock**', async (route) => {
    const url = new URL(route.request().url())
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
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
 * Mock GET /api/warehouse/offcuts
 */
export async function mockOffcutsList(page: Page, data = mockOffcuts, status?: number) {
  await page.route('**/api/warehouse/offcuts**', async (route) => {
    const url = new URL(route.request().url())
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
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
 * Mock GET /api/warehouse/movements
 */
export async function mockMovementsList(page: Page, data = mockMovements, status?: number) {
  await page.route('**/api/warehouse/movements**', async (route) => {
    const url = new URL(route.request().url())
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
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
 * Mock DELETE /api/warehouse/movements/:id (delete movement)
 */
export async function mockDeleteMovement(page: Page, movementId: string, status?: number) {
  await page.route(`**/api/warehouse/movements/${movementId}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback()
    if (status && status >= 400) {
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Mock error' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
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
  await mockDeleteMovement(page, 'whm-001')
  await mockDeleteDeficit(page, 'whd-001')
  await mockUpdateBatch(page, 'whb-001')
  await mockBatchDetail(page, 'whb-001')
}
