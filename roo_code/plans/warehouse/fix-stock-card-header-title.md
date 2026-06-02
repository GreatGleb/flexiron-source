# Fix Stock Card Header & Title

## Problem

The stock card currently shows:
- **Header**: `Остатки — Лист оцинкованный 1.5мм` (uses plural tab name + product name)
- **Title**: `Flexiron — Лист оцинкованный 1.5мм`

It should show:
- **Header**: `Остаток prod-002 — Лист оцинкованный 1.5мм` (entity in singular + productId + product name)
- **Title**: `Flexiron — Остаток prod-002 — Лист оцинкованный 1.5мм` (Flexiron + header)

## Analysis

### How other cards do it

| Card | i18n key | Pattern |
|------|----------|---------|
| Batch | `batch_card_title: 'Партия {batchNumber}'` | `Партия B-001 — {productName}` |
| Movement | `movement_card_title: '{id} — {productName}'` | `Движения — M-001 — {productName}` |
| Offcut | `offcut_card_title: '{id} — {productName}'` | `Обрезки — OC-001 — {productName}` |
| Deficit | `deficit_card_title: '{id} — {productName}'` | `Дефицит — D-001 — {productName}` |
| **Stock (current)** | *(none)* | `Остатки — {productName}` |
| **Stock (desired)** | `stock_card_title: 'Остаток {id} — {productName}'` | `Остаток prod-002 — {productName}` |

### Key observations

1. `StockOverviewItem` does NOT have an `id` field — it uses `productId` as the identifier. The route param is also `productId`.
2. The entity name in singular for stock is **"Остаток"** (ru) / **"Stock"** (en) / **"Likutis"** (lt).
3. The `pageTitle` computed currently just returns the translated product name.
4. The `<h1>` currently shows `{{ t('warehouse.tab_stock') }} — {{ tf(item.productName) }}` — uses plural tab name.
5. The `useHead` title currently shows `Flexiron — {pageTitle}` where pageTitle is just the product name.

## Changes Required

### File 1: `frontend_vue/src/i18n/admin/warehouse.ts`

Add `stock_card_title` key to all 3 locales (after existing `stock_card_not_found` key):

```typescript
// ru
stock_card_title: 'Остаток {id} — {productName}',

// en
stock_card_title: 'Stock {id} — {productName}',

// lt
stock_card_title: 'Likutis {id} — {productName}',
```

### File 2: `frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue`

#### 2a. Update `pageTitle` computed (line 26-28)

Change from:
```typescript
const pageTitle = computed(() =>
  item.value ? tf(item.value.productName) : t('warehouse.header_title'),
)
```

To:
```typescript
const pageTitle = computed(() =>
  item.value
    ? t('warehouse.stock_card_title', { id: productId, productName: tf(item.value.productName) })
    : t('warehouse.header_title'),
)
```

#### 2b. Update `<h1>` header (line 116-126)

Change from:
```html
<h1 class="page-title">
  {{ t('warehouse.tab_stock') }} — {{ tf(item.productName) }}
  ...
</h1>
```

To:
```html
<h1 class="page-title">
  {{ t('warehouse.stock_card_title', { id: productId, productName: tf(item.productName) }) }}
  ...
</h1>
```

#### 2c. Update breadcrumb label (line 112)

Change from:
```html
{ label: tf(item.productName) },
```

To:
```html
{ label: t('warehouse.stock_card_title', { id: productId, productName: tf(item.productName) }) },
```

#### 2d. `useHead` title (line 30-33)

No change needed — it already uses `pageTitle` which will now return the correct format:
```typescript
useHead({
  title: () => `Flexiron — ${pageTitle.value}`,
  ...
})
```

This will produce: `Flexiron — Остаток prod-002 — Лист оцинкованный 1.5мм`

## Verification

After changes, the stock card should display:

| Element | Before | After |
|---------|--------|-------|
| Browser title | `Flexiron — Лист оцинкованный 1.5мм` | `Flexiron — Остаток prod-002 — Лист оцинкованный 1.5мм` |
| Page header (h1) | `Остатки — Лист оцинкованный 1.5мм` | `Остаток prod-002 — Лист оцинкованный 1.5мм` |
| Breadcrumb | `Лист оцинкованный 1.5мм` | `Остаток prod-002 — Лист оцинкованный 1.5мм` |
