import type {
  FieldDefinition,
  SectionConfig,
  PermissionMatrix,
  PermissionAction,
  PermissionItem,
} from '@/types/config'
import type { TranslatedString } from '@/types/i18n'
import { mergeTranslatedString } from '@/types/i18n'

export const MOCK_FIELD_LIBRARY: FieldDefinition[] = [
  {
    id: 'f-company',
    name: { ru: 'Название компании', en: 'Company Name', lt: 'Įmonės pavadinimas' },
    type: 'text',
    required: true,
    usageCount: 12,
  },
  {
    id: 'f-status',
    name: { ru: 'Статус', en: 'Status', lt: 'Būsena' },
    type: 'enum',
    required: true,
    usageCount: 12,
    options: [
      { ru: 'Активный', en: 'Active', lt: 'Aktyvus' },
      { ru: 'Предпочтительный', en: 'Preferred', lt: 'Pageidaujamas' },
      { ru: 'Новый', en: 'New', lt: 'Naujas' },
      { ru: 'На проверке', en: 'Under Review', lt: 'Tikrinamas' },
      { ru: 'Приостановлен', en: 'Suspended', lt: 'Sustabdytas' },
      { ru: 'Заблокирован', en: 'Blocked', lt: 'Užblokuotas' },
    ],
  },
  {
    id: 'f-rating',
    name: { ru: 'Рейтинг', en: 'Rating', lt: 'Įvertinimas' },
    type: 'number',
    required: false,
    usageCount: 12,
  },
  {
    id: 'f-categories',
    name: { ru: 'Категории', en: 'Categories', lt: 'Kategorijos' },
    type: 'tags',
    required: false,
    usageCount: 10,
  },
  {
    id: 'f-email',
    name: { ru: 'Email', en: 'Email', lt: 'El. paštas' },
    type: 'text',
    required: true,
    usageCount: 12,
  },
  {
    id: 'f-phone',
    name: { ru: 'Телефон', en: 'Phone', lt: 'Telefonas' },
    type: 'text',
    required: false,
    usageCount: 11,
  },
  {
    id: 'f-country',
    name: { ru: 'Страна', en: 'Country', lt: 'Šalis' },
    type: 'enum',
    required: false,
    usageCount: 9,
    options: [
      { ru: 'Эстония', en: 'Estonia', lt: 'Estija' },
      { ru: 'Латвия', en: 'Latvia', lt: 'Latvija' },
      { ru: 'Литва', en: 'Lithuania', lt: 'Lietuva' },
      { ru: 'Германия', en: 'Germany', lt: 'Vokietija' },
      { ru: 'Швеция', en: 'Sweden', lt: 'Švedija' },
      { ru: 'Великобритания', en: 'UK', lt: 'Jungtinė Karalystė' },
    ],
  },
  {
    id: 'f-city',
    name: { ru: 'Город', en: 'City', lt: 'Miestas' },
    type: 'text',
    required: false,
    usageCount: 9,
  },
  {
    id: 'f-lead-time',
    name: { ru: 'Срок поставки (дни)', en: 'Lead Time (days)', lt: 'Pristatymo laikas (dienos)' },
    type: 'number',
    required: false,
    usageCount: 8,
  },
  {
    id: 'f-last-bcc',
    name: { ru: 'Дата последнего BCC', en: 'Last BCC Date', lt: 'Paskutinė BCC data' },
    type: 'date',
    required: false,
    usageCount: 6,
  },
  {
    id: 'f-notes',
    name: { ru: 'Заметки', en: 'Notes', lt: 'Pastabos' },
    type: 'text',
    required: false,
    usageCount: 7,
  },
  {
    id: 'f-certified',
    name: { ru: 'Сертифицирован', en: 'Certified', lt: 'Sertifikuotas' },
    type: 'boolean',
    required: false,
    usageCount: 4,
  },
]

export const MOCK_SECTIONS: SectionConfig[] = [
  {
    id: 'sec-general',
    name: { ru: 'Основная информация', en: 'General Info', lt: 'Pagrindinė informacija' },
    order: 0,
    collapsed: false,
    visible: true,
    system: true,
    fields: [
      { fieldId: 'f-company', order: 0, visible: true },
      { fieldId: 'f-status', order: 1, visible: true },
      { fieldId: 'f-rating', order: 2, visible: true },
      { fieldId: 'f-categories', order: 3, visible: true },
    ],
  },
  {
    id: 'sec-contacts',
    name: { ru: 'Контакты', en: 'Contacts', lt: 'Kontaktai' },
    order: 1,
    collapsed: false,
    visible: true,
    system: true,
    fields: [
      { fieldId: 'f-email', order: 0, visible: true },
      { fieldId: 'f-phone', order: 1, visible: true },
    ],
  },
  {
    id: 'sec-location',
    name: { ru: 'Локация', en: 'Location', lt: 'Vieta' },
    order: 2,
    collapsed: true,
    visible: true,
    system: true,
    fields: [
      { fieldId: 'f-country', order: 0, visible: true },
      { fieldId: 'f-city', order: 1, visible: true },
    ],
  },
  {
    id: 'sec-logistics',
    name: { ru: 'Логистика', en: 'Logistics', lt: 'Logistika' },
    order: 3,
    collapsed: false,
    visible: true,
    system: true,
    fields: [
      { fieldId: 'f-lead-time', order: 0, visible: true },
      { fieldId: 'f-last-bcc', order: 1, visible: true },
    ],
  },
  {
    id: 'sec-notes',
    name: { ru: 'Заметки и документы', en: 'Notes & Docs', lt: 'Pastabos ir dokumentai' },
    order: 4,
    collapsed: false,
    visible: true,
    system: true,
    fields: [
      { fieldId: 'f-notes', order: 0, visible: true },
      { fieldId: 'f-certified', order: 1, visible: false },
    ],
  },
]

export const MOCK_ROLE_USERS: Record<string, string[]> = {
  Admin: ['admin@flexiron.com', 'super@flexiron.com'],
  Sales: ['sales1@flexiron.com', 'sales2@flexiron.com'],
  Warehouse: ['warehouse@flexiron.com'],
  Accounting: ['accounting@flexiron.com', 'finance@flexiron.com'],
}

const PERMISSION_ROLES = ['Admin', 'Sales', 'Warehouse', 'Accounting']
const PERMISSION_ACTIONS: PermissionAction[] = ['read', 'edit', 'create', 'delete']

function buildMockPermissions(): PermissionMatrix {
  // Build items from sections + their fields
  const items: PermissionItem[] = []
  for (const sec of MOCK_SECTIONS) {
    items.push({ itemId: sec.id, name: sec.name, type: 'section' })
    for (const f of sec.fields) {
      const fieldDef = MOCK_FIELD_LIBRARY.find((fd) => fd.id === f.fieldId)
      items.push({
        itemId: f.fieldId,
        name: fieldDef?.name ?? { ru: f.fieldId, en: f.fieldId, lt: f.fieldId },
        type: 'field',
        parentId: sec.id,
      })
    }
  }

  // Default: Admin has all perms, others have none
  const rolePermissions: PermissionMatrix['rolePermissions'] = {}
  for (const item of items) {
    rolePermissions[item.itemId] = {}
    for (const role of PERMISSION_ROLES) {
      const defaults: Record<PermissionAction, boolean> = {
        read: false,
        edit: false,
        create: false,
        delete: false,
      }
      if (role === 'Admin') {
        for (const a of PERMISSION_ACTIONS) defaults[a] = true
      }
      rolePermissions[item.itemId]![role] = defaults
    }
  }

  return {
    roles: PERMISSION_ROLES,
    users: MOCK_ROLE_USERS,
    rolePermissions,
    userPermissions: {},
    items,
  }
}

export const MOCK_PERMISSIONS: PermissionMatrix = buildMockPermissions()

export function mockGetFieldLibrary(): FieldDefinition[] {
  // Clone — иначе `fieldLibrary.value` в composable окажется тем же массивом и любые
  // мутации MOCK_FIELD_LIBRARY (или наоборот) дадут side-effects между запросами.
  return structuredClone(MOCK_FIELD_LIBRARY)
}

export function mockSaveFieldLibrary(fields: FieldDefinition[]): void {
  // Replace stored library with the snapshot the client just sent.
  // JSON roundtrip — not structuredClone — because the composable hands us a Vue
  // reactive Proxy (`fieldLibrary.value`) whose nested objects are Proxies too, and
  // structuredClone rejects Proxy objects with a DataCloneError.
  const snapshot = JSON.parse(JSON.stringify(fields)) as FieldDefinition[]
  MOCK_FIELD_LIBRARY.length = 0
  MOCK_FIELD_LIBRARY.push(...snapshot)
}

export function mockGetSections(): SectionConfig[] {
  return structuredClone(MOCK_SECTIONS)
}

export function mockSaveSections(sections: SectionConfig[]): void {
  // JSON roundtrip — see mockSaveFieldLibrary for the rationale.
  const snapshot = JSON.parse(JSON.stringify(sections)) as SectionConfig[]
  MOCK_SECTIONS.length = 0
  MOCK_SECTIONS.push(...snapshot)
}

export function mockGetPermissions(): PermissionMatrix {
  return structuredClone(MOCK_PERMISSIONS)
}

export function mockSavePermissions(_matrix: PermissionMatrix): void {
  // no-op in mock
}

export function mockCreateField(payload: {
  name: TranslatedString
  type: FieldDefinition['type']
}): FieldDefinition {
  const field: FieldDefinition = {
    id: `f-custom-${Date.now()}`,
    name: payload.name,
    type: payload.type,
    required: false,
    usageCount: 0,
  }
  MOCK_FIELD_LIBRARY.push(field)
  return field
}

export function mockUpdateField(
  id: string,
  patch: Partial<FieldDefinition>,
): FieldDefinition | null {
  const field = MOCK_FIELD_LIBRARY.find((f) => f.id === id)
  if (!field) return null
  // Merge TranslatedString fields to preserve existing locales
  if (patch.name) {
    patch.name = mergeTranslatedString(field.name, patch.name)
  }
  Object.assign(field, patch)
  return field
}

export function mockDeleteField(id: string): void {
  const idx = MOCK_FIELD_LIBRARY.findIndex((f) => f.id === id)
  if (idx !== -1) MOCK_FIELD_LIBRARY.splice(idx, 1)
  for (const sec of MOCK_SECTIONS) {
    sec.fields = sec.fields.filter((f) => f.fieldId !== id)
  }
}

export function mockCreateSection(payload: { name: TranslatedString | string }): SectionConfig {
  const name: TranslatedString =
    typeof payload.name === 'string'
      ? { ru: payload.name, en: payload.name, lt: payload.name }
      : payload.name
  const section: SectionConfig = {
    id: `sec-new-${Date.now()}`,
    name,
    order: MOCK_SECTIONS.length,
    collapsed: false,
    visible: true,
    fields: [],
  }
  MOCK_SECTIONS.push(section)
  return section
}

export function mockUpdateSection(id: string, patch: Partial<SectionConfig>): SectionConfig | null {
  const section = MOCK_SECTIONS.find((s) => s.id === id)
  if (!section) return null
  // Merge TranslatedString fields to preserve existing locales
  if (patch.name) {
    patch.name = mergeTranslatedString(section.name, patch.name)
  }
  Object.assign(section, patch)
  return section
}

export function mockDeleteSection(id: string): void {
  const idx = MOCK_SECTIONS.findIndex((s) => s.id === id)
  if (idx !== -1) MOCK_SECTIONS.splice(idx, 1)
}
