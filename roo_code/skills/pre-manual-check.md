---
name: pre-manual-check
description: Deep verification of a newly implemented page before user manual testing. Runs targeted checks grouped by category — each group has one STOP. Findings are added to the bugs file.
user_invocable: true
arguments:
  - name: plan
    description: "Plan file identifier, e.g. '1.1' → reads toDo/plans/1.1-products-plan.md"
    required: true
---

# Pre-Manual Check — Deep verification before manual testing

Run AFTER page implementation, BEFORE manual testing. Goal: find maximum bugs before user opens browser.

**Principle: checks grouped by category** — each group runs all its checks in one pass, then STOP. This reduces 20 individual stops to ~8 grouped stops.

---

## CRITICAL RULES

1. **ONE STOP PER GROUP** — execute all checks in a group, then STOP and wait for confirmation
2. **Claim → Verify → Conclude** — every code assertion = Grep or Read BEFORE conclusion, never from memory
3. **No skipping "obvious" checks** — each check independent, verify even if "obviously clean"
4. **Add bugs immediately** — when found, add to bugs-file DURING the same group, before STOP
5. **✅ or ❌, never "probably ok"** — each item must be verified by tool

---

## Step 0: Initialization (run once before Group 1)

```
Read the following files:

1. toDo/plans/{plan}-plan.md — extract:
   - Full list of created/modified files (views, composables, services, types, CSS, i18n, router)
   - TZ section of plan ("TZ" or "What is X" section)
   - Feature flags list
   - API endpoints
   - Final checklist

2. TZ sources (mentioned in plan or create-page.md):
   - toDo/InBox LT CRM ToDo.md — this page's section
   - toDo/Flexiron_ERP_Process_Algorithm.md — if mentioned in plan
   - toDo/design/screen_specs/[XX.X_Page].md — if exists for this page
   - toDo/admin-api-contract.md — this domain's section

3. Determine bugs-file path:
   - Plan name: toDo/plans/{plan}-[domain]-plan.md (e.g. 1.1-products-plan.md)
   - Bugs-file: toDo/plans/bugs/{plan}-[domain]-bugs.md
   - If bugs-file doesn't exist — create with header and empty summary table
   - Read summary table → determine NEXT_BUG_ID

Save in memory:
- PLAN_FILES: all implementation files list
- TZ_REQUIREMENTS: requirements list from TZ (all items)
- BUGS_FILE: full path to bugs-file
- NEXT_BUG_ID: next bug sequence number
```

After initialization — immediately execute Group 1 without waiting.

---

## GROUP 1 — CSS & Design Consistency (was Prompts 1-2)

**Focus:** every CSS class defined and accessible; UI elements match existing page patterns.

### CSS class availability
1. For each view file from PLAN_FILES — read the file
2. Extract all CSS classes from `class="..."` and `:class="{...}"` in template
3. Read CSS imports of component (`import '@styles/...'`)
4. Read `src/styles/admin/admin-core.scss` — its `@import` list (global classes)
5. For each class — Grep in accessible files (component imports + admin-core.scss imports)
6. Class not found anywhere → BUG

**Specifically check:**
- `.empty-state` — NOT in admin-core.scss, must be in page CSS
- Classes from `_entity-card-layout.css` — NOT in admin-core.scss, need explicit `import`
- Any custom class from plan that may not be in CSS file

### Design consistency
Read reference page and compare:
- **Card page** → `src/views/admin/suppliers/SupplierCardPage.vue`
- **List page** → `src/views/admin/suppliers/SuppliersListPage.vue`

| Element | Expected pattern |
|---|---|
| Back button | `<router-link class="btn btn-secondary">` — not button, not router.back() |
| Header buttons | `entity-action-bar no-margin pos-static` container |
| Delete/action button | `action-icon-btn action-danger` from `_action-icons.css` |
| Section title | `:title` prop on GlassPanel — not `<h2>` inside panel body |
| Table | `data-table` + `data-table-wrapper` |
| Clickable row | CSS cursor:pointer in page CSS, `@click` on `<tr>` |
| Save bar | `entity-action-bar no-margin pos-static` with `v-if="isAnythingDirty"` |
| Page title | `<h1 class="page-title">` |
| Empty state | `class="empty-state"` (display:flex, flex-direction:column, align-items:center) |
| Read-only field | `<input readonly class="glass-input">` — not `<span class="glass-input">` |

**After completion:** add found bugs to BUGS_FILE → **STOP**

---

## GROUP 2 — Template Hygiene & v-model Contracts (was Prompts 3-4)

**Focus:** forbidden template patterns, correct v-model usage.

### Template hygiene — for each view file:
1. **Comments** — Grep `<!--` inside `<template>` → pitfall #9, FORBIDDEN
2. **`<a href>`** — Grep `<a ` in template → must be `<router-link>`
3. **`router.back()`** → must be named route `{ name: 'X' }`
4. **`v-for` without `:key`** — Grep `v-for` → each must have `:key`
5. **Hardcoded strings** — visible text not through `t('...')` (except `—` and numbers)
6. **`v-html`** — Grep `v-html` → needs explicit reason
7. **Unused imports** — each import in `<script setup>` used in template or script

### v-model contracts
1. **CustomSelect** — accepts only `string`, not `string | null` and not `number`
   - Grep `v-model` on `<CustomSelect` in new files
   - For each binding — check source type (ref, reactive, computed)
   - `string | null` → needs computed adapter `null ↔ ''`
   - "empty/all" option → `{ value: '', label: '...' }`, not `{ value: null }`

2. **DropZone** — NOT v-model component
   - Grep `v-model` on `<DropZone` → must be `hint` prop + `@uploaded` event

3. **`v-model.number` on nullable number** → watcher `NaN → null` must be in composable
   - Grep `v-model.number` → for each nullable field — check watcher in composable

4. **Other components** — for each `v-model` → read `defineProps` of component → type of `modelValue`

**After completion:** add found bugs to BUGS_FILE → **STOP**

---

## GROUP 3 — TypeScript & i18n (was Prompts 5-6)

**Focus:** null safety, data normalization, translation completeness.

### TypeScript: null safety and data normalization
1. **Nullable string before save** — in `save()` composable:
   - `form.field === ''` normalizes to `null` after `dirty.diff()`
   - Grep `delta.` in save() → check normalization for each nullable string

2. **Nullable number fields** — `v-model.number` gives NaN when cleared:
   - Grep NaN in composable → watcher present for all fields

3. **Nullable access in template**:
   - `item.price != null ? item.price : '—'` — for numbers (not `item.price ?? '—'` — 0 is falsy with `||`)
   - `item.field ?? '—'` — for strings
   - `product?.name` — optional chaining where product may be null

4. **No `any`** — Grep `: any` in new files → each case justified

5. **No `undefined` as nullable** — `T | null`, not `T | undefined`

### i18n: translation completeness
1. Read `src/i18n/admin/[domain].ts`
2. Count keys in `ru.[domain]` → N
3. Count keys in `en.[domain]` → must be N
4. Count keys in `lt.[domain]` → must be N
5. Mismatch → list missing keys
6. For each `t('domain.key')` in new files — key exists in the domain file?
7. Grep `@` in translation string values → unescaped `@` (must be `{'@'}`)
8. Grep hardcoded text in templates (not through `t()`) — check visible strings

**After completion:** add found bugs to BUGS_FILE → **STOP**

---

## GROUP 4 — Mock Data & Feature Flags (was Prompts 7-8)

**Focus:** mock STORE integrity, feature flag triple registration.

### Mock data: integrity and completeness
1. **Cross-ID check** — for each reference to another STORE (linkedSuppliers.id, categoryId etc.):
   - Grep ID in target mock file → ID exists

2. **Field type coverage** — if dynamic fields (text/number/boolean/enum/email/date/file):
   - Grep each fieldType in STORE → at least one product contains field of each type

3. **Inherited fields** — for each category with `inheritedFields` in categories STORE:
   - Products of this category have corresponding fieldValues with `inherited: true`

4. **structuredClone** — Grep each mock function reading from STORE → returns `structuredClone(...)`

5. **English language** — all STORE strings in English (not Russian)

6. **Edge cases** — at least one product with `price: null`, one with `categoryId: null`

### Feature flags: triple registration
1. Grep `useFeatureFlag(` in new files → list of all used flags
2. Grep `featureFlag:` in new route definitions → flags in route meta
3. For each flag X:
   - Grep X in `src/types/features.ts` → present in FeatureFlags interface
   - Grep X in `src/config/featureFlags.ts` → present with default value
   - Grep X in `tests/e2e/helpers/flags.ts` → present in ALL_FLAGS_ENABLED

**After completion:** add found bugs to BUGS_FILE → **STOP**

---

## GROUP 5 — Pitfalls #1–#28 (was Prompt 9)

**Focus:** run through all pitfalls from vue-rules.md on new files.

1. Read `roo_code/skills/vue-rules.md` (full pitfalls list #1–#28)
2. For each pitfall — determine: applicable to this page?
3. If applicable → Grep or Read → ✅ or ❌

**Mandatory checks (regardless of rest):**

| # | What to check | Tool |
|---|---|---|
| #9 | No `<!--` in `<template>` | Grep `<!--` in view files |
| #10 | All route names in router.push/router-link exist | Grep name in router/index.ts |
| #13 | Mock reads return structuredClone | Read mock file |
| #16 | Each component imports its own CSS explicitly | Read imports of view files |
| #17 | All `<SvgIcon name="X">` — X exists in SvgIcon.vue | Grep X in SvgIcon.vue |
| #18 | Save bar = `btn_discard_changes`; modals = `btn_discard` | Grep in view files |
| #19 | Filters/search inside same GlassPanel as table | Read template |
| #20 | `initialized` flag in list composable | Read composable |

**After completion:** add found bugs to BUGS_FILE → **STOP**

---

## GROUP 6 — Router & TZ Compliance (was Prompts 10-11)

**Focus:** all routes correct, every TZ requirement implemented.

### Router and navigation
1. Grep `{ name:` in new view/composable files → list of all used route names
2. For each name → Grep in `src/router/index.ts` → name exists
3. Read new routes block in router/index.ts:
   - Static paths (`products/categories`) come BEFORE dynamic (`:id`)
   - Vue Router 4: static segment = 40pts, dynamic = 20pts
4. For each `meta: { featureFlag: 'X' }` → X registered (see Group 4)
5. `ScreensPage.vue` updated if plan requires it — Grep in plan → Grep in ScreensPage

### TZ compliance
1. Take TZ_REQUIREMENTS from initialization (plan + all TZ sources)
2. For each requirement — find its implementation:
   - Section in template → Grep `data-test` / Read template
   - Field in form → Read view InputGroup
   - Button / action → Read view + handler in composable
   - API endpoint → Read service + mock/index.ts
   - Feature flag → Read featureFlags.ts
3. Requirement without implementation → BUG
4. Implementation doesn't match requirement → BUG

**Check explicitly:**
- Save mode correct (clean-slate vs quick-action)
- All TZ sections present
- All user actions implemented
- API endpoints match contract (HTTP method, path, request shape)

**After completion:** add found bugs to BUGS_FILE → **STOP**

---

## GROUP 7 — File-by-file: Types, Mocks, Service (was Prompts 12-14)

**Focus:** deep check of types, mocks, and service files.

### types/[domain].ts
1. Read file entirely
2. All fields from API contract reflected in types
3. Nullable fields → `T | null` (not `T | undefined`, not `T?`)
4. No `any` — Grep `: any`
5. Shared types imported from source file, not duplicated
6. `PaginatedResponse<T>` used for lists (from `src/types/api.ts`)
7. Form type (if different from API type) — separate `Pick<Entity, ...>` or interface

### mocks/[domain].ts
1. STORE contains 8+ records with diverse data
2. `mockCreate` — generates unique ID, sets `createdAt`, resolves reference names
3. `mockPatch` — applies delta via `Object.assign` or field by field; returns `structuredClone`
4. `mockDelete` — removes via `splice`, returns correct status
5. Filtering in `mockGetList` — search by name (case-insensitive), categoryId filter checks `!== null`
6. All read functions return `structuredClone(...)`; mutations work directly on STORE
7. `structuredClone` NOT used on Vue reactive proxy → `JSON.parse(JSON.stringify(...))` if needed

### mocks/index.ts + [domain]Service.ts
**mocks/index.ts:**
1. All 5 routes registered: GET list, GET `:id`, POST, PATCH `:id`, DELETE `:id`
2. Path matching and method checking — same pattern as existing routes
3. No duplicate paths (GET list vs GET :id differ by ID segment check)

**[domain]Service.ts:**
1. Each function uses correct method (`apiGet`/`apiPost`/`apiPatch`/`apiDelete`)
2. Filters in GET → null-check before adding to params
3. Functions return correct types (from `src/types/api.ts` envelope)

**After completion:** add found bugs to BUGS_FILE → **STOP**

---

## GROUP 8 — File-by-file: Composables & Views (was Prompts 15-20)

**Focus:** deep check of composables and view files.

### use[Domain].ts (list composable)
1. `initialized` flag (not ref, plain boolean) — `loading.value = true` only if `!initialized`
2. `watch(filters, load, { deep: true })` — NOT `{ immediate: true }` (otherwise duplicates onMounted load)
3. `deleteProduct`:
   - `await deleteProductApi(id)` from service
   - `toast.success(t('...'))`
   - `await load()` after successful delete
   - `catch` → `toast.error(t('...'))`
4. `load()` sets `initialized = true` in `try` block (after successful fetch)
5. Returns only what view uses (no extras in return)
6. `error` ref present and set in catch if view shows it

### use[Domain]Card.ts (card composable)
1. **form** — `ref<Pick<Entity, 'field1'|'field2'|...>>({...})` — only editable fields, not entire Entity
2. **useDirtyCheck(form)** — passed `form` as Ref (not `form.value`)
3. **NaN watcher** — `watch(form, (val) => { if (NaN) form.value.field = null }, { deep: true })` for each `v-model.number` field
4. **load()**: form filled → `dirty.capture()` called AFTER form fill → fieldValues set
5. **save()**: early exit `if (!isAnythingDirty.value) return` → delta from `dirty.diff()` → normalization → toast → `await load()`
6. **discard()** = `return load()` (not manual reset)

### [Domain]Page.vue — script setup
1. All `import` used in template or script
2. Computed adapters for CustomSelect with nullable sources
3. `onMounted(() => { load(); loadCats() })` — both loads called if needed
4. `handleCreate`: navigation or reload logic, modal close
5. `confirmDelete` — checks `deletingId.value` before calling
6. Submit buttons: `:disabled="!name.trim() || creating"` — correct conditions
7. Feature flags used only where needed (v-if in template)

### [Domain]Page.vue — template
1. **data-test** on each: page root, header, table/panel, search, row, empty, modals
2. **`@click.stop`** on delete button inside clickable row
3. **Empty state**: `v-if="!loading && items.length === 0"` — not just `v-if="items.length === 0"`
4. **Table**: `v-else` (not `v-if="items.length > 0"`) — prevents both rendering
5. **Delete modal**: delete button `btn-danger`, cancel `btn-secondary`
6. **Create modal footer**: submit button `:disabled="!newProduct.name.trim() || creating"`
7. **Modals**: `v-model="showModal"` / `:title="t('...')"` / `size="small"` on AppModal
8. **Filters inside GlassPanel** (pitfall #19) — not outside panel
9. All `t('products.X')` — keys exist (from Group 3)
10. All `{ name: 'X' }` — routes exist (from Group 6)

### [Domain]CardPage.vue — script setup
1. `id = route.params.id as string` — ID from route params
2. All composable fields destructured
3. `useHead` with computed: `computed(() => product.value?.name ?? t('...'))`
4. Computed adapter for nullable enum: `null ↔ ''`
5. Empty option `{ value: '', label: '—' }` first — for reset
6. `onMounted(load)` present
7. No extra `ref` or `reactive` duplicating composable logic
8. All imports used
9. `showX` = `useFeatureFlag('xFeature')`

### [Domain]CardPage.vue — template
1. **Sections** — all TZ sections present
2. **`:title` prop** on each GlassPanel — not `<h2>` inside panel body
3. **Save bar**: `v-if="isAnythingDirty"` — only when changes exist
4. **Save bar buttons**: both have `:disabled="saving"`; first `btn-secondary` (discard), second `btn-primary` (save)
5. **Read-only fields**: `<input :value="..." readonly class="glass-input">` — not `<span>`
6. **Dynamic fields** — all types in v-else-if: text / number / email / date / boolean / enum / file
7. **Inherited badge** on `v-if="fv.inherited"` fields
8. **Empty state** — condition covers `!product || product.linkedSuppliers.length === 0`
9. **data-test** on each section
10. All `t('...')` keys exist

**After completion:** add found bugs to BUGS_FILE → **STOP**

---

## Bug format for BUGS_FILE

When bug found — add DURING current group:

```markdown
## БАГ-[N] — [Short title]

**File:** `[path]`  
**Severity:** High / Medium / Low — [reason]

### Problem

[What's wrong. What happens in runtime / what user sees]

### Fix

[What needs to be done — specifically]

### Future rule

[How to avoid repetition]
```

And add row to summary table at end of BUGS_FILE:
```
| БАГ-[N] | [Type] | `[file]` | [One-line summary] |
```

---

## STOP — format after each group

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏸ STOP — Group [N]/8: [Group name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Result: ✅ Clean  /  ❌ Found [N] problems

[List: БАГ-X — short title (file:line)]

Added to bugs-file: yes / no (clean)

Next — Group [N+1]/8: [Next group name]
Run?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## After Group 8

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Pre-manual-check complete — all 8 groups
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total new bugs found: [N]
Bugs-file: {BUGS_FILE}

Next steps:
1. Fix all new bugs (each with typecheck + lint)
2. Pass to manual testing
3. After manual test → Playwright E2E (last plan prompt)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
