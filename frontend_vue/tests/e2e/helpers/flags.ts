import type { BrowserContext, Page } from '@playwright/test'
import type { FeatureFlags } from '@/types/features'
import { waitForDataReady } from './ready'

/**
 * ALL feature flags from src/config/featureFlags.ts, all ON.
 *
 * MAINTENANCE: when you add/rename a flag in featureFlags.ts, update this list.
 * Tests rely on this to force every guarded section/page visible so regressions
 * in prod-hidden areas are caught.
 */
export const ALL_FLAGS_ENABLED: FeatureFlags = {
  // Page-level
  adminDashboard: true,
  adminWarehouse: true,
  adminSales: true,
  adminSupply: true,
  adminStaff: true,
  adminLogistics: true,
  adminPlReport: true,
  adminDeficit: true,
  suppliersList: true,
  supplierCard: true,
  supplierCreate: true,
  supplierCardConfig: true,
  bccRequest: true,
  adminCategories: true,
  adminProducts: true,
  adminServices: true,
  adminClients: true,
  adminOrders: true,
  adminSalesCrm: true,
  adminSettings: true,
  settingsAuditLog: true,

  // Section-level
  dashboardAlerts: true,
  dashboardCharts: true,
  supplierKanbanView: true,
  supplierExport: true,
  bccHistory: true,
  permissionsEditor: true,
  categoryFieldReorder: true,
  categorySupplierLinks: true,
  productSupplierLinks: true,

  // Order pricing rework — shipments and invoices/payments. The financial panel
  // and line editing ship unflagged.
  orderShipments: true,
  orderInvoicesPayments: true,
  orderReturns: true,

  // Notifications
  notificationsPage: true,

  // Warehouse map — its own page, not one of the warehouse table tabs
  warehouseMap: true,

  // Metal cutting — the operation that turns a batch into offcuts, kerf and waste
  warehouseCutting: true,

  // Warehouse tabs and their operations
  warehouseOffcuts: true,
  warehouseDeficit: true,
  warehouseOffcutCreate: true,
  warehouseQrPrint: true,

  // Per-tab column configurators. ВСЕ ПЯТЬ по умолчанию false — до 2026-08-25 их
  // не было в этом списке, значит ни один e2e-тест этот UI никогда не открывал.
  warehouseStockPageConfig: true,
  warehouseBatchesPageConfig: true,
  warehouseOffcutsPageConfig: true,
  warehouseMovementsPageConfig: true,
  warehouseDeficitPageConfig: true,

  // Заказы. orderKanbanView и orderCuttingTool по умолчанию false — та же история.
  orderKanbanView: true,
  orderCuttingTool: true,
  orderDocumentGen: true,

  // Финансы — модуль целиком отсутствовал в списке
  adminFinance: true,
  financeIncoming: true,
  financeOutgoing: true,
  financeDocumentArchive: true,
}

/** Writes ALL_FLAGS_ENABLED to localStorage before every page in this context loads. */
export async function enableAllFlags(context: BrowserContext) {
  await context.addInitScript((flags) => {
    localStorage.setItem('ff_overrides', JSON.stringify(flags))
  }, ALL_FLAGS_ENABLED)
}

/**
 * Flips one flag for the rest of this page's life, and reloads so it takes hold.
 *
 * Registered as an init script, not written straight into localStorage: the
 * context script from `enableAllFlags` re-runs before every load and would put
 * every flag back to true on the reload. Page init scripts run after context
 * ones, so this one has the last word.
 */
export async function setFlag(page: Page, flag: string, value: boolean) {
  await page.addInitScript(
    ({ f, v }) => {
      const existing = JSON.parse(localStorage.getItem('ff_overrides') || '{}')
      existing[f] = v
      localStorage.setItem('ff_overrides', JSON.stringify(existing))
    },
    { f: flag, v: value },
  )
  await page.reload()
  await waitForDataReady(page)
}
