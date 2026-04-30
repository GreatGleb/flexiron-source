import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getCategory, patchCategory, putCategoryFields } from '@/services/categoriesService'
import { getSuppliers } from '@/services/suppliersService'
import { useDirtyCheck } from './useDirtyCheck'
import { useToast } from './useToast'
import type { Category, CategoryField } from '@/types/category'
import type { LinkedSupplier } from '@/types/product'
import type { Supplier } from '@/types/supplier'

export function useCategoryCard(id: string) {
  const { t } = useI18n()
  const toast = useToast()

  const category = ref<Category | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  // Only track the three editable header fields — excludes fields[], inheritedFields, counts
  const form = ref<Pick<Category, 'name' | 'parentId' | 'description'>>({
    name: '',
    parentId: null,
    description: null,
  })
  const dirty = useDirtyCheck(form)

  // Working copy of own fields — edited before save, tmp- ids assigned locally
  const localFields = ref<CategoryField[]>([])

  const fieldsChanged = computed(() => {
    if (!category.value) return false
    return JSON.stringify(localFields.value) !== JSON.stringify(category.value.fields)
  })

  const suppliersList = ref<Supplier[]>([])
  const linkedSuppliers = ref<LinkedSupplier[]>([])
  const originalLinkedSuppliers = ref<string>('[]')

  const linkedSuppliersChanged = computed(
    () => JSON.stringify(linkedSuppliers.value) !== originalLinkedSuppliers.value,
  )

  const isAnythingDirty = computed(
    () => dirty.isDirty.value || fieldsChanged.value || linkedSuppliersChanged.value,
  )

  function addLinkedSupplier(entry: LinkedSupplier) {
    if (linkedSuppliers.value.some((s) => s.id === entry.id)) return
    linkedSuppliers.value = [...linkedSuppliers.value, entry]
  }

  function removeLinkedSupplier(supplierId: string) {
    linkedSuppliers.value = linkedSuppliers.value.filter((s) => s.id !== supplierId)
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
      const data = await getCategory(id)
      category.value = data
      form.value = {
        name: data.name,
        parentId: data.parentId,
        description: data.description,
      }
      dirty.capture()
      localFields.value = JSON.parse(JSON.stringify(data.fields))
      linkedSuppliers.value = JSON.parse(JSON.stringify(data.linkedSuppliers)) as LinkedSupplier[]
      originalLinkedSuppliers.value = JSON.stringify(data.linkedSuppliers)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load category'
    } finally {
      loading.value = false
    }
  }

  async function save() {
    if (!isAnythingDirty.value) return
    saving.value = true
    try {
      const calls: Promise<unknown>[] = []
      const patchDelta: Parameters<typeof patchCategory>[1] = {}
      if (dirty.isDirty.value) Object.assign(patchDelta, dirty.diff())
      if (linkedSuppliersChanged.value)
        patchDelta.linkedSuppliers = JSON.parse(JSON.stringify(linkedSuppliers.value)) as LinkedSupplier[]
      if (Object.keys(patchDelta).length > 0) calls.push(patchCategory(id, patchDelta))
      if (fieldsChanged.value) calls.push(putCategoryFields(id, localFields.value))
      await Promise.all(calls)
      await load()
      toast.success(t('categories.toast_saved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('categories.toast_error'))
    } finally {
      saving.value = false
    }
  }

  function discard() {
    return load()
  }

  function addField(field: Omit<CategoryField, 'id' | 'order'>): void {
    localFields.value.push({
      ...field,
      id: `tmp-${Date.now()}`,
      order: localFields.value.length,
    })
  }

  function updateField(fieldId: string, delta: Partial<CategoryField>): void {
    const idx = localFields.value.findIndex((f) => f.id === fieldId)
    if (idx === -1) return
    const existing = localFields.value[idx]
    if (!existing) return
    localFields.value[idx] = { ...existing, ...delta } as CategoryField
  }

  function deleteField(fieldId: string): void {
    localFields.value = localFields.value
      .filter((f) => f.id !== fieldId)
      .map((f, i) => ({ ...f, order: i }))
  }

  function reorderFields(newOrder: CategoryField[]): void {
    localFields.value = newOrder.map((f, i) => ({ ...f, order: i }))
  }

  loadSuppliers()

  return {
    category,
    loading,
    saving,
    error,
    form,
    localFields,
    linkedSuppliers,
    suppliersList,
    isAnythingDirty,
    isDirty: dirty.isDirty,
    fieldsChanged,
    load,
    save,
    discard,
    addField,
    updateField,
    deleteField,
    reorderFields,
    addLinkedSupplier,
    removeLinkedSupplier,
  }
}
