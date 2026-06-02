# Plan: Restructure WarehouseStockCard to Match ProductCardPage Pattern

## Problem

The save button overlaps `.info-hint` tooltips because of a structural stacking context issue.

## Root Cause

In [`ProductCardPage.vue`](frontend_vue/src/views/admin/products/ProductCardPage.vue:148), `<GlassPanel>` components are **inside** grid columns (`.entity-col-left > GlassPanel`, `.entity-col-center > GlassPanel`). The header with buttons is completely separate from GlassPanel's stacking context.

In [`WarehouseStockCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue:71), a single `<GlassPanel>` **wraps the entire grid**. GlassPanel has `position: relative` ([`_glass-panel.css:4`](frontend_vue/src/styles/admin/components/_glass-panel.css:4)) which creates a CSS stacking context. The `.info-hint` tooltips (`::after` with `position: absolute`) extend upward from inside this stacking context, while the save buttons in the header are in the root stacking context. Even with `z-index: 1002`, the tooltip is painted within GlassPanel's context and the button (in root context) renders on top.

## Solution

Restructure to match ProductCardPage exactly:

### Current Structure (broken)
```html
<div class="page-stock-card">
  <div class="stock-card-header">
    <Breadcrumb />
    <div class="stock-card-header-row">
      <div class="entity-action-bar no-margin pos-static" />
    </div>
  </div>
  <GlassPanel>  <!-- position:relative creates stacking context -->
    <div class="stock-card-content">
      <div class="entity-card-grid">
        <div class="entity-col-left">...</div>
        <div class="entity-col-center">...</div>
        <div class="entity-col-right">...</div>
      </div>
    </div>
  </GlassPanel>
</div>
```

### Target Structure (matching ProductCardPage)
```html
<div class="page-stock-card">
  <div class="stock-card-header">
    <Breadcrumb />
    <div class="stock-card-header-row">
      <div class="entity-action-bar no-margin pos-static" />
    </div>
  </div>
  <div class="main-card-content">
    <div class="entity-card-grid">
      <div class="entity-col-left">
        <GlassPanel>  <!-- GlassPanel INSIDE column -->
          <!-- left column fields: product, category, unit, avg_price -->
        </GlassPanel>
      </div>
      <div class="entity-col-center">
        <GlassPanel>  <!-- GlassPanel INSIDE column -->
          <!-- center column fields: min_stock, total_qty, reserved, available -->
        </GlassPanel>
      </div>
      <div class="entity-col-right">
        <GlassPanel>  <!-- GlassPanel INSIDE column -->
          <!-- right column fields: batches, total_value -->
        </GlassPanel>
      </div>
    </div>
  </div>
</div>
```

## Changes Required

### 1. [`WarehouseStockCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue) — Template

- Remove the single wrapping `<GlassPanel>` (line 71)
- Remove `<div class="stock-card-content">` wrapper (line 94)
- Add `<div class="main-card-content">` wrapper around `.entity-card-grid`
- Wrap each column's content in its own `<GlassPanel>`:
  - `.entity-col-left > GlassPanel` — product, category, unit, avg_price
  - `.entity-col-center > GlassPanel` — min_stock, total_qty, reserved, available
  - `.entity-col-right > GlassPanel` — batches, total_value
- Move `:loading` and `:skeleton-rows` props to the first GlassPanel (left column) — or all three for consistency
- Move error/not-found states **outside** the grid (before `.main-card-content`), wrapped in their own GlassPanel

### 2. [`WarehouseStockCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue) — Scoped CSS

**Remove** these overrides (lines 304-347):
- `.stock-card-header .entity-action-bar { position: static !important; z-index: auto }` — no longer needed since GlassPanel won't create a conflicting stacking context
- `.page-stock-card .glass-panel { position: static }` — no longer needed
- `.stock-card-content .entity-card-grid { overflow: visible }` — no longer needed (tooltips won't extend into header)
- `.stock-card-content .info-hint { z-index: 1002 }` — no longer needed (global `_forms.css` handles this)
- `.stock-card-content .info-hint::after { z-index: 1003 }` — no longer needed
- `@media (max-width: 400px)` override for `.info-hint::after` — no longer needed (tooltips are inside GlassPanel, won't extend into header)

**Keep** these structural styles:
- `.page-stock-card { padding: 0 }`
- `.stock-card-header { margin-bottom: 24px }`
- `.stock-card-header-row { display: flex; align-items: center; gap: 12px; margin-top: 16px }`

### 3. Loading/Error States

Currently, `<GlassPanel :loading="loading">` handles loading state. With multiple GlassPanels, we need to decide:
- **Option A**: Show loading state in all three GlassPanels (all get `:loading="loading"`)
- **Option B**: Show a single loading state outside the grid, then show the grid with data

**Recommendation**: Use **Option A** — all three GlassPanels get `:loading="loading" :skeleton-rows="4"`. This matches how ProductCardPage handles it (each GlassPanel has its own loading state).

For error/not-found states, show them **before** `.main-card-content`, wrapped in a single GlassPanel.

### 4. No Changes Needed

- The composable [`useWarehouseStockCard.ts`](frontend_vue/src/composables/useWarehouseStockCard.ts) — no changes
- The global CSS files — no changes
- The router — no changes
- i18n translations — no changes

## Verification

After implementation:
1. Tooltip should render above save button without any z-index hacks
2. Mobile tooltip centering should work via global `_forms.css` rules
3. No visual regression in card layout
4. Loading skeleton should show in all three columns
5. Error/not-found states should display correctly
