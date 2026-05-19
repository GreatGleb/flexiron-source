---
name: create-plan
description: Write a complete implementation plan for a new admin page — covers all create-page.md phases, self-verified before output
user_invocable: true
arguments:
  - name: page
    description: "Sitemap ID + name (e.g., 1.1-products, 1.3-services, 3.1-orders, 3.2-customers)"
    required: true
---

> ⚠️ Кастомный скил — НЕ вызывать через `Skill()`. Читать через `Read` и выполнять inline.

# Write New Page Plan

Generate `toDo/plans/[X.X-name]-plan.md` — a complete, verified, domain-specific plan that covers every phase of `.claude/skills/create-page.md`. The plan must be correct on the first execution without rework.

---

## CRITICAL RULES

1. **Read create-page.md COMPLETELY before writing a single prompt**
2. **Every phase (0–10) must map to at least one prompt**
3. **Domain-specific content, not generic text** — tailored to THIS page's TZ
4. **Self-verify via checklist (Step 4) before saving** — if any box fails, fix first
5. **Verify every code claim** — before stating "X exists / is used / is named Y": state the Grep or Read query, run it, show the result, then conclude. Never from logic or memory alone.
6. **STOP after every Step** — after completing each Step (1–5), output the stop block and wait for explicit confirmation before proceeding:

```
⏸ СТОП — Step N: [название]
Сделано: [что именно — 1-3 пункта]
Следующий: Step N+1 — [название]
Продолжить?
```

---

## Step 1: Read Everything

Read in this order:

1. `.claude/skills/create-page.md` — all phases 0–10, all critical rules, all checkpoint formats
2. `.claude/skills/vue-rules.md` — 14 pitfalls, save modes, HTTP methods
3. `frontend_vue/CLAUDE.md` — patterns, prohibitions, CSS aliases
4. `frontend_vue/src/router/index.ts` — existing route names (avoid conflicts)
5. `frontend_vue/src/i18n/admin.ts` (first 80 lines) — existing prefixes
6. `frontend_vue/src/types/` (all files) — types to reuse
7. `frontend_vue/src/config/featureFlags.ts` — existing flags and format
8. `frontend_vue/src/components/admin/` (file list) — available components
9. `toDo/admin-api-contract.md` — contract format of existing sections
10. `toDo/Flexiron_ERP_CRM.md` — TZ for this page's section
11. `toDo/Flexiron_ERP_Process_Algorithm.md` — business logic algorithms
12. `toDo/design/Flexiron_ERP_Sitemap.md` — navigation placement, section hierarchy
13. `toDo/design/screen_specs/[XX.X_Page].md` — detailed screen spec (if file exists)

```
⏸ СТОП — Step 1: Read Everything
Сделано: все 13 источников прочитаны
Следующий: Step 2 — Analyze the Page
Продолжить?
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
**Feature flags:** два уровня:
  - **Page-level** `adminX` — защищает весь роут (beforeEnter guard), если бэкенд страницы не готов
  - **Section-level** `XFeature` — скрывает отдельную часть страницы через `v-if` (конкретное поле, кнопку, функцию), если бэкенд этой фичи не готов. Примеры: `categoryFieldReorder` (drag-and-drop + PUT endpoint), `supplierKanbanView`, `dashboardAlerts`
  Для каждой фичи, у которой есть отдельный API-endpoint, спроси: «бэкенд этого endpoint'а будет готов сразу или позже?» — если позже, нужен section-level флаг.
  Проверь: нет ли уже такого флага в featureFlags.ts.
**Components to reuse:** from src/components/admin/ — list specifically  
**Types to reuse:** from src/types/ — list specifically  

```
⏸ СТОП — Step 2: Analyze the Page
Сделано: views, save mode, endpoints, types, composables, i18n, flags, components — всё определено и выведено
Следующий: Step 3 — Write the Plan
Продолжить?
```

---

## Step 3: Write the Plan

File: `toDo/plans/[X.X-name]-plan.md`

**Format reference:** see `toDo/plans/1.2-categories-plan.md` for the expected level of detail — prompts must include actual TypeScript interfaces, exact function signatures, specific field names, and concrete mock data examples, not abstract descriptions.

### Plan header

The ТЗ section must capture the Step 2 analysis results so the plan is self-contained (executing Claude won't need to re-read all TZ docs):

```
# План: страница X.X [Name]
Route: /admin/[path] (+ /admin/[path]/:id if card exists)
Files: src/views/admin/[section]/[Name]Page.vue (+ [Name]CardPage.vue)
Skill: /create-page (.claude/skills/create-page.md) — читать перед стартом

## ТЗ (выжимка)
[Что такое эта сущность — 2-3 предложения]
[Поведение страницы списка: действия, фильтры, модалы]
[Поведение страницы карточки: секции, save mode, sub-items если есть]

### API endpoints
[GET/POST/PATCH/DELETE/PUT с путями]

### Ключевые типы (TypeScript)
[Вставить реальные интерфейсы — не абстрактные описания]
```

### Prompt order note

The plan uses this order: **contract (Phase 3a) → types (Phase 1) → mocks (Phase 2) → service (Phase 3b)**.
This differs from create-page.md's phase numbering but is intentional: types must be derived from the contract, not written before it. Do not reorder.

### Required prompts — mandatory mapping to create-page.md phases:

---

**Промпт 0 — Phase 0: Context & Checkpoint**

Include ALL of:
- Reading list: create-page.md → vue-rules.md → CLAUDE.md → router → i18n → types → featureFlags → components → TZ sources (CRM ToDo + Algorithm + Sitemap + screen_spec if exists) → admin-api-contract.md
- Checkpoint 0 output format exactly as in create-page.md: page goal, sections (per view separately), key entities, user actions, related pages, API endpoints, save mode decision, existing components to reuse, existing types to reuse, route paths, feature flag name
- "Если какое-либо поле пустое — перечитай ТЗ-источники. Не переходи дальше."
- STOP

---

**Промпт 1 — Phase 3 (part 1): API Contract**

Include ALL of:
- Open toDo/admin-api-contract.md, add new section following existing format
- For each endpoint: HTTP method + path, request body (required/optional fields with types), response shape (ApiResponse\<T\> or PaginatedResponse\<T\>), domain-specific error codes, save mode note
- Show written contract to user for review
- Checkpoint: contract written and shown

---

**Промпт 2 — Phase 1: TypeScript Types**

Include ALL of:
- Check: does src/types/[domain].ts already exist? If yes — add, don't overwrite
- Check: does src/types/api.ts have PaginatedResponse\<T\>, ApiResponse\<T\>? Reuse them
- Define all types for this domain: main entity, list item, filters, sub-types
- Rules: no any, string|null (not undefined), string unions (not enum), [] not null
- typecheck

---

**Промпт 3 — Phase 2 (part 1): Mock Data**

Include ALL of:
- Create src/services/mocks/[domain].ts
- STORE with 5-10 realistic items covering: null optional fields, varied statuses, edge-case strings
- All mock functions: mockGetX (with filters), mockGetX (single), mockCreate, mockPatch, mockDelete, any domain-specific mutations
- structuredClone on all reads; mutations operate on STORE directly
- "ВАЖНО: structuredClone на reactive данных вызывает DataCloneError → используй JSON.parse(JSON.stringify(...))"
- typecheck

---

**Промпт 4 — Phase 2 (part 2): Mock Registration**

Include ALL of:
- Open src/services/mocks/index.ts
- Register all domain routes following the exact existing pattern
- typecheck

---

**Промпт 5 — Phase 3 (part 2): Service Layer**

Include ALL of:
- Create src/services/[domain]Service.ts
- Functions matching the contract exactly (apiGet/apiPost/apiPatch/apiDelete/apiPut)
- If apiPut missing → add to api.ts following apiPatch pattern
- Write-back: add to toDo/admin-api-contract.md section → "Implementation: src/services/[domain]Service.ts"
- typecheck

---

**Промпт 6 — Phase 4: List Composable** (if list view exists)

One prompt per composable — Промпт 6 for list, Промпт 7 for card. For list composable include:
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
- typecheck

---

**Промпт N — Phase 5: i18n**

Include ALL of:
- Add key `[domain]` to adminRu, adminEn, adminLt simultaneously
- Complete key list covering: title, header_title, ALL column headers, ALL field labels, ALL button texts, ALL placeholder texts, ALL modal titles, ALL toast messages, ALL empty states, ALL error messages
- Escape @ rule: name{'@'}company.com
- LT — приближённые переводы допустимы, но ключ обязателен во всех 3 языках
- Checkpoint: посчитать ключи — RU === EN === LT

---

**Промпт N+1 — Phase 6: [Name]Page.vue Skeleton** (list page)

Include ALL of:
- Read existing similar page first for design inheritance: `src/views/admin/suppliers/SuppliersListPage.vue` — изучи: layout структуру (как вложен GlassPanel), CSS-класс корневого элемента, паттерн `<style>` импорта scss-файла внизу компонента, имена классов
- Also read `src/styles/admin/components/` — найди ближайший scss-файл для понимания конвенции имён классов
- Step A — script setup: imports (verify each exists in src/components/admin/), composable destructure, onMounted(load), modal state refs, action handler functions
- Step B — template skeleton: ALL sections from Phase 0 Checkpoint as data-test divs; `<h1 class="page-title">` in view itself (not route.meta — AdminLayout h1 is dead code); GlassPanel wraps every panel; no comments inside \<template\>; CSS root class name follows existing pattern (e.g. `page-[domain]`)
- typecheck && lint

---

**Промпт N+2 — Phase 6: [Name]CardPage.vue Skeleton** *(only if card view exists)*

Same structure as N+1 but for the card page:
- Read existing similar page first for design inheritance: `src/views/admin/suppliers/SupplierCardPage.vue` — изучи: как устроены секции (GlassPanel), Save bar разметка и классы, паттерн scss-импорта; если есть drag-and-drop — `SupplierCardConfigPage.vue` (dragstart/dragover/drop паттерн без внешних библиотек)
- Step A — script setup: route params, use[Name]Card destructure, onMounted(load), sub-item modal state if applicable
- Step B — template skeleton: header + ALL card sections (info, inherited fields if any, own fields, save bar) each with data-test; no comments; CSS root class name follows existing pattern
- typecheck && lint

---

**Промпт N+3 — Phase 7: [Name]Page.vue Bindings** (list page)

Include ALL of:
- "Секция за секцией, max 40 строк за раз"
- For each section (A, B, C…): exact bindings (v-for, v-if, v-model, @click, :disabled)
- After each step: typecheck && lint
- Final checkpoint: browser — page opens, mock data visible, no console errors

---

**Промпт N+4 — Phase 7: [Name]CardPage.vue Bindings** *(only if card view exists)*

Include ALL of:
- Step-by-step bindings for each section: basic fields, inherited fields (read-only), own fields (with drag-drop if needed), save bar v-if="isAnythingDirty", field modal
- After each step: typecheck && lint
- Final checkpoint: browser — card page opens, all sections visible, save bar triggers on edit

---

**Промпт M — Phase 8: Integration**

Include ALL of:
- src/router/index.ts: route definition(s) with correct name(s) and meta: { featureFlag }
- src/config/featureFlags.ts: добавь в FeatureFlags type AND defaultFlags ВСЕ флаги — и page-level (adminX) и section-level (XFeature) если они были определены в Step 2
- src/components/admin/AdminSidebar.vue: correct section placement, router-link with SvgIcon
- src/views/public/ScreensPage.vue: card with screen-id (X.X)
- tests/e2e/helpers/flags.ts: add ALL flags (page + section) to ALL_FLAGS_ENABLED
- В шаблоне view: section-level флаги применяются через `v-if="useFeatureFlag('XFeature').value"` на нужном элементе (кнопка, секция, функция)
- typecheck && lint + browser verify (sidebar link → correct URL)

---

**Промпт M+1 — Phase 9: Verification**

Include ALL of:
- 9a: npm run typecheck && npm run lint → 0 errors
- 9b: contract sync — add all implementation references to admin-api-contract.md: [Name]Page.vue, [Name]CardPage.vue, [domain]Service.ts, useX.ts, useXCard.ts
- 9c: golden path browser walk:
  - Navigate via sidebar → page loads with mock data
  - Every filter/search works
  - Open EVERY modal → renders → close with Escape → close with overlay click
  - For form pages: edit field → Save bar appears → Save → bar disappears
  - Navigation links in rows work
  - Language switch RU → EN → LT — no untranslated keys
- 9d: Regression — open /admin/analytics/dashboard + /admin/suppliers — no new errors
- 9e: Pitfalls checklist: #1 @ escaped, #9 no template comments, #10 route names correct, #12 no generic CSS classes, #13 mock structuredClone, #14 no native select
- ✅ report in this exact format (fill in domain values):
  ```
  - ✅ Page routes: /admin/[path] + /admin/[path]/:id
  - ✅ Feature flag: admin[Name]
  - ✅ Types: src/types/[domain].ts
  - ✅ Mock: src/services/mocks/[domain].ts
  - ✅ Service: src/services/[domain]Service.ts
  - ✅ Composables: src/composables/use[Name].ts + use[Name]Card.ts
  - ✅ Views: src/views/admin/[section]/[Name]Page.vue + [Name]CardPage.vue
  - ✅ i18n: [N] ключей в RU/EN/LT
  - ✅ data-test attrs: [список всех секций]
  - ✅ typecheck: 0 errors
  - ✅ lint: 0 errors
  - ✅ contract sync: done
  - ✅ browser golden path: passed
  ```

---

**Промпт M+2 — Phase 10: Playwright Tests**

Include ALL of:
- "Сначала прочитай: [reference spec files — list tests/e2e/admin/ and pick the structurally closest: list+card page → suppliers/list.spec.ts; config/drag-drop page → suppliers/card-config.spec.ts] — следуй точно тому же стилю"
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
⏸ СТОП — Step 3: Write the Plan
Сделано: все промпты (Промпт 0 – Промпт M+2) написаны в черновике
Следующий: Step 4 — Self-Verify the Plan
Продолжить?
```

---

## Step 4: Self-Verify the Plan

**DO NOT use only the checklist below — it is a first pass, not a substitute for re-reading the source.**

### Pass 1 — Static checklist (quick scan)

- [ ] **Промпт 0**: reading list has all TZ sources + admin-api-contract.md; Checkpoint 0 has all fields; "IF empty → re-read"; STOP
- [ ] **Phase 1 (types)**: check existing first; check api.ts for PaginatedResponse; all domain types defined; typecheck
- [ ] **Phase 2 (mocks)**: structuredClone on reads; JSON.parse note; all mock functions; register in index.ts; typecheck
- [ ] **Phase 3 (service)**: contract written BEFORE service code (Промпт 1 < Промпт with service); write-back after service; typecheck
- [ ] **Phase 4 (composable)**: save mode decided; useDirtyCheck if clean-slate; error as string not Error; discard reloads from server
- [ ] **Phase 5 (i18n)**: all 3 languages simultaneously; ALL visible strings covered; key count RU===EN===LT
- [ ] **Phase 6 (skeleton)**: h1 class="page-title" in view; data-test on root + every section; GlassPanel; no template comments; typecheck && lint
- [ ] **Phase 7 (bindings)**: max 40 lines per step; typecheck && lint after each; browser verify at end
- [ ] **Phase 8 (integration)**: route + featureFlags + sidebar + ScreensPage + flags.ts; browser verify
- [ ] **Phase 9 (verification)**: 9a–9e all; modal Escape+overlay close in golden path; regression; ✅ report format
- [ ] **Phase 10 (playwright)**: enableAllFlags; per-section snapshots; functional tests per element; smoke+navigation+feature-flags registered

### Pass 2 — Live re-read of create-page.md (mandatory)

Open `.claude/skills/create-page.md` and go through Phases 0–10 one by one.
For each phase, find the corresponding prompt in the plan and verify it covers **every requirement listed in that phase** — not just the checklist items above.

If a gap is found → fix the prompt before proceeding to Step 5.

```
⏸ СТОП — Step 4: Self-Verify the Plan
Сделано: Pass 1 (checklist) и Pass 2 (live re-read create-page.md) пройдены, все пробелы закрыты
Следующий: Step 5 — Save and Report
Продолжить?
```

---

## Step 5: Save and Report

Write to `toDo/plans/[X.X-name]-plan.md`.

Output to user:
```
План готов: toDo/plans/[X.X-name]-plan.md
Промптов: [N] (Промпт 0 – Промпт [N-1])
Выполняй по порядку, начиная с Промпт 0.
```
