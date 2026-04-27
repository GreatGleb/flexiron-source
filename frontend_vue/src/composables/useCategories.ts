import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getCategories,
  deleteCategory as deleteCategoryApi,
} from '@/services/categoriesService'
import { useToast } from './useToast'
import type { CategoryListItem, CategoryFilters } from '@/types/category'

export function useCategories() {
  const { t } = useI18n()
  const toast = useToast()

  const items = ref<CategoryListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<CategoryFilters>({ search: '' })

  let initialized = false

  async function load() {
    if (!initialized) loading.value = true
    error.value = null
    try {
      const res = await getCategories(filters)
      items.value = res.items
      initialized = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load categories'
    } finally {
      loading.value = false
    }
  }

  async function deleteCategory(id: string) {
    try {
      await deleteCategoryApi(id)
      toast.success(t('categories.toast_deleted'))
      await load()
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      if (code === 'CATEGORY_HAS_PRODUCTS') {
        toast.error(t('categories.toast_error_delete_has_products'))
      } else if (code === 'CATEGORY_HAS_CHILDREN') {
        toast.error(t('categories.toast_error_delete_has_children'))
      } else {
        toast.error(t('categories.toast_error'))
      }
    }
  }

  watch(filters, load, { deep: true })

  return { items, loading, error, filters, load, deleteCategory }
}
