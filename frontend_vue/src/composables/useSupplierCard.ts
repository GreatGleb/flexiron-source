import { ref } from 'vue'
import { getSupplier, patchSupplier } from '@/services/suppliersService'
import { useDirtyCheck } from './useDirtyCheck'
import type { SupplierCardData } from '@/types/supplier'

export function useSupplierCard(id: string) {
  const supplier = ref<SupplierCardData | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const dirty = useDirtyCheck(supplier)

  async function load() {
    loading.value = true
    error.value = null
    try {
      supplier.value = await getSupplier(id)
      dirty.capture()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load supplier'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!supplier.value || !dirty.isDirty.value) return
    saving.value = true
    error.value = null
    try {
      // Merge-patch: send ONLY dirty fields. Server merges into stored entity.
      const patch = dirty.diff() as Partial<SupplierCardData>
      if (Object.keys(patch).length === 0) return
      supplier.value = await patchSupplier(id, patch)
      dirty.capture()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save supplier'
    } finally {
      saving.value = false
    }
  }

  return { supplier, loading, saving, error, isDirty: dirty.isDirty, load, save }
}
