# Инвентаризация планов — часть 027

Пачка: `roo_code/plans/products` — три плана (fix-products-null-items-bug, products-api-contract-analysis, product-uom-restructure-plan).
Соседи в каталоге, прочитанные для контекста: `01-products-plan.md`, `uom-restructure-completion-plan.md` (второй прямо продолжает третий план пачки).
Чекбоксов ни в одном из трёх планов нет: `grep -c "^[[:space:]]*- \[ \]"` → 0, 0, 0.

---

## 1. roo_code/plans/products/fix-products-null-items-bug.md — СДЕЛАНО

Что план требует: (1) `getProductsTranslated()`/`getProductTranslated()` перевести с `/api/products/translated`
на `/api/products`; (2) добавить null-guard в `tf()`; (3) закрыть `tf(item.name)` в шаблоне списка товаров.

Доказательство:

```
$ grep -rn "getProductsTranslated\|getProductTranslated\|useProductsTranslated\|products/translated" src/
(пусто)

$ grep -rn "/translated" src/
src/services/mocks/index.ts:470:  if (path === '/api/clients' || path === '/api/clients/translated') {
src/services/mocks/index.ts:534:  if (path === '/api/orders' || path === '/api/orders/translated') {
```

Ни функций, ни эндпоинта `/api/products/translated` больше нет: сервис (`src/services/productsService.ts`)
ходит в `apiGet('/api/products', params)` и `apiGet(`/api/products/${id}`)` — единственные вызовы.
То есть требование выполнено сильнее плана: «переводные» функции не перенаправлены, а удалены вовсе.

`tf()` — guard на месте (`src/composables/useTranslatedData.ts`):

```
function tf(field: TranslatedString | null | undefined): string {
  if (!field) return ''
  const currentLocale = locale.value as keyof TranslatedString
  if (field[currentLocale]) return field[currentLocale]
  return field.ru || field.en || field.lt || ''
}
```

Шаблон списка (`src/views/admin/products/ProductsPage.vue:385-397`):

```
<router-link v-if="item.name" ...>{{ tf(item.name) }}</router-link>
<span v-else>—</span>
<td>{{ item.categoryName ? tf(item.categoryName) : '—' }}</td>
```

Проверка на null сделана через `v-if`/`v-else` вместо тернарника из плана — поведение то же («—» при пустом имени).

Осталось: ничего.

---

## 2. roo_code/plans/products/products-api-contract-analysis.md — ЧАСТИЧНО

План требует трёх правок (тип/моки + контракт) и описывает требования к бэкенду по пяти эндпоинтам
products (GET список, POST, GET :id, PATCH :id, DELETE :id) с `TranslatedString` на проводе.

Сделано — фронтенд и контракт:

```
$ grep -o "priceUnit: '[^']*'" src/services/mocks/products.ts | sort | uniq -c
     16 priceUnit: 'EUR/kg'
     19 priceUnit: 'EUR/m'
    100 priceUnit: 'EUR/vnt'
```
`'EUR/баллон'` в моках товаров нет (в `src/mocks/warehouse-movements.ts` слово «баллон» встречается только
в текстах примечаний). `src/types/product.ts:5-6`: `export type PriceUnit = string` — хардкод-юнион убран целиком.

```
$ grep -n "categoryIds\|sortBy\|sortDir" roo_code/roo-context/03-api-contract.md | head
1003:    categoryIds?: string  // ID категорий через запятую, отсутствует = все категории
1006:    sortBy?: string       // "name" | "category" | "price" (default: "name")
1007:    sortDir?: string      // "asc" | "desc" (default: "asc")
```
И клиент их отправляет (`src/services/productsService.ts`):
```
if (filters.categoryIds.length > 0) params.categoryIds = filters.categoryIds.join(',')
if (filters.sortBy) { params.sortBy = filters.sortBy; params.sortDir = filters.sortDir }
```

Не сделано — бэкенд:

```
$ find backend/app/modules/products -type f | grep features
backend/app/modules/products/features/create_product/{action,domain,repository,schemas}.py
backend/app/modules/products/features/get_product_detail/{action,domain,repository,schemas}.py

$ grep -rn "products" backend/app/main.py
11: from app.modules.products.features.get_product_detail.action import ...
14: from app.modules.products.features.create_product.action import ...
66: app.include_router(products_get_detail_router)
67: app.include_router(products_create_router)
```

Существуют только POST /api/products и GET /api/products/{id}. Нет GET-списка (а значит ни `search`,
ни `categoryIds`, ни `sortBy/sortDir`, ни `PaginatedResponse`), нет PATCH, нет DELETE (и кода `409 PRODUCT_IN_USE`).
Кроме того, wire format не соответствует разделу «Non-Issues»: `name`/`description` — `str`
(`create_product/schemas.py:11`, `get_product_detail/schemas.py:28-30`), не `TranslatedString`;
в ответе detail нет `linked_suppliers` и `category_name`, ключи snake_case, а фронтенд ждёт camelCase.

Осталось: пять эндпоинтов списка/PATCH/DELETE + перевод name/description/categoryName/fieldName в `TranslatedString`,
`linkedSuppliers` в ответе, camelCase-обёртка. Контрактная часть плана закрыта.

---

## 3. roo_code/plans/products/product-uom-restructure-plan.md — ЧАСТИЧНО

Шапка плана сама помечает валютный курс отменённым (2026-08-09), остальное в силе.
Ниже — по десяти шагам раздела «Implementation Order».

Шаг 1 (модель Product + миграция) — СДЕЛАНО. `backend/app/modules/products/shared/models.py:125-177` содержит
`currency_id`, `price_quantity`, `purchase_uom_id`, `warehouse_uom_id`, `sale_uom_id` и четыре поля конвертации;
`uom_id` и `price_unit` в модели отсутствуют. Миграция есть:
`backend/alembic/versions/a1b2c3d4e5f6_phase_15_product_uom_restructure.py:98-99` — `op.drop_column("products", "price_unit")`.

Шаг 2 (аудит закупки на партии) — СДЕЛАНО. `backend/app/modules/warehouse/shared/models.py:63-86`:
`received_quantity`, `received_uom_id`, `received_unit_price`, `received_currency_id`,
`purchase_to_warehouse_rate`, `exchange_rate`; та же миграция phase_15 строки 107-137 их добавляет.

Шаг 3 (домен create_product) — ЧАСТИЧНО. `_resolve_price_unit` не существует (grep по backend даёт только
`_reconstruct_price_unit` в get_product_detail), валюта падает на дефолт тенанта, каскад
`purchase ← warehouse ← sale` есть (`create_product/domain.py:33-41`). Но требования плана
«если `sale_uom_id` не передан → первая единица категории `quantity`» в коде нет: `sale_uom_id` остаётся `None`,
и тогда все три UoM тоже `None`.

Шаг 4 (домен create_batch: конвертация в складскую единицу + запись аудита на бэкенде) — НЕ НАЧАТО.
`find backend/app/modules/warehouse -type f` даёт только `models.py`, `dependencies.py`, `internal_api/interface.py` —
у модуля warehouse нет ни одного вертикального слайса, эндпоинта создания партии не существует.

Шаг 5 (типы фронтенда) — СДЕЛАНО. `src/types/product.ts:46-72` — `priceQuantity`, `currencyId`,
три `*UomId`, четыре поля конвертации; `src/types/warehouse.ts:52` — `export type StockUnit = string`;
`src/types/warehouse.ts:126-136` — `receivedQuantity`, `receivedUnitId`, `receivedUnitPrice`,
`receivedCurrencyId`, `purchaseToWarehouseRate`. `exchangeRate` в тип партии не добавлен — это ровно то,
что шапка плана отменила.

Шаг 6 (карточка товара) — СДЕЛАНО. `ProductCardPage.vue`: три селектора из `settings.uoms` (строки 135-165, 435-451),
`form.priceQuantity` (368), `form.currencyId` (391), условные блоки конвертации по неравенству единиц (109-119, 471-498).

Шаг 7 (создание партии) — СДЕЛАНО на фронтенде. Модального `CreateBatchModal.vue` в проекте нет
(`ls src/views/admin/warehouse | grep -i batch` → `WarehouseBatchCard.vue`, `WarehouseBatchCreatePage.vue`);
логика живёт в `src/composables/useWarehouseBatchCreate.ts`: динамический `UNIT_OPTIONS` из `settings.uoms` (191-198),
предзаполнение фактора из товара (203-206), `conversionPreview` (233-256), отправка аудита (376-380).

Шаг 8 (фильтры склада) — СДЕЛАНО. `WarehousePage.vue:415-434`: один `allUnitOptions` из `settings.uoms`,
из него все пять наборов (UNIT/BATCH/OFFCUT/MOVEMENT/DEFICIT). Хардкода `['kg','m','pcs','m2']` нет.

Шаг 9 (заказы) — СДЕЛАНО. `grep -rn "mapPriceUnitToStockUnit" src/` пусто; `AddOrderItemsModal.vue:104-151`
считает через `saleUomId`/`warehouseUomId`/`warehouseToSaleFactor`.

Шаг 10 (чистка) — ЧАСТИЧНО. Хардкод-юнионы убраны, моки перестроены
(`grep -c "saleUomId" src/services/mocks/products.ts` → 119, `priceQuantity` → 118, `purchaseUomId` → 118),
но `priceUnit` жив сознательно как legacy: `src/types/product.ts:21,34,59` и 135 значений в моках,
на бэкенде `get_product_detail/domain.py:26` `_reconstruct_price_unit` собирает его из FK.
Хардкод-единицы остались вне склада: `src/views/admin/suppliers/BccRequestPage.vue:328`
`const UNIT_OPTIONS = ['kg','m','piece','ton']`.

Осталось: бэкенд создания партии с конвертацией и записью аудита (шаг 4), дефолт `sale_uom_id`
по категории единиц (шаг 3), решение по legacy `priceUnit` и по хардкоду единиц в BccRequestPage (шаг 10).
