# Products API Contract Analysis

## Overview

Analysis of the Products API contract (`roo_code/roo-context/03-api-contract.md` lines 944-1076) vs frontend implementation for backend readiness.

## ✅ Non-Issues (Contract examples are abbreviated)

The API contract states at line 74:

> **Важно:** В примерах ниже для краткости может использоваться `"company": "Metalltorg"` — это сокращение. Реальный wire format — всегда `TranslatedString`.

All name/categoryName/fieldName/options/supplierName fields shown as plain strings in contract examples are actually `TranslatedString` (ru/en/lt object) on the wire. Frontend correctly uses `TranslatedString`. **Backend must implement all these as `TranslatedString`.**

## ✅ Full Agreement (No Changes Needed)

| Aspect | Contract | Frontend | Status |
|--------|----------|----------|--------|
| GET /api/products | Query: search, page, pageSize | Sends search, page, pageSize | ✅ Match |
| GET /api/products | Response: `PaginatedResponse<ProductListItem>` | Expects same | ✅ Match |
| POST /api/products | Body: name, categoryId, sku, description, price, minStock, priceUnit | Sends same fields | ✅ Match |
| POST /api/products | Response: `ApiResponse<Product>` | Expects same | ✅ Match |
| DELETE /api/products/:id | Response: `ApiResponse<void>` | Expects same | ✅ Match |
| GET /api/products/:id | Response: `ApiResponse<Product>` with fieldValues, linkedSuppliers | Expects same | ✅ Match |
| PATCH /api/products/:id | Dirty-only delta: name, sku, description, price, minStock, priceUnit, fieldValues, linkedSuppliers | Sends exactly these | ✅ Match |
| PATCH /api/products/:id | Response: `ApiResponse<Product>` | Expects same | ✅ Match |
| Save UX | Clean-slate: PATCH only when dirty, discard = reload | useDirtyCheck + fieldValuesChanged | ✅ Match |
| Feature Flags | adminProducts, productSupplierLinks, adminServices | Implemented | ✅ Match |
| Error codes | 422 VALIDATION_ERROR, 409 PRODUCT_IN_USE, 404 PRODUCT_NOT_FOUND | Handled via ApiResponse | ✅ Match |

## 🔧 Changes Required to Contract

### 1. Remove `'EUR/баллон'` from PriceUnit

**Decision:** Remove `'EUR/баллон'` from frontend type and mock data. Keep 3 values as in contract.

**Files to update:**
- `frontend_vue/src/types/product.ts` — remove `'EUR/баллон'` from `PriceUnit` type
- `frontend_vue/src/services/mocks/products.ts` — change all `priceUnit: 'EUR/баллон'` to `priceUnit: 'EUR/vnt'` (or appropriate unit) for gas cylinder products

### 2. Replace `categoryId` with `categoryIds` in GET /api/products

**Decision:** Backend accepts `categoryIds` (comma-separated string) instead of single `categoryId`.

**Contract update needed:**
```ts
// Query params for GET /api/products
{
  search?: string       // фильтр по name (LIKE), пустая строка = без фильтра
  categoryIds?: string  // ID категорий через запятую, отсутствует = все категории
  page: string          // "1"
  pageSize: string      // "25"
  sortBy?: string       // "name" | "category" | "price"
  sortDir?: string      // "asc" | "desc"
}
```

### 3. Add `sortBy` and `sortDir` query params to GET /api/products

**Decision:** Backend supports `sortBy` and `sortDir` query parameters.

- `sortBy`: `'name' | 'category' | 'price'`
- `sortDir`: `'asc' | 'desc'`
- Default when absent: `name ASC` (backward compatible)

## 📋 Backend Implementation Requirements

### GET /api/products

```
Query:
  search?: string       -- LIKE filter on name (TranslatedString all locales)
  categoryIds?: string  -- comma-separated category IDs, absent = all
  page: string          -- "1"
  pageSize: string      -- "25"
  sortBy?: string       -- "name" | "category" | "price" (default: "name")
  sortDir?: string      -- "asc" | "desc" (default: "asc")

Response 200: PaginatedResponse<ProductListItem>
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "prod-1",
          "name": { "ru": "...", "en": "...", "lt": "..." },
          "categoryId": "cat-2",
          "categoryName": { "ru": "...", "en": "...", "lt": "..." },
          "sku": "SS-3-1000",
          "price": 120.50,
          "minStock": 50,
          "priceUnit": "EUR/vnt",
          "createdAt": "2025-01-15"
        }
      ],
      "total": 10,
      "page": 1,
      "pageSize": 25,
      "totalPages": 1
    }
  }

Errors:
  422 VALIDATION_ERROR -- invalid params
```

### POST /api/products

```
Body:
  {
    name: TranslatedString | string   -- клиент может прислать string или TranslatedString
    categoryId?: string | null
    sku?: string | null
    description?: string | null
    price?: number | null
    minStock?: number | null
    priceUnit?: 'EUR/vnt' | 'EUR/kg' | 'EUR/m' | null
  }

Response 200: ApiResponse<Product> -- created product with fieldValues: [], linkedSuppliers: []

Errors:
  422 VALIDATION_ERROR -- if no name
```

### DELETE /api/products/:id

```
Response 200: ApiResponse<void>

Errors:
  409 PRODUCT_IN_USE -- if product is used in active orders
```

### GET /api/products/:id

```
Response 200: ApiResponse<Product>
  {
    "success": true,
    "data": {
      "id": "prod-1",
      "name": { "ru": "...", "en": "...", "lt": "..." },
      "categoryId": "cat-2",
      "categoryName": { "ru": "...", "en": "...", "lt": "..." },
      "sku": "SS-3-1000",
      "description": "Hot-rolled steel sheet",
      "price": 120.50,
      "minStock": 50,
      "priceUnit": "EUR/vnt",
      "createdAt": "2025-01-15",
      "fieldValues": [
        {
          "fieldId": "f-2-1",
          "fieldName": { "ru": "...", "en": "...", "lt": "..." },
          "fieldType": "number",
          "value": 3,
          "inherited": false,
          "options": []
        }
      ],
      "linkedSuppliers": [
        {
          "id": "sup-1",
          "name": { "ru": "...", "en": "...", "lt": "..." },
          "price": 115.00,
          "priceUnit": "EUR/vnt",
          "leadDays": 7
        }
      ]
    }
  }

Errors:
  404 PRODUCT_NOT_FOUND
```

### PATCH /api/products/:id

```
Body: dirty-only delta
  {
    name?: TranslatedString | string
    sku?: string | null
    description?: string | null
    price?: number | null
    minStock?: number | null
    priceUnit?: 'EUR/vnt' | 'EUR/kg' | 'EUR/m' | null
    fieldValues?: ProductFieldValue[]     -- полный массив если изменились
    linkedSuppliers?: LinkedSupplier[]    -- полный массив если изменился список
  }

Response 200: ApiResponse<Product> -- updated product

Notes: Last-write-wins. Клиент присылает только изменившиеся поля.
```

## 📐 Type Definitions for Backend

```typescript
// PriceUnit
type PriceUnit = 'EUR/vnt' | 'EUR/kg' | 'EUR/m'

// TranslatedString
interface TranslatedString {
  ru: string
  en: string
  lt: string
}

// ProductFieldValue
interface ProductFieldValue {
  fieldId: string
  fieldName: TranslatedString
  fieldType: CategoryFieldType  // 'string' | 'number' | 'boolean' | 'enum'
  value: string | number | boolean | string[] | null
  inherited: boolean
  options?: TranslatedString[]
}

// LinkedSupplier
interface LinkedSupplier {
  id: string
  name: TranslatedString
  price: number | null
  priceUnit: PriceUnit | null
  leadDays: number | null
}

// ProductListItem (for list response)
interface ProductListItem {
  id: string
  name: TranslatedString
  categoryId: string | null
  categoryName: TranslatedString | null
  sku: string | null
  price: number | null
  minStock: number | null
  priceUnit: PriceUnit | null
  createdAt: string  // "YYYY-MM-DD"
}

// Product (full entity)
interface Product extends ProductListItem {
  description: string | null
  fieldValues: ProductFieldValue[]
  linkedSuppliers: LinkedSupplier[]
}

// ApiResponse wrapper
interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

// PaginatedResponse
interface PaginatedResponse<T> {
  success: boolean
  data: {
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}
```
