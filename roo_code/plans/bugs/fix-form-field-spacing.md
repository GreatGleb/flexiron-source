# Fix: Restore Form Field Spacing Across All Pages

## Problem

After recent changes, spacing between fields inside sections on all pages has been lost or minimized. Fields are now too close together with no or minimal gaps.

## Root Cause Analysis

The project uses **two different CSS classes** for form field grouping:

### 1. `.input-group` (has spacing — works correctly)
- Defined in [`_forms.css`](frontend_vue/src/styles/admin/components/_forms.css:2) and [`main.css`](frontend_vue/src/styles/admin/main.css:411)
- Has `margin-bottom: 20px` (desktop), `16px` (tablet), `14px` (mobile), `12px` (small mobile)
- Used in **entity card pages**: [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:289), [`WarehouseStockCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue:160), [`WarehouseOffcutCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue:257), [`ProductCardPage.vue`](frontend_vue/src/views/admin/products/ProductCardPage.vue), [`CategoryCardPage.vue`](frontend_vue/src/views/admin/products/CategoryCardPage.vue), [`SupplierCardPage.vue`](frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue)

### 2. `.form-group` (NO spacing — the bug)
- **No CSS definition exists** for `.form-group` in any stylesheet
- Used in **modal forms**: [`CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue:421), [`CreateBatchModal.vue`](frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue:209)
- Also used in public pages: [`LoginPage.vue`](frontend_vue/src/views/public/LoginPage.vue:13), [`RegisterPage.vue`](frontend_vue/src/views/public/RegisterPage.vue:37)

The `.modal-form` class (defined in [`_modal.css`](frontend_vue/src/styles/admin/components/_modal.css:91) and [`main.css`](frontend_vue/src/styles/admin/main.css:1824)) uses `gap: 16px` which provides spacing **between** `.form-group` children, but this only works inside `.modal-form`. The `.form-group` elements themselves have no bottom margin, so if they're used outside `.modal-form` or if the gap is insufficient, spacing breaks.

## Affected Files

### CSS files to modify:
1. [`frontend_vue/src/styles/admin/components/_forms.css`](frontend_vue/src/styles/admin/components/_forms.css) — Add `.form-group` styles
2. [`frontend_vue/src/styles/admin/main.css`](frontend_vue/src/styles/admin/main.css) — Add `.form-group` styles (same content, since main.css aggregates all components)

### Vue files using `.form-group` (will benefit from the fix):
- [`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`](frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue)
- [`frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue`](frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue)
- [`frontend_vue/src/views/public/LoginPage.vue`](frontend_vue/src/views/public/LoginPage.vue)
- [`frontend_vue/src/views/public/RegisterPage.vue`](frontend_vue/src/views/public/RegisterPage.vue)

## Fix Plan

### Step 1: Add `.form-group` CSS to `_forms.css`

Add the following after the `.input-group` definition:

```css
.form-group {
  margin-bottom: 20px;
}

/* Form row — side-by-side fields */
.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
  margin-bottom: 0;
}

.form-group-flex {
  flex: 1;
}

.form-group-shrink {
  flex: 0 0 auto;
}
```

### Step 2: Add same `.form-group` CSS to `main.css`

Since `main.css` is the main aggregator and contains all component styles inline, the same rules need to be added there as well (after the `.input-group` section at line ~482).

### Step 3: Add responsive breakpoints

Add tablet/mobile/small-mobile variants matching the `.input-group` pattern:

```css
@media (max-width: 992px) {
  .form-group {
    margin-bottom: 16px;
  }
  .form-row {
    gap: 12px;
  }
}

@media (max-width: 600px) {
  .form-group {
    margin-bottom: 14px;
  }
  .form-row {
    flex-direction: column;
    gap: 0;
  }
  .form-row .form-group {
    margin-bottom: 14px;
  }
}

@media (max-width: 400px) {
  .form-group {
    margin-bottom: 12px;
  }
}
```

### Step 4: Verify

- Check that modals (CreateBatchModal, CreateMovementModal) have proper spacing between fields
- Check that public pages (Login, Register) have proper spacing
- Check that entity card pages (using `.input-group`) are unaffected
- Verify responsive behavior at all breakpoints
