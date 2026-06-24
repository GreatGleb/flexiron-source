# Plan: Currency Snapshot Fix + FIFO Cost in Orders

## Phase A — Mock mode (implement NOW)

### A1-A3: Product card reference fields

**Files:**
- [`frontend_vue/src/types/product.ts`](../frontend_vue/src/types/product.ts)
- [`frontend_vue/src/views/admin/products/ProductCardPage.vue`](../frontend_vue/src/views/admin/products/ProductCardPage.vue)
- [`frontend_vue/src/composables/useProductCard.ts`](../frontend_vue/src/composables/useProductCard.ts)
- [`frontend_vue/src/services/mocks/products.ts`](../frontend_vue/src/services/mocks/products.ts)
- [`frontend_vue/src/i18n/admin/products.ts`](../frontend_vue/src/i18n/admin/products.ts) (already done)

| Todo | File | Change |
|------|------|--------|
| A1 | [`types/product.ts`](../frontend_vue/src/types/product.ts) | Add `avgCostPrice: number \| null` to `Product` and `ProductListItem` |
| A2 | [`mocks/products.ts`](../frontend_vue/src/services/mocks/products.ts) | Populate `avgCostPrice` from mock batches |
| A3 | [`ProductCardPage.vue`](../frontend_vue/src/views/admin/products/ProductCardPage.vue) + [`useProductCard.ts`](../frontend_vue/src/composables/useProductCard.ts) | Display read-only avgCostPrice and avgSalePrice in Price section |

**i18n keys to add** to [`products.ts`](../frontend_vue/src/i18n/admin/products.ts):
- `field_avg_cost_price`: "Средняя себестоимость" / "Avg cost price" / "Vidutinė savikaina"
- `field_avg_sale_price`: "Средняя цена продажи" / "Avg sale price" / "Vidutinė pardavimo kaina"

---

### A4-A8: Order items get real cost price (FIFO)

**Files:**
- [`frontend_vue/src/services/mocks/warehouse.ts`](../frontend_vue/src/services/mocks/warehouse.ts) — add `mockCalculateFifoCost()`
- [`frontend_vue/src/services/warehouseService.ts`](../frontend_vue/src/services/warehouseService.ts) — add `getBatchCostBreakdown()` API
- [`frontend_vue/src/types/order.ts`](../frontend_vue/src/types/order.ts) — no changes needed (already has `unitCost?`)
- [`frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue`](../frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue) — major changes
- [`frontend_vue/src/composables/useOrderCard.ts`](../frontend_vue/src/composables/useOrderCard.ts) — use FIFO cost
- [`frontend_vue/src/composables/useOrderCreate.ts`](../frontend_vue/src/composables/useOrderCreate.ts) — use FIFO cost

| Todo | File | Change |
|------|------|--------|
| A4 | [`mocks/warehouse.ts`](../frontend_vue/src/services/mocks/warehouse.ts) | Implement `mockCalculateFifoCost(productId, qty)` sorting batches by `receivedAt ASC` |
| A5 | [`warehouseService.ts`](../frontend_vue/src/services/warehouseService.ts) | Add `getBatchCostBreakdown(productId, quantity)` calling mock |
| A6 | [`AddOrderItemsModal.vue`](../frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue) | Show `avgUnitPrice` in table, recalc FIFO on qty change, pass cost as `unitPrice` |
| A7 | [`useOrderCard.ts`](../frontend_vue/src/composables/useOrderCard.ts) | Integrate FIFO cost into `handleAddItemDirect` |
| A8 | [`useOrderCreate.ts`](../frontend_vue/src/composables/useOrderCreate.ts) | Integrate FIFO cost into `addItem` and `handleSave` |

---

## Phase B — Fix hardcoded currencies (implement NOW)

### B1: Replace all `'EUR'` hardcodes

| File | Line | Change |
|------|------|--------|
| [`useOrderCard.ts`](../frontend_vue/src/composables/useOrderCard.ts) | 52 | `currency: 'EUR'` → `currency: settings.constants.defaultCurrency` |
| [`useOrderCard.ts`](../frontend_vue/src/composables/useOrderCard.ts) | 56 | `vatPercent: 21` → `vatPercent: settings.constants.vatRate` |
| [`useWarehouseBatchCreate.ts`](../frontend_vue/src/composables/useWarehouseBatchCreate.ts) | 27 | `currency: 'EUR'` → `currency: settings.constants.defaultCurrency` |
| [`useSupplierCreate.ts`](../frontend_vue/src/composables/useSupplierCreate.ts) | 30 | `currency: 'EUR'` → read settings dynamically |
| [`AddOrderItemsModal.vue`](../frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue) | 459, 559, 563 | `'EUR'` → pass currency from order context |
| [`mocks/orders.ts`](../frontend_vue/src/services/mocks/orders.ts) | 279, 338, 449 | `currency: 'EUR'` → `currency: 'EUR'` (keep as is — mock data) |

### B2-B3: LinkedSupplier — currency snapshot

**Files:**
- [`types/product.ts`](../frontend_vue/src/types/product.ts) — add `currency: string | null` to `LinkedSupplier`
- [`mocks/products.ts`](../frontend_vue/src/services/mocks/products.ts) — add currency to linked suppliers
- [`ProductCardPage.vue`](../frontend_vue/src/views/admin/products/ProductCardPage.vue) — pre-fill from supplier, display in table

**Flow:**
1. Add `currency: string | null` to [`LinkedSupplier`](../frontend_vue/src/types/product.ts:17)
2. In [`submitAddSupplier()`](../frontend_vue/src/views/admin/products/ProductCardPage.vue:191):
   - Copy `supplier.currency` to `entry.currency` (snapshot)
3. Display: `1000 USD` in the suppliers table

### B4: Batch creation — pre-fill receivedCurrencyId from supplier

**Files:**
- [`useWarehouseBatchCreate.ts`](../frontend_vue/src/composables/useWarehouseBatchCreate.ts)

**Change:** When user selects a supplier for the batch:
1. Look up `LinkedSupplier.currency` for this product-supplier pair
2. Resolve currency code to UUID from `settings.currencies`
3. Pre-fill `form.receivedCurrencyId`

### B5: WarehouseMovement — add currency

**Files:**
- [`types/warehouse.ts`](../frontend_vue/src/types/warehouse.ts) — add `currency: string` to `WarehouseMovement`, `MovementListItem`
- [`mocks/warehouse.ts`](../frontend_vue/src/services/mocks/warehouse.ts) — populate currency from batch
- [`CreateMovementModal.vue`](../frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue) — add currency field

**Flow:**
1. `Movement.currency` is always copied from `Batch.currency` at creation
2. Display currency in movement list and card
3. If movement type is "sale", allow changing currency in UI (for currency conversion)

### B6-B7: OrderItem — receivedCurrency + exchangeRate

**Files:**
- [`types/order.ts`](../frontend_vue/src/types/order.ts) — add fields
- [`mocks/orders.ts`](../frontend_vue/src/services/mocks/orders.ts) — populate from batch
- [`useOrderCard.ts`](../frontend_vue/src/composables/useOrderCard.ts) — set on item add
- [`useOrderCreate.ts`](../frontend_vue/src/composables/useOrderCreate.ts) — set on item add

**New fields on [`OrderItem`](../frontend_vue/src/types/order.ts:27):**
```typescript
export interface OrderItem {
  // ... existing
  receivedCurrency: string     // UUID of batch's original currency
  exchangeRate: number | null  // rate applied (receivedCurrency → order.currency)
}
```

---

## Phase C — Backend (TODO, not implementing now)

- [ ] Backend Order model — add `currency_id` (UUID FK → currencies.id)
- [ ] Backend OrderItem — add `currency_id`, `exchange_rate`
- [ ] Backend WarehouseMovement — add `currency` column
- [ ] Backend LinkedSupplier — add `currency` column (or handle via PriceEntry table)
- [ ] API endpoint: `POST /api/warehouse/stock/{productId}/calculate-cost` for FIFO
