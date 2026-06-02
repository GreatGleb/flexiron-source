# Plan: Fix Batch Card Movements Table Styling

## Problem

On [`http://localhost:5173/admin/warehouse/batches/whb-001`](http://localhost:5173/admin/warehouse/batches/whb-001), the **Batch Movements** section uses a custom `batch-card-mini-table` class that has **no CSS definition** anywhere in the stylesheets. This means the movements table renders with **no styling** — it looks like a plain unstyled HTML table, unlike all other tables in the app which use the standard `.data-table` class.

The user correctly notes this looks like the "mini-table" from the supplier card's **Pricing & Order History** section, which uses `.history-table` — but even that is a different pattern from the main app tables.

## Current Implementation

In [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:332), the movements table is:

```html
<table class="batch-card-mini-table" data-test="batch-card-movements-table">
```

And the offcuts table similarly at line 358:

```html
<table v-else-if="offcuts.length" class="batch-card-mini-table" data-test="batch-card-offcuts-table">
```

The class `batch-card-mini-table` has **zero CSS definitions** anywhere in the project (confirmed by search). The table renders with default browser table styling — no borders, no padding, no hover effects, no text colors matching the dark theme.

## Standard Table Patterns in the App

There are **two** established table patterns:

### 1. `.data-table` — Main list tables (warehouse, products, suppliers, etc.)

Defined in [`frontend_vue/src/styles/erp-base.css`](frontend_vue/src/styles/erp-base.css:571) with:
- `width: 100%; border-collapse: collapse;`
- Uppercase, letter-spaced header styling
- `rgba(255, 255, 255, 0.35)` header color
- `rgba(255, 255, 255, 0.65)` cell text color
- Row hover effect (`rgba(24, 144, 255, 0.06)`)
- Alternating row backgrounds
- Responsive breakpoints in `main.css`

### 2. `.history-table` — Mini-tables inside cards (supplier card Pricing & Order History)

Defined in [`frontend_vue/src/styles/admin/components/_tables.css`](frontend_vue/src/styles/admin/components/_tables.css:7) with:
- Same header styling as `.data-table`
- Slightly different padding
- Hover effect: `rgba(255, 255, 255, 0.04)` background + white text
- No alternating row backgrounds
- Responsive breakpoints included

## Recommended Solution

Replace the custom `batch-card-mini-table` class with the standard `.data-table` class, wrapped in a `.table-responsive` container (matching the pattern used everywhere else).

### Changes Required

#### 1. [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue)

**Movements table** (lines 332-349):
- Change `<table class="batch-card-mini-table">` → `<div class="table-responsive"><table class="data-table">`
- Add closing `</div>` after `</table>`

**Offcuts table** (lines 358-387):
- Same change: `<table class="batch-card-mini-table">` → `<div class="table-responsive"><table class="data-table">`
- Add closing `</div>` after `</table>`

#### 2. No CSS changes needed

Since `.data-table` is already defined in `erp-base.css` (which is globally loaded), and `.table-responsive` is defined in `_tables.css` (also globally loaded via `main.css`), no additional CSS is required.

The tables will automatically inherit:
- Proper dark-theme styling
- Hover effects
- Responsive behavior
- Alternating row colors

### Visual Comparison

| Before | After |
|--------|-------|
| Plain unstyled HTML table | Dark-themed table matching app design |
| No hover effects | Row hover highlight (blue tint) |
| Default browser colors | Proper `rgba(255,255,255,0.65)` text |
| No alternating rows | Even rows get subtle background |
| No responsive handling | `.table-responsive` wrapper with overflow-x |

### Files to Modify

1. [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) — 2 changes (movements table + offcuts table)
