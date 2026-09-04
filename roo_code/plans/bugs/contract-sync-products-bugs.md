# Bugs — contract-sync / домен products

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К5. Аудит: [`roo_code/plans/api/audit/products.md`](../api/audit/products.md).
Область: `frontend_vue/src/services/productsService.ts`,
`frontend_vue/src/services/mocks/products.ts`, ветки products в
`frontend_vue/src/services/mocks/index.ts`, `frontend_vue/src/composables/useProducts.ts`,
`frontend_vue/src/composables/useProductCard.ts`,
`frontend_vue/src/composables/useProductNames.ts`,
`frontend_vue/src/views/admin/products/ProductsPage.vue`,
`frontend_vue/src/views/admin/products/ProductCardPage.vue`,
`backend/app/modules/products/`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

**У домена есть модуль бэкенда**, поэтому по двум реализованным эндпоинтам источник истины —
сервер, и расхождение фронта с ним — находка про фронт (БАГ-07, БАГ-08, БАГ-11).

---

## БАГ-01 — код ошибки удаления товара читается из `message`, а настоящий API кладёт его в `code`

**File:** `frontend_vue/src/composables/useProducts.ts:51-52`, `frontend_vue/src/services/mocks/index.ts:1507`
**Severity:** High — против настоящего бэкенда единственное осмысленное сообщение об ошибке удаления пропадёт.
**Источник:** К3 (каждый код доходит до человекочитаемого сообщения)

### Problem

`deleteProduct` сравнивает с кодом **текст исключения**:

```ts
const code = e instanceof Error ? e.message : ''
if (code === 'PRODUCT_IN_USE') { … } else { … }
```

Под моками это работает случайно: `mocks/index.ts:1507` бросает
`new Error(result.code ?? 'PRODUCT_NOT_FOUND')`, то есть кладёт код именно в `message`.
Настоящий клиент так не делает — `unwrap()` собирает `ApiRequestError`, у которого `message` это
человеческий текст сервера, а машинный код лежит в отдельном поле `code`
(`frontend_vue/src/types/api.ts:28-31`, заполнение — `frontend_vue/src/services/api.ts:53-62`,
`:117-124`). При живом бэкенде ветка не сработает никогда, и на попытку удалить товар из
активного заказа пользователь получит общий `products.toast_error_delete` вместо «Товар
используется в активных заказах» (`frontend_vue/src/i18n/admin/products.ts:63`).

Ровно тот же дефект уже записан у соседа — БАГ-01 в
[`contract-sync-categories-bugs.md`](contract-sync-categories-bugs.md). Это не дубль: место
другое, и починка одного второе не закрывает.

### Fix

Читать `code` у `ApiRequestError` (с откатом на `message`, пока мок бросает голый `Error`),
либо привести мок к общему виду — бросать `ApiRequestError` с заполненными `status` и `code`.
Второе лучше: оно чинит класс, а не один вызов.

### Future rule

Мок, бросающий `new Error(code)`, делает разбор ошибок непроверяемым: тест на моках зелёный,
продакшен красный.

---

## БАГ-02 — удаление записи аудита товара уходит без `Authorization`, хотя лента его подписывает

**File:** `frontend_vue/src/services/productsService.ts:124-126`, `frontend_vue/src/services/auditFeedService.ts:20-24,41,57-60`
**Severity:** Medium — при появлении аутентификации удаление из ленты начнёт получать 401 там, где чтение работает.
**Источник:** К4 (заголовки запроса)

### Problem

`deleteProductAuditEntry` зовёт `apiDelete` без `options`, то есть без заголовков:

```ts
await apiDelete<void>(`/api/products/${productId}/audit/${entryId}`)
```

При этом лента аудита, которая роутит удаление именно сюда по `entityType`
(`frontend_vue/src/services/auditFeedService.ts:57-60`), свои собственные чтения подписывает токеном:
`authHeaders()` собирает `Authorization: Bearer …` из `localStorage`
(`frontend_vue/src/services/auditFeedService.ts:20-24`) и передаёт его в `getAuditFeed` (`:41`) и `getAuditFeedUsers`
(`:46`). Получается, что один экран читает как аутентифицированный, а удаляет как аноним.

Под моками это невидимо: `deleteMock` заголовки принимает и игнорирует
(`frontend_vue/src/services/api.ts:212-214`).

### Fix

Либо снабдить заголовком все вызовы, что меняют данные аудита, либо вынести сборку заголовка
в один слой (`api.ts`), чтобы «подписан/не подписан» перестало быть решением каждого вызова.

### Future rule

Заголовок аутентификации, который назначается в сервисе по одному вызову, всегда где-то
забудут. Проверять надо не «есть ли токен у чтения», а «одинаково ли подписаны чтение и запись
одного экрана».

---

## БАГ-03 — один справочник товаров запрашивается тремя разными способами

**File:** `frontend_vue/src/composables/useProductNames.ts:27`, `frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue:415-418`, `frontend_vue/src/composables/useWarehouseBatchCreate.ts:282-285`, `frontend_vue/src/composables/useWarehouseOffcutCreate.ts:167-170`
**Severity:** Medium — три ответа на один вопрос расходятся при первом же изменении каталога.
**Источник:** К2 (мок ↔ код), К5 (источник истины)

### Problem

Для «дай список товаров, чтобы выбрать один» в коде живут три механизма:

1. `GET /api/products/list` — лёгкий, `{id, name}`, без пагинации
   (`frontend_vue/src/services/productsService.ts:114-118`), кэшируется на сессию
   (`frontend_vue/src/composables/useProductNames.ts:12-13`);
2. `GET /api/products` с `pageSize: 1000` — три вызова, каждый со своей копией параметров
   (`frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue:415-418`, `frontend_vue/src/composables/useWarehouseBatchCreate.ts:282-285`,
   `frontend_vue/src/composables/useWarehouseOffcutCreate.ts:167-170`);
3. постраничный список экрана товаров (`frontend_vue/src/composables/useProducts.ts:31-34`).

Второй и третий возвращают `ProductListItem` с одиннадцатью полями
(`frontend_vue/src/types/product.ts:37-54`), первый — два. Никакой из них не инвалидируется
после создания или переименования товара.

Тот же класс, что находка 3 у соседа (см.
[`contract-sync-categories-bugs.md`](contract-sync-categories-bugs.md), БАГ-03): справочник
категорий там берётся двумя способами. Здесь способов три.

### Fix

Оставить один способ и назвать его в контракте. `pageSize: 1000` — не справочник, а «надеемся,
что товаров меньше тысячи».

### Future rule

Если у вопроса «дай справочник» больше одного ответа в коде, разойдутся все ответы, кроме
одного, и никто не узнает какой.

---

## БАГ-04 — сервер отдаёт имя кастомного поля заглушкой вместо имени

**File:** `backend/app/modules/products/features/get_product_detail/domain.py:67-74`
**Severity:** High — единственный реализованный ответ по товару содержит заведомо неверные данные.
**Источник:** К4 (формы ответа), К5 (бэкенд — источник истины)

### Problem

```python
field_values = [
    ProductFieldValueResponse(
        field_id=fv.field_id,
        field_name=str(fv.field_id),  # placeholder — resolve field name
        value=fv.value,
    )
    for fv in product.field_values
]
```

`field_name` — это UUID поля, записанный строкой. Комментарий признаёт заглушку, но эндпоинт
отдаётся наружу как готовый (`backend/app/modules/products/features/get_product_detail/action.py:28`), и в его схеме `field_name`
объявлен обязательным `str` (`backend/app/modules/products/features/get_product_detail/schemas.py:9-14`) — то есть потребитель не
отличит заглушку от имени. Данные для настоящего имени рядом: `CategoryField.name`
(`backend/app/modules/products/shared/models.py:76`), связь — `product_field_values.field_id`
→ `category_fields.id` (`:203-206`).

### Fix

Резолвить имя из `category_fields`, а до тех пор не отдавать поле вовсе (`str | None = None`) —
отсутствующее имя честнее подставного.

### Future rule

Заглушка, которую видно только в комментарии, доезжает до продакшена. Если поле не готово, его
не должно быть в схеме ответа.

---

## БАГ-05 — `mockGetProduct` отдаёт запись стора по ссылке, и карточка правит стор напрямую

**File:** `frontend_vue/src/services/mocks/products.ts:13985-13989`, `frontend_vue/src/views/admin/products/ProductCardPage.vue:70`
**Severity:** High — мок перестаёт быть сервером: клиент меняет «серверные» данные, не отправив запроса.
**Источник:** К2 (мок ↔ контракт ↔ код)

### Problem

```ts
export async function mockGetProduct(id: string): Promise<Product> {
  const found = STORE.find((p) => p.id === id)
  if (!found) throw new Error(`Product ${id} not found`)
  return found
}
```

Возвращается сам элемент `STORE`, без копии — в отличие от мока категорий, который отдаёт
глубокую копию. Дальше `useProductCard.load()` кладёт этот объект в `product.value`
(`frontend_vue/src/composables/useProductCard.ts:171-172`), и карточка правит его напрямую:

```ts
product.value.auditLog = product.value.auditLog.filter((entry) => entry.id !== entryId)
```

(`frontend_vue/src/views/admin/products/ProductCardPage.vue:70`). Это запись в «базу» мимо эндпоинта. Пока правка совпадает с тем,
что делает `mockDeleteProductAuditEntry` (`mocks/products.ts:14230-14236`), расхождения не
видно — но именно поэтому никакая проверка его и не поймает.

### Fix

Возвращать копию (`structuredClone` / глубокий разбор JSON), как это делает мок категорий.
Тогда попытка править «сервер» из компонента станет видимой сразу.

### Future rule

Мок, отдающий ссылку на своё хранилище, превращает любую мутацию во фронте в тихую запись в
базу. Ответ мока обязан быть копией.

---

## БАГ-06 — `GET /api/products/:id` под моками не имеет кода ошибки, и текст исключения показывается пользователю

**File:** `frontend_vue/src/services/mocks/products.ts:13987`, `frontend_vue/src/composables/useProductCard.ts:223`
**Severity:** Medium — единственный путь ошибки карточки непереводим и неотличим машинно.
**Источник:** К3 (коды ошибок)

### Problem

Мок бросает **текст**: `throw new Error(\`Product ${id} not found\`)`. Клиент кладёт его прямо
в состояние экрана: `error.value = e instanceof Error ? e.message : 'Failed to load product'`.
Пользователь видит английскую строку из мока при любой локали.

Настоящий сервер этот случай оформляет как надо — `NotFoundError(entity="Product", …)` с кодом
`NOT_FOUND` (`backend/app/modules/products/features/get_product_detail/domain.py:53`,
`backend/app/core/exceptions.py:13-20`), отдаёт 404 с телом `{"detail": {"message", "code"}}`
(`backend/app/modules/products/features/get_product_detail/action.py:42-46`). То есть мок **слабее** сервера, и путь ошибки под
моками воспроизводится не тот, что будет в проде.

Старый контракт при этом обещает здесь код `PRODUCT_NOT_FOUND`
(`roo_code/roo-context/03-api-contract.md:1077`), которого на этом пути нет ни у мока, ни у
сервера: `grep -rn "PRODUCT_NOT_FOUND" frontend_vue/src backend/app` даёт только ветку
удаления.

### Fix

Мок обязан бросать код, который бросает сервер (`NOT_FOUND`), и клиент обязан переводить его
ключом, а не показывать `e.message`.

### Future rule

Сообщение из мока, доехавшее до экрана, — это перевод, которого не будет.

---

## БАГ-07 — карточка товара против настоящего бэкенда не откроется вовсе

**File:** `frontend_vue/src/composables/useProductCard.ts:220`, `backend/app/modules/products/features/get_product_detail/schemas.py:25-54`
**Severity:** High — единственный реализованный GET домена фронт разобрать не может.
**Источник:** К4 (формы ответа), К5 (бэкенд старше)

### Problem

Сервер отдаёт `ProductDetailResponse` в snake_case и без полей `linkedSuppliers`, `auditLog`,
`avgCostPrice`, `avgSalePrice`, `weightPerWarehouseUnitKg`
(`backend/app/modules/products/features/get_product_detail/schemas.py:25-54`). `useProductCard.load()` на этом ответе делает:

```ts
linkedSuppliers.value = JSON.parse(JSON.stringify(data.linkedSuppliers)) as LinkedSupplier[]
```

`JSON.stringify(undefined)` возвращает `undefined`, `JSON.parse(undefined)` бросает
`SyntaxError`. Исключение ловит общий `catch` (`frontend_vue/src/composables/useProductCard.ts:222-224`), и карточка встаёт в состояние
ошибки — не «часть полей пустая», а «товар не загрузился». До этого места ещё и все camelCase
чтения (`data.categoryId`, `data.priceQuantity`, три `data.*UomId`, `data.fieldValues`)
вернули бы `undefined`.

### Fix

Решение уровня контракта (см. БАГ-11): либо сервер получает camelCase-алиасы, как это уже
сделано в `settings` (`backend/app/modules/settings/features/crud/schemas.py:145,157,169`),
либо фронт получает слой преобразования регистра. Отдельно от этого `JSON.parse(JSON.stringify(x))`
на поле, которого может не быть, — небезопасный способ скопировать массив.

### Future rule

Копирование через `JSON.parse(JSON.stringify(x))` превращает отсутствующее поле в падение
всего загрузчика, а не в пустое значение.

---

## БАГ-08 — `GET /api/products/list` против настоящего бэкенда попадёт в маршрут карточки

**File:** `frontend_vue/src/services/productsService.ts:114-118`, `backend/app/modules/products/features/get_product_detail/action.py:28-30`
**Severity:** Medium — справочник имён товаров, от которого зависят пять экранов склада, на живом сервере вернёт 422.
**Источник:** К1 (инвентарь), К5 (источник истины)

### Problem

У модуля два роута, и `GET` среди них один: `@router.get("/{product_id}")` с
`product_id: UUID`. Путь `/api/products/list` совпадёт с этим шаблоном, `list` не разберётся
как UUID, и FastAPI вернёт 422 с телом pydantic-массива — то есть не «нет такого эндпоинта», а
«неверный товар». `ensureProductNames` такую ошибку глотает и снимает обещание
(`frontend_vue/src/composables/useProductNames.ts:31-33`), после чего пять экранов склада
показывают прочерки вместо имён (`grep -rl "useProductNames" frontend_vue/src/views` → 5).

### Fix

Литеральный сегмент обязан быть объявлен на сервере **раньше** параметрического — так же, как
в моке (`frontend_vue/src/services/mocks/index.ts:440` стоит перед `:449`). Это правило
попадает в контракт домена, а не в код одного роутера.

### Future rule

Литеральный путь, соседствующий с параметрическим, — порядок регистрации, а не деталь
реализации. Его надо записывать в контракт.

---

## БАГ-09 — `weightPerWarehouseUnitKg` уезжает в PATCH, не будучи объявленным в форме запроса

**File:** `frontend_vue/src/services/productsService.ts:61-85`, `frontend_vue/src/composables/useProductCard.ts:235`
**Severity:** Medium — поле, на котором держится вывод веса, не описано ни клиентом, ни бэкендом.
**Источник:** К4 (формы запроса)

### Problem

Подпись `patchProduct` перечисляет шестнадцать ключей через `Partial<Pick<Product, …>>`
(`frontend_vue/src/services/productsService.ts:63-83`) — и `weightPerWarehouseUnitKg` среди них нет:
`grep -c weightPerWarehouseUnitKg frontend_vue/src/services/productsService.ts` → 0. При этом
поле есть в форме карточки (`frontend_vue/src/composables/useProductCard.ts:33`, `:65`), попадает в дельту через
`Object.assign(delta, dirty.diff())` (`:235`) — `Object.assign` лишние ключи не отсекает — и
читается моком (`frontend_vue/src/services/mocks/products.ts:14136`, `:14201-14204`).

То есть значение ездит, но в объявленной форме запроса его нет; на бэкенде его нет вовсе
(`grep -rn "weight_per_warehouse" backend/` — пусто), при том что от него зависит расчёт веса
при резке (`frontend_vue/src/domain/cutting.ts:308`).

### Fix

Добавить ключ в `Pick<>` клиента и в задание бэкенду. Пока он не объявлен, любой, кто напишет
серверную часть по подписи клиента, его потеряет.

### Future rule

`Object.assign` в типизированную дельту — дыра в типах: лишний ключ уезжает молча. Дельта
должна собираться явным перечислением или проверяться на выходе.

---

## БАГ-10 — `mockPatchProduct` возвращает `null` вместо ошибки для несуществующего товара

**File:** `frontend_vue/src/services/mocks/products.ts:14143-14145`
**Severity:** Medium — PATCH по удалённому товару выглядит успешным.
**Источник:** К2 (мок ↔ контракт)

### Problem

```ts
): Promise<Product | null> {
  const idx = STORE.findIndex((p) => p.id === id)
  if (idx === -1) return null
```

Ветка мока результат не проверяет (`frontend_vue/src/services/mocks/index.ts:1210-1218`), и
`null` доезжает до клиента как успешный ответ. `useProductCard.save()` показывает тост
«Изменения сохранены» (`frontend_vue/src/composables/useProductCard.ts:257`) и зовёт `load()`
(`:258`), который упадёт уже по другой причине.

Тот же класс, что БАГ-05 у соседа (см.
[`contract-sync-categories-bugs.md`](contract-sync-categories-bugs.md)): там `undefined`, здесь
`null`.

### Fix

Бросать `PRODUCT_NOT_FOUND` — код у домена уже есть
(`frontend_vue/src/services/mocks/products.ts:14222`).

### Future rule

Мок, возвращающий пустоту вместо исключения, учит фронт не проверять ответ.

---

## БАГ-11 — `createProduct` шлёт объект и camelCase там, где сервер ждёт строку и snake_case

**File:** `frontend_vue/src/services/productsService.ts:49-58`, `backend/app/modules/products/features/create_product/schemas.py:8-31`
**Severity:** High — единственный реализованный POST домена с фронта не работает, и половина полей теряется молча.
**Источник:** К4 (формы запроса), К5 (бэкенд старше)

### Problem

Клиент отправляет:

```ts
const payload = { ...data, name: toTranslatedString(data.name, locale), description: … }
```

то есть `name` — объект `{ru, en, lt}` (`frontend_vue/src/types/i18n.ts:19-24`), а остальные
ключи — camelCase (`categoryId`, `priceQuantity`, `currencyId`, три `*UomId`).

Сервер объявляет `name: str` и все прочие поля в snake_case без единого алиаса
(`backend/app/modules/products/features/create_product/schemas.py:8-31`). Следствия два, и второе тише первого:

1. `name` объектом не пройдёт `str` → 422 pydantic;
2. все camelCase-ключи будут **отброшены как extra** (модель без `extra="forbid"`), то есть
   даже если бы имя прошло, товар создался бы без категории, цены, валюты и всех трёх единиц.

Как это решается в проекте, показано рядом: модуль `settings` объявляет
`Field(alias="formulaType")` и его соседей
(`backend/app/modules/settings/features/crud/schemas.py:145`, `:157`, `:169`).

### Fix

Решение уровня домена: алиасы на бэкенде либо слой преобразования на фронте. Плюс
`extra="forbid"` в схемах входа — тогда потерянный ключ станет ошибкой, а не тишиной.

### Future rule

Схема входа без `extra="forbid"` превращает опечатку и расхождение регистра в молчаливую
потерю данных.

---

## БАГ-12 — `handleCreate` не имеет `catch`: ошибка создания товара не показывается никак

**File:** `frontend_vue/src/views/admin/products/ProductsPage.vue:197-219`
**Severity:** High — единственный эндпоинт домена, у которого сервер объявляет код ошибки, во фронте обработчика ошибки не имеет.
**Источник:** К3 (код доходит до человекочитаемого сообщения)

### Problem

```ts
async function handleCreate() {
  if (!newProduct.value.name.trim()) return
  creating.value = true
  try {
    const created = await createProduct({…}, locale.value)
    …
  } finally {
    creating.value = false
  }
}
```

`try/finally` без `catch`: `sed -n '199,218p' … | grep -c catch` → 0 (по файлу целиком `catch`
встречается один раз — в разборе сохранённых фильтров). Непойманное отклонение уходит в
`unhandledrejection`; модал остаётся открытым, тоста нет, пользователь видит, что «кнопка
щёлкнула и ничего».

При этом именно у этого эндпоинта сервер объявляет код: `ValidationError("Product name is
required")` → `VALIDATION_ERROR`, 422
(`backend/app/modules/products/features/create_product/domain.py:30-31`,
`backend/app/modules/products/features/create_product/action.py:43-47`). Соседний экран (создание категории) свою ошибку показывает
(`frontend_vue/src/views/admin/products/CategoriesPage.vue:88`).

### Fix

Добавить `catch` с тостом и, для `VALIDATION_ERROR`, с подсветкой поля — `ApiRequestError`
несёт `fieldErrors` (`frontend_vue/src/types/api.ts:32-33`).

### Future rule

`try/finally` без `catch` вокруг сетевого вызова — это «ошибку решили не показывать», записанное
так, что похоже на опечатку.

---

## БАГ-13 — мок создания не подставляет ни валюту арендатора, ни каскад единиц, которые сервер уже делает

**File:** `frontend_vue/src/services/mocks/products.ts:14085-14089`, `backend/app/modules/products/features/create_product/domain.py:33-41`
**Severity:** Medium — два правила сервера под моками не воспроизводятся, значит и не проверяются.
**Источник:** К2 (мок ↔ бэкенд), К5

### Problem

Сервер при создании товара:

```python
currency_id = input_data.currency_id
if currency_id is None:
    currency_id = await get_default_currency(db, tenant_id)

sale_uom_id = input_data.sale_uom_id
warehouse_uom_id = input_data.warehouse_uom_id or sale_uom_id
purchase_uom_id = input_data.purchase_uom_id or warehouse_uom_id
```

Мок пишет то, что пришло, без обеих подстановок:

```ts
currencyId: data.currencyId ?? null,
purchaseUomId: data.purchaseUomId ?? null,
warehouseUomId: data.warehouseUomId ?? null,
saleUomId: data.saleUomId ?? null,
```

Модал создания все четыре поля оставляет необязательными
(`frontend_vue/src/views/admin/products/ProductsPage.vue:118-127`), то есть под моками
регулярно рождается товар без валюты и без единиц, а против сервера тот же товар получил бы
валюту арендатора (`cur-eur` помечен `isDefault: true` —
`frontend_vue/src/services/mocks/settings.ts:70-73`) и три одинаковые единицы.

### Fix

Повторить оба правила в моке. Мок называет себя reference implementation, а реализация,
которая слабее оригинала, скрывает расхождение вместо того, чтобы его показывать.

### Future rule

Правило, которое сервер уже реализовал, а мок нет, не проявится ни в одном тесте фронта —
именно поэтому мок обязан догонять бэкенд, а не наоборот.

---

## БАГ-14 — `get_product_by_id` выбирает товар без фильтра по арендатору

**File:** `backend/app/modules/products/features/get_product_detail/repository.py:13-22`, `backend/app/modules/products/features/get_product_detail/domain.py:47-53`
**Severity:** High — чтение товара чужого арендатора по угаданному id ничем не ограничено.
**Источник:** К6 (мультиарендность)

### Problem

```python
result = await db.execute(
    select(Product)
    .where(Product.id == product_id)
    .options(selectinload(Product.field_values))
)
```

`tenant_id` в запросе нет: `sed -n '17,22p' … | grep -c tenant` → 0, и по файлу целиком тоже 0.
При этом домен `tenant_id` получает (`backend/app/modules/products/features/get_product_detail/domain.py:47-49`) и использует его
только для сборки легаси-подписи `price_unit` (`:77-79`), а не для выборки. Схема
мультиарендность требует: `Product.tenant_id` — `nullable=False, index=True`, FK на `tenants.id`
(`backend/app/modules/products/shared/models.py:101-106`).

Что модуль это умеет — видно на соседних функциях: `count_products_by_currency` и
`count_products_by_uom` фильтруют по арендатору
(`backend/app/modules/products/internal_api/interface.py:49-53`, `:63-70`).

Тот же репозиторий переиспользуется межмодульным интерфейсом
(`backend/app/modules/products/internal_api/interface.py:21-30`), то есть дыра наследуется всеми, кто спросит товар у модуля.

### Fix

Добавить `Product.tenant_id == tenant_id` в `where`, и брать арендатора из контекста
аутентификации, а не из заглушки `00000000-…-0001` (`backend/app/modules/products/features/get_product_detail/action.py:34-35`).

### Future rule

Функция репозитория, принимающая `tenant_id` в вызывающем слое и не использующая его в `where`,
выглядит безопасной ровно до первого второго арендатора. Проверять надо `where`, а не сигнатуру.

---

## БАГ-15 — серверный `NOT_FOUND` является подстрокой двух мок-кодов домена

**File:** `frontend_vue/src/services/mocks/products.ts:14222`, `:14232`, `:14234` против `backend/app/modules/products/features/get_product_detail/domain.py:53`
**Severity:** Low — сегодня не проявляется, потому что в домене нет ни одного сравнения кода подстрокой; ловушка для следующего вызывающего.
**Источник:** К3 (ни один код не подстрока другого)

### Problem

Каталог кодов домена собран из двух источников, и они не согласованы по именам:

| код | откуда |
|---|---|
| `NOT_FOUND` | сервер, `GET /api/products/:id` (`backend/app/modules/products/features/get_product_detail/domain.py:53`, код из `backend/app/core/exceptions.py:13-20`) |
| `PRODUCT_NOT_FOUND` | мок, удаление товара и удаление записи журнала (`frontend_vue/src/services/mocks/products.ts:14222`, `:14232`) |
| `AUDIT_ENTRY_NOT_FOUND` | мок, удаление записи журнала (`frontend_vue/src/services/mocks/products.ts:14234`) |

`NOT_FOUND` — подстрока обоих длинных кодов. Правило проекта требует обратного и сформулировано
в [`00-conventions.md`](../../roo-context/api/00-conventions.md), §2: «Ни один код не является
подстрокой другого», потому что фронт местами сравнивает код **подстрокой** —
`if (message.includes(code)) return key` в переборе словаря
(`frontend_vue/src/services/orderLineEdits.ts:415-421`, словарь `ERROR_KEYS` — `:300-409`).

Почему сегодня не проявляется — две причины, и обе временные:

1. в самом домене сравнение идёт по равенству: `if (code === 'PRODUCT_IN_USE')`
   (`frontend_vue/src/composables/useProducts.ts:51-53`);
2. в словаре заказов голого `NOT_FOUND` нет (`grep -c "\['NOT_FOUND'" frontend_vue/src/services/orderLineEdits.ts`
   → 0), а кодов товаров нет вовсе
   (`grep -c "\['PRODUCT_NOT_FOUND'\|\['AUDIT_ENTRY_NOT_FOUND'\|\['PRODUCT_IN_USE'" …` → 0).

Обе причины исчезают в тот день, когда словарь код→сообщение сделают общим и внесут в него код
ядра `NOT_FOUND`: тогда сообщение `PRODUCT_NOT_FOUND` совпадёт с записью `NOT_FOUND` и человек
увидит чужой текст. Что словарь задуман общим, видно из самого правила соглашений — оно
сформулировано на весь проект, а не на домен заказов.

Обратная сторона в том же словаре уже есть и показывает, насколько тонкая это грань:
`ORDER_AUDIT_ENTRY_NOT_FOUND` (`frontend_vue/src/services/orderLineEdits.ts:354`) и
`CATALOG_PRODUCT_NOT_FOUND` (`:360`) — надстроки кодов
товаров, и именно поэтому сосед назвал свои коды длиннее, а не короче.

Порядок в словаре положения не спасает: он спасает только того, кто помнит про порядок. При
переборе сверху вниз `NOT_FOUND`, стоящий раньше, съест `PRODUCT_NOT_FOUND`; при обратном порядке
— наоборот, и оба варианта верны ровно до следующей вставки в середину.

### Fix

Решает сторона, которая объявляет код. Два пути, и выбор — часть решения владельца о старшинстве
форм в этом домене (`roo_code/plans/api/audit/00-решения-владельца.md`, раздел `products`):

- сервер называет отказ доменным кодом (`PRODUCT_NOT_FOUND`) вместо общего `NOT_FOUND` — тогда
  подстрочного пересечения не остаётся, но каталог ядра перестаёт быть общим;
- либо мок переименовывает свои коды так, чтобы общий `NOT_FOUND` не был их частью, и тогда
  расходится с тем, что уже показывается человеку (`products.toast_error_delete_in_use`,
  `frontend_vue/src/i18n/admin/products.ts:63`).

Код этой задачей не тронут.

### Future rule

Каталог кодов домена, у которого есть модуль бэкенда, собирается из **двух** источников, и правило
«ни один код не подстрока другого» проверяется на объединении, а не внутри каждого источника
отдельно. Внутри мока коды не пересекались, внутри ядра тоже — пересечение возникло ровно на стыке,
и ни одна проверка «по своему файлу» его бы не увидела.
