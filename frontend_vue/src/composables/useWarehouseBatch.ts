import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getBatch, patchBatch, deleteBatch, getMovements, getOffcuts } from '@/services/warehouseService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import { useTranslatedField } from './useTranslatedData'
import type { WarehouseBatch, BatchPatchPayload, BatchStatus, MovementListItem, OffcutListItem } from '@/types/warehouse'

export function useWarehouseBatch(id: string) {
  const { t } = useI18n()
  const router = useRouter()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const batch = ref<WarehouseBatch | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const form = ref<{
    batchNumber: string
    lotCode: string
    quantity: number
    unitPrice: number
    location: string | null
    certificateRef: string | null
    status: BatchStatus
    notes: string | null
  }>({
    batchNumber: '',
    lotCode: '',
    quantity: 0,
    unitPrice: 0,
    location: null,
    certificateRef: null,
    status: 'available',
    notes: null,
  })

  const dirty = useDirtyCheck(form)

  const isAnythingDirty = computed(() => dirty.isDirty.value)

  const movements = ref<MovementListItem[]>([])
  const movementsLoading = ref(false)

  const offcuts = ref<OffcutListItem[]>([])
  const offcutsLoading = ref(false)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await getBatch(id)
      batch.value = data
      form.value = {
        batchNumber: data.batchNumber,
        lotCode: data.lotCode,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        location: data.location,
        certificateRef: data.certificateRef,
        status: data.status,
        notes: data.notes,
      }
      dirty.capture()

      await Promise.all([loadMovements(), loadOffcuts()])
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load batch'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!batch.value) return
    saving.value = true
    try {
      const delta = dirty.diff() as BatchPatchPayload
      const updated = await patchBatch(id, delta)
      batch.value = updated
      form.value = {
        batchNumber: updated.batchNumber,
        lotCode: updated.lotCode,
        quantity: updated.quantity,
        unitPrice: updated.unitPrice,
        location: updated.location,
        certificateRef: updated.certificateRef,
        status: updated.status,
        notes: updated.notes,
      }
      dirty.capture()
      toast.success(t('warehouse.toast_batch_saved'))
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    if (!batch.value) return
    form.value = {
      batchNumber: batch.value.batchNumber,
      lotCode: batch.value.lotCode,
      quantity: batch.value.quantity,
      unitPrice: batch.value.unitPrice,
      location: batch.value.location,
      certificateRef: batch.value.certificateRef,
      status: batch.value.status,
      notes: batch.value.notes,
    }
    dirty.capture()
  }

  async function remove() {
    if (!batch.value) return
    saving.value = true
    try {
      await deleteBatch(id)
      toast.success(t('warehouse.toast_batch_deleted'))
      router.push({ name: 'admin-warehouse', params: { tab: 'batches' } })
    } catch {
      toast.error(t('warehouse.toast_error_save'))
    } finally {
      saving.value = false
    }
  }

  async function loadMovements() {
    if (!batch.value) return
    movementsLoading.value = true
    try {
      const response = await getMovements(
        { search: '', batchNumber: batch.value.batchNumber },
        { page: 1, pageSize: 50 },
      )
      movements.value = response.items
    } catch {
      movements.value = []
    } finally {
      movementsLoading.value = false
    }
  }

  async function loadOffcuts() {
    if (!batch.value) return
    offcutsLoading.value = true
    try {
      const response = await getOffcuts(
        { search: '', batchNumber: batch.value.batchNumber },
        { page: 1, pageSize: 50 },
      )
      offcuts.value = response.items
    } catch {
      offcuts.value = []
    } finally {
      offcutsLoading.value = false
    }
  }

  return {
    batch,
    loading,
    saving,
    error,
    form,
    isAnythingDirty,
    movements,
    movementsLoading,
    offcuts,
    offcutsLoading,
    load,
    save,
    discard,
    remove,
    loadMovements,
    loadOffcuts,
    tf,
  }
}
