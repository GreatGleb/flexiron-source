# Single-Locale Save Refactoring Plan

## Проблема

Сейчас при сохранении данных (POST/PATCH) клиент отправляет все три языка одинаковым значением:
```ts
{ ru: "Ботинок Алюминиевый", en: "Ботинок Алюминиевый", lt: "Ботинок Алюминиевый" }
```

Это приводит к:
1. **Нет поддержки мультиязычности** — нельзя сохранить запись на русском, а потом добавить перевод на английский
2. **Утроенный payload** — отправляем дублирующиеся данные
3. **`tf()` падает только на `ru`** — если русский пустой, а английский заполнен, пользователь увидит пустоту

## Цель

**При создании:** отправлять только язык пользователя → `{ ru: "Ботинок Алюминиевый" }`
**При редактировании:** отправлять только изменённый язык → `{ en: "Aluminum Boot" }` (не затираем ru)
**При чтении:** `tf()` показывает язык пользователя, если он есть; если нет — любой непустой

## Логика работы

```mermaid
flowchart TD
    User[Пользователь вводит значение на языке L] --> Form[Vue Form]
    Form --> Composable[use* composable]
    Composable --> Service[Сервисная функция]
    Service --> toTS[toTranslatedStringvalue, L]
    toTS --> Payload[{ L: value, ru: '', en: '', lt: '' }]
    Payload --> API[POST/PATCH /api/...]
    API --> Server[Сервер сохраняет TranslatedString]
    
    Server --> Read[GET /api/.../translated]
    Read --> tf[tf field]
    tf --> Check{field[locale] существует?}
    Check -->|Да| ShowLocale[Показать field[locale]]
    Check -->|Нет| Fallback[Показать первый непустой: ru или en или lt]
    Fallback --> ShowFallback[Показать fallback значение]
    ShowLocale --> Display[Отобразить пользователю]
    ShowFallback --> Display
```

## Пример сценария

1. **Создание:** пользователь (locale=ru) создаёт категорию "Листы"
   - Отправляем: `POST /api/categories` → `{ name: { ru: "Листы" } }`
   - Сервер хранит: `{ ru: "Листы", en: "", lt: "" }`
   - Русский пользователь видит: "Листы"
   - Английский пользователь видит: "Листы" (en пустой, fallback на ru)

2. **Редактирование:** пользователь (locale=en) меняет название на "Sheets"
   - Отправляем: `PATCH /api/categories/:id` → `{ name: { en: "Sheets" } }`
   - Сервер хранит: `{ ru: "Листы", en: "Sheets", lt: "" }`
   - Русский пользователь видит: "Листы"
   - Английский пользователь видит: "Sheets"
   - Литовский пользователь видит: "Sheets" (lt пустой, fallback на en)

3. **Редактирование:** пользователь (locale=lt) добавляет "Lakštai"
   - Отправляем: `PATCH /api/categories/:id` → `{ name: { lt: "Lakštai" } }`
   - Сервер хранит: `{ ru: "Листы", en: "Sheets", lt: "Lakštai" }`
   - Все видят свои языки

## Ключевой момент: merge при PATCH

При PATCH мы **не заменяем** весь `TranslatedString`, а **мержим** с существующим. То есть:
- Было: `{ ru: "Листы", en: "", lt: "" }`
- Пришло: `{ en: "Sheets" }`
- Стало: `{ ru: "Листы", en: "Sheets", lt: "" }` (ru не затерт!)

Это должно работать и на сервере (в моках), и на клиенте (при optimistic update).

## План реализации

### Фаза 0: Анализ и подготовка (текущая)
- [x] Проанализировать текущую архитектуру
- [x] Создать план

### Фаза 1: Инфраструктура (базовые изменения)

#### 1.1 Обновить `tf()` в [`useTranslatedData.ts`](../frontend_vue/src/composables/useTranslatedData.ts)

**Было:**
```ts
function tf(field: TranslatedString | null | undefined): string {
  if (!field) return ''
  return field[locale.value as keyof TranslatedString] ?? field.ru
}
```

**Стало:**
```ts
function tf(field: TranslatedString | null | undefined): string {
  if (!field) return ''
  const currentLocale = locale.value as keyof TranslatedString
  if (field[currentLocale]) return field[currentLocale]
  // Fallback на любой непустой язык
  return field.ru || field.en || field.lt || ''
}
```

#### 1.2 Создать утилиту `toTranslatedString()` в [`src/types/i18n.ts`](../frontend_vue/src/types/i18n.ts)

Чистая функция, не зависит от Vue/composables:
```ts
export function toTranslatedString(value: string, locale: string): TranslatedString {
  const result: TranslatedString = { ru: '', en: '', lt: '' }
  if (locale in result) {
    result[locale as keyof TranslatedString] = value
  }
  return result
}
```

#### 1.3 Создать утилиту `mergeTranslatedString()` для PATCH merge

```ts
export function mergeTranslatedString(
  existing: TranslatedString | null | undefined,
  incoming: Partial<TranslatedString>
): TranslatedString {
  return {
    ru: existing?.ru || incoming.ru || '',
    en: existing?.en || incoming.en || '',
    lt: existing?.lt || incoming.lt || '',
    ...Object.fromEntries(
      Object.entries(incoming).filter(([, v]) => v !== undefined && v !== null)
    ),
  }
}
```

### Фаза 2: Рефакторинг по доменам

Каждый домен рефакторится независимо. Внутри каждого домена порядок:
1. Сервис (service) — обновить функции сохранения
2. Мок (mock) — обновить обработчики create/patch
3. Композабл (composable) — убрать `translated` опцию, добавить locale в save
4. Вьюха (view) — убрать `translated: true`

---

#### Домен 1: Categories

**Файлы:**
- [`categoriesService.ts`](../frontend_vue/src/services/categoriesService.ts)
- [`mocks/categories.ts`](../frontend_vue/src/services/mocks/categories.ts)
- [`useCategories.ts`](../frontend_vue/src/composables/useCategories.ts)
- [`useCategoryCard.ts`](../frontend_vue/src/composables/useCategoryCard.ts)
- [`CategoriesPage.vue`](../frontend_vue/src/views/admin/products/CategoriesPage.vue)
- [`CategoryCardPage.vue`](../frontend_vue/src/views/admin/products/CategoryCardPage.vue)

**Подзадачи:**
1.1. Categories: обновить `createCategory` — использовать `toTranslatedString()` для name
1.2. Categories: обновить `patchCategory` — использовать `toTranslatedString()` для name в dirty fields
1.3. Categories: обновить `putCategoryFields` — использовать `toTranslatedString()` для fieldName и options
1.4. Categories: обновить мок `mockCreateCategory` — сохранять как есть (с пустыми другими языками)
1.5. Categories: обновить мок `mockPatchCategory` — мержить TranslatedString поля
1.6. Categories: обновить мок `mockPutCategoryFields` — мержить TranslatedString поля
1.7. Categories: обновить `useCategories` — убрать `translated` опцию, передавать locale в save
1.8. Categories: обновить `useCategoryCard` — убрать `translated` опцию, передавать locale в save
1.9. Categories: обновить `CategoriesPage.vue` — убрать `translated: true`
1.10. Categories: обновить `CategoryCardPage.vue` — убрать `translated: true`

---

#### Домен 2: Products

**Файлы:**
- [`productsService.ts`](../frontend_vue/src/services/productsService.ts)
- [`mocks/products.ts`](../frontend_vue/src/services/mocks/products.ts)
- [`useProducts.ts`](../frontend_vue/src/composables/useProducts.ts)
- [`useProductCard.ts`](../frontend_vue/src/composables/useProductCard.ts)
- [`ProductsPage.vue`](../frontend_vue/src/views/admin/products/ProductsPage.vue)
- [`ProductCardPage.vue`](../frontend_vue/src/views/admin/products/ProductCardPage.vue)

**Подзадачи:**
2.1. Products: обновить `createProduct` — использовать `toTranslatedString()` для name, description
2.2. Products: обновить `patchProduct` — использовать `toTranslatedString()` для TranslatedString полей в dirty fields
2.3. Products: обновить мок `mockCreateProduct` — сохранять как есть
2.4. Products: обновить мок `mockPatchProduct` — мержить TranslatedString поля
2.5. Products: обновить `useProducts` — убрать `translated` опцию, передавать locale в save
2.6. Products: обновить `useProductCard` — убрать `translated` опцию, передавать locale в save
2.7. Products: обновить `ProductsPage.vue` — убрать `translated: true`
2.8. Products: обновить `ProductCardPage.vue` — убрать `translated: true`

**Важно:** У Products есть `fieldValues[].fieldName`, `fieldValues[].options[]`, `linkedSuppliers[].name` — все `TranslatedString`. Нужно убедиться, что при сохранении они тоже оборачиваются через `toTranslatedString()`.

---

#### Домен 3: Suppliers

**Файлы:**
- [`suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts)
- [`mocks/suppliers.ts`](../frontend_vue/src/services/mocks/suppliers.ts)
- [`useSuppliers.ts`](../frontend_vue/src/composables/useSuppliers.ts)
- [`useSupplierCard.ts`](../frontend_vue/src/composables/useSupplierCard.ts)
- [`useSupplierCreate.ts`](../frontend_vue/src/composables/useSupplierCreate.ts)
- [`SuppliersListPage.vue`](../frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue)
- [`SupplierCardPage.vue`](../frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue)
- [`SupplierCreatePage.vue`](../frontend_vue/src/views/admin/suppliers/SupplierCreatePage.vue)

**Подзадачи:**
3.1. Suppliers: обновить `createSupplier` — использовать `toTranslatedString()` для всех TranslatedString полей
3.2. Suppliers: обновить `patchSupplier` — использовать `toTranslatedString()` для TranslatedString полей в dirty fields
3.3. Suppliers: обновить мок `mockCreateSupplier` — сохранять как есть
3.4. Suppliers: обновить мок `mockPatchSupplier` — мержить TranslatedString поля
3.5. Suppliers: обновить `useSuppliers` — убрать `translated` опцию, передавать locale в save
3.6. Suppliers: обновить `useSupplierCard` — убрать `translated` опцию, передавать locale в save
3.7. Suppliers: обновить `useSupplierCreate` — убрать `translated` опцию, передавать locale в save
3.8. Suppliers: обновить `SuppliersListPage.vue` — убрать `translated: true`
3.9. Suppliers: обновить `SupplierCardPage.vue` — убрать `translated: true`
3.10. Suppliers: обновить `SupplierCreatePage.vue` — убрать `translated: true`

**Важно:** У Suppliers много вложенных `TranslatedString` полей: `company`, `contactPerson`, `statusReason`, `addresses[].value`, `contacts[].value`, `files[].name`, `auditLog[].action`, `priceHistory[].priceNote`. Нужно рекурсивно обработать все.

---

#### Домен 4: BCC

**Файлы:**
- [`bccService.ts`](../frontend_vue/src/services/bccService.ts)
- [`mocks/bcc.ts`](../frontend_vue/src/services/mocks/bcc.ts)
- [`useBccRequest.ts`](../frontend_vue/src/composables/useBccRequest.ts)
- [`BccRequestPage.vue`](../frontend_vue/src/views/admin/suppliers/BccRequestPage.vue)

**Подзадачи:**
4.1. BCC: обновить `sendBccRequest` — использовать `toTranslatedString()` для template subject/body
4.2. BCC: обновить `logBccRequest` — использовать `toTranslatedString()` для source field
4.3. BCC: обновить мок `mockSendBccRequest` / `mockLogBccRequest` — сохранять как есть
4.4. BCC: обновить `useBccRequest` — убрать `translated` опцию, передавать locale в save
4.5. BCC: обновить `BccRequestPage.vue` — убрать `translated: true`

---

#### Домен 5: Config

**Файлы:**
- [`configService.ts`](../frontend_vue/src/services/configService.ts)
- [`mocks/config.ts`](../frontend_vue/src/services/mocks/config.ts)
- [`useCardConfig.ts`](../frontend_vue/src/composables/useCardConfig.ts)
- [`SupplierCardConfigPage.vue`](../frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue)

**Подзадачи:**
5.1. Config: обновить `createField` / `patchField` — использовать `toTranslatedString()` для field name
5.2. Config: обновить `createSection` / `patchSection` — использовать `toTranslatedString()` для section name
5.3. Config: обновить мок `mockCreateField` / `mockPatchField` — сохранять/мержить как есть
5.4. Config: обновить мок `mockCreateSection` / `mockPatchSection` — сохранять/мержить как есть
5.5. Config: обновить `useCardConfig` — убрать `translated` опцию, передавать locale в save
5.6. Config: обновить `SupplierCardConfigPage.vue` — убрать `translated: true`

---

#### Домен 6: Analytics

**Файлы:**
- [`analyticsService.ts`](../frontend_vue/src/services/analyticsService.ts)
- [`useAnalytics.ts`](../frontend_vue/src/composables/useAnalytics.ts)

**Подзадачи:**
6.1. Analytics: проверить, что `getAnalyticsPage` уже использует translated endpoint
6.2. Analytics: проверить `useAnalytics` — нет ли `translated` опции

---

### Фаза 3: Глобальная чистка

#### 3.1 Удалить не-translated функции из сервисов

После того как все домены переведены на translated:
- Удалить `getCategories`, `getCategory`, `createCategory` (старые) из [`categoriesService.ts`](../frontend_vue/src/services/categoriesService.ts)
- Удалить `getProducts`, `getProduct`, `createProduct` (старые) из [`productsService.ts`](../frontend_vue/src/services/productsService.ts)
- Удалить `getSuppliers`, `getSupplier`, `createSupplier` (старые) из [`suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts)
- Удалить `getBccCategories`, `getBccRecipients`, `getBccHistory` (старые) из [`bccService.ts`](../frontend_vue/src/services/bccService.ts)
- Удалить `getFieldLibrary`, `getSections`, `getPermissions` (старые) из [`configService.ts`](../frontend_vue/src/services/configService.ts)
- Удалить `getAnalyticsPage` (старый) из [`analyticsService.ts`](../frontend_vue/src/services/analyticsService.ts)

Переименовать `*Translated` → оригинальное имя (например, `getCategoriesTranslated` → `getCategories`).

#### 3.2 Удалить не-translated маршруты из моков

В [`mocks/index.ts`](../frontend_vue/src/services/mocks/index.ts) удалить все не-`/translated` GET маршруты.

#### 3.3 Удалить `translated` опцию из композаблов

После того как все вьюхи обновлены, удалить `translated` параметр из интерфейсов композаблов.

#### 3.4 Проверить `useLabelResolver`

Если после рефакторинга `useLabelResolver` не используется — удалить.

### Фаза 4: Верификация

#### 4.1 TypeScript проверка
```bash
cd frontend_vue && npx vue-tsc --noEmit
```

#### 4.2 Сборка
```bash
cd frontend_vue && npm run build
```

#### 4.3 E2E тесты
```bash
cd frontend_vue && npx playwright test
```

## Стратегия выполнения (Orchestrator)

1. **Фаза 1** (инфраструктура) — одна подзадача, выполняется первой
2. **Домены 1-6** (Фаза 2) — каждый домен отдельная подзадача, можно параллельно
3. **Фаза 3** (чистка) — после всех доменов
4. **Фаза 4** (верификация) — финальная проверка

Внутри каждого домена порядок: сервис → мок → композабл → вьюха.

## Важные моменты

1. **Сервисы — чистые функции.** Они не имеют доступа к `useI18n()`. Поэтому `locale` передаётся как параметр из композабла.
2. **`toTranslatedString()` — чистая утилита.** Не зависит от Vue. Может быть импортирована где угодно.
3. **PATCH должен мержить, а не заменять.** При отправке `{ name: { en: "Sheets" } }` поле `ru` не должно затираться. Это касается и моков.
4. **При optimistic update** в композаблах нужно тоже мержить, а не заменять `TranslatedString`.
5. **Все `TranslatedString` поля** должны быть обработаны, включая вложенные (fieldValues, addresses, contacts и т.д.).
