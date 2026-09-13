# Аудит контракта — warehouse

Эндпоинтов в коде: **37**. Реализовано бэкендом: **0**.

Источник истины по эндпоинту: бэкенд → мок+клиент → замысел. Пустая графа = задача не закрыта.
Утверждение без `файл:строка` не записывается. Код не правится: место, где он выглядит
неверным, — находка в `roo_code/plans/bugs/contract-sync-warehouse-bugs.md`.

> **Что общего у всех 37 разделов — чтобы не повторять это 37 раз.**
>
> **Бэкенда нет ни у одного.** Модуль `warehouse` в `backend/app/modules/` существует, но роутов
> у него ноль: `grep -rn "@router\." backend/app/modules/warehouse --include=*.py` не даёт ни
> одного попадания, `features/` содержит только `__init__.py`
> (`find backend/app/modules/warehouse -type f -name '*.py'` — семь файлов, из них
> `internal_api/interface.py` и `shared/dependencies.py` — по одной строке докстроки), и в
> `backend/app/main.py:66-74` подключены девять роутеров, ни одного складского. По К5 старшинство
> «бэкенд» здесь **не наступило** ни разу. **Но схема зафиксирована целиком** — шесть таблиц:
> `warehouse_batches`, `warehouse_movements`, `warehouse_offcuts`, `warehouse_deficits`,
> `stock_items`, `stock_audit_entries` (`backend/app/modules/warehouse/shared/models.py:11`,
> `:91`, `:131`, `:168`, `:202`, `:229`; миграция
> `backend/alembic/versions/fd0ecc1269df_phase_9_warehouse.py:26`, `:52`, `:72`, `:89`, `:103`,
> `:113`; доработка закупочного следа —
> `backend/alembic/versions/a1b2c3d4e5f6_phase_15_product_uom_restructure.py:104-137`).
> Схема учтена как ограничение, а не как форма, и расходится с фронтом в четырёх местах, каждое
> из которых записано находкой: у движения нет `offcut_id` (находка 23), у обрезка нет ни одного
> размера (17), у нехватки нет приоритета, а `status` объявлен значением приоритета (25),
> уникальность строки остатка объявлена без арендатора (28).
>
> **Заголовков клиент не шлёт ни одного.** `grep -c "headers\|options" frontend_vue/src/services/warehouseService.ts`
> → 0 на 374 строки. Значит нет ни `Authorization`, ни `X-CSRF-Token`, ни `Idempotency-Key`, ни
> `If-Match` — при том, что все четыре механизма в проекте есть
> (`frontend_vue/src/composables/useAuth.ts:101-108`, `frontend_vue/src/services/api.ts:239-245`,
> `frontend_vue/src/services/mocks/index.ts:1420-1421`) и соседние домены ими пользуются
> (`frontend_vue/src/services/settingsService.ts:18`, `frontend_vue/src/services/auditFeedService.ts:20`).
> Это находка 1, и она общая для всех 37 путей.
>
> **Конверт.** `unwrap()` снимает `{success, data}` и отдаёт наружу `json.data`
> (`frontend_vue/src/services/api.ts:128-141`); мок конверта не строит вовсе — `getMock`/`postMock`
> вызываются вместо `fetch` (`frontend_vue/src/services/api.ts:149-151`, `:168-170`), возвращая голое значение через
> `delay(...)`. Ошибка мока — голый `Error`, код лежит в `message`, а не в `ApiRequestError.code`
> (`frontend_vue/src/types/api.ts:26-31`).
>
> **Кодов у домена 22**, и это второе место после заказов. Семнадцать бросает мок домена
> (`grep -o "new Error('[A-Z_]*')" frontend_vue/src/services/mocks/warehouse.ts | sort -u` → 17),
> ещё пять приходят из доменного слоя резки через `MATERIAL_ERROR_CODE`
> (`frontend_vue/src/domain/cutting.ts:52-58`). До человека отдельным сообщением доходят **два**:
> `BATCH_LINKED_TO_ORDER` (`frontend_vue/src/composables/useWarehouseBatch.ts:341`) и
> `OFFCUT_LINKED_TO_ORDER` (`frontend_vue/src/composables/useWarehouseOffcutCard.ts:386`).
> Остальные двадцать гасятся `catch` без параметра.
>
> **Правило соседа не выводится заново.** Про регистр форм у домена с бэкендом, про
> `TranslatedString` и про то, что имя товара — ссылка, а не поле: см. аудит products, «Правила
> домена…», пункты 1 и 10, и графу «Настройки, которых мок не отслеживает», пункт 4. Про то, что
> уведомление — это переход, а не момент, и что события рождают чужие домены: см. аудит
> notifications, «Правила домена…», пункты 3 и 4. Про то, что валюта по умолчанию выражена
> дважды — флагом `isDefault` и константой `constants.defaultCurrency` — см. аудит settings,
> графа «Значения по умолчанию и их владелец».

## Эндпоинты

### DELETE /api/warehouse/batches/:id
- Вызывающий: `src/services/warehouseService.ts:115`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1607`
- Форма запроса: тела нет — `apiDelete(\`/api/warehouse/batches/${id}\`)` (`src/services/warehouseService.ts:114-116`); ни query, ни заголовков, в том числе ни `If-Match`, который ветка удаления мока читать умеет (`services/mocks/index.ts:1428`).
- Форма ответа: `Promise<void>`; мок отдаёт `delay(undefined as T)` (`services/mocks/index.ts:1610`), на проводе `ApiResponse<null>`.
- Коды ошибок: два — `BATCH_NOT_FOUND` (`services/mocks/warehouse.ts:818`) и `BATCH_LINKED_TO_ORDER` (`:819`). Второй — единственный код домена, который **доходит до человека отдельным сообщением**, и единственный, который читается правильно с обеих сторон: `err?.code === 'BATCH_LINKED_TO_ORDER' || err?.message === …` (`src/composables/useWarehouseBatch.ts:341`). Тот же вызов со списка кода не читает вовсе (`src/composables/useWarehouse.ts:318-326`).
- Save-режим: quick-action. Трое вызывающих: карточка партии по подтверждению модала (`src/composables/useWarehouseBatch.ts:331-349`) с переходом на вкладку партий, список (`src/composables/useWarehouse.ts:320`) с перезагрузкой, и сама вьюха списка (`src/views/admin/warehouse/WarehousePage.vue`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1400-1405`) обещает **каскадное удаление движений и обрезков** сервером и предупреждение клиента о числе связанных записей. Кодом не подтверждено ничто из этого: `mockDeleteBatch` вырезает одну запись (`services/mocks/warehouse.ts:820`) и не трогает ни `movementStore`, ни `offcutStore`, оставляя их висеть на несуществующей партии. На схеме политика другая и обязательная: `warehouse_movements.batch_id` и `warehouse_offcuts.batch_id` — `ondelete="CASCADE"` (`backend/app/modules/warehouse/shared/models.py:102-107`, `:142-147`), `warehouse_deficits.batch_id` — `SET NULL` (`:185-189`), `stock_audit_entries.batch_id` — `CASCADE` (`:240-245`), `warehouse_offcuts.parent_batch_id` — `SET NULL` (`:153-157`) → находка 11.
- Источник истины: мок + клиент по коду ошибки; по каскаду — **схема**, и она с моком не согласуется.

### DELETE /api/warehouse/batches/:id/audit/:id
- Вызывающий: `src/services/warehouseService.ts:343`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1441`
- Форма запроса: тела нет, два сегмента пути (`src/services/warehouseService.ts:342-344`); заголовков нет, включая вызов из ленты аудита (`src/services/auditFeedService.ts:70`).
- Форма ответа: `Promise<void>`; мок — `delay(undefined as T)` (`services/mocks/index.ts:1445`).
- Коды ошибок: два — `BATCH_NOT_FOUND` (`services/mocks/warehouse.ts:1883`) и `AUDIT_ENTRY_NOT_FOUND` (`:1885`). Ни один не подстрока другого. До человека не доходит ни один: карточка показывает общий `warehouse.toast_error` (`src/composables/useWarehouseBatch.ts:459`).
- Save-режим: quick-action, по подтверждению модала. Из карточки — `deleteAuditEntry` c локальной правкой списка (`src/composables/useWarehouseBatch.ts:452-461`), из ленты — `deleteAuditFeedEntry` (`src/services/auditFeedService.ts:70`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1407-1414`) единственный из шести таких эндпоинтов домена описан — и описан верно, включая правило «неизвестный id — ошибка, а не тихий no-op» (`:1412-1413`) и адресацию по `entryId`, а не по позиции (`:1414`). Не описано: (а) что тем же эндпоинтом пользуется общая лента аудита и второго пути к записи нет (`src/services/auditFeedService.ts:70`); (б) кому это разрешено.
- Источник истины: мок + клиент.

### DELETE /api/warehouse/deficit/:id
- Вызывающий: `src/services/warehouseService.ts:257`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1625`
- Форма запроса: тела нет (`src/services/warehouseService.ts:256-258`), заголовков нет.
- Форма ответа: `Promise<void>`; мок — `delay(undefined as T)` (`services/mocks/index.ts:1629`).
- Коды ошибок: один — `DEFICIT_NOT_FOUND` (`services/mocks/warehouse.ts:1772`). До человека не доходит: оба вызывающих ловят `catch` без параметра (`src/composables/useWarehouse.ts:343`, `src/composables/useWarehouseDeficitCard.ts:118`).
- Save-режим: quick-action по подтверждению. Двое вызывающих: список (`src/composables/useWarehouse.ts:338-346`) и карточка с переходом на вкладку (`src/composables/useWarehouseDeficitCard.ts:111-123`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано: (а) что запись, заведённую заказом, удаляет ещё и `clearShortages` — без HTTP и без следа (`services/mocks/warehouse.ts:1726-1734`); (б) что ручное удаление нехватки заказа снимет её насовсем, а следующий пересчёт строки заведёт заново (`:1678-1687`).
- Источник истины: мок + клиент.

### DELETE /api/warehouse/deficit/:id/audit/:id
- Вызывающий: `src/services/warehouseService.ts:373`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1467`
- Форма запроса: тела нет, два сегмента пути (`src/services/warehouseService.ts:372-374`); заголовков нет, в том числе из ленты (`src/services/auditFeedService.ts:76`).
- Форма ответа: `Promise<void>`; мок — `delay(undefined as T)` (`services/mocks/index.ts:1475`).
- Коды ошибок: два — `DEFICIT_NOT_FOUND` (`services/mocks/warehouse.ts:1926`) и `AUDIT_ENTRY_NOT_FOUND` (`:1928`); до человека не доходит ни один (`src/composables/useWarehouseDeficitCard.ts:56`).
- Save-режим: quick-action. Двое вызывающих: карточка дефицита (`src/composables/useWarehouseDeficitCard.ts:50-58`) и лента аудита (`src/services/auditFeedService.ts:76`).
- Пробел контракта: эндпоинта в старом тексте нет.
- Источник истины: мок + клиент.

### DELETE /api/warehouse/movements/:id/audit/:id
- Вызывающий: `src/services/warehouseService.ts:363`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1456`
- Форма запроса: тела нет, два сегмента пути (`src/services/warehouseService.ts:362-364`); заголовков нет, в том числе из ленты (`src/services/auditFeedService.ts:74`).
- Форма ответа: `Promise<void>`; мок — `delay(undefined as T)` (`services/mocks/index.ts:1466`).
- Коды ошибок: один — `AUDIT_ENTRY_NOT_FOUND` (`services/mocks/warehouse.ts:1912`). Кода «движения нет» здесь **не бросается вовсе**: для неизвестного id `getOrCreateMovementAudit` вернёт пустой массив, и ошибкой станет отсутствие записи в нём (`:1906-1913`) — единственный из пяти журналов, где отказ «нет сущности» не отличим от «нет записи».
- Save-режим: quick-action. Двое вызывающих: карточка движения (`src/composables/useWarehouseMovementCard.ts:22-30`) и лента аудита (`src/services/auditFeedService.ts:74`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано, что удаление правит **копию** журнала, а не сид, и что лента читает ту же копию именно поэтому (`services/mocks/warehouse.ts:1934-1941`, `:1975-1988`).
- Источник истины: мок + клиент.

### DELETE /api/warehouse/offcuts/:id
- Вызывающий: `src/services/warehouseService.ts:165`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1613`
- Форма запроса: тела нет (`src/services/warehouseService.ts:164-166`), заголовков нет.
- Форма ответа: `Promise<void>`; мок — `delay(undefined as T)` (`services/mocks/index.ts:1616`).
- Коды ошибок: два — `OFFCUT_NOT_FOUND` (`services/mocks/warehouse.ts:1113`) и `OFFCUT_LINKED_TO_ORDER` (`:1114`). Второй читался **только из `message`** — ~~находка 18~~, **закрыто 2026-09-13:** сегодня код берётся через `errorCode(e)` (`src/composables/useWarehouseOffcutCard.ts:386`), то есть из `ApiRequestError.code` (`src/types/api.ts:26-31`), как и парная проверка у партии (`src/composables/useWarehouseBatch.ts:341`). Пометка `✅` стоит в баг-файле.
- Save-режим: quick-action по подтверждению модала. Трое вызывающих: карточка обрезка (`src/composables/useWarehouseOffcutCard.ts:385`), список (`src/composables/useWarehouse.ts:328-336`) и вьюха списка (`src/views/admin/warehouse/WarehousePage.vue`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано: (а) что удаление куска **не возвращает материал партии** — движение `offcut`, списавшее его, остаётся в журнале, а `syncBatchQuantities` пересчитает остаток по этому же журналу (`services/mocks/warehouse.ts:397-413`), то есть металл исчезает из обоих мест; (б) что `orderId` куска — единственный сторож удаления, а хват строки заказа, по которому кусок и считается занятым, здесь не спрашивается вовсе (`:1111-1116` против `takenOffcuts` `:998-1000`) → находка 19; (в) что движения куска остаются висеть на удалённом `offcutId`.
- Источник истины: мок + клиент.

### DELETE /api/warehouse/offcuts/:id/audit/:id
- Вызывающий: `src/services/warehouseService.ts:353`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1447`
- Форма запроса: тела нет, два сегмента пути (`src/services/warehouseService.ts:352-354`); заголовков нет, в том числе из ленты (`src/services/auditFeedService.ts:72`).
- Форма ответа: `Promise<void>`; мок — `delay(undefined as T)` (`services/mocks/index.ts:1457`).
- Коды ошибок: два — `OFFCUT_NOT_FOUND` (`services/mocks/warehouse.ts:1896`) и `AUDIT_ENTRY_NOT_FOUND` (`:1898`); до человека не доходит ни один (`src/composables/useWarehouseOffcutCard.ts:191`).
- Save-режим: quick-action. Двое вызывающих: карточка обрезка (`src/composables/useWarehouseOffcutCard.ts:185-193`) и лента аудита (`src/services/auditFeedService.ts:72`).
- Пробел контракта: эндпоинта в старом тексте нет; описан только аналог у партии (`roo_code/roo-context/03-api-contract.md:1407-1414`). Правила у пяти складских журналов одинаковы, и это стоит сказать один раз, а не разойтись пятью формулировками.
- Источник истины: мок + клиент.

### DELETE /api/warehouse/stock/:id/audit/:id
- Вызывающий: `src/services/warehouseService.ts:333`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1435`
- Форма запроса: тела нет, два сегмента пути — `apiDelete<void>(\`/api/warehouse/stock/${productId}/audit/${entryId}\`)` (`src/services/warehouseService.ts:332-334`). Заголовков нет **даже когда зовёт лента аудита**: `deleteAuditFeedEntry` роутит сюда по `entityType` (`src/services/auditFeedService.ts:66-68`), а собственные чтения ленты подписаны `Authorization` (`:20-24`, `:41`) → находка 1.
- Форма ответа: `Promise<void>`; мок возвращает `delay(undefined as T)` (`services/mocks/index.ts:1439`). На проводе — общий конверт, то есть `ApiResponse<null>` (`src/services/api.ts:128-137`). Тела не читает ни один вызывающий: карточка правит список у себя (`src/composables/useWarehouseStockCard.ts:182`), лента — своей `withoutRow` (`src/composables/useAuditFeed.ts`).
- Коды ошибок: два — `STOCK_NOT_FOUND` (`services/mocks/warehouse.ts:1866`) и `AUDIT_ENTRY_NOT_FOUND` (`:1868`). Ни один не подстрока другого. До человека не доходит ни один: карточка показывает общий `warehouse.toast_error` (`src/composables/useWarehouseStockCard.ts:185`).
- Save-режим: quick-action. Из карточки — по подтверждению модала (`src/composables/useWarehouseStockCard.ts:179-187`), список правится локально без перезагрузки (`:182`). Из ленты — `deleteAuditFeedEntry` (`src/services/auditFeedService.ts:66-68`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано: (а) что удаление адресуется `entryId`, а не позицией в списке — правило записано в типе и распространено на все девять журналов (`src/types/warehouse.ts:510-525`); (б) что запись лога удаляется из двух мест одним эндпоинтом и второго пути к ней нет; (в) кому это разрешено — удаление следа изменения не гейтится ни правом, ни фича-флагом (в матрице прав склада нет ни строки, см. графу «Права»).
- Источник истины: мок + клиент. Форма — `services/mocks/warehouse.ts:1864-1870`, ветка — `services/mocks/index.ts:1435-1440`.

### GET /api/warehouse/batches
- Вызывающий: `src/services/warehouseService.ts:99`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:658`
- Форма запроса: query: всегда `search`, `page`, `pageSize`; условно `productId`, `supplierId`, `status`, `uomId`, `dateFrom`, `dateTo`, `sortBy`, `sortDir` (`src/services/warehouseService.ts:86-99`). Мок читает те же одиннадцать (`services/mocks/index.ts:664-672`), дефолты страницы — в ветке (`:657-658`), дефолты сортировки `receivedAt`/`desc` — в функции (`services/mocks/warehouse.ts:593-594`). Заголовков нет.
- Форма ответа: `BatchListResponse` = `PaginatedResponse<BatchListItem>` (`src/types/warehouse.ts:676`), сбор — `paginate(filtered.map(toBatchListItem), …)` (`services/mocks/warehouse.ts:612`). Списочная запись — 11 полей (`src/types/warehouse.ts:140-156`), и `unitPrice` в ней **`number | null`**: партия, которую никто не оценил, не стоит нуля, причина названа в коде (`services/mocks/warehouse.ts:615-623`). Имени товара и имени поставщика в списочной записи нет — подпись собирается на месте показа из справочника (`src/types/warehouse.ts:73-77`).
- Коды ошибок: ни одного: в `mockGetBatches` нет ни одного `throw` (`services/mocks/warehouse.ts:565-613`). Клиент кладёт текст в состояние (`src/composables/useWarehouse.ts:225`).
- Save-режим: чтение, и вызывающих четверо. Вкладка партий — `loadBatches()` c обязательным `Promise.all` вместе со справочником имён товаров, чтобы строка не обогнала подпись (`src/composables/useWarehouse.ts:203-229`, причина — `:212-213`). Справочником партии — карточка остатка (`src/composables/useWarehouseStockCard.ts:46-49`, `pageSize: 100`), страница создания обрезка (`src/composables/useWarehouseOffcutCreate.ts`) и страница резки (`src/composables/useWarehouseCutting.ts`).
- Пробел контракта: эндпоинта в старом тексте **нет**: описана карточка партии, а списка партий среди 13 заголовков диапазона нет (`sed -n '1273,1880p' roo_code/roo-context/03-api-contract.md | grep -c '^### GET /api/warehouse/batches$'` → 0). Не описано: (а) что поиск идёт по имени товара **через join** и по номеру партии (`services/mocks/warehouse.ts:580-585`, `_matchesProductName` — `:136-144`); (б) что сортировка по номеру партии — не строковая, а по правилу документных номеров (`:599`, причина `:597-598`); (в) что колонка «Лот» сортировку не поддерживает: страница шлёт `sortBy='lotCode'` (`src/views/admin/warehouse/WarehousePage.vue:1908`), а мок такой ветки не имеет (`services/mocks/warehouse.ts:595-610`) → находка 3; (г) что `unitPrice` в списочной записи бывает `null`.
- Источник истины: мок + клиент. Схема расходится с формой: у `warehouse_batches` единица — `unit: String(20)` (`backend/app/modules/warehouse/shared/models.py:39`), а фронт держит `uomId` — ссылку на справочник настроек (`src/types/warehouse.ts:147-148`); `margin_percent` и `product_name` на схеме нет вовсе.

### GET /api/warehouse/batches/:id
- Вызывающий: `src/services/warehouseService.ts:103`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:679`
- Форма запроса: только путь (`src/services/warehouseService.ts:102-104`), ни query, ни заголовков. Мок ловит `/^\/api\/warehouse\/batches\/([^/]+)$/` (`services/mocks/index.ts:679`); внутри ветки стоит проверка `path.endsWith('/audit')` (`:682-684`), которая **недостижима** — `[^/]+` не может содержать `/` → находка 7.
- Форма ответа: `WarehouseBatch` целиком, копией записи — `{ ...batch }` (`services/mocks/warehouse.ts:641-645`). 27 полей (`src/types/warehouse.ts:63-138`), из них `files?` объявлено необязательным **сознательно**: контракт складских сущностей его не описывает, значит гарантии сервера нет (`:65-70`). `unitPrice` и `totalCost` — `number | null` (`:99`, `:101`), `currency` — всегда базовая валюта и ничто иное (`:102-103`).
- Коды ошибок: один — `BATCH_NOT_FOUND` (`services/mocks/warehouse.ts:643`). До человека доходит текстом: `error.value = e instanceof Error ? e.message : 'Failed to load batch'` (`src/composables/useWarehouseBatch.ts:230`).
- Save-режим: чтение. Вызывающих четверо: карточка партии (`src/composables/useWarehouseBatch.ts:198`, вместе со справочником имён), карточка обрезка — ради товара **партии**, а не обрезка (`src/composables/useWarehouseOffcutCard.ts:233-241`, причина `:225-230`), страница резки (`src/composables/useWarehouseCutting.ts`) и сама вьюха карточки (`src/views/admin/warehouse/WarehouseBatchCard.vue`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1338-1379`) описывает форму, но: (а) в примере ответа нет `marginPercent` и всех пяти полей закупочного следа — `receivedQuantity`, `receivedUnitId`, `receivedUnitPrice`, `receivedCurrencyId`, `purchaseToWarehouseRate` (`src/types/warehouse.ts:120`, `:126-137`); (б) не сказано, что `unitPrice` и `totalCost` бывают `null` — в примере стоят числа (`roo_code/roo-context/03-api-contract.md:1360-1361`); (в) перечень `BatchStatus` в шапке домена (`roo_code/roo-context/03-api-contract.md:1281`) содержит десять значений, а тип — одиннадцать: нет `converted_to_offcuts` (`src/types/warehouse.ts:32`); (г) не сказано, что `supplierName` — снимок, разошедшийся со справочником: 15 различных `supplierId` в сидах партий, и **ни один** не существует в каталоге поставщиков (`frontend_vue/src/mocks/warehouse-batches.ts` против `frontend_vue/src/services/mocks/suppliers.ts` — id там `1`…`6`, `f1`, `f2`, `sup-au-1`, `sup-au-2`) → находка 8.
- Источник истины: мок + клиент. На схеме нет колонок под `margin_percent`, `supplier_name`, `lot_code` есть (`backend/app/modules/warehouse/shared/models.py:34`), а `exchange_rate` есть на схеме (`:86-88`) и отсутствует во фронте — конверсии в проекте нет нигде.

### GET /api/warehouse/batches/:id/active-sales
- Вызывающий: `src/services/warehouseService.ts:209`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:698`
- Форма запроса: только путь (`src/services/warehouseService.ts:208-210`).
- Форма ответа: `BatchActiveSale[]` — `{id, movementId, quantity, uomId, referenceId, soldAt}` (`src/types/warehouse.ts:557-567`). `id` **синтетический и позиционный**: `sale-${batchId}-${idx}` (`services/mocks/warehouse.ts:1473`), то есть меняется при появлении новой продажи, — в отличие от всего остального в домене, что адресуется собственным id.
- Коды ошибок: ни одного: неизвестная партия отвечает пустым массивом (`services/mocks/warehouse.ts:1455`) → находка 6.
- Save-режим: чтение. Один вызывающий — карточка партии (`src/composables/useWarehouseBatch.ts:379-389`); результат передаётся в модал создания движения, где выбирается продажа для возврата (`src/views/admin/warehouse/CreateMovementModal.vue:511-514`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1446-1459`) описывает форму и формулу. Не сказано: (а) что возвраты сопоставляются продажам **по `referenceId`**, а не по движению (`services/mocks/warehouse.ts:1457-1462`, `:1468`), и потому возврат клиента, который домен заказов пишет с `referenceId = orderReturn.id` (`frontend_vue/src/services/mocks/orders.ts:3781`), ни одной продаже не сопоставится — сопоставится только отмена отгрузки, у которой `referenceId = shipment.id` совпадает с продажей (`:3345`, `:3436`) → находка 13; (б) что продажа с `referenceId: null` не сопоставляется ничему и остаётся активной навсегда (`services/mocks/warehouse.ts:1468`); (в) что `id` строки позиционный.
- Источник истины: мок + клиент. Производное: колонок под это на схеме нет.

### GET /api/warehouse/batches/:id/aggregates
- Вызывающий: `src/services/warehouseService.ts:205`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:693`
- Форма запроса: только путь (`src/services/warehouseService.ts:204-206`), ни query, ни заголовков.
- Форма ответа: `BatchStatusAggregate[]` — голый массив из `{type, quantity, uomId}` (`src/types/warehouse.ts:548-553`), собирается заново при каждом чтении (`services/mocks/warehouse.ts:1415-1451`). Порядок значащий: сперва `receipt` (остаток партии), затем прочие по убыванию количества, и только с `quantity > 0` (`:1440-1449`).
- Коды ошибок: ни одного: неизвестная партия отвечает **пустым массивом**, а не `BATCH_NOT_FOUND` (`services/mocks/warehouse.ts:1417`) → находка 6.
- Save-режим: чтение. Двое вызывающих: карточка партии (`src/composables/useWarehouseBatch.ts:367-377`) и карточка остатка, которая зовёт его **в цикле по всем партиям товара** и складывает результаты сама (`src/composables/useWarehouseStockCard.ts:42-74`, вызов `:55`) — то есть N+1 запрос на экран → находка 12.
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1421-1444`) описывает и форму, и алгоритм. Не сказано: (а) что движение с заполненным `offcutId` (кроме самой резки) в агрегаты партии **не попадает** — `movesOffcut` отсекает его (`services/mocks/warehouse.ts:1425`, определение `:380-382`, причина `:365-379`); (б) что возврат уменьшает агрегат только если его `referenceType` принадлежит списку уносящих типов (`:1426-1431`, список `:355-363`), а домен заказов пишет туда `order-shipment`, `order-shipment-cancelled`, `order-return` (`frontend_vue/src/services/mocks/orders.ts:3344`, `:3435`, `:3780`) — ни одного из них в списке нет, то есть возврат отгрузки агрегат продажи не уменьшает → находка 13; (в) что `receipt` берётся из `quantityRemaining`, а не из журнала (`services/mocks/warehouse.ts:1440`).
- Источник истины: мок + клиент. Производное целиком: колонок под агрегаты на схеме нет (`backend/app/modules/warehouse/shared/models.py:11-88`).

### GET /api/warehouse/batches/:id/audit
- Вызывающий: `src/services/warehouseService.ts:339`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:688`
- Форма запроса: только путь (`src/services/warehouseService.ts:338-340`). Ветка мока стоит **после** ветки карточки (`services/mocks/index.ts:688` против `:679`) и достижима только потому, что регулярка карточки требует конца строки.
- Форма ответа: `StockAuditEntry[]` — голый массив; мок отдаёт `structuredClone` журнала партии, и причина копии названа прямо: живой массив позволял вызывающему править стор чтением (`services/mocks/warehouse.ts:1872-1879`).
- Коды ошибок: ни одного — неизвестная партия отвечает пустым массивом (`services/mocks/warehouse.ts:1878`). Парный DELETE на том же условии бросает `BATCH_NOT_FOUND` (`:1883`) → находка 6.
- Save-режим: чтение. Единственный из пяти складских журналов, у которого **есть** свой вызывающий: `loadAudit()` карточки партии (`src/composables/useWarehouseBatch.ts:439-450`), внутри `Promise.all` при загрузке (`:222-228`). Ошибку глотает, оставляя пустой лог (`:446-448`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1836-1856`) описывает форму, но: (а) в примере записи **нет поля `id`** (`:1842-1849`), тогда как адресация по `id` — единственная (`src/types/warehouse.ts:510-525`), и парный DELETE без него не работает; (б) обещан `timestamp` в локальном формате `dd.mm.yyyy hh:mm` (`roo_code/roo-context/03-api-contract.md:1855`) — в сидах и в типе ISO-строка (`frontend_vue/src/mocks/warehouse-batches.ts`, `src/types/warehouse.ts:528`); (в) не сказано, что журналы всех пяти складских сущностей едут **и полем сущности тоже**, а тут — вторым путём.
- Источник истины: мок + клиент. Единственная таблица журнала на схеме — `stock_audit_entries`, и она привязана именно к партии (`backend/app/modules/warehouse/shared/models.py:229-258`): у партии из пяти журналов домена хранение есть, у остальных четырёх нет.

### GET /api/warehouse/deficit
- Вызывающий: `src/services/warehouseService.ts:238`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:779`
- Форма запроса: query: всегда `search`, `page`, `pageSize`; условно `priority`, `status`, `uomId`, `categoryIds`, `sortBy`, `sortDir` (`src/services/warehouseService.ts:226-238`). Мок читает те же девять (`services/mocks/index.ts:785-791`), но `categoryIds` **принимает и не применяет** — фильтра по нему в теле нет (`services/mocks/warehouse.ts:1607-1633`) → находка 20. Дефолты сортировки — `deficitAmount`/`desc` (`:1636-1637`).
- Форма ответа: `DeficitListResponse` = `PaginatedResponse<DeficitListItem>` (`src/types/warehouse.ts:679`); мок отдаёт **запись целиком** без проекции (`services/mocks/warehouse.ts:1651`), то есть с `suggestedOrderQty`, `purchaseOrderId`, обоими таймстампами и журналом, которых `DeficitListItem` не объявляет (`src/types/warehouse.ts:469-490`) → находка 16. Поле `notes` в списочной записи объявлено именно потому, что оно уже ехало, и именно оно связывает нехватку с породившим её заказом (`:480-489`).
- Коды ошибок: ни одного (`services/mocks/warehouse.ts:1595-1652`).
- Save-режим: чтение. Один вызывающий — вкладка дефицита (`src/composables/useWarehouse.ts:283-304`); справочник имён здесь **не тянется**, в отличие от трёх соседних вкладок (`:214-220`, `:240-246`, `:266-272`), потому что запись дефицита хранит имя товара своей копией (`src/types/warehouse.ts:446`).
- Пробел контракта: эндпоинта в старом тексте нет — дефицит в диапазоне домена не описан ни одним заголовком. Не описано: (а) что `productName` — **копия**, а не ссылка, единственная оставшаяся в домене после того, как её убрали у партии, обрезка и движения (`roo_code/roo-context/03-api-contract.md:1297-1303` против `src/types/warehouse.ts:446`) → находка 24; (б) что `categoryIds` не фильтрует; (в) что колонки «Единица» и «Статус» не сортируются: страница шлёт `uomId` и `status` (`src/views/admin/warehouse/WarehousePage.vue:3555`, `:3643`), мок таких веток не имеет (`services/mocks/warehouse.ts:1638-1649`) → находка 3.
- Источник истины: мок + клиент. Схема беднее и расходится в смысле: у `warehouse_deficits` нет ни `priority`, ни `suggested_order_qty`, ни `purchase_order_id`, а `status` объявлен `String(20)` с дефолтом **`"critical"`** (`backend/app/modules/warehouse/shared/models.py:196-198`) — это значение из перечня `DeficitPriority`, а не `DeficitStatus` (`src/types/warehouse.ts:46`, `:49`) → находка 25.

### GET /api/warehouse/deficit/:id
- Вызывающий: `src/services/warehouseService.ts:242`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:798`
- Форма запроса: только путь (`src/services/warehouseService.ts:241-243`). Ветка мока — `services/mocks/index.ts:798`, с недостижимой проверкой `path.endsWith('/audit')` внутри (`:801-803`) → находка 7.
- Форма ответа: `WarehouseDeficit` целиком, копией (`services/mocks/warehouse.ts:1654-1658`), 15 полей (`src/types/warehouse.ts:442-467`).
- Коды ошибок: один — `DEFICIT_NOT_FOUND` (`services/mocks/warehouse.ts:1656`); до человека доходит текстом (`src/composables/useWarehouseDeficitCard.ts:74`).
- Save-режим: чтение. Один вызывающий — `load()` карточки дефицита (`src/composables/useWarehouseDeficitCard.ts:60-78`), он же берёт журнал полем ответа (`:72`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано: (а) что `deficitAmount` и `currentStock` — **хранимые копии**, а не производные от остатка: `recordShortage` пишет `currentStock: 0` всегда (`services/mocks/warehouse.ts:1693`), а `mockCreateDeficitItem` — тоже ноль и `deficitAmount = minRequired` (`:1743-1745`), тогда как настоящий остаток лежит в строке склада и считается из партий (`:449`); (б) что `productName` — копия (см. `GET /api/warehouse/deficit`).
- Источник истины: мок + клиент.

### GET /api/warehouse/deficit/:id/audit
- Вызывающий: `src/services/warehouseService.ts:369`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:807`
- Форма запроса: только путь (`src/services/warehouseService.ts:368-370`); ветка — `services/mocks/index.ts:807-810`.
- Форма ответа: `StockAuditEntry[]`, `structuredClone` журнала записи (`services/mocks/warehouse.ts:1916-1919`).
- Коды ошибок: ни одного — неизвестная запись отвечает пустым массивом (`services/mocks/warehouse.ts:1918`), парный DELETE бросает `DEFICIT_NOT_FOUND` (`:1926`) → находка 6.
- Save-режим: чтение, **вызывающего нет**: `grep -rn 'getDeficitAudit' frontend_vue/src --include=*.ts --include=*.vue` даёт только объявление (`src/services/warehouseService.ts:368`). Карточка берёт журнал полем ответа (`src/composables/useWarehouseDeficitCard.ts:72`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано, что журнал есть у всех пяти складских сущностей и приходит двумя путями, из которых работает один.
- Источник истины: мок + клиент. Таблицы под журнал дефицита на схеме нет.

### GET /api/warehouse/export/:id
- Вызывающий: `src/services/warehouseService.ts:323`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:813`
- Форма запроса: сегмент пути — **вкладка**, а не идентификатор: `stock | batches | offcuts | movements | deficit` (`src/services/warehouseService.ts:262-323`, регулярка мока перечисляет их поимённо — `services/mocks/index.ts:813-815`). Query собирается по вкладке: общий `search`, необязательный `_locale` и от четырёх до шести фильтров своей вкладки (`src/services/warehouseService.ts:267-321`) — всего 58 строк сборки.
- Форма ответа: `string` — тело CSV (`src/services/warehouseService.ts:266`). Мок отдаёт литерал `'mock-csv-data'` и **не смотрит ни на вкладку, ни на один фильтр**: `mockExportWarehouseCsv(_tab)` (`services/mocks/warehouse.ts:1853-1855`) → находка 27.
- Коды ошибок: ни одного (`services/mocks/warehouse.ts:1853-1855`). Вызывающий показывает общий `warehouse.export_error` (`src/views/admin/warehouse/WarehousePage.vue:333`).
- Save-режим: чтение, quick-action по кнопке. Один вызывающий — `exportCurrentTab()` (`src/views/admin/warehouse/WarehousePage.vue:296-334`), который берёт фильтры текущей вкладки, зовёт эндпоинт и сохраняет ответ файлом через `Blob` + `URL.createObjectURL` (`:327-332`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано: (а) что ответ — **голая строка, а не конверт**: `unwrap()` отдаст её как есть только потому, что у неё нет ключа `success` (`src/services/api.ts:128-137`), то есть сервер обязан отвечать CSV, а не `ApiResponse<string>`; (б) что `_locale` — параметр запроса, а не заголовок `Accept-Language`, и что подписи колонок обязан переводить сервер (`src/services/warehouseService.ts:267-268`); (в) что пагинации у выгрузки нет и она обязана отдавать весь отфильтрованный набор; (г) какие колонки в каждой из пяти выгрузок.
- Источник истины: мок + клиент по форме запроса; форму ответа не задаёт **никто** — мок её не строит.

### GET /api/warehouse/movements
- Вызывающий: `src/services/warehouseService.ts:191`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:755`
- Форма запроса: query: всегда `search`, `page`, `pageSize`; условно `type`, `productId`, `uomId`, `categoryIds`, `batchNumber`, `referenceId`, `offcutId`, `dateFrom`, `dateTo`, `sortBy`, `sortDir` (`src/services/warehouseService.ts:174-191`). Мок читает те же четырнадцать (`services/mocks/index.ts:761-772`), но `categoryIds` **принимает и не применяет**: в теле функции фильтра по нему нет (`services/mocks/warehouse.ts:1156-1174`) → находка 20.
- Форма ответа: `MovementListResponse` = `PaginatedResponse<MovementListItem>` (`src/types/warehouse.ts:678`), проекция — `toMovementListItem` (`services/mocks/warehouse.ts:1120-1137`): 13 полей из 19, без `fromLocation`, `toLocation`, `performedBy`, `totalCost`, `createdAt` и `auditLog`.
- Коды ошибок: ни одного (`services/mocks/warehouse.ts:1139-1193`).
- Save-режим: чтение, трое вызывающих: вкладка движений (`src/composables/useWarehouse.ts:257-281`), журнал карточки партии по `batchNumber` (`src/composables/useWarehouseBatch.ts:351-365`) и журнал карточки обрезка по `offcutId` (`src/composables/useWarehouseOffcutCard.ts:165-179`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1490-1519`) описывает query и форму. Не сказано: (а) что `categoryIds` не фильтрует ничего (см. выше); (б) что `productId`, `referenceId` и `offcutId` — точное совпадение, а `batchNumber` — подстрока (`services/mocks/warehouse.ts:1164-1171`); (в) что карточка партии фильтрует свои движения **по номеру партии, а не по её id** (`src/composables/useWarehouseBatch.ts:356`), то есть две партии с одинаковым номером покажут друг другу чужой журнал — уникальности `batch_number` нет ни в моке, ни на схеме (`backend/app/modules/warehouse/shared/models.py:33`) → находка 21; (г) что `unitPrice` в списочной записи — `number`, а не `number | null` (`src/types/warehouse.ts:392`), хотя партия без цены существует, и движение получает от неё ноль (`services/mocks/warehouse.ts:1238`).
- Источник истины: мок + клиент.

### GET /api/warehouse/movements/:id
- Вызывающий: `src/services/warehouseService.ts:199`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:750`
- Форма запроса: только путь (`src/services/warehouseService.ts:198-200`). Ветка мока стоит **после** ветки аудита (`services/mocks/index.ts:750` против `:745`), и порядок здесь объяснён комментарием (`:744`) — в отличие от остальных четырёх ресурсов, где карточка идёт первой.
- Форма ответа: `WarehouseMovement` целиком, копией, но с журналом из отдельного хранилища: `{ ...movement, auditLog: audit }`, причём журнал подставляется **только для засеянных движений** (`services/mocks/warehouse.ts:1400-1405`), а созданному в сессии всегда достаётся пустой.
- Коды ошибок: один — `MOVEMENT_NOT_FOUND` (`services/mocks/warehouse.ts:1402`). До человека доходит текстом (`src/composables/useWarehouseMovementCard.ts:41`).
- Save-режим: чтение, карточка read-only: `useWarehouseMovementCard` не имеет ни формы, ни `save`, ни `discard` — только `load` и удаление записи журнала (`src/composables/useWarehouseMovementCard.ts:9-56`). Загрузка идёт вместе со справочником имён товаров (`:36`).
- Пробел контракта: эндпоинта в старом тексте нет — там сказано лишь, что карточка движения «data-only» (`roo_code/roo-context/03-api-contract.md:1327`). Не описано: (а) что журнал движения живёт **не в записи**, а в отдельном хранилище `movementAuditStore`, куда копируется при первом чтении (`services/mocks/warehouse.ts:1583-1591`), и почему — иначе лента и карточка показали бы два разных журнала (`:1934-1941`); (б) что у движения, созданного после старта, журнала не будет никогда (`:1403`).
- Источник истины: мок + клиент.

### GET /api/warehouse/movements/:id/audit
- Вызывающий: `src/services/warehouseService.ts:359`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:745`
- Форма запроса: только путь (`src/services/warehouseService.ts:358-360`); ветка — `services/mocks/index.ts:745-748`, проверяется первой из движенческих.
- Форма ответа: `StockAuditEntry[]`, `structuredClone` копии из `movementAuditStore` (`services/mocks/warehouse.ts:1902-1904`).
- Коды ошибок: ни одного: `getOrCreateMovementAudit` для неизвестного id заводит пустой массив и возвращает его (`services/mocks/warehouse.ts:1583-1589`), тогда как парный DELETE бросает `AUDIT_ENTRY_NOT_FOUND` (`:1912`) → находка 6.
- Save-режим: чтение, **вызывающего нет**: `grep -rn 'getMovementAudit' frontend_vue/src --include=*.ts --include=*.vue` даёт только объявление (`src/services/warehouseService.ts:358`). Карточка берёт журнал полем ответа карточки (`src/composables/useWarehouseMovementCard.ts:38`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано: (а) что чтение журнала движения имеет побочный эффект — первое обращение материализует копию сида (`services/mocks/warehouse.ts:1583-1589`); (б) что этот путь никем не используется.
- Источник истины: мок + клиент. Таблицы под журнал движения на схеме нет.

### GET /api/warehouse/offcuts
- Вызывающий: `src/services/warehouseService.ts:138`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:703`
- Форма запроса: query: всегда `search`, `page`, `pageSize`; условно `productId`, `status`, `uomId`, `offcutType`, `categoryIds` (склейка через запятую), `batchNumber`, `sortBy`, `sortDir` (`src/services/warehouseService.ts:124-138`). Мок читает те же одиннадцать (`services/mocks/index.ts:709-717`), дефолты сортировки `createdAt`/`desc` (`services/mocks/warehouse.ts:857-858`).
- Форма ответа: `OffcutListResponse` = `PaginatedResponse<OffcutListItem>` (`src/types/warehouse.ts:677`); мок при этом отдаёт **не списочную запись, а сам обрезок**: `paginate(filtered, …)` над `offcutStore` без проекции (`services/mocks/warehouse.ts:866`), тогда как у партий и движений проекция есть (`:612`, `:1192`). То есть на проводе едут `thicknessMm`, `notes`, `qrData`, `files`, `auditLog` и оба таймстампа, которых `OffcutListItem` не объявляет (`src/types/warehouse.ts:252-269`) → находка 16.
- Коды ошибок: ни одного: в `mockGetOffcuts` нет `throw` (`services/mocks/warehouse.ts:825-867`).
- Save-режим: чтение. Двое вызывающих: вкладка обрезков вместе со справочником имён (`src/composables/useWarehouse.ts:231-255`) и карточка партии — своими обрезками по `batchNumber` (`src/composables/useWarehouseBatch.ts:423-437`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1651-1670`) перечисляет query и обещает `PaginatedResponse<OffcutListItem>`. Не описано: (а) что мок отдаёт запись целиком, а не списочную (см. «Форма ответа»); (б) что поиск идёт **только по имени товара** и номер обрезка в него не входит (`services/mocks/warehouse.ts:840-843`), в отличие от партий и движений, где ищут ещё и по `batchNumber` (`:583`, `:1160`); (в) что из девяти сортируемых колонок вкладки мок понимает три — `createdAt`, `productName`, `quantity` (`:859-865`), а `offcutType`, `batchNumber`, `lengthMm`, `weightKg`, `uomId`, `location`, `status` со страницы (`src/views/admin/warehouse/WarehousePage.vue:2375`, `:2420`, `:2465`, `:2510`, `:2600`, `:2643`, `:2688`) не делают ничего → находка 3.
- Источник истины: мок + клиент. Схема беднее формы: `warehouse_offcuts` не имеет ни одного размера, ни веса, ни категории, ни `qr_data`, ни `order_id` — только `offcut_type`, `quantity`, `unit`, `status`, `location`, `notes` плюс две ссылки на партию (`backend/app/modules/warehouse/shared/models.py:131-165`) → находка 17.

### GET /api/warehouse/offcuts/:id
- Вызывающий: `src/services/warehouseService.ts:153`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:730`
- Форма запроса: только путь (`src/services/warehouseService.ts:152-154`). Ветка мока стоит после `/offers` (`services/mocks/index.ts:730`); внутри неё — недостижимая проверка `path.endsWith('/audit')` (`:733-735`) → находка 7.
- Форма ответа: `WarehouseOffcut` целиком, копией — `{ ...offcut }` (`services/mocks/warehouse.ts:869-873`). 21 поле (`src/types/warehouse.ts:208-250`); `productId` — **всегда товар исходной партии**, и это правило домена, а не совпадение (`:213-219`).
- Коды ошибок: один — `OFFCUT_NOT_FOUND` (`services/mocks/warehouse.ts:871`). До человека доходит текстом: `error.value = e instanceof Error ? e.message : 'Failed to load offcut'` (`src/composables/useWarehouseOffcutCard.ts:219`).
- Save-режим: чтение. Один вызывающий — `load()` карточки обрезка (`src/composables/useWarehouseOffcutCard.ts:195-223`), который следом тянет движения куска (`:216`) и товар **партии** ради плотности материала (`:217`, причина `:225-230`).
- Пробел контракта: эндпоинта в старом тексте нет — описан только список обрезков и `/offers`. Не описано: (а) что `productId` куска обязан совпадать с товаром партии и почему (`src/types/warehouse.ts:213-219`); (б) что `weightKg` — **ручной ввод, а не вывод**: `null` означает «пусть отвечает расчёт», и хранить выведенное значение запрещено (`:328-337`, потребитель `src/composables/useWarehouseOffcutCard.ts:243-269`); (в) что `files?` необязательно сознательно (`src/types/warehouse.ts:242`).
- Источник истины: мок + клиент. Схема куска знает шесть содержательных колонок из двадцати одного поля (`backend/app/modules/warehouse/shared/models.py:131-165`) → находка 17.

### GET /api/warehouse/offcuts/:id/audit
- Вызывающий: `src/services/warehouseService.ts:349`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:739`
- Форма запроса: только путь (`src/services/warehouseService.ts:348-350`); ветка мока — `services/mocks/index.ts:739-742`.
- Форма ответа: `StockAuditEntry[]`, `structuredClone` журнала куска (`services/mocks/warehouse.ts:1889-1892`).
- Коды ошибок: ни одного — неизвестный кусок отвечает пустым массивом (`services/mocks/warehouse.ts:1891`), тогда как парный DELETE бросает `OFFCUT_NOT_FOUND` (`:1896`) → находка 6.
- Save-режим: чтение, **вызывающего нет**: `grep -rn 'getOffcutAudit' frontend_vue/src --include=*.ts --include=*.vue` даёт только объявление (`src/services/warehouseService.ts:348`). Карточка берёт журнал полем ответа карточки — `auditLog.value = data.auditLog` (`src/composables/useWarehouseOffcutCard.ts:215`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано: (а) что журнал приходит и полем сущности, и этим эндпоинтом, и второй путь мёртв; (б) что `WarehouseOffcut.auditLog` объявлен **обязательным** (`src/types/warehouse.ts:249`), в отличие от `WarehouseBatch.auditLog?` (`:123`) — две формы одного поля у соседних сущностей одного домена.
- Источник истины: мок + клиент. Таблицы под журнал куска на схеме нет: единственная — `stock_audit_entries` с обязательным `batch_id` (`backend/app/modules/warehouse/shared/models.py:240-245`).

### GET /api/warehouse/offcuts/offers
- Вызывающий: `src/services/warehouseService.ts:149`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:726`
- Форма запроса: один query — `productId` (`src/services/warehouseService.ts:148-150`). Ветка мока сравнивает путь строкой и стоит **до** регулярки карточки обрезка (`services/mocks/index.ts:726` против `:730`); порядок зафиксирован комментарием и является частью контракта (`:724-725`).
- Форма ответа: `OffcutOffer[]` — голый массив из 15 полей (`src/types/warehouse.ts:284-305`). Отдельный тип, а не `OffcutListItem`: три поля — `material`, `batchUomId`, `unitCost` — не выводятся из списочной записи и приходят от родительской партии через `offcutAllocation` (`services/mocks/warehouse.ts:1044`, `:1058-1061`; причина — `src/types/warehouse.ts:271-283`).
- Коды ошибок: ни одного: `mockGetOffcutOffers` не бросает, а молча пропускает кусок, который нельзя предложить (`services/mocks/warehouse.ts:1036-1065`). Парная запись строки заказа на те же случаи бросает три кода — `OFFCUT_NOT_FOUND`, `OFFCUT_PRODUCT_MISMATCH`, `OFFCUT_NOT_AVAILABLE`, `OFFCUT_SIZE_NOT_EXPRESSIBLE` (`:1088-1095`), и это правило: список — вежливость, отказ — правило (`:1074-1078`).
- Save-режим: чтение. Один вызывающий — диалог добавления позиций заказа, после выбора товара (`src/views/admin/orders/AddOrderItemsModal.vue:281`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1672-1732`) описывает форму и правила отбора верно и подробно. Не сказано: (а) что занятость куска склад **спрашивает у заказов регистрацией**, а не считает сам: `registerOffcutClaimLookup` (`services/mocks/warehouse.ts:972-976`), а пока никто не зарегистрировался, занятых кусков нет (`:998-1000`, причина `:961-971`); (б) что кусок, чей размер невыразим в единице партии, из списка **исчезает молча** (`:1044-1045`).
- Источник истины: мок + клиент. Правило оценки куска живёт в домене заказов — `offcutAllocation` (`frontend_vue/src/services/orderLines.ts`, импорт `services/mocks/warehouse.ts:58`), и покрыто спекой `frontend_vue/src/services/mocks/offcut-offers-route.spec.ts`.

### GET /api/warehouse/stock
- Вызывающий: `src/services/warehouseService.ts:50`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:617`
- Форма запроса: query, собирается условно: всегда `search`, `page`, `pageSize`; `categoryIds` (склейка через запятую) только если список непуст; `uomId`, `showDeficitOnly='true'`, `showInStockOnly='true'` только когда заданы; `sortBy` и `sortDir` только парой (`src/services/warehouseService.ts:37-50`). Мок читает те же девять, дефолты `page=1`, `pageSize=25` ставит ветка (`services/mocks/index.ts:618-619`, сами восемь ключей — `:623-629`), дефолты `sortBy='productName'`, `sortDir='asc'` — сама функция (`services/mocks/warehouse.ts:513-514`). Заголовков нет: `apiGet(path, params)` без третьего аргумента (`src/services/warehouseService.ts:50`), а `options?.headers` — единственный их источник (`frontend_vue/src/services/api.ts:157-159`) → находка 1.
- Форма ответа: `StockOverviewResponse` = `PaginatedResponse<StockOverviewItem>` (`src/types/warehouse.ts:680`, конверт — `src/types/api.ts:8-14`), сбор — `paginateStock` (`services/mocks/warehouse.ts:529-543`), вторая копия `paginate` (`:420-430`). Элемент — `StockOverviewItem`: `productId, productName, totalQuantity, reservedQuantity, availableQuantity, uomId, batchCount, avgUnitPrice, totalValue, minStock, isDeficit, categoryId?, categoryName?, auditLog` (`src/types/warehouse.ts:571-598`). Восемь из четырнадцати полей **не берутся из записи, а считаются заново** при каждом чтении из партий и резервов — `projectStockRow` (`services/mocks/warehouse.ts:446-476`).
- Коды ошибок: ни одного: в `mockGetStockOverview` нет ни одного `throw` (`services/mocks/warehouse.ts:478-527`). Клиент кладёт текст исключения в состояние — `stockError.value = e instanceof Error ? e.message : 'Failed to load stock overview'` (`src/composables/useWarehouse.ts:197`).
- Save-режим: чтение. Триггеров четыре: `load()` по вкладке (`src/composables/useWarehouse.ts:185-201`, диспетчер `:306-316`), `watch(stockFilters, …, {deep:true})` со сбросом страницы (`:428-436`), `watch([stockPagination.page, pageSize])` с флагом `suppressPageWatch` против двойного запроса (`:406`, `:431`, `:572-578`) и `watch(activeTab)` (`:613-620`). Пятый вызывающий — диалог добавления позиций заказа (`src/views/admin/orders/AddOrderItemsModal.vue`, импорт `:6`).
- Пробел контракта: эндпоинта в старом тексте **нет**: в диапазоне домена (`roo_code/roo-context/03-api-contract.md:1273-1880`) заголовков всего 13, и `stock` среди них нет ни одного (`sed -n '1273,1880p' … | grep -c '^### .*warehouse/stock'` → 0). Не описано: (а) что строка остатка — **проекция**, а не запись: количество, стоимость, средняя цена, число партий, резерв, доступное и признак дефицита пересчитываются при каждом чтении (`services/mocks/warehouse.ts:446-476`), а хранятся у неё только порог, категория и собственный журнал; (б) что `avgUnitPrice` взвешивается **только по партиям с ценой** (`:453-454`, `:467`) — партия без цены не тянет среднюю к нулю; (в) что строка остатка существует только для товара, у которого она засеяна: `stockStore` пополняется только сидом (`grep -n 'stockStore' frontend_vue/src/services/mocks/warehouse.ts` — восемь строк, ни одного `push`), а создание партии её не заводит (`services/mocks/warehouse.ts:680-791`) → находка 2; (г) что сортировка по имени и по единице **не работает**: страница шлёт `sortBy='name'` и `'uomId'` (`src/views/admin/warehouse/WarehousePage.vue:1355`, `:1524`), а мок знает только `'productName'` и не знает `'uomId'` (`services/mocks/warehouse.ts:515-523`) → находка 3.
- Источник истины: мок + клиент (роутов у модуля ноль). Схема хранения зафиксирована и с этой формой не согласуется: `stock_items` имеет четыре содержательные колонки — `product_id`, `total_quantity`, `unit`, `updated_at` (`backend/app/modules/warehouse/shared/models.py:202-226`), то есть ни порога, ни категории, ни резерва, ни журнала.

### GET /api/warehouse/stock/:id
- Вызывающий: `src/services/warehouseService.ts:54`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:644`
- Форма запроса: только путь — `apiGet(\`/api/warehouse/stock/${productId}\`)` (`src/services/warehouseService.ts:53-55`); ни query, ни заголовков. Сегмент — **id товара**, а не id строки остатка: `mockGetStockItem` ищет `s.productId === productId` (`services/mocks/warehouse.ts:546`). Мок ловит регуляркой `/^\/api\/warehouse\/stock\/([^/]+)$/` (`services/mocks/index.ts:644`), и она стоит **после** ветки стоимости (`:637`) — порядок обязателен, иначе `/cost` был бы съеден.
- Форма ответа: `StockOverviewItem` целиком (`src/services/warehouseService.ts:53`), и через **ту же** `projectStockRow`, что список (`services/mocks/warehouse.ts:550`) — карточка и список не имеют права разойтись о той же полке, причина названа в коде (`:548-549`).
- Коды ошибок: один — `STOCK_ITEM_NOT_FOUND` (`services/mocks/warehouse.ts:547`). До человека доходит **как текст исключения**: `error.value = e instanceof Error ? e.message : …` (`src/composables/useWarehouseStockCard.ts:137`). Соседний эндпоинт того же ресурса бросает на то же условие **другой** код — `STOCK_NOT_FOUND` (`services/mocks/warehouse.ts:1866`) → находка 4.
- Save-режим: чтение. Один вызывающий — `load()` карточки остатка (`src/composables/useWarehouseStockCard.ts:119-141`), он же заполняет форму и снимает снимок для dirty-check (`:125-133`), и следом тянет агрегаты по всем партиям товара (`:135`).
- Пробел контракта: эндпоинта в старом тексте нет (см. `GET /api/warehouse/stock`). Не описано: (а) что сегмент пути — id **товара**, а не id строки; (б) что ответ проходит через ту же проекцию, что список; (в) что неизвестный товар отвечает `STOCK_ITEM_NOT_FOUND`, а не `NOT_FOUND` ядра (`backend/app/core/exceptions.py:13-20`).
- Источник истины: мок + клиент. Форма — `services/mocks/warehouse.ts:545-551` и `src/types/warehouse.ts:571-598`.

### GET /api/warehouse/stock/:id/audit
- Вызывающий: `src/services/warehouseService.ts:329`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:653`
- Форма запроса: только путь — `apiGet(\`/api/warehouse/stock/${productId}/audit\`)` (`src/services/warehouseService.ts:328-330`); ни query, ни заголовков.
- Форма ответа: `StockAuditEntry[]` — голый массив, не `PaginatedResponse` (`src/services/warehouseService.ts:328`); мок отдаёт `structuredClone` журнала строки (`services/mocks/warehouse.ts:1859-1862`). Запись — `{id, timestamp, user: TranslatedString, userInitials, property: TranslatedString, oldValue, newValue}` (`src/types/warehouse.ts:526-534`); id проставляются при сборке хранилища `sealAuditIds`, в сидах их нет (`:536-544`, `frontend_vue/src/mocks/warehouse-stock.ts:2`).
- Коды ошибок: ни одного: для неизвестного товара мок отдаёт **пустой массив**, а не ошибку — `item?.auditLog ? … : []` (`services/mocks/warehouse.ts:1861`). Парный DELETE на том же условии бросает `STOCK_NOT_FOUND` (`:1866`): чтение и удаление отвечают на несуществующую сущность по-разному → находка 6.
- Save-режим: чтение — и **вызывающего у него нет**. `getStockAudit` не зовёт никто: `grep -rn 'getStockAudit' frontend_vue/src --include=*.ts --include=*.vue` даёт только объявление (`src/services/warehouseService.ts:328`). Журнал карточка берёт из самой строки остатка — `auditLog.value = data.auditLog` (`src/composables/useWarehouseStockCard.ts:132`), то есть полем ответа `GET /api/warehouse/stock/:id`.
- Пробел контракта: эндпоинта в старом тексте нет — описан только аудит партии (`roo_code/roo-context/03-api-contract.md:1836-1856`). Не описано: (а) что журнал приходит **дважды**, полем сущности и отдельным эндпоинтом, и второй путь никем не используется; (б) что чтение несуществующей сущности — пустой массив, а не 404; (в) что `timestamp` в сидах хранится ISO-строкой (`frontend_vue/src/mocks/warehouse-stock.ts:26`), тогда как старый текст обещает локальный формат `dd.mm.yyyy hh:mm` (`roo_code/roo-context/03-api-contract.md:1855`).
- Источник истины: мок + клиент. Таблица на схеме есть ровно одна и она **привязана к партии**: `stock_audit_entries.batch_id` — `nullable=False` FK на `warehouse_batches.id` (`backend/app/modules/warehouse/shared/models.py:240-245`), то есть журналу строки остатка на схеме места нет.

### GET /api/warehouse/stock/:id/cost
- Вызывающий: `src/services/warehouseService.ts:75`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:637`
- Форма запроса: путь плюс один обязательный query — `quantity`, сериализованный `String()` (`src/services/warehouseService.ts:71-78`). Мок читает его с дефолтом 1 при отсутствии: `params?.quantity ? Number(params.quantity) : 1` (`services/mocks/index.ts:640`).
- Форма ответа: объект из трёх чисел `{ unitPrice; totalCost; shortageQuantity }` — не `ApiResponse`-тип и не сущность (`src/services/warehouseService.ts:74`, сборка `services/mocks/warehouse.ts:1842-1848`). `shortageQuantity` объявлен частью ответа намеренно: цена, снятая с партий, покрывающих половину строки, — оценка, и вызывающий обязан их различать (`src/services/warehouseService.ts:64-70`).
- Коды ошибок: ни одного: ни `mockCalculateFifoCost` (`services/mocks/warehouse.ts:1835-1849`), ни `mockFifoAllocation` (`:1801-1829`) не бросают. Неизвестный товар отвечает нулями, а не ошибкой: `batchesForProduct` вернёт пустой список (`:1360-1364`), и `allocateFifo` отдаст всю величину недостачей.
- Save-режим: чтение, вспомогательное. Двое вызывающих, оба в домене заказов: предпросмотр строки в диалоге добавления позиций (`src/views/admin/orders/AddOrderItemsModal.vue:467`) и пересчёт строк карточки заказа (`src/composables/useOrderCard.ts:1177`). Экранов склада среди них нет.
- Пробел контракта: эндпоинта в старом тексте нет. Не описано главное: (а) что FIFO считается по **доступному**, а не по остатку — из количества партии вычитается чужой резерв и чужой хват разбивки (`services/mocks/warehouse.ts:1814-1819`, `reservedOn` — `src/services/mocks/reservations.ts:48-60`), причина расписана в коде (`services/mocks/warehouse.ts:1778-1799`); (б) что параметров `exceptLine` и `claimed`, которыми пользуется домен заказов внутри процесса (`:1804-1808`), **на проводе нет** — HTTP-вызывающий их передать не может, и оценка через этот эндпоинт всегда считается «как для чужого»; (в) что партия без цены участвует в подборе с `unitCost: 0` (`:1825`), то есть занижает средневзвешенную, и почему так (`:1820-1824`); (г) что недостача **сообщается, а не усредняется молча** — цена ставится по покрытой части (`:1843-1846`).
- Источник истины: мок + клиент. Правило подбора живёт в домене — `allocateFifo` (`src/domain/orderPricing.ts`, импорт `services/mocks/warehouse.ts:50-56`), склад лишь подставляет партии.

### PATCH /api/warehouse/batches/:id
- Вызывающий: `src/services/warehouseService.ts:111`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1301`
- Форма запроса: объявлено десять ключей `BatchPatchPayload` (`src/types/warehouse.ts:190-204`), **уезжает больше**. Дельту собирает `useDirtyCheck.diff()` по форме карточки (`src/composables/useWarehouseBatch.ts:240`), а в форме есть `uomId`, `marginPercent` и четыре части адреса — `locationRack`, `locationRow`, `locationCell`, `locationNotes` (`:92-128`); `diff()` возвращает любой изменившийся ключ верхнего уровня (`src/composables/useDirtyCheck.ts:62-77`), после чего к дельте добавляется склеенный `location` (`frontend_vue/src/composables/useWarehouseBatch.ts:242-248`) и, если есть, `fileIds` (`:252-254`). То есть шесть необъявленных ключей на проводе, и мок кладёт их в запись `Object.assign(batch, delta, …)` (`services/mocks/warehouse.ts:804`) → находка 10.
- Форма ответа: `WarehouseBatch` целиком, копией — `{ ...batch }` (`services/mocks/warehouse.ts:813`). `totalCost` пересчитывается сервером, если пришли `unitPrice` или `quantity` (`:805-808`), и остаётся `null`, пока цены нет.
- Коды ошибок: два — `BATCH_NOT_FOUND` (`services/mocks/warehouse.ts:798`) и `BATCH_CURRENCY_NOT_BASE` (`:802`); граница валюты та же, что при создании, и держится «и на входе, и потом» (`:799-800`). До человека не доходит ни один: `catch { toast.error(t('warehouse.toast_error_save')) }` (`src/composables/useWarehouseBatch.ts:299-301`).
- Save-режим: clean-slate. Признак грязи собран из трёх: `dirty.isDirty`, непустой список ожидающих файлов и удаление ранее приложенного файла (`src/composables/useWarehouseBatch.ts:135-152`). Save шлёт **один** PATCH и следом, если адрес изменился, **второй запрос** — `POST /api/warehouse/movements` с `type: 'transfer'` (`:260-276`), причём неудача второго только показывает info-тост (`:272-274`). Discard возвращает форму и восстанавливает удалённые файлы из снимка (`:306-329`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1381-1398`) перечисляет те же десять ключей, что тип, и потому **не описывает шесть фактически уезжающих** (см. «Форма запроса»). Кроме того: (а) «Last-write-wins» (`:1397`) кодом не выражено ничем — ни `If-Match`, ни версии в `WarehouseBatch` нет (`src/types/warehouse.ts:63-138`), и клиент домена не шлёт ни одного заголовка; (б) не сказано, что смена адреса — это **второй HTTP-запрос без общей транзакции**, и что провалившийся перенос оставит партию с новым адресом и без записи о переносе (`src/composables/useWarehouseBatch.ts:260-276`); (в) не сказано, что мок принимает `status` любым и не сверяет его с агрегатами, тогда как следующий же `writeMovement` пересчитает статус заново (`services/mocks/warehouse.ts:1347`).
- Источник истины: мок + клиент.

### PATCH /api/warehouse/deficit/:id
- Вызывающий: `src/services/warehouseService.ts:253`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1311`
- Форма запроса: `DeficitPatchPayload` — шесть ключей (`src/types/warehouse.ts:499-506`). Карточка шлёт дельту из трёх правимых полей (`src/composables/useWarehouseDeficitCard.ts:84`, форма `:32-40`) — здесь, в отличие от карточек партии и обрезка, форма совпадает с payload и лишних ключей не уезжает. Список шлёт одиночные `{priority}` и `{status}` (`src/composables/useWarehouse.ts:387`, `:397`).
- Форма ответа: `WarehouseDeficit` целиком, копией; `updatedAt` ставит сервер (`services/mocks/warehouse.ts:1766-1767`).
- Коды ошибок: один — `DEFICIT_NOT_FOUND` (`services/mocks/warehouse.ts:1765`). Валидации нет: `Object.assign(deficit, delta, …)` примет любой `status` и любой `priority` (`:1766`).
- Save-режим: clean-slate в карточке (`src/composables/useWarehouseDeficitCard.ts:80-99`, Discard `:101-109`) и quick-action в списке — инлайновые селекты приоритета и статуса с перезагрузкой после (`src/composables/useWarehouse.ts:385-403`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано: (а) что `purchaseOrderId` правится этим эндпоинтом (`src/types/warehouse.ts:504`), но задать его негде — ни карточка, ни список такого поля не имеют; (б) что перевод в `resolved`/`cancelled` ничего не проверяет и запись остаётся в списке; (в) что колонки `priority` и `status` — закрытые перечни во фронте (`src/types/warehouse.ts:46`, `:49`) и свободные строки на схеме (`backend/app/modules/warehouse/shared/models.py:196-198`).
- Источник истины: мок + клиент.

### PATCH /api/warehouse/offcuts/:id
- Вызывающий: `src/services/warehouseService.ts:161`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1328`
- Форма запроса: объявлено четыре ключа `OffcutPatchPayload` — `status?`, `notes?`, `location?`, `weightKg?`, плюс `fileIds?` (`src/types/warehouse.ts:324-341`). Фактически уезжает больше: дельту собирает `useDirtyCheck.diff()` по форме, где живут четыре части адреса (`src/composables/useWarehouseOffcutCard.ts:275`, форма `:99-117`), после чего добавляется склеенный `location` (`:281-287`) → находка 10. Второй вызывающий — вкладка обрезков — шлёт только `{ status }` (`src/composables/useWarehouse.ts:364`).
- Форма ответа: `WarehouseOffcut` целиком, копией (`services/mocks/warehouse.ts:1108`). `updatedAt` сервер ставит сам (`:1107`).
- Коды ошибок: один — `OFFCUT_NOT_FOUND` (`services/mocks/warehouse.ts:1106`). Проверок содержимого нет ни одной: `Object.assign(offcut, data, …)` принимает любой `status` и любой вес (`:1107`).
- Save-режим: clean-slate в карточке и quick-action в списке. Карточка: Save шлёт PATCH и следом **до двух** `POST /api/warehouse/movements` — `transfer` при смене адреса и движение по типу нового статуса (`src/composables/useWarehouseOffcutCard.ts:294-333`), оба с `.catch(() => {})`, то есть их провал не виден нигде. Список: `updateOffcutStatus` шлёт PATCH и следом движение, чей провал заглушен комментарием «Movement creation is secondary» (`src/composables/useWarehouse.ts:362-383`).
- Пробел контракта: заголовка в старом тексте нет — путь упомянут одной фразой прозой («Руками статус по-прежнему ставится через `PATCH /api/warehouse/offcuts/:id`», `roo_code/roo-context/03-api-contract.md:1637`). Не описано: (а) что смена статуса из интерфейса — это **два независимых запроса**, и второй может не дойти, оставив кусок в статусе без движения (`src/composables/useWarehouse.ts:366-377`); (б) что при записи движения сервер ставит статус куска **сам**, по типу движения (`services/mocks/warehouse.ts:1337-1344`, таблица `:294-302`), то есть клиентский PATCH и серверное правило пишут одно и то же поле с двух сторон; (в) что `weightKg: null` — не «нет веса», а «считай сам» (`src/types/warehouse.ts:328-337`).
- Источник истины: мок + клиент.

### PATCH /api/warehouse/stock/:id
- Вызывающий: `src/services/warehouseService.ts:61`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1321`
- Форма запроса: дельта `StockPatchPayload` по пяти ключам — `productName?`, `uomId?`, `avgUnitPrice?`, `minStock?`, `categoryName?` (`src/types/warehouse.ts:600-611`), собирается `useDirtyCheck.diff()` только из изменившихся ключей верхнего уровня (`src/composables/useWarehouseStockCard.ts:147`, реализация `src/composables/useDirtyCheck.ts:62-77`). Мок типизирует тело как `{ minStock?: number | null }` (`services/mocks/index.ts:1323`), то есть **уже` третьей формой**, и всё равно применяет `Object.assign(item, delta)` (`services/mocks/warehouse.ts:559`).
- Форма ответа: `StockOverviewItem` (`src/services/warehouseService.ts:60`), но мок отдаёт `{ ...item }` **без проекции** (`services/mocks/warehouse.ts:560`), в отличие от GET списка и GET карточки (`:490`, `:550`). Карточка кладёт этот ответ прямо в `item.value` (`src/composables/useWarehouseStockCard.ts:150`), то есть сразу после Save на экране висят засеянные числа вместо посчитанных → находка 5.
- Коды ошибок: один — `STOCK_ITEM_NOT_FOUND` (`services/mocks/warehouse.ts:558`). До человека не доходит: `catch { toast.error(t('warehouse.toast_error_save')) }` без параметра (`src/composables/useWarehouseStockCard.ts:160-162`).
- Save-режим: clean-slate. Правки живут в `form` (`src/composables/useWarehouseStockCard.ts:80-92`), уходят по кнопке Save и только при непустой дельте (`:147-149`), Discard возвращает форму к последнему ответу сервера (`:167-177`). Признак грязи — один `useDirtyCheck` без ручных добавок (`:94-95`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано: (а) что четыре из пяти правимых полей — **чужие**: `productName` и `categoryName` принадлежат каталогу (`frontend_vue/src/types/product.ts:39-41`), `uomId` — справочнику настроек, `avgUnitPrice` — производное от партий (`services/mocks/warehouse.ts:467`), то есть экран склада правит имя товара, а не строку остатка; (б) что записанное имя тут же теряется — следующий же GET перекрывает его каталогом (`:461`); (в) что `avgUnitPrice`, записанное руками, следующий GET перезатрёт вычисленным (`:467`); (г) что ответ не проходит проекцию (см. «Форма ответа»).
- Источник истины: мок + клиент. На схеме под четыре из пяти полей колонок нет: `stock_items` знает только `total_quantity` и `unit` (`backend/app/modules/warehouse/shared/models.py:220-223`).

### POST /api/warehouse/batches
- Вызывающий: `src/services/warehouseService.ts:107`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1105`
- Форма запроса: `BatchCreatePayload` — 16 объявленных ключей (`src/types/warehouse.ts:158-188`), плюс **семнадцатый необъявленный**: `fileIds`, добавленный пересечением типа прямо в месте вызова (`src/composables/useWarehouseBatchCreate.ts:357`, отправка `:387-389`). `unitPrice` необязателен намеренно: пустое остаётся пустым, а не нулём (`:166-172`, комментарий вызывающего `src/composables/useWarehouseBatchCreate.ts:366-368`). `currency` обязан быть базовой валютой, если прислан вообще (`src/types/warehouse.ts:174-175`).
- Форма ответа: `WarehouseBatch` целиком — созданная запись **по ссылке на стор**, без копии: `return batch` после `batchStore.push(batch)` (`services/mocks/warehouse.ts:788-790`), в отличие от `mockGetBatch`, который отдаёт копию (`:644`).
- Коды ошибок: один — `BATCH_CURRENCY_NOT_BASE` (`services/mocks/warehouse.ts:725`), и он ставит границу домена: складской слой говорит на одной валюте, курса в системе нет, переклеить подпись нельзя (`:721-723`, определение базовой — `:65-76`). До человека не доходит: страница создания ловит `catch` без разбора кода. Ни `PRODUCT_NOT_FOUND`, ни проверки существования товара, поставщика и единицы здесь нет вовсе — `mockCreateBatch` не заглядывает ни в один справочник (`:680-791`).
- Save-режим: quick-action. Один вызывающий — `submit()` страницы создания партии (`src/composables/useWarehouseBatchCreate.ts:389`), после успеха переход в карточку созданной партии.
- Пробел контракта: эндпоинта в старом тексте **нет** — среди 13 заголовков диапазона `POST /api/warehouse/batches` не значится. Не описаны пять правил, которые мок уже реализует: (а) закупочный след автозаполняется из основных полей, **но цена — никогда**: стрелка указывает в одну сторону, пустая закупочная цена остаётся пустой (`services/mocks/warehouse.ts:697-707`); (б) валюта закупки подставляется базовой только когда цена пришла без валюты (`:708-712`); (в) коэффициент `purchaseToWarehouseRate` выводится из отношения количеств и **только** при разных единицах (`:713-719`); (г) складская цена выводится из закупочной, если та в базовой валюте, и тремя разными путями (`:737-753`); (д) `marginPercent` берётся из настроек арендатора (`:779`). Не описано и то, что `fileIds` принимается подписью мока и **никуда не записывается**: `files: []` (`:681`, `:776`) → находка 9.
- Источник истины: мок + клиент. Схема хранения под все 16 полей есть, кроме `margin_percent` (`backend/app/modules/warehouse/shared/models.py:11-88`), а `file_ids` там `JSON` (`:62`), то есть массив идентификаторов, а не материализованный список файлов.

### POST /api/warehouse/cutting
- Вызывающий: `src/services/warehouseService.ts:217`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1117`
- Форма запроса: `CuttingOperation` — `{sourceBatchId, sourceQuantity, kerfMm, offcuts: Omit<OffcutCreatePayload,'batchId'>[], wasteQuantity, sourcePieces?, notes?}` (`src/types/warehouse.ts:419-438`). `sourceQuantity` — **сверка, а не ввод**: сервер считает расход заново и отказывает при расхождении (`services/mocks/warehouse.ts:1497-1500`, проверка `:1530-1535`). `sourcePieces` спрашивается только у штучной партии (`src/types/warehouse.ts:430-435`, подстановка `src/composables/useWarehouseCutting.ts:207`). Клиент кладёт в каждый кусок ещё и `productId` (`src/composables/useWarehouseCutting.ts:306`), которого в `OffcutCreatePayload` нет (`src/types/warehouse.ts:307-322`) и который мок игнорирует, беря товар у партии (`services/mocks/warehouse.ts:923`).
- Форма ответа: `{ offcuts: WarehouseOffcut[]; wasteQuantity: number }` (`src/services/warehouseService.ts:214-218`, сборка `services/mocks/warehouse.ts:1578`). `wasteQuantity` в ответе — **пересчитанный** отход, а не присланный (`:1578`).
- Коды ошибок: девять, и все — до первой записи: `BATCH_NOT_FOUND` (`services/mocks/warehouse.ts:1506`), `CUTTING_NO_OFFCUTS` (`:1508`), `CUTTING_KERF_NOT_APPLICABLE` (`:1519`), `INSUFFICIENT_QUANTITY` (`:1529`), `CUTTING_QUANTITY_MISMATCH` (`:1534`) плюс пять из домена через `MATERIAL_ERROR_CODE` — `BATCH_UNIT_NOT_SUPPORTED`, `OFFCUT_DIMENSION_MISSING`, `OFFCUT_PIECES_NOT_INTEGER`, `CUTTING_NEGATIVE_AMOUNT`, `CUTTING_SOURCE_PIECES_INVALID` (`frontend_vue/src/domain/cutting.ts:52-58`, бросок `services/mocks/warehouse.ts:1528`). До человека не доходит **ни один из десяти**: `catch { toast.error(t('warehouse.cutting_toast_error')) }` (`src/composables/useWarehouseCutting.ts:329-331`) → находка 14.
- Save-режим: quick-action — одна проводка, копить нечего. Один вызывающий — `submit()` страницы резки (`src/composables/useWarehouseCutting.ts:298-336`, отправка `:319-327`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1734-1826`) — самый полный в домене: арифметика, таблица размеров по единицам, перечень отказов, правило «переоценка по числу резов выбрана сознательно». Расхождения два: (а) в payload старого текста **нет `sourcePieces`** (`:1745-1762`), хотя у штучной партии без него расход не выводится вовсе (`src/types/warehouse.ts:430-435`), и отказ `CUTTING_SOURCE_PIECES_INVALID` в таблице кодов тоже отсутствует (`roo_code/roo-context/03-api-contract.md:1810-1820`); (б) не сказано, что перечень единиц, для которых размер куска вообще выразим, **закрыт во фронте шестью значениями** — `uom-m`, `uom-mm`, `uom-m2`, `uom-kg`, `uom-t`, `uom-pcs` (`frontend_vue/src/domain/cutting.ts:71-86`), тогда как справочник настроек знает девять (`frontend_vue/src/services/mocks/settings.ts:91-146`): партия в `uom-m3`, `uom-kg-m3` или `uom-h` не режется никогда → находка 15.
- Источник истины: мок + клиент, а правило арифметики — домен: `computeCuttingConsumption` (`frontend_vue/src/domain/cutting.ts`, вызов `services/mocks/warehouse.ts:1521-1527`), и оно же покрыто спеками `frontend_vue/src/domain/cutting.spec.ts` и `frontend_vue/src/services/mocks/cutting.spec.ts`.

### POST /api/warehouse/deficit
- Вызывающий: `src/services/warehouseService.ts:246`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1121`
- Форма запроса: `DeficitCreatePayload` — четыре ключа: `productId`, `minRequired`, `priority`, `notes?` (`src/types/warehouse.ts:492-497`).
- Форма ответа: `WarehouseDeficit` целиком — по ссылке на стор (`services/mocks/warehouse.ts:1756-1757`). Пять полей мок ставит константами: `productName: {ru:'',en:'',lt:''}`, `currentStock: 0`, `deficitAmount = minRequired`, `uomId: 'uom-pcs'`, `status: 'open'`, `suggestedOrderQty: null` (`:1742-1749`) → находка 26.
- Коды ошибок: ни одного: `mockCreateDeficitItem` не бросает и не проверяет существование товара (`services/mocks/warehouse.ts:1736-1758`).
- Save-режим: **вызывающего нет.** `createDeficitItem` объявлен (`src/services/warehouseService.ts:245-247`), ветка мока есть (`services/mocks/index.ts:1121`), и ни один экран его не зовёт: `grep -rn 'createDeficitItem' frontend_vue/src --include=*.ts --include=*.vue` даёт только объявление и ветку мока. Записи дефицита рождает **не эндпоинт**, а `recordShortage`, вызываемая доменом заказов внутри процесса (`services/mocks/warehouse.ts:1667-1712`).
- Пробел контракта: эндпоинта в старом тексте нет. Не описано главное: (а) что у дефицита **два пути рождения** — этот эндпоинт (без UI) и внутрипроцессная `recordShortage`, и они кладут разные значения в те же поля: `priority: 'high'`, `suggestedOrderQty = quantity`, `productName` из заказа, `notes = "Order <id>"` (`services/mocks/warehouse.ts:1689-1705`) против шести констант ручного создания (`:1742-1749`); (б) что «та же нехватка того же заказа» узнаётся **по полному совпадению примечания**, а не по подстроке, и причина названа в коде: «Order ORD-1» содержится в «Order ORD-10» (`:1675-1687`); (c) что нехватка снимается вместе с породившей её строкой — `clearShortages` (`:1726-1734`), и трогает только записи с примечанием заказа (`:1723-1724`).
- Источник истины: мок + клиент.

### POST /api/warehouse/movements
- Вызывающий: `src/services/warehouseService.ts:195`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1113`
- Форма запроса: `MovementCreatePayload` — 12 ключей (`src/types/warehouse.ts:400-415`). Два из них не шлёт никто: `unitPrice` и `currency` (`grep -rn 'createMovement(' frontend_vue/src --include=*.ts --include=*.vue` — пять вызовов, ни одного с этими ключами), причём `currency` мок **игнорирует по построению**: движение всегда получает валюту партии (`services/mocks/warehouse.ts:1249`) → находка 22. `batchId` обязателен и у движения куска тоже — движение всегда пишется против партии (`:1216-1221`).
- Форма ответа: `WarehouseMovement` целиком — созданная запись **по ссылке на стор** (`services/mocks/warehouse.ts:1262`, `:1350`), 19 полей (`src/types/warehouse.ts:345-380`). Ответа не читает ни один вызывающий.
- Коды ошибок: один — `BATCH_NOT_FOUND`, и он бросается **до любой записи**, в том числе до переноса адреса (`services/mocks/warehouse.ts:1222-1223`, причина `:1216-1221`). Проверки типа движения нет: `data.type` приводится к типу приведением (`:1229`), то есть любая строка станет движением.
- Save-режим: quick-action, пятеро вызывающих: модал создания движения на карточке партии (`src/views/admin/warehouse/CreateMovementModal.vue:532`), автосоздание `transfer` при смене адреса партии (`src/composables/useWarehouseBatch.ts:262`), кнопки движений карточки партии (`:406`), два автосоздания при сохранении карточки обрезка (`src/composables/useWarehouseOffcutCard.ts:299`, `:316`) и смена статуса обрезка из списка (`src/composables/useWarehouse.ts:367`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1521-1624`) — второй по полноте: таблица пересчёта остатков, правило «движение куска партию не двигает», правило статуса куска, правило адреса при `transfer`, правило порядка. Расхождения: (а) перечень `referenceType` в payload (`roo_code/roo-context/03-api-contract.md:1531` — `"sale" | "purchase_order" | "work_order" | "waste_report" | "cutting"`) не совпадает с тем, что пишет домен заказов: `order-shipment`, `order-shipment-cancelled`, `order-return`, `order-return-writeoff` (`frontend_vue/src/services/mocks/orders.ts:3344`, `:3435`, `:3780`, `:3792`), и ни одно из четырёх не уменьшает агрегат продажи (`services/mocks/warehouse.ts:1426-1431`) → находка 13; (б) не сказано, что `unitPrice` и `currency` в payload не используются; (в) не сказано, что тип движения не валидируется.
- Источник истины: мок + клиент. Схема расходится в главном: у `warehouse_movements` **нет колонки `offcut_id`** (`backend/app/modules/warehouse/shared/models.py:91-128`), а на этом поле держится вся модель обрезка — и списание, и статус, и журнал куска → находка 23.

### POST /api/warehouse/offcuts
- Вызывающий: `src/services/warehouseService.ts:157`
- Бэкенд: **нет**
- Мок: `services/mocks/index.ts:1109`
- Форма запроса: `OffcutCreatePayload` — 10 ключей (`src/types/warehouse.ts:307-322`). Вызывающий шлёт **реактивную форму целиком**, а в ней есть четыре части адреса: `createOffcut(form)` при `form: OffcutCreatePayload & { locationRack; locationRow; locationCell; locationNotes }` (`src/composables/useWarehouseOffcutCreate.ts:32-54`, отправка — единственный вызов `createOffcut`), то есть на проводе 14 ключей вместо 10 → находка 10.
- Форма ответа: `WarehouseOffcut` целиком, **по ссылке на стор**: `return offcut` после `offcutStore.push(offcut)` (`services/mocks/warehouse.ts:942`, `:958`).
- Коды ошибок: три плюс домен: `BATCH_NOT_FOUND` (`services/mocks/warehouse.ts:903`), `INSUFFICIENT_QUANTITY` (`:910`) и коды `MATERIAL_ERROR_CODE` из `resolveOffcutMaterial` — `BATCH_UNIT_NOT_SUPPORTED`, `OFFCUT_DIMENSION_MISSING`, `OFFCUT_PIECES_NOT_INTEGER` (`:905-906`, `frontend_vue/src/domain/cutting.ts:52-58`). До человека не доходит ни один: страница создания показывает общий тост.
- Save-режим: quick-action. Один вызывающий — `submit()` страницы создания обрезка (`src/composables/useWarehouseOffcutCreate.ts`), после успеха переход в карточку.
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1822-1826`) — четыре строки, отсылающие к резке. Не описано: (а) что партия **обязательна** и почему: без неё у куска нет ни единицы, ни номера, ни цены (`services/mocks/warehouse.ts:878-882`); (б) что с партии списывается **материал куска, а не его `quantity`** — счётчик кусков и количество материала это разные величины (`:883-885`); (в) что количество партии уменьшает **только движение**, второго вычитания нет нигде (`:886-887`, запись `:947-956`); (г) что `productId` в теле не принимается — товар берётся у партии (`:920-923`); (д) что `fileIds`, объявленный в payload (`src/types/warehouse.ts:320-321`), никуда не пишется: `files: []` (`services/mocks/warehouse.ts:937`) → находка 9.
- Источник истины: мок + клиент; правило размера куска — домен (`frontend_vue/src/domain/cutting.ts`, `resolveOffcutMaterial`).

## Обязанности сервера

Заполняется как НАБЛЮДЕНИЕ: что знает мок, что знает бэкенд, где во фронте стоит константа
на месте серверного значения. Ответ «нигде» — это не решение, а строка в
`00-решения-владельца.md` с указанием домена.

- Значения по умолчанию и их владелец: **Две величины домен берёт у настроек арендатора, и обе продублированы константами.** (1) Базовая валюта: мок выводит её как `code` валюты с `isDefault`, иначе `constants.defaultCurrency` (`frontend_vue/src/services/mocks/warehouse.ts:74-76`), и она же — единственная валюта, на которой говорит склад (`:65-73`); ровно то же вычисление вторым экземпляром в клиенте создания партии (`frontend_vue/src/composables/useWarehouseBatchCreate.ts:29-31`), третьим — там же в форме `currency: settings.constants.defaultCurrency` (`:42`), а **четвёртым — литералом `'EUR'`** дефолтом формы карточки партии (`frontend_vue/src/composables/useWarehouseBatch.ts:120`). (2) Маржа: `MOCK_SETTINGS.constants.defaultMargin` подставляется засеянной партии без маржи (`services/mocks/warehouse.ts:110-113`) и новой партии (`:779`), а форма карточки берёт её из стора настроек (`frontend_vue/src/composables/useWarehouseBatch.ts:119`, `:207`, `:285`, `:315`) — при этом `marginPercent` в `BatchPatchPayload` не объявлен (`frontend_vue/src/types/warehouse.ts:190-204`) и на схеме колонки под него нет (`backend/app/modules/warehouse/shared/models.py:11-88`). **Константами во фронте стоят:** размер страницы `25` — десять раз, пятью `usePagination(25)` (`frontend_vue/src/composables/useWarehouse.ts:172-176`) и дефолтами пяти веток мока (`frontend_vue/src/services/mocks/index.ts:619`, `:660`, `:705`, `:757`, `:781`); перечень размеров `10/25/50/100` — `PAGE_SIZE_OPTIONS` в компоненте (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:174-179`), справочника под него нет ни в настройках, ни на схеме; единица по умолчанию — `'uom-kg'` в четырёх местах (`frontend_vue/src/composables/useWarehouseBatch.ts:117`, `frontend_vue/src/composables/useWarehouseBatchCreate.ts:40`, `frontend_vue/src/composables/useWarehouseStockCard.ts:52`, `:88`) и `'uom-pcs'` в четырёх (`frontend_vue/src/composables/useWarehouseOffcutCreate.ts:48`, `:229`, `:334`; и в моке создания дефицита — `services/mocks/warehouse.ts:1746`); ширина реза `3` мм (`frontend_vue/src/composables/useWarehouseCutting.ts:172`); приоритет `'high'` и статус `'open'` у нехватки, заведённой заказом (`services/mocks/warehouse.ts:1697-1698`); шаг количества `1` для штучной единицы и `0.01` для прочих — трижды (`frontend_vue/src/composables/useWarehouseBatchCreate.ts:160`, `frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue:111`, `frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue:250`). Кому принадлежат размер страницы, ширина реза по умолчанию и единица по умолчанию — **нигде**, вынесено в `00-решения-владельца.md`.
- События и уведомления: **Домен рождает два события из семи, и оба — в моке.** `notifyBatchReceived` при создании партии (`frontend_vue/src/services/mocks/warehouse.ts:789` → `frontend_vue/src/services/mocks/notifications.ts:616`) и `notifyStockDeficit` при **вновь открытой** нехватке (`services/mocks/warehouse.ts:1710` → `services/mocks/notifications.ts:637`), причём повтор события не рождает: ветка «тот же заказ просит снова» поднимает величину и выходит раньше вызова (`services/mocks/warehouse.ts:1681-1686`), а причина названа прямо (`:1707-1709`). Оба доказаны спекой `frontend_vue/src/services/mocks/notification-triggers.spec.ts`. Ничего не рождают: правка партии, её удаление, резка, движение любого типа, создание и удаление обрезка, смена статуса обрезка, правка и закрытие нехватки — `grep -n "notify" frontend_vue/src/services/mocks/warehouse.ts` даёт ровно три строки: импорт `:41` и два вызова. На бэкенде уведомлений нет вовсе — у модуля `notifications` ноль роутов (см. аудит notifications, шапка). Отдельно: восьмой тип уведомления, `reserve_expiring`, триггера не имеет, и причина — в складской модели: у `StockReservation` нет ни срока, ни даты окончания, а `Batch.expiresAt` — годность металла, а не граница брони (`services/mocks/notifications.ts:739-748`, тип — `frontend_vue/src/types/warehouse.ts:625-634`, `:107`). Обязан ли склад сообщать о списании, о резке, о просроченной партии и об исчерпании — **нигде**, вынесено в `00-решения-владельца.md`.
- Запись в аудит-лог: **Пять журналов, и их не пишет никто.** Домену принадлежат пять из девяти журналов ленты аудита — `stock`, `batch`, `offcut`, `movement`, `deficit` (`frontend_vue/src/types/audit.ts:10-14`, `:21-25`, роуты карточек `:40-44`), и все пять собирает `warehouseAuditSources()` (`frontend_vue/src/services/mocks/warehouse.ts:1942-2001`). Записи есть только в сидах: `shiftAuditSeries` двигает пять серий по демо-часам (`:221-238`), id проставляет `sealAuditIds` при сборке хранилища, а не в сиде (`frontend_vue/src/types/warehouse.ts:536-544`). Ни одна операция домена в журнал не пишет: у создания партии `auditLog: []` (`services/mocks/warehouse.ts:780`), у обрезка `:940`, у движения `:1248`, у нехватки `:1704` и `:1754`; `mockPatchBatch`, `mockPatchOffcut`, `mockPatchDeficitItem`, `mockPatchStockItem` журнала не касаются вовсе (`grep -n "auditLog" frontend_vue/src/services/mocks/warehouse.ts` — ни одного `push`). То есть **удалить запись можно, а появиться ей неоткуда** — тот же класс, что у products (см. аудит products, графа «Запись в аудит-лог»). Форма записи — `{id, timestamp, user: TranslatedString, userInitials, property: TranslatedString, oldValue, newValue}` (`frontend_vue/src/types/warehouse.ts:526-534`); автор — отображаемое имя, а не id пользователя; понятия `sensitive` в записи нет (`grep -c "sensitive" frontend_vue/src/types/warehouse.ts` → 0). На схеме таблица одна и привязана к партии: `stock_audit_entries.batch_id` — `nullable=False` FK на `warehouse_batches.id` (`backend/app/modules/warehouse/shared/models.py:240-245`), автор — `user_id` с `ondelete="SET NULL"` (`:246-250`), тексты — `JSONB` (`:251`, `:253`). Кто и в какой момент пишет пять журналов, кто автор записи и где хранятся четыре из пяти — **нигде**, вынесено в `00-решения-владельца.md`.
- Кастомные поля: **у домена их нет ни в каком виде.** `grep -rn "fieldValues\|FieldDefinition\|fieldId" frontend_vue/src/types/warehouse.ts frontend_vue/src/services/mocks/warehouse.ts frontend_vue/src/services/warehouseService.ts` — пусто; в шести таблицах схемы (`backend/app/modules/warehouse/shared/models.py:11-258`) ни одной ссылки на определения полей. Библиотека `/api/config/fields` к складу не привязана: секции матрицы прав и полей построены вокруг карточки товара и поставщика (`frontend_vue/src/services/mocks/config.ts:170-176`). Единственное «свободное поле» домена — `location`, и это **составная строка** формата `"Rack: X | Row: Y | Cell: Z\nNotes: …"`, которую разбирает регулярками и клиент, и мок (`services/mocks/warehouse.ts:649-678`, вторая копия — `frontend_vue/src/composables/useWarehouseBatch.ts`, третья — `frontend_vue/src/composables/useWarehouseOffcutCreate.ts:13`): справочника секторов нет, поэтому адрес это текст, и именно он единственная гарантия, что металл найдут (`services/mocks/warehouse.ts:1294-1300`).
- Настройки, которых мок не отслеживает: четыре, каждая — прямое наблюдение. (1) **Справочник единиц открыт, а арифметика склада закрыта.** `settings.uoms` знает девять единиц (`frontend_vue/src/services/mocks/settings.ts:91-146`), а таблица размеров куска — шесть: `uom-m`, `uom-mm`, `uom-m2`, `uom-kg`, `uom-t`, `uom-pcs` (`frontend_vue/src/domain/cutting.ts:71-86`). Партия в `uom-m3`, `uom-kg-m3` или `uom-h` не режется и обрезка не даёт никогда — `BATCH_UNIT_NOT_SUPPORTED` (`:52-53`). Добавленная арендатором единица попадёт в тот же отказ. (2) **Правила пересчёта `settings.conversions` склад не использует вовсе**: `grep -rn "conversions" frontend_vue/src/services/mocks/warehouse.ts frontend_vue/src/composables/useWarehouse*.ts frontend_vue/src/views/admin/warehouse/*.vue` — пусто; коэффициент закупки в складскую единицу выводится из **отношения количеств**, присланных клиентом (`services/mocks/warehouse.ts:713-719`), а не из справочника, тогда как карточка товара тот же коэффициент берёт именно из `settings.conversions` (см. аудит products, «Правила домена…», п. 16). (3) **Курса конвертации нет нигде**, и это решение, а не пробел (`services/mocks/warehouse.ts:65-73`): партия оценена в базовой валюте или не оценена вовсе. При этом на схеме у партии колонка `exchange_rate` **есть** (`backend/app/modules/warehouse/shared/models.py:86-88`, миграция `backend/alembic/versions/a1b2c3d4e5f6_phase_15_product_uom_restructure.py:134-137`), и во фронте её нет ни в типе, ни в моке (`grep -c "exchangeRate" frontend_vue/src/types/warehouse.ts` → 0). (4) **Карта склада к адресам партий не привязана ничем**: она живёт в настройках единичным ресурсом (`GET/PUT/DELETE /api/settings/warehouse-map`, см. аудит settings, «Правила домена…», п. 3), а `batch.location` — свободный текст (`frontend_vue/src/types/warehouse.ts:108-109`); связи между картинкой и строкой адреса нет ни одной. Все четыре вынесены в `00-решения-владельца.md`.
- Мультиарендность: **на схеме выражена у всех шести таблиц, во фронте — никак.** `tenant_id` объявлен `nullable=False, index=True`, FK на `tenants.id` с `ondelete="CASCADE"` у `warehouse_batches` (`backend/app/modules/warehouse/shared/models.py:16-21`), `warehouse_movements` (`:96-101`), `warehouse_offcuts` (`:136-141`), `warehouse_deficits` (`:173-178`), `stock_items` (`:207-212`) и `stock_audit_entries` (`:234-239`). Во фронте нет ни `tenantId`, ни `userId`, ни заголовка: `warehouseService.ts` — 374 строки без единого `options` (`grep -c "headers\|options"` → 0), мок понятия арендатора не имеет (`grep -n -i "tenant\|userId\|user_id" frontend_vue/src/services/mocks/warehouse.ts` — пусто). Отдельно: у `stock_items` уникальность объявлена **по одному `product_id`** без `tenant_id` (`backend/app/modules/warehouse/shared/models.py:213-219`), то есть строка остатка на схеме глобальна, а не арендаторская → находка 28.
- Права — в какой функции проверяются: **нигде.** На сервере проверять негде — роутов ноль. Во фронте доступ гейтится только фича-флагами: восемь роутов склада несут `meta.featureFlag: 'adminWarehouse'` (`frontend_vue/src/router/index.ts:98`, `:258`, `:264`, `:276`, `:282`, `:288`, `:306`, `:318`), страница резки — `warehouseCutting` (`:294`), карта склада — `warehouseMap` (`:300`); все три объявлены `true` (`frontend_vue/src/config/featureFlags.ts:7`, `:45`, `:47`). В матрице прав склада **нет ни одной строки**: `PERMISSION_ROLES` содержит роль `Warehouse` (`frontend_vue/src/services/mocks/config.ts:186`, пользователи — `:182`), но сами права строятся только из секций карточки товара и их полей (`:189-201`, источник — `MOCK_SECTIONS`), и ни партии, ни обрезка, ни движения, ни нехватки среди них нет. Три права заказов (`seeCost`, `manualCost`, `correction`) на складские экраны не распространяются: `grep -rn "useOrderPermissions\|seeCost" frontend_vue/src/views/admin/warehouse frontend_vue/src/composables/useWarehouse*.ts` — пусто, то есть себестоимость партии видит любой, кто открыл карточку. Какое право нужно на создание партии, на резку, на движение, на удаление записи журнала — **нигде**, вынесено в `00-решения-владельца.md`.
- Транзакционность и идемпотентность: `Idempotency-Key` не шлётся ни на одном из 37 путей (`grep -c "Idempotency" frontend_vue/src/services/warehouseService.ts` → 0), при том что генератор в проекте есть (`frontend_vue/src/services/api.ts:239-245`). Внутри мока атомарность выражена и объяснена в двух местах: `writeMovement` синхронна намеренно — отгрузка обязана записаться и списать в один заход, `await` посередине оставил бы товар проданным и лежащим на полке (`frontend_vue/src/services/mocks/warehouse.ts:1195-1201`); резка проверяет всё **до первой записи** и проводится целиком либо не проводится (`:1537-1538`, отказы `:1506-1535`). А вот **между запросами транзакции нет ни одной, и клиент рвёт операции на части в четырёх местах**: Save карточки партии — PATCH плюс `POST /movements` при смене адреса, и провал второго только показывает info-тост (`frontend_vue/src/composables/useWarehouseBatch.ts:255-276`); Save карточки обрезка — PATCH плюс до двух движений, оба с `.catch(() => {})` (`frontend_vue/src/composables/useWarehouseOffcutCard.ts:288-323`); смена статуса обрезка из списка — PATCH плюс движение, чей провал заглушен комментарием «Movement creation is secondary» (`frontend_vue/src/composables/useWarehouse.ts:362-383`); карточка остатка тянет агрегаты **циклом по всем партиям товара** (`frontend_vue/src/composables/useWarehouseStockCard.ts:53-59`). Повторный `POST /api/warehouse/batches` с тем же телом создаёт вторую партию: уникальности `batch_number` нет ни в моке (`services/mocks/warehouse.ts:680-791` — ни одной проверки), ни на схеме (`backend/app/modules/warehouse/shared/models.py:33` — просто `String(100)`). Что обязано быть атомарным — вынесено в `00-решения-владельца.md`.
- Производные значения (считать, не хранить): **одиннадцать, и это самая большая доля в проекте.** У партии: (1) `quantityRemaining` и (2) `status` выводятся **из журнала движений целиком** — `syncBatchQuantities` пересчитывает оба при загрузке модуля и объявлен инвариантом, а не инициализацией, с прямым указанием «бэкенд сделает ровно этот пересчёт при старте с сохранённого журнала» (`frontend_vue/src/services/mocks/warehouse.ts:389-416`, статус — `computeBatchStatus` `:304-345`); (3) `totalCost` = `quantity × unitPrice` и `null`, пока цены нет (`:767`, `:805-808`). У строки остатка **восемь полей из четырнадцати** считаются при каждом чтении: (4) `totalQuantity`, (5) `batchCount`, (6) `totalValue`, (7) `avgUnitPrice` — взвешенная только по оценённым партиям, (8) `uomId` — берётся у первой партии, (9) `reservedQuantity` — из резервов, (10) `availableQuantity` и (11) `isDeficit` (`:446-476`, причина `:434-445`). Плюс не имеющие своих полей вовсе: агрегаты партии (`:1415-1451`), активные продажи (`:1453-1482`), FIFO-стоимость (`:1801-1849`), `totalPages` и `total` пагинации (`:420-430`). Обратное направление тоже есть: склад **регистрирует** себя у каталога, чтобы тот считал среднюю закупочную цену товара, — `registerProductBatchLookup` (`:1377-1383`, причина `:1366-1376`), и это единственный законный путь между модулями. На схеме под все одиннадцать колонок нет: `warehouse_batches` хранит `quantity_remaining`, `status` и `total_cost` как обычные колонки (`backend/app/modules/warehouse/shared/models.py:36-45`, `:57-59`), `stock_items` — только `total_quantity` и `unit` (`:220-223`), то есть сервер обязан либо считать их при чтении, либо держать согласованными с журналом сам.

## Правила домена, которых нет в контракте

Самое ценное содержимое аудита: эндпоинты машина перечислит и без человека, а правило,
живущее только в моке или доменном слое, — нет.
1. **Складской слой говорит на одной валюте, и это решение, а не пробел.** `BASE_CURRENCY`
   выводится из настроек арендатора (`frontend_vue/src/services/mocks/warehouse.ts:74-76`);
   партия либо оценена в ней, либо не оценена вовсе, а закупка в чужой валюте остаётся на
   закупочном следе и ценой товара на полке не становится никогда — причина расписана в коде
   (`:65-73`). Отказ `BATCH_CURRENCY_NOT_BASE` стоит и на создании (`:724-726`), и на правке
   (`:801-803`). Курса конвертации в проекте нет нигде.
2. **Цена, которой никто не назвал, — это `null`, а не ноль.** `unitPrice` и `totalCost`
   объявлены `number | null` у партии (`frontend_vue/src/types/warehouse.ts:99`, `:101`) и у
   списочной записи (`:150`), причина названа в обоих местах (`:91-98`, `:149`); средняя цена
   остатка взвешивается **только по оценённым партиям**, иначе неоценённая тянула бы её к нулю
   (`frontend_vue/src/services/mocks/warehouse.ts:450-467`). Единственное место, где ноль всё же
   подставляется, — FIFO: домен заказов не умеет носить «неизвестно» (`:1820-1825`).
3. **Количество партии уменьшает ТОЛЬКО движение — второго вычитания нет нигде.**
   `writeMovement` единственный владелец (`frontend_vue/src/services/mocks/warehouse.ts:1264-1273`),
   и тот же список «что уносит металл» используется пересчётом из журнала
   (`OUTGOING_MOVEMENT_TYPES` `:355-363`, `takesFromBatch` `:385-387`, применение `:402`, `:1267`).
   Причина, почему список один: разойдись они — пересчёт «вернул» бы партии то, что при записи с
   неё ушло, молча и только после пересборки хранилища (`:347-354`). Создание обрезка списывает
   через движение и никак иначе (`:944-956`, история ошибки — `:875-888`).
4. **Движение с заполненным `offcutId` двигает КУСОК, а не партию.** Исключение — сам тип
   `offcut`, то есть резка: материал уходит с партии ровно один раз, ею
   (`movesOffcut` `:380-382`, причина `:365-379`). Поэтому такое движение не меняет количества
   партии, не попадает в её агрегаты и не влияет на её статус (`:313`, `:1425`, `:402`), а
   `batchId` в нём назван ради происхождения. Посылка обязана быть истинной в данных: у каждого
   из 13 засеянных кусков ровно одно движение `offcut`
   (`grep -c "type: 'offcut'" frontend_vue/src/mocks/warehouse-movements.ts` → 14, из них 13
   записей и одна строка в комментарии `frontend_vue/src/mocks/warehouse-movements.ts:2452`; кусков —
   `grep -c "id: 'who-" frontend_vue/src/mocks/warehouse-offcuts.ts` → 13).
5. **Статус куска — это и есть его остаток, и ставится он по ТИПУ движения, а не по перечню
   случаев.** `OFFCUT_STATUS_BY_MOVEMENT` — семь типов (`frontend_vue/src/services/mocks/warehouse.ts:294-302`),
   применение — в той же функции, где партия теряет количество (`:1337-1344`), и причина названа:
   отдельный вызов рядом когда-нибудь забудут позвать, и кусок останется свободным
   (`:1325-1336`). Отличия от таблицы партии перечислены прямо: у куска нет `receipt` и
   `converted_to_offcuts`, зато есть `return` (`:281-293`).
6. **Обрезок неделим, поэтому занят он целиком, и занятость ВЫВОДИТСЯ, а не хранится.** Кто стоит
   на куске — вопрос к заказам, и склад спрашивает их регистрацией, а не импортом
   (`registerOffcutClaimLookup` `:972-976`, причина `:961-971`); спрашивается разбивка строки, а
   не резерв, потому что разбивка шире и старше (`:978-997`). Следствие названо: удалённая строка
   отпускает кусок сама, а аннулированный заказ — не отпускает, пока его строки живы (`:992-996`).
7. **Обрезки в автоматический FIFO не попадают и не будут.** Кусок выбирают глазами по размеру, а
   не по дате поступления, поэтому FIFO строится только из партий, а `GET /offcuts/offers` —
   единственная дорога куска в заказ (`frontend_vue/src/types/warehouse.ts:280-282`,
   `frontend_vue/src/services/mocks/warehouse.ts:1021-1035`).
8. **FIFO считает по ДОСТУПНОМУ, а не по остатку, и недостачу сообщает, а не усредняет.** Из
   количества партии вычитается и чужой резерв, и чужой хват разбивки
   (`:1814-1819`); история того, что бывает без второго слагаемого, записана числами: 305 единиц,
   выданных дважды, и цена на 3,1% ниже правды под ярлыком «со склада» (`:1788-1795`).
9. **Перенос меняет место, а не количество, и место пишется по-разному для куска и для партии.**
   Кусок переезжает целиком при любом количестве в движении, партия — только когда уходит весь
   остаток; неизвестный адрес назначения известный не стирает, потому что устаревшая строка хуже
   пустой (`:1293-1323`, причина `:1294-1300`).
10. **Партия не хранит имени товара, а строка остатка — хранит имя своей категории.** Имя товара
    убрано у партии, обрезка и движения (`frontend_vue/src/types/warehouse.ts:73-77`, `:213-219`,
    `:353`), подпись собирается на месте показа, а поиск и сортировка по имени остаются
    серверными (`_matchesProductName` `frontend_vue/src/services/mocks/warehouse.ts:136-144`,
    `_compareProductName` `:146-149`). Но `StockOverviewItem.categoryName`
    (`frontend_vue/src/types/warehouse.ts:594-595`) и `WarehouseDeficit.productName` (`:446`)
    остались копиями, и `projectStockRow` обновляет из каталога только имя товара, категорию — нет
    (`frontend_vue/src/services/mocks/warehouse.ts:461`).
11. **Демо-цены партий согласованы с каталогом, а не выдуманы.** `_resolveBatchCost` приводит
    закупочную цену к 58–84% от продажной цены товара, разброс между партиями сохраняя
    (`:161-192`); причина названа числами: труба на складе за 1 000,00 при продажной 45,00 и
    маржа −91% в каждой строке, использующей такую партию (`:161-176`). Тем же приёмом
    выравниваются цены движений (`:204-213`).
12. **Пять журналов домена едут на демо-часах, и движения сдвигаются на сиде, а не на копии.**
    Пять серий, пять концов, пять сдвигов (`:221-238`); движения сдвигаются до первого чтения
    именно потому, что `getOrCreateMovementAudit` копирует сид при первом обращении, и сдвиг
    копии оставил бы две правды об одном журнале (`:228-233`, аккумулятор `:1583-1591`).
13. **Адрес хранения — составная строка, и её формат продублирован в трёх местах.**
    `"Rack: X | Row: Y | Cell: Z\nNotes: …"`: четыре регулярки и разбор в моке
    (`:649-678`), вторая реализация в карточке партии (`frontend_vue/src/composables/useWarehouseBatch.ts`,
    сборка `:242-248`), третья — на странице создания обрезка
    (`frontend_vue/src/composables/useWarehouseOffcutCreate.ts:13`, `:301-306`). Справочника
    секторов нет.
14. **Идентификаторы домена — строки с префиксом, и у обрезка их два.** Партия `whb-NNN`
    (`frontend_vue/src/services/mocks/warehouse.ts:683`, сиды `frontend_vue/src/mocks/warehouse-batches.ts`,
    100 записей), движение `whm-NNN` (`:1225`, 88 засеянных `whm-` плюс 20 `wmo-`), нехватка
    `whd-NNN` (`:1690`, `:1737`), а обрезок в сидах — `who-NNN`
    (`grep -c "id: 'who-" frontend_vue/src/mocks/warehouse-offcuts.ts` → 13), тогда как созданный
    получает `offcut-NNN` (`:912`). Счётчики выводятся из длины хранилища (`:240-243`), то есть
    после удаления следующий id столкнётся с существующим — тот же класс, что у products (см.
    аудит products, «Правила домена…», п. 3).
15. **Порядок веток мока — часть контракта в трёх местах.** `/stock/:id/cost` разбирается раньше
    `/stock/:id` (`frontend_vue/src/services/mocks/index.ts:637` против `:644`),
    `/offcuts/offers` — раньше `/offcuts/:id` (`:726` против `:730`, с объяснением `:724-725`),
    `/movements/:id/audit` — раньше `/movements/:id` (`:745` против `:750`, объяснение `:744`).
    У остальных трёх ресурсов аудит стоит **после** карточки и достижим только потому, что
    регулярка карточки требует конца строки (`:653`, `:688`, `:739`, `:807`).
16. **Экран списка помнит фильтры в `localStorage`, а сервер об этом не знает.** Пять ключей —
    `warehouse_stock_prefs`, `warehouse_batches_prefs`, `warehouse_offcuts_prefs` и далее
    (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:225-227`), с проверкой формата
    сохранённой единицы при чтении (`:360`). Ни один из них на сервер не уходит.
17. **Создание движения убрано из интерфейса списка, но осталось на карточке партии.** В
    `useWarehouse` три пометки `DEPRECATED` про модал создания движения
    (`frontend_vue/src/composables/useWarehouse.ts:44`, `:47`, `:659`) и одна в странице
    (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:32`), а сам
    `CreateMovementModal.vue` жив и подключён к карточке партии
    (`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:20`, `:1522`).
18. **`DELETE /api/warehouse/movements/:id` существует в моке и не существует в клиенте.** Ветка
    есть (`frontend_vue/src/services/mocks/index.ts:1619-1623`, функция
    `frontend_vue/src/services/mocks/warehouse.ts:1407-1411`), в `warehouseService.ts` такой
    функции нет, и в инвентарь эндпоинтов домена этот путь не попал — он одна из пяти «сирот»
    замера К2 (см. `roo_code/plans/api/contract-sync-plan.md:259`). Удаление движения — это
    удаление факта, изменившего остаток; что должно происходить с партией, не сказано нигде.
19. **У пяти эндпоинтов домена написан клиент и нет ни одного экрана.** `getStockAudit`
    (`frontend_vue/src/services/warehouseService.ts:328`), `getOffcutAudit` (`:348`),
    `getMovementAudit` (`:358`), `getDeficitAudit` (`:368`) и `createDeficitItem` (`:245`) —
    `grep -rn` по `frontend_vue/src` даёт для каждого только объявление. Четыре журнала из пяти
    приходят полем самой сущности, а нехватку заводит внутрипроцессная `recordShortage`
    (`frontend_vue/src/services/mocks/warehouse.ts:1667-1712`), а не HTTP.

## Находки про код → contract-sync-warehouse-bugs.md

Двадцать восемь, все записаны в `roo_code/plans/bugs/contract-sync-warehouse-bugs.md`, код не
тронут:

1. Клиент домена не шлёт ни одного заголовка на всех 37 путях (`frontend_vue/src/services/warehouseService.ts` — `grep -c "headers\|options"` → 0), включая удаление записей аудита из ленты, которая свои чтения подписывает (`frontend_vue/src/services/auditFeedService.ts:20`, `:66-76`).
2. Строку остатка не заводит никто: `stockStore` пополняется только сидом, создание партии её не создаёт (`frontend_vue/src/services/mocks/warehouse.ts:215`, `:680-791`), и товар без засеянной строки отвечает `STOCK_ITEM_NOT_FOUND` (`:547`).
3. Двенадцать сортируемых колонок склада не сортируют ничего: `name` и `uomId` у остатка, `lotCode` у партий, семь колонок у обрезков, `uomId` и `status` у дефицита (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:1355,1524,1908,2375,2420,2465,2510,2600,2643,2688,3555,3643` против `frontend_vue/src/services/mocks/warehouse.ts:515-523,595-610,859-865,1638-1649`).
4. Один и тот же «нет строки остатка» отвечает двумя разными кодами: `STOCK_ITEM_NOT_FOUND` у чтения и правки (`frontend_vue/src/services/mocks/warehouse.ts:547`, `:558`) и `STOCK_NOT_FOUND` у удаления записи журнала (`:1866`).
5. `PATCH /api/warehouse/stock/:id` возвращает запись **без проекции** (`frontend_vue/src/services/mocks/warehouse.ts:560`), и карточка кладёт её прямо в состояние (`frontend_vue/src/composables/useWarehouseStockCard.ts:150`) — сразу после Save на экране засеянные числа вместо посчитанных.
6. Пять чтений журналов и два чтения агрегатов отвечают пустым массивом на несуществующую сущность, тогда как парные удаления бросают `*_NOT_FOUND` (`frontend_vue/src/services/mocks/warehouse.ts:1861,1878,1891,1903,1918,1417,1455` против `:1866,1883,1896,1912,1926`).
7. Четыре ветки мока содержат недостижимую проверку `path.endsWith('/audit')` внутри регулярки `([^/]+)$` (`frontend_vue/src/services/mocks/index.ts:647-649,682-684,733-735,801-803`).
8. Ни один из 15 `supplierId` в сидах партий не существует в каталоге поставщиков (`frontend_vue/src/mocks/warehouse-batches.ts` — `sup-001`…`sup-015`; `frontend_vue/src/services/mocks/suppliers.ts` — `1`…`6`, `f1`, `f2`, `sup-au-1`, `sup-au-2`), поэтому `supplierName` на партии — единственный источник имени и проверить его нечем.
9. `fileIds` принимается подписью создания партии и телом создания обрезка и никуда не пишется: `files: []` (`frontend_vue/src/services/mocks/warehouse.ts:681`, `:776`, `:937`), а PATCH кладёт массив id прямо в запись через `Object.assign` (`:804`, `:1107`), не превращая его в `files`.
10. Три эндпоинта получают ключи, которых нет в их payload: PATCH партии — шесть (`uomId`, `marginPercent` и четыре части адреса, `frontend_vue/src/composables/useWarehouseBatch.ts:106-128`, `:240`), PATCH обрезка — четыре (`frontend_vue/src/composables/useWarehouseOffcutCard.ts:199-207`, `:270`), POST обрезка — четыре (`frontend_vue/src/composables/useWarehouseOffcutCreate.ts:32-54`, `:311`).
11. `mockDeleteBatch` вырезает одну запись и не трогает ни движения, ни обрезки, ни журнал (`frontend_vue/src/services/mocks/warehouse.ts:816-821`), тогда как старый контракт обещает каскад (`roo_code/roo-context/03-api-contract.md:1404`), а схема его требует четырьмя FK (`backend/app/modules/warehouse/shared/models.py:102-107`, `:142-147`, `:153-157`, `:240-245`).
12. Карточка остатка тянет агрегаты циклом по всем партиям товара — N+1 запрос на открытие экрана (`frontend_vue/src/composables/useWarehouseStockCard.ts:46-59`).
13. Возврат, записанный доменом заказов, не уменьшает агрегат продажи и не гасит активную продажу: `referenceType` там `order-shipment` / `order-return` (`frontend_vue/src/services/mocks/orders.ts:3344`, `:3435`, `:3780`, `:3792`), а склад сверяет его со списком типов движений (`frontend_vue/src/services/mocks/warehouse.ts:1426-1431`, `:314-318`) и сопоставляет возвраты продажам по `referenceId` (`:1457-1468`).
14. Все десять отказов резки схлопываются в один тост (`frontend_vue/src/composables/useWarehouseCutting.ts:329-331` против `frontend_vue/src/services/mocks/warehouse.ts:1506-1535` и `frontend_vue/src/domain/cutting.ts:52-58`).
15. Арифметика резки закрыта шестью единицами (`frontend_vue/src/domain/cutting.ts:71-86`), а справочник настроек знает девять (`frontend_vue/src/services/mocks/settings.ts:91-146`): партия в `uom-m3`, `uom-kg-m3` или `uom-h` не режется никогда.
16. Списки обрезков и дефицита отдают запись целиком вместо списочной (`frontend_vue/src/services/mocks/warehouse.ts:866`, `:1651` против `src/types/warehouse.ts:252-269`, `:469-490`), в отличие от партий и движений, где проекция есть (`frontend_vue/src/services/mocks/warehouse.ts:612`, `:1192`).
17. Схема обрезка не знает ни одного размера, ни веса, ни категории, ни `qr_data`, ни `order_id` — шесть содержательных колонок против двадцати одного поля типа (`backend/app/modules/warehouse/shared/models.py:131-165` против `frontend_vue/src/types/warehouse.ts:208-250`).
18. ~~`OFFCUT_LINKED_TO_ORDER` читается только из `e.message`~~ — **закрыто:** сегодня код читается через `errorCode(e)` (`frontend_vue/src/composables/useWarehouseOffcutCard.ts:386`), то есть из `ApiRequestError.code` (`frontend_vue/src/types/api.ts:26-31`), как и парная проверка у партии (`frontend_vue/src/composables/useWarehouseBatch.ts:341`). Находка оставлена для истории; пометка `✅` стоит в баг-файле.
19. Удаление обрезка сторожит только `orderId` (`frontend_vue/src/services/mocks/warehouse.ts:1114`), а хват строки заказа, по которому кусок и считается занятым, не спрашивается (`takenOffcuts` `:998-1000`); списанный движением материал партии при этом не возвращается.
20. `categoryIds` уходит в query движений и дефицита и не фильтрует ничего (`frontend_vue/src/services/warehouseService.ts:182-183`, `:234-235` против `frontend_vue/src/services/mocks/warehouse.ts:1156-1174`, `:1607-1633`).
21. Карточка партии просит свои движения и обрезки **по номеру партии**, а не по её id (`frontend_vue/src/composables/useWarehouseBatch.ts:356`, `:426`), при том что уникальности `batch_number` нет ни в моке, ни на схеме (`backend/app/modules/warehouse/shared/models.py:33`).
22. `MovementCreatePayload.unitPrice` и `.currency` не шлёт никто, а `currency` мок игнорирует по построению — валюта всегда берётся у партии (`frontend_vue/src/types/warehouse.ts:406`, `:414` против `frontend_vue/src/services/mocks/warehouse.ts:1249`).
23. На схеме у движения **нет колонки `offcut_id`** (`backend/app/modules/warehouse/shared/models.py:91-128`), а на этом поле держатся списание куска, его статус и его журнал (`frontend_vue/src/types/warehouse.ts:352`, `frontend_vue/src/services/mocks/warehouse.ts:380-382`, `:1337-1344`).
24. `WarehouseDeficit.productName` — последняя оставшаяся в домене копия имени товара (`frontend_vue/src/types/warehouse.ts:446`), после того как её убрали у партии, обрезка и движения (`:73-77`, `:213-219`, `:353`); ручное создание пишет туда три пустых строки (`frontend_vue/src/services/mocks/warehouse.ts:1742`).
25. Схема нехватки не знает ни `priority`, ни `suggested_order_qty`, ни `purchase_order_id`, а её `status` объявлен с дефолтом `"critical"` — значением из перечня приоритетов, а не статусов (`backend/app/modules/warehouse/shared/models.py:196-198` против `frontend_vue/src/types/warehouse.ts:46`, `:49`).
26. Ручное создание нехватки заполняет шесть полей константами, включая `uomId: 'uom-pcs'` и пустое имя товара (`frontend_vue/src/services/mocks/warehouse.ts:1742-1749`), тогда как путь заказа заполняет их осмысленно (`:1689-1705`).
27. Выгрузка — заглушка: `mockExportWarehouseCsv` возвращает литерал `'mock-csv-data'` и не смотрит ни на вкладку, ни на один из фильтров, которые клиент собирает 58 строками (`frontend_vue/src/services/mocks/warehouse.ts:1853-1855` против `frontend_vue/src/services/warehouseService.ts:262-324`).
28. Уникальность `stock_items` объявлена по одному `product_id` без `tenant_id` (`backend/app/modules/warehouse/shared/models.py:213-219`), то есть строка остатка на схеме одна на всю систему, а не на арендатора.
