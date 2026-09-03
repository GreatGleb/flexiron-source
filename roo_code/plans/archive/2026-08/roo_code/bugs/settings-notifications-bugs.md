# Settings + Notifications — Bugs

## БАГ-7 — `notificationsPage` missing from E2E ALL_FLAGS_ENABLED

**File:** `frontend_vue/tests/e2e/helpers/flags.ts:10`
**Severity:** Medium — E2E tests won't see the notifications page

### Problem

The `notificationsPage` flag is defined in `types/features.ts` and `config/featureFlags.ts` but is missing from the `ALL_FLAGS_ENABLED` constant in the E2E test helpers. This means Playwright tests won't force this flag ON, so any notification page tests would fail.

### Fix

Add `notificationsPage: true` to `ALL_FLAGS_ENABLED` in `tests/e2e/helpers/flags.ts`.

## БАГ-8 — `adminSettings` missing from E2E ALL_FLAGS_ENABLED

**File:** `frontend_vue/tests/e2e/helpers/flags.ts:10`
**Severity:** Medium

### Problem

Same as БАГ-7 — `adminSettings` flag is defined in types and config but missing from E2E helpers.

### Fix

Add `adminSettings: true` to `ALL_FLAGS_ENABLED`.

## БАГ-6 — Systematic `any` usage in settings injects

**Files:**
- `frontend_vue/src/views/admin/settings/CompanySettings.vue:10`
- `frontend_vue/src/views/admin/settings/FinanceSettings.vue:10`
- `frontend_vue/src/views/admin/settings/OrderStatusesSettings.vue:11`
- `frontend_vue/src/views/admin/settings/UnitsSettings.vue:12`
- `frontend_vue/src/views/admin/settings/ProfileSettings.vue:13`

**Severity:** Low — no runtime impact, but defeats TypeScript safety

### Problem

All 5 child settings components use `inject<any>('settings')` instead of `inject<AppSettings>('settings')`. The `AppSettings` type is already defined in `types/settings.ts`. Using `any` means no type checking on `settings.company.name`, `settings.constants.vatRate`, etc.

### Fix

Replace `inject<any>('settings')` with `inject<AppSettings>('settings')` and import `AppSettings` in each file.

### Future rule

Never use `inject<any>('key')` when the provided value has a known type. Always use the proper type.

## БАГ-12 — `mockMarkAsRead` правит сид, и «сброс в непрочитанные» ничего не сбрасывает

**File:** `frontend_vue/src/services/mocks/notifications.ts:353,435-439,454`
**Severity:** Low — `mockResetNotifications` сегодня не зовёт никто (проверено грепом), так что дефект спящий
**Источник:** Л4 (мок = правда), цикл проверок по пункту 2 `review-followups.md`

### Problem

`let notifications = [...MOCK_NOTIFICATIONS]` — копия МАССИВА, но не записей: обе ссылки
смотрят на одни и те же объекты. `mockMarkAsRead` правит объект на месте
(`notification.isRead = true`), то есть правит запись сида. После этого
`mockResetNotifications`, который обещает «reset all notifications to unread», делает
`MOCK_NOTIFICATIONS.map((n) => ({ ...n }))` — и копирует уже испорченный `isRead: true`.

`mockMarkAllAsRead` этой болезнью не болеет: он собирает новые объекты через `map`.
Уведомления, рождённые событиями (эмиттеры ниже в том же файле), тоже не задеты — их
объекты создаются на месте и сидом не делятся.

### Fix

`let notifications = MOCK_NOTIFICATIONS.map((n) => ({ ...n }))` — сид перестаёт быть общим
с лентой. Правка на строку, но за ней тянется проверка: `mockResetNotifications` не вызван
ниоткуда, и до появления вызывающего утверждать инверсией нечего.

### Future rule

Мок, у которого есть «сброс к исходному», обязан копировать записи, а не массив: копия
массива защищает от `push`, но не от правки поля. Это тот же питфолл #13 (мок отдаёт прямую
ссылку), только направленный внутрь.

## Summary

| Bug ID | Type | File | Summary |
|--------|------|------|---------|
| ~~БАГ-1~~ | Pitfall #9 | `FinanceSettings.vue` | ~~HTML comments in template~~ ✅ FIXED |
| ~~БАГ-2~~ | Pitfall #9 | `OrderStatusesSettings.vue` | ~~8 HTML comments~~ ✅ FIXED |
| ~~БАГ-3~~ | Pitfall #9 | `ProfileSettings.vue` | ~~HTML comments~~ ✅ FIXED |
| ~~БАГ-4~~ | Pitfall #9 | `UnitsSettings.vue` | ~~6 HTML comments~~ ✅ FIXED |
| ~~БАГ-5~~ | Pitfall #9 | `SettingsLayout.vue` | ~~11 HTML comments~~ ✅ FIXED |
| ~~БАГ-6~~ | TypeScript | 5 settings views | ~~`inject<any>('settings')`~~ ✅ FIXED — typed with `AppSettings` |
| ~~БАГ-7~~ | Feature Flag | `flags.ts` | ~~`notificationsPage` missing~~ ✅ FIXED |
| ~~БАГ-8~~ | Feature Flag | `flags.ts` | ~~`adminSettings` missing~~ ✅ FIXED |
| ~~БАГ-9~~ | Pitfall #13 | `notifications.ts` mock | ~~missing structuredClone~~ ✅ FIXED |
| БАГ-10 | Pitfall #19 | `NotificationsPage.vue` | Filters outside GlassPanel — visual preference, low priority |
| ~~БАГ-11~~ | Pitfall #20 | `useNotifications.ts` | ~~missing initialized flag~~ ✅ FIXED |
| БАГ-12 | Л4 / Pitfall #13 | `notifications.ts` mock | `mockMarkAsRead` правит сид — «сброс в непрочитанные» не сбрасывает |
