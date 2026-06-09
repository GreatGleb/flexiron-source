<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@/composables/useHead'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { useWarehouse } from '@/composables/useWarehouse'
import { useCategories } from '@/composables/useCategories'
import { useToast } from '@/composables/useToast'
import type { WarehouseTab } from '@/composables/useWarehouse'
import type { BatchStatus, OffcutStatus, MovementType, DeficitStatus, StockFilters, WarehouseFilters } from '@/types/warehouse'
import type { CategoryListItem } from '@/types/category'
import { exportWarehouseData } from '@/services/warehouseService'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import MultiSelect from '@/components/admin/ui/MultiSelect.vue'
import DatePicker from '@/components/admin/ui/DatePicker.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
// DEPRECATED: import CreateBatchModal from './CreateBatchModal.vue' (batch creation moved to WarehouseBatchCreatePage)
// DEPRECATED: import CreateMovementModal from './CreateMovementModal.vue' (movement creation removed from UI)
import '@styles/admin/components/_pagination.css'
import '@styles/admin/warehouse_list.css'

const { t, locale } = useI18n()
const pageConfigEnabled = useFeatureFlag('warehouseStockPageConfig')
const batchesPageConfigEnabled = useFeatureFlag('warehouseBatchesPageConfig')
const offcutsPageConfigEnabled = useFeatureFlag('warehouseOffcutsPageConfig')
const movementsPageConfigEnabled = useFeatureFlag('warehouseMovementsPageConfig')
const deficitPageConfigEnabled = useFeatureFlag('warehouseDeficitPageConfig')
const pageConfigForActiveTab = computed(() => {
  switch (activeTab.value) {
    case 'stock':     return pageConfigEnabled.value
    case 'batches':   return batchesPageConfigEnabled.value
    case 'offcuts':   return offcutsPageConfigEnabled.value
    case 'movements': return movementsPageConfigEnabled.value
    case 'deficit':   return deficitPageConfigEnabled.value
    default:          return false
  }
})
const toast = useToast()
const route = useRoute()
const router = useRouter()

const {
  activeTab,
  stockItems, stockLoading, stockError,
  batches, batchesLoading, batchesError,
  offcuts, offcutsLoading, offcutsError,
  movements, movementsLoading, movementsError,
  deficitItems, deficitLoading, deficitError,
  batchesFilters,
  offcutFilters,
  movementFilters,
  deficitFilters,
  stockFilters,
  stockPagination,
  batchesPagination,
  offcutsPagination,
  movementsPagination,
  deficitPagination,
  load,
  loadStock,
  deleteBatch,
  deleteOffcut,
  deleteDeficit,
  toggleStockSort,
  batchesSort,
  toggleBatchesSort,
  offcutsSort,
  toggleOffcutsSort,
  movementsSort,
  toggleMovementsSort,
  deficitSort,
  toggleDeficitSort,
  // DEPRECATED: showCreateBatchModal (batch creation moved to WarehouseBatchCreatePage)
  // DEPRECATED: showCreateMovementModal (removed from UI)
  // DEPRECATED: onBatchCreated (batch creation moved to WarehouseBatchCreatePage)
  // DEPRECATED: onMovementCreated (removed from UI)
  updateOffcutStatus,
  updateDeficitStatus,
  tf,
} = useWarehouse()

// ─── Batches search display (separate from batchesFilters.search) ────────────
// When productId comes from query param, show it in the search field
// but don't use it for search filtering — only productId filter applies
const batchesSearchDisplay = ref('')

// When user types in batches search, sync to both display and actual search filter
// Also clear productId filter so search works across all products, not just the one from query param
function onBatchesSearchInput(value: string) {
  batchesSearchDisplay.value = value
  batchesFilters.search = value
  if (batchesFilters.productId) {
    batchesFilters.productId = undefined
  }
}

// ─── Sync activeTab with route param (:tab?) ─────────────────────────────────
const VALID_TABS: WarehouseTab[] = ['stock', 'batches', 'offcuts', 'movements', 'deficit']

function syncTabFromRoute() {
  const raw = route.params.tab
  const tab = typeof raw === 'string' && VALID_TABS.includes(raw as WarehouseTab)
    ? (raw as WarehouseTab)
    : 'stock'
  if (activeTab.value !== tab) {
    activeTab.value = tab
  }
}

// Sync on mount
syncTabFromRoute()

// Watch route param changes to sync tab (browser back/forward)
watch(() => route.params.tab, () => {
  syncTabFromRoute()
})

function onTabClick(tab: WarehouseTab) {
  router.push({ name: 'admin-warehouse', params: { tab } })
}

const { items: catItems, load: loadCats } = useCategories()

useHead({
  title: () => `Flexiron — ${t('warehouse.header_title')}`,
  description: () => t('warehouse.title'),
})

const TABS: { key: WarehouseTab; labelKey: string; icon: string }[] = [
  { key: 'stock', labelKey: 'warehouse.tab_stock', icon: 'pie-chart' },
  { key: 'batches', labelKey: 'warehouse.tab_batches', icon: 'package' },
  { key: 'offcuts', labelKey: 'warehouse.tab_offcuts', icon: 'scissors' },
  { key: 'movements', labelKey: 'warehouse.tab_movements', icon: 'refresh-cw' },
  { key: 'deficit', labelKey: 'warehouse.tab_deficit', icon: 'alert-triangle' },
]

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

// Per-tab page size computed — each tab has its own pagination instance
const stockPageSizeStr = computed({
  get: () => String(stockPagination.pageSize.value),
  set: (v: string) => {
    stockPagination.pageSize.value = Number(v)
    stockPagination.reset()
  },
})

const batchesPageSizeStr = computed({
  get: () => String(batchesPagination.pageSize.value),
  set: (v: string) => {
    batchesPagination.pageSize.value = Number(v)
    batchesPagination.reset()
  },
})

const offcutsPageSizeStr = computed({
  get: () => String(offcutsPagination.pageSize.value),
  set: (v: string) => {
    offcutsPagination.pageSize.value = Number(v)
    offcutsPagination.reset()
  },
})

const movementsPageSizeStr = computed({
  get: () => String(movementsPagination.pageSize.value),
  set: (v: string) => {
    movementsPagination.pageSize.value = Number(v)
    movementsPagination.reset()
  },
})

const deficitPageSizeStr = computed({
  get: () => String(deficitPagination.pageSize.value),
  set: (v: string) => {
    deficitPagination.pageSize.value = Number(v)
    deficitPagination.reset()
  },
})

// ─── Stock tab filters are now server-side via stockFilters ──────────────────

// ─── Save / Load filter preferences ──────────────────────────────────────────
const PREFS_KEY = 'warehouse_stock_prefs'
const BATCH_PREFS_KEY = 'warehouse_batches_prefs'
const OFFCUT_PREFS_KEY = 'warehouse_offcuts_prefs'
const MOVEMENT_PREFS_KEY = 'warehouse_movements_prefs'
const DEFICIT_PREFS_KEY = 'warehouse_deficit_prefs'

function saveView() {
  const prefs = {
    stockSearch: stockFilters.search,
    showDeficitOnly: stockFilters.showDeficitOnly,
    showInStockOnly: stockFilters.showInStockOnly,
    stockUnitFilter: stockFilters.unit,
    stockCategoryIds: [...stockFilters.categoryIds],
  }
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  toast.show(t('msg.prefs_saved'))
}

function saveBatchesView() {
  const prefs = {
    search: batchesFilters.search,
    status: batchesFilters.status,
    supplierId: batchesFilters.supplierId,
    unit: batchesFilters.unit,
    dateFrom: batchesFilters.dateFrom,
    dateTo: batchesFilters.dateTo,
  }
  localStorage.setItem(BATCH_PREFS_KEY, JSON.stringify(prefs))
  toast.show(t('msg.prefs_saved'))
}

function saveOffcutsView() {
  const prefs = {
    search: offcutFilters.search,
    status: offcutFilters.status,
    unit: offcutFilters.unit,
    offcutType: offcutFilters.offcutType,
    categoryIds: offcutFilters.categoryIds ? [...offcutFilters.categoryIds] : [],
    batchNumber: offcutFilters.batchNumber,
  }
  localStorage.setItem(OFFCUT_PREFS_KEY, JSON.stringify(prefs))
  toast.show(t('msg.prefs_saved'))
}

function saveMovementsView() {
  const prefs = {
    search: movementFilters.search,
    type: movementFilters.type,
    unit: movementFilters.unit,
    categoryIds: movementFilters.categoryIds ? [...movementFilters.categoryIds] : [],
    batchNumber: movementFilters.batchNumber,
    dateFrom: movementFilters.dateFrom,
    dateTo: movementFilters.dateTo,
  }
  localStorage.setItem(MOVEMENT_PREFS_KEY, JSON.stringify(prefs))
  toast.show(t('msg.prefs_saved'))
}

function saveDeficitView() {
  const prefs = {
    search: deficitFilters.search,
    status: deficitFilters.status,
    priority: deficitFilters.priority,
    unit: deficitFilters.unit,
    categoryIds: deficitFilters.categoryIds ? [...deficitFilters.categoryIds] : [],
  }
  localStorage.setItem(DEFICIT_PREFS_KEY, JSON.stringify(prefs))
  toast.show(t('msg.prefs_saved'))
}

// ─── Export current tab data as CSV ──────────────────────────────────────────
async function exportCurrentTab() {
  try {
    let filters: StockFilters | WarehouseFilters
    let filename: string

    switch (activeTab.value) {
      case 'stock':
        filters = stockFilters
        filename = 'warehouse-stock.csv'
        break
      case 'batches':
        filters = batchesFilters
        filename = 'warehouse-batches.csv'
        break
      case 'offcuts':
        filters = offcutFilters
        filename = 'warehouse-offcuts.csv'
        break
      case 'movements':
        filters = movementFilters
        filename = 'warehouse-movements.csv'
        break
      case 'deficit':
        filters = deficitFilters
        filename = 'warehouse-deficit.csv'
        break
      default:
        return
    }

    const csv = await exportWarehouseData(activeTab.value, filters, locale.value)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.error(t('warehouse.export_error'))
  }
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return
    const prefs = JSON.parse(raw) as {
      stockSearch?: string
      showDeficitOnly?: boolean
      showInStockOnly?: boolean
      stockUnitFilter?: string
      stockCategoryIds?: string[]
    }
    if (typeof prefs.stockSearch === 'string') stockFilters.search = prefs.stockSearch
    if (typeof prefs.showDeficitOnly === 'boolean') stockFilters.showDeficitOnly = prefs.showDeficitOnly
    if (typeof prefs.showInStockOnly === 'boolean') stockFilters.showInStockOnly = prefs.showInStockOnly
    if (typeof prefs.stockUnitFilter === 'string') stockFilters.unit = prefs.stockUnitFilter
    if (Array.isArray(prefs.stockCategoryIds)) stockFilters.categoryIds = prefs.stockCategoryIds
  } catch {
    /* ignore malformed prefs */
  }
}

// ─── Filter transition guard ────────────────────────────────────────────────
// Prevents visible row height flicker when filters change.
// The real table is made visibility:hidden (not display:none) during the
// transition, so offsetHeight still returns correct values for the sync.
// The skeleton overlay covers the invisible table area.
//
// IMPORTANT: This transition should only run on initial load and filter
// changes — NOT on pagination page changes (which should be instant).
const filteringStock = ref(false)
let filterTimer: ReturnType<typeof setTimeout> | null = null
const skipStockTransition = ref(false)

async function startFilterTransition() {
  if (skipStockTransition.value) {
    // Pagination page change — skip the slow transition, just sync heights
    skipStockTransition.value = false
    await nextTick()
    await syncTableRowHeights()
    return
  }
  if (filterTimer) clearTimeout(filterTimer)
  filteringStock.value = true
  // Phase 1: GlassPanel skeleton shows (wide lines, no light background).
  //          Table stays in DOM (visibility:hidden via .stock-table-hidden,
  //          panel-body display:block via .filtering-stock override)
  //          so offsetHeight is preserved for measurement.
  await nextTick()
  // Phase 2: sync heights on the invisible table — no visual flicker.
  //          GlassPanel skeleton covers the area during this async operation.
  await Promise.all([
    syncTableRowHeights(),
    new Promise(resolve => { setTimeout(resolve, 500) }),
  ])
  // Phase 3: hide skeleton, show table with correct heights already set.
  filteringStock.value = false
}

const UNIT_OPTIONS = [
  { value: '', label: t('warehouse.filter_unit_all') },
  { value: 'kg', label: t('warehouse.unit_kg') },
  { value: 'm', label: t('warehouse.unit_m') },
  { value: 'pcs', label: t('warehouse.unit_pcs') },
  { value: 'm2', label: t('warehouse.unit_m2') },
]

// ─── Batches tab filter options ──────────────────────────────────────────────

const BATCH_STATUS_OPTIONS = [
  { value: '', label: t('warehouse.filter_status_all') },
  { value: 'available', label: t('warehouse.batch_status_available') },
  { value: 'in_storage', label: t('warehouse.batch_status_in_storage') },
  { value: 'in_production', label: t('warehouse.batch_status_in_production') },
  { value: 'sold', label: t('warehouse.batch_status_sold') },
  { value: 'scrapped', label: t('warehouse.batch_status_scrapped') },
  { value: 'expensed', label: t('warehouse.batch_status_expensed') },
  { value: 'returned_to_supplier', label: t('warehouse.batch_status_returned_to_supplier') },
  { value: 'partial', label: t('warehouse.batch_status_partial') },
  { value: 'depleted', label: t('warehouse.batch_status_depleted') },
  { value: 'reserved', label: t('warehouse.batch_status_reserved') },
  { value: 'converted_to_offcuts', label: t('warehouse.batch_status_converted_to_offcuts') },
]

const BATCH_UNIT_OPTIONS = [
  { value: '', label: t('warehouse.filter_unit_all') },
  { value: 'kg', label: t('warehouse.unit_kg') },
  { value: 'm', label: t('warehouse.unit_m') },
  { value: 'pcs', label: t('warehouse.unit_pcs') },
  { value: 'm2', label: t('warehouse.unit_m2') },
]

// ─── Offcuts tab filter options ─────────────────────────────────────────────

const OFFCUT_STATUS_OPTIONS = [
  { value: '', label: t('warehouse.filter_status_all') },
  { value: 'available', label: t('warehouse.offcut_status_available') },
  { value: 'reserved', label: t('warehouse.offcut_status_reserved') },
  { value: 'in_production', label: t('warehouse.offcut_status_in_production') },
  { value: 'sold', label: t('warehouse.offcut_status_sold') },
  { value: 'scrapped', label: t('warehouse.offcut_status_scrapped') },
  { value: 'expensed', label: t('warehouse.offcut_status_expensed') },
  { value: 'returned_to_supplier', label: t('warehouse.offcut_status_returned_to_supplier') },
  { value: 'in_storage', label: t('warehouse.offcut_status_in_storage') },
]

const OFFCUT_UNIT_OPTIONS = [
  { value: '', label: t('warehouse.filter_unit_all') },
  { value: 'kg', label: t('warehouse.unit_kg') },
  { value: 'm', label: t('warehouse.unit_m') },
  { value: 'pcs', label: t('warehouse.unit_pcs') },
  { value: 'm2', label: t('warehouse.unit_m2') },
]

const OFFCUT_TYPE_OPTIONS = [
  { value: '', label: t('warehouse.filter_type_all') },
  { value: 'sheet', label: t('warehouse.offcut_type_sheet') },
  { value: 'linear', label: t('warehouse.offcut_type_linear') },
]

// ─── Movements tab filter options ────────────────────────────────────────────

const MOVEMENT_TYPE_OPTIONS = [
  { value: '', label: t('warehouse.filter_type_all') },
  { value: 'receipt', label: t('warehouse.type_receipt') },
  { value: 'sale', label: t('warehouse.type_sale') },
  { value: 'production', label: t('warehouse.type_production') },
  { value: 'expense', label: t('warehouse.type_expense') },
  { value: 'write-off', label: t('warehouse.type_write_off') },
  { value: 'storage', label: t('warehouse.type_storage') },
  { value: 'transfer', label: t('warehouse.type_transfer') },
  { value: 'return', label: t('warehouse.type_return') },
  { value: 'return-to-supplier', label: t('warehouse.type_return_to_supplier') },
  { value: 'correction', label: t('warehouse.type_correction') },
]

const MOVEMENT_UNIT_OPTIONS = [
  { value: '', label: t('warehouse.filter_unit_all') },
  { value: 'kg', label: t('warehouse.unit_kg') },
  { value: 'm', label: t('warehouse.unit_m') },
  { value: 'pcs', label: t('warehouse.unit_pcs') },
  { value: 'm2', label: t('warehouse.unit_m2') },
]

// ─── Deficit tab filter options ──────────────────────────────────────────────

const DEFICIT_STATUS_OPTIONS = [
  { value: '', label: t('warehouse.filter_status_all') },
  { value: 'open', label: t('warehouse.deficit_status_open') },
  { value: 'ordered', label: t('warehouse.deficit_status_ordered') },
  { value: 'resolved', label: t('warehouse.deficit_status_resolved') },
]

const DEFICIT_PRIORITY_OPTIONS = [
  { value: '', label: t('warehouse.filter_priority_all') },
  { value: 'critical', label: t('warehouse.priority_critical') },
  { value: 'high', label: t('warehouse.priority_high') },
  { value: 'medium', label: t('warehouse.priority_medium') },
  { value: 'low', label: t('warehouse.priority_low') },
]

const DEFICIT_UNIT_OPTIONS = [
  { value: '', label: t('warehouse.filter_unit_all') },
  { value: 'kg', label: t('warehouse.unit_kg') },
  { value: 'm', label: t('warehouse.unit_m') },
  { value: 'pcs', label: t('warehouse.unit_pcs') },
  { value: 'm2', label: t('warehouse.unit_m2') },
]

// ─── Supplier list for batches filter dropdown ───────────────────────────────
import { getSupplierList } from '@/services/suppliersService'

const supplierOptions = ref<Array<{ value: string; label: string }>>([])

onMounted(async () => {
  try {
    const suppliers = await getSupplierList()
    supplierOptions.value = [
      { value: '', label: t('warehouse.filter_supplier_all') },
      ...suppliers.map((s) => ({ value: s.id, label: s.company })),
    ]
  } catch {
    supplierOptions.value = [{ value: '', label: t('warehouse.filter_supplier_all') }]
  }
})

function getCategoryPath(cat: CategoryListItem): string {
  const parts: string[] = [tf(cat.name)]
  let current = cat
  while (current.parentId) {
    const parent = catItems.value.find((c) => c.id === current.parentId)
    if (!parent) break
    parts.unshift(tf(parent.name))
    current = parent
  }
  return parts.join(' → ')
}

const categoryFilterOptions = computed(() =>
  catItems.value.map((c) => ({ value: c.id, label: getCategoryPath(c) })),
)

// ─── Status pill helpers ──────────────────────────────────────────────────────

const BATCH_STATUS_PILL: Record<BatchStatus, string> = {
  available: 'pill-success',
  reserved: 'pill-info',
  partial: 'pill-warning',
  depleted: 'pill-consumed',
  in_storage: 'pill-info',
  in_production: 'pill-warning',
  sold: 'pill-sold',
  scrapped: 'pill-danger',
  expensed: 'pill-expensed',
  returned_to_supplier: 'pill-returned',
  converted_to_offcuts: 'pill-offcut',
}

const OFFCUT_STATUS_PILL: Record<OffcutStatus, string> = {
  available: 'pill-success',
  reserved: 'pill-info',
  in_production: 'pill-warning',
  sold: 'pill-mint',
  scrapped: 'pill-danger',
  expensed: 'pill-expensed',
  returned_to_supplier: 'pill-returned',
  in_storage: 'pill-info',
}

const MOVEMENT_TYPE_PILL: Record<MovementType, string> = {
  receipt: 'pill-success',
  expense: 'pill-danger',
  transfer: 'pill-info',
  'write-off': 'pill-warning',
  return: 'pill-mint',
  'return-to-supplier': 'pill-warning',
  correction: 'pill-info',
  production: 'pill-secondary',
  sale: 'pill-mint',
  storage: 'pill-info',
  offcut: 'pill-offcut',
}

const DEFICIT_STATUS_PILL: Record<DeficitStatus, string> = {
  open: 'pill-warning',
  in_progress: 'pill-info',
  ordered: 'pill-mint',
  resolved: 'pill-success',
  cancelled: 'pill-danger',
}

// ─── Delete confirm modals ────────────────────────────────────────────────────

const showDeleteModal = ref(false)
const deletingItem = ref<{ id: string; name: string; type: 'batch' | 'offcut' | 'deficit' | 'stock' } | null>(null)

function confirmDeleteBatch(id: string, name: string) {
  deletingItem.value = { id, name, type: 'batch' }
  showDeleteModal.value = true
}

function confirmDeleteOffcut(id: string, name: string) {
  deletingItem.value = { id, name, type: 'offcut' }
  showDeleteModal.value = true
}

function confirmDeleteDeficit(id: string, name: string) {
  deletingItem.value = { id, name, type: 'deficit' }
  showDeleteModal.value = true
}

async function handleDelete() {
  if (!deletingItem.value) return
  const { id, type } = deletingItem.value
  if (type === 'batch') await deleteBatch(id)
  else if (type === 'offcut') await deleteOffcut(id)
  else if (type === 'deficit') await deleteDeficit(id)
  showDeleteModal.value = false
  deletingItem.value = null
}

// ─── Template refs for split-table row height sync ─────────────────────────

const fixedTableEl = ref<HTMLElement | null>(null)
const scrollTableEl = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null

const onWindowResize = () => {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    syncTableRowHeights()
  }, 200)
}

function syncTableRowHeights(): Promise<void> {
  const fixedTbody = fixedTableEl.value?.querySelectorAll<HTMLElement>('tbody tr')
  const scrollTbody = scrollTableEl.value?.querySelectorAll<HTMLElement>('tbody tr')
  const fixedThead = fixedTableEl.value?.querySelectorAll<HTMLElement>('thead tr')
  const scrollThead = scrollTableEl.value?.querySelectorAll<HTMLElement>('thead tr')

  if (!fixedTbody || !scrollTbody) return Promise.resolve()

  // Pass 1: Reset all heights so the browser can compute natural sizes
  fixedTbody.forEach(tr => { tr.style.height = '' })
  scrollTbody.forEach(tr => { tr.style.height = '' })
  fixedThead?.forEach(tr => { tr.style.height = '' })
  scrollThead?.forEach(tr => { tr.style.height = '' })

  // Pass 2: Double requestAnimationFrame guarantees browser reflow is complete.
  // Return a Promise so callers can await completion.
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const maxLen = Math.min(fixedTbody.length, scrollTbody.length)
        for (let i = 0; i < maxLen; i++) {
          const h = Math.max(fixedTbody[i]!.offsetHeight, scrollTbody[i]!.offsetHeight)
          if (h > 0) {
            fixedTbody[i]!.style.height = h + 'px'
            scrollTbody[i]!.style.height = h + 'px'
          }
        }

        // Also sync header rows
        if (fixedThead && scrollThead) {
          const hdrLen = Math.min(fixedThead.length, scrollThead.length)
          for (let i = 0; i < hdrLen; i++) {
            const hh = Math.max(fixedThead[i]!.offsetHeight, scrollThead[i]!.offsetHeight)
            if (hh > 0) {
              fixedThead[i]!.style.height = hh + 'px'
              scrollThead[i]!.style.height = hh + 'px'
            }
          }
        }

        resolve()
      })
    })
  })
}

onMounted(() => {
  loadPrefs()

  // ─── Read productId from query param for batches tab ──────────────────
  const productId = route.query.productId as string | undefined
  if (productId) {
    batchesFilters.productId = productId
    // Show productId in search field but don't use it for search filtering
    batchesSearchDisplay.value = productId
  }

  load()
  loadCats()

  // ─── Row height sync on mount ──────────────────────────────────────────
  // Use double nextTick to ensure the split-table layout is fully rendered
  // before measuring heights. The watch(stockItems) below handles the case
  // where data loads asynchronously after mount.
  nextTick(() => {
    nextTick(() => {
      syncTableRowHeights()
    })
  })

  // ─── Window resize listener (debounced) ──────────────────────────────
  window.addEventListener('resize', onWindowResize)

  // ─── ResizeObserver for both split-table containers ────────────────────
  const fixedContainer = document.querySelector<HTMLElement>('.stock-table-fixed')
  const scrollContainer = document.querySelector<HTMLElement>('.stock-table-scroll')
  if (fixedContainer && scrollContainer) {
    resizeObserver = new ResizeObserver(() => {
      syncTableRowHeights()
    })
    resizeObserver.observe(fixedContainer)
    resizeObserver.observe(scrollContainer)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (resizeTimer) {
    clearTimeout(resizeTimer)
    resizeTimer = null
  }
  if (filterTimer) {
    clearTimeout(filterTimer)
    filterTimer = null
  }
  window.removeEventListener('resize', onWindowResize)
})

// ─── Re-sync when stockItems data changes ─────────────────────────────────
watch(stockItems, () => {
  nextTick(() => {
    nextTick(() => {
      syncTableRowHeights()
    })
  })
})

// ─── Re-sync when stockItems data changes (after server-side filter) ──────
watch(stockItems, () => {
  startFilterTransition()
})

// ─── Detect if any offcut filters are active ──────────────────────────────
const offcutFiltersActive = computed(() => {
  return !!(
    offcutFilters.search ||
    offcutFilters.status ||
    offcutFilters.unit ||
    offcutFilters.offcutType ||
    (offcutFilters.categoryIds && offcutFilters.categoryIds.length > 0) ||
    offcutFilters.batchNumber
  )
})

// ─── Detect if any deficit filters are active ─────────────────────────────
const deficitFiltersActive = computed(() => {
  return !!(
    deficitFilters.search ||
    deficitFilters.status ||
    deficitFilters.priority ||
    deficitFilters.unit ||
    (deficitFilters.categoryIds && deficitFilters.categoryIds.length > 0)
  )
})
</script>

<template>
  <div class="page-warehouse" data-test="page-warehouse">

    <div class="warehouse-header" data-test="warehouse-header">
      <h1 class="page-title">{{ t('warehouse.header_title') }}</h1>
    </div>

    <!-- Tabs -->
    <div class="warehouse-tabs" data-test="warehouse-tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="warehouse-tab"
        :class="{ active: activeTab === tab.key }"
        :data-test="`warehouse-tab-${tab.key}`"
        @click="onTabClick(tab.key)"
      >
        <SvgIcon :name="tab.icon" :width="18" :height="18" />
        <span>{{ t(tab.labelKey) }}</span>
      </button>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         Toolbar — action buttons per tab (matching suppliers page pattern)
         ════════════════════════════════════════════════════════════════════════ -->
    <div class="suppliers-header" data-test="warehouse-toolbar">
      <div class="suppliers-header-left" />
      <div class="suppliers-header-right">
        <!-- Export (all tabs) -->
        <button
          class="btn btn-secondary"
          data-test="warehouse-export-btn"
          @click="exportCurrentTab"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          <span>{{ t('warehouse.btn_export') }}</span>
        </button>

        <!-- Batches tab: new batch -->
        <button
          v-if="activeTab === 'batches'"
          class="btn btn-primary"
          data-test="warehouse-new-batch-btn"
          @click="router.push({ name: 'admin-warehouse-batch-create' })"
        >
          <SvgIcon name="plus-add" :width="18" :height="18" stroke-width="2" />
          <span>{{ t('warehouse.btn_new_batch') }}</span>
        </button>

        <!-- Offcuts tab: new offcut -->
        <button
          v-if="activeTab === 'offcuts'"
          class="btn btn-primary"
          data-test="warehouse-new-offcut-btn"
          @click="router.push({ name: 'admin-warehouse-offcut-create' })"
        >
          <SvgIcon name="scissors" :width="18" :height="18" />
          <span>{{ t('warehouse.btn_new_offcut') }}</span>
        </button>

        <!-- Page config stub (all tabs) — feature-flagged per tab -->
        <div class="btn-wrapper">
          <button
            v-tooltip="pageConfigForActiveTab ? '' : t('warehouse.tooltip_page_config_coming_soon')"
            class="btn btn-secondary"
            :disabled="!pageConfigForActiveTab"
            data-test="warehouse-page-config-btn"
          >
            <SvgIcon name="settings-gear" :width="18" :height="18" />
            <span>{{ t('warehouse.btn_page_config') }}</span>
          </button>
          <span v-if="!pageConfigForActiveTab" class="btn-caption">{{ t('warehouse.tooltip_page_config_coming_soon') }}</span>
        </div>
      </div>
    </div>

    <!-- Filters bar -->
    <div class="filters-bar" data-test="warehouse-filters">
      <div class="filters-bar-header">
        <span>{{ t('warehouse.filters') }}</span>
      </div>
      <div class="filters-bar-content">
        <!-- Stock tab: client-side search + filters -->
        <template v-if="activeTab === 'stock'">
          <div class="filter-group" data-test="warehouse-filter-search">
            <label class="field-label">{{ t('warehouse.col_search') }}</label>
            <SearchInput
              v-model="stockFilters.search"
              :placeholder="t('warehouse.search_placeholder')"
              data-test="warehouse-stock-search"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-category">
            <label class="field-label">{{ t('warehouse.col_category') }}</label>
            <MultiSelect
              v-model="stockFilters.categoryIds"
              :options="categoryFilterOptions"
              :placeholder="t('warehouse.filter_category_all')"
              data-test="warehouse-stock-category-filter"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-unit">
            <label class="field-label">{{ t('warehouse.col_unit') }}</label>
            <CustomSelect
              v-model="stockFilters.unit"
              :options="UNIT_OPTIONS"
              data-test="warehouse-stock-unit-filter"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-instock">
            <label class="deficit-checkbox-label">
              <input
                v-model="stockFilters.showInStockOnly"
                type="checkbox"
                class="deficit-checkbox-input"
                data-test="warehouse-stock-instock-toggle"
              />
              <span class="deficit-checkbox-custom" />
              <span class="deficit-checkbox-text">{{ t('warehouse.filter_in_stock_only') }}</span>
            </label>
          </div>
          <div class="filter-group" data-test="warehouse-filter-deficit">
            <label class="deficit-checkbox-label">
              <input
                v-model="stockFilters.showDeficitOnly"
                type="checkbox"
                class="deficit-checkbox-input"
                data-test="warehouse-stock-deficit-toggle"
              />
              <span class="deficit-checkbox-custom" />
              <span class="deficit-checkbox-text">{{ t('warehouse.filter_deficit_only') }}</span>
            </label>
          </div>
          <button class="btn btn-primary" data-test="warehouse-stock-save-view-btn" @click="saveView">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>{{ t('btn.save_view') }}</span>
          </button>
        </template>
        <!-- Batches tab: server-side filters -->
        <template v-else-if="activeTab === 'batches'">
          <div class="filter-group" data-test="warehouse-filter-search">
            <label class="field-label">{{ t('warehouse.col_search') }}</label>
            <SearchInput
              :model-value="batchesSearchDisplay"
              :placeholder="t('warehouse.search_placeholder')"
              data-test="warehouse-batches-search"
              @update:model-value="onBatchesSearchInput"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-status">
            <label class="field-label">{{ t('warehouse.col_status') }}</label>
            <CustomSelect
              :model-value="batchesFilters.status ?? ''"
              :options="BATCH_STATUS_OPTIONS"
              data-test="warehouse-batches-status-filter"
              @update:model-value="(v: string) => batchesFilters.status = (v || undefined) as any"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-supplier">
            <label class="field-label">{{ t('warehouse.col_supplier') }}</label>
            <CustomSelect
              :model-value="batchesFilters.supplierId ?? ''"
              :options="supplierOptions"
              data-test="warehouse-batches-supplier-filter"
              @update:model-value="(v: string) => batchesFilters.supplierId = v || undefined"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-date-from">
            <label class="field-label">{{ t('warehouse.filter_date_from') }}</label>
            <DatePicker
              :model-value="batchesFilters.dateFrom ?? ''"
              :placeholder="t('warehouse.filter_date_from')"
              data-test="warehouse-batches-date-from"
              @update:model-value="(v: string) => batchesFilters.dateFrom = v || undefined"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-date-to">
            <label class="field-label">{{ t('warehouse.filter_date_to') }}</label>
            <DatePicker
              :model-value="batchesFilters.dateTo ?? ''"
              :placeholder="t('warehouse.filter_date_to')"
              data-test="warehouse-batches-date-to"
              @update:model-value="(v: string) => batchesFilters.dateTo = v || undefined"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-unit">
            <label class="field-label">{{ t('warehouse.col_unit') }}</label>
            <CustomSelect
              :model-value="batchesFilters.unit ?? ''"
              :options="BATCH_UNIT_OPTIONS"
              data-test="warehouse-batches-unit-filter"
              @update:model-value="(v: string) => batchesFilters.unit = v || undefined"
            />
          </div>
          <button class="btn btn-primary" data-test="warehouse-batches-save-view-btn" @click="saveBatchesView">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>{{ t('btn.save_view') }}</span>
          </button>
        </template>
        <!-- Offcuts tab: server-side filters -->
        <template v-else-if="activeTab === 'offcuts'">
          <div class="filter-group" data-test="warehouse-filter-search">
            <label class="field-label">{{ t('warehouse.col_search') }}</label>
            <SearchInput
              v-model="offcutFilters.search"
              :placeholder="t('warehouse.search_placeholder')"
              data-test="warehouse-offcuts-search"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-status">
            <label class="field-label">{{ t('warehouse.col_status') }}</label>
            <CustomSelect
              :model-value="offcutFilters.status ?? ''"
              :options="OFFCUT_STATUS_OPTIONS"
              data-test="warehouse-offcuts-status-filter"
              @update:model-value="(v: string) => offcutFilters.status = (v || undefined) as any"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-unit">
            <label class="field-label">{{ t('warehouse.col_unit') }}</label>
            <CustomSelect
              :model-value="offcutFilters.unit ?? ''"
              :options="OFFCUT_UNIT_OPTIONS"
              data-test="warehouse-offcuts-unit-filter"
              @update:model-value="(v: string) => offcutFilters.unit = v || undefined"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-offcut-type">
            <label class="field-label">{{ t('warehouse.col_type') }}</label>
            <CustomSelect
              :model-value="offcutFilters.offcutType ?? ''"
              :options="OFFCUT_TYPE_OPTIONS"
              data-test="warehouse-offcuts-type-filter"
              @update:model-value="(v: string) => offcutFilters.offcutType = (v || undefined) as any"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-category">
            <label class="field-label">{{ t('warehouse.col_category') }}</label>
            <MultiSelect
              :model-value="offcutFilters.categoryIds ?? []"
              :options="categoryFilterOptions"
              :placeholder="t('warehouse.filter_category_all')"
              data-test="warehouse-offcuts-category-filter"
              @update:model-value="(v: string[]) => offcutFilters.categoryIds = v"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-batch">
            <label class="field-label">{{ t('warehouse.col_batch_number') }}</label>
            <SearchInput
              :model-value="offcutFilters.batchNumber ?? ''"
              :placeholder="t('warehouse.filter_batch_placeholder')"
              data-test="warehouse-offcuts-batch-filter"
              @update:model-value="(v: string) => offcutFilters.batchNumber = v || undefined"
            />
          </div>
          <button class="btn btn-primary" data-test="warehouse-offcuts-save-view-btn" @click="saveOffcutsView">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>{{ t('btn.save_view') }}</span>
          </button>
        </template>
        <template v-else-if="activeTab === 'movements'">
          <div class="filter-group" data-test="warehouse-filter-search">
            <label class="field-label">{{ t('warehouse.col_search') }}</label>
            <SearchInput
              v-model="movementFilters.search"
              :placeholder="t('warehouse.search_placeholder')"
              data-test="warehouse-movements-search"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-type">
            <label class="field-label">{{ t('warehouse.col_type') }}</label>
            <CustomSelect
              :model-value="movementFilters.type ?? ''"
              :options="MOVEMENT_TYPE_OPTIONS"
              data-test="warehouse-movements-type-filter"
              @update:model-value="(v: string) => movementFilters.type = (v || undefined) as any"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-date-from">
            <label class="field-label">{{ t('warehouse.filter_date_from') }}</label>
            <DatePicker
              :model-value="movementFilters.dateFrom ?? ''"
              :placeholder="t('warehouse.filter_date_from')"
              data-test="warehouse-movements-date-from"
              @update:model-value="(v: string) => movementFilters.dateFrom = v || undefined"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-date-to">
            <label class="field-label">{{ t('warehouse.filter_date_to') }}</label>
            <DatePicker
              :model-value="movementFilters.dateTo ?? ''"
              :placeholder="t('warehouse.filter_date_to')"
              data-test="warehouse-movements-date-to"
              @update:model-value="(v: string) => movementFilters.dateTo = v || undefined"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-unit">
            <label class="field-label">{{ t('warehouse.col_unit') }}</label>
            <CustomSelect
              :model-value="movementFilters.unit ?? ''"
              :options="MOVEMENT_UNIT_OPTIONS"
              data-test="warehouse-movements-unit-filter"
              @update:model-value="(v: string) => movementFilters.unit = v || undefined"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-category">
            <label class="field-label">{{ t('warehouse.col_category') }}</label>
            <MultiSelect
              :model-value="movementFilters.categoryIds ?? []"
              :options="categoryFilterOptions"
              :placeholder="t('warehouse.filter_category_all')"
              data-test="warehouse-movements-category-filter"
              @update:model-value="(v: string[]) => movementFilters.categoryIds = v"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-batch">
            <label class="field-label">{{ t('warehouse.col_batch_number') }}</label>
            <SearchInput
              :model-value="movementFilters.batchNumber ?? ''"
              :placeholder="t('warehouse.filter_batch_placeholder')"
              data-test="warehouse-movements-batch-filter"
              @update:model-value="(v: string) => movementFilters.batchNumber = v || undefined"
            />
          </div>
          <button class="btn btn-primary" data-test="warehouse-movements-save-view-btn" @click="saveMovementsView">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>{{ t('btn.save_view') }}</span>
          </button>
        </template>
        <template v-else-if="activeTab === 'deficit'">
          <div class="filter-group" data-test="warehouse-filter-search">
            <label class="field-label">{{ t('warehouse.col_search') }}</label>
            <SearchInput
              v-model="deficitFilters.search"
              :placeholder="t('warehouse.search_placeholder')"
              data-test="warehouse-deficit-search"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-status">
            <label class="field-label">{{ t('warehouse.col_status') }}</label>
            <CustomSelect
              :model-value="deficitFilters.status ?? ''"
              :options="DEFICIT_STATUS_OPTIONS"
              data-test="warehouse-deficit-status-filter"
              @update:model-value="(v: string) => deficitFilters.status = (v || undefined) as any"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-priority">
            <label class="field-label">{{ t('warehouse.col_priority') }}</label>
            <CustomSelect
              :model-value="deficitFilters.priority ?? ''"
              :options="DEFICIT_PRIORITY_OPTIONS"
              data-test="warehouse-deficit-priority-filter"
              @update:model-value="(v: string) => deficitFilters.priority = (v || undefined) as any"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-unit">
            <label class="field-label">{{ t('warehouse.col_unit') }}</label>
            <CustomSelect
              :model-value="deficitFilters.unit ?? ''"
              :options="DEFICIT_UNIT_OPTIONS"
              data-test="warehouse-deficit-unit-filter"
              @update:model-value="(v: string) => deficitFilters.unit = v || undefined"
            />
          </div>
          <div class="filter-group" data-test="warehouse-filter-category">
            <label class="field-label">{{ t('warehouse.col_category') }}</label>
            <MultiSelect
              :model-value="deficitFilters.categoryIds ?? []"
              :options="categoryFilterOptions"
              :placeholder="t('warehouse.filter_category_all')"
              data-test="warehouse-deficit-category-filter"
              @update:model-value="(v: string[]) => deficitFilters.categoryIds = v"
            />
          </div>
          <button class="btn btn-primary" data-test="warehouse-deficit-save-view-btn" @click="saveDeficitView">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
            <span>{{ t('btn.save_view') }}</span>
          </button>
        </template>
      </div>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Stock Overview
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'stock'" data-test="warehouse-tab-stock">
      <!-- GlassPanel :loading shows its built-in skeleton (wide lines, no light background)
           for initial page load. During filter transitions, .filtering-stock class
           overrides display:none on .panel-body so the table stays in DOM for height sync. -->
      <GlassPanel
        :loading="stockLoading || filteringStock"
        :class="{ 'filtering-stock': filteringStock }"
        :skeleton-rows="6"
        data-test="warehouse-stock-panel"
      >
        <!-- Error state -->
        <div
          v-if="stockError"
          class="error-state"
          data-test="warehouse-stock-error"
        >
          <SvgIcon name="alert-triangle" :width="48" :height="48" />
          <p>{{ stockError }}</p>
          <button class="btn btn-primary" @click="loadStock">{{ t('btn.retry') }}</button>
        </div>

        <!-- Empty state (only when not loading or filtering) -->
        <div
          v-if="!stockError && !stockLoading && !filteringStock && stockItems.length === 0"
          class="empty-state"
          data-test="warehouse-stock-empty"
        >
          <SvgIcon name="tag" :width="48" :height="48" />
          <p>{{ stockItems.length > 0 ? t('warehouse.empty_filtered_stock') : t('warehouse.empty_stock') }}</p>
        </div>

        <!-- Table area wrapper: position relative so skeleton can overlay the real table -->
        <div v-if="!stockError && stockItems.length > 0" class="stock-table-area">

          <!-- Real table: always rendered when there are items.
               When filteringStock is true, it becomes visibility:hidden + opacity:0
               (keeps layout, correct offsetHeight for syncTableRowHeights).
               The GlassPanel skeleton (wide lines) shows on top via :loading. -->
          <div :class="['stock-table-split', { 'stock-table-hidden': filteringStock }]">
          <!-- Left: Fixed Product column -->
          <div class="stock-table-fixed">
            <table ref="fixedTableEl" class="data-table">
              <thead>
                <tr>
                  <th>
                    <button class="th-sort-btn" @click="toggleStockSort('name')">
                      {{ t('warehouse.col_product') }}
                      <span class="sort-icon-group">
                        <SvgIcon
                          name="chevron-up"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'name' && stockFilters.sortDir === 'asc' }"
                        />
                        <SvgIcon
                          name="chevron-down"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'name' && stockFilters.sortDir === 'desc' }"
                        />
                      </span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in stockItems"
                  :key="item.productId"
                  :class="{ 'row-deficit': item.isDeficit }"
                  data-test="warehouse-stock-row"
                >
                  <td>
                    <router-link
                      :to="{ name: 'admin-warehouse-stock-card', params: { id: item.productId } }"
                      class="name-link"
                    >
                      {{ tf(item.productName) }}
                    </router-link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Right: Scrollable remaining columns -->
          <div class="stock-table-scroll">
            <table ref="scrollTableEl" class="data-table">
              <thead>
                <tr>
                  <th>
                    <button class="th-sort-btn" @click="toggleStockSort('totalQuantity')">
                      <div class="th-content">
                        {{ t('warehouse.col_total_qty') }}
                        <span v-tooltip="t('warehouse.col_total_qty_hint')" class="info-hint">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </span>
                      </div>
                      <span class="sort-icon-group">
                        <SvgIcon
                          name="chevron-up"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'totalQuantity' && stockFilters.sortDir === 'asc' }"
                        />
                        <SvgIcon
                          name="chevron-down"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'totalQuantity' && stockFilters.sortDir === 'desc' }"
                        />
                      </span>
                    </button>
                  </th>
                  <th class="hid-768">
                    <div class="th-content">
                      {{ t('warehouse.col_reserved') }}
                      <span v-tooltip="t('warehouse.col_reserved_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                  </th>
                  <th>
                    <button class="th-sort-btn" @click="toggleStockSort('availableQuantity')">
                      <div class="th-content">
                        {{ t('warehouse.col_available') }}
                        <span v-tooltip="t('warehouse.col_available_hint')" class="info-hint">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </span>
                      </div>
                      <span class="sort-icon-group">
                        <SvgIcon
                          name="chevron-up"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'availableQuantity' && stockFilters.sortDir === 'asc' }"
                        />
                        <SvgIcon
                          name="chevron-down"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'availableQuantity' && stockFilters.sortDir === 'desc' }"
                        />
                      </span>
                    </button>
                  </th>
                  <th class="hid-480">
                    <button class="th-sort-btn" @click="toggleStockSort('unit')">
                      <div class="th-content">
                        {{ t('warehouse.col_unit') }}
                        <span v-tooltip="t('warehouse.col_unit_hint')" class="info-hint">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </span>
                      </div>
                      <span class="sort-icon-group">
                        <SvgIcon
                          name="chevron-up"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'unit' && stockFilters.sortDir === 'asc' }"
                        />
                        <SvgIcon
                          name="chevron-down"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'unit' && stockFilters.sortDir === 'desc' }"
                        />
                      </span>
                    </button>
                  </th>
                  <th class="hid-480">
                    <div class="th-content">
                      {{ t('warehouse.col_batches') }}
                      <span v-tooltip="t('warehouse.col_batches_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                  </th>
                  <th class="hid-600">
                    <button class="th-sort-btn" @click="toggleStockSort('avgUnitPrice')">
                      <div class="th-content">
                        {{ t('warehouse.col_avg_price') }}
                        <span v-tooltip="t('warehouse.col_avg_price_hint')" class="info-hint">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </span>
                      </div>
                      <span class="sort-icon-group">
                        <SvgIcon
                          name="chevron-up"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'avgUnitPrice' && stockFilters.sortDir === 'asc' }"
                        />
                        <SvgIcon
                          name="chevron-down"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'avgUnitPrice' && stockFilters.sortDir === 'desc' }"
                        />
                      </span>
                    </button>
                  </th>
                  <th class="hid-600">
                    <button class="th-sort-btn" @click="toggleStockSort('totalValue')">
                      <div class="th-content">
                        {{ t('warehouse.col_total_value') }}
                        <span v-tooltip="t('warehouse.col_total_value_hint')" class="info-hint">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </span>
                      </div>
                      <span class="sort-icon-group">
                        <SvgIcon
                          name="chevron-up"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'totalValue' && stockFilters.sortDir === 'asc' }"
                        />
                        <SvgIcon
                          name="chevron-down"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'totalValue' && stockFilters.sortDir === 'desc' }"
                        />
                      </span>
                    </button>
                  </th>
                  <th>
                    <button class="th-sort-btn" @click="toggleStockSort('minStock')">
                      <div class="th-content">
                        {{ t('warehouse.col_min_stock') }}
                        <span v-tooltip="t('warehouse.col_min_stock_hint')" class="info-hint">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </span>
                      </div>
                      <span class="sort-icon-group">
                        <SvgIcon
                          name="chevron-up"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'minStock' && stockFilters.sortDir === 'asc' }"
                        />
                        <SvgIcon
                          name="chevron-down"
                          :width="16"
                          :height="16"
                          class="sort-icon"
                          :class="{ active: stockFilters.sortBy === 'minStock' && stockFilters.sortDir === 'desc' }"
                        />
                      </span>
                    </button>
                  </th>
                  <th class="th-actions">{{ t('warehouse.col_actions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in stockItems"
                  :key="item.productId"
                  :class="{ 'row-deficit': item.isDeficit }"
                  data-test="warehouse-stock-row"
                >
                  <td>{{ item.totalQuantity }}</td>
                  <td class="hid-768">{{ item.reservedQuantity }}</td>
                  <td>
                    <span :class="{ 'text-danger': item.availableQuantity <= 0 }">
                      {{ item.availableQuantity }}
                    </span>
                  </td>
                  <td class="hid-480">{{ t(`warehouse.unit_${item.unit}`) }}</td>
                  <td class="hid-480">{{ item.batchCount }}</td>
                  <td class="hid-600">{{ item.avgUnitPrice.toFixed(2) }} €</td>
                  <td class="hid-600">{{ item.totalValue.toFixed(2) }} €</td>
                  <td>
                    <template v-if="item.minStock !== null">
                      <span style="white-space: nowrap;">
                        {{ item.minStock }}
                        <span v-if="item.isDeficit" class="deficit-badge" data-test="deficit-badge">
                          {{ t('warehouse.deficit_badge') }}
                        </span>
                      </span>
                    </template>
                    <span v-else class="text-muted">—</span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <router-link
                        v-tooltip="t('warehouse.open_stock_card')"
                        :to="{ name: 'admin-warehouse-stock-card', params: { id: item.productId } }"
                        class="action-icon-btn"
                        data-test="stock-view-btn"
                        @click.stop
                      >
                        <SvgIcon name="external-link" :width="16" :height="16" />
                      </router-link>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        </div><!-- /.stock-table-area -->

        <!-- Stock pagination -->
        <div v-if="stockItems.length > 0" class="pagination-bar" data-test="warehouse-stock-pagination">
          <div class="page-size" data-test="warehouse-stock-page-size">
            <span>{{ t('warehouse.page_size') }}</span>
            <CustomSelect
              v-model="stockPageSizeStr"
              :options="PAGE_SIZE_OPTIONS"
              :open-up="true"
              class="custom-select-sm"
            />
          </div>
          <div class="pagination-nav">
            <button
              class="btn btn-icon btn-sm"
              :disabled="!stockPagination.hasPrev.value"
              :style="{ display: stockPagination.totalPages.value <= 1 ? 'none' : 'flex' }"
              data-test="warehouse-stock-prev-page"
              @click="skipStockTransition = true; stockPagination.prev()"
            >
              <SvgIcon
                name="chevron-right"
                :width="14"
                :height="14"
                style="transform: rotate(180deg)"
              />
            </button>
            <div class="pagination-pages">
              <template v-for="(p, i) in stockPagination.pageNumbers()" :key="i">
                <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                <button
                  v-else
                  class="page-btn"
                  :class="{ active: p === stockPagination.page.value }"
                  :data-test="`warehouse-stock-page-${p}`"
                  @click="skipStockTransition = true; stockPagination.goTo(p as number)"
                >
                  {{ p }}
                </button>
              </template>
            </div>
            <button
              class="btn btn-icon btn-sm"
              :disabled="!stockPagination.hasNext.value"
              :style="{ display: stockPagination.totalPages.value <= 1 ? 'none' : 'flex' }"
              data-test="warehouse-stock-next-page"
              @click="skipStockTransition = true; stockPagination.next()"
            >
              <SvgIcon name="chevron-right" :width="14" :height="14" />
            </button>
          </div>
          <div class="pagination-info">
            <span>{{ stockPagination.showingFrom }}-{{ stockPagination.showingTo }}</span>
            <span>&nbsp;{{ t('warehouse.of') }}&nbsp;</span>
            <span>{{ stockPagination.total.value }}</span>
          </div>
        </div>
      </GlassPanel>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Batches
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'batches'" data-test="warehouse-tab-batches">
      <GlassPanel :loading="batchesLoading" :skeleton-rows="8" data-test="warehouse-batches-panel">
        <div
          v-if="batchesError"
          class="error-state"
          data-test="warehouse-batches-error"
        >
          <SvgIcon name="alert-triangle" :width="48" :height="48" />
          <p>{{ batchesError }}</p>
          <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
        </div>

        <div
          v-else-if="!batchesLoading && batches.length === 0"
          class="empty-state"
          data-test="warehouse-batches-empty"
        >
          <SvgIcon name="package" :width="48" :height="48" />
          <p>{{ t('warehouse.empty_batches') }}</p>
        </div>

        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>
                  <button class="th-sort-btn" @click="toggleBatchesSort('productName')">
                    {{ t('warehouse.col_product') }}
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'productName' && batchesSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'productName' && batchesSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleBatchesSort('batchNumber')">
                    <div class="th-content">
                      {{ t('warehouse.col_batch_number') }}
                      <span v-tooltip="t('warehouse.col_batch_number_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'batchNumber' && batchesSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'batchNumber' && batchesSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleBatchesSort('lotCode')">
                    <div class="th-content">
                      {{ t('warehouse.col_lot_code') }}
                      <span v-tooltip="t('warehouse.col_lot_code_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'lotCode' && batchesSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'lotCode' && batchesSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleBatchesSort('quantity')">
                    <div class="th-content">
                      {{ t('warehouse.col_quantity') }}
                      <span v-tooltip="t('warehouse.col_quantity_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'quantity' && batchesSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'quantity' && batchesSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleBatchesSort('quantityRemaining')">
                    <div class="th-content">
                      {{ t('warehouse.col_remaining') }}
                      <span v-tooltip="t('warehouse.col_remaining_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'quantityRemaining' && batchesSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'quantityRemaining' && batchesSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleBatchesSort('unit')">
                    <div class="th-content">
                      {{ t('warehouse.col_unit') }}
                      <span v-tooltip="t('warehouse.col_unit_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'unit' && batchesSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'unit' && batchesSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleBatchesSort('unitPrice')">
                    <div class="th-content">
                      {{ t('warehouse.col_unit_price') }}
                      <span v-tooltip="t('warehouse.col_unit_price_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'unitPrice' && batchesSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'unitPrice' && batchesSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleBatchesSort('receivedAt')">
                    <div class="th-content">
                      {{ t('warehouse.col_received') }}
                      <span v-tooltip="t('warehouse.col_received_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'receivedAt' && batchesSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'receivedAt' && batchesSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleBatchesSort('status')">
                    <div class="th-content">
                      {{ t('warehouse.col_status') }}
                      <span v-tooltip="t('warehouse.col_status_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'status' && batchesSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: batchesSort.sortBy === 'status' && batchesSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th class="th-actions">{{ t('warehouse.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="batch in batches"
                :key="batch.id"
                data-test="warehouse-batch-row"
              >
                <td>
                  <router-link
                    :to="{ name: 'admin-warehouse-batch', params: { id: batch.id } }"
                    class="name-link"
                  >
                    {{ tf(batch.productName) }}
                  </router-link>
                </td>
                <td>{{ batch.batchNumber }}</td>
                <td><code class="lot-code">{{ batch.lotCode }}</code></td>
                <td>{{ batch.quantity }}</td>
                <td>
                  <span :class="{ 'text-danger': batch.quantityRemaining <= 0 }">
                    {{ batch.quantityRemaining }}
                  </span>
                </td>
                <td>{{ t(`warehouse.unit_${batch.unit}`) }}</td>
                <td>{{ batch.unitPrice.toFixed(2) }} €</td>
                <td>{{ batch.receivedAt.slice(0, 10) }}</td>
                <td>
                  <span class="status-pill" :class="BATCH_STATUS_PILL[batch.status]">
                    {{ t(`warehouse.status_${batch.status}`) }}
                  </span>
                </td>
                <td>
                  <div class="row-actions">
                    <router-link
                      v-tooltip="t('warehouse.open_batch_card')"
                      :to="{ name: 'admin-warehouse-batch', params: { id: batch.id } }"
                      class="action-icon-btn"
                      data-test="batch-view-btn"
                      @click.stop
                    >
                      <SvgIcon name="external-link" :width="16" :height="16" />
                    </router-link>
                    <button
                      v-tooltip="t('warehouse.btn_delete')"
                      class="action-icon-btn action-danger"
                      data-test="batch-delete-btn"
                      @click.stop="confirmDeleteBatch(batch.id, tf(batch.productName))"
                    >
                      <SvgIcon name="trash" :width="16" :height="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="batchesPagination.total.value > 0" class="pagination-bar" data-test="warehouse-batches-pagination">
          <div class="page-size" data-test="warehouse-batches-page-size">
            <span>{{ t('warehouse.page_size') }}</span>
            <CustomSelect
              v-model="batchesPageSizeStr"
              :options="PAGE_SIZE_OPTIONS"
              :open-up="true"
              class="custom-select-sm"
            />
          </div>
          <div class="pagination-nav">
            <button
              class="btn btn-icon btn-sm"
              :disabled="!batchesPagination.hasPrev.value"
              :style="{ display: batchesPagination.totalPages.value <= 1 ? 'none' : 'flex' }"
              data-test="warehouse-batches-prev-page"
              @click="batchesPagination.prev()"
            >
              <SvgIcon
                name="chevron-right"
                :width="14"
                :height="14"
                style="transform: rotate(180deg)"
              />
            </button>
            <div class="pagination-pages">
              <template v-for="(p, i) in batchesPagination.pageNumbers()" :key="i">
                <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                <button
                  v-else
                  class="page-btn"
                  :class="{ active: p === batchesPagination.page.value }"
                  :data-test="`warehouse-batches-page-${p}`"
                  @click="batchesPagination.goTo(p as number)"
                >
                  {{ p }}
                </button>
              </template>
            </div>
            <button
              class="btn btn-icon btn-sm"
              :disabled="!batchesPagination.hasNext.value"
              :style="{ display: batchesPagination.totalPages.value <= 1 ? 'none' : 'flex' }"
              data-test="warehouse-batches-next-page"
              @click="batchesPagination.next()"
            >
              <SvgIcon name="chevron-right" :width="14" :height="14" />
            </button>
          </div>
          <div class="pagination-info">
            <span>{{ batchesPagination.showingFrom }}-{{ batchesPagination.showingTo }}</span>
            <span>&nbsp;{{ t('warehouse.of') }}&nbsp;</span>
            <span>{{ batchesPagination.total.value }}</span>
          </div>
        </div>
      </GlassPanel>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Offcuts
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'offcuts'" data-test="warehouse-tab-offcuts">
      <GlassPanel :loading="offcutsLoading" :skeleton-rows="8" data-test="warehouse-offcuts-panel">
        <div
          v-if="offcutsError"
          class="error-state"
          data-test="warehouse-offcuts-error"
        >
          <SvgIcon name="alert-triangle" :width="48" :height="48" />
          <p>{{ offcutsError }}</p>
          <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
        </div>

        <!-- Empty state: no offcuts at all (no filters active) -->
        <div
          v-else-if="!offcutsLoading && offcuts.length === 0 && !offcutFiltersActive"
          class="tab-empty-state"
          data-test="warehouse-offcuts-empty"
        >
          <div class="tab-empty-state__icon">
            <SvgIcon name="scissors" :width="48" :height="48" />
          </div>
          <p class="tab-empty-state__text">{{ t('warehouse.empty_offcuts') }}</p>
          <div class="tab-empty-state__action">
            <button
              class="btn btn-primary"
              data-test="warehouse-offcuts-cut-btn-empty"
              @click="router.push({ name: 'admin-warehouse-offcut-create' })"
            >
              <SvgIcon name="scissors" :width="16" :height="16" />
              <span>{{ t('warehouse.btn_cut') }}</span>
            </button>
          </div>
        </div>

        <!-- Empty state: filters/search returned no results -->
        <div
          v-else-if="!offcutsLoading && offcuts.length === 0 && offcutFiltersActive"
          class="empty-state"
          data-test="warehouse-offcuts-filtered-empty"
        >
          <SvgIcon name="search" :width="48" :height="48" />
          <p>{{ t('warehouse.empty_filtered_offcuts') }}</p>
        </div>

        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>
                  <button class="th-sort-btn" @click="toggleOffcutsSort('productName')">
                    {{ t('warehouse.col_product') }}
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'productName' && offcutsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'productName' && offcutsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleOffcutsSort('offcutType')">
                    <div class="th-content">
                      {{ t('warehouse.col_type') }}
                      <span v-tooltip="t('warehouse.col_offcut_type_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'offcutType' && offcutsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'offcutType' && offcutsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleOffcutsSort('batchNumber')">
                    <div class="th-content">
                      {{ t('warehouse.col_batch_number') }}
                      <span v-tooltip="t('warehouse.col_batch_number_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'batchNumber' && offcutsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'batchNumber' && offcutsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleOffcutsSort('lengthMm')">
                    <div class="th-content">
                      {{ t('warehouse.col_length') }}
                      <span v-tooltip="t('warehouse.col_length_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'lengthMm' && offcutsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'lengthMm' && offcutsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleOffcutsSort('weightKg')">
                    <div class="th-content">
                      {{ t('warehouse.col_weight') }}
                      <span v-tooltip="t('warehouse.col_weight_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'weightKg' && offcutsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'weightKg' && offcutsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleOffcutsSort('quantity')">
                    <div class="th-content">
                      {{ t('warehouse.col_quantity') }}
                      <span v-tooltip="t('warehouse.col_quantity_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'quantity' && offcutsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'quantity' && offcutsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleOffcutsSort('unit')">
                    <div class="th-content">
                      {{ t('warehouse.col_unit') }}
                      <span v-tooltip="t('warehouse.col_unit_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'unit' && offcutsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'unit' && offcutsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleOffcutsSort('location')">
                    <div class="th-content">
                      {{ t('warehouse.col_location') }}
                      <span v-tooltip="t('warehouse.col_location_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'location' && offcutsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'location' && offcutsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleOffcutsSort('status')">
                    <div class="th-content">
                      {{ t('warehouse.col_status') }}
                      <span v-tooltip="t('warehouse.col_status_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'status' && offcutsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: offcutsSort.sortBy === 'status' && offcutsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th class="th-actions">{{ t('warehouse.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="offcut in offcuts"
                :key="offcut.id"
                data-test="warehouse-offcut-row"
              >
                <td>
                  <router-link
                    :to="{ name: 'admin-warehouse-offcut', params: { id: offcut.id } }"
                    class="name-link"
                  >
                    {{ tf(offcut.productName) }}
                  </router-link>
                </td>
                <td>
                  <span
                    v-if="offcut.offcutType"
                    class="offcut-type-badge"
                    :class="`offcut-type-badge--${offcut.offcutType}`"
                  >
                    {{ t(`warehouse.offcut_type_${offcut.offcutType}`) }}
                  </span>
                  <span v-else class="text-muted">&mdash;</span>
                </td>
                <td><code class="lot-code">{{ offcut.batchNumber }}</code></td>
                <td>
                  <template v-if="offcut.lengthMm">
                    <span class="offcut-dimensions">
                      {{ t('warehouse.offcut_dimensions', {
                        length: offcut.lengthMm,
                        width: offcut.widthMm ?? '—',
                      }) }}
                    </span>
                  </template>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>{{ offcut.weightKg ?? '—' }}</td>
                <td>{{ offcut.quantity }}</td>
                <td>{{ t(`warehouse.unit_${offcut.unit}`) }}</td>
                <td>{{ offcut.location ?? '—' }}</td>
                <td>
                  <span class="status-pill" :class="OFFCUT_STATUS_PILL[offcut.status]">
                    {{ t(`warehouse.status_${offcut.status}`) }}
                  </span>
                </td>
                <td>
                  <div class="row-actions">
                    <router-link
                      v-tooltip="t('warehouse.open_offcut_card')"
                      :to="{ name: 'admin-warehouse-offcut', params: { id: offcut.id } }"
                      class="action-icon-btn"
                      data-test="offcut-view-btn"
                      @click.stop
                    >
                      <SvgIcon name="external-link" :width="16" :height="16" />
                    </router-link>
                    <template v-if="offcut.status === 'available'">
                      <button
                        v-tooltip="t('warehouse.btn_mark_used')"
                        class="inline-action-btn inline-action-btn--used"
                        data-test="offcut-mark-used-btn"
                        @click.stop="updateOffcutStatus(offcut.id, 'in_production', offcut)"
                      >
                        <SvgIcon name="check" :width="14" :height="14" />
                        {{ t('warehouse.btn_mark_used') }}
                      </button>
                      <button
                        v-tooltip="t('warehouse.btn_mark_scrap')"
                        class="inline-action-btn inline-action-btn--scrap"
                        data-test="offcut-mark-scrap-btn"
                        @click.stop="updateOffcutStatus(offcut.id, 'scrapped', offcut)"
                      >
                        <SvgIcon name="trash" :width="14" :height="14" />
                        {{ t('warehouse.btn_mark_scrap') }}
                      </button>
                    </template>
                    <button
                      v-tooltip="t('warehouse.btn_delete')"
                      class="action-icon-btn action-danger"
                      data-test="offcut-delete-btn"
                      @click.stop="confirmDeleteOffcut(offcut.id, tf(offcut.productName))"
                    >
                      <SvgIcon name="trash" :width="16" :height="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="offcutsPagination.total.value > 0" class="pagination-bar" data-test="warehouse-offcuts-pagination">
          <div class="page-size" data-test="warehouse-offcuts-page-size">
            <span>{{ t('warehouse.page_size') }}</span>
            <CustomSelect
              v-model="offcutsPageSizeStr"
              :options="PAGE_SIZE_OPTIONS"
              :open-up="true"
              class="custom-select-sm"
            />
          </div>
          <div class="pagination-nav">
            <button
              class="btn btn-icon btn-sm"
              :disabled="!offcutsPagination.hasPrev.value"
              :style="{ display: offcutsPagination.totalPages.value <= 1 ? 'none' : 'flex' }"
              data-test="warehouse-offcuts-prev-page"
              @click="offcutsPagination.prev()"
            >
              <SvgIcon
                name="chevron-right"
                :width="14"
                :height="14"
                style="transform: rotate(180deg)"
              />
            </button>
            <div class="pagination-pages">
              <template v-for="(p, i) in offcutsPagination.pageNumbers()" :key="i">
                <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                <button
                  v-else
                  class="page-btn"
                  :class="{ active: p === offcutsPagination.page.value }"
                  :data-test="`warehouse-offcuts-page-${p}`"
                  @click="offcutsPagination.goTo(p as number)"
                >
                  {{ p }}
                </button>
              </template>
            </div>
            <button
              class="btn btn-icon btn-sm"
              :disabled="!offcutsPagination.hasNext.value"
              :style="{ display: offcutsPagination.totalPages.value <= 1 ? 'none' : 'flex' }"
              data-test="warehouse-offcuts-next-page"
              @click="offcutsPagination.next()"
            >
              <SvgIcon name="chevron-right" :width="14" :height="14" />
            </button>
          </div>
          <div class="pagination-info">
            <span>{{ offcutsPagination.showingFrom }}-{{ offcutsPagination.showingTo }}</span>
            <span>&nbsp;{{ t('warehouse.of') }}&nbsp;</span>
            <span>{{ offcutsPagination.total.value }}</span>
          </div>
        </div>
      </GlassPanel>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Movements
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'movements'" data-test="warehouse-tab-movements">
      <GlassPanel :loading="movementsLoading" :skeleton-rows="8" data-test="warehouse-movements-panel">
        <div
          v-if="movementsError"
          class="error-state"
          data-test="warehouse-movements-error"
        >
          <SvgIcon name="alert-triangle" :width="48" :height="48" />
          <p>{{ movementsError }}</p>
          <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
        </div>

        <div
          v-else-if="!movementsLoading && movements.length === 0"
          class="empty-state"
          data-test="warehouse-movements-empty"
        >
          <SvgIcon name="refresh-cw" :width="48" :height="48" />
          <p>{{ t('warehouse.empty_movements') }}</p>
        </div>

        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>
                  <button class="th-sort-btn" @click="toggleMovementsSort('movedAt')">
                    <div class="th-content">
                      {{ t('warehouse.col_date') }}
                      <span v-tooltip="t('warehouse.col_date_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'movedAt' && movementsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'movedAt' && movementsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleMovementsSort('type')">
                    <div class="th-content">
                      {{ t('warehouse.col_type') }}
                      <span v-tooltip="t('warehouse.col_type_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'type' && movementsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'type' && movementsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleMovementsSort('productName')">
                    {{ t('warehouse.col_product') }}
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'productName' && movementsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'productName' && movementsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleMovementsSort('batchNumber')">
                    <div class="th-content">
                      {{ t('warehouse.col_batch_number') }}
                      <span v-tooltip="t('warehouse.col_batch_number_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'batchNumber' && movementsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'batchNumber' && movementsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleMovementsSort('quantity')">
                    <div class="th-content">
                      {{ t('warehouse.col_quantity') }}
                      <span v-tooltip="t('warehouse.col_quantity_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'quantity' && movementsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'quantity' && movementsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleMovementsSort('unit')">
                    <div class="th-content">
                      {{ t('warehouse.col_unit') }}
                      <span v-tooltip="t('warehouse.col_unit_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'unit' && movementsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'unit' && movementsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleMovementsSort('unitPrice')">
                    <div class="th-content">
                      {{ t('warehouse.col_unit_price') }}
                      <span v-tooltip="t('warehouse.col_unit_price_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'unitPrice' && movementsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'unitPrice' && movementsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleMovementsSort('totalCost')">
                    <div class="th-content">
                      {{ t('warehouse.col_total') }}
                      <span v-tooltip="t('warehouse.col_total_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'totalCost' && movementsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'totalCost' && movementsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleMovementsSort('referenceId')">
                    <div class="th-content">
                      {{ t('warehouse.col_reference') }}
                      <span v-tooltip="t('warehouse.col_reference_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'referenceId' && movementsSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: movementsSort.sortBy === 'referenceId' && movementsSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th class="th-actions">{{ t('warehouse.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="mov in movements"
                :key="mov.id"
                data-test="warehouse-movement-row"
              >
                <td>{{ mov.movedAt.slice(0, 10) }}</td>
                <td>
                  <span class="status-pill" :class="MOVEMENT_TYPE_PILL[mov.type]">
                    {{ t(`warehouse.type_${mov.type.replace('-', '_')}`) }}
                  </span>
                </td>
                <td>
                  <router-link
                    :to="{ name: 'admin-warehouse-movement', params: { id: mov.id } }"
                    class="name-link"
                  >
                    {{ tf(mov.productName) }}
                  </router-link>
                </td>
                <td><code class="lot-code">{{ mov.batchNumber }}</code></td>
                <td>{{ mov.quantity }}</td>
                <td>{{ t(`warehouse.unit_${mov.unit}`) }}</td>
                <td>{{ mov.unitPrice.toFixed(2) }} €</td>
                <td>{{ (mov.quantity * mov.unitPrice).toFixed(2) }} €</td>
                <td>
                  <span v-if="mov.type === 'write-off' && mov.notes" class="badge badge-ref-waste_report">
                    {{ mov.notes }}
                  </span>
                  <span v-else-if="mov.referenceType" class="badge" :class="`badge-ref-${mov.referenceType}`">
                    {{ t(`warehouse.reference_${mov.referenceType}`) }}
                  </span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>
                  <div class="row-actions">
                    <router-link
                      v-tooltip="t('warehouse.open_movement_card')"
                      :to="{ name: 'admin-warehouse-movement', params: { id: mov.id } }"
                      class="action-icon-btn"
                      data-test="movement-view-btn"
                      @click.stop
                    >
                      <SvgIcon name="external-link" :width="16" :height="16" />
                    </router-link>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="movementsPagination.total.value > 0" class="pagination-bar" data-test="warehouse-movements-pagination">
          <div class="page-size" data-test="warehouse-movements-page-size">
            <span>{{ t('warehouse.page_size') }}</span>
            <CustomSelect
              v-model="movementsPageSizeStr"
              :options="PAGE_SIZE_OPTIONS"
              :open-up="true"
              class="custom-select-sm"
            />
          </div>
          <div class="pagination-nav">
            <button
              class="btn btn-icon btn-sm"
              :disabled="!movementsPagination.hasPrev.value"
              :style="{ display: movementsPagination.totalPages.value <= 1 ? 'none' : 'flex' }"
              data-test="warehouse-movements-prev-page"
              @click="movementsPagination.prev()"
            >
              <SvgIcon
                name="chevron-right"
                :width="14"
                :height="14"
                style="transform: rotate(180deg)"
              />
            </button>
            <div class="pagination-pages">
              <template v-for="(p, i) in movementsPagination.pageNumbers()" :key="i">
                <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                <button
                  v-else
                  class="page-btn"
                  :class="{ active: p === movementsPagination.page.value }"
                  :data-test="`warehouse-movements-page-${p}`"
                  @click="movementsPagination.goTo(p as number)"
                >
                  {{ p }}
                </button>
              </template>
            </div>
            <button
              class="btn btn-icon btn-sm"
              :disabled="!movementsPagination.hasNext.value"
              :style="{ display: movementsPagination.totalPages.value <= 1 ? 'none' : 'flex' }"
              data-test="warehouse-movements-next-page"
              @click="movementsPagination.next()"
            >
              <SvgIcon name="chevron-right" :width="14" :height="14" />
            </button>
          </div>
          <div class="pagination-info">
            <span>{{ movementsPagination.showingFrom }}-{{ movementsPagination.showingTo }}</span>
            <span>&nbsp;{{ t('warehouse.of') }}&nbsp;</span>
            <span>{{ movementsPagination.total.value }}</span>
          </div>
        </div>
      </GlassPanel>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         TAB: Deficit
         ════════════════════════════════════════════════════════════════════════ -->
    <div v-show="activeTab === 'deficit'" data-test="warehouse-tab-deficit">
      <GlassPanel :loading="deficitLoading" :skeleton-rows="8" data-test="warehouse-deficit-panel">
        <div
          v-if="deficitError"
          class="error-state"
          data-test="warehouse-deficit-error"
        >
          <SvgIcon name="alert-triangle" :width="48" :height="48" />
          <p>{{ deficitError }}</p>
          <button class="btn btn-primary" @click="load">{{ t('btn.retry') }}</button>
        </div>

        <!-- Empty state: no deficit items at all (no filters active) -->
        <div
          v-else-if="!deficitLoading && deficitItems.length === 0 && !deficitFiltersActive"
          class="tab-empty-state"
          data-test="warehouse-deficit-empty"
        >
          <div class="tab-empty-state__icon">
            <SvgIcon name="package" :width="48" :height="48" />
          </div>
          <p class="tab-empty-state__text">{{ t('warehouse.empty_deficit') }}</p>
        </div>

        <!-- Empty state: filters/search returned no results -->
        <div
          v-else-if="!deficitLoading && deficitItems.length === 0 && deficitFiltersActive"
          class="empty-state"
          data-test="warehouse-deficit-filtered-empty"
        >
          <SvgIcon name="search" :width="48" :height="48" />
          <p>{{ t('warehouse.empty_filtered_deficit') }}</p>
        </div>

        <div v-else class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>
                  <button class="th-sort-btn" @click="toggleDeficitSort('productName')">
                    {{ t('warehouse.col_product') }}
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'productName' && deficitSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'productName' && deficitSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleDeficitSort('currentStock')">
                    <div class="th-content">
                      {{ t('warehouse.col_current_stock') }}
                      <span v-tooltip="t('warehouse.col_current_stock_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'currentStock' && deficitSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'currentStock' && deficitSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleDeficitSort('minRequired')">
                    <div class="th-content">
                      {{ t('warehouse.col_min_required') }}
                      <span v-tooltip="t('warehouse.col_min_required_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'minRequired' && deficitSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'minRequired' && deficitSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleDeficitSort('deficitAmount')">
                    <div class="th-content">
                      {{ t('warehouse.col_deficit_amount') }}
                      <span v-tooltip="t('warehouse.col_deficit_amount_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'deficitAmount' && deficitSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'deficitAmount' && deficitSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleDeficitSort('unit')">
                    <div class="th-content">
                      {{ t('warehouse.col_unit') }}
                      <span v-tooltip="t('warehouse.col_unit_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'unit' && deficitSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'unit' && deficitSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleDeficitSort('priority')">
                    <div class="th-content">
                      {{ t('warehouse.col_priority') }}
                      <span v-tooltip="t('warehouse.col_priority_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'priority' && deficitSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'priority' && deficitSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th>
                  <button class="th-sort-btn" @click="toggleDeficitSort('status')">
                    <div class="th-content">
                      {{ t('warehouse.col_status') }}
                      <span v-tooltip="t('warehouse.col_status_hint')" class="info-hint">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      </span>
                    </div>
                    <span class="sort-icon-group">
                      <SvgIcon
                        name="chevron-up"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'status' && deficitSort.sortDir === 'asc' }"
                      />
                      <SvgIcon
                        name="chevron-down"
                        :width="16"
                        :height="16"
                        class="sort-icon"
                        :class="{ active: deficitSort.sortBy === 'status' && deficitSort.sortDir === 'desc' }"
                      />
                    </span>
                  </button>
                </th>
                <th class="th-actions">{{ t('warehouse.col_actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in deficitItems"
                :key="item.id"
                :class="{ 'row-critical': item.priority === 'critical' }"
                data-test="warehouse-deficit-row"
              >
                <td>
                  <router-link
                    :to="{ name: 'admin-warehouse-deficit', params: { id: item.id } }"
                    class="name-link"
                  >
                    {{ tf(item.productName) }}
                  </router-link>
                </td>
                <td :class="{ 'text-danger': item.currentStock <= 0 }">
                  {{ item.currentStock }}
                </td>
                <td>{{ item.minRequired }}</td>
                <td>
                  <span
                    class="fw-bold"
                    :class="{
                      'deficit-amount-critical': item.deficitAmount > 100,
                      'deficit-amount-high': item.deficitAmount > 50 && item.deficitAmount <= 100,
                      'text-danger': item.deficitAmount <= 50,
                    }"
                  >
                    {{ item.deficitAmount }}
                  </span>
                </td>
                <td>{{ t(`warehouse.unit_${item.unit}`) }}</td>
                <td>
                  <span
                    class="deficit-priority-badge"
                    :class="`deficit-priority-badge--${item.priority}`"
                  >
                    {{ t(`warehouse.deficit_priority_badge_${item.priority}`) }}
                  </span>
                </td>
                <td>
                  <span class="status-pill" :class="DEFICIT_STATUS_PILL[item.status]">
                    {{ t(`warehouse.status_${item.status}`) }}
                  </span>
                </td>
                <td>
                  <div class="row-actions">
                    <router-link
                      v-tooltip="t('warehouse.open_deficit_card')"
                      :to="{ name: 'admin-warehouse-deficit', params: { id: item.id } }"
                      class="action-icon-btn"
                      data-test="deficit-view-btn"
                      @click.stop
                    >
                      <SvgIcon name="external-link" :width="16" :height="16" />
                    </router-link>
                    <template v-if="item.status === 'open'">
                      <button
                        v-tooltip="t('warehouse.deficit_status_in_progress')"
                        class="inline-action-btn inline-action-btn--used"
                        data-test="deficit-mark-in-progress-btn"
                        @click.stop="updateDeficitStatus(item.id, 'in_progress')"
                      >
                        <SvgIcon name="play" :width="14" :height="14" />
                        {{ t('warehouse.deficit_status_in_progress') }}
                      </button>
                    </template>
                    <template v-if="item.status === 'in_progress'">
                      <button
                        v-tooltip="t('warehouse.deficit_status_resolved')"
                        class="inline-action-btn inline-action-btn--used"
                        data-test="deficit-mark-resolved-btn"
                        @click.stop="updateDeficitStatus(item.id, 'resolved')"
                      >
                        <SvgIcon name="check" :width="14" :height="14" />
                        {{ t('warehouse.deficit_status_resolved') }}
                      </button>
                    </template>
                    <button
                      v-tooltip="t('warehouse.btn_delete')"
                      class="action-icon-btn action-danger"
                      data-test="deficit-delete-btn"
                      @click.stop="confirmDeleteDeficit(item.id, tf(item.productName))"
                    >
                      <SvgIcon name="trash" :width="16" :height="16" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="deficitPagination.total.value > 0" class="pagination-bar" data-test="warehouse-deficit-pagination">
          <div class="page-size" data-test="warehouse-deficit-page-size">
            <span>{{ t('warehouse.page_size') }}</span>
            <CustomSelect
              v-model="deficitPageSizeStr"
              :options="PAGE_SIZE_OPTIONS"
              :open-up="true"
              class="custom-select-sm"
            />
          </div>
          <div class="pagination-nav">
            <button
              class="btn btn-icon btn-sm"
              :disabled="!deficitPagination.hasPrev.value"
              :style="{ display: deficitPagination.totalPages.value <= 1 ? 'none' : 'flex' }"
              data-test="warehouse-deficit-prev-page"
              @click="deficitPagination.prev()"
            >
              <SvgIcon
                name="chevron-right"
                :width="14"
                :height="14"
                style="transform: rotate(180deg)"
              />
            </button>
            <div class="pagination-pages">
              <template v-for="(p, i) in deficitPagination.pageNumbers()" :key="i">
                <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                <button
                  v-else
                  class="page-btn"
                  :class="{ active: p === deficitPagination.page.value }"
                  :data-test="`warehouse-deficit-page-${p}`"
                  @click="deficitPagination.goTo(p as number)"
                >
                  {{ p }}
                </button>
              </template>
            </div>
            <button
              class="btn btn-icon btn-sm"
              :disabled="!deficitPagination.hasNext.value"
              :style="{ display: deficitPagination.totalPages.value <= 1 ? 'none' : 'flex' }"
              data-test="warehouse-deficit-next-page"
              @click="deficitPagination.next()"
            >
              <SvgIcon name="chevron-right" :width="14" :height="14" />
            </button>
          </div>
          <div class="pagination-info">
            <span>{{ deficitPagination.showingFrom }}-{{ deficitPagination.showingTo }}</span>
            <span>&nbsp;{{ t('warehouse.of') }}&nbsp;</span>
            <span>{{ deficitPagination.total.value }}</span>
          </div>
        </div>
      </GlassPanel>
    </div>

    <!-- ════════════════════════════════════════════════════════════════════════
         Delete confirmation modal
         ════════════════════════════════════════════════════════════════════════ -->
    <AppModal
      v-model="showDeleteModal"
      :title="t('warehouse.delete_title')"
      size="small"
      data-test="warehouse-delete-modal"
    >
      <p>{{ t('warehouse.delete_confirm', { name: deletingItem?.name ?? '' }) }}</p>
      <template #footer>
        <button
          type="button"
          class="btn btn-secondary"
          @click="showDeleteModal = false"
        >
          {{ t('btn.cancel') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          @click="handleDelete"
        >
          {{ t('btn.delete') }}
        </button>
      </template>
    </AppModal>

    <!-- ════════════════════════════════════════════════════════════════════════
         Create modals (DEPRECATED)
         ════════════════════════════════════════════════════════════════════════ -->
    <!-- DEPRECATED: <CreateBatchModal> removed — batch creation moved to WarehouseBatchCreatePage -->
    <!-- DEPRECATED: <CreateMovementModal> removed from UI -->
  </div>
</template>
