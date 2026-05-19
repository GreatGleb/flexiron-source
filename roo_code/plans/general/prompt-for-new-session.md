# Проверка всех мок-маршрутов после исправления баги с translated

## Контекст

Была найдена и исправлена бага в [`frontend_vue/src/services/mocks/index.ts`](../frontend_vue/src/services/mocks/index.ts): порядок маршрутов в `getMock()` был неправильным. Regex для карточки товара (`/^\/api\/products\/([^/]+)$/`) перехватывал путь `/api/products/translated` раньше, чем до него доходила явная проверка. Аналогичная проблема была и для `/api/suppliers/translated`.

## Исправления уже применены

1. **Продукты** (строки 175-197): явная проверка `/api/products` / `/api/products/translated` перемещена **перед** regex-ами для карточки
2. **Поставщики** (строки 100-122): явная проверка `/api/suppliers` / `/api/suppliers/translated` перемещена **перед** regex-ами для карточки

## Задача

Нужно проверить, что **все** маршруты в `getMock()`, `postMock()`, `putMock()`, `patchMock()`, `deleteMock()` обрабатываются в правильном порядке и нет других аналогичных баг.

### Алгоритм проверки для каждого HTTP-метода

Для каждого набора маршрутов нужно проверить:

1. **Список (`/api/:resource`) vs Карточка (`/api/:resource/:id`)** — если есть regex вида `/^\/api\/resource\/([^/]+)$/`, он может перехватить путь `/api/resource/something` где `something` — не ID, а ключевое слово (например, `translated`, `export.csv`, `status`). Проверка списка должна быть **до** regex карточки.

2. **Явные пути vs Regex** — если есть явная проверка `path === '/api/resource/translated'`, она должна быть расположена **до** regex, который может совпасть с этим путём.

3. **Специфичные regex vs Общие regex** — более специфичные regex (например, с `/translated` на конце) должны быть расположены **до** более общих (без `/translated`).

### Файлы для проверки

- [`frontend_vue/src/services/mocks/index.ts`](../frontend_vue/src/services/mocks/index.ts) — все mock-маршруты
- [`frontend_vue/src/services/productsService.ts`](../frontend_vue/src/services/productsService.ts) — API-вызовы продуктов
- [`frontend_vue/src/services/suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts) — API-вызовы поставщиков
- [`frontend_vue/src/services/categoriesService.ts`](../frontend_vue/src/services/categoriesService.ts) — API-вызовы категорий
- [`frontend_vue/src/services/configService.ts`](../frontend_vue/src/services/configService.ts) — API-вызовы конфигов
- [`frontend_vue/src/services/bccService.ts`](../frontend_vue/src/services/bccService.ts) — API-вызовы BCC

### Ожидаемый результат

Таблица всех маршрутов с подтверждением, что порядок корректный, или список найденных проблем.

---

## Результат проверки

### GET маршруты (`getMock`)

#### Текущий порядок в коде (строки 84-200):

| № | Путь / Regex | Тип | Сервис | Функция сервиса |
|---|-------------|-----|--------|----------------|
| 1 | `/^\/api\/analytics\/(.+)$/` | Regex (общий) | analytics | — |
| 2 | `path === '/api/suppliers/export.csv'` | Явный | suppliers | `exportSuppliersCsv()` |
| 3 | `path === '/api/suppliers' \|\| path === '/api/suppliers/translated'` | Явный (список) | suppliers | `getSuppliers()`, `getSuppliersTranslated()` |
| 4 | `/^\/api\/suppliers\/([^/]+)\/translated$/` | Regex (специфичный) | suppliers | `getSupplierTranslated()` |
| 5 | `/^\/api\/suppliers\/([^/]+)$/` + `!path.includes('/status')` | Regex (карточка) | suppliers | `getSupplier()` |
| 6 | `path === '/api/bcc/categories'` | Явный | bcc | `getBccCategories()` |
| 7 | `path === '/api/bcc/categories/translated'` | Явный | bcc | `getBccCategoriesTranslated()` |
| 8 | `path === '/api/bcc/recipients'` | Явный | bcc | `getBccRecipients()` |
| 9 | `path === '/api/bcc/recipients/translated'` | Явный | bcc | `getBccRecipientsTranslated()` |
| 10 | `path === '/api/bcc/history'` | Явный | bcc | `getBccHistory()` |
| 11 | `path === '/api/bcc/history/translated'` | Явный | bcc | `getBccHistoryTranslated()` |
| 12 | `path === '/api/config/fields'` | Явный | config | `getFieldLibrary()` |
| 13 | `path === '/api/config/fields/translated'` | Явный | config | `getFieldLibraryTranslated()` |
| 14 | `path === '/api/config/sections'` | Явный | config | `getSections()` |
| 15 | `path === '/api/config/sections/translated'` | Явный | config | `getSectionsTranslated()` |
| 16 | `path === '/api/config/permissions'` | Явный | config | `getPermissions()` |
| 17 | `path === '/api/config/permissions/translated'` | Явный | config | `getPermissionsTranslated()` |
| 18 | `path === '/api/categories'` | Явный (список) | categories | `getCategories()` |
| 19 | `path === '/api/categories/translated'` | Явный (список) | categories | `getCategoriesTranslated()` |
| 20 | `/^\/api\/categories\/([^/]+)\/translated$/` | Regex (специфичный) | categories | `getCategoryTranslated()` |
| 21 | `/^\/api\/categories\/([^/]+)$/` | Regex (карточка) | categories | `getCategory()` |
| 22 | `path === '/api/products' \|\| path === '/api/products/translated'` | Явный (список) | products | `getProducts()`, `getProductsTranslated()` |
| 23 | `/^\/api\/products\/([^/]+)\/translated$/` | Regex (специфичный) | products | `getProductTranslated()` |
| 24 | `/^\/api\/products\/([^/]+)$/` | Regex (карточка) | products | `getProduct()` |

#### ✅ ВЕРДИКТ GET: **Корректно**

Порядок соблюдает все правила:
- **Список до карточки**: для suppliers (3→5), categories (18→21), products (22→24)
- **Явный путь до regex**: `/api/suppliers/export.csv` (2) до regex карточки (5); `/api/suppliers/translated` (3) до regex (4→5); `/api/categories/translated` (19) до regex (20→21); `/api/products/translated` (22) до regex (23→24)
- **Специфичный regex до общего**: `/translated$` (4, 20, 23) до общего (5, 21, 24)
- **BCC и Config** не имеют regex-маршрутов, только явные проверки — проблем нет

---

### POST маршруты (`postMock`)

#### Текущий порядок в коде (строки 203-260):

| № | Путь / Regex | Тип | Сервис | Функция сервиса |
|---|-------------|-----|--------|----------------|
| 1 | `path === '/api/bcc/send'` | Явный | bcc | `sendBccRequest()` |
| 2 | `path === '/api/bcc/log'` | Явный | bcc | `logBccRequest()` |
| 3 | `/^\/api\/bcc\/events\/([^/]+)\/response$/` | Regex | bcc | `acceptBccResponse()` |
| 4 | `/^\/api\/bcc\/events\/([^/]+)\/no-response$/` | Regex | bcc | `markBccNoResponse()` |
| 5 | `path === '/api/suppliers'` | Явный | suppliers | `createSupplier()` |
| 6 | `path === '/api/config/fields'` | Явный | config | `createField()` |
| 7 | `path === '/api/config/sections'` | Явный | config | `createSection()` |
| 8 | `path === '/api/categories'` | Явный | categories | `createCategory()` |
| 9 | `path === '/api/categories/translated'` | Явный | categories | `createCategoryTranslated()` |
| 10 | `path === '/api/products'` | Явный | products | `createProduct()` |

#### ⚠️ ПОТЕНЦИАЛЬНАЯ ПРОБЛЕМА POST: **Нет маршрута для `/api/suppliers/translated`**

В сервисе [`suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts:69) есть функция `createSupplierTranslated()`, которая вызывает `apiPost('/api/suppliers/translated', payload)`, но в `postMock()` нет обработчика для этого пути. При использовании моков этот вызов упадёт с `[mock] POST /api/suppliers/translated not found`.

**Статус**: Это не бага порядка маршрутов, а **отсутствующий маршрут**. Нужно добавить обработку `path === '/api/suppliers/translated'` в `postMock()`.

#### ✅ ВЕРДИКТ POST (порядок): **Корректно**

- Нет regex, который мог бы перехватить явные пути
- BCC regex-ы (`/events/([^/]+)/response` и `/no-response`) не конфликтуют с другими путями
- Явные пути расположены до любых потенциальных regex

---

### PUT маршруты (`putMock`)

#### Текущий порядок в коде (строки 263-287):

| № | Путь / Regex | Тип | Сервис | Функция сервиса |
|---|-------------|-----|--------|----------------|
| 1 | `path === '/api/config/sections'` | Явный | config | `saveSections()` |
| 2 | `path === '/api/config/fields'` | Явный | config | `saveFieldLibrary()` |
| 3 | `path === '/api/config/permissions'` | Явный | config | `savePermissions()` |
| 4 | `/^\/api\/categories\/([^/]+)\/fields$/` | Regex | categories | `putCategoryFields()` |

#### ✅ ВЕРДИКТ PUT: **Корректно**

- Явные пути до regex
- Regex `/categories/([^/]+)/fields` не конфликтует с явными путями (у всех явных путь начинается с `/api/config/`)
- Нет риска перехвата ключевых слов

---

### PATCH маршруты (`patchMock`)

#### Текущий порядок в коде (строки 290-342):

| № | Путь / Regex | Тип | Сервис | Функция сервиса |
|---|-------------|-----|--------|----------------|
| 1 | `/^\/api\/suppliers\/([^/]+)\/status$/` | Regex (специфичный) | suppliers | `patchSupplierStatus()` |
| 2 | `/^\/api\/suppliers\/([^/]+)$/` | Regex (карточка) | suppliers | `patchSupplier()` |
| 3 | `/^\/api\/categories\/([^/]+)$/` | Regex (карточка) | categories | `patchCategory()` |
| 4 | `/^\/api\/products\/([^/]+)$/` | Regex (карточка) | products | `patchProduct()` |
| 5 | `/^\/api\/config\/sections\/([^/]+)$/` | Regex (карточка) | config | `patchSection()` |
| 6 | `/^\/api\/config\/fields\/([^/]+)$/` | Regex (карточка) | config | `patchField()` |

#### ✅ ВЕРДИКТ PATCH: **Корректно**

- Специфичный regex `/suppliers/([^/]+)/status` (1) расположен **до** общего `/suppliers/([^/]+)` (2) — это правильно, иначе `status` был бы перехвачен как ID
- Нет явных путей с `/translated` в PATCH — сервисы не используют PATCH для translated-вариантов
- Все regex для разных ресурсов не пересекаются (suppliers, categories, products, config — разные префиксы)

---

### DELETE маршруты (`deleteMock`)

#### Текущий порядок в коде (строки 345-379):

| № | Путь / Regex | Тип | Сервис | Функция сервиса |
|---|-------------|-----|--------|----------------|
| 1 | `/^\/api\/suppliers\/([^/]+)\/audit\/(\d+)$/` | Regex (специфичный) | suppliers | `deleteAuditEntry()` |
| 2 | `/^\/api\/config\/fields\/([^/]+)$/` | Regex (карточка) | config | `deleteField()` |
| 3 | `/^\/api\/config\/sections\/([^/]+)$/` | Regex (карточка) | config | `deleteSection()` |
| 4 | `/^\/api\/categories\/([^/]+)$/` | Regex (карточка) | categories | `deleteCategory()` |
| 5 | `/^\/api\/products\/([^/]+)$/` | Regex (карточка) | products | `deleteProduct()` |

#### ✅ ВЕРДИКТ DELETE: **Корректно**

- Специфичный regex `/audit/(\d+)` (1) расположен **до** общих regex — правильно
- Нет явных путей с ключевыми словами в DELETE
- Все regex для разных ресурсов не пересекаются

---

## Итоговая таблица всех API-путей

### GET

| Путь | Сервисная функция | Статус в моке |
|------|------------------|---------------|
| `/api/analytics/:page` | — | ✅ Regex (1) |
| `/api/suppliers/export.csv` | `exportSuppliersCsv()` | ✅ Явный (2) |
| `/api/suppliers` | `getSuppliers()` | ✅ Явный (3) |
| `/api/suppliers/translated` | `getSuppliersTranslated()` | ✅ Явный (3) |
| `/api/suppliers/:id/translated` | `getSupplierTranslated()` | ✅ Regex (4) |
| `/api/suppliers/:id` | `getSupplier()` | ✅ Regex (5) |
| `/api/bcc/categories` | `getBccCategories()` | ✅ Явный (6) |
| `/api/bcc/categories/translated` | `getBccCategoriesTranslated()` | ✅ Явный (7) |
| `/api/bcc/recipients` | `getBccRecipients()` | ✅ Явный (8) |
| `/api/bcc/recipients/translated` | `getBccRecipientsTranslated()` | ✅ Явный (9) |
| `/api/bcc/history` | `getBccHistory()` | ✅ Явный (10) |
| `/api/bcc/history/translated` | `getBccHistoryTranslated()` | ✅ Явный (11) |
| `/api/config/fields` | `getFieldLibrary()` | ✅ Явный (12) |
| `/api/config/fields/translated` | `getFieldLibraryTranslated()` | ✅ Явный (13) |
| `/api/config/sections` | `getSections()` | ✅ Явный (14) |
| `/api/config/sections/translated` | `getSectionsTranslated()` | ✅ Явный (15) |
| `/api/config/permissions` | `getPermissions()` | ✅ Явный (16) |
| `/api/config/permissions/translated` | `getPermissionsTranslated()` | ✅ Явный (17) |
| `/api/categories` | `getCategories()` | ✅ Явный (18) |
| `/api/categories/translated` | `getCategoriesTranslated()` | ✅ Явный (19) |
| `/api/categories/:id/translated` | `getCategoryTranslated()` | ✅ Regex (20) |
| `/api/categories/:id` | `getCategory()` | ✅ Regex (21) |
| `/api/products` | `getProducts()` | ✅ Явный (22) |
| `/api/products/translated` | `getProductsTranslated()` | ✅ Явный (22) |
| `/api/products/:id/translated` | `getProductTranslated()` | ✅ Regex (23) |
| `/api/products/:id` | `getProduct()` | ✅ Regex (24) |

### POST

| Путь | Сервисная функция | Статус в моке |
|------|------------------|---------------|
| `/api/bcc/send` | `sendBccRequest()` | ✅ Явный (1) |
| `/api/bcc/log` | `logBccRequest()` | ✅ Явный (2) |
| `/api/bcc/events/:id/response` | `acceptBccResponse()` | ✅ Regex (3) |
| `/api/bcc/events/:id/no-response` | `markBccNoResponse()` | ✅ Regex (4) |
| `/api/suppliers` | `createSupplier()` | ✅ Явный (5) |
| **`/api/suppliers/translated`** | **`createSupplierTranslated()`** | **❌ ОТСУТСТВУЕТ** |
| `/api/config/fields` | `createField()` | ✅ Явный (6) |
| `/api/config/sections` | `createSection()` | ✅ Явный (7) |
| `/api/categories` | `createCategory()` | ✅ Явный (8) |
| `/api/categories/translated` | `createCategoryTranslated()` | ✅ Явный (9) |
| `/api/products` | `createProduct()` | ✅ Явный (10) |

### PUT

| Путь | Сервисная функция | Статус в моке |
|------|------------------|---------------|
| `/api/config/sections` | `saveSections()` | ✅ Явный (1) |
| `/api/config/fields` | `saveFieldLibrary()` | ✅ Явный (2) |
| `/api/config/permissions` | `savePermissions()` | ✅ Явный (3) |
| `/api/categories/:id/fields` | `putCategoryFields()` | ✅ Regex (4) |

### PATCH

| Путь | Сервисная функция | Статус в моке |
|------|------------------|---------------|
| `/api/suppliers/:id/status` | `patchSupplierStatus()` | ✅ Regex (1) |
| `/api/suppliers/:id` | `patchSupplier()` | ✅ Regex (2) |
| `/api/categories/:id` | `patchCategory()` | ✅ Regex (3) |
| `/api/products/:id` | `patchProduct()` | ✅ Regex (4) |
| `/api/config/sections/:id` | `patchSection()` | ✅ Regex (5) |
| `/api/config/fields/:id` | `patchField()` | ✅ Regex (6) |

### DELETE

| Путь | Сервисная функция | Статус в моке |
|------|------------------|---------------|
| `/api/suppliers/:id/audit/:index` | `deleteAuditEntry()` | ✅ Regex (1) |
| `/api/config/fields/:id` | `deleteField()` | ✅ Regex (2) |
| `/api/config/sections/:id` | `deleteSection()` | ✅ Regex (3) |
| `/api/categories/:id` | `deleteCategory()` | ✅ Regex (4) |
| `/api/products/:id` | `deleteProduct()` | ✅ Regex (5) |

---

## Найденные проблемы

### 1. ❌ Отсутствует POST-маршрут для `/api/suppliers/translated`

**Файл**: [`frontend_vue/src/services/mocks/index.ts`](../frontend_vue/src/services/mocks/index.ts) — `postMock()`

**Сервис**: [`suppliersService.ts:69`](../frontend_vue/src/services/suppliersService.ts:69) — `createSupplierTranslated()`

**Проблема**: Функция `createSupplierTranslated()` делает `apiPost('/api/suppliers/translated', payload)`, но в `postMock()` нет соответствующего обработчика. При использовании моков вызов упадёт с ошибкой `[mock] POST /api/suppliers/translated not found`.

**Решение**: Добавить в `postMock()` после строки 239 (после `path === '/api/suppliers'`):
```typescript
if (path === '/api/suppliers/translated') {
  return delay(mockCreateSupplier(body as Parameters<typeof mockCreateSupplier>[0]) as T)
}
```

### 2. ✅ Все остальные маршруты — корректный порядок

После исправлений (products и suppliers в getMock) порядок маршрутов во всех HTTP-методах соблюдает правила:
- Список до карточки
- Явный путь до regex
- Специфичный regex до общего regex

### 3. ✅ Нет других баг с перехватом ключевых слов regex-ами

Проверены все regex на всех HTTP-методах:
- **GET**: suppliers (status — защищён `!path.includes('/status')`), translated (явные проверки до regex), export.csv (явная проверка до regex)
- **POST**: BCC events regex не конфликтуют с другими путями
- **PATCH**: `/suppliers/:id/status` расположен до `/suppliers/:id` — корректно
- **PUT**: `/categories/:id/fields` не конфликтует с другими путями
- **DELETE**: `/suppliers/:id/audit/:index` расположен до общих regex — корректно
