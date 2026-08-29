# Plan: Unify i18n Keys in WarehouseBatchCard.vue Delete Modal

## Current State

### [`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) — Delete Modal (lines 524-549)

| Button | Current Key | Target Key |
|--------|------------|------------|
| Cancel | `t('btn.cancel')` (line 539) | `t('btn.cancel')` ✅ Already correct |
| Delete | `t('warehouse.btn_delete')` (line 546) | `t('btn.delete')` ❌ Needs change |

### [`WarehouseStockCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue) — Delete Modal (lines 398-408)

| Button | Current Key | Target Key |
|--------|------------|------------|
| Cancel | `t('btn.cancel')` (line 399) | `t('btn.cancel')` ✅ Already correct |
| Delete | `t('btn.delete')` (line 407) | `t('btn.delete')` ✅ Already correct |

## i18n Key Availability

**`btn.cancel` and `btn.delete` keys do NOT exist in any i18n file.**

The warehouse module defines keys under the `warehouse` namespace:
- `warehouse.btn_cancel` → `'Отмена' / 'Cancel' / 'Atšaukti'`
- `warehouse.btn_delete` → `'Удалить' / 'Delete' / 'Ištrinti'`

There is no top-level `btn` namespace with `cancel` or `delete` sub-keys anywhere in the i18n files. The `btn` namespace only exists in [`suppliers.ts`](../../frontend_vue/src/i18n/admin/suppliers.ts) with key `new_supplier`.

However, multiple components already use `t('btn.cancel')` and `t('btn.delete')`:
- [`WarehouseStockCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue) (lines 399, 407)
- [`WarehousePage.vue`](../../frontend_vue/src/views/admin/warehouse/WarehousePage.vue) (lines 3239, 3246)
- [`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) (lines 539, 566, 574) — already uses `btn.cancel` / `btn.delete` in audit modal
- [`WarehouseOffcutCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue) (lines 139, 155, 394, 420)
- [`WarehouseMovementCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue) (lines 110, 327, 352)
- [`WarehouseDeficitCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseDeficitCard.vue) (lines 155, 171, 402, 428)
- [`CreateMovementModal.vue`](../../frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue) (line 354)
- [`CreateBatchModal.vue`](../../frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue) (line 340)

Since these keys are already used across many components, they are **expected to exist** but are **missing** from the i18n definitions. Vue-i18n likely returns an empty string or the key itself for missing translations (depending on `silentFallbackWarn` / `silentTranslationWarn` settings).

## Required Changes

### 1. Add `btn.cancel` and `btn.delete` keys to i18n

Add a top-level `btn` namespace to the warehouse i18n file (or a shared common file) with `cancel` and `delete` keys for all three locales (ru, en, lt).

**Option A: Add to [`warehouse.ts`](../../frontend_vue/src/i18n/admin/warehouse.ts)** — since all consumers are warehouse components.

**Option B: Add to [`common.ts`](../../frontend_vue/src/i18n/admin/common.ts)** — since these are generic button labels used across the admin.

**Recommended: Option A** — to keep the change minimal and scoped to the warehouse module where the keys are actually used.

Add to each locale section in [`warehouse.ts`](../../frontend_vue/src/i18n/admin/warehouse.ts):

```typescript
btn: {
  cancel: 'Отмена',    // ru
  delete: 'Удалить',   // ru
}
```

```typescript
btn: {
  cancel: 'Cancel',    // en
  delete: 'Delete',    // en
}
```

```typescript
btn: {
  cancel: 'Atšaukti',  // lt
  delete: 'Ištrinti',  // lt
}
```

### 2. Fix the delete button key in [`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue)

Change line 546 from:
```vue
{{ saving ? t('warehouse.btn_delete') + '...' : t('warehouse.btn_delete') }}
```
to:
```vue
{{ saving ? t('btn.delete') + '...' : t('btn.delete') }}
```

## Scope of Changes

| File | Change |
|------|--------|
| [`frontend_vue/src/i18n/admin/warehouse.ts`](../../frontend_vue/src/i18n/admin/warehouse.ts) | Add `btn.cancel` and `btn.delete` keys to ru, en, lt sections |
| [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) | Replace `t('warehouse.btn_delete')` with `t('btn.delete')` on line 546 |

## Verification

1. The cancel button in the delete modal already uses `t('btn.cancel')` — no change needed.
2. The audit delete modal (lines 551-577) already uses `t('btn.cancel')` and `t('btn.delete')` — no changes needed.
3. After changes, both modals in [`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) will use the same unified `btn.cancel` / `btn.delete` keys as [`WarehouseStockCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue).
