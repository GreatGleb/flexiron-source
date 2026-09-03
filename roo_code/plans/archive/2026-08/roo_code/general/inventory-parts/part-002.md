# Инвентаризация планов — часть 002

Каталог: `roo_code/plans/auth`

---

## roo_code/plans/auth/auth-secret-link-plan.md

**Вердикт: частично**

Незакрытых чекбоксов в плане: **0** (`grep -c "^[[:space:]]*- \[ \]"` → `0`), поэтому пункты
сверялись по нумерованным разделам 1–12 и по таблице «Очередность реализации».

### Доказательство

```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/auth/auth-secret-link-plan.md
0

$ grep -rn "secret_link\|secretLink\|magic_link\|magicLink" --include=*.py --include=*.ts --include=*.vue backend frontend_vue/src
backend/alembic/versions/4e8c9a3f1b2d_add_secret_link_token_to_users.py:1:"""add_secret_link_token_to_users
backend/alembic/versions/4e8c9a3f1b2d_add_secret_link_token_to_users.py:3:Add secret_link_token column to users table for magic-link authentication.
backend/alembic/versions/4e8c9a3f1b2d_add_secret_link_token_to_users.py:28:            "secret_link_token",
backend/alembic/versions/4e8c9a3f1b2d_add_secret_link_token_to_users.py:38:    op.drop_column("users", "secret_link_token")
backend/app/main.py:26:from app.modules.auth.features.magic_link.action import (
backend/app/main.py:27:    router as auth_magic_link_router,
backend/app/main.py:73:app.include_router(auth_magic_link_router)
backend/app/modules/auth/features/me/domain.py:22:    secret_link = None
backend/app/modules/auth/features/me/domain.py:23:    if user.secret_link_token:
backend/app/modules/auth/features/me/domain.py:24:        secret_link = f"{settings.frontend_url}/auth/link?token={user.secret_link_token}"
backend/app/modules/auth/features/me/domain.py:36:        secret_link=secret_link,
backend/app/modules/auth/shared/models.py:57:    secret_link_token: Mapped[str | None] = mapped_column(
backend/app/modules/settings/features/profile/schemas.py:22:    secret_link: str | None = Field(alias="secretLink", default=None)
backend/app/modules/auth/features/register/schemas.py:42:    secret_link: str
backend/app/modules/auth/features/register/repository.py:70:    secret_link_token: str | None = None,
backend/app/modules/auth/features/register/repository.py:88:        secret_link_token=secret_link_token,
backend/app/modules/auth/features/magic_link/domain.py:11: ... get_user_by_secret_link ...
backend/app/modules/auth/features/magic_link/domain.py:19:async def verify_secret_link(
backend/app/modules/auth/features/magic_link/repository.py:15:        select(User).where(User.secret_link_token == token)
backend/app/modules/auth/features/me/schemas.py:19:    secret_link: str | None = None
backend/app/modules/auth/features/register/domain.py:115:    secret_link_token = secrets.token_urlsafe(_SECRET_LINK_BYTES)
backend/app/modules/auth/features/register/domain.py:125:        secret_link_token=secret_link_token,
backend/app/modules/auth/features/register/domain.py:154:    secret_link = f"{settings.frontend_url}/auth/link?token={secret_link_token}"
backend/app/modules/auth/features/register/domain.py:172:        secret_link=secret_link,
backend/app/modules/auth/features/magic_link/action.py:22:async def magic_link_verify(
backend/app/modules/settings/features/profile/domain.py:22:async def _ensure_secret_link(db: AsyncSession, user_id: UUID) -> str | None:
backend/app/modules/settings/features/profile/domain.py:31:    if not user.secret_link_token:
backend/app/modules/settings/features/profile/domain.py:33:        updated = await update_user(db, user_id, {"secret_link_token": token})
frontend_vue/src/views/public/LoginPage.vue:97:          <p class="secret-link-msg">{{ t('login.secretLinkMsg') }}</p>
frontend_vue/src/services/mocks/settings.ts:329:    secretLink: 'http://localhost:5173/auth/link?token=mock-secret-token-abc123',
frontend_vue/src/i18n/admin/settings.ts:83:      secretLink: 'Секретная ссылка для входа',

$ ls backend/app/modules/auth/features/
__init__.py  login  magic_link  me  register

$ ls backend/app/modules/auth/features/magic_link/
action.py  domain.py  __init__.py  repository.py  schemas.py

$ grep -n "secret" frontend_vue/src/types/auth.ts
55:  secret_link: string

$ grep -n "secret" frontend_vue/src/types/settings.ts
127:  secretLink?: string

$ grep -rn "auth/link\|AuthLink" frontend_vue/src/router/ frontend_vue/src/views/
router/index.ts:10:import AuthLinkHandler from '@/views/public/AuthLinkHandler.vue'
router/index.ts:70:    path: '/auth/link',
router/index.ts:72:    component: AuthLinkHandler,
views/public/AuthLinkHandler.vue:129:    const result = await apiGet<unknown>('/api/auth/link', { token })

$ grep -n "fetchMe\|onMounted" frontend_vue/src/App.vue
11:import { computed, watchEffect, onMounted } from 'vue'
18:const { fetchMe } = useAuth()
20:onMounted(() => {
21:  fetchMe()

$ grep -n "import.meta.env\|MOCK" frontend_vue/src/views/public/LoginPage.vue
exit=1
```

### Что есть

- Поле `secret_link_token` в модели `User` — ровно в форме из плана
  (`backend/app/modules/auth/shared/models.py:57`), миграция
  `backend/alembic/versions/4e8c9a3f1b2d_add_secret_link_token_to_users.py`.
- Генерация токена при регистрации (`register/domain.py:115`, `secrets.token_urlsafe`),
  передача в `create_user` (`register/repository.py:70,88`).
- `secret_link` в `RegisterResponse` (`register/schemas.py:42`), сборка URL из
  `settings.frontend_url` (`register/domain.py:154`); `frontend_url` есть в
  `app/core/config.py:27`.
- Feature `features/magic_link/` со всеми пятью файлами, роутер подключён в `main.py:73`.
- `secret_link` в `MeResponse` (`me/schemas.py:19`, `me/domain.py:22-36`) и в профиле настроек
  (`settings/features/profile/schemas.py:22`, `domain.py:22-107` — с автогенерацией токена,
  чего план не требовал).
- Фронтенд-типы: `RegisterResponse.secret_link` (`types/auth.ts:55`),
  `UserProfile.secretLink` (`types/settings.ts:127`, но `?`-опциональное, план требовал `string`).
- Попап после регистрации с readonly-полем, кнопкой копирования и предупреждением
  (`RegisterPage.vue:184-218`, `copySecretLink` на 373).
- Блок «Секретная ссылка для входа» в `ProfileSettings.vue:129-145` — readonly-поле,
  кнопка копирования, предупреждение.
- Страница-обработчик `views/public/AuthLinkHandler.vue` и маршрут `/auth/link`
  (`router/index.ts:70-72`), сообщение об ошибке через `t('authLink.invalidLink')`.
- `fetchMe()` в `onMounted` в `App.vue:20-21`.
- Инфо-блок на `LoginPage.vue:97-102` — три сообщения из плана плюс `support@flexiron.com`.

### Чего нет (расхождения с планом)

1. **Magic link не создаёт сессию.** План (раздел 4, `domain.py`) требует
   `login_via_link` → генерация session_token + CSRF → `create_session_repo` → `LoginResponse`.
   Реализовано иначе и осознанно: `verify_secret_link` только находит юзера и возвращает
   `MagicLinkVerifyResponse(email: str)`; docstring в `action.py` прямо говорит
   «No session is created — the user still needs to enter their password».
2. **Фронтовый обработчик не логинит.** План (раздел 11, шаги 3–5) требует сохранить сессию
   в localStorage, вызвать `fetchMe()` и редиректить на `/admin/analytics/dashboard`.
   `AuthLinkHandler.vue:145-150` вместо этого кладёт email в `sessionStorage` и редиректит
   на `/login`, где пароль вводится руками.
3. **Нет ветвления по `VITE_USE_MOCKS` на `/login`.** План (раздел 10) требует прятать форму
   email+password только в реальном режиме и оставлять её в демо-режиме. В `LoginPage.vue`
   нет ни одного `import.meta.env` (grep вышел с кодом 1); форма показывается по условию
   `v-if="prefilledEmail"` — то есть в демо-режиме без перехода по ссылке формы тоже нет.
4. Опциональный `GET /api/auth/secret-link` (раздел 5, «также можно») не заведён —
   план его не требовал жёстко, ссылка отдаётся через профиль настроек.
5. `UserProfile.secretLink` объявлено опциональным (`secretLink?: string`), план требовал
   обязательное поле; в шаблоне это учтено ветками `v-if`/`v-else` (`secretLinkMissing`).

### Пункты плана

Чекбоксов в плане нет; ниже — вердикты по 12 нумерованным разделам.

| № | Пункт | Вердикт |
|---|-------|---------|
| 1 | Поле `secret_link_token` в модели User + миграция | сделано |
| 2 | Генерация `secret_link_token` при регистрации | сделано |
| 3 | `secret_link` в `RegisterResponse` + FRONTEND_URL в Settings | сделано |
| 4 | Feature `magic_link` (валидация токена → **создание сессии**) | частично — файлы есть, сессия не создаётся, отдаётся только email |
| 5 | `secret_link` в `MeResponse` (+ опциональный эндпоинт) | сделано (отдельный эндпоинт не заводили — он был опционален) |
| 6 | `RegisterResponse.secret_link` в `types/auth.ts` | сделано |
| 7 | `UserProfile.secretLink` в `types/settings.ts` | частично — поле опциональное, план требовал обязательное |
| 8 | Попап с secret link после регистрации | сделано |
| 9 | Блок secret link в `ProfileSettings.vue` | сделано |
| 10 | `/login` — режим без моков (ветка по `VITE_USE_MOCKS`) | частично — инфо-блок есть, ветвления по моками нет, форма скрыта всегда |
| 11 | Обработчик `/auth/link` (сессия → `fetchMe` → dashboard) | частично — страница и маршрут есть, логин не выполняется, редирект на `/login` |
| 12 | `fetchMe()` в `App.vue` `onMounted` | сделано |
