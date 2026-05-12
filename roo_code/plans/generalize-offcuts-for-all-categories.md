# Plan: Generalize Offcuts System for All Product Categories

## Problem Summary

The current offcuts system only supports **sheet materials** (Листы, cat-2 / Алюминиевые листы, cat-3). The [`WarehouseOffcut`](frontend_vue/src/types/warehouse.ts:104) data model has `lengthMm`, `widthMm`, `thicknessMm` — 2D sheet dimensions. The UI table shows "Длина × Ширина" as the dimensions column.

However, **linear materials** (pipes, beams, channels, angles, rebar, profiles, wire) can also produce offcuts when cut to length. Their offcuts are characterized by a single **cut length**, not 2D width×length.

## Categories to Support

| Category | ID | Offcut Type | Unit |
|---|---|---|---|
| Листы (Sheets) | cat-2 | sheet | pcs, m² |
| Алюминиевые листы (Aluminium sheets) | cat-3 | sheet | pcs, m² |
| Трубы (Pipes) | cat-4 | linear | m |
| Балки (Beams) | cat-7 | linear | m |
| Швеллеры (Channels) | cat-8 | linear | m |
| Уголки (Angles) | cat-9 | linear | m |
| Арматура (Rebar) | cat-10 | linear | m, kg |
| Профили (Profiles) | cat-11 | linear | m, kg |
| Проволока (Wire) | cat-12 | linear | m, kg |

## Design Decision: Unified Table with Common Columns Only

All categories mixed together in one table. Only **truly common** columns are shown:

| Column | All categories | Notes |
|---|---|---|
| **Товар (Product)** | ✅ | Product name — already contains profile info (e.g. "Труба профильная 40x20") |
| **Партия № (Batch №)** | ✅ | Batch number |
| **Длина, мм (Length)** | ✅ | For sheets: lengthMm; for linear: lengthMm (cut length) |
| **Вес, кг (Weight)** | ✅ | weightKg |
| **Кол-во (Qty)** | ✅ | quantity |
| **Ед. изм. (Unit)** | ✅ | unit |
| **Место (Location)** | ✅ | location |
| **Статус (Status)** | ✅ | status |
| **Действия (Actions)** | ✅ | view/delete |

The key change: replace the current "Размеры (Д×Ш)" column with a single **"Длина, мм"** column. The detailed shape/profile info is already visible in the product name.

## Implementation Steps

### ✅ Step 1: Update Types (`frontend_vue/src/types/warehouse.ts`) — DONE

**Changes to `WarehouseOffcut` interface:**
- Add `offcutType: 'sheet' | 'linear'` field to distinguish types
- Add `categoryId: string | null` — to know which category the offcut belongs to
- Keep `lengthMm`, `widthMm`, `thicknessMm` as-is (backward compatible, still useful for sheet details)

**Changes to `OffcutListItem` interface:**
- Same additions: `offcutType`, `categoryId`

**Changes to `OffcutCreatePayload` interface:**
- Add optional `offcutType`, `categoryId`

### 🔄 Step 2: Update Mock Data (`frontend_vue/src/mocks/warehouse-offcuts.ts`) — NEEDS FIX

**Current state:** 33 offcuts total — 20 sheets (cat-2, cat-3) + 13 linear (cat-4, cat-7, cat-8, cat-9, cat-10, cat-11, cat-12).

**Problems:**
1. **Data is grouped by category** — all 20 sheets first, then pipes, beams, etc. The user wants categories **interleaved/mixed** so all categories are visible at a glance.
2. **Too few linear offcuts** — 20 sheets vs 13 linear means the table is visually dominated by sheets.

**Fix:**
- Shuffle the array so categories are interleaved (e.g., sheet, pipe, beam, sheet, angle, channel, sheet, rebar, profile, wire, sheet, ...)
- Add more linear offcuts to balance the ratio (target ~20 sheets, ~20 linear)
- Ensure all 9 categories appear throughout the list

### ✅ Step 3: Update Mock Service (`frontend_vue/src/services/mocks/warehouse.ts`) — DONE

- Update `mockCreateOffcut()` to handle new fields
- Update `mockExecuteCutting()` to pass through new fields when creating offcuts
- Update `toOffcutListItem()` mapper to include new fields

### ✅ Step 4: Update Warehouse Service (`frontend_vue/src/services/warehouseService.ts`) — DONE

- No changes needed — API layer passes through data

### ✅ Step 5: Update UI Table (`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`) — DONE

**Changes to the offcuts table (lines 1226-1371):**
- Replace "Размеры" column header with "Длина, мм"
- Replace the cell content: instead of `{{ lengthMm }}×{{ widthMm }} mm`, show just `{{ lengthMm }}` (or `—` if null)

**New column layout:**
```
| Товар | Партия № | Длина, мм | Вес, кг | Кол-во | Ед.изм. | Место | Статус | Действия |
```

### ✅ Step 6: Update Translations (`frontend_vue/src/i18n/admin/warehouse.ts`) — DONE

- Add new translation keys:
  - `col_length` / `col_length_hint` — "Длина, мм" / "Длина обрезка в миллиметрах" (ru)
  - `col_length` / `col_length_hint` — "Length, mm" / "Offcut length in millimeters" (en)
  - `col_length` / `col_length_hint` — "Ilgis, mm" / "Atraižos ilgis milimetrais" (lt)

## Data Model Changes

```typescript
export interface WarehouseOffcut {
  id: string
  batchId: string
  batchNumber: string
  productId: string
  productName: TranslatedString
  categoryId: string | null          // NEW
  offcutType: 'sheet' | 'linear'     // NEW
  lengthMm: number | null
  widthMm: number | null
  thicknessMm: number | null
  weightKg: number | null
  quantity: number
  unit: StockUnit
  location: string | null
  status: OffcutStatus
  notes: string | null
  qrData: string | null
  createdAt: string
  updatedAt: string
}
```

## UI Mockup of the New Table

```
┌─────────────────┬──────────┬───────────┬────────┬──────┬────────┬────────┬──────────┬──────────┐
│ Товар           │ Партия № │ Длина, мм │ Вес, кг│ Кол- │ Ед.изм │ Место  │ Статус   │ Действия │
├─────────────────┼──────────┼───────────┼────────┼──────┼────────┼────────┼──────────┼──────────┤
│ Лист нерж. 2мм  │ INV-...  │ 500       │ 2.36   │ 1    │ шт     │ A-01-03│ В наличии│ 👁 🗑   │
├─────────────────┼──────────┼───────────┼────────┼──────┼────────┼────────┼──────────┼──────────┤
│ Труба проф.40x20│ INV-...  │ 1200      │ 4.20   │ 1    │ шт     │ B-02-01│ В наличии│ 👁 🗑   │
├─────────────────┼──────────┼───────────┼────────┼──────┼────────┼────────┼──────────┼──────────┤
│ Балка IPE 200   │ INV-...  │ 2000      │ 45.00  │ 1    │ шт     │ H-01-01│ В наличии│ 👁 🗑   │
├─────────────────┼──────────┼───────────┼────────┼──────┼────────┼────────┼──────────┼──────────┤
│ Уголок 50x50x5  │ INV-...  │ 800       │ 3.80   │ 1    │ шт     │ H-05-01│ Зарезерв.│ 👁 🗑   │
└─────────────────┴──────────┴───────────┴────────┴──────┴────────┴────────┴──────────┴──────────┘
```

## Files to Modify

1. ✅ [`frontend_vue/src/types/warehouse.ts`](frontend_vue/src/types/warehouse.ts) — add `offcutType`, `categoryId` to `WarehouseOffcut`, `OffcutListItem`, `OffcutCreatePayload`
2. 🔄 [`frontend_vue/src/mocks/warehouse-offcuts.ts`](frontend_vue/src/mocks/warehouse-offcuts.ts) — **shuffle data to interleave categories, add more linear offcuts**
3. ✅ [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts) — update `mockCreateOffcut()`, `mockExecuteCutting()`, `toOffcutListItem()`
4. ✅ [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — update offcuts table
5. ✅ [`frontend_vue/src/i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts) — add translation keys for new columns
