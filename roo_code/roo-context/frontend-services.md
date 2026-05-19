# Services & API Layer — Flexiron Enterprise

## API Client

[`frontend_vue/src/services/api.ts`](../frontend_vue/src/services/api.ts)

Central HTTP client with mock support. All functions check `VITE_USE_MOCKS` env var and dynamically import mock handlers.

```ts
interface RequestOptions {
  headers?: Record<string, string>
}

apiGet<T>(path, params?)        // GET with query params
apiPost<T>(path, body, opts?)   // POST with JSON body
apiPut<T>(path, body, opts?)    // PUT with JSON body
apiPatch<T>(path, body, opts?)  // PATCH with JSON body
apiDelete<T = void>(path, opts?) // DELETE
apiUpload<T>(path, file)        // multipart file upload
newIdempotencyKey()             // crypto.randomUUID() based
```

- All functions unwrap `ApiResponse<T>` envelope: `{ data: T, success: boolean, message?: string }`
- Mock mode: dynamically imports `services/mocks/index.ts` handlers
- Real mode: uses `fetch()` with JSON headers

---

## Domain Services

### [`productsService.ts`](../frontend_vue/src/services/productsService.ts)

| Function | Method | Path | Returns |
|----------|--------|------|---------|
| `getProducts(filters, pagination)` | GET | `/api/products` | `PaginatedResponse<ProductListItem>` |
| `getProduct(id)` | GET | `/api/products/:id` | `Product` |
| `createProduct(data)` | POST | `/api/products` | `Product` |
| `patchProduct(id, delta)` | PATCH | `/api/products/:id` | `Product` |
| `deleteProduct(id)` | DELETE | `/api/products/:id` | `void` |

- `delta` type: `Partial<Pick<Product, 'name' | 'sku' | 'description' | 'price' | 'minStock' | 'priceUnit' | 'fieldValues' | 'linkedSuppliers'>>`

### [`suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts)

| Function | Method | Path | Returns |
|----------|--------|------|---------|
| `getSuppliers(filters, pagination)` | GET | `/api/suppliers` | `PaginatedResponse<Supplier>` |
| `getSupplier(id)` | GET | `/api/suppliers/:id` | `SupplierCardData` |
| `patchSupplier(id, patch)` | PATCH | `/api/suppliers/:id` | `SupplierCardData` |
| `patchSupplierStatus(id, status)` | PATCH | `/api/suppliers/:id/status` | `void` |
| `createSupplier(payload)` | POST | `/api/suppliers` | `SupplierCardData` |
| `deleteAuditEntry(supplierId, entryIndex)` | DELETE | `/api/suppliers/:id/audit/:entryIndex` | `void` |
| `exportSuppliersCsv(filters)` | GET | `/api/suppliers/export.csv` | `string` (CSV) |

### [`categoriesService.ts`](../frontend_vue/src/services/categoriesService.ts)

| Function | Method | Path | Returns |
|----------|--------|------|---------|
| `getCategories(filters, page, pageSize)` | GET | `/api/categories` | `PaginatedResponse<CategoryListItem>` |
| `getCategory(id)` | GET | `/api/categories/:id` | `Category` |
| `createCategory(data)` | POST | `/api/categories` | `Category` |
| `patchCategory(id, delta)` | PATCH | `/api/categories/:id` | `Category` |
| `deleteCategory(id)` | DELETE | `/api/categories/:id` | `void` |
| `putCategoryFields(id, fields)` | PUT | `/api/categories/:id/fields` | `CategoryField[]` |

- `delta` can include `linkedSuppliers` alongside header fields

### [`bccService.ts`](../frontend_vue/src/services/bccService.ts)

| Function | Method | Path | Returns |
|----------|--------|------|---------|
| `getBccCategories()` | GET | `/api/bcc/categories` | `BccCategory[]` |
| `getBccRecipients(productIds)` | GET | `/api/bcc/recipients?products=...` | `BccRecipient[]` |
| `getBccHistory(pagination?)` | GET | `/api/bcc/history` | `PaginatedResponse<BccRequest>` |
| `sendBccRequest(payload)` | POST | `/api/bcc/send` | `{ requestId: string }` |
| `logBccRequest(payload)` | POST | `/api/bcc/log` | `{ requestId: string }` |
| `acceptBccResponse(eventId, payload)` | POST | `/api/bcc/events/:id/response` | `BccRequest` |
| `markBccNoResponse(eventId)` | POST | `/api/bcc/events/:id/no-response` | `BccRequest` |

- `sendBccRequest` and `logBccRequest` include `Idempotency-Key` header

### [`configService.ts`](../frontend_vue/src/services/configService.ts)

| Function | Method | Path | Returns |
|----------|--------|------|---------|
| `getFieldLibrary()` | GET | `/api/config/fields` | `FieldDefinition[]` |
| `saveFieldLibrary(fields)` | PUT | `/api/config/fields` | `void` |
| `createField(payload)` | POST | `/api/config/fields` | `FieldDefinition` |
| `patchField(id, patch)` | PATCH | `/api/config/fields/:id` | `FieldDefinition` |
| `deleteField(id)` | DELETE | `/api/config/fields/:id` | `void` |
| `getSections()` | GET | `/api/config/sections` | `SectionConfig[]` |
| `saveSections(sections)` | PUT | `/api/config/sections` | `void` |
| `createSection(payload)` | POST | `/api/config/sections` | `SectionConfig` |
| `patchSection(id, patch)` | PATCH | `/api/config/sections/:id` | `SectionConfig` |
| `deleteSection(id)` | DELETE | `/api/config/sections/:id` | `void` |
| `getPermissions()` | GET | `/api/config/permissions` | `PermissionMatrix` |
| `savePermissions(matrix)` | PUT | `/api/config/permissions` | `void` |

### [`analyticsService.ts`](../frontend_vue/src/services/analyticsService.ts)

| Function | Method | Path | Returns |
|----------|--------|------|---------|
| `getAnalyticsPage(page)` | GET | `/api/analytics/:page` | `DashboardData` |

### [`uploadsService.ts`](../frontend_vue/src/services/uploadsService.ts)

| Function | Method | Path | Returns |
|----------|--------|------|---------|
| `uploadFile(file)` | POST (multipart) | `/api/uploads` | `UploadedFile` |

---

## Mock Layer

[`frontend_vue/src/services/mocks/index.ts`](../frontend_vue/src/services/mocks/index.ts)

Central mock router. Activated when `VITE_USE_MOCKS=true`.

### Architecture
- `getMock<T>(path, params?)` — GET handler with regex path matching
- `postMock<T>(path, body, headers?)` — POST with idempotency cache
- `putMock<T>(path, body)` — PUT handler
- `patchMock<T>(path, body)` — PATCH handler
- `deleteMock<T>(path)` — DELETE handler
- `uploadMock<T>(path, file)` — file upload handler

### Idempotency Cache
```ts
const idempotencyCache = new Map<string, unknown>()
```
- Keyed by `Idempotency-Key` header value
- If key exists, returns cached response (prevents double-POST)

### Upload Registry
```ts
const uploadRegistry = new Map<string, UploadedFileMeta>()
```
- Stores uploaded file metadata by fileId

### Delay Simulation
All mock responses wrapped in `delay(300)` — `new Promise(r => setTimeout(r, 300))`

### Mock Route Table

**GET routes:**
| Path Pattern | Handler |
|---|---|
| `/api/analytics/:page` | `mockGetAnalyticsPage` |
| `/api/suppliers/export.csv` | Returns CSV string |
| `/api/suppliers/:id` | `mockGetSupplier` |
| `/api/suppliers` | `mockGetSuppliers` |
| `/api/bcc/categories` | Returns `MOCK_BCC_CATEGORIES` |
| `/api/bcc/recipients` | Filters by product categories |
| `/api/bcc/history` | Paginated `MOCK_BCC_HISTORY` |
| `/api/config/fields` | Returns `MOCK_FIELD_LIBRARY` |
| `/api/config/sections` | Returns `MOCK_SECTIONS` |
| `/api/config/permissions` | Returns `MOCK_PERMISSIONS` |
| `/api/categories/:id` | `mockGetCategory` |
| `/api/categories` | `mockGetCategories` |
| `/api/products/:id` | `mockGetProduct` |
| `/api/products` | `mockGetProducts` |

**POST routes:** `/api/bcc/send`, `/api/bcc/log`, `/api/bcc/events/:id/response`, `/api/bcc/events/:id/no-response`, `/api/suppliers`, `/api/config/fields`, `/api/config/sections`, `/api/categories`, `/api/products`

**PUT routes:** `/api/config/sections`, `/api/config/fields`, `/api/config/permissions`, `/api/categories/:id/fields`

**PATCH routes:** `/api/suppliers/:id/status`, `/api/suppliers/:id`, `/api/categories/:id`, `/api/products/:id`, `/api/config/sections/:id`, `/api/config/fields/:id`

**DELETE routes:** `/api/suppliers/:id/audit/:entryId`, `/api/config/fields/:id`, `/api/config/sections/:id`, `/api/categories/:id`, `/api/products/:id`

### Mock Data Files

| File | Content | Size |
|------|---------|------|
| [`products.ts`](../frontend_vue/src/services/mocks/products.ts) | 10+ products with fieldValues, linkedSuppliers | 1840 lines |
| [`suppliers.ts`](../frontend_vue/src/services/mocks/suppliers.ts) | 8 suppliers with full card data | 440 lines |
| [`categories.ts`](../frontend_vue/src/services/mocks/categories.ts) | 8 categories with fields, inheritedFields, linkedSuppliers | 460 lines |
| [`bcc.ts`](../frontend_vue/src/services/mocks/bcc.ts) | BCC categories, recipients, history events | 262 lines |
| [`analytics.ts`](../frontend_vue/src/services/mocks/analytics.ts) | Dashboard data with KPIs, charts, alerts | 109 lines |
| [`config.ts`](../frontend_vue/src/services/mocks/config.ts) | Field library, sections, permissions matrix | 250 lines |
