# Bugs — contract-sync / домен auth

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), линзы Л3 и Л4.
Область: `frontend_vue/src/composables/useAuth.ts`, `frontend_vue/src/views/public/`,
`frontend_vue/src/types/auth.ts`, ветки auth в `frontend_vue/src/services/mocks/index.ts`,
`backend/app/modules/auth/`.
Начато: 2026-09-03.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

---

## БАГ-01 — `POST /api/auth/register` зовётся, мока нет

**File:** `frontend_vue/src/composables/useAuth.ts:146`, `frontend_vue/src/services/mocks/index.ts:875,905`
**Severity:** High — под моками регистрация не работает вовсе, а мок-режим включён по умолчанию (`VITE_USE_MOCKS !== 'false'`).
**Источник:** Л3 (у каждого вызванного роута есть мок), питфолл #40

### Problem

`useAuth.register()` шлёт `POST /api/auth/register`. В `mocks/index.ts` ветки auth есть только
для `/api/auth/login` (875) и `/api/auth/logout` (905), плюс GET `/api/auth/me` (296) и
`/api/auth/link` (303). Ветки `register` нет ни одной — проверено
`grep -rn "auth/register" src/`: единственное вхождение по всему `src/` это сам вызов.

Значит запрос доходит до финального `throw new Error('[mock] POST ${path} not found')`
(`mocks/index.ts:1137`), и `RegisterPage.vue:340` получает исключение вместо `secret_link`.
Пользователь видит ошибку регистрации на пустом месте.

### Fix

Добавить ветку `/api/auth/register` в `postMockRoute`: собрать `RegisterResponse`
(`types/auth.ts`) — `id`, `email`, поля профиля, `session`, `secret_link`, — положить
пользователя через `setStoredMockUser` (как это делает login) и вернуть через `delay()`.

### Future rule

Линза Л3 требует «у каждого вызванного роута есть мок» и проверяется глазами. Машинная часть
теперь есть — `contract-conformance.spec.ts` сверяет вызовы с контрактом. Второй такой же свод
нужен между вызовами и моком: инвентарь `scanCode()` против веток `mocks/index.ts`. Завести
отдельной задачей после сведения контракта — тогда `register` покраснел бы в день появления.

---

## БАГ-02 — русские данные в мок-пользователе

**File:** `frontend_vue/src/services/mocks/index.ts:884-886`
**Severity:** Low — тесты гоняются на английской локали, данные на русском ломают ассерты по тексту.
**Источник:** Л4 (мок = правда), питфолл #33

### Problem

Ветка `/api/auth/login` собирает пользователя с `first_name: 'Иван'`, `last_name: 'Петров'`,
`phone: '+7 (495) 123-45-67'`. Правило проекта — все значения мок-STORE на английском, потому что
`tests/e2e/fixtures.ts` ставит `flexiron_lang: 'en'` и любой ассерт по имени пользователя читает
русскую строку на английской странице.

### Fix

Заменить на английские значения в стиле остальных моков (`director@metalltorg.com` рядом уже
английский), телефон — в международном формате без локальной разметки.

---

## БАГ-03 — локаль регистрации зашита строкой `'ru'`

**File:** `frontend_vue/src/views/public/RegisterPage.vue:348`
**Severity:** Medium — пользователь, зарегистрированный из английского или литовского интерфейса, сохраняется на сервере как русскоязычный.
**Источник:** К6 (константа во фронте на месте серверного значения)

### Problem

Форма отправляет `locale: 'ru'` литералом. Страница при этом импортирует `useI18n`
(строка 230), но берёт из него только `t` (строка 238) — текущая локаль не читается вовсе.

Значение не декоративное: бэкенд принимает его в `RegisterInput.locale`
(`backend/app/modules/auth/features/register/schemas.py:15`, значение по умолчанию тоже `"ru"`) и
записывает пользователю в базу (`register/repository.py:87`, через `domain.py:124`). То есть
локаль интерфейса на момент регистрации теряется безвозвратно, а не «подставляется по умолчанию».

### Fix

Брать локаль из `useI18n().locale` и отправлять её. Значение по умолчанию на сервере оставить —
оно страхует запросы без поля, а не подменяет выбор пользователя.

---

## БАГ-04 — `RegisterInput` во фронте слабее серверной схемы

**File:** `frontend_vue/src/types/auth.ts:28-37`
**Severity:** Low — форма отправляет всё нужное, но тип разрешает payload, который сервер отвергнет с 422.
**Источник:** К4 (формы против схем), правило «клиентская валидация ≥ серверной» из `vue-rules.md`

### Problem

Тип объявляет `first_name?`, `last_name?`, `locale?` необязательными. Серверная схема
`RegisterInput` (`backend/app/modules/auth/features/register/schemas.py:8-18`) требует `first_name` и `last_name` без
значений по умолчанию — необязателен там только `phone`, а у `locale` есть дефолт.

Сейчас это не проявляется: `RegisterPage.vue:312-317` проверяет оба имени и всегда их отправляет.
Проявится у следующего вызывающего, которому тип разрешит их не передать.

### Fix

Привести тип к серверной схеме: `first_name` и `last_name` обязательны, `phone` и `locale`
необязательны.

---

## БАГ-05 — `MeResponse` отдаёт `secret_link`, которого нет в типе фронта

**File:** `frontend_vue/src/types/auth.ts:3-13`, `backend/app/modules/auth/features/me/schemas.py:19`
**Severity:** Low — поле приходит и молча отбрасывается; при этом на регистрации та же ссылка показывается пользователю.
**Источник:** К4 (формы против схем)

### Problem

Серверный `MeResponse` содержит `secret_link: str | None = None`. Поле есть только в `RegisterResponse` (строка 55). Тип `UserInfo` (строки 3–13), которым
`useAuth.fetchMe()` типизирует ответ, этого поля не знает — значение теряется. При регистрации
`secret_link` пользователю показывают (`RegisterPage.vue`, попап), то есть ссылка предназначена
для человека, а второй канал её получения не используется.

### Fix

Решение владельца: либо добавить поле в `UserInfo` и показывать его там, где это нужно, либо
убрать из `MeResponse` как непотребляемое. Пока решения нет — раздел контракта описывает поле как
есть, потому что сервер его отдаёт.

---

## БАГ-06 — поле формы выводится из ТЕКСТА серверного сообщения

**File:** `frontend_vue/src/services/api.ts:86-106`, `backend/app/modules/auth/features/register/domain.py:40,87`
**Severity:** Medium — сервер переформулирует сообщение, и подсветка поля в форме молча перестаёт работать. Ни один тест этого не увидит.
**Источник:** К4 (формы и ошибки), К6 (связь, которой нет в коде ни одной из сторон)

### Problem

`inferFieldFromMessage()` определяет, какое поле формы подсветить, **по подстрокам в сообщении**:
`vat`/`company code` → `vat_code`, `email` → `email`, `password`/`pwd` → `password`, `first name` →
`first_name` и так далее. Код ошибки при этом используется только как переключатель ветки
(`VALIDATION_ERROR`, `CONFLICT`).

Сейчас цепочка сходится — проверено на двух живых сообщениях бэкенда:

- `ValidationError("Invalid VAT code format. Expected format: XX0000000000 …")`
  (`register/domain.py:40`) → в тексте есть `VAT` → поле `vat_code` ✅;
- `ConflictError("A user with this email already exists")` (`register/domain.py:87`, код
  `CONFLICT` из `core/exceptions.py:48`) → в тексте есть `email` → поле `email` ✅.

Но держится это на словах внутри строк. Перепишет бэкенд первое сообщение как «Company code is
invalid» — сработает ветка `company code` и подсветится тоже `vat_code`, случайно верно. Напишет
«Неверный формат» — не сработает ничего, и человек увидит ошибку без указания поля. Со стороны
бэкенда ничто не подсказывает, что текст — часть контракта.

### Fix

Решение владельца, потому что затрагивает обе стороны: сервер присылает имя поля явно —
`detail: { code, field, message }`, — а клиент читает `field` вместо угадывания по тексту.
Прозаическая привязка тогда исчезает вместе с функцией `inferFieldFromMessage`. До этого решения
контракт обязан называть текущие сообщения дословно, чтобы бэкенд знал, что их нельзя менять
молча.

### Future rule

Связь между двумя сторонами, записанная в прозе, не проверяется ничем. Такую связь либо делают
машинной (поле в ответе), либо описывают в контракте дословно и проверяют спекой: список
сообщений, на которых держится раскладка по полям, — против того, что реально бросает бэкенд.

---

## БАГ-07 — срок жизни сессии записан в двух местах

**File:** `backend/app/modules/auth/features/login/domain.py:78`, `backend/app/modules/auth/features/me/action.py:52`
**Severity:** Low — сейчас числа совпадают; разойдутся — клиент будет считать сессию живой после того, как сервер перестал её принимать.
**Источник:** Л5 (один источник правила), К5

### Problem

`login/domain.py:78` выдаёт клиенту `expires_at = datetime.now(utc) + timedelta(hours=24)`.
`me/action.py:52` проверяет подпись токена с `max_age=86400` — те же 24 часа, но записанные
другим числом и в другом файле. Ни одна проверка не связывает их.

Расхождение проявится молча и неприятно: клиент держит `expires_at` в будущем и считает сессию
живой, а сервер уже отвечает `401 TOKEN_EXPIRED` — или наоборот, токен принимается после
объявленного срока.

### Fix

Одна константа в `app/core/` (или в модуле auth), из которой берут оба места. Задача бэкенда;
контракт домена уже называет срок 24 часа и обязанность держать его в одном месте.

---

## БАГ-08 — сессии пишутся в БД и не читаются никогда

**File:** `backend/app/modules/auth/features/login/repository.py:26-45`, `backend/app/modules/auth/features/me/action.py:52`, `backend/app/modules/auth/shared/models.py:111-139`
**Severity:** High — отозвать сессию нечем: выданный токен действителен до истечения подписи, что бы ни делал пользователь и что бы ни делал администратор.
**Источник:** аудит домена 2026-09-04, К6 (обязанности сервера), К5

### Problem

Таблица `sessions` создаётся и заполняется — `create_session` кладёт `token_hash`, `csrf_token`,
`expires_at`, `remember` (`login/repository.py:35-44`), то же делает регистрация
(`register/domain.py:145-151`). Читается она **ни разу**: все пять попаданий `token_hash` в
`backend/app` — записи (`models.py:121`, `login/repository.py:29,37`, `login/domain.py:72,84`,
`register/domain.py:137,148`), ни одного `select(Session)`.

Проверка подлинности — только разбор подписи `URLSafeTimedSerializer` (`me/action.py:25-28,52`).
Отсюда:

- **`logout` не может работать в принципе** — даже когда роут появится, инвалидировать нечего;
- `expires_at`, который сервер отдаёт клиенту (`login/schemas.py:34`), не тот срок, по которому
  сервер принимает токен: тот задан `max_age` в другом месте;
- `csrf_token` хранится, но сравнивать его не с чем — сервер заголовок не читает (БАГ-10);
- единственный способ разлогинить всех — сменить `secret_key` (`app/core/config.py:16`).

### Fix

Задача бэкенда: проверять токен по строке в `sessions` (хеш → строка → `expires_at` → активность
пользователя), а `logout` помечать её мёртвой. До этого контракт обязан говорить прямо, что
сессия не отзывается — сейчас он говорит про `logout` как про инвалидацию
(`roo_code/roo-context/api/auth.md:166-167`).

### Future rule

Таблица, в которую только пишут, — это не реализованное правило, а его декорация. Модель без
единого чтения обязана попадать в аудит домена отдельной строкой: `grep` на имя модели, где все
попадания — запись, ловит такой случай за одну команду.

---

## БАГ-09 — срок жизни сессии задан ТРЕМЯ разными способами, настройка игнорируется

**File:** `backend/app/core/config.py:17`, `backend/app/modules/auth/features/login/domain.py:78`, `backend/app/modules/auth/features/register/domain.py:144`, `backend/app/modules/auth/features/me/action.py:52`
**Severity:** Medium — пользователь, зарегистрировавшийся только что, получает `expires_at` через 8 часов, вошедший — через 24, а принимается токен 24 часа в обоих случаях. Расширяет БАГ-07, где мест было названо два.
**Источник:** аудит домена 2026-09-04, К6 (значения по умолчанию и их владелец), Л5

### Problem

Три числа на одно правило:

- `login/domain.py:78` — `expires_at = now + timedelta(hours=24)`, литерал;
- `register/domain.py:144` — `expires_at = now + timedelta(hours=settings.session_ttl_hours)`, а
  `session_ttl_hours = 8` (`app/core/config.py:17`);
- `me/action.py:52` — `max_age=86400`, то есть 24 часа, для обоих случаев.

То есть **вход настройку `session_ttl_hours` не читает вовсе**, регистрация читает, а проверка не
читает ни того, ни другого. Заодно не читается `remember_ttl_days = 30` (`config.py:18`): колонка
`sessions.remember` всегда `False`, потому что вход не передаёт этот аргумент
(`login/domain.py:81-87`, дефолт `login/repository.py:32`). Обещание старого контракта
«`remember=true` продлевает TTL до 30 дней» (`roo_code/roo-context/03-api-contract.md:310`)
не выполняется ничем.

### Fix

Один источник срока — настройка, и она же в `max_age`. Задача бэкенда; контракт домена уже
называет 24 часа (`roo_code/roo-context/api/auth.md:217-221`) и после починки обязан назвать
настройку, а не число.

---

## БАГ-10 — CSRF-токен генерируется, хранится и отдаётся, но не проверяется нигде

**File:** `frontend_vue/src/composables/useAuth.ts:106`, `backend/app/modules/auth/features/login/domain.py:44-46,75`, `backend/app/modules/auth/shared/models.py:124`
**Severity:** Medium — защита существует только в виде церемонии: клиент шлёт заголовок, сервер его не смотрит.
**Источник:** аудит домена 2026-09-04, К6 (транзакционность и идемпотентность)

### Problem

Клиент кладёт `X-CSRF-Token` в каждый защищённый запрос (`useAuth.ts:101-108`). На сервере все
попадания `csrf` — генерация (`login/domain.py:44-46,75`, `register/domain.py:57-59,143`), запись
в модель (`models.py:124`) и поля схем (`login/schemas.py:33`, `register/schemas.py:25`). Ни одна
строка не читает заголовок и не сравнивает его с сохранённым значением
(`grep -rn "csrf" backend/app` — тринадцать попаданий, ни одного чтения запроса).

Сравнивать сейчас и не с чем: строка сессии не читается вовсе (БАГ-08).

### Fix

Задача бэкенда, и она вторая после БАГ-08: сначала проверка сессии по БД, потом сверка
`X-CSRF-Token` с `sessions.csrf_token` на небезопасных методах. До этого контракт обязан говорить,
что заголовок отправляется, но не проверяется, — иначе читатель решит, что защита есть.

---

## БАГ-11 — три декодера токена вне auth не проверяют срок

**File:** `backend/app/modules/settings/features/crud/action.py:119`, `backend/app/modules/settings/features/profile/action.py:63`, `backend/app/core/uploads/action.py:50`
**Severity:** High — сессия, которую `GET /api/auth/me` уже отвергает как просроченную, продолжает работать на всех 24 роутах настроек и на загрузке файлов.
**Источник:** аудит домена 2026-09-04, К5 (источник истины), Л5

### Problem

Тот же токен разбирают четыре места, и `max_age` передан ровно в одном:

- `me/action.py:52` — `_serializer.loads(credentials.credentials, max_age=86400)`;
- `settings/features/crud/action.py:119` — `_serializer.loads(token)`, без срока;
- `settings/features/profile/action.py:63` — `_serializer.loads(token)`, без срока;
- `core/uploads/action.py:50` — `_serializer.loads(token)`, без срока.

`URLSafeTimedSerializer.loads` без `max_age` подпись по времени не проверяет вовсе. Практический
результат: фронт получает `401` от `/api/auth/me`, чистит сессию (`useAuth.ts:207-209`) — но токен
из чужой вкладки или из скрипта продолжает открывать настройки арендатора.

Тексты ошибок при этом тоже разошлись: `/me` различает три случая
(`MISSING_TOKEN`/`TOKEN_EXPIRED`/`INVALID_TOKEN`, `me/action.py:47,57,62`), настройки отвечают
одним `UNAUTHORIZED` на все (`settings/crud/action.py:108,113,124`).

### Fix

Одна зависимость на весь бэкенд. Место для неё существует и пусто: `backend/app/modules/auth/shared/dependencies.py`
— четыре строки докстринга, обещающие «get_current_user, permission checkers, tenant isolation», и
ноль кода. Задача бэкенда.

### Future rule

Дубль правила безопасности не виден линзой контракта: каждый эндпоинт по отдельности выглядит
верным. Ловится только запросом «сколько мест делают одно и то же» — `grep -n "loads("` по всему
`backend/app` даёт четыре ответа и три из них неполные.

---

## БАГ-12 — роль пишется в двух регистрах в одной функции

**File:** `backend/app/modules/auth/features/register/repository.py:90,97`, `frontend_vue/src/components/admin/AdminTopbar.vue:26-27`, `frontend_vue/src/services/mocks/index.ts:888`
**Severity:** Medium — сравнение ролей строкой начнёт врать, как только кто-то прочитает мультиролевую таблицу; уже сейчас мок и сервер выдают разные значения одного поля.
**Источник:** аудит домена 2026-09-04, К4 (формы и значения)

### Problem

`create_user` записывает роль дважды и по-разному: legacy-колонка получает `role="owner"`
(`register/repository.py:90`), мультиролевая таблица — `UserRole(role_name="Owner")` (`:97`).

Наружу отдаётся только legacy-колонка (`me/domain.py:33`,
`settings/features/profile/domain.py:61`), помеченная в модели `⚠️ DEPRECATED`
(`auth/shared/models.py:60-63`). Фронт переводит её ключом `settingsUsers.role_<role>`
(`AdminTopbar.vue:26-27`), а ключи объявлены нижним регистром: `role_owner`, `role_admin`, …
(`frontend_vue/src/i18n/admin/settings.ts:231-237`). То есть `"Owner"` из второй таблицы дал бы
ненайденный ключ.

Мок при этом отдаёт `role: 'admin'` (`mocks/index.ts:888`), хотя сервер новому пользователю всегда
ставит `owner`: демо показывает роль, которой у зарегистрировавшегося не бывает.

### Fix

Один регистр и один источник. Решение о том, какая из двух систем ролей главная, — владельца
(строка внесена в `00-решения-владельца.md`); механическая часть — привести мок к серверному
значению.

---

## БАГ-13 — email уникален по паре с арендатором, а код обращается с ним как с глобально уникальным

**File:** `backend/alembic/versions/3a0b5d31bde7_phase_1_tenants_auth_users_sessions.py:54`, `backend/app/modules/auth/shared/models.py:50-52`, `backend/app/modules/auth/features/login/repository.py:20-23`, `backend/app/modules/auth/features/register/repository.py:40-42`
**Severity:** Medium — сейчас не проявляется, потому что пользователь появляется только регистрацией; появится приглашение в существующего арендатора — вход начнёт падать 500-й.
**Источник:** аудит домена 2026-09-04, К6 (мультиарендность)

### Problem

В БД уникальна **пара**: `op.create_index("ix_users_tenant_id_email", "users", ["tenant_id", "email"], unique=True)`
(миграция `:54`); сама колонка объявлена только `index=True`, без `unique`
(`auth/shared/models.py:50-52`).

Код обращается с email как с глобально уникальным:

- регистрация проверяет занятость по всей таблице, без арендатора (`register/repository.py:40-42`)
  — то есть запрещает то, что схема разрешает;
- вход ищет так же и берёт результат через `scalar_one_or_none()` (`login/repository.py:20-23`) —
  на двух строках с одним email это `MultipleResultsFound`, то есть 500 вместо 401.

Второй строки сейчас взяться неоткуда: `User(...)` конструируется в одном месте на весь бэкенд
(`register/repository.py:80`), и регистрация всегда создаёт нового арендатора
(`register/domain.py:98-103`). Дыра открывается первым же эндпоинтом, добавляющим пользователя в
существующего арендатора, — а список пользователей во фронте уже есть
(`frontend_vue/src/services/mocks/settings.ts:188-205`).

### Fix

Решение владельца: email глобально уникален или уникален внутри арендатора. Первое — снять
составной индекс и объявить колонку `unique`. Второе — искать пользователя с арендатором и
разбирать неоднозначность на входе. Строка внесена в `00-решения-владельца.md`.

---

## БАГ-14 — под моками ни один путь отказа домена не воспроизводится

**File:** `frontend_vue/src/services/mocks/index.ts:298,305,878,880`, `frontend_vue/src/composables/useAuth.ts:207`, `frontend_vue/src/router/index.ts:423-425`
**Severity:** Medium — код обработки протухшей сессии и ошибок формы не исполняется в демо ни разу, а мок-режим включён по умолчанию.
**Источник:** аудит домена 2026-09-04, К3 (коды ошибок), К2

### Problem

Мок бросает голый `Error`, а не `ApiRequestError`: `new Error('Not authenticated')`
(`mocks/index.ts:298`), `new Error('MISSING_TOKEN')` (`:305`),
`new Error('Email and password are required')` (`:878`). У такого исключения нет ни `status`, ни
`code`, ни `fieldErrors` (`frontend_vue/src/types/api.ts:25-47`), поэтому:

- ветка `err instanceof ApiRequestError && (err.status === 401 || err.status === 404)` в `fetchMe`
  (`useAuth.ts:207`) под моками недостижима — сессия не чистится никогда;
- раскладка ошибок по полям формы регистрации (`RegisterPage.vue:353-361`) не срабатывает — да и
  ветки регистрации в моке нет вовсе (БАГ-01).

Сверх того мок не проверяет пароль (`mocks/index.ts:880`) и принимает любой непустой токен ссылки
(`:306-307`), а сторож роутера в мок-режиме выходит первой строкой (`router/index.ts:423-425`).
То есть демо не воспроизводит ни один путь отказа домена auth.

### Fix

Мок обязан бросать `ApiRequestError` с тем же `status` и `code`, что и сервер, — тогда клиентские
ветки становятся исполняемыми. Коды брать из бэкенда: `MISSING_TOKEN`, `TOKEN_EXPIRED`,
`INVALID_TOKEN` (`me/action.py:47,57,62`), `UNAUTHORIZED` (`core/exceptions.py:34`),
`VALIDATION_ERROR`, `CONFLICT` (`:27,48`).

### Future rule

«Мок = reference implementation» касается не только успешного пути. Ветка мока, которая бросает
`new Error(<строка>)` там, где сервер отдаёт `detail: { message, code }`, — это не упрощение, а
другой контракт: клиентский разбор ошибок на ней не работает.

---

## БАГ-15 — мёртвая функция `_ensure_unique_slug` в регистрации

**File:** `backend/app/modules/auth/features/register/domain.py:46-54`
**Severity:** Low — читателя ведёт по ложному следу: имя обещает подбор уникального slug, тело возвращает аргумент как есть.
**Источник:** аудит домена 2026-09-04, Л5

### Problem

Функция объявлена, принимает `db` и `base_slug`, заводит счётчик и возвращает `slug` без единого
изменения; комментарий внутри признаётся прямо: «We'll check in the domain function itself — this
is a sync helper» (`:53`). Вызывающего у неё нет (`grep -n "_ensure_unique_slug" backend/app` —
одно попадание, само объявление). Настоящий подбор написан отдельно на месте
(`register/domain.py:90-95`).

### Fix

Удалить объявление. Задача бэкенда, к контракту отношения не имеет.

---

## Сводка

| | Тип | Файл | Суть |
|---|---|---|---|
| | Runtime | `mocks/index.ts` | БАГ-01: `POST /api/auth/register` без мока — регистрация падает |
| | Mock data | `mocks/index.ts` | БАГ-02: русские имя/фамилия/телефон в мок-пользователе |
| | Contract | `RegisterPage.vue` | БАГ-03: локаль регистрации зашита `'ru'`, локаль интерфейса теряется |
| | TypeScript | `types/auth.ts` | БАГ-04: `RegisterInput` слабее серверной схемы |
| | Contract | `types/auth.ts` | БАГ-05: `secret_link` из `MeResponse` не описан во фронте |
| | Contract | `services/api.ts` | БАГ-06: поле формы выводится из текста серверного сообщения |
| | Duplicate | `backend/.../auth` | БАГ-07: срок жизни сессии записан в двух местах (24 ч и 86400) |
| | Backend | `backend/.../auth` | БАГ-08: сессии пишутся в БД и не читаются — отозвать нечего |
| | Backend | `backend/.../auth` | БАГ-09: срок сессии задан тремя способами, `session_ttl_hours` игнорируется входом |
| | Security | `backend/.../auth` | БАГ-10: `X-CSRF-Token` шлётся, но не проверяется нигде |
| | Security | `backend/.../settings`, `core/uploads` | БАГ-11: три декодера токена без `max_age` — просроченный токен принимается |
| | Contract | `backend/.../register` | БАГ-12: роль пишется как `owner` и `Owner` в одной функции |
| | Backend | `backend/.../auth` | БАГ-13: email уникален по паре `(tenant_id, email)`, код считает его глобальным |
| | Mock | `mocks/index.ts` | БАГ-14: под моками ни один путь отказа не воспроизводится — голый `Error` вместо `ApiRequestError` |
| | Dead code | `backend/.../register` | БАГ-15: `_ensure_unique_slug` объявлена и не вызывается |
