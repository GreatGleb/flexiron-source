# Plan: Add Tooltip Hints to Batches Tab Column Headers

## Objective

Add info-hint tooltips (info icons with `v-tooltip`) to all column headers in the **batches tab** of the warehouse page, matching the pattern already implemented in the **stock tab**.

## Current State

The batches tab has 10 columns in [`WarehousePage.vue`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:987):

| # | Translation Key | Current Header |
|---|-----------------|----------------|
| 1 | `warehouse.col_product` | Product name |
| 2 | `warehouse.col_batch_number` | Batch # |
| 3 | `warehouse.col_lot_code` | Lot Code |
| 4 | `warehouse.col_quantity` | Quantity |
| 5 | `warehouse.col_remaining` | Remaining |
| 6 | `warehouse.col_unit` | Unit |
| 7 | `warehouse.col_unit_price` | Unit Price |
| 8 | `warehouse.col_received` | Received |
| 9 | `warehouse.col_status` | Status |
| 10 | `warehouse.col_actions` | Actions (no tooltip needed) |

Currently, all headers are plain `<th>` elements with just `{{ t('warehouse.col_xxx') }}`.

## Stock Tab Pattern (Reference)

The stock tab uses this pattern (see lines 636-704):

```html
<!-- For sortable columns (with th-sort-btn): -->
<th>
  <button class="th-sort-btn" @click="toggleStockSort('totalQuantity')">
    <div class="th-content">
      {{ t('warehouse.col_total_qty') }}
      <span v-tooltip="t('warehouse.col_total_qty_hint')" class="info-hint">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </span>
    </div>
    <span class="sort-icon-group">...</span>
  </button>
</th>

<!-- For non-sortable columns (plain th): -->
<th>
  <div class="th-content">
    {{ t('warehouse.col_batches') }}
    <span v-tooltip="t('warehouse.col_batches_hint')" class="info-hint">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </span>
  </div>
</th>
```

## Changes Required

### 1. Add Translation Hint Keys

Add `_hint` variants for each batches column in [`warehouse.ts`](../frontend_vue/src/i18n/admin/warehouse.ts). The batches columns use these existing keys:

| Column Key | Hint Key | Russian Hint | English Hint | Lithuanian Hint |
|---|---|---|---|---|
| `col_product` | `col_product_hint` | Наименование товара | Product name | Prekės pavadinimas |
| `col_batch_number` | `col_batch_number_hint` | Уникальный номер партии поставщика | Unique supplier batch number | Unikalus tiekėjo partijos numeris |
| `col_lot_code` | `col_lot_code_hint` | Внутренний код лота на складе | Internal warehouse lot code | Vidinis sandėlio loto kodas |
| `col_quantity` | `col_quantity_hint` | Общее количество в партии | Total quantity in batch | Bendras kiekis partijoje |
| `col_remaining` | `col_remaining_hint` | Оставшееся количество после расходов | Remaining quantity after consumption | Likutis po sunaudojimo |
| `col_unit` | `col_unit_hint` | Единица измерения товара | Product unit of measurement | Prekės matavimo vienetas |
| `col_unit_price` | `col_unit_price_hint` | Цена за единицу товара | Price per unit of product | Kaina už prekės vienetą |
| `col_received` | `col_received_hint` | Дата поступления партии на склад | Date batch was received at warehouse | Partijos gavimo į sandėlį data |
| `col_status` | `col_status_hint` | Текущий статус партии | Current batch status | Dabartinė partijos būsena |

**Note:** `col_unit_hint` already exists in all 3 locales (lines 36, 241, 451), so it only needs the `th-content` wrapper + tooltip span in the template — no new translation key needed.

**Note:** `col_actions` does NOT get a tooltip (it's a standard actions column).

### 2. Update Batches Tab Template

In [`WarehousePage.vue`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:986-997), replace the plain `<th>` elements with the `th-content` + `info-hint` pattern:

```html
<thead>
  <tr>
    <!-- col_product -->
    <th>
      <div class="th-content">
        {{ t('warehouse.col_product') }}
        <span v-tooltip="t('warehouse.col_product_hint')" class="info-hint">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </span>
      </div>
    </th>
    <!-- col_batch_number -->
    <th>
      <div class="th-content">
        {{ t('warehouse.col_batch_number') }}
        <span v-tooltip="t('warehouse.col_batch_number_hint')" class="info-hint">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </span>
      </div>
    </th>
    <!-- ... repeat for each column ... -->
    <!-- col_actions - NO tooltip -->
    <th class="th-actions">{{ t('warehouse.col_actions') }}</th>
  </tr>
</thead>
```

## Files to Modify

1. **`frontend_vue/src/i18n/admin/warehouse.ts`** — Add `_hint` keys for ru/en/lt locales
2. **`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`** — Wrap batches tab headers with `th-content` + `info-hint` span

## Verification

- Run `npm run type-check` or `npx vue-tsc --noEmit` to verify TypeScript compilation
- Visually verify that info icons appear next to each batches column header
- Hover over each info icon to verify the tooltip text appears
