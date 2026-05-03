import { apiGet } from './api'
import type { AnalyticsPageKey, DashboardData } from '@/types/analytics'

/**
 * Legacy function — fetches analytics data with raw (untranslated) strings.
 * Kept for backward compatibility with pages not yet migrated.
 */
export async function getAnalyticsPage(page: AnalyticsPageKey): Promise<DashboardData> {
  return apiGet<DashboardData>(`/api/analytics/${page}`)
}

/**
 * New function — fetches analytics data where all user-facing string fields
 * are TranslatedString ({ ru, en, lt }). The server returns all language
 * variants, and the frontend picks the right one based on current locale.
 *
 * Use with useAnalyticsTranslated() composable.
 */
export async function getAnalyticsPageTranslated(page: AnalyticsPageKey): Promise<DashboardData> {
  return apiGet<DashboardData>(`/api/analytics/${page}`)
}
