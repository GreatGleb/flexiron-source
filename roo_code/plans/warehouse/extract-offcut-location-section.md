# Plan: Extract Offcut Location into a Dedicated Section

## Problem

Currently, the offcut card has a single [`form.location`](frontend_vue/src/composables/useWarehouseOffcutCard.ts:24) field (type `text`, `v-model="form.location"`) placed in the right column of the entity card grid. It's just one input among many, with no special treatment.

The user wants to replace this single field with a dedicated **Location section** (similar to what exists in the batch card at [`WarehouseBatchCard.vue:602-679`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:602)), containing structured sub-fields: rack, row, cell, and notes.

## Current Implementation

### Offcut Card Template (right column, lines 438-455)
```html
<div class="input-group">
  <label class="field-label">
    <span>{{ t('warehouse.col_location') }}</span>
    <span v-tooltip="t('warehouse.col_location_hint')" class="info-hint">...</span>
  </label>
  <input v-model="form.location" class="glass-input" type="text" data-test="field-location" />
</div>
```

### Offcut Card Composable Form State ([`useWarehouseOffcutCard.ts:22-30`](frontend_vue/src/composables/useWarehouseOffcutCard.ts:22))
```ts
const form = ref<{
  status: OffcutStatus
  location: string | null
  notes: string | null
}>({
  status: 'available',
  location: null,
  notes: null,
})
```

### Type Definition ([`WarehouseOffcut`](frontend_vue/src/types/warehouse.ts:148))
```ts
location: string | null
```

### Patch Payload ([`OffcutPatchPayload`](frontend_vue/src/types/warehouse.ts:196-200))
```ts
export interface OffcutPatchPayload {
  status?: OffcutStatus
  notes?: string | null
  location?: string | null
}
```

### Create Payload ([`OffcutCreatePayload`](frontend_vue/src/types/warehouse.ts:192))
```ts
location?: string | null
```

### i18n keys used
- [`warehouse.col_location`](frontend_vue/src/i18n/admin/warehouse.ts:56) — "Место" / "Location" / "Vieta"
- [`warehouse.col_location_hint`](frontend_vue/src/i18n/admin/warehouse.ts:57) — hint text

## Proposed Solution

Extract the location field from the right column into its **own dedicated section** (a new `GlassPanel`) placed between the `entity-card-grid` and the Audit section. This new section will contain:

1. **Rack** (`form.locationRack`) — стеллаж / rack
2. **Row** (`form.locationRow`) — ряд / row
3. **Cell** (`form.locationCell`) — ячейка / cell
4. **Notes** (`form.locationNotes`) — заметки о месте / location notes (textarea)

The existing single `location` field in the API will remain as-is on the backend (stored as a combined string). The frontend will **compose** the three sub-fields into a single string for the API, and **parse** the API response back into sub-fields on load — exactly the same pattern used in [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts:12-49).

### Why compose into a single field?
- Minimal backend changes — the API contract stays the same
- The `location` field is already used in offcut lists, batch offcuts table, etc.
- We avoid a migration on the backend
- The composed format is human-readable: `"Rack: A | Row: 01 | Cell: 01"`

### Parsing / Composition Logic

Reuse the same `parseLocation` / `composeLocation` helpers from [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts:12-49).

**On load** (in [`useWarehouseOffcutCard.ts`](frontend_vue/src/composables/useWarehouseOffcutCard.ts) `load()`):
- Parse `data.location` into parts using `parseLocation()`
- Expected format: `"Rack: X | Row: Y | Cell: Z\nNotes: ..."`
- If the format doesn't match, put the entire string into `locationRack` as a fallback

**On save** (in `save()`):
- Compose `locationRack`, `locationRow`, `locationCell`, `locationNotes` into a single string using `composeLocation()`
- If all fields are empty, send `null`

### Form State Changes

In [`useWarehouseOffcutCard.ts`](frontend_vue/src/composables/useWarehouseOffcutCard.ts), the form will be extended:

```ts
const form = ref<{
  status: OffcutStatus
  locationRack: string
  locationRow: string
  locationCell: string
  locationNotes: string
  notes: string | null
}>({
  status: 'available',
  locationRack: '',
  locationRow: '',
  locationCell: '',
  locationNotes: '',
  notes: null,
})
```

The `location` field will be **removed** from the form state (it will be composed on save and parsed on load).

### Template Changes

#### 1. Remove old location input from right column

Remove the entire `<div class="input-group">` block for location (lines 438-455 in [`WarehouseOffcutCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue:438)).

#### 2. Add new Location section between entity-card-grid and Audit section

Insert after the closing `</div>` of `entity-card-grid` (line 495) and before the Audit section (line 497):

```html
<!-- FULL WIDTH: Location section -->
<GlassPanel :title="t('warehouse.section_batch_location')" data-test="offcut-card-location-section">
  <template v-if="offcut">
    <div class="location-grid">
      <div class="input-group">
        <label class="field-label">
          <span>{{ t('warehouse.field_location_rack') }}</span>
          <span v-tooltip="t('warehouse.field_location_rack_hint')" class="info-hint">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
        </label>
        <input
          v-model="form.locationRack"
          class="glass-input"
          type="text"
          data-test="field-location-rack"
        />
      </div>
      <div class="input-group">
        <label class="field-label">
          <span>{{ t('warehouse.field_location_row') }}</span>
          <span v-tooltip="t('warehouse.field_location_row_hint')" class="info-hint">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
        </label>
        <input
          v-model="form.locationRow"
          class="glass-input"
          type="text"
          data-test="field-location-row"
        />
      </div>
      <div class="input-group">
        <label class="field-label">
          <span>{{ t('warehouse.field_location_cell') }}</span>
          <span v-tooltip="t('warehouse.field_location_cell_hint')" class="info-hint">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
        </label>
        <input
          v-model="form.locationCell"
          class="glass-input"
          type="text"
          data-test="field-location-cell"
        />
      </div>
    </div>
    <div class="input-group" style="margin-top: 12px;">
      <label class="field-label">
        <span>{{ t('warehouse.field_location_notes') }}</span>
        <span v-tooltip="t('warehouse.field_location_notes_hint')" class="info-hint">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </span>
      </label>
      <textarea
        v-model="form.locationNotes"
        class="glass-input"
        data-test="field-location-notes"
      />
    </div>
  </template>
</GlassPanel>
```

### i18n Keys

The location section i18n keys already exist in [`warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts) (added for the batch card). No new i18n keys need to be added:

| Key | Russian | English | Lithuanian |
|-----|---------|---------|------------|
| `section_batch_location` | Местоположение на складе | Storage Location | Laikymo vieta sandėlyje |
| `field_location_rack` | Стеллаж | Rack | Lentyna |
| `field_location_rack_hint` | Номер или название стеллажа | Rack number or name | Lentynos numeris arba pavadinimas |
| `field_location_row` | Ряд | Row | Eilė |
| `field_location_row_hint` | Номер ряда на стеллаже | Row number on the rack | Eilės numeris lentynoje |
| `field_location_cell` | Ячейка | Cell | Ląstelė |
| `field_location_cell_hint` | Номер ячейки в ряду | Cell number in the row | Ląstelės numeris eilėje |
| `field_location_notes` | Заметки о месте | Location Notes | Pastabos apie vietą |
| `field_location_notes_hint` | Если партия хранится в нескольких местах, укажите подробности здесь | If the batch is stored across multiple locations, add details here | Jei partija laikoma keliose vietose, nurodykite detales čia |

### Files to Modify

1. [`frontend_vue/src/composables/useWarehouseOffcutCard.ts`](frontend_vue/src/composables/useWarehouseOffcutCard.ts)
   - Add `parseLocation` / `composeLocation` helper functions (copy from [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts:12-49))
   - Extend form state: replace `location` with `locationRack`, `locationRow`, `locationCell`, `locationNotes`
   - Update `load()`: parse `data.location` into sub-fields
   - Update `save()`: compose sub-fields into `delta.location` before sending
   - Update `discard()`: reset sub-fields from `offcut.value.location`

2. [`frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue)
   - Remove the old location input group from the right column (lines 438-455)
   - Add the new Location section `GlassPanel` between the `entity-card-grid` and the Audit section

3. [`frontend_vue/src/types/warehouse.ts`](frontend_vue/src/types/warehouse.ts)
   - No changes needed — the `location` field stays as-is on the API level

### What NOT to Change

- **API types** ([`WarehouseOffcut`](frontend_vue/src/types/warehouse.ts), [`OffcutPatchPayload`](frontend_vue/src/types/warehouse.ts), [`OffcutCreatePayload`](frontend_vue/src/types/warehouse.ts)) — the `location` field stays as-is on the API level
- **Mock data** — mock data can stay as-is since we parse on load
- **Offcut create page** — it still uses a single `form.location` field; that's a separate concern
- **i18n keys** — all needed keys already exist from the batch card implementation
- **CSS** — the `.location-grid` class already exists from the batch card implementation

### Data Flow Diagram

```mermaid
flowchart LR
    A[API response: location string] --> B[load() parseLocation]
    B --> C[locationRack]
    B --> D[locationRow]
    B --> E[locationCell]
    B --> F[locationNotes]
    C --> G[Form inputs in Location section]
    D --> G
    E --> G
    F --> G
    G --> H[save() composeLocation]
    H --> I[delta.location string]
    I --> J[API PATCH]
```

### Edge Cases

1. **Existing data with old format** (e.g., `"A-01-01"`): On load, the entire string goes into `locationRack`, `locationRow` and `locationCell` remain empty. The user can then split it manually. On save, it will be composed into `"Rack: A-01-01 | Row: | Cell:"` — acceptable.

2. **All sub-fields empty**: On save, send `location: null` to the API.

3. **Only notes filled, no location**: The notes textarea is independent. If no rack/row/cell is filled but notes exist, `location` will be composed as `"Notes: some text"`. On load, it will be parsed back.

4. **Null location from API**: `parseLocation(null)` returns all empty strings — form fields start empty.

## Implementation Steps

1. **Update composable** [`useWarehouseOffcutCard.ts`](frontend_vue/src/composables/useWarehouseOffcutCard.ts):
   - Add `parseLocation` / `composeLocation` helper functions (copy from `useWarehouseBatch.ts`)
   - Replace `location` with `locationRack`, `locationRow`, `locationCell`, `locationNotes` in form state
   - Update `load()`, `save()`, `discard()` to use parse/compose

2. **Update template** [`WarehouseOffcutCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue):
   - Remove old location input from right column
   - Add new Location section GlassPanel between entity-card-grid and Audit section

3. **Verify** the changes work correctly with mock data
