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
  mockGetOffcutOffers,
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
  mockGetOrderPermissions,
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
  mockGetMail,
  mockPatchMail,
  mockSendMailTest,
  mockGetWarehouseMap,
  mockSaveWarehouseMap,
  mockDeleteWarehouseMap,
} from './settings'
import {
  mockGetOrders,
  mockGetSalesCrmStats,
  mockGetOrder,
  mockCreateOrder,
  mockPatchOrder,
  mockPatchOrderStatus,
  mockPlanOrderShipment,
  mockPlanStatusTransition,
  mockDeleteOrder,
  mockAddOrderItem,
  mockUpdateOrderItem,
  mockDeleteOrderItem,
  mockAddOrderService,
  mockUpdateOrderService,
  mockDeleteOrderService,
  mockDeleteOrderAuditEntry,
  mockAddOrderFile,
  mockRemoveOrderFile,
  mockAllocateOrderTotal,
  mockSplitOrderItem,
  mockCorrectOrderLine,
  mockGetShipments,
  mockCreateShipment,
  mockCancelShipment,
  mockGetReturns,
  mockPlanReturn,
  mockCreateReturn,
  mockReserveOrder,
  mockGetReservations,
  mockGetOrderPayments,
  mockAddOrderPayment,
  mockDeleteOrderPayment,
  mockGetInvoices,
  mockGetClientInvoiceSummary,
  mockCreateInvoice,
} from './orders'
import type { SupplierFilters, SupplierCardData } from '@/types/supplier'
import type { ClientFormData } from '@/types/client'
import type { PaginationParams } from '@/types/api'
import type { OrderFilters } from '@/types/order'
import {
  mockGetPayments,
  mockGetPayment,
  mockPatchPayment,
  mockGetArchive,
  mockGetReceivables,
} from './finance'
import { mockGetAuditFeed, mockGetAuditFeedUsers } from './auditFeed'
import type { AuditFeedFilters } from '@/types/audit'

/**
 * How many mock answers are still on their way.
 *
 * Every mock response goes through `delay`, so this is the one place that knows
 * whether the "server" is done. E2E needs that number: under mocks there is no
 * network request at all — an answer is a `setTimeout` — so Playwright's
 * `networkidle` reports quiet while the data is still pending, and a test that
 * waits for it reads a page that has rendered nothing yet.
 *
 * Published on `window` rather than exported, because the reader is the test
 * runner in another process. Nothing in the app may branch on it.
 */
let pendingMockRequests = 0
/**
 * Сколько запросов мок принял ЗА ВСЁ ВРЕМЯ — монотонно, не убывает.
 *
 * Без этого числа запрос, успевший начаться и закончиться между двумя опросами
 * хелпера, невидим: `__mockPending` в оба момента ноль, и ожидание уходит по ветке
 * «страница ничего не спрашивала» — то есть возвращается ДО данных, которые уже
 * пришли. Ноль здесь значит «ещё ничего не спрашивали», и только он.
 */
let totalMockRequests = 0

function publishPending() {
  const w = globalThis as unknown as { __mockPending?: number; __mockCalls?: number }
  w.__mockPending = pendingMockRequests
  w.__mockCalls = totalMockRequests
}
publishPending()

/**
 * Считает ЗАПРОС, а не ответ, и делает это на границе диспетчера.
 *
 * Раньше счёт вёлся в `delay()`, то есть только по успешным ответам: обработчик,
 * бросивший ошибку до задержки (`BATCH_NOT_FOUND` и вся семья «не найдено»), для
 * ожидания не существовал вовсе — страница, спросившая и получившая отказ, выглядела
 * как страница, которая ничего не спрашивала.
 */
async function dispatch<T>(run: () => Promise<T>): Promise<T> {
  pendingMockRequests += 1
  totalMockRequests += 1
  publishPending()
  try {
    return await run()
  } finally {
    pendingMockRequests -= 1
    publishPending()
  }
}

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
function parseFinanceListParams(params?: Record<string, string>) {
  return {
    search: params?.search ?? '',
    status: params?.status ?? 'all',
    page: Number(params?.page ?? 1),
    pageSize: Number(params?.pageSize ?? 25),
  }
}

// ─── GET ───
async function getMockRoute<T>(path: string, params?: Record<string, string>): Promise<T> {
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
      status: (params?.status ?? 'all') as SupplierFilters['status'],
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
      status: (params?.status ?? 'all') as SupplierFilters['status'],
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
      sortDir: (params?.sortDir ?? 'desc') as 'asc' | 'desc',
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
  if (path === '/api/settings/order-permissions') return delay(mockGetOrderPermissions() as T)
  if (path === '/api/settings/currencies') return delay(mockGetCurrencies() as T)
  if (path === '/api/settings/uoms') return delay(mockGetUoms() as T)
  if (path === '/api/settings/conversions') return delay(mockGetConversions() as T)
  if (path === '/api/settings/order-statuses') return delay(mockGetOrderStatuses() as T)
  if (path === '/api/settings/profile') return delay(mockGetProfile() as T)
  if (path === '/api/settings/mail') return delay(mockGetMail() as T)
  if (path === '/api/settings/warehouse-map') return delay(mockGetWarehouseMap() as T)

  // The audit feed reads the nine logs where they live; it has no store of its own,
  // and deletion goes to the entity's own endpoint — never to a path under /audit-feed.
  if (path === '/api/audit-feed/users') return delay(mockGetAuditFeedUsers() as T)
  if (path === '/api/audit-feed') {
    const filters: AuditFeedFilters = {
      entityType: params?.entityType ?? '',
      user: params?.user ?? '',
      dateFrom: params?.dateFrom ?? '',
      dateTo: params?.dateTo ?? '',
      search: params?.search ?? '',
    }
    return delay(
      mockGetAuditFeed(filters, {
        page: Number(params?.page ?? 1),
        pageSize: Number(params?.pageSize ?? 25),
      }) as T,
    )
  }
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
      sortDir: (params?.sortDir ?? 'asc') as 'asc' | 'desc',
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
      sortBy: (params?.sortBy ?? 'name') as ServiceFilters['sortBy'],
      sortDir: (params?.sortDir ?? 'asc') as 'asc' | 'desc',
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
        // Asked for by the dashboard: "the five newest clients" is a sort the
        // server owns. Picking the newest out of the first page instead means
        // picking them out of whichever clients happened to be on it.
        else if (sortBy === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt)
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

  // Documents, not orders — answered by the orders store, which is where an
  // invoice lives, and already knowing which of them the client still holds and
  // which of their money names no document at all.
  const clientInvoicesMatch = path.match(/^\/api\/clients\/([^/]+)\/invoices$/)
  if (clientInvoicesMatch) {
    return delay(mockGetClientInvoiceSummary(clientInvoicesMatch[1] as string) as T)
  }

  // ── Sales CRM ──
  // Counted over everything, by the side that holds everything.
  if (path === '/api/sales-crm/stats') {
    return delay(mockGetSalesCrmStats() as T)
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

  // Read-only: what a status change would do to the warehouse, before it does it.
  const statusPlanMatch = path.match(/^\/api\/orders\/([^/]+)\/status-plan$/)
  if (statusPlanMatch) {
    return delay(
      mockPlanStatusTransition(
        statusPlanMatch[1] as string,
        (params?.status ?? 'new') as import('@/types/order').OrderStatus,
      ) as T,
    )
  }

  // What could go on a truck right now, and how much of it.
  const shipPlanMatch = path.match(/^\/api\/orders\/([^/]+)\/ship-plan$/)
  if (shipPlanMatch) {
    return delay(mockPlanOrderShipment(shipPlanMatch[1] as string) as T)
  }

  const orderShipmentsMatch = path.match(/^\/api\/orders\/([^/]+)\/shipments$/)
  if (orderShipmentsMatch) {
    return delay(mockGetShipments(orderShipmentsMatch[1] as string) as T)
  }

  // What can still come back, and what already has. Both before the bare
  // `/api/orders/:id` below — that pattern would swallow them.
  const returnPlanMatch = path.match(/^\/api\/orders\/([^/]+)\/return-plan$/)
  if (returnPlanMatch) {
    return delay(mockPlanReturn(returnPlanMatch[1] as string) as T)
  }

  const orderReturnsMatch = path.match(/^\/api\/orders\/([^/]+)\/returns$/)
  if (orderReturnsMatch) {
    return delay(mockGetReturns(orderReturnsMatch[1] as string) as T)
  }

  const orderPaymentsMatch = path.match(/^\/api\/orders\/([^/]+)\/payments$/)
  if (orderPaymentsMatch) {
    return delay(mockGetOrderPayments(orderPaymentsMatch[1] as string) as T)
  }

  const orderInvoicesMatch = path.match(/^\/api\/orders\/([^/]+)\/invoices$/)
  if (orderInvoicesMatch) {
    return delay(mockGetInvoices(orderInvoicesMatch[1] as string) as T)
  }

  const orderReservationsMatch = path.match(/^\/api\/orders\/([^/]+)\/reservations$/)
  if (orderReservationsMatch) {
    return delay(mockGetReservations({ orderId: orderReservationsMatch[1] as string }) as T)
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
          uomId: params?.uomId,
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
          uomId: params?.uomId,
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
          uomId: params?.uomId,
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

  // Проверяется ДО карточки обрезка: `/offcuts/offers` подходит под её шаблон
  // `/offcuts/:id`, и обобщённое совпадение увело бы запрос в «обрезок не найден».
  if (path === '/api/warehouse/offcuts/offers') {
    return delay(mockGetOffcutOffers(params?.productId ?? '') as T)
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

  // Порядок важен: аудит проверяется ПЕРВЫМ, потому что оба пути начинаются одинаково.
  const movementAuditMatch = path.match(/^\/api\/warehouse\/movements\/([^/]+)\/audit$/)
  if (movementAuditMatch) {
    return delay(mockGetMovementAudit(movementAuditMatch[1] as string) as T)
  }

  const movementCardMatch = path.match(/^\/api\/warehouse\/movements\/([^/]+)$/)
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
          uomId: params?.uomId,
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
          uomId: params?.uomId,
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
  // Реестр входящих — представление над счетами заказов, своего хранилища у него
  // нет; исходящие платежи — самостоятельные записи. Поэтому и роута два.
  if (path === '/api/finance/receivables') {
    return delay(mockGetReceivables(parseFinanceListParams(params)) as T)
  }

  if (path === '/api/finance/payments') {
    return delay(mockGetPayments(parseFinanceListParams(params)) as T)
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
async function postMockRoute<T>(
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

  const orderAllocateMatch = path.match(/^\/api\/orders\/([^/]+)\/allocate-total$/)
  if (orderAllocateMatch) {
    const { targetGross, version } = body as { targetGross: number; version?: number }
    return delay(mockAllocateOrderTotal(orderAllocateMatch[1] as string, targetGross, version) as T)
  }

  const orderSplitMatch = path.match(/^\/api\/orders\/([^/]+)\/items\/([^/]+)\/split$/)
  if (orderSplitMatch) {
    const { shippedQuantity, version } = body as { shippedQuantity: number; version?: number }
    return delay(
      mockSplitOrderItem(
        orderSplitMatch[1] as string,
        orderSplitMatch[2] as string,
        shippedQuantity,
        version,
      ) as T,
    )
  }

  const orderCorrectMatch = path.match(/^\/api\/orders\/([^/]+)\/items\/([^/]+)\/correct$/)
  if (orderCorrectMatch) {
    return delay(
      mockCorrectOrderLine(
        orderCorrectMatch[1] as string,
        orderCorrectMatch[2] as string,
        body as { unitPrice?: number; unitCost?: number; reason?: string; version?: number },
      ) as T,
    )
  }

  const shipmentCancelMatch = path.match(/^\/api\/orders\/([^/]+)\/shipments\/([^/]+)\/cancel$/)
  if (shipmentCancelMatch) {
    return delay(
      mockCancelShipment(
        shipmentCancelMatch[1] as string,
        shipmentCancelMatch[2] as string,
        body as Parameters<typeof mockCancelShipment>[2],
      ) as T,
    )
  }

  // ── The two operations contract §3 calls mandatory ──
  // A shipment and a payment are the two POSTs that cost real money to repeat:
  // the same request twice gave two shipments, six units off the shelf for a
  // request about three, two 'sale' movements, and two payments of 500 adding up
  // to 1000. The only guard was a busy flag in the card, which is exactly what
  // §3 calls "not a guard". The order id is folded out of the path so the route
  // is named rather than pattern-matched, and the guard is visible on it.
  const orderRouteMatch = path.match(/^(\/api\/orders\/)([^/]+)(\/[^/]+)$/)
  if (orderRouteMatch) {
    const orderId = orderRouteMatch[2] as string
    const orderSubpath = `${orderRouteMatch[1]}:id${orderRouteMatch[3]}`
    if (orderSubpath === '/api/orders/:id/shipments') {
      return delay(
        withIdempotency(headers, () =>
          mockCreateShipment(orderId, body as Parameters<typeof mockCreateShipment>[1]),
        ) as T,
      )
    }
    if (orderSubpath === '/api/orders/:id/payments') {
      return delay(
        withIdempotency(headers, () =>
          mockAddOrderPayment(orderId, body as Parameters<typeof mockAddOrderPayment>[1]),
        ) as T,
      )
    }
    // A return moves the shelf and the documents exactly as a shipment does, so
    // it is the third operation that may not happen twice on one intent.
    if (orderSubpath === '/api/orders/:id/returns') {
      return delay(
        withIdempotency(headers, () =>
          mockCreateReturn(orderId, body as Parameters<typeof mockCreateReturn>[1]),
        ) as T,
      )
    }
  }

  const orderReserveMatch = path.match(/^\/api\/orders\/([^/]+)\/reserve$/)
  if (orderReserveMatch) {
    const { version } = (body ?? {}) as { version?: number }
    return delay(mockReserveOrder(orderReserveMatch[1] as string, version) as T)
  }

  const invoiceCreateMatch = path.match(/^\/api\/orders\/([^/]+)\/invoices$/)
  if (invoiceCreateMatch) {
    return delay(
      mockCreateInvoice(
        invoiceCreateMatch[1] as string,
        body as Parameters<typeof mockCreateInvoice>[1],
      ) as T,
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
    const { fileId, version } = body as { fileId: string; version?: number }
    const originalName = uploadedFiles.get(fileId)?.name
    return delay(
      mockAddOrderFile(orderFilesPostMatch[1] as string, fileId, originalName, version) as T,
    )
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
  if (path === '/api/settings/mail/test') return delay(mockSendMailTest() as T)

  throw new Error(`[mock] POST ${path} not found`)
}

// ─── PUT (bulk replace) ───
async function putMockRoute<T>(
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
  if (path === '/api/settings/warehouse-map') {
    return delay(mockSaveWarehouseMap(body as Parameters<typeof mockSaveWarehouseMap>[0]) as T)
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
async function patchMockRoute<T>(
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
    const { status, version } = body as {
      status: import('@/types/order').OrderStatus
      version?: number
    }
    return delay(mockPatchOrderStatus(orderStatusMatch[1] as string, status, version) as T)
  }

  const orderServiceUpdateMatch = path.match(/^\/api\/orders\/([^/]+)\/services\/([^/]+)$/)
  if (orderServiceUpdateMatch) {
    return delay(
      mockUpdateOrderService(
        orderServiceUpdateMatch[1] as string,
        orderServiceUpdateMatch[2] as string,
        body as Parameters<typeof mockUpdateOrderService>[2],
      ) as T,
    )
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
  if (path === '/api/settings/mail') {
    const result = mockPatchMail(body as Parameters<typeof mockPatchMail>[0])
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
        (fileId) => uploadedFiles.get(fileId),
      ) as T,
    )
  }

  throw new Error(`[mock] PATCH ${path} not found`)
}

// ─── DELETE ───
/**
 * A DELETE carries no body, so the version it is written against arrives as
 * `If-Match` — contract §3. Absent means the caller never read a version and is
 * making no claim about what it saw; the mock then checks nothing, exactly as it
 * does for a body without one.
 */
function ifMatchVersion(headers?: Record<string, string>): number | undefined {
  const raw = headers?.['If-Match'] ?? headers?.['if-match']
  if (raw === undefined) return undefined
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : undefined
}

async function deleteMockRoute<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const version = ifMatchVersion(headers)
  const auditMatch = path.match(/^\/api\/suppliers\/([^/]+)\/audit\/([^/]+)$/)
  if (auditMatch) {
    mockDeleteAuditEntry(auditMatch[1] as string, auditMatch[2] as string)
    return delay(undefined as T)
  }

  const stockAuditMatch = path.match(/^\/api\/warehouse\/stock\/([^/]+)\/audit\/([^/]+)$/)
  if (stockAuditMatch) {
    mockDeleteStockAuditEntry(stockAuditMatch[1] as string, stockAuditMatch[2] as string)
    return delay(undefined as T)
  }

  const batchAuditMatch = path.match(/^\/api\/warehouse\/batches\/([^/]+)\/audit\/([^/]+)$/)
  if (batchAuditMatch) {
    mockDeleteBatchAuditEntry(batchAuditMatch[1] as string, batchAuditMatch[2] as string)
    return delay(undefined as T)
  }

  const offcutAuditDeleteMatch = path.match(/^\/api\/warehouse\/offcuts\/([^/]+)\/audit\/([^/]+)$/)
  if (offcutAuditDeleteMatch) {
    mockDeleteOffcutAuditEntry(
      offcutAuditDeleteMatch[1] as string,
      offcutAuditDeleteMatch[2] as string,
    )
    return delay(undefined as T)
  }

  const movementAuditDeleteMatch = path.match(
    /^\/api\/warehouse\/movements\/([^/]+)\/audit\/([^/]+)$/,
  )
  if (movementAuditDeleteMatch) {
    mockDeleteMovementAuditEntry(
      movementAuditDeleteMatch[1] as string,
      movementAuditDeleteMatch[2] as string,
    )
    return delay(undefined as T)
  }

  const deficitAuditDeleteMatch = path.match(/^\/api\/warehouse\/deficit\/([^/]+)\/audit\/([^/]+)$/)
  if (deficitAuditDeleteMatch) {
    mockDeleteDeficitAuditEntry(
      deficitAuditDeleteMatch[1] as string,
      deficitAuditDeleteMatch[2] as string,
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

  const productAuditDeleteMatch = path.match(/^\/api\/products\/([^/]+)\/audit\/([^/]+)$/)
  if (productAuditDeleteMatch) {
    mockDeleteProductAuditEntry(
      productAuditDeleteMatch[1] as string,
      productAuditDeleteMatch[2] as string,
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
    // `await` здесь не украшение: без него `deleted` — это промис, он всегда
    // истинный, и проверка ниже не срабатывала НИКОГДА. Удаление несуществующей
    // услуги молча возвращало успех вместо ошибки. Нашло правило
    // no-unnecessary-condition, включённое 2026-08-26.
    const deleted = await mockDeleteService(serviceDeleteMatch[1] as string)
    if (!deleted) throw new Error('CATALOG_SERVICE_NOT_FOUND')
    return delay(undefined as T)
  }

  const clientDeleteMatch = path.match(/^\/api\/clients\/([^/]+)$/)
  if (clientDeleteMatch) {
    mockDeleteClient(clientDeleteMatch[1] as string)
    return delay(undefined as T)
  }

  const clientAuditDeleteMatch = path.match(/^\/api\/clients\/([^/]+)\/audit\/([^/]+)$/)
  if (clientAuditDeleteMatch) {
    mockDeleteClientAuditEntry(
      clientAuditDeleteMatch[1] as string,
      clientAuditDeleteMatch[2] as string,
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
    mockDeleteOrderItem(
      orderItemDeleteMatch[1] as string,
      orderItemDeleteMatch[2] as string,
      version,
    )
    return delay(undefined as T)
  }

  const paymentDeleteMatch = path.match(/^\/api\/orders\/([^/]+)\/payments\/([^/]+)$/)
  if (paymentDeleteMatch) {
    mockDeleteOrderPayment(
      paymentDeleteMatch[1] as string,
      paymentDeleteMatch[2] as string,
      version,
    )
    return delay(undefined as T)
  }

  const orderServiceDeleteMatch = path.match(/^\/api\/orders\/([^/]+)\/services\/([^/]+)$/)
  if (orderServiceDeleteMatch) {
    mockDeleteOrderService(
      orderServiceDeleteMatch[1] as string,
      orderServiceDeleteMatch[2] as string,
      version,
    )
    return delay(undefined as T)
  }

  const orderDeleteMatch = path.match(/^\/api\/orders\/([^/]+)$/)
  if (orderDeleteMatch) {
    mockDeleteOrder(orderDeleteMatch[1] as string, version)
    return delay(undefined as T)
  }

  // The entry is named, not counted. A position in a list that other people are
  // appending to and deleting from names a different record by the time the
  // request arrives — see contract §4.1.
  const orderAuditDeleteMatch = path.match(/^\/api\/orders\/([^/]+)\/audit\/([^/]+)$/)
  if (orderAuditDeleteMatch) {
    mockDeleteOrderAuditEntry(
      orderAuditDeleteMatch[1] as string,
      orderAuditDeleteMatch[2] as string,
      version,
    )
    return delay(undefined as T)
  }

  const orderFileDeleteMatch = path.match(/^\/api\/orders\/([^/]+)\/files\/([^/]+)$/)
  if (orderFileDeleteMatch) {
    mockRemoveOrderFile(
      orderFileDeleteMatch[1] as string,
      orderFileDeleteMatch[2] as string,
      version,
    )
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
  if (path === '/api/settings/warehouse-map') {
    mockDeleteWarehouseMap()
    return delay(undefined as T)
  }

  throw new Error(`[mock] DELETE ${path} not found`)
}

// ─── UPLOAD ───
async function uploadMockRoute<T>(path: string, file: File): Promise<T> {
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

// ─── Точки входа: один счётчик на все шесть ─────────────────────────────────
// Имена и подписи те же, что были: `services/api.ts` их и вызывает.

export async function getMock<T>(path: string, params?: Record<string, string>): Promise<T> {
  return dispatch(() => getMockRoute<T>(path, params))
}

export async function postMock<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  return dispatch(() => postMockRoute<T>(path, body, headers))
}

export async function putMock<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  return dispatch(() => putMockRoute<T>(path, body, headers))
}

export async function patchMock<T>(
  path: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  return dispatch(() => patchMockRoute<T>(path, body, headers))
}

export async function deleteMock<T>(path: string, headers?: Record<string, string>): Promise<T> {
  return dispatch(() => deleteMockRoute<T>(path, headers))
}

export async function uploadMock<T>(path: string, file: File): Promise<T> {
  return dispatch(() => uploadMockRoute<T>(path, file))
}
