# Phase 6, Subtask 1: Playwright route interception mocks for warehouse E2E tests

## What needs to be done

Create Playwright route interception mocks for the warehouse API endpoints. These mocks will be used by the E2E tests to simulate server responses without a real backend.

## Files to create

- [`frontend_vue/tests/e2e/mocks/warehouse.ts`](frontend_vue/tests/e2e/mocks/warehouse.ts) — new file with route interception handlers

## Context

### Existing E2E test infrastructure

The project uses Playwright for E2E testing. Existing test files:
- [`tests/e2e/fixtures.ts`](frontend_vue/tests/e2e/fixtures.ts) — test fixtures
- [`tests/e2e/helpers/mocks.ts`](frontend_vue/tests/e2e/helpers/mocks.ts) — mock helper utilities
- [`tests/e2e/helpers/admin.ts`](frontend_vue/tests/e2e/helpers/admin.ts) — admin page helpers
- [`tests/e2e/helpers/flags.ts`](frontend_vue/tests/e2e/helpers/flags.ts) — feature flag helpers
- [`tests/e2e/helpers/visual.ts`](frontend_vue/tests/e2e/helpers/visual.ts) — visual testing helpers
- [`tests/e2e/admin/products/service-card.spec.ts`](frontend_vue/tests/e2e/admin/products/service-card.spec.ts) — example spec with route interception

### Example pattern from existing tests

Look at [`service-card.spec.ts`](frontend_vue/tests/e2e/admin/products/service-card.spec.ts) for the established pattern of route interception and mock data usage.

### Existing mock data (from [`mocks/`](frontend_vue/src/mocks/))

- [`warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts) — 74 mock batches
- [`warehouse-movements.ts`](frontend_vue/src/mocks/warehouse-movements.ts) — mock movements
- [`warehouse-offcuts.ts`](frontend_vue/src/mocks/warehouse-offcuts.ts) — 33 mock offcuts
- [`warehouse-stock.ts`](frontend_vue/src/mocks/warehouse-stock.ts) — mock stock overview
- [`warehouse-deficit.ts`](frontend_vue/src/mocks/warehouse-deficit.ts) — mock deficit items

### API endpoints to mock

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/warehouse/stock` | Stock overview list |
| GET | `/api/warehouse/batches` | Batches list |
| GET | `/api/warehouse/batches/:id` | Single batch detail |
| POST | `/api/warehouse/batches` | Create batch |
| PATCH | `/api/warehouse/batches/:id` | Update batch |
| DELETE | `/api/warehouse/batches/:id` | Delete batch |
| GET | `/api/warehouse/offcuts` | Offcuts list |
| POST | `/api/warehouse/offcuts` | Create offcut |
| DELETE | `/api/warehouse/offcuts/:id` | Delete offcut |
| GET | `/api/warehouse/movements` | Movements list |
| POST | `/api/warehouse/movements` | Create movement |
| DELETE | `/api/warehouse/movements/:id` | Delete movement |
| POST | `/api/warehouse/cutting` | Execute cutting |
| GET | `/api/warehouse/deficit` | Deficit list |
| POST | `/api/warehouse/deficit` | Create deficit |
| PATCH | `/api/warehouse/deficit/:id` | Update deficit |
| DELETE | `/api/warehouse/deficit/:id` | Delete deficit |

## Requirements

### Function: `mockWarehouseEndpoints(page: Page)`

A single setup function that intercepts all warehouse API routes and returns appropriate mock data:

```ts
import { Page } from '@playwright/test'
import { warehouseBatches } from '@/mocks/warehouse-batches'
// ... other mock imports

export async function mockWarehouseEndpoints(page: Page) {
  // Stock overview
  await page.route('**/api/warehouse/stock**', async (route) => {
    // return paginated stock data
  })

  // Batches list
  await page.route('**/api/warehouse/batches**', async (route) => {
    const url = new URL(route.request().url())
    // Check if it's a single batch request (has ID in path) or list
    if (/* is single batch */) {
      // return single batch
    } else {
      // return paginated batch list
    }
  })

  // ... etc for all endpoints
}
```

### Granular mock functions

For test flexibility, also export individual mock functions:

```ts
export async function mockStockList(page: Page, data?: any)
export async function mockBatchesList(page: Page, data?: any)
export async function mockBatchDetail(page: Page, batchId: string, data?: any)
export async function mockCreateBatch(page: Page, response?: any)
export async function mockUpdateBatch(page: Page, batchId: string)
export async function mockDeleteBatch(page: Page, batchId: string)
export async function mockOffcutsList(page: Page, data?: any)
export async function mockMovementsList(page: Page, data?: any)
export async function mockCutting(page: Page, response?: any)
export async function mockDeficitList(page: Page, data?: any)
```

### Pagination support

List endpoints should support `page` and `pageSize` query params and return appropriate paginated responses with `items`, `total`, `page`, `pageSize`, `totalPages`.

### Error simulation

Each mock should support an optional `status` parameter to simulate error responses (e.g., `mockBatchDetail(page, id, null, 500)` for server error).

## Acceptance criteria

- [ ] Mock file created at [`frontend_vue/tests/e2e/mocks/warehouse.ts`](frontend_vue/tests/e2e/mocks/warehouse.ts)
- [ ] All 17 warehouse API endpoints are mockable
- [ ] List endpoints support pagination
- [ ] Individual mock functions for granular test control
- [ ] Error simulation support
- [ ] Uses existing mock data from [`src/mocks/`](frontend_vue/src/mocks/)
- [ ] Follows the same pattern as existing E2E mocks
