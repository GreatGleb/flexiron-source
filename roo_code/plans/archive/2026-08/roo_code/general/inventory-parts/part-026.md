# Инвентаризация: roo_code/plans/products/01-products-plan.md

**Вердикт: частично** (все 23 итоговых пункта поставки реализованы и переросли план;
3 из 9 пунктов чеклиста питфоллов в текущем коде НЕ выполняются)

Незакрытых чекбоксов в плане: 32 (`grep -c "^[[:space:]]*- \[ \]"` → 32; закрытых `- [x]` — 0,
то есть чекбоксы в плане никогда не отмечались, хотя работа сделана).

## Доказательство

### Файлы поставки — все на месте
```
$ ls src/types/product.ts src/services/mocks/products.ts src/services/productsService.ts \
     src/composables/useProducts.ts src/composables/useProductCard.ts \
     src/styles/admin/products_list.css src/styles/admin/products_card.css
src/composables/useProductCard.ts
src/composables/useProducts.ts
src/services/mocks/products.ts
src/services/productsService.ts
src/styles/admin/products_card.css
src/styles/admin/products_list.css
src/types/product.ts

src/views/admin/products/: CategoriesPage.vue CategoryCardPage.vue ProductCardPage.vue
                           ProductsPage.vue ServiceCardPage.vue ServicesPage.vue
tests/e2e/admin/products/: categories.spec.ts products.spec.ts products.spec.ts-snapshots
                           service-card.spec.ts services.spec.ts
```

### Роут, флаги
```
$ grep -n "admin-product-card" src/router/index.ts
224:        name: 'admin-product-card',
$ grep -n "productSupplierLinks\|adminServices\|adminProducts" src/config/featureFlags.ts src/types/features.ts tests/e2e/helpers/flags.ts
src/types/features.ts:17:  adminProducts: boolean
src/types/features.ts:18:  adminServices: boolean
src/types/features.ts:34:  productSupplierLinks: boolean
src/config/featureFlags.ts:20:  adminProducts: true,
src/config/featureFlags.ts:21:  adminServices: true,      # план требовал false как placeholder 1.3 — страница 1.3 реализована, флаг включён осознанно
src/config/featureFlags.ts:38:  productSupplierLinks: true,
tests/e2e/helpers/flags.ts:45:  productSupplierLinks: true,
```

### Контракт
`toDo/admin-api-contract.md` (путь из плана) **не существует**:
```
$ ls ../toDo/admin-api-contract.md
ls: cannot access '../toDo/admin-api-contract.md': No such file or directory
```
Живой контракт — `roo_code/roo-context/03-api-contract.md`, секции есть:
```
992:## Список товаров (Products 1.1)
1051:## Карточка товара (Products 1.1)
1101:## Save UX — Products
1112:## Feature Flags — Products
1122-1127: → Implementation: productsService.ts, mocks/products.ts, useProducts.ts,
           useProductCard.ts, ProductsPage.vue, ProductCardPage.vue, products.spec.ts
```
То есть содержимое написано, только файл переехал (ROO.md фиксирует переезд).

### Типы (переросли план)
`src/types/product.ts` — Product, ProductListItem, ProductFieldValue, LinkedSupplier,
PriceUnit, ProductFilters присутствуют. Отличия от плана — следствие более поздних планов
(`product-uom-restructure-plan.md`, «Себестоимость партии»):
`PriceUnit` стал `string` («now dynamic from settings»), строки стали `TranslatedString`,
добавлены `currencyId`, `priceQuantity`, три UoM (`purchaseUomId`/`warehouseUomId`/`saleUomId`),
коэффициенты конверсии, `weightPerWarehouseUnitKg`, `avgCostPrice`/`avgSalePrice`, `auditLog`.
`ProductFilters` — `categoryIds: string[]` + `sortBy`/`sortDir` вместо `categoryId: string | null`.

### Мок
```
$ grep -c "id: 'prod-" src/services/mocks/products.ts
114
$ grep -o "fieldType: '[a-z]*'" src/services/mocks/products.ts | sort | uniq -c
  22 boolean   22 date   21 email   92 enum   21 file   422 number   161 text
```
114 товаров (план требовал 8–10), все семь типов полей покрыты.
Экспорты `mockGetProducts/mockGetProduct/mockCreateProduct/mockPatchProduct/mockDeleteProduct`
есть (строки 14056/14099/14105/14233/14338), маршруты зарегистрированы в `mocks/index.ts`
(GET 423, GET :id 446, POST 931, PATCH 1187, DELETE 1476).

### Сервис, композаблы
`productsService.ts`: getProducts, getProduct, createProduct, patchProduct, deleteProduct
(+ getProductList, deleteProductAuditEntry сверх плана).
`useProducts.ts`: `let initialized = false` (25), `if (!initialized) loading.value = true` (28),
`deleteProduct` (45), `watch` фильтров (63) и пагинации (73).
`useProductCard.ts`: `useDirtyCheck` (67), `fieldValues` map (90), `fieldValuesChanged` (93),
`isAnythingDirty` = dirty || fieldValuesChanged || linkedSuppliersChanged (105), save (229),
discard (266).

### i18n
`src/i18n/admin.ts` из плана больше не существует — файл разбит на `src/i18n/admin/*.ts`,
ключи товаров в `src/i18n/admin/products.ts`. Все ключи плана присутствуют по 3 раза
(RU/EN/LT), кроме четырёх: `field_price_unit`, `price_unit_vnt`, `price_unit_kg`,
`price_unit_m` — 0 вхождений. Это следствие UoM-реструктуризации
(`product-uom-restructure-plan.md:308` «Current: hardcoded priceUnitOptions with 3 values»
— заменено на единицы из настроек), а не потерянная работа.

### Страницы
`ProductsPage.vue` — 29 data-test (products-header, products-table, products-row,
products-search, products-filter-categories, modal-create-product, modal-delete-product,
products-delete-btn, Pagination, сортировка по 3 колонкам, сохранение вида).
`ProductCardPage.vue` — 40 data-test (page-product-card, product-card-info/price/uom/
fields/suppliers/audit, product-save-bar), все семь ветвей `fv.fieldType ===`
(text/number/email/date/boolean/enum/file+DropZone), секция поставщиков под
`showSupplierLinks`, переход на `admin-supplier-card`, явные импорты
`_entity-card-layout.css` и `products_card.css`.

### CSS
`products_list.css` (236 строк): `.products-filters` (21), `.products-row-actions` (85),
`.empty-state` (91), responsive-медиазапросы 992/600/400/320.
`products_card.css` — 111 строк, существует.

### Тесты
`tests/e2e/admin/products/products.spec.ts` — 57 тестов, группы structure / basic fields /
dirty check / save lifecycle / suppliers / dynamic fields / i18n / visual @1440 /
флаг adminProducts OFF → /404 / productSupplierLinks OFF. Снапшоты есть (linux+win32).
Регистрация: `smoke.spec.ts:35-36` (`/admin/products`, `/admin/products/prod-001`),
`navigation.spec.ts:38-40` (deep link to product card, ждёт `[data-test=page-product-card]`),
`feature-flags.spec.ts:21-22` (adminProducts × оба роута).

### Приёмка
```
$ npm run typecheck
> vue-tsc --noEmit
(без вывода — 0 ошибок)
$ npm run lint
> eslint src/ tests/ *.ts --max-warnings=0 --cache ...
(без вывода — 0 ошибок)
```

## Что осталось

Три проверки из чеклиста питфоллов Промпта 14 в текущем коде не выполняются:

1. **#19 фильтры внутри GlassPanel** — фильтры вынесены в отдельный блок
   `<div class="filters-bar" data-test="products-filters">` (ProductsPage.vue:250),
   GlassPanel таблицы начинается ниже, на строке 293. Проектная конвенция сменилась на
   общий `filters-bar` — но пункт плана как написан не выполнен.
2. **#13 мок возвращает structuredClone** — `grep -c "structuredClone\|JSON.parse(JSON.stringify"
   src/services/mocks/products.ts` → 0. `mockGetProduct` (14099) возвращает найденный объект
   STORE напрямую (`return found`), `delay()` в mocks/index.ts:245 тоже не клонирует.
   Карточка правит объект стора напрямую.
3. **#9 нет комментариев внутри `<template>`** — в ProductCardPage.vue 7 HTML-комментариев
   внутри template (строки 300, 426, 457, 503, 535, 614, 689; template — 238..856).
   Правило живо: vue-rules.md:162-163.

Плюс не проверяемое инструментом: «browser golden path пройден пользователем» — ручной пункт.

## Пункты (32)

| # | Пункт | Вердикт |
|---|---|---|
| 1 | #10 route name 'admin-product-card' существует | сделано |
| 2 | #17 SvgIcon имена проверены | сделано |
| 3 | #18 save bar btn_discard_changes, модалы btn_discard | сделано |
| 4 | #19 поиск + фильтр внутри GlassPanel | частично |
| 5 | #20 initialized флаг в useProducts | сделано |
| 6 | #16 явные импорты CSS в ProductCardPage | сделано |
| 7 | #9 нет комментариев внутри template | не начато |
| 8 | #13 mock возвращает structuredClone | не начато |
| 9 | BUG-03 mock покрывает все типы полей | сделано |
| 10 | контракт — секция Products | сделано (файл переехал в 03-api-contract.md) |
| 11 | src/types/product.ts | сделано |
| 12 | mocks/products.ts, 8+ товаров | сделано (114) |
| 13 | mocks/index.ts маршруты | сделано |
| 14 | productsService.ts — 5 функций | сделано |
| 15 | useProducts.ts | сделано |
| 16 | useProductCard.ts | сделано |
| 17 | i18n products ключи RU/EN/LT | частично (4 price-unit ключа сняты UoM-планом) |
| 18 | ProductsPage.vue — список с фильтрами | сделано |
| 19 | ProductCardPage.vue — динамические поля | сделано |
| 20 | products_list.css расширен | сделано |
| 21 | products_card.css новый | сделано |
| 22 | router — admin-product-card | сделано |
| 23 | featureFlags productSupplierLinks: true | сделано |
| 24 | ScreensPage.vue карточка | сделано |
| 25 | tests/e2e/helpers/flags.ts | сделано |
| 26 | products.spec.ts | сделано |
| 27 | smoke.spec.ts дополнен | сделано |
| 28 | navigation.spec.ts дополнен | сделано |
| 29 | feature-flags.spec.ts дополнен | сделано |
| 30 | typecheck 0 ошибок | сделано |
| 31 | lint 0 ошибок | сделано |
| 32 | browser golden path пройден пользователем | непонятно (ручная проверка человеком) |
