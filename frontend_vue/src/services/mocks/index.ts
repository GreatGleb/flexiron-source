import { mockGetAnalyticsPage } from './analytics'
import {
  mockGetStockOverview,
  mockGetBatches,
  mockGetBatch,
  mockCreateBatch,
  mockPatchBatch,
  mockDeleteBatch,
  mockGetOffcuts,
  mockGetOffcut,
  mockCreateOffcut,
  mockDeleteOffcut,
  mockGetMovements,
  mockCreateMovement,
  mockDeleteMovement,
  mockExecuteCutting,
  mockGetDeficitList,
  mockGetDeficitItem,
  mockCreateDeficitItem,
  mockPatchDeficitItem,
  mockDeleteDeficitItem,
} from './warehouse'
import {
  mockGetCategories,
  mockGetCategory,
  mockCreateCategory,
  mockPatchCategory,
  mockDeleteCategory,
  mockPutCategoryFields,
} from './categories'
import type { CategoryFilters, CategoryField } from '@/types/category'
import {
  mockGetProducts,
  mockGetProduct,
  mockCreateProduct,
  mockPatchProduct,
  mockDeleteProduct,
  STORE as PRODUCTS_STORE,
} from './products'
import type { ProductFilters } from '@/types/product'
import {
  mockGetServices,
  mockGetService,
  mockCreateService,
  mockPatchService,
  mockDeleteService,
} from './services'
import type { ServiceFilters } from '@/types/service'
import {
  mockGetSuppliers,
  mockGetSupplier,
  mockPatchSupplier,
  mockUpdateSupplierStatus,
  mockDeleteAuditEntry,
  mockCreateSupplier,
  mockExportSuppliersCsv,
  MOCK_SUPPLIERS,
} from './suppliers'
import {
  mockGetBccCategories,
  mockGetBccRecipients,
  mockGetBccHistory,
  mockSendBccRequest,
  mockLogBccRequest,
  mockAcceptResponse,
  mockMarkNoResponse,
} from './bcc'
import {
  mockGetFieldLibrary,
  mockGetSections,
  mockSaveSections,
  mockSaveFieldLibrary,
  mockGetPermissions,
  mockSavePermissions,
  mockCreateField,
  mockUpdateField,
  mockDeleteField,
  mockCreateSection,
  mockUpdateSection,
  mockDeleteSection,
} from './config'
import type { SupplierFilters, SupplierCardData } from '@/types/supplier'
import type { PaginationParams } from '@/types/api'

function delay<T>(data: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms))
}

// ─── Idempotency cache (Idempotency-Key → cached response) ───
const idempotencyCache = new Map<string, unknown>()

function withIdempotency<T>(headers: Record<string, string> | undefined, fn: () => T): T {
  const key = headers?.['Idempotency-Key'] ?? headers?.['idempotency-key']
  if (!key) return fn()
  if (idempotencyCache.has(key)) return idempotencyCache.get(key) as T
  const result = fn()
  idempotencyCache.set(key, result)
  return result
}

// ─── Uploads (in-memory registry) ───
let uploadSeq = 1
interface UploadedFileMeta {
  fileId: string
  name: string
  size: number
  mime: string
  url: string
  uploadedAt: string
}
const uploadedFiles = new Map<string, UploadedFileMeta>()

// ─── GET ───
export async function getMock<T>(path: string, params?: Record<string, string>): Promise<T> {
  const analyticsMatch = path.match(/^\/api\/analytics\/(.+)$/)
  if (analyticsMatch) {
    return delay(mockGetAnalyticsPage(analyticsMatch[1] as string) as T)
  }

  if (path === '/api/suppliers/export.csv') {
    const filters: SupplierFilters = {
      search: params?.search ?? '',
      status: (params?.status as SupplierFilters['status']) ?? 'all',
      categories: params?.categories ? params.categories.split(',') : [],
      rating: Number(params?.rating ?? 0),
    }
    return delay(mockExportSuppliersCsv(filters) as T)
  }

  if (path === '/api/suppliers/list') {
    // Return suppliers that match the IDs used in batch mock data (sup-XXX format)
    const suppliers = MOCK_SUPPLIERS.map((s) => ({
      id: `sup-${String(s.id).padStart(3, '0')}`,
      company: s.company.en,
    }))
    return delay(suppliers as T)
  }

  if (path === '/api/suppliers') {
    const filters: SupplierFilters = {
      search: params?.search ?? '',
      status: (params?.status as SupplierFilters['status']) ?? 'all',
      categories: params?.categories ? params.categories.split(',') : [],
      rating: Number(params?.rating ?? 0),
    }
    const pagination: PaginationParams = {
      page: Number(params?.page ?? 1),
      pageSize: Number(params?.pageSize ?? 25),
    }
    return delay(mockGetSuppliers(filters, pagination) as T)
  }

  const supplierCardMatch = path.match(/^\/api\/suppliers\/([^/]+)$/)
  if (supplierCardMatch && !path.includes('/status')) {
    return delay(mockGetSupplier(supplierCardMatch[1] as string) as T)
  }

  if (path === '/api/bcc/categories') return delay(mockGetBccCategories() as T)
  if (path === '/api/bcc/recipients') {
    const productIds = params?.products ? params.products.split(',') : []
    return delay(mockGetBccRecipients(productIds) as T)
  }
  if (path === '/api/bcc/history') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(mockGetBccHistory(page, pageSize) as T)
  }
  if (path === '/api/config/fields') return delay(mockGetFieldLibrary() as T)
  if (path === '/api/config/sections') return delay(mockGetSections() as T)
  if (path === '/api/config/permissions') return delay(mockGetPermissions() as T)

  if (path === '/api/categories') {
    const filters: CategoryFilters = { search: params?.search ?? '' }
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(mockGetCategories(filters, page, pageSize) as T)
  }
  const categoryCardMatch = path.match(/^\/api\/categories\/([^/]+)$/)
  if (categoryCardMatch) {
    return delay(mockGetCategory(categoryCardMatch[1] as string) as T)
  }

  if (path === '/api/products') {
    const filters: ProductFilters = {
      search: params?.search ?? '',
      categoryIds: params?.categoryIds ? params.categoryIds.split(',') : [],
      sortBy: (params?.sortBy as ProductFilters['sortBy']) ?? null,
      sortDir: (params?.sortDir as 'asc' | 'desc') ?? 'asc',
    }
    const pagination = {
      page: params?.page ? Number(params.page) : 1,
      pageSize: params?.pageSize ? Number(params.pageSize) : 25,
    }
    return delay(mockGetProducts({ ...filters, ...pagination }) as T)
  }

  if (path === '/api/products/list') {
    // Return lightweight product list for dropdowns (id + name only)
    const products = PRODUCTS_STORE.map((p) => ({
      id: p.id,
      name: p.name,
    }))
    return delay(products as T)
  }

  const productCardMatch = path.match(/^\/api\/products\/([^/]+)$/)
  if (productCardMatch) {
    return delay(mockGetProduct(productCardMatch[1] as string) as T)
  }

  if (path === '/api/services') {
    const filters: ServiceFilters = {
      search: params?.search ?? '',
      sortBy: (params?.sortBy as ServiceFilters['sortBy']) ?? 'name',
      sortDir: (params?.sortDir as 'asc' | 'desc') ?? 'asc',
    }
    const pagination = {
      page: params?.page ? Number(params.page) : 1,
      pageSize: params?.pageSize ? Number(params.pageSize) : 25,
    }
    return delay(mockGetServices(filters, pagination) as T)
  }

  const serviceCardMatch = path.match(/^\/api\/services\/([^/]+)$/)
  if (serviceCardMatch) {
    return delay(mockGetService(serviceCardMatch[1] as string) as T)
  }

  // ── Warehouse ──
  if (path === '/api/warehouse/stock') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(mockGetStockOverview({
      search: params?.search ?? '',
      categoryIds: params?.categoryIds,
      unit: params?.unit,
      showDeficitOnly: params?.showDeficitOnly,
      showInStockOnly: params?.showInStockOnly,
      sortBy: params?.sortBy,
      sortDir: params?.sortDir,
    }, { page, pageSize }) as T)
  }

  if (path === '/api/warehouse/batches') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(mockGetBatches({
      search: params?.search ?? '',
      productId: params?.productId,
      supplierId: params?.supplierId,
      status: params?.status,
      unit: params?.unit,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      sortBy: params?.sortBy,
      sortDir: params?.sortDir,
    }, { page, pageSize }) as T)
  }

  const batchCardMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)$/)
  if (batchCardMatch) {
    return delay(mockGetBatch(batchCardMatch[1] as string) as T)
  }

  if (path === '/api/warehouse/offcuts') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(mockGetOffcuts({
      search: params?.search ?? '',
      productId: params?.productId,
      status: params?.status,
      unit: params?.unit,
      offcutType: params?.offcutType,
      categoryIds: params?.categoryIds,
      batchNumber: params?.batchNumber,
      sortBy: params?.sortBy,
      sortDir: params?.sortDir,
    }, { page, pageSize }) as T)
  }

  const offcutCardMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)$/)
  if (offcutCardMatch) {
    return delay(mockGetOffcut(offcutCardMatch[1] as string) as T)
  }

  if (path === '/api/warehouse/movements') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(mockGetMovements({
      search: params?.search ?? '',
      type: params?.type,
      productId: params?.productId,
      unit: params?.unit,
      categoryIds: params?.categoryIds,
      batchNumber: params?.batchNumber,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo,
      sortBy: params?.sortBy,
      sortDir: params?.sortDir,
    }, { page, pageSize }) as T)
  }

  if (path === '/api/warehouse/deficit') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(mockGetDeficitList({
      search: params?.search ?? '',
      priority: params?.priority,
      status: params?.status,
      unit: params?.unit,
      categoryIds: params?.categoryIds,
      sortBy: params?.sortBy,
      sortDir: params?.sortDir,
    }, { page, pageSize }) as T)
  }

  const deficitCardMatch = path.match(/^\/api\/warehouse\/deficit\/([^/]+)$/)
  if (deficitCardMatch) {
    return delay(mockGetDeficitItem(deficitCardMatch[1] as string) as T)
  }

  throw new Error(`[mock] GET ${path} not found`)
}

// ─── POST ───
export async function postMock<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  if (path === '/api/bcc/send') {
    return delay(
      withIdempotency(headers, () =>
        mockSendBccRequest(body as Parameters<typeof mockSendBccRequest>[0]),
      ) as T,
    )
  }
  if (path === '/api/bcc/log') {
    return delay(
      withIdempotency(headers, () =>
        mockLogBccRequest(body as Parameters<typeof mockLogBccRequest>[0]),
      ) as T,
    )
  }

  const acceptMatch = path.match(/^\/api\/bcc\/events\/([^/]+)\/response$/)
  if (acceptMatch) {
    const evt = mockAcceptResponse(
      acceptMatch[1] as string,
      body as { price: number; unit: string },
    )
    return delay(evt as T)
  }
  const noRespMatch = path.match(/^\/api\/bcc\/events\/([^/]+)\/no-response$/)
  if (noRespMatch) {
    const evt = mockMarkNoResponse(noRespMatch[1] as string)
    return delay(evt as T)
  }

  if (path === '/api/suppliers') {
    return delay(mockCreateSupplier(body as Parameters<typeof mockCreateSupplier>[0]) as T)
  }

  if (path === '/api/config/fields') {
    return delay(mockCreateField(body as Parameters<typeof mockCreateField>[0]) as T)
  }
  if (path === '/api/config/sections') {
    return delay(mockCreateSection(body as Parameters<typeof mockCreateSection>[0]) as T)
  }
  if (path === '/api/categories') {
    return delay(mockCreateCategory(body as Parameters<typeof mockCreateCategory>[0]) as T)
  }

  if (path === '/api/products') {
    return delay(mockCreateProduct(body as Parameters<typeof mockCreateProduct>[0]) as T)
  }

  if (path === '/api/services') {
    return delay(mockCreateService(body as Parameters<typeof mockCreateService>[0]) as T)
  }

  // ── Warehouse POST ──
  if (path === '/api/warehouse/batches') {
    return delay(mockCreateBatch(body as Parameters<typeof mockCreateBatch>[0]) as T)
  }

  if (path === '/api/warehouse/offcuts') {
    return delay(mockCreateOffcut(body as Parameters<typeof mockCreateOffcut>[0]) as T)
  }

  if (path === '/api/warehouse/movements') {
    return delay(mockCreateMovement(body as Parameters<typeof mockCreateMovement>[0]) as T)
  }

  if (path === '/api/warehouse/cutting') {
    return delay(mockExecuteCutting(body as Parameters<typeof mockExecuteCutting>[0]) as T)
  }

  if (path === '/api/warehouse/deficit') {
    return delay(mockCreateDeficitItem(body as Parameters<typeof mockCreateDeficitItem>[0]) as T)
  }

  throw new Error(`[mock] POST ${path} not found`)
}

// ─── PUT (bulk replace) ───
export async function putMock<T>(
  path: string,
  body: unknown,
  _headers?: Record<string, string>,
): Promise<T> {
  if (path === '/api/config/sections') {
    mockSaveSections(body as Parameters<typeof mockSaveSections>[0])
    return delay(undefined as T)
  }
  if (path === '/api/config/fields') {
    mockSaveFieldLibrary(body as Parameters<typeof mockSaveFieldLibrary>[0])
    return delay(undefined as T)
  }
  if (path === '/api/config/permissions') {
    mockSavePermissions(body as Parameters<typeof mockSavePermissions>[0])
    return delay(undefined as T)
  }

  const categoryFieldsMatch = path.match(/^\/api\/categories\/([^/]+)\/fields$/)
  if (categoryFieldsMatch) {
    const { fields } = body as { fields: CategoryField[] }
    return delay(mockPutCategoryFields(categoryFieldsMatch[1] as string, fields) as T)
  }

  throw new Error(`[mock] PUT ${path} not found`)
}

// ─── PATCH (merge) ───
export async function patchMock<T>(
  path: string,
  body: unknown,
  _headers?: Record<string, string>,
): Promise<T> {
  const statusMatch = path.match(/^\/api\/suppliers\/([^/]+)\/status$/)
  if (statusMatch) {
    const { status } = body as { status: string }
    mockUpdateSupplierStatus(statusMatch[1] as string, status)
    return delay(undefined as T)
  }

  const supplierMatch = path.match(/^\/api\/suppliers\/([^/]+)$/)
  if (supplierMatch) {
    return delay(
      mockPatchSupplier(supplierMatch[1] as string, body as Partial<SupplierCardData>) as T,
    )
  }

  const categoryMatch = path.match(/^\/api\/categories\/([^/]+)$/)
  if (categoryMatch) {
    return delay(
      mockPatchCategory(categoryMatch[1] as string, body as Parameters<typeof mockPatchCategory>[1]) as T,
    )
  }

  const productPatchMatch = path.match(/^\/api\/products\/([^/]+)$/)
  if (productPatchMatch) {
    return delay(
      mockPatchProduct(productPatchMatch[1] as string, body as Parameters<typeof mockPatchProduct>[1]) as T,
    )
  }

  const sectionMatch = path.match(/^\/api\/config\/sections\/([^/]+)$/)
  if (sectionMatch) {
    const updated = mockUpdateSection(
      sectionMatch[1] as string,
      body as Parameters<typeof mockUpdateSection>[1],
    )
    return delay(updated as T)
  }

  const fieldMatch = path.match(/^\/api\/config\/fields\/([^/]+)$/)
  if (fieldMatch) {
    const updated = mockUpdateField(
      fieldMatch[1] as string,
      body as Parameters<typeof mockUpdateField>[1],
    )
    return delay(updated as T)
  }

  const servicePatchMatch = path.match(/^\/api\/services\/([^/]+)$/)
  if (servicePatchMatch) {
    return delay(
      mockPatchService(servicePatchMatch[1] as string, body as Parameters<typeof mockPatchService>[1]) as T,
    )
  }

  // ── Warehouse PATCH ──
  const batchPatchMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)$/)
  if (batchPatchMatch) {
    return delay(
      mockPatchBatch(batchPatchMatch[1] as string, body as Parameters<typeof mockPatchBatch>[1]) as T,
    )
  }

  const deficitPatchMatch = path.match(/^\/api\/warehouse\/deficit\/([^/]+)$/)
  if (deficitPatchMatch) {
    return delay(
      mockPatchDeficitItem(deficitPatchMatch[1] as string, body as Parameters<typeof mockPatchDeficitItem>[1]) as T,
    )
  }

  throw new Error(`[mock] PATCH ${path} not found`)
}

// ─── DELETE ───
export async function deleteMock<T>(path: string, _headers?: Record<string, string>): Promise<T> {
  const auditMatch = path.match(/^\/api\/suppliers\/([^/]+)\/audit\/(\d+)$/)
  if (auditMatch) {
    mockDeleteAuditEntry(auditMatch[1] as string, Number(auditMatch[2]))
    return delay(undefined as T)
  }

  const fieldMatch = path.match(/^\/api\/config\/fields\/([^/]+)$/)
  if (fieldMatch) {
    mockDeleteField(fieldMatch[1] as string)
    return delay(undefined as T)
  }

  const sectionMatch = path.match(/^\/api\/config\/sections\/([^/]+)$/)
  if (sectionMatch) {
    mockDeleteSection(sectionMatch[1] as string)
    return delay(undefined as T)
  }

  const categoryDeleteMatch = path.match(/^\/api\/categories\/([^/]+)$/)
  if (categoryDeleteMatch) {
    const result = mockDeleteCategory(categoryDeleteMatch[1] as string)
    if (!result.ok) throw new Error(result.code)
    return delay(undefined as T)
  }

  const productDeleteMatch = path.match(/^\/api\/products\/([^/]+)$/)
  if (productDeleteMatch) {
    const deleted = mockDeleteProduct(productDeleteMatch[1] as string)
    if (!deleted) throw new Error('PRODUCT_NOT_FOUND')
    return delay(undefined as T)
  }

  const serviceDeleteMatch = path.match(/^\/api\/services\/([^/]+)$/)
  if (serviceDeleteMatch) {
    const deleted = mockDeleteService(serviceDeleteMatch[1] as string)
    if (!deleted) throw new Error('SERVICE_NOT_FOUND')
    return delay(undefined as T)
  }

  // ── Warehouse DELETE ──
  const batchDeleteMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)$/)
  if (batchDeleteMatch) {
    return delay(mockDeleteBatch(batchDeleteMatch[1] as string) as T)
  }

  const offcutDeleteMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)$/)
  if (offcutDeleteMatch) {
    return delay(mockDeleteOffcut(offcutDeleteMatch[1] as string) as T)
  }

  const movementDeleteMatch = path.match(/^\/api\/warehouse\/movements\/([^/]+)$/)
  if (movementDeleteMatch) {
    return delay(mockDeleteMovement(movementDeleteMatch[1] as string) as T)
  }

  const deficitDeleteMatch = path.match(/^\/api\/warehouse\/deficit\/([^/]+)$/)
  if (deficitDeleteMatch) {
    return delay(mockDeleteDeficitItem(deficitDeleteMatch[1] as string) as T)
  }

  throw new Error(`[mock] DELETE ${path} not found`)
}

// ─── UPLOAD ───
export async function uploadMock<T>(path: string, file: File): Promise<T> {
  if (path === '/api/uploads') {
    const fileId = `file-${uploadSeq++}-${Date.now()}`
    const meta: UploadedFileMeta = {
      fileId,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      url: `#uploaded/${fileId}`,
      uploadedAt: new Date().toISOString(),
    }
    uploadedFiles.set(fileId, meta)
    return delay(meta as T)
  }
  throw new Error(`[mock] UPLOAD ${path} not found`)
}
