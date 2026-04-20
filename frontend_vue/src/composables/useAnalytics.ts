import { ref } from 'vue'
import { getAnalyticsPage } from '@/services/analyticsService'
import type { AnalyticsPageKey, DashboardData } from '@/types/analytics'

export function useAnalytics(page: AnalyticsPageKey) {
  const data = ref<DashboardData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await getAnalyticsPage(page)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load analytics'
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load }
}
