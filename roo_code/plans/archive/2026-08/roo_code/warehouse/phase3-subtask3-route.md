# Phase 3, Subtask 3: Verify route `/admin/warehouse/batches/:id`

## What needs to be done

The route for the batch card page **already exists** in the router. This subtask is a verification step — ensure the route is properly configured and works with the enhanced component.

## File to verify

- [`frontend_vue/src/router/index.ts`](frontend_vue/src/router/index.ts)

## Current route configuration (already exists at line 184-189)

```ts
{
  path: 'warehouse/batches/:id',
  name: 'admin-warehouse-batch',
  component: () => import('@/views/admin/warehouse/WarehouseBatchCard.vue'),
  meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
},
```

## What to check

1. ✅ Route path: `warehouse/batches/:id` — correct
2. ✅ Route name: `admin-warehouse-batch` — correct
3. ✅ Lazy-loaded component: `WarehouseBatchCard.vue` — correct
4. ✅ Feature flag: `adminWarehouse` — correct
5. ✅ Route is a child of `/admin` — correct
6. ✅ No duplicate routes for the same path

## No changes needed

The route is already properly configured. No code changes are required for this subtask.

## Acceptance criteria

- [ ] Route `/admin/warehouse/batches/:id` exists and is properly configured
- [ ] Route has name `admin-warehouse-batch`
- [ ] Route uses feature flag `adminWarehouse`
- [ ] Component is lazy-loaded
