# Plan: Fix Missing i18n Keys in Offcut Card and Related Views

## Problem

On the offcut card page at `/admin/warehouse/offcuts/who-030`, many field labels and UI texts show raw translation keys (e.g., `warehouse.col_width`) instead of the actual translated text. This happens because the translation keys exist in the Vue templates but are **missing from the i18n definitions** in [`warehouse.ts`](../../frontend_vue/src/i18n/admin/warehouse.ts).

## Missing Keys Analysis

### 1. [`WarehouseOffcutCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue)

| Line | Key Used | Status |
|------|----------|--------|
| 197 | `warehouse.col_offcut_type` | ❌ MISSING |
| 225 | `warehouse.col_width` | ❌ MISSING |
| 235 | `warehouse.col_thickness` | ❌ MISSING |
| 307 | `warehouse.loading` | ❌ MISSING (exists as `common.loading`) |
| 310 | `warehouse.no_audit_entries` | ❌ MISSING |
| 316 | `warehouse.audit_col_date` | ❌ MISSING |
| 317 | `warehouse.audit_col_user` | ❌ MISSING |
| 318 | `warehouse.audit_col_property` | ❌ MISSING |
| 319 | `warehouse.audit_col_old_value` | ❌ MISSING |
| 320 | `warehouse.audit_col_new_value` | ❌ MISSING |
| 338 | `warehouse.btn_delete_audit_entry` | ❌ MISSING |
| 387 | `warehouse.delete_audit_entry_title` | ❌ MISSING |
| 391 | `warehouse.confirm_delete_audit_entry` | ❌ MISSING |

### 2. [`WarehousePage.vue`](../../frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — Offcuts table

| Line | Key Used | Status |
|------|----------|--------|
| 2324 | `tooltip.view_details` | ❌ MISSING (exists as `suppliers.view_details`) |

### 3. [`CreateOffcutModal.vue`](../../frontend_vue/src/views/admin/warehouse/CreateOffcutModal.vue)

| Line | Key Used | Status |
|------|----------|--------|
| 311 | `warehouse.col_width` | ❌ MISSING |

## Required Changes

### File 1: [`frontend_vue/src/i18n/admin/warehouse.ts`](../../frontend_vue/src/i18n/admin/warehouse.ts)

Add the following missing keys to all three locales (ru, en, lt):

#### Keys to add under `warehouse` namespace:

| Key | ru | en | lt |
|-----|----|----|----|
| `col_offcut_type` | Тип обрезка | Offcut type | Atraižos tipas |
| `col_width` | Ширина, мм | Width, mm | Plotis, mm |
| `col_thickness` | Толщина, мм | Thickness, mm | Storis, mm |
| `loading` | Загрузка... | Loading... | Įkeliama... |
| `no_audit_entries` | Нет записей аудита | No audit entries | Nėra audito įrašų |
| `audit_col_date` | Дата | Date | Data |
| `audit_col_user` | Пользователь | User | Vartotojas |
| `audit_col_property` | Свойство | Property | Savybė |
| `audit_col_old_value` | Старое значение | Old value | Senoji reikšmė |
| `audit_col_new_value` | Новое значение | New value | Nauja reikšmė |
| `btn_delete_audit_entry` | Удалить запись | Delete entry | Ištrinti įrašą |
| `delete_audit_entry_title` | Удаление записи аудита | Delete audit entry | Audito įrašo ištrynimas |
| `confirm_delete_audit_entry` | Вы уверены, что хотите удалить эту запись аудита? | Are you sure you want to delete this audit entry? | Ar tikrai norite ištrinti šį audito įrašą? |

### File 2: [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](../../frontend_vue/src/views/admin/warehouse/WarehousePage.vue)

Change line 2324 from:
```vue
v-tooltip="t('tooltip.view_details')"
```
to:
```vue
v-tooltip="t('warehouse.open_offcut_card')"
```

The key `warehouse.open_offcut_card` already exists in all three locales (line 103 in ru, line 422 in en, line 754 in lt).

## Scope of Changes

| # | File | Change |
|---|------|--------|
| 1 | [`frontend_vue/src/i18n/admin/warehouse.ts`](../../frontend_vue/src/i18n/admin/warehouse.ts) | Add 13 missing keys to ru, en, lt sections |
| 2 | [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](../../frontend_vue/src/views/admin/warehouse/WarehousePage.vue) | Fix `tooltip.view_details` → `warehouse.open_offcut_card` on line 2324 |

## Verification

1. Navigate to `/admin/warehouse/offcuts/who-030` and verify all field labels show translated text
2. Check the audit section headings and column headers
3. Check the offcuts table in the main warehouse page for the view-details tooltip
4. Check the Create Offcut modal for the "Width" label
5. Verify all three locales (ru, en, lt) display correctly
