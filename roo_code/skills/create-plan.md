---
name: create-plan
description: Write a complete implementation plan for a new admin page — covers all create-page.md phases, self-verified before output
user_invocable: true
arguments:
  - name: page
    description: "Sitemap ID + name (e.g., 1.1-products, 1.3-services, 3.1-orders, 3.2-customers)"
    required: true
---

# Write New Page Plan

Generate `toDo/plans/[X.X-name]-plan.md` — a complete, verified, domain-specific plan covering every phase of `roo_code/skills/create-page.md`. Must be correct on first execution without rework.

---

## CRITICAL RULES

1. **Read create-page.md COMPLETELY before writing a single prompt**
2. **Every phase (0–10) must map to at least one prompt**
3. **Domain-specific content, not generic text** — tailored to THIS page's TZ
4. **Self-verify via checklist (Step 4) before saving** — if any box fails, fix first
5. **Verify every code claim** — before stating "X exists / is used / is named Y": state the Grep or Read query, run it, show the result, then conclude. Never from logic or memory alone.
6. **STOP after every Step** — after completing each Step (1–5), output the stop block and wait for explicit confirmation before proceeding.
7. **NEVER use `git restore` or `git checkout` on tracked files** — these permanently destroy uncommitted changes. Use `git show HEAD:<path>` to read committed version, then manually apply only needed parts. If uncommitted changes were destroyed, use `git reflog` + `git show` before any further writes.

---

## Step 1: Read Everything

Read in this order (batch reads where possible):

1. `roo_code/skills/create-page.md` — all phases 0–10, all critical rules, all checkpoint formats
2. `roo_code/skills/vue-rules.md` — pitfalls, save modes, HTTP methods
3. `frontend_vue/CLAUDE.md` — patterns, prohibitions, CSS aliases
4. `frontend_vue/src/router/index.ts` — existing route names (avoid conflicts)
5. `frontend_vue/src/i18n/admin/` — list domain files, check existing prefixes
6. `frontend_vue/src/types/` (all files) — types to reuse
7. `frontend_vue/src/config/featureFlags.ts` — existing flags and format
8. `frontend_vue/src/components/admin/` (file list) — available components
9. `toDo/admin-api-contract.md` — contract format of existing sections
10. `toDo/Flexiron_ERP_CRM.md` — TZ for this page's section
11. `toDo/Flexiron_ERP_Process_Algorithm.md` — business logic algorithms
12. `toDo/design/Flexiron_ERP_Sitemap.md` — navigation placement, section hierarchy
13. `toDo/design/screen_specs/[XX.X_Page].md` — detailed screen spec (if file exists)

```
⏸ STOP — Step 1: Read Everything
Done: all 13 sources read
Next: Step 2 — Analyze the Page
Continue?
```

---

## Step 2: Analyze the Page

Before writing any prompts, determine:

**Views:** list only / list+card / card only / dashboard  
**Save mode per view:** clean-slate (editable form with Save bar) / quick-action (immediate API call) / mixed  
**API endpoints:** list every needed operation (GET list, GET single, POST, PATCH, DELETE, PUT bulk?)  
**Types needed:** main entity + list item + filters + sub-types (e.g. field type union)  
**Composables needed:** one per view (useX for list, useXCard for card)  
**Key i18n sections:** list all visible text categories (columns, labels, modals, toasts, empty states)  
**Route names:** pick names, verify not already in router/index.ts  
**Feature flags:** two levels:
  - **Page-level** `adminX` — protects entire route (beforeEnter guard), if backend not ready
  - **Section-level** `XFeature` — hides page section via `v-if`, if backend feature not ready
  For each feature with its own API endpoint, ask: "will this endpoint be ready at launch or later?" — if later, section-level flag needed.
  Check: does this flag already exist in featureFlags.ts?
**Components to reuse:** from src/components/admin/ — list specifically  
**Types to reuse:** from src/types/ — list specifically  

```
⏸ STOP — Step 2: Analyze the Page
Done: views, save mode, endpoints, types, composables, i18n, flags, components — all determined
Next: Step 3 — Write the Plan
Continue?
```

---

## Step 3: Write the Plan

File: `toDo/plans/[X.X-name]-plan.md`

**Format reference:** see `toDo/plans/1.2-categories-plan.md` for expected detail level — prompts must include actual TypeScript interfaces, exact function signatures, specific field names, and concrete mock data examples.

### Plan header

The TZ section must capture Step 2 analysis so the plan is self-contained:

```
# Plan: page X.X [Name]
Route: /admin/[path] (+ /admin/[path]/:id if card exists)
Files: src/views/admin/[section]/[Name]Page.vue (+ [Name]CardPage.vue)
Skill: /create-page (roo_code/skills/create-page.md) — read before starting

## TZ (summary)
[What this entity is — 2-3 sentences]
[List page behavior: actions, filters, modals]
[Card page behavior: sections, save mode, sub-items if any]

### API endpoints
[GET/POST/PATCH/DELETE/PUT with paths]

### Key types (TypeScript)
[Insert actual interfaces — not abstract descriptions]
```

### Prompt order

The plan uses this order: **contract (Phase 3a) → types (Phase 1) → mocks (Phase 2) → service (Phase 3b)**.
This differs from create-page.md's phase numbering but is intentional: types must derive from contract, not be written before it. Do not reorder.

### Required prompts — mandatory mapping to create-page.md phases:

---

**Prompt 0 — Phase 0: Context & Checkpoint**

Include ALL of:
- Reading list: create-page.md → vue-rules.md → CLAUDE.md → router → i18n → types → featureFlags → components → TZ sources (CRM ToDo + Algorithm + Sitemap + screen_spec if exists) → admin-api-contract.md
- Checkpoint 0 output format exactly as in create-page.md: page goal, sections (per view separately), key entities, user actions, related pages, API endpoints, save mode decision, existing components to reuse, existing types to reuse, route paths, feature flag name
- "If any field is empty — re-read TZ sources. Do not proceed."
- STOP

---

**Prompt 1 — Phase 3 (part 1): API Contract**

Include ALL of:
- Open toDo/admin-api-contract.md, add new section following existing format
- For each endpoint: HTTP method + path, request body (required/optional fields with types), response shape (ApiResponse\<T\> or PaginatedResponse\<T\>), domain-specific error codes, save mode note
- Show written contract to user for review
- **Verify /translated endpoint necessity:** After any backend refactoring, check whether the base endpoint (`/api/domain`) now returns translated data. If so, the plan should NOT use `/api/domain/translated` — use the base endpoint directly.
- **Register both mock route variants:** The plan must include both `/api/domain` and `/api/domain/translated` mock routes in the test setup section.
- Checkpoint: contract written and shown

---

**Prompt 2 — Phase 1: TypeScript Types**

Include ALL of:
- Check: does src/types/[domain].ts already exist? If yes — add, don't overwrite
- Check: does src/types/api.ts have PaginatedResponse\<T\>, ApiResponse\<T\>? Reuse them
- Define all types for this domain: main entity, list item, filters, sub-types
- Rules: no any, string|null (not undefined), string unions (not enum), [] not null
- typecheck

---

**Prompt 3 — Phase 2 (part 1): Mock Data**

Include ALL of:
- Create src/services/mocks/[domain].ts
- STORE with 5-10 realistic items covering: null optional fields, varied statuses, edge-case strings
- All mock functions: mockGetX (with filters), mockGetX (single), mockCreate, mockPatch, mockDelete, any domain-specific mutations
- structuredClone on all reads; mutations operate on STORE directly
- "IMPORTANT: structuredClone on reactive data causes DataCloneError → use JSON.parse(JSON.stringify(...))"
- typecheck

---

**Prompt 4 — Phase 2 (part 2): Mock Registration**

Include ALL of:
- Open src/services/mocks/index.ts
- Register all domain routes following the exact existing pattern
- typecheck

---

**Prompt 5 — Phase 3 (part 2): Service Layer**

Include ALL of:
- Create src/services/[domain]Service.ts
- Functions matching the contract exactly (apiGet/apiPost/apiPatch/apiDelete/apiPut)
- If apiPut missing → add to api.ts following apiPatch pattern
- Write-back: add to toDo/admin-api-contract.md section → "Implementation: src/services/[domain]Service.ts"
- typecheck

---

**Prompt 6 — Phase 4: List Composable** (if list view exists)

One prompt per composable — Prompt 6 for list, Prompt 7 for card. For list composable include:
- items, loading, error: ref\<string|null\>(null), filters refs
- load() with try/catch/finally
- watch(filters, load, { deep: true })
- Quick-action operations (delete with 409-handling toast, etc.)
- Expose ONLY what view needs
- typecheck

For card/detail composable include:
- useDirtyCheck for basic fields
- If sub-items array: localX ref + xChanged computed (JSON comparison) + isAnythingDirty = isDirty || xChanged
- save() with Promise.all if multiple concurrent API calls
- discard() calls load() (re-fetch from server)
- Sub-item mutations: add/update/delete/reorder with order recalculation
- JSON.parse(JSON.stringify(...)) for cloning reactive state
- **Use watchEffect for dirty checks:** The plan must specify `watchEffect` (not `watch({ deep: true })`) for dirty check logic, because `structuredClone` crashes on Vue reactive proxies.
- **Never use watch getter + toRaw():** The plan must avoid `watch(() => toRaw(source.value), ...)` — this breaks Vue dependency tracking.
- typecheck

---

**Prompt N — Phase 5: i18n**

Include ALL of:
- Add to `src/i18n/admin/[domain].ts` — create or update domain file with all 3 languages
- Each file exports a single object with `ru`, `en`, `lt` keys
- Export name: `admin[Domain]` (e.g., `adminProducts`)
- Key prefix = domain name (`products.title`, `products.search_placeholder`)
- Complete key list covering: title (for useHead), header_title, ALL column headers, ALL field labels, ALL button texts, ALL placeholder texts, ALL modal titles, ALL toast messages, ALL empty states, ALL error messages
- Escape @ rule: name{'@'}company.com
- LT — approximate translations acceptable, but key required in all 3 languages
- For data from API/mocks: use `TranslatedString` + `tf()`, NOT `resolveLabel()`
- For form inputs: use `mergeLocaleValue()` / `toTranslatedString()` from `@/types/i18n`
- **Use mergeTranslatedString() for UI updates:** The plan must use `mergeTranslatedString(existing, value, locale)` in computed setters and form inputs, NOT `toTranslatedString()` which zeroes out other locales.
- **Always wrap TranslatedString with tf() in templates:** The plan must include a verification step that all `{{ }}` expressions with TranslatedString values are wrapped in `tf()`.
- **Cross-reference composable keys:** After writing the composable, grep ALL `t('` calls in composable and service files. Every key used in `t()` must exist in the domain i18n file. Missing keys cause runtime display of raw key strings.
- **No cross-namespace references:** Never use `$t('otherDomain.key')` in a template or composable of a different domain. Each domain must have its own keys. If a key is shared (e.g. pagination `of`), duplicate it in each domain file.
- **Include ALL toast keys:** Every `toast.success(t('...'))` and `toast.error(t('...'))` call in the composable must have a corresponding i18n key. Common toast keys: `toast_created`, `toast_error_create`, `toast_deleted`, `toast_error_delete`, `toast_updated`, `toast_error_update`.
- **Include `title` key for useHead:** `useHead({ title: t('domain.title') })` is used in the page template. The `title` key MUST exist in the domain i18n file.
- Checkpoint: count keys — RU === EN === LT within the domain file

---

**Prompt N+1 — Phase 6: [Name]Page.vue Skeleton** (list page)

Include ALL of:
- Read existing similar page first for design inheritance: `src/views/admin/suppliers/SuppliersListPage.vue` — study: layout structure (GlassPanel nesting), CSS root class, `<style>` import pattern at bottom, class names
- Also read `src/styles/admin/components/` — find closest scss file for class naming conventions
- Step A — script setup: imports (verify each exists in src/components/admin/), composable destructure, onMounted(load), modal state refs, action handler functions
- Step B — template skeleton: ALL sections from Phase 0 Checkpoint as data-test divs; `<h1 class="page-title">` in view itself; GlassPanel wraps every panel; no template comments; CSS root class follows existing pattern
- **Use skeleton loading states:** The plan must specify skeleton layouts (using `<GlassPanel :loading="true" :skeleton-rows="5" />`) instead of text-based loading indicators.
- typecheck && lint

---

**Prompt N+2 — Phase 6: [Name]CardPage.vue Skeleton** *(only if card view exists)*

Same structure as N+1 but for card page:
- Read existing similar page: `src/views/admin/suppliers/SupplierCardPage.vue` — study sections (GlassPanel), Save bar markup, scss import pattern; if drag-and-drop → `SupplierCardConfigPage.vue`
- Step A — script setup: route params, use[Name]Card destructure, onMounted(load), sub-item modal state if applicable
- Step B — template skeleton: header + ALL card sections each with data-test; no comments; CSS root class follows existing pattern
- typecheck && lint

---

**Prompt N+3 — Phase 7: [Name]Page.vue Bindings** (list page)

Include ALL of:
- "Section by section, max 40 lines at a time"
- For each section (A, B, C…): exact bindings (v-for, v-if, v-model, @click, :disabled)
- After each step: typecheck && lint
- Final checkpoint: browser — page opens, mock data visible, no console errors

---

**Prompt N+4 — Phase 7: [Name]CardPage.vue Bindings** *(only if card view exists)*

Include ALL of:
- Step-by-step bindings for each section: basic fields, inherited fields (read-only), own fields (with drag-drop if needed), save bar v-if="isAnythingDirty", field modal
- After each step: typecheck && lint
- Final checkpoint: browser — card page opens, all sections visible, save bar triggers on edit

---

**Prompt M — Phase 8: Integration**

Include ALL of:
- src/router/index.ts: route definition(s) with correct name(s) and meta: { featureFlag }
- src/config/featureFlags.ts: add to FeatureFlags type AND defaultFlags ALL flags — page-level (adminX) and section-level (XFeature)
- src/components/admin/AdminSidebar.vue: correct section placement, router-link with SvgIcon
- src/views/public/ScreensPage.vue: card with screen-id (X.X)
- tests/e2e/helpers/flags.ts: add ALL flags (page + section) to ALL_FLAGS_ENABLED
- In view template: section-level flags via `v-if="useFeatureFlag('XFeature').value"`
- typecheck && lint + browser verify (sidebar link → correct URL)

---

**Prompt M+1 — Phase 9: Verification**

Include ALL of:
- 9a: npm run typecheck && npm run lint → 0 errors
- 9b: contract sync — add all implementation references to admin-api-contract.md
- 9c: golden path browser walk:
  - Navigate via sidebar → page loads with mock data
  - Every filter/search works
  - Open EVERY modal → renders → close with Escape → close with overlay click
  - For form pages: edit field → Save bar appears → Save → bar disappears
  - Navigation links in rows work
  - Language switch RU → EN → LT — no untranslated keys
- 9d: Regression — open /admin/analytics/dashboard + /admin/suppliers — no new errors
- 9e: Pitfalls checklist: #1 @ escaped, #9 no template comments, #10 route names correct, #12 no generic CSS classes, #13 mock structuredClone, #14 no native select
- ✅ report format (fill in domain values):
  ```
  - ✅ Page routes: /admin/[path] + /admin/[path]/:id
  - ✅ Feature flag: admin[Name]
  - ✅ Types: src/types/[domain].ts
  - ✅ Mock: src/services/mocks/[domain].ts
  - ✅ Service: src/services/[domain]Service.ts
  - ✅ Composables: src/composables/use[Name].ts + use[Name]Card.ts
  - ✅ Views: src/views/admin/[section]/[Name]Page.vue + [Name]CardPage.vue
  - ✅ i18n: [N] keys in RU/EN/LT
  - ✅ data-test attrs: [all sections list]
  - ✅ typecheck: 0 errors
  - ✅ lint: 0 errors
  - ✅ contract sync: done
  - ✅ browser golden path: passed
  ```

---

**Prompt M+2 — Phase 10: Playwright Tests**

Include ALL of:
- "First read: [reference spec files — pick structurally closest] — follow exact same style"
- Create tests/e2e/admin/[section]/[domain].spec.ts
- enableAllFlags in beforeEach
- Load & no-crash test
- Per-section visual snapshots: one test() per data-test section (NOT full-page)
- DOM visibility assertions for every data-test section
- Functional tests for EVERY interactive element: each filter, each button, each modal, save bar flow, drag-drop if present
- i18n test: RU/EN/LT switch
- Playwright rules: many small test(), expect.soft() for linked assertions, wait toBeVisible (not networkidle)
- Register: smoke.spec.ts + navigation.spec.ts + feature-flags.spec.ts
- Run: npx playwright test --update-snapshots [path]
- Checkpoint: all green, snapshots created

```
⏸ STOP — Step 3: Write the Plan
Done: all prompts (Prompt 0 – Prompt M+2) written in draft
Next: Step 4 — Self-Verify the Plan
Continue?
```

---

## Step 4: Self-Verify the Plan

### Pass 1 — Static checklist (quick scan)

- [ ] **Prompt 0**: reading list has all TZ sources + admin-api-contract.md; Checkpoint 0 has all fields; "IF empty → re-read"; STOP
- [ ] **Phase 1 (types)**: check existing first; check api.ts for PaginatedResponse; all domain types defined; typecheck
- [ ] **Phase 2 (mocks)**: structuredClone on reads; JSON.parse note; all mock functions; register in index.ts; typecheck
- [ ] **Phase 3 (service)**: contract written BEFORE service code; write-back after service; typecheck
- [ ] **Phase 4 (composable)**: save mode decided; useDirtyCheck if clean-slate; error as string not Error; discard reloads from server
- [ ] **Phase 5 (i18n)**: all 3 languages simultaneously; ALL visible strings covered; key count RU===EN===LT
- [ ] **Phase 6 (skeleton)**: h1 class="page-title" in view; data-test on root + every section; GlassPanel; no template comments; typecheck && lint
- [ ] **Phase 7 (bindings)**: max 40 lines per step; typecheck && lint after each; browser verify at end
- [ ] **Phase 8 (integration)**: route + featureFlags + sidebar + ScreensPage + flags.ts; browser verify
- [ ] **Phase 9 (verification)**: 9a–9e all; modal Escape+overlay close in golden path; regression; ✅ report format
- [ ] **Phase 10 (playwright)**: enableAllFlags; per-section snapshots; functional tests per element; smoke+navigation+feature-flags registered

#### Single-locale refactoring lessons checklist

- [ ] All `/api/domain` routes have corresponding `/api/domain/translated` mock routes
- [ ] All `{{ }}` expressions with TranslatedString values are wrapped in `tf()`
- [ ] All TranslatedString form fields use computed get/set, not direct v-model
- [ ] All dirty checks use `watchEffect` instead of `watch({ deep: true })`
- [ ] All UI translation updates use `mergeTranslatedString()` not `toTranslatedString()`
- [ ] Loading states use skeleton layouts, not text placeholders
- [ ] `tf()` has null guard for null/undefined safety

### Pass 2 — Live re-read of create-page.md (mandatory)

Open `roo_code/skills/create-page.md` and go through Phases 0–10 one by one.
For each phase, find the corresponding prompt in the plan and verify it covers **every requirement listed in that phase**.

If a gap is found → fix the prompt before proceeding to Step 5.

```
⏸ STOP — Step 4: Self-Verify the Plan
Done: Pass 1 (checklist) and Pass 2 (live re-read create-page.md) complete, all gaps closed
Next: Step 5 — Save and Report
Continue?
```

---

## Step 5: Save and Report

Write to `toDo/plans/[X.X-name]-plan.md`.

Output to user:
```
Plan ready: toDo/plans/[X.X-name]-plan.md
Prompts: [N] (Prompt 0 – Prompt [N-1])
Execute in order, starting with Prompt 0.
```
