---
name: vue-rules
description: Vue 3 + Vite specific rules and pitfalls for frontend_vue. Trigger on: adding `:class` bindings, writing/editing mocks, building editable forms with Save, adding new pages/components, refactoring existing pages, new endpoint callers, before committing Vue changes, when strange CSS/reactivity bugs appear, when choosing HTTP method for new endpoint.
user_invocable: true
---

# Vue Rules — Flexiron Enterprise Frontend

Rules collected from real bugs during `demo/` → `frontend_vue/` migration. Each rule = lesson learned, not theory.

---

## Working Principles

- **Thoroughness over speed.** Before completing a task — Grep all callers related to the change (router-link, event names, class names, props). "Skimming" already caused bugs.
- **Verify against original in details.** Before implementing logic from `demo/admin/*.html` or `demo/assets/js/admin/*.js` — read the original entirely, don't rely on memory.
- **Phase verification ≠ only typecheck+lint.** Static analysis doesn't catch: missing components, wrong string literals (route names, i18n keys), visual regressions, outdated **specs in `toDo/admin-api-contract.md`** and meta-pages (ScreensPage, README). Final check = plan→files→typecheck→lint→contract sync→browser.
- **NEVER use `git restore` or `git checkout` on tracked files.** These commands permanently destroy uncommitted changes in the working tree. If a file needs to be reverted to its committed state for any reason, use `git show HEAD:<path>` to read the committed version, then manually apply only the needed parts. If uncommitted changes were accidentally destroyed, stop immediately and use `git reflog` + `git show` to attempt recovery before any further writes.

---

## Save UX — Clean-slate (default) vs Quick-actions

**Default — clean-slate** for editable forms/configs: all mutations in local Vue reactive state, **server doesn't know until Save click**. Page reload = rollback to server state. No autosave / per-keystroke sync.

**Applies to:**
- `SupplierCardPage` — Save sends PATCH **with delta only** via `useDirtyCheck.diff()`
- `SupplierCardConfigPage` — Save → 3 PUT parallel: `/api/config/fields`, `/api/config/sections`, `/api/config/permissions`. All ops (create/delete field/section, rename, hide) — **local**, not immediate POST/DELETE.

**Quick-action exceptions** — applied on server immediately:
- Drag-drop status in Kanban → `PATCH /suppliers/:id/status`
- Accept Response / No Response in BCC history → `POST /bcc/events/:id/...`
- BCC Send / Log → `POST /bcc/send` / `/bcc/log`
- Audit entry delete (with confirm modal) → `DELETE /suppliers/:id/audit/:idx`
- File upload on drag-drop → `POST /uploads` (detached fileId, binding via save)

**Before writing save logic — ask user:** "Quick-action (immediate) or Save-batch (clean-slate)?" Default — **clean-slate if editable form**.

---

## HTTP Methods

- **PATCH (RFC 7396 merge)** — update single entity with delta. Currently: `/suppliers/:id`, `/suppliers/:id/status`, `/config/sections/:id`, `/config/fields/:id`
- **PUT** — bulk replace collections when atomic consistency needed. Currently: `/config/sections`, `/config/fields`, `/config/permissions` (all three parallel on Save)
- **POST** — create + necessary actions (BCC send/log, accept response, etc.)
- **DELETE** — targeted deletion (audit entry, custom field, section)

**Idempotency-Key header** on irreversible POST (`/bcc/send`, `/bcc/log`) — generated via `newIdempotencyKey()` from `services/api.ts`, server cache 24h.

**Files** — separate `POST /api/uploads` (multipart) immediately on drag-drop → `returns { fileId, name, size, mime, url }`. Save operation sends array `fileIds: string[]`. Never **send** binary data inside JSON card payload.

---

## Contract-first (new endpoint / page refactoring)

Lesson learned: adding `SupplierCreatePage` with `SupplierCardPage` refactoring (extract `SupplierFormSections`) — missed (a) updating `toDo/admin-api-contract.md` ("UI component — separate iteration" remained after implementation), (b) syncing client validation with contract (validate checked only `company`, contract required `company + email`, server would reject with 422). Typecheck+lint doesn't catch this.

**Rule: contract read → code → contract write-back.**

**Read-first** — before writing composable/service/validate for endpoint:
- Read corresponding section of `toDo/admin-api-contract.md` (search by endpoint path)
- Required fields, response shape, save pattern (clean-slate vs quick-action), idempotency, error codes — taken **from there**, not from UX intuition. Client validation ≥ server validation (never weaker).

**Write-back** — after implementing endpoint UI, update contract:
- Remove `"TBD"`, `"UI — separate iteration"`, `"future endpoint"` markers for this endpoint
- Write specific `Page.vue`, composable, route — so contract has actual reference
- If contract references non-existent endpoints/files — remove (contract is not a roadmap)

**Refactor checklist** (task = new page + extract shared component from existing):
1. Grep all callers of removed/renamed exports (services, composables, components) — including **template usage**, which TypeScript doesn't always catch
2. In old page: remove unused `import`s and utility functions after extraction
3. Update `toDo/admin-api-contract.md` if endpoint signature changed
4. If route structure changes — check `ScreensPage.vue`, CLAUDE.md (architecture path), README
5. Done ≠ typecheck+lint. Done = (1-4) + pitfalls #1-#28 + contract sync + browser walk-through golden path

**Trigger moment**: as soon as I notice task = "new page + extract from old" / "new endpoint caller" — **immediately** read contract **before** plan, not after.

---

## Pitfalls (complete list)

### 1. `@` in translations breaks vue-i18n
`name@company.com` → `SyntaxError: Invalid linked format`. **Fix:** escape `name{'@'}company.com`.

### 2. `#app` wrapper breaks flex-layout
Public CSS expects `body { display: flex; flex-direction: column }`. Vue wraps in `<div id="app">`. **Fix:** `#app { display: flex; flex-direction: column; min-height: 100vh }` in App.vue.

### 3. `html { overflow: hidden }` from erp-base.css cuts long pages
For public pages with register form. **Fix:** `html { height: auto !important; overflow: visible !important }` in App.vue.

### 4. Vite blocks files outside root (403)
CSS from `demo/assets/` references `url("../images/...")`. **Fix:** `server.fs.allow` in `vite.config.js` must include `demo/assets`.

### 5. Content behind bg-overlay invisible
App.vue renders `.bg-image` (z-index: 0) and `.bg-overlay` (z-index: 1). **Fix:** content without `.container` (which already has z-index 10) must set `position: relative; z-index: 10+`.

### 6. `taskkill //F //IM node.exe` kills Claude Code
Don't use mass kill. Stop dev-server by PID or Ctrl+C.

### 7. `public.css` loads globally and breaks admin styles
E.g. `.lang-switcher { position: absolute }` — breaks flex topbar. **Fix:** `.shell .lang-switcher { position: static }` in AdminLayout.

### 8. `bg-image` / `bg-overlay` needed for ALL routes
Glass effect (`backdrop-filter: blur`) on sidebar/topbar works only when background is visible. **Don't** hide via `v-if` for admin.

### 9. HTML comments in `<template>` go to DOM
`<!-- X -->` renders as DOM comment node, especially pollutes inside `<svg>`. **Fix:** comments — only in `<script>`.

### 10. Wrong route names
`<router-link :to="{ name: 'X' }">` silently fails if `X` not in router. **Fix:** before using — verify against `src/router/index.ts`. TypeScript doesn't catch this.

### 11. Typecheck + lint ≠ full phase verification
Static analysis doesn't catch: missing components, wrong string literals, visual regressions. **Fix:** checklist plan→files→typecheck→lint→browser. Don't declare phase done after only typecheck.

### 12. Generic class names break local styles
`.hidden { display: none !important }` in `suppliers_list.css` — global. When using `:class="{ hidden }"` locally — global display:none overrides local opacity/dashed. **Fix:** for state modifiers — BEM-style: `.is-hidden`, `.is-active`, `.has-error`. Before `:class="{ X }"` → `grep -rn "^\.X" demo/assets/css/` to confirm name is free.

### 13. Mock returns direct array reference
`mockGetX()` returns `STORE` directly → `composable.value === STORE`. Any mutation in mock reflects in reactive ref **without emit**. If view additionally does `.push()` — double item. **Fix:** all `mockGetX()` return `structuredClone(STORE)`. Mutations work on STORE, reads — on clones. Simulates REST where client/server are isolated.

### 14. One UI component across page — no mix native + custom
Mix of native `<select>` and `CustomSelect` on same page → different hover/focus, user sees inconsistency. **Fix:** if CustomSelect dominates — use it everywhere including modals. Native HTML — only when no custom alternative exists.

### 15. Playwright tests must not depend on specific mock data
**Problem:** test searching for `'metal'` or expecting `.toHaveCount(1)` on specific name — fails on any STORE change. When switching to real API, mock data won't be used at all.

**Rules for Playwright tests:**

**Language — always English.** `tests/e2e/fixtures.ts` sets `flexiron_lang: 'en'` in `addInitScript` before page load. All specs (except `i18n.spec.ts`) import `test` from `fixtures.ts`, not from `@playwright/test`.

**Mock data — only English.** All values in mock STORE (category names, field names, enum options, descriptions) must be in English.

**Don't hardcode specific data in tests.** Instead of `fill('metal')` + `toHaveCount(1)` — read value dynamically:
```ts
// BAD — fails when mock changes
await input.fill('metal')
await expect(rows).toHaveCount(1)

// GOOD — data-independent
const firstName = (await rows.first().locator('td').first().textContent())!.trim().split(' ')[0]!
await input.fill(firstName)
const after = await rows.count()
expect(after).toBeGreaterThan(0)
expect(after).toBeLessThan(totalBefore)
```

**Relative count-assertions instead of absolute:**
```ts
// BAD
await expect(rows).toHaveCount(6)

// GOOD
const before = await rows.count()
await doSomething()
await expect(rows).toHaveCount(before + 1)
```

**For API-ready tests — `page.route()`.** When test checks behavior with specific data (e.g. 409 error on delete), use interception:
```ts
await page.route('**/api/categories/*', (route) => {
  route.fulfill({ status: 409, json: { code: 'CATEGORY_HAS_PRODUCTS' } })
})
```
This works identically with mock layer and real API.

**`fixtures.ts` — single entry point.** All specs import `{ test, expect }` from `../../fixtures` (or relative path), except `feature-flags.spec.ts` and `i18n.spec.ts`.

### 16. Component must import its own CSS styles

Can't rely on another component on the same page loading needed classes. If `ComponentA` uses class `.foo` from `_foo.css` but doesn't import it — styles work only accidentally when `ComponentB` (which imports `_foo.css`) is on the same page.

**Example:** `SearchInput.vue` used class `checkbox-list-search` from `_checkbox-list.css` without import. On page with `CheckboxList` everything worked. On page without it — icon overflowed the field.

**Fix:** each Vue component imports its own CSS file explicitly in `<script setup>`:
```ts
import '@styles/admin/components/_my-component.css'
```

### 17. SvgIcon — verify icon name before use

Before `<SvgIcon name="X">` — grep `SvgIcon.vue` to confirm name exists. TypeScript doesn't catch wrong string. Error examples: `name="edit"` (doesn't exist → `name="edit-pencil"`), `name="folder"` and `name="trash"` weren't defined until manually added.

**Fix:** `grep -n '"X"' src/components/admin/SvgIcon.vue` before each new name.

### 18. Save bar and modal — different i18n keys for "Cancel"

Button in **save bar** (cancel unsaved changes) → key `btn_discard_changes` → "Discard changes".  
Button **closing modal** (cancel without action) → key `btn_discard` → "Cancel".

Never use `btn_discard` in save bar — user won't understand what's being cancelled.

### 19. Search/filters — inside same GlassPanel as table

`glass-input` has background `rgba(255,255,255,0.05)` — nearly invisible on dark page background outside GlassPanel. Inside GlassPanel `backdrop-filter + background` create additional layer — field looks noticeably lighter and clearer.

**Rule:** search/filters related to a specific table — **always inside the same `GlassPanel`** before table content.

### 20. Filter watcher + GlassPanel — mandatory `initialized` flag

`watch(filters, load)` + search inside `panel-body` = each keystroke → `loading=true` → `.glass-panel.loading .panel-body { display:none }` → search field hides + browser loses focus. After load, field reappears but focus is lost.

**Fix:** skeleton only on **first** load; filter reloads — silent:
```ts
let initialized = false

async function load() {
  if (!initialized) loading.value = true  // skeleton only first time
  try {
    const res = await getItems(filters)
    items.value = res.items
    initialized = true
  } finally {
    loading.value = false
  }
}
```

Applies to: any composable with `watch(filters, load)` where search is inside GlassPanel.

### 21. Sidebar — only section entry points

Sidebar has one link per **section** (`/admin/products`), not each sub-page. All child pages navigate via links within the section.

**How to do internal links:**
```html
<!-- in section page header -->
<div class="entity-action-bar no-margin pos-static">
  <router-link :to="{ name: 'admin-categories' }" class="btn btn-secondary">
    <SvgIcon name="folder" :width="18" :height="18" />
    <span>{{ t('categories.title') }}</span>
  </router-link>
</div>
```

Violation example: "Categories" as separate sidebar item, though it's a page within "Products" section.

### 22. Update snapshot baseline immediately after UI changes

After any change affecting an element with snapshot test (CSS margin/padding/color, button text, added/removed element) — **immediately update baseline**:
```bash
npx playwright test [spec] -g "[test-name]" --update-snapshots --workers=1
```
Then open updated PNG in `tests/e2e/...-snapshots/` and visually verify baseline is correct. Don't accumulate "broken" snapshots — they hide real regressions.

### 23. AppModal + Teleport: fall-through attributes don't land

`AppModal` uses `<Teleport to="body">` as root. `data-test="modal-*"` on component becomes fall-through attribute, but Teleport isn't a DOM element — attribute disappears. All E2E tests of modals fail with 0 elements.

**Already fixed in AppModal.vue** (`inheritAttrs: false` + `v-bind="$attrs"` on `.modal-overlay`). But if creating **new** component with `<Teleport>` as root — same fix:
```ts
defineOptions({ inheritAttrs: false })
```
```html
<div v-bind="$attrs" class="modal-overlay" ...>  <!-- data-test lands here -->
```

### 24. CustomSelect — only `string` in v-model, not `string | null`

`CustomSelect` expects `modelValue: string` and `SelectOption.value: string`. Fields with type `string | null` are incompatible — TypeScript error + "All" option with `value: null` never matches.

**Fix:** computed adapter `null ↔ ''` for each nullable field:
```ts
const categoryStr = computed({
  get: () => filters.categoryId ?? '',
  set: (v: string) => { filters.categoryId = v || null },
})
```
"All/empty" option in options: `{ value: '', label: t('...all') }` — empty string, not `null`.

### 25. `v-model.number` sets NaN on clear — needs watcher-normalizer

`v-model.number` calls `parseFloat("")` → NaN on empty field. `JSON.stringify(NaN) === "null"` — `useDirtyCheck` doesn't notice change if original was null (ok). But if original was `15.5` → diff sends `{ price: NaN }` → mock saves NaN to STORE.

**Fix:** watcher-normalizer immediately after `useDirtyCheck(form)`:
```ts
watch(form, (val) => {
  if (Number.isNaN(val.price as unknown)) form.value.price = null
  if (Number.isNaN(val.minStock as unknown)) form.value.minStock = null
}, { deep: true })
```

Apply for **each** nullable number field in card.

### 26. `DropZone` — not v-model component, requires `hint` prop

`DropZone` has no `modelValue` — `v-model` silently ignored. `hint: string` — required prop (runtime warning without it).

**Correct pattern:**
```html
<DropZone
  hint="PDF / image"
  @uploaded="(files) => (fieldValues[id] = files[0]?.fileId ?? null)"
/>
```

`@uploaded` emits `UploadedFile[]`. No v-model, no modelValue.

### 27. CSS button classes — `btn-ghost` doesn't exist

In `_buttons.css` only: `btn-primary`, `btn-secondary`, `btn-danger`. Class `btn-ghost` **doesn't exist** — button renders without styles.

Back button in card → `<router-link class="btn btn-secondary">` with named route to list. Not `<button @click="router.back()">` — unreliable if opened via direct link.

### 28. Data table rows — standard row design

Reference: `ProductsPage.vue` + `products_list.css`. All new tables must exactly reproduce this pattern.

**Row HTML:**
```vue
<tr
  v-for="item in items"
  :key="item.id"
  class="[domain]-row"
  data-test="[domain]-row"
>
  <td>
    <router-link
      :to="{ name: 'admin-[domain]-card', params: { id: item.id } }"
      class="name-link"
    >
      {{ tf(item.name) }}
    </router-link>
  </td>          <!-- first column — always brighter, name-link for navigation -->
  <!-- secondary columns -->
  <td>
    <div class="[domain]-row-actions">
      <router-link
        v-tooltip="t('tooltip.view_details')"
        :to="{ name: 'admin-[domain]-card', params: { id: item.id } }"
        class="action-icon-btn action-edit"
        data-test="[domain]-view-btn"
        @click.stop
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </router-link>
      <button
        v-tooltip="t('[domain].btn_delete')"
        class="action-icon-btn action-danger"
        data-test="[domain]-delete-btn"
        @click.stop="openDeleteModal(item.id)"
      >
        <SvgIcon name="trash" :width="16" :height="16" />
      </button>
    </div>
  </td>
</tr>
```

**CSS in `[domain]_list.css` — required rules:**
```css
.[domain]-row td { transition: background 0.15s, color 0.15s; }
.[domain]-row td:first-child { font-weight: 500; color: rgba(255, 255, 255, 0.85); }
.[domain]-row:hover td:first-child { color: #fff; }
.[domain]-row-actions { display: flex; gap: 8px; justify-content: flex-end; }
.name-link {
  color: inherit;
  text-decoration: none;
  transition: text-decoration-color 0.2s ease;
  text-decoration-line: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
}
.name-link:hover {
  text-decoration-color: currentColor;
}
```

**Base `.data-table` styles** (erp-base.css, global — don't duplicate):
- `th`: `font-size: 0.75rem`, uppercase, `letter-spacing: 0.05em`, `color: rgba(255,255,255,0.35)`
- `td`: `font-size: 0.85rem`, `color: var(--text-dim)`, `height: 40px`
- `tr:hover td`: `background: rgba(24,144,255,0.06); color: #fff`
- separator: `border-bottom: 1px solid rgba(255,255,255,0.05)`

**Forbidden:**
- `:title` on action buttons → only `v-tooltip`
- `display: none` on disabled pagination buttons → `:disabled` + `:style="{ display: totalPages <= 1 ? 'none' : 'flex' }"`
- mixing button styles: view = inline eye SVG, delete = `<SvgIcon name="trash">`

If row is not clickable (no card) — remove `cursor: pointer` and `@click` on `<tr>`.

### 29. Responsive page headers — mandatory breakpoints

Every flex page header (`display: flex; justify-content: space-between`) must have responsive breakpoints:
```css
@media (max-width: 992px) { .page-header { gap: 12px; } }
@media (max-width: 600px) { .page-header { flex-direction: column; align-items: stretch; } .page-header .btn { width: 100%; justify-content: center; } }
```

### 30. Empty state — must not flash during loading

Empty state condition: `v-if="!loading && items.length === 0"` — not just `v-if="items.length === 0"`. Otherwise empty state flashes during initial load while `loading=true` but `items=[]`.

### 31. Delete button inside clickable row — must use @click.stop

When a row is clickable (navigates to card) AND has a delete button inside it:
```vue
<tr @click="router.push(...)">
  <td>...</td>
  <td>
    <button @click.stop="deleteItem(item.id)">  <!-- @click.stop is MANDATORY -->
      Delete
    </button>
  </td>
</tr>
```
Without `@click.stop`, clicking delete also triggers row navigation.

### 32. Navigation links — always router-link, never <a href>

All internal navigation: `<router-link :to="{ name: 'exact-route-name' }">` — never `<a href>`. TypeScript doesn't catch wrong route names (pitfall #10), but `<a href>` causes full page reload and loses Vue state.

### 33. Mock data — English only, never Russian

All values in mock STORE (names, descriptions, enum options) must be in English. Russian strings cause tests to break when mock data changes, since tests always run with English locale (`fixtures.ts` sets `flexiron_lang: 'en'`).

### 34. `resolveLabel()` / `labelLookup` — deleted, use `TranslatedString` + `tf()`

The old `resolveLabel()` function and `labelLookup.ts` auto-generated mapping are **deleted**. They are dead code — not imported by any component.

**Fix:** For data coming from API/mocks (product names, category names, field labels, enum options) — use `TranslatedString` type (`{ ru, en, lt }`) and render via `tf()` from `useTranslatedData.ts`:
```ts
const { tf } = useTranslatedData()
// In template: {{ tf(item.name) }}
```

For form inputs that need to edit a `TranslatedString` — use `mergeLocaleValue()` / `toTranslatedString()` from `@/types/i18n`.

### 35. Editing the wrong admin translation file

The old monolithic `src/i18n/admin.ts` is **deleted** — replaced by domain-split files in `src/i18n/admin/`.

**Fix:** All new admin translations go in `src/i18n/admin/[domain].ts`:
- `layout.ts` — sidebar, header
- `dashboard.ts` — dashboard page
- `products.ts` — products page + data translations
- `categories.ts` — categories page
- `suppliers.ts` — suppliers pages
- `bcc.ts` — BCC request page
- `cardConfig.ts` — supplier card config
- `analytics.ts` — analytics sub-pages
- `common.ts` — shared translations (loading, errors, buttons)

Each file exports a single object with `ru`, `en`, `lt` keys. Never edit `admin.ts` — it doesn't exist.

### 🔥 #36 — structuredClone crashes on Vue reactive proxies

**Симптом:** `structuredClone` throws `DOMException: Failed to execute 'structuredClone' on 'Window'` when Vue reactive/ref objects are passed. This happens in `watch({ deep: true })` which internally calls `structuredClone` on old values.

**Причина:** Vue 3's `reactive()`/`ref()` create Proxy objects. `structuredClone` cannot clone Proxies. Three trigger patterns: (a) ref changes value type (string→object), (b) deep mutation of reactive properties, (c) `watch` with `deep: true` snapshotting old values.

**Решение:**
- Store `TranslatedString | null` (never `'' as unknown as TranslatedString`)
- Use `computed` get/set instead of inline `@input` for TranslatedString fields
- Replace entire objects instead of mutating individual fields
- Use `toRaw()` for dirty check snapshots
- Prefer `watchEffect` over `watch({ deep: true })` when working with reactive proxies

### 🔥 #37 — watch getter + toRaw() breaks dependency tracking

**Симптом:** Dirty check watch never fires after wrapping with `toRaw()` inside a watch getter.

**Причина:** `watch(() => JSON.parse(JSON.stringify(toRaw(source.value))), ...)` — `toRaw()` extracts the raw object, so Vue loses visibility into nested property changes. The watch getter returns a static snapshot, not a reactive reference.

**Решение:** Replace `watch` with `watchEffect` — it doesn't call `structuredClone` on proxies, and inside the effect `source.value` is tracked first, then `toRaw()` extracts the raw object for serialization:
```ts
// ❌ Bad: watch getter + toRaw()
watch(() => JSON.parse(JSON.stringify(toRaw(source.value))), (newVal) => { ... })

// ✅ Good: watchEffect
watchEffect(() => {
  const raw = JSON.parse(JSON.stringify(toRaw(source.value)))
  // use raw for dirty check
})
```

### 🔥 #38 — toTranslatedString() zeroes out other locales

**Симптом:** When user types in one locale and switches language, other locales lose their translations.

**Причина:** `toTranslatedString(value, locale)` creates `{ ru: '', en: 'Hello', lt: '' }` — only one locale filled. Correct for API calls (server handles other locales), but incorrect for UI updates. When used in computed setters, it overwrites the entire object.

**Решение:** Use `mergeTranslatedString(existing, value, locale)` instead of `toTranslatedString()` for all UI update locations (computed setters, form inputs). This function preserves existing translations for other locales:
```ts
// ❌ Bad: toTranslatedString() in computed setter
set(val) { model.value.name = toTranslatedString(val, locale.value) }

// ✅ Good: mergeTranslatedString() in computed setter
set(val) { model.value.name = mergeTranslatedString(model.value.name, val, locale.value) }
```

### 🔥 #39 — TranslatedString renders as [object Object]

**Симптом:** In templates, `{{ item.name }}` renders as `[object Object]` instead of the translated text.

**Причина:** After single-locale refactoring, `TranslatedString` objects have only one language filled (e.g., `{ ru: 'Привет', en: '', lt: '' }`). Previously all 3 locales had the same value, so `{{ }}` sometimes worked accidentally. Now Vue calls `.toString()` on the object.

**Решение:** Always wrap TranslatedString values with `tf()` in templates:
```vue
<!-- ❌ Bad: renders [object Object] -->
{{ item.name }}

<!-- ✅ Good: renders translated text -->
{{ tf(item.name) }}
```
Also use computed get/set for form fields instead of direct v-model on TranslatedString properties.

### 🔥 #40 — Missing /translated mock routes

**Симптом:** Composables call `/api/*/translated` endpoints, but mock router only handles non-translated paths. Error: `[mock] GET ... not found`. Items remain `undefined` → `Cannot read properties of undefined (reading 'items')`.

**Причина:** After single-locale refactoring, composables were updated to call `/translated` endpoints, but the mock router in tests was not updated with corresponding routes.

**Решение:** Always register both `/api/domain` and `/api/domain/translated` routes in mock handlers. The translated route should delegate to the same mock function:
```ts
// Register both routes
httpMock.get('/api/categories', getCategories)
httpMock.get('/api/categories/translated', getCategories) // same handler
```

### 🔥 #41 — tf() has no null guard

**Симптом:** `tf()` crashes on `null`/`undefined` fields with `Cannot read properties of null (reading 'ru')`.

**Причина:** The `tf()` function assumes the input is always a valid `TranslatedString` object. After refactoring, some fields may be `null` or `undefined` (e.g., when API returns incomplete data).

**Решение:** Add null guard to `tf()`:
```ts
function tf(field: TranslatedString | null | undefined): string {
  if (!field) return ''
  return field[locale.value] || field.en || ''
}
```
Also add null-safe checks in templates:
```vue
{{ item.name ? tf(item.name) : '—' }}
```

### 🔥 #42 — Verify /translated endpoint necessity after refactoring

**Симптом:** After backend refactoring, some `/translated` endpoints may no longer be needed because the backend now handles translation internally. Calling a non-existent `/translated` endpoint returns 404.

**Причина:** During refactoring, the backend was updated to return translated data from the base endpoint. The frontend wasn't updated to match.

**Решение:** After any backend refactoring, verify which endpoints still need `/translated` suffix. If backend returns translated data from `/api/domain`, use that directly instead of `/api/domain/translated`.

### 🔥 #43 — Never use generic text loading states

**Симптом:** Pages show `<div class="loading-state">{{ t('common.loading') }}</div>` — a plain text "Loading..." that causes layout shift and poor UX.

**Причина:** Developers use generic text placeholders instead of skeleton layouts that mirror the actual page structure.

**Решение:** Always use skeleton loading states that match the page layout:
```vue
<!-- ❌ Bad: text loading -->
<div v-if="loading">Loading...</div>

<!-- ✅ Good: skeleton loading -->
<div v-if="loading" class="kpi-skeleton">
  <div class="skeleton-icon" />
  <div class="skeleton-label" />
  <div class="skeleton-value" />
  <div class="skeleton-delta" />
</div>
```
Use `<GlassPanel :loading="true" :skeleton-rows="5" />` for card/panel skeletons.

### 🔥 #44 — Hierarchical paths in selectors

**Симптом:** Category filter dropdown shows only the short name (e.g., "Steel") instead of the full hierarchical path (e.g., "Materials → Metals → Steel"), making it impossible to distinguish categories with same names in different branches.

**Причина:** Selector options use `item.name` directly without computing the full path from root to leaf.

**Решение:** Create a `getCategoryPath(categoryId, categories)` function that traverses the tree and returns the full path string. Use this for display in selectors, breadcrumbs, and filters.

### 🔥 #45 — Comprehensive mock data for domain-specific fields

**Симптом:** Category card shows empty or placeholder fields for domain-specific categories (e.g., metal categories missing weight per meter, tensile strength, GOST standards).

**Причина:** Mock data only includes generic fields. Domain-specific categories need industry-standard fields that match real-world usage.

**Решение:** When creating mock data for domain entities, research and include all industry-standard fields. For metal categories: weight per meter, tensile strength, yield strength, GOST/EN standards, surface treatment options. For each domain, maintain a comprehensive mock dataset that exercises all field types.

### 🔥 #46 — Contextual section titles

**Симптом:** Dynamic Fields section shows a static title like "Dynamic Fields" instead of "Dynamic Fields for Materials → Metals → Steel".

**Причина:** Section titles are hardcoded strings instead of using i18n with dynamic parameters.

**Решение:** Use i18n with interpolation for contextual titles:
```ts
t('categories.dynamicFieldsTitle', { path: getCategoryPath(category.id) })
```
Always consider whether a section title should reflect its context (parent entity, current selection, etc.).

### 🔥 #47 — Run typecheck after every code change

**Симптом:** TypeScript errors appear only at build time, not during development. Changes that break types go unnoticed until CI fails.

**Причина:** Developers forget to run `npx vue-tsc --noEmit` after making changes. The IDE may not catch all type errors, especially with complex generics or Vue template types.

**Решение:** After every prompt/code change, run `npx vue-tsc --noEmit` to verify types. Add this as a mandatory step in the development workflow. If the project has a `typecheck` script in package.json, use that.

### 🔥 #48 — Feature flag registration in all 3 required files

**Симптом:** Feature flag works in development but not in production, or vice versa. The flag is missing from one environment.

**Причина:** Feature flags must be registered in 3 places: (1) feature flag config file, (2) type definitions, (3) the feature flag composable/store. Missing any one causes inconsistent behavior.

**Решение:** When adding a new feature flag, always register it in all 3 locations. Create a checklist:
```ts
// 1. config/featureFlags.ts — add to FEATURE_FLAGS object
// 2. types/features.ts — add to FeatureFlag type
// 3. composables/useFeatureFlag.ts — add default value
```

### 🔥 #49 — readonly `<input>` in Vue — use `:value` + `@input`

**Симптом:** An `<input readonly>` field does not update when the underlying data changes. The user sees stale data.

**Причина:** In Vue, `readonly` attribute on `<input>` prevents the input from emitting input events. With `v-model`, this means the binding becomes one-way and breaks reactivity.

**Решение:** Use `:value` binding with a no-op `@input` handler instead of `readonly`:
```vue
<!-- ❌ Bad: readonly with v-model -->
<input v-model="item.name" readonly />

<!-- ✅ Good: :value without v-model -->
<input :value="tf(item.name)" @input="() => {}" readonly />
```

### 🔥 #50 — Normalize empty strings to null before save

**Симптом:** Empty string fields are saved as `""` instead of `null`, causing API validation errors or inconsistent data.

**Причина:** Form inputs default to empty string. When the user clears a field, it becomes `""` but the API expects `null` for empty optional fields.

**Решение:** Before saving, normalize all empty strings to `null`:
```ts
function normalizeEmptyStrings(obj: Record<string, any>): Record<string, any> {
  const result = { ...obj }
  for (const key in result) {
    if (result[key] === '') result[key] = null
  }
  return result
}
```

### 🔥 #51 — GlassPanel :title propagation

**Симптом:** A `:title` attribute on `<GlassPanel>` does not appear as a tooltip on the rendered panel.

**Причина:** `GlassPanel` is a custom component, not a native HTML element. Vue does not automatically pass `:title` (or any attribute) to the root element unless the component uses `inheritAttrs: false` or explicitly binds `$attrs`.

**Решение:** Ensure custom wrapper components pass `:title` (and other attributes) to their root element:
```vue
<!-- In GlassPanel.vue -->
<div class="glass-panel" :title="$attrs.title">
  <slot />
</div>
```

### 🔥 #52 — Empty state belongs inside the card, not at page level

**Симптом:** When a list is empty, the "No data" message appears outside the card/panel, breaking the visual layout.

**Причина:** The `.empty-state` component is placed at the page level instead of inside the data container (card, table, panel).

**Решение:** Always place `.empty-state` inside the card/panel that would contain the data:
```vue
<!-- ❌ Bad: empty state at page level -->
<PageLayout>
  <EmptyState />  <!-- outside card -->
  <DataCard>
    <Table v-if="items.length" />
  </DataCard>
</PageLayout>

<!-- ✅ Good: empty state inside card -->
<PageLayout>
  <DataCard>
    <Table v-if="items.length" />
    <EmptyState v-else />  <!-- inside card -->
  </DataCard>
</PageLayout>
```

### 🔥 #53 — Breadcrumbs must update reactively on route change

**Симптом:** Breadcrumbs show stale path after navigating between items (e.g., from Product A to Product B).

**Причина:** Breadcrumb data is computed once on mount and not watched for route param changes.

**Решение:** Use `watch` on route params or make breadcrumbs a computed property that depends on reactive route data:
```ts
const breadcrumbs = computed(() => [
  { label: 'Products', to: '/admin/products' },
  { label: product.value?.name || 'New Product', to: '' }
])
```

### 🔥 #54 — useHead title must be reactive

**Симптом:** Page title does not update when the data changes (e.g., product name loads after the page mounts).

**Причина:** `useHead({ title: ... })` is called with a static value or a computed that doesn't track the right dependencies.

**Решение:** Always use a `computed` for dynamic titles in `useHead`:
```ts
// ❌ Bad: static title
useHead({ title: 'Product: ' + route.params.id })

// ✅ Good: computed title
const pageTitle = computed(() => product.value?.name || 'Loading...')
useHead({ title: () => pageTitle.value })
```

### 🔥 #55 — Save bar must be visible on any change, not just focus

**Симптом:** User makes changes to a form field but the Save/Cancel bar does not appear until they click elsewhere.

**Причина:** The dirty check is triggered only on `@blur` or `@focusout` events, not on `@input` or `@change`.

**Решение:** Trigger dirty check on every input change, not just blur:
```vue
<!-- ❌ Bad: only on blur -->
<input @blur="markDirty" />

<!-- ✅ Good: on every input -->
<input @input="markDirty" @blur="markDirty" />
```

### 🔥 #56 — DatePicker locale reactivity

**Симптом:** DatePicker shows wrong date format or month names after switching the app language.

**Причина:** DatePicker initializes with the current locale on mount but does not watch for locale changes.

**Решение:** Add a watcher for locale changes that re-initializes or re-renders the DatePicker:
```ts
watch(locale, () => {
  // re-initialize date picker with new locale
  datePicker.updateLocale(locale.value)
})
```

### 🔥 #57 — Pagination reset on filter change

**Симптом:** User applies a filter and the table shows page 1, but the pagination component still shows "Page 3 of 10".

**Причина:** Pagination page is not reset to 1 when filters change. The current page index persists from the previous query.

**Решение:** Watch filter changes and reset pagination to page 1:
```ts
watch([filter1, filter2], () => {
  currentPage.value = 1
})
```

### 🔥 #58 — URL query params sync with filters

**Симптом:** After applying filters and refreshing the page, all filters are reset to defaults.

**Причина:** Filter state is stored only in component memory, not synced with URL query parameters.

**Решение:** Sync filter values with URL query params using the router:
```ts
// On filter change
router.replace({ query: { ...route.query, status: filter.value } })

// On mount — read filters from URL
onMounted(() => {
  if (route.query.status) filter.value = route.query.status
})
```

### 🔥 #59 — Sorting breaks after pagination

**Симптом:** After navigating to page 2, clicking a column header to sort returns to page 1 with sorted data, losing the current page.

**Причина:** Sort change handler does not reset pagination, or pagination state is not preserved during sort.

**Решение:** When sort changes, reset to page 1 and re-fetch data:
```ts
function onSortChange(sortField: string) {
  currentSort.value = sortField
  currentPage.value = 1
  fetchData()
}
```

### 🔥 #60 — CSS consistency between list pages

**Симптом:** Two list pages (e.g., Products List and Categories List) have different spacing, font sizes, or colors for the same UI elements.

**Причина:** CSS values are hardcoded per component instead of using shared CSS variables or a design token system.

**Решение:** Use CSS custom properties (variables) for all shared values:
```css
/* ❌ Bad: hardcoded values */
.product-list { padding: 16px; }
.category-list { padding: 20px; }

/* ✅ Good: CSS variables */
:root {
  --list-padding: 16px;
  --list-gap: 8px;
}
.product-list, .category-list { padding: var(--list-padding); }
```

### 🔥 #61 — Check for existing components before creating new ones

**Симптом:** A new component is created that duplicates functionality of an existing component (e.g., two different search input components).

**Причина:** Developer does not check the existing component library before creating a new component.

**Решение:** Before creating any new component, search the codebase for existing components that might serve the same purpose. Check:
- `src/components/` for shared components
- `src/components/admin/ui/` for UI primitives
- Existing page implementations for similar patterns

---

## Applying this skill

When starting a task from trigger list (see description above) — **read this skill completely** before writing code. If task not from list — `Read` only the needed section.

After completing task — run through checklist: pitfalls #1–#61, save mode (if form), HTTP method (if new endpoint).
