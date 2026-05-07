# Рефакторинг переводов: CategoryCardPage.vue

## Цель
Перевести страницу карточки категории на `TranslatedString { ru, en, lt }` — чтобы переводы приходили с сервера (или из моков) и мгновенно переключались при смене языка без перезапроса данных.

**Архитектура (как в аналитике):**
1. Типы: все пользовательские строки → `TranslatedString`
2. Моки: все UI-строки → `{ ru, en, lt }`
3. Сервисы: добавить `getCategoryTranslated()` рядом со старой `getCategory()`
4. Композаблы: добавить `useCategoryCardTranslated()` рядом со старой `useCategoryCard()`
5. Страница: использовать `useCategoryCardTranslated()` + `tf()` для динамических данных
6. Переключение mock/API: уже работает через `apiGet()` → `USE_MOCKS` → `getMock()`

---

## Файлы для изменения

### 1. `frontend_vue/src/types/category.ts`

Уже должно быть изменено в рамках `03-categories-page.md`. Если нет — изменить:

```typescript
import type { TranslatedString } from '@/types/i18n'

export interface CategoryField {
  id: string
  name: TranslatedString        // было: string
  type: CategoryFieldType
  required: boolean
  order: number
  options: TranslatedString[]   // было: string[]
}

export interface Category {
  id: string
  name: TranslatedString        // было: string
  parentId: string | null
  description: string | null
  fieldCount: number
  productCount: number
  inheritedFields: CategoryField[]
  fields: CategoryField[]
  linkedSuppliers: LinkedSupplier[]
}

export interface CategoryListItem {
  id: string
  name: TranslatedString        // было: string
  parentId: string | null
  parentName: TranslatedString | null  // было: string | null
  fieldCount: number
  productCount: number
  level: number
}
```

### 2. `frontend_vue/src/services/mocks/categories.ts`

Все `name` (категорий, полей) и `options[]` — заменить на `{ ru, en, lt }`.

Пример:
```typescript
{
  id: 'cat-1',
  name: { ru: 'Металл', en: 'Metal', lt: 'Metalas' },
  parentId: null,
  description: { ru: 'Все виды металлопродукции', en: 'All types of metal products', lt: 'Visi metalo gaminių tipai' },
  // ...
  fields: [
    { id: 'f-1-1', name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, type: 'text', required: true, order: 0, options: [] },
    { id: 'f-2-2', name: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, type: 'enum', required: false, order: 1, options: [
      { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
      { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
      { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
    ] },
  ],
}
```

### 3. `frontend_vue/src/services/categoriesService.ts`

Добавить новую функцию рядом со старой (старую НЕ удаляем):

```typescript
export async function getCategoryTranslated(id: string): Promise<Category> {
  return apiGet(`/api/categories/${id}/translated`)
}
```

### 4. `frontend_vue/src/composables/useCategoryCard.ts`

Добавить новый композабл рядом со старым (старый НЕ удаляем):

```typescript
import { useTranslatedField } from './useTranslatedData'

// ─── Translated variant ───

export function useCategoryCardTranslated(id: string) {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const category = ref<Category | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const form = ref<Pick<Category, 'name' | 'parentId' | 'description'>>({
    name: '',
    parentId: null,
    description: null,
  })
  const dirty = useDirtyCheck(form)

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
      const data = await getCategoryTranslated(id)
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
    tf,
  }
}
```

### 5. `frontend_vue/src/views/admin/products/CategoryCardPage.vue`

**В `<script setup>`:**
- Удалить `import { useLabelResolver } from '@/composables/useLabelResolver'`
- Удалить `const { resolveLabel } = useLabelResolver()`
- Заменить `import { useCategoryCard } from '@/composables/useCategoryCard'` на `import { useCategoryCardTranslated } from '@/composables/useCategoryCard'`
- Заменить `const { category, loading, ... } = useCategoryCard(props.id)` на `const { category, loading, ..., tf } = useCategoryCardTranslated(props.id)`

**В шаблоне:**
- `resolveLabel(category.value.name)` → `tf(category.value.name)`
- `resolveLabel(category.name)` → `tf(category.name)`
- `resolveLabel(c.name)` → `tf(c.name)` (для parent category)
- `resolveLabel(field.name)` → `tf(field.name)`
- `resolveLabel(allCategories.find(...)?.name ...)` → `tf(allCategories.find(...)?.name ?? '')`

**Добавить загрузочный скелетон:**
```vue
<template v-if="loading">
  <GlassPanel :loading="true" :skeleton-rows="6" />
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

1. **Загрузка**: `useCategoryCardTranslated()` вызывает `getCategoryTranslated()` → `apiGet('/api/categories/:id/translated')` → `getMock()` возвращает данные с `{ ru, en, lt }`
2. **Рендеринг**: `tf(field.name)` берёт `field.name.ru` или `field.name.en` или `field.name.lt` в зависимости от `locale.value`
3. **Переключение языка**: `tf()` — это `computed`, он реактивно меняется при `locale.value = 'en'`. Мгновенно, без перезапроса.
4. **Режим API**: достаточно выставить `VITE_USE_MOCKS=false` — и `apiGet()` пойдёт на реальный бэкенд, который должен вернуть те же `{ ru, en, lt }` структуры.
