import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProducts, deleteProduct as deleteProductApi } from '@/services/productsService'
import { useToast } from './useToast'
import type { ProductListItem, ProductFilters } from '@/types/product'

export function useProducts() {
  const { t } = useI18n()
  const toast = useToast()

  const items = ref<ProductListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<ProductFilters>({ search: '', categoryId: null })

  let initialized = false

  async function load() {
    if (!initialized) loading.value = true
    error.value = null
    try {
      const res = await getProducts(filters)
      items.value = res.items
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
    } catch {
      toast.error(t('products.toast_error_delete'))
    }
  }

  watch(filters, load, { deep: true })

  return { items, loading, error, filters, load, deleteProduct }
}
