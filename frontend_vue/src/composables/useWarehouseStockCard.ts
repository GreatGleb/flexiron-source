import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getStockItem, patchStockItem, deleteStockAuditEntry } from '@/services/warehouseService'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import { mergeLocaleValue } from '@/types/i18n'
import type { StockOverviewItem, StockPatchPayload, StockUnit, StockAuditEntry } from '@/types/warehouse'
import type { TranslatedString } from '@/types/i18n'

export function useWarehouseStockCard(productId: string) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const item = ref<StockOverviewItem | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // Audit log
  const auditLog = ref<StockAuditEntry[]>([])
  const auditLoading = ref(false)

  const form = ref<{
    productName: TranslatedString | null
    unit: StockUnit
    avgUnitPrice: number
    minStock: number | null
    categoryName: TranslatedString | null
  }>({
    productName: null,
    unit: 'kg',
    avgUnitPrice: 0,
    minStock: null,
    categoryName: null,
  })

  // Simple dirty tracking without useDirtyCheck
  let snapshot = ''
  const isAnythingDirty = ref(false)

  function captureSnapshot() {
    snapshot = JSON.stringify(form.value)
    isAnythingDirty.value = false
  }

  function checkDirty() {
    isAnythingDirty.value = JSON.stringify(form.value) !== snapshot
  }

  // Watch minStock changes from v-model
  watch(
    () => form.value.minStock,
    () => {
      checkDirty()
    },
  )

  // Computed get/set for current-locale product name
  const formName = computed({
    get: () => {
      if (!form.value.productName) return ''
      return form.value.productName[locale.value as keyof TranslatedString] ?? ''
    },
    set: (val: string) => {
      form.value.productName = mergeLocaleValue(form.value.productName, val, locale.value)
      checkDirty()
    },
  })

  // Computed get/set for current-locale category name
  const formCategoryName = computed({
    get: () => {
      if (!form.value.categoryName) return ''
      return form.value.categoryName[locale.value as keyof TranslatedString] ?? ''
    },
    set: (val: string) => {
      form.value.categoryName = mergeLocaleValue(form.value.categoryName, val, locale.value)
      checkDirty()
    },
  })

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getStockItem(productId)
      item.value = data
      form.value = {
        productName: data.productName,
        unit: data.unit,
        avgUnitPrice: data.avgUnitPrice,
        minStock: data.minStock,
        categoryName: data.categoryName ?? null,
      }
      auditLog.value = data.auditLog ?? []
      captureSnapshot()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load stock item'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!item.value) return
    saving.value = true
    try {
      const delta = buildDelta()
      const updated = await patchStockItem(productId, delta)
      item.value = updated
      form.value = {
        productName: updated.productName,
        unit: updated.unit,
        avgUnitPrice: updated.avgUnitPrice,
        minStock: updated.minStock,
        categoryName: updated.categoryName ?? null,
      }
      captureSnapshot()
      toast.success(t('warehouse.toast_stock_saved'))
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  function buildDelta(): StockPatchPayload {
    const current = form.value
    const delta: StockPatchPayload = {}
    const snap: Record<string, unknown> = JSON.parse(snapshot)
    if (JSON.stringify(current.productName) !== JSON.stringify(snap.productName)) {
      delta.productName = current.productName ?? undefined
    }
    if (JSON.stringify(current.unit) !== JSON.stringify(snap.unit)) {
      delta.unit = current.unit
    }
    if (JSON.stringify(current.avgUnitPrice) !== JSON.stringify(snap.avgUnitPrice)) {
      delta.avgUnitPrice = current.avgUnitPrice
    }
    if (JSON.stringify(current.minStock) !== JSON.stringify(snap.minStock)) {
      delta.minStock = current.minStock
    }
    if (JSON.stringify(current.categoryName) !== JSON.stringify(snap.categoryName)) {
      delta.categoryName = current.categoryName ?? undefined
    }
    return delta
  }

  function discard() {
    if (!item.value) return
    form.value = {
      productName: item.value.productName,
      unit: item.value.unit,
      avgUnitPrice: item.value.avgUnitPrice,
      minStock: item.value.minStock,
      categoryName: item.value.categoryName ?? null,
    }
    captureSnapshot()
  }

  async function deleteAuditEntry(entryIndex: number) {
    try {
      await deleteStockAuditEntry(productId, entryIndex)
      auditLog.value.splice(entryIndex, 1)
      toast.success(t('msg.audit_deleted'))
    } catch {
      toast.error(t('warehouse.toast_error'))
    }
  }

  return {
    item,
    loading,
    saving,
    error,
    form,
    formName,
    formCategoryName,
    isAnythingDirty,
    auditLog,
    auditLoading,
    load,
    save,
    discard,
    deleteAuditEntry,
    tf,
  }
}
