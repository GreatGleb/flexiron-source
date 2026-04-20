import { apiGet } from './api'
import type { AnalyticsPageKey, DashboardData } from '@/types/analytics'

export async function getAnalyticsPage(page: AnalyticsPageKey): Promise<DashboardData> {
  return apiGet<DashboardData>(`/api/analytics/${page}`)
}
