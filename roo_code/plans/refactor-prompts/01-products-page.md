# Рефакторинг переводов: ProductsPage.vue

## Цель
Перевести страницу продуктов на `TranslatedString { ru, en, lt }` — чтобы переводы приходили с сервера (или из моков) и мгновенно переключались при смене языка без перезапроса данных.

**Архитектура (как в аналитике):**
1. Типы: все пользовательские строки → `TranslatedString`
2. Моки: все UI-строки → `{ ru, en, lt }`
3. Сервисы: добавить `getProductsTranslated()` рядом со старой `getProducts()`
4. Композаблы: добавить `useProductsTranslated()` рядом со старой `useProducts()`
5. Страница: использовать `useProductsTranslated()` + `tf()` для динамических данных
6. Переключение mock/API: уже работает через `apiGet()` → `USE_MOCKS` → `getMock()`

---

## Файлы для изменения

### 1. `frontend_vue/src/types/product.ts`

Изменить поля, которые отображаются пользователю:

```typescript
import type { TranslatedString } from '@/types/i18n'

export interface ProductFieldValue {
  fieldId: string
  fieldName: TranslatedString   // было: string
  fieldType: CategoryFieldType
  value: string | number | boolean | string[] | null
  inherited: boolean
  options?: TranslatedString[]  // было: string[]
}

export interface LinkedSupplier {
  id: string
  name: TranslatedString        // было: string
  price: number | null
  priceUnit: string | null
  leadDays: number | null
}

export interface ProductListItem {
  id: string
  name: TranslatedString        // было: string
  categoryId: string | null
  categoryName: TranslatedString | null  // было: string | null
  sku: string | null
  price: number | null
  minStock: number | null
  priceUnit: PriceUnit | null
  createdAt: string
}

export interface Product {
  id: string
  name: TranslatedString        // было: string
  categoryId: string | null
  categoryName: TranslatedString | null  // было: string | null
  sku: string | null
  description: string | null
  price: number | null
  minStock: number | null
  priceUnit: PriceUnit | null
  createdAt: string
  fieldValues: ProductFieldValue[]
  linkedSuppliers: LinkedSupplier[]
}
```

### 2. `frontend_vue/src/services/mocks/products.ts`

Все `name`, `fieldName`, `categoryName`, `options[]` — заменить на `{ ru, en, lt }`.

Пример для одного продукта:
```typescript
{
  id: 'prod-001',
  name: { ru: 'Стальной лист 3мм', en: 'Steel Sheet 3mm', lt: 'Plieno lakštas 3mm' },
  categoryId: 'cat-2',
  categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
  sku: 'SS-3-1000',
  description: { ru: 'Горячекатаный стальной лист, 1000x2000мм', en: 'Hot-rolled steel sheet, 1000x2000mm', lt: 'Karštai valcuotas plieno lakštas, 1000x2000mm' },
  price: 120.50,
  minStock: 50,
  priceUnit: 'EUR/vnt',
  createdAt: '2025-01-15',
  fieldValues: [
    { fieldId: 'f-1-1', fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' }, fieldType: 'text', value: 'S235JR', inherited: true, options: [] },
    { fieldId: 'f-2-2', fieldName: { ru: 'Тип листа', en: 'Sheet type', lt: 'Lakšto tipas' }, fieldType: 'enum', value: 'Hot-rolled', inherited: false, options: [
      { ru: 'Горячекатаный', en: 'Hot-rolled', lt: 'Karštai valcuotas' },
      { ru: 'Холоднокатаный', en: 'Cold-rolled', lt: 'Šaltai valcuotas' },
      { ru: 'Оцинкованный', en: 'Galvanized', lt: 'Cinkuotas' },
    ] },
  ],
  linkedSuppliers: [
    { id: '1', name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' }, price: 115.00, priceUnit: 'EUR/vnt', leadDays: 7 },
  ],
}
```

**ВАЖНО**: Поля `sku`, `price`, `minStock`, `priceUnit`, `createdAt` — НЕ переводим (технические данные).
Поля `id`, `fieldId`, `categoryId` — идентификаторы, не переводим.
Имена компаний-поставщиков (`LinkedSupplier.name`) — proper nouns, но для единообразия тоже оборачиваем в `{ ru, en, lt }` (значения могут быть одинаковыми).

### 3. `frontend_vue/src/services/productsService.ts`

Добавить новую функцию рядом со старой (старую НЕ удаляем):

```typescript
// ─── Translated variants (server-provided translations) ───

export async function getProductsTranslated(
  filters: ProductFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<ProductListItem>> {
  const params: Record<string, string> = {
    search: filters.search,
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
  }
  if (filters.categoryIds.length > 0) params.categoryIds = filters.categoryIds.join(',')
  if (filters.sortBy) { params.sortBy = filters.sortBy; params.sortDir = filters.sortDir }
  return apiGet('/api/products/translated', params)
}

export async function getProductTranslated(id: string): Promise<Product> {
  return apiGet(`/api/products/${id}/translated`)
}
```

### 4. `frontend_vue/src/composables/useProducts.ts`

Добавить новый композабл рядом со старым (старый НЕ удаляем):

```typescript
import { useTranslatedField } from './useTranslatedData'

// ─── Translated variant ───

export function useProductsTranslated() {
  const { t } = useI18n()
  const toast = useToast()
  const { tf } = useTranslatedField()

  const items = ref<ProductListItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<ProductFilters>({ search: '', categoryIds: [], sortBy: null, sortDir: 'asc' })
  const pagination = usePagination(25)

  let initialized = false

  async function load() {
    if (!initialized) loading.value = true
    error.value = null
    try {
      const res = await getProductsTranslated(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      items.value = res.items
      pagination.total.value = res.total
      initialized = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load products'
    } finally {
      loading.value = false
    }
  }

  async function deleteProduct(id: string) {
    try {
      await deleteProductApi(id)
      toast.success(t('products.toast_deleted'))
      await load()
    } catch {
      toast.error(t('products.toast_error_delete'))
    }
  }

  let skipNextPageWatch = false

  watch(filters, () => {
    skipNextPageWatch = pagination.page.value !== 1
    pagination.reset()
    load()
  }, { deep: true })

  watch([pagination.page, pagination.pageSize], () => {
    if (skipNextPageWatch) {
      skipNextPageWatch = false
      return
    }
    load()
  })

  function toggleSort(col: 'name' | 'category' | 'price') {
    if (filters.sortBy === col) {
      filters.sortDir = filters.sortDir === 'asc' ? 'desc' : 'asc'
    } else {
      filters.sortBy = col
      filters.sortDir = 'asc'
    }
  }

  return { items, loading, error, filters, pagination, load, deleteProduct, toggleSort, tf }
}
```

### 5. `frontend_vue/src/views/admin/products/ProductsPage.vue`

**В `<script setup>`:**
- Удалить `import { useLabelResolver } from '@/composables/useLabelResolver'`
- Удалить `const { resolveLabel } = useLabelResolver()`
- Заменить `import { useProducts } from '@/composables/useProducts'` на `import { useProductsTranslated } from '@/composables/useProducts'`
- Заменить `const { items, loading, error, filters, pagination, load, deleteProduct, toggleSort } = useProducts()` на `const { items, loading, error, filters, pagination, load, deleteProduct, toggleSort, tf } = useProductsTranslated()`

**В шаблоне:**
- `resolveLabel(item.name)` → `tf(item.name)`
- `resolveLabel(item.categoryName)` → `tf(item.categoryName)`
- `resolveLabel(cat.name)` → `tf(cat.name)` (в модалке фильтра)
- `resolveLabel(parent.name)` → `tf(parent.name)` (в модалке фильтра)

**Добавить загрузочный скелетон (как в аналитике):**
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

Не забудь импортировать `GlassPanel`, если его нет.

### 6. Проверка

```bash
npx vue-tsc --noEmit
npm run build
```

---

## Как это работает

1. **Загрузка**: `useProductsTranslated()` вызывает `getProductsTranslated()` → `apiGet('/api/products/translated')` → `getMock()` возвращает данные с `{ ru, en, lt }`
2. **Рендеринг**: `tf(item.name)` берёт `item.name.ru` или `item.name.en` или `item.name.lt` в зависимости от `locale.value`
3. **Переключение языка**: `tf()` — это `computed`, он реактивно меняется при `locale.value = 'en'`. Мгновенно, без перезапроса.
4. **Режим API**: достаточно выставить `VITE_USE_MOCKS=false` — и `apiGet()` пойдёт на реальный бэкенд, который должен вернуть те же `{ ru, en, lt }` структуры.
