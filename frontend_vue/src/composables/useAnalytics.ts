import { ref } from 'vue'
import { getAnalyticsPage, getAnalyticsPageTranslated } from '@/services/analyticsService'
import type { AnalyticsPageKey, DashboardData } from '@/types/analytics'
import { useTranslatedField } from './useTranslatedData'

/**
 * Legacy composable — fetches analytics data with raw (untranslated) strings.
 * Kept for backward compatibility with pages not yet migrated.
 */
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

/**
 * New composable — fetches analytics data where all user-facing string fields
 * are TranslatedString ({ ru, en, lt }). Provides a `tf()` helper to
 * reactively pick the right language based on current vue-i18n locale.
 *
 * When the user switches language, all `tf()` calls update instantly
 * without re-fetching data from the API.
 */
export function useAnalyticsTranslated(page: AnalyticsPageKey) {
  const data = ref<DashboardData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { tf } = useTranslatedField()

  async function load() {
    loading.value = true
    error.value = null
    try {
      data.value = await getAnalyticsPageTranslated(page)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load analytics'
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, load, tf }
}
