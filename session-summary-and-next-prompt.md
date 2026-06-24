# Session Summary — Currency & FIFO Cost Implementation

## What Was Done

### ✅ Types Updated
- [`frontend_vue/src/types/product.ts`](frontend_vue/src/types/product.ts) — added `avgCostPrice`, `avgSalePrice` to `Product` + `ProductListItem`; added `currency` to `LinkedSupplier`
- [`frontend_vue/src/types/order.ts`](frontend_vue/src/types/order.ts) — added `receivedCurrency`, `exchangeRate` to `OrderItem`
- [`frontend_vue/src/types/warehouse.ts`](frontend_vue/src/types/warehouse.ts) — added `currency` to `WarehouseMovement`, `MovementListItem`, `MovementCreatePayload`

### ✅ i18n Updated
- [`frontend_vue/src/i18n/admin/products.ts`](frontend_vue/src/i18n/admin/products.ts) — `field_price` renamed to "Default sale price" (all 3 locales); added `field_avg_cost_price`, `field_avg_sale_price`

### ✅ API & Mocks
- [`frontend_vue/src/services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts) — added `getBatchCostBreakdown(productId, quantity)`
- [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts) — added `mockCalculateFifoCost()` with FIFO logic
- [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts) — imported `mockCalculateFifoCost`, added route `GET /api/warehouse/stock/{id}/cost`
- [`frontend_vue/src/services/mocks/orders.ts`](frontend_vue/src/services/mocks/orders.ts) — order items now include `receivedCurrency` + `exchangeRate`

### ✅ Composables Partially
- [`frontend_vue/src/composables/useOrderCard.ts`](frontend_vue/src/composables/useOrderCard.ts) — hardcoded `'EUR'` → `settings.constants.defaultCurrency`; `21` → `settings.constants.vatRate`

### ✅ Views Partially
- [`frontend_vue/src/views/admin/products/ProductCardPage.vue`](frontend_vue/src/views/admin/products/ProductCardPage.vue) — added read-only `avgCostPrice` and `avgSalePrice` fields in Price section
- [`frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue`](frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue) — added `selectedItemsCosts` map + `recalcFifoCost()` function; watch triggers FIFO recalc on qty change

---

## ❌ What Still Needs To Be Done

### Task 1: Fix remaining hardcoded 'EUR'
**Files:** [`useWarehouseBatchCreate.ts`](frontend_vue/src/composables/useWarehouseBatchCreate.ts), [`useOrderCreate.ts`](frontend_vue/src/composables/useOrderCreate.ts)

- [`useWarehouseBatchCreate.ts:27`](frontend_vue/src/composables/useWarehouseBatchCreate.ts:27): `currency: 'EUR'` → `currency: settings.constants.defaultCurrency`
- [`useOrderCreate.ts`](frontend_vue/src/composables/useOrderCreate.ts): Add `currency` field to the form, default from settings

### Task 2: AddOrderItemsModal — use FIFO cost price
**File:** [`AddOrderItemsModal.vue`](frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue)

- Line 184: `toggleProduct()` — set `unitPrice` from `selectedItemsCosts` (FIFO cost) instead of `product.price`
- Line 371: `onSave()` — pass calculated FIFO cost as `unitPrice`
- Line 473: In products table, show `avgUnitPrice` from stock overview instead of `product.price + ' EUR'`
- Lines 559, 563: Remove hardcoded `' EUR'`, use order's currency instead
- Add a "Cost" column that shows the FIFO-calculated unit price per item

### Task 3: Mock products — add avgCostPrice/avgSalePrice/currency
**File:** [`services/mocks/products.ts`](frontend_vue/src/services/mocks/products.ts)

- Add `currency: 'EUR'` to all `LinkedSupplier` objects (fix TS errors)
- Calculate and add `avgCostPrice` (from batch data) and `avgSalePrice` (from product.price) to each product

### Task 4: ProductCard — LinkedSupplier currency display
**File:** [`ProductCardPage.vue`](frontend_vue/src/views/admin/products/ProductCardPage.vue)

- In the suppliers table (line 582-590), display the supplier's price including currency: `{{ s.price }} {{ s.currency ?? '' }}`

### Task 5: Batch creation — pre-fill receivedCurrencyId from LinkedSupplier
**File:** [`useWarehouseBatchCreate.ts`](frontend_vue/src/composables/useWarehouseBatchCreate.ts)

- When supplier is selected for a batch, look up `LinkedSupplier.currency` for this product-supplier pair
- Resolve currency code to ID from `settings.currencies`
- Pre-fill `form.receivedCurrencyId`

### Task 6: Movement mock data — add currency
**File:** [`services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)

- Ensure movements include `currency` copied from their source batch
- Update `MovementListItem` objects similarly

---

## How to Continue in New Session

Start a new chat with the following prompt:

> Продолжаем проект Flexiron ERP (путь: `c:/Users/great/Documents/bussiness/flexiron_enterprise`).
> 
> В предыдущей сессии мы реализовали часть плана из `/plans/currency-fix-and-fifo-plan.md` — обновили типы, i18n, добавили mockCalculateFifoCost и getBatchCostBreakdown API, обновили useOrderCard.ts.
> 
> Осталось доделать:
> 1. [`useWarehouseBatchCreate.ts:27`](frontend_vue/src/composables/useWarehouseBatchCreate.ts) — заменить `'EUR'` на `settings.constants.defaultCurrency`
> 2. [`useOrderCreate.ts`](frontend_vue/src/composables/useOrderCreate.ts) — добавить `currency` в форму со значением из `settings.constants.defaultCurrency`
> 3. [`AddOrderItemsModal.vue`](frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue) — использовать FIFO cost вместо `product.price` (строки 184, 371, 473, 559, 563) + убрать хардкод `'EUR'`
> 4. [`services/mocks/products.ts`](frontend_vue/src/services/mocks/products.ts) — добавить `currency` в LinkedSupplier, `avgCostPrice` и `avgSalePrice` в продукты
> 5. [`ProductCardPage.vue`](frontend_vue/src/views/admin/products/ProductCardPage.vue) — показывать `currency` в таблице поставщиков
> 6. [`useWarehouseBatchCreate.ts`](frontend_vue/src/composables/useWarehouseBatchCreate.ts) — pre-fill `receivedCurrencyId` из LinkedSupplier при выборе поставщика
> 
> Подробный план: `/plans/currency-fix-and-fifo-plan.md`
