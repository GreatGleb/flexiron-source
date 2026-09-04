# Аудит контракта — settings

Эндпоинтов в коде: **31**. Реализовано бэкендом: **24** (DELETE /api/settings/conversions/:id, DELETE /api/settings/currencies/:id, DELETE /api/settings/order-statuses/:id, DELETE /api/settings/uoms/:id, GET /api/settings/company, GET /api/settings/constants, GET /api/settings/conversions, GET /api/settings/currencies, GET /api/settings/order-statuses, GET /api/settings/profile, GET /api/settings/uoms, PATCH /api/settings/company, PATCH /api/settings/constants, PATCH /api/settings/conversions/:id, PATCH /api/settings/currencies/:id, PATCH /api/settings/order-statuses/:id, PATCH /api/settings/profile, PATCH /api/settings/uoms/:id, POST /api/settings/change-password, POST /api/settings/conversions, POST /api/settings/currencies, POST /api/settings/order-statuses, POST /api/settings/uoms, PUT /api/settings/order-statuses/reorder).

Источник истины по эндпоинту: бэкенд → мок+клиент → замысел. Пустая графа = задача не закрыта.
Утверждение без `файл:строка` не записывается. Код не правится: место, где он выглядит
неверным, — находка в `roo_code/plans/bugs/contract-sync-settings-bugs.md`.

> **Что общего у всех 31 раздела — чтобы не повторять это 31 раз.**
>
> **Конверт.** Бэкенд оборачивает всё в `ApiResponse` — `{success, data, message, code}`,
> `backend/app/core/schemas.py:29-35`; клиент снимает конверт в `unwrap()`,
> `frontend_vue/src/services/api.ts:128-137`, и отдаёт наружу `json.data` (`:137`). Мок конверта
> не строит вовсе — возвращает голое значение через `delay(...)` (например `mocks/index.ts:381`),
> потому что `getMock`/`postMock` вызываются вместо `fetch`, минуя `unwrap` (`api.ts:149-151`).
>
> **Заголовки.** Все 31 вызова идут с `Authorization: Bearer <token>` из `authHeaders()` —
> `frontend_vue/src/services/settingsService.ts:18-22`. Токен читается **только из
> `localStorage`** (`:19`), тогда как сам логин кладёт его в `localStorage` **или** в
> `sessionStorage` (`frontend_vue/src/composables/useAuth.ts:36`, чтение из обоих — `:40`) →
> находка 1. `Idempotency-Key` не шлётся ни на одном эндпоинте домена: в
> `settingsService.ts` нет ни импорта `newIdempotencyKey`, ни строки `Idempotency-Key`
> (`grep -c "Idempotency" frontend_vue/src/services/settingsService.ts` → 0).
>
> **Аутентификация на сервере.** Проверка токена продублирована в двух файлах модуля:
> `backend/app/modules/settings/features/crud/action.py:97-128` и
> `backend/app/modules/settings/features/profile/action.py:41-72` — посимвольно одна и та же
> функция `_resolve_user_id`. Ни одна из двух копий не передаёт `max_age`, тогда как
> `auth`-модуль на том же токене требует `max_age=86400`
> (`backend/app/modules/auth/features/me/action.py:52`) → находка 2. Арендатор выводится из
> пользователя в `_get_tenant` (`crud/action.py:131-139`), который на отсутствие арендатора
> отдаёт 404 `NOT_FOUND` (`:135-138`).
>
> **Восемь роутов из 24 не требуют токена вовсе** — PATCH и DELETE у всех четырёх коллекций:
> `crud/action.py:252`, `:266`, `:320`, `:334`, `:399`, `:413`, `:468`, `:482` — ни у одной из
> восьми сигнатур нет `Depends(_resolve_user_id)`, и глобального auth-мидлвара нет
> (`backend/app/main.py:8` подключает только CORS) → находка 3.
>
> **Конверт не умеет списки.** Поле объявлено `data: dict | None`
> (`backend/app/core/schemas.py:33`), а четыре списочных GET домена кладут в него **список**:
> `crud/action.py:222`, `:301`, `:369`, `:437` — `data=[r.model_dump(...) for r in result]`. Больше
> ни один модуль так не делает (`grep -rn "data=\[" backend/app --include=*.py` даёт четыре
> попадания, и все четыре — здесь) → находка 21.
>
> **Коды ошибок ядра.** `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `FORBIDDEN`, `UNAUTHORIZED`
> объявлены в `backend/app/core/exceptions.py:20,27,34,41,48`; `UNAUTHORIZED` домен бросает
> напрямую из `_resolve_user_id` (`crud/action.py:108,115,127`).

## Эндпоинты

### DELETE /api/settings/conversions/:id
- Вызывающий: `src/services/settingsService.ts:101`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:413`
- Мок: `mocks/index.ts:1642`
- Форма запроса: тела нет — `apiDelete(\`/api/settings/conversions/${id}\`, { headers: authHeaders() })`, `src/services/settingsService.ts:101`. Бэкенд принимает `conv_id: uuid.UUID` из пути (`crud/action.py:415`) — нечисловой/не-UUID идентификатор отвергается самим FastAPI как 422 Pydantic, а мок принимает любую строку (`mocks/index.ts:1643`).
- Форма ответа: `Promise<void>` в подписи (`settingsService.ts:100`). Бэкенд отдаёт `ApiResponse(success=True, message="Conversion deleted")` без `data` (`crud/action.py:420`) — то есть после `unwrap` клиент получает `undefined`. Мок возвращает `delay(undefined as T)` (`mocks/index.ts:1646`).
- Коды ошибок: бэкенд — `NOT_FOUND` из `remove_conversion_item` (`crud/domain.py:438`), но **обработчика у него в роуте нет**: `crud/action.py:413-420` не ловит `NotFoundError`, в отличие от соседних DELETE валют (`:275-279`) и UOM (`:343-347`) → находка 4. Мок — `CONVERSION_NOT_FOUND` (`mocks/settings.ts:531`). До человека ни один код не доходит: клиент показывает общую ошибку сохранения `e.message` (`src/composables/useSettings.ts:522`).
- Save-режим: clean-slate. Удаление правки в стор — `_removeConversion` (`useSettings.ts:584-589`), кнопка `removeConversion` в таблице (`src/views/admin/settings/UnitsSettings.vue:14`); запрос уходит только по Save, из ветки diff-а коллекции (`useSettings.ts:457-459`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:2489-2494`) не называет ни одного кода ошибки и не говорит, что удаление правила ничего не проверяет: ни мок, ни бэкенд не смотрят, пользуется ли кто-то этим правилом (`crud/domain.py:435-439` — только проверка существования). Не сказано и что 404 на этом пути не оформлен (находка 4).
- Источник истины: бэкенд (`crud/action.py:413`), форма ответа снята с него.

### DELETE /api/settings/currencies/:id
- Вызывающий: `src/services/settingsService.ts:65`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:266`
- Мок: `mocks/index.ts:1632`
- Форма запроса: тела нет — `apiDelete(\`/api/settings/currencies/${id}\`, …)`, `settingsService.ts:65`. Бэкенд: `currency_id: uuid.UUID` из пути (`crud/action.py:268`), токена **не требует** (`:266-270`, см. находку 3).
- Форма ответа: `Promise<void>` (`settingsService.ts:64`); бэкенд — `ApiResponse(success=True, message="Currency deleted")` (`crud/action.py:274`); мок — `delay(undefined as T)` (`mocks/index.ts:1635`).
- Коды ошибок: бэкенд — `NOT_FOUND` (404, `crud/action.py:275-279`, источник `crud/domain.py:260`) и `CONFLICT` (409, `:280-284`, источник `crud/domain.py:266` — «валюта используется N товарами», счёт через `products.internal_api.interface.count_products_by_currency`, `crud/domain.py:263-264`). Мок — `CURRENCY_NOT_FOUND` (`mocks/settings.ts:477`), проверки использования у него нет вовсе. **Ни бэкенд, ни мок не запрещают удалить валюту по умолчанию** — ни ту, у которой `is_default`, ни ту, чей код записан в `global_constants.default_currency`: в `remove_currency_item` (`crud/domain.py:257-268`) такой проверки нет → находка 5. Ни один код не подстрока другого.
- Save-режим: clean-slate. `_removeCurrency` правит стор (`useSettings.ts:560-565`), запрос уходит по Save (`useSettings.ts:400-402`). В UI кнопка удаления заблокирована у валюты по умолчанию (`src/views/admin/settings/FinanceSettings.vue:111-114`) — то есть правило существует **только как атрибут `disabled`**.
- Пробел контракта: старый раздел (`03-api-contract.md:2369-2375`) обещает «422 если попытка удалить валюту, установленную как `defaultCurrency` в константах» — такой проверки нет ни на бэкенде, ни в моке (находка 5); и не упоминает реально существующий 409 по товарам (`crud/domain.py:262-266`).
- Источник истины: бэкенд.

### DELETE /api/settings/order-statuses/:id
- Вызывающий: `src/services/settingsService.ts:136`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:482`
- Мок: `mocks/index.ts:1647`
- Форма запроса: тела нет (`settingsService.ts:136`); бэкенд — `status_id: uuid.UUID` из пути (`crud/action.py:484`), без токена (находка 3).
- Форма ответа: `Promise<void>` (`settingsService.ts:135`); бэкенд — `ApiResponse(success=True, message="Order status deleted")` (`crud/action.py:490`); мок — `delay(undefined as T)` (`mocks/index.ts:1650`).
- Коды ошибок: бэкенд — `NOT_FOUND` (404, `crud/action.py:491-495`) и `FORBIDDEN` (403 на системный статус, `:496-500`, источник `crud/domain.py:529`). Мок — только `ORDER_STATUS_NOT_FOUND` (`mocks/settings.ts:577`); **системность мок не проверяет вовсе**, хотя все 15 сидовых статусов помечены `system: true` (`mocks/settings.ts:210-345`), то есть под моками удаляется то, что сервер запретит → расхождение мок↔бэкенд, находка 6. Проверки «статус используется в заказах» нет нигде: она оставлена комментарием-TODO (`crud/domain.py:531-532`).
- Save-режим: clean-slate. `_removeOrderStatus` (`useSettings.ts:602-607`), запрос по Save (`useSettings.ts:503-505`). Важно: при удалении Save дополнительно шлёт `PUT …/reorder` (`useSettings.ts:482-486`), то есть два запроса без общей транзакции.
- Пробел контракта: старый раздел (`03-api-contract.md:2573-2579`) обещает 403 на системный (есть) и 409 на использование в заказах (**нет нигде**, `crud/domain.py:531-532`). Не сказано, кто ставит `system: true` — на бэкенде его не ставит никто (`crud/domain.py:469` жёстко пишет `False` при создании, а сидов системных статусов в миграциях нет), см. «Значения по умолчанию».
- Источник истины: бэкенд.

### DELETE /api/settings/uoms/:id
- Вызывающий: `src/services/settingsService.ts:83`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:334`
- Мок: `mocks/index.ts:1637`
- Форма запроса: тела нет (`settingsService.ts:83`); бэкенд — `uom_id: uuid.UUID` (`crud/action.py:336`), без токена (находка 3).
- Форма ответа: `Promise<void>` (`settingsService.ts:82`); бэкенд — `ApiResponse(success=True, message="UOM deleted")` (`crud/action.py:342`); мок — `delay(undefined as T)` (`mocks/index.ts:1640`).
- Коды ошибок: бэкенд — `NOT_FOUND` (`crud/action.py:343-347`) и `CONFLICT` при использовании в товарах (`:348-352`, источник `crud/domain.py:342`, счёт `count_products_by_uom`, `:339-340`). Мок — `UOM_NOT_FOUND` (`mocks/settings.ts:504`). **Правила пересчёта при этом не проверяет никто**, и схема удаляет их молча: `uom_conversions.from_uom_id`/`to_uom_id` объявлены `ondelete="CASCADE"` (`backend/app/modules/settings/shared/models.py:117`, `:122`) → находка 7.
- Save-режим: clean-slate. `_removeUom` (`useSettings.ts:572-577`), запрос по Save (`useSettings.ts:429-431`), кнопка — `src/views/admin/settings/UnitsSettings.vue:79`.
- Пробел контракта: старый раздел (`03-api-contract.md:2434-2440`) обещает «409 если UOM используется в товарах, правилах пересчёта или заказах» — из трёх реализован только первый пункт (`crud/domain.py:338-342`); по правилам пересчёта поведение противоположно обещанному (каскадное удаление, находка 7), а заказов на бэкенде нет вовсе.
- Источник истины: бэкенд.

### DELETE /api/settings/warehouse-map
- Вызывающий: `src/services/settingsService.ts:156`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1652`
- Форма запроса: тела нет, единичный ресурс без id — `apiDelete('/api/settings/warehouse-map', { headers: authHeaders() })`, `settingsService.ts:156`.
- Форма ответа: `Promise<void>` (`settingsService.ts:155`); мок — `delay(undefined as T)` (`mocks/index.ts:1655`), сам сброс — `mockDeleteWarehouseMap` (`mocks/settings.ts:659-661`), который кладёт `settingsStore.warehouseMap = null`.
- Коды ошибок: ни одного — в `mockDeleteWarehouseMap` (`mocks/settings.ts:659-661`) нет ни одного `throw`; удаление несуществующей карты — успех. Клиент код и не читает: ловит любую ошибку и показывает один тост `warehouse.map_toast_error_delete` (`src/composables/useWarehouseMap.ts:76-78`).
- Save-режим: quick-action. `remove()` уходит на сервер сразу после подтверждения (`src/composables/useWarehouseMap.ts:69-82`), Save bar настроек не участвует — карта не входит в набор `fetchAllSections` (`useSettings.ts:217-237`, девять запросов, карты среди них нет).
- Пробел контракта: старый раздел (`03-api-contract.md:2819-2826`) описывает поведение верно, но не говорит: (а) что удаление идемпотентно (повтор на пустой карте — тоже успех, `mocks/settings.ts:659-661`); (б) что сам файл при этом никуда не девается — `POST /api/uploads` его уже сохранил, и обязанности удалить бинарник контракт не назначает никому.
- Источник истины: мок + клиент (бэкенда нет). Модели `warehouse_map` в `backend/app/modules/settings/shared/models.py` нет ни одной (`grep -c warehouse_map` по файлу → 0).

### GET /api/settings/company
- Вызывающий: `src/services/settingsService.ts:27`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:146`
- Мок: `mocks/index.ts:381`
- Форма запроса: ни query, ни тела — `apiGet('/api/settings/company', undefined, { headers: authHeaders() })`, `settingsService.ts:27`.
- Форма ответа: `CompanyInfo` — `name`, `legalAddress`, `vatCode`, `bankName`, `bankAccount`, `logoUrl?` (`src/types/settings.ts:4-11`). Бэкенд отдаёт ровно эти шесть ключей в camelCase (`crud/schemas.py:15-25`, алиасы `:19-23`, сериализация `by_alias=True` — `crud/action.py:156`); все пять строковых полей на выходе непусты, `None` из БД заменяется на `""` (`crud/domain.py:77-84`), `logoUrl` — `str | None` (`crud/schemas.py:23`).
- Коды ошибок: `UNAUTHORIZED` (401) при отсутствии/порче токена (`crud/action.py:108,115,127`) и `NOT_FOUND` (404), если у пользователя нет арендатора (`:135-138`). Специфичного кода нет ни одного; мок не бросает ничего (`mocks/settings.ts:413-415`). Обещанного старым контрактом `COMPANY_NOT_FOUND` в коде нет нигде (`grep -rn COMPANY_NOT_FOUND backend/app frontend_vue/src` → пусто).
- Save-режим: чтение, один из девяти параллельных запросов `fetchAllSections()` (`useSettings.ts:228`), `Promise.allSettled` (`:227`) — падение раздела не рушит остальные (`:246-252`).
- Пробел контракта: старый раздел (`03-api-contract.md:2236-2253`) форму описывает верно. Не сказано главное: **строка компании создаётся сервером сама** — при регистрации через `init_company_info` (`backend/app/modules/settings/internal_api/interface.py:67-79`, вызов `backend/app/modules/auth/features/register/domain.py:106`), а при чтении, если её всё-таки нет, — прямо в GET, с подстановкой имени и НДС-кода арендатора (`crud/domain.py:67-76`). То есть 404 «компании нет» недостижим по построению.
- Источник истины: бэкенд.

### GET /api/settings/constants
- Вызывающий: `src/services/settingsService.ts:43`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:179`
- Мок: `mocks/index.ts:382`
- Форма запроса: ни query, ни тела (`settingsService.ts:43`).
- Форма ответа: `GlobalConstants` — `vatRate`, `defaultMargin`, `defaultCurrency`, `defaultDiscountPercent` (`src/types/settings.ts:14-19`); бэкенд — те же четыре ключа camelCase (`crud/schemas.py:43-51`), числа приводятся из `Numeric` во `float` (`crud/domain.py:132-137`). `defaultCurrency` — **код** валюты (`String(10)`, `backend/app/modules/settings/shared/models.py:50-52`), а не её `id`.
- Коды ошибок: те же общие `UNAUTHORIZED`/`NOT_FOUND` (`crud/action.py:108,115,127`, `:135-138`); своих нет, мок не бросает ничего (`mocks/settings.ts:429-431`).
- Save-режим: чтение, запрос №2 из девяти (`useSettings.ts:229`).
- Пробел контракта: старый раздел (`03-api-contract.md:2278-2292`) верен по форме и по смыслу `defaultCurrency`. Не сказано: строка констант **создаётся при первом чтении** со значениями по умолчанию `vat_rate=21`, `default_margin=15`, `default_currency='EUR'`, `default_discount_percent=0` (`crud/domain.py:129-131`, дефолты — `models.py:44-55`), то есть у арендатора эти четыре числа появляются без единого действия человека, и «EUR» назначает сервер.
- Источник истины: бэкенд.

### GET /api/settings/conversions
- Вызывающий: `src/services/settingsService.ts:89`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:359`
- Мок: `mocks/index.ts:386`
- Форма запроса: ни query, ни тела, пагинации нет (`settingsService.ts:89`).
- Форма ответа: `UomConversion[]` — `{ id, fromUomId, toUomId, type, factor?, formulaType? }` (`src/types/settings.ts:78-85`); бэкенд — те же ключи (`crud/schemas.py:137-147`), сборка `crud/domain.py:353-363`. Порядок не задан: `get_conversions` идёт без `order_by` (`crud/repository.py:198-202`). Список кладётся в поле конверта, объявленное как `dict | None` (`crud/action.py:369` против `backend/app/core/schemas.py:33`) — находка 21. **`factor` теряется, если он равен нулю:** `float(c.factor) if c.factor else None` (`crud/domain.py:359`) — ноль ложен в Python.
- Коды ошибок: общие `UNAUTHORIZED`/`NOT_FOUND`; своих нет, мок не бросает ничего (`mocks/settings.ts:510-512`).
- Save-режим: чтение, запрос №7 из девяти (`useSettings.ts:234`).
- Пробел контракта: старый раздел (`03-api-contract.md:2446-2458`) форму описывает верно, но: (а) не называет порядок выдачи (его нет — `crud/repository.py:198-202`); (б) не оговаривает, что `type` и `formulaType` на сервере — свободные строки (`String(20)`/`String(50)`, `models.py:125-133`), тогда как во фронте это замкнутые списки (`src/types/settings.ts:43`, `:55-59`), и сервер не обязан их соблюдать.
- Источник истины: бэкенд.

### GET /api/settings/currencies
- Вызывающий: `src/services/settingsService.ts:53`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:212`
- Мок: `mocks/index.ts:384`
- Форма запроса: ни query, ни тела, пагинации нет (`settingsService.ts:53`).
- Форма ответа: во фронте `Currency[]` — `{ id, code, name: TranslatedString, isDefault, updatedAt? }` (`src/types/settings.ts:22-28`). **Бэкенд отдаёт на одно поле больше** — `exchangeRate` (`crud/schemas.py:73`, заполнение `crud/domain.py:184`), которого в типе фронта нет; во фронте курса нет нигде, валюты сосуществуют без пересчёта. Порядок выдачи не задан (`crud/repository.py:87-91` — без `order_by`). Список кладётся в поле конверта, объявленное как `dict | None` (`crud/action.py:222` против `backend/app/core/schemas.py:33`) — находка 21.
- Коды ошибок: общие `UNAUTHORIZED`/`NOT_FOUND`; своих нет, мок не бросает ничего (`mocks/settings.ts:456-458`).
- Save-режим: чтение, запрос №5 из девяти (`useSettings.ts:232`).
- Пробел контракта: старый раздел (`03-api-contract.md:2315-2327`) показывает `exchangeRate` в примере и утверждает, что он есть в типе `Currency` (`:2194`) — **в типе его нет** (`src/types/settings.ts:22-28`). Расхождение не косметическое: на нём ломается создание валюты (см. `POST /api/settings/currencies`), и что с курсом делать — вопрос владельцу.
- Источник истины: бэкенд.

### GET /api/settings/mail
- Вызывающий: `src/services/settingsService.ts:166`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:389`
- Форма запроса: ни query, ни тела (`settingsService.ts:166`).
- Форма ответа: `MailServerSettings` — `host`, `port`, `encryption`, `username`, `passwordSet`, `fromEmail`, `fromName` (`src/types/settings.ts:140-152`). Пароля нет и быть не может: поля для него нет в типе (`:146-147`), мок собирает ответ из `mailStore` плюс вычисляемый `passwordSet` (`mocks/settings.ts:588-590`). Доказано спекой на обоих путях чтения — `mocks/mail-settings.spec.ts:25-33`.
- Коды ошибок: ни одного — в `mockGetMail` (`mocks/settings.ts:588-590`) нет `throw`.
- Save-режим: чтение, запрос №3 из девяти (`useSettings.ts:230`).
- Пробел контракта: старый раздел (`03-api-contract.md:2647-2666`) описывает поведение верно. Не сказано, что **хранилища почтовых настроек на бэкенде нет вовсе**: модели нет (`grep -rn "smtp\|MailServer" backend/app/modules/settings` → пусто), а единственный серверный тип этой формы — `MailServerConfig` внутри чужого модуля (`backend/app/modules/bcc/features/send_request/domain.py:42-55`), и он **не конструируется нигде** (`grep -rn "MailServerConfig(" backend/app` → пусто).
- Источник истины: мок + клиент (бэкенда нет).

### GET /api/settings/order-permissions
- Вызывающий: `src/services/settingsService.ts:37`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:383`
- Форма запроса: ни query, ни тела (`settingsService.ts:37-39`).
- Форма ответа: `OrderPermissions` — три массива имён ролей: `seeCost`, `manualCost`, `correction` (`src/types/settings.ts:224-231`); мок отдаёт копию среза настроек (`mocks/settings.ts:440-442`), сид — `['owner','admin','accounting']` / `['owner','admin']` / `['owner','admin']` (`mocks/settings.ts:62-66`).
- Коды ошибок: ни одного — `mockGetOrderPermissions` (`mocks/settings.ts:440-442`) не бросает.
- Save-режим: чтение, запрос №4 из девяти (`useSettings.ts:231`). Записи нет: эндпоинта на запись не существует, и в `save()` (`useSettings.ts:340-526`) раздела `orderPermissions` нет — то есть матрица прав читается и не редактируется.
- Пробел контракта: раздела нет вовсе — `grep -n "order-permissions\|orderPermissions" roo_code/roo-context/03-api-contract.md` не даёт ни одного попадания. При этом эндпоинт обслуживает три права модели ценообразования и читается как гейт кнопок и колонок (`src/composables/useOrderPermissions.ts:28-30`), а мок применяет те же права на «сервере» (`mocks/orders.ts:1857`, `:1393`).
- Источник истины: мок + клиент (бэкенда нет). Модели прав в `backend/app/modules/settings/shared/models.py` нет — файл содержит шесть классов (`:12`, `:32`, `:61`, `:86`, `:104`, `:136`), прав среди них нет.

### GET /api/settings/order-statuses
- Вызывающий: `src/services/settingsService.ts:107`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:427`
- Мок: `mocks/index.ts:387`
- Форма запроса: ни query, ни тела, пагинации нет (`settingsService.ts:107-109`).
- Форма ответа: `OrderStatusSetting[]` — `{ id, name: TranslatedString, color, order, system?, reserveOnTransition?, writeOffOnTransition? }` (`src/types/settings.ts:88-98`); бэкенд отдаёт те же семь ключей (`crud/schemas.py:176-187`), причём `order` на проводе — это колонка `sort_order` (`crud/domain.py:453`), а `system` — `is_system` (`:454`). **Порядок задан**: сортировка по `sort_order` в репозитории (`crud/repository.py:253-259`). Список кладётся в поле конверта, объявленное как `dict | None` (`crud/action.py:437` против `backend/app/core/schemas.py:33`) — находка 21.
- Коды ошибок: общие `UNAUTHORIZED`/`NOT_FOUND`; своих нет, мок не бросает ничего (`mocks/settings.ts:537-539`).
- Save-режим: чтение, запрос №8 из девяти (`useSettings.ts:235`).
- Пробел контракта: старый раздел (`03-api-contract.md:2500-2513`) форму описывает верно. Не сказано: (а) что `order`/`system` на проводе — переименование колонок `sort_order`/`is_system`, и сервер обязан держать это соответствие (`crud/domain.py:453-454`); (б) откуда берутся системные статусы — на бэкенде их **не создаёт никто** (создание жёстко пишет `is_system=False`, `crud/domain.py:469`; сидов в миграциях нет), тогда как весь фронт заказов опирается на замкнутый список статусов (`src/domain/orderStatus.ts`) и все 15 сидовых статусов мока помечены `system: true` (`mocks/settings.ts:210-345`).
- Источник истины: бэкенд.

### GET /api/settings/profile
- Вызывающий: `src/services/settingsService.ts:185`
- Бэкенд: `backend/app/modules/settings/features/profile/action.py:75`
- Мок: `mocks/index.ts:388`
- Форма запроса: ни query, ни тела (`settingsService.ts:185`).
- Форма ответа: `UserProfile` — `firstName`, `lastName`, `email`, `phone`, `role`, `secretLink?` (`src/types/settings.ts:205-212`); бэкенд отдаёт те же шесть ключей в camelCase (`profile/schemas.py:10-24`), `phone` из `None` превращается в `""` (`profile/domain.py:60`). `secretLink` — **не хранимое поле, а собранный URL**: `{frontend_url}/auth/link?token={secret_link_token}`, причём токен при отсутствии генерируется прямо в GET и записывается в БД (`profile/domain.py:22-42`, генерация `:32`, запись `:33`).
- Коды ошибок: `UNAUTHORIZED` (`profile/action.py:51,58,70`) и `NOT_FOUND` (404, `:91-95`, источник `profile/domain.py:52`). Мок не бросает ничего (`mocks/settings.ts:627-629`).
- Save-режим: чтение, запрос №9 из девяти (`useSettings.ts:236`).
- Пробел контракта: старый раздел (`03-api-contract.md:2585-2600`) неполон в двух местах: (а) `secretLink` в примере ответа **отсутствует**, хотя его отдают и бэкенд (`profile/schemas.py:22`), и мок (`mocks/settings.ts:354`), и страница его показывает и копирует (`src/views/admin/settings/ProfileSettings.vue:19`); (б) не сказано, что GET имеет побочный эффект — создаёт секретный токен, если его не было (`profile/domain.py:31-33`).
- Источник истины: бэкенд.

### GET /api/settings/uoms
- Вызывающий: `src/services/settingsService.ts:71`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:291`
- Мок: `mocks/index.ts:385`
- Форма запроса: ни query, ни тела, пагинации нет (`settingsService.ts:71`).
- Форма ответа: `Uom[]` — `{ id, code: TranslatedString, name: TranslatedString, category }` (`src/types/settings.ts:70-75`); бэкенд — те же четыре ключа (`crud/schemas.py:104-112`), где `code` собирается из колонки `code_translations`, а `name` — из `name_translations` (`crud/domain.py:276-281`). Порядок не задан (`crud/repository.py:141-145` — без `order_by`). Список кладётся в поле конверта, объявленное как `dict | None` (`crud/action.py:301` против `backend/app/core/schemas.py:33`) — находка 21.
- Коды ошибок: общие `UNAUTHORIZED`/`NOT_FOUND`; своих нет, мок не бросает ничего (`mocks/settings.ts:483-485`).
- Save-режим: чтение, запрос №6 из девяти (`useSettings.ts:233`).
- Пробел контракта: старый раздел (`03-api-contract.md:2381-2393`) перечисляет семь категорий UOM — `weight | length | area | volume | quantity | density | thickness` (`:2403`), — а во фронте их **восемь**: добавлен `time` для услуг (`src/types/settings.ts:31-40`, сид `mocks/settings.ts:146-150`). Комментарий бэкенда (`models.py:99-101`) повторяет тот же устаревший список из семи; сама колонка — `String(20)` без ограничения, то есть сервер примет любую строку.
- Источник истины: бэкенд.

### GET /api/settings/warehouse-map
- Вызывающий: `src/services/settingsService.ts:146`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:390`
- Форма запроса: ни query, ни тела (`settingsService.ts:146-148`).
- Форма ответа: `WarehouseMapFile | null` — `{ fileId, name, mime, size, url, uploadedAt }` или `null`, если карту не загружали (`src/types/settings.ts:111-119`, подпись `settingsService.ts:145`); мок отдаёт копию или `null` (`mocks/settings.ts:647-649`), сид — `null` (`mocks/settings.ts:185`). Поля повторяют ответ `POST /api/uploads` (`UploadedFile`, комментарий `src/types/settings.ts:108-109`).
- Коды ошибок: ни одного — `mockGetWarehouseMap` (`mocks/settings.ts:647-649`) не бросает. Клиент кладёт любую ошибку в `error.value` текстом (`src/composables/useWarehouseMap.ts:30-32`).
- Save-режим: чтение, **вне** набора настроек: `fetchAllSections()` карту не запрашивает (`useSettings.ts:217-237` — девять вызовов, карты среди них нет), её тянет своя `load()` на своей странице (`src/composables/useWarehouseMap.ts:25-35`).
- Пробел контракта: старый раздел (`03-api-contract.md:2801-2805`) верен. Не сказано, что `null` — это именно успешный ответ, а не 404: подпись клиента `Promise<WarehouseMapFile | null>` (`settingsService.ts:145`), и пустое состояние страницы строится на `null`, а не на пойманной ошибке.
- Источник истины: мок + клиент (бэкенда нет).

### PATCH /api/settings/company
- Вызывающий: `src/services/settingsService.ts:31`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:160`
- Мок: `mocks/index.ts:1339`
- Форма запроса: по подписи — `Partial<CompanyInfo>` (`settingsService.ts:30`), по факту вызова — **вся секция целиком**: `saveCompany({ ...settings.company })` (`useSettings.ts:348`). Бэкенд принимает `CompanyPatchInput` — шесть необязательных полей с camelCase-алиасами (`crud/schemas.py:28-38`); `None` означает «не менять» (`crud/domain.py:103-106`), то есть **обнулить поле в `null` через этот эндпоинт нельзя**, пустая строка при этом проходит.
- Форма ответа: `CompanyInfo` целиком после merge (`settingsService.ts:30`; бэкенд — `crud/action.py:168-172`; мок — `mockPatchCompany` возвращает копию секции, `mocks/settings.ts:422-425`).
- Коды ошибок: `UNAUTHORIZED`/`NOT_FOUND` общие; своих нет. Мок не бросает ничего (`mocks/settings.ts:422-425`). Валидации полей нет ни на одной стороне: ни ИНН/НДС, ни IBAN не проверяются (`crud/domain.py:94-112` — только перекладывание значений).
- Save-режим: clean-slate. Правки идут в стор через `updateCompany` (`useSettings.ts:531-535`, потребитель `src/views/admin/settings/CompanySettings.vue:12`), запрос уходит по общей кнопке Save (`useSettings.ts:347-350`) вместе с остальными дельтами через `Promise.all` (`:518`).
- Пробел контракта: старый раздел (`03-api-contract.md:2255-2272`) утверждает «Body: dirty-only поля» — **неверно**: клиент шлёт секцию целиком (`useSettings.ts:348`). И утверждает «Клиент **не** шлёт base64» — тоже неверно: при выборе файла в стор кладётся data-URL для мгновенного превью (`src/views/admin/settings/SettingsLayout.vue:334-337`), и если Save нажать до завершения загрузки, этот data-URL уходит в `logoUrl` (колонка `Text`, `models.py:29`) → находка 8.
- Источник истины: бэкенд.

### PATCH /api/settings/constants
- Вызывающий: `src/services/settingsService.ts:47`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:193`
- Мок: `mocks/index.ts:1343`
- Форма запроса: по подписи `Partial<GlobalConstants>` (`settingsService.ts:46`), по факту — секция целиком: `saveConstants({ ...settings.constants })` (`useSettings.ts:354`). Бэкенд — `ConstantsPatchInput`, четыре необязательных поля с camelCase-алиасами (`crud/schemas.py:54-62`), `None` = «не менять» (`crud/domain.py:154-157`).
- Форма ответа: `GlobalConstants` целиком после merge (`settingsService.ts:46`; бэкенд — `crud/action.py:201-205`; мок — `mocks/settings.ts:449-452`).
- Коды ошибок: общие; своих нет. **Ни одна из четырёх величин не проверяется**: `vatRate` и проценты могут быть отрицательными или больше 100 (`crud/domain.py:147-157` — только перекладывание), `defaultCurrency` не сверяется со списком валют арендатора (в `patch_global_constants` нет ни одного обращения к валютам, `crud/domain.py:140-170`) → находка 9.
- Save-режим: clean-slate. `updateConstants` правит стор (`useSettings.ts:536-540`), запрос по Save (`useSettings.ts:353-356`).
- Пробел контракта: старый раздел (`03-api-contract.md:2294-2307`) говорит «Body: dirty-only поля» — неверно (секция целиком, `useSettings.ts:354`) — и «`defaultCurrency` … должен соответствовать одной из валют» — это правило не реализовано нигде (находка 9). Не сказано, что смена валюты по умолчанию — операция из **двух** запросов: PATCH валют (флаг `isDefault`) плюс PATCH констант (`src/views/admin/settings/SettingsLayout.vue:436-446` → `useSettings.ts:403-405` и `:353-356`).
- Источник истины: бэкенд.

### PATCH /api/settings/conversions/:id
- Вызывающий: `src/services/settingsService.ts:97`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:399`
- Мок: `mocks/index.ts:1364`
- Форма запроса: `Partial<UomConversion>` (`settingsService.ts:96`), собирается пофайловым diff-ом `findUpdated` — только изменившиеся ключи (`useSettings.ts:176-198`, вызов `:438`). Бэкенд — `ConversionPatchInput`: пять необязательных полей (`crud/schemas.py:162-171`); `None` = «не менять», поэтому **сбросить `factor` или `formulaType` в `null` невозможно** (`crud/domain.py:413-416`) — правило, переключённое со `static` на `dynamic`, сохранит старый `factor` → находка 10.
- Форма ответа: `Promise<void>` (`settingsService.ts:96`), но бэкенд отдаёт полный `ConversionResponse` (`crud/action.py:406-410`), а мок — `undefined` (`mocks/index.ts:1370`). Клиент ответ не читает.
- Коды ошибок: бэкенд — `NOT_FOUND` из `update_conversion_item` (`crud/domain.py:404`, `:421`), но **обработчика в роуте нет** (`crud/action.py:399-410`), как и у DELETE конверсий (находка 4). Мок — `CONVERSION_NOT_FOUND` (`mocks/settings.ts:525`). Проверки `fromUomId != toUomId` и дубля пары на PATCH **нет**, хотя на POST она есть (`crud/domain.py:372-379`) → находка 11.
- Save-режим: clean-slate. Инлайновая правка `factor` в таблице (`src/views/admin/settings/UnitsSettings.vue:43`) идёт в стор через `updateConversion` (`useSettings.ts:590-595`), запрос уходит по Save (`useSettings.ts:460-462`).
- Пробел контракта: старый раздел (`03-api-contract.md:2476-2487`) перечисляет только `factor`/`type`/`formulaType`, тогда как схема принимает ещё и `fromUomId`/`toUomId` (`crud/schemas.py:165-166`), то есть правило можно перевесить на другую пару единиц без всякой проверки (находка 11). Про невозможность обнулить `factor` (находка 10) не сказано ничего.
- Источник истины: бэкенд.

### PATCH /api/settings/currencies/:id
- Вызывающий: `src/services/settingsService.ts:61`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:252`
- Мок: `mocks/index.ts:1356`
- Форма запроса: `Partial<Currency>` (`settingsService.ts:60`), дельта от `findUpdated` (`useSettings.ts:379`). Бэкенд — `CurrencyPatchInput`: `code`, `name`, `exchangeRate`, `isDefault`, все необязательные (`crud/schemas.py:91-99`). Токена роут **не требует** (`crud/action.py:252-257`, находка 3).
- Форма ответа: `Promise<void>` (`settingsService.ts:60`); бэкенд отдаёт полный `CurrencyResponse` (`crud/action.py:259-263`), мок — `undefined` (`mocks/index.ts:1362`).
- Коды ошибок: бэкенд — `NOT_FOUND` из `update_currency_item` (`crud/domain.py:226`, `:243`), обработчика в роуте нет (`crud/action.py:252-263`) → тот же класс, что находка 4. Мок — `CURRENCY_NOT_FOUND` (`mocks/settings.ts:471`). Проверки уникальности `code` на PATCH нет (на POST есть — `crud/domain.py:200-202`), при том что в БД стоит `UniqueConstraint("tenant_id","code")` (`models.py:81-83`) → нарушение вылезет как необработанная ошибка драйвера, а не как `CONFLICT` → находка 12.
- Save-режим: clean-slate. Единственный путь правки — переключение валюты по умолчанию (`src/views/admin/settings/FinanceSettings.vue:102` → `SettingsLayout.vue:430-446`), которое ставит `isDefault` **всем** валютам локально (`SettingsLayout.vue:439-441`) и потому порождает столько PATCH, сколько валют изменилось (`useSettings.ts:403-405`).
- Пробел контракта: старый раздел (`03-api-contract.md:2356-2367`) описывает тело как `{ exchangeRate?, isDefault? }` и говорит, что «другие автоматически сбрасываются на клиенте». Именно так и происходит — и это единственное место, где хранится инвариант «валюта по умолчанию ровно одна»: сервер его не держит (`crud/domain.py:221-254` — ни одного обращения к другим валютам) → находка 13.
- Источник истины: бэкенд.

### PATCH /api/settings/mail
- Вызывающий: `src/services/settingsService.ts:170`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1351`
- Форма запроса: `MailServerPayload` — `Partial<Omit<MailServerSettings,'passwordSet'>> & { password?: string }` (`src/types/settings.ts:179-182`). По факту клиент шлёт секцию целиком плюс пароль, если его ввели: `const { passwordSet: _passwordSet, ...editable } = settings.mail` и `payload.password = mailPassword.value` только при непустом значении (`useSettings.ts:363-374`).
- Форма ответа: `MailServerSettings` целиком после merge, снова без пароля (`settingsService.ts:169`; мок — `mockPatchMail` возвращает `mockGetMail()`, `mocks/settings.ts:597-602`). Ответ кладётся прямо в стор (`useSettings.ts:368-370`).
- Коды ошибок: ни одного — в `mockPatchMail` (`mocks/settings.ts:597-602`) нет `throw`. Валидации `host`/`fromEmail`/`port` нет ни на одной стороне.
- Save-режим: clean-slate, та же кнопка Save (`useSettings.ts:363-374`). Пароль живёт вне стора и вне снимка (`useSettings.ts:96-103`) и обнуляется сразу после постановки запроса в очередь (`:372`) — **до** того, как запрос выполнился.
- Пробел контракта: старый раздел (`03-api-contract.md:2668-2686`) описывает правило «пустая строка не отправляется» верно (`useSettings.ts:366`, мок `mocks/settings.ts:600`) и подтверждено спекой `mocks/mail-settings.spec.ts:41-49`. Не сказано: (а) что стереть пароль этим эндпоинтом нельзя вовсе — отдельного действия «убрать пароль» нет ни в UI, ни в моке; (б) что клиент шлёт секцию целиком, а не dirty-поля (`useSettings.ts:364-365`).
- Источник истины: мок + клиент (бэкенда нет).

### PATCH /api/settings/order-statuses/:id
- Вызывающий: `src/services/settingsService.ts:124`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:468`
- Мок: `mocks/index.ts:1378`
- Форма запроса: `Partial<OrderStatusSetting>` (`settingsService.ts:120-123`), дельта от `findUpdated` (`useSettings.ts:469`). Бэкенд — `OrderStatusPatchInput`: `name`, `color`, `order`, `reserveOnTransition`, `writeOffOnTransition` (`crud/schemas.py:202-211`); поля `system` в схеме нет, то есть системность через PATCH не меняется. Токена роут не требует (`crud/action.py:468-473`, находка 3).
- Форма ответа: `Promise<void>` (`settingsService.ts:120`); бэкенд отдаёт полный `OrderStatusResponse` (`crud/action.py:475-479`), мок — `undefined` (`mocks/index.ts:1384`).
- Коды ошибок: бэкенд — `NOT_FOUND` из `update_order_status_item` (`crud/domain.py:490`, `:507`), обработчика в роуте нет (`crud/action.py:468-479`) → класс находки 4. Мок — `ORDER_STATUS_NOT_FOUND` (`mocks/settings.ts:553`). Формат цвета не проверяет никто: колонка `String(7)` (`models.py:148`), но проверки `#RRGGBB` нет ни в `crud/domain.py:496-497`, ни в моке.
- Save-режим: clean-slate. Правки цвета и флагов идут в стор через `updateOrderStatus` (`useSettings.ts:608-613`; вызовы — `SettingsLayout.vue:455` и `src/views/admin/settings/OrderStatusesSettings.vue:15`), запрос по Save (`useSettings.ts:506-508`).
- Пробел контракта: старый раздел (`03-api-contract.md:2546-2559`) говорит «`order` изменяется через reorder» — но схема PATCH `order` **принимает** (`crud/schemas.py:207`), а `findUpdated` положит его в дельту, если он изменился (`useSettings.ts:187-192`), так что тот же порядок правится двумя путями сразу. Не сказано и что `system` иммутабельно потому, что поля просто нет в схеме, а не потому, что сервер его отвергает.
- Источник истины: бэкенд.

### PATCH /api/settings/profile
- Вызывающий: `src/services/settingsService.ts:189`
- Бэкенд: `backend/app/modules/settings/features/profile/action.py:98`
- Мок: `mocks/index.ts:1347`
- Форма запроса: по подписи `Partial<UserProfile>` (`settingsService.ts:188`), по факту — весь профиль: `saveProfile({ ...settings.profile })` (`useSettings.ts:514`), то есть вместе с `role` и `secretLink`. Бэкенд принимает только четыре поля — `firstName`, `lastName`, `email`, `phone` (`profile/schemas.py:27-35`), лишние молча игнорирует (модель без `extra`). **Мок же принимает всё** — `Object.assign(settingsStore.profile, patch)` (`mocks/settings.ts:636-639`), включая `role` → расхождение мок↔бэкенд, находка 14.
- Форма ответа: `UserProfile` целиком после merge (`settingsService.ts:188`; бэкенд — `profile/action.py:111-114`, снова с пересозданием `secretLink` при его отсутствии, `profile/domain.py:99`; мок — `mocks/settings.ts:636-639`).
- Коды ошибок: `UNAUTHORIZED` (`profile/action.py:51,58,70`), `NOT_FOUND` (404, `:115-119`), `CONFLICT` (409, `:120-124`, источник `profile/domain.py:86` — почта уже занята). Мок не бросает ничего. Формат почты и телефона не проверяется ни на одной стороне (`profile/domain.py:82-89` — только проверка занятости).
- Save-режим: clean-slate. `updateProfile` правит стор (`useSettings.ts:623-627`, потребитель `src/views/admin/settings/ProfileSettings.vue:14`), запрос по Save (`useSettings.ts:513-516`).
- Пробел контракта: старый раздел (`03-api-contract.md:2602-2614`) снова говорит «dirty-only поля» — неверно (`useSettings.ts:514`), и не называет обязанность сервера игнорировать `role`/`secretLink`, которую бэкенд выполняет случайно (их нет в схеме), а мок не выполняет вовсе (находка 14).
- Источник истины: бэкенд.

### PATCH /api/settings/uoms/:id
- Вызывающий: `src/services/settingsService.ts:79`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:320`
- Мок: `mocks/index.ts:1372`
- Форма запроса: `Partial<Uom>` (`settingsService.ts:78`). Бэкенд — `UomPatchInput`: `code`, `name`, `category`, все необязательные (`crud/schemas.py:125-132`). Токена роут не требует (`crud/action.py:320-325`, находка 3).
- Форма ответа: `Promise<void>` (`settingsService.ts:78`); бэкенд — полный `UomResponse` (`crud/action.py:327-331`); мок — `undefined` (`mocks/index.ts:1378` — ветка на `:1374-1377`).
- Коды ошибок: бэкенд — `NOT_FOUND` из `update_uom_item` (`crud/domain.py:308`, `:321`), обработчика в роуте нет (`crud/action.py:320-331`) → класс находки 4. Мок — `UOM_NOT_FOUND` (`mocks/settings.ts:498`). Значение `category` не проверяется по списку ни на одной стороне (`crud/domain.py:315-316`; колонка `String(20)`, `models.py:99-101`).
- Save-режим: **вызывающего нет.** `useSettings.save()` для UOM считает только добавленные и удалённые (`useSettings.ts:410-433`) — ветки `findUpdated` у `uoms`, в отличие от валют, конверсий и статусов, там нет, и мутатора `updateUom` композабл не экспортирует (`useSettings.ts:674-704` — в возвращаемом объекте его нет). То есть клиент написан, UI нет → находка 15.
- Пробел контракта: старый раздел (`03-api-contract.md:2420-2432`) честно помечает это «будущий UI — inline rename», но говорит «`category` менять можно (с осторожностью)» — правила, ограничивающего эту осторожность, нет нигде: смена категории у единицы, на которую ссылаются правила пересчёта и товары, ничем не проверяется.
- Источник истины: бэкенд.

### POST /api/settings/change-password
- Вызывающий: `src/services/settingsService.ts:197`
- Бэкенд: `backend/app/modules/settings/features/profile/action.py:127`
- Мок: `mocks/index.ts:1134`
- Форма запроса: `{ currentPassword, newPassword, confirmPassword }`, все три обязательны (`settingsService.ts:192-196`); бэкенд — `ChangePasswordInput` с теми же тремя camelCase-алиасами (`profile/schemas.py:38-45`).
- Форма ответа: `Promise<void>` (`settingsService.ts:196`); бэкенд — `ApiResponse(success=True, message="Password changed")`, данных нет (`profile/action.py:140`); мок — `delay(undefined as T)`, **no-op** (`mocks/index.ts:1134`): пароля мок не хранит и ничего не проверяет.
- Коды ошибок: бэкенд — `UNAUTHORIZED`, `NOT_FOUND` (404, `profile/action.py:141-145`) и `VALIDATION_ERROR` (422, `:146-150`) на три разных случая: неверный текущий пароль (`profile/domain.py:127`), короткий новый (`:131-133`), несовпадение подтверждения (`:137`). Все три идут **одним кодом** — различает их только текст сообщения. Обещанного старым контрактом `INVALID_PASSWORD` нет нигде (`grep -rn INVALID_PASSWORD backend/app frontend_vue/src` → пусто). Клиент показывает `e.message` как есть (`src/views/admin/settings/ProfileSettings.vue:66`).
- Save-режим: quick-action. Отдельная форма и отдельная кнопка, Save bar настроек не участвует (`ProfileSettings.vue:39-70`); клиент повторяет обе проверки локально до отправки (`:45-52`).
- Пробел контракта: старый раздел (`03-api-contract.md:2616-2634`) обещает `INVALID_PASSWORD` (кода нет) и «Rate-limit: 3 попытки/min/IP» — ограничение объявлено настройкой `password_change_rate_limit_per_min` (`backend/app/core/config.py:32`) и **не используется ни в одной строке кода** (`grep -rn password_change_rate_limit_per_min backend/app` даёт единственное попадание — само объявление) → находка 16. Не сказано и что мок этот эндпоинт не реализует вовсе: под моками смена пароля всегда «успешна» (`mocks/index.ts:1134`).
- Источник истины: бэкенд.

### POST /api/settings/conversions
- Вызывающий: `src/services/settingsService.ts:93`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:373`
- Мок: `mocks/index.ts:1130`
- Форма запроса: `Omit<UomConversion,'id'>` (`settingsService.ts:92`); фактически клиент шлёт либо `{fromUomId, toUomId, type:'static', factor}`, либо `{fromUomId, toUomId, type:'dynamic', formulaType}` (`src/views/admin/settings/SettingsLayout.vue:380-394`). Бэкенд — `ConversionCreateInput`: `fromUomId`, `toUomId`, `type` обязательны; `factor` и `formulaType` — нет (`crud/schemas.py:150-159`), то есть **правило без коэффициента и без формулы сервер примет** (в `create_conversion_item` таких проверок нет, `crud/domain.py:366-396`) → находка 17.
- Форма ответа: `UomConversion` с серверным `id` (`settingsService.ts:92`; бэкенд — `crud/action.py:382-386`; мок — `mockCreateConversion` с id вида `conv-{N}`, `mocks/settings.ts:514-521`). Клиент подменяет временный локальный id ответом, находя строку по паре `fromUomId+toUomId` (`useSettings.ts:445-454`).
- Коды ошибок: бэкенд — `VALIDATION_ERROR` (422, `crud/action.py:387-391`, источник `crud/domain.py:374` — «одна и та же единица с обеих сторон») и `CONFLICT` (409, `:392-396`, источник `crud/domain.py:379` — пара уже описана). Мок **не бросает ни того, ни другого** (`mocks/settings.ts:514-521` — ни одного `throw`), то есть под моками дубль пары создаётся молча → расхождение мок↔бэкенд.
- Save-режим: clean-slate. `_addConversion` кладёт строку с временным id `conv-temp-<ts>` (`useSettings.ts:578-583`), запрос по Save (`useSettings.ts:444-456`). Форма проверяет только непустоту пары и наличие формулы у динамического (`SettingsLayout.vue:377-378`); совпадение единиц и дубль пары клиент не проверяет.
- Пробел контракта: старый раздел (`03-api-contract.md:2460-2474`) описывает 422 и 409 верно и помечает `factor` как «required if type === 'static'» — но это правило не реализовано ни на сервере, ни в моке (находка 17). Не сказано, что клиент опознаёт созданную строку по паре единиц (`useSettings.ts:447-449`) — то есть сервер обязан вернуть ту же пару, что получил.
- Источник истины: бэкенд.

### POST /api/settings/currencies
- Вызывающий: `src/services/settingsService.ts:57`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:226`
- Мок: `mocks/index.ts:1126`
- Форма запроса: по подписи `Omit<Currency,'id'>` — `{ code, name, isDefault, updatedAt? }` (`settingsService.ts:56` + `src/types/settings.ts:22-28`); фактически форма шлёт три поля: `code` (в верхнем регистре), `name` во всех трёх локалях и `isDefault: false` (`SettingsLayout.vue:355-359`). Бэкенд требует **четыре**, и `exchangeRate` среди них обязателен — у поля нет значения по умолчанию (`crud/schemas.py:80-88`, `:85`) → клиент физически не может создать валюту против настоящего сервера, ответ будет 422 Pydantic → находка 18.
- Форма ответа: `Currency` с серверным `id` (`settingsService.ts:56`; бэкенд — `crud/action.py:236-239`, включая `exchangeRate`; мок — `cur-{N}`, `mocks/settings.ts:460-467`). Клиент подменяет временный id, находя строку по `code` (`useSettings.ts:387-396`).
- Коды ошибок: бэкенд — `VALIDATION_ERROR` (422, `crud/action.py:240-244`, источник `crud/domain.py:197` — пустой код) и `CONFLICT` (409, `:245-249`, источник `crud/domain.py:202` — код занят у арендатора; в БД тот же запрет как `UniqueConstraint`, `models.py:81-83`). Мок не бросает ничего (`mocks/settings.ts:460-467`). Клиент дублей тоже не ловит: `isCurrencyFormValid` проверяет только непустоту (`SettingsLayout.vue:354`).
- Save-режим: clean-slate. `_addCurrency` кладёт строку с временным id `cur-temp-<ts>` (`useSettings.ts:554-559`), запрос по Save (`useSettings.ts:386-399`).
- Пробел контракта: старый раздел (`03-api-contract.md:2329-2354`) описывает тело с `exchangeRate` — это соответствует бэкенду и **не** соответствует ни типу фронта, ни форме (`SettingsLayout.vue:355-359`). Обещанный формат id `cur-{N}` — свойство мока (`mocks/settings.ts:463`), сервер выдаёт UUID (`models.py`, `UUIDMixin`, `backend/app/core/base.py:18-22`); контракт не имеет права обещать формат идентификатора.
- Источник истины: бэкенд.

### POST /api/settings/mail/test
- Вызывающий: `src/services/settingsService.ts:179`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1135`
- Форма запроса: пустой объект — `apiPost('/api/settings/mail/test', {}, { headers: authHeaders() })` (`settingsService.ts:179`). Параметры не передаются намеренно: проверяются те, что уже на сервере (комментарий `settingsService.ts:173-177`).
- Форма ответа: `{ deliveredTo: string }` — адрес, на который ушло письмо (`settingsService.ts:178`); мок отдаёт `mailStore.fromEmail` (`mocks/settings.ts:620-623`), доказано спекой `mocks/mail-settings.spec.ts:73-75`.
- Коды ошибок: один — `MAIL_NOT_CONFIGURED` (`mocks/settings.ts:621`), условие берётся из общего для проекта `isMailConfigured` (`src/types/settings.ts:167-171`, вызов `mocks/settings.ts:611-613`). Это единственный код домена, который **доходит до человека отдельным сообщением** (`src/views/admin/settings/MailSettings.vue:79-84`), — но читается он из `e.message` (`:79`), а у настоящего `ApiRequestError` код лежит в поле `code`, а `message` — человеческий текст (`src/types/api.ts`, заполнение `src/services/api.ts:118-124`) → против сервера ветка не сработает, находка 19. Тот же код бросает и BCC-инструмент (`mocks/bcc.ts:317`), то есть код кросс-доменный.
- Save-режим: quick-action, сохранения не требует и не выполняет (`MailSettings.vue:73-88`). Кнопка гаснет по тому же правилу `isMailConfigured`, применённому к состоянию **сервера**, а не к черновику (`MailSettings.vue:49`), и адрес получателя не называется, пока раздел грязный (`:65-69`).
- Пробел контракта: старый раздел (`03-api-contract.md:2688-2696`) описывает поведение верно. Не сказано: (а) что письмо уходит на адрес отправителя, то есть сервер обязан уметь принять собственную почту; (б) что успешный тест ничего не сохраняет — параметры берутся из уже сохранённого состояния.
- Источник истины: мок + клиент (бэкенда нет).

### POST /api/settings/order-statuses
- Вызывающий: `src/services/settingsService.ts:115`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:441`
- Мок: `mocks/index.ts:1132`
- Форма запроса: `Omit<OrderStatusSetting,'id'>` (`settingsService.ts:112-114`); форма шлёт `name` во всех трёх локалях, `color`, `order` (равный текущей длине списка) и два флага (`SettingsLayout.vue:413-419`). Бэкенд — `OrderStatusCreateInput`: `name`, `color`, `order` обязательны, флаги по умолчанию `False` (`crud/schemas.py:190-199`); поля `system` в схеме нет, сервер жёстко ставит `is_system=False` (`crud/domain.py:469`).
- Форма ответа: `OrderStatusSetting` с серверным `id` (`settingsService.ts:112-118`; бэкенд — `crud/action.py:450-453`; мок — `st-{N}`, `mocks/settings.ts:541-549`). **Мок переписывает присланный `order`** на индекс в конце списка (`mocks/settings.ts:547`), бэкенд — сохраняет присланный (`crud/domain.py:468`) → расхождение мок↔бэкенд по одному полю.
- Коды ошибок: ни одного специфичного — ни `create_order_status_item` (`crud/domain.py:462-482`), ни мок (`mocks/settings.ts:541-549`) не бросают. Уникальность имени, формат цвета и коллизия `order` не проверяются нигде.
- Save-режим: clean-slate. `_addOrderStatus` кладёт строку с временным id `st-temp-<ts>` (`useSettings.ts:596-601`), запрос по Save (`useSettings.ts:488-502`). Поиск созданной строки в ответе идёт **не по данным, а по «первой, которой нет в снимке»** (`useSettings.ts:491-495`), то есть при двух добавленных статусах обе замены попадут в одну и ту же строку → находка 20.
- Пробел контракта: старый раздел (`03-api-contract.md:2515-2544`) показывает в теле `system?: boolean` — такого поля схема не принимает (`crud/schemas.py:190-199`), и это правильно; но контракт обязан сказать это прямо, а не описывать поле, которое сервер обязан игнорировать. Пример ответа показывает `"id": "st-11"` (`03-api-contract.md:2534`) — инкрементальный формат мока (`mocks/settings.ts:544`), тогда как сервер выдаёт UUID (`backend/app/core/base.py:18-22`); контракт не имеет права обещать формат идентификатора.
- Источник истины: бэкенд.

### POST /api/settings/uoms
- Вызывающий: `src/services/settingsService.ts:75`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:305`
- Мок: `mocks/index.ts:1128`
- Форма запроса: `Omit<Uom,'id'>` — `{ code: TranslatedString, name: TranslatedString, category }` (`settingsService.ts:74`); форма кладёт одну и ту же строку во все три локали (`SettingsLayout.vue:367-371`). Бэкенд — `UomCreateInput`, все три поля обязательны (`crud/schemas.py:115-122`).
- Форма ответа: `Uom` с серверным `id` (`settingsService.ts:74`; бэкенд — `crud/action.py:314-317`; мок — `uom-{N}`, `mocks/settings.ts:487-494`). Клиент подменяет временный id, находя строку по паре `category` + **объект** `code` (`useSettings.ts:419-421`) — сравнение `u.code === item.code` работает только потому, что это один и тот же объект в памяти; после ответа сервера такая же строка уже не нашлась бы.
- Коды ошибок: ни одного — ни `create_uom_item` (`crud/domain.py:286-300`), ни мок (`mocks/settings.ts:487-494`) не бросают. Уникальность кода на сервере не проверяется (в отличие от валют), хотя функция поиска по коду в репозитории есть (`crud/repository.py:153-168`) и используется только межмодульным API (`internal_api/interface.py:59-64`). Дубль ловит **только форма**: `isUomCodeDuplicate` (`SettingsLayout.vue:365`, вычислимое — `:190`).
- Save-режим: clean-slate. `_addUom` кладёт строку с временным id `uom-temp-<ts>` (`useSettings.ts:566-571`), запрос по Save (`useSettings.ts:417-428`).
- Пробел контракта: старый раздел (`03-api-contract.md:2395-2418`) перечисляет семь категорий без `time` (`:2403`), тогда как во фронте их восемь (`src/types/settings.ts:31-40`). Не сказано, кто владеет уникальностью кода единицы — сейчас только форма (`SettingsLayout.vue:190`), а сервер примет дубль.
- Источник истины: бэкенд.

### PUT /api/settings/order-statuses/reorder
- Вызывающий: `src/services/settingsService.ts:128`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:456`
- Мок: `mocks/index.ts:1147`
- Форма запроса: `{ orderedIds: string[] }` — полный упорядоченный список (`settingsService.ts:127-133`); бэкенд — `OrderStatusReorderInput` с алиасом `orderedIds` (`crud/schemas.py:214-219`).
- Форма ответа: `Promise<void>` (`settingsService.ts:127`); бэкенд — `ApiResponse(success=True, message="Statuses reordered")` (`crud/action.py:465`); мок — `undefined` (`mocks/index.ts:1150`).
- Коды ошибок: ни одного. Бэкенд перебирает id и пишет `sort_order=idx` по паре `(id, tenant_id)` (`crud/repository.py:294-306`); **несуществующий или чужой id молча не даёт эффекта** — `update` без совпадения строк не ошибка. Неполный список тоже не ошибка: статусы, которых в нём нет, сохранят прежний `sort_order` и могут столкнуться с новыми. Мок ведёт себя иначе: недостающие статусы он дописывает в конец и перенумеровывает все (`mocks/settings.ts:557-573`) → расхождение мок↔бэкенд по полноте списка.
- Save-режим: clean-slate. Перестановка drag-and-drop правит стор (`SettingsLayout.vue:464-471` → `useSettings.ts:614-622`), запрос уходит по Save — и только если что-то удалено или порядок действительно изменился (`useSettings.ts:477-486`).
- Пробел контракта: старый раздел (`03-api-contract.md:2561-2571`) обещает «атомарную перезапись порядка» — на сервере это **цикл из N отдельных `UPDATE`** с одним `commit` в конце (`crud/repository.py:296-306`), то есть атомарность держится на транзакции сессии, но частичный список приводит к неконсистентной нумерации, и контракт этого не оговаривает.
- Источник истины: бэкенд.

### PUT /api/settings/warehouse-map
- Вызывающий: `src/services/settingsService.ts:152`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1155`
- Форма запроса: `WarehouseMapFile` целиком — `{ fileId, name, mime, size, url, uploadedAt }` (`settingsService.ts:151`, тип `src/types/settings.ts:111-119`). Клиент собирает его строго из ответа `POST /api/uploads`, ничего не пересобирая (`src/composables/useWarehouseMap.ts:51-58`). Бинарник в теле не ходит никогда (комментарий `settingsService.ts:141-143`).
- Форма ответа: `WarehouseMapFile` — сохранённая карта (`settingsService.ts:151`; мок — копия записанного, `mocks/settings.ts:651-657`).
- Коды ошибок: один — `MAP_NOT_AN_IMAGE`, если `mime` не начинается с `image/` (`mocks/settings.ts:654`), доказано спекой `mocks/warehouse-map.spec.ts:73`. Клиент проверяет то же самое до отправки (`useWarehouseMap.ts:45-48`), но код ответа не читает: любая ошибка становится одним тостом `warehouse.map_toast_error_save` (`useWarehouseMap.ts:61-63`).
- Save-режим: quick-action. `replaceWith()` уходит на сервер сразу после подтверждения замены (`useWarehouseMap.ts:44-67`), Save bar настроек не участвует.
- Пробел контракта: старый раздел (`03-api-contract.md:2807-2817`) описывает поведение верно, включая обязанность сервера перепроверить `mime`. Не сказано: (а) что прежняя карта пропадает безвозвратно и обязанности удалить её файл контракт никому не назначает; (б) что `url`, `size` и `uploadedAt` сервер получает от клиента и обязан не верить им на слово — проверяется сейчас только `mime` (`mocks/settings.ts:654`).
- Источник истины: мок + клиент (бэкенда нет).

## Обязанности сервера

Заполняется как НАБЛЮДЕНИЕ: что знает мок, что знает бэкенд, где во фронте стоит константа
на месте серверного значения. Ответ «нигде» — это не решение, а строка в
`00-решения-владельца.md` с указанием домена.

- Значения по умолчанию и их владелец: четыре финансовые величины владеет `settings` и создаёт сервер сам при первом чтении — `vat_rate=21`, `default_margin=15`, `default_currency='EUR'`, `default_discount_percent=0` (`backend/app/modules/settings/shared/models.py:44-55`, автосоздание `backend/app/modules/settings/features/crud/domain.py:129-131`). Фронт держит **вторую копию тех же чисел** дефолтом состояния до ответа сервера (`frontend_vue/src/composables/useSettings.ts:27` — `vatRate: 21, defaultMargin: 15, defaultCurrency: 'EUR'`) и **третью** — сидом мока (`frontend_vue/src/services/mocks/settings.ts:52-57`). Потребители читают их из стора: НДС и маржа новой строки заказа — `useOrderCard.ts:145-148`, маржа партии — `useWarehouseBatch.ts:119`, валюта поставщика — `useSupplierCreate.ts:49`. Валюта по умолчанию при этом выражена **дважды**: флагом `Currency.isDefault` (`src/types/settings.ts:26`) и кодом в `constants.defaultCurrency` (`:17`), и `orderLines.ts:160` читает сначала первое, потом второе. Отдельно: жёсткий список валют `EUR/USD/PLN/GBP` стоит константой в карточке поставщика (`frontend_vue/src/components/admin/SupplierFormSections.vue:58-63`), хотя валютами владеет этот домен. Строка компании создаётся при регистрации из данных арендатора (`backend/app/modules/settings/internal_api/interface.py:67-79`), а вот справочники — валюты, единицы, правила пересчёта, статусы заказов — при регистрации **не создаются**: `create_tenant` пишет только сам арендатор (`backend/app/modules/auth/features/register/repository.py:46-61`), сидов в миграциях нет (`grep -rn "op.bulk_insert" backend/alembic/versions/` даёт одно попадание — `8cf3bfa380dd_phase_12_plans_multi_role.py:255`, и это фичи тарифов). Вынесено владельцу.
- События и уведомления: **мок не рождает ни одного** — `grep -c "notify" frontend_vue/src/services/mocks/settings.ts` → 0. Семь триггеров уведомлений (`frontend_vue/src/services/mocks/notifications.ts:542,566,592,616,637,657,684`) не касаются настроек ни одним: `grep -in "settings\|currenc\|uom" frontend_vue/src/services/mocks/notifications.ts` даёт только статусы заказов. На бэкенде уведомлений нет вовсе — у модуля `notifications` ноль роутов. Кому и о чём сообщать при смене валюты по умолчанию, ставки НДС или набора статусов заказа — вынесено владельцу.
- Запись в аудит-лог: **нет нигде.** `grep -c "auditLog" frontend_vue/src/services/mocks/settings.ts` → 0; в перечне сущностей ленты аудита (`roo_code/roo-context/03-api-contract.md:2717-2718` — `product|order|client|supplier|batch|stock|offcut|movement|deficit`) настроек нет. При этом сама страница логов живёт вкладкой **внутри** настроек (`frontend_vue/src/router/index.ts:391-396`), то есть домен показывает чужой аудит и не пишет свой. Вынесено владельцу.
- Кастомные поля: **у домена их нет и быть не должно** — определения полей владеет `config` (`FieldDefinition`, `/api/config/fields`), значения живут у товаров. В `settings` нет ни одного упоминания: `grep -rn "fieldDefinition\|fieldValues\|customField" frontend_vue/src/types/settings.ts frontend_vue/src/services/mocks/settings.ts backend/app/modules/settings` → пусто. Единственная точка соприкосновения — справочники этого домена (валюты, единицы) как источник значений для полей товара; правило их удаления описано в графе «Транзакционность» и в находках 5 и 7.
- Настройки, которых мок не отслеживает: три подраздела мок держит, а бэкенд не знает вовсе — **почта** (модели нет: `grep -rn "smtp\|MailServer" backend/app/modules/settings` → пусто; серверный тип формы лежит в чужом модуле и не конструируется — `backend/app/modules/bcc/features/send_request/domain.py:42-55`), **карта склада** (`grep -c warehouse_map backend/app/modules/settings/shared/models.py` → 0) и **матрица прав заказа** (шесть классов моделей — `models.py:12,32,61,86,104,136` — прав среди них нет). Обратно: мок **не отслеживает пароль смены** — `POST /api/settings/change-password` в нём no-op (`frontend_vue/src/services/mocks/index.ts:1134`), и путь ошибки под моками не воспроизводится. Мок также не хранит `exchangeRate` у валюты, который есть у сервера (`backend/app/modules/settings/features/crud/schemas.py:73`). И отдельно: `AppSettings.users` (`frontend_vue/src/types/settings.ts:245`) с сидом на шесть человек (`mocks/settings.ts:187-206`) **не заполняется ни одним эндпоинтом** — в `fetchAllSections` его нет (`useSettings.ts:217-237`), список пользователей ниоткуда не приходит.
- Мультиарендность: `tenant_id` есть у всех шести моделей домена (`backend/app/modules/settings/shared/models.py:17`, `:37`, `:66`, `:91`, `:109`, `:141`), у синглтонов — с `unique=True` (`:21`, `:41`). Выборка списков ограничена арендатором (`crud/repository.py:89`, `:143`, `:200`, `:256`). **Но восемь операций над отдельными записями арендатором не ограничены вовсе**: `get_currency`, `get_uom`, `get_conversion`, `get_order_status` ищут по одному только `id` (`crud/repository.py:94-98`, `:148-150`, `:205-209`, `:262-266`), и роуты PATCH/DELETE этих коллекций не требуют даже токена (`crud/action.py:252,266,320,334,399,413,468,482`) — см. находку 3. Исключение — `reorder`, он пишет по паре `(id, tenant_id)` (`crud/repository.py:299-302`).
- Права — в какой функции проверяются: **нигде на сервере.** В модуле нет ни одной проверки роли: `grep -rn "role" backend/app/modules/settings --include=*.py` даёт только чтение и отдачу `user.role` в профиле (`profile/domain.py:61`, `:106`). Во фронте домен закрыт одним фича-флагом на весь раздел — `adminSettings` (`frontend_vue/src/router/index.ts:355`), у вкладки логов свой флаг `settingsAuditLog` (`:395`); прав, различающих роли внутри настроек, нет. Сам домен при этом **владеет** тремя правами чужого домена и отдаёт их `GET /api/settings/order-permissions` (`mocks/settings.ts:62-66`), а применяет их `orders` (`frontend_vue/src/composables/useOrderPermissions.ts:28-30`, «сервер» мока — `mocks/orders.ts:1857`). Кто и каким правом может править сами настройки — вынесено владельцу.
- Транзакционность и идемпотентность: `Idempotency-Key` не шлётся ни на одном из 31 эндпоинта (`grep -c Idempotency frontend_vue/src/services/settingsService.ts` → 0). Одна кнопка Save порождает **до десятка независимых запросов** — восемь секций плюс по запросу на каждый добавленный/изменённый/удалённый элемент коллекций, — и все они летят одним `Promise.all` (`frontend_vue/src/composables/useSettings.ts:518`): падение любого оставляет остальные применёнными, а `takeSnapshot()` (`:520`) до `catch` (`:521`) не доходит, то есть снимок не сдвигается и следующий Save шлёт всё заново. Смена валюты по умолчанию — это N+1 запрос без общей транзакции (`SettingsLayout.vue:436-446` → PATCH каждой изменившейся валюты + PATCH констант), и инвариант «валюта по умолчанию ровно одна» держит **только клиент** (`SettingsLayout.vue:439-441`), сервер его не проверяет (`crud/domain.py:221-254`). Удаление статуса — два запроса: DELETE плюс reorder (`useSettings.ts:482-486`, `:503-505`). На стороне сервера каждый репозиторный вызов делает свой `commit` (`crud/repository.py:44`, `:51`, `:117`, `:130`, `:136` и далее), то есть в пределах одного запроса транзакция одна, между запросами — ни одной. Что обязано быть атомарным — вынесено владельцу.
- Производные значения (считать, не хранить): сервер считает при чтении три вещи. `secretLink` профиля — не колонка, а собранный URL `{frontend_url}/auth/link?token={secret_link_token}` (`backend/app/modules/settings/features/profile/domain.py:38-41`), причём при отсутствии токена он тут же генерируется и записывается (`:31-33`). `order` и `system` статуса — переименование колонок `sort_order` и `is_system` (`crud/domain.py:453-454`). `passwordSet` почты — вычисляется из наличия пароля и никогда не хранится как поле (`mocks/settings.ts:589`), пароля в типе нет вовсе (`frontend_vue/src/types/settings.ts:146-147`). Хранится, но выводимо: `exchangeRate` валюты (`models.py:74-76`) — курса во фронте нет нигде, конверсии в проекте не существует. Наоборот, **не считается то, что могло бы**: `sort_order` статусов сервер хранит и не нормализует, поэтому после удаления в середине остаются дыры (`crud/domain.py:522-534` — перенумерации нет), тогда как мок перенумеровывает (`mocks/settings.ts:579`).

## Правила домена, которых нет в контракте

Самое ценное содержимое аудита: эндпоинты машина перечислит и без человека, а правило,
живущее только в моке или доменном слое, — нет.

1. **Пароль почты пишется и не читается — правилом типа, а не дисциплиной.** Поля `password`
   нет в `MailServerSettings` (`frontend_vue/src/types/settings.ts:140-152`), поэтому положить
   секрет в стор, снимок и кэш `localStorage` физически нечем. `MailServerPayload`
   (`:179-182`) — единственное место, где поле существует, и оно только для записи. Пустая
   строка не отправляется: пустое поле формы означает «не менять», а не «стереть»
   (`useSettings.ts:366`, мок `mocks/settings.ts:600`). Доказано спекой
   `frontend_vue/src/services/mocks/mail-settings.spec.ts:25-49`.
2. **«Можно ли отправить письмо» — одно правило на весь проект.** `isMailConfigured`
   (`frontend_vue/src/types/settings.ts:167-171`) зовут гейт кнопки теста
   (`MailSettings.vue:49`), гейт кнопки Send BCC-инструмента и отказ «сервера»
   (`mocks/settings.ts:611-613`). Аргумент сужен до трёх полей (`types/settings.ts:168`),
   чтобы правило не могло незаметно начать смотреть на что-то ещё.
3. **Карта склада — единичный ресурс без истории.** PUT заменяет её целиком, версий нет,
   «загрузить новую» и «обновить» — одно действие (`settingsService.ts:140-143`). Хранится
   ровно в одном месте — `AppSettings.warehouseMap` (`types/settings.ts:243-244`); второго
   реестра карт в складском модуле быть не должно.
4. **`mime` проверяется дважды и обязан проверяться на сервере.** Атрибут `accept` фильтрует
   только диалог выбора файла и ничего не значит для перетаскивания
   (`useWarehouseMap.ts:39-42`), поэтому клиент проверяет `image/*` перед отправкой
   (`:45-48`), а «сервер» — ещё раз (`mocks/settings.ts:654`).
5. **Тест почты проверяет сервер, а не черновик.** Гейт кнопки смотрит на `settings.mail` —
   состояние, пришедшее с сервера, — а не на только что введённый пароль
   (`MailSettings.vue:44-49`), и адрес получателя не называется, пока раздел грязный
   (`:65-69`): назвать черновик значило бы соврать о получателе.
6. **Права заказа отдаются отдельным эндпоинтом намеренно.** Не потому, что это «ещё одни
   константы», а потому, что сервер обязан иметь ответ, даже когда настройки на экране не
   открыты (`mocks/settings.ts:433-442`). Пустой дефолт `{ seeCost: [], manualCost: [],
   correction: [] }` (`useSettings.ts:30`) — тоже правило: до ответа сервера не разрешено
   ничего, а флаг `settled` (`useSettings.ts:92`) отличает «сервер сказал нет» от «сервер
   ещё не отвечал».
7. **Сокрытие себестоимости в интерфейсе — занавеска, а не право.** Сервер не имеет права
   отдавать `cost`/`margin` пользователю без `seeCost`; поскольку карточка пересчитывает цены
   из себестоимости, сервер, вырезавший её, обязан прислать посчитанную цену
   (`frontend_vue/src/composables/useOrderPermissions.ts:16-21`).
8. **У часа нет правил пересчёта, и это решение.** Категория `time` добавлена ради услуг
   (`types/settings.ts:39-40`), и пустая строка в матрице честнее выдуманного коэффициента
   (`mocks/settings.ts:143-145`).
9. **Список формул пересчёта — один на проект, и тип выводится из него.** Массив
   `CONVERSION_FORMULA_TYPES` (`types/settings.ts:55-59`) задаёт и опции селекта, и подписи
   `settingsUom.formula_<имя>`, и типы полей товара; добавленная формула не может остаться без
   варианта в форме.
10. **Демо-данные держатся тех же правил, что приложение.** Карта склада в сиде — `null`
    (`mocks/settings.ts:182-185`): нарисовать ссылку на несуществующий файл значило бы показать
    пустому складу картинку, которой ни у кого нет.

## Находки про код → contract-sync-settings-bugs.md

Двадцать одна находка, все записаны в `roo_code/plans/bugs/contract-sync-settings-bugs.md`.
Код не тронут: `git status` по `frontend_vue/src` и `backend/` чист.
