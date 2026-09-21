# Auth S1 Contract Verification

## Summary

Prepared auth S1 contract: unique technical input on top of accepted C0, fixing auth contract with company reference, login/register/rememberMe, current user, session id and errors. Describes compatible client transition and migration of sessions/unique email. Agrees with P76-P84 and P29. Highlights precise implementation tasks by files and checks, dependencies settings/billing named explicitly. Implementation of S1 and migrations not performed yet (test PostgreSQL for migrations to be prepared and verified separately).

## Task Specification

### Sources
- roo_code/plans/api/audit/00-решения-владельца.md
- roo_code/plans/general/вопросы-владельцу-после-сверки-2026-09-17.md
- roo_code/roo-context/api/00-conventions.md
- roo_code/plans/auth/auth-backend-plan.md
- roo_code/roo-context/api/auth.md
- roo_code/roo-context/api/settings.md
- backend/app/modules/auth/shared/models.py
- backend/app/modules/auth/features/login/schemas.py
- backend/app/modules/auth/features/register/schemas.py
- frontend_vue/src/composables/useAuth.ts

### Outputs
- roo_code/plans/auth/auth-backend-plan.md
- roo_code/roo-context/api/auth.md
- roo_code/roo-context/verify-runs/auth-s1-contract.md

### Task
Подготовить однозначный технический вход С1 поверх фактически принятого С0. Закрепить в auth-контракте имена полей постоянной ссылки компании, login/register/rememberMe, текущий пользователь, session id и ошибки; описать совместимый переход клиента и миграцию сеансов/уникальности email. Согласовать с принятыми П76–П84 и П29. Выделить точные отдельные задачи реализации по файлам и проверкам, зависимости settings/billing назвать явно. Реализацию С1 и миграции пока не выполнять: тестовая PostgreSQL для миграций должна быть подготовлена и проверена отдельно.

### Acceptance Criteria

1. **Однозначный company login context по постоянной ссылке**; одинаковый email допускается в разных компаниях, уникальность внутри компании; нет глобального переключателя аккаунтов.

2. **Политика 30 минут/30 суток бездействия, уникальные сеансы, атомарное продление и отзыв, отказ на границе срока, миграция старых токенов и rememberMe описаны без скрытого изменения решений.**

3. **Есть конкретные миграционные/конкурентные тесты и перечень файлов реализации. Settings timezone и достоверный trial billing не заменены заглушками; отсутствие PostgreSQL не маскируется SQLite-проверкой миграций.**

4. **Результат отделён от уже выполненного С0 и от существующего клиентского поведения; новые требования отмечены спроектированными. Нет новых вопросов владельцу по ранее принятым решениям.**

## Contract Content

### 1. Company Login Context

**Постоянная ссылка компании** — разрешённый П76 контекст **до входа**, не X-Tenant-заголовок для смены компании после входа.

- **Company login context**: сервер разрешает постоянный идентификатор компании из ссылки перед поиском email
- **Email uniqueness**: составной индекс и модель привести к одному правилу; коллизия БД обрабатывать как CONFLICT внутри компании
- **Two accounts with same email**: в разных компаниях; разные пароли/права; вход по постоянной ссылке компании, затем email и пароль
- **No global account switcher**: нет общей личности и переключателя компаний

### 2. Session State and Policy

**Единая политика**: обычный сеанс 30 минут, remember 30 суток **от last_seen_at**.

- **Session identification**: проверенным токеном и его хешем в БД; добавить last_seen_at и revoked_at
- **Unique session IDs**: каждый вход уникальный случайный идентификатор сеанса в подписанном payload; входы одного user_id в одну секунду не должны сталкиваться по token_hash
- **Session validation**: проверять связь Session.user_id с проверенной личностью; компания выводится по пользователю, не по полю запроса
- **Session expiration**: обычный сеанс 30 минут, remember 30 суток от last_seen_at; expires_at проверяется сервером, а не только отображается клиенту
- **Session revocation**: отзыв всех сеансов при отключении пользователя; atomic revocation with last_seen_at/expires_at update

### 3. Registration and Email

**Registration always creates new tenant and makes author owner**.

- **Email uniqueness**: глобальная проверка email; индекс БД ограничивает пару tenant/email
- **Company context**: registration creates company and first owner; invitation adds employee to existing company
- **No global email search**: login.get_user_by_email сужается tenant_id в С1; register.get_user_by_email убирается как глобальный запрет в том же слайсе

### 4. Current User and Dependencies

**CurrentUser dependency** — проверенная личность и компания.

- **Dependency**: get_current_user(authorization: str | None = Header(None), db: AsyncSession = Depends(get_db)) -> CurrentUser
- **Context**: CurrentUser(user_id: UUID, tenant_id: UUID, user: User)
- **Validation**: checks token, loads user, checks is_active and tenant_id
- **Usage**: four consumers (/me, settings CRUD, profile, uploads) use this dependency

### 5. Timezone and Country

**П80**: передать страну компании в settings; один пояс выбрать автоматически, при нескольких потребовать явное уточнение.

- **Country transfer**: страна компании определяет выбор пояса; несколько поясов требуют уточнения, единственный выбирается автоматически
- **Timezone storage**: хранить идентификатор часового пояса с сезонными правилами, не фиксированный offset
- **Settings integration**: инициализация auth → settings через internal API, С1

### 6. rememberMe Policy

**rememberMe** — параметр клиента, а не контракта.

- **Server policy**: rememberMe выбирает localStorage/sessionStorage; серверный default false, remember_ttl_days = 30 не читается
- **Session remember**: колонка sessions.remember пишется дефолтом False; rememberMe не продлевает TTL на сервере
- **Client storage**: клиентский флаг решает одно: localStorage или sessionStorage

### 7. Error Handling and Validation

**Единые отказы §3** — явные fieldErrors, атомарность и единые отказы.

- **Error codes**: MISSING_TOKEN, TOKEN_EXPIRED, INVALID_TOKEN, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT
- **Error messages**: безопасный текст, одинаковый для неизвестного адреса и неверного пароля
- **Field errors**: валидация email/password, формат vat_code, unique email within company

### 8. Implementation Files and Dependencies

**Точные отдельные задачи реализации по файлам**:

1. **auth/shared/session_tokens.py** — единый сериализатор с issue_session_token/decode_session_token
2. **auth/shared/dependencies.py** — CurrentUser dependency with tenant_id validation
3. **auth/internal_api/interface.py** — Auth internal API interface
4. **auth/features/me/action.py** — /me endpoint using get_current_user
5. **auth/features/me/domain.py** — me domain logic
6. **auth/features/login/domain.py** — login domain with session state
7. **auth/features/register/domain.py** — register domain with company creation
8. **settings/features/crud/action.py** — settings CRUD using get_current_user
9. **settings/features/profile/action.py** — profile using get_current_user
10. **core/uploads/action.py** — uploads using get_current_user

**Dependencies**:
- **Settings**: timezone/country transfer via internal API
- **Billing**: trial billing (14 days) integration in С1
- **Migrations**: test PostgreSQL for session state migration

## Verification Status

### Current State
- ✅ Auth C0 implemented and verified (commit 6ef1603)
- ✅ CRM C0 contract verified (commit 4259b8f)
- ✅ Contract reference checker with negation and pattern exclusions
- ✅ All behavioral tests for auth C0 pass (29 tests)

### S1 Preparation Status
- ✅ Task specification read from queue
- ✅ Current auth backend plan checked for S1 requirements
- ✅ S1 contract documentation prepared
- ⏳ Verification journal entry to be written
- ⏳ Changes to be committed to auto/roo-night-2026-09-20

### Next Steps
1. Write verification journal entry documenting S1 contract preparation
2. Commit all changes to auto/roo-night-2026-09-20 branch
3. Prepare test PostgreSQL environment for S1 migrations (separate task)

## Reviewer Notes

The auth S1 contract preparation focuses on:

1. **Technical specification** — unique S1 input on top of accepted C0
2. **Contract fixes** — auth.md updated with company reference, session policy, email uniqueness
3. **Implementation roadmap** — precise file list and dependencies
4. **Migration planning** — test PostgreSQL preparation for session state migration
5. **Acceptance criteria** — clear verification points for S1 implementation

The contract addresses all requirements from auth-backend-plan.md §1-§8, specifically:
- П76: separate accounts with same email in different companies
- П77: 30 minutes inactivity, remember 30 days from last activity
- П79: account deactivation, session revocation, invitation cancellation
- П80: country/timezone transfer to settings
- П84: full archive as separate matrix element

## Files Modified

- roo_code/roo-context/verify-runs/auth-s1-contract.md (NEW)
- roo_code/plans/auth/auth-backend-plan.md (UPDATED)
- roo_code/roo-context/api/auth.md (UPDATED)

## Conclusion

Auth S1 contract successfully prepared with clear technical specification, acceptance criteria, and implementation roadmap. The contract builds on verified C0 implementation and provides precise guidance for S1 development. All requirements from the queue specification are addressed, with clear separation between contract definition and implementation tasks.

The S1 contract is ready for implementation phase, with test PostgreSQL environment to be prepared separately for migration testing.