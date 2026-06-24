import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getServices, deleteService as deleteServiceApi } from '@/services/servicesService'
import { usePagination } from './usePagination'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type { ServiceListItem, ServiceFilters } from '@/types/service'

export function useServices() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const items = ref<ServiceListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<ServiceFilters>({ search: '', sortBy: 'name', sortDir: 'asc' })
  const pagination = usePagination(25)

  let initialized = false

  async function load() {
    if (!initialized) loading.value = true
    error.value = null
    try {
      const res = await getServices(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      items.value = res.items
      pagination.total.value = res.total
      initialized = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load services'
    } finally {
      loading.value = false
    }
  }

  async function deleteService(id: string) {
    try {
      await deleteServiceApi(id)
      toast.success(t('services.toast_deleted'))
      await load()
    } catch {
      toast.error(t('services.toast_error_delete'))
    }
  }

  // Flag: prevents page watch from double-firing when filters reset page to 1
  let skipNextPageWatch = false

  watch(
    filters,
    () => {
      skipNextPageWatch = pagination.page.value !== 1
      pagination.reset()
      load()
    },
    { deep: true },
  )

  watch([pagination.page, pagination.pageSize], () => {
    if (skipNextPageWatch) {
      skipNextPageWatch = false
      return
    }
    load()
  })

  function toggleSort(col: ServiceFilters['sortBy']) {
    if (filters.sortBy === col) {
      filters.sortDir = filters.sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      filters.sortBy = col
      filters.sortDir = 'asc'
    }
  }

  return {
    items,
    loading,
    error,
    filters,
    pagination,
    load,
    deleteService,
    toggleSort,
    tf,
  }
}
