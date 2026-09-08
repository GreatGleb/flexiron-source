# Settings

Справочники и параметры арендатора: карточка компании, четыре финансовые константы, валюты,
единицы измерения, правила пересчёта, статусы заказов, профиль и пароль текущего пользователя,
почтовый сервер, карта склада и матрица трёх прав заказа. **Тридцать один эндпоинт**, все в
пространстве `/api/settings`.

**Общие соглашения — [`00-conventions.md`](00-conventions.md), и здесь они не повторяются.**
Конверт ответа и разбор ошибки — §1; коды ядра и правило «отказ несёт код, а не текст» — §2;
`PATCH` против `PUT` — §3; мультиарендность — §4; заголовки и четыре реализации «где лежит
токен» — §5; права и три их механизма — §6; аудит-лог — §9; уведомления — §10;
идемпотентность — §11; `TranslatedString` и три помощника слияния — §12; даты, деньги, валюта и
владение справочниками — §14; clean-slate против quick-action — §15; файлы и `POST /api/uploads`
— §16; производные значения — §17; чем мок отличается от обязанностей сервера — §18;
непрозрачность `id` — §19. Ниже — только то, что живёт в этом домене.

**Источник истины — бэкенд у 24 эндпоинтов из 31.** Модуль `backend/app/modules/settings/`
реализован двумя фичами: `crud` (21 роут — компания, константы и четыре коллекции) и `profile`
(3 роута — чтение, правка профиля и смена пароля). Формы запросов и ответов у этих 24 сняты со
схем бэкенда, а не с типов фронта; где фронт с ними расходится, стоит номер находки в
[`contract-sync-settings-bugs.md`](../../plans/bugs/contract-sync-settings-bugs.md).

**У семи эндпоинтов серверной половины нет вовсе**, и они описаны по клиенту и моку: три
эндпоинта карты склада, три почтовых и чтение прав заказа. У каждого стоит `Бэкенд: не
реализован` — метка `Статус: спроектировано` тут была бы неверна: она про отсутствие кода
вообще, а клиент и мок эти семь имеют. Ни одной модели под них на сервере нет: почты
(`grep -rn "smtp\|MailServer" backend/app/modules/settings` → пусто), карты
(`grep -c warehouse_map backend/app/modules/settings/shared/models.py` → 0) и прав (шесть
классов моделей модуля, прав среди них нет).

Потребители: [`services/settingsService.ts`](../../../frontend_vue/src/services/settingsService.ts)
— все 31 вызова; [`composables/useSettings.ts`](../../../frontend_vue/src/composables/useSettings.ts)
— девять параллельных чтений и общая кнопка Save; и
[`composables/useWarehouseMap.ts`](../../../frontend_vue/src/composables/useWarehouseMap.ts) —
своя страница карты, вне набора настроек. Экраны — семь вкладок
`frontend_vue/src/views/admin/settings/`.

**Реестр «клиент написан, UI нет» — одна строка:** `PATCH /api/settings/uoms/:id`. Функция
клиента существует, а вызывающего у неё нет: `save()` считает у единиц только добавленные и
удалённые, ветки изменённых там нет, и мутатора композабл не экспортирует. Подробности — в
разделе эндпоинта.

**Три особенности авторизации домена, и все три — находки, а не разрешённое поведение.** Общая
механика заголовков — §5 соглашений; домену принадлежит следующее:

- **токен читается только из `localStorage`**, тогда как вход кладёт его в `localStorage` **или**
  в `sessionStorage`: вошедший без «запомнить меня» получит 401 на всех 24 серверных роутах
  (БАГ-06);
- **восемь роутов из 24 не требуют токена вовсе** — PATCH и DELETE у всех четырёх коллекций; а
  репозиторий у тех же операций ищет запись по одному `id`, без арендатора, то есть зная UUID
  чужой валюты, её можно переименовать или удалить (БАГ-01);
- **срок токена в этом модуле не проверяется**: обе копии `_resolve_user_id` зовут `loads()` без
  `max_age`, тогда как `auth` на том же токене требует суток (БАГ-02). И сама функция разбора
  существует в модуле **двумя посимвольно одинаковыми копиями** (БАГ-03).

---

## Каталог кодов ошибок домена

**Своих кодов у сервера нет ни одного** — он бросает только коды ядра (§2 соглашений), а
доменные коды знает лишь мок:

| код | статус | где объявлен | эндпоинты |
|---|---|---|---|
| `UNAUTHORIZED` | 401 | ядро; домен бросает из `_resolve_user_id` (`crud/action.py:108`, `:115`, `:127`, те же три строки в `profile/action.py:51`, `:58`, `:70`) | все 16 роутов с токеном |
| `NOT_FOUND` | 404 | ядро; нет арендатора у пользователя (`crud/action.py:135-138`), нет самой записи (`crud/action.py:275-279`) | см. разделы |
| `VALIDATION_ERROR` | 422 | ядро; пустой код валюты, совпадение единиц, три случая смены пароля | POST валют, POST правил, смена пароля |
| `CONFLICT` | 409 | ядро; занятый код валюты, дубль пары единиц, справочник используется товарами | POST/DELETE валют, DELETE единиц, POST правил |
| `FORBIDDEN` | 403 | ядро; удаление системного статуса — единственное место во всём бэкенде, где поднимается `ForbiddenError` | DELETE статуса |
| `CURRENCY_NOT_FOUND` | — | только мок (`mocks/settings.ts:471`, `:477`) | PATCH/DELETE валюты |
| `UOM_NOT_FOUND` | — | только мок (`mocks/settings.ts:498`, `:504`) | PATCH/DELETE единицы |
| `CONVERSION_NOT_FOUND` | — | только мок (`mocks/settings.ts:525`, `:531`) | PATCH/DELETE правила |
| `ORDER_STATUS_NOT_FOUND` | — | только мок (`mocks/settings.ts:553`, `:577`) | PATCH/DELETE статуса |
| `MAIL_NOT_CONFIGURED` | — | только мок (`mocks/settings.ts:621`); кросс-доменный — тот же код бросает BCC-инструмент (`mocks/bcc.ts:317`) | POST почтового теста |
| `MAP_NOT_AN_IMAGE` | — | только мок (`mocks/settings.ts:654`) | PUT карты склада |

Три следствия, каждое проверяется по этой таблице:

1. **Ни один код домена не доходит до человека как код.** Из шести мок-кодов разбирается ровно
   один — `MAIL_NOT_CONFIGURED`, и разбирается неправильно: читается из `message`, а настоящий
   `ApiRequestError` кладёт код в поле `code` (БАГ-17). Остальные пять показываются как есть
   текстом: общая ошибка сохранения (`useSettings.ts:522`) и один тост карты
   (`useWarehouseMap.ts:61`).
2. **Четыре мок-кода содержат код ядра `NOT_FOUND` как подстроку.** Правило §2 соглашений
   («ни один код не подстрока другого») здесь формально нарушено, но живого дефекта нет:
   подстрочное сравнение кода написано в чужом домене (`services/orderLineEdits.ts:343-354`), а
   потребители настроек код не сравнивают вовсе. Правило важно для сервера: заводя доменный код,
   нельзя брать имя, внутри которого лежит `NOT_FOUND`.
3. **Пять серверных отказов приходят как 500, а не как код.** Домен бросает `NotFoundError` из
   пяти функций, а роуты, которые их зовут, `try/except` не имеют — глобального обработчика
   `AppError` в приложении нет (БАГ-11).

Кодов, которые старый контракт обещал, а в коде нет, три: `COMPANY_NOT_FOUND`,
`INVALID_PASSWORD` и статус 415 у карты склада — все в разделе «Чего в домене нет».

---

## Компания

Одна строка на арендатора, единичный ресурс без `id`. Экран — вкладка
`views/admin/settings/CompanySettings.vue`.

### GET /api/settings/company

Чтение карточки компании. Ни query, ни тела. Save-режим: чтение, один из девяти параллельных
запросов `fetchAllSections()`; набор идёт через `Promise.allSettled`, поэтому падение одного
раздела не рушит остальные (`useSettings.ts:227`, `:246-252`).

Ответ — `CompanyInfo`, шесть ключей в camelCase:

```ts
{
  name: string
  legalAddress: string
  vatCode: string
  bankName: string
  bankAccount: string
  logoUrl?: string | null
}
```

Схема сервера — `crud/schemas.py:15-25`, алиасы `:19-23`, сериализация `by_alias=True`
(`crud/action.py:156`); тип фронта — `types/settings.ts:4-11`. Расхождений нет. **Пять строковых
полей на выходе непусты всегда:** `None` из БД заменяется пустой строкой
(`crud/domain.py:77-84`), и только `logo_url` объявлен nullable.

**Строку компании создаёт сервер сам, и 404 «компании нет» недостижим по построению.** При
регистрации её создаёт чужой домен через межмодульный API — `init_company_info`
(`backend/app/modules/settings/internal_api/interface.py:67-79`, вызов
`backend/app/modules/auth/features/register/domain.py:106`); а если строки всё-таки нет, она
собирается прямо в обработчике чтения, с подстановкой имени и НДС-кода арендатора
(`crud/domain.py:67-76`).

Ошибки: только коды ядра — `UNAUTHORIZED` при отсутствии или порче токена и `NOT_FOUND`, если у
пользователя нет арендатора. Своего кода у эндпоинта нет ни одного; мок не бросает ничего.

Бэкенд: `settings/features/crud/action.py:146` — `get_company_route` · схемы `crud/schemas.py:15-25`
Реализация: `services/settingsService.ts:26` — `getCompany` · мок `mocks/index.ts:381` →
`mocks/settings.ts:413` — `mockGetCompany`

---

### PATCH /api/settings/company

Правка карточки. Save-режим: clean-slate — правки идут в стор через `updateCompany`
(`useSettings.ts:531-535`), запрос уходит по общей кнопке Save (`useSettings.ts:347-350`).

**Запрос — вся секция целиком, а не dirty-поля.** Подпись клиента обещает `Partial<CompanyInfo>`
(`settingsService.ts:30`), но вызов передаёт копию всей секции (`useSettings.ts:348`). Схема
сервера принимает шесть необязательных полей с теми же алиасами (`crud/schemas.py:28-38`).

**`None` означает «не менять», поэтому обнулить поле в `null` этим эндпоинтом нельзя**
(`crud/domain.py:103-106`); пустая строка при этом проходит и записывается.

Ответ: `CompanyInfo` целиком после merge — конверт собирает `model_dump` с алиасами
(`crud/action.py:168-172`).

Ошибки: коды ядра. **Валидации полей нет ни на одной стороне** — ни НДС-код, ни IBAN не
проверяются: домен только перекладывает значения (`crud/domain.py:94-112`).

**`logoUrl` обязан быть URL от `POST /api/uploads`, а сегодня может оказаться base64.** Для
мгновенного превью выбранный файл читается в data-URL и кладётся прямо в стор
(`views/admin/settings/SettingsLayout.vue:328-338`); настоящий URL приходит позже событием
загрузки и подменяет превью, но Save, нажатый в промежутке, отправит PATCH с base64, а колонка
это примет — она `Text` (БАГ-18). Сервер обязан отвергать тело, где `logoUrl` не URL.

Бэкенд: `settings/features/crud/action.py:160` — `patch_company_route` · схемы `crud/schemas.py:28-38`
Реализация: `services/settingsService.ts:30` — `saveCompany` · мок `mocks/index.ts:1339` →
`mocks/settings.ts:422` — `mockPatchCompany`

---

## Финансовые константы

Четыре числа на арендатора, единичный ресурс. Владелец этих значений — домен `settings`, и это
общее правило проекта (§14 соглашений). Экран — вкладка
`views/admin/settings/FinanceSettings.vue`.

### GET /api/settings/constants

Чтение четырёх констант. Ни query, ни тела. Save-режим: чтение, запрос №2 из девяти
(`useSettings.ts:229`).

Ответ — `GlobalConstants`:

```ts
{
  vatRate: number                  // проценты, не доля
  defaultMargin: number            // проценты
  defaultCurrency: string          // КОД валюты ('EUR'), а не её id
  defaultDiscountPercent: number
}
```

Схема сервера — `crud/schemas.py:43-51`, тип фронта — `types/settings.ts:14-19`. Числа приводятся
из `Numeric` во `float` при чтении (`crud/domain.py:132-137`). `defaultCurrency` — колонка
`String(10)` с кодом валюты (`backend/app/modules/settings/shared/models.py:50-52`), не ссылка на
запись.

**Строка констант создаётся при первом чтении, и значения назначает сервер:** `vat_rate=21`,
`default_margin=15`, `default_currency='EUR'`, `default_discount_percent=0`
(`crud/domain.py:129-131`, дефолты колонок — `models.py:44-55`). То есть у нового арендатора эти
четыре числа появляются без единого действия человека, и «EUR» выбирает не он.

Ошибки: коды ядра; своих нет, мок не бросает ничего.

Бэкенд: `settings/features/crud/action.py:179` — `get_constants_route` · схемы `crud/schemas.py:43-51`
Реализация: `services/settingsService.ts:42` — `getConstants` · мок `mocks/index.ts:382` →
`mocks/settings.ts:429` — `mockGetConstants`

---

### PATCH /api/settings/constants

Правка констант. Save-режим: clean-slate — `updateConstants` правит стор
(`useSettings.ts:536-540`), запрос по Save (`useSettings.ts:353-356`).

Запрос — **вся секция целиком**, а не dirty-поля (`useSettings.ts:354`); схема принимает четыре
необязательных поля с camelCase-алиасами (`crud/schemas.py:54-62`), `None` = «не менять»
(`crud/domain.py:154-157`).

Ответ: `GlobalConstants` целиком после merge, тем же `model_dump` с алиасами
(`crud/action.py:201-205`).

Ошибки: коды ядра. **Ни одна из четырёх величин не проверяется ничем:** проценты могут быть
отрицательными или больше ста, а `defaultCurrency` не сверяется со списком валют арендатора — в
`patch_global_constants` нет ни одного обращения к валютам (`crud/domain.py:140-170`). Старый
контракт обещал обратное («должен соответствовать одной из валют») — правила нет нигде, строка
осталась владельцу.

**Смена валюты по умолчанию — операция из двух и более запросов, и общей транзакции у них нет.**
Клиент снимает флаг `isDefault` у всех валют и ставит его одной (`SettingsLayout.vue:436-446`),
а затем Save шлёт PATCH каждой изменившейся валюты (`useSettings.ts:403-405`) плюс этот PATCH
констант (`:353-356`). Инвариант «валюта по умолчанию ровно одна» держит только клиент (БАГ-09), а
какой из двух источников главный — флаг записи или код в константах — строка владельцу.

Бэкенд: `settings/features/crud/action.py:193` — `patch_constants_route` · схемы `crud/schemas.py:54-62`
Реализация: `services/settingsService.ts:46` — `saveConstants` · мок `mocks/index.ts:1343` →
`mocks/settings.ts:449` — `mockPatchConstants`

---

## Валюты

Коллекция арендатора. Секция внутри вкладки финансов. Общее правило проекта: **справочник
принадлежит серверу, копий его во фронте быть не должно** (§14 соглашений) — известное нарушение
у этого справочника одно и записано находкой: жёсткий список `EUR/USD/PLN/GBP` в карточке
поставщика (`components/admin/SupplierFormSections.vue:58-63`).

**Конвертации валют в проекте нет нигде** (§14), но у сервера есть колонка курса, а у фронта её
нет: расхождение проходит через все четыре раздела ниже и остаётся строкой владельцу.

### GET /api/settings/currencies

Список валют. Ни query, ни тела, **пагинации нет**. Save-режим: чтение, запрос №5 из девяти
(`useSettings.ts:232`).

Ответ — `Currency[]`; у сервера на одно поле больше, чем у фронта:

```ts
{
  id: string
  code: string                  // 'EUR'
  name: TranslatedString
  isDefault: boolean
  exchangeRate: number          // ОТДАЁТ СЕРВЕР; в типе фронта поля нет
  updatedAt?: string            // ISO-строка колонки, у обеих сторон необязательна
}
```

Тип фронта — `types/settings.ts:22-28`; серверная схема — `crud/schemas.py:64-77`. Курс объявлен
полем схемы (`crud/schemas.py:73`) и заполняется из колонки (`crud/domain.py:184`), а во фронте не
читается ничем: типа для него нет, конвертации в проекте нет (§14 соглашений). Время правки сервер
отдаёт (`crud/domain.py:186`), фронт его тоже не читает.

**Порядок выдачи не задан:** выборка идёт без сортировки (`crud/repository.py:87-91`). Сервер
обязан назвать умолчание — §13 соглашений требует этого от каждого списка.

Список кладётся в поле конверта, объявленное как `dict | None` (БАГ-04): это один из четырёх
списочных GET домена и единственные четыре места во всём бэкенде, где в `data` уходит массив.

Ошибки: коды ядра; своих нет, мок не бросает ничего.

Бэкенд: `settings/features/crud/action.py:212` — `get_currencies_route` · схемы `crud/schemas.py:64-77`
Реализация: `services/settingsService.ts:52` — `getCurrencies` · мок `mocks/index.ts:384` →
`mocks/settings.ts:456` — `mockGetCurrencies`

---

### POST /api/settings/currencies

Создание валюты. Save-режим: clean-slate — `_addCurrency` кладёт строку с временным id
`cur-temp-<ts>` (`useSettings.ts:554-559`), запрос уходит по Save (`useSettings.ts:386-399`).

Запрос по схеме сервера `CurrencyCreateInput` (`crud/schemas.py:80-88`):

```ts
{ code: string; name: TranslatedString; exchangeRate: number; isDefault?: boolean }
```

**Обязательных полей четыре, и форма шлёт три** — `code` в верхнем регистре, `name` во всех трёх
локалях и `isDefault: false` (`SettingsLayout.vue:355-359`). У курса значения по умолчанию в
схеме нет, поэтому против настоящего сервера создание валюты кончается 422 Pydantic (БАГ-05).
Остаётся ли курс в модели — строка владельцу; до решения этот эндпоинт работает только под моками.

Ответ: `Currency` с серверным `id`, конверт собирает `model_dump` (`crud/action.py:236-239`). **Формат идентификатора контракт
не обещает** (§19 соглашений): сервер выдаёт UUID, мок — читаемый `cur-{N}`.

**Клиент опознаёт созданную строку по коду валюты** (`useSettings.ts:387-396`), то есть сервер
обязан вернуть тот же `code`, что получил, — иначе временный id останется в сторе.

Ошибки: `VALIDATION_ERROR` (422) на пустой код — перехват `ValidationError` (`crud/action.py:240-244`), источник
`crud/domain.py:197`) и `CONFLICT` (409) на код, уже занятый у арендатора (`crud/action.py:245-249`,
источник `crud/domain.py:202`); тот же запрет стоит в БД составным ограничением
(`models.py:81-83`). **Мок не бросает ни того, ни другого** (`mocks/settings.ts:460-467`), и форма
дублей не ловит — `isCurrencyFormValid` проверяет только непустоту (`SettingsLayout.vue:354`).

Бэкенд: `settings/features/crud/action.py:226` — `create_currency_route` · схемы `crud/schemas.py:80-88`
Реализация: `services/settingsService.ts:56` — `createCurrency` · мок `mocks/index.ts:1126` →
`mocks/settings.ts:460` — `mockCreateCurrency`

---

### PATCH /api/settings/currencies/:id

Правка валюты. Save-режим: clean-slate. Единственный живой путь правки — переключение валюты по
умолчанию (`views/admin/settings/FinanceSettings.vue:102` → `SettingsLayout.vue:430-446`), которое
локально снимает флаг у всех и потому порождает столько PATCH, сколько валют изменилось
(`useSettings.ts:403-405`).

Запрос по схеме `CurrencyPatchInput` (`crud/schemas.py:91-99`) — четыре необязательных поля:

```ts
{ code?: string; name?: TranslatedString; exchangeRate?: number; isDefault?: boolean }
```

Дельта собирается пофайловым сравнением со снимком — `findUpdated` (`useSettings.ts:176-198`,
вызов `:379`), то есть здесь клиент шлёт **только изменившиеся ключи**, в отличие от секций.

Ответ: сервер отдаёт `CurrencyResponse` целиком, через `model_dump` (`crud/action.py:259-263`); клиент ответ не
читает — подпись `Promise<void>` (`settingsService.ts:60`), мок возвращает `undefined`.

Ошибки: `NOT_FOUND` домен бросает как `NotFoundError` (`crud/domain.py:226`), **но роут его не ловит** — придёт 500
(БАГ-11). Мок — `CURRENCY_NOT_FOUND`. **Уникальность кода на PATCH не проверяется** (на POST
проверяется), поэтому занятый код упрётся в ограничение БД и вылетит ошибкой драйвера, а не
`CONFLICT` (БАГ-10). Токена роут не требует (БАГ-01).

**Инвариант «валюта по умолчанию ровно одна» сервер не держит:** `update_currency_item` пишет
присланный флаг и других валют не касается (`crud/domain.py:221-254`). Правило живёт только в
клиенте (БАГ-09); для сервера это задача — снимать флаг у остальных в той же транзакции.

Бэкенд: `settings/features/crud/action.py:252` — `patch_currency_route` · схемы `crud/schemas.py:91-99`
Реализация: `services/settingsService.ts:60` — `updateCurrency` · мок `mocks/index.ts:1356` →
`mocks/settings.ts:469` — `mockUpdateCurrency`

---

### DELETE /api/settings/currencies/:id

Удаление валюты. Тела нет. Save-режим: clean-slate — `_removeCurrency` правит стор
(`useSettings.ts:560-565`), запрос уходит по Save (`useSettings.ts:400-402`).

Ответ: `ApiResponse` без `data` (`crud/action.py:274`), после снятия конверта клиент получает
`undefined`.

Ошибки: `NOT_FOUND` (404, `crud/action.py:275-279`, источник `crud/domain.py:260`) и `CONFLICT`
(409, `crud/action.py:280-284`, источник `crud/domain.py:266`) — «валюта используется N товарами»,
счёт идёт межмодульным вызовом `count_products_by_currency` (`crud/domain.py:263-264`). Мок знает
только `CURRENCY_NOT_FOUND` и проверки использования не делает вовсе.

**Валюту по умолчанию сегодня удалить можно, и это не разрешённое поведение, а находка.** Ни флаг
записи, ни код в константах не проверяет никто (`crud/domain.py:257-268`); инвариант держит
единственный атрибут `disabled` на кнопке (`FinanceSettings.vue:111-114`) — БАГ-08. Каким кодом
сервер обязан отвечать, в домене нет: строка владельцу.

Бэкенд: `settings/features/crud/action.py:266` — `delete_currency_route` · домен `crud/domain.py:257-268`
Реализация: `services/settingsService.ts:64` — `deleteCurrency` · мок `mocks/index.ts:1632` →
`mocks/settings.ts:475` — `mockDeleteCurrency`

---

## Единицы измерения

Коллекция арендатора. Экран — вкладка `views/admin/settings/UnitsSettings.vue`.

**Категорий восемь, и список закрыт типом фронта:** `weight`, `length`, `area`, `volume`,
`quantity`, `density`, `thickness` плюс `time`, добавленная ради услуг (`types/settings.ts:31-40`).
На сервере это `String(20)` без ограничения, а комментарий рядом с колонкой перечисляет прежние
семь (`models.py:99-101`) — то есть сервер примет любую строку. Кто владеет перечнем — контракт
называет фронт: тип замкнут, и добавленная категория обязана появиться в нём.

### GET /api/settings/uoms

Список единиц. Ни query, ни тела, пагинации нет. Save-режим: чтение, запрос №6 из девяти
(`useSettings.ts:233`).

Ответ — `Uom[]`:

```ts
{ id: string; code: TranslatedString; name: TranslatedString; category: UomCategory }
```

Тип фронта — `types/settings.ts:70-75`; схема сервера — `crud/schemas.py:104-112`, где `code`
собирается из колонки `code_translations`, а `name` — из `name_translations`
(`crud/domain.py:276-281`). **Код единицы переводимый, а не строка** — это одно из немногих мест,
где схема и тип сходятся (§12 соглашений).

Порядок выдачи не задан (`crud/repository.py:141-145`). Список уходит в поле конверта типа
`dict | None` (БАГ-04).

Ошибки: коды ядра; своих нет, мок не бросает ничего.

Бэкенд: `settings/features/crud/action.py:291` — `get_uoms_route` · схемы `crud/schemas.py:104-112`
Реализация: `services/settingsService.ts:70` — `getUoms` · мок `mocks/index.ts:385` →
`mocks/settings.ts:483` — `mockGetUoms`

---

### POST /api/settings/uoms

Создание единицы. Save-режим: clean-slate — `_addUom` кладёт строку с временным id
`uom-temp-<ts>` (`useSettings.ts:566-571`), запрос по Save (`useSettings.ts:417-428`).

Запрос по схеме `UomCreateInput` (`crud/schemas.py:115-122`) — все три поля обязательны:

```ts
{ code: TranslatedString; name: TranslatedString; category: UomCategory }
```

Форма кладёт одну и ту же строку во все три локали (`SettingsLayout.vue:367-371`) — то есть
переводы вводятся не здесь, а правкой позже; сервер обязан хранить все три ключа как пришли.

Ответ: `Uom` с серверным `id`, тем же `model_dump` (`crud/action.py:314-317`); формат id контракт не
обещает.

**Уникальность кода не проверяет никто, кроме формы.** Функция поиска по коду в репозитории есть
(`crud/repository.py:153-168`) и используется только межмодульным API
(`backend/app/modules/settings/internal_api/interface.py:59-64`); домен создания её не зовёт.
Дубль ловит вычислимое формы — `isUomCodeDuplicate` (`SettingsLayout.vue:365`, объявление `:190`).
Кому принадлежит это правило — вопрос сервера: у валют оно на сервере есть, у единиц нет.

Ошибки: ни одного специфичного — ни домен (`crud/domain.py:286-300`), ни мок не бросают.

**Подмена временного id сравнивает объекты, а не значения** — `code` это `TranslatedString`, и
сравнение работает только потому, что в память попала та же ссылка (БАГ-16). Для сервера это
значит: ответ обязан нести тот же `code`, но полагаться на порядок сопоставления в клиенте нельзя.

Бэкенд: `settings/features/crud/action.py:305` — `create_uom_route` · схемы `crud/schemas.py:115-122`
Реализация: `services/settingsService.ts:74` — `createUom` · мок `mocks/index.ts:1128` →
`mocks/settings.ts:487` — `mockCreateUom`

---

### PATCH /api/settings/uoms/:id

Правка единицы. **Клиент написан, UI нет — единственная такая строка домена.** `save()` считает
у единиц только добавленные и удалённые (`useSettings.ts:410-433`); ветки `findUpdated` у `uoms`,
в отличие от валют, правил и статусов, там нет, и мутатора `updateUom` композабл не экспортирует
(`useSettings.ts:674-704`). То есть эндпоинт существует, а вызвать его сегодня нечем.

Запрос по схеме `UomPatchInput` (`crud/schemas.py:125-132`) — три необязательных поля:

```ts
{ code?: TranslatedString; name?: TranslatedString; category?: UomCategory }
```

Ответ: сервер отдаёт `UomResponse` целиком, через `model_dump` (`crud/action.py:327-331`); подпись клиента —
`Promise<void>`.

Ошибки: `NOT_FOUND` домен бросает как `NotFoundError` (`crud/domain.py:308`), роут не ловит — 500
(БАГ-11). Мок — `UOM_NOT_FOUND`. Токена роут не требует (БАГ-01). **Значение категории не сверяется со списком ни
на одной стороне** (`crud/domain.py:315-316`).

**Смена категории у единицы, на которую ссылаются правила пересчёта и товары, не проверяется
ничем.** Старый контракт разрешал её «с осторожностью», но правила, ограничивающего эту
осторожность, нет нигде — строка владельцу вместе с судьбой удаления единицы.

Бэкенд: `settings/features/crud/action.py:320` — `patch_uom_route` · схемы `crud/schemas.py:125-132`
Реализация: `services/settingsService.ts:78` — `updateUom` (вызывающего нет) · мок
`mocks/index.ts:1372` → `mocks/settings.ts:496` — `mockUpdateUom`

---

### DELETE /api/settings/uoms/:id

Удаление единицы. Тела нет. Save-режим: clean-slate — `_removeUom` правит стор
(`useSettings.ts:572-577`), запрос по Save (`useSettings.ts:429-431`), кнопка —
`views/admin/settings/UnitsSettings.vue:79`.

Ответ: `ApiResponse` без `data` (`crud/action.py:342`).

Ошибки: `NOT_FOUND` (404, `crud/action.py:343-347`) и `CONFLICT` (409, `crud/action.py:348-352`,
источник `crud/domain.py:342`) — единица используется товарами, счёт межмодульным
`count_products_by_uom` (`crud/domain.py:339-340`). Мок — `UOM_NOT_FOUND`.

**Правила пересчёта при удалении единицы не проверяет никто, и схема сносит их молча:** обе
стороны связи объявлены каскадом (`models.py:117`, `:122`) — БАГ-07. Из трёх пунктов, обещанных
старым контрактом («товары, правила пересчёта, заказы»), реализован один, по второму поведение
противоположно обещанному, а заказов на бэкенде нет вовсе. Что здесь верно — `CONFLICT` или
каскад — решение владельца; контракт фиксирует наблюдаемое.

Бэкенд: `settings/features/crud/action.py:334` — `delete_uom_route` · домен `crud/domain.py:333-344`
Реализация: `services/settingsService.ts:82` — `deleteUom` · мок `mocks/index.ts:1637` →
`mocks/settings.ts:502` — `mockDeleteUom`

---

## Правила пересчёта

Коллекция арендатора: матрица «из единицы в единицу». Секция внутри вкладки единиц.

**Тип правила и список формул закрыты во фронте и открыты на схеме.** `ConversionType` — два
значения (`types/settings.ts:43`); формул три, и тип выведен из массива —
`CONVERSION_FORMULA_TYPES` (`types/settings.ts:55-59`), из него же собираются опции селекта и
подписи. На сервере это свободные строки: `String(20)` у типа и `String(50)` у формулы
(`models.py:125-133`). Сервер не обязан соблюдать замкнутость сам,
но контракт называет её правилом домена.

### GET /api/settings/conversions

Список правил. Ни query, ни тела, пагинации нет. Save-режим: чтение, запрос №7 из девяти
(`useSettings.ts:234`).

Ответ — `UomConversion[]`:

```ts
{
  id: string
  fromUomId: string
  toUomId: string
  type: 'static' | 'dynamic'
  factor?: number            // у static
  formulaType?: string       // у dynamic, из CONVERSION_FORMULA_TYPES
}
```

Тип фронта — `types/settings.ts:78-85`; схема сервера — `crud/schemas.py:137-147`, сборка ответа
`crud/domain.py:353-363`. Порядок выдачи не задан (`crud/repository.py:198-202`). Список уходит в
поле конверта типа `dict | None` (БАГ-04).

**Коэффициент, равный нулю, до клиента не доезжает:** сборка пишет `float(c.factor) if c.factor
else None`, а ноль в Python ложен (`crud/domain.py:359`, тот же приём `:394` и `:430`) — БАГ-19.
Ноль как коэффициент бессмысленен, но записать его сегодня можно: запрета нет ни в домене, ни в
форме.

Ошибки: коды ядра; своих нет, мок не бросает ничего.

Бэкенд: `settings/features/crud/action.py:359` — `get_conversions_route` · схемы `crud/schemas.py:137-147`
Реализация: `services/settingsService.ts:88` — `getConversions` · мок `mocks/index.ts:386` →
`mocks/settings.ts:510` — `mockGetConversions`

---

### POST /api/settings/conversions

Создание правила. Save-режим: clean-slate — `_addConversion` кладёт строку с временным id
`conv-temp-<ts>` (`useSettings.ts:578-583`), запрос по Save (`useSettings.ts:444-456`).

Запрос по схеме `ConversionCreateInput` (`crud/schemas.py:150-159`):

```ts
{
  fromUomId: string          // обязателен
  toUomId: string            // обязателен
  type: 'static' | 'dynamic' // обязателен
  factor?: number
  formulaType?: string
}
```

Фактически клиент шлёт либо пару с коэффициентом, либо пару с формулой
(`SettingsLayout.vue:380-394`). **Связка «static → factor, dynamic → formulaType» на сервере не
проверяется**, поэтому правило без коэффициента и без формулы он примет (БАГ-20). Форма это
правило знает и соблюдает (`SettingsLayout.vue:377-378`), но клиент — не место для серверного
инварианта.

Ответ: `UomConversion` с серверным `id`, тем же `model_dump` (`crud/action.py:382-386`). **Клиент опознаёт созданную
строку по паре единиц** (`useSettings.ts:445-454`), значит сервер обязан вернуть ту же пару, что
получил.

Ошибки: `VALIDATION_ERROR` (422) на одну и ту же единицу с обеих сторон — перехват
`ValidationError` (`crud/action.py:387-391`), источник `crud/domain.py:374`; и `CONFLICT` (409) на
уже описанную пару (`crud/action.py:392-396`, источник `crud/domain.py:379`). **Мок не бросает ни того, ни другого** (`mocks/settings.ts:514-521`)
— под моками дубль пары создаётся молча, и путь ошибки в демо не воспроизводится.

Бэкенд: `settings/features/crud/action.py:373` — `create_conversion_route` · схемы `crud/schemas.py:150-159`
Реализация: `services/settingsService.ts:92` — `createConversion` · мок `mocks/index.ts:1130` →
`mocks/settings.ts:514` — `mockCreateConversion`

---

### PATCH /api/settings/conversions/:id

Правка правила. Save-режим: clean-slate — инлайновая правка коэффициента в таблице
(`views/admin/settings/UnitsSettings.vue:43`) идёт в стор через `updateConversion`
(`useSettings.ts:590-595`), запрос по Save (`useSettings.ts:460-462`); дельта — от `findUpdated`
(`useSettings.ts:438`).

Запрос по схеме `ConversionPatchInput` (`crud/schemas.py:162-171`) — пять необязательных полей,
включая **обе единицы**:

```ts
{ fromUomId?: string; toUomId?: string; type?: string; factor?: number; formulaType?: string }
```

**Обнулить `factor` или `formulaType` этим эндпоинтом нельзя:** `None` означает «не менять»
— обе ветки записи стоят под `is not None` (`crud/domain.py:413-416`), поэтому правило,
переключённое со static на dynamic, сохранит старый коэффициент (БАГ-21). Для сервера это задача: явный `null` обязан значить «стереть».

**Ни совпадение единиц, ни дубль пары на PATCH не проверяются**, хотя обе проверки написаны для
создания — правило можно перевесить на уже описанную пару или на одну единицу с обеих сторон
(БАГ-21).

Ответ: сервер отдаёт `ConversionResponse` целиком, через `model_dump` (`crud/action.py:406-410`);
подпись клиента —
`Promise<void>`.

Ошибки: `NOT_FOUND` домен бросает как `NotFoundError` (`crud/domain.py:404`), роут не ловит — 500
(БАГ-11). Мок — `CONVERSION_NOT_FOUND`. Токена роут не требует (БАГ-01).

Бэкенд: `settings/features/crud/action.py:399` — `patch_conversion_route` · схемы `crud/schemas.py:162-171`
Реализация: `services/settingsService.ts:96` — `updateConversion` · мок `mocks/index.ts:1364` →
`mocks/settings.ts:523` — `mockUpdateConversion`

---

### DELETE /api/settings/conversions/:id

Удаление правила. Тела нет. Save-режим: clean-slate — `_removeConversion` правит стор
(`useSettings.ts:584-589`), кнопка в таблице (`views/admin/settings/UnitsSettings.vue:14`), запрос
по Save (`useSettings.ts:457-459`).

Ответ: `ApiResponse` без `data` (`crud/action.py:420`).

Ошибки: `NOT_FOUND` домен бросает как `NotFoundError` (`crud/domain.py:438`), **роут его не ловит** — в отличие от
соседних DELETE валют и единиц (БАГ-11). Мок — `CONVERSION_NOT_FOUND` (`mocks/settings.ts:531`).
Токена роут не требует (БАГ-01).

**Удаление правила ничего не проверяет ни на одной стороне:** используется ли оно кем-нибудь, не
смотрит ни мок, ни домен — там только проверка существования (`crud/domain.py:435-439`). Правило
пересчёта читают склад и карточка товара, поэтому это не безобидно; правила отказа в домене нет —
строка владельцу.

Бэкенд: `settings/features/crud/action.py:413` — `delete_conversion_route` · домен `crud/domain.py:435-439`
Реализация: `services/settingsService.ts:100` — `deleteConversion` · мок `mocks/index.ts:1642` →
`mocks/settings.ts:529` — `mockDeleteConversion`

---

## Статусы заказов

Коллекция арендатора и одновременно словарь чужого домена: на этот список опирается весь фронт
заказов. Экран — вкладка `views/admin/settings/OrderStatusesSettings.vue`.

**Два поля на проводе — переименование колонок, и сервер обязан держать это соответствие:**
`order` это `sort_order`, `system` это `is_system` (`crud/domain.py:453-454`).

**Системные статусы не создаёт никто.** Создание жёстко пишет `is_system=False`
(`crud/domain.py:469`), схема PATCH поля `system` не принимает, сидов в миграциях нет — а весь
фронт заказов опирается на замкнутый список (`frontend_vue/src/domain/orderStatus.ts`), и все
пятнадцать сидовых статусов мока помечены системными (`mocks/settings.ts:210-345`). Откуда они
берутся у нового арендатора — строка владельцу, и она же первая по важности в этом домене.

### GET /api/settings/order-statuses

Список статусов. Ни query, ни тела, пагинации нет. Save-режим: чтение, запрос №8 из девяти
(`useSettings.ts:235`).

Ответ — `OrderStatusSetting[]`:

```ts
{
  id: string
  name: TranslatedString
  color: string                    // HEX #RRGGBB
  order: number                    // 0-based, колонка sort_order
  system?: boolean                 // колонка is_system
  reserveOnTransition?: boolean
  writeOffOnTransition?: boolean
}
```

Тип фронта — `types/settings.ts:88-98`; схема сервера — `crud/schemas.py:176-187`.

**Порядок задан, и это единственный список домена, у которого он задан:** выборка сортируется по
`sort_order` (`crud/repository.py:253-259`). Список уходит в поле конверта типа `dict | None`
(БАГ-04).

Ошибки: коды ядра; своих нет, мок не бросает ничего.

Бэкенд: `settings/features/crud/action.py:427` — `get_order_statuses_route` · схемы `crud/schemas.py:176-187`
Реализация: `services/settingsService.ts:106` — `getOrderStatuses` · мок `mocks/index.ts:387` →
`mocks/settings.ts:537` — `mockGetOrderStatuses`

---

### POST /api/settings/order-statuses

Создание статуса. Save-режим: clean-slate — `_addOrderStatus` кладёт строку с временным id
`st-temp-<ts>` (`useSettings.ts:596-601`), запрос по Save (`useSettings.ts:488-502`).

Запрос по схеме `OrderStatusCreateInput` (`crud/schemas.py:190-199`):

```ts
{
  name: TranslatedString            // обязательно
  color: string                     // обязательно
  order: number                     // обязательно
  reserveOnTransition?: boolean     // по умолчанию false
  writeOffOnTransition?: boolean    // по умолчанию false
}
```

Поля `system` в схеме нет — и это правильно: системность назначает не клиент. Контракт говорит
это прямо, вместо того чтобы описывать поле, которое сервер обязан игнорировать.

Ответ: `OrderStatusSetting` с серверным `id`, тем же `model_dump` (`crud/action.py:450-453`);
формат id контракт не обещает. **Мок и сервер расходятся по одному полю:** мок переписывает присланный порядок на индекс
в конце списка (`mocks/settings.ts:547`), сервер сохраняет присланный (`crud/domain.py:468`).
Источник истины — сервер.

Ошибки: ни одного специфичного — ни домен (`crud/domain.py:462-482`), ни мок не бросают.
**Уникальность имени, формат цвета и коллизия порядка не проверяются нигде.**

**Подмена временного id ищет строку «первую, которой нет в снимке»** (`useSettings.ts:488-502`) —
предикат не зависит ни от запроса, ни от ответа, поэтому при двух добавленных за один Save
статусах оба ответа перезапишут одну строку (БАГ-15). Сервер обязан вернуть созданную запись
целиком; сопоставление — задача клиента.

Бэкенд: `settings/features/crud/action.py:441` — `create_order_status_route` · схемы `crud/schemas.py:190-199`
Реализация: `services/settingsService.ts:112` — `createOrderStatus` · мок `mocks/index.ts:1132` →
`mocks/settings.ts:541` — `mockCreateOrderStatus`

---

### PATCH /api/settings/order-statuses/:id

Правка статуса. Save-режим: clean-slate — правки названия, цвета и складских флагов идут в стор
через `updateOrderStatus` (`useSettings.ts:608-613`; вызовы — `SettingsLayout.vue:455` и
`views/admin/settings/OrderStatusesSettings.vue:15`), запрос по Save (`useSettings.ts:506-508`);
дельта — от `findUpdated` (`useSettings.ts:469`).

Запрос по схеме `OrderStatusPatchInput` (`crud/schemas.py:202-211`):

```ts
{
  name?: TranslatedString
  color?: string
  order?: number
  reserveOnTransition?: boolean
  writeOffOnTransition?: boolean
}
```

**`system` иммутабельно потому, что поля просто нет в схеме**, а не потому, что сервер его
отвергает: лишнее поле pydantic отбросит молча.

**Порядок правится двумя путями сразу.** Схема PATCH `order` принимает (`crud/schemas.py:207`), и
дельта его положит, если он изменился (`useSettings.ts:187-192`), — при том что для порядка есть
отдельный `PUT …/reorder`. Старый контракт утверждал, что `order` меняется только reorder-ом; это
неверно. Какой путь главный — вопрос сервера: два способа писать одно поле дают две разные
нумерации.

Ответ: сервер отдаёт `OrderStatusResponse` целиком, через `model_dump` (`crud/action.py:475-479`);
подпись клиента —
`Promise<void>`.

Ошибки: `NOT_FOUND` домен бросает как `NotFoundError` (`crud/domain.py:490`), роут не ловит — 500
(БАГ-11). Мок — `ORDER_STATUS_NOT_FOUND`. Токена роут не требует (БАГ-01). **Формат цвета не проверяет никто:**
колонка `String(7)` (`models.py:148`), проверки `#RRGGBB` нет ни в домене
(`crud/domain.py:496-497`), ни в моке.

Бэкенд: `settings/features/crud/action.py:468` — `patch_order_status_route` · схемы `crud/schemas.py:202-211`
Реализация: `services/settingsService.ts:120` — `updateOrderStatus` · мок `mocks/index.ts:1378` →
`mocks/settings.ts:551` — `mockUpdateOrderStatus`

---

### PUT /api/settings/order-statuses/reorder

Перестановка статусов. `PUT`, а не `PATCH`: тело — весь упорядоченный набор, замена целиком (§3
соглашений). Save-режим: clean-slate — drag-and-drop правит стор (`SettingsLayout.vue:464-471` →
`useSettings.ts:614-622`), запрос уходит по Save и только если порядок действительно изменился или
что-то удалено (`useSettings.ts:477-486`).

Запрос:

```ts
{ orderedIds: string[] }        // ПОЛНЫЙ упорядоченный список id
```

Подпись клиента — `settingsService.ts:127-133`; схема сервера с тем же алиасом —
`crud/schemas.py:214-219`.

Ответ: `ApiResponse` без `data` (`crud/action.py:465`).

Ошибки: **ни одной.** Сервер перебирает id и пишет `sort_order=idx` по паре `(id, tenant_id)`
(`crud/repository.py:294-306`) — это единственная операция над отдельными записями, ограниченная
арендатором. Следствия, которые сервер обязан назвать явно:

- **несуществующий или чужой id не даёт эффекта и не даёт ошибки** — `UPDATE` без совпадения строк
  не отказ;
- **неполный список тоже не ошибка**: статусы, которых в нём нет, сохранят прежний `sort_order` и
  могут столкнуться с новыми номерами;
- **мок ведёт себя иначе** — недостающие статусы дописывает в конец и перенумеровывает все
  (`mocks/settings.ts:557-573`). Источник истины — сервер, но расхождение значит, что демо не
  показывает последствий неполного списка.

**«Атомарная перезапись» из старого контракта — это цикл из N отдельных `UPDATE` с одним
`commit`** (`crud/repository.py:296-306`): атомарность держится транзакцией запроса, а не
конструкцией запроса, и частичный список приводит к неконсистентной нумерации.

Бэкенд: `settings/features/crud/action.py:456` — `reorder_order_statuses_route` · репозиторий `crud/repository.py:294-306`
Реализация: `services/settingsService.ts:127` — `moveOrderStatus` · мок `mocks/index.ts:1147` →
`mocks/settings.ts:557` — `mockMoveOrderStatus`

---

### DELETE /api/settings/order-statuses/:id

Удаление статуса. Тела нет. Save-режим: clean-slate — `_removeOrderStatus` правит стор
(`useSettings.ts:602-607`), запрос по Save (`useSettings.ts:503-505`). **Удаление — это два
запроса без общей транзакции:** вместе с DELETE Save шлёт `PUT …/reorder`
(`useSettings.ts:482-486`).

Ответ: `ApiResponse` без `data` (`crud/action.py:490`).

Ошибки: `NOT_FOUND` (404, `crud/action.py:507-511`) и `FORBIDDEN` (403, `crud/action.py:512-516`,
источник `crud/domain.py:529`) — на системный статус. Это **единственное место во всём бэкенде,
где поднимается `ForbiddenError`** (§6 соглашений). Мок знает только `ORDER_STATUS_NOT_FOUND` и
**системность не проверяет вовсе** (БАГ-14), то есть под моками удаляется то, что сервер запретит.

**Проверки «статус используется в заказах» нет нигде** — она оставлена комментарием-TODO
(`crud/domain.py:531-532`), а обещал её старый контракт. Заказов на бэкенде нет вовсе, так что для
сервера это будущая работа, а не восстановление существующего.

**Дыры в нумерации после удаления сервер не заделывает** (`crud/domain.py:522-534`), а мок
перенумеровывает (`mocks/settings.ts:579`). При чтении дыры не видны, потому что порядок задаётся
сортировкой; обязан ли сервер нормализовать — строка владельцу.

Бэкенд: `settings/features/crud/action.py:482` — `delete_order_status_route` · домен `crud/domain.py:522-534`
Реализация: `services/settingsService.ts:135` — `deleteOrderStatus` · мок `mocks/index.ts:1647` →
`mocks/settings.ts:575` — `mockDeleteOrderStatus`

---

## Профиль и пароль

Профиль **текущего** пользователя, определяемого токеном: id в пути нет ни у чтения, ни у правки.
Реализовано отдельной фичей `profile`, со своей копией разбора токена (БАГ-03). Экран — вкладка
`views/admin/settings/ProfileSettings.vue`.

### GET /api/settings/profile

Чтение профиля. Ни query, ни тела. Save-режим: чтение, запрос №9 из девяти
(`useSettings.ts:236`).

Ответ — `UserProfile`:

```ts
{
  firstName: string
  lastName: string
  email: string
  phone: string          // пустая строка вместо null
  role: string
  secretLink?: string    // собранный URL, не колонка
}
```

Тип фронта — `types/settings.ts:205-212`; схема сервера — `profile/schemas.py:10-24`. Телефон из
`None` превращается в пустую строку — `phone` собирается через `or ""` (`profile/domain.py:60`). Роль отдаётся из legacy-колонки
`role` (§6 соглашений).

**`secretLink` — производное, и его чтение имеет побочный эффект.** URL склеивается из
`frontend_url` и токена при каждом ответе (`profile/domain.py:38-41`), а если токена в базе нет,
он **генерируется и записывается прямо в обработчике чтения** (`profile/domain.py:31-33`). Это не
дефект, а необъявленная обязанность сервера: ссылка обязана существовать к моменту показа
страницы, которая её показывает и копирует (`ProfileSettings.vue:19`). Третья копия сборки того же
URL — находка домена `auth`.

Ошибки: `UNAUTHORIZED` (`profile/action.py:51`, `:58`, `:70`) и `NOT_FOUND` (404,
`profile/action.py:91-95`, источник `profile/domain.py:52`). Мок не бросает ничего.

Бэкенд: `settings/features/profile/action.py:75` — `get_profile` · схемы `profile/schemas.py:10-24`
Реализация: `services/settingsService.ts:184` — `getProfile` · мок `mocks/index.ts:388` →
`mocks/settings.ts:627` — `mockGetProfile`

---

### PATCH /api/settings/profile

Правка профиля. Save-режим: clean-slate — `updateProfile` правит стор
(`useSettings.ts:623-627`), запрос по Save (`useSettings.ts:513-516`).

**Сервер принимает четыре поля, а клиент шлёт весь профиль** — включая `role` и `secretLink`
(`useSettings.ts:514`):

```ts
{ firstName?: string; lastName?: string; email?: string; phone?: string }
```

Схема — `profile/schemas.py:27-35`; лишние поля pydantic отбрасывает молча, то есть обязанность
игнорировать роль сервер выполняет случайно, а не по правилу. **Правило контракт формулирует
прямо: роль и секретную ссылку этот эндпоинт не меняет никогда.** Мок его не соблюдает — кладёт
всё, что дали (`mocks/settings.ts:636-639`), и под моками сохранение профиля способно переписать
собственную роль (БАГ-13).

Ответ: `UserProfile` целиком после merge, тем же `model_dump` (`profile/action.py:111-114`), снова с пересозданием
секретного токена, если его не было (`profile/domain.py:99`).

Ошибки: `UNAUTHORIZED`, `NOT_FOUND` (404, `profile/action.py:115-119`) и `CONFLICT` (409,
`profile/action.py:120-124`, источник `profile/domain.py:86`) — почта уже занята. **Формат почты и
телефона не проверяется ни на одной стороне** (`profile/domain.py:82-89` — только проверка
занятости). Уникальность почты при этом ищется по одному адресу, без арендатора — это находка
домена `auth` (§4 соглашений).

Бэкенд: `settings/features/profile/action.py:98` — `patch_profile` · схемы `profile/schemas.py:27-35`
Реализация: `services/settingsService.ts:188` — `saveProfile` · мок `mocks/index.ts:1347` →
`mocks/settings.ts:636` — `mockPatchProfile`

---

### POST /api/settings/change-password

Смена собственного пароля. Save-режим: **quick-action** — отдельная форма и отдельная кнопка,
общая кнопка Save настроек не участвует (`ProfileSettings.vue:39-70`); клиент повторяет обе
проверки локально до отправки (`ProfileSettings.vue:45-52`).

Запрос — три обязательных поля:

```ts
{ currentPassword: string; newPassword: string; confirmPassword: string }
```

Подпись клиента — `settingsService.ts:192-196`; схема сервера с теми же алиасами объявляет
`ChangePasswordInput` (`profile/schemas.py:38-45`). Пароль пишется в колонку пользователя, то есть
домен настроек правит таблицу чужого модуля — правило домена `auth`.

Ответ: `ApiResponse` только с сообщением, данных нет (`profile/action.py:140`). **Мок этот
эндпоинт не реализует** — ветка возвращает `undefined` и ничего не проверяет
(`mocks/index.ts:1134`): под моками смена пароля всегда «успешна», и ни один путь отказа в демо не
воспроизводится.

Ошибки: `UNAUTHORIZED`, `NOT_FOUND` (404, `profile/action.py:141-145`) и `VALIDATION_ERROR` (422,
`profile/action.py:146-150`) — **одним кодом на три разных случая:** неверный текущий пароль
(`profile/domain.py:127`), слишком короткий новый (`profile/domain.py:131-133`) и несовпадение
подтверждения (`profile/domain.py:137`). Различает их только текст сообщения, а клиент показывает
`e.message` как есть (`ProfileSettings.vue:66`). Разделять ли эти три случая кодами — строка
владельцу.

**Ограничения попыток нет:** настройка объявлена и не читается ни одной строкой кода (БАГ-12), а
старый контракт обещал «3 попытки в минуту на IP».

Бэкенд: `settings/features/profile/action.py:127` — `change_password` · схемы `profile/schemas.py:38-45`
Реализация: `services/settingsService.ts:192` — `changePassword` · мок `mocks/index.ts:1134` (no-op)

---

## Почтовый сервер

Один сервер на арендатора, единичный ресурс без `id`. **Серверной половины нет ни у одного из
трёх эндпоинтов**, и хранилища тоже: модели почтовых настроек в модуле нет, а единственный
серверный тип этой формы лежит в чужом модуле и не конструируется нигде
(`backend/app/modules/bcc/features/send_request/domain.py:42-55`). При этом BCC-инструмент уже
умеет слать письма через эти параметры — то есть сервер обязан их где-то держать. Экран — вкладка
`views/admin/settings/MailSettings.vue`.

**Пароль пишется и не читается — правилом типа, а не дисциплиной.** Поля `password` в
`MailServerSettings` нет вовсе (`types/settings.ts:140-152`), поэтому положить секрет в стор, в
снимок и в кэш физически нечем; единственное место, где поле существует, — payload записи
(`types/settings.ts:179-182`). Доказано спекой `mocks/mail-settings.spec.ts:25-49`.

### GET /api/settings/mail

Чтение почтовых настроек. Ни query, ни тела. Save-режим: чтение, запрос №3 из девяти
(`useSettings.ts:230`).

Ответ — `MailServerSettings`:

```ts
{
  host: string
  port: number
  encryption: 'none' | 'ssl' | 'starttls'   // MAIL_ENCRYPTIONS, types/settings.ts:122
  username: string
  passwordSet: boolean                      // ПРОИЗВОДНОЕ: пароль задан или нет
  fromEmail: string
  fromName: string
}
```

Тип — `types/settings.ts:140-152`. **Пароля в ответе нет ни при каких условиях**, а `passwordSet`
вычисляется из его наличия и не хранится полем (`mocks/settings.ts:588-590`).

Ошибки: ни одного кода — мок не бросает ничего.

Бэкенд: **не реализован** — модели и роутов нет (`grep -rn "smtp\|MailServer" backend/app/modules/settings` → пусто).
Реализация: `services/settingsService.ts:165` — `getMailServer` · мок `mocks/index.ts:389` →
`mocks/settings.ts:588` — `mockGetMail`

---

### PATCH /api/settings/mail

Правка почтовых настроек. Save-режим: clean-slate, та же общая кнопка Save
(`useSettings.ts:363-374`).

Запрос — `MailServerPayload`: все поля ответа кроме `passwordSet`, плюс необязательный пароль
(`types/settings.ts:179-182`). Клиент шлёт **секцию целиком** (`useSettings.ts:364-365`) и
добавляет пароль только если его ввели (`useSettings.ts:366`).

**Отсутствующий `password` означает «не менять», а пустая строка сюда не попадает** — пустое поле
формы это «не трогать пароль», а не «стереть его». Правило записано с обеих сторон
(`mocks/settings.ts:600`) и доказано спекой `mocks/mail-settings.spec.ts:41-49`. Следствие,
которого старый контракт не называл: **стереть пароль этим эндпоинтом нельзя вовсе** — отдельного
действия «убрать пароль» нет ни в интерфейсе, ни в моке.

Ответ: `MailServerSettings` целиком после merge, снова без пароля
(`mocks/settings.ts:597-602`); ответ кладётся прямо в стор (`useSettings.ts:368-370`).

Ошибки: ни одного кода — мок не бросает ничего. **Валидации `host`, `port` и `fromEmail` нет ни на
одной стороне**, при том что от них зависит гейт отправки.

Отдельное свойство, которое сервер обязан учитывать: **пароль живёт вне стора и вне снимка**
(`useSettings.ts:96-103`) и обнуляется сразу после постановки запроса в очередь
(`useSettings.ts:372`) — то есть **до** того, как запрос выполнился. Отказ сохранения теряет
введённый пароль без следа.

Бэкенд: **не реализован**.
Реализация: `services/settingsService.ts:169` — `saveMailServer` · мок `mocks/index.ts:1351` →
`mocks/settings.ts:597` — `mockPatchMail`

---

### POST /api/settings/mail/test

Отправка тестового письма. Save-режим: **quick-action**, сохранения не требует и не выполняет
(`MailSettings.vue:73-88`).

Запрос — **пустой объект**, и это намеренно: проверяются параметры, которые **уже** на сервере, а
не черновик формы (комментарий `settingsService.ts:173-177`).

Ответ:

```ts
{ deliveredTo: string }        // адрес, на который ушло письмо
```

Письмо уходит **на адрес отправителя**, то есть сервер обязан уметь принять собственную почту;
мок отдаёт `fromEmail` из своего хранилища (`mocks/settings.ts:620-623`), доказано спекой
`mocks/mail-settings.spec.ts:73-75`.

Ошибки: один код — `MAIL_NOT_CONFIGURED`, если не заданы хост, адрес отправителя или пароль.
Условие берётся из общего для проекта `isMailConfigured` (`types/settings.ts:167-171`, вызов
`mocks/settings.ts:611-613`). **Молчаливый успех недонастроенного сервера запрещён:** кнопка тогда
проверяла бы себя. Это единственный код домена, доходящий до отдельного сообщения, — и читается он
из `message`, поэтому против настоящего сервера ветка не сработает (БАГ-17).

**Гейт кнопки смотрит на состояние сервера, а не на черновик** (`MailSettings.vue:44-49`), и адрес
получателя не называется, пока раздел грязный (`MailSettings.vue:65-69`): назвать черновик значило
бы соврать о получателе.

Бэкенд: **не реализован** — SMTP в проекте один и лежит в чужом домене
(`backend/app/modules/bcc/features/send_request/transport.py:11`).
Реализация: `services/settingsService.ts:178` — `sendMailServerTest` · мок `mocks/index.ts:1135` →
`mocks/settings.ts:620` — `mockSendMailTest`

---

## Карта склада

Единичный ресурс без `id` и без истории: одна картинка на арендатора. Серверной половины нет ни у
одного из трёх эндпоинтов. Экран — своя страница склада, а не вкладка настроек, и в набор
`fetchAllSections()` карта **не входит**: её тянет своя загрузка — `getWarehouseMap`
(`useWarehouseMap.ts:25-35`).

Сам файл уходит штатным `POST /api/uploads` (§16 соглашений), и в тело этих эндпоинтов попадают
только его метаданные — **бинарник в JSON не ходит никогда** (`settingsService.ts:141-143`).

### GET /api/settings/warehouse-map

Чтение карты. Ни query, ни тела.

Ответ — `WarehouseMapFile | null`:

```ts
{ fileId: string; name: string; mime: string; size: number; url: string; uploadedAt: string } | null
```

Тип — `WarehouseMapFile` (`types/settings.ts:111-119`), поля повторяют ответ загрузки файла.
**`null` — это успешный ответ, а не 404:** подпись клиента допускает его (`settingsService.ts:145`), и пустое состояние
страницы строится на нём, а не на пойманной ошибке. Сид мока — тоже `null`
(`mocks/settings.ts:182-185`): рисовать ссылку на несуществующий файл значило бы показать пустому
складу чужую картинку.

Ошибки: ни одного кода — мок не бросает ничего; клиент кладёт любую ошибку в текст
(`useWarehouseMap.ts:30-32`).

Бэкенд: **не реализован** (`grep -c warehouse_map backend/app/modules/settings/shared/models.py` → 0).
Реализация: `services/settingsService.ts:145` — `getWarehouseMap` · мок `mocks/index.ts:390` →
`mocks/settings.ts:647` — `mockGetWarehouseMap`

---

### PUT /api/settings/warehouse-map

Замена карты. `PUT`, а не `PATCH`: ресурс единичный и заменяется целиком, «загрузить новую» и
«обновить» — одно действие (§3 соглашений). Save-режим: **quick-action** — уходит на сервер сразу
после подтверждения замены (`useWarehouseMap.ts:44-67`).

Запрос — `WarehouseMapFile` целиком, собранный строго из ответа загрузки, без пересборки полей
(`useWarehouseMap.ts:51-58`).

Ответ: `WarehouseMapFile` — сохранённая карта (`mocks/settings.ts:651-657`).

Ошибки: один код — `MAP_NOT_AN_IMAGE`, если `mime` не начинается с `image/`
(`mocks/settings.ts:654`), доказано спекой `mocks/warehouse-map.spec.ts:73`. **Проверка обязана
быть на сервере**, и это не дублирование: атрибут `accept` фильтрует только диалог выбора файла и
ничего не значит для перетаскивания (`useWarehouseMap.ts:39-43`), поэтому клиент проверяет то же
самое до отправки (`useWarehouseMap.ts:45-48`) — а код ответа не читает: любая ошибка становится
одним тостом (`useWarehouseMap.ts:61-63`).

Две обязанности, которых прежний текст не называл:

- **`url`, `size` и `uploadedAt` сервер получает от клиента и не вправе им верить** — проверяется
  сегодня только тип; §16 соглашений говорит то же о самом `url`: он производное, а не колонка;
- **прежняя карта пропадает безвозвратно, и удалить её файл контракт не поручает никому** —
  строка владельцу вместе с судьбой файла удалённой карты.

Бэкенд: **не реализован**.
Реализация: `services/settingsService.ts:151` — `saveWarehouseMap` · мок `mocks/index.ts:1155` →
`mocks/settings.ts:651` — `mockSaveWarehouseMap`

---

### DELETE /api/settings/warehouse-map

Удаление карты. Тела нет, id нет — ресурс единичный. Save-режим: **quick-action** — уходит сразу
после подтверждения (`useWarehouseMap.ts:69-82`).

Ответ: пусто; карты больше нет, страница возвращается к пустому состоянию.

Ошибки: ни одного кода — в моке нет ни одного отказа (`mocks/settings.ts:659-661`). Отсюда два
правила, которые сервер обязан повторить:

- **удаление идемпотентно**: повтор на пустой карте — тоже успех;
- **сам файл при этом никуда не девается** — загрузка его уже сохранила, и обязанности удалить
  бинарник контракт не назначает никому (та же строка владельцу, что у `PUT`).

Удаление предусмотрено намеренно: иначе единственным способом убрать карту была бы загрузка
пустого файла.

Бэкенд: **не реализован**.
Реализация: `services/settingsService.ts:155` — `deleteWarehouseMap` · мок `mocks/index.ts:1652` →
`mocks/settings.ts:659` — `mockDeleteWarehouseMap`

---

## Права заказа

### GET /api/settings/order-permissions

Матрица трёх прав ценообразования заказа. Ни query, ни тела. Save-режим: чтение, запрос №4 из
девяти (`useSettings.ts:231`). **Записи нет**: эндпоинта на запись не существует, и раздела
`orderPermissions` в `save()` нет (`useSettings.ts:340-526`) — матрица читается и не редактируется
ничем.

Ответ — `OrderPermissions`, три массива имён ролей:

```ts
{ seeCost: string[]; manualCost: string[]; correction: string[] }
```

Тип — `types/settings.ts:224-231`; мок отдаёт копию среза настроек (`mocks/settings.ts:440-442`),
сид — владелец с администратором и бухгалтерией у первого права и владелец с администратором у
двух остальных (`mocks/settings.ts:62-66`).

Ошибки: ни одного кода — мок не бросает ничего.

**Отдельным эндпоинтом это сделано намеренно, и вот почему** — сервер обязан иметь ответ, даже
когда экран настроек не открыт (`mocks/settings.ts:433-442`). Пустой дефолт
`{ seeCost: [], manualCost: [], correction: [] }` — тоже правило: до ответа сервера не разрешено
ничего — `orderPermissions` пустыми массивами (`useSettings.ts:30`); а `settled` отличает «сервер
сказал нет» от «сервер ещё не отвечал» (`useSettings.ts:92`).

**Применяет права чужой домен, а не этот.** Три computed заказа читают эту матрицу
(`composables/useOrderPermissions.ts:28-30`), и «сервер» мока проверяет её сам
(`mocks/orders.ts:1857`, `:1393`). Механизм целиком и его отличие от матрицы карточки поставщика
и от фича-флагов — §6 соглашений; модель прав заказа — §5
[контракта заказов](../../plans/orders/orders-backend-contract.md).

**Сокрытие себестоимости в интерфейсе — занавеска, а не право:** сервер не имеет права отдавать
себестоимость и маржу пользователю без `seeCost`, а поскольку карточка пересчитывает цены из
себестоимости, сервер, вырезавший её, обязан прислать посчитанную цену
(`composables/useOrderPermissions.ts:16-21`).

Бэкенд: **не реализован** — модели прав в модуле нет: шесть классов моделей
(`backend/app/modules/settings/shared/models.py:12`, `:32`, `:61`, `:86`, `:104`, `:136`), прав
среди них нет.
Реализация: `services/settingsService.ts:36` — `getOrderPermissions` · мок `mocks/index.ts:383` →
`mocks/settings.ts:440` — `mockGetOrderPermissions`

---

## Обязанности сервера

Девять граф аудита ([`plans/api/audit/settings.md`](../../plans/api/audit/settings.md), раздел
«Обязанности сервера») — то, чего во фронтенде не видно и что линзы согласованности не ловят по
построению: вызова нет, сравнивать не с чем. Ответ «нигде» контракт не назначает — он идёт строкой
в [`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md), раздел
«settings — аудит 2026-09-04» (семнадцать строк).

**1. Значения по умолчанию и их владелец — этот домен и есть владелец, но копий его значений во
фронте три.**

| значение | кто задаёт | состояние |
|---|---|---|
| `vat_rate=21`, `default_margin=15`, `default_currency='EUR'`, `default_discount_percent=0` | колонки сервера (`models.py:44-55`), строка создаётся при первом чтении (`crud/domain.py:129-131`) | продублированы дефолтом состояния фронта (`useSettings.ts:27`) и сидом мока (`mocks/settings.ts:52-57`) |
| валюта, НДС и маржа новой строки заказа | читаются из стора настроек (`composables/useOrderCard.ts:145-148`) | правильно: копии нет |
| маржа партии, валюта поставщика | стор настроек (`composables/useWarehouseBatch.ts:119`, `composables/useSupplierCreate.ts:49`) | правильно |
| список валют карточки поставщика | **константа во фронте** — `EUR/USD/PLN/GBP` (`components/admin/SupplierFormSections.vue:58-63`) | находка: справочник принадлежит серверу (§14) |
| валюта по умолчанию | выражена дважды — флагом записи (`types/settings.ts:26`) и кодом в константах (`:17`); читаются подряд одним выражением (`services/orderLines.ts:160`) | какой источник главный — строка владельцу |
| карточка компании нового арендатора | сервер, при регистрации (`backend/app/modules/settings/internal_api/interface.py:67-79`) | работает |
| валюты, единицы, правила пересчёта, статусы заказов нового арендатора | **никто**: регистрация создаёт только арендатора (`backend/app/modules/auth/features/register/repository.py:46-61`), сидов в миграциях нет | строка владельцу, первая по важности |
| системность статуса заказа | **никто**: создание пишет `is_system=False` (`crud/domain.py:469`), схема PATCH поля не принимает | строка владельцу |

**2. События и уведомления — ни одного, ни на одной стороне.** Мок настроек не рождает ни одной
записи (`grep -c "notify" frontend_vue/src/services/mocks/settings.ts` → 0), и ни один из семи
эмиттеров уведомлений (§10 соглашений) настроек не касается: `grep -in "settings\|currenc\|uom"
frontend_vue/src/services/mocks/notifications.ts` даёт только статусы заказов. На бэкенде
уведомлений нет вовсе — у модуля `notifications` ноль роутов. Кому и о чём сообщать при смене
ставки НДС, валюты по умолчанию или набора статусов заказа — строка владельцу.

**3. Запись в аудит-лог — нигде, при том что страница логов живёт внутри настроек.** У мока
настроек нет ни одной записи (`grep -c "auditLog" frontend_vue/src/services/mocks/settings.ts` →
0), а в замкнутом перечне девяти сущностей ленты (§9 соглашений, `types/audit.ts:4-14`) настроек
нет. Вкладка логов при этом принадлежит этому разделу (`frontend_vue/src/router/index.ts:391-396`)
— то есть домен показывает чужой аудит и не пишет своего. Остаётся ли след у смены финансовых
констант, валюты по умолчанию, матрицы прав и почтового пароля и кто его автор — строка владельцу.

**4. Кастомные поля — домену не принадлежат и в нём отсутствуют.** Определениями владеет `config`,
значениями — товары (§8 соглашений); в этом домене нет ни одного упоминания:
`grep -rn "fieldDefinition\|fieldValues\|customField" frontend_vue/src/types/settings.ts
frontend_vue/src/services/mocks/settings.ts backend/app/modules/settings` → пусто. Единственная
точка соприкосновения обратная: **справочники этого домена служат значениями полей товара**,
поэтому правила их удаления (графа 8, БАГ-07 и БАГ-08) — это и есть жизненный цикл, которого §8
соглашений не находит нигде.

**5. Настройки, которых мок не отслеживает — перечислены прямо, потому что каждая делает демо
непохожим на сервер.**

- **три подраздела мок держит, а сервер не знает вовсе**: почта, карта склада и матрица прав
  заказа — семь эндпоинтов из 31 (см. их разделы);
- **пароль мок не хранит и не проверяет**: смена пароля у него no-op (`mocks/index.ts:1134`), и
  ни один из трёх путей отказа в демо не воспроизводится;
- **курса валюты мок не знает**, а сервер требует его при создании (`crud/schemas.py:85`) —
  БАГ-05;
- **системности статуса мок не проверяет** (БАГ-14), а сервер отвечает 403;
- **дубль пары единиц мок не ловит** (`mocks/settings.ts:514-521`), а сервер отвечает 409;
- **список пользователей не приходит ниоткуда**: поле в типе есть (`types/settings.ts:245`) и сид
  на шесть человек есть (`mocks/settings.ts:187-206`), а эндпоинта нет ни одного и в набор чтений
  оно не входит (`useSettings.ts:217-237`) — строка владельцу.

**6. Мультиарендность — списки ограничены арендатором, операции над записью нет.** `tenant_id`
есть у всех шести моделей домена (`models.py:17`, `:37`, `:66`, `:91`, `:109`, `:141`), у двух
синглтонов — с `unique=True` (`models.py:21`, `:41`); арендатор выводится из пользователя токена
(`crud/action.py:131-139`), как требует §4 соглашений. **Но восемь операций над отдельными
записями арендатором не ограничены вовсе:** `get_currency`, `get_uom`, `get_conversion`,
`get_order_status` ищут по одному `id` (`crud/repository.py:94-98`, `:148-150`, `:205-209`,
`:262-266`), а роуты PATCH и DELETE этих коллекций не требуют даже токена (БАГ-01). Единственное
исключение — reorder, он пишет по паре с арендатором (`crud/repository.py:299-302`). Для сервера
это не «улучшение», а условие корректности: справочник арендатора правится по чужому UUID.

**7. Права — на сервере не проверяется ничего, а домен при этом владеет правами чужого домена.**
В модуле нет ни одной проверки роли: `grep -rn "role" backend/app/modules/settings --include=*.py`
даёт только чтение и отдачу роли в профиле (`profile/domain.py:61`, `:106`). Во фронте раздел
закрыт одним фича-флагом на всё (`frontend_vue/src/router/index.ts:355`), у вкладки логов свой
флаг (`:395`); прав, различающих роли внутри настроек, нет ни одного. При этом сам домен **отдаёт**
три права заказа (`GET /api/settings/order-permissions`), а применяет их `orders`
(`composables/useOrderPermissions.ts:28-30`). Какое право нужно, чтобы править настройки, и одно ли
оно на все семь вкладок — строка владельцу; общая картина трёх механизмов — §6 соглашений.

**8. Транзакционность и идемпотентность — одна кнопка Save, до десятка независимых запросов.**
`Idempotency-Key` не шлётся ни на одном из 31 эндпоинта
(`grep -c "Idempotency" frontend_vue/src/services/settingsService.ts` → 0), при том что механизм в
проекте есть (§11 соглашений). Save собирает восемь секций плюс по запросу на каждый добавленный,
изменённый и удалённый элемент четырёх коллекций и отправляет их одним `Promise.all`
(`useSettings.ts:518`): падение любого оставляет остальные применёнными, а снимок не сдвигается,
потому что `takeSnapshot()` (`useSettings.ts:520`) до обработчика ошибки (`:521`) не доходит — и
следующий Save шлёт всё заново. Три составные операции без общей транзакции названы прямо:

- **смена валюты по умолчанию** — N PATCH валют плюс PATCH констант (`SettingsLayout.vue:436-446`);
- **удаление статуса** — DELETE плюс reorder (`useSettings.ts:482-486`, `:503-505`);
- **создание элемента коллекции** — POST плюс подмена временного id в сторе, у статусов и единиц
  сделанная небезопасно (БАГ-15, БАГ-16).

На стороне сервера транзакция ровно одна на запрос: каждый репозиторный вызов делает свой `commit`
(`crud/repository.py:44`, `:51`). Между запросами транзакции нет ни одной. Что обязано применяться
целиком — строка владельцу, и она же самая частая строка всего файла решений (§15 соглашений).

**9. Производные значения — сервер считает, а не хранит.** Считаются при чтении четыре вещи:

- **`secretLink` профиля** — не колонка, а URL, склеенный из `frontend_url` и токена
  (`profile/domain.py:38-41`), причём отсутствующий токен тут же генерируется и записывается
  (`profile/domain.py:31-33`);
- **`order` и `system` статуса** — переименование колонок `sort_order` и `is_system`
  (`crud/domain.py:453-454`);
- **`passwordSet` почты** — выводится из наличия пароля и полем не хранится
  (`mocks/settings.ts:589`); самого пароля в типе нет вовсе (`types/settings.ts:146-147`);
- **пустые строки вместо `null`** у компании и телефона профиля: `legal_address`
  (`crud/domain.py:77-84`) и `phone` (`profile/domain.py:60`) собираются через `or ""` — то есть
  форма ответа нормализуется при чтении.

Обратный случай — **хранится то, что могло бы считаться, и не нормализуется то, что должно**:
порядок статусов сервер после удаления не перенумеровывает — `remove_order_status_item`
(`crud/domain.py:522-534`), а мок перенумеровывает (`mocks/settings.ts:579`): строка владельцу.
И `exchange_rate` (`models.py:74-76`) хранится при том, что конвертации в проекте нет нигде.

---

## Правила домена

То, что живёт только в этом домене и не выводится из формы ни одного эндпоинта.

1. **Пароль почты пишется и не читается — правилом типа, а не дисциплиной.** Поля для него нет в
   типе ответа (`types/settings.ts:140-152`), поэтому положить секрет в стор, снимок и кэш
   физически нечем; существует оно только в payload записи (`types/settings.ts:179-182`). Пустая
   строка не отправляется: пустое поле формы означает «не менять», а не «стереть»
   (`useSettings.ts:366`, `mocks/settings.ts:600`). Доказано спекой
   `mocks/mail-settings.spec.ts:25-49`.
2. **«Можно ли отправить письмо» — одно правило на весь проект.** `isMailConfigured`
   (`types/settings.ts:167-171`) зовут гейт кнопки теста (`MailSettings.vue:49`), гейт кнопки Send
   BCC-инструмента и отказ «сервера» (`mocks/settings.ts:611-613`). Аргумент сужен до трёх полей
   (`types/settings.ts:168`), чтобы правило не могло незаметно начать смотреть на что-то ещё.
3. **Карта склада — единичный ресурс без истории.** `PUT` заменяет её целиком, версий нет,
   «загрузить новую» и «обновить» — одно действие (`settingsService.ts:140-143`). Хранится ровно в
   одном месте (`types/settings.ts:243-244`); второго реестра карт в складском домене быть не
   должно.
4. **`mime` проверяется дважды, и обе проверки нужны.** Атрибут `accept` фильтрует только диалог
   выбора файла и ничего не значит для перетаскивания (`useWarehouseMap.ts:39-43`), поэтому клиент
   проверяет тип перед отправкой (`useWarehouseMap.ts:45-48`), а «сервер» — ещё раз
   (`mocks/settings.ts:654`).
5. **Тест почты проверяет сервер, а не черновик.** Гейт кнопки смотрит на состояние, пришедшее с
   сервера (`MailSettings.vue:44-49`), и адрес получателя не называется, пока раздел грязный
   (`MailSettings.vue:65-69`): назвать черновик значило бы соврать о получателе.
6. **Права заказа отдаются отдельным эндпоинтом намеренно** — не потому, что это «ещё одни
   константы», а потому, что сервер обязан иметь ответ, даже когда настройки на экране не открыты
   (`mocks/settings.ts:433-442`). Пустой дефолт — тоже правило (`useSettings.ts:30`), а флаг
   `settled` отличает «сервер сказал нет» от «сервер ещё не отвечал» (`useSettings.ts:92`).
7. **Сокрытие себестоимости в интерфейсе — занавеска, а не право**
   (`composables/useOrderPermissions.ts:16-21`); см. раздел прав заказа.
8. **У часа нет правил пересчёта, и это решение.** Категория `time` добавлена ради услуг
   (`types/settings.ts:39-40`), и пустая строка в матрице честнее выдуманного коэффициента
   (`mocks/settings.ts:143-145`).
9. **Список формул пересчёта — один на проект, и тип выводится из него.** Массив
   `CONVERSION_FORMULA_TYPES` (`types/settings.ts:55-59`) задаёт и опции селекта, и подписи, и
   типы полей товара: добавленная формула не может остаться без варианта в форме.
10. **Демо-данные держатся тех же правил, что приложение.** Карта склада в сиде — `null`
    (`mocks/settings.ts:182-185`): нарисовать ссылку на несуществующий файл значило бы показать
    пустому складу картинку, которой ни у кого нет.

---

## Чего в домене нет

Ничего не вычеркнуто молча: строка на каждое описание, снятое из прежнего текста контракта, с
доказательством отсутствия. Ссылок с номерами строк на монолит здесь нет намеренно — он удаляется
отдельной задачей плана, и номер в нём станет мусором; утверждения цитируются текстом.

| было описано | чем доказано отсутствие |
|---|---|
| код `COMPANY_NOT_FOUND` — 404 в каталоге кодов | `grep -rn COMPANY_NOT_FOUND backend/app frontend_vue/src` → пусто. Более того, 404 «компании нет» недостижим: строка создаётся при регистрации и добирается при чтении вызовом `create_company` (`crud/domain.py:67-76`) |
| код `INVALID_PASSWORD` — 422 при неверном текущем пароле | `grep -rn INVALID_PASSWORD backend/app frontend_vue/src` → пусто; все три случая смены пароля идут одним `VALIDATION_ERROR` — один перехват `ValidationError` (`profile/action.py:146-150`), различает их только текст |
| «Rate-limit: 3 попытки/min/IP» у смены пароля | ограничителя нет: настройка объявлена в конфиге (`backend/app/core/config.py:32`) и не читается ни одной строкой — БАГ-12 |
| «Body: dirty-only поля» у компании, констант, почты и профиля | клиент шлёт **секцию целиком** во всех четырёх: `useSettings.ts:348`, `:354`, `:364-365`, `:514`. Dirty-поля шлют только коллекции — через `findUpdated` (`useSettings.ts:176-198`) |
| «Клиент **не** шлёт base64» у логотипа | шлёт, если Save нажать до конца загрузки: data-URL кладётся в стор для превью (`SettingsLayout.vue:328-338`) — БАГ-18 |
| «422 если попытка удалить валюту, установленную как `defaultCurrency`» | такой проверки нет ни на сервере, ни в моке (`crud/domain.py:257-268`) — БАГ-08; зато существует не описанный прежде 409 «используется товарами» (`crud/domain.py:266`) |
| «409 если UOM используется в товарах, правилах пересчёта или заказах» | из трёх реализован один — товары (`crud/domain.py:342`); правила пересчёта удаляются **каскадом** (`models.py:117`, `:122`) — БАГ-07; заказов на бэкенде нет вовсе |
| «`factor` required if `type === 'static'`» (и формула у динамического) | правила нет ни на сервере, ни в моке: схема объявляет оба поля необязательными (`crud/schemas.py:156-157`), домен связку не проверяет (`crud/domain.py:366-396`) — БАГ-20 |
| «`order` изменяется только через reorder» | схема PATCH `order` принимает (`crud/schemas.py:207`), и дельта его отправляет (`useSettings.ts:187-192`) — два пути к одному полю |
| поле `system?: boolean` в теле создания статуса | схема такого поля не принимает (`crud/schemas.py:190-199`), сервер жёстко пишет `is_system=False` (`crud/domain.py:469`). Описывать поле, которое сервер обязан игнорировать, — приглашение его прислать |
| «409 если статус используется в заказах» у удаления | проверки нет нигде, она оставлена комментарием-TODO (`crud/domain.py:531-532`) |
| «Атомарная перезапись порядка» у reorder | это цикл из N отдельных `UPDATE` с одним `commit` в конце (`crud/repository.py:296-306`); неполный список даёт неконсистентную нумерацию |
| форматы идентификаторов `cur-{N}`, `uom-{N}`, `st-11` в примерах ответов | свойство мока (`mocks/settings.ts:463`, `:490`, `:544`); сервер выдаёт UUID (`backend/app/core/base.py:18-22`), и контракт не вправе обещать формат `id` (§19 соглашений) |
| семь категорий единиц (`weight … thickness`) | их восемь: добавлена `time` для услуг (`types/settings.ts:31-40`); тот же устаревший список повторяет комментарий колонки (`models.py:99-101`) |
| «`exchangeRate` есть в типе `Currency`» | в типе фронта его нет (`types/settings.ts:22-28`); поле существует только на сервере, и из-за этого не работает создание валюты — БАГ-05 |
| «`defaultCurrency` должен соответствовать одной из валют» | проверки нет: `patch_global_constants` к валютам не обращается ни разу (`crud/domain.py:140-170`) |
| статус 415 у `MAP_NOT_AN_IMAGE` | статуса в коде нет: мок бросает голый `Error` без статуса (`mocks/settings.ts:654`), а форма ошибки на проводе — `detail` с кодом (§1 соглашений) |
| «Сервер НЕ возвращает данные пользователя» у смены пароля | верно и подтверждено: ответ несёт только сообщение (`profile/action.py:140`) |
| общие правила: конверт ответа, коды ядра, `PATCH` против `PUT`, мультиарендность, форма `id`, `TranslatedString`, clean-slate | перенесены в [`00-conventions.md`](00-conventions.md) (§1, §2, §3, §4, §19, §12, §15) — правило двух и более доменов в доменном файле не дублируется |
| — (не было в прежнем тексте) | `GET /api/settings/order-permissions` описания не имел вовсе: `grep -n "order-permissions\|orderPermissions" roo_code/roo-context/03-api-contract.md` → ни одного попадания. Теперь описан своим разделом |
| — (не было в прежнем тексте) | две ветки мока без вызывающего — `GET /api/settings` (`mocks/index.ts:410`) и `PUT /api/settings` (`:1151`), сироты из линзы К2: `grep -rn "'/api/settings'" frontend_vue/src --include=*.ts --include=*.vue \| grep -v mocks` → пусто. Эндпоинтами домена они не являются: чтения и записи всего дерева настроек одним запросом в контракте нет |

---

## Пробелы аудита — состояние

Каждый пробел из [аудита](../../plans/api/audit/settings.md) закрыт выше или помечен «осталось».
«Осталось» здесь значит одно: ответа нет ни в коде фронта, ни на сервере, и назначать его контракт
не вправе — строка стоит в
[`audit/00-решения-владельца.md`](../../plans/api/audit/00-решения-владельца.md).

| пробел аудита | где закрыт |
|---|---|
| «Body: dirty-only поля» неверно у четырёх секций | разделы PATCH компании, констант, почты и профиля; строка в «Чего в домене нет» |
| старый контракт не называл, что строка компании и строка констант создаются сервером сами | разделы `GET /api/settings/company` и `GET /api/settings/constants` |
| `defaultCurrency` — код, а не id; правило «должен соответствовать валюте» не реализовано | раздел `GET /api/settings/constants`; строка в «Чего в домене нет» |
| смена валюты по умолчанию — операция из двух и более запросов | раздел `PATCH /api/settings/constants`; графа 8 обязанностей |
| `exchangeRate` есть у сервера и нет у фронта; создание валюты не работает | разделы `GET`/`POST /api/settings/currencies`, БАГ-05 |
| порядок выдачи не задан у трёх списков из четырёх | разделы `GET` валют, единиц и правил; §13 соглашений требует умолчания |
| список в поле конверта, объявленном как `dict` | четыре раздела `GET` коллекций, БАГ-04 |
| удаление валюты по умолчанию ничем не запрещено; 409 по товарам прежде не описан | раздел `DELETE /api/settings/currencies/:id`, БАГ-08 |
| уникальность кода валюты не проверяется на PATCH | раздел `PATCH /api/settings/currencies/:id`, БАГ-10 |
| инвариант «валюта по умолчанию ровно одна» живёт только в клиенте | тот же раздел и графа 8, БАГ-09 |
| категорий единиц восемь, а не семь; сервер примет любую строку | вводный абзац раздела «Единицы измерения» |
| уникальность кода единицы держит только форма | раздел `POST /api/settings/uoms` |
| у `PATCH /api/settings/uoms/:id` нет вызывающего | раздел эндпоинта плюс реестр «клиент написан, UI нет» во вводной части |
| удаление единицы сносит правила пересчёта каскадом | раздел `DELETE /api/settings/uoms/:id`, БАГ-07 |
| `factor = 0` не доезжает до клиента | раздел `GET /api/settings/conversions`, БАГ-19 |
| правило можно создать без коэффициента и без формулы | раздел `POST /api/settings/conversions`, БАГ-20 |
| PATCH правила не проверяет ни совпадение единиц, ни дубль пары; `factor` не обнулить | раздел `PATCH /api/settings/conversions/:id`, БАГ-21 |
| удаление правила не проверяет использование | раздел `DELETE /api/settings/conversions/:id` |
| `order`/`system` статуса — переименование колонок | вводный абзац раздела «Статусы заказов»; графа 9 |
| `order` правится и PATCH-ем, и reorder-ом | раздел `PATCH /api/settings/order-statuses/:id`; строка в «Чего в домене нет» |
| мок переписывает присланный порядок при создании, сервер сохраняет | раздел `POST /api/settings/order-statuses` |
| подмена временного id у статусов и единиц небезопасна | разделы `POST` статусов и `POST` единиц, БАГ-15 и БАГ-16 |
| reorder молча игнорирует чужой id и неполный список; «атомарность» не та | раздел `PUT /api/settings/order-statuses/reorder`; строка в «Чего в домене нет» |
| мок не проверяет системность статуса | раздел `DELETE /api/settings/order-statuses/:id`, БАГ-14 |
| `secretLink` отсутствовал в примере ответа и создаётся побочным эффектом GET | раздел `GET /api/settings/profile`; графа 9 |
| PATCH профиля обязан игнорировать `role` и `secretLink`, мок не игнорирует | раздел `PATCH /api/settings/profile`, БАГ-13 |
| три случая смены пароля идут одним кодом; `INVALID_PASSWORD` и rate-limit не существуют | раздел `POST /api/settings/change-password`, БАГ-12; строки в «Чего в домене нет» |
| у почты нет серверного хранилища, а BCC-инструмент через неё уже отправляет письма | вводный абзац раздела «Почтовый сервер» |
| стереть пароль почты нечем; клиент шлёт секцию целиком; пароль обнуляется до ответа | раздел `PATCH /api/settings/mail` |
| тест почты уходит на адрес отправителя и ничего не сохраняет | раздел `POST /api/settings/mail/test` |
| `null` карты — успешный ответ, а не 404 | раздел `GET /api/settings/warehouse-map` |
| прежняя карта пропадает безвозвратно; `url`/`size`/`uploadedAt` приходят от клиента | раздел `PUT /api/settings/warehouse-map` |
| удаление карты идемпотентно, а файл остаётся | раздел `DELETE /api/settings/warehouse-map` |
| раздела прав заказа в прежнем тексте не было вовсе | раздел `GET /api/settings/order-permissions`; строка в «Чего в домене нет» |
| восемь роутов без токена и арендатора; `loads()` без срока; две копии разбора токена | вводная часть, три пункта авторизации; БАГ-01, БАГ-02, БАГ-03; графа 6 |
| токен читается только из `localStorage` | там же, БАГ-06 |
| `NOT_FOUND` не оформлен на пяти роутах | каталог кодов, следствие 3; БАГ-11 |
| код домена не доходит до человека как код | каталог кодов, следствия 1 и 2; БАГ-17 |
| десять правил домена, которых нет в контракте | раздел «Правила домена», пункты 1–10 один к одному |
| девять граф «Обязанностей сервера» | раздел «Обязанности сервера», графы 1–9 |
| **решено 2026-09-07 (П25)** · всё четыре создаются **миграцией** — это то, без чего работать нельзя с первого дня. Статусы заказа при этом системные: их заводит система, удалить их нельзя. Сегодня не сеется ничто (`op.bulk_insert` во всех миграциях один, и это фичи тарифов), а системный статус сервер завести не может вовсе — создание пишет `is_system=False` (`crud/domain.py:469`), PATCH поля `system` не принимает (`crud/schemas.py:202-211`). Эталон состава — 15 статусов мока (`mocks/settings.ts:210-345`) | графа 1 |
| **осталось** · кто создаёт системные статусы заказа и что делает их системными | графа 1 и вводный абзац статусов; решение владельца |
| **решено 2026-09-07 (П23)** · не остаётся — поле **удаляется**: от конверсии валют пока отказались, возможно вернутся позже. Сегодня сервер требует его обязательным (`crud/schemas.py:85`, колонка `settings/shared/models.py:74-76`), и из-за этого `POST /api/settings/currencies` против настоящего сервера не работает; удаление снимает и БАГ-05. Колонка `exchange_rate` складской партии — та же судьба | разделы валют; [§14](00-conventions.md) |
| **решено 2026-09-07 (П19)** · настройками. Жёсткий `EUR/USD/PLN/GBP` в `components/admin/SupplierFormSections.vue:58-63` — дефект: справочник принадлежит серверу, копии во фронте быть не должно | графа 1; [§14](00-conventions.md) |
| **решено 2026-09-07 (П22)** · главный — флаг `Currency.isDefault`: именно его правит вкладка `/admin/settings/finance` (`FinanceSettings.vue:90-113`), поля `constants.defaultCurrency` на ней нет. Константа производна, и сервер обязан держать исключительность флага и выводить код сам — сегодня и то и другое делает браузер (`SettingsLayout.vue:436-446`), а сервер при записи `is_default` других валют не касается (`crud/domain.py:221-254`) | графа 1 и раздел `PATCH /api/settings/constants`; [§14](00-conventions.md) |
| **осталось** · рождает ли уведомление смена НДС, валюты по умолчанию или набора статусов | графа 2; решение владельца |
| **решено 2026-09-08 частично (П36)** · правило записи общее: любое изменение любого свойства, автор — `user_id` плюс снимок имени. **Решено 2026-09-08 (П42):** да — `settings` становится **десятым видом сущности ленты**. У события есть всё, что нужно строке: свойство, старое значение, новое, автор. После П38 это новое значение `entity_type`, а не новая таблица; замкнутый перечень `AuditEntityType` (`types/audit.ts:5-14`) расширяется до десяти. Логируются финансовые константы, валюта по умолчанию, матрица прав и почтовые настройки | графа 3; [§9](00-conventions.md) |
| **решено 2026-09-07 (П2, П7)** · править настройки — обычное право матрицы; одно ли оно на все семь вкладок, решается повкладочно по надобности роли, а не сквозным правилом | графа 7; [§6.6](00-conventions.md) |
| **решено 2026-09-07 (П12)** · матрица живёт на бэкенде, отдельно на арендатора, правят владелец и админ; фронтовая копия остаётся мок-режиму. Три права заказа при этом **перестают быть отдельным механизмом** (П15): `seeCost` есть `read`, `manualCost` и `correction` есть `edit`. Свойство, которое обязано пережить переезд, — права приходят на старте приложения, а не при открытии экрана настроек, и пустой дефолт плюс флаг `settled` отличают «сервер сказал нет» от «сервер ещё не отвечал» | графа 7 и раздел прав; [§6.4](00-conventions.md), [§6.8](00-conventions.md) |
| **осталось** · что из одной кнопки Save обязано применяться целиком | графа 8; решение владельца |
| **осталось** · нужен ли `Idempotency-Key` создающим эндпоинтам домена | графа 8; решение владельца |
| **осталось** · где сервер хранит почтовые настройки | графа 5 и раздел почты; решение владельца |
| **осталось** · где сервер хранит карту склада, и кто удаляет файл заменённой карты | графа 5 и разделы карты; решение владельца |
| **осталось** · откуда админка берёт список пользователей | графа 5; решение владельца |
| **осталось** · каким кодом отвергать удаление единицы с правилами и валюты по умолчанию | разделы `DELETE` единиц и валют; решение владельца (БАГ-07, БАГ-08) |
| **осталось** · разделять ли три случая смены пароля разными кодами | раздел смены пароля; решение владельца |
| **осталось** · обязан ли сервер нормализовать `sort_order` после удаления статуса | графа 9 и раздел `DELETE` статуса; решение владельца |
| **осталось** · проверяет ли сервер границы четырёх констант и `defaultCurrency` по списку валют | раздел `PATCH /api/settings/constants`. Своей строки в файле решений у этого пункта нет — он примыкает к строке про два источника валюты по умолчанию; отдельной строкой его вносит владелец, контракт правила не назначает |

Находки про код домена — [`contract-sync-settings-bugs.md`](../../plans/bugs/contract-sync-settings-bugs.md),
БАГ-01…БАГ-21. Код этой работой не тронут.
