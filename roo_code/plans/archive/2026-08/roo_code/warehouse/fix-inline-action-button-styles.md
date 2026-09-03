# Plan: Fix Broken Inline Action Button Styles

## Problem Summary

The CSS class `inline-action-btn` is used in the template of [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) but has **no CSS definition** anywhere in the project. This causes the following buttons to render without proper styling:

### Offcuts tab (lines 2407-2425)
- **"использован" (Mark Used)** button — `inline-action-btn inline-action-btn--used`
- **"в утиль" (Mark Scrap)** button — `inline-action-btn inline-action-btn--scrap`

### Deficit tab (lines 3202-3222)
- **"в работе" (Mark In Progress)** button — `inline-action-btn inline-action-btn--used`
- **"решён" (Mark Resolved)** button — `inline-action-btn inline-action-btn--used`

## Current State

The buttons use class `inline-action-btn` with modifier `inline-action-btn--used` or `inline-action-btn--scrap`, but neither the base class nor the modifiers have any CSS rules defined. The buttons appear as unstyled HTML `<button>` elements.

## Design System Context

The project has a well-defined button system in [`_buttons.css`](frontend_vue/src/styles/admin/components/_buttons.css) and [`_action-icons.css`](frontend_vue/src/styles/admin/components/_action-icons.css):

- **`.action-icon-btn`** — 32×32px icon-only buttons for table actions (view, edit, delete)
- **`.btn`** — Base button class with padding, gap, border-radius, etc.
- **`.btn-sm`** — Small variant (4px 10px padding, 11px font)
- **`.btn-primary`** — Primary blue button
- **`.btn-success`** — Green success button
- **`.btn-danger`** — Red danger button

The `inline-action-btn` buttons are **text + icon buttons** that appear inline in table rows (inside `.row-actions` flex container). They should be visually distinct from the icon-only `.action-icon-btn`.

## Solution

Add CSS rules for `.inline-action-btn` and its modifiers (`.inline-action-btn--used`, `.inline-action-btn--scrap`) to the warehouse stylesheet [`warehouse_list.css`](frontend_vue/src/styles/admin/warehouse_list.css), following the existing design system patterns.

### Button Design Specifications

Based on the existing design system:

| Property | Value |
|----------|-------|
| Display | `inline-flex` (align items center, gap 6px) |
| Padding | `6px 12px` (compact for table rows) |
| Font size | `12px` (smaller than standard 14px for table context) |
| Font weight | `500` |
| Border radius | `6px` |
| Border | `1px solid` with transparency |
| Background | Semi-transparent |
| Transition | `all 0.2s ease` |

### Color Variants

#### `inline-action-btn--used` (использован / в работе / решён)
- **Default**: Green-tinted (matching success/used action semantics)
  - Border: `rgba(82, 196, 26, 0.3)` (green)
  - Color: `#52c41a` (green text)
  - Background: `rgba(82, 196, 26, 0.08)`
- **Hover**: Stronger green
  - Background: `rgba(82, 196, 26, 0.15)`
  - Border: `rgba(82, 196, 26, 0.5)`
  - Color: `#73d13d` (lighter green)

#### `inline-action-btn--scrap` (в утиль)
- **Default**: Orange/warning-tinted (matching scrap/disposal semantics)
  - Border: `rgba(250, 173, 20, 0.3)` (orange)
  - Color: `#fadb14` (yellow text)
  - Background: `rgba(250, 173, 20, 0.08)`
- **Hover**: Stronger orange
  - Background: `rgba(250, 173, 20, 0.15)`
  - Border: `rgba(250, 173, 20, 0.5)`
  - Color: `#ffe58f` (lighter yellow)

## Implementation Steps

### Step 1: Add CSS to `warehouse_list.css`

Add the `.inline-action-btn` base class and its modifiers after the existing `.row-actions` section (around line 420).

**Location**: [`frontend_vue/src/styles/admin/warehouse_list.css`](frontend_vue/src/styles/admin/warehouse_list.css) — after line 420 (after `.row-actions` block)

**CSS to add**:

```css
/* ─── Inline action buttons (text + icon in table rows) ──────────────────── */

.inline-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  line-height: 1;
  font-family: inherit;
}

.inline-action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.inline-action-btn svg {
  flex-shrink: 0;
  display: block;
}

/* Used / Success variant (использован, в работе, решён) */
.inline-action-btn--used {
  border-color: rgba(82, 196, 26, 0.3);
  color: #52c41a;
  background: rgba(82, 196, 26, 0.08);
}

.inline-action-btn--used:hover {
  background: rgba(82, 196, 26, 0.15);
  border-color: rgba(82, 196, 26, 0.5);
  color: #73d13d;
}

/* Scrap / Warning variant (в утиль) */
.inline-action-btn--scrap {
  border-color: rgba(250, 173, 20, 0.3);
  color: #fadb14;
  background: rgba(250, 173, 20, 0.08);
}

.inline-action-btn--scrap:hover {
  background: rgba(250, 173, 20, 0.15);
  border-color: rgba(250, 173, 20, 0.5);
  color: #ffe58f;
}
```

### Step 2: Verify the fix

1. Check that the buttons render with proper styling in the browser
2. Verify hover states work correctly
3. Ensure the buttons remain compact enough to fit in table rows
4. Check that the deficit "в работе" and "решён" buttons both use the green `--used` variant (they currently both use `inline-action-btn--used` class, which is correct)

## Files to Modify

| File | Change |
|------|--------|
| [`frontend_vue/src/styles/admin/warehouse_list.css`](frontend_vue/src/styles/admin/warehouse_list.css) | Add `.inline-action-btn` CSS rules after line 420 |

## Verification Checklist

- [ ] Offcuts tab: "использован" button has green styling
- [ ] Offcuts tab: "в утиль" button has orange/warning styling
- [ ] Deficit tab: "в работе" button has green styling
- [ ] Deficit tab: "решён" button has green styling
- [ ] All buttons have proper hover states
- [ ] Buttons fit correctly in table row layout
- [ ] SVG icons inside buttons are properly aligned
- [ ] No existing styles are broken
