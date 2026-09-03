# Fix: CustomSelect Dropdown Overlapped by Movements Section

## Problem

On the Warehouse Batch Card page (`/admin/warehouse/batches/whb-001`), when the status `CustomSelect` dropdown is opened (right column of the entity card grid), the dropdown list is visually overlapped by the "Movements" (`Движения по партии`) section that appears below it.

## Root Cause Analysis

### DOM Structure

```
.page-batch-card (flex column)
  └── .main-card-content
        ├── .entity-card-grid (display: grid; overflow: visible;)
        │     ├── .entity-col-left > .glass-panel
        │     ├── .entity-col-center > .glass-panel
        │     └── .entity-col-right > .glass-panel
        │           └── .custom-select-wrap (position: relative;)
        │                 └── .custom-select-list (position: absolute; z-index: 1001;)
        │
        ├── .glass-panel (Movements)  ← **overlaps the dropdown**
        ├── .glass-panel (Offcuts)
        ├── .glass-panel (Files)
        └── .audit-panel-wide > .glass-panel (Audit)
```

### Key Finding: `main.css` is NOT imported

The file [`frontend_vue/src/styles/admin/main.css`](frontend_vue/src/styles/admin/main.css) contains `.glass-panel { position: relative; }` (line 284), but **this file is never imported anywhere** in the application. It's an orphan file.

The actual CSS that applies to `.glass-panel` comes from:
- [`frontend_vue/src/styles/admin/components/_glass-panel.css`](frontend_vue/src/styles/admin/components/_glass-panel.css) — imported via [`admin-core.scss`](frontend_vue/src/styles/admin/admin-core.scss) (line 10) which is imported by [`AdminLayout.vue`](frontend_vue/src/layouts/AdminLayout.vue) (line 9)
- This file does **NOT** have `position: relative` on `.glass-panel`

### Stacking Context Chain

Since `.glass-panel` has **no** `position: relative`:
1. The `.custom-select-wrap` (with `position: relative`) creates the **only** stacking context for the dropdown
2. The `.custom-select-list` with `z-index: 1001` is confined to this stacking context
3. The Movements `.glass-panel` is a **sibling of `.entity-card-grid`** inside `.main-card-content`
4. Since neither `.glass-panel` nor `.entity-card-grid` has `position: relative`, they don't create stacking contexts
5. The Movements `.glass-panel` comes **after** `.entity-card-grid` in DOM order, so it paints on top

### Why Previous Fixes Didn't Work

1. **`.glass-panel:has(.custom-select-list.open) { z-index: 100 !important; }`** — No effect because `.glass-panel` has no `position: relative`, so `z-index` doesn't apply.

2. **`.entity-card-grid:has(.custom-select-list.open) { position: relative; z-index: 1; }`** — Should theoretically work, but the `:has()` selector was added to `main.css` which is **not loaded**. Even if it were loaded, the `.entity-card-grid` rule in `_entity-card-layout.css` (which IS loaded) doesn't have `position: relative`.

## Fix Plan

### Step 1: Add `position: relative` to `.glass-panel` in the ACTUALLY loaded CSS

File: [`frontend_vue/src/styles/admin/components/_glass-panel.css`](frontend_vue/src/styles/admin/components/_glass-panel.css)

Add `position: relative;` to the `.glass-panel` rule (line 2-4). This is the file that's actually imported and used.

### Step 2: Add the dropdown-open elevation rule to the correct file

File: [`frontend_vue/src/styles/admin/components/_glass-panel.css`](frontend_vue/src/styles/admin/components/_glass-panel.css)

Add a rule that elevates the `.glass-panel` when its child `.custom-select-list` is open:
```css
.glass-panel:has(.custom-select-list.open) {
  z-index: 100 !important;
}
```

This will now work because `.glass-panel` has `position: relative`.

### Step 3: Elevate the entire `.entity-card-grid` when dropdown is open

File: [`frontend_vue/src/styles/admin/components/_entity-card-layout.css`](frontend_vue/src/styles/admin/components/_entity-card-layout.css)

Add:
```css
.entity-card-grid:has(.custom-select-list.open) {
  position: relative;
  z-index: 1;
}
```

This ensures the entire grid (including all its children) paints above subsequent siblings like the Movements section.

### Why This Will Work

With `position: relative` on `.glass-panel`:
- The `.glass-panel:has(.custom-select-list.open)` rule creates a stacking context with `z-index: 100`
- The `.entity-card-grid:has(.custom-select-list.open)` rule creates a stacking context with `z-index: 1` on the grid itself
- Since the Movements `.glass-panel` has no `z-index` and no `position: relative`, it stays at the default paint order
- The elevated `.entity-card-grid` (with `z-index: 1`) will paint **above** the Movements section

### Alternative: Simpler Fix

If the `:has()` selector approach is too complex, a simpler fix would be to just add `position: relative` to `.glass-panel` in `_glass-panel.css` and then the existing `.glass-panel:has(.custom-select-list.open) { z-index: 100 !important; }` in `main.css` would work — **but only if `main.css` were imported**.

Since `main.css` is not imported, we need to put the fix in the files that ARE actually loaded.

## Files to Modify

1. [`frontend_vue/src/styles/admin/components/_glass-panel.css`](frontend_vue/src/styles/admin/components/_glass-panel.css) — Add `position: relative` and the `:has()` elevation rule
2. [`frontend_vue/src/styles/admin/components/_entity-card-layout.css`](frontend_vue/src/styles/admin/components/_entity-card-layout.css) — Add the grid-level elevation rule
