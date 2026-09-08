# Products

Каталог товаров: постраничный список, лёгкий справочник имён, карточка, создание, правка,
удаление и удаление записи журнала товара. **Семь эндпоинтов**, все в пространстве
`/api/products`.

**Общие соглашения — [`00-conventions.md`](00-conventions.md), и здесь они не повторяются.**
Конверт ответа и разбор ошибки — §1; каталог кодов ядра и правило «отказ несёт код, а не
текст» — §2; `PATCH` против `PUT` — §3; мультиарендность — §4; заголовки и «где лежит
токен» — §5; два механизма прав и заглушка `check_permission` — §6; фича-флаги как тариф — §7;
кастомные поля — §8; аудит-лог девяти сущностей и адресация записи по `id` — §9; уведомления —
§10; идемпотентность и last-write-wins — §11; `TranslatedString` и три помощника — §12;
пагинация, `total` и поведение без `sortBy` — §13; даты, деньги, единицы, валюта — §14;
clean-slate против quick-action — §15; производные значения — §17; чем мок отличается от
обязанностей сервера — §18; форма `id` — §19. Ниже — только то, что живёт в этом домене.

**Источник истины — по эндпоинту, а не по домену.** Модуль бэкенда есть, и у него ровно два
роута: `@router.post("", …)` (`backend/app/modules/products/features/create_product/action.py:23`) и
`@router.get("/{product_id}", …)` (`backend/app/modules/products/features/get_product_detail/action.py:28`),
оба подключены в `backend/app/main.py:66-67`. Значит формы `POST /api/products` и
`GET /api/products/:id` ниже сняты **со схем сервера**, а расхождение фронта с ними названо
находкой; остальные пять описаны по клиенту и моку. Строка `Бэкенд:` стоит у каждого раздела —
файл со строкой или слово «не реализован». Метки `Статус: спроектировано` в домене нет ни
одной: у всех семи эндпоинтов есть вызывающий код (`services/productsService.ts:21`, `:25`,
`:58`, `:111`, `:117`, `:121`, `:125`).

Схема при этом заведена целиком и опережает эндпоинты: модуль создаёт четыре таблицы —
`categories`, `category_fields`, `products`, `product_field_values`
(`backend/app/modules/products/shared/models.py:17`, `:62`, `:99`, `:189`; миграция
`backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:27`, `:42`, `:57`, `:73`), —
плюс две доработки: валюта и UoM
(`backend/alembic/versions/bbd27a3881a5_phase_14_add_currency_uom_fk_to_products.py:27-47`) и
разделение UoM на три с формулами пересчёта
(`backend/alembic/versions/a1b2c3d4e5f6_phase_15_product_uom_restructure.py:31-82`).

**Регистр полей: сервер говорит `snake_case` без единого алиаса, клиент — `camelCase`, и моста
между ними нет.** Серверные схемы —
`backend/app/modules/products/features/create_product/schemas.py:8-31` и
`backend/app/modules/products/features/get_product_detail/schemas.py:25-54`; клиент шлёт и читает
camelCase (`services/productsService.ts:49-58`, `:86-111`, тип — `types/product.ts:56-109`).
Соседний модуль ту же задачу решил алиасами (`backend/app/modules/settings/features/crud/schemas.py:145`,
`:157`, `:169` — `Field(alias="formulaType")`), products — нет. Следствий два, и оба тихие: тело
`POST` теряет все camelCase-ключи как `extra` (модель без `extra="forbid"`, БАГ-11), а карточка
против живого сервера не открывается вовсе (БАГ-07). Чем это закрывать — алиасами на бэкенде или
слоем преобразования на клиенте — контракт **не назначает**: строка в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
`products`.

Потребители: [`services/productsService.ts`](../../../frontend_vue/src/services/productsService.ts) —
единственный клиентский слой домена (126 строк, семь функций);
[`composables/useProducts.ts`](../../../frontend_vue/src/composables/useProducts.ts) — список
(`:27-43` чтение, `:45-58` удаление);
[`composables/useProductCard.ts`](../../../frontend_vue/src/composables/useProductCard.ts) —
карточка (`:167-227` чтение, `:229-264` Save);
[`composables/useProductNames.ts`](../../../frontend_vue/src/composables/useProductNames.ts) —
справочник имён на сессию; экраны — `views/admin/products/ProductsPage.vue` и
`views/admin/products/ProductCardPage.vue`. Реестра «клиент написан, UI нет» у домена нет: у
каждого из семи эндпоинтов есть экран-потребитель, а `GET /api/products/list` зовут ещё пять
складских экранов через `useProductNames` (`grep -rln "useProductNames" frontend_vue/src/views` →
пять файлов).

Товар — **адресат чужих данных больше, чем источник своих**: `avgCostPrice` и `avgSalePrice`
приходят регистрацией из склада и заказов (`services/mocks/warehouse.ts:1377`,
`services/mocks/orders.ts:1311`), уведомление о дефиците рождает склад (`services/mocks/warehouse.ts:1710`),
а определения кастомных полей — категория (§8 соглашений). Отсюда объём раздела «Обязанности
сервера»: почти всё, что сервер обязан делать с товаром, во фронтенде не видно.

---

## Каталог кодов ошибок домена

| код | статус | эндпоинт | где объявлен |
|---|---|---|---|
| `NOT_FOUND` | 404 | `GET /api/products/:id` | `backend/app/modules/products/features/get_product_detail/domain.py:53`, код из `backend/app/core/exceptions.py:13-20` |
| `VALIDATION_ERROR` | 422 | `POST /api/products` | `backend/app/modules/products/features/create_product/domain.py:30-31`, код из `backend/app/core/exceptions.py:23-27` |
| `PRODUCT_NOT_FOUND` | — | `DELETE /api/products/:id`, `DELETE /api/products/:id/audit/:id` | только мок: `services/mocks/products.ts:14222`, `:14232` |
| `PRODUCT_IN_USE` | — | `DELETE /api/products/:id` | только мок: `services/mocks/products.ts:14225` |
| `AUDIT_ENTRY_NOT_FOUND` | — | `DELETE /api/products/:id/audit/:id` | только мок: `services/mocks/products.ts:14234` |

Прочие коды ядра (`UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT` — `backend/app/core/exceptions.py:30-48`)
домен не бросает ни разу: `grep -rn "UNAUTHORIZED\|FORBIDDEN\|CONFLICT" backend/app/modules/products`
пуст.

Четыре свойства этого каталога — наблюдения, и каждое значимо для сервера:

- **Два кода из пяти есть только у сервера, три — только у мока, и пересечения нет ни одного.**
  Значит путь ошибки, который сервер уже реализовал, в демо не воспроизводится (§18 соглашений), а
  три мок-кода серверу ещё предстоит объявить.
- **`NOT_FOUND` — подстрока `PRODUCT_NOT_FOUND` и `AUDIT_ENTRY_NOT_FOUND`.** Правило §2 соглашений
  требует обратного, и нарушено оно именно тем, что мок назвал свои коды длиннее серверного. В
  самом домене сравнение идёт по равенству (`composables/useProducts.ts:51-52`), поэтому сегодня
  это ловушка для следующего вызывающего, а не живой отказ — БАГ-15.
- **Мок кладёт код в `message`, а не в `code`.** `throw new Error(result.code ?? 'PRODUCT_NOT_FOUND')`
  (`services/mocks/index.ts:1507`), и клиент читает `e.message` (`composables/useProducts.ts:51-52`);
  у настоящего `ApiRequestError` код лежит в поле `code` (`types/api.ts:28-31`, заполнение —
  `services/api.ts:53-62`, `:117-124`) — БАГ-01.
- **До человека доходит один код из пяти.** `PRODUCT_IN_USE` → `products.toast_error_delete_in_use`
  (`i18n/admin/products.ts:63`, en `:327`, lt `:590`); остальные падают в общие тексты
  `products.toast_error_delete` (`composables/useProducts.ts:55`), `products.toast_error`
  (`composables/useProductCard.ts:260`), `msg.status_error`
  (`views/admin/products/ProductCardPage.vue:73`) и `auditLog.toast_error_delete`
  (`composables/useAuditFeed.ts:103`).

---

### GET /api/products

Постраничный список каталога. Save-режим: чтение.

Запрос — query, собирается **условно** (`services/productsService.ts:11-21`):

```ts
{
  search: string        // всегда; пустая строка = без фильтра (§13 соглашений)
  page: string          // всегда, String(page)
  pageSize: string      // всегда, String(pageSize)
  categoryIds?: string  // только если список непуст; id через запятую
  sortBy?: 'name' | 'category' | 'price'   // только если задан пользователем
  sortDir?: 'asc' | 'desc'                 // только парой с sortBy
}
```

Мок читает ровно эти пять параметров с дефолтами `page=1`, `pageSize=25`, `sortDir='asc'`
(`services/mocks/index.ts:427-436`). **У `sortBy` дефолта нет ни на одной стороне** — правило
домена 7.

Ответ: `PaginatedResponse<ProductListItem>` (конверт — §13 соглашений; сбор страницы —
`services/mocks/products.ts:13976-13982`):

```ts
interface ProductListItem {
  id: string
  name: TranslatedString
  categoryId: string | null
  categoryName: TranslatedString | null
  sku: string | null
  price: number | null
  minStock: number | null
  avgCostPrice: number | null
  avgSalePrice?: number | null   // null, когда ничего не продано
  createdAt: string
  saleUomId: string | null
  warehouseUomId: string | null
  warehouseToSaleFactor: number | null
}
```

`types/product.ts:37-54`; элемент собирает `toListItem` (`services/mocks/products.ts:13922-13940`).
Три последних поля есть в списке ради подписи единицы в модалах заказа
(`views/admin/products/ProductsPage.vue:158-165`, `productUnitLabel`), а `avgCostPrice` и
`avgSalePrice` — производные, которые сервер обязан считать сам (графа 9 обязанностей).

Правила выборки — наблюдения, а не пожелания:

- **поиск идёт по `sku` и по всем трём локалям имени сразу; описание в поиск не входит**
  (`services/mocks/products.ts:13948-13956`);
- **товар без категории не попадёт ни в одну выборку по категориям**: фильтр сравнивает
  `params.categoryIds.includes(p.categoryId ?? '')` (`:13961`), а пустая строка в списке id не
  встречается — правило домена 8;
- **без `sortBy` порядок выдачи — порядок хранилища**: весь блок сортировки под `if (params.sortBy)`
  (`:13965-13974`); `sortBy: 'category'` сортирует по **копии** имени категории внутри товара
  (`:13969-13970`) — правило домена 7.

Зовут список **четверо**, и двумя разными способами. Экран каталога — один вызывающий на три
повода: по монтированию
(`views/admin/products/ProductsPage.vue:151-155`), по `watch(filters, …, { deep: true })` со
сбросом страницы (`composables/useProducts.ts:63-71`) и по `watch([page, pageSize])` с флагом
против двойного срабатывания (`:73-79`); как справочник — трижды с `pageSize: 1000` и
`sortBy: 'name'`, тремя остальными (`views/admin/orders/AddOrderItemsModal.vue:415-418`,
`composables/useWarehouseBatchCreate.ts:282-285`,
`composables/useWarehouseOffcutCreate.ts:167-170`). Что у одной задачи три механизма — БАГ-03.

Ошибки: ни одной. `mockGetProducts` не бросает (`services/mocks/products.ts:13942-13983`), клиент
кладёт текст исключения в состояние (`composables/useProducts.ts:39`).

Бэкенд: **не реализован** — у модуля два роута, и `GET` среди них только по `/{product_id}`
(`backend/app/modules/products/features/get_product_detail/action.py:28`). Против живого сервера
этот путь даёт 404.

Реализация: `services/productsService.ts:7-22` (`getProducts`) · мок `services/mocks/index.ts:426`

---

### GET /api/products/list

Лёгкий справочник «id + имя» на весь каталог, без параметров и без пагинации. Save-режим: чтение,
один запрос на сессию.

Запрос: параметров нет вовсе — `apiGet('/api/products/list')` без второго аргумента
(`services/productsService.ts:114-118`). Ни поиска, ни страницы, ни фильтра.

Ответ — **голый массив, не `PaginatedResponse`**:

```ts
Array<{ id: string; name: TranslatedString }>
```

Подпись клиента объявляет форму имени структурным литералом `{ ru: string; en: string; lt: string }`
(`services/productsService.ts:114-116`) — второе написание `TranslatedString` (`types/i18n.ts:6-10`).
Мок собирает ответ из всего хранилища без среза (`services/mocks/index.ts:442-445`), то есть 114
записей (`grep -c "^    id: 'prod-" frontend_vue/src/services/mocks/products.ts` → 114). **Это
единственный ответ домена, ничем не ограниченный по размеру.**

Три свойства, которые сервер обязан знать:

- **путь `/list` обязан разбираться раньше `/:id`.** В моке порядок именно такой:
  `path === '/api/products'` (`services/mocks/index.ts:426`), затем `'/api/products/list'` (`:440`),
  затем регулярка карточки (`:449`). У сервера с единственным маршрутом `/{product_id}` порядок
  обратный по построению, и это уже даёт живой дефект: сегмент типизирован `UUID`
  (`backend/app/modules/products/features/get_product_detail/action.py:30`), поэтому ответом будет
  **422 о неразобранном UUID**, а не 404 — БАГ-08. Общее правило — §18 соглашений;
- **справочник живёт синглтоном на сессию и не инвалидируется ничем.** Модульные `products` и
  `inflight` (`composables/useProductNames.ts:12-13`), запрос ровно один за сессию (`:25-36`),
  снимается обещание только при ошибке (`:31-33`); функции сброса нет —
  `grep -rn "inflight" frontend_vue/src` даёт один файл. Создание, переименование и удаление товара
  справочник не трогают;
- **его ждут вместе со своими данными, а не после.** Восемь складских загрузчиков зовут
  `ensureProductNames` внутри `Promise.all` (`composables/useWarehouse.ts:219`, `:245`, `:271`;
  `composables/useWarehouseBatch.ts:198`; `composables/useWarehouseOffcutCard.ts:199`;
  `composables/useWarehouseMovementCard.ts:36`; `composables/useWarehouseCutting.ts:110`, `:146`) —
  причина записана в самом файле (`composables/useProductNames.ts:15-24`).

Ошибки: ни одной. Ветка мока не бросает (`services/mocks/index.ts:440-447`), потребитель ошибку
глотает и снимает обещание, чтобы попробовать снова (`composables/useProductNames.ts:31-33`).

Бэкенд: **не реализован** — и хуже, чем «нет»: путь перехватит
`GET /api/products/{product_id}` (`backend/app/modules/products/features/get_product_detail/action.py:28-30`).

Реализация: `services/productsService.ts:114-118` (`getProductList`) · мок
`services/mocks/index.ts:440`

---

### GET /api/products/:id

Карточка товара целиком. Сегмент `:id` — идентификатор товара. Save-режим: чтение; тот же вызов
работает кнопкой Discard (`composables/useProductCard.ts:266-268`) и после Save (`:258`).

Запрос: только путь — `apiGet(\`/api/products/${id}\`)` (`services/productsService.ts:24-26`), ни
query, ни заголовков. Сервер типизирует сегмент как `product_id: UUID`
(`backend/app/modules/products/features/get_product_detail/action.py:30`), то есть демо-идентификатор
вида `prod-001` (`services/mocks/products.ts:31`) он отвергнет валидацией пути, не дойдя до
обработчика — правило домена 2. Мок ловит путь регуляркой `/^\/api\/products\/([^/]+)$/`
(`services/mocks/index.ts:449`).

**Ответ описан по серверу — он здесь старший.** `ProductDetailResponse`, обёрнутый в `ApiResponse`
(`backend/app/modules/products/features/get_product_detail/action.py:38-41`):

```ts
{
  id: string                                  // UUID
  name: string
  sku: string | null
  description: string | null
  price: number | null
  price_unit: string | null                   // легаси-подпись "EUR/kg", см. графу 9
  price_quantity: number                      // по умолчанию 1
  currency_id: string | null
  min_stock: number | null
  purchase_uom_id: string | null
  warehouse_uom_id: string | null
  sale_uom_id: string | null
  purchase_to_warehouse_formula_type: string | null
  purchase_to_warehouse_factor: number | null
  warehouse_to_sale_formula_type: string | null
  warehouse_to_sale_factor: number | null
  category: { id: string; name: string; level: number } | null
  field_values: Array<{ field_id: string; field_name: string; value: string | null }>
  created_at: string                          // datetime
  updated_at: string                          // datetime
}
```

`backend/app/modules/products/features/get_product_detail/schemas.py:25-54`, вложенные схемы `:9-14`
и `:17-22`, сборка — `backend/app/modules/products/features/get_product_detail/domain.py:81-104`.

Фронт ждёт `Product` в camelCase (`types/product.ts:56-109`), и расхождений **шесть**, каждое
отдельное:

1. **регистр всех составных имён** — общая беда домена, см. врезку выше;
2. **категория**: у сервера вложенный `category` из живой выборки (`backend/app/modules/products/features/get_product_detail/schemas.py:17-22`, сборка
   `backend/app/modules/products/features/get_product_detail/domain.py:56-64`), у фронта два плоских поля `categoryId` + `categoryName`
   (`types/product.ts:59-60`), причём мок хранит имя **копией** внутри товара
   (`services/mocks/products.ts:34`) — правило домена 4 «Обязанностей»;
3. **`price_unit`** — легаси-подпись, которую сервер собирает заново из FK при каждом чтении
   (`backend/app/modules/products/features/get_product_detail/domain.py:26-44`, вызов `:77-79`), хотя колонку миграция удалила
   (`backend/alembic/versions/a1b2c3d4e5f6_phase_15_product_uom_restructure.py:99`); во фронте такого
   поля нет (`grep -c "priceUnit" frontend_vue/src/types/product.ts` → 0, есть лишь неиспользуемый
   алиас `PriceUnit` на `types/product.ts:7`);
4. **`updated_at`** сервер отдаёт (`backend/app/modules/products/features/get_product_detail/schemas.py:54`), фронт хранит только `createdAt`
   (`types/product.ts:105`);
5. **пяти полей фронта у сервера нет вовсе** — `avgCostPrice`, `avgSalePrice`, `linkedSuppliers`,
   `auditLog`, `weightPerWarehouseUnitKg` (`types/product.ts:69-70`, `:103`, `:107-108`): ни в схеме
   ответа, ни в модели (`backend/app/modules/products/shared/models.py:96-183`);
6. **элемент `field_values`** у сервера — три поля, у фронта шесть, и `field_name` сервер заполняет
   **заглушкой** `str(fv.field_id)` с комментарием «placeholder — resolve field name»
   (`backend/app/modules/products/features/get_product_detail/domain.py:70`) — БАГ-04; фронтовый `ProductFieldValue` — `{fieldId, fieldName: TranslatedString,
   fieldType, value, inherited, options?}` (`types/product.ts:9-16`).

Практическое следствие пятого пункта: **карточка против живого бэкенда не откроется** —
`JSON.parse(JSON.stringify(data.linkedSuppliers))` на `undefined` бросает
(`composables/useProductCard.ts:220`) — БАГ-07.

Мок отдаёт `Product` целиком и **по ссылке на запись хранилища**, без копии: `return found`
(`services/mocks/products.ts:13985-13989`) — БАГ-05, и карточка правит хранилище напрямую
(`views/admin/products/ProductCardPage.vue:70`). Для сервера разницы нет; правило записано, чтобы
её не перенесли в контракт (§18 соглашений).

Ошибки: **у сервера одна, у мока ни одной.** Сервер бросает `NotFoundError(entity="Product", …)`
(`backend/app/modules/products/features/get_product_detail/domain.py:51-53`) и отдаёт 404 с телом
`{"detail": {"message", "code"}}` (`backend/app/modules/products/features/get_product_detail/action.py:42-46`); мок
вместо кода бросает **текст** — `new Error(\`Product ${id} not found\`)`
(`services/mocks/products.ts:13987`), и этот текст показывается пользователю
(`composables/useProductCard.ts:223`) — БАГ-06.

Кроме карточки тот же эндпоинт зовут четыре складских потребителя за одним товаром:
`composables/useWarehouseBatchCreate.ts:145`, `composables/useWarehouseOffcutCreate.ts:281`,
`composables/useWarehouseOffcutCard.ts:237`, `composables/useWarehouseCutting.ts:148`.

Бэкенд: `backend/app/modules/products/features/get_product_detail/action.py:28`
(`get_product_detail`) · схемы `backend/app/modules/products/features/get_product_detail/schemas.py:9-54` · выборка
`backend/app/modules/products/features/get_product_detail/repository.py:13-22` (**без фильтра по арендатору** — БАГ-14)

Реализация: `services/productsService.ts:24-26` (`getProduct`) · мок
`services/mocks/index.ts:449` → `services/mocks/products.ts:13985` (`mockGetProduct`)

---

### POST /api/products

Создание товара. Save-режим: quick-action — запрос уходит по submit модала каталога, затем модал
закрывается, форма сбрасывается и происходит переход в карточку созданного товара
(`views/admin/products/ProductsPage.vue:214-216`). **Списка после этого не перезапрашивают.**

**Запрос описан по серверу — он здесь старший.** `CreateProductInput`
(`backend/app/modules/products/features/create_product/schemas.py:8-31`):

```ts
{
  name: string                                  // единственное обязательное
  category_id?: string | null
  sku?: string | null
  description?: string | null
  price?: number | null
  min_stock?: number | null
  currency_id?: string | null
  price_quantity?: number                       // default 1, ge=1
  purchase_uom_id?: string | null
  warehouse_uom_id?: string | null
  sale_uom_id?: string | null
  purchase_to_warehouse_formula_type?: string | null
  purchase_to_warehouse_factor?: number | null
  warehouse_to_sale_formula_type?: string | null
  warehouse_to_sale_factor?: number | null
}
```

Клиент шлёт те же пятнадцать полей в camelCase и `name` **объектом** `TranslatedString`
(`services/productsService.ts:28-59`; заворачивание — `:51`, помощник — `types/i18n.ts:19-25`).
Против живого сервера это два тихих отказа: `name` объектом не пройдёт `str`, а все camelCase-ключи
будут молча отброшены как `extra`, то есть категория, цена, валюта и три единицы измерения до
сервера не доедут — БАГ-11. Из модала при этом приходит только **восемь** полей — `name`,
`categoryId`, `price`, `priceQuantity`, `currencyId`, `purchaseUomId`, `warehouseUomId`, `saleUomId`
(`views/admin/products/ProductsPage.vue:201-210`), — хотя подпись клиента принимает пятнадцать
(`services/productsService.ts:29-46`). Ни `sku`, ни `description`, ни `minStock` в создании задать
нельзя; `weightPerWarehouseUnitKg` не принимает даже подпись — правило домена 15.

**Два правила подстановки сервер уже реализует, и мок не повторяет ни одного:**

- **валюта**: при `currency_id is None` подставляется валюта арендатора — `is_default` из
  справочника, иначе первая (`backend/app/modules/products/features/create_product/domain.py:33-36`;
  реализация — `backend/app/modules/settings/internal_api/interface.py:44-56`);
- **единицы**: незаданные каскадируются `warehouse ← sale`, `purchase ← warehouse`
  (`backend/app/modules/products/features/create_product/domain.py:38-41`).

Мок пишет то, что пришло, без обеих подстановок (`services/mocks/products.ts:14085-14089`) —
БАГ-13. Обе подстановки — обязанность сервера, а не клиента: справочником владеет `settings`
(§14 соглашений).

Ответ — **у сервера четыре поля, у мока и клиента весь товар**. `CreateProductResponse` со статусом
`201 Created`:

```ts
{ id: string; name: string; sku: string | null; message: string }
```

`backend/app/modules/products/features/create_product/schemas.py:34-40`, сборка
`backend/app/modules/products/features/create_product/domain.py:63-67`, конверт и статус — `backend/app/modules/products/features/create_product/action.py:23`, `:38-42`.
Клиент типизирует ответ как `Promise<Product>` (`services/productsService.ts:48`), мок отдаёт
созданный `Product` целиком (`services/mocks/products.ts:14076-14114`). Сегодня расхождение
безвредно — вызывающий читает единственное поле `created.id` для перехода в карточку
(`views/admin/products/ProductsPage.vue:216`), — но тип клиента врёт, и второй вызывающий на нём
сломается.

Ошибки: **одна у сервера, ни одной у мока.** Сервер бросает
`ValidationError("Product name is required")` на пустом имени
(`backend/app/modules/products/features/create_product/domain.py:30-31`) и отдаёт 422 с телом `{"detail": {"message", "code"}}`
(`backend/app/modules/products/features/create_product/action.py:43-47`). Мок не бросает ничего
(`services/mocks/products.ts:13991-14115`); вместо серверной проверки стоит клиентская —
`if (!newProduct.value.name.trim()) return` (`views/admin/products/ProductsPage.vue:198`) плюс
`:disabled` на кнопке (`:540`). **Ошибку создания фронт не показывает вовсе:** у `handleCreate`
есть `try/finally` и нет `catch` (`views/admin/products/ProductsPage.vue:197-220`) — БАГ-12.

Повторный `POST` с тем же телом создаёт второй товар: `Idempotency-Key` домен не шлёт (§11
соглашений), уникальности имени или `sku` нет ни на схеме — единственный `UniqueConstraint` модуля
это `uq_product_field_value` на `(product_id, field_id)`
(`backend/app/modules/products/shared/models.py:210-214`), — ни в моке
(`services/mocks/products.ts:13991-14115`).

Бэкенд: `backend/app/modules/products/features/create_product/action.py:23` (`create_product`) ·
схемы `backend/app/modules/products/features/create_product/schemas.py:8-40` · запись `backend/app/modules/products/features/create_product/repository.py:48-50`
(`flush`, без своего коммита)

Реализация: `services/productsService.ts:28-59` (`createProduct`) · мок
`services/mocks/index.ts:953` → `services/mocks/products.ts:13991` (`mockCreateProduct`)

---

### PATCH /api/products/:id

Правка карточки: форма, значения кастомных полей и список поставщиков — **одним запросом**.
Сегмент `:id` — идентификатор товара. Save-режим: clean-slate, уходит по кнопке Save и только при
`isAnythingDirty` (`composables/useProductCard.ts:229-264`, признак — `:105-107`).

Запрос — дельта. Объявленных ключей **шестнадцать**
(`services/productsService.ts:61-85`):

```ts
Partial<{
  name: TranslatedString
  sku: string | null
  description: TranslatedString | null
  price: number | null
  minStock: number | null
  priceQuantity: number
  currencyId: string | null
  purchaseUomId: string | null
  warehouseUomId: string | null
  saleUomId: string | null
  purchaseToWarehouseFormulaType: ConversionFormulaType | null
  purchaseToWarehouseFactor: number | null
  warehouseToSaleFormulaType: ConversionFormulaType | null
  warehouseToSaleFactor: number | null
  fieldValues: ProductFieldValue[]      // полный массив, replace-семантика
  linkedSuppliers: LinkedSupplier[]     // полный массив, replace-семантика
}>
```

Семнадцатый ключ, `weightPerWarehouseUnitKg`, **уезжает, не будучи объявленным**: он есть в форме
(`composables/useProductCard.ts:203`), попадает в дельту через `Object.assign(delta, dirty.diff())`
(`:235`), читается моком (`services/mocks/products.ts:14136`, `:14201-14204`) — и отсутствует в
`Pick<>` подписи клиента (`services/productsService.ts:63-83`) — БАГ-09, правило домена 15.

Ключа `categoryId` в подписи нет **сознательно**: категория в карточке только читается —
`readonly` на поле (`views/admin/products/ProductCardPage.vue:308-315`).

Как собирается дельта: `useDirtyCheck.diff()` отдаёт только изменённые ключи верхнего уровня
(§15 соглашений), `fieldValues` и `linkedSuppliers` кладутся **целыми массивами**
(`composables/useProductCard.ts:243-255`). Признак грязи собран из трёх независимых: `dirty.isDirty`
по форме, сравнение JSON карты значений (`:93-95`) и сравнение JSON списка поставщиков (`:101-103`).
Клиент перед отправкой заворачивает в `TranslatedString` `name`, `description`,
`fieldValues[].fieldName` и `fieldValues[].options[]`, а также `linkedSuppliers[].name` — но
**только если пришла строка** (`services/productsService.ts:87-110`); из карточки всегда приходит
уже собранный объект (`composables/useProductCard.ts:188-204`), поэтому все пять ветвей со строкой
из UI недостижимы.

**`fieldValues` приходит полным массивом с материализованной копией определения** — `fieldName`,
`fieldType`, `options`, `inherited` (`types/product.ts:9-16`, сборка
`composables/useProductCard.ts:244-249`). Четыре поля из шести на проводе производные, и **сервер
обязан их игнорировать, а не записывать**: на схеме у значения есть только `field_id` и `value`
(`backend/app/modules/products/shared/models.py:203-208`). Общий механизм — §8 соглашений.

Ответ: `Product` целиком (`services/productsService.ts:85`); мок возвращает пересобранный объект
(`services/mocks/products.ts:14168-14217`) — **или `null`, если товара нет** (`:14145`, подпись
`:14143`), что по конверту доходит до клиента как успешный ответ без данных — БАГ-10. Ответ клиент
не использует: после `patchProduct` идёт безусловный `load()` (`composables/useProductCard.ts:256-258`).

Ошибки: ни одной. В `mockPatchProduct` нет ни одного `throw`
(`services/mocks/products.ts:14117-14218`), клиент показывает общий `products.toast_error` и тела
ошибки не читает — `catch {` без параметра (`composables/useProductCard.ts:259-260`). Валидации
значений кастомных полей по `fieldType` и `required` нет **нигде**: единственная нормализация — NaN
у числового поля (`:247`) и три NaN-заглушки в форме (`:238-241`).

Версия не спрашивается: `If-Match` домен не шлёт (§11 соглашений), `updatedAt` в `Product` нет
(`types/product.ts:56-109`) — то есть last-write-wins здесь не решение контракта, а следствие
отсутствия механизма.

Бэкенд: **не реализован.** Схема хранения при этом уже заведена и с формой запроса согласуется по
именам в `snake_case` (`backend/app/modules/products/shared/models.py:107-177`), кроме
`weightPerWarehouseUnitKg`, которого на бэкенде нет вовсе (`grep -rn "weight_per_warehouse" backend/`
— пусто).

Реализация: `services/productsService.ts:61-112` (`patchProduct`) · мок
`services/mocks/index.ts:1210` → `services/mocks/products.ts:14117` (`mockPatchProduct`)

---

### DELETE /api/products/:id

Удаление товара. Сегмент `:id` — идентификатор товара. Save-режим: quick-action — уходит сразу
после подтверждения модала (`views/admin/products/ProductsPage.vue:190-195`, вызов
`composables/useProducts.ts:47`); после успеха тост `products.toast_deleted` (`:48`) и `load()`
(`:49`). Save bar не участвует.

Запрос: тела нет — `apiDelete(\`/api/products/${id}\`)` (`services/productsService.ts:120-122`). Ни
query, ни заголовков: `apiDelete` кладёт только `options?.headers`, а вызывающий их не передаёт
(`services/api.ts:211-221`).

Ответ: `Promise<void>` в подписи (`services/productsService.ts:120`); мок возвращает
`delay(undefined as T)` (`services/mocks/index.ts:1508`). На проводе — общий конверт с пустыми
данными, `ApiResponse<null>` (`services/api.ts:128-141`, тип — `types/api.ts:1-6`).

Ошибки: `PRODUCT_NOT_FOUND` и `PRODUCT_IN_USE` (`services/mocks/products.ts:14222`, `:14225`), и
код лежит в `message` — БАГ-01. **Проверка «товар используется» в моке — захардкоженное множество
трёх id, ничем не связанное с заказами:** `new Set(['prod-001', 'prod-005', 'prod-010'])` (`:14224`),
причём `services/mocks/products.ts` заказы не импортирует вовсе (его импорты — `:1-18`).

**Чем должна быть эта проверка на сервере, контракт не назначает** — и это самая дорогая строка
домена: на товар ссылаются **семь** чужих таблиц, и политик у них на схеме пять разных:

| ссылка | политика | где |
|---|---|---|
| `warehouse_batches.product_id` | `RESTRICT` | `backend/app/modules/warehouse/shared/models.py:22-27` |
| `warehouse_offcuts.product_id` | `SET NULL` | `backend/app/modules/warehouse/shared/models.py:148-152` |
| `warehouse_deficits.product_id` | `CASCADE` | `backend/app/modules/warehouse/shared/models.py:179-183` |
| `stock_items.product_id` | `CASCADE` + `unique` | `backend/app/modules/warehouse/shared/models.py:213-218` |
| `supplier_price_entries.product_id` | `SET NULL` | `backend/app/modules/suppliers/shared/models.py:223` |
| `bcc_events.product_id` | `SET NULL` | `backend/app/modules/bcc/shared/models.py:65` |
| `product_field_values.product_id` | `CASCADE` | `backend/app/modules/products/shared/models.py:199` |

Мок не знает ни одной: `mockDeleteProduct` делает `STORE.splice(idx, 1)`
(`services/mocks/products.ts:14226`) и оставляет висячими 313 складских ссылок на 72 различных
товара (`grep -oh "productId: 'prod-[0-9]*'" frontend_vue/src/mocks/*.ts | wc -l` → 313, то же с
`| sort -u` → 72; складские сиды лежат в пяти файлах `frontend_vue/src/mocks/`). Строка в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

Бэкенд: **не реализован.**

Реализация: `services/productsService.ts:120-122` (`deleteProduct`) · мок
`services/mocks/index.ts:1504` → `services/mocks/products.ts:14220` (`mockDeleteProduct`)

---

### DELETE /api/products/:id/audit/:id

Удаление одной записи журнала товара. Сегментов в пути два, и оба — идентификаторы:

- первый — идентификатор **товара** (`productId`);
- второй — идентификатор **записи журнала** (`entryId`), уникальный внутри своего лога.

Адресация записи по `id`, а не по позиции, и отсутствие своего `DELETE` у общей ленты — общее
правило девяти сущностей, §9 соглашений.

Запрос: тела нет —
`apiDelete<void>(\`/api/products/${productId}/audit/${entryId}\`)`
(`services/productsService.ts:124-126`). Заголовков клиент не шлёт **даже когда зовёт из ленты
аудита**: `deleteAuditFeedEntry` роутит сюда по `entityType`
(`services/auditFeedService.ts:57-60`), а собственные чтения ленты при этом несут `Authorization`
(`:20-24`, `:41`, `:46`) — БАГ-02.

Ответ: `Promise<void>`; мок возвращает `delay(undefined as T)` (`services/mocks/index.ts:1501`), на
проводе `ApiResponse<null>`. **Тела ответа не читает ни один вызывающий:** карточка правит список
локально (`views/admin/products/ProductCardPage.vue:70`), лента — своей функцией `withoutRow`
(`composables/useAuditFeed.ts:97`).

Ошибки: `PRODUCT_NOT_FOUND` и `AUDIT_ENTRY_NOT_FOUND`, и здесь мок бросает их **правильно** — из
самой функции, кодом, а не текстом (`services/mocks/products.ts:14232`, `:14234`), и ветка
`services/mocks/index.ts:1495-1502` их не перехватывает. До человека, впрочем, не доходит ни один:
карточка показывает общий `msg.status_error` (`views/admin/products/ProductCardPage.vue:73`), лента —
общий `auditLog.toast_error_delete` (`composables/useAuditFeed.ts:103`). Неизвестный `entryId` —
отказ, а не тихий no-op: правило §9 соглашений здесь соблюдено.

Два места вызова, и второго пути к записи сознательно нет
(`services/auditFeedService.ts:49-56`): из карточки — по подтверждению модала (`askDeleteAudit`
открывает — `views/admin/products/ProductCardPage.vue:60-63`, `confirmDeleteAudit` шлёт запрос —
`:65-78`); из общей ленты — `deleteRow` с перезагрузкой списка после
(`composables/useAuditFeed.ts:96-100`).

**Кому это разрешено — не сказано нигде:** удаление следа изменения не гейтится ни правом, ни
фича-флагом (единственный `useFeatureFlag` в карточке — `productSupplierLinks`,
`views/admin/products/ProductCardPage.vue:35`). Строка владельцу, графа 7 обязанностей.

Форма записи — `StockAuditEntry` (`types/warehouse.ts:526-534`), товар переиспользует её через
алиас `SupplierAuditEntry` (`types/supplier.ts:81`, поле — `types/product.ts:108`).

Бэкенд: **не реализован** — и таблицы под журнал товара на схеме нет: модуль создаёт четыре
таблицы (`backend/app/modules/products/shared/models.py:17`, `:62`, `:99`, `:189`), а единственные
существующие таблицы журналов — `stock_audit_entries`
(`backend/app/modules/warehouse/shared/models.py:232`) и журнал поставщика
(`backend/app/modules/suppliers/shared/models.py:173`).

Реализация: `services/productsService.ts:124-126` (`deleteProductAuditEntry`) · мок
`services/mocks/index.ts:1495` → `services/mocks/products.ts:14230`
(`mockDeleteProductAuditEntry`)

---

## Обязанности сервера

Девять граф аудита ([`plans/api/audit/products.md`](../../plans/api/audit/products.md), раздел
«Обязанности сервера») — то, чего во фронтенде не видно и что линзы согласованности не ловят по
построению. Ответ «нигде» контракт **не назначает**: он идёт строкой в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
`products`.

**1. Значения по умолчанию и их владелец — два правила сервер уже знает, и мок оба нарушает.**

| значение | где задано | состояние |
|---|---|---|
| валюта нового товара | `backend/app/modules/products/features/create_product/domain.py:33-36` (валюта арендатора), реализация — `backend/app/modules/settings/internal_api/interface.py:44-56`; в моке настроек `cur-eur` помечен `isDefault: true` (`services/mocks/settings.ts:70-73`) | сервер подставляет, мок пишет `data.currencyId ?? null` (`services/mocks/products.ts:14085`) — БАГ-13 |
| единицы нового товара | `backend/app/modules/products/features/create_product/domain.py:38-41` (каскад `warehouse ← sale`, `purchase ← warehouse`) | сервер каскадирует, мок пишет каждую как пришла (`services/mocks/products.ts:14087-14089`) — БАГ-13 |
| `priceQuantity` | три экземпляра: `backend/app/modules/products/features/create_product/schemas.py:20`, `backend/app/modules/products/shared/models.py:132-134`, мок `services/mocks/products.ts:14084`, форма карточки `composables/useProductCard.ts:193` | значение одно (`1`), владельца нет |
| размер страницы | `usePagination(25)` (`composables/useProducts.ts:23`) и дефолт ветки мока (`services/mocks/index.ts:435`) | константа фронта в двух местах, §13 соглашений |
| перечень размеров страницы | `PAGE_SIZE_OPTIONS = 25/50/100` (`views/admin/products/ProductsPage.vue:37-41`) | справочника нет ни в настройках, ни на схеме |
| перечень формул пересчёта | `CONVERSION_FORMULA_TYPES` — три имени со стражем (`types/settings.ts:55-67`); на схеме обе колонки — `String(30)` без `CHECK` (`backend/app/modules/products/shared/models.py:165-177`), у сервера в схеме входа `str | None` без валидации (`backend/app/modules/products/features/create_product/schemas.py:28-31`) | владелец — **нигде**, строка владельцу |

Отдельно: **валюта живёт в проекте тремя представлениями** — id у товара (`Product.currencyId`,
`'cur-eur'` — `types/product.ts:67`, `services/mocks/products.ts:46`), код в снимке поставщика
(`LinkedSupplier.currency`, `'EUR'` — `types/product.ts:34`) и код в константах настроек
(`constants.defaultCurrency: 'EUR'` — `composables/useSettings.ts:27`). Почему трижды — строка
владельцу; общее правило «справочник принадлежит серверу» — §14 соглашений.

**2. События и уведомления — создание, правка и удаление товара не рождают ни одного.**
`grep -n "notify" frontend_vue/src/services/mocks/products.ts` пуст. Из семи эмиттеров проекта
(`grep -c "^export function notify" frontend_vue/src/services/mocks/notifications.ts` → 7) товара
касается ровно один — `notifyStockDeficit` (`services/mocks/notifications.ts:637-654`), и рождает
его **склад**, а не товар: единственный вызов — `services/mocks/warehouse.ts:1710`. Уведомление при
этом ссылается на карточку товара (`services/mocks/notifications.ts:650-652`), то есть товар —
адресат чужого события и источник ни одного своего. Не рождает события и правка `minStock` —
величины, относительно которой дефицит и считается (`types/product.ts:68`, редактирование —
`composables/useProductCard.ts:194`). Строка владельцу. Механика эмиттеров — §10 соглашений.

**3. Запись в аудит-лог — лог у товара есть, и его никто не пишет.** Поле
`auditLog: SupplierAuditEntry[]` объявлено (`types/product.ts:108`), засеяно у 114 товаров из 114
(`grep -c "auditLog: \[$" frontend_vue/src/services/mocks/products.ts` → 114), читается карточкой
(`views/admin/products/ProductCardPage.vue:700`) и общей лентой
(`services/mocks/products.ts:14247-14254`), удаляется эндпоинтом (`:14230-14236`) — и не пополняется
ничем: `mockPatchProduct` переносит старый (`:14213`), `mockCreateProduct` кладёт пустой (`:14110`).
То есть **удалить запись можно, а появиться ей неоткуда**. Автор в записи — отображаемое имя, а не
id пользователя (`types/warehouse.ts:526-534`); понятия `sensitive` в записи нет
(`grep -c "sensitive" frontend_vue/src/types/warehouse.ts` → 0). Таблицы под журнал товара на схеме
нет (см. раздел `DELETE /api/products/:id/audit/:id`). Кто и когда пишет запись, кто её автор и что
помечается чувствительным — строка владельцу; общая картина — §9 соглашений.

**4. Кастомные поля — определения у категории, значения у товара, валидации нет ни у кого.**
Определения живут в `Category.fields` / `Category.inheritedFields` (домен `categories`), товар
хранит значения — `ProductFieldValue` (`types/product.ts:9-16`). Набор для нового товара мок
собирает из категории: сначала унаследованные с `inherited: true`, затем собственные с
`inherited: false` (`services/mocks/products.ts:14046-14063`). Четыре поля из шести — копия
справочника внутри значения (`:14047-14052`), и после переименования поля в категории у товаров они
не обновляются: `services/mocks/categories.ts` товаров не касается вовсе. На схеме значение —
свободный `Text` (`backend/app/modules/products/shared/models.py:208`) с уникальностью пары
`(product_id, field_id)` (`:210-214`; индекс миграции —
`backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:83`), то есть тип значения не
выражен ничем. Файловое поле хранит **имена** файлов, а не `fileId`
(`views/admin/products/ProductCardPage.vue:218-226`). Кто валидирует значение по типу и
обязательности и что делать со значением удалённого определения — строка владельцу; общий механизм
и вторая библиотека определений — §8 соглашений.

**5. Настройки, которых мок не отслеживает — четыре, каждая прямое наблюдение.**

1. **Справочник единиц.** `settings.uoms` строит селекты карточки и модала создания
   (`views/admin/products/ProductsPage.vue:496`, `:518`, `:526`) и подпись единицы в списке
   (`:158-165`), но `priceUomId` связанного поставщика — **снимок** `form.value.saleUomId` на момент
   привязки (`views/admin/products/ProductCardPage.vue:209`), и после смены единицы продажи не
   обновляется ничем.
2. **Правила пересчёта.** `settings.conversions` подставляют коэффициент в форму при загрузке и при
   смене единиц (`composables/useProductCard.ts:155-165`, `:182-186`, `:270-303`) — то есть значение
   справочника **материализуется в товар** и дальше живёт своей жизнью. Сервер об этой подстановке
   не знает: у него каскадируются только сами единицы (`backend/app/modules/products/features/create_product/domain.py:38-41`).
3. **Валюта поставщика** в `linkedSuppliers` — снимок на момент привязки
   (`views/admin/products/ProductCardPage.vue:211`, тип — `types/product.ts:34`); курса конвертации в
   проекте нет вовсе (§14 соглашений).
4. **Локали.** `TranslatedString` жёстко трёхъязычна (`types/i18n.ts:6-10`), сортировка списка всегда
   идёт по `name.en` независимо от языка читателя (`services/mocks/products.ts:13968`, `:13970`), а на
   схеме под имя стоит одна `String(255)` (`backend/app/modules/products/shared/models.py:107`) —
   расхождение схемы с типом описано в §12 соглашений.

**6. Мультиарендность — на схеме выражена, в единственном реализованном чтении нет.**
`Product.tenant_id` и `ProductFieldValue.tenant_id` объявлены `nullable=False, index=True`, FK на
`tenants.id` с `ondelete="CASCADE"` (`backend/app/modules/products/shared/models.py:101-106`,
`:191-196`; миграция `backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:60`,
`:76`). Но `get_product_by_id` выбирает товар **только по id**
(`backend/app/modules/products/features/get_product_detail/repository.py:13-22`), а домен, который
`tenant_id` получает, использует его лишь для сборки легаси-подписи
(`backend/app/modules/products/features/get_product_detail/domain.py:47-53`, `:77-79`) — БАГ-14. Что модуль это умеет, видно рядом:
`count_products_by_currency` и `count_products_by_uom` фильтруют по арендатору
(`backend/app/modules/products/internal_api/interface.py:49-53`, `:63-70`). Сам арендатор в обоих
роутах захардкожен заглушкой `00000000-0000-0000-0000-000000000001`
(`backend/app/modules/products/features/create_product/action.py:33-34`, `backend/app/modules/products/features/get_product_detail/action.py:34-35`). Во фронте
мультиарендность не выражена никак — и так и должно быть (§4 соглашений).

**7. Права — не проверяются нигде.** У роутов бэкенда нет ни одной зависимости аутентификации:
единственный `Depends` в обоих — `get_db` (`backend/app/modules/products/features/create_product/action.py:26`,
`backend/app/modules/products/features/get_product_detail/action.py:31`), тогда как соседний `GET /api/auth/me` требует Bearer
(`backend/app/modules/auth/features/me/action.py:36`). Клиент заголовков не шлёт тоже
(`services/productsService.ts` — 126 строк, ни одного `headers`), что для домена с
`tenant_id NOT NULL` само по себе находка (§5 соглашений). Во фронте доступ гейтится только
фича-флагами: роуты `products` и `products/:id` несут `meta.featureFlag: 'adminProducts'`
(`router/index.ts:220`, `:226`), секция поставщиков — `productSupplierLinks`
(`views/admin/products/ProductCardPage.vue:35`); оба объявлены `true`
(`config/featureFlags.ts:20`, `:38`), и флаг — это тариф, а не право (§7 соглашений). В матрице
прав товаров нет ни одного упоминания (`grep -rn "product" frontend_vue/src/services/mocks/config.ts`
— пусто), при том что сама матрица существует (`types/config.ts:37-57`). Какое право нужно на
чтение, создание, правку, удаление и на удаление записи журнала — строка владельцу.

**8. Транзакционность и идемпотентность.** `Idempotency-Key` домен не использует —
`grep -rn "Idempotency" frontend_vue/src/services/productsService.ts` пуст, `apiPost`/`apiPatch`
кладут только `Content-Type` (`services/api.ts:174`, `:205`); по правилу §11 соглашений это
законно: необратимого `POST` в домене нет. На бэкенде транзакция одна на запрос и снимается
зависимостью `get_db`: коммит после выхода из обработчика, откат на любом исключении
(`backend/app/core/database.py:22-30`); репозиторий делает только `flush`
(`backend/app/modules/products/features/create_product/repository.py:48-50`), то есть 422 отката не требует — он и так до записи не
доходит (`backend/app/modules/products/features/create_product/domain.py:30-31`). **Save карточки шлёт один запрос на все три группы
правок** (`composables/useProductCard.ts:233-256`), то есть атомарность формы, значений полей и
списка поставщиков обеспечена одним `PATCH` — это правило контракта, а не деталь клиента, и один из
трёх доменов проекта, где так (§15 соглашений). Что сервер обязан сделать с семью чужими ссылками
при удалении товара — строка владельцу (см. `DELETE /api/products/:id`).

**9. Производные значения — сервер считает, а не хранит.** Их четыре, и три считаются сегодня на
клиенте:

1. **`avgCostPrice`** — средневзвешенная складская цена по партиям с остатком, в базовой валюте
   (`services/mocks/products.ts:13874-13882`);
2. **`avgSalePrice`** — нетто отгруженного, делённое на отгруженное количество (`:13891-13895`).
   Обе повешены на товар геттерами, запись в них — no-op (`:13905-13918`, применение к хранилищу
   `:13920`, к созданному `:14112`, к пропатченному `:14215`), а данные приходят регистрацией из
   чужих модулей: партии от склада (`services/mocks/warehouse.ts:1377`), продажи от заказов
   (`services/mocks/orders.ts:1311`). Колонок под обе на схеме нет
   (`backend/app/modules/products/shared/models.py:96-183`), в ответе сервера их тоже нет
   (`backend/app/modules/products/features/get_product_detail/schemas.py:25-54`) — значит **сервер обязан считать их сам**, и это
   единственный способ: данные лежат в двух других модулях. Кто именно считает — строка владельцу;
3. **`price_unit`** — подпись вида `"EUR/kg"`, которую сервер собирает из `currency_id` +
   `sale_uom_id` при каждом чтении (`backend/app/modules/products/features/get_product_detail/domain.py:26-44`, вызов `:77-79`) после
   того, как одноимённая колонка была удалена миграцией
   (`backend/alembic/versions/a1b2c3d4e5f6_phase_15_product_uom_restructure.py:99`); код единицы
   берётся `en → ru → lt` (`backend/app/modules/products/features/get_product_detail/domain.py:37-41`), то есть подпись всегда
   собирается на чужом языке. Остаётся ли она в ответе — строка владельцу;
4. **`categoryName`** — производное **только во фронте**: мок хранит его копией в записи товара
   (`services/mocks/products.ts:34`) и подставляет из категории при создании (`:14026-14030`), а
   сервер отдаёт вложенный `category` из живой выборки (`backend/app/modules/products/features/get_product_detail/domain.py:56-64`). У
   сервера это ссылка, у мока копия, и после переименования категории копия устаревает.

---

## Правила домена

То, что живёт только в этом домене и не выводится из формы ни одного эндпоинта.

1. **Формы бэкенда и формы фронта — два разных языка, и мост между ними не написан.** Врезка в
   начале файла; следствия — БАГ-07 и БАГ-11, решение — владельцу.
2. **Товар идентифицируется UUID'ом на сервере и строкой `prod-NNN` в моке.** Сегмент пути
   типизирован `product_id: UUID` (`backend/app/modules/products/features/get_product_detail/action.py:30`), схема — `UUIDMixin`
   (`backend/app/modules/products/shared/models.py:96`); мок сеет `id: 'prod-001'` … `'prod-114'`
   (`services/mocks/products.ts:31`). Все чужие ссылки на товар — строки того же вида: 72
   различных id в складских сидах (раздел `DELETE /api/products/:id`). Общее правило
   непрозрачности `id` — §19 соглашений.
3. **Новый id мок выдаёт по длине массива, и после удаления он столкнётся с существующим.**
   `id: \`prod-${String(STORE.length + 1).padStart(3, '0')}\`` (`services/mocks/products.ts:14077`)
   при 114 засеянных даёт `prod-115`; после `STORE.splice(idx, 1)` (`:14226`) длина 113, и следующее
   создание выдаст `prod-114` — уже занятый id. Свойство мока, но правило контракта прямое: **`id`
   выдаёт сервер** (§19 соглашений).
4. **`GET /api/products/:id` в моке отдаёт запись хранилища по ссылке, а не копию** — БАГ-05;
   следствие видно сразу: карточка правит журнал прямо в хранилище
   (`views/admin/products/ProductCardPage.vue:70`). Для сервера разницы нет (§18 соглашений).
5. **Проверка «товар используется» в моке — три захардкоженных id, а на схеме это пять разных
   политик удаления.** Таблица в разделе `DELETE /api/products/:id`. Удаление товара — операция,
   задевающая три чужих модуля, и кода ошибки у неё один.
6. **Поиск идёт по `sku` и по всем трём языкам имени сразу; описание в поиск не входит**
   (`services/mocks/products.ts:13948-13956`).
7. **Без явного `sortBy` порядок выдачи — порядок хранилища, а не сортировка по имени.** Весь блок
   сортировки под `if (params.sortBy)` (`services/mocks/products.ts:13965-13974`), а клиент кладёт
   `sortBy` в query только когда он задан (`services/productsService.ts:17-20`), то есть до первого
   клика по колонке (`composables/useProducts.ts:81-88`) сортировки нет. `sortBy: 'category'`
   сортирует по `categoryName.en` — по **копии** имени внутри товара
   (`services/mocks/products.ts:13969-13970`). Что умолчание
   обязано быть названо по каждому списку — §13 соглашений.
8. **Товар без категории не попадает ни в одну выборку по категориям.** Фильтр —
   `params.categoryIds.includes(p.categoryId ?? '')` (`services/mocks/products.ts:13961`). При этом
   категория необязательна и на схеме (`products.category_id` — `nullable=True`,
   `backend/app/modules/products/shared/models.py:108-113`), и у сервера
   (`backend/app/modules/products/features/create_product/schemas.py:12`).
9. **Значения кастомных полей везут с собой копию определения, и сервер обязан её игнорировать.**
   Раздел `PATCH /api/products/:id`, абзац о `fieldValues`; общий механизм — §8 соглашений.
10. **Дату создания выбирает сервер, и формат сегодня расходится.** Мок пишет
    `new Date().toISOString().slice(0, 10)` (`services/mocks/products.ts:14095`), сиды — те же десять
    символов (`:55`), тип объявляет `createdAt: string` (`types/product.ts:105`); сервер отдаёт полный
    `datetime` и вдобавок `updated_at`, которого во фронте нет
    (`backend/app/modules/products/features/get_product_detail/schemas.py:53-54`). Владелец времени — §14 соглашений.
11. **Связь товара с поставщиком хранится снимком из трёх величин, и все три стареют молча.**
    `LinkedSupplier` = `{id, name, price, priceUomId, leadDays, currency}` (`types/product.ts:18-35`);
    при добавлении `name` копируется из карточки поставщика
    (`views/admin/products/ProductCardPage.vue:205`), `currency` — оттуда же (`:211`), `priceUomId` —
    из единицы продажи **самого товара** на этот момент (`:209`). После переименования поставщика,
    смены его валюты или смены единицы продажи товара ни одно из трёх не обновляется. `priceUomId`
    при этом в таблице карточки не показывается вовсе — колонок четыре: имя, цена, срок, валюта
    (`:637-641`, строки `:650-654`), то есть за что взята цена, из UI не узнать. **Таблицы под эту
    связь на бэкенде нет ни одной** — строка владельцу.
12. **Один поставщик привязывается к товару не более одного раза, и это проверяет только клиент.**
    `addLinkedSupplier` выходит, если id уже в списке (`composables/useProductCard.ts:122`), селект
    прячет уже привязанных (`views/admin/products/ProductCardPage.vue:757-758`). На проводе уходит
    полный массив (`services/productsService.ts:105-110`), серверной проверки нет — значит правило
    обязан держать сервер.
13. **Справочники категорий и поставщиков карточка берёт явным большим `pageSize`, а не отдельным
    эндпоинтом.** `getCategories({ search: '' }, 1, 999)` (`composables/useProductCard.ts:132`) и
    `getSuppliers({…}, { page: 1, pageSize: 999 })` (`:141-144`). Для товаров отдельный эндпоинт
    есть, и всё равно используются оба способа — БАГ-03.
14. **Справочник имён товаров кэшируется на сессию и не инвалидируется ничем** — раздел
    `GET /api/products/list`.
15. **`weightPerWarehouseUnitKg` — величина, которой нет на бэкенде и нет в объявленной форме
    `PATCH`, но которая ездит и на которой держится вывод веса.** Поле объявлено
    (`types/product.ts:103`), редактируется (`views/admin/products/ProductCardPage.vue:507-515`),
    читается доменом резки (`domain/cutting.ts:308`), принимается моком
    (`services/mocks/products.ts:14136`) — и отсутствует и в `Pick<>` клиента
    (`services/productsService.ts:63-83`), и во всём бэкенде
    (`grep -rn "weight_per_warehouse" backend/` — пусто). При создании задать его нельзя вовсе:
    подпись `createProduct` его не принимает (`services/productsService.ts:28-46`) — БАГ-09.
16. **Коэффициенты пересчёта материализуются в товар из справочника настроек при первом же
    открытии карточки.** `findConversionFactor` ищет статическое правило
    (`composables/useProductCard.ts:155-165`), результат кладётся в форму при загрузке
    (`:182-186`, `:200`, `:202`) и при смене любой из единиц (`:270-303`) — и при следующем Save
    уезжает в товар как его собственное значение. Формула при этом обнуляется намеренно: статическое
    правило означает «формулы нет». Сервер такой подстановки не делает
    (`backend/app/modules/products/features/create_product/domain.py:38-41` каскадирует только единицы).
17. **Перечень формул пересчёта закрыт во фронте и открыт на схеме** — графа 1 обязанностей; тот же
    класс, что перечень типов поля (§8 соглашений).
18. **Порядок разбора путей — часть контракта: `/api/products/list` разбирается раньше
    `/api/products/:id`.** Раздел `GET /api/products/list`; общее правило и живой дефект — §18
    соглашений.

---

## Чего в домене нет

Ничего не вычеркнуто молча: строка на каждое описание, снятое из прежнего
[`03-api-contract.md`](../03-api-contract.md) (домен занимал `03-api-contract.md:992-1125`), с доказательством
отсутствия.

| было описано | чем доказано отсутствие |
|---|---|
| `GET /api/products`: «Сортировка по `name ASC` (дефолт)», `sortBy` по умолчанию `"name"` (`03-api-contract.md:1006`, `03-api-contract.md:1023`) | мок без `sortBy` не сортирует вовсе — весь блок под `if (params.sortBy)` (`services/mocks/products.ts:13965-13974`), а клиент не шлёт параметр, пока пользователь не кликнул по колонке (`services/productsService.ts:17-20`, `composables/useProducts.ts:81-88`). Правило домена 7 |
| «`categoryIds: null` = без категории» (`03-api-contract.md:1023`) | товар с `categoryId: null` не попадёт ни в одну выборку: фильтр сравнивает `p.categoryId ?? ''` (`services/mocks/products.ts:13961`), а пустая строка в списке id не встречается. Правило домена 8 |
| «фильтр по `name` (LIKE)» (`03-api-contract.md:1002`) | поиск идёт ещё и по `sku`, и по всем трём локалям сразу (`services/mocks/products.ts:13948-13956`) |
| `name`, `categoryName`, `description`, `fieldName`, `options` строками (`03-api-contract.md:1016`, `03-api-contract.md:1063`, `03-api-contract.md:1069-1070`) | все пять — `TranslatedString` (`types/product.ts:39-41`, `:58`, `:62`, `:11`, `:15`); сборка списка — `services/mocks/products.ts:13925`, `:13927`. Механика — §12 соглашений |
| пример ответа списка без `avgCostPrice`, `avgSalePrice`, `saleUomId`, `warehouseUomId`, `warehouseToSaleFactor` (`03-api-contract.md:1013-1017`) | пять полей есть в типе (`types/product.ts:45-53`) и в сборке (`services/mocks/products.ts:13922-13940`); две первых — производные (графа 9) |
| `POST /api/products`: тело из шести полей (`03-api-contract.md:1030-1037`) | у сервера пятнадцать (`backend/app/modules/products/features/create_product/schemas.py:8-31`), у клиента те же пятнадцать в camelCase (`services/productsService.ts:29-46`); нет ни `priceQuantity`, ни `currencyId`, ни трёх UoM, ни четырёх полей пересчёта |
| «Response 200: `ApiResponse<Product>` — созданный товар целиком (с `fieldValues: []`, `linkedSuppliers: []`)» (`03-api-contract.md:1039`) | сервер отдаёт четыре поля — `{id, name, sku, message}` — и статус **201** (`backend/app/modules/products/features/create_product/schemas.py:34-40`, `backend/app/modules/products/features/create_product/action.py:23`) |
| «Клиент после успеха перезапрашивает список (`load()`)» (`03-api-contract.md:1040`) | не перезапрашивает: модал закрывается и происходит переход в карточку созданного товара (`views/admin/products/ProductsPage.vue:214-216`) |
| «409 `PRODUCT_IN_USE` если товар используется в активных заказах» (`03-api-contract.md:1046`) | код есть, но с заказами не связан ничем: правило мока — множество трёх id (`services/mocks/products.ts:14224`), заказы этот файл не импортирует (`:1-18`). Статус 409 не подтверждён ничем: мок бросает голый `Error` без статуса (`services/mocks/index.ts:1507`), а `ApiRequestError.status` заполняется только из настоящего HTTP-ответа (`types/api.ts:26-27`, `services/api.ts:117-124`) |
| `DELETE /api/products/:id` без `PRODUCT_NOT_FOUND` (`03-api-contract.md:1042-1046` — только `PRODUCT_IN_USE`) | второй код мок бросает (`services/mocks/products.ts:14222`), и до человека он не доходит (`composables/useProducts.ts:51-55`) — БАГ-01 |
| `GET /api/products/:id`: «404 `PRODUCT_NOT_FOUND`» (`03-api-contract.md:1077`) | такого кода на этом пути нет ни у сервера, ни у мока: сервер отдаёт `NOT_FOUND` (`backend/app/modules/products/features/get_product_detail/domain.py:53`), мок — текст `Product ${id} not found` (`services/mocks/products.ts:13987`). `grep -rn "PRODUCT_NOT_FOUND" frontend_vue/src backend/app` даёт только ветку удаления — БАГ-06 |
| пример `linkedSuppliers` без поля `currency` (`03-api-contract.md:1072`) | поле есть в типе и заполняется снимком валюты поставщика (`types/product.ts:34`, запись — `views/admin/products/ProductCardPage.vue:211`) |
| ответ карточки без одиннадцати поздних полей — `priceQuantity`, `currencyId`, `avgCostPrice`, `avgSalePrice`, три `*UomId`, четыре поля пересчёта, `weightPerWarehouseUnitKg` (`03-api-contract.md:1057-1076`) | все объявлены (`types/product.ts:64-103`); формы сервера и фронта при этом сегодня несовместимы — раздел `GET /api/products/:id`, шесть расхождений |
| `PATCH /api/products/:id`: дельта из семи ключей (`03-api-contract.md:1085-1091`) | объявленных шестнадцать (`services/productsService.ts:63-83`) плюс семнадцатый неявный — `weightPerWarehouseUnitKg` (БАГ-09) |
| «Last-write-wins» у `PATCH` (`03-api-contract.md:1095`) | ничем в коде не выражено: ни `If-Match`, ни `updatedAt` в `Product` нет (`types/product.ts:56-109`). Это не наблюдение, а следствие отсутствия механизма — §11 соглашений |
| «Клиент пересчитывает `fieldValues` из `Record<fieldId,value>` обратно в массив перед отправкой» (`03-api-contract.md:1095`) | **подтверждено** и оставлено: `composables/useProductCard.ts:243-249`. Не описано было главное — что массив несёт копию определения и сервер обязан её игнорировать (раздел `PATCH`) |
| «`linkedSuppliers` — администратор вручную добавляет/удаляет поставщиков из карточки товара; **BCC requests к этому списку не относятся**» (`03-api-contract.md:1095`) | **подтверждено кодом и остаётся в силе**: `linkedSuppliers` живёт только в товаре — 118 вхождений в `mocks/products.ts` и ни одного в `mocks/bcc.ts` (`grep -c linkedSuppliers frontend_vue/src/services/mocks/bcc.ts` → `0`). Заявка BCC связывает поставщика с товаром своей колонкой `bcc_events.product_id` (`backend/app/modules/bcc/shared/models.py:63-67`), а не списком поставщиков товара: два разных отношения, и сервер обязан держать их раздельно — правка одного не трогает другое |
| раздел «Save UX — Products» (`03-api-contract.md:1099-1108`) целиком | не удалён, а разнесён: строка `Save-режим` стоит у каждого раздела эндпоинта, общая модель clean-slate против quick-action — §15 соглашений. Описание при этом было неполным: `linkedSuppliers` как третий независимый признак грязи в нём не назван (`composables/useProductCard.ts:101-107`) |
| таблица «Feature Flags — Products» (`03-api-contract.md:1110-1116`) с флагом `adminServices` | флаг `adminServices` закрывает чужой домен (`router/index.ts:244`, `:250`); товарных флагов два — `adminProducts` и `productSupplierLinks` (`router/index.ts:220`, `:226`, `views/admin/products/ProductCardPage.vue:35`), и оба объявлены `true` (`config/featureFlags.ts:20`, `:38`). Флаг — тариф, а не право: §7 соглашений |
| общие правила: конверт ответа, коды ядра, пагинация, `TranslatedString`, форма `id`, идемпотентность | перенесены в [`00-conventions.md`](00-conventions.md) (§1, §2, §13, §12, §19, §11) — правило двух и более доменов в доменном файле не дублируется |

Двух эндпоинтов домена в прежнем тексте не было **вовсе**, и это не удаление, а добавление:
`GET /api/products/list` (`sed -n '992,1125p' roo_code/roo-context/03-api-contract.md | grep -c "products/list"` → 0)
и `DELETE /api/products/:id/audit/:id` (`… | grep -c audit` → 0).

---

## Пробелы аудита — состояние

Каждый пробел из [аудита](../../plans/api/audit/products.md) закрыт выше или помечен «осталось».
«Осталось» здесь значит одно: ответа нет ни в коде фронта, ни на сервере, и назначать его контракт
не вправе — строка стоит в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
`products`.

| пробел аудита | где закрыт |
|---|---|
| старый текст описывал `PRODUCT_IN_USE` со статусом 409 и без `PRODUCT_NOT_FOUND` | «Каталог кодов ошибок домена»; «Чего в домене нет», две строки про удаление |
| `DELETE /api/products/:id/audit/:id` не описан вовсе, включая «удаляется из двух мест» | раздел `DELETE /api/products/:id/audit/:id`, абзац о двух местах вызова |
| `GET /api/products` — четыре неверных утверждения и пять неописанных полей | раздел `GET /api/products`; «Чего в домене нет», пять строк |
| `GET /api/products/:id` — строки вместо `TranslatedString`, отсутствие `currency`, одиннадцать поздних полей | раздел `GET /api/products/:id`; «Чего в домене нет», три строки |
| `GET /api/products/list` — ответ без пагинации и синглтон без инвалидации | раздел `GET /api/products/list`, три свойства |
| `GET /api/products/list` — путь обязан разбираться раньше `/:id` | там же, первое свойство; правило домена 18 |
| `PATCH /api/products/:id` — семь ключей из семнадцати, `fieldValues` полным массивом со справочными полями | раздел `PATCH /api/products/:id`; правило домена 9 |
| `POST /api/products` — шесть полей из пятнадцати, форма ответа, «перезапрашивает список» | раздел `POST /api/products`; «Чего в домене нет», три строки |
| два правила подстановки сервера (валюта арендатора, каскад единиц) не описаны | раздел `POST /api/products`; графа 1 обязанностей |
| правила домена 1–18 аудита | раздел «Правила домена», пункты 1–18 один к одному |
| девять граф «Обязанностей сервера» | раздел «Обязанности сервера», графы 1–9 |
| **осталось** · как закрывается расхождение регистра между сервером и фронтом — алиасами на бэкенде или слоем преобразования на клиенте | врезка «Регистр полей»; решение владельца (БАГ-07, БАГ-11) |
| **осталось** · рождают ли создание, правка и удаление товара уведомление, и обязана ли правка `minStock` пересчитывать дефицит | графа 2; решение владельца |
| **осталось** · кто и когда пишет запись в журнал товара, кто её автор и что помечается чувствительным | графа 3; решение владельца |
| **решено 2026-09-07 (П2, П7, П8)** · права на чтение, создание, правку и удаление товара — обычные элементы CRUD-матрицы по надобности роли; удаление записи его журнала — **только владелец** | графа 7; [§6.2](00-conventions.md), [§6.6](00-conventions.md) |
| **решено 2026-09-07 частично** · перечнем формул владеет **код**, одним источником вместо трёх копий (П26); сервер обязан его валидировать — сегодня обе колонки свободные `String(30)` без `CHECK` (`products/shared/models.py:165-177`), а схема входа принимает `str | None` без проверки. Валютой владеют настройки (П19). **Осталось:** форма валюты на проводе — id, код или и то и другое; это вопрос формы, не умолчания | графа 1; [§14](00-conventions.md) |
| **осталось** · кто валидирует значение кастомного поля по типу и обязательности и что делать со значением удалённого определения | графа 4; решение владельца |
| **осталось** · что сервер обязан сделать с семью чужими ссылками на товар при удалении и каким кодом отвечать | раздел `DELETE /api/products/:id`, таблица политик; графа 8; решение владельца |
| **осталось** · кто считает `avgCostPrice` и `avgSalePrice` на сервере, если данные лежат в двух других модулях | графа 9, пункты 1–2; решение владельца |
| **осталось** · остаётся ли в ответе легаси-подпись `price_unit` и на каком языке собирается код единицы | графа 9, пункт 3; решение владельца |
| **осталось** · чем сервер хранит `linkedSuppliers` товара — таблицы связи «товар ↔ поставщик» нет ни одной | правило домена 11; решение владельца |
| **осталось** · остаётся ли `GET /api/products/list` отдельным лёгким эндпоинтом и обязан ли он инвалидироваться при изменении каталога | раздел `GET /api/products/list`; решение владельца (БАГ-03) |

Находки про код домена —
[`contract-sync-products-bugs.md`](../../plans/bugs/contract-sync-products-bugs.md),
БАГ-01…БАГ-15. Код этой работой не тронут.
