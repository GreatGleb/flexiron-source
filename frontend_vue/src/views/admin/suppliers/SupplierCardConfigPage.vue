<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import ConfigSectionCard from '@/components/admin/ConfigSectionCard.vue'
import FieldLibraryItem from '@/components/admin/FieldLibraryItem.vue'
import AppModal from '@/components/admin/ui/AppModal.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import { useCardConfig } from '@/composables/useCardConfig'
import { useToast } from '@/composables/useToast'
import { useHead } from '@/composables/useHead'
import { useFeatureFlag } from '@/composables/useFeatureFlag'
import type { FieldDefinition, PermissionAction } from '@/types/config'

import '@styles/admin/supplier_card_config.css'

const { t } = useI18n()
const toast = useToast()
const showPermissionsEditor = useFeatureFlag('permissionsEditor')

useHead({
  title: () => `Flexiron — ${t('cardConfig.header_title')}`,
  description: () => t('cardConfig.header_title'),
})

const {
  fieldLibrary,
  sections,
  permissions,
  saving,
  loading,
  load,
  saveConfig,
  moveSection,
  toggleSection,
  toggleSectionVisibility,
  renameSection,
  toggleFieldVisibility,
} = useCardConfig()

const fieldSearch = ref('')

const filteredFields = computed(() => {
  if (!fieldSearch.value.trim()) return fieldLibrary.value
  const q = fieldSearch.value.toLowerCase()
  return fieldLibrary.value.filter((f) => f.name.toLowerCase().includes(q))
})

function fieldById(fieldId: string): FieldDefinition | undefined {
  return fieldLibrary.value.find((f) => f.id === fieldId)
}

const newFieldOpen = ref(false)
const newField = ref<{ name: string; type: FieldDefinition['type'] }>({
  name: '',
  type: 'text',
})

const FIELD_TYPE_OPTIONS: FieldDefinition['type'][] = [
  'text',
  'number',
  'date',
  'boolean',
  'enum',
  'tags',
]
const fieldTypeOptions = computed(() =>
  FIELD_TYPE_OPTIONS.map((typ) => ({ value: typ, label: t(`field.type_${typ}`, typ) })),
)

const PERMISSION_ACTIONS: PermissionAction[] = ['read', 'edit', 'create', 'delete']
const ACTION_LABEL: Record<PermissionAction, string> = {
  read: 'R',
  edit: 'E',
  create: 'C',
  delete: 'D',
}

const expandedCells = ref<Set<string>>(new Set())

function cellKey(itemId: string, role: string) {
  return `${itemId}::${role}`
}

function toggleExpand(itemId: string, role: string) {
  const key = cellKey(itemId, role)
  const next = new Set(expandedCells.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedCells.value = next
}

function isExpanded(itemId: string, role: string) {
  return expandedCells.value.has(cellKey(itemId, role))
}

function fieldsOfSection(sectionId: string) {
  return (
    permissions.value?.items.filter((i) => i.type === 'field' && i.parentId === sectionId) ?? []
  )
}

function getRolePerm(itemId: string, role: string, action: PermissionAction): boolean {
  return permissions.value?.rolePermissions[itemId]?.[role]?.[action] ?? false
}

// State of a single role-checkbox based on its user overrides (for a leaf item — field, or section without fields)
function leafRoleState(
  itemId: string,
  role: string,
  action: PermissionAction,
): 'checked' | 'unchecked' | 'indeterminate' {
  const users = permissions.value?.users[role] ?? []
  if (users.length === 0) {
    return getRolePerm(itemId, role, action) ? 'checked' : 'unchecked'
  }
  let allChecked = true
  let allUnchecked = true
  for (const u of users) {
    if (getUserPerm(itemId, role, u, action)) allUnchecked = false
    else allChecked = false
  }
  if (allChecked) return 'checked'
  if (allUnchecked) return 'unchecked'
  return 'indeterminate'
}

function rolePermState(
  itemId: string,
  role: string,
  action: PermissionAction,
): 'checked' | 'unchecked' | 'indeterminate' {
  const item = permissions.value?.items.find((i) => i.itemId === itemId)
  if (!item) return 'unchecked'

  if (item.type === 'section') {
    const fields = fieldsOfSection(itemId)
    if (fields.length === 0) return leafRoleState(itemId, role, action)

    let allChecked = true
    let allUnchecked = true
    for (const f of fields) {
      const state = rolePermState(f.itemId, role, action)
      if (state === 'checked' || state === 'indeterminate') allUnchecked = false
      if (state === 'unchecked' || state === 'indeterminate') allChecked = false
    }
    if (allChecked) return 'checked'
    if (allUnchecked) return 'unchecked'
    return 'indeterminate'
  }

  return leafRoleState(itemId, role, action)
}

function getUserPerm(
  itemId: string,
  role: string,
  user: string,
  action: PermissionAction,
): boolean {
  const saved = permissions.value?.userPermissions[itemId]?.[role]?.[user]?.[action]
  if (saved !== undefined) return saved
  return getRolePerm(itemId, role, action)
}

function setRolePerm(itemId: string, role: string, action: PermissionAction, checked: boolean) {
  if (!permissions.value) return
  if (!permissions.value.rolePermissions[itemId]) permissions.value.rolePermissions[itemId] = {}
  if (!permissions.value.rolePermissions[itemId][role]) {
    permissions.value.rolePermissions[itemId][role] = {
      read: false,
      edit: false,
      create: false,
      delete: false,
    }
  }
  permissions.value.rolePermissions[itemId][role]![action] = checked
}

// Rule 4: Role → Users — when role checkbox changes, clear per-user overrides for this action
function clearUserOverrides(itemId: string, role: string, action: PermissionAction) {
  const map = permissions.value?.userPermissions[itemId]?.[role]
  if (!map) return
  for (const user of Object.keys(map)) {
    if (map[user]?.[action] !== undefined) {
      delete map[user]![action]
    }
  }
}

// Rule 1: Section → Fields — cascade to all fields in section
function syncSectionToFields(
  sectionId: string,
  role: string,
  action: PermissionAction,
  checked: boolean,
) {
  for (const f of fieldsOfSection(sectionId)) {
    setRolePerm(f.itemId, role, action, checked)
    clearUserOverrides(f.itemId, role, action)
  }
}

function onRoleToggle(itemId: string, role: string, action: PermissionAction, checked: boolean) {
  const item = permissions.value?.items.find((i) => i.itemId === itemId)
  if (!item) return

  if (item.type === 'section') {
    // Rule 1: cascade to fields
    syncSectionToFields(itemId, role, action, checked)
    // The section's own role-state is derived from fields, but also set for consistency
    setRolePerm(itemId, role, action, checked)
  } else {
    setRolePerm(itemId, role, action, checked)
  }
  // Rule 4: clear user-level overrides for this item+role+action
  clearUserOverrides(itemId, role, action)
}

function applyUserOverride(
  itemId: string,
  role: string,
  user: string,
  action: PermissionAction,
  checked: boolean,
) {
  if (!permissions.value) return
  const userMap = permissions.value.userPermissions
  if (!userMap[itemId]) userMap[itemId] = {}
  if (!userMap[itemId][role]) userMap[itemId][role] = {}
  if (!userMap[itemId][role][user]) userMap[itemId][role][user] = {}
  userMap[itemId][role][user]![action] = checked
}

// Rule 5 bottom-up: if all users for this role align on action, collapse overrides and promote to role-level
function collapseIfAligned(itemId: string, role: string, action: PermissionAction) {
  if (!permissions.value) return
  const users = permissions.value.users[role] ?? []
  if (users.length === 0) return
  let allChecked = true
  let allUnchecked = true
  for (const u of users) {
    if (getUserPerm(itemId, role, u, action)) allUnchecked = false
    else allChecked = false
  }
  if (allChecked || allUnchecked) {
    const userMap = permissions.value.userPermissions
    for (const u of users) {
      const m = userMap[itemId]?.[role]?.[u]
      if (m) delete m[action]
    }
    setRolePerm(itemId, role, action, allChecked)
  }
}

function onUserToggle(
  itemId: string,
  role: string,
  user: string,
  action: PermissionAction,
  checked: boolean,
) {
  if (!permissions.value) return

  // Rule 5: store user override on this item
  applyUserOverride(itemId, role, user, action, checked)

  // Rule 2: if the user-checkbox sits in a SECTION row — cascade the same change to every field's user-checkbox in that section
  const item = permissions.value.items.find((i) => i.itemId === itemId)
  if (item?.type === 'section') {
    for (const f of fieldsOfSection(itemId)) {
      applyUserOverride(f.itemId, role, user, action, checked)
      collapseIfAligned(f.itemId, role, action)
    }
  }

  // Rule 5 finalize: collapse this item's overrides if all users re-aligned on this action
  collapseIfAligned(itemId, role, action)
}

// Rule 6: override badge — field's perms differ from section's
function hasOverride(fieldId: string): boolean {
  const item = permissions.value?.items.find((i) => i.itemId === fieldId)
  if (!item || item.type !== 'field' || !item.parentId) return false
  const roles = permissions.value?.roles ?? []
  for (const role of roles) {
    for (const a of PERMISSION_ACTIONS) {
      const secVal = getRolePerm(item.parentId, role, a)
      const fieldVal = getRolePerm(fieldId, role, a)
      if (secVal !== fieldVal) return true
    }
  }
  return false
}

// Custom fields are ones the user created in this session (not present in original MOCK_FIELD_LIBRARY).
// We detect them by the id prefix `f-custom-` generated in createField / addFieldToSection.
function isCustomField(fieldId: string): boolean {
  return fieldId.startsWith('f-custom-')
}

// Clean-slate: создание/удаление НЕ уходит на сервер. Изменения накапливаются локально и
// применяются батчем при клике Save (PUT /sections + PUT /fields + PUT /permissions).
function createField() {
  if (!newField.value.name.trim()) {
    toast.show(t('notification.enter_field_name'), 'error')
    return
  }
  fieldLibrary.value.push({
    id: `f-custom-${Date.now()}`,
    name: newField.value.name.trim(),
    type: newField.value.type,
    required: false,
    usageCount: 0,
  })
  newField.value = { name: '', type: 'text' }
  newFieldOpen.value = false
  toast.show(t('notification.field_created'))
}

// ─── Confirm delete section ───
const deleteSectionOpen = ref(false)
const sectionToDeleteId = ref<string | null>(null)
function askDeleteSection(sectionId: string) {
  sectionToDeleteId.value = sectionId
  deleteSectionOpen.value = true
}
function confirmDeleteSection() {
  if (!sectionToDeleteId.value) return
  const idx = sections.value.findIndex((s) => s.id === sectionToDeleteId.value)
  if (idx !== -1) sections.value.splice(idx, 1)
  sectionToDeleteId.value = null
  deleteSectionOpen.value = false
  toast.show(t('notification.section_deleted', 'Section deleted'))
}

// ─── Confirm delete custom field from Global Fields ───
const deleteFieldOpen = ref(false)
const fieldToDeleteId = ref<string | null>(null)
function askDeleteField(fieldId: string) {
  fieldToDeleteId.value = fieldId
  deleteFieldOpen.value = true
}
function confirmDeleteField() {
  if (!fieldToDeleteId.value) return
  const removedId = fieldToDeleteId.value
  const idx = fieldLibrary.value.findIndex((f) => f.id === removedId)
  if (idx !== -1) fieldLibrary.value.splice(idx, 1)
  for (const sec of sections.value) {
    sec.fields = sec.fields.filter((f) => f.fieldId !== removedId)
  }
  fieldToDeleteId.value = null
  deleteFieldOpen.value = false
  toast.show(t('notification.field_deleted', 'Field deleted'))
}

// ─── Edit (rename) section ───
const editSectionOpen = ref(false)
const editSectionId = ref<string | null>(null)
const editSectionName = ref('')
function openEditSection(sectionId: string) {
  const sec = sections.value.find((s) => s.id === sectionId)
  if (!sec) return
  editSectionId.value = sectionId
  editSectionName.value = sec.name
  editSectionOpen.value = true
}
function confirmEditSection() {
  if (!editSectionId.value) return
  if (!editSectionName.value.trim()) {
    toast.show(t('notification.enter_field_name'), 'error')
    return
  }
  renameSection(editSectionId.value, editSectionName.value.trim())
  editSectionOpen.value = false
  toast.show(t('notification.section_updated'))
}

// ─── Add field to specific section ───
const addFieldOpen = ref(false)
const addFieldSectionId = ref<string | null>(null)
const addField = ref<{ name: string; type: FieldDefinition['type'] }>({
  name: '',
  type: 'text',
})
function openAddFieldToSection(sectionId: string) {
  addFieldSectionId.value = sectionId
  addField.value = { name: '', type: 'text' }
  addFieldOpen.value = true
}
function confirmAddField() {
  if (!addFieldSectionId.value) return
  if (!addField.value.name.trim()) {
    toast.show(t('notification.enter_field_name'), 'error')
    return
  }
  const newId = `f-custom-${Date.now()}`
  fieldLibrary.value.push({
    id: newId,
    name: addField.value.name.trim(),
    type: addField.value.type,
    required: false,
    usageCount: 1,
  })
  const sec = sections.value.find((s) => s.id === addFieldSectionId.value)
  if (sec) {
    sec.fields.push({ fieldId: newId, order: sec.fields.length, visible: true })
  }
  addFieldOpen.value = false
  toast.show(t('notification.field_added'))
}

// ─── Confirm remove custom field from a section (only the section reference, not the library entry) ───
const removeFromSectionOpen = ref(false)
const removeFromSectionTarget = ref<{ sectionId: string; fieldId: string } | null>(null)
function askRemoveFieldFromSection(sectionId: string, fieldId: string) {
  removeFromSectionTarget.value = { sectionId, fieldId }
  removeFromSectionOpen.value = true
}
function confirmRemoveFieldFromSection() {
  const target = removeFromSectionTarget.value
  if (!target) return
  const sec = sections.value.find((s) => s.id === target.sectionId)
  if (sec) sec.fields = sec.fields.filter((f) => f.fieldId !== target.fieldId)
  removeFromSectionTarget.value = null
  removeFromSectionOpen.value = false
}

// ─── Add new section: open modal → POST → scroll to it ───
const addSectionOpen = ref(false)
const addSectionName = ref('')

function openAddSection() {
  addSectionName.value = ''
  addSectionOpen.value = true
}

async function confirmAddSection() {
  const name = addSectionName.value.trim()
  if (!name) {
    toast.show(t('notification.enter_field_name'), 'error')
    return
  }
  const newSection = {
    id: `sec-new-${Date.now()}`,
    name,
    order: sections.value.length,
    collapsed: false,
    visible: true,
    system: false,
    fields: [],
  }
  sections.value.push(newSection)
  addSectionOpen.value = false
  await nextTick()
  document
    .querySelector(`.config-section-card[data-section-id="${newSection.id}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function save() {
  await saveConfig()
  toast.show(t('notification.config_saved'))
}

let draggingSectionId: string | null = null

function onSectionDragStart(e: DragEvent, id: string) {
  draggingSectionId = id
  e.dataTransfer?.setData('text/plain', id)
}

function onSectionDrop(e: DragEvent, targetId: string) {
  e.preventDefault()
  if (!draggingSectionId || draggingSectionId === targetId) return
  moveSection(draggingSectionId, targetId)
  draggingSectionId = null
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

onMounted(load)
</script>

<template>
  <h1 class="page-title" data-test="supplier-card-config-title">
    {{ t('cardConfig.header_title') }}
  </h1>

  <div class="flex-end" style="margin-bottom: 24px" data-test="supplier-card-config-action-bar">
    <div class="entity-action-bar no-margin pos-static flex-group">
      <button
        class="btn btn-primary"
        :disabled="saving"
        data-test="supplier-card-config-save-btn"
        @click="save"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>{{ t('btn.save') }}</span>
      </button>
    </div>
  </div>

  <div class="config-grid" data-test="supplier-card-config-grid">
    <!-- COL LEFT: Global Field Library -->
    <div class="col-library" data-test="supplier-card-config-library">
      <GlassPanel
        :title="t('cardConfig.global_fields')"
        :loading="loading && fieldLibrary.length === 0"
        :skeleton-rows="8"
      >
        <template #header>
          <button
            class="nav-btn"
            style="
              width: auto;
              padding: 0 10px;
              font-size: 10px;
              height: 22px;
              gap: 5px;
              opacity: 0.8;
              background: rgba(24, 144, 255, 0.1);
              border-color: rgba(24, 144, 255, 0.2);
              margin-left: auto;
            "
            data-test="supplier-card-config-library-new-btn"
            @click="newFieldOpen = true"
          >
            <SvgIcon name="plus-add" :width="10" :height="10" stroke-width="3" />
            <span>{{ t('btn.new_field') }}</span>
          </button>
        </template>
        <div class="input-group" style="margin-bottom: 16px">
          <input
            v-model="fieldSearch"
            type="text"
            class="glass-input"
            data-test="supplier-card-config-library-search"
            :placeholder="t('field.search')"
          />
        </div>
        <div class="field-library-list" data-test="supplier-card-config-library-list">
          <FieldLibraryItem
            v-for="f in filteredFields"
            :key="f.id"
            :field-id="f.id"
            :name="f.name"
            :type="f.type"
            :draggable="true"
            :usage-count="f.usageCount"
            :hidden-required="f.required"
            :deletable="isCustomField(f.id)"
            :show-hide="false"
            :show-delete="isCustomField(f.id)"
            @delete="askDeleteField"
          />
        </div>
      </GlassPanel>
    </div>

    <!-- COL RIGHT: Section Builder -->
    <div class="col-builder" data-test="supplier-card-config-builder">
      <GlassPanel
        :title="t('cardConfig.card_structure')"
        :loading="loading && sections.length === 0"
        :skeleton-rows="10"
      >
        <template #header>
          <button
            class="nav-btn"
            style="
              width: auto;
              padding: 0 10px;
              font-size: 10px;
              height: 22px;
              gap: 5px;
              opacity: 0.8;
              background: rgba(24, 144, 255, 0.1);
              border-color: rgba(24, 144, 255, 0.2);
              margin-left: auto;
            "
            data-test="supplier-card-config-builder-add-btn"
            @click="openAddSection"
          >
            <SvgIcon name="plus-add" :width="10" :height="10" stroke-width="3" />
            <span>{{ t('btn.add_section') }}</span>
          </button>
        </template>
        <div class="section-builder-list" data-test="supplier-card-config-builder-list">
          <div
            v-for="sec in sections"
            :key="sec.id"
            class="section-builder-row"
            :data-test="`supplier-card-config-section-wrapper`"
            :data-section-id="sec.id"
            @dragstart="onSectionDragStart($event, sec.id)"
            @dragover="onDragOver"
            @drop="onSectionDrop($event, sec.id)"
          >
            <ConfigSectionCard
              :section-id="sec.id"
              :name="sec.name"
              :collapsed="sec.collapsed"
              :hidden="!sec.visible"
              :field-count="sec.fields.length"
              :deletable="!sec.system"
              @collapse="toggleSection"
              @add-field="openAddFieldToSection"
              @edit="openEditSection"
              @toggle-visibility="toggleSectionVisibility"
              @delete="askDeleteSection"
            >
              <FieldLibraryItem
                v-for="f in sec.fields"
                :key="f.fieldId"
                :field-id="f.fieldId"
                :name="fieldById(f.fieldId)?.name ?? f.fieldId"
                :type="fieldById(f.fieldId)?.type ?? 'text'"
                :usage-count="0"
                :hidden="!f.visible"
                :hidden-required="fieldById(f.fieldId)?.required ?? false"
                :deletable="isCustomField(f.fieldId)"
                :show-hide="true"
                :show-delete="isCustomField(f.fieldId)"
                @toggle-visibility="toggleFieldVisibility(sec.id, f.fieldId)"
                @delete="(fid) => askRemoveFieldFromSection(sec.id, fid)"
              />
            </ConfigSectionCard>
          </div>
        </div>
      </GlassPanel>
    </div>
  </div>

  <!-- FULL WIDTH: Permissions Editor -->
  <div
    v-if="showPermissionsEditor"
    class="config-editor"
    data-test="supplier-card-config-permissions"
  >
    <GlassPanel
      :title="t('cardConfig.permissions_editor')"
      :loading="loading && !permissions"
      :skeleton-rows="5"
    >
      <div v-if="permissions" class="permissions-table-container">
        <table class="permissions-matrix-table" data-test="supplier-card-config-permissions-table">
          <thead>
            <tr>
              <th class="permissions-header-item">{{ t('permissions.item') }}</th>
              <th class="permissions-header-type">{{ t('permissions.type') }}</th>
              <th v-for="role in permissions.roles" :key="role" class="permissions-header-role">
                {{ t(`role.${role.toLowerCase()}`, role) }}
              </th>
            </tr>
            <tr class="permissions-subheader">
              <th colspan="2" />
              <th v-for="role in permissions.roles" :key="role">
                <span v-for="a in PERMISSION_ACTIONS" :key="a" class="permissions-action-label">
                  {{ ACTION_LABEL[a] }}
                </span>
              </th>
            </tr>
            <tr class="permissions-legend">
              <td :colspan="2 + permissions.roles.length" class="permissions-legend-cell">
                <span class="permissions-legend-item">
                  <strong>R</strong> = <span>{{ t('permissions.action_read') }}</span>
                </span>
                <span class="permissions-legend-item">
                  <strong>E</strong> = <span>{{ t('permissions.action_edit') }}</span>
                </span>
                <span class="permissions-legend-item">
                  <strong>C</strong> = <span>{{ t('permissions.action_create') }}</span>
                </span>
                <span class="permissions-legend-item">
                  <strong>D</strong> = <span>{{ t('permissions.action_delete') }}</span>
                </span>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in permissions.items"
              :key="item.itemId"
              class="permissions-table-row"
              :class="item.type === 'section' ? 'permissions-section-row' : 'permissions-field-row'"
              :data-test="`supplier-card-config-permissions-row`"
              :data-item-id="item.itemId"
              :data-item-type="item.type"
              :data-parent-id="item.parentId"
            >
              <td class="permissions-cell-name">
                <span v-if="item.type === 'field'" class="permissions-field-indent" />
                <span class="permissions-item-name">{{ item.name }}</span>
                <span
                  v-if="item.type === 'field' && hasOverride(item.itemId)"
                  class="permissions-override-badge"
                >
                  {{ t('permission.override') }}
                </span>
              </td>
              <td class="permissions-cell-type">
                <span class="permissions-type-badge">
                  {{
                    t(
                      item.type === 'section'
                        ? 'permissions.type_section'
                        : 'permissions.type_field',
                    )
                  }}
                </span>
              </td>
              <td
                v-for="role in permissions.roles"
                :key="role"
                class="permissions-cell-role"
                :data-test="`supplier-card-config-permissions-cell`"
                :data-role="role"
              >
                <div class="permissions-role-cell">
                  <div class="permissions-actions-row">
                    <label
                      v-for="a in PERMISSION_ACTIONS"
                      :key="a"
                      class="permissions-checkbox"
                      :data-test="`supplier-card-config-perm-role-checkbox`"
                      :data-action="a"
                      :title="t(`permissions.action_${a}`)"
                    >
                      <input
                        type="checkbox"
                        :checked="rolePermState(item.itemId, role, a) === 'checked'"
                        :indeterminate.prop="
                          rolePermState(item.itemId, role, a) === 'indeterminate'
                        "
                        @change="
                          onRoleToggle(
                            item.itemId,
                            role,
                            a,
                            ($event.target as HTMLInputElement).checked,
                          )
                        "
                      />
                      <span class="checkbox-custom" />
                    </label>
                  </div>
                  <button
                    type="button"
                    class="permissions-expand-btn"
                    :class="{ expanded: isExpanded(item.itemId, role) }"
                    data-test="supplier-card-config-perm-expand-btn"
                    :title="t('permissions.expand_users')"
                    @click="toggleExpand(item.itemId, role)"
                  >
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      style="pointer-events: none"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>
                <div
                  v-if="isExpanded(item.itemId, role)"
                  class="permissions-users-list visible"
                  data-test="supplier-card-config-perm-users-list"
                >
                  <div
                    v-for="user in permissions.users[role] ?? []"
                    :key="user"
                    class="permissions-user-row"
                    data-test="supplier-card-config-perm-user-row"
                    :data-user="user"
                  >
                    <span class="permissions-user-email">{{ user }}</span>
                    <div class="permissions-user-actions">
                      <label
                        v-for="a in PERMISSION_ACTIONS"
                        :key="a"
                        class="permissions-checkbox"
                        :data-test="`supplier-card-config-perm-user-checkbox`"
                        :data-action="a"
                        :title="t(`permissions.action_${a}`)"
                      >
                        <input
                          type="checkbox"
                          :checked="getUserPerm(item.itemId, role, user, a)"
                          @change="
                            onUserToggle(
                              item.itemId,
                              role,
                              user,
                              a,
                              ($event.target as HTMLInputElement).checked,
                            )
                          "
                        />
                        <span class="checkbox-custom" />
                      </label>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GlassPanel>
  </div>

  <AppModal v-model="newFieldOpen" :title="t('modal.new_field')" size="medium">
    <div class="modal-form" data-test="supplier-card-config-modal-new-field">
      <div class="input-group">
        <label class="field-label">{{ t('field.field_name') }}</label>
        <input
          v-model="newField.name"
          type="text"
          class="glass-input"
          data-test="supplier-card-config-modal-new-field-name"
        />
      </div>
      <div class="input-group">
        <label class="field-label">{{ t('field.field_type') }}</label>
        <CustomSelect
          :model-value="newField.type"
          :options="fieldTypeOptions"
          @update:model-value="(v: string) => (newField.type = v as typeof newField.type)"
        />
      </div>
      <div class="input-group">
        <label class="field-label">{{ t('field.default_value') }}</label>
        <input type="text" class="glass-input" />
      </div>
    </div>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        data-test="supplier-card-config-modal-new-field-cancel"
        @click="newFieldOpen = false"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        data-test="supplier-card-config-modal-new-field-confirm"
        @click="createField"
      >
        {{ t('btn.create') }}
      </button>
    </template>
  </AppModal>

  <!-- Confirm Delete Section -->
  <AppModal v-model="deleteSectionOpen" :title="t('modal.confirm_delete')" size="small">
    <p data-test="supplier-card-config-modal-delete-section">{{ t('modal.delete_message') }}</p>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        data-test="supplier-card-config-modal-delete-section-cancel"
        @click="deleteSectionOpen = false"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-danger"
        data-test="supplier-card-config-modal-delete-section-confirm"
        @click="confirmDeleteSection"
      >
        {{ t('btn.delete') }}
      </button>
    </template>
  </AppModal>

  <!-- Confirm Remove Custom Field from Section -->
  <AppModal v-model="removeFromSectionOpen" :title="t('modal.confirm_delete')" size="small">
    <p data-test="supplier-card-config-modal-remove-field">{{ t('modal.delete_message') }}</p>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        data-test="supplier-card-config-modal-remove-field-cancel"
        @click="removeFromSectionOpen = false"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-danger"
        data-test="supplier-card-config-modal-remove-field-confirm"
        @click="confirmRemoveFieldFromSection"
      >
        {{ t('btn.delete') }}
      </button>
    </template>
  </AppModal>

  <!-- Confirm Delete Custom Field -->
  <AppModal v-model="deleteFieldOpen" :title="t('modal.confirm_delete')" size="small">
    <p data-test="supplier-card-config-modal-delete-field">{{ t('modal.delete_message') }}</p>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        data-test="supplier-card-config-modal-delete-field-cancel"
        @click="deleteFieldOpen = false"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-danger"
        data-test="supplier-card-config-modal-delete-field-confirm"
        @click="confirmDeleteField"
      >
        {{ t('btn.delete') }}
      </button>
    </template>
  </AppModal>

  <!-- Rename Section -->
  <AppModal v-model="editSectionOpen" :title="t('modal.edit_section')" size="small">
    <div class="modal-form" data-test="supplier-card-config-modal-edit-section">
      <div class="input-group">
        <label class="field-label">{{ t('field.section_name') }}</label>
        <input
          v-model="editSectionName"
          type="text"
          class="glass-input"
          data-test="supplier-card-config-modal-edit-section-name"
        />
      </div>
    </div>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        data-test="supplier-card-config-modal-edit-section-cancel"
        @click="editSectionOpen = false"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        data-test="supplier-card-config-modal-edit-section-confirm"
        @click="confirmEditSection"
      >
        {{ t('btn.save') }}
      </button>
    </template>
  </AppModal>

  <!-- Add Section -->
  <AppModal v-model="addSectionOpen" :title="t('modal.new_section', 'New Section')" size="small">
    <div class="modal-form" data-test="supplier-card-config-modal-add-section">
      <div class="input-group">
        <label class="field-label">{{ t('field.section_name') }}</label>
        <input
          v-model="addSectionName"
          type="text"
          class="glass-input"
          data-test="supplier-card-config-modal-add-section-name"
        />
      </div>
    </div>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        data-test="supplier-card-config-modal-add-section-cancel"
        @click="addSectionOpen = false"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        data-test="supplier-card-config-modal-add-section-confirm"
        @click="confirmAddSection"
      >
        {{ t('btn.create') }}
      </button>
    </template>
  </AppModal>

  <!-- Add Field to Section -->
  <AppModal v-model="addFieldOpen" :title="t('modal.add_field_to_section')" size="medium">
    <div class="modal-form" data-test="supplier-card-config-modal-add-field">
      <div class="input-group">
        <label class="field-label">{{ t('field.field_name') }}</label>
        <input
          v-model="addField.name"
          type="text"
          class="glass-input"
          data-test="supplier-card-config-modal-add-field-name"
        />
      </div>
      <div class="input-group">
        <label class="field-label">{{ t('field.field_type') }}</label>
        <CustomSelect
          :model-value="addField.type"
          :options="fieldTypeOptions"
          @update:model-value="(v: string) => (addField.type = v as typeof addField.type)"
        />
      </div>
    </div>
    <template #footer>
      <button
        type="button"
        class="btn btn-secondary"
        data-test="supplier-card-config-modal-add-field-cancel"
        @click="addFieldOpen = false"
      >
        {{ t('btn.cancel') }}
      </button>
      <button
        type="button"
        class="btn btn-primary"
        data-test="supplier-card-config-modal-add-field-confirm"
        @click="confirmAddField"
      >
        {{ t('btn.add') }}
      </button>
    </template>
  </AppModal>
</template>
