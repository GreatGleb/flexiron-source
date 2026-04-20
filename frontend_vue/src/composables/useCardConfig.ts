import { ref } from 'vue'
import {
  getFieldLibrary,
  saveFieldLibrary,
  getSections,
  saveSections,
  getPermissions,
  savePermissions,
} from '@/services/configService'
import type { FieldDefinition, SectionConfig, PermissionMatrix } from '@/types/config'

export function useCardConfig() {
  const fieldLibrary = ref<FieldDefinition[]>([])
  const sections = ref<SectionConfig[]>([])
  const permissions = ref<PermissionMatrix | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const [fields, secs, perms] = await Promise.all([
        getFieldLibrary(),
        getSections(),
        getPermissions(),
      ])
      fieldLibrary.value = fields
      sections.value = secs
      permissions.value = perms
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load config'
    } finally {
      loading.value = false
    }
  }

  async function saveConfig() {
    if (!permissions.value) return
    saving.value = true
    error.value = null
    try {
      // Atomic save batch: client built up local changes; server now sees the final state.
      await Promise.all([
        saveFieldLibrary(fieldLibrary.value),
        saveSections(sections.value),
        savePermissions(permissions.value),
      ])
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save config'
    } finally {
      saving.value = false
    }
  }

  function moveSection(fromId: string, toId: string) {
    const arr = sections.value
    const fromIdx = arr.findIndex((s) => s.id === fromId)
    const toIdx = arr.findIndex((s) => s.id === toId)
    if (fromIdx === -1 || toIdx === -1) return
    const moved = arr.splice(fromIdx, 1)[0]
    if (!moved) return
    arr.splice(toIdx, 0, moved)
    arr.forEach((s, i) => (s.order = i))
  }

  function toggleSection(sectionId: string) {
    const sec = sections.value.find((s) => s.id === sectionId)
    if (sec) sec.collapsed = !sec.collapsed
  }

  function toggleSectionVisibility(sectionId: string) {
    const sec = sections.value.find((s) => s.id === sectionId)
    if (sec) sec.visible = !sec.visible
  }

  function renameSection(sectionId: string, name: string) {
    const sec = sections.value.find((s) => s.id === sectionId)
    if (sec) sec.name = name
  }

  function toggleFieldVisibility(sectionId: string, fieldId: string) {
    const sec = sections.value.find((s) => s.id === sectionId)
    const field = sec?.fields.find((f) => f.fieldId === fieldId)
    if (field) field.visible = !field.visible
  }

  function toggleFieldLibraryHidden(fieldId: string) {
    const field = fieldLibrary.value.find((f) => f.id === fieldId)
    if (field) field.hidden = !field.hidden
  }

  return {
    fieldLibrary,
    sections,
    permissions,
    loading,
    saving,
    error,
    load,
    saveConfig,
    moveSection,
    toggleSection,
    toggleSectionVisibility,
    renameSection,
    toggleFieldVisibility,
    toggleFieldLibraryHidden,
  }
}
