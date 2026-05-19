# Рефакторинг переводов: SupplierCardConfigPage.vue

## Цель
Перевести страницу конфигурации карточки поставщика на `TranslatedString { ru, en, lt }` — чтобы переводы приходили с сервера (или из моков) и мгновенно переключались при смене языка без перезапроса данных.

**Архитектура (как в аналитике):**
1. Типы: все пользовательские строки → `TranslatedString`
2. Моки: все UI-строки → `{ ru, en, lt }`
3. Сервисы: добавить `getFieldLibraryTranslated()`, `getSectionsTranslated()`, `getPermissionsTranslated()` рядом со старыми
4. Композаблы: добавить `useCardConfigTranslated()` рядом со старым `useCardConfig()`
5. Страница: использовать `useCardConfigTranslated()` + `tf()` для динамических данных
6. Переключение mock/API: уже работает через `apiGet()` → `USE_MOCKS` → `getMock()`

---

## Файлы для изменения

### 1. `frontend_vue/src/types/config.ts`

Изменить поля, которые отображаются пользователю:

```typescript
import type { TranslatedString } from '@/types/i18n'

export interface FieldDefinition {
  id: string
  name: TranslatedString        // было: string
  type: FieldType
  required: boolean
  usageCount: number
  hidden?: boolean
  options?: TranslatedString[]  // было: string[]
}

export interface SectionConfig {
  id: string
  name: TranslatedString        // было: string
  order: number
  collapsed: boolean
  visible: boolean
  system?: boolean
  fields: SectionField[]
}

export interface PermissionItem {
  itemId: string
  name: TranslatedString        // было: string
  type: 'section' | 'field'
  parentId?: string
}
```

### 2. `frontend_vue/src/services/mocks/config.ts`

Все `name` (полей, секций, элементов прав) и `options[]` — заменить на `{ ru, en, lt }`.

Пример:
```typescript
export const MOCK_FIELD_LIBRARY: FieldDefinition[] = [
  { id: 'f-company', name: { ru: 'Название компании', en: 'Company Name', lt: 'Įmonės pavadinimas' }, type: 'text', required: true, usageCount: 12 },
  { id: 'f-status', name: { ru: 'Статус', en: 'Status', lt: 'Būsena' }, type: 'enum', required: true, usageCount: 12, options: [
    { ru: 'Активный', en: 'Active', lt: 'Aktyvus' },
    { ru: 'Предпочтительный', en: 'Preferred', lt: 'Pageidaujamas' },
    { ru: 'Новый', en: 'New', lt: 'Naujas' },
    { ru: 'На проверке', en: 'Under Review', lt: 'Tikrinamas' },
    { ru: 'Приостановлен', en: 'Suspended', lt: 'Sustabdytas' },
    { ru: 'Заблокирован', en: 'Blocked', lt: 'Užblokuotas' },
  ] },
  { id: 'f-rating', name: { ru: 'Рейтинг', en: 'Rating', lt: 'Įvertinimas' }, type: 'number', required: false, usageCount: 12 },
  { id: 'f-categories', name: { ru: 'Категории', en: 'Categories', lt: 'Kategorijos' }, type: 'tags', required: false, usageCount: 10 },
  { id: 'f-email', name: { ru: 'Email', en: 'Email', lt: 'El. paštas' }, type: 'text', required: true, usageCount: 12 },
  { id: 'f-phone', name: { ru: 'Телефон', en: 'Phone', lt: 'Telefonas' }, type: 'text', required: false, usageCount: 11 },
  { id: 'f-country', name: { ru: 'Страна', en: 'Country', lt: 'Šalis' }, type: 'enum', required: false, usageCount: 9, options: [
    { ru: 'Эстония', en: 'Estonia', lt: 'Estija' },
    { ru: 'Латвия', en: 'Latvia', lt: 'Latvija' },
    { ru: 'Литва', en: 'Lithuania', lt: 'Lietuva' },
    { ru: 'Германия', en: 'Germany', lt: 'Vokietija' },
    { ru: 'Швеция', en: 'Sweden', lt: 'Švedija' },
    { ru: 'Великобритания', en: 'UK', lt: 'Jungtinė Karalystė' },
  ] },
  { id: 'f-city', name: { ru: 'Город', en: 'City', lt: 'Miestas' }, type: 'text', required: false, usageCount: 9 },
  { id: 'f-lead-time', name: { ru: 'Срок поставки (дни)', en: 'Lead Time (days)', lt: 'Pristatymo laikas (dienos)' }, type: 'number', required: false, usageCount: 8 },
  { id: 'f-last-bcc', name: { ru: 'Дата последнего BCC', en: 'Last BCC Date', lt: 'Paskutinė BCC data' }, type: 'date', required: false, usageCount: 6 },
  { id: 'f-notes', name: { ru: 'Заметки', en: 'Notes', lt: 'Pastabos' }, type: 'text', required: false, usageCount: 7 },
  { id: 'f-certified', name: { ru: 'Сертифицирован', en: 'Certified', lt: 'Sertifikuotas' }, type: 'boolean', required: false, usageCount: 4 },
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
      // ...
    ],
  },
  {
    id: 'sec-contacts',
    name: { ru: 'Контакты', en: 'Contacts', lt: 'Kontaktai' },
    order: 1,
    // ...
  },
  // ...
]
```

Для `PermissionItem`:
```typescript
items: [
  { itemId: 'sec-general', name: { ru: 'Основная информация', en: 'General Info', lt: 'Pagrindinė informacija' }, type: 'section' },
  { itemId: 'f-company', name: { ru: 'Название компании', en: 'Company Name', lt: 'Įmonės pavadinimas' }, type: 'field', parentId: 'sec-general' },
  // ...
]
```

### 3. `frontend_vue/src/services/configService.ts`

Добавить новые функции рядом со старыми (старые НЕ удаляем):

```typescript
// ─── Translated variants (server-provided translations) ───

export async function getFieldLibraryTranslated(): Promise<FieldDefinition[]> {
  return apiGet<FieldDefinition[]>('/api/config/fields/translated')
}

export async function getSectionsTranslated(): Promise<SectionConfig[]> {
  return apiGet<SectionConfig[]>('/api/config/sections/translated')
}

export async function getPermissionsTranslated(): Promise<PermissionMatrix> {
  return apiGet<PermissionMatrix>('/api/config/permissions/translated')
}
```

### 4. `frontend_vue/src/composables/useCardConfig.ts`

Добавить новый композабл рядом со старым (старый НЕ удаляем):

```typescript
import { useTranslatedField } from './useTranslatedData'

// ─── Translated variant ───

export function useCardConfigTranslated() {
  const { tf } = useTranslatedField()

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
        getFieldLibraryTranslated(),
        getSectionsTranslated(),
        getPermissionsTranslated(),
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
    tf,
  }
}
```

### 5. `frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue`

**В `<script setup>`:**
- Удалить `import { useLabelResolver } from '@/composables/useLabelResolver'`
- Удалить `const { resolveLabel } = useLabelResolver()`
- Заменить `import { useCardConfig } from '@/composables/useCardConfig'` на `import { useCardConfigTranslated } from '@/composables/useCardConfig'`
- Заменить `const { fieldLibrary, sections, ... } = useCardConfig()` на `const { fieldLibrary, sections, ..., tf } = useCardConfigTranslated()`

**В шаблоне:**
- `resolveLabel(f.name)` → `tf(f.name)`
- `resolveLabel(sec.name)` → `tf(sec.name)`
- `resolveLabel(fieldById(f.fieldId)?.name ?? f.fieldId)` → `tf(fieldById(f.fieldId)?.name ?? f.fieldId)`
- `resolveLabel(item.name)` → `tf(item.name)`

**Добавить загрузочный скелетон:**
```vue
<template v-if="loading">
  <GlassPanel :loading="true" :skeleton-rows="8" />
</template>
<template v-else-if="error">
  <div class="error-state">{{ error }}</div>
</template>
<template v-else>
  <!-- существующий контент -->
</template>
```

### 6. Проверка

```bash
npx vue-tsc --noEmit
npm run build
```

---

## Как это работает

1. **Загрузка**: `useCardConfigTranslated()` вызывает `getFieldLibraryTranslated()`, `getSectionsTranslated()`, `getPermissionsTranslated()` → `apiGet('/api/config/.../translated')` → `getMock()` возвращает данные с `{ ru, en, lt }`
2. **Рендеринг**: `tf(f.name)` берёт `f.name.ru` или `f.name.en` или `f.name.lt` в зависимости от `locale.value`
3. **Переключение языка**: `tf()` — это `computed`, он реактивно меняется при `locale.value = 'en'`. Мгновенно, без перезапроса.
4. **Режим API**: достаточно выставить `VITE_USE_MOCKS=false` — и `apiGet()` пойдёт на реальный бэкенд, который должен вернуть те же `{ ru, en, lt }` структуры.
