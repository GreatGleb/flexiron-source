# Domain: Analytics — Single-Locale Save Refactoring

## Context

Analytics is a read-only domain. It doesn't have create/patch endpoints. We just need to verify it already uses translated endpoints correctly.

## Goal

Verify that Analytics domain already works correctly with the single-locale approach.

## Files to check

### 1. Service: [`analyticsService.ts`](../frontend_vue/src/services/analyticsService.ts)

Check that `getAnalyticsPage` (or `getAnalyticsPageTranslated`) already calls the translated endpoint:

```ts
// Should be something like:
export async function getAnalyticsPage(page: string) {
  return apiGet(`/api/analytics/${page}`)
  // or
  return apiGet(`/api/analytics/${page}/translated`)
}
```

If there are two versions (translated and non-translated), verify that the non-translated one is not used anywhere.

### 2. Composable: [`useAnalytics.ts`](../frontend_vue/src/composables/useAnalytics.ts)

Check that `useAnalytics` doesn't have a `translated` option. If it does, remove it.

## What to do

1. Read both files
2. If they already use translated endpoints and don't have a `translated` option — no changes needed
3. If they have a `translated` option — remove it
4. If they use non-translated endpoints — switch to translated ones

## Verification

- `vue-tsc --noEmit` passes
- Analytics data displays correctly with `tf()` fallback
