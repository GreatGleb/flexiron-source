import { reactive } from 'vue'
import type { FeatureFlags, FeatureFlagKey } from '@/types/features'

const defaults: FeatureFlags = {
  // Page-level flags
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

  // Section-level flags
  dashboardAlerts: true,
  dashboardCharts: true,
  supplierKanbanView: true,
  supplierExport: true,
  bccHistory: true,
  permissionsEditor: true,
  categoryFieldReorder: true,
  categorySupplierLinks: true,
  productSupplierLinks: true,

  // Warehouse section-level flags
  warehouseOffcuts: true,
  warehouseDeficit: true,
  warehouseQrPrint: true,
  // Карта склада — отдельная страница с картинкой (не вкладка складских таблиц)
  warehouseMap: true,

  // Warehouse per-tab page config flags (disabled by default — in development)
  warehouseStockPageConfig: false,
  warehouseBatchesPageConfig: false,
  warehouseOffcutsPageConfig: false,
  warehouseMovementsPageConfig: false,
  warehouseDeficitPageConfig: false,

  // Warehouse offcut create page
  // Orders section-level flags
  orderKanbanView: false,
  orderDocumentGen: true,
  orderCuttingTool: false,

  // Order pricing rework. The corrected calculation itself is NOT behind a flag —
  // a wrong total is not a feature anybody opts into. These two are new
  // capabilities and stay switchable, like every other section of the app.
  orderShipments: true,
  orderInvoicesPayments: true,
  // Partial returns: the return document, the header badge, the marked lines and
  // the net-amount rows. The statuses are NOT behind it — a status list that is
  // missing values is not a feature anybody opts into.
  orderReturns: true,

  warehouseOffcutCreate: true,

  // Notifications
  notificationsPage: true,

  // Finance page-level flags
  adminFinance: true,
  financeIncoming: true,
  financeOutgoing: true,
  financeDocumentArchive: true,
}

function loadOverrides(): Partial<FeatureFlags> {
  try {
    const raw = localStorage.getItem('ff_overrides')
    return raw ? (JSON.parse(raw) as Partial<FeatureFlags>) : {}
  } catch {
    return {}
  }
}

export const featureFlags = reactive<FeatureFlags>({
  ...defaults,
  ...loadOverrides(),
})

export function isEnabled(flag: FeatureFlagKey): boolean {
  return featureFlags[flag] ?? false
}
