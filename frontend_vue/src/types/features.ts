export interface FeatureFlags {
  // Page-level flags
  adminDashboard: boolean
  adminWarehouse: boolean
  adminSales: boolean
  adminSupply: boolean
  adminStaff: boolean
  adminLogistics: boolean
  adminPlReport: boolean
  adminDeficit: boolean
  suppliersList: boolean
  supplierCard: boolean
  supplierCreate: boolean
  supplierCardConfig: boolean
  bccRequest: boolean
  adminCategories: boolean
  adminProducts: boolean
  adminServices: boolean

  // Section-level flags
  dashboardAlerts: boolean
  dashboardCharts: boolean
  supplierKanbanView: boolean
  supplierExport: boolean
  bccHistory: boolean
  permissionsEditor: boolean
  categoryFieldReorder: boolean
  categorySupplierLinks: boolean
  productSupplierLinks: boolean

  // Warehouse section-level flags
  warehouseOffcuts: boolean
  warehouseDeficit: boolean
  warehouseQrPrint: boolean

  // Warehouse per-tab page config flags
  warehouseStockPageConfig: boolean
  warehouseBatchesPageConfig: boolean
  warehouseOffcutsPageConfig: boolean
  warehouseMovementsPageConfig: boolean
  warehouseDeficitPageConfig: boolean
}

export type FeatureFlagKey = keyof FeatureFlags
