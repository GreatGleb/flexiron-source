# Settings

Настройки арендатора: реквизиты компании, четыре финансовые константы, справочники валют и
единиц измерения, правила пересчёта, статусы заказа, права заказа, профиль текущего
пользователя со сменой пароля, почтовый сервер и карта склада. **Домен владеет справочниками,
которыми пользуется весь проект** — валютой, единицами, формулами пересчёта, статусами и
четырьмя числами (НДС, маржа, валюта по умолчанию, скидка), — поэтому его ответы читают ещё
восемь доменов.

Общие правила — [`00-conventions.md`](00-conventions.md) в этом каталоге; здесь они не
повторяются, а вызываются ссылкой. Аудит по коду, с `файл:строка` на каждое утверждение —
[`plans/api/audit/settings.md`](../../plans/api/audit/settings.md). Находки про код —
[`contract-sync-settings-bugs.md`](../../plans/bugs/contract-sync-settings-bugs.md), 21 штука.
Вопросы, на которые нет ответа нигде в коде, — 17 строк в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
`settings`.

**Источник истины этого домена — бэкенд.** `backend/app/modules/settings/` реализует **24
эндпоинта из 31** — это самый крупный реализованный модуль проекта. Формы запросов и ответов
ниже сняты со схем бэкенда; там, где фронт с ними расходится, стоит пометка и номер находки.
Семь эндпоинтов серверной части не имеют вовсе, и у них источник истины — мок и клиент: три
эндпоинта карты склада, два почтовых, тест почты и права заказа. У каждого раздела строка
`Бэкенд:` говорит, что именно из двух.

Потребители: [`services/settingsService.ts`](../../../frontend_vue/src/services/settingsService.ts)
— единственный клиент домена, 31 функция; экраны —
[`views/admin/settings/`](../../../frontend_vue/src/views/admin/settings/) (семь вкладок под
`SettingsLayout.vue`), состояние и Save —
[`composables/useSettings.ts`](../../../frontend_vue/src/composables/useSettings.ts), карта
склада отдельно — [`composables/useWarehouseMap.ts`](../../../frontend_vue/src/composables/useWarehouseMap.ts).

Четыре вещи, верные для всех 31 эндпоинта сразу — чтобы не повторять их 31 раз:

- **Заголовки.** Все 31 вызова идут с `Authorization: Bearer <token>` из локального
  `authHeaders()` (`services/settingsService.ts:18-22`). Это **вторая копия** канонического
  `useAuth.authHeaders()`, и она читает только `localStorage` (`settingsService.ts:19`), тогда
  как вход кладёт токен в `localStorage` **или** в `sessionStorage`
  (`composables/useAuth.ts:36`): вошедший без «запомнить меня» получит 401 на всех 24
  реализованных роутах — БАГ-06, правило — `00-conventions.md` §5.
- **`X-CSRF-Token` домен не шлёт ни на одном эндпоинте**, и сервер его не проверяет нигде
  (`00-conventions.md` §5).
- **`Idempotency-Key` не шлётся ни на одном из 31**
  (`grep -c "Idempotency" frontend_vue/src/services/settingsService.ts` → 0). Нужен ли он
  создающим эндпоинтам домена — строка владельцу.
- **Пагинации нет ни у одного из четырёх списочных GET**: справочники отдаются целиком, без
  `page`/`pageSize` (`settingsService.ts:53`, `:71`, `:89`, `:107`). Правило
  `00-conventions.md` §13 к домену не применяется.

**Проверка токена на сервере продублирована.** `_resolve_user_id` существует в модуле в двух
посимвольно одинаковых копиях — `crud/action.py:97-128` и `profile/action.py:41-72` (БАГ-03), и
ни одна не передаёт `max_age`, тогда как `auth` на том же токене требует `max_age=86400`
(`backend/app/modules/auth/features/me/action.py:52`) — то есть сессия у настроек не истекает
(БАГ-02). Арендатор выводится из пользователя в `_get_tenant` (`crud/action.py:131-139`).

**Восемь роутов из 24 не требуют токена вовсе** — PATCH и DELETE у всех четырёх коллекций
(`crud/action.py:252`, `:266`, `:320`, `:334`, `:399`, `:413`, `:468`, `:482`): в подписи каждой
из восьми стоит один только `Depends(get_db)`, а `_resolve_user_id` не стоит ни в одной
(`grep -c _resolve_user_id` по каждому из восьми диапазонов подписи → 0, при том что у
реализованных GET он есть — `crud/action.py:146-156` → 1). Глобального auth-мидлвара тоже нет:
единственный `add_middleware` во всём бэкенде — CORS
(`backend/app/core/middleware/cors.py:9`, подключение — `backend/app/main.py:58`). Это БАГ-01, и оно же лишает эти восемь операций
фильтра по арендатору (см. «Обязанности сервера», графа мультиарендности). **Для бэкенда это
задача:** контракт требует токен на всех 31.

**Конверт не умеет списки.** `ApiResponse.data` объявлен `dict | None`
(`backend/app/core/schemas.py:33`), а четыре списочных GET домена кладут в него **список**
(`crud/action.py:222`, `:301`, `:369`, `:437`). Больше ни один модуль так не делает — БАГ-04.
Форма на проводе при этом верна, и контракт описывает именно её: `data` — массив.

---

## Компания и константы

### GET /api/settings/company

Реквизиты компании арендатора. Чтение; один из девяти параллельных запросов `fetchAllSections()`
(`useSettings.ts:228`), собранных через `Promise.allSettled` (`:227`) — падение одного раздела не
рушит остальные.

Ответ — `CompanyInfo` (`types/settings.ts:4-11`):

```ts
{
  name: string
  legalAddress: string
  vatCode: string
  bankName: string
  bankAccount: string
  logoUrl?: string
}
```

**Пять строковых полей на выходе непусты**: `None` из базы сервер заменяет на `""`
(`crud/domain.py:77-84`); `logoUrl` — единственное, что может прийти `null`
(`crud/schemas.py:23`). Ключи camelCase через алиасы схемы (`crud/schemas.py:19-23`) и
`by_alias=True` при сериализации (`crud/action.py:156`).

**Строку компании создаёт сервер сам, и 404 по ней недостижим.** При регистрации её пишет
`init_company_info` (`backend/app/modules/settings/internal_api/interface.py:67-79`, вызов —
`backend/app/modules/auth/features/register/domain.py:106`); если её всё-таки нет, она создаётся
прямо в обработчике чтения, с подстановкой имени и НДС-кода арендатора (`crud/domain.py:67-76`).

Ошибки: `UNAUTHORIZED` (401 — нет токена, битая подпись; `crud/action.py:108`, `:115`, `:127`),
`NOT_FOUND` (404 — у пользователя нет арендатора; `crud/action.py:135-138`). Своего кода нет ни
одного; мок не бросает ничего.

Бэкенд: `backend/app/modules/settings/features/crud/action.py:146` · схемы `crud/schemas.py:15-25`
Реализация: `services/settingsService.ts:26` · мок `mocks/index.ts:381` → `mocks/settings.ts:413-415`

### PATCH /api/settings/company

Правит реквизиты. Save-режим: clean-slate — правки идут в стор через `updateCompany`
(`useSettings.ts:531-535`), запрос уходит по общей кнопке Save (`useSettings.ts:347-350`).

Запрос — `CompanyPatchInput`: те же шесть полей, все необязательные, camelCase-алиасы
(`crud/schemas.py:28-38`).

**`None` означает «не менять», поэтому обнулить поле в `null` через этот эндпоинт нельзя**
(`crud/domain.py:103-106`); пустая строка при этом проходит и записывается.

**Клиент шлёт секцию целиком, а не дельту** — `saveCompany({ ...settings.company })`
(`useSettings.ts:348`). Общее правило PATCH (`00-conventions.md` §3) сервер обязан соблюдать всё
равно: тело — merge-patch, и слать дельту вправе любой другой вызывающий.

Ответ: `CompanyInfo` целиком после слияния (`crud/action.py:168-172`).

Ошибки: общие `UNAUTHORIZED`/`NOT_FOUND`; своих нет. **Валидации нет ни на одной стороне** — ни
НДС-код, ни IBAN не проверяются (`crud/domain.py:94-112` — только перекладывание значений).

**`logoUrl` сервер обязан не принимать на веру.** Клиент кладёт в это поле data-URL для
мгновенного превью (`views/admin/settings/SettingsLayout.vue:334-337`) и заменяет его ссылкой
сервера, когда загрузка закончится (`SettingsLayout.vue:344-348`); если Save нажать до этого
момента, data-URL уедет в колонку `Text` (`shared/models.py:29`) — БАГ-18. Логотип
обязан приходить как ссылка от `POST /api/uploads` (`00-conventions.md` §16).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:160` · схемы `crud/schemas.py:28-38`
Реализация: `services/settingsService.ts:30` · мок `mocks/index.ts:1339` → `mocks/settings.ts:422-425`

### GET /api/settings/constants

Четыре финансовые константы арендатора. Чтение, запрос №2 из девяти (`useSettings.ts:229`).

Ответ — `GlobalConstants` (`types/settings.ts:14-19`):

```ts
{ vatRate: number; defaultMargin: number; defaultCurrency: string; defaultDiscountPercent: number }
```

`defaultCurrency` — **код** валюты (`EUR`), а не её `id`: колонка `String(10)`
(`shared/models.py:50-52`). Числа приводятся из `Numeric` во `float` (`crud/domain.py:132-137`).

**Строка констант создаётся при первом чтении**, со значениями `vat_rate=21`,
`default_margin=15`, `default_currency='EUR'`, `default_discount_percent=0`
(`crud/domain.py:129-131`, дефолты — `shared/models.py:44-55`). То есть эти четыре числа
появляются у арендатора без единого действия человека, и «EUR» назначает сервер. Кто владеет
этими значениями и почему их копии во фронте — дефект, см. «Обязанности сервера».

Ошибки: общие `UNAUTHORIZED`/`NOT_FOUND`; своих нет, мок не бросает ничего
(`mocks/settings.ts:429-431`).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:179` · схемы `crud/schemas.py:43-51`
Реализация: `services/settingsService.ts:42` · мок `mocks/index.ts:382` → `mocks/settings.ts:429-431`

### PATCH /api/settings/constants

Правит константы. Save-режим: clean-slate, `updateConstants` правит стор
(`useSettings.ts:536-540`), запрос по Save (`useSettings.ts:353-356`). Клиент и здесь шлёт
секцию целиком (`useSettings.ts:354`).

Запрос — `ConstantsPatchInput`: четыре необязательных поля, camelCase-алиасы
(`crud/schemas.py:54-62`); `None` = «не менять» (`crud/domain.py:154-157`).

Ответ: `GlobalConstants` целиком после слияния (`crud/action.py:201-205`).

Ошибки: общие; своих нет. **Ни одна из четырёх величин не проверяется**: `vatRate` и проценты
принимаются отрицательными и больше 100, а `defaultCurrency` не сверяется со списком валют
арендатора — в `patch_global_constants` нет ни одного обращения к валютам
(`crud/domain.py:140-170`). Прежний контракт обещал такую сверку; правила нет нигде, и его
введение — решение владельца (строка «какой из двух источников валюты по умолчанию главный»).

**Смена валюты по умолчанию — это два разных запроса, а не один.** Клиент ставит `isDefault`
всем валютам локально и шлёт PATCH на каждую изменившуюся плюс PATCH констант
(`views/admin/settings/SettingsLayout.vue:436-446` → `useSettings.ts:403-405` и `:353-356`).
Инвариант «валюта по умолчанию ровно одна» держит **только клиент** — БАГ-09; для сервера это
задача.

Бэкенд: `backend/app/modules/settings/features/crud/action.py:193` · схемы `crud/schemas.py:54-62`
Реализация: `services/settingsService.ts:46` · мок `mocks/index.ts:1343` → `mocks/settings.ts:449-452`

---

## Валюты

Справочник валют арендатора. Конвертации в проекте нет нигде и не предполагается
(`00-conventions.md` §14): валюты сосуществуют, курса нет.

### GET /api/settings/currencies

Весь справочник, без пагинации. Чтение, запрос №5 из девяти (`useSettings.ts:232`).

Ответ — массив. Форма во фронте — `Currency` (`types/settings.ts:22-28`):

```ts
{ id: string; code: string; name: TranslatedString; isDefault: boolean; updatedAt?: string }
```

**Бэкенд отдаёт на одно поле больше — `exchangeRate`** (`crud/schemas.py:73`, заполнение
`crud/domain.py:184`), которого в типе фронта нет. Описано как есть, потому что сервер его
отдаёт; остаётся ли курс в модели — решение владельца, и на нём же ломается создание валюты
(см. `POST /api/settings/currencies`, БАГ-05).

**Порядок выдачи не задан** — `get_currencies` идёт без `order_by`
(`crud/repository.py:87-91`). Умолчание обязано быть названо (`00-conventions.md` §13): для
справочника это код по возрастанию, и сегодня его не гарантирует никто. **Осталось:** порядок
не назначен ни кодом, ни владельцем.

Ошибки: общие `UNAUTHORIZED`/`NOT_FOUND`; своих нет, мок не бросает ничего
(`mocks/settings.ts:456-458`).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:212` · схемы `crud/schemas.py:67-77`
Реализация: `services/settingsService.ts:52` · мок `mocks/index.ts:384` → `mocks/settings.ts:456-458`

### POST /api/settings/currencies

Создаёт валюту. Save-режим: clean-slate — `_addCurrency` кладёт строку с временным id
`cur-temp-<ts>` (`useSettings.ts:554-559`), запрос уходит по Save (`useSettings.ts:386-399`).

Запрос — `CurrencyCreateInput`: `code`, `name`, `exchangeRate`, `isDefault`
(`crud/schemas.py:80-88`).

**`exchangeRate` на сервере обязателен и значения по умолчанию не имеет**
(`crud/schemas.py:85`), а форма шлёт три поля: `code` в верхнем регистре, `name` во всех трёх
локалях и `isDefault: false` (`SettingsLayout.vue:355-359`). Против настоящего сервера создание
валюты поэтому не работает вовсе — 422 Pydantic (БАГ-05). Решение — владельцу: либо поле
получает дефолт, либо исчезает.

Ответ: созданная валюта с серверным `id` (`crud/action.py:236-239`). **Формат id контракт не
обещает**: сервер выдаёт UUID (`backend/app/core/base.py:18-22`), `cur-{N}` — свойство мока
(`mocks/settings.ts:463`), правило — `00-conventions.md` §19.

**Клиент опознаёт созданную строку по `code`** (`useSettings.ts:387-396`), то есть сервер обязан
вернуть тот же код, что получил.

Ошибки: `VALIDATION_ERROR` (422 — пустой код; `crud/action.py:240-244`, источник
`crud/domain.py:197`), `CONFLICT` (409 — код занят у арендатора; `crud/action.py:245-249`,
источник `crud/domain.py:202`, тот же запрет в БД — `shared/models.py:81-83`). Мок не бросает
ни того, ни другого (`mocks/settings.ts:460-467`), и форма проверяет только непустоту
(`SettingsLayout.vue:354`) — под моками дубль создаётся молча.

Бэкенд: `backend/app/modules/settings/features/crud/action.py:226` · схемы `crud/schemas.py:80-88`
Реализация: `services/settingsService.ts:56` · мок `mocks/index.ts:1126` → `mocks/settings.ts:460-467`

### PATCH /api/settings/currencies/:id

Правит валюту. Save-режим: clean-slate, дельта от `findUpdated` (`useSettings.ts:379`), запрос по
Save (`useSettings.ts:403-405`). Единственный живой путь правки в интерфейсе — переключение
валюты по умолчанию (`views/admin/settings/FinanceSettings.vue:102` →
`SettingsLayout.vue:430-446`), и оно порождает столько PATCH, сколько валют изменилось.

Запрос — `CurrencyPatchInput`: `code`, `name`, `exchangeRate`, `isDefault`, все необязательные
(`crud/schemas.py:91-99`).

Ответ: полный `CurrencyResponse` (`crud/action.py:259-263`). Клиент ответ не читает — подпись
`Promise<void>` (`settingsService.ts:60`).

Ошибки: `NOT_FOUND` бросается доменом (`crud/domain.py:226`, `:243`), но **обработчика в роуте
нет** (`crud/action.py:252-263`) — 404 превращается в 500, БАГ-11. Мок — `CURRENCY_NOT_FOUND`
(`mocks/settings.ts:471`).

**Уникальность `code` на этом пути не проверяется** (на создании проверяется —
`crud/domain.py:200-202`), при том что в БД стоит `UniqueConstraint("tenant_id", "code")`
(`shared/models.py:81-83`): нарушение вылезет необработанной ошибкой драйвера вместо `CONFLICT`
— БАГ-10. Контракт требует `CONFLICT` на обоих путях.

**Сервер не держит инвариант «валюта по умолчанию ровно одна»**: при записи `is_default` других
валют он не касается (`crud/domain.py:221-254`) — БАГ-09.

Токена роут не требует (`crud/action.py:252-257`, БАГ-01).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:252` · схемы `crud/schemas.py:91-99`
Реализация: `services/settingsService.ts:60` · мок `mocks/index.ts:1356` → `mocks/settings.ts:471`

### DELETE /api/settings/currencies/:id

Удаляет валюту. Тела нет. Save-режим: clean-slate — `_removeCurrency` правит стор
(`useSettings.ts:560-565`), запрос по Save (`useSettings.ts:400-402`).

Ответ: `ApiResponse(success=True, message="Currency deleted")` без `data`
(`crud/action.py:274`) — после снятия конверта клиент получает `undefined`.

Ошибки: `NOT_FOUND` (404, `crud/action.py:275-279`, источник `crud/domain.py:260`) и `CONFLICT`
(409 — «валюта используется N товарами»; `crud/action.py:280-284`, источник
`crud/domain.py:266`, счёт через межмодульный `count_products_by_currency`,
`crud/domain.py:263-264`). Мок знает только `CURRENCY_NOT_FOUND` (`mocks/settings.ts:477`),
проверки использования у него нет.

**Валюту по умолчанию удалить можно, и это не запрещено ничем на сервере**: ни `is_default`, ни
код в `global_constants.default_currency` в `remove_currency_item` не проверяются
(`crud/domain.py:257-268`) — БАГ-08. В интерфейсе правило существует только как атрибут
`disabled` у кнопки (`views/admin/settings/FinanceSettings.vue:111-114`). Каким кодом сервер
обязан отказывать — строка владельцу (подходящего кода в домене нет).

Токена роут не требует (`crud/action.py:266-270`, БАГ-01).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:266`
Реализация: `services/settingsService.ts:64` · мок `mocks/index.ts:1632` → `mocks/settings.ts:477`

---

## Единицы измерения

### GET /api/settings/uoms

Весь справочник единиц, без пагинации. Чтение, запрос №6 из девяти (`useSettings.ts:233`).

Ответ — массив. `Uom` (`types/settings.ts:70-75`):

```ts
{ id: string; code: TranslatedString; name: TranslatedString; category: UomCategory }
```

`code` и `name` собираются из колонок `code_translations` и `name_translations`
(`crud/domain.py:276-281`) — правило `TranslatedString` в `00-conventions.md` §12.

**Категорий восемь, а не семь**: `weight | length | area | volume | quantity | density |
thickness | time` (`types/settings.ts:31-40`). `time` добавлен ради услуг. Комментарий бэкенда
(`shared/models.py:99-101`) повторяет старый список из семи, а сама колонка — `String(20)` без
ограничения, то есть сервер примет любую строку. **Для бэкенда это задача:** перечень закрыт
типом фронта, и сервер обязан его соблюдать.

**Порядок выдачи не задан** — `get_uoms` без `order_by` (`crud/repository.py:141-145`).
**Осталось:** умолчание не назначено.

Ошибки: общие; своих нет, мок не бросает ничего (`mocks/settings.ts:483-485`).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:291` · схемы `crud/schemas.py:104-112`
Реализация: `services/settingsService.ts:70` · мок `mocks/index.ts:385` → `mocks/settings.ts:483-485`

### POST /api/settings/uoms

Создаёт единицу. Save-режим: clean-slate — `_addUom` кладёт строку с временным id
`uom-temp-<ts>` (`useSettings.ts:566-571`), запрос по Save (`useSettings.ts:417-428`).

Запрос — `UomCreateInput`: `code`, `name`, `category`, все три обязательны
(`crud/schemas.py:115-122`). Форма кладёт одну и ту же строку во все три локали
(`SettingsLayout.vue:367-371`).

Ответ: созданная единица с серверным `id` (`crud/action.py:314-317`). Формат id — UUID; `uom-{N}`
свойство мока (`mocks/settings.ts:487-494`).

**Уникальность кода единицы не проверяет никто на сервере** — ни `create_uom_item`
(`crud/domain.py:286-300`), ни мок; функция поиска по коду в репозитории есть
(`crud/repository.py:153-168`) и используется только межмодульным API
(`internal_api/interface.py:59-64`). Дубль ловит только форма — `isUomCodeDuplicate`
(`SettingsLayout.vue:365`, вычислимое — `:190`). **Для бэкенда это задача:** уникальность кода
в паре с арендатором, как у валюты.

**Клиент опознаёт созданную строку сравнением объектов, а не значений** — `u.code === item.code`
(`useSettings.ts:419-421`) работает только пока это один и тот же объект в памяти (БАГ-16).
Требование к серверу от этого не меняется: он обязан вернуть ту же пару `category` + `code`,
что получил.

Ошибки: ни одного специфичного ни на одной стороне.

Бэкенд: `backend/app/modules/settings/features/crud/action.py:305` · схемы `crud/schemas.py:115-122`
Реализация: `services/settingsService.ts:74` · мок `mocks/index.ts:1128` → `mocks/settings.ts:487-494`

### PATCH /api/settings/uoms/:id

Правит единицу. Запрос — `UomPatchInput`: `code`, `name`, `category`, все необязательные
(`crud/schemas.py:125-132`). Ответ — полный `UomResponse` (`crud/action.py:327-331`).

**Вызывающего у этой функции нет: клиент написан, UI нет.** `useSettings.save()` считает для
единиц только добавленные и удалённые (`useSettings.ts:417-433`) — ветки `findUpdated` у `uoms`,
в отличие от валют, правил и статусов, там нет, и мутатора `updateUom` композабл не
экспортирует. Реестр — раздел «Клиент написан, UI нет» ниже.

Ошибки: `NOT_FOUND` бросается доменом (`crud/domain.py:308`, `:321`), обработчика в роуте нет
(`crud/action.py:320-331`) — БАГ-11. Мок — `UOM_NOT_FOUND` (`mocks/settings.ts:498`). Значение
`category` не проверяется по списку ни на одной стороне (`crud/domain.py:315-316`).

**Смена категории у единицы, на которую ссылаются правила пересчёта и товары, не проверяется
ничем.** Прежний контракт разрешал её «с осторожностью», не назвав правила; правила нет нигде.
**Осталось:** чем ограничена смена категории — не решено.

Токена роут не требует (`crud/action.py:320-325`, БАГ-01).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:320` · схемы `crud/schemas.py:125-132`
Реализация: `services/settingsService.ts:78` · мок `mocks/index.ts:1372` → `mocks/settings.ts:498`

### DELETE /api/settings/uoms/:id

Удаляет единицу. Тела нет. Save-режим: clean-slate — `_removeUom` (`useSettings.ts:572-577`),
запрос по Save (`useSettings.ts:429-431`), кнопка —
`views/admin/settings/UnitsSettings.vue:79`.

Ответ: `ApiResponse(success=True, message="UOM deleted")` (`crud/action.py:342`).

Ошибки: `NOT_FOUND` (`crud/action.py:343-347`) и `CONFLICT` при использовании в товарах
(`crud/action.py:348-352`, источник `crud/domain.py:342`, счёт `count_products_by_uom` —
`crud/domain.py:339-340`). Мок — `UOM_NOT_FOUND` (`mocks/settings.ts:504`).

**Правила пересчёта при удалении не проверяет никто, и схема сносит их молча**:
`uom_conversions.from_uom_id` и `to_uom_id` объявлены `ondelete="CASCADE"`
(`shared/models.py:117`, `:122`) — БАГ-07. Каким кодом сервер обязан отказывать — строка
владельцу. **Для бэкенда это задача:** каскад заменить отказом.

Токена роут не требует (`crud/action.py:334-338`, БАГ-01).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:334`
Реализация: `services/settingsService.ts:82` · мок `mocks/index.ts:1637` → `mocks/settings.ts:504`

---

## Правила пересчёта единиц

### GET /api/settings/conversions

Матрица правил пересчёта, без пагинации. Чтение, запрос №7 из девяти (`useSettings.ts:234`).

Ответ — массив. `UomConversion` (`types/settings.ts:78-85`):

```ts
{
  id: string
  fromUomId: string
  toUomId: string
  type: 'static' | 'dynamic'
  factor?: number
  formulaType?: 'weight_per_meter' | 'area_to_weight' | 'pcs_to_weight'
}
```

**`type` и `formulaType` во фронте — замкнутые списки** (`types/settings.ts:41`, `:55-59`), на
сервере — свободные строки `String(20)` и `String(50)` (`shared/models.py:125-133`). Сервер
обязан соблюдать замкнутые списки; сегодня его ничто к этому не обязывает. Правило
«список формул один на проект, тип выводится из массива» — ниже, «Правила домена».

**`factor` со значением 0 не доезжает до клиента**: `float(c.factor) if c.factor else None`
(`crud/domain.py:359`) — ноль в Python ложен, и нулевой коэффициент превращается в «поля нет»
(БАГ-19).

**Порядок выдачи не задан** — `get_conversions` без `order_by` (`crud/repository.py:198-202`).
**Осталось:** умолчание не назначено.

Ошибки: общие; своих нет, мок не бросает ничего (`mocks/settings.ts:510-512`).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:359` · схемы `crud/schemas.py:137-147`
Реализация: `services/settingsService.ts:88` · мок `mocks/index.ts:386` → `mocks/settings.ts:510-512`

### POST /api/settings/conversions

Создаёт правило. Save-режим: clean-slate — `_addConversion` кладёт строку с временным id
`conv-temp-<ts>` (`useSettings.ts:578-583`), запрос по Save (`useSettings.ts:444-456`).

Запрос — `ConversionCreateInput`: `fromUomId`, `toUomId`, `type` обязательны, `factor` и
`formulaType` — нет (`crud/schemas.py:150-159`). Фактически клиент шлёт либо
`{fromUomId, toUomId, type: 'static', factor}`, либо
`{fromUomId, toUomId, type: 'dynamic', formulaType}` (`SettingsLayout.vue:380-394`).

**Связка «`static` → `factor`, `dynamic` → `formulaType`» серверу не известна**: правило без
коэффициента и без формулы он примет (`crud/domain.py:366-396` — таких проверок нет), БАГ-20.
Форма это правило знает и соблюдает (`SettingsLayout.vue:377-378`), но клиент — не место для
серверного инварианта. **Для бэкенда это задача.**

Ответ: созданное правило с серверным `id` (`crud/action.py:382-386`). **Клиент опознаёт строку
по паре `fromUomId + toUomId`** (`useSettings.ts:445-454`), то есть сервер обязан вернуть ту же
пару, что получил.

Ошибки: `VALIDATION_ERROR` (422 — одна и та же единица с обеих сторон; `crud/action.py:387-391`,
источник `crud/domain.py:374`) и `CONFLICT` (409 — пара уже описана; `crud/action.py:392-396`,
источник `crud/domain.py:379`). Мок не бросает ни того, ни другого
(`mocks/settings.ts:514-521`) — под моками дубль пары создаётся молча.

Бэкенд: `backend/app/modules/settings/features/crud/action.py:373` · схемы `crud/schemas.py:150-159`
Реализация: `services/settingsService.ts:92` · мок `mocks/index.ts:1130` → `mocks/settings.ts:514-521`

### PATCH /api/settings/conversions/:id

Правит правило. Save-режим: clean-slate — инлайновая правка `factor` в таблице
(`views/admin/settings/UnitsSettings.vue:43`) идёт в стор через `updateConversion`
(`useSettings.ts:590-595`), запрос по Save (`useSettings.ts:460-462`); тело — дельта от
`findUpdated` (`useSettings.ts:176-198`).

Запрос — `ConversionPatchInput`: `fromUomId`, `toUomId`, `type`, `factor`, `formulaType`, все
необязательные (`crud/schemas.py:162-171`).

**Сбросить `factor` или `formulaType` в `null` этим путём нельзя**: `None` означает «не менять»
(`crud/domain.py:413-416`), поэтому правило, переключённое со `static` на `dynamic`, сохранит
старый коэффициент. Контракт требует различать «поля нет в теле» и «поле пришло `null`»: второе
— «стереть». Записано в БАГ-21.

**Ни совпадение единиц, ни дубль пары на этом пути не проверяются** — обе проверки написаны
только для создания (`crud/domain.py:373-379`) и здесь не вызываются: правило можно перевесить
на уже описанную пару (БАГ-21). Схема при этом `fromUomId`/`toUomId` принимает
(`crud/schemas.py:165-166`), и прежний контракт этих двух полей не знал вовсе.

Ответ: полный `ConversionResponse` (`crud/action.py:406-410`); клиент его не читает.

Ошибки: `NOT_FOUND` бросается доменом (`crud/domain.py:404`, `:421`), обработчика в роуте нет
(`crud/action.py:399-410`) — БАГ-11. Мок — `CONVERSION_NOT_FOUND` (`mocks/settings.ts:525`).

Токена роут не требует (`crud/action.py:399-404`, БАГ-01).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:399` · схемы `crud/schemas.py:162-171`
Реализация: `services/settingsService.ts:96` · мок `mocks/index.ts:1364` → `mocks/settings.ts:525`

### DELETE /api/settings/conversions/:id

Удаляет правило. Тела нет; идентификатор — UUID из пути (`crud/action.py:415`). Save-режим:
clean-slate — `_removeConversion` (`useSettings.ts:584-589`), кнопка в таблице
(`views/admin/settings/UnitsSettings.vue:14`), запрос по Save (`useSettings.ts:457-459`).

Ответ: `ApiResponse(success=True, message="Conversion deleted")` (`crud/action.py:420`).

Ошибки: `NOT_FOUND` бросается доменом (`crud/domain.py:438`), обработчика в роуте нет —
`crud/action.py:413-420`, в отличие от соседних DELETE валют (`crud/action.py:275-279`) и единиц
(`crud/action.py:343-347`), то есть 404 приходит как 500 (БАГ-11). Мок —
`CONVERSION_NOT_FOUND` (`mocks/settings.ts:531`).

**Удаление правила ничего не проверяет по построению**: пользуется ли им кто-то, не смотрит ни
мок, ни сервер (`crud/domain.py:435-439` — только проверка существования). Это правильно:
правило пересчёта — производная настройка, а не ссылочная сущность.

Токена роут не требует (`crud/action.py:413-418`, БАГ-01).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:413`
Реализация: `services/settingsService.ts:100` · мок `mocks/index.ts:1642` → `mocks/settings.ts:531`

---

## Статусы заказа

Домен владеет справочником статусов, а применяет его `orders`. Модель статусов заказа целиком —
[`plans/orders/orders-backend-contract.md`](../../plans/orders/orders-backend-contract.md).

### GET /api/settings/order-statuses

Весь справочник статусов, без пагинации. Чтение, запрос №8 из девяти (`useSettings.ts:235`).

Ответ — массив. `OrderStatusSetting` (`types/settings.ts:88-98`):

```ts
{
  id: string
  name: TranslatedString
  color: string              // '#RRGGBB'
  order: number
  system?: boolean
  reserveOnTransition?: boolean
  writeOffOnTransition?: boolean
}
```

**`order` и `system` на проводе — переименование колонок `sort_order` и `is_system`**
(`crud/domain.py:453-454`), и сервер обязан держать это соответствие. Оба флага перехода и
`system` сервер отдаёт **всегда**, с дефолтом `False` (`crud/schemas.py:183-185`), тогда как в
типе фронта все три необязательные (`types/settings.ts:92-97`): для клиента это совместимо, для
сервера — обязанность присылать их, а не опускать.

**Порядок задан**, единственный из четырёх справочников: сортировка по `sort_order` в
репозитории (`crud/repository.py:253-259`).

Ошибки: общие; своих нет, мок не бросает ничего (`mocks/settings.ts:537-539`).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:427` · схемы `crud/schemas.py:176-187`
Реализация: `services/settingsService.ts:106` · мок `mocks/index.ts:387` → `mocks/settings.ts:537-539`

### POST /api/settings/order-statuses

Создаёт статус. Save-режим: clean-slate — `_addOrderStatus` кладёт строку с временным id
`st-temp-<ts>` (`useSettings.ts:596-601`), запрос по Save (`useSettings.ts:488-502`).

Запрос — `OrderStatusCreateInput`: `name`, `color`, `order` обязательны, оба флага перехода по
умолчанию `False` (`crud/schemas.py:190-199`). Форма шлёт имя во всех трёх локалях, цвет,
`order`, равный текущей длине списка, и два флага (`SettingsLayout.vue:413-419`).

**Поля `system` в теле нет, и это правильно**: сервер жёстко ставит `"is_system": False`
(`crud/domain.py:469`). Системность назначается не создателем статуса — но кем, не сказано
нигде (строка владельцу; см. «Обязанности сервера»). Прежний контракт показывал `system?` в
теле — этого поля быть не должно.

Ответ: созданный статус с серверным `id` (`crud/action.py:450-453`). Формат id — UUID; `st-{N}`
свойство мока (`mocks/settings.ts:544`).

**Присланный `order` сервер сохраняет как есть** (`crud/domain.py:468`), а мок переписывает его
на индекс в конце списка (`mocks/settings.ts:547`) — расхождение мок↔бэкенд по одному полю.
Источник истины — сервер: клиент назначает позицию сам.

Ошибки: ни одного специфичного — ни `create_order_status_item` (`crud/domain.py:462-482`), ни мок
не бросают. Уникальность имени, формат цвета и коллизия `order` не проверяются нигде.
**Осталось:** правила уникальности имени и валидации цвета не назначены.

**Клиент ищет созданную строку «первой, которой нет в снимке»** (`useSettings.ts:491-495`), и при
двух добавленных статусах обе замены попадут в одну строку (БАГ-15). Требование к серверу от
этого не меняется — вернуть созданный объект целиком.

Бэкенд: `backend/app/modules/settings/features/crud/action.py:441` · схемы `crud/schemas.py:190-199`
Реализация: `services/settingsService.ts:112` · мок `mocks/index.ts:1132` → `mocks/settings.ts:541-549`

### PATCH /api/settings/order-statuses/:id

Правит статус. Save-режим: clean-slate — правки цвета и флагов идут в стор через
`updateOrderStatus` (`useSettings.ts:608-613`; вызовы — `SettingsLayout.vue:455` и
`views/admin/settings/OrderStatusesSettings.vue:15`), запрос по Save
(`useSettings.ts:506-508`); тело — дельта от `findUpdated` (`useSettings.ts:469`).

Запрос — `OrderStatusPatchInput`: `name`, `color`, `order`, `reserveOnTransition`,
`writeOffOnTransition` (`crud/schemas.py:202-211`).

**`system` иммутабельно ровно потому, что поля нет в схеме**, а не потому, что сервер его
отвергает. Контракт требует именно иммутабельности: системность через этот путь не меняется.

**`order` этот путь тоже принимает** (`crud/schemas.py:207`), и `findUpdated` положит его в
дельту, если он изменился (`useSettings.ts:187-192`) — то есть порядок правится двумя путями
сразу, этим и `PUT …/reorder`. Прежний контракт утверждал, что только вторым. Источник
истины — код: оба пути живые, и сервер обязан обрабатывать оба одинаково.

Ответ: полный `OrderStatusResponse` (`crud/action.py:475-479`); клиент его не читает.

Ошибки: `NOT_FOUND` бросается доменом (`crud/domain.py:490`, `:507`), обработчика в роуте нет
(`crud/action.py:468-479`) — БАГ-11. Мок — `ORDER_STATUS_NOT_FOUND`
(`mocks/settings.ts:553`). **Формат цвета не проверяет никто**: колонка `String(7)`
(`shared/models.py:148`), проверки `#RRGGBB` нет ни в домене (`crud/domain.py:496-497`), ни в
моке.

Токена роут не требует (`crud/action.py:468-473`, БАГ-01).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:468` · схемы `crud/schemas.py:202-211`
Реализация: `services/settingsService.ts:120` · мок `mocks/index.ts:1378` → `mocks/settings.ts:553`

### PUT /api/settings/order-statuses/reorder

Перезаписывает порядок статусов целиком. `PUT`, а не `PATCH`, потому что тело — весь
упорядоченный набор, а не дельта (`00-conventions.md` §3).

Запрос — `OrderStatusReorderInput` с алиасом `orderedIds` (`crud/schemas.py:214-219`):

```ts
{ orderedIds: string[] }
```

Ответ: `ApiResponse(success=True, message="Statuses reordered")` (`crud/action.py:465`).

Save-режим: clean-slate — перестановка drag-and-drop правит стор
(`SettingsLayout.vue:464-471` → `useSettings.ts:614-622`), запрос уходит по Save и только если
что-то удалено или порядок действительно изменился (`useSettings.ts:477-486`).

**Список обязан быть полным, и сервер обязан этого требовать.** Сейчас он перебирает
присланные id и пишет `sort_order = idx` по паре `(id, tenant_id)`
(`crud/repository.py:294-306`): несуществующий или чужой id молча не даёт эффекта, а статусы,
которых в списке нет, сохраняют прежний `sort_order` и сталкиваются с новыми номерами. Мок ведёт
себя иначе — недостающие дописывает в конец и перенумеровывает все
(`mocks/settings.ts:557-573`). Источник истины — сервер; требование полноты списка контракт
называет прямо, потому что иначе нумерация расходится.

**Атомарность держится транзакцией сессии, а не операцией:** это цикл из N отдельных `UPDATE` с
одним `commit` в конце (`crud/repository.py:296-306`). Прежний контракт обещал «атомарную
перезапись» — фактически перезапись частичная, если список неполон.

Ошибки: ни одного кода — ни на сервере, ни в моке. **Осталось:** каким кодом отвергать неполный
или чужой список — не назначено.

**Удаление статуса — два запроса без общей транзакции:** DELETE плюс этот `PUT`
(`useSettings.ts:482-486`, `:503-505`). Что обязано быть атомарным — строка владельцу.

Бэкенд: `backend/app/modules/settings/features/crud/action.py:456` · схемы `crud/schemas.py:214-219`
Реализация: `services/settingsService.ts:127` · мок `mocks/index.ts:1147` → `mocks/settings.ts:557-573`

### DELETE /api/settings/order-statuses/:id

Удаляет статус. Тела нет. Save-режим: clean-slate — `_removeOrderStatus`
(`useSettings.ts:602-607`), запрос по Save (`useSettings.ts:503-505`); при удалении Save
дополнительно шлёт `PUT …/reorder`.

Ответ: `ApiResponse(success=True, message="Order status deleted")` (`crud/action.py:490`).

Ошибки: `NOT_FOUND` (404, `crud/action.py:491-495`) и `FORBIDDEN` (403 на системный статус;
`crud/action.py:496-500`, источник `crud/domain.py:529`). Это **единственное место во всём
бэкенде, где поднимается `ForbiddenError`** (`00-conventions.md` §6). Мок знает только
`ORDER_STATUS_NOT_FOUND` (`mocks/settings.ts:577`) и **системность не проверяет вовсе**, хотя
все 15 сидовых статусов помечены `system: true` (`mocks/settings.ts:210-345`) — то есть под
моками удаляется то, что сервер запретит (БАГ-14).

**Проверки «статус используется в заказах» нет нигде** — она оставлена комментарием-TODO
(`crud/domain.py:531-532`). Прежний контракт обещал на этот случай 409. **Для бэкенда это
задача**, и до неё в контракте пробел: заказов на сервере нет вовсе, ссылаться не на что.

**`sort_order` после удаления сервер не нормализует** (`crud/domain.py:522-534`), мок
нормализует (`mocks/settings.ts:579`). Дыры в нумерации не видны, потому что порядок задаётся
сортировкой при чтении; обязан ли сервер перенумеровывать — строка владельцу.

Токена роут не требует (`crud/action.py:482-487`, БАГ-01).

Бэкенд: `backend/app/modules/settings/features/crud/action.py:482`
Реализация: `services/settingsService.ts:135` · мок `mocks/index.ts:1647` → `mocks/settings.ts:577`

---

## Права заказа

### GET /api/settings/order-permissions

Три права модели ценообразования, каждое — список имён ролей. Домен ими **владеет**, а применяет
их `orders`: `composables/useOrderPermissions.ts:23-32` во фронте и `requireRight`/`maySeeCost`
на «сервере» мока (`mocks/orders.ts:1855-1860`, `:1390-1393`). Механизм и его отличие от матрицы
прав карточки поставщика и от фича-флагов — `00-conventions.md` §6.

Ответ — `OrderPermissions` (`types/settings.ts:224-231`):

```ts
{ seeCost: string[]; manualCost: string[]; correction: string[] }
```

Сид мока — `['owner','admin','accounting']` для `seeCost` и `['owner','admin']` для двух
остальных (`mocks/settings.ts:62-66`).

Чтение, запрос №4 из девяти (`useSettings.ts:231`). **Записи нет:** эндпоинта на запись не
существует, и раздела `orderPermissions` нет в `save()` (`useSettings.ts:340-526`) — матрица
читается и не редактируется. Где она живёт и кем правится — строка владельцу.

**Отдельный эндпоинт здесь намеренно**, а не потому, что это «ещё одни константы»: сервер обязан
иметь ответ, даже когда экран настроек не открыт (`mocks/settings.ts:433-442`). Пустой дефолт
`{ seeCost: [], manualCost: [], correction: [] }` (`useSettings.ts:30`) вместе с флагом `settled`
(`useSettings.ts:92`) отличают «сервер сказал нет» от «сервер ещё не отвечал»: до ответа не
разрешено ничего.

Ошибки: ни одного — `mockGetOrderPermissions` не бросает (`mocks/settings.ts:440-442`).

Бэкенд: **не реализован.** Модели прав в модуле нет: `shared/models.py` содержит шесть классов
(`:12`, `:32`, `:61`, `:86`, `:104`, `:136`), прав среди них нет. Для бэкенда это задача, а не
описание существующего.
Реализация: `services/settingsService.ts:36` · мок `mocks/index.ts:383` → `mocks/settings.ts:440-442`

---

## Профиль и пароль

### GET /api/settings/profile

Профиль текущего пользователя. Чтение, запрос №9 из девяти (`useSettings.ts:236`).

Ответ — `UserProfile` (`types/settings.ts:205-212`):

```ts
{
  firstName: string
  lastName: string
  email: string
  phone: string          // '' вместо null
  role: UserRole
  secretLink?: string
}
```

`phone` из `None` превращается в `""` (`profile/domain.py:60`).

**`secretLink` — не хранимое поле, а собранный URL**
`{frontend_url}/auth/link?token={secret_link_token}` (`profile/domain.py:38-41`). **У этого GET
есть побочный эффект, и он осознанный:** если токена нет, он генерируется и записывается в базу
прямо в обработчике чтения (`profile/domain.py:31-33`) — ссылка обязана существовать к моменту
показа страницы, которая её показывает и копирует
(`views/admin/settings/ProfileSettings.vue:19`).

Ошибки: `UNAUTHORIZED` (`profile/action.py:51`, `:58`, `:70`), `NOT_FOUND` (404 — пользователя
нет; `profile/action.py:91-95`, источник `profile/domain.py:52`). Мок не бросает ничего
(`mocks/settings.ts:627-629`).

Бэкенд: `backend/app/modules/settings/features/profile/action.py:75` · схемы `profile/schemas.py:10-24`
Реализация: `services/settingsService.ts:184` · мок `mocks/index.ts:388` → `mocks/settings.ts:627-629`

### PATCH /api/settings/profile

Правит профиль. Save-режим: clean-slate — `updateProfile` правит стор
(`useSettings.ts:623-627`, потребитель `views/admin/settings/ProfileSettings.vue:14`), запрос по
Save (`useSettings.ts:513-516`).

Запрос — `ProfilePatchInput`: **только четыре поля** — `firstName`, `lastName`, `email`, `phone`
(`profile/schemas.py:27-35`).

**`role` и `secretLink` сервер обязан игнорировать.** Клиент шлёт весь профиль целиком —
`saveProfile({ ...settings.profile })` (`useSettings.ts:514`), то есть вместе с ними; бэкенд их
отбрасывает, но случайно — их просто нет в схеме. Мок же принимает всё:
`Object.assign(settingsStore.profile, patch)` (`mocks/settings.ts:636-639`), включая `role`
(БАГ-13). Роль меняется не здесь — правило контракта, а не свойство схемы.

Ответ: `UserProfile` целиком после слияния (`profile/action.py:111-114`), снова с
пересозданием `secretLink` при его отсутствии (`profile/domain.py:99`).

Ошибки: `UNAUTHORIZED` (`profile/action.py:51`, `:58`, `:70`), `NOT_FOUND` (404,
`profile/action.py:115-119`), `CONFLICT` (409 — почта уже занята; `profile/action.py:120-124`,
источник `profile/domain.py:86`). Мок не бросает ничего. Формат почты и телефона не проверяется
ни на одной стороне (`profile/domain.py:82-89` — только проверка занятости).

Бэкенд: `backend/app/modules/settings/features/profile/action.py:98` · схемы `profile/schemas.py:27-35`
Реализация: `services/settingsService.ts:188` · мок `mocks/index.ts:1347` → `mocks/settings.ts:636-639`

### POST /api/settings/change-password

Смена пароля. Save-режим: quick-action — своя форма и своя кнопка, Save bar настроек не
участвует (`views/admin/settings/ProfileSettings.vue:39-70`); клиент повторяет обе проверки
локально до отправки (`ProfileSettings.vue:45-52`).

Запрос — `ChangePasswordInput`, все три поля обязательны (`profile/schemas.py:38-45`):

```ts
{ currentPassword: string; newPassword: string; confirmPassword: string }
```

Ответ: `ApiResponse(success=True, message="Password changed")`, данных нет
(`profile/action.py:140`).

Ошибки: `UNAUTHORIZED`, `NOT_FOUND` (404, `profile/action.py:141-145`) и `VALIDATION_ERROR`
(422, `profile/action.py:146-150`) — **на три разных случая одним кодом**: неверный текущий
пароль (`profile/domain.py:126-127`), новый короче **шести** символов
(`profile/domain.py:130-133` — единственное место в проекте, где длина пароля ограничена) и
несовпадение подтверждения (`profile/domain.py:136-137`). Различает их только текст сообщения, и
клиент показывает его как есть (`ProfileSettings.vue:66`). Разделять ли эти три случая кодами —
строка владельцу.

**Ограничения попыток нет.** Настройка `password_change_rate_limit_per_min: int = 3` объявлена
(`backend/app/core/config.py:32`) и не используется ни в одной строке кода (БАГ-12). Прежний
контракт обещал «3 попытки/мин/IP» как реализованное — это неверно; для бэкенда это задача.

**Мок этот эндпоинт не реализует: он no-op** (`mocks/index.ts:1134`) — пароля не хранит и ничего
не проверяет, поэтому под моками смена пароля всегда «успешна» и ни один путь ошибки не
воспроизводится (`00-conventions.md` §18).

Бэкенд: `backend/app/modules/settings/features/profile/action.py:127` · схемы `profile/schemas.py:38-45`
Реализация: `services/settingsService.ts:192` · мок `mocks/index.ts:1134` (no-op)

---

## Почтовый сервер

Один почтовый сервер на арендатора, поэтому единичный ресурс без id. Через него уходят письма
поставщикам: `POST /api/bcc/send` берёт отправителя и параметры отсюда и своей копии не держит.

### GET /api/settings/mail

Параметры SMTP без пароля. Чтение, запрос №3 из девяти (`useSettings.ts:230`).

Ответ — `MailServerSettings` (`types/settings.ts:140-152`):

```ts
{
  host: string
  port: number
  encryption: 'none' | 'ssl' | 'starttls'
  username: string
  passwordSet: boolean      // «пароль задан», а не какой он
  fromEmail: string
  fromName: string
}
```

**Пароля здесь нет и быть не может — правилом типа, а не дисциплиной.** Поля для него нет в
типе (`types/settings.ts:146-147`), поэтому положить секрет в стор, снимок и кэш `localStorage`
физически нечем. `passwordSet` — производное, никогда не колонка
(`mocks/settings.ts:589`). Доказано на обоих путях чтения — `mocks/mail-settings.spec.ts:25-33`.

Ошибки: ни одного — `mockGetMail` не бросает (`mocks/settings.ts:588-590`).

Бэкенд: **не реализован.** Хранилища почтовых настроек нет вовсе: модели нет
(`grep -rn "smtp\|MailServer" backend/app/modules/settings` → пусто), а единственный серверный
тип этой формы лежит в чужом модуле —
`backend/app/modules/bcc/features/send_request/domain.py:42-55` — и не конструируется нигде.
Реализация: `services/settingsService.ts:165` · мок `mocks/index.ts:389` → `mocks/settings.ts:588-590`

### PATCH /api/settings/mail

Правит параметры SMTP и, отдельно, пароль. Save-режим: clean-slate, та же кнопка Save
(`useSettings.ts:363-374`).

Запрос — `MailServerPayload` (`types/settings.ts:179-182`): все поля `MailServerSettings` кроме
`passwordSet`, необязательные, плюс `password`. По факту клиент шлёт секцию целиком плюс пароль,
если его ввели (`useSettings.ts:363-374`).

**Пустая строка в `password` не отправляется, и это правило, а не оптимизация**: пустое поле
формы означает «не менять», а не «стереть» (`useSettings.ts:366`, «сервер» —
`mocks/settings.ts:600`). Доказано `mocks/mail-settings.spec.ts:41-49`. Следствие: **стереть
пароль этим эндпоинтом нельзя вовсе** — отдельного действия «убрать пароль» нет ни в
интерфейсе, ни в моке. **Осталось:** как стирается пароль — не назначено.

Ответ: `MailServerSettings` целиком после слияния, **снова без пароля**
(`mocks/settings.ts:597-602`); ответ кладётся прямо в стор (`useSettings.ts:368-370`).

Пароль живёт вне стора и вне снимка (`useSettings.ts:96-103`) и обнуляется сразу после
постановки запроса в очередь (`useSettings.ts:372`) — **до** того, как запрос выполнился.

Ошибки: ни одного — `mockPatchMail` не бросает (`mocks/settings.ts:597-602`). Валидации `host`,
`port` и `fromEmail` нет ни на одной стороне. **Осталось:** какие поля сервер обязан
валидировать — не назначено.

Бэкенд: **не реализован** (см. `GET /api/settings/mail`).
Реализация: `services/settingsService.ts:169` · мок `mocks/index.ts:1351` → `mocks/settings.ts:597-602`

### POST /api/settings/mail/test

Сервер отправляет тестовое письмо самому себе и отвечает, на какой адрес оно ушло.

Запрос — пустой объект `{}` (`services/settingsService.ts:179`). **Параметры не передаются
намеренно:** проверяются те, что уже сохранены на сервере (комментарий
`settingsService.ts:173-177`).

Ответ: `{ deliveredTo: string }` — мок отдаёт `mailStore.fromEmail`
(`mocks/settings.ts:620-623`), доказано `mocks/mail-settings.spec.ts:73-75`. То есть **письмо
уходит на адрес отправителя, и сервер обязан уметь принять собственную почту.** Успешный тест
ничего не сохраняет.

Ошибки: один код — `MAIL_NOT_CONFIGURED` (422; `mocks/settings.ts:621`), условие берётся из
общего для проекта `isMailConfigured` (`types/settings.ts:167-171`, вызов
`mocks/settings.ts:611-613`). Тот же код бросает BCC-инструмент (`mocks/bcc.ts:317`) — код
кросс-доменный. Это единственный код домена, доходящий до человека отдельным сообщением
(`views/admin/settings/MailSettings.vue:79-84`), но читается он из `e.message`
(`MailSettings.vue:79`), тогда как настоящий `ApiRequestError` кладёт код в `code`
(`services/api.ts:118-124`) — против сервера эта ветка не сработает, БАГ-17.

Save-режим: quick-action, сохранения не требует и не выполняет
(`views/admin/settings/MailSettings.vue:73-88`). **Гейт кнопки смотрит на состояние сервера, а
не на черновик** (`MailSettings.vue:44-49`), и адрес получателя не называется, пока раздел
грязный (`MailSettings.vue:65-69`): назвать черновик значило бы соврать о получателе.

Бэкенд: **не реализован** — роута нет; отправку писем умеет только модуль `bcc`
(`backend/app/modules/bcc/features/send_request/domain.py:42-55`), и оттуда почтовые параметры
не читаются ниоткуда.
Реализация: `services/settingsService.ts:178` · мок `mocks/index.ts:1135` → `mocks/settings.ts:620-623`

---

## Карта склада

Единичный ресурс без id и без истории версий: PUT заменяет карту целиком, DELETE убирает.
«Загрузить новую» и «обновить» — одно действие (`services/settingsService.ts:139-143`).
Хранится ровно в одном месте — `AppSettings.warehouseMap` (`types/settings.ts:243-244`), второго
реестра карт в складском модуле быть не должно. Сам файл кладётся штатным `POST /api/uploads`
(`00-conventions.md` §16), бинарник в JSON не ходит никогда.

Все три эндпоинта живут **вне** набора настроек: `fetchAllSections` карту не запрашивает — девять её запросов перечислены подряд
(`useSettings.ts:213`, вызовы `:217-237`), её тянет своя `load()` на своей странице
(`composables/useWarehouseMap.ts:25-35`).

### GET /api/settings/warehouse-map

Текущая карта или её отсутствие. Чтение вне набора настроек.

Ответ — `WarehouseMapFile | null` (`types/settings.ts:111-119`, подпись
`settingsService.ts:145`):

```ts
{ fileId: string; name: string; mime: string; size: number; url: string; uploadedAt: string } | null
```

Поля повторяют ответ `POST /api/uploads` (`types/settings.ts:105-109`): страница кладёт сюда то,
что вернул сервер, ничего не пересобирая.

**`null` — это успешный ответ, а не 404.** Пустое состояние страницы строится на `null`, а не на
пойманной ошибке (`settingsService.ts:145`); мок отдаёт копию или `null`
(`mocks/settings.ts:647-649`), сид — `null` (`mocks/settings.ts:185`).

Ошибки: ни одного — `mockGetWarehouseMap` не бросает (`mocks/settings.ts:647-649`). Клиент
кладёт любую ошибку в текст (`useWarehouseMap.ts:30-32`).

Бэкенд: **не реализован.** Модели карты в модуле нет —
`grep -c warehouse_map backend/app/modules/settings/shared/models.py` → 0.
Реализация: `services/settingsService.ts:145` · мок `mocks/index.ts:390` → `mocks/settings.ts:647-649`

### PUT /api/settings/warehouse-map

Заменяет карту целиком. `PUT`, а не `PATCH`: тело — вся запись, слияния нет
(`00-conventions.md` §3).

Запрос — `WarehouseMapFile` целиком (`settingsService.ts:151`). Клиент собирает его строго из
ответа `POST /api/uploads`, ничего не пересобирая (`useWarehouseMap.ts:51-58`).

Ответ: сохранённая карта (`mocks/settings.ts:651-657`).

Save-режим: quick-action — `replaceWith()` уходит на сервер сразу после подтверждения замены
(`useWarehouseMap.ts:44-67`), Save bar настроек не участвует.

Ошибки: один код — `MAP_NOT_AN_IMAGE`, если `mime` не начинается с `image/`
(`mocks/settings.ts:654`), доказано `mocks/warehouse-map.spec.ts:73`. Клиент проверяет то же
самое до отправки (`useWarehouseMap.ts:45-48`), но код ответа не читает: любая ошибка становится
одним тостом (`useWarehouseMap.ts:61-63`).

**`mime` обязан проверяться на сервере, а не только у клиента.** Атрибут `accept` фильтрует
диалог выбора файла и ничего не значит для перетаскивания (`useWarehouseMap.ts:39-42`) —
поэтому проверок две, и серверная из них обязательная.

**`url`, `size` и `uploadedAt` сервер получает от клиента и не имеет права верить им на слово** —
проверяется сегодня только `mime` (`mocks/settings.ts:654`). Правило `00-conventions.md` §16:
`url` — производное от `storage_path`, а не данные.

**Прежняя карта пропадает безвозвратно, и обязанности удалить её файл контракт никому не
назначает.** **Осталось:** судьба вытесненного файла не решена.

Бэкенд: **не реализован** (см. `GET /api/settings/warehouse-map`).
Реализация: `services/settingsService.ts:151` · мок `mocks/index.ts:1155` → `mocks/settings.ts:651-657`

### DELETE /api/settings/warehouse-map

Убирает карту. Тела нет, id нет — единичный ресурс.

Ответ: пусто (`settingsService.ts:155`); мок кладёт `settingsStore.warehouseMap = null`
(`mocks/settings.ts:659-661`).

Save-режим: quick-action — `remove()` уходит на сервер сразу после подтверждения
(`useWarehouseMap.ts:69-82`).

Ошибки: ни одного, и **удаление идемпотентно**: в `mockDeleteWarehouseMap` нет ни одного
`throw` (`mocks/settings.ts:659-661`), повтор на пустой карте — тоже успех. Клиент код и не
читает — один тост на любую ошибку (`useWarehouseMap.ts:76-78`).

**Сам файл при этом никуда не девается:** `POST /api/uploads` его уже сохранил, и обязанности
удалить бинарник контракт не назначает никому — тот же пробел, что у `PUT`. **Осталось.**

Бэкенд: **не реализован** (см. `GET /api/settings/warehouse-map`).
Реализация: `services/settingsService.ts:155` · мок `mocks/index.ts:1652` → `mocks/settings.ts:659-661`

---

## Каталог кодов ошибок домена

Ядро объявляет шесть кодов и их статусы (`00-conventions.md` §2); ниже — то, что бросает сам
домен.

**Про правило «код не подстрока другого» здесь надо быть точным.** Никакие два доменных кода
подстроками друг друга не являются, но все четыре мок-кода коллекций — `CURRENCY_NOT_FOUND`,
`UOM_NOT_FOUND`, `CONVERSION_NOT_FOUND`, `ORDER_STATUS_NOT_FOUND` — содержат внутри себя
серверный `NOT_FOUND`. Сегодня это безобидно ровно потому, что **в домене никто не читает
`e.code` вообще**: ни один из семи экранов и ни один из двух композаблов домена к полю `code` не
обращается (`grep -rn "\.code" frontend_vue/src/composables/useSettings.ts
frontend_vue/src/composables/useWarehouseMap.ts frontend_vue/src/views/admin/settings/` даёт
только `Currency.code` и `Uom.code`, то есть коды валют и единиц). Появится сравнение подстрокой,
как в заказах (`services/orderLineEdits.ts:418` — `message.includes(code)` по словарю
`:337-360`), — эти четыре кода начнут ловиться обработчиком `NOT_FOUND`.

| код | статус | где бросается | знает ли мок |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | `crud/action.py:108`, `:115`, `:127`; `profile/action.py:51`, `:58`, `:70` | нет |
| `NOT_FOUND` | 404 | нет арендатора — `crud/action.py:135-138`; нет пользователя — `profile/action.py:91-95`; нет записи — `crud/action.py:275-279`, `:343-347`, `:491-495`, `profile/action.py:115-119` | своими кодами, см. ниже |
| `VALIDATION_ERROR` | 422 | пустой код валюты — `crud/action.py:240-244`; единица с обеих сторон правила — `crud/action.py:387-391`; три случая смены пароля — `profile/action.py:146-150` | нет |
| `CONFLICT` | 409 | код валюты занят — `crud/action.py:245-249`; валюта используется товарами — `crud/action.py:280-284`; единица используется товарами — `crud/action.py:348-352`; дубль пары правила — `crud/action.py:392-396`; почта занята — `profile/action.py:120-124` | нет |
| `FORBIDDEN` | 403 | удаление системного статуса — `crud/action.py:496-500`, источник `crud/domain.py:529` | нет |

Шесть кодов знает только мок, и все шесть — «не найдено» своей коллекции:
`CURRENCY_NOT_FOUND` (`mocks/settings.ts:471`, `:477`), `UOM_NOT_FOUND`
(`mocks/settings.ts:498`, `:504`), `CONVERSION_NOT_FOUND` (`mocks/settings.ts:525`, `:531`),
`ORDER_STATUS_NOT_FOUND` (`mocks/settings.ts:553`, `:577`), `MAIL_NOT_CONFIGURED`
(`mocks/settings.ts:621`), `MAP_NOT_AN_IMAGE` (`mocks/settings.ts:654`). Первые четыре — то же,
что серверный `NOT_FOUND`, только с указанием коллекции; последние два серверной пары не имеют
вовсе, потому что почты и карты на сервере нет.

**Ни один код домена не доходит до человека отдельным сообщением, кроме
`MAIL_NOT_CONFIGURED`.** Save настроек показывает `e.message` одним тостом
(`useSettings.ts:522`), карта склада — по одному тосту на действие
(`useWarehouseMap.ts:61-63`, `:76-78`), смена пароля — текст сервера как есть
(`views/admin/settings/ProfileSettings.vue:66`). Это класс из `00-conventions.md` §2: отказ
несёт код, а не текст, и ветки, читающие `e.message`, против сервера не сработают.

Два кода, которых в домене нет, а поведение под них есть: удаление валюты по умолчанию
(БАГ-08) и удаление единицы, на которую ссылаются правила пересчёта (БАГ-07). Оба — строка
владельцу.

---

## Обязанности сервера

То, чего во фронтенде не видно и что в мок-режиме не проявляется никак. Заполнено как
наблюдение: где правила нет нигде — строка в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

**Значения по умолчанию и их владелец.** Четырьмя финансовыми величинами владеет этот домен, и
сервер создаёт их сам при первом чтении: `vat_rate=21`, `default_margin=15`,
`default_currency='EUR'`, `default_discount_percent=0` (`shared/models.py:44-55`, автосоздание
`crud/domain.py:129-131`). Фронт держит **вторую копию тех же чисел** дефолтом состояния
(`useSettings.ts:27`) и **третью** — сидом мока (`mocks/settings.ts:52-57`). Потребители читают
их из стора: НДС и маржа новой строки заказа — `composables/useOrderCard.ts:145-148`, маржа
партии — `composables/useWarehouseBatch.ts:119`, валюта поставщика —
`composables/useSupplierCreate.ts:49`. Отдельно: жёсткий список `EUR/USD/PLN/GBP` стоит
константой в карточке поставщика (`components/admin/SupplierFormSections.vue:58-63`), хотя
валютами владеет этот домен. Валюта по умолчанию выражена **дважды** — флагом
`Currency.isDefault` (`types/settings.ts:26`) и кодом в `constants.defaultCurrency`
(`types/settings.ts:17`), и `services/orderLines.ts:160` читает сначала первое, потом второе;
согласованности между ними сервер не держит. **Справочники нового арендатора не создаёт никто:**
`create_tenant` пишет только сам арендатор
(`backend/app/modules/auth/features/register/repository.py:46-61`), строку компании — отдельный
вызов (`internal_api/interface.py:67-79`), а валют, единиц, правил и статусов не создаёт ни
регистрация, ни миграции. **Системные статусы не создаёт никто тоже**: создание жёстко пишет
`"is_system": False` (`crud/domain.py:469`), сидов нет, а весь фронт заказов опирается на замкнутый
список (`domain/orderStatus.ts`) и 15 статусов мока с `system: true`
(`mocks/settings.ts:210-345`). Четыре строки владельцу.

**События и уведомления.** Домен не рождает ни одного: `grep -c "notify"
frontend_vue/src/services/mocks/settings.ts` → 0, и ни один из семи эмиттеров
(`mocks/notifications.ts:542`, `:566`, `:592`, `:616`, `:637`, `:657`, `:684`) настроек не
касается. На сервере уведомлений нет вовсе — у модуля `notifications` роутов ноль. Рождает ли
уведомление смена ставки НДС, валюты по умолчанию или набора статусов и кому оно адресовано —
строка владельцу.

**Запись в аудит-лог.** Нет нигде: `grep -c "auditLog"
frontend_vue/src/services/mocks/settings.ts` → 0, а в замкнутом перечне девяти сущностей ленты
(`types/audit.ts:4-14`) настроек нет. При этом сама страница логов живёт вкладкой **внутри**
настроек (`router/index.ts:391-396`) — домен показывает чужой аудит и не пишет свой. Остаётся ли
след у смены финансовых констант, валюты по умолчанию, матрицы прав и почтового пароля и кто его
автор — строка владельцу.

**Кастомные поля.** У домена их нет и быть не должно: определениями владеет `config`, значения
живут у товаров (`00-conventions.md` §8). В `settings` нет ни одного упоминания —
`grep -rn "fieldDefinition\|fieldValues\|customField" frontend_vue/src/types/settings.ts
frontend_vue/src/services/mocks/settings.ts backend/app/modules/settings` пусто. Единственная
точка соприкосновения — справочники этого домена как источник значений для полей товара, и
правила их удаления описаны выше (БАГ-07, БАГ-08).

**Настройки, которых мок не отслеживает.** Три подраздела мок держит, а бэкенд не знает вовсе:
**почта** (модели нет; серверный тип формы лежит в чужом модуле и не конструируется —
`backend/app/modules/bcc/features/send_request/domain.py:42-55`), **карта склада**
(`grep -c warehouse_map backend/app/modules/settings/shared/models.py` → 0) и **матрица прав
заказа** (шесть классов моделей — `shared/models.py:12`, `:32`, `:61`, `:86`, `:104`, `:136` —
прав среди них нет). Обратно: мок **не отслеживает смену пароля** — она у него no-op
(`mocks/index.ts:1134`), и путь ошибки под моками не воспроизводится; мок также не хранит
`exchangeRate` валюты, который есть у сервера (`crud/schemas.py:73`). И отдельно:
`AppSettings.users` (`types/settings.ts:245`) с сидом на шесть человек
(`mocks/settings.ts:187-206`) **не заполняется ни одним эндпоинтом** — в `fetchAllSections` его
нет (`useSettings.ts:213`, девять вызовов — `:217-237`). Три строки владельцу.

**Мультиарендность.** `tenant_id` есть у всех шести моделей домена (`shared/models.py:17`,
`:37`, `:66`, `:91`, `:109`, `:141`), у двух синглтонов — с `unique=True`
(`shared/models.py:21`, `:41`). Выборка четырёх списков ограничена арендатором
(`crud/repository.py:89`, `:143`, `:200`, `:256`). **Но восемь операций над отдельными записями
арендатором не ограничены вовсе:** `get_currency`, `get_uom`, `get_conversion`,
`get_order_status` ищут по одному `id` (`crud/repository.py:94-98`, `:148-150`, `:205-209`,
`:262-266`), а роуты PATCH и DELETE этих коллекций не требуют даже токена (БАГ-01). Исключение —
`reorder`: он пишет по паре `(id, tenant_id)` (`crud/repository.py:299-302`). Общее правило —
`00-conventions.md` §4; контракт требует пары `(id, tenant_id)` во всех восьми.

**Права — в какой функции проверяются.** Нигде на сервере: в модуле нет ни одной проверки роли
(`grep -rn "role" backend/app/modules/settings --include=*.py` даёт только чтение и отдачу
`user.role` в профиле — `profile/domain.py:61`, `:106`). Во фронте домен закрыт одним
фича-флагом `adminSettings` на весь раздел (`router/index.ts:355`), у вкладки логов свой флаг
`settingsAuditLog` (`router/index.ts:395`); прав, различающих роли внутри настроек, нет. При
этом сам домен **владеет** тремя правами чужого домена и отдаёт их
`GET /api/settings/order-permissions`. Какое право нужно, чтобы править настройки, и одно ли оно
на все семь вкладок — строка владельцу. Разница между правом и фича-флагом —
`00-conventions.md` §6 и §7.

**Транзакционность и идемпотентность.** `Idempotency-Key` не шлёт ни один из 31 эндпоинта. Одна
кнопка Save порождает **до десятка независимых запросов** — восемь секций плюс по запросу на
каждый добавленный, изменённый и удалённый элемент четырёх коллекций, — и все они летят одним
`Promise.all` (`useSettings.ts:518`): падение любого оставляет остальные применёнными, а
`takeSnapshot()` (`useSettings.ts:520`) до `catch` (`:521`) не доходит, то есть снимок не
сдвигается и следующий Save шлёт всё заново. Смена валюты по умолчанию — N+1 запрос без общей
транзакции; удаление статуса — DELETE плюс reorder. На стороне сервера каждый репозиторный вызов
делает свой `commit` (`crud/repository.py:44`, `:51`, `:117`, `:130`, `:136`), то есть в пределах
одного запроса транзакция одна, между запросами — ни одной. Что обязано применяться целиком —
строка владельцу; общий класс — `00-conventions.md` §15.

**Производные значения (считать, не хранить).** Сервер считает при чтении три вещи:
`secretLink` профиля — собранный URL, а не колонка (`profile/domain.py:38-41`); `order` и
`system` статуса — переименование колонок `sort_order` и `is_system` (`crud/domain.py:453-454`);
`passwordSet` почты — вычисляется из наличия пароля и не хранится полем
(`mocks/settings.ts:589`). Хранится, но выводимо ничем: `exchangeRate` валюты
(`shared/models.py:74-76`) — курса во фронте нет нигде. Наоборот, **не считается то, что могло
бы**: `sort_order` статусов сервер хранит и не нормализует после удаления
(`crud/domain.py:522-534`), тогда как мок перенумеровывает (`mocks/settings.ts:579`) — строка
владельцу.

---

## Правила домена

Правила, живущие только в этом домене; общие — в `00-conventions.md`.

1. **Пароль почты пишется и не читается — правилом типа, а не дисциплиной.** Поля `password`
   нет в `MailServerSettings` (`types/settings.ts:140-152`), поэтому положить секрет в стор,
   снимок и кэш `localStorage` физически нечем. `MailServerPayload`
   (`types/settings.ts:179-182`) — единственное место, где поле существует, и оно только для
   записи. Пустая строка не отправляется: пустое поле формы означает «не менять», а не
   «стереть» (`useSettings.ts:366`, «сервер» — `mocks/settings.ts:600`). Доказано
   `mocks/mail-settings.spec.ts:25-49`.
2. **«Можно ли отправить письмо» — одно правило на весь проект.** `isMailConfigured`
   (`types/settings.ts:167-171`) зовут гейт кнопки теста (`MailSettings.vue:49`), гейт кнопки
   Send BCC-инструмента и отказ «сервера» (`mocks/settings.ts:611-613`). Аргумент сужен до трёх
   полей (`types/settings.ts:167-169`), чтобы правило не могло незаметно начать смотреть на
   что-то ещё.
3. **Тест почты проверяет сервер, а не черновик.** Гейт кнопки смотрит на состояние, пришедшее
   с сервера (`MailSettings.vue:44-49`), и адрес получателя не называется, пока раздел грязный
   (`MailSettings.vue:65-69`): назвать черновик значило бы соврать о получателе.
4. **Карта склада — единичный ресурс без истории.** PUT заменяет её целиком, версий нет,
   «загрузить новую» и «обновить» — одно действие (`settingsService.ts:139-143`). Хранится ровно
   в одном месте — `AppSettings.warehouseMap` (`types/settings.ts:243-244`); второго реестра
   карт в складском модуле быть не должно.
5. **`mime` карты проверяется дважды, и серверная проверка обязательная.** `accept` фильтрует
   только диалог выбора файла и ничего не значит для перетаскивания (`useWarehouseMap.ts:39-42`),
   поэтому клиент проверяет `image/*` перед отправкой (`useWarehouseMap.ts:45-48`), а «сервер» —
   ещё раз (`mocks/settings.ts:654`).
6. **Права заказа отдаются отдельным эндпоинтом намеренно** — не потому, что это «ещё одни
   константы», а потому, что сервер обязан иметь ответ, даже когда настройки на экране не
   открыты (`mocks/settings.ts:433-442`). Пустой дефолт плюс флаг `settled`
   (`useSettings.ts:30`, `:92`) отличают «сервер сказал нет» от «сервер ещё не отвечал».
7. **Сокрытие себестоимости в интерфейсе — занавеска, а не право.** Сервер не имеет права
   отдавать `cost`/`margin` пользователю без `seeCost`; поскольку карточка пересчитывает цены из
   себестоимости, сервер, вырезавший её, обязан прислать посчитанную цену
   (`composables/useOrderPermissions.ts:16-21`).
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

---

## Клиент написан, UI нет

- **`PATCH /api/settings/uoms/:id`** — функция `updateUom` есть (`settingsService.ts:78`),
  вызывающего нет: `useSettings.save()` считает для единиц только добавленные и удалённые
  (`useSettings.ts:417-433`), ветки `findUpdated` у `uoms` там нет, и мутатора `updateUom`
  композабл не экспортирует. Прежний контракт помечал это «будущий UI — inline rename»;
  реализация бэкенда при этом есть (`crud/action.py:320`), то есть эндпоинт живой и
  непроверяемый интерфейсом.

---

## Чего в домене нет

Ничего не вычеркнуто молча: каждое снятое утверждение прежнего
[`03-api-contract.md`](../03-api-contract.md) (строки 2236–2696, 2801–2826) названо здесь вместе
с тем, чем оно опровергнуто.

| было описано | чем доказано отсутствие |
|---|---|
| код `COMPANY_NOT_FOUND` у `GET /api/settings/company` | `grep -rn COMPANY_NOT_FOUND backend/app frontend_vue/src` → пусто; 404 недостижим, потому что строка компании создаётся при чтении (`crud/domain.py:67-76`) |
| код `INVALID_PASSWORD` у смены пароля | `grep -rn INVALID_PASSWORD backend/app frontend_vue/src` → пусто; все три случая идут одним `VALIDATION_ERROR` (`profile/action.py:146-150`) |
| «Rate-limit: 3 попытки/min/IP» у смены пароля | настройка `password_change_rate_limit_per_min` объявлена (`backend/app/core/config.py:32`) и не используется ни в одной строке — БАГ-12 |
| «422, если удаляют валюту, установленную как `defaultCurrency`» | проверки нет ни в `remove_currency_item` (`crud/domain.py:257-268`), ни в моке (`mocks/settings.ts:477`) — БАГ-08; в интерфейсе это только `disabled` (`views/admin/settings/FinanceSettings.vue:111-114`) |
| «409, если UOM используется в правилах пересчёта или заказах» | правила сносятся каскадом (`shared/models.py:117`, `:122`) — БАГ-07; проверяются только товары (`crud/domain.py:338-342`), а заказов на сервере нет вовсе |
| «409, если статус используется в заказах» | оставлено комментарием-TODO (`crud/domain.py:531-532`); реализован только 403 на системный (`crud/action.py:496-500`) |
| «`factor` required if `type === 'static'`» как действующее правило | не реализовано ни на сервере (`crud/domain.py:366-396`), ни в моке (`mocks/settings.ts:514-521`) — БАГ-20; знает только форма (`SettingsLayout.vue:377-378`) |
| «`defaultCurrency` должен соответствовать одной из валют» как действующее правило | `patch_global_constants` валют не касается вовсе (`crud/domain.py:140-170`) |
| `exchangeRate` как поле типа `Currency` во фронте | в типе его нет (`types/settings.ts:22-28`); поле существует только на сервере (`crud/schemas.py:73`), и на нём ломается создание валюты — БАГ-05 |
| поле `system?: boolean` в теле `POST /api/settings/order-statuses` | схема такого поля не принимает (`crud/schemas.py:190-199`), сервер жёстко ставит `"is_system": False` (`crud/domain.py:469`) |
| «`order` изменяется только через reorder» | схема PATCH `order` принимает (`crud/schemas.py:207`), и `findUpdated` положит его в дельту (`useSettings.ts:187-192`) — путей два |
| формат id `cur-{N}`, `st-11`, `uom-{N}` в примерах ответов | это формат мока (`mocks/settings.ts:463`, `:544`, `:490`); сервер выдаёт UUID (`backend/app/core/base.py:18-22`), и контракт не имеет права обещать формат id (`00-conventions.md` §19) |
| «Body: dirty-only поля» у PATCH company, constants, profile и mail | клиент шлёт секцию целиком: `useSettings.ts:348`, `:354`, `:514`, `:364-365`. Правило merge-patch для сервера при этом в силе (`00-conventions.md` §3) |
| «клиент **не** шлёт base64» в PATCH company | шлёт: data-URL превью уходит в `logoUrl`, если Save нажали до конца загрузки (`SettingsLayout.vue:334-337`) — БАГ-18 |
| семь категорий UOM (`weight … thickness`) | во фронте их восемь — добавлен `time` (`types/settings.ts:31-40`); комментарий бэкенда (`shared/models.py:99-101`) повторяет тот же устаревший список |
| «атомарная перезапись порядка» у reorder | это цикл из N отдельных `UPDATE` с одним `commit` (`crud/repository.py:294-306`); неполный список оставляет прежние номера |
| «Draft-файлы удаляются по TTL 24 ч» — в части карты склада | `POST /api/uploads` пишет `is_draft=False`, уборщика нет (`00-conventions.md` §16); вытесненная карта остаётся файлом навсегда |

**Раздела `GET /api/settings/order-permissions` в прежнем контракте не было вовсе** —
`grep -n "order-permissions\|orderPermissions" roo_code/roo-context/03-api-contract.md` не даёт
ни одного попадания. Это не удаление, а добавление: эндпоинт обслуживает три права модели
ценообразования и читается как гейт кнопок и колонок.

**`GET /api/settings` и `PUT /api/settings` существуют только в моке.** Ветки есть
(`mocks/index.ts:410`, `:1151`), клиента нет ни одного:
`grep -rn "'/api/settings'" frontend_vue/src --include=*.ts --include=*.vue` вне моков пусто, и в
`settingsService.ts` функций чтения и записи всего среза настроек нет. Это две из пяти сирот
инвентаря моков (`00-conventions.md`, линза К2 скила): целого среза настроек в контракте нет и
быть не должно — разделы читаются девятью независимыми запросами.
