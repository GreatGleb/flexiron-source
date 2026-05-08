# Warehouse Phase 2 — Bug Report

## 1. i18n: Wrong key `st.of` used in pagination (CRITICAL)

**Files:** [`WarehousePage.vue:354`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:354), `:478`, `:584`, `:705`

**Problem:** The template uses `t('st.of')` in 4 places for pagination "X–Y of Z" text. However, the `of` key is defined under `warehouse.of` (inside the `warehouse` namespace), not under `st.of`. The `st` namespace only exists in `suppliers.ts` with `st.all` — there is no `st.of` anywhere.

**Fix:** Replace `t('st.of')` with `t('warehouse.of')` in all 4 locations.

---

## 2. i18n: Missing translation keys for status/type/priority prefixes (HIGH)

**Files:** [`WarehousePage.vue`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue)

**Problem:** The template uses these i18n key patterns that don't match the translation file:

| Template key pattern | Translation file key | Status |
|---|---|---|
| `warehouse.batch_status_${batch.status}` | `warehouse.status_*` (e.g. `status_available`) | ❌ **MISMATCH** — template uses `batch_status_` prefix, translations use `status_` prefix |
| `warehouse.offcut_status_${offcut.status}` | `warehouse.status_*` (e.g. `status_available`) | ❌ **MISMATCH** — template uses `offcut_status_` prefix, translations use `status_` prefix |
| `warehouse.movement_type_${mov.type}` | `warehouse.type_*` (e.g. `type_receipt`) | ❌ **MISMATCH** — template uses `movement_type_` prefix, translations use `type_` prefix |
| `warehouse.deficit_priority_${item.priority}` | `warehouse.priority_*` (e.g. `priority_critical`) | ❌ **MISMATCH** — template uses `deficit_priority_` prefix, translations use `priority_` prefix |
| `warehouse.deficit_status_${item.status}` | `warehouse.status_*` (e.g. `status_open`) | ❌ **MISMATCH** — template uses `deficit_status_` prefix, translations use `status_` prefix |

**Fix:** Either:
- (a) Rename translation keys to match template prefixes (e.g. `batch_status_available`, `offcut_status_available`, `movement_type_receipt`, `deficit_priority_critical`, `deficit_status_open`), OR
- (b) Change template to use existing keys: `warehouse.status_${batch.status}`, `warehouse.status_${offcut.status}`, `warehouse.type_${mov.type}`, `warehouse.priority_${item.priority}`, `warehouse.status_${item.status}`

Option (b) is simpler but note that `deficit_status_*` and `batch_status_*` would collide with `offcut_status_*` and general `status_*` — so option (a) is safer.

---

## 3. i18n: Missing `warehouse.stock_empty` key (MEDIUM)

**File:** [`WarehousePage.vue:202`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:202)

**Problem:** Template uses `t('warehouse.stock_empty')` but the translation file has `warehouse.empty_stock` (line 27 ru, line 153 en, line 279 lt).

**Fix:** Change template to use `t('warehouse.empty_stock')` or rename translation key to `stock_empty`.

---

## 4. i18n: Missing `warehouse.batches_empty` key (MEDIUM)

**File:** [`WarehousePage.vue:278`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:278)

**Problem:** Template uses `t('warehouse.batches_empty')` but the translation file has `warehouse.empty_batches` (line 23 ru, line 149 en, line 275 lt).

**Fix:** Change template to use `t('warehouse.empty_batches')` or rename translation key to `batches_empty`.

---

## 5. i18n: Missing `warehouse.offcuts_empty` key (MEDIUM)

**File:** [`WarehousePage.vue:415`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:415)

**Problem:** Template uses `t('warehouse.offcuts_empty')` but the translation file has `warehouse.empty_offcuts` (line 24 ru, line 150 en, line 276 lt).

**Fix:** Change template to use `t('warehouse.empty_offcuts')` or rename translation key to `offcuts_empty`.

---

## 6. i18n: Missing `warehouse.movements_empty` key (MEDIUM)

**File:** [`WarehousePage.vue:536`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:536)

**Problem:** Template uses `t('warehouse.movements_empty')` but the translation file has `warehouse.empty_movements` (line 25 ru, line 151 en, line 277 lt).

**Fix:** Change template to use `t('warehouse.empty_movements')` or rename translation key to `movements_empty`.

---

## 7. i18n: Missing `warehouse.deficit_empty` key (MEDIUM)

**File:** [`WarehousePage.vue:642`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:642)

**Problem:** Template uses `t('warehouse.deficit_empty')` but the translation file has `warehouse.empty_deficit` (line 26 ru, line 152 en, line 278 lt).

**Fix:** Change template to use `t('warehouse.empty_deficit')` or rename translation key to `deficit_empty`.

---

## 8. i18n: Missing `warehouse.col_search` key (MEDIUM)

**File:** [`WarehousePage.vue:171`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:171)

**Problem:** Template uses `t('warehouse.col_search')` but this key does not exist in the translation file. The closest keys are `col_product`, `col_batch`, etc. — no `col_search`.

**Fix:** Add `col_search: 'Search' / 'Поиск' / 'Paieška'` to all three locales in [`warehouse.ts`](../frontend_vue/src/i18n/admin/warehouse.ts), or change template to use a different existing key.

---

## 9. i18n: Missing `warehouse.col_batch_number` key (MEDIUM)

**File:** [`WarehousePage.vue:286, 546`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:286)

**Problem:** Template uses `t('warehouse.col_batch_number')` but the translation file has `warehouse.col_batch` (not `col_batch_number`). Also used at line 546 in movements tab.

**Fix:** Add `col_batch_number: 'Batch #' / '№ партии' / 'Partijos Nr.'` to all three locales, or change template to use `warehouse.col_batch`.

---

## 10. i18n: Missing `warehouse.col_avg_price` key (MEDIUM)

**File:** [`WarehousePage.vue:215`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:215)

**Problem:** Template uses `t('warehouse.col_avg_price')` but the translation file has `warehouse.col_price` (not `col_avg_price`).

**Fix:** Add `col_avg_price: 'Avg. Price' / 'Ср. цена' / 'Vid. kaina'` or change template to use `warehouse.col_price`.

---

## 11. i18n: Missing `warehouse.col_total_value` key (MEDIUM)

**File:** [`WarehousePage.vue:216`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:216)

**Problem:** Template uses `t('warehouse.col_total_value')` but the translation file has `warehouse.col_total` (not `col_total_value`).

**Fix:** Add `col_total_value: 'Total Value' / 'Общая стоимость' / 'Bendra vertė'` or change template to use `warehouse.col_total`.

---

## 12. i18n: Missing `warehouse.col_min_stock` key (MEDIUM)

**File:** [`WarehousePage.vue:217`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:217)

**Problem:** Template uses `t('warehouse.col_min_stock')` but the translation file has `warehouse.stock_min` (not `col_min_stock`).

**Fix:** Add `col_min_stock: 'Min. Stock' / 'Мин. запас' / 'Min. atsargos'` or change template to use `warehouse.stock_min`.

---

## 13. i18n: Missing `warehouse.col_current_stock` key (MEDIUM)

**File:** [`WarehousePage.vue:650`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:650)

**Problem:** Template uses `t('warehouse.col_current_stock')` but the translation file has `warehouse.field_current_stock` (under modals section, not column headers).

**Fix:** Add `col_current_stock: 'Current Stock' / 'Текущий остаток' / 'Dabartinės atsargos'` to column headers section.

---

## 14. i18n: Missing `warehouse.col_min_required` key (MEDIUM)

**File:** [`WarehousePage.vue:651`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:651)

**Problem:** Template uses `t('warehouse.col_min_required')` but this key does not exist in translations.

**Fix:** Add `col_min_required: 'Min. Required' / 'Мин. необходимо' / 'Min. reikia'` to all three locales.

---

## 15. i18n: Missing `warehouse.col_deficit_amount` key (MEDIUM)

**File:** [`WarehousePage.vue:652`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:652)

**Problem:** Template uses `t('warehouse.col_deficit_amount')` but the translation file has `warehouse.field_deficit_amount` (under modals section).

**Fix:** Add `col_deficit_amount: 'Deficit' / 'Дефицит' / 'Trūkumas'` to column headers section.

---

## 16. i18n: Missing `warehouse.col_unit_price` key (MEDIUM)

**File:** [`WarehousePage.vue:291, 549`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:291)

**Problem:** Template uses `t('warehouse.col_unit_price')` but the translation file has `warehouse.col_price` (not `col_unit_price`).

**Fix:** Add `col_unit_price: 'Unit Price' / 'Цена за ед.' / 'Vnt. kaina'` or change template to use `warehouse.col_price`.

---

## 17. i18n: Missing `warehouse.col_received` key (MEDIUM)

**File:** [`WarehousePage.vue:292`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:292)

**Problem:** Template uses `t('warehouse.col_received')` but the translation file has `warehouse.col_date` (not `col_received`).

**Fix:** Add `col_received: 'Received' / 'Поступление' / 'Gauta'` or change template to use `warehouse.col_date`.

---

## 18. i18n: Missing `warehouse.col_total_cost` key (MEDIUM)

**File:** [`WarehouseBatchCard.vue:101`](../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:101)

**Problem:** Template uses `t('warehouse.col_total_cost')` but the translation file has `warehouse.field_total_cost` (under batch card section).

**Fix:** Change template to use `t('warehouse.field_total_cost')` or add `col_total_cost` alias.

---

## 19. i18n: Missing `warehouse.col_expires` key (MEDIUM)

**File:** [`WarehouseBatchCard.vue:111`](../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:111)

**Problem:** Template uses `t('warehouse.col_expires')` but the translation file has `warehouse.field_expires_at`.

**Fix:** Change template to use `t('warehouse.field_expires_at')` or add `col_expires` alias.

---

## 20. i18n: Missing `warehouse.col_certificate` key (MEDIUM)

**File:** [`WarehouseBatchCard.vue:113`](../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:113)

**Problem:** Template uses `t('warehouse.col_certificate')` but the translation file has `warehouse.field_certificate`.

**Fix:** Change template to use `t('warehouse.field_certificate')` or add `col_certificate` alias.

---

## 21. i18n: Missing `warehouse.col_supplier` key in batch card (MEDIUM)

**File:** [`WarehouseBatchCard.vue:83`](../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:83)

**Problem:** Template uses `t('warehouse.col_supplier')` but the translation file has `warehouse.field_supplier` (under batch card section) and `warehouse.col_supplier` (under column headers). Actually `col_supplier` exists in translations (line 44 ru, line 170 en, line 296 lt) — this is OK.

---

## 22. i18n: Missing `warehouse.col_location` in batch card (MEDIUM)

**File:** [`WarehouseBatchCard.vue:85`](../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:85)

**Problem:** Template uses `t('warehouse.col_location')` but the translation file has `warehouse.field_location` (under batch card section). `col_location` exists in column headers though — so this is OK.

---

## 23. i18n: Missing `warehouse.delete_title` key (MEDIUM)

**File:** [`WarehousePage.vue:753`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:753)

**Problem:** Template uses `t('warehouse.delete_title')` but this key does not exist in translations.

**Fix:** Add `delete_title: 'Confirm deletion' / 'Подтверждение удаления' / 'Patvirtinti ištrynimą'` to all three locales.

---

## 24. i18n: Missing `warehouse.delete_confirm` key (MEDIUM)

**File:** [`WarehousePage.vue:754`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:754)

**Problem:** Template uses `t('warehouse.delete_confirm', { name })` but this key does not exist in translations.

**Fix:** Add `delete_confirm: 'Are you sure you want to delete "{name}"?' / 'Вы уверены, что хотите удалить "{name}"?' / 'Ar tikrai norite ištrinti "{name}"?'` to all three locales.

---

## 25. i18n: Missing `warehouse.batch_section_general` key (MEDIUM)

**File:** [`WarehouseBatchCard.vue:77`](../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:77)

**Problem:** Template uses `t('warehouse.batch_section_general')` but the translation file has `warehouse.section_batch_info`.

**Fix:** Change template to use `t('warehouse.section_batch_info')` or rename translation key.

---

## 26. i18n: Missing `warehouse.batch_section_quantities` key (MEDIUM)

**File:** [`WarehouseBatchCard.vue:91`](../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:91)

**Problem:** Template uses `t('warehouse.batch_section_quantities')` but this key does not exist in translations.

**Fix:** Add `batch_section_quantities: 'Quantities' / 'Количество' / 'Kiekiai'` to all three locales.

---

## 27. i18n: Missing `warehouse.batch_section_dates` key (MEDIUM)

**File:** [`WarehouseBatchCard.vue:107`](../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:107)

**Problem:** Template uses `t('warehouse.batch_section_dates')` but this key does not exist in translations.

**Fix:** Add `batch_section_dates: 'Dates' / 'Даты' / 'Datos'` to all three locales.

---

## 28. i18n: Missing `warehouse.batch_section_notes` key (MEDIUM)

**File:** [`WarehouseBatchCard.vue:119`](../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:119)

**Problem:** Template uses `t('warehouse.batch_section_notes')` but the translation file has `warehouse.field_notes`.

**Fix:** Change template to use `t('warehouse.field_notes')` or add `batch_section_notes` alias.

---

## 29. i18n: Missing `warehouse.batch_card_title` — uses `{batchNumber}` interpolation but template doesn't pass it (LOW)

**File:** [`WarehouseBatchCard.vue:44`](../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:44)

**Problem:** The translation key `warehouse.batch_card_title` has value `'Batch {batchNumber}'` / `'Партия {batchNumber}'` / `'Partija {batchNumber}'` expecting a `batchNumber` parameter, but the template calls `t('warehouse.batch_card_title')` without passing `{ batchNumber: batch.value?.batchNumber }`. The title will show literally "Batch {batchNumber}".

**Fix:** Change to `t('warehouse.batch_card_title', { batchNumber: batch.value?.batchNumber ?? '...' })`.

---

## 30. Composable: `initialized` flag causes loading state issues (HIGH)

**File:** [`useWarehouse.ts:68, 84, 102, 119, 137`](../frontend_vue/src/composables/useWarehouse.ts:68)

**Problem:** The `initialized` flag is shared across ALL tabs. When switching tabs, `initialized` is reset to `false` (line 216), which is correct. However, the logic `if (!initialized) batchesLoading.value = true` means that on the **first load** of each tab, loading is set to `true`, but on **subsequent loads** (e.g., filter change, pagination), loading stays `false`. This is intentional but fragile — if `loadBatches()` is called directly (not through `load()`), `initialized` might already be `true` from a different tab, causing loading state to not show.

**More critically:** When `load()` is called (line 163-165), it calls the tab loader. But `initialized` is set to `true` inside `loadBatches()`/`loadOffcuts()`/etc. **after** the API call succeeds. If the API call fails on the first attempt, `initialized` stays `false`, and on retry, loading will show again — which is correct. But if the API succeeds, `initialized = true`, and subsequent pagination/filter changes won't show loading state.

**Fix:** Either:
- (a) Remove the `initialized` guard and always set loading to `true` before each load
- (b) Or use a per-tab initialized flag

---

## 31. Composable: `watch(filters, ...)` triggers `load()` before tab data is ready (MEDIUM)

**File:** [`useWarehouse.ts:200-204`](../frontend_vue/src/composables/useWarehouse.ts:200)

**Problem:** The `watch(filters, ...)` watcher calls `load()` which loads the **currently active tab**. But filters are shared across tabs. If the user changes a filter on the Batches tab, then switches to Offcuts tab, the filters watcher will fire again (since filters are reactive and shared), potentially causing a double load.

**Fix:** Consider using a per-tab filter object or adding a guard to prevent re-triggering loads when filters change due to tab switch.

---

## 32. Composable: `skipNextPageWatch` flag logic is fragile (MEDIUM)

**File:** [`useWarehouse.ts:198-212`](../frontend_vue/src/composables/useWarehouse.ts:198)

**Problem:** When filters change, `pagination.reset()` sets page to 1, which triggers the `watch([pagination.page, pagination.pageSize])` watcher. The `skipNextPageWatch` flag is meant to prevent double-loading. However, the logic `skipNextPageWatch = pagination.page.value !== 1` on line 201 is evaluated **before** `pagination.reset()` on line 202. If page is already 1, `skipNextPageWatch` will be `false`, and the page watcher will fire again, causing a double load.

**Fix:** Reorder: first call `pagination.reset()`, then check `skipNextPageWatch = pagination.page.value !== 1` — but since `reset()` sets page to 1, this would always be `false`. Better approach: use a simple debounce or a loading lock.

---

## 33. Composable: `load()` doesn't reset pagination for stock tab (LOW)

**File:** [`useWarehouse.ts:163-165`](../frontend_vue/src/composables/useWarehouse.ts:163)

**Problem:** The `loadStock()` function doesn't use pagination (stock overview is a flat list), so calling `load()` on the stock tab is fine. But the pagination state from a previous tab (batches/offcuts/etc.) persists when switching to stock. This is cosmetic but could cause confusion if pagination controls are visible (they are hidden by `v-if="pagination.total.value > 0"` in the template, so this is low priority).

---

## 34. Router: No route for offcut card (LOW)

**File:** [`router/index.ts:177-189`](../frontend_vue/src/router/index.ts:177)

**Problem:** There's a route for `admin-warehouse-batch` (`warehouse/batches/:id`) but no route for an offcut detail page (`warehouse/offcuts/:id`). The service has `getOffcut(id)` but there's no page to navigate to. The offcut rows in the table don't link anywhere (they use `<span>` not `<router-link>`), so this is not a runtime error, but it's an incomplete feature.

**Fix:** Add route `warehouse/offcuts/:id` → `WarehouseOffcutCard.vue` when needed.

---

## 35. Feature flags: All warehouse flags are correctly declared (OK)

**File:** [`features.ts:31-34`](../frontend_vue/src/types/features.ts:31)

**Status:** ✅ All three warehouse section-level flags (`warehouseOffcuts`, `warehouseDeficit`, `warehouseQrPrint`) are correctly declared in the `FeatureFlags` interface and in the defaults config.

---

## 36. CSS: Missing `pill-mint` class (MEDIUM)

**File:** [`WarehousePage.vue:97`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:97), CSS: [`warehouse_list.css`](../frontend_vue/src/styles/admin/warehouse_list.css)

**Problem:** The `DEFICIT_STATUS_PILL` mapping uses `'pill-mint'` for the `ordered` status (line 97). However, there is no `.pill-mint` class defined in [`warehouse_list.css`](../frontend_vue/src/styles/admin/warehouse_list.css) or any imported CSS file. The existing pill classes are: `pill-success`, `pill-info`, `pill-warning`, `pill-danger`, `pill-muted`, `pill-lg`.

**Fix:** Add `.pill-mint` CSS class to [`warehouse_list.css`](../frontend_vue/src/styles/admin/warehouse_list.css):
```css
.pill-mint {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}
```

---

## 37. CSS: Missing `btn-danger-ghost` class (MEDIUM)

**File:** [`WarehousePage.vue:337, 461, 688`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:337)

**Problem:** The template uses `btn-danger-ghost` class on delete buttons, but this class is not defined in [`warehouse_list.css`](../frontend_vue/src/styles/admin/warehouse_list.css). It may be defined globally elsewhere, but if not, delete buttons will have no visible danger styling.

**Fix:** Verify if `btn-danger-ghost` exists in global styles. If not, add it.

---

## 38. Mock data: ✅ Mock data exists and is comprehensive

**Files:** [`mocks/warehouse.ts`](../frontend_vue/src/mocks/warehouse.ts), [`services/mocks/warehouse.ts`](../frontend_vue/src/services/mocks/warehouse.ts), [`services/mocks/index.ts`](../frontend_vue/src/services/mocks/index.ts)

**Status:** ✅ Mock data exists for all endpoints:
- `GET /api/warehouse/stock` — 6 stock overview items
- `GET /api/warehouse/batches` — 6 batches with pagination
- `GET /api/warehouse/batches/:id` — single batch
- `GET /api/warehouse/offcuts` — 3 offcuts with pagination
- `GET /api/warehouse/offcuts/:id` — single offcut
- `GET /api/warehouse/movements` — 7 movements with pagination
- `GET /api/warehouse/deficit` — 3 deficit items with pagination
- `GET /api/warehouse/deficit/:id` — single deficit item
- All POST/PATCH/DELETE operations are also mocked

---

## 39. Imports: ✅ All components are correctly imported

**File:** [`WarehousePage.vue:1-14`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:1)

**Status:** ✅ All 5 components (`GlassPanel`, `Breadcrumb`, `SvgIcon`, `SearchInput`, `CustomSelect`) are properly imported. The CSS imports for `_pagination.css` and `warehouse_list.css` are also present.

---

## 40. Types vs Pill mappings: All enum values covered (OK)

**Files:** [`warehouse.ts`](../frontend_vue/src/types/warehouse.ts), [`WarehousePage.vue:65-100`](../frontend_vue/src/views/admin/warehouse/WarehousePage.vue:65)

**Status:** ✅ All enum values have corresponding pill mappings:

| Enum | Values | Pill mapping coverage |
|---|---|---|
| `BatchStatus` | `available`, `reserved`, `partial`, `depleted`, `quarantine` | ✅ All 5 covered |
| `OffcutStatus` | `available`, `reserved`, `used`, `scrap` | ✅ All 4 covered |
| `MovementType` | `receipt`, `expense`, `transfer`, `write-off` | ✅ All 4 covered |
| `DeficitPriority` | `critical`, `high`, `medium`, `low` | ✅ All 4 covered |
| `DeficitStatus` | `open`, `in_progress`, `ordered`, `resolved`, `cancelled` | ✅ All 5 covered |

---

## Summary

| Priority | Count | Key issues |
|---|---|---|
| CRITICAL | 1 | `st.of` → `warehouse.of` wrong i18n key |
| HIGH | 2 | Status/type/priority i18n key prefix mismatches; `initialized` flag logic |
| MEDIUM | 30+ | Missing i18n keys, missing CSS classes, fragile watcher logic |
| LOW | 2 | No offcut card route; `batch_card_title` missing interpolation param |
| OK | 3 | Feature flags, mock data, imports, type-pill coverage |
