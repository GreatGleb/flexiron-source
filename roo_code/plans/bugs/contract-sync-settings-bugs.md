# Bugs — contract-sync / домен settings

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К5. Аудит: [`roo_code/plans/api/audit/settings.md`](../api/audit/settings.md).
Область: `backend/app/modules/settings/**`, `backend/app/core/schemas.py`,
`backend/app/core/config.py`, `frontend_vue/src/services/settingsService.ts`,
`frontend_vue/src/services/mocks/settings.ts`, ветки settings в
`frontend_vue/src/services/mocks/index.ts`, `frontend_vue/src/composables/useSettings.ts`,
`frontend_vue/src/composables/useWarehouseMap.ts`,
`frontend_vue/src/views/admin/settings/**`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда. Двадцать одна находка; порядок — по убыванию тяжести последствий, а не
по порядку чтения файлов.

---

## БАГ-01 — восемь роутов настроек не требуют ни токена, ни арендатора

**File:** `backend/app/modules/settings/features/crud/action.py:252,266,320,334,399,413,468,482`
**Severity:** Critical — правку и удаление справочников любого арендатора может выполнить кто угодно без входа в систему.
**Источник:** К5 (источник истины), графа «Мультиарендность»

### Problem

Из 24 роутов модуля шестнадцать объявляют `user_id: uuid.UUID = Depends(_resolve_user_id)` и
дальше зовут `_get_tenant` (`crud/action.py:131-139`). Восемь — PATCH и DELETE у всех четырёх
коллекций — не объявляют ничего:

```python
@router.patch("/currencies/{currency_id}", response_model=ApiResponse)
async def patch_currency_route(currency_id: uuid.UUID, input_data: CurrencyPatchInput,
                               db: AsyncSession = Depends(get_db)):   # ← и всё
```

Глобального auth-мидлвара, который закрыл бы дыру снаружи, нет: `backend/app/main.py:8`
подключает только CORS (`setup_cors`), других мидлваров в файле нет.

Вторая половина той же дыры — репозиторий. `get_currency`, `get_uom`, `get_conversion`,
`get_order_status` ищут запись **по одному `id`**, без `tenant_id`
(`crud/repository.py:94-98`, `:148-150`, `:205-209`, `:262-266`), поэтому даже если токен
вернуть, арендатор всё равно не проверяется: зная UUID чужой валюты, её можно переименовать
или удалить. Ограничение по арендатору есть только у списков (`:89`, `:143`, `:200`, `:256`)
и у `reorder`, который пишет по паре `(id, tenant_id)` (`:299-302`).

### Fix

Добавить `Depends(_resolve_user_id)` восьми роутам и провести `tenant_id` до репозитория —
`get_*` по id обязаны принимать `tenant_id` и фильтровать по нему, как это уже сделано в
`reorder_order_statuses` (`crud/repository.py:294-306`).

### Future rule

Проверка «каждый роут модуля объявляет зависимость аутентификации» — машинная: список
`router.routes` перебирается, у каждого смотрится `dependant`. Без такой проверки восемь
пропусков из двадцати четырёх не видно ни в ревью, ни в тестах.

---

## БАГ-02 — сессия у настроек не истекает: `loads()` без `max_age`

**File:** `backend/app/modules/settings/features/crud/action.py:119`, `backend/app/modules/settings/features/profile/action.py:63`
**Severity:** High — украденный или забытый токен открывает настройки и профиль бессрочно.
**Источник:** К5

### Problem

Обе копии `_resolve_user_id` декодируют токен так:

```python
data = _serializer.loads(token)
```

`URLSafeTimedSerializer.loads` без `max_age` подпись проверяет, а время — нет. Тот же токен
в `auth`-модуле проверяется с ограничением `max_age=86400` (`backend/app/modules/auth/features/me/action.py:52`),
и просроченный там даёт `TOKEN_EXPIRED`
(`backend/app/modules/auth/features/me/action.py:54-58`). То есть `/api/auth/me` скажет «сессия истекла», а `/api/settings/profile` тем же
токеном ответит данными.

### Fix

Передавать `max_age` из конфигурации в обе копии и отдавать `TOKEN_EXPIRED` на
`SignatureExpired`, как в `me/action.py:54-58`.

### Future rule

Срок жизни сессии — одно правило; записанное трижды, оно разъезжается. См. БАГ-03: правило
здесь не просто разъехалось, оно ещё и продублировано посимвольно.

---

## БАГ-03 — `_resolve_user_id` существует в модуле в двух посимвольно одинаковых копиях

**File:** `backend/app/modules/settings/features/crud/action.py:97-128`, `backend/app/modules/settings/features/profile/action.py:41-72`
**Severity:** Medium — правка одной копии (например добавление `max_age` из БАГ-02) молча оставит вторую прежней.
**Источник:** К5, Л5 (один источник правила)

### Problem

Две фичи модуля объявляют свой сериализатор (`crud/action.py:91-94` и `profile/action.py:35-38`)
и свою функцию разбора заголовка. Тексты совпадают до кавычек — включая все три сообщения об
ошибке (`crud/action.py:108,115,127` против `profile/action.py:51,58,70`).

### Fix

Одна функция в `backend/app/modules/settings/shared/dependencies.py` (файл уже существует),
обе фичи импортируют её.

### Future rule

Дубль ловится `jscpd`-подобной проверкой по бэкенду; сейчас такой в приёмке нет.

---

## БАГ-04 — конверт `ApiResponse` объявлен как `dict`, а четыре GET кладут в него список

**File:** `backend/app/core/schemas.py:33`, `backend/app/modules/settings/features/crud/action.py:222,301,369,437`
**Severity:** High — четыре списочных эндпоинта домена собраны против схемы, которая списка не принимает.
**Источник:** К4 (формы запроса и ответа)

### Problem

```python
class ApiResponse(BaseModel):
    data: dict | None = None          # backend/app/core/schemas.py:33
```

и четырежды:

```python
return ApiResponse(success=True, data=[r.model_dump(mode="json", by_alias=True) for r in result])
```

(`crud/action.py:222` — валюты, `:301` — единицы, `:369` — правила пересчёта, `:437` — статусы
заказов). Это единственные четыре места во всём бэкенде, где в `data` уходит список:
`grep -rn "data=\[" backend/app --include=*.py | wc -l` → `4`, и все четыре в этом файле.
Остальные вызовы кладут `result.model_dump(...)`, то есть словарь.

Проверить исполнением в этом окружении нечем — `pydantic` не установлен
(`python3 -c "import pydantic"` → `ModuleNotFoundError`), поэтому находка держится на чтении
схемы, а не на прогоне. Тем важнее её записать: расхождение объявленного типа с передаваемым
значением — ровно то, что `response_model=ApiResponse` (`crud/action.py:212`) обязан проверять.

### Fix

Либо расширить конверт (`data: dict | list | None`), либо ввести отдельный
`ApiListResponse`. Решение — за владельцем ядра: конверт общий для всех модулей.

### Future rule

Смоук-тест на каждый роут («вернул 200 и валидный конверт») ловит это первым же прогоном.
Сейчас в `backend/tests` таких тестов на settings нет.

---

## БАГ-05 — фронт не может создать валюту: сервер требует `exchangeRate`, клиент его не знает

**File:** `backend/app/modules/settings/features/crud/schemas.py:85`, `frontend_vue/src/types/settings.ts:22-28`, `frontend_vue/src/views/admin/settings/SettingsLayout.vue:355-359`
**Severity:** High — единственный путь добавления валюты против настоящего сервера кончается 422.
**Источник:** К4

### Problem

Серверная схема создания:

```python
class CurrencyCreateInput(BaseModel):
    code: str
    name: TranslatedString
    exchange_rate: float = Field(alias="exchangeRate")   # ← значения по умолчанию нет
    is_default: bool = Field(alias="isDefault", default=False)
```

Форма шлёт три поля и `exchangeRate` среди них нет:

```ts
addCurrency({ code: newCurrency.value.code.toUpperCase(),
              name: { ru: …, en: …, lt: … },
              isDefault: false })
```

Поля нет и в типе: `Currency` — это `{ id, code, name, isDefault, updatedAt? }`
(`frontend_vue/src/types/settings.ts:22-28`), курса во фронте нет нигде. Под моками
создание работает (`mocks/settings.ts:460-467` кладёт что дали), против сервера — 422 Pydantic.

### Fix

Требует решения владельца: остаётся ли курс валюты в модели вообще (см.
`00-решения-владельца.md`, строка про `exchangeRate`). Пока решения нет — код не трогаем.

### Future rule

Схема бэкенда и тип фронта для одной и той же формы обязаны сверяться машинно; сейчас
расхождение видно только глазами.

---

## БАГ-06 — заголовок `Authorization` теряется при входе без «запомнить меня»

**File:** `frontend_vue/src/services/settingsService.ts:18-22`, `frontend_vue/src/composables/useAuth.ts:36,40`
**Severity:** High — вошедший без галочки пользователь получит 401 на всех 24 роутах настроек.
**Источник:** К2

### Problem

```ts
function authHeaders(): Record<string, string> | undefined {
  const token = localStorage.getItem('auth_token')     // settingsService.ts:19
  if (!token) return undefined
  return { Authorization: `Bearer ${token}` }
}
```

Токен же кладётся туда, куда попросил пользователь: `_useLocalStorage ? localStorage : sessionStorage`
(`useAuth.ts:36`), и сам `useAuth` читает **оба** хранилища
(`useAuth.ts:40`), как и гвард роутера (`frontend_vue/src/router/index.ts:34`). Под моками
это не проявляется никак: `apiGet` уходит в мок раньше, чем заголовок кому-то понадобится
(`frontend_vue/src/services/api.ts:149-151`).

### Fix

Вынести чтение токена в одно место (`useAuth` уже имеет такую функцию) и звать её из всех
сервисов. Те же две строки повторены в `frontend_vue/src/services/uploadsService.ts:14` и
`frontend_vue/src/services/auditFeedService.ts:21` — правило записано трижды.

### Future rule

«Где лежит токен» — правило одного места. Каждая новая копия обязана быть импортом.

---

## БАГ-07 — удаление единицы измерения молча сносит правила пересчёта

**File:** `backend/app/modules/settings/shared/models.py:117,122`, `backend/app/modules/settings/features/crud/domain.py:333-344`
**Severity:** High — матрица пересчёта теряет строки без предупреждения и без следа.
**Источник:** К5

### Problem

Обе стороны правила объявлены каскадом:

```python
from_uom_id: … ForeignKey("uoms.id", ondelete="CASCADE")   # models.py:117
to_uom_id:   … ForeignKey("uoms.id", ondelete="CASCADE")   # models.py:122
```

`remove_uom_item` (`crud/domain.py:333-344`) проверяет только товары — счёт идёт через
`count_products_by_uom` (`crud/domain.py:339-340`) — и, не найдя их, удаляет единицу. Правила пересчёта, где эта единица
стоит с любой стороны, исчезнут вместе с ней. Старый контракт обещал ровно обратное — «409
если UOM используется в товарах, правилах пересчёта или заказах»
(старый раздел `DELETE /api/settings/uoms/:id`).

### Fix

Либо проверка перед удалением и `CONFLICT`, либо `ondelete="RESTRICT"` — но это решение о
поведении, а не о коде: см. `00-решения-владельца.md`.

---

## БАГ-08 — валюту по умолчанию можно удалить

**File:** `backend/app/modules/settings/features/crud/domain.py:257-268`, `frontend_vue/src/views/admin/settings/FinanceSettings.vue:111-114`
**Severity:** High — арендатор остаётся с `constants.defaultCurrency`, указывающим в никуда.
**Источник:** К5

### Problem

`remove_currency_item` проверяет одно: используется ли валюта товарами — счёт через
`count_products_by_currency` (`crud/domain.py:262-266`).
Ни флаг `is_default` самой записи, ни код в `global_constants.default_currency` не проверяются —
в функции нет ни одного обращения ни к тому, ни к другому. Инвариант держит **только атрибут `disabled` на кнопке**:

```vue
:class="{ 'action-danger': !cur.isDefault, 'action-disabled': cur.isDefault }"
:disabled="cur.isDefault"
```

Мок не проверяет и этого (`mocks/settings.ts:475-479`).

### Fix

Проверка в домене с `CONFLICT`. Что именно запрещать — только `is_default` или ещё и
совпадение кода с константами — решение владельца.

---

## БАГ-09 — валюта по умолчанию может стать не одна: инвариант живёт только в клиенте

**File:** `frontend_vue/src/views/admin/settings/SettingsLayout.vue:436-446`, `backend/app/modules/settings/features/crud/domain.py:221-254`
**Severity:** High — при частичном падении Save на сервере окажется две валюты по умолчанию либо ни одной.
**Источник:** К5, графа «Транзакционность»

### Problem

Смена валюты по умолчанию — цикл по всем валютам в клиенте:

```ts
for (const c of settings.currencies) { c.isDefault = c.id === id }
const cur = settings.currencies.find((c) => c.id === id)
if (cur) updateConstants({ defaultCurrency: cur.code })
```

По Save это превращается в PATCH каждой изменившейся валюты (`useSettings.ts:403-405`) плюс
PATCH констант (`:353-356`), и все они уходят одним `Promise.all` (`:518`).
`update_currency_item` при этом просто пишет присланный `is_default`
(`crud/domain.py:237-238`) — других валют не касается.

### Fix

Инвариант обязан жить на сервере: установка `isDefault: true` снимает флаг у остальных валют
арендатора в той же транзакции.

---

## БАГ-10 — уникальность кода валюты проверяется только при создании

**File:** `backend/app/modules/settings/features/crud/domain.py:221-254`, `backend/app/modules/settings/shared/models.py:81-83`
**Severity:** Medium — PATCH с занятым кодом упрётся в ограничение БД и вылетит необработанной ошибкой драйвера вместо 409.
**Источник:** К3

### Problem

`create_currency_item` дубли ловит (`crud/domain.py:200-202` → `ConflictError`).
`update_currency_item` — нет: код переписывается без всякой проверки
(`crud/domain.py:229-230`), а в схеме стоит `UniqueConstraint("tenant_id", "code", name="uq_currencies_tenant_code")`.
Ответ клиенту в этом случае будет не `CONFLICT`, а 500.

### Fix

Та же проверка через `get_currency_by_code` (`crud/repository.py:101-111`) в ветке PATCH.

---

## БАГ-11 — `NOT_FOUND` домена не оформлен на шести роутах: 404 превращается в 500

**File:** `backend/app/modules/settings/features/crud/action.py:252-263,320-331,399-410,413-420,468-479`
**Severity:** Medium — вместо «валюты нет» клиент получает 500 без кода.
**Источник:** К3

### Problem

Домен исправно бросает `NotFoundError` из пяти функций — `update_currency_item`
(`crud/domain.py:226`), `update_uom_item` (`:308`), `update_conversion_item` (`:404`),
`remove_conversion_item` (`:438`), `update_order_status_item` (`:490`). Роуты, которые их
вызывают, `try/except` не имеют: сравните `delete_currency_route` (`crud/action.py:266-284`,
ловит `NotFoundError` и `ConflictError`) с `patch_currency_route` (`:252-263`, не ловит
ничего). `AppError` — обычное `Exception` (`backend/app/core/exceptions.py:4-10`), глобального
обработчика для него в `backend/app/main.py` нет, значит FastAPI отдаст 500.

### Fix

Один обработчик `AppError` на приложение, отображающий `code` в HTTP-статус, — вместо
шестнадцати `try/except` в роутах.

---

## БАГ-12 — ограничение попыток смены пароля объявлено и не работает

**File:** `backend/app/core/config.py:32`, `backend/app/modules/settings/features/profile/action.py:127-150`
**Severity:** Medium — перебор текущего пароля ничем не ограничен.
**Источник:** К5

### Problem

`password_change_rate_limit_per_min: int = 3` объявлено в конфигурации и **не используется
нигде**: `grep -rn password_change_rate_limit_per_min backend/app` даёт единственное
попадание — саму строку объявления. То же у `login_rate_limit_per_min`
(`backend/app/core/config.py:30`). Старый контракт обещает «Rate-limit: 3 попытки/min/IP»
(старый раздел `POST /api/settings/change-password`).

### Fix

Либо реализовать ограничение, либо убрать настройку: объявленная и неработающая читается как
работающая.

---

## БАГ-13 — мок профиля принимает `role`, сервер её игнорирует

**File:** `frontend_vue/src/services/mocks/settings.ts:636-639`, `frontend_vue/src/composables/useSettings.ts:514`
**Severity:** Medium — под моками сохранение профиля способно переписать собственную роль пользователя; против сервера — нет.
**Источник:** К2

### Problem

Клиент шлёт профиль целиком — `saveProfile` со спредом всей секции (`useSettings.ts:514`), то
есть вместе с `role` и `secretLink`
(`frontend_vue/src/types/settings.ts:205-212`). Серверная схема принимает только четыре поля
(`profile/schemas.py:27-35`) и лишние отбрасывает. Мок же кладёт всё:

```ts
export function mockPatchProfile(patch: Partial<UserProfile>): UserProfile {
  Object.assign(settingsStore.profile, patch)
  return structuredClone(settingsStore.profile)
}
```

Роль читают гейты прав (`frontend_vue/src/composables/useOrderPermissions.ts:26`), то есть
под моками поведение расходится с продакшеном именно на правах.

### Fix

Мок обязан принимать тот же набор полей, что и схема сервера, — четыре, — и молча
отбрасывать остальные.

---

## БАГ-14 — мок статусов не знает про системные, сервер знает

**File:** `frontend_vue/src/services/mocks/settings.ts:575-580`, `backend/app/modules/settings/features/crud/domain.py:527-529`
**Severity:** Medium — под моками удаляется то, что сервер запретит 403-м.
**Источник:** К2

### Problem

Сервер отказывает: `if existing.is_system: raise ForbiddenError("Cannot delete a system-defined order status")`
(`crud/domain.py:528-529`), роут отображает это в 403 (`crud/action.py:496-500`). Мок
удаляет что угодно (`mocks/settings.ts:575-580` — единственная проверка это существование),
при том что все 15 сидовых статусов помечены `system: true`
(`mocks/settings.ts:210-345`). Кнопка удаления в UI системные статусы не различает
(`frontend_vue/src/views/admin/settings/OrderStatusesSettings.vue:13`).

### Fix

`mockDeleteOrderStatus` бросает `ORDER_STATUS_IS_SYSTEM` при `system === true`; UI гасит
кнопку по тому же признаку.

---

## БАГ-15 — подмена временного id статуса выбирает строку «первую не из снимка»

**File:** `frontend_vue/src/composables/useSettings.ts:488-502`
**Severity:** Medium — при добавлении двух статусов за один Save оба ответа сервера перезапишут одну и ту же строку, вторая останется с временным id.
**Источник:** К2

### Problem

```ts
const local = snapshot
  ? settings.orderStatuses.find((s) => !snapshot!.orderStatuses.find((o) => o.id === s.id))
  : null
if (local && created?.id) { … splice(idx, 1, created …) }
```

Предикат не зависит ни от `item`, ни от `created` — он всегда возвращает **первую** строку,
которой нет в снимке. Соседние коллекции ищут по данным: валюты — по `code`
(`useSettings.ts:389`), правила пересчёта — по паре единиц (`:447-449`). У статусов такого
ключа нет, поэтому и написан «первый попавшийся».

### Fix

Сопоставлять ответ с запросом по позиции в очереди (индекс `addedData`), а не поиском по
стору.

---

## БАГ-16 — подмена временного id единицы измерения сравнивает объекты, а не значения

**File:** `frontend_vue/src/composables/useSettings.ts:417-428`
**Severity:** Low — работает случайно; любое копирование `code` перед отправкой ломает подстановку id.
**Источник:** К2

### Problem

```ts
const local = settings.uoms.find((u) => u.category === item.category && u.code === item.code)
```

`code` — это `TranslatedString`, то есть объект (`frontend_vue/src/types/settings.ts:72`).
Сравнение `===` истинно только потому, что `addedData` собран деструктуризацией той же
строки (`useSettings.ts:415`) и ссылка та же. Сравнение по значению здесь никогда не
выполнялось.

### Fix

Сопоставлять по индексу очереди, как в БАГ-15, либо сравнивать `JSON.stringify(code)`.

---

## БАГ-17 — код `MAIL_NOT_CONFIGURED` читается из `message`, а настоящий API кладёт его в `code`

**File:** `frontend_vue/src/views/admin/settings/MailSettings.vue:78-84`
**Severity:** Medium — против настоящего бэкенда осмысленное сообщение «сервер не настроен» пропадёт, останется общий «не удалось».
**Источник:** К3

### Problem

```ts
const code = e instanceof Error ? e.message : ''
toast.error(code === 'MAIL_NOT_CONFIGURED' ? t('settingsMail.test_not_configured') : t('settingsMail.test_failed'))
```

Под моками совпадает случайно: мок бросает `new Error('MAIL_NOT_CONFIGURED')` — код уходит в
текст исключения (`frontend_vue/src/services/mocks/settings.ts:621`), а не в поле кода.
`unwrap()` собирает `ApiRequestError`, у которого `message` — человеческий текст сервера, а
код лежит в поле `code` (`frontend_vue/src/services/api.ts:118-124`).

Это единственный код домена, который вообще доходит до отдельного сообщения; остальные пять кодов мока
(`CURRENCY_NOT_FOUND`, `UOM_NOT_FOUND`, `CONVERSION_NOT_FOUND`,
`ORDER_STATUS_NOT_FOUND`, `MAP_NOT_AN_IMAGE` и коды ядра) не разбираются нигде — клиент
показывает `e.message` как есть (`useSettings.ts:522`, `useWarehouseMap.ts:61`).

### Fix

Читать `code` у `ApiRequestError`; мок привести к тому же исключению. Класс общий с
БАГ-01 домена `categories` — чинить его надо один раз для всех доменов.

---

## БАГ-18 — data-URL логотипа уходит на сервер, если Save нажали до конца загрузки

**File:** `frontend_vue/src/views/admin/settings/SettingsLayout.vue:328-338`
**Severity:** Medium — в колонку `logo_url` попадает base64 целого файла.
**Источник:** К4

### Problem

Для мгновенного превью выбранный файл читается в data-URL и кладётся прямо в стор:

```ts
reader.onload = (e) => { updateCompany({ logoUrl: e.target?.result as string }) }
reader.readAsDataURL(file)
```

Настоящий URL приходит позже, обработчиком загрузки — `handleLogoUploaded`
(`SettingsLayout.vue:344-349`), и
подменяет превью. Но `updateCompany` помечает секцию грязной (`useSettings.ts:531-535`), и
Save, нажатый в промежутке, отправит PATCH с base64. Колонка это примет: `logo_url` — `Text`
(`backend/app/modules/settings/shared/models.py:29`, расширена миграцией
`backend/alembic/versions/15f2c7d4e9b0_enlarge_logo_url_to_text.py`). Старый контракт
утверждает обратное — «Клиент **не** шлёт base64»
(старый раздел `PATCH /api/settings/company`).

### Fix

Держать превью вне стора (отдельный `ref`), а в `settings.company.logoUrl` писать только то,
что вернул `POST /api/uploads`.

---

## БАГ-19 — `factor` со значением 0 не доезжает до клиента

**File:** `backend/app/modules/settings/features/crud/domain.py:359,394,430`
**Severity:** Low — коэффициент 0 читается как «коэффициента нет».
**Источник:** К4

### Problem

Три раза подряд:

```python
factor=float(c.factor) if c.factor else None
```

В Python `0` ложен, поэтому нулевой коэффициент превращается в `None`, а `None` во фронте
означает отсутствие поля (`frontend_vue/src/types/settings.ts:83` — `factor?: number`).
Проверка должна быть `is not None`. Ноль как коэффициент бессмысленен, но записать его
сейчас можно: валидации `factor > 0` нет ни в `create_conversion_item`
(`crud/domain.py:366-396`), ни в форме (`SettingsLayout.vue:376-398`).

### Fix

`if c.factor is not None` — и отдельно запрет нулевого коэффициента при создании.

---

## БАГ-20 — правило пересчёта можно создать и без коэффициента, и без формулы

**File:** `backend/app/modules/settings/features/crud/schemas.py:150-159`, `backend/app/modules/settings/features/crud/domain.py:366-396`
**Severity:** Medium — в матрице появляется строка, по которой ничего не пересчитывается.
**Источник:** К4

### Problem

В схеме создания обязательны только `fromUomId`, `toUomId` и `type`; `factor` и
`formula_type` объявлены необязательными (`crud/schemas.py:156-157`). В домене проверяются
две вещи — совпадение единиц (`crud/domain.py:373-374`) и дубль пары (`:377-379`); связка
`type='static' → factor` / `type='dynamic' → formulaType` не проверяется. Само `type` —
свободная строка (`String(20)`, `models.py:125-127`), то есть примется любая.

Форма это правило знает и соблюдает (`SettingsLayout.vue:377-378, 380-394`), но клиент —
не место для серверного инварианта.

### Fix

Валидатор на уровне схемы (`model_validator`), проверяющий пару `type`/значение, и
ограничение `type` списком.

---

## БАГ-21 — PATCH правила пересчёта не проверяет ни совпадение единиц, ни дубль пары

**File:** `backend/app/modules/settings/features/crud/domain.py:399-432`, `backend/app/modules/settings/features/crud/schemas.py:162-171`
**Severity:** Medium — правило можно перевесить на пару, которая уже описана, или на одну и ту же единицу с обеих сторон.
**Источник:** К4

### Problem

`ConversionPatchInput` принимает `fromUomId` и `toUomId` (`crud/schemas.py:165-166`), а
`update_conversion_item` их просто перекладывает: обе единицы уходят в
`updates` без единой проверки (`crud/domain.py:407-410`). Обе проверки,
написанные для создания (`crud/domain.py:373-374` и `:377-379`), здесь не вызываются. Тем же
путём нельзя обнулить `factor` или `formula_type`: `None` означает «не менять»
(`:413-416`), поэтому правило, переключённое со `static` на `dynamic`, сохранит старый
коэффициент.

### Fix

Вынести обе проверки в общую функцию и звать её из обеих веток; для сброса полей — трактовать
явный `null` как «стереть», а не как «не менять».

---

## Рассмотрено и отклонено

- **`GET /api/settings/profile` пишет в БД.** Секретный токен генерируется и сохраняется прямо
  в обработчике чтения (`backend/app/modules/settings/features/profile/domain.py:31-33`). Это
  побочный эффект у GET — но осознанный и работающий: ссылка обязана существовать к моменту
  показа страницы. Не баг, а необъявленная обязанность сервера; ушло в аудит, графа
  «Производные значения».
- **`AppSettings.users` не заполняется ничем.** Поле есть в типе
  (`frontend_vue/src/types/settings.ts:245`) и в сиде мока (`mocks/settings.ts:187-206`), но
  эндпоинта нет и в `fetchAllSections` его нет (`useSettings.ts:213-237`). Это не дефект кода,
  а отсутствующая функциональность — вопрос владельцу, не правка.
- **`sort_order` статусов не нормализуется после удаления.** Сервер оставляет дыры в
  нумерации (`crud/domain.py:522-534`), мок перенумеровывает (`mocks/settings.ts:579`).
  Порядок при чтении задаётся сортировкой (`crud/repository.py:257`), поэтому дыры не видны;
  расхождение записано в аудит, но багом не считается.

---

## БАГ-22 — зависимости аутентификации нет в одном месте: три копии и четвёртый механизм

**File:** `backend/app/modules/auth/shared/dependencies.py`, `backend/app/modules/settings/features/crud/action.py:97`, `backend/app/modules/settings/features/profile/action.py:41`, `backend/app/core/uploads/action.py:34`, `backend/app/modules/auth/features/me/action.py:31`
**Severity:** High — это корень БАГ-01: восемь роутов забыли аутентификацию потому, что тянуться было не к чему.
**Источник:** починка БАГ-01 2026-09-07, линза Л5 (второй экземпляр правила)

### Problem

Требовать вошедшего пользователя бэкенд умеет **четырьмя разными кусками кода**, и ни один из
них не общий:

1. `_resolve_user_id` в `settings/features/crud/action.py:97`;
2. **его же копия** в `settings/features/profile/action.py:41`;
3. **третья копия** в `core/uploads/action.py:34` — она даже признаётся в докстринге:
   «Extract user_id from the Bearer session token (same logic as settings)»;
4. `HTTPBearer(auto_error=False)` плюс ручная проверка `credentials is None` в
   `auth/features/me/action.py:31,45-49` — единственное место, где отказ несёт код
   `MISSING_TOKEN`, а не `UNAUTHORIZED`.

Канонического места при этом **не существует**: `auth/shared/dependencies.py` состоит из одного
докстринга — «Includes: get_current_user, permission checkers, tenant isolation» — и не содержит
ни строки кода. `grep -c "def " backend/app/modules/auth/shared/dependencies.py` → `0`.

Цена измерима, и она уже заплачена: восемь роутов настроек не объявляли аутентификацию
(БАГ-01), потому что зависимость в каждом модуле своя и «забыть» её — значит просто не написать
ещё одну функцию. Второй экземпляр правила расходится с первым молча, и расхождение уже началось: три копии
совпадают по кодам и текстам отказа (все три — `UNAUTHORIZED` с тремя одинаковыми сообщениями),
но уже разошлись по типу параметра — `Optional[str]` в обеих настройках против `str | None` в
загрузке. Четвёртый механизм разошёлся сильнее: `auth/features/me` отвечает `MISSING_TOKEN`,
`TOKEN_EXPIRED` и `INVALID_TOKEN` там, где остальные три отвечают одним `UNAUTHORIZED`.

### Fix

Перенести `_resolve_user_id` в `auth/shared/dependencies.py` — в то место, которое его
докстринг и обещает, — и импортировать оттуда во всех трёх модулях. `auth/features/me` привести
к той же зависимости, сохранив его код `MISSING_TOKEN` (он назван в контракте `auth`, раздел
`GET /api/auth/me`, и фронт его знает). После сведения `AUTH_DEPENDENCIES` в
`backend/tests/test_route_auth.py` станет из одного имени, а не из двух, — это и будет признаком,
что починка закончена.

### Future rule

Сторож `backend/tests/test_route_auth.py` требует у каждого роута зависимость аутентификации, но
**не** требует, чтобы она была одна на проект. Пока их четыре, он вынужден знать все четыре
имени — и каждое новое имя придётся ему дописывать. Список зависимостей в сторожe длиной больше
единицы — сам по себе признак, что правило живёт в нескольких экземплярах.

