import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  getStockItem,
  patchStockItem,
  getBatches,
  getBatchAggregates,
  deleteStockAuditEntry,
} from '@/services/warehouseService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import { mergeLocaleValue } from '@/types/i18n'
import type {
  StockOverviewItem,
  StockUnit,
  StockAuditEntry,
  BatchStatusAggregate,
} from '@/types/warehouse'
import type { TranslatedString } from '@/types/i18n'

export function useWarehouseStockCard(productId: string) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const item = ref<StockOverviewItem | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // ─── Stock aggregates (summed across all batches for this product) ────
  const stockAggregates = ref<BatchStatusAggregate[]>([])
  const stockAggregatesLoading = ref(false)

  /**
   * Total usable quantity = receipt + storage + offcut (goods we can still use).
   * Computed from aggregates, NOT from item.totalQuantity (which may be stale).
   */
  const totalUsableQuantity = computed(() => {
    const aggs = stockAggregates.value
    if (!aggs || aggs.length === 0) return item.value?.totalQuantity ?? 0
    const usableTypes = new Set(['receipt', 'storage', 'offcut'])
    return aggs.filter((a) => usableTypes.has(a.type)).reduce((sum, a) => sum + a.quantity, 0)
  })

  async function loadStockAggregates() {
    stockAggregatesLoading.value = true
    try {
      // Load all batches for this product
      const batchesRes = await getBatches(
        { search: '', productId, sortBy: 'receivedAt', sortDir: 'desc' },
        { page: 1, pageSize: 100 },
      )
      // Load aggregates for each batch and sum them
      const byType: Record<string, number> = {}
      let unit: StockUnit = 'kg'
      for (const batch of batchesRes.items) {
        unit = batch.unit as StockUnit
        const aggs = await getBatchAggregates(batch.id)
        for (const a of aggs) {
          byType[a.type] = (byType[a.type] || 0) + a.quantity
        }
      }
      const result: BatchStatusAggregate[] = Object.entries(byType)
        .filter(([, q]) => q > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([type, quantity]) => ({ type: type as BatchStatusAggregate['type'], quantity, unit }))
      stockAggregates.value = result
    } catch {
      stockAggregates.value = []
    } finally {
      stockAggregatesLoading.value = false
    }
  }

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

  const dirty = useDirtyCheck(form)
  const isAnythingDirty = dirty.isDirty

  // Computed get/set for current-locale product name
  const formName = computed({
    get: () => {
      if (!form.value.productName) return ''
      return form.value.productName[locale.value as keyof TranslatedString] ?? ''
    },
    set: (val: string) => {
      form.value.productName = mergeLocaleValue(form.value.productName, val, locale.value)
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
      dirty.capture()
      // Also load aggregates across all batches for this product
      await loadStockAggregates()
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
      const delta = dirty.diff() as Record<string, unknown>
      if (Object.keys(delta).length === 0) return
      const updated = await patchStockItem(productId, delta)
      item.value = updated
      form.value = {
        productName: updated.productName,
        unit: updated.unit,
        avgUnitPrice: updated.avgUnitPrice,
        minStock: updated.minStock,
        categoryName: updated.categoryName ?? null,
      }
      dirty.capture()
      toast.success(t('warehouse.toast_stock_saved'))
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
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
    dirty.capture()
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
    stockAggregates,
    stockAggregatesLoading,
    totalUsableQuantity,
    auditLog,
    auditLoading,
    load,
    save,
    discard,
    deleteAuditEntry,
    tf,
  }
}
