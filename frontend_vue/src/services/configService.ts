import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './api'
import type { FieldDefinition, SectionConfig, PermissionMatrix } from '@/types/config'

// ─── Field library ───
export async function getFieldLibrary(): Promise<FieldDefinition[]> {
  return apiGet<FieldDefinition[]>('/api/config/fields')
}

/** Full replace of the field library — atomic Save batch (Save сохраняет всё накопленное локально). */
export async function saveFieldLibrary(fields: FieldDefinition[]): Promise<void> {
  await apiPut<void>('/api/config/fields', fields)
}

export async function createField(payload: {
  name: string
  type: FieldDefinition['type']
}): Promise<FieldDefinition> {
  return apiPost<FieldDefinition>('/api/config/fields', payload)
}

export async function patchField(
  id: string,
  patch: Partial<FieldDefinition>,
): Promise<FieldDefinition> {
  return apiPatch<FieldDefinition>(`/api/config/fields/${id}`, patch)
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
): Promise<SectionConfig> {
  return apiPatch<SectionConfig>(`/api/config/sections/${id}`, patch)
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
