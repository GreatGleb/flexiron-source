# Bugs — contract-sync / домен warehouse

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К4, К6. Аудит: [`roo_code/plans/api/audit/warehouse.md`](../api/audit/warehouse.md).
Область: `frontend_vue/src/services/warehouseService.ts`,
`frontend_vue/src/services/mocks/warehouse.ts`, ветки warehouse в
`frontend_vue/src/services/mocks/index.ts`, девять композаблов
`frontend_vue/src/composables/useWarehouse*.ts`, экраны
`frontend_vue/src/views/admin/warehouse/`, типы `frontend_vue/src/types/warehouse.ts`,
доменный слой `frontend_vue/src/domain/cutting.ts`, сиды `frontend_vue/src/mocks/warehouse-*.ts`,
схема `backend/app/modules/warehouse/shared/models.py`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

---

## БАГ-01 — клиент склада не шлёт ни одного заголовка на всех 37 путях

**File:** `frontend_vue/src/services/warehouseService.ts:1-374`
**Severity:** High — против настоящего бэкенда ни один из 37 запросов домена не опознается: сервер не узнает ни арендатора, ни пользователя, а шесть таблиц схемы требуют `tenant_id` обязательным.
**Источник:** К6 (мультиарендность), К4 (формы запроса)

### Problem

`grep -c "headers\|options" frontend_vue/src/services/warehouseService.ts` → **0** на 374 строки.
Ни один из 37 вызовов не передаёт третий аргумент `options`, а `options?.headers` — единственный
источник заголовков у `apiGet` (`frontend_vue/src/services/api.ts:157-159`), `apiPost`
(`:171-176`), `apiPatch` (`:203-207`) и `apiDelete` (`:211-217`).

Соседние домены с живым бэкендом шлют `Authorization: Bearer` + `X-CSRF-Token`
(`frontend_vue/src/services/settingsService.ts:18-22`,
`frontend_vue/src/services/auditFeedService.ts:20-24`, заготовка —
`frontend_vue/src/composables/useAuth.ts:101-108`).

Хуже всего это видно на удалении записей аудита: **та же лента**, которая свои чтения подписывает
(`frontend_vue/src/services/auditFeedService.ts:20-24`, `:41`), для удаления зовёт складские функции без подписи
(`frontend_vue/src/services/auditFeedService.ts:66-76` → `frontend_vue/src/services/warehouseService.ts:332`, `:342`, `:352`, `:362`, `:372`).

Схема требует `tenant_id` `nullable=False, index=True` у всех шести таблиц домена
(`backend/app/modules/warehouse/shared/models.py:16-21`, `:96-101`, `:136-141`, `:173-178`,
`:207-212`, `:234-239`).

### Expected

То же, что у `settingsService` и `auditFeedService`: `authHeaders()` на каждом вызове.

### Actual

Заголовков нет ни на одном. `Idempotency-Key` (`frontend_vue/src/services/api.ts:239-245`) и
`If-Match` (ветка мока умеет его читать — `frontend_vue/src/services/mocks/index.ts:1420`,
`:1428`) тоже не используются.

---

## БАГ-02 — строку остатка не заводит никто, и товар с партиями может её не иметь

**File:** `frontend_vue/src/services/mocks/warehouse.ts:215`
**Severity:** High — вкладка «Остатки» и карточка остатка показывают только засеянные товары; партия, созданная для товара без строки, нигде в остатках не появится.
**Источник:** К6 (производные значения), К2

### Problem

`stockStore` наполняется единственный раз — из сида (`:215`), и ни одной записи в него больше не
добавляется: `grep -n "stockStore" frontend_vue/src/services/mocks/warehouse.ts` даёт восемь
строк (`:215`, `:234`, `:490`, `:546`, `:557`, `:1860`, `:1865`, `:1945`) — все чтения. `push`
среди них нет.

`mockCreateBatch` (`:680-791`) строки остатка не создаёт. `mockGetStockItem` для товара без
строки бросает `STOCK_ITEM_NOT_FOUND` (`:547`).

Сегодня это не проявляется только потому, что сиды согласованы: 72 товара с партиями и ровно 72
строки остатка, пересечение полное (сопоставление `productId` в
`frontend_vue/src/mocks/warehouse-batches.ts` и `frontend_vue/src/mocks/warehouse-stock.ts`).
Первая же партия на 73-й товар это ломает.

### Expected

Строка остатка заводится при появлении первой партии товара — либо её вообще нет как записи, и
остаток целиком выводится из партий (что мок уже почти делает: `projectStockRow` пересчитывает
восемь из четырнадцати полей, `:446-476`).

### Actual

Хранилище только читается.

---

## БАГ-03 — двенадцать сортируемых колонок склада не сортируют ничего

**File:** `frontend_vue/src/views/admin/warehouse/WarehousePage.vue:1355`
**Severity:** Medium — пользователь кликает по заголовку, стрелка перерисовывается, порядок строк не меняется.
**Источник:** К2 (мок ↔ код)

### Problem

Страница шлёт ключ сортировки, которого мок не знает.

| вкладка | ключ страницы | ветка мока |
|---|---|---|
| остатки | `name` (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:1355`) | знает `productName` (`frontend_vue/src/services/mocks/warehouse.ts:517`) |
| остатки | `uomId` (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:1524`) | ветки нет (`frontend_vue/src/services/mocks/warehouse.ts:515-523`) |
| партии | `lotCode` (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:1908`) | ветки нет (`frontend_vue/src/services/mocks/warehouse.ts:595-610`) |
| обрезки | `offcutType`, `batchNumber`, `lengthMm`, `weightKg`, `uomId`, `location`, `status` (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:2375`, `:2420`, `:2465`, `:2510`, `:2600`, `:2643`, `:2688`) | знает только `createdAt`, `productName`, `quantity` (`frontend_vue/src/services/mocks/warehouse.ts:859-865`) |
| дефицит | `uomId`, `status` (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:3555`, `:3643`) | ветки нет (`frontend_vue/src/services/mocks/warehouse.ts:1638-1649`) |

Проверка: `sed -n '515,523p' frontend_vue/src/services/mocks/warehouse.ts | grep -c "'uomId'"` → 0;
`sed -n '859,865p' … | grep -c "'status'"` → 0; `sed -n '1638,1649p' … | grep -c "'uomId'"` → 0.

Из девяти сортируемых колонок вкладки обрезков работают **две**.

### Expected

Либо мок умеет каждый ключ, который шлёт страница, либо страница не рисует кнопку сортировки на
колонке, которой сортировки нет.

### Actual

Кнопка есть, ответа нет; движения — единственная вкладка, где все девять ключей покрыты
(`frontend_vue/src/services/mocks/warehouse.ts:1177-1190`).

---

## БАГ-04 — «нет строки остатка» отвечает двумя разными кодами

**File:** `frontend_vue/src/services/mocks/warehouse.ts:1866`
**Severity:** Low — каталог кодов домена содержит два имени для одного условия.
**Источник:** К3 (коды ошибок)

### Problem

`mockGetStockItem` и `mockPatchStockItem` бросают `STOCK_ITEM_NOT_FOUND` (`:547`, `:558`), а
`mockDeleteStockAuditEntry` на том же условии — `STOCK_NOT_FOUND` (`:1866`). У остальных четырёх
сущностей домена код один на все операции (`BATCH_NOT_FOUND`, `OFFCUT_NOT_FOUND`,
`MOVEMENT_NOT_FOUND`, `DEFICIT_NOT_FOUND`).

### Expected

Один код на одно условие.

### Actual

Два. Подстрокой друг друга они при этом не являются, так что подстрочное сравнение фронта
(`frontend_vue/src/services/api.ts:53-63`) не ломается — ломается только каталог.

---

## БАГ-05 — PATCH остатка возвращает запись без проекции, и карточка показывает засеянные числа

**File:** `frontend_vue/src/services/mocks/warehouse.ts:560`
**Severity:** Medium — сразу после Save на экране количество, стоимость и средняя цена из сида, а не посчитанные из партий; следующий переход по странице их «исправит».
**Источник:** К4 (формы ответа)

### Problem

`mockGetStockOverview` и `mockGetStockItem` пропускают строку через `projectStockRow`
(`:490`, `:550`), который пересчитывает восемь полей из партий и резервов (`:446-476`).
`mockPatchStockItem` этого не делает: `Object.assign(item, delta); return { ...item }`
(`:559-560`).

Карточка кладёт ответ прямо в состояние и в форму
(`frontend_vue/src/composables/useWarehouseStockCard.ts:150-157`).

Комментарий в самом моке объясняет, почему карточка и список обязаны идти через одну проекцию
(`frontend_vue/src/services/mocks/warehouse.ts:548-549`) — на PATCH это правило не распространили.

### Expected

`return projectStockRow(item)`.

### Actual

`return { ...item }`.

---

## БАГ-06 — чтение журнала и агрегатов молча отвечает пустым, а парное удаление бросает 404

**File:** `frontend_vue/src/services/mocks/warehouse.ts:1861`
**Severity:** Medium — «сущности нет» и «журнал пуст» неразличимы, и клиент рисует пустую таблицу вместо ошибки.
**Источник:** К3 (коды ошибок)

### Problem

Семь чтений возвращают `[]` для несуществующей сущности:
`mockGetStockAudit` (`:1861`), `mockGetBatchAudit` (`:1878`), `mockGetOffcutAudit` (`:1891`),
`mockGetMovementAudit` (`:1903`, через `getOrCreateMovementAudit` `:1583-1589`),
`mockGetDeficitAudit` (`:1918`), `mockGetBatchAggregates` (`:1417`),
`mockGetBatchActiveSales` (`:1455`).

Парные удаления на том же условии бросают: `STOCK_NOT_FOUND` (`:1866`), `BATCH_NOT_FOUND`
(`:1883`), `OFFCUT_NOT_FOUND` (`:1896`), `DEFICIT_NOT_FOUND` (`:1926`).

У движения асимметрия ещё сильнее: `mockDeleteMovementAuditEntry` не имеет кода «движения нет»
вовсе — неизвестный id даёт пустой журнал, и ошибкой становится `AUDIT_ENTRY_NOT_FOUND`
(`:1906-1913`).

### Expected

Одно правило на все пять журналов и оба агрегата: либо `*_NOT_FOUND` и на чтении, либо
`[]` и на удалении.

### Actual

Читают молча, удаляют с кодом.

---

## БАГ-07 — четыре ветки мока содержат недостижимую проверку `path.endsWith('/audit')`

**File:** `frontend_vue/src/services/mocks/index.ts:647`
**Severity:** Low — мёртвый код, который читается как работающая маршрутизация.
**Источник:** К2 (мок ↔ контракт ↔ код)

### Problem

Четыре ветки карточек проверяют внутри себя, не аудит ли это:

```
frontend_vue/src/services/mocks/index.ts:644  /^\/api\/warehouse\/stock\/([^/]+)$/
:647    if (path.endsWith('/audit')) { … mockGetStockAudit … }
:679  /^\/api\/warehouse\/batches\/([^/]+)$/     → :682
:730  /^\/api\/warehouse\/offcuts\/([^/]+)$/     → :733
:798  /^\/api\/warehouse\/deficit\/([^/]+)$/     → :801
```

`[^/]+` не может содержать `/`, а `$` закрывает строку, поэтому путь, оканчивающийся на
`/audit`, под эти регулярки **не подходит никогда**. Реальные вызовы обслуживают отдельные
ветки — `:653`, `:688`, `:739`, `:807`.

### Expected

Либо ветка аудита проверяется первой (как сделано у движений — `:745` перед `:750`, с
объяснением на `:744`), либо мёртвой проверки нет.

### Actual

Четыре мёртвых `if`.

---

## БАГ-08 — ни один `supplierId` в сидах партий не существует в каталоге поставщиков

**File:** `frontend_vue/src/mocks/warehouse-batches.ts:1`
**Severity:** Medium — ссылка партии на поставщика не резолвится ни у одной из 100 партий; переход из партии в карточку поставщика ведёт в никуда, а фильтр по поставщику на вкладке партий не даёт совпадений.
**Источник:** К2, mock-data-must-be-true

### Problem

В сидах партий 15 различных значений: `sup-001` … `sup-015`. В каталоге поставщиков id другие:
`1`, `2`, `3`, `4`, `5`, `6`, `f1`, `f2`, `sup-au-1`, `sup-au-2`
(`frontend_vue/src/services/mocks/suppliers.ts`).

Пересечение — **ноль из пятнадцати**:

```
node -e "…" # разбор обоих файлов
batch supplierIds: sup-001 … sup-015
supplier ids: 1, 2, 3, 4, 5, 6, f1, f2, sup-au-1, sup-au-2
resolvable: 0 of 15
```

Именно поэтому партия несёт `supplierName` копией (`frontend_vue/src/types/warehouse.ts:80`,
сортировка по ней — `frontend_vue/src/services/mocks/warehouse.ts:606-607`): проверить копию
нечем, потому что настоящей ссылки нет. Тот же класс, что расхождение имён товара, которое
закрыл пункт 4e (`frontend_vue/src/services/mocks/warehouse.ts:117-130`), — только здесь оно не
закрыто.

Рядом то же с заказами: `orderId: 'ord-001'` у партии и у трёх обрезков
(`frontend_vue/src/mocks/warehouse-offcuts.ts`), тогда как мок заказов выдаёт `ORD-001`
(`frontend_vue/src/services/mocks/orders.ts:662`).

### Expected

Ссылка резолвится, или её нет.

### Actual

Ссылка есть и не резолвится; имя живёт копией рядом с ней.

---

## БАГ-09 — `fileIds` принимается и никуда не пишется

**File:** `frontend_vue/src/services/mocks/warehouse.ts:681`
**Severity:** Medium — файл, приложенный при создании партии или обрезка, исчезает; приложенный при правке — превращается в поле `fileIds` на записи и в списке файлов не появляется.
**Источник:** К2, К4

### Problem

Создание партии объявляет параметр и не использует его:

```ts
data: BatchCreatePayload & { fileIds?: string[] },   // :681
…
files: [],                                          // :776
```

Создание обрезка — то же: `OffcutCreatePayload` объявляет `fileIds?`
(`frontend_vue/src/types/warehouse.ts:320-321`), мок ставит `files: []` (`frontend_vue/src/services/mocks/warehouse.ts:937`).

Правка обеих сущностей делает `Object.assign` (`frontend_vue/src/services/mocks/warehouse.ts:804`, `:1107`), то есть массив идентификаторов
ложится в запись **как `fileIds`**, а `files` не меняется. Карточка при этом уверена, что после
Save сервер вернул новый набор: `originalFiles.value = updated.files ? … : []`
(`frontend_vue/src/composables/useWarehouseBatch.ts:297`).

Метаданные для превращения id в файл у мока есть — `uploadedFiles`
(`frontend_vue/src/services/mocks/index.ts:281`, заполнение `:1675`), и домен заказов ими
пользуется (`:1098`, `:1405`).

### Expected

`fileIds` разворачивается в `files` тем же способом, что у заказов.

### Actual

Игнорируется на создании, пишется мусором на правке.

---

## БАГ-10 — три эндпоинта получают ключи, которых нет в их payload

**File:** `frontend_vue/src/composables/useWarehouseBatch.ts:240`
**Severity:** Medium — сервер получит поля, которых контракт не описывает; мок кладёт их прямо в запись, и она обрастает полями формы.
**Источник:** К4 (формы запроса)

### Problem

`useDirtyCheck.diff()` возвращает **любой** изменившийся ключ верхнего уровня формы
(`frontend_vue/src/composables/useDirtyCheck.ts:62-77`), а формы шире payload.

1. **PATCH партии.** Форма — 13 ключей (`frontend_vue/src/composables/useWarehouseBatch.ts:92-128`), `BatchPatchPayload` — 10
   (`frontend_vue/src/types/warehouse.ts:190-204`). Лишние: `uomId`, `marginPercent`,
   `locationRack`, `locationRow`, `locationCell`, `locationNotes`. Дельта уходит как есть
   (`frontend_vue/src/composables/useWarehouseBatch.ts:240`, `:255`), плюс дописанный `location` (`:248`).
   `sed -n '190,204p' frontend_vue/src/types/warehouse.ts | grep -c 'marginPercent'` → 0.
2. **PATCH обрезка.** Форма — 7 ключей (`frontend_vue/src/composables/useWarehouseOffcutCard.ts:99-117`),
   `OffcutPatchPayload` — 5 (`types/warehouse.ts:324-341`). Лишние — те же четыре части адреса
   (`frontend_vue/src/composables/useWarehouseOffcutCard.ts:275`, `:287`).
3. **POST обрезка.** Уходит реактивная форма целиком, вместе с четырьмя частями адреса:
   `createOffcut(form)` при `form: OffcutCreatePayload & { locationRack; … }`
   (`frontend_vue/src/composables/useWarehouseOffcutCreate.ts:32-54`, `:301-311`).

Мок принимает всё: `Object.assign(batch, delta, …)` (`frontend_vue/src/services/mocks/warehouse.ts:804`),
`Object.assign(offcut, data, …)` (`:1107`).

Тот же класс, что БАГ-09 соседа (см. `contract-sync-products-bugs.md`, п. 9 —
`weightPerWarehouseUnitKg`).

### Expected

Дельта фильтруется по объявленному payload перед отправкой.

### Actual

Уезжает всё, что изменилось в форме.

---

## БАГ-11 — удаление партии не трогает ни движения, ни обрезки, ни журнал

**File:** `frontend_vue/src/services/mocks/warehouse.ts:816-821`
**Severity:** High — после удаления партии её движения и обрезки остаются в хранилище с несуществующим `batchId`; вкладка движений покажет строки партии, которой нет, а `writeMovement` для такого обрезка бросит `BATCH_NOT_FOUND`.
**Источник:** К2, К6 (транзакционность)

### Problem

```ts
export async function mockDeleteBatch(id: string): Promise<void> {   // :816
  const batch = batchStore.find((b) => b.id === id)
  if (!batch) throw new Error('BATCH_NOT_FOUND')
  if (batch.orderId) throw new Error('BATCH_LINKED_TO_ORDER')
  batchStore.splice(batchStore.indexOf(batch), 1)                    // :820
}
```

Ни `movementStore`, ни `offcutStore`, ни журнал не трогаются.

Старый контракт обещает каскад прямо: «сервер удаляет все движения и обрезки, привязанные к
партии» и «клиент показывает предупреждение о количестве удаляемых связанных записей»
(`roo_code/roo-context/03-api-contract.md:1404`).

Схема каскад требует четырьмя внешними ключами:
`warehouse_movements.batch_id` — `CASCADE` (`backend/app/modules/warehouse/shared/models.py:102-107`),
`warehouse_offcuts.batch_id` — `CASCADE` (`:142-147`),
`warehouse_offcuts.parent_batch_id` — `SET NULL` (`:153-157`),
`warehouse_deficits.batch_id` — `SET NULL` (`:185-189`),
`stock_audit_entries.batch_id` — `CASCADE` (`:240-245`).

### Expected

Каскад или отказ.

### Actual

Одна запись вырезана, четыре вида ссылок повисли.

---

## БАГ-12 — карточка остатка тянет агрегаты циклом по всем партиям товара

**File:** `frontend_vue/src/composables/useWarehouseStockCard.ts:53`
**Severity:** Medium — открытие карточки остатка делает 1 + 1 + N запросов, где N — число партий товара (запрашивается страница из 100).
**Источник:** К6 (производные значения)

### Problem

```ts
const batchesRes = await getBatches({ search: '', productId, … }, { page: 1, pageSize: 100 })  // :46-49
for (const batch of batchesRes.items) {
  const aggs = await getBatchAggregates(batch.id)      // :55 — по запросу на партию, последовательно
  …
}
```

Складывает результаты клиент (`:56-67`), причём `uomId` берётся у **последней** партии цикла
(`:54`), а не у первой или преобладающей.

Ровно ту же сумму сервер мог бы дать одним ответом: `mockGetBatchAggregates` считает её из того же
`movementStore` (`frontend_vue/src/services/mocks/warehouse.ts:1415-1451`).

### Expected

Один эндпоинт «агрегаты по товару» — или агрегаты в самой строке остатка.

### Actual

N+1 на каждое открытие карточки.

---

## БАГ-13 — возврат, записанный заказами, не уменьшает агрегат продажи и не гасит активную продажу

**File:** `frontend_vue/src/services/mocks/orders.ts:3435`
**Severity:** High — после отмены отгрузки или возврата клиента партия продолжает показывать проданным то, что вернулось; остаток при этом увеличивается, то есть два экрана об одной партии говорят разное.
**Источник:** К2 (кросс-доменное), К6

### Problem

Склад уменьшает агрегат по `referenceType` возвратного движения и **только если это тип
движения**:

```ts
if (m.type === 'return') {
  const reduceType = m.referenceType || ''
  if (reduceType && OUTGOING_MOVEMENT_TYPES.has(reduceType)) byType[reduceType] -= m.quantity
  continue
}
```
(`frontend_vue/src/services/mocks/warehouse.ts:1426-1431`, тот же код в `computeBatchStatus`
`:314-318`; список — `:355-363`: `sale`, `expense`, `write-off`, `production`,
`return-to-supplier`, `storage`, `offcut`.)

Домен заказов пишет туда другое:

```
frontend_vue/src/services/mocks/orders.ts:3344   referenceType: 'order-shipment'
:3435   referenceType: 'order-shipment-cancelled'
:3780   referenceType: 'order-return'
:3792   referenceType: 'order-return-writeoff'
```

Ни одно из четырёх в списке не значится, значит агрегат `sale` не уменьшается никогда.

Второе следствие — активные продажи. `mockGetBatchActiveSales` сопоставляет возвраты продажам по
`referenceId` (`frontend_vue/src/services/mocks/warehouse.ts:1457-1468`). У отмены отгрузки
`referenceId = shipment.id` совпадает с продажей (`frontend_vue/src/services/mocks/orders.ts:3345`, `:3436`) — здесь совпадение
случайно верное. У возврата клиента `referenceId = orderReturn.id` (`frontend_vue/src/services/mocks/orders.ts:3781`), и он не
совпадает ни с одной продажей: возвращённое остаётся «активной продажей» навсегда.

Старый контракт называет ещё третий словарь: `"sale" | "purchase_order" | "work_order" |
"waste_report" | "cutting"` (`roo_code/roo-context/03-api-contract.md:1531`). Три словаря на одно
поле.

### Expected

Один словарь `referenceType`, и он же — ключ, по которому склад уменьшает агрегат.

### Actual

Три словаря; склад понимает свой, заказы пишут свой.

---

## БАГ-14 — все десять отказов резки схлопываются в один тост

**File:** `frontend_vue/src/composables/useWarehouseCutting.ts:329`
**Severity:** Medium — оператор видит «ошибка резки» и не узнаёт, что именно: не хватило металла, не тот размер, не целое число кусков или расхождение расчёта.
**Источник:** К3 (коды ошибок)

### Problem

```ts
} catch {
  toast.error(t('warehouse.cutting_toast_error'))   // :330
  return false
}
```

Сервер при этом различает десять случаев: `BATCH_NOT_FOUND`, `CUTTING_NO_OFFCUTS`,
`CUTTING_KERF_NOT_APPLICABLE`, `INSUFFICIENT_QUANTITY`, `CUTTING_QUANTITY_MISMATCH`
(`frontend_vue/src/services/mocks/warehouse.ts:1506`, `:1508`, `:1519`, `:1529`, `:1534`) плюс
пять из домена — `BATCH_UNIT_NOT_SUPPORTED`, `OFFCUT_DIMENSION_MISSING`,
`OFFCUT_PIECES_NOT_INTEGER`, `CUTTING_NEGATIVE_AMOUNT`, `CUTTING_SOURCE_PIECES_INVALID`
(`frontend_vue/src/domain/cutting.ts:52-58`).

`catch` без параметра — то есть ни код, ни текст не читаются вовсе.

### Expected

Каждый код доходит до человекочитаемого сообщения — как это сделано у строки заказа
(`frontend_vue/src/services/orderLineEdits.ts:400`).

### Actual

Один тост на десять причин.

---

## БАГ-15 — арифметика резки закрыта шестью единицами, а справочник знает девять

**File:** `frontend_vue/src/domain/cutting.ts:71-86`
**Severity:** Medium — партия в единице, которой нет в таблице, не режется и обрезка не даёт никогда, причём отказ приходит после того, как оператор заполнил форму.
**Источник:** К6 (настройки, которых мок не отслеживает)

### Problem

Таблица размера куска перечисляет шесть единиц:

```
'uom-m', 'uom-mm', 'uom-m2', 'uom-kg', 'uom-t', 'uom-pcs'
```
(`frontend_vue/src/domain/cutting.ts:71-76`, `:81-86`).

Справочник настроек содержит девять: те же шесть плюс `uom-m3`, `uom-kg-m3`, `uom-h`
(`frontend_vue/src/services/mocks/settings.ts:91-146`).
`sed -n '71,86p' frontend_vue/src/domain/cutting.ts | grep -c 'uom-m3'` → 0.

Партия в `uom-m3` даёт `BATCH_UNIT_NOT_SUPPORTED` (`frontend_vue/src/domain/cutting.ts:52-53`) и на резке
(`frontend_vue/src/services/mocks/warehouse.ts:1528`), и на ручном создании обрезка (`:905-906`).
Арендатор, добавивший свою единицу настройками, попадёт туда же.

### Expected

Либо перечень единиц, пригодных для склада, принадлежит настройкам, либо форма резки не
предлагает партию в непригодной единице.

### Actual

Закрытый перечень в домене против открытого справочника.

---

## БАГ-16 — списки обрезков и дефицита отдают запись целиком вместо списочной

**File:** `frontend_vue/src/services/mocks/warehouse.ts:866`
**Severity:** Low — на проводе едут поля, которых списочный тип не объявляет, включая журналы аудита каждой строки.
**Источник:** К4 (формы ответа)

### Problem

```ts
return paginate(filtered, pagination.page, pagination.pageSize)     // :866  обрезки
return paginate(filtered, pagination.page, pagination.pageSize)     // :1651 дефицит
```

`filtered` здесь — `WarehouseOffcut[]` и `WarehouseDeficit[]`, а подписи обещают
`PaginatedResponse<OffcutListItem>` и `PaginatedResponse<DeficitListItem>`
(`frontend_vue/src/types/warehouse.ts:677`, `:679`).

Списочная запись обрезка объявляет 12 полей (`:252-269`), сама сущность — 21 (`:208-250`):
лишними едут `thicknessMm`, `notes`, `qrData`, `files`, `createdAt`, `updatedAt` и **`auditLog`**.
У дефицита 11 против 15 (`:469-490` против `:442-467`), лишними — `suggestedOrderQty`,
`purchaseOrderId`, оба таймстампа и **`auditLog`**.

У партий и движений проекция есть: `toBatchListItem` (`frontend_vue/src/services/mocks/warehouse.ts:624-639`), `toMovementListItem`
(`:1120-1137`), и оба применяются (`:612`, `:1192`).

### Expected

`toOffcutListItem` и `toDeficitListItem` — как у двух соседних ресурсов.

### Actual

Отдаётся хранимая запись.

---

## БАГ-17 — схема обрезка не знает ни одного размера, ни веса, ни категории

**File:** `backend/app/modules/warehouse/shared/models.py:131-165`
**Severity:** High — обрезок без размеров нельзя ни оценить, ни предложить строке заказа: и `resolveOffcutMaterial`, и `offcutAllocation` считают материал именно из `lengthMm`/`widthMm`/`weightKg`.
**Источник:** К5 (источник истины), К4

### Problem

`WarehouseOffcut` на схеме — шесть содержательных колонок: `offcut_type`, `quantity`, `unit`,
`status`, `location`, `notes` плюс `tenant_id`, `batch_id`, `product_id`, `parent_batch_id`
(`:131-165`). `sed -n '131,165p' backend/app/modules/warehouse/shared/models.py | grep -c 'length_mm'` → 0.

Тип фронта — 21 поле (`frontend_vue/src/types/warehouse.ts:208-250`), и без `lengthMm`,
`widthMm`, `thicknessMm`, `weightKg` не работают ни таблица размеров
(`frontend_vue/src/domain/cutting.ts:71-86`), ни предложение куска строке заказа
(`frontend_vue/src/services/mocks/warehouse.ts:1046-1062`), ни вывод веса
(`frontend_vue/src/composables/useWarehouseOffcutCard.ts:243-251`).

Плюс на схеме есть **вторая** ссылка на партию — `parent_batch_id` (`:153-157`), которой во
фронте нет вовсе.

### Expected

Схема несёт то, на чём держится домен.

### Actual

Четыре размера, категория, `qr_data` и `order_id` не хранятся нигде.

---

## БАГ-18 — `OFFCUT_LINKED_TO_ORDER` читается только из `message`

**File:** `frontend_vue/src/composables/useWarehouseOffcutCard.ts:385`
**Severity:** Medium — против настоящего API код придёт в `ApiRequestError.code`, и карточка покажет общий тост вместо объяснения, почему кусок нельзя удалить.
**Источник:** К3

### Problem

```ts
if (e instanceof Error && e.message === 'OFFCUT_LINKED_TO_ORDER') {   // :385
```

Парная проверка у партии смотрит на оба поля:

```ts
if (err?.code === 'BATCH_LINKED_TO_ORDER' || err?.message === 'BATCH_LINKED_TO_ORDER') {
```
(`frontend_vue/src/composables/useWarehouseBatch.ts:341`).

У `ApiRequestError` код лежит в `code`, а `message` — человеческий текст сервера
(`frontend_vue/src/types/api.ts:26-31`, заполнение `frontend_vue/src/services/api.ts:117-124`).
Совпадение `message` работает только под моками, где код бросается голым `Error`
(`frontend_vue/src/services/mocks/warehouse.ts:1114`).

Тот же класс, что БАГ-01 соседа (см. `contract-sync-products-bugs.md`, п. 1).

### Expected

Как у партии.

### Actual

Только `message`.

---

## БАГ-19 — удаление обрезка не спрашивает, кто на нём стоит, и не возвращает металл партии

**File:** `frontend_vue/src/services/mocks/warehouse.ts:1111-1116`
**Severity:** High — кусок, названный в разбивке строки заказа, удаляется без возражений; движение `offcut`, списавшее его материал, остаётся в журнале, и металл исчезает из обоих мест.
**Источник:** К6 (транзакционность), К2

### Problem

```ts
export async function mockDeleteOffcut(id: string): Promise<void> {   // :1111
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  if (offcut.orderId) throw new Error('OFFCUT_LINKED_TO_ORDER')       // :1114
  offcutStore.splice(offcutStore.indexOf(offcut), 1)
}
```

Сторож один — поле `orderId`. Но «занят» в этом домене определяется **не им**: занятость
выводится из разбивок строк заказа через `takenOffcuts` (`:998-1000`, регистрация `:972-976`),
и именно этот признак решает, предлагать ли кусок (`:1041`) и принимать ли его в строку (`:1090`).
Удаление о нём не спрашивает.

Второе: материал куска ушёл с партии движением `offcut` (`:947-956`). Удаление куска это движение
не отменяет, а `syncBatchQuantities` пересчитывает остаток по журналу (`:397-413`) — значит после
любой пересборки хранилища металл не вернётся ни в остаток, ни на полку.

### Expected

Отказ, пока на куске кто-то стоит; при удалении — обратное движение или отмена списавшего.

### Actual

Проверяется поле, которым занятость не выражается.

---

## БАГ-20 — `categoryIds` уходит в запрос движений и дефицита и не фильтрует ничего

**File:** `frontend_vue/src/services/mocks/warehouse.ts:1156-1174`
**Severity:** Medium — фильтр по категории на вкладках «Движения» и «Дефицит» нарисован и не работает.
**Источник:** К2

### Problem

Клиент собирает параметр (`frontend_vue/src/services/warehouseService.ts:182-183` для движений,
`:234-235` для дефицита), ветка мока его читает и передаёт
(`frontend_vue/src/services/mocks/index.ts:765`, `:789`), сигнатура функции его объявляет
(`frontend_vue/src/services/mocks/warehouse.ts:1145`, `:1601`) — и в теле фильтра по нему нет:

```
sed -n '1156,1174p' frontend_vue/src/services/mocks/warehouse.ts | grep -c categoryIds   → 0
sed -n '1607,1633p' frontend_vue/src/services/mocks/warehouse.ts | grep -c categoryIds   → 0
```

У обрезков такой фильтр есть (`:848-852`), у остатков — тоже (`:504-507`).

### Expected

Фильтр работает на всех четырёх вкладках, где он показан.

### Actual

Работает на двух из четырёх; на двух параметр принимается и молча теряется.

---

## БАГ-21 — карточка партии просит свои движения и обрезки по номеру, а не по id

**File:** `frontend_vue/src/composables/useWarehouseBatch.ts:356`
**Severity:** Medium — две партии с одинаковым номером покажут друг другу чужой журнал и чужие обрезки; номер партии — это номер накладной поставщика, и уникальным он не объявлен нигде.
**Источник:** К4

### Problem

```ts
const response = await getMovements(
  { search: '', batchNumber: batch.value.batchNumber, … }, { page: 1, pageSize: 50 })  // :356
…
const response = await getOffcuts(
  { search: '', batchNumber: batch.value.batchNumber }, { page: 1, pageSize: 50 })     // :426
```

Мок при этом фильтрует **подстрокой**:

```ts
filtered = filtered.filter((m) => m.batchNumber.toLowerCase().includes(filters.batchNumber!.toLowerCase()))
```
(`frontend_vue/src/services/mocks/warehouse.ts:1166-1169`, у обрезков `:853-856`), то есть партия
`INV-2025-1` подтянет журнал `INV-2025-10`.

Уникальности номера нет ни в моке (`mockCreateBatch` не проверяет — `:680-791`), ни на схеме
(`batch_number: String(100)` без `unique` — `backend/app/modules/warehouse/shared/models.py:33`).
Настоящая ссылка при этом есть: `WarehouseMovement.batchId`
(`frontend_vue/src/types/warehouse.ts:349`) и `WarehouseOffcut.batchId` (`:211`), и мок движений
уже умеет фильтровать по `productId` и `offcutId` точным совпадением (`frontend_vue/src/services/mocks/warehouse.ts:1164`, `:1171`).

### Expected

Фильтр по `batchId`.

### Actual

Подстрока по номеру накладной.

---

## БАГ-22 — `unitPrice` и `currency` в payload движения не используются никем

**File:** `frontend_vue/src/types/warehouse.ts:406`
**Severity:** Low — два поля контракта, которые клиент не шлёт, а сервер игнорирует по построению.
**Источник:** К4

### Problem

`MovementCreatePayload` объявляет `unitPrice?: number` (`:406`) и `currency?: string` (`:414`).

Ни один из пяти вызывающих их не шлёт (`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue:515-530`,
`frontend_vue/src/composables/useWarehouseBatch.ts:262-270`, `:406-412`,
`frontend_vue/src/composables/useWarehouseOffcutCard.ts:299-310`, `:316-322`,
`frontend_vue/src/composables/useWarehouse.ts:367-374`).

`currency` мок игнорирует и в принципе: движение всегда получает валюту партии —
`currency: batch.currency` (`frontend_vue/src/services/mocks/warehouse.ts:1249`), поля `data.currency`
`writeMovement` не читает вовсе.

### Expected

Поле либо влияет на ответ, либо не объявлено.

### Actual

Объявлено, не шлётся, игнорируется.

---

## БАГ-23 — у движения на схеме нет колонки `offcut_id`

**File:** `backend/app/modules/warehouse/shared/models.py:91-128`
**Severity:** High — на этом поле держится вся модель обрезка: по нему решается, что движение двигает кусок, а не партию; по нему ставится статус куска; по нему карточка обрезка собирает свой журнал.
**Источник:** К5, К4

### Problem

`sed -n '91,128p' backend/app/modules/warehouse/shared/models.py | grep -c 'offcut_id'` → **0**.
В миграции тоже нет (`backend/alembic/versions/fd0ecc1269df_phase_9_warehouse.py:52-70`).

Во фронте поле обязательное и несущее:

- `WarehouseMovement.offcutId: string | null` (`frontend_vue/src/types/warehouse.ts:352`);
- `movesOffcut()` — единственное правило «движение двигает кусок, а не партию»
  (`frontend_vue/src/services/mocks/warehouse.ts:380-382`), применяется в четырёх местах
  (`:313`, `:402`, `:1267`, `:1425`);
- статус куска ставится по типу движения именно для `offcutId != null` (`:1337-1344`);
- журнал куска в карточке фильтруется по нему (`frontend_vue/src/composables/useWarehouseOffcutCard.ts:170`).

### Expected

Колонка есть, иначе списание куска на сервере невыразимо.

### Actual

Колонки нет.

---

## БАГ-24 — `WarehouseDeficit.productName` остался копией имени товара

**File:** `frontend_vue/src/types/warehouse.ts:446`
**Severity:** Medium — последняя копия имени товара в домене; ручное создание записи кладёт туда три пустых строки, и запись показывается без имени.
**Источник:** К6 (производные значения)

### Problem

Пункт 4e убрал копию имени у партии, обрезка и движения — правило записано в самих типах
(`frontend_vue/src/types/warehouse.ts:73-77`, `:213-219`, `:353`) и в моке
(`frontend_vue/src/services/mocks/warehouse.ts:117-133`), и именно из-за расхождения копий: 92
партии из 100 называли себя не тем товаром.

У дефицита копия осталась (`:446`, в списочной записи — `:472`), и ручное создание пишет туда
пустоту:

```ts
productName: { ru: '', en: '', lt: '' },     // frontend_vue/src/services/mocks/warehouse.ts:1742
```

Путь заказа заполняет её одной строкой на все три языка (`:1692`). Поиск по вкладке дефицита
идёт **по этой копии** (`:1610-1617`), а не по каталогу — в отличие от трёх соседних вкладок,
где поиск идёт через `_matchesProductName` (`:136-144`).

### Expected

`productId` и подпись из каталога, как у остальных четырёх сущностей домена.

### Actual

Копия, которую нечем заполнить при ручном создании.

---

## БАГ-25 — у нехватки на схеме нет приоритета, а `status` объявлен со значением приоритета

**File:** `backend/app/modules/warehouse/shared/models.py:196-198`
**Severity:** Medium — колонка `status` получает дефолт `"critical"`, которого нет в перечне статусов и который принадлежит перечню приоритетов.
**Источник:** К5, К4

### Problem

```python
status: Mapped[str] = mapped_column(
    String(20), nullable=False, default="critical", server_default="critical"
)
```
(`:196-198`).

Во фронте это два разных перечня:

```ts
export type DeficitPriority = 'critical' | 'high' | 'medium' | 'low'                    // :46
export type DeficitStatus = 'open' | 'in_progress' | 'ordered' | 'resolved' | 'cancelled' // :49
```
(`frontend_vue/src/types/warehouse.ts:46`, `:49`).

Колонок под `priority`, `suggested_order_qty` и `purchase_order_id` на схеме нет вовсе
(`backend/app/modules/warehouse/shared/models.py:168-199`), хотя все три есть в типе
(`frontend_vue/src/types/warehouse.ts:455`, `:458`, `:460`) и все три правятся
(`:499-506`).

### Expected

Две колонки — статус и приоритет, каждая со своим перечнем.

### Actual

Одна колонка с дефолтом из чужого перечня.

---

## БАГ-26 — ручное создание нехватки заполняет шесть полей константами

**File:** `frontend_vue/src/services/mocks/warehouse.ts:1742-1749`
**Severity:** Medium — созданная руками запись всегда «штуки», всегда без имени товара и всегда с нулевым текущим остатком, каким бы он ни был на самом деле.
**Источник:** К6 (значения по умолчанию)

### Problem

```ts
productName: { ru: '', en: '', lt: '' },   // :1742
currentStock: 0,                          // :1743
deficitAmount: data.minRequired,          // :1745
uomId: 'uom-pcs',                         // :1746
status: 'open',                           // :1748
suggestedOrderQty: null,                  // :1749
```

Ни `productName`, ни `uomId`, ни `currentStock` не берутся у товара и у склада, хотя оба
источника рядом: имя — `PRODUCTS_STORE` (`:131-133`), остаток и единица — `projectStockRow`
(`:446-476`).

Путь заказа те же поля заполняет осмысленно: имя из строки, единица из строки, `priority: 'high'`,
`suggestedOrderQty` равен нехватке (`:1689-1705`).

Сегодня расхождение невидимо только потому, что вызывающего у эндпоинта нет вовсе (см. аудит,
«Правила домена…», п. 19).

### Expected

Оба пути заполняют запись одинаково.

### Actual

Шесть констант против шести вычисленных значений.

---

## БАГ-27 — выгрузка CSV это заглушка, игнорирующая вкладку и все фильтры

**File:** `frontend_vue/src/services/mocks/warehouse.ts:1853-1855`
**Severity:** Medium — кнопка «Экспорт» на пяти вкладках сохраняет файл с текстом `mock-csv-data`; 58 строк сборки параметров в клиенте не проверяются ничем.
**Источник:** К2

### Problem

```ts
export async function mockExportWarehouseCsv(_tab: string): Promise<string> {
  return 'mock-csv-data'
}
```

Клиент при этом собирает запрос подробно и по-разному для каждой из пяти вкладок
(`frontend_vue/src/services/warehouseService.ts:262-324`), включая `_locale`
(`:267-268`), и сохраняет ответ файлом (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:327-332`).

### Expected

Мок отдаёт CSV, отвечающий вкладке и фильтрам, — иначе поведение выгрузки не описано ничем и
бэкенду его писать не с чего.

### Actual

Литерал.

---

## БАГ-28 — уникальность строки остатка объявлена без арендатора

**File:** `backend/app/modules/warehouse/shared/models.py:213-219`
**Severity:** High — `unique=True` на одном `product_id` означает одну строку остатка на всю базу, а не на арендатора; второй арендатор с тем же товаром не сможет её создать.
**Источник:** К6 (мультиарендность)

### Problem

```python
product_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("products.id", ondelete="CASCADE"),
    nullable=False,
    unique=True,
    index=True,
)
```
(`:213-219`; та же строка в миграции —
`backend/alembic/versions/fd0ecc1269df_phase_9_warehouse.py:107`).

`tenant_id` в ограничение не входит: `sed -n '213,219p' backend/app/modules/warehouse/shared/models.py | grep -c tenant_id` → 0.

Как это делается правильно, видно в соседнем модуле: `uq_product_field_value` на паре
(`backend/app/modules/products/shared/models.py:210-214`).

### Expected

`UniqueConstraint("tenant_id", "product_id")`.

### Actual

`unique=True` на одной колонке.

---

## БАГ-29 — `minStock` живёт в двух разных сторах, и его правка не меняет ни дефицит, ни уведомление

**File:** `frontend_vue/src/services/mocks/warehouse.ts:474`, `frontend_vue/src/services/mocks/products.ts:14184`, `frontend_vue/src/types/warehouse.ts:588-589`
**Severity:** Medium — порог, поставленный на карточке товара, не влияет на склад; переход через порог не является событием ни для кого
**Источник:** К5 (производные значения), К6 (события)

### Problem

**Порог хранится дважды.** На карточке товара его правит поле формы
(`views/admin/products/ProductCardPage.vue:333` → `composables/useProductCard.ts:24`), уходит
дельтой в единственный PATCH товара (`useProductCard.ts:233-256`) и ложится в стор товаров
(`mocks/products.ts:14184`, запись — `:14220`). У склада порог — собственное поле строки остатка, засеянное отдельно
(`frontend_vue/src/mocks/warehouse-stock.ts`, `grep -c minStock` → 72) и правимое собственным
маршрутом `PATCH` остатка (`mocks/index.ts:1437` → `mocks/warehouse.ts:553-561`, `Object.assign(item, delta)`).
Комментарий типа обещает вывод из товара — «Minimum stock threshold (**from product**)»
(`types/warehouse.ts:588-589`), но вывода нет: `grep -n minStock frontend_vue/src/services/mocks/warehouse.ts`
даёт ровно две строки, `:474` и `:522`, и обе читают `row.minStock`, то есть собственную копию.
Правка порога на товаре склад не видит; правка на складе не видна товару.

**Дефицит не хранится, а считается при каждом чтении:**

```ts
isDeficit: row.minStock !== null && totalQuantity < row.minStock,
```
(`mocks/warehouse.ts:474`, в проекции `projectStockRow`, через которую идут и список
`mockGetStockOverview` (`:490`), и карточка `mockGetStockItem` (`:545-551`)).

Поэтому перехода через порог не существует как момента: признак появляется и исчезает молча при
следующем чтении, и подписаться на него нечему.

**Уведомление говорит про порог, но рождается не от него.** Текст `stock_deficit` — «достиг нижнего
лимита остатка» / «has reached minimum stock level» (`mocks/notifications.ts:648-651`), а
единственный вызыватель — открытие новой записи нехватки под заказ, попросивший больше, чем лежит
(`mocks/warehouse.ts:1721`, условие — только **вновь открытая** нехватка). Правка `minStock` не зовёт
эмиттер ни разу: `grep -c notifyStockDeficit` по местам правки порога → 0.

**Карточка товара о дефиците не знает вовсе.** `grep -rn isDeficit` по
`views/admin/products/` и `composables/useProductCard.ts` → пусто; признак читают только склад
(`WarehousePage.vue:1387`, `:1737`, `:1756`) и карточка остатка (`WarehouseStockCard.vue:267`). То
есть на экране, где порог задают, последствия его правки не видны.

### Fix

TBD — решение владельца о владельце порога. Ожидаемое по §17 соглашений (сервер считает производные,
а не хранит): `minStock` принадлежит товару, строка остатка его не дублирует, а склад читает у товара;
переход через порог — событие, и тогда текст `stock_deficit` перестаёт расходиться со своим поводом.

### Future rule

Одно и то же число в двух сторах — это два числа. Если тип обещает «from product», должен
существовать код, который это выводит; комментарий выводом не является.
