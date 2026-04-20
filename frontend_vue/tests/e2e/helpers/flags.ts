import type { BrowserContext, Page } from '@playwright/test'

/**
 * ALL feature flags from src/config/featureFlags.ts, all ON.
 *
 * MAINTENANCE: when you add/rename a flag in featureFlags.ts, update this list.
 * Tests rely on this to force every guarded section/page visible so regressions
 * in prod-hidden areas are caught.
 */
export const ALL_FLAGS_ENABLED = {
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

  // Section-level
  dashboardAlerts: true,
  dashboardCharts: true,
  supplierKanbanView: true,
  supplierExport: true,
  bccHistory: true,
  permissionsEditor: true,
} as const

/** Writes ALL_FLAGS_ENABLED to localStorage before every page in this context loads. */
export async function enableAllFlags(context: BrowserContext) {
  await context.addInitScript((flags) => {
    localStorage.setItem('ff_overrides', JSON.stringify(flags))
  }, ALL_FLAGS_ENABLED)
}

/** Override a single flag for one test (requires page.reload() after). */
export async function setFlag(page: Page, flag: string, value: boolean) {
  await page.evaluate(
    ({ f, v }) => {
      const existing = JSON.parse(localStorage.getItem('ff_overrides') || '{}')
      existing[f] = v
      localStorage.setItem('ff_overrides', JSON.stringify(existing))
    },
    { f: flag, v: value },
  )
  await page.reload()
  await page.waitForLoadState('networkidle')
}
