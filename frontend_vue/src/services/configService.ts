import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './api'
import type { FieldDefinition, SectionConfig, PermissionMatrix } from '@/types/config'
import { toTranslatedString } from '@/types/i18n'

// ─── Field library ───
export async function getFieldLibrary(): Promise<FieldDefinition[]> {
  return apiGet<FieldDefinition[]>('/api/config/fields')
}

/** Full replace of the field library — atomic Save batch (Save сохраняет всё накопленное локально). */
export async function saveFieldLibrary(fields: FieldDefinition[]): Promise<void> {
  await apiPut<void>('/api/config/fields', fields)
}

export async function createField(
  payload: {
    name: string
    type: FieldDefinition['type']
  },
  locale: string,
): Promise<FieldDefinition> {
  return apiPost<FieldDefinition>('/api/config/fields', {
    ...payload,
    name: toTranslatedString(payload.name, locale),
  })
}

export async function patchField(
  id: string,
  patch: Partial<FieldDefinition>,
  locale: string,
): Promise<FieldDefinition> {
  const translatedPatch: Partial<FieldDefinition> = { ...patch }
  if (patch.name && typeof patch.name === 'string') {
    translatedPatch.name = toTranslatedString(patch.name, locale)
  }
  return apiPatch<FieldDefinition>(`/api/config/fields/${id}`, translatedPatch)
}

export async function deleteField(id: string): Promise<void> {
  await apiDelete<void>(`/api/config/fields/${id}`)
}

// ─── Sections ───
export async function getSections(): Promise<SectionConfig[]> {
  return apiGet<SectionConfig[]>('/api/config/sections')
}

/** Full replace — used after drag-drop reorder or batch Save in the config builder. */
export async function saveSections(sections: SectionConfig[]): Promise<void> {
  await apiPut<void>('/api/config/sections', sections)
}

export async function createSection(payload: { name: string }): Promise<SectionConfig> {
  return apiPost<SectionConfig>('/api/config/sections', payload)
}

export async function patchSection(
  id: string,
  patch: Partial<SectionConfig>,
  locale: string,
): Promise<SectionConfig> {
  const translatedPatch: Partial<SectionConfig> = { ...patch }
  if (patch.name && typeof patch.name === 'string') {
    translatedPatch.name = toTranslatedString(patch.name, locale)
  }
  return apiPatch<SectionConfig>(`/api/config/sections/${id}`, translatedPatch)
}

export async function deleteSection(id: string): Promise<void> {
  await apiDelete<void>(`/api/config/sections/${id}`)
}

// ─── Permissions ───
export async function getPermissions(): Promise<PermissionMatrix> {
  return apiGet<PermissionMatrix>('/api/config/permissions')
}

/** Full replace — cascade Rules 1-5 touch many cells at once. */
export async function savePermissions(matrix: PermissionMatrix): Promise<void> {
  await apiPut<void>('/api/config/permissions', matrix)
}
