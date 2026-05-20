# Plan: Add Action Buttons to Warehouse Stock Page Tabs

## Overview

Add a header toolbar with action buttons (similar to [`SuppliersListPage.vue`](frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:290-332)) to the warehouse stock page, positioned between the tabs and the filters bar. Each tab gets context-appropriate buttons.

## Current State

The [`WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) currently has:
- A simple header with just the page title (line 617-619)
- Tab navigation (lines 622-634)
- Filters bar with "Save View" button inside (lines 637-968)
- Some tabs already have action buttons **inside the filters bar** (e.g., "Cutting" button for offcuts tab at line 830-837)

Missing: A dedicated toolbar row **between tabs and filters** with action buttons like the suppliers page has.

## Reference Pattern (Suppliers Page)

The [`SuppliersListPage.vue`](frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:290-332) has:
```
┌─────────────────────────────────────────────────┐
│  [ViewTabs]              [Export] [BCC] [+New]  │  ← suppliers-header
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  Filters...                                     │  ← filters-bar
└─────────────────────────────────────────────────┘
```

## Proposed Layout for Warehouse Page

```
┌─────────────────────────────────────────────────┐
│  Warehouse Management                           │  ← page-title (existing)
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  [Stock] [Batches] [Offcuts] [Movements] [Deficit] │  ← warehouse-tabs (existing)
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  [Export]  [New Item]  [Page Config ⚙]         │  ← NEW: warehouse-toolbar
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  Filters...                                     │  ← filters-bar (existing)
└─────────────────────────────────────────────────┘
```

## Buttons Per Tab

### Stock Tab
| Button | Action | Notes |
|--------|--------|-------|
| **Export** | Export stock data as CSV | Like suppliers export |
| **New Stock Item** | Opens a modal or navigates to create a new stock record | Could open CreateBatchModal or a new flow |
| **Page Config** | Stub — shows tooltip "In development" | ⚙ settings icon |

### Batches Tab
| Button | Action | Notes |
|--------|--------|-------|
| **Export** | Export batches data as CSV | |
| **New Batch** | Opens `CreateBatchModal` | Already exists as `showCreateBatchModal` |
| **Page Config** | Stub — tooltip "In development" | |

### Offcuts Tab
| Button | Action | Notes |
|--------|--------|-------|
| **Export** | Export offcuts data as CSV | |
| **New Offcut** | Opens `CreateOffcutModal` | Already exists as `showCreateOffcutModal` |
| **Page Config** | Stub — tooltip "In development" | |

### Movements Tab
| Button | Action | Notes |
|--------|--------|-------|
| **Export** | Export movements data as CSV | |
| **New Movement** | Opens `CreateMovementModal` | Already exists as `showCreateMovementModal` |
| **Page Config** | Stub — tooltip "In development" | |

### Deficit Tab
| Button | Action | Notes |
|--------|--------|-------|
| **Export** | Export deficit data as CSV | |
| **Add to Deficit** | Opens deficit creation modal | |
| **Page Config** | Stub — tooltip "In development" | |

## Implementation Steps

### Step 1: Add i18n translations

Add new translation keys to [`warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts):

```typescript
// New keys to add under warehouse namespace:
btn_export: 'Export' / 'Экспорт' / 'Eksportuoti'
btn_new_stock: 'New Stock Item' / 'Новый остаток' / 'Naujas likutis'
btn_new_batch: 'New Batch' / 'Новая партия' / 'Nauja partija'
btn_new_offcut: 'New Offcut' / 'Новый обрезок' / 'Nauja atraiža'
btn_new_movement: 'New Movement' / 'Новое движение' / 'Naujas judėjimas'
btn_add_deficit: 'Add to Deficit' / 'Добавить в дефицит' / 'Pridėti į trūkumą'
btn_page_config: 'Page Settings' / 'Настройки страницы' / 'Puslapio nustatymai'
tooltip_page_config_coming_soon: 'Page configuration is in development' / 'Настройки страницы в разработке' / 'Puslapio nustatymai kuriami'
```

### Step 2: Add toolbar template to WarehousePage.vue

Insert a new `.warehouse-toolbar` div between the tabs (line 634) and the filters bar (line 637):

```html
<!-- Action toolbar -->
<div class="warehouse-toolbar" data-test="warehouse-toolbar">
  <div class="warehouse-toolbar-left">
    <!-- left side: could be empty or view toggles -->
  </div>
  <div class="warehouse-toolbar-right">
    <!-- Export button (all tabs) -->
    <button class="btn btn-secondary" @click="exportCurrentTab">
      <svg ...download icon... />
      <span>{{ t('btn.export') }}</span>
    </button>

    <!-- Tab-specific action button -->
    <template v-if="activeTab === 'stock'">
      <button class="btn btn-primary" @click="openNewStockItem">
        <SvgIcon name="plus-add" :width="18" :height="18" />
        <span>{{ t('warehouse.btn_new_stock') }}</span>
      </button>
    </template>
    <template v-else-if="activeTab === 'batches'">
      <button class="btn btn-primary" @click="showCreateBatchModal = true">
        <SvgIcon name="plus-add" :width="18" :height="18" />
        <span>{{ t('warehouse.btn_new_batch') }}</span>
      </button>
    </template>
    <template v-else-if="activeTab === 'offcuts'">
      <button class="btn btn-primary" @click="showCreateOffcutModal = true">
        <SvgIcon name="plus-add" :width="18" :height="18" />
        <span>{{ t('warehouse.btn_new_offcut') }}</span>
      </button>
    </template>
    <template v-else-if="activeTab === 'movements'">
      <button class="btn btn-primary" @click="showCreateMovementModal = true">
        <SvgIcon name="plus-add" :width="18" :height="18" />
        <span>{{ t('warehouse.btn_new_movement') }}</span>
      </button>
    </template>
    <template v-else-if="activeTab === 'deficit'">
      <button class="btn btn-primary" @click="openAddDeficit">
        <SvgIcon name="plus-add" :width="18" :height="18" />
        <span>{{ t('warehouse.btn_add_deficit') }}</span>
      </button>
    </template>

    <!-- Page Config stub button -->
    <button
      class="btn btn-ghost btn-icon-only"
      v-tooltip="t('warehouse.tooltip_page_config_coming_soon')"
      data-test="warehouse-page-config-btn"
    >
      <SvgIcon name="settings" :width="18" :height="18" />
    </button>
  </div>
</div>
```

### Step 3: Add export functions

Add export logic for each tab's data (similar to [`SuppliersListPage.vue`](frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue:204-224)):

```typescript
function exportCurrentTab() {
  let rows: string[][]
  let filename: string
  
  switch (activeTab.value) {
    case 'stock':
      rows = stockItems.value.map(item => [
        tf(item.productName),
        String(item.totalQuantity),
        String(item.reservedQuantity),
        String(item.availableQuantity),
        t(`warehouse.unit_${item.unit}`),
        String(item.batchCount),
        item.avgUnitPrice.toFixed(2),
        item.totalValue.toFixed(2),
        item.minStock !== null ? String(item.minStock) : '',
      ])
      filename = 'warehouse-stock.csv'
      break
    // ... similar for other tabs
  }
  
  // CSV generation and download
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

### Step 4: Add CSS styles

Add minimal styles for the toolbar layout (aligning with the existing design system):

```css
.warehouse-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0;
}
```

### Step 5: Remove duplicate buttons from filters bar

The "Cutting" button currently inside the offcuts filter bar (line 830-837) should be removed since it will be replaced by the toolbar's "New Offcut" button. Similarly, ensure no duplicate action buttons exist.

## Files to Modify

1. [`frontend_vue/src/i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts) — Add new translation keys (ru, en, lt)
2. [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue) — Add toolbar template, export functions, CSS

## Files NOT Modified

- No new components needed
- No composable changes needed
- No route changes needed

## Testing Notes

- Verify toolbar appears between tabs and filters
- Verify export downloads CSV with correct data for each tab
- Verify "New X" buttons open the correct modals
- Verify Page Config button shows tooltip on hover
- Verify existing functionality is preserved (modals, filters, etc.)
