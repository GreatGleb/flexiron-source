# Stock Remainder Card — Fix Plan

## Problems Identified

The current [`WarehouseStockCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue) does not follow the project's established card page conventions. Below is a comparison with reference cards:

| Pattern | Reference ([`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue)) | Current Stock Card | Fix |
|---------|------|------|-----|
| `useHead` for page title | ✅ Line 52-55 | ❌ Missing | Add `useHead` import + call |
| Back button class | `btn btn-ghost` (line 344) — but pitfall #27 says `btn-ghost` doesn't exist. Actually batch card uses it too, but the correct pattern per pitfall #27 is `btn btn-secondary` | `btn btn-ghost` | Change to `btn btn-secondary` |
| Back button action | `$router.back()` (line 344) | `goBack()` with `router.push` | Use `$router.back()` for consistency |
| Card layout CSS | Inline styles + custom `.batch-card-*` classes | Custom `.stock-card-*` classes | Keep custom classes but use project CSS variables |
| CSS variables | Uses `--text-dim`, `--text-primary`, `--color-surface` etc. from `erp-base.css` | Uses `--bg-secondary`, `--text-muted` (non-existent) | Replace with project CSS variables |
| `_entity-card-layout.css` import | ❌ Not imported (batch card is custom layout) | ❌ Not needed (single-panel card) | Not needed |
| Loading skeleton | `<GlassPanel :loading="loading" :skeleton-rows="12">` | `<GlassPanel :loading="loading" :skeleton-rows="6">` | ✅ OK, just adjust rows |
| Error state pattern | `error-state` div with SvgIcon + retry button | ✅ Same pattern | ✅ OK |
| Empty/not-found state | Uses `entity-not-found` class (from `_entity-card-layout.css`) | Custom `empty-state` | Use `entity-not-found` class for consistency |
| `useHead` title format | `Flexiron — {translated title}` | ❌ Missing | Add `useHead` with `Flexiron — Stock Card` format |

## Specific Changes Needed

### 1. [`WarehouseStockCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue) — Script section

- Add `import { useHead } from '@/composables/useHead'`
- Add `import { computed } from 'vue'`
- Add `useHead` call with reactive title
- Remove `goBack` usage — use `$router.back()` directly in template

### 2. [`WarehouseStockCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue) — Template section

- Change back button class from `btn btn-ghost` to `btn btn-secondary`
- Change back button click from `@click="goBack"` to `@click="$router.back()"`
- Change empty state from custom `.empty-state` to `.entity-not-found` (matching ProductCardPage pattern)
- Add `entity-not-found` structure with h2 + p tags

### 3. [`WarehouseStockCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue) — Style section

- Replace `--bg-secondary` with `--color-surface` (project's CSS variable)
- Replace `--text-muted` with `--text-dim` (project's CSS variable)
- Keep the grid layout but use project-consistent variables

### 4. [`useWarehouseStockCard.ts`](../../frontend_vue/src/composables/useWarehouseStockCard.ts) — Composable

- Remove `goBack` function (template will use `$router.back()` directly)
- Keep everything else as-is

## Files to Modify

1. [`frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue) — Script, template, and style fixes
2. [`frontend_vue/src/composables/useWarehouseStockCard.ts`](../../frontend_vue/src/composables/useWarehouseStockCard.ts) — Remove `goBack`

## Files NOT to Modify (already correct)

- [`frontend_vue/src/services/warehouseService.ts`](../../frontend_vue/src/services/warehouseService.ts) — `getStockItem()` is correct
- [`frontend_vue/src/services/mocks/warehouse.ts`](../../frontend_vue/src/services/mocks/warehouse.ts) — `mockGetStockItem()` is correct
- [`frontend_vue/src/services/mocks/index.ts`](../../frontend_vue/src/services/mocks/index.ts) — mock route handler is correct
- [`frontend_vue/src/router/index.ts`](../../frontend_vue/src/router/index.ts) — route is correct
- [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](../../frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — links are correct
- [`frontend_vue/src/i18n/admin/warehouse.ts`](../../frontend_vue/src/i18n/admin/warehouse.ts) — translations are correct

## Verification

After changes:
1. Run `npx vue-tsc --noEmit` — must pass with zero errors
2. Check that the page loads without Vite import errors
3. Verify the card follows the same visual patterns as WarehouseBatchCard
