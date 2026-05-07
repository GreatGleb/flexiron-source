# Рефакторинг переводов: SuppliersListPage.vue

## Цель
Перевести страницу списка поставщиков на `TranslatedString { ru, en, lt }` — чтобы переводы приходили с сервера (или из моков) и мгновенно переключались при смене языка без перезапроса данных.

**Архитектура (как в аналитике):**
1. Типы: все пользовательские строки → `TranslatedString`
2. Моки: все UI-строки → `{ ru, en, lt }`
3. Сервисы: добавить `getSuppliersTranslated()` рядом со старой `getSuppliers()`
4. Композаблы: добавить `useSuppliersTranslated()` рядом со старой `useSuppliers()`
5. Страница: использовать `useSuppliersTranslated()` + `tf()` для динамических данных
6. Переключение mock/API: уже работает через `apiGet()` → `USE_MOCKS` → `getMock()`

---

## Файлы для изменения

### 1. `frontend_vue/src/types/supplier.ts`

> **Важно:** Типы `Supplier` и `SupplierCardData` уже будут изменены в рамках `08-supplier-create-page.md` и `06-supplier-card-page.md`. Убедиться, что поля `company` и `contactPerson` уже `TranslatedString`.

Дополнительно для списка поставщиков — проверить, что `SupplierFilters` не содержит пользовательских строк (не меняется):

```typescript
export interface SupplierFilters {
  search: string        // техническое поле, не меняется
  status: SupplierStatus | 'all'
  categories: string[]  // техническое поле (ключи категорий)
  rating: number
}
```

**Какие поля отображаются в списке (`SuppliersListPage.vue`):**
- `s.company` — в таблице и канбане → `TranslatedString` ✓ (уже меняется)
- `s.status` — статус, не переводится (ключ для i18n)
- `s.rating` — число, не переводится
- `s.categories` — массив ключей, перевод через `t('category.${c}')`
- `s.leadTime` — число, не переводится
- `s.lastBccDate` — дата или 'Never', не переводится
- `s.email` — техническое поле
- `s.hasDeficit` — булево, не переводится

---

### 2. `frontend_vue/src/services/suppliersService.ts`

Добавить новый метод рядом со старым:

```typescript
import type { Supplier, SupplierCardData, SupplierFilters } from '@/types/supplier'
import type { PaginatedResponse, PaginationParams } from '@/types/api'

// Старый (остаётся для обратной совместимости)
export async function getSuppliers(
  filters: SupplierFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<Supplier>> {
  const params: Record<string, string> = {
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
    search: filters.search,
    status: filters.status,
    rating: String(filters.rating),
  }
  if (filters.categories.length > 0) {
    params.categories = filters.categories.join(',')
  }
  return apiGet<PaginatedResponse<Supplier>>('/api/suppliers', params)
}

// Новый — возвращает TranslatedString-поля
export async function getSuppliersTranslated(
  filters: SupplierFilters,
  pagination: PaginationParams,
): Promise<PaginatedResponse<Supplier>> {
  const params: Record<string, string> = {
    page: String(pagination.page),
    pageSize: String(pagination.pageSize),
    search: filters.search,
    status: filters.status,
    rating: String(filters.rating),
  }
  if (filters.categories.length > 0) {
    params.categories = filters.categories.join(',')
  }
  return apiGet<PaginatedResponse<Supplier>>('/api/suppliers', params)
}
```

> Примечание: эндпоинт тот же (`GET /api/suppliers`). Разница только в том, что ответ теперь содержит `TranslatedString` вместо `string` для `company` и `contactPerson`.

---

### 3. `frontend_vue/src/services/mocks/suppliers.ts`

Уже будет обновлено в рамках `08-supplier-create-page.md` — `MOCK_SUPPLIERS` будет содержать `TranslatedString` для `company` и `contactPerson`.

Дополнительно обновить `mockGetSuppliers`, если он возвращает данные в старом формате:

```typescript
export function mockGetSuppliers(
  filters: SupplierFilters,
  pagination: PaginationParams,
): PaginatedResponse<Supplier> {
  let filtered = [...MOCK_SUPPLIERS]

  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = filtered.filter(
      (s) =>
        s.company.ru?.toLowerCase().includes(q) ||
        s.company.en?.toLowerCase().includes(q) ||
        s.company.lt?.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q),
    )
  }

  if (filters.status !== 'all') {
    filtered = filtered.filter((s) => s.status === filters.status)
  }

  if (filters.categories.length > 0) {
    filtered = filtered.filter((s) =>
      filters.categories.some((c) => s.categories.includes(c)),
    )
  }

  if (filters.rating > 0) {
    filtered = filtered.filter((s) => s.rating >= filters.rating)
  }

  const total = filtered.length
  const start = (pagination.page - 1) * pagination.pageSize
  const items = filtered.slice(start, start + pagination.pageSize)

  return { items, total }
}
```

> **Важно:** Фильтрация по `search` теперь должна проверять все языки (`company.ru`, `company.en`, `company.lt`), а не только строку.

---

### 4. `frontend_vue/src/composables/useSuppliers.ts`

Создать новый композабл `useSuppliersTranslated()` рядом со старым `useSuppliers()`:

```typescript
import { ref, reactive, watch } from 'vue'
import { getSuppliersTranslated } from '@/services/suppliersService'
import { usePagination } from './usePagination'
import type { Supplier, SupplierFilters } from '@/types/supplier'

export function useSuppliersTranslated() {
  const suppliers = ref<Supplier[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filters = reactive<SupplierFilters>({
    search: '',
    status: 'all',
    categories: [],
    rating: 0,
  })

  const pagination = usePagination(25)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const res = await getSuppliersTranslated(filters, {
        page: pagination.page.value,
        pageSize: pagination.pageSize.value,
      })
      suppliers.value = res.items
      pagination.total.value = res.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load suppliers'
    } finally {
      loading.value = false
    }
  }

  function resetFilters() {
    filters.search = ''
    filters.status = 'all'
    filters.categories = []
    filters.rating = 0
    pagination.reset()
  }

  async function changeStatus(id: string, status: string) {
    const s = suppliers.value.find((sup) => sup.id === id)
    if (s) s.status = status as Supplier['status']
    await patchSupplierStatus(id, status)
  }

  let skipNextPageWatch = false

  watch(
    () => [filters.search, filters.status, [...filters.categories], filters.rating],
    () => {
      skipNextPageWatch = pagination.page.value !== 1
      pagination.reset()
      load()
    },
    { deep: true },
  )

  watch([pagination.page, pagination.pageSize], () => {
    if (skipNextPageWatch) {
      skipNextPageWatch = false
      return
    }
    load()
  })

  return { suppliers, loading, error, filters, pagination, load, resetFilters, changeStatus }
}
```

---

### 5. `frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue`

#### Импорты

```vue
<script setup lang="ts">
// Было:
// import { useSuppliers } from '@/composables/useSuppliers'
// const { suppliers, loading, error, filters, pagination, load, changeStatus } = useSuppliers()

// Стало:
import { useSuppliersTranslated } from '@/composables/useSuppliersTranslated'
const { suppliers, loading, error, filters, pagination, load, changeStatus } = useSuppliersTranslated()
</script>
```

#### Шаблон — отображение `company` через `tf()`

В таблице (строка ~460):
```vue
<!-- Было: -->
<!-- {{ s.company }} -->

<!-- Стало: -->
{{ tf(s.company) }}
```

В канбане (строка ~601):
```vue
<!-- Было: -->
<!-- :company-name="s.company" -->

<!-- Стало: -->
:company-name="tf(s.company)"
```

#### Экспорт CSV (функция `exportCsv`, строка ~200)

При экспорте нужно выбрать один язык для поля `company` — например, английский:

```typescript
function exportCsv() {
  const rows = suppliers.value.map((s) =>
    [
      s.company?.en ?? s.company?.ru ?? '',  // было: s.company
      STATUS_LABEL[s.status],
      s.rating,
      s.categories.join(';'),
      s.leadTime,
      s.email,
      s.phone,
    ].join(','),
  )
  // ...
}
```

#### Модальное окно подтверждения (строка ~619-627)

Поле `pendingMove.company` — отобразить через `tf()`:

```vue
<p v-if="pendingMove">
  {{
    t('modal.confirm_move_message', {
      company: tf(pendingMove.company),   // было: pendingMove.company
      from: t(`st.${pendingMove.fromStatus}`),
      to: t(`st.${pendingMove.toStatus}`),
    })
  }}
</p>
```

---

### 6. `frontend_vue/src/services/mocks/index.ts`

Обновить маршрутизацию моков для `GET /api/suppliers` — убедиться, что возвращаются `TranslatedString`:

```typescript
if (path === '/api/suppliers' && method === 'GET') {
  const filters: SupplierFilters = {
    search: params.search ?? '',
    status: (params.status as SupplierFilters['status']) ?? 'all',
    categories: params.categories ? params.categories.split(',') : [],
    rating: params.rating ? Number(params.rating) : 0,
  }
  const pagination: PaginationParams = {
    page: params.page ? Number(params.page) : 1,
    pageSize: params.pageSize ? Number(params.pageSize) : 25,
  }
  return delay(mockGetSuppliers(filters, pagination) as T)
}
```

Метод уже существует, нужно только убедиться, что `MOCK_SUPPLIERS` содержит `TranslatedString` (изменение из `08-supplier-create-page.md`).

---

### 7. `frontend_vue/src/components/admin/KanbanCard.vue`

Компонент `KanbanCard` принимает проп `company-name` как строку. После рефакторинга страница будет передавать уже переведённую строку через `tf(s.company)`, поэтому изменений в `KanbanCard` не требуется.

---

## Порядок выполнения

1. Типы (`supplier.ts`) — уже изменены в `08-supplier-create-page.md` (убедиться)
2. Моки (`suppliers.ts`) — уже обновлены в `08-supplier-create-page.md` (убедиться)
3. Сервисы (`suppliersService.ts`) — добавить `getSuppliersTranslated()`
4. Композабл (`useSuppliers.ts`) — добавить `useSuppliersTranslated()`
5. Страница (`SuppliersListPage.vue`) — переключиться на новый композабл, добавить `tf()` в шаблон
6. Мок-индекс (`mocks/index.ts`) — проверить маршрутизацию
