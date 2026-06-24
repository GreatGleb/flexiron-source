import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import { usePagination } from '@/composables/usePagination'
import { getOrders, deleteOrder } from '@/services/ordersService'
import type { OrderListItem, OrderFilters } from '@/types/order'

export function useOrders() {
  const { t } = useI18n()
  const toast = useToast()
  const items = ref<OrderListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<OrderFilters>({
    search: '',
    status: 'all',
    clientId: null,
    dateFrom: '',
    dateTo: '',
    sortBy: null,
    sortDir: 'asc',
  })
  const pagination = usePagination()
  const { page, pageSize, total } = pagination

  let initialized = false

  async function load() {
    if (!initialized) loading.value = true
    error.value = null
    try {
      const result = await getOrders(filters, { page: page.value, pageSize: pageSize.value })
      items.value = result.items
      total.value = result.total
      initialized = true
    } catch (e) {
      error.value = String(e)
    } finally {
      loading.value = false
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteOrder(id)
      toast.success(t('orders.toast_deleted'))
      await load()
    } catch (e) {
      const msg = String(e)
      if (msg.includes('ORDER_HAS_SHIPMENTS')) {
        toast.error(t('orders.toast_error_delete_conflict'))
      } else {
        toast.error(t('orders.toast_error_delete'))
      }
    }
  }

  function toggleSort(col: string) {
    if (filters.sortBy === col) {
      filters.sortDir = filters.sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      filters.sortBy = col
      filters.sortDir = 'asc'
    }
  }

  // ─── Flag: prevents page watch from double-firing when filters reset page to 1 ──
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

  watch([page, pageSize], () => {
    if (skipNextPageWatch) {
      skipNextPageWatch = false
      return
    }
    load()
  })

  return {
    items,
    loading,
    error,
    filters,
    pagination,
    page,
    pageSize,
    total,
    load,
    handleDelete,
    toggleSort,
  }
}
