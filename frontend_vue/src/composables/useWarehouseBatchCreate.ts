import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { createBatch } from '@/services/warehouseService'
import { getProducts, getProduct } from '@/services/productsService'
import { getSupplierList } from '@/services/suppliersService'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import { useSettings } from './useSettings'
import type { BatchCreatePayload, StockUnit } from '@/types/warehouse'
import type { ProductListItem, Product } from '@/types/product'
import type { SelectOption } from '@/components/admin/ui/CustomSelect.vue'

export function useWarehouseBatchCreate() {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()
  const { settings } = useSettings()

  const form = reactive({
    productId: '',
    supplierId: '',
    batchNumber: '',
    lotCode: '',
    quantity: 0,
    unit: 'kg' as StockUnit,
    unitPrice: 0,
    currency: settings.constants.defaultCurrency,
    receivedAt: new Date().toISOString().slice(0, 10),
    expiresAt: '',
    locationRack: '',
    locationRow: '',
    locationCell: '',
    locationNotes: '',
    certificateRef: '',
    notes: '',
    // ── Purchase audit fields ──
    receivedQuantity: null as number | null,
    receivedUnitId: null as string | null,
    receivedUnitPrice: null as number | null,
    receivedCurrencyId: null as string | null,
    purchaseToWarehouseRate: null as number | null,
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
      const linkedIds = new Set<string>()
      for (const s of linkedSuppliers) {
        linkedIds.add(s.id)
        linkedIds.add(`sup-${String(s.id).padStart(3, '0')}`)
      }
      return supplierOptions.value.filter((opt) => opt.value && linkedIds.has(opt.value))
    }
    if (linkedSuppliers && linkedSuppliers.length === 0) {
      return [{ value: '__no_suppliers__', label: t('warehouse.batch_create_no_suppliers') }]
    }
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

  /** Auto-fill unit from product's warehouseUomId */
  function autoFillUnit(product: Product | null) {
    if (product?.warehouseUomId) {
      const uom = settings.uoms.find((u: { id: string }) => u.id === product.warehouseUomId)
      if (uom) {
        form.unit = uom.code.en || uom.code.ru || uom.code.lt || form.unit
      }
    }
  }

  // ─── Watch product selection: auto-fill form.productId, unit, and load full product ──
  watch(selectedProductId, async (newVal) => {
    if (newVal) {
      form.productId = newVal
      try {
        selectedProductFull.value = await getProduct(newVal)
        autoFillUnit(selectedProductFull.value)
        // Pre-fill currency from product
        if (selectedProductFull.value?.currencyId) {
          const cur = settings.currencies.find(
            (c: { id: string }) => c.id === selectedProductFull.value!.currencyId,
          )
          if (cur) form.currency = cur.code
        }
      } catch {
        selectedProductFull.value = null
      }
    } else {
      form.productId = ''
      selectedProductFull.value = null
    }
  })

  const quantityStep = computed(() => (form.unit === 'pcs' ? 1 : 0.01))

  const totalCost = computed(() => {
    return (form.quantity || 0) * (form.unitPrice || 0)
  })

  /** Dynamic UoM options from settings */
  const UNIT_OPTIONS = computed<SelectOption[]>(() => {
    const uoms = settings.uoms ?? []
    return uoms.map((u: { id: string; code: { en?: string; ru?: string; lt?: string } }) => {
      const label = u.code.en || u.code.ru || u.code.lt || u.id
      return { value: u.id, label }
    })
  })

  /** Dynamic currency options from settings */
  const CURRENCY_OPTIONS = computed<string[]>(() => {
    return (settings.currencies ?? []).map((c: { code: string }) => c.code)
  })

  /** Pre-fill conversion factor from product when product changes */
  watch(selectedProductFull, (product) => {
    if (product?.purchaseToWarehouseFactor) {
      form.purchaseToWarehouseRate = product.purchaseToWarehouseFactor
    }
  })

  /** Pre-fill receivedCurrencyId from linked supplier's currency when supplier changes */
  watch(
    () => form.supplierId,
    (supplierId) => {
      if (!supplierId || !selectedProductFull.value?.linkedSuppliers) {
        form.receivedCurrencyId = null
        return
      }
      const linkedSupplier = selectedProductFull.value.linkedSuppliers.find(
        (s) => s.id === supplierId,
      )
      if (linkedSupplier?.currency) {
        const cur = settings.currencies.find(
          (c: { code: string }) => c.code === linkedSupplier.currency,
        )
        form.receivedCurrencyId = cur ? cur.id : null
      } else {
        form.receivedCurrencyId = null
      }
    },
  )

  /** Conversion preview: if selected product has different purchaseUom than warehouseUom */
  const conversionPreview = computed(() => {
    if (!selectedProductFull.value) return null
    const product = selectedProductFull.value
    if (!product.purchaseUomId || !product.warehouseUomId) return null
    // If units match, no conversion needed
    if (product.purchaseUomId === product.warehouseUomId) return null
    // Use editable conversion rate (defaults to product's factor)
    const factor = form.purchaseToWarehouseRate || product.purchaseToWarehouseFactor
    if (!factor || factor <= 0) return null
    const qty = form.quantity || 0
    const convertedQty = qty * factor
    // Resolve unit codes from settings for display (locale-aware)
    const cl = ['ru', 'en', 'lt'].includes(locale.value) ? locale.value : 'en'
    const purchaseUom = settings.uoms.find((u: { id: string }) => u.id === product.purchaseUomId)
    const warehouseUom = settings.uoms.find((u: { id: string }) => u.id === product.warehouseUomId)
    const purchaseCode = purchaseUom?.code as Record<string, string | undefined> | undefined
    const warehouseCode = warehouseUom?.code as Record<string, string | undefined> | undefined
    const purchaseUnit =
      purchaseCode?.[cl] || purchaseCode?.en || purchaseCode?.ru || purchaseCode?.lt || '?'
    const warehouseUnit =
      warehouseCode?.[cl] || warehouseCode?.en || warehouseCode?.ru || warehouseCode?.lt || '?'
    return {
      receivedQty: qty,
      receivedUnit: purchaseUnit,
      warehouseQty: convertedQty,
      warehouseUnit,
      factor,
    }
  })

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
        location: composeLocation(
          form.locationRack,
          form.locationRow,
          form.locationCell,
          form.locationNotes,
        ),
        certificateRef: form.certificateRef || null,
        notes: form.notes || null,
        // ── Audit trail fields ──
        receivedQuantity: form.receivedQuantity,
        receivedUnitId: form.receivedUnitId,
        receivedUnitPrice: form.receivedUnitPrice,
        receivedCurrencyId: form.receivedCurrencyId,
        purchaseToWarehouseRate: form.purchaseToWarehouseRate,
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

  function resolveUnitLabel(code: string | null): string {
    if (!code) return '—'
    const uom = settings.uoms.find((u: { code: { en?: string } }) => u.code.en === code)
    if (!uom) return code
    const currentLocale = locale.value as keyof typeof uom.code
    return uom.code[currentLocale] || uom.code.en || uom.code.ru || uom.code.lt || code
  }

  return {
    form,
    saving,
    errors,
    isFormValid,
    productsLoading,
    supplierOptions,
    productSupplierOptions,
    UNIT_OPTIONS,
    CURRENCY_OPTIONS,
    quantityStep,
    totalCost,
    conversionPreview,
    loadOptions,
    save,
    resolveUnitLabel,
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
