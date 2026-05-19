# Рефакторинг переводов: CategoriesPage.vue

## Цель
Перевести страницу категорий на `TranslatedString { ru, en, lt }` — чтобы переводы приходили с сервера (или из моков) и мгновенно переключались при смене языка без перезапроса данных.

**Архитектура (как в аналитике):**
1. Типы: все пользовательские строки → `TranslatedString`
2. Моки: все UI-строки → `{ ru, en, lt }`
3. Сервисы: добавить `getCategoriesTranslated()` рядом со старой `getCategories()`
4. Композаблы: добавить `useCategoriesTranslated()` рядом со старой `useCategories()`
5. Страница: использовать `useCategoriesTranslated()` + `tf()` для динамических данных
6. Переключение mock/API: уже работает через `apiGet()` → `USE_MOCKS` → `getMock()`

---

## Файлы для изменения

### 1. `frontend_vue/src/types/category.ts`

Изменить поля, которые отображаются пользователю:

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
// ─── Translated variants (server-provided translations) ───

export async function getCategoriesTranslated(
  filters: CategoryFilters,
  page = 1,
  pageSize = 25,
): Promise<PaginatedResponse<CategoryListItem>> {
  return apiGet('/api/categories/translated', {
    search: filters.search,
    page: String(page),
    pageSize: String(pageSize),
  })
}
```

### 4. `frontend_vue/src/composables/useCategories.ts`

Добавить новый композабл рядом со старым (старый НЕ удаляем):

```typescript
import { useTranslatedField } from './useTranslatedData'

// ─── Translated variant ───

export function useCategoriesTranslated() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const items = ref<CategoryListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<CategoryFilters>({ search: '' })

  let initialized = false

  async function load() {
    if (!initialized) loading.value = true
    error.value = null
    try {
      const res = await getCategoriesTranslated(filters)
      items.value = res.items
      initialized = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load categories'
    } finally {
      loading.value = false
    }
  }

  async function deleteCategory(id: string) {
    try {
      await deleteCategoryApi(id)
      toast.success(t('categories.toast_deleted'))
      await load()
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      if (code === 'CATEGORY_HAS_PRODUCTS') {
        toast.error(t('categories.toast_error_delete_has_products'))
      } else if (code === 'CATEGORY_HAS_CHILDREN') {
        toast.error(t('categories.toast_error_delete_has_children'))
      } else {
        toast.error(t('categories.toast_error'))
      }
    }
  }

  watch(filters, load, { deep: true })

  return { items, loading, error, filters, load, deleteCategory, tf }
}
```

### 5. `frontend_vue/src/views/admin/products/CategoriesPage.vue`

**В `<script setup>`:**
- Удалить `import { useLabelResolver } from '@/composables/useLabelResolver'`
- Удалить `const { resolveLabel } = useLabelResolver()`
- Заменить `import { useCategories } from '@/composables/useCategories'` на `import { useCategoriesTranslated } from '@/composables/useCategories'`
- Заменить `const { items, loading, error, filters, load, deleteCategory } = useCategories()` на `const { items, loading, error, filters, load, deleteCategory, tf } = useCategoriesTranslated()`

**В шаблоне:**
- `resolveLabel(item.name)` → `tf(item.name)`
- `resolveLabel(item.parentName)` → `tf(item.parentName)`

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

1. **Загрузка**: `useCategoriesTranslated()` вызывает `getCategoriesTranslated()` → `apiGet('/api/categories/translated')` → `getMock()` возвращает данные с `{ ru, en, lt }`
2. **Рендеринг**: `tf(item.name)` берёт `item.name.ru` или `item.name.en` или `item.name.lt` в зависимости от `locale.value`
3. **Переключение языка**: `tf()` — это `computed`, он реактивно меняется при `locale.value = 'en'`. Мгновенно, без перезапроса.
4. **Режим API**: достаточно выставить `VITE_USE_MOCKS=false` — и `apiGet()` пойдёт на реальный бэкенд, который должен вернуть те же `{ ru, en, lt }` структуры.
