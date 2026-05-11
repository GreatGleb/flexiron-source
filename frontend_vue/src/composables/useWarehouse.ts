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
  deleteStockItem as deleteStockItemApi,
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
  StockFilters,
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

  // Shared filters (for batches, offcuts, movements, deficit)
  const filters = reactive<WarehouseFilters>({
    search: '',
    dateFrom: '',
    dateTo: '',
  })

  // Stock-specific filters (server-side)
  const stockFilters = reactive<StockFilters>({
    search: '',
    categoryIds: [],
    unit: '',
    showDeficitOnly: false,
    showInStockOnly: false,
    sortBy: null,
    sortDir: 'asc',
  })

  const pagination = usePagination(25)

  // Per-tab initialized flags — each tab controls its own loading state independently
  const stockInitialized = ref(false)
  const batchesInitialized = ref(false)
  const offcutsInitialized = ref(false)
  const movementsInitialized = ref(false)
  const deficitInitialized = ref(false)

  async function loadStock() {
    if (!stockInitialized.value) stockLoading.value = true
    stockError.value = null
    try {
      const res = await getStockOverview(stockFilters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      stockItems.value = res.items
      pagination.total.value = res.total
      stockInitialized.value = true
    } catch (e) {
      stockError.value = e instanceof Error ? e.message : 'Failed to load stock overview'
    } finally {
      stockLoading.value = false
    }
  }

  async function loadBatches() {
    if (!batchesInitialized.value) batchesLoading.value = true
    batchesError.value = null
    try {
      const res = await getBatches(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      batches.value = res.items
      pagination.total.value = res.total
      batchesInitialized.value = true
    } catch (e) {
      batchesError.value = e instanceof Error ? e.message : 'Failed to load batches'
    } finally {
      batchesLoading.value = false
    }
  }

  async function loadOffcuts() {
    if (!offcutsInitialized.value) offcutsLoading.value = true
    offcutsError.value = null
    try {
      const res = await getOffcuts(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      offcuts.value = res.items
      pagination.total.value = res.total
      offcutsInitialized.value = true
    } catch (e) {
      offcutsError.value = e instanceof Error ? e.message : 'Failed to load offcuts'
    } finally {
      offcutsLoading.value = false
    }
  }

  async function loadMovements() {
    if (!movementsInitialized.value) movementsLoading.value = true
    movementsError.value = null
    try {
      const res = await getMovements(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      movements.value = res.items
      pagination.total.value = res.total
      movementsInitialized.value = true
    } catch (e) {
      movementsError.value = e instanceof Error ? e.message : 'Failed to load movements'
    } finally {
      movementsLoading.value = false
    }
  }

  async function loadDeficit() {
    if (!deficitInitialized.value) deficitLoading.value = true
    deficitError.value = null
    try {
      const res = await getDeficitList(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      deficitItems.value = res.items
      pagination.total.value = res.total
      deficitInitialized.value = true
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

  async function deleteStock(id: string) {
    try {
      await deleteStockItemApi(id)
      toast.success(t('warehouse.toast_stock_deleted'))
      await loadStock()
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

  // Watch stock filters — reload stock tab
  watch(stockFilters, () => {
    skipNextPageWatch = pagination.page.value !== 1
    pagination.reset()
    loadStock()
  }, { deep: true })

  function toggleStockSort(col: StockFilters['sortBy']) {
    if (stockFilters.sortBy === col) {
      stockFilters.sortDir = stockFilters.sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      stockFilters.sortBy = col
      stockFilters.sortDir = 'asc'
    }
  }

  watch([pagination.page, pagination.pageSize], () => {
    if (skipNextPageWatch) {
      skipNextPageWatch = false
      return
    }
    load()
  })

  // Reload when tab changes — reset all per-tab initialized flags so loading state shows again
  watch(activeTab, () => {
    stockInitialized.value = false
    batchesInitialized.value = false
    offcutsInitialized.value = false
    movementsInitialized.value = false
    deficitInitialized.value = false
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
    stockFilters,
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
    deleteStock,
    toggleStockSort,
    tf,
  }
}
