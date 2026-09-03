# Auth

Вход, регистрация, выход, проверка сессии и разбор magic-link. Общие соглашения — файл
`00-conventions.md` в этом каталоге (появится в фазе B плана сверки; ссылку поставить, когда файл
существует, — иначе линза К7 краснеет на битой ссылке).

**Источник истины этого домена — бэкенд, а не мок.** `backend/app/modules/auth/` реализует
**четыре эндпоинта из пяти**: register, login, me, link. У `logout` серверной реализации нет ни в
каком виде (`grep -rn "logout" backend/app` пуст) — клиент и мок его имеют, сервер нет. Формы
запросов и ответов ниже сняты со схем бэкенда; там, где фронт с ними расходится, стоит пометка и
номер находки в [`contract-sync-auth-bugs.md`](../../plans/bugs/contract-sync-auth-bugs.md).

Потребители: [`composables/useAuth.ts`](../../../frontend_vue/src/composables/useAuth.ts) (login,
register, fetchMe, logout) и
[`views/public/AuthLinkHandler.vue`](../../../frontend_vue/src/views/public/AuthLinkHandler.vue)
(разбор ссылки).

**Сессия живёт не в cookie.** Сервер возвращает `session.token` и `session.csrf_token` **в теле**
ответа; клиент кладёт их в `localStorage` (когда «запомнить меня») или в `sessionStorage` (только
эта вкладка) и на каждом защищённом запросе шлёт `Authorization: Bearer <token>` и
`X-CSRF-Token: <csrf_token>` — `useAuth.authHeaders()`. HttpOnly-cookie не используется нигде:
`grep -rn "credentials\|HttpOnly" src/services/api.ts` пуст.

**Регистр полей — `snake_case`**, как их отдаёт бэкенд: `first_name`, `csrf_token`, `expires_at`,
`tenant_id`, `is_active`. Домен auth единственный, где так: он писался под форму ответа FastAPI, и
`types/auth.ts` эту форму повторяет буквально.

**`id` и `tenant_id` — UUID.** В схемах бэкенда они объявлены типом `UUID`
(`login/schemas.py:18,25`), на проводе это строка UUID, и во фронте тип `string`. Для бэкенда это
не «любая строка»: неразбираемый UUID — отказ, а не 500.

---

### POST /api/auth/login

Вход по email и паролю. Quick-action: уходит на сервер по submit формы `LoginPage.vue`.

Запрос (по схеме бэкенда `LoginInput`, `backend/app/modules/auth/features/login/schemas.py:8-12`):

```ts
{ email: string; password: string }
```

**`rememberMe` серверу не передаётся как параметр контракта.** Клиент кладёт его в то же тело
(`useAuth.ts:login` шлёт `input` целиком, а `LoginInput` во фронте содержит
`rememberMe?: boolean`), но серверная схема такого поля не объявляет и pydantic его отбрасывает.
Это правильно и должно остаться так: выбор между `localStorage` и `sessionStorage` — решение
клиента, а TTL сессии сервер назначает сам через `session.expires_at`.

Ответ:

```ts
interface LoginResponse {
  user: UserInfo
  session: { token: string; csrf_token: string; expires_at: string }
}

interface UserInfo {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  locale: string
  role: string
  tenant_id: string | null
  is_active: boolean
}
```

После успеха клиент сбрасывает кэш настроек (`useSettings().resetState()`) и уходит на
`/admin/analytics/dashboard`.

Ошибки: неверная пара — `401 UnauthorizedError("Invalid email or password")`
(`login/domain.py:64,68` — одно и то же сообщение и для неизвестного email, и для неверного
пароля, что правильно: разные тексты выдают существование адреса). Отдельного кода клиент здесь
не разбирает, `authError` — это `message` из ответа.

Бэкенд: `auth/features/login/action.py:22` · схемы `login/schemas.py`
Реализация: `composables/useAuth.ts:login` · мок `mocks/index.ts:875` (принимает любую непустую
пару, пустая — `Email and password are required`; мок-пользователь на русском — БАГ-02)

---

### POST /api/auth/register

Регистрация пользователя и компании с автологином. Quick-action, submit формы
`RegisterPage.vue`.

Запрос (по схеме бэкенда `RegisterInput`,
`backend/app/modules/auth/features/register/schemas.py:8-18`):

```ts
{
  email: string
  password: string
  company_name: string
  vat_code: string
  first_name: string        // обязателен на сервере
  last_name: string         // обязателен на сервере
  locale?: string           // по умолчанию 'ru'
  phone?: string | null
}
```

Два расхождения с фронтом, оба записаны находками:

- тип `RegisterInput` в `types/auth.ts:28-37` объявляет `first_name`, `last_name` и `locale`
  необязательными — слабее серверной схемы (БАГ-04). Форма их всегда отправляет
  (`RegisterPage.vue:312-317`), так что сейчас это ловушка для следующего вызывающего, а не
  живой отказ;
- `locale` форма шлёт литералом `'ru'` (`RegisterPage.vue:348`), хотя сервер сохраняет это
  значение пользователю в базу (`register/repository.py:87`). Локаль интерфейса на момент
  регистрации теряется (БАГ-03).

Ответ — `UserInfo` россыпью (не вложенным объектом) плюс сессия и ссылка:

```ts
interface RegisterResponse {
  id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  locale: string
  role: string
  tenant_id: string | null
  is_active: boolean
  session: { token: string; csrf_token: string; expires_at: string }
  /** Показывается пользователю во всплывающем окне сразу после регистрации. */
  secret_link: string
}
```

**Ошибки должны приходить с кодом, иначе форма не подсветит поле.** Клиент
(`services/api.ts:parseErrorBody`, `inferFieldFromMessage`) раскладывает ошибку по полям так:

- `422` в формате Pydantic (`detail: [{ loc, msg, type }]`) → поле берётся из `loc`, код
  подставляется `VALIDATION_ERROR`;
- `detail: { message, code }` с `code: 'VALIDATION_ERROR'` → поле выводится из текста сообщения по
  ключевым словам: `vat`/`company code` → `vat_code`, `email` → `email`, `password` → `password`,
  `phone` → `phone`, `first name` → `first_name`, `last name` → `last_name`, `company` →
  `company_name`;
- `code: 'CONFLICT'` со словом `email` в сообщении → `email` (занятый адрес).

Форма читает `err.fieldErrors` из `ApiRequestError` (`types/api.ts`). Ошибка без кода долетит
только как общий текст.

> **Текст сообщения сейчас — часть контракта, и это плохо.** Поле выводится из подстроки в
> сообщении, а не из данных ответа. Две живые пары проверены и сходятся:
> `ValidationError("Invalid VAT code format. …")` (`register/domain.py:40`) → `vat_code`;
> `ConflictError("A user with this email already exists")` (`register/domain.py:87`) → `email`.
> Переформулировка любого из этих сообщений молча ломает подсветку поля. Правильное решение —
> сервер присылает имя поля явно (`detail: { code, field, message }`) — записано как БАГ-06 и
> ждёт решения владельца. До него **эти сообщения менять нельзя**.

Бэкенд: `auth/features/register/action.py:22` (отдаёт `201 Created`) · схемы `register/schemas.py`
Реализация: `composables/useAuth.ts:register` · **мока нет** — БАГ-01 в
[`contract-sync-auth-bugs.md`](../../plans/bugs/contract-sync-auth-bugs.md): под моками
регистрация падает, хотя против настоящего сервера работает

---

### POST /api/auth/logout

Инвалидация сессии. Тело — `{}`, ответ не читается. Идемпотентен: повторный вызов на мёртвой
сессии — не ошибка.

Требует `authHeaders()`. Клиент чистит хранилища **в любом случае** — даже если запрос упал, сессия
удаляется локально и происходит переход на `redirectTo` (по умолчанию `/`).

В мок-режиме (`VITE_USE_MOCKS !== 'false'`) запрос не отправляется вовсе и сессия не чистится:
админка остаётся доступной без входа. Это осознанное поведение демо, а не недоделка.

Бэкенд: **не реализован** — в `backend/app/modules/auth/features/` есть login, register, me,
magic_link и нет logout. Инвалидация сессии на сервере сейчас не происходит: токен остаётся
действительным до истечения `expires_at`, клиент лишь забывает его локально. Для бэкенда это
задача, а не описание существующего.
Реализация: `composables/useAuth.ts:logout` · мок `mocks/index.ts:905`

---

### GET /api/auth/me

Проверка живой сессии на старте приложения. Требует `authHeaders()`.

Ответ по схеме бэкенда `MeResponse` (`backend/app/modules/auth/features/me/schemas.py:7-19`) —
это `UserInfo` **плюс одно поле**:

```ts
{ ...UserInfo, secret_link?: string | null }
```

`secret_link` фронт не знает: `useAuth.fetchMe()` типизирует ответ как `UserInfo`
(`types/auth.ts:3-13`), и поле молча отбрасывается. Описано как есть, потому что сервер его
отдаёт; что с ним делать — решение владельца (БАГ-05).

**Коды ошибок — со схем и кода бэкенда, а не придуманные** (`me/action.py:44-72` — четыре ветки отказа):

| статус | код | когда |
|---|---|---|
| 401 | `MISSING_TOKEN` | заголовка `Authorization` нет вовсе |
| 401 | `TOKEN_EXPIRED` | подпись просрочена — `max_age` токена **86400 с (24 ч)** |
| 401 | `INVALID_TOKEN` | подпись битая, payload не разбирается, `user_id` не UUID |
| 404 | `NOT_FOUND` | токен валиден, пользователя в базе нет (`me/domain.py:19`) |

Ошибка приходит в формате FastAPI: `detail: { message, code }` — тот самый формат, который
разбирает `services/api.ts:parseErrorBody`.

Клиент различает два случая, и сервер обязан их различать тоже:

- `401` или `404` → токен недействителен: чистится сессия и кэш пользователя;
- любая другая ошибка (сеть, `5xx`) → сессия сохраняется, показывается закэшированный
  пользователь. Отдавать `500` вместо `401` на истёкшем токене значит оставить человека
  залогиненным.

**Срок жизни токена — 24 часа, и он записан в двух местах.** `login/domain.py:78` ставит
`expires_at = now + 24 ч`, а `me/action.py:52` проверяет подпись с `max_age=86400`. Числа обязаны
совпадать: разойдутся — клиент будет считать сессию живой после того, как сервер перестал её
принимать. Это второй экземпляр одного правила (Л5), и для бэкенда это задача: держать срок в
одном месте.

Бэкенд: `auth/features/me/action.py:34` · схемы `me/schemas.py`
Реализация: `composables/useAuth.ts:fetchMe` · мок `mocks/index.ts:296`

---

### GET /api/auth/link

Проверка magic-link из письма. Токен идёт в query: `?token=<...>`.

Ответ: `{ email: string }` — адрес, к которому привязана ссылка; страница подставляет его в форму.

Ошибки бэкенда (`magic_link/domain.py:34,37`) — обе `401` с кодом `UNAUTHORIZED`
(`core/exceptions.py:34`):

- `Invalid or expired secret link` — токен неизвестен или просрочен;
- `Account is deactivated` — ссылка верна, но пользователь отключён.

Мок ведёт себя иначе и **слабее**: пустой токен — `MISSING_TOKEN`, любой непустой принимается
(`mocks/index.ts:303`). Для фронтенда это значит, что путь «просроченная ссылка» под моками не
воспроизводится вовсе.

Бэкенд: `auth/features/magic_link/action.py:21` · схемы `magic_link/schemas.py` —
`MagicLinkInput { token }`, ответ `MagicLinkVerifyResponse { email }`
Реализация: `views/public/AuthLinkHandler.vue:129` · мок `mocks/index.ts:303` (принимает любой
непустой токен, всегда отвечает `director@metalltorg.com`)

---

## Чего в домене нет

`POST /api/auth/refresh` описывался прежним контрактом («background-интервал за 5 минут до
`expiresAt`») и **не существует**: ни одного вызова в коде нет
(`grep -rn "auth/refresh" frontend_vue/src` пуст), мок-ветки нет. Продление сессии сейчас не
реализовано ничем — истёк токен, `GET /api/auth/me` вернёт 401 и клиент разлогинит. Нужен refresh —
это новая работа, а не восстановление описанного.
