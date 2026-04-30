<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import TagInput from '@/components/admin/ui/TagInput.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import { useHead } from '@/composables/useHead'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import { useCategoryCard } from '@/composables/useCategoryCard'
import { getCategories } from '@/services/categoriesService'
import type { CategoryField, CategoryFieldType, CategoryListItem } from '@/types/category'
import type { LinkedSupplier } from '@/types/product'

import '@styles/admin/components/_entity-card-layout.css'
import '@styles/admin/categories_card.css'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const id = route.params.id as string
const showSupplierLinks = useFeatureFlag('categorySupplierLinks')

const {
  category,
  loading,
  saving,
  form,
  localFields,
  linkedSuppliers,
  suppliersList,
  isAnythingDirty,
  load,
  save,
  discard,
  addField,
  updateField,
  deleteField,
  addLinkedSupplier,
  removeLinkedSupplier,
} = useCategoryCard(id)

useHead({
  title: () => category.value?.name ?? t('categories.title'),
  description: () => t('categories.title'),
})

// ─── Parent select ─────────────────────────────────────────────────────────────

const allCategories = ref<CategoryListItem[]>([])

async function loadCategoryList() {
  const res = await getCategories({ search: '' })
  allCategories.value = res.items
}

const formParentId = computed({
  get: () => form.value.parentId ?? '',
  set: (v: string) => {
    form.value.parentId = v || null
  },
})

const formDescription = computed({
  get: () => form.value.description ?? '',
  set: (v: string) => {
    form.value.description = v || null
  },
})

const parentOptions = computed(() => [
  { value: '', label: t('categories.field_parent_none') },
  ...allCategories.value.filter((c) => c.id !== id).map((c) => ({ value: c.id, label: c.name })),
])

// ─── Field type options ─────────────────────────────────────────────────────────

const FIELD_TYPES: CategoryFieldType[] = [
  'text',
  'number',
  'boolean',
  'enum',
  'email',
  'date',
  'file',
]
const fieldTypeOptions = computed(() =>
  FIELD_TYPES.map((typ) => ({ value: typ, label: t(`categories.type_${typ}`) })),
)

// ─── Field modal ────────────────────────────────────────────────────────────────

const showAddFieldModal = ref(false)
const editingField = ref<CategoryField | null>(null)
const fieldDraft = ref<{ name: string; required: boolean; options: string[] }>({
  name: '',
  required: false,
  options: [],
})
const fieldDraftType = ref<string>('text')

watch(fieldDraftType, (v) => {
  if (v !== 'enum') fieldDraft.value.options = []
})

function openAddField() {
  editingField.value = null
  fieldDraft.value = { name: '', required: false, options: [] }
  fieldDraftType.value = 'text'
  showAddFieldModal.value = true
}

function openEditField(field: CategoryField) {
  editingField.value = field
  fieldDraft.value = { name: field.name, required: field.required, options: [...field.options] }
  fieldDraftType.value = field.type
  showAddFieldModal.value = true
}

function submitFieldModal() {
  const name = fieldDraft.value.name.trim()
  if (!name) return
  const payload = {
    name,
    type: fieldDraftType.value as CategoryFieldType,
    required: fieldDraft.value.required,
    options: fieldDraftType.value === 'enum' ? fieldDraft.value.options : [],
  }
  if (editingField.value) {
    updateField(editingField.value.id, payload)
  } else {
    addField(payload)
  }
  showAddFieldModal.value = false
}


// ─── Delete field confirmation ──────────────────────────────────────────────────

const fieldToDelete = ref<CategoryField | null>(null)
const showDeleteFieldModal = computed({
  get: () => fieldToDelete.value !== null,
  set: (v: boolean) => { if (!v) fieldToDelete.value = null },
})

// ─── Supplier links ─────────────────────────────────────────────────────────────

const showAddSupplier = ref(false)
const supplierToRemove = ref<LinkedSupplier | null>(null)
const showRemoveModal = computed({
  get: () => supplierToRemove.value !== null,
  set: (v: boolean) => { if (!v) supplierToRemove.value = null },
})

const addSupplierForm = ref<{ supplierId: string; leadDays: number | null }>({
  supplierId: '',
  leadDays: null,
})

const supplierOptions = computed(() => {
  const linked = new Set(linkedSuppliers.value.map((s) => s.id))
  return suppliersList.value
    .filter((s) => !linked.has(s.id))
    .map((s) => ({ value: s.id, label: s.company }))
})

function submitAddSupplier() {
  const supplier = suppliersList.value.find((s) => s.id === addSupplierForm.value.supplierId)
  if (!supplier) return
  addLinkedSupplier({
    id: supplier.id,
    name: supplier.company,
    price: null,
    priceUnit: null,
    leadDays: addSupplierForm.value.leadDays ?? supplier.leadTime,
  })
  showAddSupplier.value = false
  addSupplierForm.value = { supplierId: '', leadDays: null }
}

onMounted(() => {
  load()
  loadCategoryList()
})
</script>

<template>
  <div class="page-category-card" data-test="page-category-card">
    <div class="category-card-header" data-test="category-card-header">
      <div class="category-card-title">
        <button
          class="btn btn-icon btn-sm"
          @click="router.push({ name: 'admin-categories' })"
        >
          <SvgIcon
            name="chevron-right"
            :width="16"
            :height="16"
            style="transform: rotate(180deg)"
          />
        </button>
        <h1 class="page-title">{{ category?.name ?? t('categories.title') }}</h1>
      </div>
      <div class="entity-action-bar no-margin pos-static" data-test="category-save-bar">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="!isAnythingDirty || saving"
          @click="discard"
        >
          {{ t('categories.btn_discard_changes') }}
        </button>
        <button
          type="button"
          class="btn btn-save"
          :class="{ dirty: isAnythingDirty, loading: saving }"
          :disabled="!isAnythingDirty || saving"
          @click="save"
        >
          {{ t('categories.btn_save') }}
        </button>
      </div>
    </div>

    <div class="category-panels-grid">
    <GlassPanel
      :title="t('categories.section_info')"
      :loading="loading"
      :skeleton-rows="3"
      data-test="category-card-info"
    >
      <InputGroup :label="t('categories.field_name')">
        <input
          v-model="form.name"
          type="text"
          class="glass-input"
          data-test="category-name-input"
        />
      </InputGroup>
      <InputGroup :label="t('categories.field_parent')">
        <CustomSelect
          v-model="formParentId"
          :options="parentOptions"
          data-test="category-parent-select"
        />
      </InputGroup>
      <InputGroup :label="t('categories.field_description')">
        <textarea
          v-model="formDescription"
          class="glass-input"
          rows="3"
          data-test="category-description-input"
        />
      </InputGroup>
    </GlassPanel>

    <div class="category-panels-fields-col">
    <GlassPanel
      v-if="category?.inheritedFields?.length"
      :title="t('categories.section_inherited_fields')"
      data-test="category-inherited-fields"
    >
      <p class="inherited-label">
        {{ t('categories.inherited_from') }}
        {{ allCategories.find((c) => c.id === category?.parentId)?.name ?? '' }}
      </p>
      <table class="data-table">
        <tbody>
          <tr v-for="field in category.inheritedFields" :key="field.id">
            <td>{{ field.name }}</td>
            <td><span class="tag tag-sm">{{ t(`categories.type_${field.type}`) }}</span></td>
            <td>
              <span v-if="field.required" class="tag tag-sm tag-required">
                {{ t('categories.field_required') }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </GlassPanel>

    <GlassPanel :title="t('categories.section_own_fields')" data-test="category-own-fields">
      <template #header>
        <button
          type="button"
          class="btn btn-primary"
          data-test="category-add-field-btn"
          @click="openAddField"
        >
          <SvgIcon name="plus-add" :width="16" :height="16" />
          <span>{{ t('categories.btn_add_field') }}</span>
        </button>
      </template>

      <table v-if="localFields.length" class="data-table">
        <tbody>
          <tr
            v-for="field in localFields"
            :key="field.id"
            data-test="category-field-row"
          >
            <td>{{ field.name }}</td>
            <td><span class="tag tag-sm">{{ t(`categories.type_${field.type}`) }}</span></td>
            <td>
              <span v-if="field.required" class="tag tag-sm tag-required">
                {{ t('categories.field_required') }}
              </span>
            </td>
            <td class="category-field-actions-cell">
              <div class="category-field-actions">
                <button
                  v-tooltip="t('categories.btn_edit_field')"
                  type="button"
                  class="action-icon-btn action-edit category-field-action-btn"
                  @click="openEditField(field)"
                >
                  <SvgIcon name="edit-pencil" :width="16" :height="16" />
                </button>
                <button
                  v-tooltip="t('categories.btn_delete')"
                  type="button"
                  class="action-icon-btn action-danger category-field-action-btn"
                  @click="fieldToDelete = field"
                >
                  <SvgIcon name="trash" :width="16" :height="16" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </GlassPanel>
    </div>

    <GlassPanel
      v-if="showSupplierLinks"
      :title="t('categories.section_suppliers')"
      data-test="category-supplier-links"
    >
      <template #header>
        <button
          type="button"
          class="btn btn-primary"
          data-test="category-add-supplier-btn"
          @click="showAddSupplier = true"
        >
          <SvgIcon name="plus-add" :width="16" :height="16" />
          <span>{{ t('categories.btn_add_supplier') }}</span>
        </button>
      </template>

      <table v-if="linkedSuppliers.length" class="data-table" data-test="category-suppliers-table">
        <thead>
          <tr>
            <th>{{ t('categories.th_supplier_name') }}</th>
            <th>{{ t('categories.th_lead_days') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in linkedSuppliers" :key="s.id" data-test="category-supplier-row">
            <td>{{ s.name }}</td>
            <td>{{ s.leadDays }}</td>
            <td>
              <button
                v-tooltip="t('categories.btn_delete')"
                type="button"
                class="action-icon-btn action-danger category-supplier-remove-btn"
                data-test="category-supplier-remove-btn"
                @click="supplierToRemove = s"
              >
                <SvgIcon name="trash" :width="16" :height="16" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="category-suppliers-empty">{{ t('categories.suppliers_empty') }}</p>
    </GlassPanel>
    </div>

    <AppModal
      v-model="showAddFieldModal"
      :title="editingField ? t('categories.modal_field_title_edit') : t('categories.modal_field_title_add')"
      size="medium"
      data-test="modal-field"
    >
      <InputGroup :label="t('categories.field_label')">
        <input
          v-model="fieldDraft.name"
          type="text"
          class="glass-input"
          data-test="field-name-input"
        />
      </InputGroup>
      <InputGroup :label="t('categories.field_type')">
        <CustomSelect
          v-model="fieldDraftType"
          :options="fieldTypeOptions"
          data-test="field-type-select"
        />
      </InputGroup>
      <InputGroup :label="t('categories.field_required')">
        <input
          v-model="fieldDraft.required"
          type="checkbox"
          data-test="field-required-checkbox"
        />
      </InputGroup>
      <InputGroup v-if="fieldDraftType === 'enum'" :label="t('categories.field_options')">
        <TagInput
          v-model="fieldDraft.options"
          :placeholder="t('categories.field_options_placeholder')"
          :free-input="true"
          data-test="field-options-input"
        />
      </InputGroup>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="showAddFieldModal = false">
          {{ t('categories.btn_discard') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          data-test="field-modal-submit"
          @click="submitFieldModal"
        >
          {{ t('categories.btn_save') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showDeleteFieldModal"
      :title="t('categories.modal_delete_field')"
      size="small"
      data-test="modal-delete-field"
    >
      <p>{{ t('categories.confirm_delete_field') }}</p>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="fieldToDelete = null">
          {{ t('categories.btn_discard') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="confirm-delete-field"
          @click="() => { deleteField(fieldToDelete!.id); fieldToDelete = null }"
        >
          {{ t('categories.btn_delete') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showAddSupplier"
      :title="t('categories.modal_add_supplier')"
      size="medium"
      data-test="modal-add-supplier"
    >
      <InputGroup :label="t('categories.field_supplier')">
        <CustomSelect
          v-model="addSupplierForm.supplierId"
          :options="supplierOptions"
          data-test="add-supplier-select"
        />
      </InputGroup>
      <InputGroup :label="t('categories.th_lead_days')">
        <input
          v-model.number="addSupplierForm.leadDays"
          type="number"
          class="glass-input"
          min="0"
          data-test="add-supplier-lead-days"
        />
      </InputGroup>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="showAddSupplier = false">
          {{ t('categories.btn_discard') }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!addSupplierForm.supplierId"
          data-test="add-supplier-submit"
          @click="submitAddSupplier"
        >
          {{ t('categories.btn_add_supplier') }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="showRemoveModal"
      :title="t('categories.modal_remove_supplier')"
      size="small"
      data-test="modal-remove-supplier"
    >
      <p>{{ t('categories.confirm_remove_supplier') }}</p>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="supplierToRemove = null">
          {{ t('categories.btn_discard') }}
        </button>
        <button
          type="button"
          class="btn btn-danger"
          data-test="confirm-remove-supplier"
          @click="() => { removeLinkedSupplier(supplierToRemove!.id); supplierToRemove = null }"
        >
          {{ t('categories.btn_delete') }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
