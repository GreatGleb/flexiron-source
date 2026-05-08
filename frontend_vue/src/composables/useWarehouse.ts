import { ref, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getStockOverview,
  getBatches,
  getOffcuts,
  getMovements,
  getDeficitList,
  deleteBatch as deleteBatchApi,
  deleteOffcut as deleteOffcutApi,
  deleteDeficitItem as deleteDeficitItemApi,
} from '@/services/warehouseService'
import { usePagination } from './usePagination'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type {
  StockOverviewItem,
  BatchListItem,
  OffcutListItem,
  MovementListItem,
  DeficitListItem,
  WarehouseFilters,
} from '@/types/warehouse'

export type WarehouseTab = 'stock' | 'batches' | 'offcuts' | 'movements' | 'deficit'

export function useWarehouse() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const activeTab = ref<WarehouseTab>('stock')

  // Stock overview
  const stockItems = ref<StockOverviewItem[]>([])
  const stockLoading = ref(false)
  const stockError = ref<string | null>(null)

  // Batches
  const batches = ref<BatchListItem[]>([])
  const batchesLoading = ref(false)
  const batchesError = ref<string | null>(null)

  // Offcuts
  const offcuts = ref<OffcutListItem[]>([])
  const offcutsLoading = ref(false)
  const offcutsError = ref<string | null>(null)

  // Movements
  const movements = ref<MovementListItem[]>([])
  const movementsLoading = ref(false)
  const movementsError = ref<string | null>(null)

  // Deficit
  const deficitItems = ref<DeficitListItem[]>([])
  const deficitLoading = ref(false)
  const deficitError = ref<string | null>(null)

  // Shared filters
  const filters = reactive<WarehouseFilters>({
    search: '',
    dateFrom: '',
    dateTo: '',
  })

  const pagination = usePagination(25)

  let initialized = false

  async function loadStock() {
    stockLoading.value = true
    stockError.value = null
    try {
      const res = await getStockOverview()
      stockItems.value = res
    } catch (e) {
      stockError.value = e instanceof Error ? e.message : 'Failed to load stock overview'
    } finally {
      stockLoading.value = false
    }
  }

  async function loadBatches() {
    if (!initialized) batchesLoading.value = true
    batchesError.value = null
    try {
      const res = await getBatches(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      batches.value = res.items
      pagination.total.value = res.total
      initialized = true
    } catch (e) {
      batchesError.value = e instanceof Error ? e.message : 'Failed to load batches'
    } finally {
      batchesLoading.value = false
    }
  }

  async function loadOffcuts() {
    if (!initialized) offcutsLoading.value = true
    offcutsError.value = null
    try {
      const res = await getOffcuts(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      offcuts.value = res.items
      pagination.total.value = res.total
      initialized = true
    } catch (e) {
      offcutsError.value = e instanceof Error ? e.message : 'Failed to load offcuts'
    } finally {
      offcutsLoading.value = false
    }
  }

  async function loadMovements() {
    if (!initialized) movementsLoading.value = true
    movementsError.value = null
    try {
      const res = await getMovements(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      movements.value = res.items
      pagination.total.value = res.total
      initialized = true
    } catch (e) {
      movementsError.value = e instanceof Error ? e.message : 'Failed to load movements'
    } finally {
      movementsLoading.value = false
    }
  }

  async function loadDeficit() {
    if (!initialized) deficitLoading.value = true
    deficitError.value = null
    try {
      const res = await getDeficitList(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      deficitItems.value = res.items
      pagination.total.value = res.total
      initialized = true
    } catch (e) {
      deficitError.value = e instanceof Error ? e.message : 'Failed to load deficit list'
    } finally {
      deficitLoading.value = false
    }
  }

  const tabLoaders: Record<WarehouseTab, () => Promise<void>> = {
    stock: loadStock,
    batches: loadBatches,
    offcuts: loadOffcuts,
    movements: loadMovements,
    deficit: loadDeficit,
  }

  async function load() {
    await tabLoaders[activeTab.value]()
  }

  async function deleteBatch(id: string) {
    try {
      await deleteBatchApi(id)
      toast.success(t('warehouse.toast_batch_deleted'))
      await loadBatches()
    } catch {
      toast.error(t('warehouse.toast_error'))
    }
  }

  async function deleteOffcut(id: string) {
    try {
      await deleteOffcutApi(id)
      toast.success(t('warehouse.toast_offcut_deleted'))
      await loadOffcuts()
    } catch {
      toast.error(t('warehouse.toast_error'))
    }
  }

  async function deleteDeficit(id: string) {
    try {
      await deleteDeficitItemApi(id)
      toast.success(t('warehouse.toast_deficit_deleted'))
      await loadDeficit()
    } catch {
      toast.error(t('warehouse.toast_error'))
    }
  }

  // Flag: prevents page watch from double-firing when filters reset page to 1
  let skipNextPageWatch = false

  watch(filters, () => {
    skipNextPageWatch = pagination.page.value !== 1
    pagination.reset()
    load()
  }, { deep: true })

  watch([pagination.page, pagination.pageSize], () => {
    if (skipNextPageWatch) {
      skipNextPageWatch = false
      return
    }
    load()
  })

  // Reload when tab changes
  watch(activeTab, () => {
    initialized = false
    pagination.reset()
    load()
  })

  return {
    // State
    activeTab,
    stockItems, stockLoading, stockError,
    batches, batchesLoading, batchesError,
    offcuts, offcutsLoading, offcutsError,
    movements, movementsLoading, movementsError,
    deficitItems, deficitLoading, deficitError,
    filters,
    pagination,

    // Actions
    load,
    loadStock,
    loadBatches,
    loadOffcuts,
    loadMovements,
    loadDeficit,
    deleteBatch,
    deleteOffcut,
    deleteDeficit,
    tf,
  }
}
