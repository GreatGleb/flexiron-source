# Phase 10 — Playwright E2E Tests for Clients Pages

## Контекст

Страницы Клиентов (CRM 3.2) полностью реализованы:

- **List:** [`ClientsListPage.vue`](frontend_vue/src/views/admin/clients/ClientsListPage.vue) — `/admin/clients`
- **Create:** [`ClientCreatePage.vue`](frontend_vue/src/views/admin/clients/ClientCreatePage.vue) — `/admin/clients/new`
- **Card:** [`ClientCardPage.vue`](frontend_vue/src/views/admin/clients/ClientCardPage.vue) — `/admin/clients/:id`

Все баги исправлены (8 CSS/i18n/import багов + 4 API-контракт бага). PRE-MANUAL-CHECK пройден.

## Что нужно сделать (Phase 10)

Выполни скилл `roo_code/skills/create-page.md` начиная с **Phase 10**.

### Step 10a — Audit страниц

Для каждой из 3 страниц составь список:
- Все visual sections (data-test)
- Все interactive elements (кнопки, фильтры, модалы)
- Все form inputs и их валидация
- Все API calls (мок-эндпоинты)
- Edge cases (empty list, API error, validation error, CONFLICT при удалении)

### Step 10b — Создать spec-файл

Создать: `frontend_vue/tests/e2e/admin/clients/clients.spec.ts`

**Import:** `import { test, expect } from '../../fixtures'`

**API route interception (beforeEach):**
```ts
test.beforeEach(async ({ page }) => {
  await page.route('**/api/clients/**', async (route) => {
    // intercept all client endpoints with mock data
  })
  await page.route('**/api/clients', async (route) => {
    // intercept GET list and POST
  })
})
```

**Test cases (минимум):**

1. **Load & no-crash** — `/admin/clients` loads without console errors
2. **Per-section snapshots** — header, filters, table, empty state
3. **DOM assertions** — all `data-test` sections visible
4. **Search filters list** — typing in search reduces results
5. **Status filter** — switching status filter updates table
6. **Pagination** — page buttons work (if > 25 clients)
7. **Create page loads** — `/admin/clients/new` renders form
8. **Create validation** — empty name shows error
9. **Create success** — fill form, save, redirect to card
10. **Card page loads** — `/admin/clients/CL-001` renders
11. **Card save** — edit field, save bar appears, save
12. **Card audit** — audit log table visible
13. **Delete modal** — click delete, modal opens, confirm
14. **i18n RU/EN/LT** — switch language, key text translates

### Step 10c — Registration

Добавить в:
- `tests/e2e/smoke.spec.ts` — `/admin/clients`
- `tests/e2e/navigation.spec.ts` — route `admin-clients`
- `tests/e2e/feature-flags.spec.ts` — flag `adminClients` OFF → /404
- `tests/e2e/helpers/flags.ts` — уже есть `adminClients: true`

### Step 10d — Run

```bash
cd frontend_vue && npx playwright test admin/clients
```

## Референсы для тестов

- [`tests/e2e/admin/suppliers/list.spec.ts`](frontend_vue/tests/e2e/admin/suppliers/list.spec.ts) — пример list-страницы
- [`tests/e2e/admin/suppliers/card.spec.ts`](frontend_vue/tests/e2e/admin/suppliers/card.spec.ts) — пример card-страницы

## Data-test аттрибуты

**ClientsListPage:**
- `page-clients`, `clients-header`, `clients-filters`, `clients-filter-search`, `clients-filter-status`
- `clients-table-panel`, `clients-table`, `clients-row`, `clients-row-actions`
- `clients-new-btn`, `clients-view-btn`, `clients-delete-btn`
- `clients-search-input`, `clients-pagination`, `clients-page-size`
- `clients-empty-state`, `clients-error-state`
- `clients-delete-modal`, `clients-delete-cancel`, `clients-delete-confirm`

**ClientCreatePage:**
- `client-create-page`, `client-create-title`, `client-create-header`
- `client-create-action-bar`, `client-create-cancel-btn`, `client-create-save-btn`
- `client-create-content`, `client-create-general`, `client-create-contact`, `client-create-status`
- `field-name`, `field-company-code`, `field-vat`, `field-address`, `field-phone`, `field-email`, `field-status`, `field-notes`

**ClientCardPage:**
- `client-card-page`, `client-card-header`, `client-card-save-bar`
- `client-card-general`, `client-card-contact`, `client-card-status`
- `client-card-status-pill`, `client-card-status-hint`
- `client-card-audit`, `client-card-audit-table`, `client-card-audit-row`
- `client-card-audit-delete-btn`, `client-card-error`
- `field-name`, `field-company-code`, `field-vat`, `field-address`, `field-phone`, `field-email`, `field-status`, `field-notes`
