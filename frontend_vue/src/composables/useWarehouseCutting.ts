import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getBatch, getBatches, executeCutting } from '@/services/warehouseService'
import { getProduct } from '@/services/productsService'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import {
  computeCuttingConsumption,
  isLinearBatchUnit,
  type CuttingConsumption,
  type MaterialFailureReason,
} from '@/domain/cutting'
import { roundQuantity } from '@/domain/quantity'
import type { BatchListItem, OffcutCreatePayload, WarehouseBatch } from '@/types/warehouse'

/** Один вид получаемых кусков: размеры одного куска плюс сколько их. */
export interface CuttingRow {
  offcutType: 'sheet' | 'linear'
  lengthMm: number | null
  widthMm: number | null
  thicknessMm: number | null
  weightKg: number | null
  /** СЧЁТЧИК КУСКОВ, не количество материала */
  quantity: number
  location: string
  notes: string
}

/** Почему операцию нельзя выполнить — в терминах, которые можно показать. */
export type CuttingProblem =
  | { kind: MaterialFailureReason; detail: string; row: number }
  | { kind: 'no_offcuts' }
  | { kind: 'insufficient'; consumed: number; remaining: number }
  | { kind: 'kerf_not_applicable' }

function emptyRow(): CuttingRow {
  return {
    offcutType: 'linear',
    lengthMm: null,
    widthMm: null,
    thicknessMm: null,
    weightKg: null,
    quantity: 1,
    location: '',
    notes: '',
  }
}

/**
 * Резка партии: из неё выходят куски, пропилы и отходы.
 *
 * Расход НЕ ВВОДИТСЯ — он считается из кусков, ширины реза и отходов, и оператор
 * видит его до подтверждения. Два поля, которые обязаны совпадать, расходятся ровно
 * тогда, когда их два; поэтому здесь одно, а сервер считает его заново и отказывает
 * при расхождении.
 *
 * Операция немедленная (quick-action), а не clean-slate: это проводка по складу, а не
 * редактирование карточки. Копить её до «Сохранить» нечего — она либо выполнена, либо
 * нет.
 */
export function useWarehouseCutting() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  // ─── Партия-источник ──────────────────────────────────────────────────────
  const batches = ref<BatchListItem[]>([])
  const batchesLoading = ref(false)
  const batchSearch = ref('')
  const batch = ref<WarehouseBatch | null>(null)
  const batchLoading = ref(false)
  /**
   * Категория товара — её нет на партии, а обрезку она нужна: список обрезков умеет
   * фильтр по категориям, и кусок без неё выпал бы из выдачи. Берётся у товара, а не
   * спрашивается у оператора: у обрезка та же категория, что у металла, из которого
   * он вышел.
   */
  const productCategoryId = ref<string | null>(null)

  async function loadBatches() {
    batchesLoading.value = true
    try {
      const response = await getBatches(
        { search: batchSearch.value, sortBy: 'receivedAt', sortDir: 'desc' },
        { page: 1, pageSize: 50 },
      )
      batches.value = response.items
    } catch {
      batches.value = []
    } finally {
      batchesLoading.value = false
    }
  }

  async function selectBatch(id: string) {
    batchLoading.value = true
    try {
      const loaded = await getBatch(id)
      batch.value = loaded
      productCategoryId.value = await getProduct(loaded.productId)
        .then((product) => product.categoryId)
        .catch(() => null)
    } catch {
      batch.value = null
      productCategoryId.value = null
      toast.error(t('warehouse.cutting_toast_batch_error'))
    } finally {
      batchLoading.value = false
    }
  }

  /** Вернуться к выбору партии: форма кусков остаётся, партия — нет. */
  function clearBatch() {
    batch.value = null
    productCategoryId.value = null
  }

  // ─── Форма ────────────────────────────────────────────────────────────────
  const rows = reactive<CuttingRow[]>([emptyRow()])
  const form = reactive({ kerfMm: 3, wasteQuantity: 0, notes: '' })

  function addRow() {
    rows.push(emptyRow())
  }

  function removeRow(index: number) {
    // Резка без кусков — не резка, поэтому последнюю строку убрать нельзя.
    if (rows.length > 1) rows.splice(index, 1)
  }

  // Пустое числовое поле даёт NaN (пункт #25 правил). NaN в расчёте — это отказ, а
  // не тишина, но в payload он не поедет: приводим к null здесь.
  watch(
    () => rows.map((r) => [r.lengthMm, r.widthMm, r.thicknessMm, r.weightKg]),
    () => {
      for (const row of rows) {
        if (Number.isNaN(row.lengthMm)) row.lengthMm = null
        if (Number.isNaN(row.widthMm)) row.widthMm = null
        if (Number.isNaN(row.thicknessMm)) row.thicknessMm = null
        if (Number.isNaN(row.weightKg)) row.weightKg = null
      }
    },
    { deep: true },
  )

  const uomId = computed(() => batch.value?.uomId ?? '')

  /** Ширина реза имеет смысл только у партии, которая меряется по длине. */
  const kerfApplies = computed(() => (uomId.value ? isLinearBatchUnit(uomId.value) : false))

  /** Пропил, который реально пойдёт в расчёт: у нелинейной партии его нет. */
  const effectiveKerfMm = computed(() => (kerfApplies.value ? form.kerfMm || 0 : 0))

  const consumption = computed<CuttingConsumption | null>(() => {
    if (!batch.value) return null
    const result = computeCuttingConsumption({
      offcuts: rows,
      kerfMm: effectiveKerfMm.value,
      wasteQuantity: form.wasteQuantity || 0,
      uomId: batch.value.uomId,
    })
    return result.ok ? result : null
  })

  /** Остаток партии после операции — то, что оператор увидит на карточке. */
  const remainingAfter = computed(() => {
    if (!batch.value || !consumption.value) return null
    return roundQuantity(batch.value.quantityRemaining - consumption.value.consumed)
  })

  const problem = computed<CuttingProblem | null>(() => {
    if (!batch.value) return null
    if (rows.length === 0) return { kind: 'no_offcuts' }
    const result = computeCuttingConsumption({
      offcuts: rows,
      kerfMm: effectiveKerfMm.value,
      wasteQuantity: form.wasteQuantity || 0,
      uomId: batch.value.uomId,
    })
    if (!result.ok) return { kind: result.reason, detail: result.detail, row: result.offcutIndex }
    if (result.consumed > batch.value.quantityRemaining) {
      return {
        kind: 'insufficient',
        consumed: result.consumed,
        remaining: batch.value.quantityRemaining,
      }
    }
    return null
  })

  const saving = ref(false)
  const canSubmit = computed(
    () =>
      batch.value != null && problem.value == null && consumption.value != null && !saving.value,
  )

  /**
   * Выполняет резку. `sourceQuantity` уходит на сервер не как ввод, а как то же
   * число, что показано оператору: сервер считает его заново и отказывает, если оно
   * разошлось.
   */
  async function submit(): Promise<boolean> {
    const source = batch.value
    const total = consumption.value
    if (!source || !total || problem.value) return false

    saving.value = true
    try {
      const offcuts: Omit<OffcutCreatePayload, 'batchId'>[] = rows.map((row) => ({
        productId: source.productId,
        categoryId: productCategoryId.value,
        offcutType: row.offcutType,
        lengthMm: row.lengthMm,
        widthMm: row.widthMm,
        thicknessMm: row.thicknessMm,
        weightKg: row.weightKg,
        quantity: row.quantity,
        uomId: source.uomId,
        location: row.location.trim() || source.location,
        notes: row.notes.trim() || null,
      }))

      await executeCutting({
        sourceBatchId: source.id,
        sourceQuantity: total.consumed,
        kerfMm: effectiveKerfMm.value,
        offcuts,
        wasteQuantity: form.wasteQuantity || 0,
        notes: form.notes.trim() || null,
      })
      toast.success(t('warehouse.toast_cutting_executed'))
      return true
    } catch {
      toast.error(t('warehouse.cutting_toast_error'))
      return false
    } finally {
      saving.value = false
    }
  }

  return {
    // Партия
    batches,
    batchesLoading,
    batchSearch,
    batch,
    batchLoading,
    loadBatches,
    selectBatch,
    clearBatch,
    // Форма
    rows,
    form,
    addRow,
    removeRow,
    uomId,
    kerfApplies,
    // Расчёт
    consumption,
    remainingAfter,
    problem,
    canSubmit,
    saving,
    submit,
    tf,
  }
}
