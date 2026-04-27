---
name: migrate-page
description: Migrate an admin HTML page from demo/admin to Vue 3 component in frontend_vue
user_invocable: true
arguments:
  - name: page
    description: "Page name (e.g., dashboard, warehouse, sales, supply, staff, logistics, pl-report, deficit, suppliers-list, supplier-card, bcc-request, supplier-card-config)"
    required: true
---

# Migrate Admin Page to Vue

Migrate a single admin page from static HTML to a Vue 3 SFC.

## Steps

1. **Read source files** for the page `$ARGUMENTS`:

   - Compiled HTML: find matching file in `demo/admin/analytics/` or `demo/admin/suppliers/`
   - Panini source: find matching file in `demo/panini/pages/analytics/` or `demo/panini/pages/suppliers/`
   - Translations: find matching file in `demo/assets/js/lang/admin/` (e.g., `analytic_dashboard.js`, `suppliers_list.js`)
   - JS logic: check `demo/assets/js/admin/` for `*_logic.js` file
   - Page CSS: check `demo/assets/css/admin/` for page-specific CSS

2. **Read CLAUDE.md** at `frontend_vue/CLAUDE.md` for all patterns and rules.

3. **Read existing admin components** in `frontend_vue/src/components/admin/` to understand available components.

4. **Create the Vue page** at `frontend_vue/src/views/admin/analytics/` or `frontend_vue/src/views/admin/suppliers/`:

   - `<script setup lang="ts">` with:
     - `useI18n()` for translations
     - `useHead()` for SEO
     - Data composable (e.g., `useAnalytics('dashboard')`)
     - Feature flags via `useFeatureFlag()`
   - Template: convert Handlebars to Vue:
     - `{{> partial}}` → `<ComponentName />`
     - `data-i18n="key"` → `{{ t('pagePrefix.key') }}`
     - `{{#if}}` → `v-if`
     - `{{#each}}` → `v-for`
   - Import page-specific CSS if it exists

5. **Add translations** to `frontend_vue/src/i18n/admin.ts`:
   - Extract from the source translation file (all 3 languages: RU, EN, LT)
   - Use page name as prefix (e.g., `dashboard.kpi1_label`)
   - Escape `@` symbols: `name{'@'}company.com`

6. **Register route** in `frontend_vue/src/router/index.ts`:
   - Add to admin children routes
   - Lazy-load: `() => import('@/views/admin/...')`
   - Add feature flag guard if needed

7. **Verify**:
   - Run `npm run typecheck` in `frontend_vue/`
   - Run `npm run lint` in `frontend_vue/`
   - Report any errors found

## Rules

- Follow ALL patterns from `frontend_vue/CLAUDE.md`
- Never use Options API — only `<script setup lang="ts">`
- Never use `data-i18n` — use `{{ t('key') }}`
- Never use `<a href>` — use `<router-link>`
- Never copy CSS — import from `@assets`
- Use existing shared components, don't recreate them
