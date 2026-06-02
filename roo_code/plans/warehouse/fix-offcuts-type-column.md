# Fix: Offcut Type Column in Offcuts Table

## 1. Analysis

### Current Problem

In the offcuts table at [`WarehousePage.vue:2358-2374`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:2358), the offcut type badge is rendered **inline inside the Product cell**:

```html
<td>
  <div class="th-content" style="gap: 6px;">
    <router-link ... class="name-link">
      {{ tf(offcut.productName) }}
    </router-link>
    <span v-if="offcut.offcutType"
      class="offcut-type-badge"
      :class="`offcut-type-badge--${offcut.offcutType}`"
    >
      {{ t(`warehouse.offcut_type_${offcut.offcutType}`) }}
    </span>
  </div>
</td>
```

Issues:
1. **Layout problem** — The badge is "glued" to the product name inside a flex container with `gap: 6px`, making it look cramped and unprofessional.
2. **No dedicated column** — There is no "Type" column in the table header (8 columns: Product, Batch, Length, Weight, Qty, Unit, Status, Actions).
3. **No CSS styling** — The `.offcut-type-badge` class has **zero CSS rules** defined anywhere in the project, so it renders as plain unstyled text.
4. **Not sortable** — Unlike all other columns, the offcut type cannot be used for sorting.

### Current State Summary

| Aspect | Current | Desired |
|--------|---------|---------|
| Badge location | Inside Product cell, inline | Dedicated "Type" column |
| Column order | Product → Batch → ... | Product → **Type** → Batch → ... |
| Sortable | No | Yes, by `offcutType` |
| CSS styling | None (plain text) | Styled badge per project design system |
| Header tooltip | None | `warehouse.col_offcut_type_hint` (new key) |
| Header label | N/A | `warehouse.col_type` (existing key) |

---

## 2. Solution

### What Changes and Why

1. **Remove the offcut type badge from the Product cell** — Delete the `<span class="offcut-type-badge">` from the product name cell.
2. **Add a new `<th>` for "Type"** between Product and Batch in the `<thead>` — sortable by `offcutType`, with tooltip hint.
3. **Add a new `<td>` for "Type"** in each offcut row — render the badge in its own column.
4. **Define CSS for `.offcut-type-badge`** — follow the project's reference badge pattern (`.badge-ref-*`) with distinct colors for sheet vs linear.
5. **Translation changes needed** — a new key `warehouse.col_offcut_type_hint` must be added to all three locales (ru, en, lt) in the i18n file. The existing `warehouse.col_type_hint` key describes warehouse operation types (receipt/expense/transfer), NOT offcut types (sheet/linear), so a dedicated key is required.

### Column Order After Change

| # | Column | Sort Field | Tooltip |
|---|--------|-----------|---------|
| 1 | Product | `productName` | — |
| 2 | **Type (NEW)** | **`offcutType`** | `col_offcut_type_hint` |
| 3 | Batch | `batchNumber` | `col_batch_number_hint` |
| 4 | Length | `lengthMm` | `col_length_hint` |
| 5 | Weight | `weightKg` | `col_weight_hint` |
| 6 | Qty | `quantity` | `col_quantity_hint` |
| 7 | Unit | `unit` | `col_unit_hint` |
| 8 | Location | `location` | `col_location_hint` |
| 9 | Status | `status` | `col_status_hint` |
| 10 | Actions | — | — |

---

## 3. Files to Modify

| # | File | Lines | Change |
|---|------|-------|--------|
| 1 | [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue) | 2118-2138 (Product `<th>`) | Remove `style="gap: 6px"` from Product header (cleanup) |
| 2 | Same file | 2139-2168 (Batch `<th>`) | Insert new Type `<th>` **before** this block |
| 3 | Same file | 2358-2374 (Product `<td>`) | Remove the `<span class="offcut-type-badge">` from product cell |
| 4 | Same file | 2375 (Batch `<td>`) | Insert new Type `<td>` **before** this line |
| 5 | [`frontend_vue/src/styles/admin/warehouse_list.css`](../frontend_vue/src/styles/admin/warehouse_list.css) | After line 919 | Add `.offcut-type-badge` and `.offcut-type-badge--sheet` / `.offcut-type-badge--linear` CSS rules |
| 6 | [`frontend_vue/src/i18n/admin/warehouse.ts`](../frontend_vue/src/i18n/admin/warehouse.ts) | ru:57, en:335, lt:626 | Add `col_offcut_type_hint` key after `col_type` in each locale section |

---

## 4. Step-by-Step Implementation

### Step 1: Remove badge from Product cell in `<tbody>`

**File:** [`WarehousePage.vue:2358-2374`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:2358)

**Current code:**
```html
<td>
  <div class="th-content" style="gap: 6px;">
    <router-link
      :to="{ name: 'admin-product-card', params: { id: offcut.productId } }"
      class="name-link"
    >
      {{ tf(offcut.productName) }}
    </router-link>
    <span
      v-if="offcut.offcutType"
      class="offcut-type-badge"
      :class="`offcut-type-badge--${offcut.offcutType}`"
    >
      {{ t(`warehouse.offcut_type_${offcut.offcutType}`) }}
    </span>
  </div>
</td>
```

**Replace with:**
```html
<td>
  <router-link
    :to="{ name: 'admin-product-card', params: { id: offcut.productId } }"
    class="name-link"
  >
    {{ tf(offcut.productName) }}
  </router-link>
</td>
```

Changes:
- Removed the wrapping `<div class="th-content" style="gap: 6px;">` (unnecessary now since there's only one element)
- Removed the entire `<span class="offcut-type-badge">` block

### Step 2: Add Type `<td>` in `<tbody>` rows

**File:** [`WarehousePage.vue`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — insert **after** the Product `<td>` (line 2374) and **before** the Batch `<td>` (line 2375).

**Insert this block:**
```html
<td>
  <span
    v-if="offcut.offcutType"
    class="offcut-type-badge"
    :class="`offcut-type-badge--${offcut.offcutType}`"
  >
    {{ t(`warehouse.offcut_type_${offcut.offcutType}`) }}
  </span>
  <span v-else class="text-muted">—</span>
</td>
```

Note: The `v-else` handles the edge case where `offcutType` might be null/undefined (defensive, though the type says it's always `'sheet' | 'linear'`).

### Step 3: Add Type `<th>` in `<thead>`

**File:** [`WarehousePage.vue`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — insert **after** the Product `<th>` (line 2138) and **before** the Batch `<th>` (line 2139).

**Insert this block:**
```html
<th>
  <button class="th-sort-btn" @click="toggleOffcutsSort('offcutType')">
    <div class="th-content">
      {{ t('warehouse.col_type') }}
      <span v-tooltip="t('warehouse.col_offcut_type_hint')" class="info-hint">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </span>
    </div>
    <span class="sort-icon-group">
      <SvgIcon
        name="chevron-up"
        :width="16"
        :height="16"
        class="sort-icon"
        :class="{ active: offcutsSort.sortBy === 'offcutType' && offcutsSort.sortDir === 'asc' }"
      />
      <SvgIcon
        name="chevron-down"
        :width="16"
        :height="16"
        class="sort-icon"
        :class="{ active: offcutsSort.sortBy === 'offcutType' && offcutsSort.sortDir === 'desc' }"
      />
    </span>
  </button>
</th>
```

This follows the **exact same pattern** as all other sortable column headers (e.g., Batch at line 2139, Length at line 2169).

### Step 4: Clean up Product `<th>` (optional but recommended)

**File:** [`WarehousePage.vue:2118-2138`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:2118)

The Product `<th>` currently has no tooltip and no wrapping `<div class="th-content">`. It's fine as-is — no changes needed here. It already follows the simpler pattern (just a button with text and sort icons).

### Step 5: Add CSS for `.offcut-type-badge`

**File:** [`frontend_vue/src/styles/admin/warehouse_list.css`](../frontend_vue/src/styles/admin/warehouse_list.css) — append after the reference badges section (after line 919).

```css
/* ─── Offcut type badges ──────────────────────────────────────────────────── */
.offcut-type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
}

.offcut-type-badge--sheet {
  background: rgba(24, 144, 255, 0.15);
  color: #5cb8ff;
}

.offcut-type-badge--linear {
  background: rgba(82, 196, 26, 0.15);
  color: #95de64;
}
```

**Design rationale:**
- Base `.offcut-type-badge` uses the same pattern as `.badge` (line 893-903): `display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: 500;`
- `white-space: nowrap` prevents badge text from wrapping within the cell
- Sheet type uses **blue** tones (matching `.badge-ref-purchase_order`) — sheet materials are flat/2D
- Linear type uses **green** tones (matching `.badge-ref-work_order`) — linear materials are long/extruded
- Both use `rgba(color, 0.15)` backgrounds and lighter text colors, consistent with the reference badge system

---

## 5. CSS Design Summary

| Class | Property | Value | Source |
|-------|----------|-------|--------|
| `.offcut-type-badge` | `display` | `inline-block` | `.badge` pattern |
| | `padding` | `2px 8px` | `.badge` pattern |
| | `border-radius` | `4px` | `.badge` pattern |
| | `font-size` | `0.8em` | `.badge` pattern |
| | `font-weight` | `500` | `.badge` pattern |
| | `line-height` | `1.3` | `.badge` pattern |
| | `white-space` | `nowrap` | New (prevents wrapping) |
| `.offcut-type-badge--sheet` | `background` | `rgba(24, 144, 255, 0.15)` | Blue, matching `.badge-ref-purchase_order` |
| | `color` | `#5cb8ff` | Blue, matching `.badge-ref-purchase_order` |
| `.offcut-type-badge--linear` | `background` | `rgba(82, 196, 26, 0.15)` | Green, matching `.badge-ref-work_order` |
| | `color` | `#95de64` | Green, matching `.badge-ref-work_order` |

---

## 6. Add New Translation Key `warehouse.col_offcut_type_hint`

**File:** [`frontend_vue/src/i18n/admin/warehouse.ts`](../frontend_vue/src/i18n/admin/warehouse.ts)

Add the new key `col_offcut_type_hint` **right after** the `col_type` key in each locale section.

### ru section (around line 57)

```typescript
      col_type: 'Тип',
      col_type_hint: 'Тип складской операции (поступление, расход, перемещение)',
      col_offcut_type_hint: 'Тип обрезка: листовой или линейный',
      col_priority: 'Приоритет',
```

### en section (around line 335)

```typescript
      col_type: 'Type',
      col_type_hint: 'Type of warehouse operation (receipt, expense, transfer)',
      col_offcut_type_hint: 'Offcut type: sheet or linear',
      col_priority: 'Priority',
```

### lt section (around line 626)

```typescript
      col_type: 'Tipas',
      col_type_hint: 'Sandėlio operacijos tipas (gavimas, išlaidos, perkėlimas)',
      col_offcut_type_hint: 'Atraižos tipas: lakštinis arba linijinis',
      col_priority: 'Prioritetas',
```

**Why a new key is needed:** The existing `warehouse.col_type_hint` translates to `'Type of warehouse operation (receipt, expense, transfer)'` — this describes movement/operation types, NOT offcut types (sheet vs linear). Using it for the offcut type column would show incorrect tooltip text.

---

## 7. Verification Checklist

After implementation, verify the following:

- [ ] **Product cell is clean** — The product name cell in the offcuts table no longer contains the type badge; it only shows the product name as a link.
- [ ] **New "Type" column exists** — A new column with header "Тип" / "Type" / "Tipas" appears between "Product" and "Batch" columns.
- [ ] **Badge renders correctly** — Each offcut row shows a styled badge in the Type column (blue for "Листовой"/"Sheet"/"Lakštinis", green for "Линейный"/"Linear"/"Linijinis").
- [ ] **Badge is styled** — The badge has proper padding, border-radius, font-size, and background color (not plain text).
- [ ] **Sorting works** — Clicking the Type column header sorts offcuts by `offcutType` (ascending/descending toggle), with sort icons active.
- [ ] **Tooltip works** — Hovering over the info icon in the Type header shows the `col_offcut_type_hint` tooltip.
- [ ] **No translation keys missing** — All keys used (`warehouse.col_type`, `warehouse.col_offcut_type_hint`, `warehouse.offcut_type_sheet`, `warehouse.offcut_type_linear`) exist in all three locales (ru, en, lt).
- [ ] **Edge case: null offcutType** — If `offcutType` is falsy, the cell shows `—` (em dash) instead of a badge.
- [ ] **No regressions** — All other columns (Batch, Length, Weight, Qty, Unit, Location, Status, Actions) remain unchanged.
- [ ] **Responsive** — The table layout is not broken on narrower viewports (the new column has short text content).
