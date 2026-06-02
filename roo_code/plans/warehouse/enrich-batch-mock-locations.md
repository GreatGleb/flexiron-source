# Plan: Enrich Batch Mock Data with Structured Location Fields

## Context

The batch card location section was extracted into a dedicated [`GlassPanel`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:601) with four fields:

| Field | i18n key | Type |
|-------|----------|------|
| **Rack** (Стеллаж) | `field_location_rack` | text input |
| **Row** (Ряд) | `field_location_row` | text input |
| **Cell** (Ячейка) | `field_location_cell` | text input |
| **Notes** (Заметки о месте) | `field_location_notes` | textarea |

The API stores location as a single string in the format:
```
Rack: {rack} | Row: {row} | Cell: {cell}
Notes: {notes}
```

Parsing/composition logic is in [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts:11-49).

## Current State

All 100 batches in [`warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts) have `location` as a simple legacy string like `"A-01-01"`, `"B-02-01"`, etc. This means when parsed, only `locationRack` gets filled (with the whole string), while `locationRow` and `locationCell` remain empty.

## Goal

Update all 100 batch mock entries so that:
1. **Every batch** has `location` in the new format: `"Rack: {rack} | Row: {row} | Cell: {cell}"`
2. **At least 50 batches (≥50%)** have `locationNotes` appended via `\nNotes: {notes}`
3. The data is **realistic** — reflecting real warehouse scenarios

## Warehouse Layout Reference

| Zone | Category | Rack prefix | Rack range |
|------|----------|-------------|------------|
| A | Листы / Sheets | A | A-01 through A-10 |
| B | Трубы / Pipes | B | B-01 through B-11 |
| C | Расходные материалы / Consumables | C | C-01 through C-07 |
| D | Газы / Gases | D | D-01 through D-06 |
| E | Абразив / Abrasives | E | E-01 through E-02 |
| F | Инструмент / Tools | F | F-01 through F-03 |
| G | Оборудование / Equipment | G | G-01 through G-03 |
| H | Балки и швеллеры / Beams & Channels | H | H-01 through H-06 |
| I | Арматура / Rebar | I | I-01 through I-02 |
| J | Профили / Profiles | J | J-01 through J-03 |
| K | Фитинги / Fittings | K | K-01 through K-02 |
| L | Прочее / Other | L | L-01 |

Each rack has rows (01-05) and cells (01-10).

## Location Notes Scenarios (≥50% of batches)

Below are the scenarios where `locationNotes` should be filled, with realistic warehouse situations:

### Scenario 1: Split across multiple cells within same rack (15 batches)
The batch is too large for one cell and spills into adjacent cells.
- **Notes example**: `"Часть партии также в ячейках 02-03 этого же ряда"` / `"Part of batch also in cells 02-03 of same row"`

### Scenario 2: Split across multiple racks/zones (10 batches)
The batch is stored in different zones entirely (e.g., some on rack A, some on rack B).
- **Notes example**: `"50% материала на стеллаже B-03, ряд 02, ячейки 04-05"` / `"50% of material on rack B-03, row 02, cells 04-05"`

### Scenario 3: Hard-to-reach / special handling (8 batches)
The location requires equipment or special care.
- **Notes example**: `"Требуется погрузчик — верхний ряд"` / `"Requires forklift — top row"`

### Scenario 4: Reserved / blocked location (6 batches)
Space is shared with another batch or reserved for an order.
- **Notes example**: `"Ячейка частично занята партией #whb-045"` / `"Cell partially occupied by batch #whb-045"`

### Scenario 5: Temporary / overflow storage (5 batches)
Batch is temporarily stored in a non-standard location.
- **Notes example**: `"Временно на проходе, ожидает перемещения на стеллаж C-04"` / `"Temporarily in aisle, awaiting transfer to rack C-04"`

### Scenario 6: Environmental conditions (4 batches)
Material requires specific storage conditions.
- **Notes example**: `"Хранить вдали от источников влаги. Не штабелировать более 3 рядов."` / `"Keep away from moisture. Do not stack more than 3 rows high."`

### Scenario 7: Quality hold / quarantine (4 batches)
Batch is under inspection and separated.
- **Notes example**: `"На карантине — ожидает проверки качества. Не использовать!"` / `"On quarantine — awaiting quality inspection. Do not use!"`

### Scenario 8: Mixed with other material (3 batches)
Different materials share the same cell.
- **Notes example**: `"В одной ячейке с листами 3мм (партия #whb-008)"` / `"In same cell as 3mm sheets (batch #whb-008)"`

**Total with notes: 55 batches (55%)** — meets the ≥50% requirement.

## Data Transformation Rules

For each batch, the current `location` value (e.g., `"A-01-01"`) will be decomposed as:
- **Rack**: The first two parts (e.g., `"A-01"`)
- **Row**: The third part (e.g., `"01"`)
- **Cell**: The fourth part (e.g., `"01"`)

Then the new format becomes:
```
Rack: A-01 | Row: 01 | Cell: 01
```

If notes exist, append:
```
Rack: A-01 | Row: 01 | Cell: 01
Notes: {notes text}
```

## Implementation Steps

1. **Edit** [`warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts) — update all 100 `location` values to the new format
2. **Verify** that the parsing logic in [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts) correctly handles the new format
3. **Verify** that the batch card displays Rack, Row, Cell, and Notes correctly

## Files to Modify

| File | Change |
|------|--------|
| [`frontend_vue/src/mocks/warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts) | Update all 100 `location` values to new format with notes |

## What NOT to Change

- **API types** — `location` field stays as `string | null` in [`WarehouseBatch`](frontend_vue/src/types/warehouse.ts:65)
- **Composable** [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts) — parsing logic already handles both legacy and new format
- **Template** [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) — already renders the location section
- **i18n** — keys already exist
- **Other mock files** — offcuts, movements remain unchanged

## Verification

After changes, open any batch card in the UI and confirm:
1. Rack field shows the rack value (e.g., `"A-01"`)
2. Row field shows the row value (e.g., `"01"`)
3. Cell field shows the cell value (e.g., `"01"`)
4. Notes field shows the location notes (if applicable)
5. Saving the batch composes the fields back correctly
