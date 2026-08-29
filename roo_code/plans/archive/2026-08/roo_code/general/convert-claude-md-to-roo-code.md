# Plan: Convert `frontend_vue/CLAUDE.md` to Roo Code Format

## Problem

[`frontend_vue/CLAUDE.md`](../../frontend_vue/CLAUDE.md) was written for **Claude Code** (Anthropic's tool). It references Claude Code-specific patterns:
- Skill invocation via `/vue-rules` slash-command
- `CLAUDE.md` as auto-read project instructions file

Roo Code has its own system:
- [`ROO.md`](../../ROO.md) at root level for workspace rules
- Skills in [`roo_code/skills/`](../../roo_code/skills/) with YAML frontmatter
- Context files in [`roo_code/roo-context/`](../../roo_code/roo-context/)
- Plans in [`roo_code/plans/`](../../roo_code/plans/)

## Analysis: Content Mapping

| CLAUDE.md Section | Status | Target |
|---|---|---|
| Stack (lines 5-13) | ✅ Already covered in [`roo_code/roo-context/frontend-architecture.md`](../../roo_code/roo-context/frontend-architecture.md) lines 5-6 | No change needed |
| Directory Structure (lines 17-42) | 🔶 Partially covered — architecture.md has structure but CLAUDE.md has more detail | Convert to context file |
| Patterns (lines 44-73) | 🔶 Partially covered in vue-rules.md | Convert to context file |
| SOLID (lines 75-81) | ❌ Not in any Roo Code file | Convert to context file |
| DRY (lines 83-88) | ❌ Not in any Roo Code file | Convert to context file |
| DDD (lines 90-97) | ❌ Not in any Roo Code file | Convert to context file |
| CSS Strategy (lines 99-107) | ✅ Covered in architecture.md lines 190-204 | No change needed |
| API/Mock Layer (lines 109-118) | ✅ Covered in architecture.md lines 154-166 | No change needed |
| Feature Flags (lines 120-126) | ✅ Covered in architecture.md lines 115-123 | No change needed |
| i18n (lines 128-134) | ✅ Covered in architecture.md lines 125-136 | No change needed |
| Routing (lines 136-140) | ✅ Covered in architecture.md lines 68-113 | No change needed |
| Known Pitfalls (lines 142-151) | ✅ Covered in vue-rules.md (pitfalls #1-#6) | No change needed |
| Prohibitions (lines 153-162) | 🔶 Partially covered in vue-rules.md | Convert to context file |
| Verification Checklist (lines 164-171) | 🔶 Partially covered in verify.md skill | Convert to context file |

## Plan

### Step 1: Create [`roo_code/roo-context/frontend-vue-quickref.md`](../../roo_code/roo-context/frontend-vue-quickref.md)

A new Roo Code context file containing the **unique content** from CLAUDE.md that isn't already in Roo Code files:

1. **Directory Structure** — the src/ layout overview (useful quick reference)
2. **Patterns** — Composition API, v-model, provide/inject, slots, Teleport
3. **SOLID** principles as applied to this project
4. **DRY** principles
5. **DDD** (Domain-Driven Design) domain mapping
6. **Prohibitions** list
7. **Verification Checklist** (adapted for Roo Code workflow)

Format: Standard markdown with Roo Code conventions (relative links, no slash-commands).

### Step 2: Update [`frontend_vue/CLAUDE.md`](../../frontend_vue/CLAUDE.md)

Replace the content with a **redirect note** pointing to Roo Code equivalents:

- Remove Claude Code-specific references (`/vue-rules` slash-command)
- Add a header explaining this file is for reference; Roo Code uses [`roo_code/`](../../roo_code/) files
- Keep the essential technical content but reformat for Roo Code conventions
- Update references from Claude Code patterns to Roo Code patterns

### Step 3: Update references in other files

Check and update any files that reference `CLAUDE.md`:

- [`roo_code/skills/create-plan.md`](../../roo_code/skills/create-plan.md) line 37: `frontend_vue/CLAUDE.md` — update to reference the new context file
- Any other skills referencing CLAUDE.md

### Step 4: Verify consistency

- Ensure no duplicate content between the new context file and existing files
- Ensure all links are correct relative paths
- Ensure no Claude Code-specific terminology remains

## Detailed Content for New Context File

The new [`roo_code/roo-context/frontend-vue-quickref.md`](../../roo_code/roo-context/frontend-vue-quickref.md) should contain:

```markdown
# Frontend Vue — Quick Reference

> Quick-reference for [`frontend_vue/`](../../frontend_vue/) project patterns, conventions, and architecture.
> Detailed architecture: [`frontend-architecture.md`](./frontend-architecture.md)
> Vue pitfalls & rules: [`vue-rules.md`](../skills/vue-rules.md)

## Directory Structure

```
frontend_vue/src/
  config/             # Feature flags
  components/
    BackButton.vue    # (public)
    LangSwitcher.vue  # (public)
    admin/            # Admin UI components
      ui/             # Form controls (CustomSelect, Modal, TagInput, etc.)
      tables/         # Table components (AlertsTable, HistoryTable, etc.)
  composables/        # Reusable logic (useXxx pattern)
  i18n/               # Translations (domain-split in admin/)
  layouts/            # AdminLayout.vue
  router/             # Route definitions
  services/           # API layer (pure async, no Vue reactivity)
    mocks/            # Mock data (same interface as real API)
  types/              # TypeScript interfaces (per domain)
  views/
    public/           # Public pages (Landing, Auth, etc.)
    admin/
      analytics/      # 8 analytics pages
      suppliers/      # 5 supplier pages
      products/       # 4 product pages
tests/
  e2e/                # Playwright tests
```

## Patterns

### Composition API
- Always `<script setup lang="ts">` — never Options API
- Composables with `use` prefix for reusable logic
- Views for pages, Components for reusable blocks

### v-model for custom components
```vue
defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
```

### provide/inject
- `AdminLayout` provides: sidebar collapsed state, toast handler
- Deep components inject directly — no prop drilling

### Slots
- GlassPanel: default + header + action slots
- AppModal: default (body) + footer slots
- Extend components via slots and props, not by editing source (Open/Closed)

### Teleport
- Modals and toasts render into `<body>` via `<Teleport to="body">`

## SOLID

- **S**: One component = one UI task. One composable = one domain. One service = one API domain.
- **O**: Extend via slots/props, not source edits.
- **L**: All v-model components follow `modelValue` + `update:modelValue` contract.
- **I**: Types split by domain. Composables expose only what consumers need.
- **D**: Components → composables → services → mock/real. Swap data source = change service only.

## DRY

- UI components written once, used everywhere
- Composables extract shared business logic from views
- Types: single `Supplier` interface used in service, mock, composable, and component
- CSS: single source of truth in `src/styles/` (alias `@styles`), images in `src/assets/images/` (alias `@images`)

## DDD (Domain-Driven Design)

Code organized by business domain:
- `suppliers`: types/supplier.ts → suppliersService.ts → mocks/suppliers.ts → useSuppliers.ts → views
- `analytics`: types/analytics.ts → analyticsService.ts → mocks/analytics.ts → useAnalytics.ts → views
- `bcc`: types/bcc.ts → bccService.ts → mocks/bcc.ts → useBccRequest.ts → views
- `config`: types/config.ts → configService.ts → mocks/config.ts → useCardConfig.ts → views

## Prohibitions

- NO Options API
- NO `data-i18n` attributes
- NO unnecessary `v-html` (only when translation contains HTML like `<br>`)
- NO unused imports
- NO direct DOM manipulation (`document.querySelector`) — use composable or ref
- NO `<a href>` for navigation — use `<router-link>`
- NO copying CSS into `frontend_vue/`
- NO custom i18n composables — use vue-i18n

## Verification Checklist

After every component/page/composable:
1. `npm run typecheck` — 0 TypeScript errors
2. `npm run lint` — 0 ESLint errors
3. `npm run dev` → check in browser
4. Verify existing pages still work (regression)
5. Switch language (RU/EN/LT) — translations in place
```

## Updated CLAUDE.md Content

The updated [`frontend_vue/CLAUDE.md`](../../frontend_vue/CLAUDE.md) should:

1. Keep the essential technical content (stack, architecture, patterns)
2. Replace `/vue-rules` references with links to Roo Code files
3. Add a note at the top that Roo Code uses [`roo_code/`](../../roo_code/) for its workflow
4. Remove references to Claude Code-specific features
