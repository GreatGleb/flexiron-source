import { mockGetAnalyticsPage } from './analytics'
import {
  mockGetNotifications,
  mockGetUnreadCount,
  mockMarkAsRead,
  mockMarkAllAsRead,
} from './notifications'
import type { NotificationFilters } from '@/types/notifications'
import {
  mockGetStockOverview,
  mockGetStockItem,
  mockGetBatches,
  mockGetBatch,
  mockCreateBatch,
  mockPatchBatch,
  mockDeleteBatch,
  mockGetOffcuts,
  mockGetOffcut,
  mockCreateOffcut,
  mockPatchOffcut,
  mockDeleteOffcut,
  mockGetMovements,
  mockGetMovement,
  mockCreateMovement,
  mockDeleteMovement,
  mockExecuteCutting,
  mockGetDeficitList,
  mockGetDeficitItem,
  mockCreateDeficitItem,
  mockPatchDeficitItem,
  mockPatchStockItem,
  mockDeleteDeficitItem,
  mockGetStockAudit,
  mockDeleteStockAuditEntry,
  mockGetBatchAudit,
  mockDeleteBatchAuditEntry,
  mockGetOffcutAudit,
  mockDeleteOffcutAuditEntry,
  mockGetMovementAudit,
  mockDeleteMovementAuditEntry,
  mockGetDeficitAudit,
  mockDeleteDeficitAuditEntry,
  mockExportWarehouseCsv,
  mockGetBatchAggregates,
  mockGetBatchActiveSales,
  mockCalculateFifoCost,
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
  mockDeleteProductAuditEntry,
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
  mockGetClients,
  mockGetClient,
  mockCreateClient,
  mockPatchClient,
  mockDeleteClient,
  mockGetClientAudit,
  mockDeleteClientAuditEntry,
  mockAddClientInteraction,
  mockDeleteClientInteraction,
} from './clients'
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
import {
  mockGetSettings,
  mockSaveSettings,
  mockGetCompany,
  mockPatchCompany,
  mockGetConstants,
  mockPatchConstants,
  mockGetCurrencies,
  mockCreateCurrency,
  mockUpdateCurrency,
  mockDeleteCurrency,
  mockGetUoms,
  mockCreateUom,
  mockUpdateUom,
  mockDeleteUom,
  mockGetConversions,
  mockCreateConversion,
  mockUpdateConversion,
  mockDeleteConversion,
  mockGetOrderStatuses,
  mockCreateOrderStatus,
  mockUpdateOrderStatus,
  mockMoveOrderStatus,
  mockDeleteOrderStatus,
  mockGetProfile,
  mockPatchProfile,
} from './settings'
import {
  mockGetOrders,
  mockGetOrder,
  mockCreateOrder,
  mockPatchOrder,
  mockPatchOrderStatus,
  mockDeleteOrder,
  mockAddOrderItem,
  mockUpdateOrderItem,
  mockDeleteOrderItem,
  mockAddOrderService,
  mockDeleteOrderService,
  mockDeleteOrderAuditEntry,
  mockAddOrderFile,
  mockRemoveOrderFile,
} from './orders'
import type { SupplierFilters, SupplierCardData } from '@/types/supplier'
import type { ClientFormData } from '@/types/client'
import type { PaginationParams } from '@/types/api'
import type { OrderFilters } from '@/types/order'
import type { FinancePaymentFilters } from '@/types/finance'
import { mockGetPayments, mockGetPayment, mockPatchPayment, mockGetArchive } from './finance'

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

// ─── Finance ───
function parseFinancePaymentsParams(params?: Record<string, string>) {
  const direction = (params?.direction ?? 'all') as 'incoming' | 'outgoing' | 'all'
  const filters: FinancePaymentFilters = {
    search: params?.search ?? '',
    status: params?.status ?? 'all',
    counterpartyId: params?.counterpartyId ?? null,
    dateFrom: params?.dateFrom ?? '',
    dateTo: params?.dateTo ?? '',
    direction,
  }
  const pagination = {
    page: Number(params?.page ?? 1),
    pageSize: Number(params?.pageSize ?? 25),
  }
  return { direction, filters, pagination }
}

// ─── GET ───
export async function getMock<T>(path: string, params?: Record<string, string>): Promise<T> {
  // ── Auth: get current user (validate session) ──
  if (path === '/api/auth/me') {
    const user = getStoredMockUser()
    if (!user) throw new Error('Not authenticated')
    return delay(user as T)
  }

  // ── Auth: magic link verification (returns email) ──
  if (path === '/api/auth/link') {
    const token = params?.token
    if (!token) throw new Error('MISSING_TOKEN')
    // Accept any non-empty token in mock mode — return MagicLinkVerifyResponse format
    return delay({ email: 'director@metalltorg.com' } as T)
  }

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
  // ── Notifications ──
  if (path === '/api/notifications') {
    const filters: NotificationFilters = {
      search: params?.search ?? '',
      type: params?.type ?? 'all',
      isRead: params?.isRead ? params.isRead === 'true' : null,
      sortBy: params?.sortBy ?? 'createdAt',
      sortDir: (params?.sortDir as 'asc' | 'desc') ?? 'desc',
    }
    const pagination = {
      page: Number(params?.page ?? 1),
      pageSize: Number(params?.pageSize ?? 25),
    }
    return delay(mockGetNotifications(filters, pagination) as T)
  }
  if (path === '/api/notifications/unread-count') return delay(mockGetUnreadCount() as T)

  // ── Settings granular routes ──
  if (path === '/api/settings/company') return delay(mockGetCompany() as T)
  if (path === '/api/settings/constants') return delay(mockGetConstants() as T)
  if (path === '/api/settings/currencies') return delay(mockGetCurrencies() as T)
  if (path === '/api/settings/uoms') return delay(mockGetUoms() as T)
  if (path === '/api/settings/conversions') return delay(mockGetConversions() as T)
  if (path === '/api/settings/order-statuses') return delay(mockGetOrderStatuses() as T)
  if (path === '/api/settings/profile') return delay(mockGetProfile() as T)
  if (path === '/api/settings') return delay(mockGetSettings() as T)
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

  // ── Clients ──
  if (path === '/api/clients' || path === '/api/clients/translated') {
    const search = params?.search ?? ''
    const status = params?.status ?? ''
    const sortBy = params?.sortBy ?? ''
    const sortDir = params?.sortDir ?? 'asc'
    let filtered = mockGetClients()
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.companyCode.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q),
      )
    }
    if (status) {
      filtered = filtered.filter((c) => c.status === status)
    }
    // Sort
    if (sortBy) {
      filtered.sort((a, b) => {
        let cmp = 0
        if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
        else if (sortBy === 'email') cmp = a.email.localeCompare(b.email)
        else if (sortBy === 'status') cmp = a.status.localeCompare(b.status)
        return sortDir === 'desc' ? -cmp : cmp
      })
    }
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    const start = (page - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)
    return delay({
      items,
      total: filtered.length,
      page,
      pageSize,
      totalPages: Math.ceil(filtered.length / pageSize),
    } as T)
  }

  const clientCardMatch = path.match(/^\/api\/clients\/([^/]+)$/)
  if (clientCardMatch) {
    const client = mockGetClient(clientCardMatch[1] as string)
    if (!client) throw new Error('CLIENT_NOT_FOUND')
    return delay(client as T)
  }

  const clientAuditMatch = path.match(/^\/api\/clients\/([^/]+)\/audit$/)
  if (clientAuditMatch) {
    return delay(mockGetClientAudit(clientAuditMatch[1] as string) as T)
  }

  // ── Orders ──
  if (path === '/api/orders' || path === '/api/orders/translated') {
    const filters: OrderFilters = {
      search: params?.search ?? '',
      status: params?.status ?? 'all',
      clientId: params?.clientId ?? null,
      dateFrom: params?.dateFrom ?? '',
      dateTo: params?.dateTo ?? '',
      sortBy: params?.sortBy ?? null,
      sortDir: params?.sortDir ?? 'asc',
    }
    const pagination = {
      page: params?.page ? Number(params.page) : 1,
      pageSize: params?.pageSize ? Number(params.pageSize) : 25,
    }
    return delay(mockGetOrders(filters, pagination) as T)
  }

  const orderCardMatch = path.match(/^\/api\/orders\/([^/]+)$/)
  if (orderCardMatch) {
    return delay(mockGetOrder(orderCardMatch[1] as string) as T)
  }

  // ── Warehouse ──
  if (path === '/api/warehouse/stock') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(
      mockGetStockOverview(
        {
          search: params?.search ?? '',
          categoryIds: params?.categoryIds,
          unit: params?.unit,
          showDeficitOnly: params?.showDeficitOnly,
          showInStockOnly: params?.showInStockOnly,
          sortBy: params?.sortBy,
          sortDir: params?.sortDir,
        },
        { page, pageSize },
      ) as T,
    )
  }

  // Cost breakdown route must be checked BEFORE the generic stock card match
  const stockCostMatch = path.match(/^\/api\/warehouse\/stock\/([^/]+)\/cost$/)
  if (stockCostMatch) {
    const productId = stockCostMatch[1] as string
    const quantity = params?.quantity ? Number(params.quantity) : 1
    return delay(mockCalculateFifoCost(productId, quantity) as T)
  }

  const stockCardMatch = path.match(/^\/api\/warehouse\/stock\/([^/]+)$/)
  if (stockCardMatch) {
    // Check if this is an audit request
    if (path.endsWith('/audit')) {
      return delay(mockGetStockAudit(stockCardMatch[1] as string) as T)
    }
    return delay(mockGetStockItem(stockCardMatch[1] as string) as T)
  }

  const stockAuditMatch = path.match(/^\/api\/warehouse\/stock\/([^/]+)\/audit$/)
  if (stockAuditMatch) {
    return delay(mockGetStockAudit(stockAuditMatch[1] as string) as T)
  }

  if (path === '/api/warehouse/batches') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(
      mockGetBatches(
        {
          search: params?.search ?? '',
          productId: params?.productId,
          supplierId: params?.supplierId,
          status: params?.status,
          unit: params?.unit,
          dateFrom: params?.dateFrom,
          dateTo: params?.dateTo,
          sortBy: params?.sortBy,
          sortDir: params?.sortDir,
        },
        { page, pageSize },
      ) as T,
    )
  }

  const batchCardMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)$/)
  if (batchCardMatch) {
    // Check if this is an audit request
    if (path.endsWith('/audit')) {
      return delay(mockGetBatchAudit(batchCardMatch[1] as string) as T)
    }
    return delay(mockGetBatch(batchCardMatch[1] as string) as T)
  }

  const batchAuditMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)\/audit$/)
  if (batchAuditMatch) {
    return delay(mockGetBatchAudit(batchAuditMatch[1] as string) as T)
  }

  const batchAggregatesMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)\/aggregates$/)
  if (batchAggregatesMatch) {
    return delay(mockGetBatchAggregates(batchAggregatesMatch[1] as string) as T)
  }

  const batchActiveSalesMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)\/active-sales$/)
  if (batchActiveSalesMatch) {
    return delay(mockGetBatchActiveSales(batchActiveSalesMatch[1] as string) as T)
  }

  if (path === '/api/warehouse/offcuts') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(
      mockGetOffcuts(
        {
          search: params?.search ?? '',
          productId: params?.productId,
          status: params?.status,
          unit: params?.unit,
          offcutType: params?.offcutType,
          categoryIds: params?.categoryIds,
          batchNumber: params?.batchNumber,
          sortBy: params?.sortBy,
          sortDir: params?.sortDir,
        },
        { page, pageSize },
      ) as T,
    )
  }

  const offcutCardMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)$/)
  if (offcutCardMatch) {
    // Check if this is an audit request
    if (path.endsWith('/audit')) {
      return delay(mockGetOffcutAudit(offcutCardMatch[1] as string) as T)
    }
    return delay(mockGetOffcut(offcutCardMatch[1] as string) as T)
  }

  const offcutAuditMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)\/audit$/)
  if (offcutAuditMatch) {
    return delay(mockGetOffcutAudit(offcutAuditMatch[1] as string) as T)
  }

  const movementCardMatch = path.match(/^\/api\/warehouse\/movements\/([^/]+)$/)
  if (movementCardMatch) {
    // Check if this is an audit request
    if (path.endsWith('/audit')) {
      return delay(mockGetMovementAudit(movementCardMatch[1] as string) as T)
    }
    return delay(mockGetMovement(movementCardMatch[1] as string) as T)
  }

  const movementAuditMatch = path.match(/^\/api\/warehouse\/movements\/([^/]+)\/audit$/)
  if (movementAuditMatch) {
    return delay(mockGetMovementAudit(movementAuditMatch[1] as string) as T)
  }
  if (movementCardMatch) {
    return delay(mockGetMovement(movementCardMatch[1] as string) as T)
  }

  if (path === '/api/warehouse/movements') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(
      mockGetMovements(
        {
          search: params?.search ?? '',
          type: params?.type,
          productId: params?.productId,
          unit: params?.unit,
          categoryIds: params?.categoryIds,
          batchNumber: params?.batchNumber,
          referenceId: params?.referenceId,
          offcutId: params?.offcutId,
          dateFrom: params?.dateFrom,
          dateTo: params?.dateTo,
          sortBy: params?.sortBy,
          sortDir: params?.sortDir,
        },
        { page, pageSize },
      ) as T,
    )
  }

  if (path === '/api/warehouse/deficit') {
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(
      mockGetDeficitList(
        {
          search: params?.search ?? '',
          priority: params?.priority,
          status: params?.status,
          unit: params?.unit,
          categoryIds: params?.categoryIds,
          sortBy: params?.sortBy,
          sortDir: params?.sortDir,
        },
        { page, pageSize },
      ) as T,
    )
  }

  const deficitCardMatch = path.match(/^\/api\/warehouse\/deficit\/([^/]+)$/)
  if (deficitCardMatch) {
    // Check if this is an audit request
    if (path.endsWith('/audit')) {
      return delay(mockGetDeficitAudit(deficitCardMatch[1] as string) as T)
    }
    return delay(mockGetDeficitItem(deficitCardMatch[1] as string) as T)
  }

  const deficitAuditMatch = path.match(/^\/api\/warehouse\/deficit\/([^/]+)\/audit$/)
  if (deficitAuditMatch) {
    return delay(mockGetDeficitAudit(deficitAuditMatch[1] as string) as T)
  }

  // ── Warehouse Export ──
  const exportMatch = path.match(
    /^\/api\/warehouse\/export\/(stock|batches|offcuts|movements|deficit)$/,
  )
  if (exportMatch) {
    return delay(mockExportWarehouseCsv(exportMatch[1] as string) as T)
  }

  // ── Finance ──
  if (path === '/api/finance/payments') {
    const { direction, filters, pagination } = parseFinancePaymentsParams(params)
    return delay(mockGetPayments(direction, { ...filters, ...pagination }) as T)
  }

  const financePaymentCardMatch = path.match(/^\/api\/finance\/payments\/([^/]+)$/)
  if (financePaymentCardMatch) {
    return delay(mockGetPayment(financePaymentCardMatch[1] as string) as T)
  }

  if (path === '/api/finance/archive') {
    const search = params?.search ?? ''
    const type = params?.type ?? 'all'
    const relatedEntityType = params?.relatedEntityType ?? 'all'
    const page = Number(params?.page ?? 1)
    const pageSize = Number(params?.pageSize ?? 25)
    return delay(mockGetArchive({ search, type, relatedEntityType, page, pageSize }) as T)
  }

  throw new Error(`[mock] GET ${path} not found`)
}

// ─── Auth mock user storage ───
const MOCK_AUTH_USER_KEY = 'mock_auth_user'

function getStoredMockUser(): import('@/types/auth').UserInfo | null {
  try {
    const raw = localStorage.getItem(MOCK_AUTH_USER_KEY)
    return raw ? (JSON.parse(raw) as import('@/types/auth').UserInfo) : null
  } catch {
    return null
  }
}

function setStoredMockUser(user: import('@/types/auth').UserInfo): void {
  localStorage.setItem(MOCK_AUTH_USER_KEY, JSON.stringify(user))
}

function clearStoredMockUser(): void {
  localStorage.removeItem(MOCK_AUTH_USER_KEY)
}

// ─── POST ───
export async function postMock<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  // ── Auth: login ──
  if (path === '/api/auth/login') {
    const { email, password } = body as { email: string; password: string }
    if (!email || !password) {
      throw new Error('Email and password are required')
    }
    // Accept any non-empty email+password in mock mode
    const mockUser: import('@/types/auth').UserInfo = {
      id: 'usr-mock-001',
      email,
      first_name: 'Иван',
      last_name: 'Петров',
      phone: '+7 (495) 123-45-67',
      locale: 'ru',
      role: 'admin',
      tenant_id: 'tenant-mock-001',
      is_active: true,
    }
    setStoredMockUser(mockUser)
    const response: import('@/types/auth').LoginResponse = {
      user: mockUser,
      session: {
        token: 'mock-token-' + Date.now(),
        csrf_token: 'mock-csrf-' + Date.now(),
        expires_at: new Date(Date.now() + 86400000).toISOString(), // +1 day
      },
    }
    return delay(response as T)
  }

  // ── Auth: logout ──
  if (path === '/api/auth/logout') {
    clearStoredMockUser()
    return delay(undefined as T)
  }

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

  if (path === '/api/clients') {
    return delay(mockCreateClient(body as ClientFormData) as T)
  }

  const clientInteractionPostMatch = path.match(/^\/api\/clients\/([^/]+)\/interactions$/)
  if (clientInteractionPostMatch) {
    return delay(
      mockAddClientInteraction(
        clientInteractionPostMatch[1] as string,
        body as import('@/types/client').InteractionHistoryEntry,
      ) as T,
    )
  }

  // ── Orders POST ──
  if (path === '/api/orders') {
    return delay(
      mockCreateOrder(body as { clientId: string; documentType: 'local' | 'export' }) as T,
    )
  }

  const orderItemMatch = path.match(/^\/api\/orders\/([^/]+)\/items$/)
  if (orderItemMatch) {
    return delay(
      mockAddOrderItem(
        orderItemMatch[1] as string,
        body as Parameters<typeof mockAddOrderItem>[1],
      ) as T,
    )
  }

  const orderServiceMatch = path.match(/^\/api\/orders\/([^/]+)\/services$/)
  if (orderServiceMatch) {
    return delay(
      mockAddOrderService(
        orderServiceMatch[1] as string,
        body as Parameters<typeof mockAddOrderService>[1],
      ) as T,
    )
  }

  const orderFilesPostMatch = path.match(/^\/api\/orders\/([^/]+)\/files$/)
  if (orderFilesPostMatch) {
    const fileId = (body as { fileId: string }).fileId
    const originalName = uploadedFiles.get(fileId)?.name
    return delay(mockAddOrderFile(orderFilesPostMatch[1] as string, fileId, originalName) as T)
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

  // ── Settings POST ──
  if (path === '/api/settings/currencies')
    return delay(mockCreateCurrency(body as Parameters<typeof mockCreateCurrency>[0]) as T)
  if (path === '/api/settings/uoms')
    return delay(mockCreateUom(body as Parameters<typeof mockCreateUom>[0]) as T)
  if (path === '/api/settings/conversions')
    return delay(mockCreateConversion(body as Parameters<typeof mockCreateConversion>[0]) as T)
  if (path === '/api/settings/order-statuses')
    return delay(mockCreateOrderStatus(body as Parameters<typeof mockCreateOrderStatus>[0]) as T)
  if (path === '/api/settings/change-password') return delay(undefined as T) // no-op mock

  throw new Error(`[mock] POST ${path} not found`)
}

// ─── PUT (bulk replace) ───
export async function putMock<T>(
  path: string,
  body: unknown,
  _headers?: Record<string, string>,
): Promise<T> {
  // ── Settings PUT ──
  if (path === '/api/settings/order-statuses/reorder') {
    mockMoveOrderStatus((body as { orderedIds: string[] }).orderedIds)
    return delay(undefined as T)
  }
  if (path === '/api/settings') {
    mockSaveSettings(body as Parameters<typeof mockSaveSettings>[0])
    return delay(undefined as T)
  }
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
      mockPatchCategory(
        categoryMatch[1] as string,
        body as Parameters<typeof mockPatchCategory>[1],
      ) as T,
    )
  }

  const productPatchMatch = path.match(/^\/api\/products\/([^/]+)$/)
  if (productPatchMatch) {
    return delay(
      mockPatchProduct(
        productPatchMatch[1] as string,
        body as Parameters<typeof mockPatchProduct>[1],
      ) as T,
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
      mockPatchService(
        servicePatchMatch[1] as string,
        body as Parameters<typeof mockPatchService>[1],
      ) as T,
    )
  }

  const clientPatchMatch = path.match(/^\/api\/clients\/([^/]+)$/)
  if (clientPatchMatch) {
    return delay(
      mockPatchClient(
        clientPatchMatch[1] as string,
        body as Partial<import('@/types/client').Client>,
      ) as T,
    )
  }

  // ── Orders PATCH ──
  const orderStatusMatch = path.match(/^\/api\/orders\/([^/]+)\/status$/)
  if (orderStatusMatch) {
    const { status } = body as { status: import('@/types/order').OrderStatus }
    return delay(mockPatchOrderStatus(orderStatusMatch[1] as string, status) as T)
  }

  const orderItemUpdateMatch = path.match(/^\/api\/orders\/([^/]+)\/items\/([^/]+)$/)
  if (orderItemUpdateMatch) {
    return delay(
      mockUpdateOrderItem(
        orderItemUpdateMatch[1] as string,
        orderItemUpdateMatch[2] as string,
        body as Parameters<typeof mockUpdateOrderItem>[2],
      ) as T,
    )
  }

  const orderPatchMatch = path.match(/^\/api\/orders\/([^/]+)$/)
  if (orderPatchMatch) {
    return delay(
      mockPatchOrder(
        orderPatchMatch[1] as string,
        body as Partial<import('@/types/order').Order>,
      ) as T,
    )
  }

  // ── Warehouse PATCH ──
  const batchPatchMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)$/)
  if (batchPatchMatch) {
    return delay(
      mockPatchBatch(
        batchPatchMatch[1] as string,
        body as Parameters<typeof mockPatchBatch>[1],
      ) as T,
    )
  }

  const deficitPatchMatch = path.match(/^\/api\/warehouse\/deficit\/([^/]+)$/)
  if (deficitPatchMatch) {
    return delay(
      mockPatchDeficitItem(
        deficitPatchMatch[1] as string,
        body as Parameters<typeof mockPatchDeficitItem>[1],
      ) as T,
    )
  }

  const stockPatchMatch = path.match(/^\/api\/warehouse\/stock\/([^/]+)$/)
  if (stockPatchMatch) {
    return delay(
      mockPatchStockItem(stockPatchMatch[1] as string, body as { minStock?: number | null }) as T,
    )
  }

  const offcutPatchMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)$/)
  if (offcutPatchMatch) {
    return delay(
      mockPatchOffcut(
        offcutPatchMatch[1] as string,
        body as Parameters<typeof mockPatchOffcut>[1],
      ) as T,
    )
  }

  // ── Settings PATCH ──
  if (path === '/api/settings/company') {
    const result = mockPatchCompany(body as Parameters<typeof mockPatchCompany>[0])
    return delay(result as T)
  }
  if (path === '/api/settings/constants') {
    const result = mockPatchConstants(body as Parameters<typeof mockPatchConstants>[0])
    return delay(result as T)
  }
  if (path === '/api/settings/profile') {
    const result = mockPatchProfile(body as Parameters<typeof mockPatchProfile>[0])
    return delay(result as T)
  }

  const currencyPatchMatch = path.match(/^\/api\/settings\/currencies\/([^/]+)$/)
  if (currencyPatchMatch) {
    mockUpdateCurrency(
      currencyPatchMatch[1] as string,
      body as Parameters<typeof mockUpdateCurrency>[1],
    )
    return delay(undefined as T)
  }
  const conversionPatchMatch = path.match(/^\/api\/settings\/conversions\/([^/]+)$/)
  if (conversionPatchMatch) {
    mockUpdateConversion(
      conversionPatchMatch[1] as string,
      body as Parameters<typeof mockUpdateConversion>[1],
    )
    return delay(undefined as T)
  }
  const uomPatchMatch = path.match(/^\/api\/settings\/uoms\/([^/]+)$/)
  if (uomPatchMatch) {
    mockUpdateUom(uomPatchMatch[1] as string, body as Parameters<typeof mockUpdateUom>[1])
    return delay(undefined as T)
  }

  const statusPatchMatch = path.match(/^\/api\/settings\/order-statuses\/([^/]+)$/)
  if (statusPatchMatch) {
    mockUpdateOrderStatus(
      statusPatchMatch[1] as string,
      body as Parameters<typeof mockUpdateOrderStatus>[1],
    )
    return delay(undefined as T)
  }

  // ── Notifications PATCH ──
  if (path === '/api/notifications/read-all') {
    mockMarkAllAsRead()
    return delay(undefined as T)
  }
  const notifReadMatch = path.match(/^\/api\/notifications\/([^/]+)\/read$/)
  if (notifReadMatch) {
    mockMarkAsRead(notifReadMatch[1] as string)
    return delay(undefined as T)
  }

  // ── Finance PATCH ──
  const financePaymentPatchMatch = path.match(/^\/api\/finance\/payments\/([^/]+)$/)
  if (financePaymentPatchMatch) {
    return delay(
      mockPatchPayment(
        financePaymentPatchMatch[1] as string,
        body as Partial<import('@/types/finance').FinancePayment>,
      ) as T,
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

  const stockAuditMatch = path.match(/^\/api\/warehouse\/stock\/([^/]+)\/audit\/(\d+)$/)
  if (stockAuditMatch) {
    mockDeleteStockAuditEntry(stockAuditMatch[1] as string, Number(stockAuditMatch[2]))
    return delay(undefined as T)
  }

  const batchAuditMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)\/audit\/(\d+)$/)
  if (batchAuditMatch) {
    mockDeleteBatchAuditEntry(batchAuditMatch[1] as string, Number(batchAuditMatch[2]))
    return delay(undefined as T)
  }

  const offcutAuditDeleteMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)\/audit\/(\d+)$/)
  if (offcutAuditDeleteMatch) {
    mockDeleteOffcutAuditEntry(
      offcutAuditDeleteMatch[1] as string,
      Number(offcutAuditDeleteMatch[2]),
    )
    return delay(undefined as T)
  }

  const movementAuditDeleteMatch = path.match(
    /^\/api\/warehouse\/movements\/([^/]+)\/audit\/(\d+)$/,
  )
  if (movementAuditDeleteMatch) {
    mockDeleteMovementAuditEntry(
      movementAuditDeleteMatch[1] as string,
      Number(movementAuditDeleteMatch[2]),
    )
    return delay(undefined as T)
  }

  const deficitAuditDeleteMatch = path.match(/^\/api\/warehouse\/deficit\/([^/]+)\/audit\/(\d+)$/)
  if (deficitAuditDeleteMatch) {
    mockDeleteDeficitAuditEntry(
      deficitAuditDeleteMatch[1] as string,
      Number(deficitAuditDeleteMatch[2]),
    )
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

  const productAuditDeleteMatch = path.match(/^\/api\/products\/([^/]+)\/audit\/(\d+)$/)
  if (productAuditDeleteMatch) {
    mockDeleteProductAuditEntry(
      productAuditDeleteMatch[1] as string,
      Number(productAuditDeleteMatch[2]),
    )
    return delay(undefined as T)
  }

  const productDeleteMatch = path.match(/^\/api\/products\/([^/]+)$/)
  if (productDeleteMatch) {
    const result = await mockDeleteProduct(productDeleteMatch[1] as string)
    if (!result.ok) throw new Error(result.code ?? 'PRODUCT_NOT_FOUND')
    return delay(undefined as T)
  }

  const serviceDeleteMatch = path.match(/^\/api\/services\/([^/]+)$/)
  if (serviceDeleteMatch) {
    const deleted = mockDeleteService(serviceDeleteMatch[1] as string)
    if (!deleted) throw new Error('SERVICE_NOT_FOUND')
    return delay(undefined as T)
  }

  const clientDeleteMatch = path.match(/^\/api\/clients\/([^/]+)$/)
  if (clientDeleteMatch) {
    mockDeleteClient(clientDeleteMatch[1] as string)
    return delay(undefined as T)
  }

  const clientAuditDeleteMatch = path.match(/^\/api\/clients\/([^/]+)\/audit\/(\d+)$/)
  if (clientAuditDeleteMatch) {
    mockDeleteClientAuditEntry(
      clientAuditDeleteMatch[1] as string,
      Number(clientAuditDeleteMatch[2]),
    )
    return delay(undefined as T)
  }

  const clientInteractionDeleteMatch = path.match(/^\/api\/clients\/([^/]+)\/interactions\/(\d+)$/)
  if (clientInteractionDeleteMatch) {
    mockDeleteClientInteraction(
      clientInteractionDeleteMatch[1] as string,
      Number(clientInteractionDeleteMatch[2]),
    )
    return delay(undefined as T)
  }

  // ── Orders DELETE ──
  const orderItemDeleteMatch = path.match(/^\/api\/orders\/([^/]+)\/items\/([^/]+)$/)
  if (orderItemDeleteMatch) {
    mockDeleteOrderItem(orderItemDeleteMatch[1] as string, orderItemDeleteMatch[2] as string)
    return delay(undefined as T)
  }

  const orderServiceDeleteMatch = path.match(/^\/api\/orders\/([^/]+)\/services\/([^/]+)$/)
  if (orderServiceDeleteMatch) {
    mockDeleteOrderService(
      orderServiceDeleteMatch[1] as string,
      orderServiceDeleteMatch[2] as string,
    )
    return delay(undefined as T)
  }

  const orderDeleteMatch = path.match(/^\/api\/orders\/([^/]+)$/)
  if (orderDeleteMatch) {
    mockDeleteOrder(orderDeleteMatch[1] as string)
    return delay(undefined as T)
  }

  const orderAuditDeleteMatch = path.match(/^\/api\/orders\/([^/]+)\/audit\/(\d+)$/)
  if (orderAuditDeleteMatch) {
    mockDeleteOrderAuditEntry(orderAuditDeleteMatch[1] as string, Number(orderAuditDeleteMatch[2]))
    return delay(undefined as T)
  }

  const orderFileDeleteMatch = path.match(/^\/api\/orders\/([^/]+)\/files\/([^/]+)$/)
  if (orderFileDeleteMatch) {
    mockRemoveOrderFile(orderFileDeleteMatch[1] as string, orderFileDeleteMatch[2] as string)
    return delay(undefined as T)
  }

  // ── Warehouse DELETE ──
  const batchDeleteMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)$/)
  if (batchDeleteMatch) {
    await mockDeleteBatch(batchDeleteMatch[1] as string)
    return delay(undefined as T)
  }

  const offcutDeleteMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)$/)
  if (offcutDeleteMatch) {
    await mockDeleteOffcut(offcutDeleteMatch[1] as string)
    return delay(undefined as T)
  }

  const movementDeleteMatch = path.match(/^\/api\/warehouse\/movements\/([^/]+)$/)
  if (movementDeleteMatch) {
    mockDeleteMovement(movementDeleteMatch[1] as string)
    return delay(undefined as T)
  }

  const deficitDeleteMatch = path.match(/^\/api\/warehouse\/deficit\/([^/]+)$/)
  if (deficitDeleteMatch) {
    mockDeleteDeficitItem(deficitDeleteMatch[1] as string)
    return delay(undefined as T)
  }

  // ── Settings DELETE ──
  const currencyDeleteMatch = path.match(/^\/api\/settings\/currencies\/([^/]+)$/)
  if (currencyDeleteMatch) {
    mockDeleteCurrency(currencyDeleteMatch[1] as string)
    return delay(undefined as T)
  }
  const uomDeleteMatch = path.match(/^\/api\/settings\/uoms\/([^/]+)$/)
  if (uomDeleteMatch) {
    mockDeleteUom(uomDeleteMatch[1] as string)
    return delay(undefined as T)
  }
  const conversionDeleteMatch = path.match(/^\/api\/settings\/conversions\/([^/]+)$/)
  if (conversionDeleteMatch) {
    mockDeleteConversion(conversionDeleteMatch[1] as string)
    return delay(undefined as T)
  }
  const statusDeleteMatch = path.match(/^\/api\/settings\/order-statuses\/([^/]+)$/)
  if (statusDeleteMatch) {
    mockDeleteOrderStatus(statusDeleteMatch[1] as string)
    return delay(undefined as T)
  }

  throw new Error(`[mock] DELETE ${path} not found`)
}

// ─── UPLOAD ───
export async function uploadMock<T>(path: string, file: File): Promise<T> {
  if (path === '/api/uploads') {
    const fileId = `file-${uploadSeq++}-${Date.now()}`
    // Convert file to data URL so the URL survives localStorage cache across page reloads.
    // In production the backend returns a permanent URL — this is mock-only.
    const dataUrl = await fileToDataUrl(file)
    const meta: UploadedFileMeta = {
      fileId,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      url: dataUrl,
      uploadedAt: new Date().toISOString(),
    }
    uploadedFiles.set(fileId, meta)
    return delay(meta as T)
  }
  throw new Error(`[mock] UPLOAD ${path} not found`)
}

/** Helper: read a File as a base64 data URL */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}
