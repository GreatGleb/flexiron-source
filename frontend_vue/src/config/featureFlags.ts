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

  // Section-level flags
  dashboardAlerts: true,
  dashboardCharts: true,
  supplierKanbanView: true,
  supplierExport: true,
  bccHistory: true,
  permissionsEditor: true,
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
