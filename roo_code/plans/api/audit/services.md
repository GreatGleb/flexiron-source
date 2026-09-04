# Аудит контракта — services

Эндпоинтов в коде: **5**. Реализовано бэкендом: **0**.

Источник истины по эндпоинту: бэкенд → мок+клиент → замысел. Пустая графа = задача не закрыта.
Утверждение без `файл:строка` не записывается. Код не правится: место, где он выглядит
неверным, — находка в `roo_code/plans/bugs/contract-sync-services-bugs.md`.

> **Что общего у всех пяти разделов — чтобы не повторять это пять раз.**
>
> **Конверт.** Правило выведено соседом и не выводится заново: см. аудит settings,
> врезка «Конверт» (`roo_code/plans/api/audit/settings.md:11-15`) — бэкенд оборачивает в
> `ApiResponse`, клиент снимает обёртку в `unwrap()`, мок конверта не строит вовсе, потому что
> `getMock`/`postMock` вызываются вместо `fetch`. Для этого домена важна вторая половина: бэкенда
> у него нет, поэтому **сегодня конверта нет ни на одном из пяти вызовов** — всё, что видит
> клиент, приходит из мока голым значением (`frontend_vue/src/services/mocks/index.ts:464`,
> `:469`, `:958`, `:1240`, `:1519`). Клиент к обёртке готов: `unwrap` принимает и её, и голое
> тело (`frontend_vue/src/services/api.ts:128-141`).
>
> **Заголовки — расхождение с соседом, и это находка.** У `settings` `authHeaders()` стоит у всех
> 31 вызова (см. аудит settings, врезка «Заголовки», `settings.md:17-23`). У `services`
> **ни один из пяти вызовов не шлёт ни одного заголовка**: третьего аргумента нет нигде
> (`frontend_vue/src/services/servicesService.ts:23`, `:27`, `:40`, `:72`, `:76`), и
> `grep -c "Idempotency\|Authorization\|authHeaders" frontend_vue/src/services/servicesService.ts`
> → 0. То есть против настоящего сервера, который потребует токен, весь домен получит 401 →
> находка 5. `Idempotency-Key` не шлётся тоже — ни на POST, ни на DELETE.
>
> **Кто такие услуги.** Прайс-лист работ, который добавляется в заказ отдельной строкой.
> Каталог живой и ровно один: `mocks/orders.ts` не держит своей копии, а читает этот же STORE
> через `serviceById` (`frontend_vue/src/services/mocks/services.ts:18-20`, вызов
> `frontend_vue/src/services/mocks/orders.ts:372`), и причина записана прямо там же
> (`mocks/orders.ts:346-352`): копия на пять услуг подставляла первую попавшуюся, и услуга
> уходила в заказ под чужим именем и с чужой себестоимостью.
>
> **Цена — три поля, а не строка.** `costPrice`/`sellingPrice` + `currencyId` из справочника
> валют + `uomId` из справочника единиц (`frontend_vue/src/types/service.ts:19-31`). Союза
> `'EUR/vnt' | 'EUR/kg' | 'EUR/m' | 'EUR/h'` больше нет, и почему — записано в самом типе
> (`types/service.ts:3-18`). Отсюда зависимость домена от `settings`: оба id проверяются по
> справочникам этого соседа (`mocks/services.ts:86-93`).
>
> **Модель бэкенда осталась в старом мире.** `backend/app/modules/services/shared/models.py:28-30`
> держит `price_unit: String(20)` со значением по умолчанию `"EUR/vnt"` — ровно ту сваренную
> строку, которую фронт снял; колонок `currency_id`/`uom_id` в модели нет
> (`grep -c "currency_id\|uom_id" backend/app/modules/services/shared/models.py` → 0), и
> миграции, которая их добавила бы, нет: `services` создана один раз
> (`backend/alembic/versions/d730d0aa32ef_phase_4_services.py:26-36`) и с тех пор не менялась,
> тогда как `products` ту же миграцию прошли дважды
> (`backend/alembic/versions/bbd27a3881a5_phase_14_add_currency_uom_fk_to_products.py:4`,
> `backend/alembic/versions/a1b2c3d4e5f6_phase_15_product_uom_restructure.py:98-99` — там
> `price_unit` прямо удалён) → находка 1.
>
> **Роутов ноль.** Модуль состоит из модели и двух файлов-заглушек: `internal_api/interface.py`
> — одна строка докстринга, `shared/dependencies.py` — одна строка докстринга;
> `grep -rn "@router\." backend/app/modules/services --include=*.py` → пусто, и в
> `backend/app/main.py:66-74` подключены девять роутеров, ни одного из `services`.

## Эндпоинты

### DELETE /api/services/:id
- Вызывающий: `src/services/servicesService.ts:76`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1511`
- Форма запроса: тела нет и заголовков нет — `apiDelete(`/api/services/${id}`)`, `src/services/servicesService.ts:76` (второго аргумента `options` не передаётся, см. врезку «Заголовки»). Мок принимает любую непустую строку id: регулярка `/^\/api\/services\/([^/]+)$/` (`mocks/index.ts:1511`), проверки формата нет ни в клиенте, ни в моке. Бэкенд принял бы `uuid.UUID` (`backend/app/modules/services/shared/models.py:10` наследует `UUIDMixin`, `backend/app/core/base.py:18-22`), а мок раздаёт id вида `svc-001` (`mocks/services.ts:118`) — форматы id у фронта и у сервера разные, и это правило домену ещё не назначено.
- Форма ответа: `Promise<void>` в подписи (`servicesService.ts:75`); мок возвращает `delay(undefined as T)` (`mocks/index.ts:1519`). Тела успеха нет — ни счёта, ни id удалённого.
- Коды ошибок: один — `CATALOG_SERVICE_NOT_FOUND`, и бросает его **ветка мока, а не функция**: `mockDeleteService` возвращает `false` (`mocks/services.ts:168`), а `throw` стоит в `mocks/index.ts:1518`. Имя выбрано так, чтобы не быть подстрокой `ORDER_SERVICE_NOT_FOUND` — фронт сравнивает коды подстрокой, причина записана в `mocks/orders.ts:373-375`. Ни один код до человека не доходит: `useServices.deleteService` ловит любую ошибку и показывает один тост `services.toast_error_delete` (`frontend_vue/src/composables/useServices.ts:45-47`), кода в нём нет. Проверки «услуга используется в заказах» нет нигде: `mockDeleteService` (`mocks/services.ts:166-171`) смотрит только на существование.
- Save-режим: quick-action. `confirmDelete` открывает модалку подтверждения (`frontend_vue/src/views/admin/products/ServicesPage.vue:110-113`), `handleDelete` шлёт запрос сразу (`:115-120`), после успеха список перезапрашивается (`useServices.ts:44`).
- Пробел контракта: старый раздел (`roo_code/roo-context/03-api-contract.md:1195-1199`) неверен в двух местах из трёх. Обещанного кода `SERVICE_NOT_FOUND` в коде нет — реальный `CATALOG_SERVICE_NOT_FOUND` (`mocks/services.ts:134`, `:151`, `mocks/index.ts:1518`), и это не опечатка, а осознанное имя (`mocks/orders.ts:373-375`). Обещанного 409 `SERVICE_IN_USE` нет **нигде**: `grep -rn "SERVICE_IN_USE" backend/app frontend_vue/src` → пусто, удаление используемой заказами услуги проходит. Не сказано и то, что заказ переживает удаление: строка заказа хранит снимок имени и себестоимости на момент добавления (`mocks/orders.ts:2415-2425`), поэтому старые документы не рушатся, а вот **добавить** удалённую услугу в заказ уже нельзя — `serviceEntry` бросает (`mocks/orders.ts:372-376`).
- Источник истины: мок + клиент (бэкенда нет — роутов у модуля ноль, `backend/app/main.py:66-74`).

### GET /api/services
- Вызывающий: `src/services/servicesService.ts:23`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:454`
- Форма запроса: пять query-параметров, все пять шлются **всегда**, даже пустыми — `{ search, sortBy, sortDir, page, pageSize }`, собираются в `Record<string,string>` (`servicesService.ts:16-23`). `search` — подстрока, `sortBy` ∈ `'name' | 'costPrice' | 'sellingPrice' | 'createdAt'` (`frontend_vue/src/types/service.ts:38`), `sortDir` ∈ `'asc' | 'desc'` (`:39`), `page`/`pageSize` — числа строками (`servicesService.ts:20-21`). Мок читает те же пять и подставляет дефолты, если параметра нет: `search=''`, `sortBy='name'`, `sortDir='asc'`, `page=1`, `pageSize=25` (`mocks/index.ts:455-463`).
- Форма ответа: `PaginatedResponse<Service>` — `{ items, total, page, pageSize, totalPages }` (`frontend_vue/src/types/api.ts:8-14`), элемент — `Service` целиком: `id`, `name: TranslatedString`, `costPrice`, `sellingPrice`, `currencyId`, `uomId`, `description?`, `createdAt`, `updatedAt` (`types/service.ts:19-31`). `ServiceListItem` — это псевдоним `Service`, помеченный `@deprecated` (`types/service.ts:33-34`), то есть отдельной облегчённой формы списка у домена нет: `toListItem` перечисляет ровно те же девять полей (`mocks/services.ts:26-38`). `total` — длина после фильтра, `totalPages` — `Math.ceil(total / pageSize)` (`mocks/services.ts:69-75`).
- Коды ошибок: ни одного — в `mockGetServices` (`mocks/services.ts:40-76`) нет ни одного `throw`. Непонятный `sortBy` не ошибка, а «не сортировать»: три `else if` без ветки по умолчанию (`mocks/services.ts:61-64`) оставляют `cmp = 0`. `page` за концом списка — пустой `items`, не 404 (`:72-73`). Клиент кладёт текст ошибки в `error` и показывает его как есть (`useServices.ts:33-35`).
- Save-режим: чтение. Два потребителя с разными привычками. Список страницы — `onMounted → load()` плюс watch на фильтры и на пару `page/pageSize` (`useServices.ts:53-69`), серверная пагинация по 25 (`:18`). Модалка добавления услуг в заказ — **тянет весь каталог одним запросом** `pageSize: 1000` и пагинирует его у себя (`frontend_vue/src/views/admin/orders/AddOrderServicesModal.vue:210-213`, локальный срез `:201-204`), запрос уходит при каждом открытии модалки (`:222-233`).
- Пробел контракта: старый раздел (`03-api-contract.md:1151-1176`) описывает форму верно, но: (а) перечисляет три значения `sortBy` вместо четырёх — `createdAt` пропущен (`types/service.ts:38`); (б) называет параметры необязательными (`search?`, `sortBy?`), тогда как клиент шлёт все пять всегда (`servicesService.ts:16-22`) — сервер не имеет права требовать их отсутствия; (в) в примере ответа у элемента нет `createdAt`/`updatedAt`, хотя тип их требует (`types/service.ts:29-30`); (г) не сказано, что сортировка по имени идёт **по английскому варианту при любом языке интерфейса** (`mocks/services.ts:61` — `a.name.en.localeCompare(b.name.en)`), а поиск смотрит во все три (`:51-53`); (д) не сказано про потребителя с `pageSize: 1000`, а он определяет верхнюю границу, которую сервер обязан разрешить.
- Источник истины: мок + клиент.

### GET /api/services/:id
- Вызывающий: `src/services/servicesService.ts:27`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:467`
- Форма запроса: ни query, ни тела, ни заголовков — `apiGet<Service>(`/api/services/${id}`)` (`servicesService.ts:27`); id берётся из маршрута `products/services/:id` (`frontend_vue/src/router/index.ts:247`).
- Форма ответа: `Service` целиком, те же девять полей (`types/service.ts:19-31`); мок отдаёт `{ ...svc }` (`mocks/services.ts:135`) — поверхностную копию, то есть `name` и `description` уходят наружу **той же ссылкой**, что лежит в сторе. У соседнего домена то же место сделано иначе: `mocks/orders.ts:1359-1361` определяет `clone()` через `JSON.parse(JSON.stringify(...))` и отдаёт наружу его → находка 8.
- Коды ошибок: один — `CATALOG_SERVICE_NOT_FOUND` (`mocks/services.ts:134`). До человека доходит не код, а факт ошибки: `useServiceCard.load` кладёт `e.message` в `error` (`frontend_vue/src/composables/useServiceCard.ts:57-59`), а страница на любую непустую `error` рисует «сущность не найдена» (`frontend_vue/src/views/admin/products/ServiceCardPage.vue:62-78`) — то есть сетевой сбой выглядит как удалённая услуга.
- Save-режим: чтение, `onMounted → load()` (`ServiceCardPage.vue:52-55`). Рядом вторым запросом идёт `loadSettings()` (`:54`) — карточке нужны справочники валют и единиц, чтобы построить селекты (`:47-50`).
- Пробел контракта: старый раздел (`03-api-contract.md:1207-1226`) обещает код `SERVICE_NOT_FOUND` (в коде `CATALOG_SERVICE_NOT_FOUND`), показывает в примере `"description": null` — тогда как тип объявляет поле необязательным, а не обнуляемым (`types/service.ts:28`), и мок кладёт туда `undefined` (`mocks/services.ts:113`), — и теряет `updatedAt`, показывая `createdAt` датой `"2025-01-15"` вместо ISO-момента (`mocks/services.ts:125-126` — `new Date().toISOString()`).
- Источник истины: мок + клиент.

### PATCH /api/services/:id
- Вызывающий: `src/services/servicesService.ts:72`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1238`
- Форма запроса: merge-patch, только грязные поля — `{ name?: TranslatedString; costPrice?: number; sellingPrice?: number; currencyId?: string; uomId?: string; description?: TranslatedString }` (`servicesService.ts:60-72`). Подпись принимает `name`/`description` **строкой или `TranslatedString`** (`:54-57`) и нормализует их через `toPayloadValue` (`:43-50`): строка превращается в `TranslatedString` текущего языка, то есть **два других языка становятся пустыми** (`frontend_vue/src/types/i18n.ts:19-25`). Карточка сюда строку не отдаёт — она правит через `mergeLocaleValue` и хранит `TranslatedString` (`ServiceCardPage.vue:27-39`), — но подпись это разрешает. `null` не доходит до провода: `toPayloadValue` возвращает `undefined` (`servicesService.ts:47`), а `undefined` в тело не кладётся (`:62`, `:71`) → находка 6. `currencyId`/`uomId` проверяются на истинность, а не на `!== undefined` (`:65-66`), — пустая строка молча не отправится.
- Форма ответа: `Service` целиком, обновлённый (`servicesService.ts:59`, мок `mocks/services.ts:163`). Мок правит запись **в сторе на месте** (`:153-161`) и возвращает поверхностную копию; `updatedAt` пересчитывается сервером (`:162`).
- Коды ошибок: три. `CATALOG_SERVICE_NOT_FOUND` (`mocks/services.ts:151`), `SERVICE_CURRENCY_NOT_FOUND` и `SERVICE_UOM_NOT_FOUND` (`:88`, `:91`) — последние два бросаются при правке валюты или единицы, причём проверяется **итоговая пара**, а не присланное поле: `assertKnownPricing(data.currencyId ?? svc.currencyId, data.uomId ?? svc.uomId)` (`:157`). Ни один код не подстрока другого. Все три проверены спекой (`frontend_vue/src/domain/servicePricing.spec.ts:94-108`). До человека ни один не доходит: `useServiceCard.save` ловит всё и показывает `services.toast_error_save` (`useServiceCard.ts:86-88`).
- Save-режим: clean-slate. Правки живут в `form`, `useDirtyCheck` считает грязь и выдаёт дельту (`useServiceCard.ts:38`, `:68`), кнопка Save активна только при `isAnythingDirty` (`ServiceCardPage.vue:100-108`), Discard возвращает форму к последнему ответу сервера (`useServiceCard.ts:93-104`). Пустая дельта запроса не порождает (`:69`).
- Пробел контракта: старый раздел (`03-api-contract.md:1228-1243`) объявляет `description?: TranslatedString | null` — `null` до сервера не доходит никогда (находка 6), то есть описание нельзя стереть, и это надо либо чинить, либо записывать как правило. «Last-write-wins» подтверждается (`mocks/services.ts:153-161` — ни версии, ни `If-Match`), но не сказано, что версионирования нет намеренно, тогда как у заказов оно есть (`mocks/orders.ts:2403` — `assertVersion`, а сама проверка `mocks/orders.ts:1938`). Не названы два из трёх кодов (`SERVICE_CURRENCY_NOT_FOUND`, `SERVICE_UOM_NOT_FOUND`) и не сказано, что валюта с единицей проверяются по справочникам чужого домена.
- Источник истины: мок + клиент.

### POST /api/services
- Вызывающий: `src/services/servicesService.ts:40`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:957`
- Форма запроса: шесть полей, `name` и `description` — уже `TranslatedString`, собранные клиентом из строки формы по текущему языку (`servicesService.ts:31-39`, `types/i18n.ts:19-25`). То есть услуга рождается переведённой **на один язык**, два других пусты. `description` не передаётся вовсе, если его нет (`servicesService.ts:37-38`). Обязательность: тип требует `name`, `costPrice`, `sellingPrice`, `currencyId`, `uomId` (`types/service.ts:42-49`), но **на проводе обязательным не проверяется ничто**: мок не смотрит на `name` вовсе (`mocks/services.ts:95-130`), единственная проверка — `if (!createForm.name.trim()) return` в форме (`ServicesPage.vue:83`). Отрицательную цену не отвергает никто.
- Форма ответа: `Service` целиком с серверными `id`, `createdAt`, `updatedAt` (`mocks/services.ts:117-127`).
- Коды ошибок: два — `SERVICE_CURRENCY_NOT_FOUND` и `SERVICE_UOM_NOT_FOUND` (`mocks/services.ts:88`, `:91`, вызов `:115`). Обещанного старым контрактом `VALIDATION_ERROR` на отсутствующее `name` мок не бросает. До человека ни один код не доходит: `handleCreate` ловит всё и показывает `services.toast_error` (`ServicesPage.vue:105-107`).
- Save-режим: quick-action. Модалка «создать услугу» на странице списка, POST уходит по submit (`ServicesPage.vue:82-108`), после успеха форма сбрасывается к дефолтам и список перезапрашивается (`:96-104`).
- Пробел контракта: старый раздел (`03-api-contract.md:1178-1193`) объявляет `costPrice?`/`sellingPrice?` с дефолтом 0 — клиент шлёт их всегда (`servicesService.ts:33-34`), а дефолт 0 живёт в форме (`ServicesPage.vue:57-58`) и в модели бэкенда (`backend/app/modules/services/shared/models.py:22-27`). Обещает 422 `VALIDATION_ERROR` без `name` — такой проверки нет ни в моке, ни на сервере. И честно называет `'cur-eur'`/`'uom-pcs'` «клиент шлёт по умолчанию» (`:1187-1188`), но не говорит, что это **константы во фронте на месте настройки арендатора** (`ServicesPage.vue:59-60`, `:100-101`) — см. графу «Значения по умолчанию».
- Источник истины: мок + клиент.

## Обязанности сервера

Заполняется как НАБЛЮДЕНИЕ: что знает мок, что знает бэкенд, где во фронте стоит константа
на месте серверного значения. Ответ «нигде» — это не решение, а строка в
`00-решения-владельца.md` с указанием домена.

- Значения по умолчанию и их владелец: у домена их два, и оба стоят **константой во фронте**. Новая услуга рождается с `currencyId: 'cur-eur'` и `uomId: 'uom-pcs'` — зашито в форму создания дважды, при объявлении и при сбросе (`frontend_vue/src/views/admin/products/ServicesPage.vue:59-60` и `:100-101`), — хотя валютами и единицами владеет `settings` и дефолтная валюта у него выражена двумя способами (см. аудит settings, графа «Значения по умолчанию», `roo_code/plans/api/audit/settings.md:398`: флаг `Currency.isDefault` и код в `constants.defaultCurrency`). Ни один из двух не читается ни здесь, ни в карточке. Цены по умолчанию — нули, и они совпадают в трёх местах: форма (`ServicesPage.vue:57-58`), карточка до загрузки (`frontend_vue/src/composables/useServiceCard.ts:29-30`) и модель бэкенда (`backend/app/modules/services/shared/models.py:22-27`, `server_default="0"`). Карточка при этом дефолт валюты и единицы сознательно **не** подставляет — пустая строка, и почему, записано там же (`useServiceCard.ts:31-35`): подставленное значение стало бы записанным при первом же Save. Кто владеет дефолтной валютой и единицей новой услуги — вынесено владельцу.
- События и уведомления: **нет нигде.** `grep -c "notify" frontend_vue/src/services/mocks/services.ts` → 0; семь триггеров уведомлений (`frontend_vue/src/services/mocks/notifications.ts`) услуг не касаются ни одним — `grep -in "service" frontend_vue/src/services/mocks/notifications.ts` → пусто. На бэкенде уведомлений нет вовсе: у модуля `notifications` роутов ноль. При этом событие, о котором есть что сообщать, у домена очевидно есть — изменение цены услуги, уже стоящей в незакрытых заказах: строка заказа хранит снимок себестоимости (`frontend_vue/src/services/mocks/orders.ts:2415-2422`), и после правки прайса заказ и каталог расходятся молча. Вынесено владельцу.
- Запись в аудит-лог: **нет нигде.** `grep -c "auditLog" frontend_vue/src/services/mocks/services.ts` → 0; в ленте аудита услуг нет ни строки — `grep -n "service" frontend_vue/src/services/mocks/auditFeed.ts` → пусто, и в перечне сущностей ленты (`roo_code/roo-context/03-api-contract.md:2717-2718` — `product|order|client|supplier|batch|stock|offcut|movement|deficit`) услуги не значатся. Между тем правка `costPrice` — это правка себестоимости, то есть ровно тот класс, который у заказов помечается `sensitive` и прячется правом `seeCost` (`frontend_vue/src/services/mocks/orders.ts:1902`). Вынесено владельцу.
- Кастомные поля: **у домена их нет.** `grep -rn "fieldValues\|fieldDefinition\|customField" frontend_vue/src/types/service.ts frontend_vue/src/services/mocks/services.ts backend/app/modules/services` → пусто. Определениями полей владеет `config` (`FieldDefinition`, `/api/config/fields`), значениями — товары; услуга не участвует ни там, ни там. Единственная точка соприкосновения со справочниками — `currencyId`/`uomId`, и она описана в графе «Транзакционность».
- Настройки, которых мок не отслеживает: три. **Арендатора** мок не знает вовсе — `STORE` один на процесс (`frontend_vue/src/services/mocks/services.ts:8`), тогда как у модели бэкенда `tenant_id` есть (`backend/app/modules/services/shared/models.py:15-20`). **Языка каталога** мок не фиксирует: `mockCreateService` пишет перевод того языка, в котором сидел админ (`mocks/services.ts:106-107`), а заказы читают каталог жёстко по-английски — `CATALOGUE_LANGUAGE = 'en'` (`frontend_vue/src/services/mocks/orders.ts:369`), с объяснением, почему выбор принадлежит каталогу, а не читателю (`mocks/orders.ts:353-368`); значит, услуга, созданная в русском сеансе, придёт в заказ **пустым именем**. И обратно: мок **строже** будущего сервера — он проверяет `currencyId`/`uomId` по справочнику `settings` (`mocks/services.ts:86-93`), тогда как в схеме бэкенда этих колонок нет вовсе (врезка, находка 1), то есть внешнего ключа, который держал бы то же правило, на сервере не существует.
- Мультиарендность: `tenant_id` у модели есть — `ForeignKey("tenants.id", ondelete="CASCADE")`, `nullable=False`, `index=True` (`backend/app/modules/services/shared/models.py:15-20`), и в миграции так же (`backend/alembic/versions/d730d0aa32ef_phase_4_services.py:28`). Чем ограничена выборка — проверить не на чем: запросов нет, роутов нет, репозитория у модуля нет (`ls backend/app/modules/services/features/` — только `__init__.py` и `__pycache__`). Мок арендатора не моделирует (`mocks/services.ts:8`). То есть колонка есть, правила её применения нет ни в одной строке кода — это не «нигде», а «ещё не написано»: правило появится вместе с первым слайсом.
- Права — в какой функции проверяются: **нигде.** На сервере проверять нечему — роутов ноль. Во фронте домен закрыт одним фича-флагом на оба маршрута — `adminServices` (`frontend_vue/src/router/index.ts:244`, `:250`, значение `frontend_vue/src/config/featureFlags.ts:21`), а флаг — это тариф, а не роль. Роль не спрашивается ни разу: `grep -rn "seeCost\|role" frontend_vue/src/composables/useServices.ts frontend_vue/src/composables/useServiceCard.ts frontend_vue/src/views/admin/products/ServicesPage.vue` → пусто. Следствие видно рядом: себестоимость услуги показана **всем**, у кого включён флаг, — колонкой в таблице (`ServicesPage.vue:274`) и полем в карточке (`frontend_vue/src/views/admin/products/ServiceCardPage.vue:131`), тогда как в заказах ровно та же величина закрыта правом `seeCost` (`frontend_vue/src/composables/useOrderPermissions.ts:28`, «сервер» мока — `frontend_vue/src/services/mocks/orders.ts:1390-1393`), и правило сформулировано как обязанность сервера, а не интерфейса (`useOrderPermissions.ts:17-21`). Кто имеет право видеть и править прайс — вынесено владельцу.
- Транзакционность и идемпотентность: `Idempotency-Key` не шлётся ни на одном из пяти вызовов (`grep -c "Idempotency" frontend_vue/src/services/servicesService.ts` → 0), поэтому повторный POST по таймауту создаст вторую услугу — уникальности имени не проверяет никто (`mocks/services.ts:95-130`). Каждая операция домена — один запрос, многозапросного Save, как у настроек, здесь нет: карточка шлёт ровно один PATCH (`useServiceCard.ts:70-74`). Откатывать внутри домена нечего. А вот **связность с соседями не держит никто**: удаление услуги не смотрит на заказы (`mocks/services.ts:166-171`), удаление валюты или единицы из справочника не смотрит на услуги — `remove_currency_item` считает только товары (`backend/app/modules/settings/features/crud/domain.py:262-266`), `remove_uom_item` тоже (`:338-342`), и услуг в этом счёте нет ни в одном из двух; в моке проверки использования нет вовсе (см. аудит settings, находки 5 и 7). То есть услуга может остаться с `currencyId`, которого больше нет, и подпись цены станет прочерком (`frontend_vue/src/domain/servicePricing.ts:25`). Что должно быть атомарным и что запрещать — вынесено владельцу.
- Производные значения (считать, не хранить): три. **Подпись цены** «EUR/шт» — функция, а не поле, и в типе поля намеренно нет (`frontend_vue/src/types/service.ts:13-17`, реализация `frontend_vue/src/domain/servicePricing.ts:16-27`); код единицы берётся в языке читателя, а не каталога, и почему — записано там же (`servicePricing.ts:11-14`), доказано спекой (`frontend_vue/src/domain/servicePricing.spec.ts:17-23`). **`totalPages`** считается при чтении из `total` и `pageSize` (`mocks/services.ts:75`). **`createdAt`/`updatedAt`** ставит сервер и только он: мок — при создании и при каждой правке (`mocks/services.ts:125-126`, `:162`), модель бэкенда — `server_default=func.now()` и `onupdate=func.now()` (`backend/app/core/base.py:28-37`). Наоборот, **хранится то, что могло бы считаться**: имя и себестоимость услуги дублируются в строку заказа снимком (`mocks/orders.ts:2415-2422`) — это не дефект, а решение (документ не должен переписываться задним числом), но сервер обязан знать, что оно принято.

## Правила домена, которых нет в контракте

Самое ценное содержимое аудита: эндпоинты машина перечислит и без человека, а правило,
живущее только в моке или доменном слое, — нет.

1. **Каталог услуг ровно один, и заказы читают его живым.** `serviceById`/`allServices`
   экспортируются именно для этого (`frontend_vue/src/services/mocks/services.ts:10-24`), а
   модуль заказов держит на них ссылку вместо копии (`frontend_vue/src/services/mocks/orders.ts:121`,
   `:346-352`). Цена копии записана прямо в комментарии: услуга, созданная позже, уходила в
   заказ под именем и себестоимостью первой из пяти, а исправленная себестоимость не доходила
   до заказа никогда. Сервер обязан держать то же: один прайс, читаемый заказом по ссылке.
2. **Валюта и единица — ссылки на справочник, а не строка, и проверяются, а не приводятся
   типом.** `assertKnownPricing` (`mocks/services.ts:86-93`) отвергает неизвестный id при
   создании и при правке; на месте проверки раньше стоял непроверенный каст, через который
   старое значение `'EUR/kg'` пролезло бы молча (`mocks/services.ts:78-85`). Спека держит оба
   пути и обе стороны (`frontend_vue/src/domain/servicePricing.spec.ts:70-108`).
3. **Подпись цены собирается там, где её показывают.** Поля-подписи в типе нет намеренно
   (`frontend_vue/src/types/service.ts:13-17`); у товара такое поле было, жило ради одного места
   и собирало подпись всегда по-английски — удалено вместе с ним. Сервер не должен присылать
   `"EUR/шт"`: это вторая правда об одной величине.
4. **Код единицы берётся в языке читателя, а не каталога.** `serviceUnitLabel` спрашивает
   `uomCode(uomId, uoms, locale)` (`frontend_vue/src/domain/servicePricing.ts:24`), и литовская
   подпись обязана остаться `EUR/vnt`, а не стать `EUR/pcs`
   (`frontend_vue/src/domain/servicePricing.spec.ts:17-23`).
5. **Имя каталога, наоборот, в языке каталога, а не читателя.** `CATALOGUE_LANGUAGE = 'en'`
   (`frontend_vue/src/services/mocks/orders.ts:369`) — снимок имени, попадающий в заказ, обязан
   быть одним, а не тем, на каком языке сидел вводивший; и это код, который сервер физически
   может исполнить, в отличие от чтения языка из браузера (`mocks/orders.ts:353-368`).
6. **Неизвестный id даёт прочерк, а не выдуманную подпись.** `serviceUnitLabel` возвращает `—`,
   если валюта или единица не нашлись (`frontend_vue/src/domain/servicePricing.ts:25`,
   спека `servicePricing.spec.ts:29-32`). Это и есть поведение при удалённом справочнике.
7. **У часа нет правил пересчёта, и это решение.** Категория `time` заведена ради услуг, и
   пустая строка в матрице честнее выдуманного коэффициента — правило выведено соседом,
   см. аудит settings, «Правила домена», п. 8 (`roo_code/plans/api/audit/settings.md:447-449`);
   доказательство со стороны услуг — `frontend_vue/src/domain/servicePricing.spec.ts:44-51`.
8. **Код «услуги нет в каталоге» не имеет права быть подстрокой кода «в заказе нет такой
   строки».** Отсюда `CATALOG_SERVICE_NOT_FOUND` вместо `SERVICE_NOT_FOUND` — фронт сравнивает
   коды подстрокой, и два разных отказа читались бы как один
   (`frontend_vue/src/services/mocks/orders.ts:373-375`).
9. **Удаление несуществующей услуги — отказ, а не молчаливый успех.** Проверка `if (!deleted)`
   не срабатывала никогда, пока перед `mockDeleteService` не появился `await`: промис всегда
   истинен (`frontend_vue/src/services/mocks/index.ts:1513-1518`). Правило домена: DELETE
   идемпотентным **не** является.
10. **Демо-каталог держится тех же правил, что приложение.** Все пять сеяных услуг ссылаются на
    существующие валюту и единицу, и ни у одной не осталось сваренной строки — это не
    договорённость, а спека (`frontend_vue/src/domain/servicePricing.spec.ts:55-68`).

## Находки про код → contract-sync-services-bugs.md

Восемь находок, все записаны в `roo_code/plans/bugs/contract-sync-services-bugs.md`.
Код не тронут: `git status` по `frontend_vue/src` и `backend/` чист.
