# Warehouse

Склад: остатки по товарам, партии, обрезки, движения, резка, нехватки и выгрузка. **37
эндпоинтов** в пространстве `/api/warehouse` — самый большой домен проекта после заказов. Счёт
машинный, а не глазами: инвентарь кода считает
[`services/contractInventory.ts`](../../../frontend_vue/src/services/contractInventory.ts), а
[`contract-conformance.spec.ts`](../../../frontend_vue/src/services/contract-conformance.spec.ts)
требует раздела на каждый вызов кода и не допускает раздела без вызова, — так что число разделов в
этом файле и есть число эндпоинтов домена:
`grep -cE '^### (GET|POST|PUT|PATCH|DELETE) /api' roo_code/roo-context/api/warehouse.md` → 37.
До сведения тот же прогон печатал `warehouse=37` строкой «не сведено»; теперь домен в ней не
значится.

**Общие соглашения — [`00-conventions.md`](00-conventions.md), и здесь они не повторяются.**
Конверт ответа и разбор ошибки — §1 (там же исключение про CSV этого домена); каталог кодов ядра и
правило «отказ несёт код, а не текст» — §2; `PATCH` против `PUT` — §3; мультиарендность — §4;
заголовки и четыре реализации «где лежит токен» — §5; права и фича-флаги — §6 и §7; аудит-лог,
адресация записи по `id` — §9; уведомления как переход — §10; идемпотентность и `If-Match` — §11;
`TranslatedString` — §12; форма `PaginatedResponse`, размер страницы и правило «сортировка
принадлежит серверу» — §13; даты, деньги, единицы и «цена, которой никто не назвал, — это `null`» —
§14; clean-slate против quick-action — §15; файлы — §16; производные значения — §17; чем мок
отличается от обязанностей сервера — §18; непрозрачность `id` — §19. Ниже — только то, что живёт в
этом домене.

**Источник истины — мок и клиент, по каждому из 37 путей.** Модуль `backend/app/modules/warehouse`
существует, но роутов у него **ноль**: `grep -rn "@router\." backend/app/modules/warehouse --include=*.py`
не даёт ни одного попадания, в `features/` лежит только `__init__.py`
(`find backend/app/modules/warehouse -type f -name '*.py'` → семь файлов, из которых
`internal_api/interface.py` и `shared/dependencies.py` — по одной строке докстроки), а в
`backend/app/main.py:66-74` подключены девять роутеров и ни одного складского. Поэтому у каждого
раздела ниже стоит строка **`Бэкенд: не реализован`** — форма «модуль есть, серверной половины нет».
Метка `**Статус:** спроектировано` в этом домене не стоит ни у одного раздела и стоять не должна:
она про отсутствие кода вообще, а клиент и мок есть у всех 37 путей.

**Но схема хранения зафиксирована целиком, и она — ограничение, а не форма.** Шесть таблиц:
`warehouse_batches`, `warehouse_movements`, `warehouse_offcuts`, `warehouse_deficits`, `stock_items`,
`stock_audit_entries` — объявления `__tablename__` стоят на
`backend/app/modules/warehouse/shared/models.py:14`, `:94`, `:134`, `:171`, `:205`, `:232`
(классы — `:11`, `:91`, `:131`, `:168`, `:202`, `:229`; миграция
`backend/alembic/versions/fd0ecc1269df_phase_9_warehouse.py`, закупочный след добавлен
`backend/alembic/versions/a1b2c3d4e5f6_phase_15_product_uom_restructure.py`). Схема расходится с
формой фронта в четырёх местах, и каждое — находка, а не решение: у движения нет колонки `offcut_id`
(БАГ-23), у обрезка нет ни одного размера (БАГ-17), у нехватки нет приоритета, а её `status` объявлен
значением из перечня приоритетов (БАГ-25), уникальность строки остатка объявлена без арендатора
(БАГ-28, он же назван в §4 соглашений). Сервер, который начнёт писать этот домен, обязан сначала
разрешить эти четыре расхождения — форма ниже описана по коду фронта, потому что старшего источника
у неё нет.

**Заголовков клиент не шлёт ни на одном из 37 путей.**
`grep -c "headers\|options" frontend_vue/src/services/warehouseService.ts` → 0 на 374 строки: ни
`Authorization`, ни `X-CSRF-Token`, ни `Idempotency-Key` (`grep -c "Idempotency"` → 0), ни `If-Match`
— при том что все четыре механизма в проекте есть (§5 и §11 соглашений) и соседние домены ими
пользуются. Это БАГ-01, и он общий для всего домена; отдельной строкой в разделах он не повторяется.
Самый неприятный частный случай: удаление записи аудита из общей ленты уходит без подписи, хотя сама
лента свои чтения подписывает (`frontend_vue/src/services/auditFeedService.ts:20`, роутинг удаления
`:66-77`).

**Конверт под моками не строится.** `getMock`/`postMock` вызываются вместо `fetch`
(`frontend_vue/src/services/api.ts:149-151`, `:168-170`) и возвращают голое значение через `delay()`;
`unwrap()` пропускает его, потому что ключа `success` в нём нет (§1). Отказ мока — голый
`Error(<код>)`, то есть код лежит в `message`, а не в `ApiRequestError.code`
(`frontend_vue/src/types/api.ts:26-31`). Против настоящего сервера это уже даёт живой дефект:
`OFFCUT_LINKED_TO_ORDER` читается только из `message` (БАГ-18).

**Правило соседа не выводится заново.** Про то, что имя товара — ссылка, а не поле, и про регистр
форм: аудит [`products`](../../plans/api/audit/products.md). Про то, что уведомление — это переход:
аудит [`notifications`](../../plans/api/audit/notifications.md) и §10 соглашений. Про то, что базовая
валюта выражена дважды — флагом `isDefault` и константой `constants.defaultCurrency`: аудит
[`settings`](../../plans/api/audit/settings.md) и §14 соглашений.

Находки про код домена — [`contract-sync-warehouse-bugs.md`](../../plans/bugs/contract-sync-warehouse-bugs.md),
БАГ-01…БАГ-28. Код этой работой не тронут.

---

## Каталог кодов ошибок домена

**Двадцать два кода** — второе место в проекте после заказов. Семнадцать бросает мок домена
литералом (`grep -o "new Error('[A-Z_]*')" frontend_vue/src/services/mocks/warehouse.ts | sort -u | wc -l`
→ 17), пять приходят из доменного слоя резки через `MATERIAL_ERROR_CODE`
(`frontend_vue/src/domain/cutting.ts:52-58`) и бросаются двумя строками мока
(`frontend_vue/src/services/mocks/warehouse.ts:906`, `:1528`).
Пересечения между двумя наборами нет ни одного, поэтому 17 + 5 = 22.

| код | где бросается — файл `frontend_vue/src/services/mocks/warehouse.ts`, если не сказано иное | эндпоинты |
|---|---|---|
| `BATCH_NOT_FOUND` | `frontend_vue/src/services/mocks/warehouse.ts:643`, `:798`, `:818`, `:903`, `:1093`, `:1223`, `:1506`, `:1883` | GET/PATCH/DELETE партии, её аудит, POST движения, POST обрезка, POST резки |
| `BATCH_LINKED_TO_ORDER` | `:819` | `DELETE /api/warehouse/batches/:batchId` |
| `BATCH_CURRENCY_NOT_BASE` | `:725`, `:802` | `POST /api/warehouse/batches`, `PATCH /api/warehouse/batches/:batchId` |
| `OFFCUT_NOT_FOUND` | `:871`, `:1088`, `:1106`, `:1113`, `:1896` | GET/PATCH/DELETE обрезка, его аудит, запись строки заказа |
| `OFFCUT_LINKED_TO_ORDER` | `:1114` | `DELETE /api/warehouse/offcuts/:offcutId` |
| `OFFCUT_PRODUCT_MISMATCH` | `:1089` | запись обрезка в строку заказа |
| `OFFCUT_NOT_AVAILABLE` | `:1091` | то же |
| `OFFCUT_SIZE_NOT_EXPRESSIBLE` | `:1095` | то же |
| `MOVEMENT_NOT_FOUND` | `:1402`, `:1409` | `GET /api/warehouse/movements/:movementId` |
| `STOCK_ITEM_NOT_FOUND` | `:547`, `:558` | `GET`/`PATCH /api/warehouse/stock/:productId` |
| `STOCK_NOT_FOUND` | `:1866` | `DELETE /api/warehouse/stock/:productId/audit/:entryId` |
| `DEFICIT_NOT_FOUND` | `:1656`, `:1765`, `:1772`, `:1926` | GET/PATCH/DELETE нехватки, её аудит |
| `AUDIT_ENTRY_NOT_FOUND` | `:1868`, `:1885`, `:1898`, `:1912`, `:1928` | все пять удалений записи журнала |
| `INSUFFICIENT_QUANTITY` | `:910`, `:1529` | `POST /api/warehouse/offcuts`, `POST /api/warehouse/cutting` |
| `CUTTING_NO_OFFCUTS` | `:1508` | `POST /api/warehouse/cutting` |
| `CUTTING_KERF_NOT_APPLICABLE` | `:1519` | то же |
| `CUTTING_QUANTITY_MISMATCH` | `:1534` | то же |
| `CUTTING_NEGATIVE_AMOUNT` | `domain/cutting.ts:56` | то же |
| `CUTTING_SOURCE_PIECES_INVALID` | `domain/cutting.ts:57` | то же |
| `BATCH_UNIT_NOT_SUPPORTED` | `domain/cutting.ts:53` | `POST /api/warehouse/cutting`, `POST /api/warehouse/offcuts` |
| `OFFCUT_DIMENSION_MISSING` | `domain/cutting.ts:54` | то же |
| `OFFCUT_PIECES_NOT_INTEGER` | `domain/cutting.ts:55` | то же |

**Ни один код не является подстрокой другого** — правило §2 соглашений; проверено попарно по всем
22 (0 пар), проверка проинвертирована на подставленной паре `BATCH_NOT` ⊂ `BATCH_NOT_FOUND` и её
поймала.

**До человека отдельным сообщением доходят два кода из двадцати двух.** `BATCH_LINKED_TO_ORDER`
(`frontend_vue/src/composables/useWarehouseBatch.ts:341`) и `OFFCUT_LINKED_TO_ORDER`
(`frontend_vue/src/composables/useWarehouseOffcutCard.ts:385`) поднимают флаг
`deleteBlockedByOrder`, за которым стоит переведённый модал на всех трёх локалях
(`frontend_vue/src/i18n/admin/warehouse.ts:422-423`). Ещё пять доезжают до экрана **сырой строкой
кода**: пять карточек кладут `e.message` в состояние ошибки — партия
(`useWarehouseBatch.ts:230`), обрезок (`useWarehouseOffcutCard.ts:219`), движение
(`useWarehouseMovementCard.ts:40`), нехватка (`useWarehouseDeficitCard.ts:74`), остаток
(`useWarehouseStockCard.ts:137`), плюс страница создания обрезка (`useWarehouseOffcutCreate.ts:315`).
Остальные пятнадцать схлопываются в общий тост. Крайний случай — резка: **все десять её отказов дают
один текст** (`useWarehouseCutting.ts:329-331`), это БАГ-14.

**Кодов ядра домен не наследует ни одного.** Пять кодов ядра
(`backend/app/core/exceptions.py` — `grep -c 'code="' ` → 5: `NOT_FOUND`, `VALIDATION_ERROR`,
`UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`; перечень со статусами — §2 соглашений) склад не бросает
нигде, потому что бросать негде: роутов у модуля ноль. Прежний контракт обещал два из них у этого
домена — см. «Чего в домене нет».

---

## Остаток по товару (stock)

Строка остатка — **проекция партий, а не запись**: всё, на что может ответить партия, читается с
партий при каждом чтении (`projectStockRow`, `frontend_vue/src/services/mocks/warehouse.ts:446-476`,
причина расписана там же `:434-445`). Из четырнадцати полей `StockOverviewItem`
(`frontend_vue/src/types/warehouse.ts:571-598`) проекция перезаписывает **девять**: восемь считает
из партий и резервов — `totalQuantity`, `batchCount`, `avgUnitPrice`, `totalValue`, `uomId`,
`reservedQuantity`, `availableQuantity`, `isDeficit`, — а девятое, `productName`, берёт из каталога
товаров. На строке остаются **пять**: `productId`, `minStock`, `categoryId`, `categoryName` и
собственный журнал.

### GET /api/warehouse/stock

Список остатков по товарам — первая вкладка склада.
Save-режим: чтение.

Запрос — query, собирается условно: всегда `search`, `page`, `pageSize`; `categoryIds` (склейка
через запятую) только если список непуст; `uomId`, `showDeficitOnly='true'`, `showInStockOnly='true'`
только когда заданы; `sortBy` и `sortDir` — только парой
(`frontend_vue/src/services/warehouseService.ts:37-50`). Мок читает те же девять ключей
(`frontend_vue/src/services/mocks/index.ts:623-629`), дефолты страницы ставит ветка (`:618-619`),
дефолты сортировки — `productName`/`asc` — сама функция
(`frontend_vue/src/services/mocks/warehouse.ts:513-514`).

Ответ: `StockOverviewResponse` = `PaginatedResponse<StockOverviewItem>`
(`frontend_vue/src/types/warehouse.ts:680`), сбор — `paginateStock`
(`frontend_vue/src/services/mocks/warehouse.ts:529-543`).

Поиск идёт по трём локалям имени товара **и по `productId`**
(`frontend_vue/src/services/mocks/warehouse.ts:493-501`) — то есть по подстроке идентификатора тоже,
в отличие от партий и движений.

Сортировка поддержана по шести ключам: `productName`, `totalQuantity`, `availableQuantity`,
`avgUnitPrice`, `totalValue`, `minStock`
(`frontend_vue/src/services/mocks/warehouse.ts:517-522`). Страница при этом шлёт ещё `name` и
`uomId`, которых мок не знает — колонки выглядят сортируемыми и не сортируют (БАГ-03).

Ошибки: ни одной — в `mockGetStockOverview` нет ни одного `throw`
(`frontend_vue/src/services/mocks/warehouse.ts:478-527`).

Обязанности сервера: `avgUnitPrice` взвешивается **только по оценённым партиям**
(`frontend_vue/src/services/mocks/warehouse.ts:467`, отбор `:453-454`) — партия без цены не тянет
среднюю к нулю; `uomId` берётся у первой партии товара (`:469`); строка остатка существует только
для товара, у которого она засеяна — `stockStore` пополняется исключительно сидом, и создание партии
её не заводит (БАГ-02), то есть **сервер обязан завести строку сам**, иначе новый товар с партиями
не покажется на складе вовсе.

Бэкенд: не реализован — схема хранения беднее формы: `stock_items` знает четыре содержательные
колонки (`product_id`, `total_quantity`, `unit`, `updated_at` —
`backend/app/modules/warehouse/shared/models.py:202-226`), то есть ни порога, ни категории, ни
резерва, ни журнала.
Реализация: `services/warehouseService.ts:getStockOverview` · мок `mocks/index.ts:617` →
`services/mocks/warehouse.ts:mockGetStockOverview`

### GET /api/warehouse/stock/:productId

Карточка остатка. Сегмент пути — **id товара, а не id строки остатка**: `mockGetStockItem` ищет
`s.productId === productId` (`frontend_vue/src/services/mocks/warehouse.ts:546`).
Save-режим: чтение.

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:53-55`), ни query, ни заголовков.

Ответ: `StockOverviewItem` целиком — и **через ту же проекцию, что список**
(`frontend_vue/src/services/mocks/warehouse.ts:550`, причина названа в коде `:548-549`): карточка и
список не имеют права разойтись об одной полке.

Ошибки: `STOCK_ITEM_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:547`) — доходит до
человека сырой строкой кода (`useWarehouseStockCard.ts:137`). Соседний эндпоинт того же ресурса
бросает на то же условие **другой** код, `STOCK_NOT_FOUND` (БАГ-04); серверу выбирать один.

Обязанности сервера: неизвестный товар — отказ, а не пустая строка; `NOT_FOUND` ядра тут не
подходит, потому что клиент читает именно доменный код.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:getStockItem` · мок `mocks/index.ts:644` →
`services/mocks/warehouse.ts:mockGetStockItem`

### PATCH /api/warehouse/stock/:productId

Правка строки остатка из карточки. Тело — дельта, ответ — строка целиком.
Save-режим: clean-slate — правки живут в форме (`useWarehouseStockCard.ts:80-92`), уходят по кнопке
Save и только при непустой дельте (`:147-149`), Discard возвращает форму к последнему ответу сервера
(`:167-177`).

Запрос: `StockPatchPayload` — пять ключей, все необязательные:
`productName?`, `uomId?`, `avgUnitPrice?`, `minStock?`, `categoryName?`
(`frontend_vue/src/types/warehouse.ts:600-611`). Дельту собирает `useDirtyCheck.diff()` по верхнему
уровню (`frontend_vue/src/composables/useDirtyCheck.ts:62-77`, правило — §15 соглашений).

Ответ: `StockOverviewItem`.

Ошибки: `STOCK_ITEM_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:558`); до человека не
доходит — `catch { toast.error(...) }` без параметра (`useWarehouseStockCard.ts:160-162`).

**Четыре правимых поля из пяти принадлежат не этой строке**, и сервер обязан это знать:
`productName` и `categoryName` — каталогу товаров (`frontend_vue/src/types/product.ts:39-41`),
`uomId` — справочнику единиц настроек, `avgUnitPrice` — производное от партий
(`frontend_vue/src/services/mocks/warehouse.ts:467`). Записанное имя теряется на следующем же
чтении: проекция перекрывает его каталогом (`:461`), а записанную вручную среднюю цену —
вычисленной (`:467`). Своё у строки только `minStock`. Что здесь источник истины — **решение
владельца**; контракт его не назначает.

Отдельно про сам порог: **решено 2026-09-09 (П57)** — правка `minStock` пересчитывает нехватку
**сразу**, не дожидаясь складской операции. Сегодня признак считается на лету при чтении
(`isDeficit: row.minStock !== null && totalQuantity < row.minStock`,
`frontend_vue/src/services/mocks/warehouse.ts:474`), а записи нехватки заводят только складские
операции (`:1706`, `:1756`) — то есть поднятый порог виден на экране остатков и не рождает ни
записи, ни уведомления. См. раздел «События и уведомления» файла `products` и
[§17](00-conventions.md).

Обязанности сервера: ответ обязан проходить **ту же проекцию**, что GET. Мок отдаёт `{ ...item }`
без проекции (`frontend_vue/src/services/mocks/warehouse.ts:560`), и карточка кладёт этот ответ
прямо в состояние (`useWarehouseStockCard.ts:150`) — сразу после Save на экране висят засеянные
числа вместо посчитанных (БАГ-05).

Бэкенд: не реализован — под четыре из пяти полей колонок в `stock_items` нет
(`backend/app/modules/warehouse/shared/models.py:220-223`).
Реализация: `services/warehouseService.ts:patchStockItem` · мок `mocks/index.ts:1321` →
`services/mocks/warehouse.ts:mockPatchStockItem`

### GET /api/warehouse/stock/:productId/cost

Оценка строки заказа по FIFO: сколько будет стоить взять со склада `quantity` этого товара.
Экранов склада среди вызывающих нет — оба в домене заказов: предпросмотр строки в диалоге
добавления позиций (`frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue:467`) и пересчёт
строк карточки заказа (`frontend_vue/src/composables/useOrderCard.ts:1177`).
Save-режим: чтение, вспомогательное.

Запрос: путь плюс один обязательный query — `quantity`, сериализованный `String()`
(`frontend_vue/src/services/warehouseService.ts:71-78`). Мок читает его с дефолтом 1 при отсутствии
(`frontend_vue/src/services/mocks/index.ts:640`).

Ответ — объект из трёх чисел, не сущность и не конверт:

```ts
{ unitPrice: number; totalCost: number; shortageQuantity: number }
```

(`frontend_vue/src/services/warehouseService.ts:74`, сборка
`frontend_vue/src/services/mocks/warehouse.ts:1842-1848`). Третье поле объявлено частью ответа
намеренно: цена, снятая с партий, покрывающих половину строки, — оценка, и вызывающий обязан
отличать её от полной (`frontend_vue/src/services/warehouseService.ts:64-70`).

Ошибки: ни одной. Неизвестный товар отвечает нулями, а не отказом: `batchesForProduct` вернёт пустой
список (`frontend_vue/src/services/mocks/warehouse.ts:1360-1364`), и подбор отдаст всю величину
недостачей.

Обязанности сервера, четыре, и первая — главная:

1. **FIFO считает по доступному, а не по остатку.** Из количества партии вычитается и чужой резерв,
   и чужой хват разбивки строки (`frontend_vue/src/services/mocks/warehouse.ts:1814-1819`, причина
   с числами — `:1788-1795`). Правило подбора живёт в домене (`allocateFifo`,
   `frontend_vue/src/domain/orderPricing.ts`, импорт `services/mocks/warehouse.ts:50-56`), склад лишь
   подставляет партии.
2. **Параметров `exceptLine` и `claimed` на проводе нет.** Домен заказов передаёт их
   внутрипроцессно (`frontend_vue/src/services/mocks/warehouse.ts:1804-1808`), а HTTP-вызывающий не
   может: значит оценка через этот эндпоинт всегда считается «как для чужого», и своя же строка
   заказа выглядит занявшей металл. Как это выразить на проводе — **решение владельца**.
3. **Партия без цены участвует в подборе с `unitCost: 0`**
   (`frontend_vue/src/services/mocks/warehouse.ts:1825`, причина `:1820-1824`) и занижает
   средневзвешенную. Это единственное место домена, где неизвестная цена превращается в ноль, и
   причина названа: домен заказов не умеет носить «неизвестно».
4. **Недостача сообщается, а не усредняется молча** — цена ставится по покрытой части
   (`:1843-1846`).

Бэкенд: не реализован — колонок под этот ответ на схеме нет и быть не должно, он производный
целиком.
Реализация: `services/warehouseService.ts:getBatchCostBreakdown` · мок `mocks/index.ts:637` →
`services/mocks/warehouse.ts:mockCalculateFifoCost`

### GET /api/warehouse/stock/:productId/audit

Журнал изменений строки остатка. **Вызывающего у этого пути нет** — см. «Клиент написан, UI нет».
Save-режим: чтение.

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:328-330`).

Ответ: `StockAuditEntry[]` — голый массив, не `PaginatedResponse`
(`frontend_vue/src/services/warehouseService.ts:328`); мок отдаёт `structuredClone` журнала строки
(`frontend_vue/src/services/mocks/warehouse.ts:1859-1862`). Запись — семь полей:

```ts
{ id: string; timestamp: string; user: TranslatedString; userInitials: string;
  property: TranslatedString; oldValue: string; newValue: string }
```

(`frontend_vue/src/types/warehouse.ts:526-534`). `id` проставляется при сборке хранилища
(`sealAuditIds`, `frontend_vue/src/types/warehouse.ts:536-544`), в сидах его нет — и именно на нём
держится адресация записи (§9 соглашений).

Ошибки: ни одной — для неизвестного товара мок отдаёт **пустой массив**
(`frontend_vue/src/services/mocks/warehouse.ts:1861`), тогда как парный DELETE на том же условии
бросает `STOCK_NOT_FOUND` (`:1866`). Чтение и удаление отвечают на несуществующую сущность
по-разному — БАГ-06, и это класс на весь домен: так ведут себя пять чтений журналов и два чтения
агрегатов.

Обязанности сервера: журнал приходит **двумя путями** — полем сущности в ответе
`GET /api/warehouse/stock/:productId` и этим эндпоинтом; карточка пользуется первым
(`useWarehouseStockCard.ts:132`). Сервер обязан отдавать одно и то же по обоим.

Бэкенд: не реализован — таблица журнала на схеме одна, `stock_audit_entries`, и она привязана к
партии: `batch_id` объявлен `nullable=False` FK на `warehouse_batches.id`
(`backend/app/modules/warehouse/shared/models.py:240-245`). Журналу строки остатка на схеме места
нет.
Реализация: `services/warehouseService.ts:getStockAudit` · мок `mocks/index.ts:653` →
`services/mocks/warehouse.ts:mockGetStockAudit`

### DELETE /api/warehouse/stock/:productId/audit/:entryId

Удаление одной записи журнала строки остатка. Два вызывающих, и второй — чужого домена: карточка
остатка по подтверждению модала (`useWarehouseStockCard.ts:179-187`) и общая лента аудита, которая
роутит сюда по `entityType` (`frontend_vue/src/services/auditFeedService.ts:67-68`). Второго пути к
записи нет — своего `DELETE` у ленты нет намеренно (§9 соглашений).
Save-режим: quick-action.

Запрос: тела нет, два сегмента пути (`frontend_vue/src/services/warehouseService.ts:332-334`).

Ответ: `Promise<void>`; на проводе — `ApiResponse<null>`. Тела не читает ни один вызывающий:
карточка правит список у себя (`useWarehouseStockCard.ts:182`), лента — своей функцией.

Ошибки: `STOCK_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:1866`) и
`AUDIT_ENTRY_NOT_FOUND` (`:1868`). До человека не доходит ни один — карточка показывает общий тост
(`useWarehouseStockCard.ts:185`).

Обязанности сервера: **неизвестный `entryId` — отказ, а не тихий no-op** (§9 соглашений): молчание
неотличимо от успеха, и клиент сотрёт у себя строку, которая на сервере осталась. Адресация — по
`id` записи, никогда по позиции. Кому это разрешено — **решение владельца**: удаление следа
изменения не гейтится сегодня ни правом, ни фича-флагом.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:deleteStockAuditEntry` · мок `mocks/index.ts:1435` →
`services/mocks/warehouse.ts:mockDeleteStockAuditEntry`

---

## Партии (batches)

### GET /api/warehouse/batches

Список партий — вкладка «Партии» и справочник партий для четырёх других экранов.
Save-режим: чтение. Вызывающих четверо: вкладка партий (`useWarehouse.ts:203-229`) — обязательно
внутри `Promise.all` вместе со справочником имён товаров, чтобы строка не обогнала подпись (причина
— `:212-213`), карточка остатка (`useWarehouseStockCard.ts:46-49`, `pageSize: 100`), страница
создания обрезка (`useWarehouseOffcutCreate.ts`) и страница резки (`useWarehouseCutting.ts`).

Запрос — query: всегда `search`, `page`, `pageSize`; условно `productId`, `supplierId`, `status`,
`uomId`, `dateFrom`, `dateTo`, `sortBy`, `sortDir`
(`frontend_vue/src/services/warehouseService.ts:86-99`). Мок читает те же одиннадцать
(`frontend_vue/src/services/mocks/index.ts:664-672`); дефолты сортировки — `receivedAt`/`desc`
(`frontend_vue/src/services/mocks/warehouse.ts:593-594`).

Ответ: `BatchListResponse` = `PaginatedResponse<BatchListItem>`
(`frontend_vue/src/types/warehouse.ts:676`), проекция — `toBatchListItem`, применяется до пагинации
(`frontend_vue/src/services/mocks/warehouse.ts:612`). Списочная запись — **12 полей**
(`frontend_vue/src/types/warehouse.ts:140-156`), и `unitPrice` в ней `number | null`: партия,
которую никто не оценил, не стоит нуля (причина — `frontend_vue/src/types/warehouse.ts:149`).
**Имени товара и имени поставщика в списочной записи нет** — подпись собирается на месте показа из
справочника (правило — `frontend_vue/src/types/warehouse.ts:73-77`).

Поиск идёт по имени товара **через join** и по номеру партии
(`frontend_vue/src/services/mocks/warehouse.ts:580-585`, `_matchesProductName` — `:136-144`).
Сортировка по номеру партии — не строковая, а по правилу документных номеров (`:599`, причина
`:597-598`). Колонка «Лот» сортировку не поддерживает: страница шлёт `sortBy='lotCode'`, ветки в
моке нет (БАГ-03).

Ошибки: ни одной (`frontend_vue/src/services/mocks/warehouse.ts:565-613` — ни одного `throw`).

Обязанности сервера: поиск и сортировка по имени товара — серверный join по `productId`, а не поле
записи; умолчание сортировки обязано быть названо (§13 соглашений) и здесь это `receivedAt DESC`.

Бэкенд: не реализован — схема расходится с формой: у `warehouse_batches` единица это `unit:
String(20)` (`backend/app/modules/warehouse/shared/models.py:39`), а фронт держит `uomId` — ссылку
на справочник настроек (`frontend_vue/src/types/warehouse.ts:147-148`); колонки `margin_percent` на
схеме нет вовсе.
Реализация: `services/warehouseService.ts:getBatches` · мок `mocks/index.ts:658` →
`services/mocks/warehouse.ts:mockGetBatches`

### POST /api/warehouse/batches

Приёмка партии. Save-режим: quick-action — один вызывающий, `submit()` страницы создания партии
(`useWarehouseBatchCreate.ts:389`), после успеха переход в карточку созданной партии.

Запрос: `BatchCreatePayload` — **18 объявленных ключей**
(`frontend_vue/src/types/warehouse.ts:158-188`): `productId`, `supplierId?`, `batchNumber`,
`lotCode`, `quantity`, `uomId`, `unitPrice?`, `currency?`, `receivedAt`, `expiresAt?`, `location?`,
`certificateRef?`, `notes?` плюс пять полей закупочного следа — `receivedQuantity?`,
`receivedUnitId?`, `receivedUnitPrice?`, `receivedCurrencyId?`, `purchaseToWarehouseRate?`. Плюс
**девятнадцатый, необъявленный**: `fileIds`, добавленный пересечением типа прямо в месте вызова
(`useWarehouseBatchCreate.ts:357`, отправка `:387-389`).

`unitPrice` необязателен намеренно: пустое остаётся пустым, а не нулём
(`frontend_vue/src/types/warehouse.ts:166-172`, комментарий вызывающего
`useWarehouseBatchCreate.ts:366-368`). `currency` обязан быть базовой валютой, если прислан вообще
(`frontend_vue/src/types/warehouse.ts:174-175`).

Ответ: `WarehouseBatch` целиком — **29 полей**
(`frontend_vue/src/types/warehouse.ts:63-138`).

Ошибки: `BATCH_CURRENCY_NOT_BASE` (`frontend_vue/src/services/mocks/warehouse.ts:725`) — и он ставит
границу домена: складской слой говорит на одной валюте (`:721-723`, вывод базовой — `:65-76`). До
человека не доходит: страница ловит `catch` без разбора (`useWarehouseBatchCreate.ts:392-394`).
**Проверок существования товара, поставщика и единицы здесь нет вовсе** — `mockCreateBatch` не
заглядывает ни в один справочник (`frontend_vue/src/services/mocks/warehouse.ts:680-791`); серверу
их придётся ввести, и это новые коды, которых сегодня нет ни у кого.

Обязанности сервера, шесть, и все шесть мок уже реализует, а прежний контракт не описывал:

1. **Закупочный след автозаполняется из основных полей, но цена — никогда**: стрелка указывает в
   одну сторону, пустая закупочная цена остаётся пустой
   (`frontend_vue/src/services/mocks/warehouse.ts:697-707`).
2. **Валюта закупки подставляется базовой только когда цена пришла без валюты** (`:708-712`).
3. **Коэффициент `purchaseToWarehouseRate` выводится из отношения количеств и только при разных
   единицах** (`:713-719`). Это не курс валюты, и справочник `settings.conversions` здесь не
   участвует — см. графу «Настройки, которых мок не отслеживает».
4. **Складская цена выводится из закупочной, если та в базовой валюте**, тремя разными путями
   (`:737-753`).
5. **`marginPercent` берётся из настроек арендатора** (`:779`, значение —
   `constants.defaultMargin`).
6. **Строку остатка создание партии не заводит** (БАГ-02) — а сервер обязан, иначе товар с партиями
   не появится на первой вкладке.

`fileIds` мок принимает подписью и **никуда не записывает**: `files: []` (`:776`) — БАГ-09. Сервер
обязан превратить массив идентификаторов в список файлов (§16 соглашений).

Бэкенд: не реализован — схема покрывает все объявленные поля, кроме `margin_percent`
(`backend/app/modules/warehouse/shared/models.py:11-88`); `file_ids` там `JSON` (`:62`), то есть
массив идентификаторов, а не материализованный список.
Реализация: `services/warehouseService.ts:createBatch` · мок `mocks/index.ts:1105` →
`services/mocks/warehouse.ts:mockCreateBatch`

### GET /api/warehouse/batches/:batchId

Карточка партии. Save-режим: чтение. Вызывающих четверо: карточка партии
(`useWarehouseBatch.ts:198`, вместе со справочником имён), карточка обрезка — ради товара **партии**,
а не обрезка (`useWarehouseOffcutCard.ts:233-241`, причина `:225-230`), страница резки
(`useWarehouseCutting.ts`) и сама вьюха карточки (`views/admin/warehouse/WarehouseBatchCard.vue`).

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:102-104`).

Ответ: `WarehouseBatch` целиком, копией записи
(`frontend_vue/src/services/mocks/warehouse.ts:641-645`) — **29 полей**
(`frontend_vue/src/types/warehouse.ts:63-138`). Три из них требуют оговорки:

- `files?` объявлено необязательным **сознательно**: контракт складских сущностей его не описывает,
  значит гарантии сервера нет (`frontend_vue/src/types/warehouse.ts:65-70`);
- `unitPrice` и `totalCost` — `number | null` (`:99`, `:101`), и `null` здесь значит «никто не
  назвал цену», а не «бесплатно»;
- `currency` — всегда базовая валюта и ничто иное (`:102-103`).

`BatchStatus` — **11 значений** (`frontend_vue/src/types/warehouse.ts:21-32`), и статус **не
хранится, а выводится** из журнала движений (см. графу «Производные значения»).

Ошибки: `BATCH_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:643`) — доходит до человека
сырой строкой (`useWarehouseBatch.ts:230`).

Ветка мока ловит путь регуляркой `([^/]+)$`, и внутри неё стоит **недостижимая** проверка
`path.endsWith('/audit')` (`frontend_vue/src/services/mocks/index.ts:682-684`): класс `[^/]` слэша
не содержит, значит условие не выполнится никогда. То же в трёх соседних ветках — остатка, обрезка
и нехватки (`:647-649`, `:733-735`, `:801-803`), БАГ-07. Серверу это ничего не предписывает:
вложенный `/audit` у него отдельный роут (§18 соглашений).

Обязанности сервера: `supplierName` на партии — **снимок**, разошедшийся со справочником: ни один
из 15 различных `supplierId` в сидах партий не существует в каталоге поставщиков (БАГ-08), то есть
проверить имя нечем. Сервер обязан решить, снимок это или join; сегодня это единственный источник
имени.

Бэкенд: не реализован — на схеме нет колонок под `margin_percent` и `supplier_name`, зато есть
`exchange_rate` (`backend/app/modules/warehouse/shared/models.py:86-88`), которого нет во фронте:
конверсии валют в проекте нет нигде (§14 соглашений). Зачем колонка — **решение владельца**.
Реализация: `services/warehouseService.ts:getBatch` · мок `mocks/index.ts:679` →
`services/mocks/warehouse.ts:mockGetBatch`

### PATCH /api/warehouse/batches/:batchId

Правка партии из карточки. Тело — дельта, ответ — партия целиком.
Save-режим: clean-slate. Признак грязи собран из трёх: `dirty.isDirty`, непустой список ожидающих
файлов и удаление ранее приложенного файла (`useWarehouseBatch.ts:135-152`). Discard возвращает
форму и восстанавливает удалённые файлы из снимка (`:306-329`).

Запрос: объявлено **10 ключей** `BatchPatchPayload` — `batchNumber?`, `lotCode?`, `quantity?`,
`unitPrice?`, `currency?`, `location?`, `certificateRef?`, `status?`, `notes?`, `fileIds?`
(`frontend_vue/src/types/warehouse.ts:190-204`). **Уезжает больше.** Дельту собирает
`useDirtyCheck.diff()` по форме карточки (`useWarehouseBatch.ts:241`), а в форме живут `uomId`,
`marginPercent` и четыре части адреса — `locationRack`, `locationRow`, `locationCell`,
`locationNotes` (`:92-128`); `diff()` возвращает любой изменившийся ключ верхнего уровня
(`frontend_vue/src/composables/useDirtyCheck.ts:62-77`), после чего к дельте добавляется склеенный
`location` (`useWarehouseBatch.ts:242-248`) и, если есть, `fileIds` (`:252-254`). Итого шесть
необъявленных ключей на проводе, и мок кладёт их в запись через `Object.assign`
(`frontend_vue/src/services/mocks/warehouse.ts:804`) — БАГ-10. **Серверу принимать их нельзя**:
контракт тела — те десять ключей, а `marginPercent` и `uomId` требуют отдельного решения.

Ответ: `WarehouseBatch` целиком.

Ошибки: `BATCH_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:798`) и
`BATCH_CURRENCY_NOT_BASE` (`:802`) — граница валюты та же, что при создании, и держится «и на
входе, и потом» (`:799-800`). До человека не доходит ни один
(`useWarehouseBatch.ts:299-301`).

Обязанности сервера:

1. **`totalCost` пересчитывается, если пришли `unitPrice` или `quantity`**
   (`frontend_vue/src/services/mocks/warehouse.ts:805-808`), и остаётся `null`, пока цены нет.
2. **`status` в дельте — ложное поле.** Мок принимает любое значение и не сверяет его с агрегатами,
   а следующий же записанный `writeMovement` пересчитает статус заново (`:1347`). Сервер обязан
   либо отвергать `status` в дельте, либо признать его подсказкой, которую пересчёт перекроет.
3. **Смена адреса — это второй HTTP-запрос без общей транзакции.** Save шлёт один PATCH и следом,
   если `location` изменился, `POST /api/warehouse/movements` с `type: 'transfer'`
   (`useWarehouseBatch.ts:260-276`); неудача второго только показывает info-тост (`:272-274`), то
   есть партия остаётся с новым адресом и без записи о переносе. **Решено 2026-09-09 (П43):**
   склад назван атомарным поимённо — PATCH и движение обязаны применяться одной транзакцией,
   целиком либо никак ([§15](00-conventions.md)).
4. «Last-write-wins» прежнего контракта кодом не выражено ничем: ни `If-Match`, ни версии в
   `WarehouseBatch` нет (§11 соглашений).

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:patchBatch` · мок `mocks/index.ts:1301` →
`services/mocks/warehouse.ts:mockPatchBatch`

### DELETE /api/warehouse/batches/:batchId

Удаление партии. Save-режим: quick-action по подтверждению модала. Трое вызывающих: карточка партии
с переходом на вкладку партий (`useWarehouseBatch.ts:331-349`), список с перезагрузкой
(`useWarehouse.ts:320`) и вьюха списка (`views/admin/warehouse/WarehousePage.vue`).

Запрос: тела нет (`frontend_vue/src/services/warehouseService.ts:114-116`); `If-Match` не шлётся,
хотя ветка удаления мока читать его умеет (`frontend_vue/src/services/mocks/index.ts:1428`).

Ответ: `Promise<void>`; на проводе `ApiResponse<null>`.

Ошибки: `BATCH_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:818`) и
`BATCH_LINKED_TO_ORDER` (`:819`). Второй — **единственный код домена, который читается правильно с
обеих сторон**: `err?.code === 'BATCH_LINKED_TO_ORDER' || err?.message === …`
(`useWarehouseBatch.ts:341`). Тот же вызов со списка кода не читает вовсе
(`useWarehouse.ts:318-326`).

Обязанности сервера — **каскад, и он не описан ни одним источником одинаково.** Мок вырезает одну
запись и не трогает ни `movementStore`, ни `offcutStore`
(`frontend_vue/src/services/mocks/warehouse.ts:820`), оставляя их висеть на несуществующей партии
(БАГ-11). Схема требует другого, и требует обязательно: `warehouse_movements.batch_id` и
`warehouse_offcuts.batch_id` — `ondelete="CASCADE"`
(`backend/app/modules/warehouse/shared/models.py:102-107`, `:142-147`),
`warehouse_offcuts.parent_batch_id` — `SET NULL` (`:153-157`), `warehouse_deficits.batch_id` —
`SET NULL` (`:185-189`), `stock_audit_entries.batch_id` — `CASCADE` (`:240-245`). **Старший источник
здесь схема**: у мока политики нет, а у схемы она выражена четырьмя разными FK, и сервер обязан её
исполнять. Предупреждение о числе связанных записей до подтверждения — часть прежнего описания,
которой в коде нет; см. «Чего в домене нет».

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:deleteBatch` · мок `mocks/index.ts:1607` →
`services/mocks/warehouse.ts:mockDeleteBatch`

### GET /api/warehouse/batches/:batchId/aggregates

Распределение металла партии по статусам: сколько лежит, сколько продано, сколько списано.
Save-режим: чтение. Двое вызывающих: карточка партии (`useWarehouseBatch.ts:367-377`) и карточка
остатка, которая зовёт его **в цикле по всем партиям товара** и складывает результаты сама
(`useWarehouseStockCard.ts:42-74`, вызов `:55`) — N+1 запрос на открытие экрана (БАГ-12).

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:204-206`).

Ответ: `BatchStatusAggregate[]` — голый массив из трёх полей `{type, quantity, uomId}`
(`frontend_vue/src/types/warehouse.ts:548-553`), собирается заново при каждом чтении
(`frontend_vue/src/services/mocks/warehouse.ts:1415-1451`). **Порядок значащий**: сперва `receipt`
(остаток партии), затем прочие по убыванию количества, и только с `quantity > 0` (`:1440-1449`).

Ошибки: ни одной — неизвестная партия отвечает **пустым массивом**, а не `BATCH_NOT_FOUND`
(`frontend_vue/src/services/mocks/warehouse.ts:1417`), тогда как соседние эндпоинты той же партии
бросают. БАГ-06.

Обязанности сервера, три:

1. **Движение с заполненным `offcutId` в агрегаты партии не попадает** — кроме самой резки:
   `movesOffcut` отсекает его (`frontend_vue/src/services/mocks/warehouse.ts:1425`, определение
   `:380-382`, причина `:365-379`). Иначе тот же металл был бы посчитан дважды.
2. **`receipt` берётся из `quantityRemaining`, а не из журнала** (`:1440`).
3. **Возврат уменьшает агрегат только если его `referenceType` принадлежит списку уносящих типов**
   (`:1426-1431`, список `:355-363`). Домен заказов пишет туда `order-shipment`,
   `order-shipment-cancelled`, `order-return` — ни одного из них в списке нет, то есть возврат
   отгрузки агрегат продажи не уменьшает (БАГ-13). Согласовать два словаря — работа сервера, и
   какой из них главный, **решает владелец**.

Бэкенд: не реализован — колонок под агрегаты на схеме нет и быть не должно: они производные целиком
(`backend/app/modules/warehouse/shared/models.py:11-88`).
Реализация: `services/warehouseService.ts:getBatchAggregates` · мок `mocks/index.ts:693` →
`services/mocks/warehouse.ts:mockGetBatchAggregates`

### GET /api/warehouse/batches/:batchId/active-sales

Продажи партии, которые ещё можно вернуть: результат передаётся в модал создания движения, где
выбирается продажа для возврата (`views/admin/warehouse/CreateMovementModal.vue:511-514`).
Save-режим: чтение. Один вызывающий — карточка партии (`useWarehouseBatch.ts:379-389`).

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:208-210`).

Ответ: `BatchActiveSale[]` — шесть полей `{id, movementId, quantity, uomId, referenceId, soldAt}`
(`frontend_vue/src/types/warehouse.ts:557-567`). **`id` синтетический и позиционный**:
`sale-${batchId}-${idx}` (`frontend_vue/src/services/mocks/warehouse.ts:1473`), то есть меняется при
появлении новой продажи — в отличие от всего остального в домене, что адресуется собственным id
(§19 соглашений). Сервер обязан выдать устойчивый идентификатор либо не выдавать его вовсе.

Ошибки: ни одной — неизвестная партия отвечает пустым массивом
(`frontend_vue/src/services/mocks/warehouse.ts:1455`). БАГ-06.

Обязанности сервера, три:

1. **Возвраты сопоставляются продажам по `referenceId`, а не по движению** (`:1457-1462`, `:1468`).
2. Следствие: **возврат клиента, записанный доменом заказов с `referenceId = orderReturn.id`, ни
   одной продаже не сопоставится**; сопоставится только отмена отгрузки, у которой `referenceId`
   совпадает с продажей (БАГ-13).
3. **Продажа с `referenceId: null` не сопоставляется ничему и остаётся активной навсегда**
   (`:1468`).

Бэкенд: не реализован — производное целиком, колонок под это на схеме нет.
Реализация: `services/warehouseService.ts:getBatchActiveSales` · мок `mocks/index.ts:698` →
`services/mocks/warehouse.ts:mockGetBatchActiveSales`

### GET /api/warehouse/batches/:batchId/audit

Журнал изменений партии. **Единственный из пяти складских журналов, у которого есть свой
вызывающий**: `loadAudit()` карточки партии (`useWarehouseBatch.ts:439-450`), внутри `Promise.all`
при загрузке (`:222-228`); ошибку глотает, оставляя пустой лог (`:445-448`).
Save-режим: чтение.

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:338-340`).

Ответ: `StockAuditEntry[]` — голый массив; мок отдаёт `structuredClone` журнала партии, и причина
копии названа прямо: живой массив позволял вызывающему править стор чтением
(`frontend_vue/src/services/mocks/warehouse.ts:1872-1879`).

Ошибки: ни одной — неизвестная партия отвечает пустым массивом (`:1878`), парный DELETE на том же
условии бросает `BATCH_NOT_FOUND` (`:1883`). БАГ-06.

Обязанности сервера: запись обязана несть `id` — прежнее описание его в примере ответа не имело, а
без него парный DELETE не работает (см. «Чего в домене нет»). Журнал приходит **и полем сущности
тоже** (`WarehouseBatch.auditLog?`, `frontend_vue/src/types/warehouse.ts:123`), и оба пути обязаны
отдавать одно и то же.

Бэкенд: не реализован — но именно у этого журнала хранение на схеме есть:
`stock_audit_entries` привязана к партии (`backend/app/modules/warehouse/shared/models.py:229-258`),
автор — `user_id` с `ondelete="SET NULL"` (`:246-250`), тексты — `JSONB` (`:251`, `:253`). У
остальных четырёх журналов домена таблицы нет.
Реализация: `services/warehouseService.ts:getBatchAudit` · мок `mocks/index.ts:688` →
`services/mocks/warehouse.ts:mockGetBatchAudit`

### DELETE /api/warehouse/batches/:batchId/audit/:entryId

Удаление записи журнала партии. Два вызывающих: карточка партии с локальной правкой списка
(`useWarehouseBatch.ts:452-461`) и общая лента аудита
(`frontend_vue/src/services/auditFeedService.ts:70`).
Save-режим: quick-action по подтверждению модала.

Запрос: тела нет, два сегмента пути (`frontend_vue/src/services/warehouseService.ts:342-344`).

Ответ: `Promise<void>`.

Ошибки: `BATCH_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:1883`) и
`AUDIT_ENTRY_NOT_FOUND` (`:1885`). До человека не доходит ни один — карточка показывает общий тост
(`useWarehouseBatch.ts:458`).

Обязанности сервера: те же, что у удаления записи журнала остатка — отказ вместо no-op, адресация по
`id`, и решение владельца о праве. Из всех шести таких эндпоинтов домена прежний контракт описывал
**только этот**, и описывал верно.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:deleteBatchAuditEntry` · мок `mocks/index.ts:1441` →
`services/mocks/warehouse.ts:mockDeleteBatchAuditEntry`

---

## Обрезки (offcuts)

Обрезок — **один физический кусок**, и делится он только резкой: «остатка», из которого вычитают
чужой хват, у него нет. Отсюда два правила, которых нет больше нигде в проекте: занят кусок целиком,
и занятость **выводится**, а не хранится (`takenOffcuts`,
`frontend_vue/src/services/mocks/warehouse.ts:998-1000`, причина расписана `:961-971` и `:978-997`).

### GET /api/warehouse/offcuts

Список обрезков — вкладка «Обрезки», а также свои обрезки на карточке партии.
Save-режим: чтение. Двое вызывающих: вкладка вместе со справочником имён
(`useWarehouse.ts:231-255`) и карточка партии, которая просит свои обрезки **по номеру партии**
(`useWarehouseBatch.ts:423-437`) — БАГ-21, см. `GET /api/warehouse/movements`.

Запрос — query: всегда `search`, `page`, `pageSize`; условно `productId`, `status`, `uomId`,
`offcutType`, `categoryIds` (склейка через запятую), `batchNumber`, `sortBy`, `sortDir`
(`frontend_vue/src/services/warehouseService.ts:124-138`). Мок читает те же одиннадцать
(`frontend_vue/src/services/mocks/index.ts:709-717`); дефолты сортировки —
`createdAt`/`desc` (`frontend_vue/src/services/mocks/warehouse.ts:857-858`).

Ответ обязан быть `OffcutListResponse` = `PaginatedResponse<OffcutListItem>`
(`frontend_vue/src/types/warehouse.ts:677`), где `OffcutListItem` — **14 полей** (`:252-269`). Мок при
этом отдаёт **не списочную запись, а сам обрезок**: `paginate(filtered, …)` над хранилищем без
проекции (`frontend_vue/src/services/mocks/warehouse.ts:866`), тогда как у партий и движений
проекция есть (`:612`, `:1192`). То есть на проводе едут `thicknessMm`, `notes`, `qrData`, `files`,
`auditLog` и оба таймстампа, которых тип не объявляет — БАГ-16. **Контракт задаёт тип, а не
поведение мока**: сервер отдаёт 14 полей.

Поиск идёт **только по имени товара**, номер обрезка в него не входит
(`frontend_vue/src/services/mocks/warehouse.ts:840-843`) — в отличие от партий и движений, где ищут
ещё и по `batchNumber` (`:583`, `:1160`). Сортировка поддержана по трём ключам: `createdAt`,
`productName`, `quantity` (`:861-863`); ещё семь колонок вкладки сортировку не делают (БАГ-03).

Ошибки: ни одной (`frontend_vue/src/services/mocks/warehouse.ts:825-867`).

Бэкенд: не реализован — схема куска беднее формы: `warehouse_offcuts` знает шесть содержательных
колонок (`offcut_type`, `quantity`, `unit`, `status`, `location`, `notes`) плюс две ссылки на партию
и `product_id` (`backend/app/modules/warehouse/shared/models.py:131-165`); ни одного размера, ни
веса, ни категории, ни `qr_data`, ни `order_id` там нет — БАГ-17.
Реализация: `services/warehouseService.ts:getOffcuts` · мок `mocks/index.ts:703` →
`services/mocks/warehouse.ts:mockGetOffcuts`

### POST /api/warehouse/offcuts

Ручное создание обрезка — тот же резолвер размера и тот же владелец количества, что у резки.
Save-режим: quick-action. Один вызывающий — `submit()` страницы создания обрезка
(`useWarehouseOffcutCreate.ts:298-320`), после успеха переход в карточку.

Запрос: `OffcutCreatePayload` — **12 ключей**: `batchId`, `categoryId?`, `offcutType?`, `lengthMm?`,
`widthMm?`, `thicknessMm?`, `weightKg?`, `quantity`, `uomId`, `location?`, `notes?`, `fileIds?`
(`frontend_vue/src/types/warehouse.ts:307-322`). Вызывающий шлёт **реактивную форму целиком**, а в
ней ещё четыре части адреса: `form: OffcutCreatePayload & { locationRack; locationRow; locationCell;
locationNotes }` (`useWarehouseOffcutCreate.ts:32-54`), то есть на проводе 16 ключей вместо 12 —
БАГ-10. Сервер принимает 12.

Ответ: `WarehouseOffcut` целиком — 21 поле (`frontend_vue/src/types/warehouse.ts:208-250`).

Ошибки: `BATCH_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:903`),
`INSUFFICIENT_QUANTITY` (`:910`) и три кода `MATERIAL_ERROR_CODE` из `resolveOffcutMaterial` —
`BATCH_UNIT_NOT_SUPPORTED`, `OFFCUT_DIMENSION_MISSING`, `OFFCUT_PIECES_NOT_INTEGER` (бросок `:906`).
Прежний контракт называл четыре из пяти, без `BATCH_UNIT_NOT_SUPPORTED` — см. «Чего в домене нет».

Обязанности сервера, пять:

1. **Партия обязательна**, и причина названа в коде: без неё у куска нет ни единицы, ни номера, ни
   цены (`frontend_vue/src/services/mocks/warehouse.ts:878-882`).
2. **С партии списывается материал куска, а не его `quantity`**: счётчик кусков и количество
   материала — разные величины (`:883-885`). Размер считает `resolveOffcutMaterial` — одна функция
   на ручной путь и на резку.
3. **Количество партии уменьшает только движение**, второго вычитания нет нигде (`:886-887`, запись
   `:947-956`); нулевой расход движения не пишет (`:944-946`).
4. **`productId` в теле не принимается** — товар берётся у партии (`:920-923`); в сидах эти два поля
   успели разойтись у десяти записей из тринадцати, и поле убрали.
5. **`fileIds` объявлен в payload и никуда не пишется**: `files: []` (`:937`) — БАГ-09.

Созданный кусок получает `status: 'available'` (`:933`) и id вида `offcut-NNN` (`:912`) — против
`who-NNN` в сидах: два пространства id в одном домене (§19 соглашений).

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:createOffcut` · мок `mocks/index.ts:1109` →
`services/mocks/warehouse.ts:mockCreateOffcut`

### GET /api/warehouse/offcuts/offers

Обрезки, которые строка заказа может взять по этому товару. **Единственная дорога куска в заказ** —
в автоматический FIFO обрезки не попадают и не будут
(`frontend_vue/src/types/warehouse.ts:280-282`,
`frontend_vue/src/services/mocks/warehouse.ts:1021-1035`).
Save-режим: чтение. Один вызывающий — диалог добавления позиций заказа, после выбора товара
(`views/admin/orders/AddOrderItemsModal.vue:281`).

Запрос: один query — `productId` (`frontend_vue/src/services/warehouseService.ts:148-150`).

Ответ: `OffcutOffer[]` — голый массив из **15 полей**
(`frontend_vue/src/types/warehouse.ts:284-305`). Отдельный тип, а не `OffcutListItem`, и это
решение: три поля — `material`, `batchUomId`, `unitCost` — не выводятся из списочной записи и
приходят от родительской партии через `offcutAllocation`
(`frontend_vue/src/services/mocks/warehouse.ts:1044`, `:1058-1061`; причина —
`frontend_vue/src/types/warehouse.ts:271-283`).

Ошибки: ни одной — `mockGetOffcutOffers` не бросает, а молча пропускает кусок, который нельзя
предложить (`frontend_vue/src/services/mocks/warehouse.ts:1036-1065`). Парная запись выбранных
кусков в строку заказа на те же случаи бросает четыре кода — `OFFCUT_NOT_FOUND`,
`OFFCUT_PRODUCT_MISMATCH`, `OFFCUT_NOT_AVAILABLE`, `OFFCUT_SIZE_NOT_EXPRESSIBLE` (`:1088-1095`), и
это правило, названное в коде: **список — вежливость, отказ — правило** (`:1074-1078`).

Обязанности сервера, три:

1. **Предлагается только свободный кусок**: `status === 'available'` и никем не занятый
   (`:1040-1042`).
2. **Занятость склад спрашивает у заказов регистрацией, а не считает сам**
   (`registerOffcutClaimLookup`, `:972-976`); пока никто не зарегистрировался, занятых кусков нет, и
   это правда, а не заглушка (`:998-1000`). Спрашивается разбивка строки, а не резерв, потому что
   разбивка шире и старше (`:978-997`). Следствие названо прямо: удалённая строка отпускает кусок
   сама, а аннулированный заказ не отпускает, пока его строки живы (`:992-996`).
3. **Кусок, чей размер невыразим в единице партии, из списка исчезает молча** (`:1044-1045`) —
   показать его значило бы пообещать выбор, который откажут на сохранении.

Форма и правила отбора покрыты спекой
[`mocks/offcut-offers-route.spec.ts`](../../../frontend_vue/src/services/mocks/offcut-offers-route.spec.ts).

Бэкенд: не реализован. Правило оценки куска живёт в домене заказов — `offcutAllocation`
(`frontend_vue/src/services/orderLines.ts`, импорт `services/mocks/warehouse.ts:58`).
Реализация: `services/warehouseService.ts:getOffcutOffers` · мок `mocks/index.ts:726` →
`services/mocks/warehouse.ts:mockGetOffcutOffers`

**Порядок разбора важен**: сравнение пути строкой стоит **до** регулярки карточки обрезка
(`frontend_vue/src/services/mocks/index.ts:726` против `:730`, порядок закреплён комментарием
`:724-725`). У сервера с одним маршрутом `/{id}` порядок обратный по построению — §18 соглашений; то
есть **сервер обязан объявить `/offers` отдельным роутом раньше `/{offcut_id}`**, иначе `offers`
будет разобран как идентификатор.

### GET /api/warehouse/offcuts/:offcutId

Карточка обрезка. Save-режим: чтение. Один вызывающий — `load()`
(`useWarehouseOffcutCard.ts:195-223`), который следом тянет движения куска (`:216`) и товар
**партии** ради плотности материала (`:217`, причина `:225-230`).

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:152-154`).

Ответ: `WarehouseOffcut` целиком, копией — **21 поле**
(`frontend_vue/src/types/warehouse.ts:208-250`).

Ошибки: `OFFCUT_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:871`) — доходит до
человека сырой строкой (`useWarehouseOffcutCard.ts:219`).

Обязанности сервера, три:

1. **`productId` куска обязан совпадать с товаром партии**, и это правило домена, а не совпадение
   (`frontend_vue/src/types/warehouse.ts:213-219`).
2. **`weightKg` — ручной ввод, а не вывод**: `null` означает «пусть отвечает расчёт», и хранить
   выведенное значение запрещено (`frontend_vue/src/types/warehouse.ts:328-337`, потребитель
   `useWarehouseOffcutCard.ts:243-269`).
3. **`files?` необязательно сознательно** (`frontend_vue/src/types/warehouse.ts:242`), как у партии.

Отдельно: `WarehouseOffcut.auditLog` объявлен **обязательным** (`:249`), в отличие от
`WarehouseBatch.auditLog?` (`:123`) — две формы одного поля у соседних сущностей одного домена;
серверу выбирать одну.

Бэкенд: не реализован — БАГ-17.
Реализация: `services/warehouseService.ts:getOffcut` · мок `mocks/index.ts:730` →
`services/mocks/warehouse.ts:mockGetOffcut`

### PATCH /api/warehouse/offcuts/:offcutId

Правка обрезка. Save-режим: clean-slate в карточке и quick-action в списке — инлайновая смена
статуса.

Запрос: объявлено **пять ключей** `OffcutPatchPayload` — `status?`, `notes?`, `location?`,
`weightKg?`, `fileIds?` (`frontend_vue/src/types/warehouse.ts:324-341`). Фактически из карточки
уезжает больше: дельту собирает `useDirtyCheck.diff()` по форме, где живут четыре части адреса
(`useWarehouseOffcutCard.ts:275`, форма `:99-117`), после чего добавляется склеенный `location`
(`:281-287`) — БАГ-10. Второй вызывающий, вкладка обрезков, шлёт только `{ status }`
(`useWarehouse.ts:364`).

Ответ: `WarehouseOffcut` целиком, копией (`frontend_vue/src/services/mocks/warehouse.ts:1108`);
`updatedAt` ставит сервер (`:1107`).

Ошибки: `OFFCUT_NOT_FOUND` (`:1106`). **Проверок содержимого нет ни одной**: `Object.assign` примет
любой `status` и любой вес (`:1107`) — сервер обязан проверять `status` по перечню `OffcutStatus`
(восемь значений, `frontend_vue/src/types/warehouse.ts:35-43`).

Обязанности сервера, три:

1. **Смена статуса из интерфейса — это два независимых запроса.** Карточка шлёт PATCH и следом
   **до двух** `POST /api/warehouse/movements` — `transfer` при смене адреса и движение по типу
   нового статуса (`useWarehouseOffcutCard.ts:294-333`), оба с `.catch(() => {})`, то есть их провал
   не виден нигде. Список делает то же одним движением, чей провал заглушен комментарием «Movement
   creation is secondary» (`useWarehouse.ts:362-383`). Кусок остаётся в статусе без движения.
2. **При записи движения сервер ставит статус куска сам, по типу движения**
   (`frontend_vue/src/services/mocks/warehouse.ts:1337-1344`, таблица `:294-302`) — то есть
   клиентский PATCH и серверное правило пишут одно и то же поле с двух сторон. Какое из двух
   старше — **решение владельца**.
3. **`weightKg: null` — это не «нет веса», а «считай сам»**
   (`frontend_vue/src/types/warehouse.ts:328-337`).

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:patchOffcut` · мок `mocks/index.ts:1328` →
`services/mocks/warehouse.ts:mockPatchOffcut`

### DELETE /api/warehouse/offcuts/:offcutId

Удаление обрезка. Save-режим: quick-action по подтверждению модала. Трое вызывающих: карточка
(`useWarehouseOffcutCard.ts:385`), список (`useWarehouse.ts:328-336`) и вьюха списка
(`views/admin/warehouse/WarehousePage.vue`).

Запрос: тела нет (`frontend_vue/src/services/warehouseService.ts:164-166`).

Ответ: `Promise<void>`.

Ошибки: `OFFCUT_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:1113`) и
`OFFCUT_LINKED_TO_ORDER` (`:1114`). Второй читается **только из `message`**
(`useWarehouseOffcutCard.ts:385`), тогда как парная проверка у партии смотрит на оба поля
(`useWarehouseBatch.ts:341`) — БАГ-18.

Обязанности сервера, три, и все три сегодня не исполнены:

1. **Удаление куска не возвращает материал партии**: движение `offcut`, списавшее его, остаётся в
   журнале, а пересчёт остатка идёт по этому же журналу
   (`frontend_vue/src/services/mocks/warehouse.ts:397-413`) — металл исчезает из обоих мест
   (БАГ-19). Что обязано происходить с партией, **решает владелец**.
2. **`orderId` куска — единственный сторож удаления** (`:1111-1116`), а хват строки заказа, по
   которому кусок и считается занятым, здесь не спрашивается вовсе (`takenOffcuts` `:998-1000`).
3. **Движения куска остаются висеть на удалённом `offcutId`** — на схеме колонки `offcut_id` нет
   вовсе (БАГ-23), так что политику придётся вводить вместе с колонкой.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:deleteOffcut` · мок `mocks/index.ts:1613` →
`services/mocks/warehouse.ts:mockDeleteOffcut`

### GET /api/warehouse/offcuts/:offcutId/audit

Журнал изменений обрезка. **Вызывающего у этого пути нет** — карточка берёт журнал полем ответа
карточки (`useWarehouseOffcutCard.ts:215`); см. «Клиент написан, UI нет».
Save-режим: чтение.

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:348-350`).

Ответ: `StockAuditEntry[]`, `structuredClone` журнала куска
(`frontend_vue/src/services/mocks/warehouse.ts:1889-1892`).

Ошибки: ни одной — неизвестный кусок отвечает пустым массивом (`:1891`), парный DELETE бросает
`OFFCUT_NOT_FOUND` (`:1896`). БАГ-06.

Обязанности сервера: журнал приходит и полем сущности, и этим эндпоинтом; сервер обязан отдавать по
обоим одно и то же.

Бэкенд: не реализован — таблицы под журнал куска на схеме нет: единственная —
`stock_audit_entries` с обязательным `batch_id`
(`backend/app/modules/warehouse/shared/models.py:240-245`).
Реализация: `services/warehouseService.ts:getOffcutAudit` · мок `mocks/index.ts:739` →
`services/mocks/warehouse.ts:mockGetOffcutAudit`

### DELETE /api/warehouse/offcuts/:offcutId/audit/:entryId

Удаление записи журнала обрезка. Два вызывающих: карточка (`useWarehouseOffcutCard.ts:185-193`) и
общая лента (`frontend_vue/src/services/auditFeedService.ts:72`).
Save-режим: quick-action.

Запрос: тела нет, два сегмента пути (`frontend_vue/src/services/warehouseService.ts:352-354`).

Ответ: `Promise<void>`.

Ошибки: `OFFCUT_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:1896`) и
`AUDIT_ENTRY_NOT_FOUND` (`:1898`); до человека не доходит ни один
(`useWarehouseOffcutCard.ts:191`).

Обязанности сервера: те же, что у четырёх остальных удалений записи журнала. **Правила у всех пяти
складских журналов одинаковы, и сказать это стоит один раз**, а не разойтись пятью формулировками:
отказ вместо no-op, адресация по `id` записи, единственный путь к записи (§9 соглашений).

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:deleteOffcutAuditEntry` · мок `mocks/index.ts:1447` →
`services/mocks/warehouse.ts:mockDeleteOffcutAuditEntry`

---

## Движения (movements)

Движение — **единственный владелец количества партии**: второго вычитания нет нигде
(`writeMovement`, `frontend_vue/src/services/mocks/warehouse.ts:1264-1273`). Из журнала движений
выводятся и остаток, и статус партии — `syncBatchQuantities` объявлен инвариантом, а не
инициализацией, с прямым указанием, что «бэкенд сделает ровно этот пересчёт при старте с
сохранённого журнала» (`:389-416`).

### GET /api/warehouse/movements

Список движений — вкладка «Движения», журнал карточки партии и журнал карточки обрезка.
Save-режим: чтение. Трое вызывающих: вкладка (`useWarehouse.ts:257-281`), карточка партии по
`batchNumber` (`useWarehouseBatch.ts:351-365`) и карточка обрезка по `offcutId`
(`useWarehouseOffcutCard.ts:165-179`).

Запрос — query: всегда `search`, `page`, `pageSize`; условно `type`, `productId`, `uomId`,
`categoryIds`, `batchNumber`, `referenceId`, `offcutId`, `dateFrom`, `dateTo`, `sortBy`, `sortDir`
(`frontend_vue/src/services/warehouseService.ts:174-191`). Мок читает те же четырнадцать
(`frontend_vue/src/services/mocks/index.ts:761-772`).

Ответ: `MovementListResponse` = `PaginatedResponse<MovementListItem>`
(`frontend_vue/src/types/warehouse.ts:678`), проекция — `toMovementListItem`
(`frontend_vue/src/services/mocks/warehouse.ts:1120-1137`): **14 полей из 20**, без `totalCost`,
`fromLocation`, `toLocation`, `performedBy`, `createdAt` и `auditLog`.

Правила сопоставления фильтров: `productId`, `referenceId` и `offcutId` — точное совпадение, а
`batchNumber` — подстрока (`frontend_vue/src/services/mocks/warehouse.ts:1164-1171`). `categoryIds`
**принимается и не применяется** — фильтра по нему в теле функции нет (`:1156-1174`), БАГ-20.

Ошибки: ни одной (`:1139-1193`).

Обязанности сервера: `unitPrice` в списочной записи объявлен `number`, а не `number | null`
(`frontend_vue/src/types/warehouse.ts:392`), хотя партия без цены существует и движение получает от
неё ноль (`frontend_vue/src/services/mocks/warehouse.ts:1238`) — то есть в этом одном месте домена
неизвестная цена уже превращена в нуль, и сервер обязан либо это узаконить, либо расширить тип.

**Карточка партии фильтрует свои движения по номеру партии, а не по её id**
(`useWarehouseBatch.ts:356`), то есть две партии с одинаковым номером покажут друг другу чужой
журнал: уникальности `batch_number` нет ни в моке, ни на схеме
(`backend/app/modules/warehouse/shared/models.py:33` — просто `String(100)`). БАГ-21. Серверу нужен
либо фильтр по `batchId`, либо уникальность номера.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:getMovements` · мок `mocks/index.ts:755` →
`services/mocks/warehouse.ts:mockGetMovements`

### POST /api/warehouse/movements

Проводка движения — приход, продажа, списание, перенос, возврат, коррекция, резка.
Save-режим: quick-action, пятеро вызывающих: модал создания движения на карточке партии
(`views/admin/warehouse/CreateMovementModal.vue:532`), автосоздание `transfer` при смене адреса
партии (`useWarehouseBatch.ts:262`), кнопки движений карточки партии (`:406`), два автосоздания при
сохранении карточки обрезка (`useWarehouseOffcutCard.ts:299`, `:316`) и смена статуса обрезка из
списка (`useWarehouse.ts:367`). Ответа не читает ни один из пяти.

Запрос: `MovementCreatePayload` — **13 ключей**: `type`, `batchId`, `offcutId?`, `quantity`,
`unitPrice?`, `referenceId?`, `referenceType?`, `fromLocation?`, `toLocation?`, `performedBy?`,
`notes?`, `movedAt?`, `currency?` (`frontend_vue/src/types/warehouse.ts:400-415`). Два ключа не шлёт
никто — `unitPrice` и `currency`, — и `currency` мок **игнорирует по построению**: движение всегда
получает валюту партии (`frontend_vue/src/services/mocks/warehouse.ts:1249`). БАГ-22.

`type` — `MovementType`, **11 значений** (`frontend_vue/src/types/warehouse.ts:7-18`). Проверки типа
в моке нет: `data.type` приводится приведением
(`frontend_vue/src/services/mocks/warehouse.ts:1229`), то есть любая строка станет движением —
сервер обязан проверять по перечню.

`batchId` обязателен **и у движения куска тоже**: движение всегда пишется против партии, потому что
номер, товар, единицу, цену и валюту запись копирует оттуда (`:1216-1221`).

Ответ: `WarehouseMovement` целиком — **20 полей** (`frontend_vue/src/types/warehouse.ts:345-380`).

Ошибки: `BATCH_NOT_FOUND`, и он бросается **до любой записи**, в том числе до переноса адреса
(`frontend_vue/src/services/mocks/warehouse.ts:1222-1223`, причина `:1216-1221`).

Обязанности сервера, шесть:

1. **Запись и списание — одна операция.** `writeMovement` синхронна намеренно: отгрузка обязана
   записаться и списать в один заход, `await` посередине оставил бы товар проданным и лежащим на
   полке (`:1195-1201`).
2. **Что уносит металл с партии — один список на два правила.** `OUTGOING_MOVEMENT_TYPES` — семь
   типов (`:355-363`): по нему списывает запись и по нему же остаток пересчитывается из журнала.
   Разойдись они — пересчёт «вернул» бы партии то, что при записи с неё ушло, молча и только после
   пересборки хранилища (`:347-354`).
3. **Движение с заполненным `offcutId` двигает кусок, а не партию** — исключение только сам тип
   `offcut`, то есть резка (`movesOffcut` `:380-382`, причина `:365-379`). Такое движение не меняет
   количества партии, не попадает в её агрегаты и не влияет на её статус.
4. **Статус куска сервер ставит сам, по типу движения** — `OFFCUT_STATUS_BY_MOVEMENT`, семь типов
   (`:294-302`), применение в той же функции, где партия теряет количество (`:1337-1344`), и причина
   названа: отдельный вызов рядом когда-нибудь забудут позвать (`:1325-1336`).
5. **Перенос меняет место, а не количество**, и место пишется по-разному для куска и для партии:
   кусок переезжает целиком при любом количестве, партия — только когда уходит весь остаток;
   неизвестный адрес назначения известный **не стирает**, потому что устаревшая строка хуже пустой
   (`:1293-1323`, причина `:1294-1300`).
6. **Цена движения — цена партии** (`:1237-1238`), валюта — валюта партии (`:1249`).

**Повторный `POST` с тем же телом создаёт второе движение**: `Idempotency-Key` домен не шлёт
(§11 соглашений), уникальности номера партии нет. Что здесь обязано быть идемпотентным — **решение
владельца**.

Отдельно про `referenceType`: прежний контракт перечисляет пять значений
(`roo_code/roo-context/03-api-contract.md:1531`), а домен заказов пишет туда четыре других —
`order-shipment`, `order-shipment-cancelled`, `order-return`, `order-return-writeoff`
(`frontend_vue/src/services/mocks/orders.ts:3344`, `:3435`, `:3780`, `:3792`), и ни одно из четырёх
не уменьшает агрегат продажи (БАГ-13). Перечень **открыт** и на схеме (`reference_type` —
`String(50)` без ограничения, `backend/app/modules/warehouse/shared/models.py:118`); кто им владеет
— **решение владельца**.

Бэкенд: не реализован — и главное расхождение схемы здесь: у `warehouse_movements` **нет колонки
`offcut_id`** (`backend/app/modules/warehouse/shared/models.py:91-128`), а на этом поле держится вся
модель обрезка — и списание, и статус, и журнал куска (БАГ-23).
Реализация: `services/warehouseService.ts:createMovement` · мок `mocks/index.ts:1113` →
`services/mocks/warehouse.ts:mockCreateMovement` → `writeMovement`

### GET /api/warehouse/movements/:movementId

Карточка движения — **read-only**: `useWarehouseMovementCard` не имеет ни формы, ни `save`, ни
`discard`, только `load` и удаление записи журнала
(`frontend_vue/src/composables/useWarehouseMovementCard.ts:9-56`).
Save-режим: чтение. Загрузка идёт вместе со справочником имён товаров (`:36`).

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:198-200`).

Ответ: `WarehouseMovement` целиком, копией, но с журналом из отдельного хранилища:
`{ ...movement, auditLog: audit }` (`frontend_vue/src/services/mocks/warehouse.ts:1400-1405`).

Ошибки: `MOVEMENT_NOT_FOUND` (`:1402`) — доходит до человека сырой строкой
(`useWarehouseMovementCard.ts:40`).

Обязанности сервера: журнал движения обязан приходить **и полем записи, и своим эндпоинтом** — и это
единственное место домена, где мок держит журнал не в записи, а в отдельном хранилище, куда копирует
сид при первом чтении (`frontend_vue/src/services/mocks/warehouse.ts:1583-1591`); причина названа:
иначе лента и карточка показали бы два разных журнала (`:1934-1941`). Свойство мока, не сервера:
движению, созданному после старта, журнала не достаётся никогда (`:1403`).

Бэкенд: не реализован — таблицы под журнал движения на схеме нет.
Реализация: `services/warehouseService.ts:getMovement` · мок `mocks/index.ts:750` →
`services/mocks/warehouse.ts:mockGetMovement`

**Порядок разбора важен**: ветка карточки стоит **после** ветки аудита
(`frontend_vue/src/services/mocks/index.ts:750` против `:745`, порядок объяснён комментарием
`:744`) — в отличие от остальных четырёх ресурсов, где карточка идёт первой и аудит достижим только
потому, что регулярка карточки требует конца строки. Серверу — то же требование, что у `/offers`
(§18 соглашений).

### GET /api/warehouse/movements/:movementId/audit

Журнал изменений движения. **Вызывающего у этого пути нет** — карточка берёт журнал полем ответа
карточки (`useWarehouseMovementCard.ts:38`); см. «Клиент написан, UI нет».
Save-режим: чтение.

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:358-360`).

Ответ: `StockAuditEntry[]`, `structuredClone` копии из отдельного хранилища
(`frontend_vue/src/services/mocks/warehouse.ts:1902-1904`).

Ошибки: ни одной — для неизвестного id `getOrCreateMovementAudit` заводит пустой массив и возвращает
его (`:1583-1589`), тогда как парный DELETE бросает `AUDIT_ENTRY_NOT_FOUND` (`:1912`). БАГ-06.

Обязанности сервера: **чтения не имеют права иметь побочный эффект.** У мока он есть — первое
обращение материализует копию сида (`:1583-1589`); это свойство мока, и переносить его в сервер
нельзя.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:getMovementAudit` · мок `mocks/index.ts:745` →
`services/mocks/warehouse.ts:mockGetMovementAudit`

### DELETE /api/warehouse/movements/:movementId/audit/:entryId

Удаление записи журнала движения. Два вызывающих: карточка движения
(`useWarehouseMovementCard.ts:22-30`) и общая лента
(`frontend_vue/src/services/auditFeedService.ts:74`).
Save-режим: quick-action.

Запрос: тела нет, два сегмента пути (`frontend_vue/src/services/warehouseService.ts:362-364`).

Ответ: `Promise<void>`.

Ошибки: **один код вместо двух** — `AUDIT_ENTRY_NOT_FOUND`
(`frontend_vue/src/services/mocks/warehouse.ts:1912`). Кода «движения нет» здесь не бросается
вовсе: для неизвестного id `getOrCreateMovementAudit` вернёт пустой массив, и отказом станет
отсутствие записи в нём (`:1906-1913`). Это единственный из пяти складских журналов, где «нет
сущности» неотличимо от «нет записи», и сервер обязан их различать: `MOVEMENT_NOT_FOUND` плюс
`AUDIT_ENTRY_NOT_FOUND`.

Обязанности сервера: удаление правит **копию** журнала, а не сид, и лента читает ту же копию именно
поэтому (`:1934-1941`, `:1975-1988`) — свойство мока.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:deleteMovementAuditEntry` · мок `mocks/index.ts:1456` →
`services/mocks/warehouse.ts:mockDeleteMovementAuditEntry`

---

## Резка (cutting)

### POST /api/warehouse/cutting

Резка партии: из неё выходят куски, пропилы и отход. **Одна проводка** — либо проведена целиком,
либо не проведена вовсе.
Save-режим: quick-action. Один вызывающий — `submit()` страницы резки
(`useWarehouseCutting.ts:298-336`, отправка `:319-327`).

Запрос: `CuttingOperation` — семь ключей
(`frontend_vue/src/types/warehouse.ts:419-438`):

```ts
{ sourceBatchId: string; sourceQuantity: number; kerfMm: number;
  offcuts: Omit<OffcutCreatePayload, 'batchId'>[]; wasteQuantity: number;
  sourcePieces?: number; notes?: string | null }
```

Три оговорки к телу:

- **`sourceQuantity` — сверка, а не ввод.** Сервер считает расход заново и отказывает при
  расхождении с допуском `1e-6` (`frontend_vue/src/services/mocks/warehouse.ts:1497-1500`, проверка
  `:1530-1535`). Два числа, которые обязаны совпадать, расходятся ровно тогда, когда их два.
- **`sourcePieces` спрашивается только у штучной партии** (`frontend_vue/src/types/warehouse.ts:430-435`,
  подстановка `useWarehouseCutting.ts:207`): у измеримой расход выводится из размеров кусков, а у
  штучной выводиться не из чего — лист, распущенный на четыре куска, это один ушедший лист.
- **`productId` в кусках сервер не принимает.** Клиент кладёт его в каждый кусок
  (`useWarehouseCutting.ts:306`), в `OffcutCreatePayload` его нет
  (`frontend_vue/src/types/warehouse.ts:307-322`), и мок его игнорирует, беря товар у партии
  (`frontend_vue/src/services/mocks/warehouse.ts:923`).

Ответ: `{ offcuts: WarehouseOffcut[]; wasteQuantity: number }`
(`frontend_vue/src/services/warehouseService.ts:214-218`). **`wasteQuantity` в ответе —
пересчитанный отход, а не присланный** (`frontend_vue/src/services/mocks/warehouse.ts:1578`).

Ошибки — **десять, и все до первой записи**: `BATCH_NOT_FOUND` (`:1506`), `CUTTING_NO_OFFCUTS`
(`:1508`), `CUTTING_KERF_NOT_APPLICABLE` (`:1519`), `INSUFFICIENT_QUANTITY` (`:1529`),
`CUTTING_QUANTITY_MISMATCH` (`:1534`) плюс пять из домена через `MATERIAL_ERROR_CODE` —
`BATCH_UNIT_NOT_SUPPORTED`, `OFFCUT_DIMENSION_MISSING`, `OFFCUT_PIECES_NOT_INTEGER`,
`CUTTING_NEGATIVE_AMOUNT`, `CUTTING_SOURCE_PIECES_INVALID`
(`frontend_vue/src/domain/cutting.ts:52-58`, бросок `frontend_vue/src/services/mocks/warehouse.ts:1528`).
До человека не доходит **ни один из десяти** (`useWarehouseCutting.ts:329-331`) — БАГ-14.

Обязанности сервера, пять:

1. **Арифметика принадлежит серверу, клиенту он не верит.** `material(кусок) = quantity × размер
   одного куска в единице партии`, `cuts = Σ quantity`, `consumed = Σ material + cuts × kerf +
   waste` — правило живёт в домене (`computeCuttingConsumption`,
   `frontend_vue/src/domain/cutting.ts`, вызов `services/mocks/warehouse.ts:1521-1527`) и покрыто спеками
   [`domain/cutting.spec.ts`](../../../frontend_vue/src/domain/cutting.spec.ts) и
   [`mocks/cutting.spec.ts`](../../../frontend_vue/src/services/mocks/cutting.spec.ts).
2. **Перечень единиц, для которых размер куска выразим, закрыт шестью значениями** — `uom-m`,
   `uom-mm`, `uom-m2`, `uom-kg`, `uom-t`, `uom-pcs` (`frontend_vue/src/domain/cutting.ts:71-86`,
   экспорт `SUPPORTED_BATCH_UNITS` `:90`), тогда как справочник настроек знает девять
   (`frontend_vue/src/services/mocks/settings.ts:91-146`): партия в `uom-m3`, `uom-kg-m3` или
   `uom-h` не режется никогда — `BATCH_UNIT_NOT_SUPPORTED` (БАГ-15). Кто владеет этим перечнем —
   **решение владельца**.
3. **Пропил только у линейных единиц**: `kerfMm > 0` у нелинейной партии — отказ, а не молчаливый
   ноль (`frontend_vue/src/services/mocks/warehouse.ts:1519`).
4. **`cuts = Σ quantity` переоценивает расход на один рез при ровном раскрое, и это выбрано
   сознательно** (`roo_code/roo-context/03-api-contract.md:1784-1786`): переоценка показывает металла
   меньше, чем лежит, и лишнее находится при инвентаризации; недооценка обещает клиенту металл,
   которого нет.
5. **Что пишется в движения**: по одному `type: 'offcut'` на строку кусков и одно `type:
   'write-off'` с `referenceType: 'cutting'` на пропил с отходом, если оно больше нуля
   (`frontend_vue/src/services/mocks/warehouse.ts:1570-1575`). У штучной партии куски пишутся без
   движения, а ушедшие листы уходят одним движением операции (`:1537-1542`) — иначе списание по
   кускам списало бы четыре листа вместо одного.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:executeCutting` · мок `mocks/index.ts:1117` →
`services/mocks/warehouse.ts:mockExecuteCutting`

---

## Нехватки (deficit)

Нехватка — запись «этого товара не хватает, купите». У неё **два пути рождения**, и они кладут
разные значения в те же поля: HTTP-эндпоинт `POST /api/warehouse/deficit` (у которого нет UI) и
внутрипроцессная `recordShortage`, вызываемая доменом заказов
(`frontend_vue/src/services/mocks/warehouse.ts:1667-1712`).

### GET /api/warehouse/deficit

Список нехваток — вкладка «Дефицит».
Save-режим: чтение. Один вызывающий — вкладка дефицита (`useWarehouse.ts:283-304`); справочник имён
товаров здесь **не тянется**, в отличие от трёх соседних вкладок, потому что запись дефицита хранит
имя товара своей копией (`frontend_vue/src/types/warehouse.ts:446`).

Запрос — query: всегда `search`, `page`, `pageSize`; условно `priority`, `status`, `uomId`,
`categoryIds`, `sortBy`, `sortDir` (`frontend_vue/src/services/warehouseService.ts:226-238`). Мок
читает те же девять (`frontend_vue/src/services/mocks/index.ts:785-791`), но `categoryIds`
**принимает и не применяет** (`frontend_vue/src/services/mocks/warehouse.ts:1596-1651` — фильтра по
нему в теле нет), БАГ-20. Дефолты сортировки — `deficitAmount`/`desc` (`:1636-1637`); поддержаны
пять ключей — `productName`, `currentStock`, `minRequired`, `deficitAmount`, `priority` (`:1639-1648`),
причём `priority` сортируется по смысловому порядку, а не по алфавиту (`:1645-1646`). Колонки
«Единица» и «Статус» страница шлёт, а мок не понимает (БАГ-03).

Ответ обязан быть `DeficitListResponse` = `PaginatedResponse<DeficitListItem>`
(`frontend_vue/src/types/warehouse.ts:679`), где `DeficitListItem` — **10 полей** (`:469-490`). Мок
отдаёт **запись целиком** без проекции (`frontend_vue/src/services/mocks/warehouse.ts:1651`), то
есть с `suggestedOrderQty`, `purchaseOrderId`, обоими таймстампами и журналом — БАГ-16. Поле `notes`
в списочной записи объявлено именно потому, что оно уже ехало, и именно оно связывает нехватку с
породившим её заказом (`frontend_vue/src/types/warehouse.ts:480-489`).

Поиск идёт по трём локалям имени товара
(`frontend_vue/src/services/mocks/warehouse.ts:1611-1618`) — по копии в записи, а не по каталогу.

Ошибки: ни одной (`:1595-1652`).

Обязанности сервера: `productName` здесь — **копия, а не ссылка**, единственная оставшаяся в домене
после того, как её убрали у партии, обрезка и движения (`frontend_vue/src/types/warehouse.ts:446`,
БАГ-24). Снимок это или join — **решение владельца**; сегодня ручное создание пишет туда три пустых
строки.

Бэкенд: не реализован — схема беднее и расходится в смысле: у `warehouse_deficits` нет ни
`priority`, ни `suggested_order_qty`, ни `purchase_order_id`, а `status` объявлен `String(20)` с
дефолтом **`"critical"`** (`backend/app/modules/warehouse/shared/models.py:196-198`) — это значение
из перечня `DeficitPriority` (`frontend_vue/src/types/warehouse.ts:46`), а не `DeficitStatus`
(`:49`). БАГ-25.
Реализация: `services/warehouseService.ts:getDeficitList` · мок `mocks/index.ts:779` →
`services/mocks/warehouse.ts:mockGetDeficitList`

### POST /api/warehouse/deficit

Ручное создание нехватки. **Вызывающего нет** — см. «Клиент написан, UI нет».
Save-режим: quick-action (по замыслу).

Запрос: `DeficitCreatePayload` — четыре ключа: `productId`, `minRequired`, `priority`, `notes?`
(`frontend_vue/src/types/warehouse.ts:492-497`).

Ответ: `WarehouseDeficit` целиком — 15 полей (`:442-467`).

Ошибки: ни одной — `mockCreateDeficitItem` не бросает и не проверяет существование товара
(`frontend_vue/src/services/mocks/warehouse.ts:1736-1758`). Серверу проверка нужна.

Обязанности сервера, три:

1. **Шесть полей мок заполняет не из тела**: пять констант — `productName` (три пустые строки),
   `currentStock: 0`, `uomId: 'uom-pcs'`, `status: 'open'`, `suggestedOrderQty: null` — и шестое,
   `deficitAmount`, выведенное из `minRequired` (`:1742-1749`); из тела берутся только
   `minRequired` и `priority`. Путь заказа те же поля заполняет осмысленно — `priority: 'high'`,
   `suggestedOrderQty = quantity`, `productName` из заказа, `notes = "Order <id>"` (`:1691-1702`).
   БАГ-26. Какие значения верны для ручного пути — **решение владельца**.
2. **`currentStock` и `deficitAmount` — хранимые копии, а не производные от остатка**: обе ветки
   пишут `currentStock: 0` всегда (`:1693`, `:1743`), тогда как настоящий остаток лежит в строке
   склада и считается из партий (`:449`).
3. **Уникальность нехватки — по полному совпадению примечания, а не по подстроке**, и причина
   названа в коде: «Order ORD-1» содержится в «Order ORD-10» (`:1675-1687`). Ту же нехватку того же
   заказа второй раз заводить нельзя — величина поднимается на существующей записи.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:createDeficitItem` · мок `mocks/index.ts:1121` →
`services/mocks/warehouse.ts:mockCreateDeficitItem`

### GET /api/warehouse/deficit/:deficitId

Карточка нехватки. Save-режим: чтение. Один вызывающий — `load()`
(`useWarehouseDeficitCard.ts:60-78`), он же берёт журнал полем ответа (`:72`).

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:241-243`).

Ответ: `WarehouseDeficit` целиком, копией
(`frontend_vue/src/services/mocks/warehouse.ts:1654-1658`) — 15 полей
(`frontend_vue/src/types/warehouse.ts:442-467`).

Ошибки: `DEFICIT_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:1656`) — доходит до
человека сырой строкой (`useWarehouseDeficitCard.ts:74`).

Обязанности сервера: те же две копии, что у списка — `productName`, `currentStock`, `deficitAmount`.

Бэкенд: не реализован — БАГ-25.
Реализация: `services/warehouseService.ts:getDeficitItem` · мок `mocks/index.ts:798` →
`services/mocks/warehouse.ts:mockGetDeficitItem`

### PATCH /api/warehouse/deficit/:deficitId

Правка нехватки. Save-режим: clean-slate в карточке (`useWarehouseDeficitCard.ts:80-99`, Discard
`:101-109`) и quick-action в списке — инлайновые селекты приоритета и статуса с перезагрузкой после
(`useWarehouse.ts:385-403`).

Запрос: `DeficitPatchPayload` — шесть ключей: `minRequired?`, `priority?`, `status?`,
`suggestedOrderQty?`, `purchaseOrderId?`, `notes?`
(`frontend_vue/src/types/warehouse.ts:499-506`). Карточка шлёт дельту из трёх правимых полей
(`useWarehouseDeficitCard.ts:84`, форма `:32-40`) — здесь, в отличие от карточек партии и обрезка,
форма совпадает с payload и лишних ключей не уезжает. Список шлёт одиночные `{priority}` и
`{status}` (`useWarehouse.ts:387`, `:397`).

Ответ: `WarehouseDeficit` целиком, копией; `updatedAt` ставит сервер
(`frontend_vue/src/services/mocks/warehouse.ts:1766-1767`).

Ошибки: `DEFICIT_NOT_FOUND` (`:1765`). **Валидации нет**: `Object.assign` примет любой `status` и
любой `priority` (`:1766`) — сервер обязан проверять оба по перечням: `DeficitPriority` — четыре
значения (`frontend_vue/src/types/warehouse.ts:46`), `DeficitStatus` — пять (`:49`).

Обязанности сервера, три:

1. **`purchaseOrderId` правится этим эндпоинтом** (`frontend_vue/src/types/warehouse.ts:504`), но
   задать его негде — ни карточка, ни список такого поля не имеют. Модуля закупочных заказов в
   проекте нет вовсе, так что чем это поле заполняется — **решение владельца**.
2. **Перевод в `resolved`/`cancelled` ничего не проверяет и записи из списка не убирает**: фильтра
   по статусу в умолчании списка нет (`frontend_vue/src/services/mocks/warehouse.ts:1626-1628` —
   фильтр применяется только когда параметр прислан).
3. Оба перечня — закрытые во фронте и свободные строки на схеме
   (`backend/app/modules/warehouse/shared/models.py:196-198`).

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:patchDeficitItem` · мок `mocks/index.ts:1311` →
`services/mocks/warehouse.ts:mockPatchDeficitItem`

### DELETE /api/warehouse/deficit/:deficitId

Удаление нехватки. Save-режим: quick-action по подтверждению. Двое вызывающих: список
(`useWarehouse.ts:338-346`) и карточка с переходом на вкладку (`useWarehouseDeficitCard.ts:111-123`).

Запрос: тела нет (`frontend_vue/src/services/warehouseService.ts:256-258`).

Ответ: `Promise<void>`.

Ошибки: `DEFICIT_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:1772`). До человека не
доходит: оба вызывающих ловят `catch` без параметра (`useWarehouse.ts:343`,
`useWarehouseDeficitCard.ts:118`).

Обязанности сервера, две:

1. **Запись, заведённую заказом, удаляет ещё и внутрипроцессная `clearShortages` — без HTTP и без
   следа** (`frontend_vue/src/services/mocks/warehouse.ts:1726-1734`), и трогает она только записи с
   примечанием заказа (`:1723-1724`): нехватка, введённая руками, никому не принадлежит и снимается
   только этим эндпоинтом.
2. **Ручное удаление нехватки заказа снимет её не насовсем**: следующий пересчёт строки заведёт её
   заново (`:1675-1687`). То есть удаление здесь — не «решено», а «убрать из списка до следующего
   раза».

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:deleteDeficitItem` · мок `mocks/index.ts:1625` →
`services/mocks/warehouse.ts:mockDeleteDeficitItem`

### GET /api/warehouse/deficit/:deficitId/audit

Журнал изменений нехватки. **Вызывающего у этого пути нет** — карточка берёт журнал полем ответа
(`useWarehouseDeficitCard.ts:72`); см. «Клиент написан, UI нет».
Save-режим: чтение.

Запрос: только путь (`frontend_vue/src/services/warehouseService.ts:368-370`).

Ответ: `StockAuditEntry[]`, `structuredClone` журнала записи
(`frontend_vue/src/services/mocks/warehouse.ts:1916-1919`).

Ошибки: ни одной — неизвестная запись отвечает пустым массивом (`:1918`), парный DELETE бросает
`DEFICIT_NOT_FOUND` (`:1926`). БАГ-06.

Бэкенд: не реализован — таблицы под журнал нехватки на схеме нет.
Реализация: `services/warehouseService.ts:getDeficitAudit` · мок `mocks/index.ts:807` →
`services/mocks/warehouse.ts:mockGetDeficitAudit`

### DELETE /api/warehouse/deficit/:deficitId/audit/:entryId

Удаление записи журнала нехватки. Два вызывающих: карточка
(`useWarehouseDeficitCard.ts:50-58`) и общая лента
(`frontend_vue/src/services/auditFeedService.ts:76`).
Save-режим: quick-action.

Запрос: тела нет, два сегмента пути (`frontend_vue/src/services/warehouseService.ts:372-374`).

Ответ: `Promise<void>`.

Ошибки: `DEFICIT_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:1926`) и
`AUDIT_ENTRY_NOT_FOUND` (`:1928`); до человека не доходит ни один
(`useWarehouseDeficitCard.ts:56`).

Обязанности сервера: те же, что у остальных четырёх удалений записи журнала.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:deleteDeficitAuditEntry` · мок `mocks/index.ts:1467` →
`services/mocks/warehouse.ts:mockDeleteDeficitAuditEntry`

---

## Выгрузка (export)

### GET /api/warehouse/export/:tab

Выгрузка текущей вкладки в CSV. **Сегмент пути — вкладка, а не идентификатор**, и перечень закрыт
пятью значениями, которые регулярка мока называет поимённо
(`frontend_vue/src/services/mocks/index.ts:813-815`):

- `stock` — остатки по товарам;
- `batches` — партии;
- `offcuts` — обрезки;
- `movements` — движения;
- `deficit` — нехватки.

Save-режим: quick-action по кнопке. Один вызывающий — `exportCurrentTab()`
(`views/admin/warehouse/WarehousePage.vue:296-334`), который берёт фильтры текущей вкладки, зовёт
эндпоинт и сохраняет ответ файлом через `Blob` + `URL.createObjectURL` (`:327-332`).

Запрос: query собирается по вкладке — общий `search`, необязательный `_locale` и от четырёх до шести
фильтров своей вкладки: сборка занимает
**55 строк** (`frontend_vue/src/services/warehouseService.ts:267-321`) при 63 строках всей функции
(`:262-324`). Фильтры совпадают с фильтрами
соответствующего списочного эндпоинта, кроме пагинации — её здесь нет.

Ответ: **`string`, тело CSV** (`frontend_vue/src/services/warehouseService.ts:266`) — голая строка,
а не конверт: `unwrap()` отдаст её как есть только потому, что ключа `success` в ней нет
(§1 соглашений, там же названа обратная сторона: `apiGet` читает `res.json()`, то есть настоящий
`text/csv` клиент прочитать не может — БАГ-27).

Ошибки: ни одной; вызывающий показывает общий тост (`views/admin/warehouse/WarehousePage.vue:335`).

Обязанности сервера, четыре, и форму ответа не задаёт **никто** — мок её не строит вовсе:
`mockExportWarehouseCsv(_tab)` возвращает литерал `'mock-csv-data'` и не смотрит ни на вкладку, ни
на один фильтр (`frontend_vue/src/services/mocks/warehouse.ts:1853-1855`), БАГ-27.

1. **Сервер обязан отвечать CSV, а не `ApiResponse<string>`.**
2. **`_locale` — параметр запроса, а не заголовок `Accept-Language`**
   (`frontend_vue/src/services/warehouseService.ts:267-268`), и подписи колонок обязан переводить
   сервер.
3. **Пагинации у выгрузки нет**: она обязана отдавать весь отфильтрованный набор.
4. **Какие колонки в каждой из пяти выгрузок — не сказано нигде**, и контракт этого не назначает:
   **решение владельца**. Разумный ориентир — поля списочного типа соответствующей вкладки, но это
   ориентир, а не наблюдение.

Бэкенд: не реализован.
Реализация: `services/warehouseService.ts:exportWarehouseData` · мок `mocks/index.ts:813` →
`services/mocks/warehouse.ts:mockExportWarehouseCsv`

---

## Обязанности сервера

То, чего во фронтенде не видно и что в мок-режиме не проявляется никак. Девять граф; ответ «нигде» —
не решение контракта, а строка в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), их у домена
**девять**.

### 1. Значения по умолчанию и их владелец

**Две величины домен берёт у настроек арендатора, и обе продублированы константами.**

- **Базовая валюта.** Мок выводит её как `code` валюты с флагом `isDefault`, иначе
  `constants.defaultCurrency` (`frontend_vue/src/services/mocks/warehouse.ts:74-76`), и она же —
  единственная валюта, на которой говорит склад (`:65-73`). Ровно то же вычисление стоит вторым
  экземпляром в клиенте создания партии (`useWarehouseBatchCreate.ts:29-31`), третьим — там же в
  форме (`:42`), а **четвёртым — литералом `'EUR'`** дефолтом формы карточки партии
  (`useWarehouseBatch.ts:120`). Правило «справочник принадлежит серверу, копии во фронте быть не
  должно» — §14 соглашений.
- **Маржа.** `constants.defaultMargin` подставляется засеянной партии без маржи
  (`frontend_vue/src/services/mocks/warehouse.ts:110-113`) и новой партии (`:779`), а форма карточки
  берёт её из стора настроек (`useWarehouseBatch.ts:119`, `:207`, `:285`, `:315`). При этом
  `marginPercent` в `BatchPatchPayload` не объявлен
  (`frontend_vue/src/types/warehouse.ts:190-204`) и колонки под него на схеме нет.

**Константами во фронте стоят, и владельца у них нет:** размер страницы `25` — **десять**
экземпляров, пятью `usePagination(25)` (`useWarehouse.ts:172-176`; замер —
`grep -c "usePagination(25)" frontend_vue/src/composables/useWarehouse.ts` → `5`) и дефолтами пяти
веток мока (`frontend_vue/src/services/mocks/index.ts:619`, `:660`, `:705`, `:757`, `:781`); перечень размеров
`10/25/50/100` — константа компонента (`views/admin/warehouse/WarehousePage.vue:174-179`); единица по
умолчанию — `'uom-kg'` в **четырёх** местах (`useWarehouseBatch.ts:118`,
`useWarehouseBatchCreate.ts:40`, `useWarehouseStockCard.ts:52` и `:88`) и `'uom-pcs'` ещё в
**четырёх** (`useWarehouseOffcutCreate.ts:48`, `:229`, `:334`, и в моке ручного создания нехватки
`frontend_vue/src/services/mocks/warehouse.ts:1746`); разницы между `:229` и `:334` нет — обе
строки `form.uomId = 'uom-pcs'`, как и между `:52` и `:88` — обе дефолт формы; ширина реза `3` мм
(`useWarehouseCutting.ts:172`); приоритет `'high'` и статус `'open'` у нехватки, заведённой заказом
(`frontend_vue/src/services/mocks/warehouse.ts:1697-1698`); шаг количества — `1` для штучной единицы
и `0.01` для прочих, трижды (`useWarehouseBatchCreate.ts:160`,
`views/admin/warehouse/WarehouseStockCard.vue:111`,
`views/admin/warehouse/CreateMovementModal.vue:250`).

**Кому принадлежат размер страницы, ширина реза по умолчанию и единица по умолчанию — нигде**
(решение владельца). Остаётся ли базовая валюта склада выведенной из настроек или это отдельная
настройка — тоже (решение владельца).

### 2. События и уведомления

**Домен рождает два события из семи, и оба — в моке.** `notifyBatchReceived` при создании партии
(`frontend_vue/src/services/mocks/warehouse.ts:789`) и `notifyStockDeficit` при **вновь открытой**
нехватке (`:1710`), причём повтор события не рождает: ветка «тот же заказ просит снова» поднимает
величину и выходит раньше вызова (`:1679-1687`), а причина названа прямо (`:1707-1709`). Оба
доказаны спекой
[`mocks/notification-triggers.spec.ts`](../../../frontend_vue/src/services/mocks/notification-triggers.spec.ts);
общее правило «событие — это переход» — §10 соглашений.

**Ничего не рождают:** правка партии, её удаление, резка, движение любого типа, создание и удаление
обрезка, смена статуса обрезка, правка и закрытие нехватки —
`grep -n "notify" frontend_vue/src/services/mocks/warehouse.ts` даёт ровно три строки: импорт
(`frontend_vue/src/services/mocks/warehouse.ts:41`) и два вызова.

Отдельно: восьмой тип уведомления, `reserve_expiring`, триггера не имеет, и причина в складской
модели — у `StockReservation` нет ни срока, ни даты окончания
(`frontend_vue/src/types/warehouse.ts:625-634`), а `Batch.expiresAt` — годность металла, а не граница
брони (`:107`).

**Решено 2026-09-09 (П52): срок у брони есть — три рабочих дня по умолчанию, значение в
настройках.** Восьмой тип оживает, и складская модель получает границу брони, которой у неё нет.
«Рабочий день» при этом в проекте не определён нигде: умолчание контракта — суббота и воскресенье
в срок не входят, праздники остаются выбором реализации ([§10.3](00-conventions.md)).

**Решено 2026-09-09 (П51, П55): склад получает один новый тип и один флаг.** Новый тип — **партия
просрочена**. Исчерпание остатка нового типа не требует: оно ложится на существующий
`stock_deficit`, но помечается флагом «требует действия сейчас», когда нехватка **под
подтверждённый заказ**, — и такие записи показывает блок тревог на дашборде
([§10.4](00-conventions.md)). Списание, резка и движения уведомлений не рождают.

**Обязан ли склад сообщать о списании, о резке, о просроченной партии и об исчерпании остатка —
нигде** (решение владельца).

### 3. Запись в аудит-лог

**Пять журналов, и их не пишет никто.** Домену принадлежат пять из девяти журналов ленты аудита —
`stock`, `batch`, `offcut`, `movement`, `deficit` (`frontend_vue/src/types/audit.ts:4-14`, замкнутый
перечень — §9 соглашений), и все пять собирает `warehouseAuditSources()`
(`frontend_vue/src/services/mocks/warehouse.ts:1942-2001`).

Записи есть только в сидах: `shiftAuditSeries` двигает пять серий по демо-часам (`:221-238`), `id`
проставляет `sealAuditIds` при сборке хранилища
(`frontend_vue/src/types/warehouse.ts:536-544`), а не сид. Ни одна операция домена в журнал не
пишет: у создания партии `auditLog: []`
(`frontend_vue/src/services/mocks/warehouse.ts:780`), у обрезка `:940`, у движения `:1248`, у
нехватки `:1704` и `:1754`; четыре функции правки журнала не касаются вовсе — ни одного
`auditLog.push` в файле нет. **То есть удалить запись можно, а появиться ей неоткуда** — тот же
класс, что у товаров, клиентов и поставщиков (§9 соглашений).

Форма записи — семь полей (`frontend_vue/src/types/warehouse.ts:526-534`); автор — отображаемое имя,
а не ссылка на пользователя; признака `sensitive` в записи нет
(`grep -c "sensitive" frontend_vue/src/types/warehouse.ts` → 0). На схеме предусмотрена пара:
`user_id` с `ondelete="SET NULL"` плюс замороженные переводы имени и инициалы
(`backend/app/modules/warehouse/shared/models.py:246-252`).

**Кто и в какой момент пишет пять журналов, кто автор записи и где хранятся четыре из пяти — нигде**
(решение владельца): таблица на схеме одна, и она привязана к партии (`:240-245`).

### 4. Кастомные поля

**У домена их нет ни в каком виде.**
`grep -rn "fieldValues\|FieldDefinition\|fieldId" frontend_vue/src/types/warehouse.ts frontend_vue/src/services/mocks/warehouse.ts frontend_vue/src/services/warehouseService.ts`
— пусто; в шести таблицах схемы
(`backend/app/modules/warehouse/shared/models.py:11-258`) ни одной ссылки на определения полей.
Библиотека `/api/config/fields` к складу не привязана: обе библиотеки определений и их вокабуляры —
§8 соглашений, и элементы там построены вокруг карточки товара и поставщика.

Единственное «свободное поле» домена — **`location`, и это составная строка** формата
`"Rack: X | Row: Y | Cell: Z\nNotes: …"`, которую разбирает регулярками и мок, и клиент
(`frontend_vue/src/services/mocks/warehouse.ts:649-678`). Справочника секторов нет, поэтому адрес —
текст, и именно он единственная гарантия, что металл найдут (`:1294-1300`).

### 5. Настройки, которых мок не отслеживает

Четыре, каждая — прямое наблюдение.

1. **Справочник единиц открыт, а арифметика склада закрыта.** `settings.uoms` знает девять единиц
   (`frontend_vue/src/services/mocks/settings.ts:91-146`), а таблица размеров куска — шесть
   (`frontend_vue/src/domain/cutting.ts:71-86`). Партия в `uom-m3`, `uom-kg-m3` или `uom-h` не
   режется и обрезка не даёт никогда, и добавленная арендатором единица попадёт в тот же отказ
   (БАГ-15). Кто владеет перечнем пригодных для склада единиц — **нигде** (решение владельца).
2. **Правила пересчёта `settings.conversions` склад не использует вовсе**:
   `grep -rn "conversions" frontend_vue/src/services/mocks/warehouse.ts frontend_vue/src/composables/useWarehouse*.ts`
   — пусто; коэффициент закупки в складскую единицу выводится из **отношения количеств**,
   присланных клиентом (`frontend_vue/src/services/mocks/warehouse.ts:713-719`), а не из
   справочника, тогда как карточка товара тот же коэффициент берёт именно из `settings.conversions`.
   Кто владеет правилами пересчёта — **нигде** (решение владельца).
3. **Курса конвертации нет нигде, и это решение, а не пробел**
   (`frontend_vue/src/services/mocks/warehouse.ts:65-73`, §14 соглашений): партия оценена в базовой
   валюте или не оценена вовсе. При этом на схеме у партии колонка `exchange_rate` **есть**
   (`backend/app/modules/warehouse/shared/models.py:86-88`), а во фронте её нет ни в типе, ни в моке
   (`grep -c "exchangeRate" frontend_vue/src/types/warehouse.ts` → 0). Зачем колонка — **нигде**
   (решение владельца).
4. **Карта склада к адресам партий не привязана ничем**: она живёт в настройках единичным ресурсом
   (`GET/PUT/DELETE /api/settings/warehouse-map`, домен `settings`), а `batch.location` — свободный
   текст (`frontend_vue/src/types/warehouse.ts:108-109`); связи между картинкой и строкой адреса нет
   ни одной. Связаны ли они — **нигде** (решение владельца).

### 6. Мультиарендность

**На схеме выражена у всех шести таблиц, во фронте — никак.** `tenant_id` объявлен `nullable=False,
index=True`, FK на `tenants.id` с `ondelete="CASCADE"` у `warehouse_batches`
(`backend/app/modules/warehouse/shared/models.py:16-21`), `warehouse_movements` (`:96-101`),
`warehouse_offcuts` (`:136-141`), `warehouse_deficits` (`:173-178`), `stock_items` (`:207-212`) и
`stock_audit_entries` (`:234-239`) — счёт машинный:
`grep -c tenant_id backend/app/modules/warehouse/shared/models.py` → 6. Во фронте нет ни `tenantId`,
ни заголовка (`grep -c "headers\|options" frontend_vue/src/services/warehouseService.ts` → 0), и мок
понятия арендатора не имеет. Правило «арендатор берётся из токена, и только из него» — §4
соглашений; фильтр по арендатору обязателен в каждом из 37 запросов.

Отдельно: у `stock_items` уникальность объявлена **по одному `product_id`** без `tenant_id`
(`backend/app/modules/warehouse/shared/models.py:213-219`), то есть строка остатка на схеме одна на
всю систему, а не на арендатора — БАГ-28, он же назван в §4 соглашений как одно из двух известных
исключений проекта.

### 7. Права — в какой функции проверяются

**Нигде.** На сервере проверять негде — роутов ноль. Во фронте доступ гейтится только
фича-флагами: восемь роутов склада несут `meta.featureFlag: 'adminWarehouse'`
(`frontend_vue/src/router/index.ts:98`, `:258`, `:264`, `:276`, `:282`, `:288`, `:306`, `:318`),
страница резки — `warehouseCutting` (`:294`), карта склада — `warehouseMap` (`:300`); все три
объявлены `true` (`frontend_vue/src/config/featureFlags.ts:7`, `:45`, `:47`). Флаг — это тариф, а не
право (§6 и §7 соглашений).

**В матрице прав склада нет ни одной строки.** `PERMISSION_ROLES` содержит роль `Warehouse`
(`frontend_vue/src/services/mocks/config.ts:186`, её пользователи — `:182`), но сами права строятся
только из секций карточки поставщика и их полей (`:189-203`) — ни партии, ни обрезка, ни движения,
ни нехватки среди них нет. Три права заказов (`seeCost`, `manualCost`, `correction`) на складские
экраны не распространяются:
`grep -rn "useOrderPermissions\|seeCost" frontend_vue/src/views/admin/warehouse frontend_vue/src/composables/useWarehouse*.ts`
— пусто, то есть **себестоимость партии видит любой, кто открыл карточку**, при том что в заказах та
же величина закрыта правом (§6 соглашений).

**Какое право нужно на создание партии, на резку, на движение, на удаление записи журнала, и видит
ли себестоимость партии кладовщик — нигде** (решение владельца).

### 8. Транзакционность и идемпотентность

`Idempotency-Key` не шлётся ни на одном из 37 путей
(`grep -c "Idempotency" frontend_vue/src/services/warehouseService.ts` → 0), при том что генератор в
проекте есть (§11 соглашений). Версии (`If-Match`) у домена нет ни во фронте, ни на схеме —
поведение last-write-wins.

**Внутри мока атомарность выражена и объяснена в двух местах:** `writeMovement` синхронна намеренно —
отгрузка обязана записаться и списать в один заход, `await` посередине оставил бы товар проданным и
лежащим на полке (`frontend_vue/src/services/mocks/warehouse.ts:1195-1201`); резка проверяет всё
**до первой записи** и проводится целиком либо не проводится (`:1536-1538`, отказы `:1506-1535`).

**А между запросами транзакции нет ни одной, и клиент рвёт операции на части в трёх местах:** Save
карточки партии — PATCH плюс `POST /movements` при смене адреса, провал второго только показывает
info-тост (`useWarehouseBatch.ts:255-276`); Save карточки обрезка — PATCH плюс до двух движений, оба
с `.catch(() => {})` (`useWarehouseOffcutCard.ts:288-323`); смена статуса обрезка из списка — PATCH
плюс движение, чей провал заглушен комментарием «Movement creation is secondary»
(`useWarehouse.ts:362-383`). Плюс четвёртое место того же класса, но без записи: карточка остатка
тянет агрегаты циклом по всем партиям товара (`useWarehouseStockCard.ts:53-59`, БАГ-12).

Повторный `POST /api/warehouse/batches` с тем же телом создаёт вторую партию: уникальности
`batch_number` нет ни в моке
(`frontend_vue/src/services/mocks/warehouse.ts:680-791` — ни одной проверки), ни на схеме
(`backend/app/modules/warehouse/shared/models.py:33` — просто `String(100)`).

**Что обязано быть атомарным — решено 2026-09-09 (П43):** склад входит в число атомарных вместе с
заказом. Save карточки партии применяется целиком либо не применяется вовсе, и разрыв операции на
два-три запроса без общей границы (`useWarehouseBatch.ts:255`, `:262`) перестаёт быть допустимым
(§15 соглашений).

### 9. Производные значения: сервер считает, а не хранит

**Одиннадцать, и это самая большая доля в проекте** (§17 соглашений).

У партии три: (1) `quantityRemaining` и (2) `status` выводятся **из журнала движений целиком** —
`syncBatchQuantities` объявлен инвариантом, а не инициализацией, с прямым указанием «бэкенд сделает
ровно этот пересчёт при старте с сохранённого журнала»
(`frontend_vue/src/services/mocks/warehouse.ts:389-416`, статус — `computeBatchStatus` `:304-345`);
(3) `totalCost` = `quantity × unitPrice`, и `null`, пока цены нет (`:767`, `:805-808`).

У строки остатка восемь из четырнадцати полей считаются при каждом чтении: (4) `totalQuantity`,
(5) `batchCount`, (6) `totalValue`, (7) `avgUnitPrice` — взвешенная только по оценённым партиям,
(8) `uomId` — берётся у первой партии, (9) `reservedQuantity` — из резервов, (10)
`availableQuantity` и (11) `isDeficit` (`:446-476`, причина `:434-445`).

Плюс не имеющие своих полей вовсе: агрегаты партии (`:1415-1451`), активные продажи (`:1453-1482`),
FIFO-стоимость (`:1801-1849`), `total` и `totalPages` пагинации (`:420-430`).

Обратное направление тоже есть и оно единственное законное: склад **регистрирует** себя у каталога,
чтобы тот считал среднюю закупочную цену товара — `registerProductBatchLookup` (`:1377-1383`,
причина `:1366-1376`).

На схеме под все одиннадцать колонок нет: `warehouse_batches` хранит `quantity_remaining`, `status`
и `total_cost` обычными колонками (`backend/app/modules/warehouse/shared/models.py:36-45`, `:57-59`),
`stock_items` — только `total_quantity` и `unit` (`:220-223`). То есть сервер обязан либо считать их
при чтении, либо держать согласованными с журналом сам — и второе схема уже допускает
рассинхронизировать (§17 соглашений).

---

## Правила домена

Девятнадцать правил, живущих только в этом домене или в его доменном слое. Эндпоинты машина
перечислит и без человека, а это — нет.

1. **Складской слой говорит на одной валюте, и это решение, а не пробел.** Базовая валюта выводится
   из настроек арендатора (`frontend_vue/src/services/mocks/warehouse.ts:74-76`); партия либо
   оценена в ней, либо не оценена вовсе, а закупка в чужой валюте остаётся на закупочном следе и
   ценой товара на полке не становится никогда (`:65-73`). Отказ `BATCH_CURRENCY_NOT_BASE` стоит и
   на создании (`:724-726`), и на правке (`:801-803`).
2. **Цена, которой никто не назвал, — это `null`, а не ноль.** `unitPrice` и `totalCost` объявлены
   `number | null` у партии (`frontend_vue/src/types/warehouse.ts:99`, `:101`) и у списочной записи
   (`:150`), причина названа в обоих местах (`:91-98`, `:149`); средняя цена остатка взвешивается
   **только по оценённым партиям** (`frontend_vue/src/services/mocks/warehouse.ts:450-467`).
   Единственное место, где ноль всё же подставляется, — FIFO: домен заказов не умеет носить
   «неизвестно» (`:1820-1825`).
3. **Количество партии уменьшает ТОЛЬКО движение — второго вычитания нет нигде.** `writeMovement`
   единственный владелец (`frontend_vue/src/services/mocks/warehouse.ts:1264-1273`), и тот же список
   «что уносит металл» используется пересчётом из журнала (`OUTGOING_MOVEMENT_TYPES` `:355-363`,
   `takesFromBatch` `:385-387`). Причина, почему список один: разойдись они — пересчёт «вернул» бы
   партии то, что при записи с неё ушло, молча и только после пересборки хранилища (`:347-354`).
4. **Движение с заполненным `offcutId` двигает КУСОК, а не партию.** Исключение — сам тип `offcut`,
   то есть резка: материал уходит с партии ровно один раз, ею (`movesOffcut` `:380-382`, причина
   `:365-379`). Поэтому такое движение не меняет количества партии, не попадает в её агрегаты и не
   влияет на её статус, а `batchId` в нём назван ради происхождения.
5. **Статус куска — это и есть его остаток, и ставится он по ТИПУ движения, а не по перечню
   случаев.** `OFFCUT_STATUS_BY_MOVEMENT` — семь типов
   (`frontend_vue/src/services/mocks/warehouse.ts:294-302`), применение — в той же функции, где
   партия теряет количество (`:1337-1344`), и причина названа: отдельный вызов рядом когда-нибудь
   забудут позвать, и кусок останется свободным (`:1325-1336`). Отличия от таблицы партии
   перечислены прямо: у куска нет `receipt` и `converted_to_offcuts`, зато есть `return` (`:281-293`).
6. **Обрезок неделим, поэтому занят он целиком, и занятость ВЫВОДИТСЯ, а не хранится.** Кто стоит на
   куске — вопрос к заказам, и склад спрашивает их регистрацией, а не импортом
   (`registerOffcutClaimLookup` `:972-976`, причина `:961-971`); спрашивается разбивка строки, а не
   резерв, потому что разбивка шире и старше (`:978-997`). Следствие названо: удалённая строка
   отпускает кусок сама, а аннулированный заказ — не отпускает, пока его строки живы (`:992-996`).
7. **Обрезки в автоматический FIFO не попадают и не будут.** Кусок выбирают глазами по размеру, а не
   по дате поступления, поэтому FIFO строится только из партий, а `GET /api/warehouse/offcuts/offers`
   — единственная дорога куска в заказ (`frontend_vue/src/types/warehouse.ts:280-282`,
   `frontend_vue/src/services/mocks/warehouse.ts:1021-1035`).
8. **FIFO считает по ДОСТУПНОМУ, а не по остатку, и недостачу сообщает, а не усредняет.** Из
   количества партии вычитается и чужой резерв, и чужой хват разбивки (`:1814-1819`); история того,
   что бывает без второго слагаемого, записана числами (`:1788-1795`).
9. **Перенос меняет место, а не количество, и место пишется по-разному для куска и для партии.**
   Кусок переезжает целиком при любом количестве в движении, партия — только когда уходит весь
   остаток; неизвестный адрес назначения известный не стирает, потому что устаревшая строка хуже
   пустой (`:1293-1323`, причина `:1294-1300`).
10. **Партия не хранит имени товара, а строка остатка хранит имя своей категории.** Имя товара убрано
    у партии, обрезка и движения (`frontend_vue/src/types/warehouse.ts:73-77`, `:213-219`, `:353`),
    подпись собирается на месте показа, а поиск и сортировка по имени остаются серверными
    (`_matchesProductName` `frontend_vue/src/services/mocks/warehouse.ts:136-144`,
    `_compareProductName` `:146-149`). Но `StockOverviewItem.categoryName`
    (`frontend_vue/src/types/warehouse.ts:594-595`) и `WarehouseDeficit.productName` (`:446`)
    остались копиями, и проекция обновляет из каталога только имя товара, категорию — нет
    (`frontend_vue/src/services/mocks/warehouse.ts:461`).
11. **Демо-цены партий согласованы с каталогом, а не выдуманы.** `_resolveBatchCost` приводит
    закупочную цену к доле от продажной цены товара, разброс между партиями сохраняя (`:161-192`);
    причина названа числами (`:161-176`). Тем же приёмом выравниваются цены движений (`:204-213`).
    **Это свойство мока**, и серверу его повторять не нужно (§18 соглашений).
12. **Пять журналов домена едут на демо-часах, и движения сдвигаются на сиде, а не на копии.** Пять
    серий, пять концов, пять сдвигов (`:221-238`); движения сдвигаются до первого чтения именно
    потому, что журнал движения копируется при первом обращении, и сдвиг копии оставил бы две правды
    об одном журнале (`:228-233`, аккумулятор `:1583-1591`). Тоже свойство мока.
13. **Адрес хранения — составная строка, и её формат продублирован в трёх местах.**
    `"Rack: X | Row: Y | Cell: Z\nNotes: …"`: четыре регулярки и разбор в моке (`:649-678`), вторая
    реализация в карточке партии (сборка `useWarehouseBatch.ts:242-248`), третья — на странице
    создания обрезка (`useWarehouseOffcutCreate.ts:13`, `:301-306`). Справочника секторов нет.
14. **Идентификаторы домена — строки с префиксом, и у обрезка их два.** Партия `whb-NNN`
    (`frontend_vue/src/services/mocks/warehouse.ts:683`), движение `whm-NNN` (`:1225`), нехватка
    `whd-NNN` (`:1690`, `:1737`), а обрезок в сидах — `who-NNN`, тогда как созданный получает
    `offcut-NNN` (`:912`). Счётчики выводятся из длины хранилища (`:240-243`), то есть после
    удаления следующий id столкнётся с существующим — §19 соглашений.
15. **Порядок веток разбора мока — часть контракта в трёх местах.** `/stock/:id/cost` разбирается
    раньше `/stock/:id` (`frontend_vue/src/services/mocks/index.ts:637` против `:644`),
    `/offcuts/offers` — раньше `/offcuts/:id` (`:726` против `:730`, с объяснением `:724-725`),
    `/movements/:id/audit` — раньше `/movements/:id` (`:745` против `:750`, объяснение `:744`). У
    остальных трёх ресурсов аудит стоит **после** карточки и достижим только потому, что регулярка
    карточки требует конца строки (`:653`, `:688`, `:739`, `:807`). Для сервера правило другое и
    оно в §18 соглашений: с одним маршрутом `/{id}` порядок обратный по построению, и вложенные пути
    обязаны быть объявлены раньше.
16. **Экран списка помнит фильтры в `localStorage`, а сервер об этом не знает.** Ключи вида
    `warehouse_stock_prefs` (`views/admin/warehouse/WarehousePage.vue:225-227`), с проверкой формата
    сохранённой единицы при чтении (`:360`). Ни один из них на сервер не уходит.
17. **Создание движения убрано из интерфейса списка, но осталось на карточке партии.** В
    `useWarehouse` три пометки `DEPRECATED` про модал создания движения (`useWarehouse.ts:44`,
    `:47`, `:659`) и одна в странице (`views/admin/warehouse/WarehousePage.vue:32`), а сам
    `CreateMovementModal.vue` жив и подключён к карточке партии
    (`views/admin/warehouse/WarehouseBatchCard.vue:20`, `:1522`).
18. **`DELETE /api/warehouse/movements/:movementId` существует в моке и не существует в клиенте.**
    Ветка есть (`frontend_vue/src/services/mocks/index.ts:1619-1623`, функция
    `frontend_vue/src/services/mocks/warehouse.ts:1407-1411`), а в `warehouseService.ts` такой
    функции нет — то есть в инвентарь эндпоинтов домена этот путь не попал и раздела выше у него
    нет. Он одна из пяти «сирот» замера К2 (см.
    [`contract-sync-plan.md`](../../plans/api/contract-sync-plan.md), раздел «Линзы контракта»).
    Удаление движения — это удаление факта, изменившего остаток; что должно происходить с партией,
    не сказано нигде. **Раздела здесь нет намеренно**: контракт описывает то, что зовёт код, а не то,
    на что мок умеет ответить.
19. **Обрезок и партия — не одно и то же, и «остаток» у них разный по природе.** У партии остаток —
    число, которое уменьшают движения; у куска остатка нет вовсе, есть статус
    (`frontend_vue/src/services/mocks/warehouse.ts:281-293`). Поэтому у партии FIFO вычитает чужой
    хват из количества, а у куска вычитать нечего — он один и делится только резкой (`:1000-1011`).

---

## Клиент написан, UI нет

Пять эндпоинтов домена имеют функцию клиента и ни одного экрана. Проверка на каждый —
`grep -rn '<имя>' frontend_vue/src --include=*.ts --include=*.vue` даёт только объявление.

| метод и путь | функция клиента | почему живёт |
|---|---|---|
| `POST /api/warehouse/deficit` | `createDeficitItem` (`services/warehouseService.ts:245`) | записи дефицита рождает не эндпоинт, а внутрипроцессная `recordShortage` (`services/mocks/warehouse.ts:1667-1712`) |
| `GET /api/warehouse/stock/:productId/audit` | `getStockAudit` (`services/warehouseService.ts:328`) | журнал приходит полем ответа карточки (`useWarehouseStockCard.ts:132`) |
| `GET /api/warehouse/offcuts/:offcutId/audit` | `getOffcutAudit` (`services/warehouseService.ts:348`) | то же (`useWarehouseOffcutCard.ts:215`) |
| `GET /api/warehouse/movements/:movementId/audit` | `getMovementAudit` (`services/warehouseService.ts:358`) | то же (`useWarehouseMovementCard.ts:38`) |
| `GET /api/warehouse/deficit/:deficitId/audit` | `getDeficitAudit` (`services/warehouseService.ts:368`) | то же (`useWarehouseDeficitCard.ts:72`) |

Те же пять строк стоят в реестре прежнего контракта
(`roo_code/roo-context/03-api-contract.md:3037-3041`, правило реестра — `:3024-3025`), и правило
снятия оттуда остаётся в силе: появился UI — строка уходит, а у эндпоинта проставляется конкретный
вызывающий. Парные `delete*AuditEntry` **вызываются** из карточек — то есть у четырёх журналов из
пяти удаление работает, а отдельная загрузка осталась вторым путём к тем же данным.

Шестой случай того же класса, но с другой стороны: `DELETE /api/warehouse/movements/:movementId` —
ветка мока без функции клиента (правило домена 18).

---

## Чего в домене нет

Ничего не вычеркнуто молча: строка на каждое утверждение прежнего
[`03-api-contract.md`](../03-api-contract.md), снятое или исправленное, с доказательством. Диапазон
домена там — строки 1273-1880; заголовков вида `### <МЕТОД> /api/...` в нём **14**, а различных
эндпоинтов **13** (`DELETE /api/warehouse/batches/:id/audit/:entryId` описан дважды, на
`roo_code/roo-context/03-api-contract.md:1412` и `:1849`); проверка —
`sed -n '1273,1880p' roo_code/roo-context/03-api-contract.md | grep -cE '^### (GET|POST|PUT|PATCH|DELETE) /api'`
→ 14.

| было описано | чем доказано отсутствие или неверность |
|---|---|
| «Все ответы обёрнуты в `ApiResponse<T>`» (`03-api-contract.md:1319`) | форм тела три, а не одна, и выгрузка этого домена едет **голой строкой** (§1 соглашений, `services/warehouseService.ts:266`) |
| каталог кодов домена из восьми кодов (`03-api-contract.md:1308-1315`) | кодов **22**, и восьмёрка не подмножество: `VALIDATION_ERROR` и `NOT_FOUND` — коды ядра (§2 соглашений), и склад не бросает ни того, ни другого нигде, потому что роутов у модуля ноль; остальные шесть верны |
| `BatchStatus` — десять значений (`03-api-contract.md:1281`) | в типе **одиннадцать**: нет `converted_to_offcuts` (`types/warehouse.ts:21-32`) |
| пример ответа партии без `marginPercent` и без пяти полей закупочного следа (`03-api-contract.md:1343-1379`) | поля объявлены и приходят: `marginPercent` (`types/warehouse.ts:120`) и `receivedQuantity`/`receivedUnitId`/`receivedUnitPrice`/`receivedCurrencyId`/`purchaseToWarehouseRate` (`:126-137`) |
| `unitPrice` и `totalCost` числами в примере (`03-api-contract.md:1360-1361`) | оба `number \| null` (`types/warehouse.ts:99`, `:101`), и `null` значит «никто не назвал цену» (§14 соглашений) |
| «Last-write-wins» у PATCH партии (`03-api-contract.md:1404`) | кодом не выражено ничем: ни `If-Match`, ни версии в `WarehouseBatch` нет, и клиент домена не шлёт ни одного заголовка (§11 соглашений). Утверждение верно как описание последствия и неверно как описание механизма |
| «сервер удаляет все движения и обрезки, привязанные к партии» (`03-api-contract.md:1410`) | мок не удаляет ничего, кроме самой партии (`services/mocks/warehouse.ts:820`, БАГ-11) — но схема каскад **требует** четырьмя FK (`warehouse/shared/models.py:102-107`, `:142-147`, `:153-157`, `:240-245`), поэтому утверждение не снято, а перенесено в обязанности сервера раздела `DELETE /api/warehouse/batches/:batchId` со ссылкой на схему как на старший источник |
| «Клиент показывает предупреждение о количестве удаляемых связанных записей» (`03-api-contract.md:1410`) | **подтверждено, не снято**: модал печатает оба числа (`views/admin/warehouse/WarehouseBatchCard.vue:1542`, `:1545`, ключи `i18n/admin/warehouse.ts:424-426`). Аудит домена утверждал обратное — поправка внесена здесь |
| пример записи аудита без поля `id` (`03-api-contract.md:1836-1842`) | `id` обязателен (`types/warehouse.ts:527`) и адресация по нему единственная (§9 соглашений); без него парный `DELETE` не работает |
| `timestamp` записи аудита — локальный формат `dd.mm.yyyy hh:mm` (`03-api-contract.md:1847`) | в типе и в сидах ISO-строка (`types/warehouse.ts:528`, сиды `frontend_vue/src/mocks/warehouse-stock.ts`); формат вывода принадлежит клиенту (§14 соглашений) |
| перечень `referenceType` из пяти значений (`03-api-contract.md:1531`) | домен заказов пишет туда четыре других значения, и ни одно из них склад не узнаёт (БАГ-13); на схеме перечень открыт (`warehouse/shared/models.py:118`) |
| payload резки без `sourcePieces` (`03-api-contract.md:1739-1757`) | поле объявлено и обязательно для штучной партии (`types/warehouse.ts:430-435`); `grep -c sourcePieces roo_code/roo-context/03-api-contract.md` → 0 |
| таблица отказов резки из девяти кодов (`03-api-contract.md:1802-1812`) | отказов **десять**: нет `CUTTING_SOURCE_PIECES_INVALID` (`domain/cutting.ts:57`); `grep -c CUTTING_SOURCE_PIECES_INVALID roo_code/roo-context/03-api-contract.md` → 0 |
| «Отказы `BATCH_NOT_FOUND`, `OFFCUT_DIMENSION_MISSING`, `OFFCUT_PIECES_NOT_INTEGER`, `INSUFFICIENT_QUANTITY` — те же» у ручного создания обрезка (`03-api-contract.md:1820-1822`) | их пять: пропущен `BATCH_UNIT_NOT_SUPPORTED`, который бросает тот же резолвер (`services/mocks/warehouse.ts:906`, код — `domain/cutting.ts:53`) |
| таблица фича-флагов из одной строки — только `adminWarehouse` (`03-api-contract.md:1868-1870`) | флагов **три**: `adminWarehouse` на восьми роутах, `warehouseCutting` и `warehouseMap` по одному (`router/index.ts:294`, `:300`) |
| перечень реализации: композаблы `useWarehouseOffcutsAndDeficit.ts`, `useWarehouseStock.ts` и вьюхи `StockCardPage.vue`, `DeficitCardPage.vue` (`03-api-contract.md:1873-1879`) | ни одного из четырёх файлов не существует; складских композаблов десять, вьюх одиннадцать (`ls frontend_vue/src/composables \| grep -i warehouse`, `ls frontend_vue/src/views/admin/warehouse`) |
| «Карточка движения — data-only» (`03-api-contract.md:1333`) | **подтверждено**: у `useWarehouseMovementCard` нет ни формы, ни `save`, ни `discard` (`:9-56`). Аудит домена ссылался на `:1327`, где стоит другая строка — поправка внесена здесь |
| общие правила: конверт, коды ядра, `PATCH`/`PUT`, мультиарендность, заголовки, права и флаги, аудит-лог, уведомления, идемпотентность, `TranslatedString`, пагинация, деньги и валюта, Save UX, файлы, производные значения, форма `id` | перенесены в [`00-conventions.md`](00-conventions.md) (§1-§19) — правило двух и более доменов в доменном файле не дублируется (§20) |

---

## Пробелы аудита — состояние

Каждый пробел из [аудита](../../plans/api/audit/warehouse.md) закрыт выше или помечен «осталось».
«Осталось» здесь значит одно: ответа нет ни в коде фронта, ни на сервере, и назначать его контракт
не вправе — строка стоит в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), и у домена
`warehouse` таких строк **девять**.

| пробел аудита | где закрыт |
|---|---|
| у 24 из 37 путей раздела в прежнем контракте не было вовсе: все шесть путей остатка, все семь нехватки, выгрузка, карточки движения и обрезка, четыре журнала из пяти, `POST /api/warehouse/batches`, `PATCH` обрезка (был одной фразой прозой, `03-api-contract.md:1576`) | 37 разделов выше, по разделу на путь |
| каскад при удалении партии описан тремя источниками по-разному | раздел `DELETE /api/warehouse/batches/:batchId`, графа обязанностей; строка в «Чего в домене нет» |
| правила пяти складских журналов повторялись бы пять раз | сказаны один раз в разделе `DELETE /api/warehouse/offcuts/:offcutId/audit/:entryId` и вынесены в §9 соглашений |
| чтения журналов и агрегатов отвечают пустым массивом там, где удаления бросают | БАГ-06, назван в шести разделах чтения |
| `categoryIds` уходит в query движений и дефицита и не фильтрует | БАГ-20, назван в обоих разделах |
| у выгрузки форму ответа не задаёт никто | раздел `GET /api/warehouse/export/:tab`, четыре обязанности сервера |
| двенадцать сортируемых колонок не сортируют | БАГ-03, назван в четырёх списочных разделах с перечнем поддержанных ключей |
| три эндпоинта получают ключи, которых нет в их payload | БАГ-10, назван в трёх разделах с точным счётом объявленных и уезжающих ключей |
| списки обрезков и дефицита отдают запись целиком вместо списочной | БАГ-16, назван в обоих разделах; контракт задаёт тип |
| поля `unitPrice`/`currency` payload движения не шлёт никто | БАГ-22, раздел `POST /api/warehouse/movements` |
| журнал приходит дважды — полем сущности и своим эндпоинтом | сказано в каждом из пяти разделов чтения журнала; реестр — «Клиент написан, UI нет» |
| у пяти эндпоинтов написан клиент и нет экрана | раздел «Клиент написан, UI нет», пять строк |
| `DELETE /api/warehouse/movements/:id` есть в моке и нет в клиенте | правило домена 18, с объяснением, почему раздела нет |
| девятнадцать правил домена аудита | раздел «Правила домена», пункты 1-19 один к одному |
| девять граф «Обязанностей сервера» | раздел «Обязанности сервера», графы 1-9, каждая непуста |
| **решено 2026-09-07 частично** · размер страницы принадлежит коду, сервер его не назначает (П20). **Осталось:** ширина реза `3` мм (`composables/useWarehouseCutting.ts:172`) и единица по умолчанию (`'uom-kg'` в четырёх местах, `'uom-pcs'` в четырёх) — код или настройка арендатора: у разного оборудования ширина реза разная | графа 1; [§13](00-conventions.md) |
| **решено 2026-09-07 (П19)** · выводится из настроек, отдельной настройки не заводится. Четыре копии вычисления (`mocks/warehouse.ts:74-76`, `useWarehouseBatchCreate.ts:29-31`, `:42`, литерал `'EUR'` в `useWarehouseBatch.ts:120`) — работа по коду | графа 1; [§14](00-conventions.md) |
| **решено 2026-09-09 (П51, П55)** · **партия просрочена** становится новым типом уведомления; исчерпание остатка ложится на существующий `stock_deficit` и помечается флагом тревоги, когда нехватка под подтверждённый заказ; списание, резка и движения уведомлений не рождают | графа 2; [§10.1](00-conventions.md), [§10.4](00-conventions.md) |
| **решено 2026-09-08 (П36)** · пишет каждая операция, меняющая любое свойство — сегодня не пишет ни одна: `auditLog: []` у создания партии (`mocks/warehouse.ts:780`), обрезка (`:940`), движения (`:1248`) и нехватки (`:1704`, `:1754`), а четыре `mockPatch*` журнала не касаются. Автор — `user_id` плюс замороженный снимок имени, схема это умеет (`warehouse/shared/models.py:246-252`). Хранение: **одна общая таблица** `audit_entries` с `entity_type` и `entity_id` (П38) — все пять складских журналов ложатся в неё, отдельных таблиц под них не заводится, а `stock_audit_entries` сливается туда же | графа 3; [§9](00-conventions.md) |
| **решено 2026-09-07 (П26)** · перечень остаётся в коде, но **одним источником** вместо копий: сегодня единица по умолчанию задана `'uom-kg'` в четырёх местах и `'uom-pcs'` в четырёх других. Сведение копий — работа по коду | графа 5, пункт 1 (БАГ-15) |
| **снято 2026-09-10 (П23)** · незачем: колонка удаляется вместе с отказом от конверсии валют — курса в системе нет нигде | графа 5, пункт 3; [§14](00-conventions.md) |
| **решено 2026-09-10 (П26, П65 а)** · правилами пересчёта владеет код, сервер их валидирует; карта склада — просто картинка, значит адрес хранения партии с ней структурно не связан и сверять адрес по карте сервер не обязан (вторая половина — чтение контракта, не слово владельца) | графа 5, пункты 2 и 4; [§25](00-conventions.md), [§14](00-conventions.md) |
| **решено 2026-09-07** · права на создание партии, резку и движение — обычные элементы CRUD-матрицы по надобности роли (П2, П7); удаление записи журнала — **только владелец** (П8). **Решено 2026-09-07 (П18)** · себестоимость партии сервер **вырезает и присылает цену продажи посчитанной**. Причина выбора: неизвестно, нужна ли кладовщику себестоимость и надо ли её от него прятать, поэтому форма ответа обязана выдержать оба случая. По полям это значит: `sellingPrice` завести в ответе — сегодня его на проводе нет, это клиентский `computed` (`views/admin/warehouse/WarehouseBatchCard.vue:64-68`); вырезать три поля — `unitPrice` (`types/warehouse.ts:99`), `totalCost` (`:100-101`, это `quantity × unitPrice`) и `marginPercent` (`:120`), последнее по правилу полноты вырезания, иначе себестоимость получают делением; `totalSellingValue` не заводить — он выводится из `sellingPrice` и `quantity`. Экран это не ломает: случай «цены нет» уже предусмотрен, поле показывает прочерк (`WarehouseBatchCard.vue:62`, `:65`). Страница при этом обязана не рисовать колонок себестоимости такому пользователю ([§6.7](00-conventions.md)) | графа 7; [§6.6](00-conventions.md), [§6.10](00-conventions.md) |
| **решено 2026-09-09 (П43)** · склад назван атомарным поимённо: Save карточки партии применяется целиком либо не применяется вовсе. Сегодня это `patchBatch()` и следом `createMovement()` двумя запросами без общей границы (`useWarehouseBatch.ts:255`, `:262`), а провал второго заглушён | графа 8; [§15](00-conventions.md) |
| **осталось** · какие колонки в каждой из пяти выгрузок | раздел `GET /api/warehouse/export/:tab`, обязанность 4; ответа нет ни в моке, ни на сервере |
| **осталось** · что делать с `purchaseOrderId`, который правится, но задаётся негде | раздел `PATCH /api/warehouse/deficit/:deficitId`, обязанность 1; модуля закупочных заказов в проекте нет |
| **осталось** · как выразить на проводе `exceptLine` и `claimed`, которых HTTP-вызывающий передать не может | раздел `GET /api/warehouse/stock/:productId/cost`, обязанность 2 |
| **осталось** · какие значения верны для ручного создания нехватки, где мок ставит пять констант плюс выведенное `deficitAmount` | раздел `POST /api/warehouse/deficit`, обязанность 1 (БАГ-26) |
| **осталось** · какой источник главнее для `status` куска: клиентский PATCH или серверное правило по типу движения | раздел `PATCH /api/warehouse/offcuts/:offcutId`, обязанность 2 |
| **осталось** · что происходит с партией при удалении обрезка, чей материал уже списан движением | раздел `DELETE /api/warehouse/offcuts/:offcutId`, обязанность 1 (БАГ-19) |
| **осталось** · кто владеет перечнем `referenceType` и какой из двух словарей главный | раздел `POST /api/warehouse/movements` (БАГ-13) |
| **осталось** · снимок ли `supplierName` на партии и `productName` на нехватке, или join | разделы `GET /api/warehouse/batches/:batchId` и `GET /api/warehouse/deficit` (БАГ-08, БАГ-24) |
| **осталось** · что источник истины для четырёх чужих полей, правимых через `PATCH /api/warehouse/stock/:productId` | раздел `PATCH /api/warehouse/stock/:productId` |

Первые девять «осталось» — это ровно девять строк домена в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md); остальные вынесены
контрактом дополнительно, потому что при письме обнаружились там, где аудит вопрос не задал.

Находки про код домена — [`contract-sync-warehouse-bugs.md`](../../plans/bugs/contract-sync-warehouse-bugs.md),
БАГ-01…БАГ-28. Код этой работой не тронут.
