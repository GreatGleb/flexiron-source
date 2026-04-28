import { mockGetAnalyticsPage } from './analytics'
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
} from './products'
import type { ProductFilters } from '@/types/product'
import {
  mockGetSuppliers,
  mockGetSupplier,
  mockPatchSupplier,
  mockUpdateSupplierStatus,
  mockDeleteAuditEntry,
  mockCreateSupplier,
  mockExportSuppliersCsv,
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

  const supplierCardMatch = path.match(/^\/api\/suppliers\/([^/]+)$/)
  if (supplierCardMatch && !path.includes('/status')) {
    return delay(mockGetSupplier(supplierCardMatch[1] as string) as T)
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

  const categoryCardMatch = path.match(/^\/api\/categories\/([^/]+)$/)
  if (categoryCardMatch) {
    return delay(mockGetCategory(categoryCardMatch[1] as string) as T)
  }
  if (path === '/api/categories') {
    const filters: CategoryFilters = { search: params?.search ?? '' }
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(mockGetCategories(filters, page, pageSize) as T)
  }

  const productCardMatch = path.match(/^\/api\/products\/([^/]+)$/)
  if (productCardMatch) {
    return delay(mockGetProduct(productCardMatch[1] as string) as T)
  }
  if (path === '/api/products') {
    const filters: ProductFilters = {
      search: params?.search ?? '',
      categoryId: params?.categoryId ?? null,
    }
    return delay(mockGetProducts(filters) as T)
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
    return delay(mockPutCategoryFields(categoryFieldsMatch[1] as string, body as CategoryField[]) as T)
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
