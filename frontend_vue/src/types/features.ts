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

  // Section-level flags
  dashboardAlerts: boolean
  dashboardCharts: boolean
  supplierKanbanView: boolean
  supplierExport: boolean
  bccHistory: boolean
  permissionsEditor: boolean
}

export type FeatureFlagKey = keyof FeatureFlags
