import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getCategories, deleteCategory as deleteCategoryApi } from '@/services/categoriesService'
import { usePagination } from './usePagination'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type { CategoryListItem, CategoryFilters } from '@/types/category'

export function useCategories() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const items = ref<CategoryListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<CategoryFilters>({ search: '' })
  const pagination = usePagination(25)

  let initialized = false

  async function load() {
    if (!initialized) loading.value = true
    error.value = null
    try {
      const res = await getCategories(filters, pagination.page.value, pagination.pageSize.value)
      items.value = res.items
      pagination.total.value = res.total
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

  return { items, loading, error, filters, pagination, load, deleteCategory, tf }
}
