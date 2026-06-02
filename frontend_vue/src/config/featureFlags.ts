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

  // Warehouse per-tab page config flags (disabled by default — in development)
  warehouseStockPageConfig: false,
  warehouseBatchesPageConfig: false,
  warehouseOffcutsPageConfig: false,
  warehouseMovementsPageConfig: false,
  warehouseDeficitPageConfig: false,

  // Warehouse offcut create page
  warehouseOffcutCreate: true,
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
