# Plan: Extract Batch Location into a Dedicated Section

## Problem

Currently, the batch card has a single [`form.location`](frontend_vue/src/composables/useWarehouseBatch.ts:30) field (type `text`, `v-model="form.location"`) placed in the left column of the entity card grid. It's just one input among many, with no special treatment.

However, the physical storage location of a batch is important for warehouse workers. A batch may be split across multiple physical locations (racks, shelves, cells), and the current single-field approach doesn't capture this complexity. Workers need to know exactly where to find material, and sometimes need to add notes about partial storage across multiple spots.

## Current Implementation

### Template (left column, lines 365-382)
```html
<div class="input-group">
  <label class="field-label">
    <span>{{ t('warehouse.col_location') }}</span>
    <span v-tooltip="t('warehouse.col_location_hint')" class="info-hint">...</span>
  </label>
  <input v-model="form.location" class="glass-input" type="text" data-test="field-location" />
</div>
```

### Composable form state (line 30)
```ts
location: string | null
```

### Type definition ([`WarehouseBatch`](frontend_vue/src/types/warehouse.ts:65))
```ts
location: string | null
```

### i18n keys used
- [`warehouse.col_location`](frontend_vue/src/i18n/admin/warehouse.ts:56) — "Место" / "Location" / "Vieta"
- [`warehouse.col_location_hint`](frontend_vue/src/i18n/admin/warehouse.ts:57) — hint for offcut location (currently reused)
- [`warehouse.field_location`](frontend_vue/src/i18n/admin/warehouse.ts:276) — "Место хранения" / "Storage location" / "Laikymo vieta"

## Proposed Solution

Extract the location field from the left column into its **own dedicated section** (a new `GlassPanel`) placed between the entity-card-grid and the Movements section. This new section will contain:

1. **Rack** (`form.locationRack`) — стеллаж / rack
2. **Row** (`form.locationRow`) — ряд / row
3. **Cell** (`form.locationCell`) — ячейка / cell
4. **Notes** (`form.locationNotes`) — заметки о месте / location notes (textarea)

The existing single `location` field in the API will remain as-is on the backend (stored as a combined string like `"A-01-01"` or a free-text location). The frontend will **compose** the three sub-fields into a single string for the API, and **parse** the API response back into sub-fields on load.

### Why compose into a single field?
- Minimal backend changes — the API contract stays the same
- The `location` field is already used in batch lists, movements, offcuts, etc.
- We avoid a migration on the backend
- The composed format is human-readable: `"Rack A, Row 01, Cell 01"` or `"A-01-01"`

### Parsing / Composition Logic

**On load** (in [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts) `load()`):
- Parse `data.location` into parts. Expected format: `"Rack: X | Row: Y | Cell: Z"` or fallback to putting the whole string into the `rack` field.
- If the format doesn't match, put the entire string into `locationRack` as a fallback.

**On save** (in `save()`):
- Compose `locationRack`, `locationRow`, `locationCell` into a single string: `"Rack: ${rack} | Row: ${row} | Cell: ${cell}"`
- If all three are empty, send `null`.

### Form State Changes

In [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts), the form will be extended:

```ts
form.value = {
  // ... existing fields
  locationRack: string | null,
  locationRow: string | null,
  locationCell: string | null,
  locationNotes: string | null,
}
```

The `location` field will be **removed** from the form state (it will be composed on save and parsed on load).

### Template Changes

The new section will be placed **after** the `entity-card-grid` div and **before** the Movements section:

```html
<!-- LOCATION SECTION -->
<GlassPanel :title="t('warehouse.section_batch_location')" data-test="batch-card-location-section">
  <template v-if="batch">
    <div class="location-grid">
      <div class="input-group">
        <label class="field-label">
          <span>{{ t('warehouse.field_location_rack') }}</span>
          <span v-tooltip="t('warehouse.field_location_rack_hint')" class="info-hint">...</span>
        </label>
        <input v-model="form.locationRack" class="glass-input" type="text" data-test="field-location-rack" />
      </div>
      <div class="input-group">
        <label class="field-label">
          <span>{{ t('warehouse.field_location_row') }}</span>
          <span v-tooltip="t('warehouse.field_location_row_hint')" class="info-hint">...</span>
        </label>
        <input v-model="form.locationRow" class="glass-input" type="text" data-test="field-location-row" />
      </div>
      <div class="input-group">
        <label class="field-label">
          <span>{{ t('warehouse.field_location_cell') }}</span>
          <span v-tooltip="t('warehouse.field_location_cell_hint')" class="info-hint">...</span>
        </label>
        <input v-model="form.locationCell" class="glass-input" type="text" data-test="field-location-cell" />
      </div>
    </div>
    <div class="input-group" style="margin-top: 12px;">
      <label class="field-label">
        <span>{{ t('warehouse.field_location_notes') }}</span>
        <span v-tooltip="t('warehouse.field_location_notes_hint')" class="info-hint">...</span>
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

The `location-grid` should use a simple 3-column CSS grid (`.location-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }`).

### i18n Keys to Add

**Russian (ru):**
| Key | Value |
|-----|-------|
| `section_batch_location` | Местоположение на складе |
| `field_location_rack` | Стеллаж |
| `field_location_rack_hint` | Номер или название стеллажа |
| `field_location_row` | Ряд |
| `field_location_row_hint` | Номер ряда на стеллаже |
| `field_location_cell` | Ячейка |
| `field_location_cell_hint` | Номер ячейки в ряду |
| `field_location_notes` | Заметки о месте |
| `field_location_notes_hint` | Если партия хранится в нескольких местах, укажите подробности здесь |

**English (en):**
| Key | Value |
|-----|-------|
| `section_batch_location` | Storage Location |
| `field_location_rack` | Rack |
| `field_location_rack_hint` | Rack number or name |
| `field_location_row` | Row |
| `field_location_row_hint` | Row number on the rack |
| `field_location_cell` | Cell |
| `field_location_cell_hint` | Cell number in the row |
| `field_location_notes` | Location Notes |
| `field_location_notes_hint` | If the batch is stored across multiple locations, add details here |

**Lithuanian (lt):**
| Key | Value |
|-----|-------|
| `section_batch_location` | Laikymo vieta sandėlyje |
| `field_location_rack` | Lentyna |
| `field_location_rack_hint` | Lentynos numeris arba pavadinimas |
| `field_location_row` | Eilė |
| `field_location_row_hint` | Eilės numeris lentynoje |
| `field_location_cell` | Ląstelė |
| `field_location_cell_hint` | Ląstelės numeris eilėje |
| `field_location_notes` | Pastabos apie vietą |
| `field_location_notes_hint` | Jei partija laikoma keliose vietose, nurodykite detales čia |

### Files to Modify

1. [`frontend_vue/src/composables/useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts)
   - Extend form state: replace `location` with `locationRack`, `locationRow`, `locationCell`, `locationNotes`
   - Update `load()`: parse `data.location` into sub-fields
   - Update `save()`: compose sub-fields into `delta.location` before sending
   - Update `discard()`: reset sub-fields from `batch.value.location`

2. [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue)
   - Remove the old location input group from the left column (lines 365-382)
   - Add the new Location section `GlassPanel` between the entity-card-grid and Movements section

3. [`frontend_vue/src/i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts)
   - Add all new i18n keys for all 3 languages (ru, en, lt)

### What NOT to Change

- **API types** ([`WarehouseBatch`](frontend_vue/src/types/warehouse.ts), [`BatchPatchPayload`](frontend_vue/src/types/warehouse.ts)) — the `location` field stays as-is on the API level
- **Mock data** ([`warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts)) — mock data can stay as-is since we parse on load
- **Other components** — no other components use `form.location` from the batch composable

### Data Flow Diagram

```mermaid
flowchart LR
    A[API response: location string] --> B[load() parse]
    B --> C[locationRack]
    B --> D[locationRow]
    B --> E[locationCell]
    C --> F[Form inputs]
    D --> F
    E --> F
    F --> G[save() compose]
    G --> H[delta.location string]
    H --> I[API PATCH]
```

### Edge Cases

1. **Existing data with old format** (e.g., `"A-01-01"`): On load, the entire string goes into `locationRack`, `locationRow` and `locationCell` remain empty. The user can then split it manually. On save, it will be composed into `"Rack: A-01-01 | Row: | Cell:"` — acceptable.

2. **All sub-fields empty**: On save, send `location: null` to the API.

3. **Only notes filled, no location**: The notes textarea is independent — it's always saved as `locationNotes`. But if no rack/row/cell is filled, `location` will be `null` (notes are stored separately in the form but not composed into the API location field — they are only for UI display). Actually, let's reconsider: `locationNotes` should be stored **separately** from the API `location` field. Since the API doesn't have a `locationNotes` field, we have two options:
   - **Option A**: Append notes to the composed location string (e.g., `"Rack: A | Row: 01 | Cell: 01 — Notes: some text"`). Messy.
   - **Option B**: Store `locationNotes` only in the frontend form state, not sent to API. Notes persist only during the session. **Not ideal** — notes would be lost on page refresh.
   - **Option C**: Add `locationNotes` to the API types as an optional field. **Best option** but requires backend change.

   **Recommendation**: Start with **Option B** (frontend-only notes) as a minimal change. The notes field is meant for temporary annotations by the warehouse worker. If persistence is needed later, we can add it to the API.

   Actually, re-reading the user's request: "иногда часть из партии хранится разбито на несколько физических мест, в таком случае кладовщик сможет добавить информацию в заметки" — this suggests the notes are informational, not critical for system logic. So **Option B** is fine for now. We can store `locationNotes` in the form but not send it to the API. If the user wants persistence, we can add it later.

   **Update**: Actually, let's use the existing `notes` field for this purpose instead. The batch already has a `notes` field (textarea in the right column). We can repurpose or clarify that the notes field can be used for location-related notes. But the user specifically wants a separate notes field for location. So let's keep `locationNotes` as a frontend-only field for now.

   **Revised decision**: We'll store `locationNotes` in the form, and on save, we'll **append** it to the composed location string with a separator, e.g.: `"Rack: A | Row: 01 | Cell: 01\nNotes: some text"`. On load, we'll parse it back. This way notes persist without backend changes.

### Parsing/Composition Format

**Compose (save):**
```
Rack: ${rack} | Row: ${row} | Cell: ${cell}
Notes: ${notes}
```
If notes are empty, omit the `Notes:` line.
If all rack/row/cell are empty, just store the notes (or null if both location and notes are empty).

**Parse (load):**
1. Check if the string matches the pattern with `Rack:`, `Row:`, `Cell:` markers
2. If yes, extract each part
3. Check for `Notes:` line and extract notes
4. If no match, put the entire string into `locationRack` as fallback

### Test Data Examples

| Stored API value | Parsed result |
|---|---|
| `"Rack: A | Row: 01 | Cell: 01"` | rack="A", row="01", cell="01", notes="" |
| `"Rack: B | Row: 03 | Cell: 12\nNotes: Часть на стеллаже C"` | rack="B", row="03", cell="12", notes="Часть на стеллаже C" |
| `"A-01-01"` (legacy) | rack="A-01-01", row="", cell="", notes="" |
| `null` | rack="", row="", cell="", notes="" |

## Implementation Steps

1. **Add i18n keys** to [`warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts) for all 3 languages
2. **Update composable** [`useWarehouseBatch.ts`](frontend_vue/src/composables/useWarehouseBatch.ts):
   - Replace `location` with `locationRack`, `locationRow`, `locationCell`, `locationNotes` in form state
   - Add parse/compose helper functions
   - Update `load()`, `save()`, `discard()`
3. **Update template** [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue):
   - Remove old location input from left column
   - Add new Location section GlassPanel
4. **Verify** the changes work correctly with mock data
