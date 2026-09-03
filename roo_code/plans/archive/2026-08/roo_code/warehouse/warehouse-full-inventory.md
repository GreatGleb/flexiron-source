# Warehouse Section — Full Inventory

## Routes (Frontend)

| Path | Route Name | Component | Description |
|---|---|---|---|
| `/admin/warehouse/:tab(stock\|batches\|offcuts\|movements\|deficit)?` | `admin-warehouse` | `WarehousePage.vue` | Main warehouse page with 5 tabs |
| `/admin/warehouse/batches/:id` | `admin-warehouse-batch` | `WarehouseBatchCard.vue` | Single batch card page |

## Tabs on WarehousePage

| Tab Key | Icon | Description |
|---|---|---|
| `stock` | `pie-chart` | Stock Overview — product-level remaining stock |
| `batches` | `package` | Batches list |
| `offcuts` | `scissors` | Offcuts / remnants |
| `movements` | `refresh-cw` | Movements (receipt/expense/transfer/write-off) |
| `deficit` | `alert-triangle` | Deficit items |

## Modal Windows (Create)

| File | Description | Opened From Tabs |
|---|---|---|
| `CreateBatchModal.vue` | Create new batch (receipt) | stock, batches, deficit |
| `CreateMovementModal.vue` | Create movement (expense/receipt/transfer/write-off) | movements |
| `CreateOffcutModal.vue` | Cutting operation — create offcuts from a batch | offcuts |

## Composables (Business Logic + DB calls)

| File | Purpose | Key Functions |
|---|---|---|
| `useWarehouse.ts` | Main composable for WarehousePage. Manages all 5 tabs, filters, pagination, CRUD | `loadStock()`, `loadBatches()`, `loadOffcuts()`, `loadMovements()`, `loadDeficit()`, `deleteBatch()`, `deleteOffcut()`, `deleteMovement()`, `deleteDeficit()`, `deleteStock()`, `updateOffcutStatus()`, `updateDeficitPriority()`, `updateDeficitStatus()`, `toggleStockSort()`, `toggleBatchesSort()`, `toggleOffcutsSort()`, `toggleMovementsSort()`, `toggleDeficitSort()` |
| `useWarehouseBatch.ts` | For WarehouseBatchCard. Load/edit/delete single batch + its movements/offcuts | `load()`, `save()`, `discard()`, `remove()`, `loadMovements()`, `loadOffcuts()` |
| `useWarehouseMovement.ts` | Create/delete movement (from modal) | `create()`, `remove()` |
| `useWarehouseOffcuts.ts` | Create/delete offcut (from modal) | `create()`, `remove()` |
| `useWarehouseDeficit.ts` | Create/update/delete deficit record | `create()`, `update()`, `remove()` |

## Service Layer (API calls) — `warehouseService.ts`

| Function | HTTP Method | Endpoint | Description |
|---|---|---|---|
| `getStockOverview()` | GET | `/api/warehouse/stock` | List stock overview |
| `deleteStockItem()` | DELETE | `/api/warehouse/stock/:productId` | Delete stock item |
| `getBatches()` | GET | `/api/warehouse/batches` | List batches |
| `getBatch()` | GET | `/api/warehouse/batches/:id` | Get single batch |
| `createBatch()` | POST | `/api/warehouse/batches` | Create batch |
| `patchBatch()` | PATCH | `/api/warehouse/batches/:id` | Update batch |
| `deleteBatch()` | DELETE | `/api/warehouse/batches/:id` | Delete batch |
| `getOffcuts()` | GET | `/api/warehouse/offcuts` | List offcuts |
| `getOffcut()` | GET | `/api/warehouse/offcuts/:id` | Get single offcut |
| `createOffcut()` | POST | `/api/warehouse/offcuts` | Create offcut |
| `deleteOffcut()` | DELETE | `/api/warehouse/offcuts/:id` | Delete offcut |
| `getMovements()` | GET | `/api/warehouse/movements` | List movements |
| `createMovement()` | POST | `/api/warehouse/movements` | Create movement |
| `deleteMovement()` | DELETE | `/api/warehouse/movements/:id` | Delete movement |
| `executeCutting()` | POST | `/api/warehouse/cutting` | Cutting operation (creates offcuts + expense movement) |
| `getDeficitList()` | GET | `/api/warehouse/deficit` | List deficit |
| `getDeficitItem()` | GET | `/api/warehouse/deficit/:id` | Get single deficit item |
| `createDeficitItem()` | POST | `/api/warehouse/deficit` | Create deficit record |
| `patchDeficitItem()` | PATCH | `/api/warehouse/deficit/:id` | Update deficit record |
| `deleteDeficitItem()` | DELETE | `/api/warehouse/deficit/:id` | Delete deficit record |

## Types — `types/warehouse.ts`

- `WarehouseBatch`, `BatchListItem`, `BatchCreatePayload`, `BatchPatchPayload`
- `WarehouseOffcut`, `OffcutListItem`, `OffcutCreatePayload`
- `WarehouseMovement`, `MovementListItem`, `MovementCreatePayload`
- `CuttingOperation`
- `WarehouseDeficit`, `DeficitListItem`, `DeficitCreatePayload`, `DeficitPatchPayload`
- `StockOverviewItem`
- `WarehouseFilters`, `StockFilters`
- Enums: `MovementType`, `BatchStatus`, `OffcutStatus`, `DeficitPriority`, `DeficitStatus`, `StockUnit`

## Mocks — `services/mocks/warehouse.ts`

All service functions have `mock*` counterparts for offline development.
