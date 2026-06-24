import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProducts, deleteProduct as deleteProductApi } from '@/services/productsService'
import { usePagination } from './usePagination'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type { ProductListItem, ProductFilters } from '@/types/product'

export function useProducts() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const items = ref<ProductListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<ProductFilters>({
    search: '',
    categoryIds: [],
    sortBy: null,
    sortDir: 'asc',
  })
  const pagination = usePagination(25)

  let initialized = false

  async function load() {
    if (!initialized) loading.value = true
    error.value = null
    try {
      const res = await getProducts(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      items.value = res.items
      pagination.total.value = res.total
      initialized = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load products'
    } finally {
      loading.value = false
    }
  }

  async function deleteProduct(id: string) {
    try {
      await deleteProductApi(id)
      toast.success(t('products.toast_deleted'))
      await load()
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      if (code === 'PRODUCT_IN_USE') {
        toast.error(t('products.toast_error_delete_in_use'))
      } else {
        toast.error(t('products.toast_error_delete'))
      }
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

  function toggleSort(col: 'name' | 'category' | 'price') {
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
    deleteProduct,
    toggleSort,
    tf,
  }
}
