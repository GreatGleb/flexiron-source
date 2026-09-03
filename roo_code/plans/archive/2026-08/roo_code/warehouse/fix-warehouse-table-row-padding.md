# Fix: Consistent Row Padding in Warehouse Tables

## Problem

In all warehouse tables (Stock, Batches, Offcuts, Movements, Deficit), when a product name wraps to 2+ lines, the vertical padding (top/bottom) disappears — the text sits flush against the cell borders. When the name fits on one line, the row looks correctly spaced.

## Root Cause

The base style in [`erp-base.css`](frontend_vue/src/styles/erp-base.css:585-591) defines:

```css
.data-table td {
  height: 40px;
  padding: 0 0.75rem;   /* ← zero vertical padding! */
  ...
}
```

The row height comes entirely from `height: 40px`, not from padding. When text wraps to 2+ lines, the content exceeds 40px, the cell grows to accommodate it, but since `padding-top` and `padding-bottom` are `0`, the text sits flush against the top and bottom cell borders — no visible spacing.

For single-line names, the `height: 40px` provides enough room with some implicit spacing (text is vertically centered in the 40px cell).

## Tables Affected

All 5 tabs in `/admin/warehouse/` — the product name column in each:

| Tab | Table type | Product name cell |
|-----|-----------|-------------------|
| **Stock** | Split-table fixed column | `.stock-table-fixed .data-table td` |
| **Batches** | Regular table | `.data-table-wrapper .data-table td:first-child` |
| **Offcuts** | Regular table | `.data-table-wrapper .data-table td:first-child` |
| **Movements** | Regular table | `.data-table-wrapper .data-table td:first-child` |
| **Deficit** | Regular table | `.data-table-wrapper .data-table td:first-child` |

## Solution

**Replace `height: 40px` with `padding-top`/`padding-bottom` on the product name `<td>` cells.** This ensures consistent vertical spacing regardless of text wrapping, without increasing the visual height for single-line names.

### Calculation

Current single-line cell height: `40px` (from `height` property)
- Font-size: ~13.6px (0.85rem)
- Line-height: ~18px (browser default ~1.3)
- Implicit vertical centering in 40px cell leaves ~11px top and bottom

Target: `padding-top: 11px; padding-bottom: 11px;` with `height: auto` (remove fixed height).

This gives:
- Single-line: `11px + ~18px + 11px = ~40px` — same as before ✓
- Multi-line (2 lines): `11px + ~36px + 11px = ~58px` — padding preserved ✓
- Multi-line (3 lines): `11px + ~54px + 11px = ~76px` — padding preserved ✓

### Implementation

#### File: [`warehouse_list.css`](frontend_vue/src/styles/admin/warehouse_list.css)

**Change 1 — Stock split-table fixed column (product name):**

Replace the existing rule at ~line 602:
```css
.stock-table-fixed .data-table td {
  white-space: normal;
}
```

With:
```css
.stock-table-fixed .data-table td {
  white-space: normal;
  height: auto;
  padding-top: 11px;
  padding-bottom: 11px;
}
```

**Change 2 — Other 4 tabs (Batches, Offcuts, Movements, Deficit):**

The product name is the first column (`td:first-child`) in these regular tables. Add a new rule:
```css
/* Consistent vertical padding for product name cells in warehouse tables */
.data-table-wrapper .data-table td:first-child {
  height: auto;
  padding-top: 11px;
  padding-bottom: 11px;
}
```

**Change 3 — Responsive adjustments:**

The `height: 40px` is a desktop base. At smaller breakpoints, the font-size shrinks, so the padding needs to adjust proportionally. Add responsive overrides:

```css
@media (max-width: 768px) {
  .stock-table-fixed .data-table td,
  .data-table-wrapper .data-table td:first-child {
    padding-top: 10px;
    padding-bottom: 10px;
  }
}

@media (max-width: 600px) {
  .stock-table-fixed .data-table td,
  .data-table-wrapper .data-table td:first-child {
    padding-top: 8px;
    padding-bottom: 8px;
  }
}

@media (max-width: 480px) {
  .stock-table-fixed .data-table td,
  .data-table-wrapper .data-table td:first-child {
    padding-top: 6px;
    padding-bottom: 6px;
  }
}

@media (max-width: 320px) {
  .stock-table-fixed .data-table td,
  .data-table-wrapper .data-table td:first-child {
    padding-top: 5px;
    padding-bottom: 5px;
  }
}
```

**Important:** The existing responsive rules in [`warehouse_list.css`](frontend_vue/src/styles/admin/warehouse_list.css:481-524) already set `.page-warehouse .data-table td` padding at these breakpoints. However, those set `padding` (all 4 sides), which includes horizontal padding. Our new rules only set `padding-top` and `padding-bottom`, so they won't conflict with the horizontal padding from the existing rules.

## Verification

After applying the changes:

1. **Single-line product name** — cell height should remain ~40px (same as before)
2. **Multi-line (2-3 line) product name** — cell should have consistent 11px top/bottom padding
3. **All 5 tabs** — Stock, Batches, Offcuts, Movements, Deficit should all show consistent row padding
4. **Responsive breakpoints** — padding should scale correctly at 768px, 600px, 480px, 320px
5. **No double-padding** — the `height: auto` + `padding-top`/`padding-bottom` approach replaces the fixed height mechanism, so there's no stacking

## Files to modify

| File | Changes |
|------|---------|
| [`frontend_vue/src/styles/admin/warehouse_list.css`](frontend_vue/src/styles/admin/warehouse_list.css) | Add/modify CSS rules as described above |
