# Suppliers

Справочник поставщиков: список с канбаном, карточка с пятью панелями, создание, быстрая смена
статуса, удаление записи аудита, экспорт и лёгкий справочник для выпадашек. Эндпоинтов **восемь**.

Общие правила — [`00-conventions.md`](00-conventions.md) в этом каталоге: конверт ответа (§1),
каталог кодов ядра (§2), `PATCH` против `PUT` (§3), мультиарендность (§4), заголовки авторизации
(§5), права (§6), кастомные поля (§8), аудит-лог (§9), уведомления (§10), идемпотентность и
`If-Match` (§11), `TranslatedString` (§12), пагинация (§13), даты и валюта (§14), Save UX (§15),
файлы (§16), производные значения (§17), чем мок отличается от сервера (§18), форма id (§19).
Ниже — только то, что живёт в этом домене. Второго экземпляра общего правила здесь нет
намеренно.

Аудит, из которого собран файл: [`plans/api/audit/suppliers.md`](../../plans/api/audit/suppliers.md).
Находки про код: [`contract-sync-suppliers-bugs.md`](../../plans/bugs/contract-sync-suppliers-bugs.md).
Строки, которые контракт не назначает:
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
`suppliers` — двадцать строк.

## Источник истины: модуль бэкенда есть, роутов у него ноль

`backend/app/modules/suppliers/` содержит `shared/models.py`, `shared/dependencies.py`,
`internal_api/interface.py` и пустой `features/__init__.py`; `grep -rn "@router\."
backend/app/modules/suppliers --include=*.py` не даёт ни одного попадания, а `dependencies.py` и
`internal_api/interface.py` — по одному докстрингу
(`backend/app/modules/suppliers/shared/dependencies.py:1`,
`backend/app/modules/suppliers/internal_api/interface.py:1`).

Отсюда разделение источников, и оно проходит **внутри** каждого раздела:

- **форма запроса и ответа на проводе** — клиент [`services/suppliersService.ts`](../../../frontend_vue/src/services/suppliersService.ts)
  и мок [`services/mocks/suppliers.ts`](../../../frontend_vue/src/services/mocks/suppliers.ts);
  у каждого раздела ниже стоит строка `Бэкенд: не реализован`;
- **схема хранения** — `backend/app/modules/suppliers/shared/models.py`, шесть таблиц миграции
  `backend/alembic/versions/a8dd7d7ba74b_phase_6_suppliers.py:26,56,70,83,94,109`. Она **старше**
  типов фронта: она уже в БД. Четыре расхождения перечислены в «Схема старше типов» и собраны
  находкой БАГ-06.

Метка `Статус: спроектировано` в этом файле не стоит нигде: у всех восьми эндпоинтов есть клиент и
ветка мока, то есть код существует — отсутствует только серверная часть, и об этом говорит строка
`Бэкенд:`.

Потребители домена: [`composables/useSuppliers.ts`](../../../frontend_vue/src/composables/useSuppliers.ts)
(список и канбан), [`composables/useSupplierCard.ts`](../../../frontend_vue/src/composables/useSupplierCard.ts)
(карточка), [`composables/useSupplierCreate.ts`](../../../frontend_vue/src/composables/useSupplierCreate.ts)
(создание), плюс четыре чужих экрана, зовущих домен как справочник:
`composables/useProductCard.ts:141-144`, `composables/useCategoryCard.ts:66-69`,
`views/admin/warehouse/WarehousePage.vue:525`, `composables/useWarehouseBatchCreate.ts:297`.

## Правила домена

Восемь правил, каждое живёт только здесь.

1. **Статусов ровно шесть, и списка-источника у них нет.** `SupplierStatus` — `active`,
   `preferred`, `new`, `under_review`, `suspended`, `blocked`
   (`frontend_vue/src/types/supplier.ts:4-10`); тот же перечень продублирован колонками канбана
   (`frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:92-99`) и пилюлями формы
   (`frontend_vue/src/components/admin/SupplierFormSections.vue:45-52`). Схема — `String(50)` без
   `enum` и без `CHECK` (`backend/app/modules/suppliers/shared/models.py:29-31`), то есть
   ограничение обязан наложить сервер. Доменного модуля с одним источником у поставщика нет — в
   отличие от заказов (`frontend_vue/src/domain/orderStatus.ts`).
2. **Три переводимых поля сливаются, а не заменяются.** `company`, `contactPerson`, `statusReason`
   проходят через `mergeTranslatedString` (`frontend_vue/src/services/mocks/suppliers.ts:417-423`),
   поэтому правка в одной локали не стирает две другие. Клиент со своей стороны конвертирует
   пришедшую из формы строку в `TranslatedString` **текущей локали**
   (`frontend_vue/src/services/suppliersService.ts:33-49`), то есть на проводе всегда объект,
   никогда строка. Общий выбор между тремя помощниками — §12 соглашений; здесь важно, что на
   правке применяется именно merge.
3. **Дельта Save считается по верхнему уровню, вложенное уходит целиком.** `useDirtyCheck.diff()`
   сравнивает `JSON.stringify` каждого ключа первого уровня
   (`frontend_vue/src/composables/useDirtyCheck.ts:62-77`, причина —
   `frontend_vue/src/composables/useDirtyCheck.ts:51-55`). Для сервера это значит
   **replace-семантика** у `addresses`, `contacts`, `files`, `bccEmails`, `categories`, `tags`:
   удаление элемента выражается его отсутствием в присланном массиве, а не отдельной операцией.
4. **У поставщика два журнала сразу, и удаляется только один.** `auditLog` — общий для семи
   сущностей тип (`frontend_vue/src/types/supplier.ts:81` →
   `frontend_vue/src/types/warehouse.ts:526-534`), запись адресуется своим `id`, удаление идёт в
   `DELETE /api/suppliers/:supplierId/audit/:entryId`. `history`
   (`frontend_vue/src/types/supplier.ts:107-112`) — свой, только у поставщика, без `id`, без
   эндпоинта и **без таблицы на бэкенде**: миграция домена создаёт шесть таблиц, `supplier_history`
   среди них нет (`backend/alembic/versions/a8dd7d7ba74b_phase_6_suppliers.py:26,56,70,83,94,109`).
   Мок его синтезирует из `createdAt`/`updatedAt`
   (`frontend_vue/src/services/mocks/suppliers.ts:335-356`).
5. **`priceHistory` — не история цен, а склейка двух источников.** Строка `pending`/`sent` — это
   неотвеченный BCC-запрос без цены, `replied` — ответ поставщика с ценой и остатком; так
   документировано типом (`frontend_vue/src/types/supplier.ts:56-70`) и так строит мок — одна
   строка `replied` с ценой, одна `sent` без
   (`frontend_vue/src/services/mocks/suppliers.ts:357-384`). Серверная таблица этого не выражает
   (см. «Схема старше типов», п. 4).
6. **Список и карточка обязаны отдаваться из одного состояния.** В моке «сервером» является кэш
   `MOCK_CARD`: он заполняется при первом чтении
   (`frontend_vue/src/services/mocks/suppliers.ts:407`) и с этого момента отвечает на все
   последующие `GET` (`frontend_vue/src/services/mocks/suppliers.ts:305`). Обычный `PATCH` пишет в
   обе структуры (`frontend_vue/src/services/mocks/suppliers.ts:426`,
   `frontend_vue/src/services/mocks/suppliers.ts:429-447`), а быстрая смена статуса — только в
   список (`frontend_vue/src/services/mocks/suppliers.ts:451-454`), из-за чего карточка после
   канбана показывает прежний статус (БАГ-03). Сервер, у которого «карточка» и «строка списка» —
   два представления одной записи, обязан гарантировать их совпадение.
7. **Экспорт списка существует в двух несовместимых видах** — серверный эндпоинт без вызывающего
   (`frontend_vue/src/services/suppliersService.ts:86-93`) и браузерный экспорт текущей страницы по
   кнопке (`frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:205-225`). Колонки у них
   разные, у второго нет строки заголовка. Какой настоящий — строка владельцу (БАГ-04).
8. **Справочники формы поставщика зашиты константами в компоненте.** `CURRENCY_OPTIONS` — четыре
   кода (`frontend_vue/src/components/admin/SupplierFormSections.vue:58-63`), `PAYMENT_OPTIONS` —
   три строки (`frontend_vue/src/components/admin/SupplierFormSections.vue:65-69`),
   `CATEGORY_OPTIONS` — пятнадцать (`frontend_vue/src/components/admin/SupplierFormSections.vue:71-87`).
   Валютами при этом владеют настройки, категориями — отдельный домен с CRUD. Находки БАГ-01 и
   БАГ-05; кому принадлежит каждый из трёх справочников — строки владельцу.

## Схема старше типов: четыре расхождения

Правило старшинства (бэкенд → мок и клиент → замысел) применяется по эндпоинту, но **схема
хранения** от него не зависит: таблицы уже созданы миграцией. Там, где тип фронта расходится со
схемой, расхождение — на стороне фронта, и все четыре собраны в БАГ-06.

**Решено 2026-09-11 (П68, П72): две колонки удаляются, третья остаётся с обязанностью.**
`has_deficit` и `last_bcc_date` (`backend/app/modules/suppliers/shared/models.py:58-61`) удаляются —
оба значения выводятся при чтении, и сегодня их не пишет никто. `priceHistory`, наоборот,
**хранится** и обновляется **событием**: она склеена из прайс-леджера и журнала BCC, то есть из
чужого модуля, и это названное исключение ([§17.1](00-conventions.md)). Контракт обязан
перечислить все события, двигающие её: запись прайса и приём ответа BCC.

**Решено 2026-09-10 (П67): страна поставщика становится кодом.** Свободного текста в поле страны
не остаётся нигде — правило общее для компании, клиента и поставщика ([§14](00-conventions.md)).
Полей у поставщика **два**: `Supplier.country` (`String(100)`, nullable,
`backend/app/modules/suppliers/shared/models.py:38`; во фронте `types/supplier.ts:21`) и
`SupplierAddress.country` (`String(100)`, `NOT NULL`,
`backend/app/modules/suppliers/shared/models.py:103`; во фронте
`types/supplier.ts:88`). Оба хранят код ISO 3166-1 alpha-2 из закрытого списка
(`domain/countries.ts`), сервер обязан проверять его предикатом, а выбор в интерфейсе — быть с
поиском по названиям на всех языках и по коду. Своей вёрстки у поля нет: страна приходит через
библиотеку полей карточки, `f-country` (`services/mocks/config.ts:63`), то есть меняется тип поля.

Перенос посева показывает, зачем правило: сегодня там `'Estonia'`, `'Lithuania'`, `'Sweden'`,
`'Latvia'`, `'Germany'` и `'UK'` (`services/mocks/suppliers.ts:17`, `:117`) — английские названия
вперемешку с сокращением, и **`UK` кодом ISO не является**: Великобритания это `GB`
(`domain/countries.ts:96`). Строка, которая выглядит кодом, им не была.

| фронт | схема | что это значит серверу |
|---|---|---|
| `SupplierAddress.line2?: string` (`frontend_vue/src/types/supplier.ts:83-90`) | колонки нет (`backend/app/modules/suppliers/shared/models.py:98-107`) | второй строки адреса хранить негде |
| контакт: `role: TranslatedString` (`frontend_vue/src/types/supplier.ts:92-97`) | `position: String(255)`, непереводимый (`backend/app/modules/suppliers/shared/models.py:130`) | и имя поля, и переводимость разные |
| файл: `size`, `type` на записи (`frontend_vue/src/types/supplier.ts:99-105`) | ссылка `file_id` → `uploaded_files` с `ondelete="RESTRICT"`, своих `size`/`mime` нет (`backend/app/modules/suppliers/shared/models.py:157-165`) | размер и тип — производные от файла, а не поля карточки |
| `SupplierPriceEntry` — семь полей, включая `stock`, `source`, `status` (`frontend_vue/src/types/supplier.ts:56-70`) | `supplier_price_entries` знает `price`, `unit`, `entry_date`, `notes`, `product_id`; трёх полей нет, а `unit` — `String(20)` против `TranslatedString \| null` (`backend/app/modules/suppliers/shared/models.py:204-234`, `backend/app/modules/suppliers/shared/models.py:227`) | либо склейку делает сервер при чтении из двух таблиц, либо схема неполна — **осталось** |

## Каталог кодов ошибок домена

Домен бросает **два** кода, оба из одной функции удаления записи аудита:

| код | когда | где |
|---|---|---|
| `SUPPLIER_NOT_FOUND` | карточки поставщика нет в состоянии | `frontend_vue/src/services/mocks/suppliers.ts:458` |
| `AUDIT_ENTRY_NOT_FOUND` | запись с таким `entryId` не найдена | `frontend_vue/src/services/mocks/suppliers.ts:460` |

Ни один не подстрока другого, и ни один **не доходит до человека**: карточка ловит любую ошибку и
показывает общий тост `msg.status_error`
(`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue:76-78`). Это класс из §2 соглашений
(отказ несёт код, а не текст), а не свойство домена.

Остальные семь эндпоинтов кодов не бросают вовсе. Два места, где отказ есть, но кода нет:

- чтение несуществующей карточки — `throw new Error(\`Supplier ${id} not found\`)`
  (`frontend_vue/src/services/mocks/suppliers.ts:307`): человекочитаемая фраза вместо машинного
  кода, при том что соседняя функция того же файла бросает именно код
  (`frontend_vue/src/services/mocks/suppliers.ts:458`). Сервер обязан отвечать `404 NOT_FOUND`
  (`backend/app/core/exceptions.py:13-20`);
- быстрая смена статуса на неизвестном id **молча ничего не делает** — `if (s) s.status = …`
  (`frontend_vue/src/services/mocks/suppliers.ts:451-454`), промах неотличим от успеха. Сервер
  обязан отвечать `404 NOT_FOUND`.

Коды ядра, которыми сервер обязан отвечать в этом домене: `NOT_FOUND` (несуществующий поставщик
или запись аудита), `VALIDATION_ERROR` (создание без `company`/`email`), `UNAUTHORIZED` (нет
сессии), `FORBIDDEN` (см. «Обязанности сервера», графа «Права») —
`backend/app/core/exceptions.py:13-48`, статусы в §2 соглашений.

---

### GET /api/suppliers

Страница списка и канбан. Чтение: `onMounted → load()`, любое изменение фильтров и пагинации
(`frontend_vue/src/composables/useSuppliers.ts:60-78`). Тот же эндпоинт зовут как справочник с
`pageSize: 999` карточка товара (`frontend_vue/src/composables/useProductCard.ts:141-144`) и
карточка категории (`frontend_vue/src/composables/useCategoryCard.ts:66-69`).

Запрос — query-строка, все значения строками
(`frontend_vue/src/services/suppliersService.ts:10-19`):

```ts
{
  page: string          // "1"
  pageSize: string      // "25"
  search: string
  status: SupplierStatus | 'all'
  rating: string        // "0" — без фильтра
  categories?: string   // "Sheets,Pipes" — ставится ТОЛЬКО при непустом списке
}
```

`categories` — единственный необязательный параметр: клиент добавляет его лишь когда список непуст
(`frontend_vue/src/services/suppliersService.ts:17-19`), сервер разбирает по запятой
(`frontend_vue/src/services/mocks/index.ts:338`). Остальные пять уезжают всегда, в том числе
пустыми, — общее правило §13 соглашений («пустая строка фильтра доезжает буквально»).

**Что именно ищет `search`:** три локали названия компании и email — и больше ничего
(`frontend_vue/src/services/mocks/suppliers.ts:262-266`). По `contactPerson` поиска нет; прежний
контракт его обещал — снято, см. «Чего в домене нет». Пробел аудита (в) закрыт: у эндпоинта
нет бэкенда, значит источник истины — мок и клиент.

Ответ: `PaginatedResponse<Supplier>` — `{ items, total, page, pageSize, totalPages }`
(`frontend_vue/src/types/api.ts:8-14`), собирается в
`frontend_vue/src/services/mocks/suppliers.ts:279-293`, `total` — длина отфильтрованного,
`totalPages = Math.ceil(total / pageSize)` (`frontend_vue/src/services/mocks/suppliers.ts:291`).
`Supplier` — **18** полей (`frontend_vue/src/types/supplier.ts:12-31`; замер — `sed -n '13,30p' src/types/supplier.ts | grep -c ":"` → `18`).

Ошибки: домен не бросает ни одной; композабл кладёт любую в строку `error`
(`frontend_vue/src/composables/useSuppliers.ts:33-35`).

Save-режим: чтение.

**Осталось (пробелы аудита, а):** `rating` — точное совпадение или минимум. Мок фильтрует
равенством (`frontend_vue/src/services/mocks/suppliers.ts:270`), прежний контракт объявлял
минимумом; одно из двух неверно, и контракт этого не назначает —
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), строка
`suppliers · Форма запроса · rating`.

**Осталось (б):** сортировка. Клиент параметра сортировки не шлёт
(`frontend_vue/src/services/suppliersService.ts:10-19`), мок отдаёт порядок сида —
`filtered.slice(start, start + pageSize)` без сортировки
(`frontend_vue/src/services/mocks/suppliers.ts:283-285`), прежний контракт требовал фиксированный
`updatedAt DESC`. Строка владельцу `suppliers · Форма ответа · сортировка`; общий класс — §13
соглашений («контракт обязан назвать умолчание по каждому списку»).

**Осталось (г):** справочный вызов с `pageSize: 999` вместо лёгкого списка. Тот же случай уже
вынесен владельцу по домену `categories`
([`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), строка
`categories · Форма ответа для справочников`); у поставщика он тем острее, что рядом существует
`GET /api/suppliers/list`, и эти два вызывающих его не используют.

Бэкенд: **не реализован** — роутов у модуля нет; таблица `suppliers` есть
(`backend/app/modules/suppliers/shared/models.py:14-78`).
Реализация: `services/suppliersService.ts:20` (`getSuppliers`) · мок `mocks/index.ts:334`
(ветка `/api/suppliers`) → `mocks/suppliers.ts:279` (`mockGetSuppliers`)

---

### GET /api/suppliers/list

Лёгкий справочник для выпадашек: только `id` и название. Ни параметров, ни заголовков
(`frontend_vue/src/services/suppliersService.ts:96-99`).

Ответ — **голый массив, без конверта и без пагинации**:

```ts
Array<{ id: string; company: string }>
```

`company` здесь — **плоская строка, а не `TranslatedString`**: так объявлен клиент
(`frontend_vue/src/services/suppliersService.ts:97-99`), и так отдаёт мок, беря локаль `en`
(`frontend_vue/src/services/mocks/index.ts:325-332`). Это единственное место домена, где название
компании уезжает одной строкой; соседние ответы отдают объект
(`frontend_vue/src/types/supplier.ts:12-31`). Форма закрыта клиентом и моком согласно правилу
старшинства — пробел аудита (в) закрыт; **какую локаль выбирать серверу — кодом не решено** (мок берёт `en`, локали запроса
клиент не сообщает) — **снято 2026-09-10 (П64, §12.1)**: сервер локаль не выбирает вовсе. Он
хранит и возвращает все три ключа, а показывает клиент — текущий язык интерфейса, а если на нём не
сохранено, любой сохранённый.

Ошибки: ни одной. Оба вызывающих гасят отказ в `catch` и подставляют список из одного пункта
«все» (`frontend_vue/src/composables/useWarehouseBatchCreate.ts:302-304`,
`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:530-531`), то есть сбой справочника выглядит
как пустой справочник.

Save-режим: чтение. Вызывающие — фильтр страницы склада
(`frontend_vue/src/views/admin/warehouse/WarehousePage.vue:525`, импорт — `:519`) и выбор поставщика при создании
партии (`frontend_vue/src/composables/useWarehouseBatchCreate.ts:6`,
`frontend_vue/src/composables/useWarehouseBatchCreate.ts:297-301`).

**Осталось (пробел аудита, б):** этот эндпоинт **изготавливает** id другой формы, чем весь
остальной домен: `sup-${String(s.id).padStart(3, '0')}`
(`frontend_vue/src/services/mocks/index.ts:327-330`) превращает `'1'` в `'sup-001'`, а
`GET /api/suppliers/:id` такого id не знает — поиск идёт по
`MOCK_SUPPLIERS.find((s) => s.id === id)` (`frontend_vue/src/services/mocks/suppliers.ts:306`) и
бросает на промахе (`frontend_vue/src/services/mocks/suppliers.ts:307`). У поставщика **два
пространства id**, и во втором живут партии склада
(`frontend_vue/src/mocks/warehouse-batches.ts:6`) и события BCC
(`frontend_vue/src/services/mocks/bcc.ts:146`), тогда как получатели BCC — в первом
(`frontend_vue/src/services/mocks/bcc.ts:239-240`). Какая форма канонична — строка владельцу
`suppliers · Источник истины (форма id)`; находка БАГ-02. Общее правило («id — непрозрачная
строка, её выдаёт сервер») — §19 соглашений.

Пробел аудита (а) закрыт фактом: в прежнем контракте этого эндпоинта не было вовсе, раздел
написан впервые.

Бэкенд: **не реализован**.
Реализация: `services/suppliersService.ts:98` (`getSupplierList`) · мок `mocks/index.ts:325`
(ветка `/api/suppliers/list`, отдаёт `MOCK_SUPPLIERS.map`)

---

### GET /api/suppliers/export.csv

Экспорт списка по фильтрам. Те же фильтры, что у `GET /api/suppliers`, **без** `page`/`pageSize`
(`frontend_vue/src/services/suppliersService.ts:86-93`):

```ts
{ search: string; status: SupplierStatus | 'all'; rating: string; categories?: string }
```

Ответ — **CSV текстом, без конверта**. Мок отдаёт строку с заголовком
`id,company,email,phone,status,rating,leadTime,categories`, категории склеены `;`
(`frontend_vue/src/services/mocks/suppliers.ts:519-535`,
`frontend_vue/src/services/mocks/suppliers.ts:521`); в колонку `company` попадает русская локаль.
Клиент типизирует ответ как `string` (`frontend_vue/src/services/suppliersService.ts:93`).

**Клиент прочитать этот ответ не может.** `apiGet` делает `await res.json()`, при провале
оставляет `body = null` и возвращает его как значение
(`frontend_vue/src/services/api.ts:110-115`, `frontend_vue/src/services/api.ts:140-141`), то есть
против настоящего сервера с `text/csv` функция вернёт `null`, а не CSV. Контракт фиксирует форму на
проводе; починка — на стороне фронта, БАГ-04. Исключение перечислено и в §1 соглашений. Пробел
аудита (а) закрыт: форма на проводе — `text/csv`, неспособность клиента её прочитать — находка про
фронт, а не развилка контракта.

Ошибки: ни одной — `mockExportSuppliersCsv` не бросает
(`frontend_vue/src/services/mocks/suppliers.ts:519-535`).

Save-режим: чтение, разовое действие.

**Клиент написан, UI нет.** `exportSuppliersCsv` не зовёт никто: `grep -rn exportSuppliersCsv
frontend_vue/src` даёт только объявление (`frontend_vue/src/services/suppliersService.ts:86`). А
кнопка «Export» на странице списка (флаг `supplierExport`) собирает CSV **в браузере** из уже
загруженной страницы, другими колонками и без строки заголовка:
`company,status,rating,categories,leadTime,email,phone`
(`frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:205-225`).

**Решено 2026-09-10 (П65 в): настоящая — серверная.** `GET /api/suppliers/export.csv` уже написан
и его никто не зовёт; кнопка страницы собирает CSV в браузере из того, что на экране. Значит объём
выборки — **весь список под фильтрами**, а не текущая страница, и прежний контракт был прав.
Браузерная сборка остаётся мок-режиму. **Осталось (пробелы аудита, б, г):** набор колонок и
обязательность `Content-Disposition` и стриминга — ни того, ни другого в коде нет нигде. Прежняя
строка владельцу
`suppliers · Настройки, которых мок не отслеживает · какой из двух экспортов списка настоящий`.

Бэкенд: **не реализован**.
Реализация: `services/suppliersService.ts:93` (`exportSuppliersCsv`) · мок `mocks/index.ts:315`
(ветка `/api/suppliers/export.csv`) → `mocks/suppliers.ts:519` (`mockExportSuppliersCsv`)

---

### GET /api/suppliers/:id

Карточка поставщика. Только `id` в пути, ни query, ни заголовков
(`frontend_vue/src/services/suppliersService.ts:23-25`).

Ответ — `SupplierCardData`: `Supplier` плюс 13 полей карточки
(`frontend_vue/src/types/supplier.ts:40-54`):

```ts
interface SupplierCardData extends Supplier {
  statusReason: TranslatedString
  contractDate: string
  vatCode: string
  currency: string
  paymentTerms: string
  minOrder: number | null
  bccEmails: string[]
  addresses: SupplierAddress[]
  contacts: SupplierContact[]
  files: SupplierFile[]
  history: SupplierHistoryItem[]
  priceHistory: SupplierPriceEntry[]
  auditLog: SupplierAuditEntry[]
}
```

Все поля **обязательны** — необязателен лишь `line2` внутри адреса
(`frontend_vue/src/types/supplier.ts:83-90`). Мок либо отдаёт кэшированную карточку
(`frontend_vue/src/services/mocks/suppliers.ts:305`), либо строит её из строки списка и кэширует
(`frontend_vue/src/services/mocks/suppliers.ts:308-405`,
`frontend_vue/src/services/mocks/suppliers.ts:407`).

Ошибки: кода нет — мок бросает фразу (`frontend_vue/src/services/mocks/suppliers.ts:307`); сервер
обязан отвечать `404 NOT_FOUND` (см. «Каталог кодов ошибок домена»).

Save-режим: чтение. `onMounted(load)` карточки
(`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue:93` →
`frontend_vue/src/composables/useSupplierCard.ts:19-30`); второй вызывающий — предвыбор получателя
в BCC по `?supplier=<id>` (`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue:531`).

**Осталось (пробел аудита, а):** вырезание полей по правам. Прежний контракт обещал, что поля без
права `read` сервер вырезает или присылает `null`; ни мок, ни фронт прав не читают вовсе
(`grep -c permission frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue` → 0), а тип
обязателен по всем полям — вырезание его сломало бы. Строка владельцу
`suppliers · Права — в какой функции проверяются`; механизм матрицы и то, что сервер её не
применяет, — §6 соглашений.

**Решено 2026-09-08 (П35):** второго журнала не будет, а вместо него у поставщика появляются
**внутренние заметки списком**. Разгадка в названии панели: она называется «Внутренние заметки
и история» (`i18n/admin/suppliers.ts:69`, `:298`, `:527`), то есть половин задумывалось две —
человеческая и машинная. Машинную уже несёт `auditLog`, отрисованный отдельной секцией «Audit
History» (`views/admin/suppliers/SupplierCardPage.vue:275`); `SupplierHistoryItem`
(`types/supplier.ts:107-112`) её дублирует и потому уходит.

Заметка: **свободный текст, у каждой дата и автор, число не ограничено.** То есть поле
`notes: string` (`types/supplier.ts:24`) становится списком записей, и сервер обязан хранить их
записями, а не одной строкой.

Сегодня они лежат в одной строке, склеенные пустой строкой, с датой первой строчкой блока, и
разбираются регуляркой обратно (`components/admin/SupplierFormSections.vue:95-121`:
запись — `:100-102`, чтение — `split(/\n\n+/)` `:108`, удаление — `:117-121`). Отсюда четыре
следствия, каждое проверяемо: **автора нет вовсе** (`addNote` пишет только дату и текст),
заметка с пустой строкой внутри разваливается на две, удаление одной переписывает всё поле
целиком, и ни отфильтровать, ни разбить на страницы нельзя.

Форма берётся у клиента — там та же потребность уже решена записями с автором:
`InteractionHistoryEntry { date, type, summary, user }` (`types/client.ts:5-13`). Держать в
проекте две разные структуры под одно и то же незачем; отличие в том, что у заметки поставщика
`type` не нужен, а текст остаётся свободным.

**Осталось (в):** `priceHistory` — склейка сервером при чтении или неполная схема (правило домена
5, «Схема старше типов» п. 4). Строка владельцу
`suppliers · Производные значения · склеивает ли сервер`.

Бэкенд: **не реализован** — таблицы карточки есть (адреса, контакты, файлы, аудит, цены:
`backend/app/modules/suppliers/shared/models.py:81`,
`backend/app/modules/suppliers/shared/models.py:112`,
`backend/app/modules/suppliers/shared/models.py:140`,
`backend/app/modules/suppliers/shared/models.py:170`,
`backend/app/modules/suppliers/shared/models.py:204`), эндпоинта нет.
Реализация: `services/suppliersService.ts:24` (`getSupplier`) · мок `mocks/index.ts:348`
(ветка `^/api/suppliers/([^/]+)$`) → `mocks/suppliers.ts:305` (`mockGetSupplier`)

> Страховка `&& !path.includes('/status')` в ветке мока
> (`frontend_vue/src/services/mocks/index.ts:349`) недостижима: класс `[^/]` слэш в сегменте уже
> исключил. Порядок разбора веток мока — часть контракта (§18 соглашений), и у сервера с одним
> маршрутом `/{id}` он обратный по построению: `/api/suppliers/list` и
> `/api/suppliers/export.csv` обязаны быть объявлены **до** `/{supplier_id}`, иначе попадут в него
> и вернут отказ о разборе UUID.

---

### POST /api/suppliers

Создание поставщика. Clean-slate: вся заполненная форма одним запросом, черновиков нет
(`frontend_vue/src/composables/useSupplierCreate.ts:59-76`).

Запрос объявлен как `Partial<SupplierCardData>`
(`frontend_vue/src/services/suppliersService.ts:58-62`), но фактически уходит **вся форма
целиком** — композабл передаёт весь объект состояния
(`frontend_vue/src/composables/useSupplierCreate.ts:68`), а стартовое состояние собирает фабрика
`emptyCard`, дающая полный `SupplierCardData`
(`frontend_vue/src/composables/useSupplierCreate.ts:9-42`,
`frontend_vue/src/composables/useSupplierCreate.ts:49`). Значит на проводе присутствуют и пустые
`id`, `createdAt`, `updatedAt`, и пустые `auditLog: []`, `history: []`, `priceHistory: []`.
**Сервер обязан их игнорировать**, а не пытаться применить: `id` и метки времени принадлежат ему
(§14 соглашений, `backend/app/core/base.py:25-37`), журналы — тоже.

Три переводимых поля клиент нормализует, и не одинаково: `company` и `contactPerson` при
отсутствии превращаются в пустой `TranslatedString`, `statusReason` — в `undefined`
(`frontend_vue/src/services/suppliersService.ts:62-79`).

Ответ — `SupplierCardData` целиком с присвоенным `id`
(`frontend_vue/src/services/mocks/suppliers.ts:464-517`); клиент по нему редиректит на карточку
(`frontend_vue/src/composables/useSupplierCreate.ts:68-69`). Возврат — JSON-roundtrip, а не
`structuredClone`, потому что приходит реактивный Proxy
(`frontend_vue/src/services/mocks/suppliers.ts:513-516`); для сервера это свойство мока, не
правило.

Ошибки: серверных нет — `mockCreateSupplier` не бросает
(`frontend_vue/src/services/mocks/suppliers.ts:464-517`). Валидация целиком клиентская и
возвращает не коды, а ключи `company_required` / `email_required`
(`frontend_vue/src/composables/useSupplierCreate.ts:53-57`). Сервер обязан отвечать
`422 VALIDATION_ERROR` (`backend/app/core/exceptions.py:23-27`) при отсутствии `company` или
`email`, и — чтобы форма подсветила поле — присылать код, а не только текст (§1, §2 соглашений).

**Осталось (пробел аудита, а):** форма id. Мок продолжает числовой ряд — `max(number) + 1`
(`frontend_vue/src/services/mocks/suppliers.ts:465`), справочник изготавливает `sup-NNN`, схема
даёт UUID (`UUIDMixin`, `backend/app/modules/suppliers/shared/models.py:14`). Три формы одного
идентификатора; строка владельцу `suppliers · Источник истины (форма id)`, БАГ-02.

**Осталось (б):** чьи дефолты главные. Бэкенд владеет четырьмя
(`status='new'`, `rating=0`, `lead_time=0`, `currency='EUR'` —
`backend/app/modules/suppliers/shared/models.py:29-31`,
`backend/app/modules/suppliers/shared/models.py:35-37`,
`backend/app/modules/suppliers/shared/models.py:44-46`,
`backend/app/modules/suppliers/shared/models.py:50-52`), у `payment_terms` дефолта нет вовсе
(`backend/app/modules/suppliers/shared/models.py:53`). Во фронте те же значения расставлены заново
и в двух местах: мок (`frontend_vue/src/services/mocks/suppliers.ts:483`,
`frontend_vue/src/services/mocks/suppliers.ts:494-495`) и фабрика формы
(`frontend_vue/src/composables/useSupplierCreate.ts:31-32`), причём валюту фабрика берёт из
настроек, а мок зашивает `'EUR'`. Строки владельцу
`suppliers · Значения по умолчанию и их владелец` (четыре строки).

**Осталось (в):** файлы — `fileIds: string[]` или `files: SupplierFile[]` (см. `PATCH
/api/suppliers/:id`).

**Осталось (г):** право `create` на корневую секцию — прежний контракт его требовал, проверки нет
ни во фронте, ни в моке, ни на сервере. Строка владельцу
`suppliers · Права — в какой функции проверяются`.

Идемпотентность: `Idempotency-Key` клиент не шлёт
(`grep -c Idempotency frontend_vue/src/services/suppliersService.ts` → 0), при том что генератор
ключа в проекте есть (`frontend_vue/src/services/api.ts:239-245`). Нужен ли он созданию — строка
владельцу; правило «необратимый POST требует ключ» — §11 соглашений.

Бэкенд: **не реализован**.
Реализация: `services/suppliersService.ts:62` (`createSupplier`) · мок `mocks/index.ts:939`
(ветка `/api/suppliers`) → `mocks/suppliers.ts:464` (`mockCreateSupplier`)

---

### PATCH /api/suppliers/:id

Правка карточки. Save-режим: **clean-slate** — уходит по кнопке Save и только при `isDirty`, пустая
дельта запроса не отправляет (`frontend_vue/src/composables/useSupplierCard.ts:32-47`,
`frontend_vue/src/composables/useSupplierCard.ts:39`). Один Save — ровно один PATCH
(`frontend_vue/src/composables/useSupplierCard.ts:40`); поставщик один из трёх доменов, где это так
(§15 соглашений).

Запрос — merge-patch, **только грязные поля**: `Partial<SupplierCardData>`, посчитанный
`useDirtyCheck.diff()` (`frontend_vue/src/composables/useSupplierCard.ts:37-40`). Вложенное уходит
целиком (правило домена 3), три переводимых поля нормализуются в `TranslatedString` текущей локали
(`frontend_vue/src/services/suppliersService.ts:33-49`).

Ответ — `SupplierCardData` целиком после слияния
(`frontend_vue/src/services/mocks/suppliers.ts:411-449`). Мок сливает три переводимых поля через
`mergeTranslatedString` (`frontend_vue/src/services/mocks/suppliers.ts:417-423`) и переписывает
**16** общих полей в строке списка (`frontend_vue/src/services/mocks/suppliers.ts:429-447`;
замер — `sed -n '431,446p' … | grep -c "listItem."` → `16`) — правило домена 6.

**Шестнадцать против восемнадцати, и разница не в одном `id`.** Мок не переписывает `currency`
(`sed -n '429,447p' … | grep -c "listItem.currency"` → `0`), то есть смена валюты поставщика
меняет карточку и **не** меняет строку списка: до перезагрузки список и карточка показывают
разную валюту. Это нарушение правила домена 6 в его же реализации — **БАГ-07**. Сервер обязан
отдавать список и карточку из одного состояния: у него это одна строка таблицы, и расхождение
возможно только если список собирается отдельной проекцией — тогда `currency` обязан быть в
ней.

`updatedAt` **пересчитывает сервер, и только он**: `onupdate=func.now()`
(`backend/app/core/base.py:25-37`), §14 соглашений. Мок его не трогает, а лишь копирует прежнее
значение в строку списка (`frontend_vue/src/services/mocks/suppliers.ts:446`) — слабость мока, а не
правило (пробел аудита б закрыт).

Формат `notes` — **свободная строка** (`frontend_vue/src/types/supplier.ts:24`). Прежний контракт
описывал склейку блоков с клиентским timestamp `dd.mm.yyyy hh:mm`; генератора таких блоков в коде
нет (`grep -rn "dd.mm.yyyy" frontend_vue/src` — пусто), см. «Чего в домене нет» (пробел аудита д
закрыт).

Версий нет: ни `If-Match`, ни `version` клиент не шлёт
(`grep -c "If-Match\|version" frontend_vue/src/services/suppliersService.ts` → 0), поведение —
last-write-wins, как в остальных шестнадцати доменах (§11 соглашений). **Осталось (пробел
аудита е):** нужен ли карточке `If-Match` — строка владельцу
`suppliers · Транзакционность и идемпотентность`.

Ошибки: своих нет. `mockPatchSupplier` начинается с `mockGetSupplier`
(`frontend_vue/src/services/mocks/suppliers.ts:412`), поэтому на несуществующем id прилетает та же
фраза без кода; композабл кладёт сообщение в `error`
(`frontend_vue/src/composables/useSupplierCard.ts:42-44`), карточка показывает общий тост
(`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue:88-90`).

**Осталось (пробел аудита а):** пишет ли сервер записи аудита по diff. Прежний контракт этого
требовал; в коде нет ни одной записи —
`grep -c "auditLog.push" frontend_vue/src/services/mocks/suppliers.ts` → 0, а таблица на бэкенде
готова (`backend/app/modules/suppliers/shared/models.py:170-201`). Строки владельцу
`suppliers · Запись в аудит-лог`.

**Осталось (в):** как карточка передаёт файлы. Прежний контракт требовал `fileIds: string[]` —
«полный актуальный массив»; клиент шлёт `files: SupplierFile[]` объектами: карточка кладёт в массив
весь метаобъект после аплоада
(`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue:41-52`) и вырезает по id при удалении
(`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue:54-57`), и именно этот массив попадает
в дельту; `fileIds` в домене не встречается ни разу. Схема при этом хранит ссылку `file_id`
(`backend/app/modules/suppliers/shared/models.py:157-165`), то есть клиент и схема расходятся, и
схема старше. Строка владельцу `suppliers · Форма запроса · как карточка передаёт файлы`. Общее
правило двух фаз (загрузка и привязка) — §16 соглашений.

**Решено 2026-09-08 (П39):** формат — **готовая строка**: собирает её сервер, клиент печатает.
Собирается **при чтении**, в локаль запросившего, а хранится исходное значение — иначе одна
колонка `Text` обслуживала бы одну локаль. То есть прав оказался мок, а не прежний контракт.
Прежнее расхождение: контракт требовал JSON-строки с ключами изменённых полей; мок хранит
человекочитаемые куски —
`'Prepayment'` → `'30 Days Net'` (`frontend_vue/src/services/mocks/suppliers.ts:242-243`),
`'1000 EUR'` → `'2500 EUR'` (`frontend_vue/src/services/mocks/suppliers.ts:251-252`), то есть
противоположное; на схеме это `Text` без формата
(`backend/app/modules/suppliers/shared/models.py:195-196`). Ни один тест формат не защищает. Строка
владельцу `suppliers · Запись в аудит-лог · в каком формате сервер пишет`.

Транзакционность: PATCH, меняющий поле, обязан одной транзакцией дописать запись аудита — иначе
журнал разойдётся с данными. Правила на этот счёт в коде нет нигде (многозапросных операций у
домена тоже нет: Save — ровно один PATCH); строка владельцу
`suppliers · Транзакционность и идемпотентность`.

Бэкенд: **не реализован**.
Реализация: `services/suppliersService.ts:33` (`patchSupplier`) · мок `mocks/index.ts:1193`
(ветка `^/api/suppliers/([^/]+)$`) → `mocks/suppliers.ts:411` (`mockPatchSupplier`)

---

### PATCH /api/suppliers/:id/status

Быстрая смена статуса перетаскиванием в канбане. Save-режим: **quick-action** — уходит сразу после
подтверждения переноса (`frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:193-197` →
`frontend_vue/src/composables/useSuppliers.ts:48-54`). Локальное состояние меняется **до** запроса,
потому что мок мутирует тот же объект и Vue иначе не перерисует
(`frontend_vue/src/composables/useSuppliers.ts:49-52`) — свойство мок-режима, серверу знать не
нужно.

Запрос — единственное поле (`frontend_vue/src/services/suppliersService.ts:54-56`):

```ts
{ status: SupplierStatus }
```

Значение — один из шести статусов (правило домена 1); мок читает ровно его
(`frontend_vue/src/services/mocks/index.ts:1186-1191`).

Ответ: **`void`**. Клиент объявлен `Promise<void>` и ответ выбрасывает
(`frontend_vue/src/services/suppliersService.ts:54-56`), мок возвращает `undefined`
(`frontend_vue/src/services/mocks/index.ts:1190`). Прежний контракт обещал здесь обновлённый
`Supplier` — не подтверждено кодом, см. «Чего в домене нет».

Правило переходов — **из прежнего контракта, кодом не выражено**: разрешены любые переходы
(any → any), бизнес-правил сервер не накладывает, операция идемпотентна (повторное `active → active`
— no-op). В коде от него есть только отказ от no-op-переноса на ту же колонку
(`frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:183`); ограничения статусов у схемы
тоже нет (правило домена 1). Правило сохранено как замысел — третий источник старшинства, — а не
как наблюдение по коду; этим пробел аудита (а) закрыт: правило есть, но у него нет ни одного
доказательства в коде, и контракт говорит об этом прямо.

Ошибки: ни одной. На неизвестном id мок молча ничего не делает
(`frontend_vue/src/services/mocks/suppliers.ts:451-454`) — сервер обязан отвечать `404 NOT_FOUND`
(см. «Каталог кодов ошибок домена»).

Список и карточка обязаны меняться вместе: мок правит только строку списка, из-за чего карточка
после канбана показывает прежний статус — БАГ-03, правило домена 6 (пробел аудита в закрыт).

**Осталось (пробел аудита б):** пишет ли смена статуса запись в `auditLog` — прежний контракт
требовал записи на каждое изменение, мок не пишет ни одной. Та же строка владельцу, что у
`PATCH /api/suppliers/:id`.

**Осталось (г):** связывает ли сервер `statusReason` со сменой статуса. Формой карточки причина
правится (`frontend_vue/src/components/admin/SupplierFormSections.vue:40-43`), быстрым переходом —
нет: в теле его нет (`frontend_vue/src/services/suppliersService.ts:54-56`), и правила об этом нет
нигде.

Бэкенд: **не реализован**.
Реализация: `services/suppliersService.ts:55` (`patchSupplierStatus`) · мок `mocks/index.ts:1186`
(ветка `^/api/suppliers/([^/]+)/status$`) → `mocks/suppliers.ts:451`
(`mockUpdateSupplierStatus`)

---

### DELETE /api/suppliers/:supplierId/audit/:entryId

Удаление одной записи журнала аудита из карточки. Save-режим: **quick-action**, и это сказано прямо
в коде — «server-side delete applies immediately (no batched Save)»
(`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue:72-73`).

Запрос: тела нет — `apiDelete<void>` без body
(`frontend_vue/src/services/suppliersService.ts:82-84`). Заголовков клиент не шлёт; `deleteMockRoute`
читает `If-Match` для других доменов (`frontend_vue/src/services/mocks/index.ts:1428`), но эта
ветка значение игнорирует (`frontend_vue/src/services/mocks/index.ts:1429-1433`) — то есть
удаление записи аудита от проверки версии освобождено, как и в общей ленте (§11 соглашений).

Ответ: `void` (`frontend_vue/src/services/mocks/index.ts:1432`). UI ответ не читает, а вычёркивает
запись у себя (`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue:74`).

Ошибки — единственные два кода домена: `SUPPLIER_NOT_FOUND` и `AUDIT_ENTRY_NOT_FOUND`
(`frontend_vue/src/services/mocks/suppliers.ts:456-462`). Молчание вместо отказа недопустимо:
клиент сотрёт у себя строку, которая на сервере осталась (§9 соглашений).

**Удаление идёт напрямую, без мета-записи «X удалил Y».** Это подтверждено кодом: функция удаления
только вырезает элемент (`frontend_vue/src/services/mocks/suppliers.ts:456-462`), а записей в
журнал домен не добавляет вовсе — `grep -c "auditLog.push"
frontend_vue/src/services/mocks/suppliers.ts` → 0. Пробел аудита (второй) закрыт.

**Осталось (первый пробел аудита):** какая гарантия уникальности требуется от `entryId`. Мок выдаёт
всем построенным на лету карточкам одни и те же `sup-au-1`/`sup-au-2`
(`frontend_vue/src/services/mocks/suppliers.ts:387`,
`frontend_vue/src/services/mocks/suppliers.ts:396`), и те же два id стоят в засеянной карточке
(`frontend_vue/src/services/mocks/suppliers.ts:237`,
`frontend_vue/src/services/mocks/suppliers.ts:246`); прежний контракт называл `entryId` UUID,
генерируемым сервером, то есть глобально уникальным. Лента аудита сегодня не страдает, потому что
удаляет парой (`entityId`, `entryId`) (`frontend_vue/src/services/auditFeedService.ts:57-61`), но
от выбора зависит, можно ли адресовать запись одним id. Строка владельцу
`suppliers · Запись в аудит-лог · уникален ли`; общее правило («`entryId` уникален внутри
своего лога») — §19 соглашений.

Право `delete` на аудит прежний контракт требовал; проверки нет нигде — см. «Обязанности сервера»,
графа «Права».

Бэкенд: **не реализован** — таблица `supplier_audit_entries` есть
(`backend/app/modules/suppliers/shared/models.py:170-201`), эндпоинта нет.
Реализация: `services/suppliersService.ts:83` (`deleteAuditEntry`) · мок `mocks/index.ts:1429`
(ветка `^/api/suppliers/([^/]+)/audit/([^/]+)$`) → `mocks/suppliers.ts:456`
(`mockDeleteAuditEntry`)

---

## Обязанности сервера

То, чего во фронтенде не видно и что в мок-режиме не проявляется никак. Девять граф аудита; строки,
у которых ответа нет нигде, помечены **осталось** и лежат в
[`00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел `suppliers`.

**1. Значения по умолчанию и их владелец.** Бэкенд владеет четырьмя: `status='new'`, `rating=0`,
`lead_time=0`, `currency='EUR'` (`backend/app/modules/suppliers/shared/models.py:29-31`,
`backend/app/modules/suppliers/shared/models.py:35-37`,
`backend/app/modules/suppliers/shared/models.py:44-46`,
`backend/app/modules/suppliers/shared/models.py:50-52`); у `payment_terms` дефолта нет
(`backend/app/modules/suppliers/shared/models.py:53`). Во фронте те же значения расставлены заново
и дважды — мок (`frontend_vue/src/services/mocks/suppliers.ts:483`,
`frontend_vue/src/services/mocks/suppliers.ts:494-495`) и фабрика формы создания
(`frontend_vue/src/composables/useSupplierCreate.ts:31-32`), — и два из них расходятся:
`paymentTerms: '30 Days Net'` есть у обеих сторон фронта и отсутствует на сервере, а валюту фабрика
берёт из настроек арендатора, мок зашивает литералом. Плюс три справочника формы константами в
компоненте (правило домена 8). **Осталось:** кому принадлежит каждый из трёх справочников и чей
дефолт условий оплаты главный — четыре строки владельцу
`suppliers · Значения по умолчанию и их владелец`; БАГ-01 и БАГ-05. Общее правило («справочник
принадлежит серверу, во фронте его копии быть не должно») — §14 соглашений.

**2. События и уведомления.** Домен не рождает ни одного:
`grep -c notify frontend_vue/src/services/mocks/suppliers.ts` → 0. Единственное уведомление **про**
поставщика рождает чужой домен — `notifySupplierResponse` зовётся из мока BCC, когда поставщик
ответил на запрос (`frontend_vue/src/services/mocks/bcc.ts:368` →
`frontend_vue/src/services/mocks/notifications.ts:657-670`), и это один из семи триггеров проекта
(§10 соглашений). Ссылка этого уведомления ведёт во второе пространство id
(`frontend_vue/src/services/mocks/notifications.ts:667-669`) — БАГ-02. **Решено 2026-09-09 (П51):
блокировка поставщика становится новым типом уведомления** — «нельзя больше заказывать», адресат
закупки; создание поставщика и обычная смена статуса уведомлений не рождают. Кому адресовано и
почему повтор не рождает второго — снято §10: адресация настраивается подписками (П54), а правило
«событие есть переход» доказано спекой. См. [§10.1](00-conventions.md).

**3. Запись в аудит-лог.** Сервер обязан писать сам, и в коде этого нет ни в одном месте:
`grep -c "auditLog.push" frontend_vue/src/services/mocks/suppliers.ts` → 0. Записи существуют
только как сид — две в засеянной карточке
(`frontend_vue/src/services/mocks/suppliers.ts:235-254`) и две синтезированные при построении
карточки на лету (`frontend_vue/src/services/mocks/suppliers.ts:385-404`), причём с одинаковыми id
у всех поставщиков. Таблица на бэкенде готова и знает автора: `user_id` с `ondelete="SET NULL"`,
замороженные переводы имени, инициалы, переводимое имя свойства, `old_value`, `new_value`,
`timestamp` (`backend/app/modules/suppliers/shared/models.py:170-201`) — то есть автор хранится как
снимок, а не только ссылкой (§9 соглашений). Формат записи — `StockAuditEntry`
(`frontend_vue/src/types/warehouse.ts:526-534`). Признака `sensitive` нет ни у типа, ни у схемы
(`grep -rn sensitive backend/app/modules/suppliers frontend_vue/src/types/supplier.ts` — пусто).
**Решено 2026-09-08.** Формат `oldValue`/`newValue` — готовая строка, собираемая сервером при
чтении (П39). Уникальность `entryId` — **глобальная**: журнал стал одной таблицей `audit_entries`
с ключом UUIDv7 (П38). Второй журнал `history` не заводится — машинную половину панели
«Внутренние заметки и история» несёт `auditLog`, а человеческая становится списком заметок с
датой и автором (П35).

**4. Кастомные поля.** Определения полей и разделов карточки поставщика физически объявлены
**внутри модуля suppliers** — `FieldDefinition`, `SectionConfig`, `SectionField`
(`backend/app/modules/suppliers/shared/models.py:240-326`), а таблицы создаёт миграция чужой фазы
(`backend/alembic/versions/e24a3922ed01_phase_7_config.py:28,44,57`). Фронт ходит за ними в домен
`config` (`frontend_vue/src/services/configService.ts:7`,
`frontend_vue/src/services/configService.ts:46`,
`frontend_vue/src/services/configService.ts:76`) и правит отдельной страницей
(`frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue:10` →
`frontend_vue/src/composables/useCardConfig.ts`), а сама карточка этой конфигурации **не читает
вовсе**: `grep -rn "configService\|useCardConfig"
frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue
frontend_vue/src/components/admin/SupplierFormSections.vue` — пусто, форма нарисована жёстко.
Значений кастомных полей у поставщика нет ни во фронте
(`grep -c fieldValues frontend_vue/src/types/supplier.ts` → 0), ни в схеме (колонки в `suppliers`
нет — `backend/app/modules/suppliers/shared/models.py:14-78`), при том что в библиотеке уже лежит
поле, которого нет в типе, — `f-certified`
(`frontend_vue/src/services/mocks/config.ts:106-108`). **Осталось:** куда сервер кладёт значение
кастомного поля поставщика и рисуется ли карточка по конфигурации — две строки владельцу
`suppliers · Кастомные поля`; сквозной случай (две библиотеки определений, жизненного цикла нет
нигде) — §8 соглашений.

**5. Настройки, которых мок не отслеживает.** Три справочника формы (валюты, условия оплаты,
категории) — правило домена 8. Категории поставщика при этом **свободные строки**, а не id домена
`categories` (`frontend_vue/src/types/supplier.ts:19`), и связь категорий с поставщиками включается
фича-флагом `categorySupplierLinks` (`frontend_vue/src/config/featureFlags.ts:37`). Справочника
условий оплаты нет ни в `AppSettings`
(`grep -rn "paymentTerms\|payment_terms" frontend_vue/src/types/settings.ts` — пусто), ни на
бэкенде (`grep -rn payment_terms backend/app/modules/settings` — пусто). Типы адреса справочником
тоже не являются: `'Legal'` подставляется двумя местами фронта
(`frontend_vue/src/services/mocks/suppliers.ts:319`,
`frontend_vue/src/composables/useSupplierCreate.ts:35`), а три разрешённых значения существуют
только комментарием схемы (`backend/app/modules/suppliers/shared/models.py:98-100`).
**Решено 2026-09-07 (П26).** Типы адреса и категории поставщика остаются **в коде**, одним
источником вместо копий, и сервер их валидирует; список типов адреса замкнутый — три значения,
существующие сегодня только комментарием схемы, становятся проверкой. **Условия оплаты
поставщика — исключение: уезжают в настройки** (владелец сказал «возможно стоит», читаю как
«заносим», потому что тем же движением в настройки уходит отсрочка платежа клиента, П32).
**Решено 2026-09-10 (П65 в):** настоящая — **серверная**. Выгружается весь список, а не видимая
страница; браузерная сборка остаётся мок-режиму. Прежняя строка владельцу
`suppliers · Значения по умолчанию и их владелец` и `suppliers · Настройки, которых мок не
отслеживает`.

**6. Мультиарендность.** Владеет ею целиком бэкенд: `tenant_id` стоит на всех шести таблицах домена
и на трёх таблицах конфигурации карточки — `grep -c tenant_id
backend/app/modules/suppliers/shared/models.py` → 10, все с
`ForeignKey("tenants.id", ondelete="CASCADE")`, `nullable=False`, `index=True` (например
`backend/app/modules/suppliers/shared/models.py:19-24`,
`backend/app/modules/suppliers/shared/models.py:209-214`). Фронт про арендатора не знает ничего:
`grep -rn tenant frontend_vue/src/services/suppliersService.ts
frontend_vue/src/types/supplier.ts` — пусто, заголовка арендатора клиент не шлёт. Значит выборка
обязана ограничиваться сервером по сессии, и ни один параметр запроса домена этого не выражает.
Как сервер узнаёт арендатора и почему уникальность считается парой с ним — §4 соглашений. Отдельно:
`suppliersService` не ставит **никаких** заголовков, включая `Authorization` (§5 соглашений), — это
находка класса, записанного в баг-файлах всех таких доменов.

**7. Права.** Не проверяются нигде — ни во фронте, ни на сервере. Матрица прав существует и
заведена **именно под карточку поставщика**: её пункты — разделы и поля этой карточки
(`frontend_vue/src/services/mocks/config.ts:13-108`), тип — `PermissionMatrix` с четырьмя
действиями (`frontend_vue/src/types/config.ts:35-57`), чтение и запись — домен `config`
(`frontend_vue/src/services/configService.ts:76`,
`frontend_vue/src/services/configService.ts:81`). Но применяет её только страница настройки самой
карточки: `grep -c permission frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue` → 0, то
же у `SupplierFormSections.vue` и у обоих композаблов домена. Прежний контракт ссылался на права
четырежды — вырезание нечитаемых полей в ответе, игнор недоступных на `edit` полей в PATCH, право
`create` на секцию, право `delete` на аудит; ни одно не реализовано. Функция, которая пишет, и
функция, которая проверяет, не существуют обе. **Решено 2026-09-07:** права на создание, правку и чтение поля — обычные элементы CRUD-матрицы,
назначаемые по надобности роли (П2, П7); **удаление записи аудита — только владелец** (П8). Отказ —
`403` (П4). Матрица хранится на бэкенде, отдельно на арендатора, и правят её владелец и админ
(П12), поэтому четыре обещания прежнего контракта — вырезание нечитаемых полей в ответе, игнор
недоступных на `edit` полей в PATCH, право `create` на секцию, право `delete` на аудит — из
неподтверждённых становятся работой. Почему это сквозная обязанность, где стоит заглушка
`check_permission` и какой код несёт работающий отказ — [§6](00-conventions.md) соглашений.

**8. Транзакционность и идемпотентность.** Многозапросных операций у домена нет: Save карточки —
ровно один PATCH (`frontend_vue/src/composables/useSupplierCard.ts:40`), создание — ровно один POST
(`frontend_vue/src/composables/useSupplierCreate.ts:68`). `Idempotency-Key` домен не шлёт ни разу
(`grep -c Idempotency frontend_vue/src/services/suppliersService.ts` → 0), оптимистичной блокировки
тоже нет (`grep -c "If-Match\|version" frontend_vue/src/services/suppliersService.ts` → 0). Но два
действия обязаны быть атомарными на сервере, и об этом не сказано нигде: PATCH обязан одной
транзакцией записать изменение и запись аудита, `PATCH /status` — то же самое. **Снято
2026-09-09:** ни ключ, ни версия не нужны, и оба ответа дают прежние правила §11 — создание
поставщика обратимо, а версия спрашивается только в заказах, в остальных шестнадцати доменах
поведение last-write-wins.

**9. Производные значения.** Честно производное у домена одно — `totalPages`, который мок считает
при чтении (`frontend_vue/src/services/mocks/suppliers.ts:291`). Два других объявлены полями и **не
пишутся никем**: `hasDeficit` (`frontend_vue/src/types/supplier.ts:27`) читается списком и
канбан-карточкой (`frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:469`,
`frontend_vue/src/components/admin/KanbanCard.vue:11`), но не пересчитывается нигде —
`grep -c hasDeficit frontend_vue/src/services/mocks/warehouse.ts` → 0 при живом складском домене
дефицита; `lastBccDate` (`frontend_vue/src/types/supplier.ts:26`) показывается в списке
(`frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:490`) и участвует в построении
карточки (`frontend_vue/src/services/mocks/suppliers.ts:372`), но отправка BCC его не обновляет —
`grep -c lastBccDate frontend_vue/src/services/mocks/bcc.ts` → 0. На бэкенде оба — **хранимые
колонки** (`backend/app/modules/suppliers/shared/models.py:58-61`). `rating` тоже хранится
(`backend/app/modules/suppliers/shared/models.py:35-37`), правится руками из формы и ниоткуда не
выводится — это состояние, а не производное. **Осталось:** считает ли сервер `hasDeficit` и
`lastBccDate` при чтении или хранит и обновляет событием, и склеивает ли `priceHistory` — три
строки владельцу `suppliers · Производные значения`; общее правило («сервер считает, а не хранит»)
и перечень таких расхождений — §17 соглашений.

## Клиент написан, UI нет

| эндпоинт | клиент | почему числится здесь |
|---|---|---|
| `GET /api/suppliers/export.csv` | `frontend_vue/src/services/suppliersService.ts:86-93` | вызывающего нет ни одного; кнопка «Export» собирает CSV в браузере другими колонками (`frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:205-225`) |

## Чего в домене нет

Ничего не вычеркнуто молча: каждое снятое утверждение прежнего `03-api-contract.md` (строки
355–535, раздел `# Admin — Suppliers`) названо здесь вместе с тем, чем оно опровергнуто. Строки,
которые не сняты, а ждут владельца, стоят выше под пометкой **осталось** — их здесь нет.

| было в прежнем тексте | чем доказано отсутствие |
|---|---|
| `POST /api/suppliers/:id/files` и `DELETE /api/suppliers/:id/files/:fileId` — прежний текст сам объявлял их отсутствующими | подтверждено: путей с сегментом `files` или `notes` у домена нет — `grep -rn "api/suppliers" frontend_vue/src --include=*.ts --include=*.vue` даёт только восемь путей инвентаря, файловых среди них нет |
| отдельные эндпоинты `/notes` | там же: ни вызова, ни ветки мока; заметки уезжают полем `notes` в общем PATCH (`frontend_vue/src/types/supplier.ts:24`) |
| формат поля `notes` — блоки, разделённые `\n\n`, каждый с клиентским timestamp `dd.mm.yyyy hh:mm` | генератора таких блоков нет: `grep -rn "dd.mm.yyyy" frontend_vue/src` — пусто; в коде это свободная строка (`frontend_vue/src/types/supplier.ts:24`) |
| `search` ищет ещё и по `contactPerson` | мок ищет по трём локалям названия компании и email, и только (`frontend_vue/src/services/mocks/suppliers.ts:262-266`) |
| `PATCH /api/suppliers/:id/status` отвечает обновлённым `Supplier`, «клиент сверяется с server-state» | клиент объявлен `Promise<void>` и ответ выбрасывает (`frontend_vue/src/services/suppliersService.ts:54-56`), мок возвращает `undefined` (`frontend_vue/src/services/mocks/index.ts:1190`); сверки с ответом нет ни строки |
| опциональный `?sort=` как «будущее расширение» списка | параметра нет ни у клиента (`frontend_vue/src/services/suppliersService.ts:10-19`), ни в разборе мока (`frontend_vue/src/services/mocks/index.ts:334-346`) |
| пример ответа с `"id": "s-1"` — форма id `s-N` | такой формы нет нигде: мок даёт `'1'`…`'6'` и `max(number)+1` (`frontend_vue/src/services/mocks/suppliers.ts:465`), справочник — `sup-NNN` (`frontend_vue/src/services/mocks/index.ts:327-330`), схема — UUID (`backend/app/modules/suppliers/shared/models.py:14`). Какая из трёх канонична — **осталось** |
| «Колонки: все основные поля `Supplier` + флаги» у экспорта | в коде два конкретных и **разных** набора колонок (`frontend_vue/src/services/mocks/suppliers.ts:521` и `frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:205-225`); «все поля + флаги» не соответствует ни одному |
