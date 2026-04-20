import { ref, reactive, watch } from 'vue'
import { getSuppliers, patchSupplierStatus } from '@/services/suppliersService'
import { usePagination } from './usePagination'
import type { Supplier, SupplierFilters } from '@/types/supplier'

export function useSuppliers() {
  const suppliers = ref<Supplier[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filters = reactive<SupplierFilters>({
    search: '',
    status: 'all',
    categories: [],
    rating: 0,
  })

  const pagination = usePagination(25)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await getSuppliers(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      suppliers.value = res.items
      pagination.total.value = res.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load suppliers'
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    filters.search = ''
    filters.status = 'all'
    filters.categories = []
    filters.rating = 0
    pagination.reset()
  }

  async function changeStatus(id: string, status: string) {
    // Reactive update first — otherwise mocks mutate the underlying object directly,
    // and Vue's proxy sees identical value afterwards and skips the rerender.
    const s = suppliers.value.find((sup) => sup.id === id)
    if (s) s.status = status as Supplier['status']
    await patchSupplierStatus(id, status)
  }

  // Flag: prevents page watch from double-firing when filters reset page to 1
  let skipNextPageWatch = false

  // Reload when filters change — always call load once
  watch(
    () => [filters.search, filters.status, [...filters.categories], filters.rating],
    () => {
      // If page > 1, reset() will change page → page watch will fire → mark to skip it
      skipNextPageWatch = pagination.page.value !== 1
      pagination.reset()
      load()
    },
    { deep: true },
  )

  // Reload on manual page/pageSize navigation (skip if triggered by filter reset)
  watch([pagination.page, pagination.pageSize], () => {
    if (skipNextPageWatch) {
      skipNextPageWatch = false
      return
    }
    load()
  })

  return { suppliers, loading, error, filters, pagination, load, resetFilters, changeStatus }
}
