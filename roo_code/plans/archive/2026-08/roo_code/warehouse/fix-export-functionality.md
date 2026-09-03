# Plan: Fix Export Functionality in Warehouse Stock Page

## Problem Analysis

The current export implementation in [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:267) (function `exportCurrentTab`) works **entirely client-side** — it takes the already-loaded data from reactive refs (`stockItems`, `batches`, `offcuts`, `movements`, `deficitItems`) and generates a CSV blob in the browser. It does **not** make any API call to the server or mock layer.

This means:
1. **Only the currently visible page** of data is exported (e.g., 25 items), not the full filtered dataset.
2. **No server-side filtering** is applied — the export uses whatever data is already in memory.
3. **No API endpoint** exists for export — neither in the service layer nor in the mock layer.

## Requirements

1. Export button should make a request to the server (or mock) to get a **ready-made CSV file**.
2. If using mocks (`VITE_USE_MOCKS=true`), the mock should generate real CSV data from the in-memory stores.
3. If using a real server, the server should return a ready-made CSV file.
4. Export should include **all data** matching the current filters, not just the current page.
5. Export should work for all 5 tabs: stock, batches, offcuts, movements, deficit.

## Architecture & Data Flow

### Approach

Following the existing suppliers export pattern (see [`mocks/index.ts:126`](frontend_vue/src/services/mocks/index.ts:126) and [`mocks/suppliers.ts:456`](frontend_vue/src/services/mocks/suppliers.ts:456)):

- The mock returns a **CSV string** directly via `getMock<T>` (no separate `getMockBlob` needed)
- The service layer calls `apiGet<string>` to get the CSV string
- The component creates the `Blob` from the returned string and triggers download
- For the real server path, `apiGet` will use `fetch` and we'll handle the response as text

### Data Flow

```
User clicks Export button
  → exportCurrentTab() in WarehousePage.vue
    → calls warehouseService.exportWarehouseData(tab, filters)
      → apiGet<string>('/api/warehouse/export/:tab', params)
        → if USE_MOCKS:
            → getMock('/api/warehouse/export/stock', params)
              → mockExportWarehouseCsv(tab, filters) in mocks/warehouse.ts
                → filters the full in-memory store (no pagination)
                → generates CSV string with BOM + headers + rows
                → returns CSV string
        → if real server:
            → fetch GET /api/warehouse/export/stock?search=...&unit=...
            → server returns CSV as text
            → return text
    → creates Blob from CSV string
    → triggers browser download
```

### Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | [`frontend_vue/src/services/warehouseService.ts`](frontend_vue/src/services/warehouseService.ts) | Add `exportWarehouseData()` function |
| 2 | [`frontend_vue/src/services/mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts) | Add `mockExportWarehouseCsv()` function |
| 3 | [`frontend_vue/src/services/mocks/index.ts`](frontend_vue/src/services/mocks/index.ts) | Add route for `/api/warehouse/export/:tab` in `getMock()` |
| 4 | [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) | Refactor `exportCurrentTab()` to call the service |
| 5 | [`frontend_vue/src/i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts) | Add `export_error` i18n key |

## Detailed Implementation

### 1. [`warehouseService.ts`](frontend_vue/src/services/warehouseService.ts) — Add export function

Add after the existing functions (before the Stock Audit section):

```typescript
// ─── Export ────────────────────────────────────────────────────────────────

export async function exportWarehouseData(
  tab: string,
  filters: StockFilters | WarehouseFilters,
): Promise<string> {
  const params: Record<string, string> = {}

  // Common params
  if ('search' in filters && filters.search) params.search = filters.search

  // Stock-specific params
  if (tab === 'stock') {
    const sf = filters as StockFilters
    if (sf.categoryIds.length > 0) params.categoryIds = sf.categoryIds.join(',')
    if (sf.unit) params.unit = sf.unit
    if (sf.showDeficitOnly) params.showDeficitOnly = 'true'
    if (sf.showInStockOnly) params.showInStockOnly = 'true'
  }

  // Batches-specific params
  if (tab === 'batches') {
    const bf = filters as WarehouseFilters
    if (bf.productId) params.productId = bf.productId
    if (bf.supplierId) params.supplierId = bf.supplierId
    if (bf.status) params.status = bf.status
    if (bf.unit) params.unit = bf.unit
    if (bf.dateFrom) params.dateFrom = bf.dateFrom
    if (bf.dateTo) params.dateTo = bf.dateTo
  }

  // Offcuts-specific params
  if (tab === 'offcuts') {
    const of = filters as WarehouseFilters
    if (of.status) params.status = of.status
    if (of.unit) params.unit = of.unit
    if (of.offcutType) params.offcutType = of.offcutType
    if (of.categoryIds?.length) params.categoryIds = of.categoryIds.join(',')
    if (of.batchNumber) params.batchNumber = of.batchNumber
  }

  // Movements-specific params
  if (tab === 'movements') {
    const mf = filters as WarehouseFilters
    if (mf.type) params.type = mf.type
    if (mf.unit) params.unit = mf.unit
    if (mf.categoryIds?.length) params.categoryIds = mf.categoryIds.join(',')
    if (mf.batchNumber) params.batchNumber = mf.batchNumber
    if (mf.dateFrom) params.dateFrom = mf.dateFrom
    if (mf.dateTo) params.dateTo = mf.dateTo
  }

  // Deficit-specific params
  if (tab === 'deficit') {
    const df = filters as WarehouseFilters
    if (df.status) params.status = df.status
    if (df.priority) params.priority = df.priority
    if (df.unit) params.unit = df.unit
    if (df.categoryIds?.length) params.categoryIds = df.categoryIds.join(',')
  }

  return apiGet<string>(`/api/warehouse/export/${tab}`, params)
}
```

Also add `apiGet` import if not already present (it is already imported at line 1).

### 2. [`mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts) — Add CSV generation

Add at the end of the file (before the last line):

```typescript
// ─── Export CSV ────────────────────────────────────────────────────────────

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function mockExportWarehouseCsv(tab: string, params: Record<string, string>): string {
  const BOM = '\uFEFF'

  switch (tab) {
    case 'stock': {
      const search = params.search ?? ''
      const categoryIds = params.categoryIds ? params.categoryIds.split(',') : undefined
      const unit = params.unit ?? ''
      const showDeficitOnly = params.showDeficitOnly === 'true'
      const showInStockOnly = params.showInStockOnly === 'true'

      let items = [...stockStore]
      if (search) items = items.filter((i) => matchSearch(i, search))
      if (categoryIds) items = items.filter((i) => categoryIds.includes(i.categoryId))
      if (unit) items = items.filter((i) => i.unit === unit)
      if (showDeficitOnly) items = items.filter((i) => i.isDeficit)
      if (showInStockOnly) items = items.filter((i) => i.availableQuantity > 0)

      const header = 'productName,totalQuantity,reservedQuantity,availableQuantity,unit,batchCount,avgUnitPrice,totalValue,minStock'
      const rows = items.map((i) =>
        [
          escapeCsvField(i.productName.en),
          String(i.totalQuantity),
          String(i.reservedQuantity),
          String(i.availableQuantity),
          i.unit,
          String(i.batchCount),
          i.avgUnitPrice.toFixed(2),
          i.totalValue.toFixed(2),
          i.minStock !== null ? String(i.minStock) : '',
        ].join(','),
      )
      return BOM + [header, ...rows].join('\n')
    }

    case 'batches': {
      const search = params.search ?? ''
      const productId = params.productId
      const supplierId = params.supplierId
      const status = params.status
      const unit = params.unit ?? ''
      const dateFrom = params.dateFrom
      const dateTo = params.dateTo

      let items = [...batchStore]
      if (search) items = items.filter((b) => matchSearch(b, search))
      if (productId) items = items.filter((b) => b.productId === productId)
      if (supplierId) items = items.filter((b) => b.supplierId === supplierId)
      if (status) items = items.filter((b) => b.status === status)
      if (unit) items = items.filter((b) => b.unit === unit)
      if (dateFrom) items = items.filter((b) => b.receivedAt >= dateFrom)
      if (dateTo) items = items.filter((b) => b.receivedAt <= dateTo)

      const header = 'productName,batchNumber,lotCode,quantity,quantityRemaining,unit,unitPrice,receivedAt,status'
      const rows = items.map((b) =>
        [
          escapeCsvField(b.productName.en),
          b.batchNumber,
          b.lotCode,
          String(b.quantity),
          String(b.quantityRemaining),
          b.unit,
          b.unitPrice.toFixed(2),
          b.receivedAt.slice(0, 10),
          b.status,
        ].join(','),
      )
      return BOM + [header, ...rows].join('\n')
    }

    case 'offcuts': {
      const search = params.search ?? ''
      const productId = params.productId
      const status = params.status
      const unit = params.unit ?? ''
      const offcutType = params.offcutType
      const categoryIds = params.categoryIds ? params.categoryIds.split(',') : undefined
      const batchNumber = params.batchNumber

      let items = [...offcutStore]
      if (search) items = items.filter((o) => matchSearch(o, search))
      if (productId) items = items.filter((o) => o.productId === productId)
      if (status) items = items.filter((o) => o.status === status)
      if (unit) items = items.filter((o) => o.unit === unit)
      if (offcutType) items = items.filter((o) => o.offcutType === offcutType)
      if (categoryIds) items = items.filter((o) => categoryIds.includes(o.categoryId))
      if (batchNumber) items = items.filter((o) => o.batchNumber === batchNumber)

      const header = 'productName,batchNumber,lengthMm,weightKg,quantity,unit,location,status'
      const rows = items.map((o) =>
        [
          escapeCsvField(o.productName.en),
          o.batchNumber,
          o.lengthMm ? String(o.lengthMm) : '',
          o.weightKg ? String(o.weightKg) : '',
          String(o.quantity),
          o.unit,
          o.location ?? '',
          o.status,
        ].join(','),
      )
      return BOM + [header, ...rows].join('\n')
    }

    case 'movements': {
      const search = params.search ?? ''
      const type = params.type
      const productId = params.productId
      const unit = params.unit ?? ''
      const categoryIds = params.categoryIds ? params.categoryIds.split(',') : undefined
      const batchNumber = params.batchNumber
      const dateFrom = params.dateFrom
      const dateTo = params.dateTo

      let items = [...movementStore]
      if (search) items = items.filter((m) => {
        const name = m.productName?.en ?? ''
        return name.toLowerCase().includes(search.toLowerCase())
      })
      if (type) items = items.filter((m) => m.type === type)
      if (productId) items = items.filter((m) => m.productId === productId)
      if (unit) items = items.filter((m) => m.unit === unit)
      if (categoryIds) items = items.filter((m) => m.categoryId && categoryIds.includes(m.categoryId))
      if (batchNumber) items = items.filter((m) => m.batchNumber === batchNumber)
      if (dateFrom) items = items.filter((m) => m.movedAt >= dateFrom)
      if (dateTo) items = items.filter((m) => m.movedAt <= dateTo)

      const header = 'movedAt,type,productName,batchNumber,quantity,unit,unitPrice,total,referenceType'
      const rows = items.map((m) =>
        [
          m.movedAt.slice(0, 10),
          m.type,
          escapeCsvField(m.productName?.en ?? ''),
          m.batchNumber,
          String(m.quantity),
          m.unit,
          m.unitPrice.toFixed(2),
          (m.quantity * m.unitPrice).toFixed(2),
          m.referenceType ?? '',
        ].join(','),
      )
      return BOM + [header, ...rows].join('\n')
    }

    case 'deficit': {
      const search = params.search ?? ''
      const priority = params.priority
      const status = params.status
      const unit = params.unit ?? ''
      const categoryIds = params.categoryIds ? params.categoryIds.split(',') : undefined

      let items = [...deficitStore]
      if (search) items = items.filter((d) => matchSearch(d, search))
      if (priority) items = items.filter((d) => d.priority === priority)
      if (status) items = items.filter((d) => d.status === status)
      if (unit) items = items.filter((d) => d.unit === unit)
      if (categoryIds) items = items.filter((d) => d.categoryId && categoryIds.includes(d.categoryId))

      const header = 'productName,currentStock,minRequired,deficitAmount,unit,priority,status'
      const rows = items.map((d) =>
        [
          escapeCsvField(d.productName.en),
          String(d.currentStock),
          String(d.minRequired),
          String(d.deficitAmount),
          d.unit,
          d.priority,
          d.status,
        ].join(','),
      )
      return BOM + [header, ...rows].join('\n')
    }

    default:
      throw new Error(`Unknown export tab: ${tab}`)
  }
}
```

**Note:** The `matchSearch` function already exists in [`mocks/warehouse.ts:54`](frontend_vue/src/services/mocks/warehouse.ts:54) and can be reused. The in-memory stores (`stockStore`, `batchStore`, `offcutStore`, `movementStore`, `deficitStore`) are already defined at the top of the file.

### 3. [`mocks/index.ts`](frontend_vue/src/services/mocks/index.ts) — Add route handler

Add inside `getMock()` before the final `throw new Error(...)` line (around line 342):

```typescript
  // ── Warehouse Export ──
  const exportMatch = path.match(/^\/api\/warehouse\/export\/(stock|batches|offcuts|movements|deficit)$/)
  if (exportMatch) {
    return delay(mockExportWarehouseCsv(exportMatch[1] as string, params ?? {}) as T)
  }
```

Also add the import at the top of the file:
```typescript
import { mockExportWarehouseCsv } from './warehouse'
```

### 4. [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — Refactor export

Replace the current `exportCurrentTab()` function (lines 267-409) with:

```typescript
async function exportCurrentTab() {
  try {
    let filters: StockFilters | WarehouseFilters
    let filename: string

    switch (activeTab.value) {
      case 'stock':
        filters = stockFilters
        filename = 'warehouse-stock.csv'
        break
      case 'batches':
        filters = batchesFilters
        filename = 'warehouse-batches.csv'
        break
      case 'offcuts':
        filters = offcutFilters
        filename = 'warehouse-offcuts.csv'
        break
      case 'movements':
        filters = movementFilters
        filename = 'warehouse-movements.csv'
        break
      case 'deficit':
        filters = deficitFilters
        filename = 'warehouse-deficit.csv'
        break
      default:
        return
    }

    const csv = await exportWarehouseData(activeTab.value, filters)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    toast.error(t('warehouse.export_error'))
  }
}
```

Also add the import at the top of the script section:
```typescript
import { exportWarehouseData } from '@/services/warehouseService'
import type { StockFilters, WarehouseFilters } from '@/types/warehouse'
```

Remove the old `escapeCsvField` helper function (lines 411-416) as it's no longer needed in the component.

### 5. [`i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts) — Add error key

Add `export_error` to the toast section in all 3 locales:

**ru:** `export_error: 'Ошибка экспорта',`
**en:** `export_error: 'Export error',`
**lt:** `export_error: 'Eksporto klaida',`

Place it after `toast_error_save` in each locale section (around lines 299, 610, 921).

## Edge Cases & Considerations

1. **Translated fields**: For `productName` (TranslatedString), use the English version (`en`) in CSV output since CSV is a flat format. The mock generates raw English names; the real server would handle localization.
2. **Empty results**: If no data matches filters, return CSV with BOM + headers only (no rows).
3. **Error handling**: If the mock throws an error (e.g., invalid tab name), catch it in the component and show a toast with `warehouse.export_error`.
4. **Performance**: Mock data is in-memory and small, so no pagination needed. For real server, the server handles this.
5. **BOM for Excel**: UTF-8 BOM (`\uFEFF`) is prepended to CSV for proper Excel encoding of Cyrillic characters.
6. **CSV escaping**: The `escapeCsvField` function is moved to the mock layer (not the component) since the mock generates raw CSV strings.

## Implementation Order

1. Add `export_error` i18n key to [`warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts)
2. Add `exportWarehouseData()` to [`warehouseService.ts`](frontend_vue/src/services/warehouseService.ts)
3. Add `mockExportWarehouseCsv()` to [`mocks/warehouse.ts`](frontend_vue/src/services/mocks/warehouse.ts)
4. Add route handler to [`mocks/index.ts`](frontend_vue/src/services/mocks/index.ts)
5. Refactor `exportCurrentTab()` in [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue)
6. Remove unused `escapeCsvField` helper from [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue)
7. Verify all 5 tabs export correctly in mock mode
