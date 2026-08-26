# Инвентаризация планов — часть 016

Каталог: `roo_code/plans/general`. Код не менялся.

Чекбоксов (`grep -c "^[[:space:]]*- \[ \]"`) во всех четырёх планах — 0:

```
roo_code/plans/general/settings-cache-data-staleness-plan.md: 0
roo_code/plans/general/settings-plan.md: 0
roo_code/plans/general/update-skills-clients-prompt.md: 0
roo_code/plans/general/user-dropdown-menu-plan.md: 0
```

---

## 1. roo_code/plans/general/settings-cache-data-staleness-plan.md — СДЕЛАНО

Все пять правок плана есть в коде.

**Fix 1 — `loaded`-гард убран, `resetState()` добавлен и экспортирован**

```
$ grep -n "loaded\|resetState\|CACHE_KEY\|CACHE_TTL" frontend_vue/src/composables/useSettings.ts
16:  // exists only because the settings have not loaded yet.
29:const CACHE_KEY = `flexiron_settings_cache_v${CACHE_VERSION}`
30:const LEGACY_CACHE_KEYS = [
36:// const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
45://     const raw = localStorage.getItem(CACHE_KEY)
49://     if (age >= CACHE_TTL_MS) {
50://       localStorage.removeItem(CACHE_KEY)
217:    // Always purge localStorage cache to avoid stale data
254:    // Purge localStorage cache
564:  function resetState() {
597:    resetState,
```

Переменной `loaded` нет вовсе (осталось только слово в комментарии), раннего выхода нет:
`load()` начинается с очистки всех кэш-ключей, ставит `loading = true`, зовёт
`fetchAllSections()` (все секции параллельно, `allSettled`), пишет кэш, снимает снапшот.
Чтение из localStorage (Cause 2) закомментировано целиком — TTL-кэш больше не читается.

**Fix 2 — `resetState()` после register/login**

```
$ grep -n "resetState\|function login\|function register" frontend_vue/src/composables/useAuth.ts
114:  async function login(input: LoginInput): Promise<void> {
124:      const { resetState } = useSettings()
125:      resetState()
139:  async function register(input: RegisterInput): Promise<string> {
163:      const { resetState } = useSettings()
164:      resetState()
```

**Fix 3 — шапка читает `useAuth().user`**

`frontend_vue/src/components/admin/AdminTopbar.vue`:
```
const { user: authUser, logout: authLogout } = useAuth()
const userName = computed(() => { if (!authUser.value) return t('head.user') ... })
const userRole = computed(() => { if (!authUser.value?.role) return t('head.role')
  return t(`settingsUsers.role_${authUser.value.role}`) })
```
`useSettings().settings.profile` в топбаре не используется.

**Fix 4/5 — скелетон и error-state в SettingsLayout**

```
$ grep -n "settings-loading\|settings-error\|skeleton-rows\|settings.retry" frontend_vue/src/views/admin/settings/SettingsLayout.vue
487:    <!-- Loading skeleton -->
488:    <div v-if="loading" class="settings-loading" data-test="settings-loading">
489:      <GlassPanel :loading="true" :skeleton-rows="6" />
493:    <div v-else-if="error && !loading" class="settings-error" data-test="settings-error">
499:          {{ t('settings.retry') }}
800:.settings-loading {
804:.settings-error {
808:.settings-error .error-state {
```
CSS `.settings-error` / `.error-state` на месте (строки 800–830).

Расхождение только в именах i18n-ключей: план предлагал `t('settings.loadError')` и
`t('common.retry')`, в коде — `t('settings.retry')`. Поведение то же.

Осталось: ничего.

---

## 2. roo_code/plans/general/settings-plan.md — ЧАСТИЧНО

Инфраструктура настроек есть, но структура страницы и три из семи табов — нет.

**Что есть**

```
$ ls frontend_vue/src/types/settings.ts frontend_vue/src/services/settingsService.ts \
     frontend_vue/src/services/mocks/settings.ts frontend_vue/src/composables/useSettings.ts \
     frontend_vue/src/i18n/admin/settings.ts
frontend_vue/src/composables/useSettings.ts
frontend_vue/src/i18n/admin/settings.ts
frontend_vue/src/services/mocks/settings.ts
frontend_vue/src/services/settingsService.ts
frontend_vue/src/types/settings.ts
```

Типы (`types/settings.ts`): `CompanyInfo`, `GlobalConstants`, `Currency`, `Uom`,
`UomConversion`, `OrderStatusSetting`, `SettingUser`, `UserProfile`, `AppSettings`
(+ сверх плана: `WarehouseMapFile`, `OrderPermissions`, `UomCategory`, `UserRole`).

Флаг и роут:
```
$ grep -n "adminSettings" frontend_vue/src/config/featureFlags.ts
25:  adminSettings: true,
$ grep -n "settings" frontend_vue/src/router/index.ts
355:        path: 'settings'
359:            name: 'admin-settings'
360:            component: () => import('@/views/admin/settings/SettingsLayout.vue')
369/374/379/384/389/394: admin-settings-{profile,company,finance,units,order-statuses,logs}
```

Сайдбар — уже router-link, не заглушка:
```
$ grep -n "admin-settings-profile" frontend_vue/src/components/admin/AdminSidebar.vue
136:        :to="{ name: 'admin-settings-profile' }"
162:        :to="{ name: 'admin-settings-profile' }"
```

**Чего нет**

- `views/admin/settings/SettingsPage.vue` из плана не существует. Вместо одной таб-страницы —
  `SettingsLayout.vue` + дочерние роуты: `ProfileSettings.vue`, `CompanySettings.vue`,
  `FinanceSettings.vue`, `UnitsSettings.vue`, `OrderStatusesSettings.vue`, `LogsSettings.vue`.
  Табов шесть, и набор другой (появился Profile и Logs).
- **Таб «Пользователи» отсутствует.** Тип `SettingUser` есть, данные в моке есть
  (`mocks/settings.ts:162: users: [`), но в `settingsService.ts` нет ни одной функции по
  пользователям (`grep -rn "users" settingsService.ts` — пусто) и UI-страницы нет.
- **Таб «Карта склада» (секторы) отсутствует.** `grep -rn -i "sector" types/settings.ts
  settingsService.ts` — пусто; вместо `WarehouseSector[]` в `AppSettings` лежит
  `warehouseMap: WarehouseMapFile | null`, и правят его страницы склада
  (`views/admin/warehouse/WarehouseMapPage.vue`, `WarehousePage.vue`), не настройки.
- **Таб «Шаблоны документов» отсутствует** даже заглушкой:
  `grep -rn -i "documentTemplate\|templates" i18n/admin/settings.ts` — пусто.
- **Атомарного сохранения из плана нет.** `getSettings()` / `saveSettings()` в
  `settingsService.ts` не экспортируются (`grep -n "getSettings\|saveSettings"` — пусто);
  сервис пофункциональный: `getCompany/saveCompany`, `getConstants/saveConstants`,
  CRUD валют/UOM/пересчётов/статусов, `getProfile/saveProfile`, `changePassword`,
  `getWarehouseMap/saveWarehouseMap/deleteWarehouseMap`, `getOrderPermissions`.
  В моках `mockGetSettings`/`mockSaveSettings` есть, но сервис их не зовёт.
- `styles/admin/settings.scss` не существует: `ls frontend_vue/src/styles/admin | grep -i settin`
  → только `settings_logs.css`; остальные стили настроек — scoped внутри `SettingsLayout.vue`.
- `Currency.exchangeRate` из плана нет — и это осознанно: в проекте нет курсов вовсе
  (см. память «Валютной конвертации нет»). Считать это долгом нельзя.

---

## 3. roo_code/plans/general/update-skills-clients-prompt.md — ЧАСТИЧНО

Это не план кода, а промпт «выполни `/update-skills clients`». Сопоставляется с состоянием
скилов. Багфайлы на месте: `roo_code/plans/bugs/clients-bugs.md` (все БАГ-1…БАГ-8 помечены ✅),
`roo_code/plans/bugs/clients-api-contract-analysis.md`.

**Правила из плана, которые в скилах уже есть (БАГ-1…БАГ-8)**

```
$ grep -n "dot notation\|btn_retry\|main-card-content\|empty-state\|Import hygiene" roo_code/skills/create-page.md
548: All i18n keys must use domain prefix ... Never use unprefixed dot-notation keys like t('btn.delete')
550: Include ALL button/label keys from template ... btn_retry ...
551: `btn_retry` is required for error state
666: Import hygiene — every import must be used ... Common unused imports: useRouter
676: `.empty-state` must be defined with display:flex; flex-direction:column; align-items:center
677: For card pages: `.main-card-content` and `.entity-card-grid` must be defined in the page CSS
711: Error state (retry button) — every list page must have an error state with a dedicated btn_retry key
725: ❗ CSS required: The `.empty-state` class is NOT global
$ grep -n "#63" roo_code/skills/vue-rules.md
903 (раздел): 🔥 #63 — Never rely on CSS classes from another page's CSS file
     (перечислены .empty-state, .text-muted, .main-card-content, .entity-card-grid)
```
Плюс на месте старое правило про `_entity-card-layout.css` (create-page.md:672, Pitfall #16)
и общее правило `structuredClone` (create-page.md:157/165, Pitfall #13).

**Чего в скилах нет (все — контрактная половина, БАГ-9…БАГ-12, плюс два уточнения)**

```
$ grep -n "VALIDATION_ERROR\|CONFLICT" roo_code/skills/create-page.md
(пусто)
```
- Phase 2: нет требования «мок POST валидирует required-поля и возвращает VALIDATION_ERROR» (БАГ-10).
- Phase 2: нет требования «мок DELETE проверяет CONFLICT по активным ссылкам» (БАГ-11).
- Phase 2: нет проверки «у каждого зарегистрированного мок-роута есть функция-обработчик» (БАГ-12);
  в разделе регистрации только правило про парный `/translated`-вариант (create-page.md:180).
- Phase 2: нет отдельного пункта «добавляя НОВУЮ мок-читалку в существующий файл — применить
  `structuredClone`» (БАГ-8 закрыт общим правилом, но именно этот зазор не описан).
- Checkpoint 6: обратная проверка «класс используется, но нигде не определён/не импортирован»
  так и не добавлена — там только «Dead CSS check» (defined but not used, create-page.md:698).
  Частично закрыто пунктом 676 внутри BUG-18/19, но не в чекпоинте.
- Phase 9 verification checklist про unused imports не появился — правило живёт в Phase 6 (666).
- БАГ-9 (`orderHistory`) план сам помечает как domain-specific и в скилы не просил.

---

## 4. roo_code/plans/general/user-dropdown-menu-plan.md — ЧАСТИЧНО

Дропдаун сделан целиком; расходится одна деталь поведения logout в мок-режиме.

**Есть**

`frontend_vue/src/components/admin/AdminTopbar.vue` — `<div class="user-profile" @click.stop="toggleMenu">`,
`isMenuOpen`/`toggleMenu`/`closeMenu`, закрытие по клику вне (`document.addEventListener('click',
handleOutsideClick)` в `onMounted`, снятие в `onUnmounted`), два пункта — `goToSettings()` →
`router.push({ name: 'admin-settings-profile' })` и `handleLogout()` → `authLogout('/')`.

```
$ grep -n "settings:\|logout:" frontend_vue/src/i18n/admin/layout.ts
34:      settings: 'Настройки',   35:      logout: 'Выйти',
92:      settings: 'Settings',    93:      logout: 'Logout',
150:      settings: 'Nustatymai',  151:      logout: 'Atsijungti',
```
(в блоке `head` каждой локали; строки 13/71/129 — это `side.settings`).

```
$ grep -n "user-dropdown" frontend_vue/src/styles/erp-base.css
430:.user-profile {  434:.user-dropdown {  450:.user-dropdown-header {
459:.user-dropdown-avatar {  474:.user-dropdown-info {  481:.user-dropdown-name {
490:.user-dropdown-role {  498:.user-dropdown-item {  517:.user-dropdown-item:hover {
522:.user-dropdown-item.logout:hover {  527:.user-dropdown-divider {
```

Опциональный мок-обработчик тоже добавлен:
```
$ sed -n '882,886p' frontend_vue/src/services/mocks/index.ts
  if (path === '/api/auth/logout') {
    clearStoredMockUser()
    return delay(undefined as T)
  }
```

`useAuth.logout` принимает путь редиректа и в реальном режиме зовёт API:
```
222:  async function logout(redirectTo = '/'): Promise<void> {
223:    const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'
225:    if (USE_MOCKS) {  // Mock mode: just redirect, don't clear anything
227:      await router.push(redirectTo); return
232:      await apiPost('/api/auth/logout', {}, { headers: authHeaders() })
237:    clearSession()
238:    await router.push(redirectTo)
```

**Расхождение**

План (таблица «Behavior by Mode» и пункт 1) требует в мок-режиме `clearSession()` + редирект.
Код в мок-режиме сессию НЕ чистит — только редиректит, с комментарием «so the admin stays
accessible without login». Осознанное отступление, но не то, что написано в плане, поэтому
«частично», а не «сделано». Также пункт «Настройки» сделан кнопкой с `router.push`, а не
`<router-link>` — по существу то же.
