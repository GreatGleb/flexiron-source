import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createBatch } from '@/services/warehouseService'
import { getProducts, getProduct } from '@/services/productsService'
import { getSupplierList } from '@/services/suppliersService'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type { BatchCreatePayload, StockUnit } from '@/types/warehouse'
import type { ProductListItem, Product } from '@/types/product'
import type { SelectOption } from '@/components/admin/ui/CustomSelect.vue'

export function useWarehouseBatchCreate() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const form = reactive({
    productId: '',
    supplierId: '',
    batchNumber: '',
    lotCode: '',
    quantity: 0,
    unit: 'kg' as StockUnit,
    unitPrice: 0,
    currency: 'EUR',
    receivedAt: new Date().toISOString().slice(0, 10),
    expiresAt: '',
    locationRack: '',
    locationRow: '',
    locationCell: '',
    locationNotes: '',
    certificateRef: '',
    notes: '',
  })

  const saving = ref(false)
  const productsLoading = ref(false)
  const supplierOptions = ref<SelectOption[]>([])

  // ─── Full product data (for linkedSuppliers) ────────────────────────
  const selectedProductFull = ref<Product | null>(null)

  // ─── Product-specific supplier filtering ────────────────────────────
  const productSupplierOptions = computed<SelectOption[]>(() => {
    if (!selectedProduct.value) return []
    const linkedSuppliers = selectedProductFull.value?.linkedSuppliers
    if (linkedSuppliers && linkedSuppliers.length > 0) {
      // linkedSupplier.id is a simple number string ('1'), but supplierOptions.value
      // from the API uses formatted IDs ('sup-001'). Match both formats.
      const linkedIds = new Set<string>()
      for (const s of linkedSuppliers) {
        linkedIds.add(s.id) // raw: '1'
        linkedIds.add(`sup-${String(s.id).padStart(3, '0')}`) // formatted: 'sup-001'
      }
      return supplierOptions.value.filter((opt) => opt.value && linkedIds.has(opt.value))
    }
    if (linkedSuppliers && linkedSuppliers.length === 0) {
      // Product has no linked suppliers — show a disabled-like placeholder
      return [{ value: '__no_suppliers__', label: t('warehouse.batch_create_no_suppliers') }]
    }
    // linkedSuppliers is undefined (product not fully loaded yet) — keep supplier select disabled
    return []
  })

  // ─── Product selection (searchable table with categories) ────────────────
  const products = ref<ProductListItem[]>([])
  const productSearch = ref('')
  const productCategoryFilter = ref('all')
  const selectedProductId = ref<string | null>(null)

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

  const categoryFilterOptions = computed<SelectOption[]>(() => [
    { value: 'all', label: t('warehouse.batch_create_all_categories') },
    ...categories.value.map((c) => ({ value: c.id, label: c.name })),
  ])

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

  const selectedProduct = computed<ProductListItem | null>(() => {
    if (!selectedProductId.value) return null
    return products.value.find((p) => p.id === selectedProductId.value) ?? null
  })

  /** Map a Product's PriceUnit ('EUR/vnt' | 'EUR/kg' | 'EUR/m') to StockUnit ('kg' | 'm' | 'pcs' | 'm2') */
  function mapPriceUnitToStockUnit(priceUnit: string | null): StockUnit | null {
    switch (priceUnit) {
      case 'EUR/kg': return 'kg'
      case 'EUR/m':  return 'm'
      case 'EUR/vnt': return 'pcs'
      default:       return null
    }
  }

  // ─── Watch product selection: auto-fill form.productId, unit, and load full product ──
  watch(selectedProductId, async (newVal) => {
    if (newVal) {
      form.productId = newVal
      // Fetch full product data first (contains priceUnit)
      try {
        selectedProductFull.value = await getProduct(newVal)
        // Then auto-fill unit from product's priceUnit
        const unit = mapPriceUnitToStockUnit(selectedProductFull.value?.priceUnit ?? null)
        if (unit) form.unit = unit
      } catch {
        selectedProductFull.value = null
      }
    } else {
      form.productId = ''
      selectedProductFull.value = null
    }
  })

  const quantityStep = computed(() => form.unit === 'pcs' ? 1 : 0.01)

  const totalCost = computed(() => {
    return (form.quantity || 0) * (form.unitPrice || 0)
  })

  const UNIT_OPTIONS: SelectOption[] = [
    { value: 'kg', label: 'kg' },
    { value: 'm', label: 'm' },
    { value: 'pcs', label: 'pcs' },
    { value: 'm2', label: 'm²' },
  ]

  const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP', 'PLN']

  // ─── Location compose helper ──────────────────────────────────────────
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

  // ─── Load products (searchable table) ────────────────────────────────────
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

  // ─── Load supplier options ───────────────────────────────────────────────
  async function loadOptions() {
    try {
      const suppliers = await getSupplierList()
      supplierOptions.value = [
        { value: '', label: t('warehouse.filter_supplier_all') },
        ...suppliers.map((s) => ({ value: s.id, label: s.company })),
      ]
    } catch {
      supplierOptions.value = [{ value: '', label: t('warehouse.filter_supplier_all') }]
    }
  }

  // ─── Validation ──────────────────────────────────────────────────────
  const errors = ref<Record<string, string>>({})

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!form.productId) e.productId = t('validation.required')
    if (!form.batchNumber.trim()) e.batchNumber = t('validation.required')
    if (!form.lotCode.trim()) e.lotCode = t('validation.required')
    if (!form.quantity || form.quantity <= 0) e.quantity = t('validation.required')
    if (!form.unit) e.unit = t('validation.required')
    if (form.unitPrice <= 0) e.unitPrice = t('validation.required')
    if (!form.receivedAt) e.receivedAt = t('validation.required')
    errors.value = e
    return Object.keys(e).length === 0
  }

  function clearError(field: string) {
    if (errors.value[field]) {
      const next = { ...errors.value }
      delete next[field]
      errors.value = next
    }
  }

  const isFormValid = computed(() => {
    return (
      form.productId &&
      form.batchNumber.trim() &&
      form.lotCode.trim() &&
      form.quantity > 0 &&
      form.unit &&
      form.unitPrice > 0 &&
      form.receivedAt
    )
  })

  // ─── Save ────────────────────────────────────────────────────────────
  async function save(fileIds?: string[]): Promise<string | null> {
    if (!validate()) {
      toast.error(t('warehouse.toast_validation_error'))
      return null
    }

    saving.value = true
    try {
      const payload: BatchCreatePayload & { fileIds?: string[] } = {
        productId: form.productId,
        supplierId: form.supplierId || null,
        batchNumber: form.batchNumber.trim(),
        lotCode: form.lotCode.trim(),
        quantity: form.quantity,
        unit: form.unit,
        unitPrice: form.unitPrice,
        currency: form.currency,
        receivedAt: form.receivedAt,
        expiresAt: form.expiresAt || null,
        location: composeLocation(form.locationRack, form.locationRow, form.locationCell, form.locationNotes),
        certificateRef: form.certificateRef || null,
        notes: form.notes || null,
      }
      if (fileIds && fileIds.length > 0) {
        payload.fileIds = fileIds
      }
      const batch = await createBatch(payload)
      toast.success(t('warehouse.toast_batch_created'))
      return batch.id
    } catch {
      toast.error(t('warehouse.toast_error_save'))
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    form, saving, errors, isFormValid,
    productsLoading, supplierOptions, productSupplierOptions,
    UNIT_OPTIONS, CURRENCY_OPTIONS,
    quantityStep, totalCost,
    loadOptions, save,
    // Product selection
    products,
    productSearch,
    productCategoryFilter,
    categoryFilterOptions,
    filteredProducts,
    selectedProductId,
    selectedProduct,
    loadProducts,
    tf,
    clearError,
  }
}
