# Plan: Service Card Page (ServiceCardPage)

## Overview
Create a Service Card page (`ServiceCardPage.vue`) analogous to `CategoryCardPage.vue`, with breadcrumbs, save/discard buttons, and editable fields. Also add a route, a composable, i18n keys, mock handlers, and update the services list to include an "open card" button.

## Changes Required

### 1. Router — add route for `products/services/:id`
**File:** [`frontend_vue/src/router/index.ts`](frontend_vue/src/router/index.ts:164)

Add a new child route after `admin-services`:
```ts
{
  path: 'products/services/:id',
  name: 'admin-service-card',
  component: () => import('@/views/admin/products/ServiceCardPage.vue'),
  meta: { layout: 'admin', featureFlag: 'adminServices' as FeatureFlagKey },
}
```

### 2. Create composable `useServiceCard`
**File:** `frontend_vue/src/composables/useServiceCard.ts` (new)

Analogous to [`useCategoryCard`](frontend_vue/src/composables/useCategoryCard.ts) but simpler — Service has no fields, no suppliers, no parent. Only:
- `service` (ref of `Service | null`)
- `loading`, `saving`, `error`
- `form` (ref with `name`, `costPrice`, `sellingPrice`, `priceUnit`, `description`)
- `isAnythingDirty` (computed)
- `load()`, `save()`, `discard()`
- `tf` (from `useTranslatedField`)

Uses:
- [`getService(id)`](frontend_vue/src/services/servicesService.ts:20) — already exists
- [`patchService(id, delta, locale)`](frontend_vue/src/services/servicesService.ts:38) — already exists
- [`useDirtyCheck`](frontend_vue/src/composables/useDirtyCheck.ts)
- [`useToast`](frontend_vue/src/composables/useToast.ts)

### 3. Create `ServiceCardPage.vue`
**File:** `frontend_vue/src/views/admin/products/ServiceCardPage.vue` (new)

Analogous to [`CategoryCardPage.vue`](frontend_vue/src/views/admin/products/CategoryCardPage.vue) structure:

```
<template>
  <template v-if="loading">
    <GlassPanel :loading="true" :skeleton-rows="6" />
  </template>
  <template v-else-if="error">
    <Breadcrumb :items="[...]" />
    <div class="entity-not-found">...</div>
  </template>
  <template v-else>
    <div class="page-service-card" data-test="page-service-card">
      <div class="service-card-header" data-test="service-card-header">
        <Breadcrumb :items="[
          { label: t('products.header_title'), to: { name: 'admin-products' } },
          { label: t('services.header_title'), to: { name: 'admin-services' } },
          { label: service?.name ? tf(service.name) : '...' },
        ]" />
        <div class="service-card-header-row">
          <h1 class="page-title">{{ service?.name ? tf(service.name) : t('services.title') }}</h1>
          <div class="entity-action-bar no-margin pos-static" data-test="service-save-bar">
            <button class="btn btn-secondary" :disabled="!isAnythingDirty || saving" @click="discard">
              {{ t('services.btn_discard_changes') }}
            </button>
            <button class="btn btn-save" :class="{ dirty: isAnythingDirty, loading: saving }"
              :disabled="!isAnythingDirty || saving" @click="save">
              {{ t('services.btn_save') }}
            </button>
          </div>
        </div>
      </div>

      <div class="entity-card-grid">
        <div class="entity-col-left">
          <GlassPanel :title="t('services.section_info')" data-test="service-card-info">
            <InputGroup :label="t('services.field_name')">
              <input v-model="formName" type="text" class="glass-input" data-test="service-name-input" />
            </InputGroup>
            <InputGroup :label="t('services.field_cost_price')">
              <input v-model.number="formCostPrice" type="number" step="0.01" class="glass-input" data-test="service-cost-input" />
            </InputGroup>
            <InputGroup :label="t('services.field_selling_price')">
              <input v-model.number="formSellingPrice" type="number" step="0.01" class="glass-input" data-test="service-selling-input" />
            </InputGroup>
            <InputGroup :label="t('services.field_price_unit')">
              <CustomSelect v-model="formPriceUnit" :options="priceUnitOptions" data-test="service-unit-select" />
            </InputGroup>
            <InputGroup :label="t('services.field_description')">
              <textarea v-model="formDescription" class="glass-input" rows="3" data-test="service-description-input" />
            </InputGroup>
          </GlassPanel>
        </div>
      </div>
    </div>
  </template>
</template>
```

### 4. Add i18n keys for card page
**File:** [`frontend_vue/src/i18n/admin/services.ts`](frontend_vue/src/i18n/admin/services.ts)

Add to all 3 locales (ru/en/lt):
- `btn_save` — "Save" / "Сохранить" / "Išsaugoti"
- `btn_discard_changes` — "Discard changes" / "Отменить изменения" / "Atšaukti pakeitimus"
- `section_info` — "Service info" / "Информация об услуге" / "Paslaugos informacija"

### 5. Add "open card" button to ServicesPage list
**File:** [`frontend_vue/src/views/admin/products/ServicesPage.vue`](frontend_vue/src/views/admin/products/ServicesPage.vue:228)

In the actions column (`services-row-actions`), add an "open" button before the delete button:
```html
<router-link
  :to="{ name: 'admin-service-card', params: { id: item.id } }"
  v-tooltip="t('services.btn_open')"
  class="action-icon-btn"
  data-test="services-btn-open"
>
  <SvgIcon name="external-link" :width="16" :height="16" />
</router-link>
```

Also add i18n key `btn_open` to all 3 locales.

### 6. Add mock for `GET /api/services/:id` and `PATCH /api/services/:id`

**File:** [`frontend_vue/src/services/mocks/services.ts`](frontend_vue/src/services/mocks/services.ts)

Add `mockGetService(id)` and `mockPatchService(id, data)` functions.

**File:** [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts)

- In `getMock`: add route match for `/^\/api\/services\/([^/]+)$/` → `mockGetService`
- In `patchMock`: add route match for `/^\/api\/services\/([^/]+)$/` → `mockPatchService`

### 7. Update E2E tests
**File:** `frontend_vue/tests/e2e/admin/products/services.spec.ts`

Add test for:
- Clicking "open" button navigates to service card page
- Service card page renders with header, breadcrumbs, save bar
- Service card page shows service info

**File:** `frontend_vue/tests/e2e/admin/products/service-card.spec.ts` (new)

Full test suite analogous to category-card tests:
- Structure tests (header, save bar, breadcrumbs)
- Dirty check (editing enables save, discard resets)
- Save lifecycle
- Visual tests

## Files to modify
1. [`frontend_vue/src/router/index.ts`](frontend_vue/src/router/index.ts) — add route
2. [`frontend_vue/src/views/admin/products/ServicesPage.vue`](frontend_vue/src/views/admin/products/ServicesPage.vue) — add "open" button
3. [`frontend_vue/src/i18n/admin/services.ts`](frontend_vue/src/i18n/admin/services.ts) — add i18n keys
4. [`frontend_vue/src/services/mocks/services.ts`](frontend_vue/src/services/mocks/services.ts) — add mockGetService, mockPatchService
5. [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts) — add GET/PATCH routes
6. [`frontend_vue/tests/e2e/admin/products/services.spec.ts`](frontend_vue/tests/e2e/admin/products/services.spec.ts) — add navigation test

## Files to create
1. `frontend_vue/src/composables/useServiceCard.ts` — new composable
2. `frontend_vue/src/views/admin/products/ServiceCardPage.vue` — new page
3. `frontend_vue/tests/e2e/admin/products/service-card.spec.ts` — new test suite
