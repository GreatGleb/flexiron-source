# Admin API Contract

> Единый источник истины для всех API-эндпоинтов административной панели.
> Каждая секция описывает эндпоинты одного домена.

---

## General Conventions

| Convention | Value |
|-----------|-------|
| Envelope | `ApiResponse<T>`: `{ success, data, message, code }` |
| Pagination | `PaginatedResponse<T>`: `{ items, total, page, pageSize, totalPages }` |
| Date/time | ISO 8601 (UTC) |
| Money | `number`, 2 decimal places |
| Auth | HttpOnly session cookie + CSRF token |
| Error codes | UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT, RATE_LIMITED, SERVER_ERROR |
| PATCH semantics | RFC 7396 JSON Merge Patch — partial body, server merges |
| Save mode | Clean-slate: local-first, single PATCH on Save, no autosave |

---

## Auth

### POST /api/auth/login
- **Body:** `{ email: string, password: string }` — required both
- **Response:** `ApiResponse<{ user: User, session: Session }>` — sets HttpOnly session cookie
- **Errors:** UNAUTHENTICATED (invalid credentials)

### POST /api/auth/register
- **Body:** `{ email: string, password: string, companyName: string, vatCode: string, locale: string }` — all required
- **Response:** `ApiResponse<User>` — auto-login after registration
- **Errors:** VALIDATION_ERROR (VAT format), CONFLICT (email exists)

### POST /api/auth/logout
- **Body:** none
- **Response:** `ApiResponse<null>` — invalidates session

### GET /api/auth/me
- **Query:** none
- **Response:** `ApiResponse<User>`

### POST /api/auth/refresh
- **Body:** none
- **Response:** `ApiResponse<{ user: User, session: Session }>`

---

## Suppliers

### GET /api/suppliers
- **Query:** `search?: string`, `status?: SupplierStatus | 'all'`, `categories?: string[]`, `rating?: number`, `page?: number`, `pageSize?: number`
- **Response:** `PaginatedResponse<Supplier>`
- **Save mode:** quick-action (list filters)

### GET /api/suppliers/:id
- **Response:** `ApiResponse<SupplierCardData>`
- **Save mode:** clean-slate (card edit)

### POST /api/suppliers
- **Body:** `Partial<SupplierCardData>` — required: `company`, `email`
- **Response:** `ApiResponse<SupplierCardData>` — with generated `id`

### PATCH /api/suppliers/:id
- **Body:** `Partial<SupplierCardData>` — delta only (dirty-checked fields)
- **Response:** `ApiResponse<SupplierCardData>` — full updated object
- **Errors:** NOT_FOUND, VALIDATION_ERROR
- **Note:** Server generates `auditLog` entries from diff

### PATCH /api/suppliers/:id/status
- **Body:** `{ status: SupplierStatus }` — any-to-any transition
- **Response:** `ApiResponse<SupplierCardData>`

### DELETE /api/suppliers/:id/audit/:entryId
- **Response:** `ApiResponse<null>`

### GET /api/suppliers/export.csv
- **Query:** same filters as GET list, no pagination
- **Response:** CSV stream (`Content-Type: text/csv`)
- **Note:** Streaming for >10k rows

---

## BCC (Bulk Cost Calculation)

### GET /api/bcc/categories
- **Query:** none
- **Response:** `ApiResponse<BccCategory[]>` — full catalog with nested children
- **Note:** ETag caching

### GET /api/bcc/recipients
- **Query:** `productIds?: string[]`
- **Response:** `ApiResponse<BccRecipient[]>` — each with `selected` flag

### GET /api/bcc/history
- **Query:** `page?: number`, `pageSize?: number`, `supplierId?: string`, `productId?: string`
- **Response:** `PaginatedResponse<BccHistoryItem>`

### POST /api/bcc/send
- **Body:** `{ supplierIds: string[], productIds: string[], message: string }`
- **Response:** `ApiResponse<BccSendResult>`
- **Note:** Idempotency-Key header required (24h cache)

### POST /api/bcc/log
- **Body:** `{ supplierIds: string[], productIds: string[], notes: string }`
- **Response:** `ApiResponse<BccSendResult>`
- **Note:** Idempotency-Key header required (24h cache)

### POST /api/bcc/events/:id/response
- **Body:** `{ price: number, unit: string, stock: string }`
- **Response:** `ApiResponse<BccEvent>` — creates new `responded` event (event-sourcing)

### POST /api/bcc/events/:id/no-response
- **Body:** none
- **Response:** `ApiResponse<BccEvent>` — creates new `no_response` event (event-sourcing)

---

## Config

### GET /api/config/fields
- **Response:** `ApiResponse<ConfigField[]>` — global field library with `usageCount`

### POST /api/config/fields
- **Body:** `{ name: string, type: ConfigFieldType, required: boolean, options?: string[] }`
- **Response:** `ApiResponse<ConfigField>` — server overrides `id`

### PATCH /api/config/fields/:id
- **Body:** `Partial<ConfigField>` — rename/update
- **Response:** `ApiResponse<ConfigField>`

### DELETE /api/config/fields/:id
- **Response:** `ApiResponse<null>`
- **Note:** Built-in fields immutable, cascade delete

### GET /api/config/sections
- **Response:** `ApiResponse<ConfigSection[]>` — sorted by `order`

### PUT /api/config/sections
- **Body:** `ConfigSection[]` — bulk replace (drag-drop reorder)
- **Response:** `ApiResponse<ConfigSection[]>`

### PATCH /api/config/sections/:id
- **Body:** `Partial<ConfigSection>` — single section merge
- **Response:** `ApiResponse<ConfigSection>`

### GET /api/config/permissions
- **Response:** `ApiResponse<PermissionMatrix>`

### PUT /api/config/permissions
- **Body:** `PermissionMatrix` — bulk replace
- **Response:** `ApiResponse<PermissionMatrix>`
- **Note:** Server doesn't validate consistency (frontend guarantees it)

---

## Uploads

### POST /api/uploads
- **Body:** multipart/form-data — file (max 20MB, MIME whitelist)
- **Response:** `ApiResponse<{ fileId: string, name: string, size: number, mime: string, url: string }>`
- **Errors:** VALIDATION_ERROR (size/mime), CONFLICT (virus INFECTED)
- **Note:** Draft storage until attached via save endpoint

---

## Analytics

### GET /api/analytics/:page
- **Query:** `period?: 'day' | 'week' | 'month' | 'year'`, `dateFrom?: string`, `dateTo?: string`
- **Response:** `ApiResponse<DashboardData>`
- **Page variants:** dashboard, suppliers, warehouse, production, sales, clients, finance, reports

---

## Categories (1.2)

### GET /api/categories
- **Query:** `search?: string`, `page?: number`, `pageSize?: number`
- **Response:** `PaginatedResponse<CategoryListItem>`
- **Save mode:** quick-action (filters)

### GET /api/categories/:id
- **Response:** `ApiResponse<Category>` — includes `inheritedFields[]` and `fields[]`
- **Save mode:** clean-slate (card edit)

### POST /api/categories
- **Body:** `{ name: string, parentId?: string, description?: string }`
- **Response:** `ApiResponse<Category>` — with generated `id`

### PATCH /api/categories/:id
- **Body:** `{ name?: string, parentId?: string, description?: string }` — delta only
- **Response:** `ApiResponse<Category>` — full updated object

### DELETE /api/categories/:id
- **Response:** `ApiResponse<null>`
- **Errors:** CONFLICT (productCount > 0 — deletion forbidden)

### PUT /api/categories/:id/fields
- **Body:** `CategoryField[]` — bulk replace (entire array, for reorder + save)
- **Response:** `ApiResponse<Category>`

---

## Products (1.1)

### GET /api/products
- **Query:** `search?: string`, `categoryId?: string`, `page?: number`, `pageSize?: number`
- **Response:** `PaginatedResponse<ProductListItem>`
- **Save mode:** quick-action (filters)

### GET /api/products/:id
- **Response:** `ApiResponse<Product>` — includes `fieldValues[]` and `linkedSuppliers[]`
- **Save mode:** clean-slate (card edit)

### POST /api/products
- **Body:** `{ name: string, sku: string, categoryId: string, description?: string, price?: number, minStock?: number, priceUnit?: PriceUnit, fieldValues?: ProductFieldValue[] }`
- **Response:** `ApiResponse<Product>` — with generated `id`

### PATCH /api/products/:id
- **Body:** `Partial<Product>` — delta only (dirty-checked fields)
- **Response:** `ApiResponse<Product>` — full updated object

### DELETE /api/products/:id
- **Response:** `ApiResponse<null>`
- **Errors:** CONFLICT (used in orders/deficit)

---

## Clients

### GET /api/clients
- **Query:** `search?: string`, `status?: 'active' | 'inactive'`, `page?: number`, `pageSize?: number`
- **Response:** `PaginatedResponse<Client>`
- **Save mode:** quick-action (list filters)

### GET /api/clients/:id
- **Response:** `ApiResponse<Client>` — full client data with order history
- **Save mode:** clean-slate (card edit, dirty-check)

### POST /api/clients
- **Body:** `{ name: string, companyCode: string, vatCode: string, address: string, phone: string, email: string, status: 'active' | 'inactive', notes: string, dynamicFields?: Record<string, unknown> }`
  - Required: `name`, `companyCode`, `email`
  - Optional: `vatCode`, `address`, `phone`, `status` (default: `active`), `notes`, `dynamicFields`
- **Response:** `ApiResponse<Client>` — with generated `id` and `createdAt`
- **Errors:** VALIDATION_ERROR (missing required fields, invalid email), CONFLICT (duplicate companyCode)

### PATCH /api/clients/:id
- **Body:** `Partial<Client>` — delta only (dirty-checked fields from form)
- **Response:** `ApiResponse<Client>` — full updated object
- **Errors:** NOT_FOUND, VALIDATION_ERROR
- **Save mode:** clean-slate — local reactive state, single PATCH on Save

### DELETE /api/clients/:id
- **Response:** `ApiResponse<null>`
- **Errors:** NOT_FOUND, CONFLICT (client has active orders)
- **Save mode:** quick-action (delete with confirm modal)

---

## Orders (3.1)

Sales order management — create, edit, track, and generate documents for client orders.

Types from `src/types/order.ts`:
- `Order`, `OrderListItem`, `OrderFilters`
- `OrderItem`, `OrderService`, `OrderDocument`
- `OrderStatus`, `OrderDocumentType`

### Error codes (domain-specific)

- `ORDER_NOT_FOUND` — 404
- `ORDER_HAS_SHIPMENTS` — 409, delete blocked (order has documents generated)
- `ORDER_ITEM_NOT_FOUND` — 404
- `VALIDATION_ERROR` — 422

### Save mode

**OrdersListPage** — quick-action: POST (create), DELETE (delete). Filters — read-only (no dirty check).

**OrderCardPage** — mixed:
- Header fields (totalAmount, totalWeight, notes, documentType, currency) — **clean-slate** via `useDirtyCheck` + `PATCH`
- Items/Services — **quick-action** via separate POST/PATCH/DELETE endpoints (each change immediate)
- Document generation — quick-action via placeholder

---

## Order list

Page: `OrdersListPage.vue`. Composable: `useOrders`.

### GET /api/orders

- **When:** `onMounted` → `load()`, filter change, page/pageSize change.
- **Query:**
  ```ts
  {
    search?: string       // search by orderNumber / clientName
    status?: string       // OrderStatus | 'all'
    clientId?: string
    dateFrom?: string     // ISO
    dateTo?: string       // ISO
    page: string          // "1"
    pageSize: string      // "25"
  }
  ```
- **Response 200:** `PaginatedResponse<OrderListItem>`
  ```json
  { "success": true, "data": { "items": [{ "id": "ORD-001", "orderNumber": "ORD-2026-001", "clientId": "CL-001", "clientName": "UAB Metalica", "status": "confirmed", "totalAmount": 12450.00, "currency": "EUR", "itemCount": 3, "createdAt": "2026-06-01T10:00:00Z" }], "total": 10, "page": 1, "pageSize": 25, "totalPages": 1 } }
  ```
- **Notes:** Sort by createdAt DESC. status filter uses exact match.

### POST /api/orders

- **When:** submit on `OrderCreatePage`.
- **Body:**
  ```ts
  {
    clientId: string           // required
    documentType: 'local' | 'export'  // required, default: 'local'
  }
  ```
- **Response 200:** `ApiResponse<Order>` — created order with empty items/services/documents arrays. Server generates `orderNumber` (ORD-YYYY-XXX sequence).
- **Notes:** 422 if no clientId.

### DELETE /api/orders/:id

- **When:** `confirmDelete` in `OrdersListPage`. **Quick action.**
- **Response 200:** `ApiResponse<void>`.
- **Notes:** 409 `ORDER_HAS_SHIPMENTS` if order has documents generated.

---

## Order card

Page: `OrderCardPage.vue`. Composable: `useOrderCard` + `useDirtyCheck`.

### GET /api/orders/:id

- **When:** `onMounted` → `load()`.
- **Response 200:** `ApiResponse<Order>` — full order with items, services, documents, auditLog.
  ```json
  { "success": true, "data": { "id": "ORD-001", "orderNumber": "ORD-2026-001", "clientId": "CL-001", "clientName": "UAB Metalica", "clientVatCode": "LT304567890", "clientAddress": "Vytauto g. 15, Kaunas", "documentType": "local", "status": "confirmed", "items": [{ "id": "oi-1", "lineNumber": 1, "productId": "prod-1", "productName": "Steel Sheet 3mm", "quantity": 10, "unit": "pcs", "unitPrice": 120.50, "discount": 0, "totalPrice": 1205.00, "batchId": null, "offcutId": null }], "services": [], "totalAmount": 1205.00, "totalVat": 253.05, "totalWithVat": 1458.05, "totalWeight": 250.50, "notes": null, "documents": [], "auditLog": [], "createdAt": "2026-06-01T10:00:00Z", "updatedAt": "2026-06-01T10:00:00Z" } }
  ```
- **Notes:** 404 `ORDER_NOT_FOUND`.

### PATCH /api/orders/:id

- **When:** Save click, only if `isDirty`. **Clean-slate** — delta only.
- **Body:** dirty-only delta (`Partial<Order>`):
  ```ts
  {
    totalAmount?: number
    totalWeight?: number
    notes?: string | null
    documentType?: 'local' | 'export'
    currency?: string
  }
  ```
  Note: `status` changes are handled via dedicated `PATCH /api/orders/:id/status` (quick-action, immediate).
- **Response 200:** `ApiResponse<Order>` — full updated order.
- **Notes:** Items/services managed through separate endpoints (see below). Last-write-wins.

### PATCH /api/orders/:id/status

- **When:** status dropdown change in card. **Quick action** — immediate.
- **Body:** `{ status: OrderStatus }`.
- **Response 200:** `ApiResponse<Order>`.
- **Notes:** Any-to-any transitions allowed. Writes to auditLog.

---

## Order items

### POST /api/orders/:id/items

- **When:** "Add product" modal submit.
- **Body:**
  ```ts
  {
    productId: string
    quantity: number
    unit: string
    unitPrice: number
    batchId?: string | null
  }
  ```
- **Response 200:** `ApiResponse<OrderItem>` — created item with server-assigned id and recalculated totals.

### PATCH /api/orders/:id/items/:lineId

- **When:** inline edit quantity/price/discount in cart.
- **Body:** `{ quantity?: number, unitPrice?: number, discount?: number }`.
- **Response 200:** `ApiResponse<OrderItem>` — updated item with recalculated totalPrice and order totals.

### DELETE /api/orders/:id/items/:lineId

- **When:** remove item button click.
- **Response 200:** `ApiResponse<void>` — order totals recalculated.

---

## Order services

### POST /api/orders/:id/services

- **When:** "Add service" modal submit.
- **Body:** `{ serviceId: string, quantity: number, price?: number }`.
- **Response 200:** `ApiResponse<OrderService>` — created service with calculated margin.

### DELETE /api/orders/:id/services/:serviceId

- **When:** remove service from order.
- **Response 200:** `ApiResponse<void>`.

---

## Feature Flags

| Flag | Level | What | Default |
|------|-------|------|---------|
| `adminOrders` | page-level | All `/admin/orders` routes | true |
| `orderKanbanView` | section-level | Kanban view toggle | false |
| `orderDocumentGen` | section-level | Document generation section | true |
| `orderCuttingTool` | section-level | "Cut" mechanism UI | false |

---

## Implementation

- Service: `src/services/ordersService.ts`
- Mock: `src/services/mocks/orders.ts`
- Composables: `src/composables/useOrders.ts`, `src/composables/useOrderCard.ts`, `src/composables/useOrderCreate.ts`
- Views:
  - `src/views/admin/orders/OrdersListPage.vue`
  - `src/views/admin/orders/OrderCreatePage.vue`
  - `src/views/admin/orders/OrderCardPage.vue`
  - `src/views/admin/orders/AddOrderItemsModal.vue`
  - `src/views/admin/orders/AddOrderServicesModal.vue`
- CSS:
  - `src/styles/admin/orders_list.css`
  - `src/styles/admin/orders_card.css`
  - `src/styles/admin/orders_create.css`
- E2E: `tests/e2e/admin/orders/orders.spec.ts`
- i18n: `src/i18n/admin/orders.ts`
