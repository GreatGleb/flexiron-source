import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProduct, patchProduct } from '@/services/productsService'
import { getCategories } from '@/services/categoriesService'
import { getSuppliers } from '@/services/suppliersService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import type { Product, ProductFieldValue, LinkedSupplier } from '@/types/product'
import type { CategoryListItem } from '@/types/category'
import type { Supplier } from '@/types/supplier'

type BasicFields = Pick<Product, 'name' | 'sku' | 'description' | 'price' | 'minStock' | 'priceUnit'>
type FieldValueMap = Record<string, ProductFieldValue['value']>

export function useProductCard(id: string) {
  const { t } = useI18n()
  const toast = useToast()

  const product = ref<Product | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const categories = ref<CategoryListItem[]>([])
  const suppliersList = ref<Supplier[]>([])

  const form = ref<BasicFields>({
    name: '',
    sku: null,
    description: null,
    price: null,
    minStock: null,
    priceUnit: null,
  })
  const dirty = useDirtyCheck(form)

  // v-model.number sets NaN when input is cleared — normalize to null immediately
  watch(
    form,
    (val) => {
      if (Number.isNaN(val.price as unknown)) form.value.price = null
      if (Number.isNaN(val.minStock as unknown)) form.value.minStock = null
    },
    { deep: true },
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
      parts.unshift(current.name)
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

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getProduct(id)
      product.value = data
      form.value = {
        name: data.name,
        sku: data.sku,
        description: data.description,
        price: data.price,
        minStock: data.minStock,
        priceUnit: data.priceUnit,
      }
      dirty.capture()
      const map: FieldValueMap = {}
      for (const fv of data.fieldValues) {
        if (fv.fieldType === 'file') {
          map[fv.fieldId] = Array.isArray(fv.value) ? fv.value : fv.value ? [fv.value as string] : []
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
        if (delta.description === '') delta.description = null
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
        delta.linkedSuppliers = JSON.parse(JSON.stringify(linkedSuppliers.value)) as LinkedSupplier[]
      }
      await patchProduct(id, delta)
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
  }
}
