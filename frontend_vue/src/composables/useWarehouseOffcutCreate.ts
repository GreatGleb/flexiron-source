import { ref, reactive, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getProducts } from '@/services/productsService'
import { getBatches, createOffcut } from '@/services/warehouseService'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type {
  OffcutCreatePayload,
  WarehouseOffcut,
  StockUnit,
  BatchListItem,
} from '@/types/warehouse'
import type { ProductListItem } from '@/types/product'

// ─── Location compose helper (same pattern as useWarehouseBatch / useWarehouseOffcutCard) ──
function composeLocation(rack: string, row: string, cell: string, notes: string): string | null {
  const parts: string[] = []
  if (rack || row || cell) {
    parts.push(`Rack: ${rack} | Row: ${row} | Cell: ${cell}`)
  }
  if (notes) {
    parts.push(`Notes: ${notes}`)
  }
  return parts.length > 0 ? parts.join('\n') : null
}

export function useWarehouseOffcutCreate() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()
  const route = useRoute()
  const router = useRouter()

  // ─── Form state ───────────────────────────────────────────────────────────
  const form = reactive<
    OffcutCreatePayload & {
      locationRack: string
      locationRow: string
      locationCell: string
      locationNotes: string
    }
  >({
    batchId: '',
    productId: '',
    categoryId: null,
    offcutType: undefined,
    lengthMm: null,
    widthMm: null,
    thicknessMm: null,
    weightKg: null,
    quantity: 1,
    unit: 'pcs' as StockUnit,
    location: null,
    notes: null,
    locationRack: '',
    locationRow: '',
    locationCell: '',
    locationNotes: '',
  })

  const saving = ref(false)
  const error = ref<string | null>(null)

  // ─── Pre-selection from query params (batchId + productId) ────────────────
  const preselectedBatchId = ref<string | null>(null)
  const preselectedProductId = ref<string | null>(null)

  const queryBatchId = route.query.batchId as string | undefined
  const queryProductId = route.query.productId as string | undefined

  if (queryBatchId && queryProductId) {
    preselectedBatchId.value = queryBatchId
    preselectedProductId.value = queryProductId
  }

  // ─── Products ─────────────────────────────────────────────────────────────
  const products = ref<ProductListItem[]>([])
  const productsLoading = ref(false)
  const productSearch = ref('')
  const productCategoryFilter = ref<string>('all')
  const selectedProductId = ref<string | null>(null)

  // ─── Categories (derived from products) ───────────────────────────────────
  const categories = computed(() => {
    const map = new Map<string, string>()
    for (const p of products.value) {
      if (p.categoryId && p.categoryName) {
        const name = tf(p.categoryName)
        if (!map.has(p.categoryId)) {
          map.set(p.categoryId, name)
        }
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  })

  const categoryFilterOptions = computed(() => [
    { value: 'all', label: t('warehouse.offcut_create_all_categories') },
    ...categories.value.map((c) => ({ value: c.id, label: c.name })),
  ])

  // ─── Filtered products ────────────────────────────────────────────────────
  const filteredProducts = computed(() => {
    const q = productSearch.value.trim().toLowerCase()
    const cat = productCategoryFilter.value
    return products.value.filter((p) => {
      if (cat !== 'all' && p.categoryId !== cat) return false
      if (q) {
        const name = tf(p.name).toLowerCase()
        if (!name.includes(q)) return false
      }
      return true
    })
  })

  // ─── Batches ──────────────────────────────────────────────────────────────
  const batches = ref<BatchListItem[]>([])
  const batchesLoading = ref(false)
  const batchSearch = ref('')
  const selectedBatchId = ref<string | null>(null)

  const filteredBatches = computed(() => {
    const q = batchSearch.value.trim().toLowerCase()
    if (!q) return batches.value
    return batches.value.filter((b) => {
      return b.batchNumber.toLowerCase().includes(q)
    })
  })

  const noBatchesMessage = computed(() => {
    if (selectedProductId.value && batches.value.length === 0 && !batchesLoading.value) {
      return t('warehouse.offcut_create_no_batches')
    }
    return null
  })

  // ─── After products load, apply product pre-selection ─────────────────────
  watch(
    products,
    (prods) => {
      if (preselectedProductId.value && preselectedBatchId.value && prods.length > 0) {
        selectedProductId.value = preselectedProductId.value
      }
    },
    { once: true },
  )

  // ─── After batches load, apply batch pre-selection ────────────────────────
  watch(batches, (batchList) => {
    if (preselectedBatchId.value && batchList.length > 0) {
      const exists = batchList.find((b) => b.id === preselectedBatchId.value)
      if (exists) {
        selectedBatchId.value = preselectedBatchId.value
      }
      preselectedBatchId.value = null
    }
  })

  // ─── Watch for user changing batch away from pre-selected ─────────────────
  watch(selectedBatchId, (newVal, oldVal) => {
    if (oldVal && newVal !== oldVal) {
      // User actively changed batch — remove query params from URL
      router.replace({ query: {} })
    }
  })

  // ─── Load products ────────────────────────────────────────────────────────
  async function loadProducts() {
    productsLoading.value = true
    try {
      const res = await getProducts(
        { search: '', categoryIds: [], sortBy: 'name', sortDir: 'asc' },
        { page: 1, pageSize: 1000 },
      )
      products.value = res.items
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      productsLoading.value = false
    }
  }

  // ─── Load batches for selected product ────────────────────────────────────
  async function loadBatches(productId: string) {
    batchesLoading.value = true
    batches.value = []
    batchSearch.value = ''
    try {
      const res = await getBatches({ search: '', productId }, { page: 1, pageSize: 100 })
      batches.value = res.items
      // Auto-set unit from the first batch (all batches for a product share the same unit)
      const firstBatch = res.items[0]
      if (firstBatch) {
        form.unit = firstBatch.unit
      }
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      batchesLoading.value = false
    }
  }

  // ─── Determine offcut type from category name ────────────────────────────
  function getOffcutTypeForProduct(
    product: ProductListItem | null,
  ): 'sheet' | 'linear' | undefined {
    if (!product?.categoryName) return undefined
    const name = tf(product.categoryName).toLowerCase()
    // Sheet-related keywords in supported languages
    const sheetKeywords = ['лист', 'sheet', 'lakšt']
    const isSheet = sheetKeywords.some((kw) => name.includes(kw))
    return isSheet ? 'sheet' : 'linear'
  }

  // ─── Selected product (full object for auto-fill) ─────────────────────────
  const selectedProduct = computed(() => {
    if (!selectedProductId.value) return null
    return products.value.find((p) => p.id === selectedProductId.value) ?? null
  })

  // ─── Watch product selection ──────────────────────────────────────────────
  watch(selectedProductId, (newVal) => {
    if (newVal) {
      const product = products.value.find((p) => p.id === newVal) ?? null
      form.productId = newVal
      form.categoryId = product?.categoryId ?? null
      form.offcutType = getOffcutTypeForProduct(product)
      form.batchId = ''
      selectedBatchId.value = null
      loadBatches(newVal)
    } else {
      form.productId = ''
      form.categoryId = null
      form.offcutType = undefined
      form.unit = 'pcs' as StockUnit
      form.batchId = ''
      batches.value = []
      selectedBatchId.value = null
    }
  })

  // ─── Selected batch (full object for auto-fill) ──────────────────────────
  const selectedBatch = computed(() => {
    if (!selectedBatchId.value) return null
    return batches.value.find((b) => b.id === selectedBatchId.value) ?? null
  })

  // ─── Watch batch selection ────────────────────────────────────────────────
  watch(selectedBatchId, (newVal) => {
    form.batchId = newVal ?? ''
    if (newVal) {
      const batch = batches.value.find((b) => b.id === newVal)
      if (batch) form.unit = batch.unit
    }
  })

  // ─── Save ─────────────────────────────────────────────────────────────────
  async function save(fileIds?: string[]): Promise<WarehouseOffcut | null> {
    // Validate required fields
    if (!form.batchId || !form.productId) {
      error.value = t('warehouse.toast_offcut_create_error')
      toast.error(t('warehouse.toast_offcut_create_error'))
      return null
    }

    saving.value = true
    error.value = null
    try {
      // Compose location sub-fields into a single string for the API
      form.location = composeLocation(
        form.locationRack,
        form.locationRow,
        form.locationCell,
        form.locationNotes,
      )
      // Attach file IDs if provided
      if (fileIds && fileIds.length > 0) {
        form.fileIds = fileIds
      }
      const offcut = await createOffcut(form)
      toast.success(t('warehouse.toast_offcut_created'))
      return offcut
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create offcut'
      error.value = msg
      toast.error(t('warehouse.toast_offcut_create_error'))
      return null
    } finally {
      saving.value = false
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────
  function reset() {
    form.batchId = ''
    form.productId = ''
    form.categoryId = null
    form.offcutType = undefined
    form.lengthMm = null
    form.widthMm = null
    form.thicknessMm = null
    form.weightKg = null
    form.quantity = 1
    form.unit = 'pcs' as StockUnit
    form.location = null
    form.notes = null
    form.locationRack = ''
    form.locationRow = ''
    form.locationCell = ''
    form.locationNotes = ''
    selectedProductId.value = null
    selectedBatchId.value = null
    batches.value = []
    batchSearch.value = ''
    productSearch.value = ''
    productCategoryFilter.value = 'all'
    error.value = null
  }

  return {
    // Form
    form,
    saving,
    error,
    save,
    reset,

    // Products
    products,
    productsLoading,
    productSearch,
    productCategoryFilter,
    categoryFilterOptions,
    filteredProducts,
    selectedProductId,
    selectedProduct,
    loadProducts,

    // Batches
    batches,
    batchesLoading,
    batchSearch,
    filteredBatches,
    selectedBatchId,
    selectedBatch,
    noBatchesMessage,

    // Utils
    tf,
  }
}
