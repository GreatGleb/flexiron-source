import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProduct, patchProduct } from '@/services/productsService'
import { getCategories } from '@/services/categoriesService'
import { getSuppliers } from '@/services/suppliersService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import { useSettings } from './useSettings'
import { toTranslatedString } from '@/types/i18n'
import type { Product, ProductFieldValue, LinkedSupplier } from '@/types/product'
import type { TranslatedString } from '@/types/i18n'
import type { CategoryListItem } from '@/types/category'
import type { Supplier } from '@/types/supplier'
import type { UomConversion } from '@/types/settings'

// Extended form type with all editable fields
interface ProductForm {
  name: TranslatedString | null
  description: TranslatedString | null
  sku: string | null
  price: number | null
  priceQuantity: number
  minStock: number | null
  currencyId: string | null
  purchaseUomId: string | null
  warehouseUomId: string | null
  saleUomId: string | null
  purchaseToWarehouseFormulaType: string | null
  purchaseToWarehouseFactor: number | null
  warehouseToSaleFormulaType: string | null
  warehouseToSaleFactor: number | null
}
type FieldValueMap = Record<string, ProductFieldValue['value']>

export function useProductCard(id: string) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()
  const { settings } = useSettings()

  const product = ref<Product | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const categories = ref<CategoryListItem[]>([])
  const suppliersList = ref<Supplier[]>([])

  const form = ref<ProductForm>({
    name: null,
    sku: null,
    description: null,
    price: null,
    priceQuantity: 1,
    minStock: null,
    currencyId: null,
    purchaseUomId: null,
    warehouseUomId: null,
    saleUomId: null,
    purchaseToWarehouseFormulaType: null,
    purchaseToWarehouseFactor: null,
    warehouseToSaleFormulaType: null,
    warehouseToSaleFactor: null,
  })
  const dirty = useDirtyCheck(form)

  // v-model.number sets NaN when input is cleared — normalize to null immediately.
  watch(
    () => [
      form.value.price,
      form.value.minStock,
      form.value.purchaseToWarehouseFactor,
      form.value.warehouseToSaleFactor,
    ],
    ([price, minStock, p2wf, w2sf]) => {
      if (Number.isNaN(price as unknown)) form.value.price = null
      if (Number.isNaN(minStock as unknown)) form.value.minStock = null
      if (Number.isNaN(p2wf as unknown)) form.value.purchaseToWarehouseFactor = null
      if (Number.isNaN(w2sf as unknown)) form.value.warehouseToSaleFactor = null
    },
  )

  // Flat Record<fieldId, value> for v-model binding per dynamic field
  const fieldValues = ref<FieldValueMap>({})
  const originalFieldValues = ref<string>(JSON.stringify({}))

  const fieldValuesChanged = computed(() => {
    return JSON.stringify(fieldValues.value) !== originalFieldValues.value
  })

  // Editable linked suppliers
  const linkedSuppliers = ref<LinkedSupplier[]>([])
  const originalLinkedSuppliers = ref<string>('[]')

  const linkedSuppliersChanged = computed(() => {
    return JSON.stringify(linkedSuppliers.value) !== originalLinkedSuppliers.value
  })

  const isAnythingDirty = computed(
    () => dirty.isDirty.value || fieldValuesChanged.value || linkedSuppliersChanged.value,
  )

  function getCategoryPath(categoryId: string): string {
    const parts: string[] = []
    let current = categories.value.find((c) => c.id === categoryId)
    while (current) {
      parts.unshift(tf(current.name))
      current = current.parentId
        ? categories.value.find((c) => c.id === current!.parentId)
        : undefined
    }
    return parts.join(' → ')
  }

  function addLinkedSupplier(entry: LinkedSupplier) {
    if (linkedSuppliers.value.some((s) => s.id === entry.id)) return
    linkedSuppliers.value = [...linkedSuppliers.value, entry]
  }

  function removeLinkedSupplier(supplierId: string) {
    linkedSuppliers.value = linkedSuppliers.value.filter((s) => s.id !== supplierId)
  }

  async function loadCategories() {
    try {
      const res = await getCategories({ search: '' }, 1, 999)
      categories.value = res.items
    } catch {
      // non-critical
    }
  }

  async function loadSuppliers() {
    try {
      const res = await getSuppliers(
        { search: '', status: 'all', rating: 0, categories: [] },
        { page: 1, pageSize: 999 },
      )
      suppliersList.value = res.items
    } catch {
      // non-critical
    }
  }

  /**
   * Look up a matching conversion rule from global settings.
   * Returns the factor if a static conversion exists, otherwise null.
   */
  function findConversionFactor(fromUomId: string | null, toUomId: string | null): number | null {
    if (!fromUomId || !toUomId) return null
    const conv = (settings.conversions ?? []).find(
      (c: UomConversion) =>
        c.fromUomId === fromUomId &&
        c.toUomId === toUomId &&
        c.type === 'static' &&
        c.factor != null,
    )
    return conv?.factor ?? null
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getProduct(id)
      product.value = data
      // Normalize description: old products may have it as a plain string
      const normalizedDescription: TranslatedString | null =
        data.description === null
          ? null
          : typeof data.description === 'string'
            ? toTranslatedString(data.description, locale.value)
            : (data.description as TranslatedString)

      // Resolve default conversion factors from global settings if product has none
      const defaultP2wFactor =
        data.purchaseToWarehouseFactor ??
        findConversionFactor(data.purchaseUomId, data.warehouseUomId)
      const defaultW2sFactor =
        data.warehouseToSaleFactor ?? findConversionFactor(data.warehouseUomId, data.saleUomId)

      form.value = {
        name: data.name,
        sku: data.sku,
        description: normalizedDescription,
        price: data.price,
        priceQuantity: data.priceQuantity ?? 1,
        minStock: data.minStock,
        currencyId: data.currencyId,
        purchaseUomId: data.purchaseUomId,
        warehouseUomId: data.warehouseUomId,
        saleUomId: data.saleUomId,
        purchaseToWarehouseFormulaType: data.purchaseToWarehouseFormulaType,
        purchaseToWarehouseFactor: defaultP2wFactor,
        warehouseToSaleFormulaType: data.warehouseToSaleFormulaType,
        warehouseToSaleFactor: defaultW2sFactor,
      }
      dirty.capture()
      const map: FieldValueMap = {}
      for (const fv of data.fieldValues) {
        if (fv.fieldType === 'file') {
          map[fv.fieldId] = Array.isArray(fv.value)
            ? fv.value
            : fv.value
              ? [fv.value as string]
              : []
        } else {
          map[fv.fieldId] = fv.value
        }
      }
      fieldValues.value = map
      originalFieldValues.value = JSON.stringify(map)
      linkedSuppliers.value = JSON.parse(JSON.stringify(data.linkedSuppliers)) as LinkedSupplier[]
      originalLinkedSuppliers.value = JSON.stringify(data.linkedSuppliers)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load product'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!isAnythingDirty.value) return
    saving.value = true
    try {
      const delta: Parameters<typeof patchProduct>[1] = {}
      if (dirty.isDirty.value) {
        Object.assign(delta, dirty.diff())
        if (delta.sku === '') delta.sku = null
        // Clean NaN values
        if (Number.isNaN(delta.purchaseToWarehouseFactor as unknown))
          delta.purchaseToWarehouseFactor = null
        if (Number.isNaN(delta.warehouseToSaleFactor as unknown)) delta.warehouseToSaleFactor = null
        if (Number.isNaN(delta.priceQuantity as unknown)) delta.priceQuantity = 1
      }
      if (fieldValuesChanged.value && product.value) {
        delta.fieldValues = product.value.fieldValues.map((fv) => {
          const raw = fieldValues.value[fv.fieldId]
          const value =
            fv.fieldType === 'number' && Number.isNaN(raw as unknown) ? null : (raw ?? null)
          return { ...fv, value }
        })
      }
      if (linkedSuppliersChanged.value) {
        delta.linkedSuppliers = JSON.parse(
          JSON.stringify(linkedSuppliers.value),
        ) as LinkedSupplier[]
      }
      await patchProduct(id, delta, locale.value)
      toast.success(t('products.toast_saved'))
      await load()
    } catch {
      toast.error(t('products.toast_error'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    return load()
  }

  // ─── Watch UoM changes → auto-fill conversion factors from settings if not yet set ──
  watch(
    () => [form.value.purchaseUomId, form.value.warehouseUomId],
    ([pUom, wUom]) => {
      // Only auto-fill if the factor is currently null (not manually set)
      const current = form.value.purchaseToWarehouseFactor
      if (current == null && pUom && wUom) {
        const defaultFactor = findConversionFactor(pUom, wUom)
        if (defaultFactor != null) {
          form.value.purchaseToWarehouseFactor = defaultFactor
          form.value.purchaseToWarehouseFormulaType = 'static'
        }
      }
    },
  )

  watch(
    () => [form.value.warehouseUomId, form.value.saleUomId],
    ([wUom, sUom]) => {
      // Only auto-fill if the factor is currently null (not manually set)
      const current = form.value.warehouseToSaleFactor
      if (current == null && wUom && sUom) {
        const defaultFactor = findConversionFactor(wUom, sUom)
        if (defaultFactor != null) {
          form.value.warehouseToSaleFactor = defaultFactor
          form.value.warehouseToSaleFormulaType = 'static'
        }
      }
    },
  )

  loadCategories()
  loadSuppliers()

  return {
    product,
    loading,
    saving,
    error,
    form,
    fieldValues,
    linkedSuppliers,
    suppliersList,
    isAnythingDirty,
    categories,
    getCategoryPath,
    addLinkedSupplier,
    removeLinkedSupplier,
    load,
    save,
    discard,
    tf,
  }
}
