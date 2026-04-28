import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getProduct, patchProduct } from '@/services/productsService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import type { Product, ProductFieldValue } from '@/types/product'

type BasicFields = Pick<Product, 'name' | 'sku' | 'description' | 'price' | 'minStock' | 'priceUnit'>
type FieldValueMap = Record<string, ProductFieldValue['value']>

export function useProductCard(id: string) {
  const { t } = useI18n()
  const toast = useToast()

  const product = ref<Product | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

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
  // JSON baseline for dirty detection of dynamic fields
  const originalFieldValues = ref<string>('')

  const fieldValuesChanged = computed(() => {
    return JSON.stringify(fieldValues.value) !== originalFieldValues.value
  })

  const isAnythingDirty = computed(() => dirty.isDirty.value || fieldValuesChanged.value)

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
        map[fv.fieldId] = fv.value
      }
      fieldValues.value = map
      originalFieldValues.value = JSON.stringify(map)
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

  return {
    product,
    loading,
    saving,
    error,
    form,
    fieldValues,
    isAnythingDirty,
    load,
    save,
    discard,
  }
}
