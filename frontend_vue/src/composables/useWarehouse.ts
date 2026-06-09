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
  patchDeficitItem as patchDeficitItemApi,
  patchOffcut as patchOffcutApi,
  createMovement as createMovementApi,
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
  DeficitPriority,
  DeficitStatus,
  WarehouseFilters,
  StockFilters,
  OffcutStatus,
  MovementType,
} from '@/types/warehouse'

export type WarehouseTab = 'stock' | 'batches' | 'offcuts' | 'movements' | 'deficit'

export function useWarehouse() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const activeTab = ref<WarehouseTab>('stock')

  // ─── Modal state ──────────────────────────────────────────────────────────────
  // DEPRECATED: const showCreateBatchModal = ref(false) — batch creation moved to WarehouseBatchCreatePage
  // DEPRECATED: const showCreateMovementModal = ref(false) — movement creation removed from UI
  const showCreateOffcutModal = ref(false)

  // DEPRECATED: onBatchCreated() — batch creation moved to WarehouseBatchCreatePage
  // function onBatchCreated() {
  //   showCreateBatchModal.value = false
  //   loadBatches()
  // }

  // DEPRECATED: onMovementCreated() — movement creation removed from UI

  function onOffcutCreated() {
    showCreateOffcutModal.value = false
    loadOffcuts()
  }

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

  // Shared filters (for offcuts, movements, deficit)
  const filters = reactive<WarehouseFilters>({
    search: '',
    dateFrom: '',
    dateTo: '',
  })

  // Batches-specific filters (server-side)
  const batchesFilters = reactive<WarehouseFilters>({
    search: '',
    productId: undefined,
    status: undefined,
    supplierId: undefined,
    unit: '',
    dateFrom: '',
    dateTo: '',
    sortBy: undefined,
    sortDir: 'asc',
  })

  // Offcuts-specific filters (server-side)
  const offcutFilters = reactive<WarehouseFilters>({
    search: '',
    status: undefined,
    unit: '',
    offcutType: undefined,
    productId: undefined,
    categoryIds: [],
    batchNumber: undefined,
    sortBy: undefined,
    sortDir: 'asc',
  })

  // Movements-specific filters (server-side)
  const movementFilters = reactive<WarehouseFilters>({
    search: '',
    type: undefined,
    unit: '',
    categoryIds: [],
    batchNumber: undefined,
    dateFrom: '',
    dateTo: '',
    sortBy: undefined,
    sortDir: 'asc',
  })

  // Deficit-specific filters (server-side)
  const deficitFilters = reactive<WarehouseFilters>({
    search: '',
    status: undefined,
    priority: undefined,
    unit: '',
    categoryIds: [],
    sortBy: undefined,
    sortDir: 'asc',
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

  // Batches-specific sort state
  const batchesSort = reactive<{ sortBy: string | null; sortDir: 'asc' | 'desc' }>({
    sortBy: null,
    sortDir: 'asc',
  })

  // Offcuts-specific sort state
  const offcutsSort = reactive<{ sortBy: string | null; sortDir: 'asc' | 'desc' }>({
    sortBy: null,
    sortDir: 'asc',
  })

  // Movements-specific sort state — default: newest first by date
  const movementsSort = reactive<{ sortBy: string | null; sortDir: 'asc' | 'desc' }>({
    sortBy: 'movedAt',
    sortDir: 'desc',
  })

  // Deficit-specific sort state
  const deficitSort = reactive<{ sortBy: string | null; sortDir: 'asc' | 'desc' }>({
    sortBy: null,
    sortDir: 'asc',
  })

  // ─── Separate pagination per tab ──────────────────────────────────────────
  const stockPagination = usePagination(25)
  const batchesPagination = usePagination(25)
  const offcutsPagination = usePagination(25)
  const movementsPagination = usePagination(25)
  const deficitPagination = usePagination(25)

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
        page: stockPagination.page.value,
        pageSize: stockPagination.pageSize.value,
      })
      stockItems.value = res.items
      stockPagination.total.value = res.total
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
      const batchFilters: WarehouseFilters = {
        ...batchesFilters,
        sortBy: batchesSort.sortBy ?? undefined,
        sortDir: batchesSort.sortDir,
      }
      const res = await getBatches(batchFilters, {
        page: batchesPagination.page.value,
        pageSize: batchesPagination.pageSize.value,
      })
      batches.value = res.items
      batchesPagination.total.value = res.total
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
      const offcutFiltersForApi: WarehouseFilters = {
        ...offcutFilters,
        sortBy: offcutsSort.sortBy ?? undefined,
        sortDir: offcutsSort.sortDir,
      }
      const res = await getOffcuts(offcutFiltersForApi, {
        page: offcutsPagination.page.value,
        pageSize: offcutsPagination.pageSize.value,
      })
      offcuts.value = res.items
      offcutsPagination.total.value = res.total
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
      const movementFiltersForApi: WarehouseFilters = {
        ...movementFilters,
        sortBy: movementsSort.sortBy ?? undefined,
        sortDir: movementsSort.sortDir,
      }
      const res = await getMovements(movementFiltersForApi, {
        page: movementsPagination.page.value,
        pageSize: movementsPagination.pageSize.value,
      })
      movements.value = res.items
      movementsPagination.total.value = res.total
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
      const deficitFiltersForApi: WarehouseFilters = {
        ...deficitFilters,
        sortBy: deficitSort.sortBy ?? undefined,
        sortDir: deficitSort.sortDir,
      }
      const res = await getDeficitList(deficitFiltersForApi, {
        page: deficitPagination.page.value,
        pageSize: deficitPagination.pageSize.value,
      })
      deficitItems.value = res.items
      deficitPagination.total.value = res.total
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

  // ─── Offcut status → Movement type mapping ──────────────────────────
  const OFFCUT_STATUS_TO_MOVEMENT_TYPE: Record<OffcutStatus, MovementType> = {
    available: 'return',
    reserved: 'transfer',
    in_production: 'production',
    sold: 'sale',
    scrapped: 'write-off',
    expensed: 'expense',
    returned_to_supplier: 'return-to-supplier',
    in_storage: 'storage',
  }

  // ─── Inline status/priority updates ──────────────────────────────────────────

  async function updateOffcutStatus(id: string, status: string, offcut: OffcutListItem) {
    try {
      await patchOffcutApi(id, { status: status as OffcutStatus })
      // Auto-create movement on status change
      try {
        await createMovementApi({
          type: OFFCUT_STATUS_TO_MOVEMENT_TYPE[status as OffcutStatus],
          offcutId: id,
          batchId: offcut.batchId,
          quantity: offcut.quantity,
          movedAt: new Date().toISOString(),
          notes: t(`warehouse.movement_offcut_${status}`, { id }),
        })
      } catch {
        // Movement creation is secondary — don't block the status update
      }
      toast.success(t('warehouse.toast_offcut_saved'))
      await loadOffcuts()
    } catch {
      toast.error(t('warehouse.toast_error'))
    }
  }

  async function updateDeficitPriority(id: string, priority: DeficitPriority) {
    try {
      await patchDeficitItemApi(id, { priority })
      toast.success(t('warehouse.toast_deficit_saved'))
      await loadDeficit()
    } catch {
      toast.error(t('warehouse.toast_error'))
    }
  }

  async function updateDeficitStatus(id: string, status: DeficitStatus) {
    try {
      await patchDeficitItemApi(id, { status })
      toast.success(t('warehouse.toast_deficit_saved'))
      await loadDeficit()
    } catch {
      toast.error(t('warehouse.toast_error'))
    }
  }

  // Loading lock — prevents page watcher from double-firing when filters reset page to 1
  let suppressPageWatch = false

  watch(filters, () => {
    // Only suppress if page actually changes (i.e. wasn't already 1)
    const tabPaginationMap: Record<WarehouseTab, ReturnType<typeof usePagination>> = {
      stock: stockPagination,
      batches: batchesPagination,
      offcuts: offcutsPagination,
      movements: movementsPagination,
      deficit: deficitPagination,
    }
    const current = tabPaginationMap[activeTab.value]
    suppressPageWatch = current.page.value !== 1
    current.reset()
    load()
  }, { deep: true })

  // Watch stock filters — reload stock tab
  watch(stockFilters, () => {
    suppressPageWatch = stockPagination.page.value !== 1
    stockPagination.reset()
    loadStock()
  }, { deep: true })

  // Watch batches filters — reload batches tab
  watch(batchesFilters, () => {
    suppressPageWatch = batchesPagination.page.value !== 1
    batchesPagination.reset()
    loadBatches()
  }, { deep: true })

  // Watch offcuts filters — reload offcuts tab
  watch(offcutFilters, () => {
    suppressPageWatch = offcutsPagination.page.value !== 1
    offcutsPagination.reset()
    loadOffcuts()
  }, { deep: true })

  // Watch movements filters — reload movements tab
  watch(movementFilters, () => {
    suppressPageWatch = movementsPagination.page.value !== 1
    movementsPagination.reset()
    loadMovements()
  }, { deep: true })

  // Watch deficit filters — reload deficit tab
  watch(deficitFilters, () => {
    suppressPageWatch = deficitPagination.page.value !== 1
    deficitPagination.reset()
    loadDeficit()
  }, { deep: true })

  function toggleStockSort(col: StockFilters['sortBy']) {
    if (stockFilters.sortBy === col) {
      stockFilters.sortDir = stockFilters.sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      stockFilters.sortBy = col
      stockFilters.sortDir = 'asc'
    }
  }

  function toggleBatchesSort(col: string) {
    if (batchesSort.sortBy === col) {
      batchesSort.sortDir = batchesSort.sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      batchesSort.sortBy = col
      batchesSort.sortDir = 'asc'
    }
  }

  // Watch batches sort — reload batches tab
  watch(batchesSort, () => {
    suppressPageWatch = batchesPagination.page.value !== 1
    batchesPagination.reset()
    loadBatches()
  }, { deep: true })

  function toggleOffcutsSort(col: string) {
    if (offcutsSort.sortBy === col) {
      offcutsSort.sortDir = offcutsSort.sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      offcutsSort.sortBy = col
      offcutsSort.sortDir = 'asc'
    }
  }

  // Watch offcuts sort — reload offcuts tab
  watch(offcutsSort, () => {
    suppressPageWatch = offcutsPagination.page.value !== 1
    offcutsPagination.reset()
    loadOffcuts()
  }, { deep: true })

  function toggleMovementsSort(col: string) {
    if (movementsSort.sortBy === col) {
      movementsSort.sortDir = movementsSort.sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      movementsSort.sortBy = col
      movementsSort.sortDir = 'asc'
    }
  }

  // Watch movements sort — reload movements tab
  watch(movementsSort, () => {
    suppressPageWatch = movementsPagination.page.value !== 1
    movementsPagination.reset()
    loadMovements()
  }, { deep: true })

  function toggleDeficitSort(col: string) {
    if (deficitSort.sortBy === col) {
      deficitSort.sortDir = deficitSort.sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      deficitSort.sortBy = col
      deficitSort.sortDir = 'asc'
    }
  }

  // Watch deficit sort — reload deficit tab
  watch(deficitSort, () => {
    suppressPageWatch = deficitPagination.page.value !== 1
    deficitPagination.reset()
    loadDeficit()
  }, { deep: true })

  // Watch page/pageSize changes for each tab independently
  watch([stockPagination.page, stockPagination.pageSize], () => {
    if (suppressPageWatch) { suppressPageWatch = false; return }
    if (activeTab.value === 'stock') loadStock()
  })

  watch([batchesPagination.page, batchesPagination.pageSize], () => {
    if (suppressPageWatch) { suppressPageWatch = false; return }
    if (activeTab.value === 'batches') loadBatches()
  })

  watch([offcutsPagination.page, offcutsPagination.pageSize], () => {
    if (suppressPageWatch) { suppressPageWatch = false; return }
    if (activeTab.value === 'offcuts') loadOffcuts()
  })

  watch([movementsPagination.page, movementsPagination.pageSize], () => {
    if (suppressPageWatch) { suppressPageWatch = false; return }
    if (activeTab.value === 'movements') loadMovements()
  })

  watch([deficitPagination.page, deficitPagination.pageSize], () => {
    if (suppressPageWatch) { suppressPageWatch = false; return }
    if (activeTab.value === 'deficit') loadDeficit()
  })

  // Reload when tab changes — reset all per-tab initialized flags so loading state shows again
  watch(activeTab, () => {
    stockInitialized.value = false
    batchesInitialized.value = false
    offcutsInitialized.value = false
    movementsInitialized.value = false
    deficitInitialized.value = false
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
    batchesFilters,
    offcutFilters,
    movementFilters,
    deficitFilters,
    stockFilters,
    batchesSort,
    offcutsSort,
    movementsSort,
    deficitSort,

    // Separate pagination per tab
    stockPagination,
    batchesPagination,
    offcutsPagination,
    movementsPagination,
    deficitPagination,

    // Modal state
    // DEPRECATED: showCreateBatchModal — batch creation moved to WarehouseBatchCreatePage
    // DEPRECATED: showCreateMovementModal — movement creation removed from UI
    showCreateOffcutModal,

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
    toggleStockSort,
    toggleBatchesSort,
    toggleOffcutsSort,
    toggleMovementsSort,
    toggleDeficitSort,
    // DEPRECATED: onBatchCreated — batch creation moved to WarehouseBatchCreatePage
    // DEPRECATED: onMovementCreated — movement creation removed from UI
    onOffcutCreated,
    updateOffcutStatus,
    updateDeficitPriority,
    updateDeficitStatus,
    tf,
  }
}
