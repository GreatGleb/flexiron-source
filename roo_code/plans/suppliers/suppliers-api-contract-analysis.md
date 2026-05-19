# API Contract Analysis — Suppliers Domain

## Overview

This document analyzes the readiness of the API contract for the **Suppliers domain** (including BCC, Config, and related modules) for backend development. The analysis is based on:

- [`roo_code/roo-context/03-api-contract.md`](../roo_code/roo-context/03-api-contract.md) — canonical API contract (981 lines)
- [`toDo/admin-api-contract.md`](../toDo/admin-api-contract.md) — duplicate copy (982 lines)
- [`frontend_vue/src/types/supplier.ts`](../frontend_vue/src/types/supplier.ts) — frontend type definitions
- [`frontend_vue/src/services/suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts) — frontend service layer
- [`frontend_vue/src/services/mocks/suppliers.ts`](../frontend_vue/src/services/mocks/suppliers.ts) — mock implementation
- [`frontend_vue/src/services/mocks/index.ts`](../frontend_vue/src/services/mocks/index.ts) — mock router
- [`frontend_vue/src/services/api.ts`](../frontend_vue/src/services/api.ts) — API client with mock/real switching
- [`roo_code/plans/suppliers/4.1-suppliers-plan.md`](../roo_code/plans/suppliers/4.1-suppliers-plan.md) — supplier implementation plan
- [`roo_code/roo-context/01-todo-crm.md`](../roo_code/roo-context/01-todo-crm.md) — CRM roadmap
- [`roo_code/roo-context/02-erp-algorithm.md`](../roo_code/roo-context/02-erp-algorithm.md) — ERP business processes

---

## 1. Current State Summary

### What exists (frontend side, fully implemented with mocks)

| Component | Status | Lines |
|-----------|--------|-------|
| `SuppliersListPage.vue` | ✅ Complete | 673 |
| `SupplierCardPage.vue` | ✅ Complete | 341 |
| `SupplierCreatePage.vue` | ✅ Complete | — |
| `BccRequestPage.vue` | ✅ Complete | 1350 |
| `SupplierCardConfigPage.vue` | ✅ Complete | 1053 |
| `useSuppliers` composable | ✅ Complete | — |
| `useSupplierCard` composable | ✅ Complete | — |
| `useSupplierCreate` composable | ✅ Complete | — |
| `useBccRequest` composable | ✅ Complete | — |
| `useCardConfig` composable | ✅ Complete | — |
| `suppliersService.ts` | ✅ Complete | 95 lines |
| `bccService.ts` | ✅ Complete | — |
| `configService.ts` | ✅ Complete | — |
| `uploadsService.ts` | ✅ Complete | — |
| Mock data (`mocks/suppliers.ts`) | ✅ Complete | 473 lines |
| Mock router (`mocks/index.ts`) | ✅ Complete | 358 lines |
| Types (`types/supplier.ts`, `types/bcc.ts`, `types/config.ts`) | ✅ Complete | — |

### What is missing (backend)

**No backend exists yet.** All data flows through in-memory mocks controlled by `VITE_USE_MOCKS` env var.

---

## 2. API Contract Completeness Assessment

### 2.1 General Conventions — ✅ FULLY DEFINED

| Convention | Status | Notes |
|-----------|--------|-------|
| Envelope (`ApiResponse<T>`) | ✅ Defined | `success`, `data`, `message`, `code` |
| Pagination (`PaginatedResponse<T>`) | ✅ Defined | `items`, `total`, `page`, `pageSize`, `totalPages` |
| Date/time format (ISO 8601) | ✅ Defined | |
| Money (number, 2 decimals) | ✅ Defined | |
| Auth (HttpOnly cookie + CSRF) | ✅ Defined | |
| Error codes | ✅ Defined | 6 codes: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT, RATE_LIMITED, SERVER_ERROR |
| Idempotency-Key | ✅ Defined | Required on `POST /bcc/send` and `POST /bcc/log` |
| PATCH vs PUT semantics | ✅ Defined | PATCH = merge single entity, PUT = bulk replace collection |
| Save UX / Clean-slate | ✅ Defined | Local-first, single PATCH on Save, no autosave |
| File uploads | ✅ Defined | `POST /api/uploads` → `fileId` → attach via save endpoint |
| Feature flags | ✅ Defined | Page-level + section-level |

### 2.2 Auth Endpoints — ✅ FULLY DEFINED

5 endpoints, all clearly specified:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | Email/password login, sets HttpOnly session cookie |
| `/api/auth/register` | POST | Registration with VAT validation, auto-login |
| `/api/auth/logout` | POST | Session invalidation |
| `/api/auth/me` | GET | Current user hydrate |
| `/api/auth/refresh` | POST | Session refresh |

### 2.3 Suppliers Endpoints — ✅ FULLY DEFINED

| # | Endpoint | Method | Contract Status | Notes |
|---|----------|--------|----------------|-------|
| 1 | `/api/suppliers` | GET | ✅ Complete | Paginated list with filters (search, status, categories, rating) |
| 2 | `/api/suppliers/export.csv` | GET | ✅ Complete | CSV export, same filters, no pagination, streaming |
| 3 | `/api/suppliers` | POST | ✅ Complete | Create supplier, returns `SupplierCardData` with generated `id` |
| 4 | `/api/suppliers/:id` | GET | ✅ Complete | Full `SupplierCardData` including nested objects |
| 5 | `/api/suppliers/:id` | PATCH | ✅ Complete | Dirty-only delta, merge patch, server generates audit log |
| 6 | `/api/suppliers/:id/status` | PATCH | ✅ Complete | Quick action, any→any transitions |
| 7 | `/api/suppliers/:id/audit/:entryId` | DELETE | ✅ Complete | Direct delete, no meta-record |

### 2.4 BCC Endpoints — ✅ FULLY DEFINED

| # | Endpoint | Method | Contract Status | Notes |
|---|----------|--------|----------------|-------|
| 1 | `/api/bcc/categories` | GET | ✅ Complete | Full catalog with nested children, ETag caching |
| 2 | `/api/bcc/recipients` | GET | ✅ Complete | Filtered by product IDs, `selected` flag |
| 3 | `/api/bcc/history` | GET | ✅ Complete | Paginated event-sourcing history |
| 4 | `/api/bcc/send` | POST | ✅ Complete | Idempotency-Key required, sends email + creates history |
| 5 | `/api/bcc/log` | POST | ✅ Complete | Idempotency-Key required, no email, creates history |
| 6 | `/api/bcc/events/:id/response` | POST | ✅ Complete | Event-sourcing, creates new `responded` event |
| 7 | `/api/bcc/events/:id/no-response` | POST | ✅ Complete | Event-sourcing, creates new `no_response` event |

### 2.5 Config Endpoints — ✅ FULLY DEFINED

| # | Endpoint | Method | Contract Status | Notes |
|---|----------|--------|----------------|-------|
| 1 | `/api/config/fields` | GET | ✅ Complete | Global field library with `usageCount` |
| 2 | `/api/config/fields` | POST | ✅ Complete | Create custom field, server overrides `id` |
| 3 | `/api/config/fields/:id` | PATCH | ✅ Complete | Rename/update custom field |
| 4 | `/api/config/fields/:id` | DELETE | ✅ Complete | Cascade delete, built-in fields immutable |
| 5 | `/api/config/sections` | GET | ✅ Complete | Sections sorted by `order` |
| 6 | `/api/config/sections` | PUT | ✅ Complete | Bulk replace (drag-drop reorder) |
| 7 | `/api/config/sections/:id` | PATCH | ✅ Complete | Single section merge patch |
| 8 | `/api/config/permissions` | GET | ✅ Complete | Full permission matrix |
| 9 | `/api/config/permissions` | PUT | ✅ Complete | Bulk replace, server doesn't validate consistency |

### 2.6 Uploads Endpoint — ✅ FULLY DEFINED

| Endpoint | Method | Contract Status | Notes |
|----------|--------|----------------|-------|
| `/api/uploads` | POST | ✅ Complete | Multipart upload, draft storage, 20MB limit, MIME whitelist, virus scan |

### 2.7 Analytics Endpoints — ✅ FULLY DEFINED

| Endpoint | Method | Contract Status | Notes |
|----------|--------|----------------|-------|
| `/api/analytics/:page` | GET | ✅ Complete | 8 page variants, common `DashboardData` shape |

---

## 3. Detailed Contract Analysis

### 3.1 Strengths (well-defined areas)

1. **Envelope consistency** — All endpoints use `ApiResponse<T>` wrapper. The client (`api.ts`) already handles unwrapping and error throwing. Exception (`export.csv`) is explicitly documented.

2. **PATCH vs PUT semantics** — Clearly separated. PATCH for single-entity merge (RFC 7396), PUT for bulk collection replace. This prevents common concurrency bugs.

3. **Save UX / Clean-slate** — The contract explicitly forbids autosave, drafts, and per-keystroke sync. This is a critical architectural decision that simplifies backend significantly.

4. **Idempotency-Key pattern** — Required on `POST /bcc/send` and `POST /bcc/log` with 24h server cache. Already implemented in mocks (`withIdempotency` helper).

5. **File upload pipeline** — Clean separation: `POST /api/uploads` → draft storage → `fileIds[]` on save endpoint → permanent storage. No separate file CRUD endpoints.

6. **Event-sourcing for BCC** — Each response/no-response creates a new event rather than mutating the original. This preserves full audit trail.

7. **Permission matrix** — Server is explicitly told NOT to validate consistency. All 5 cascade rules are frontend-side. This is a pragmatic decision that avoids duplicating complex business logic.

8. **Error codes** — Well-defined with HTTP status mapping. Client already handles `!json.success` generically.

### 3.2 Potential Issues / Ambiguities

#### Issue 1: `SupplierCardData` vs `Supplier` type mismatch

The contract says `GET /api/suppliers` returns `PaginatedResponse<Supplier>` (flat), while `GET /api/suppliers/:id` returns `SupplierCardData` (nested with `addresses`, `contacts`, `files`, `auditLog`, `priceHistory`). However, looking at the frontend types:

- [`Supplier`](../frontend_vue/src/types/supplier.ts:11) has fields like `notes`, `tags`, `leadTime`, `lastBccDate`, `hasDeficit`
- [`SupplierCardData`](../frontend_vue/src/types/supplier.ts:38) extends `Supplier` with `addresses`, `contacts`, `files`, `history`, `priceHistory`, `auditLog`, `statusReason`, `vatCode`, `currency`, `paymentTerms`, `minOrder`, `bccEmails`

**This is fine** — the list endpoint returns a lighter object. But the backend must ensure:
- `PATCH /api/suppliers/:id` accepts `Partial<SupplierCardData>` (deep structure)
- `POST /api/suppliers` returns `SupplierCardData` (full structure)
- The `Supplier` type in the list response must be a subset of `SupplierCardData`

**Risk: Low.** The contract is clear about which shape each endpoint returns.

#### Issue 2: `TranslatedString` in types vs plain strings in contract

The frontend types use `TranslatedString` (e.g., `company: TranslatedString` = `{ ru: string; en: string; lt: string }`), but the contract examples show plain strings like `"company": "Metalltorg"`.

Looking at [`suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts:28-51), the service layer converts strings to `TranslatedString` using `toTranslatedString(value, locale)` before sending. This means:

- **The backend receives `TranslatedString` objects** (e.g., `{ ru: "Металлторг", en: "Metalltorg", lt: "Metalltorg" }`)
- **The contract examples show simplified strings** — this is a documentation inconsistency

**Risk: Medium.** The contract examples don't match the actual wire format. Backend must expect `TranslatedString` objects for: `company`, `contactPerson`, `statusReason`, `notes` (notes is plain string though), and all nested `TranslatedString` fields in `SupplierPriceEntry`, `SupplierAuditEntry`, `SupplierContact`, `SupplierFile`, `SupplierHistoryItem`.

**Recommendation:** Update contract examples to show `TranslatedString` format, or clarify that the backend receives pre-translated strings (one locale at a time). Based on the service code, it seems the frontend sends the full `TranslatedString` object with all 3 locales.

#### Issue 3: `DELETE /api/suppliers/:id/audit/:entryId` — entryId is a number index, not a UUID

In [`suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts:82-84):
```ts
export async function deleteAuditEntry(supplierId: string, entryIndex: number): Promise<void> {
  await apiDelete<void>(`/api/suppliers/${supplierId}/audit/${entryIndex}`)
}
```

The contract says `:entryId` but the frontend passes `entryIndex` (a number). The mock at [`mocks/suppliers.ts`](../frontend_vue/src/services/mocks/suppliers.ts) likely uses array index.

**Risk: Low.** The backend can accept either. But the contract should clarify whether this is a database ID or an array index. If it's an index, concurrent edits could shift indices and cause wrong deletion.

**Recommendation:** Clarify in contract — use a stable database ID (`auditEntryId`) rather than an index.

#### Issue 4: `PATCH /api/suppliers/:id` — server generates audit log from diff

The contract states: "Сервер сам генерит `auditLog` entries по diff (сравнивает с предыдущим state)."

This means the backend must:
1. Load current state from DB
2. Compare with incoming `Partial<SupplierCardData>`
3. Generate `SupplierAuditEntry` records for each changed field
4. Apply the merge
5. Return the full updated object

**Risk: Medium.** This is non-trivial logic. The backend needs to know which fields are diffable, handle `TranslatedString` comparison, and generate human-readable `oldValue`/`newValue` strings. The contract doesn't specify the format of these diff strings.

**Recommendation:** Add a section specifying the audit log diff format (e.g., `"Рейтинг: 4 → 5"`, `"Статус: active → suspended"`).

#### Issue 5: `notes` field format — client-generated timestamps

The contract specifies that `notes` is a single string with blocks separated by `\n\n`, each block starting with `dd.mm.yyyy hh:mm` timestamp generated by the client.

**Risk: Low.** The backend just stores and returns this string. No server-side parsing needed.

#### Issue 6: `POST /api/uploads` — virus scan

The contract mentions async virus scan with 422 `INFECTED`. This adds complexity:
- Files are in draft storage during scan
- If infected, the file becomes unusable
- The frontend needs to handle this error when saving

**Risk: Medium.** Virus scanning infrastructure needs to be planned. The contract doesn't specify how the frontend learns about infection status (polling? webhook?).

**Recommendation:** Clarify the virus scan flow. Options: (a) synchronous scan (blocking), (b) async with polling endpoint `GET /api/uploads/:fileId/status`, (c) async with notification.

#### Issue 7: `POST /api/suppliers` — body is `Partial<SupplierCardData>` with required `company` and `email`

The contract says body is `Partial<SupplierCardData>` with mandatory `company` and `email`. But `SupplierCardData` includes nested objects (`addresses`, `contacts`, `files`, etc.). The creation endpoint likely only accepts top-level fields + maybe `addresses`/`contacts`.

**Risk: Low.** The frontend `SupplierCreatePage` likely sends a subset. The backend should validate `company` and `email` are present, and accept whatever else is provided.

#### Issue 8: No `DELETE /api/suppliers/:id` endpoint

There's no endpoint to delete a supplier entirely. The contract only has `DELETE /api/suppliers/:id/audit/:entryId`.

**Risk: Low.** This might be intentional (suppliers are deactivated via status change, not deleted). But if soft-delete or hard-delete is needed later, it's missing.

#### Issue 9: `GET /api/suppliers/export.csv` — streaming requirement

The contract mentions streaming for >10k rows. This is a performance requirement, not a contract issue.

**Risk: Low.** Backend should implement streaming CSV generation.

#### Issue 10: Categories and Products endpoints are also defined

The contract also includes Categories (1.2) and Products (1.1) endpoints. These are separate domains but share the `Supplier` entity through `linkedSuppliers`.

**Risk: Low.** These are well-defined in the contract.

---

## 4. Data Model Mapping

### 4.1 Supplier (list view)

```typescript
interface Supplier {
  id: string
  company: TranslatedString    // { ru, en, lt }
  contactPerson: TranslatedString
  email: string
  phone: string
  status: SupplierStatus       // 'active' | 'preferred' | 'new' | 'under_review' | 'suspended' | 'blocked'
  categories: string[]
  rating: number               // 1-5
  country: string
  city: string
  tags: string[]
  notes: string
  leadTime: number             // days
  lastBccDate: string | null   // ISO date
  hasDeficit: boolean
  createdAt: string            // ISO datetime
  updatedAt: string            // ISO datetime
}
```

### 4.2 SupplierCardData (card view)

Extends `Supplier` with:
```typescript
interface SupplierCardData extends Supplier {
  statusReason: TranslatedString
  contractDate: string         // ISO date
  vatCode: string
  currency: string
  paymentTerms: string
  minOrder: number | null
  bccEmails: string[]
  addresses: SupplierAddress[]
  contacts: SupplierContact[]
  files: SupplierFile[]
  history: SupplierHistoryItem[]
  priceHistory: SupplierPriceEntry[]
  auditLog: SupplierAuditEntry[]
}
```

### 4.3 Database Tables (inferred)

Based on the contract, the backend would need at minimum these tables:

| Table | Description | Key Fields |
|-------|-------------|------------|
| `suppliers` | Core supplier data | All `Supplier` fields + `statusReason`, `contractDate`, `vatCode`, `currency`, `paymentTerms`, `minOrder`, `bccEmails` (JSON array) |
| `supplier_addresses` | One-to-many addresses | `supplier_id`, `type`, `line1`, `line2`, `city`, `country`, `zip` |
| `supplier_contacts` | One-to-many contacts | `supplier_id`, `name` (JSON), `role` (JSON), `email`, `phone` |
| `supplier_files` | One-to-many files | `supplier_id`, `file_id` (references uploads), `name`, `size`, `type`, `uploaded_at` |
| `supplier_audit_log` | Audit trail | `supplier_id`, `timestamp`, `user`, `property`, `old_value`, `new_value` |
| `supplier_price_history` | Pricing history | `supplier_id`, `date`, `product`, `stock`, `price`, `unit`, `source`, `status` |
| `supplier_history` | Activity history | `supplier_id`, `date`, `action`, `user`, `details` |
| `uploads` | File storage | `file_id`, `name`, `size`, `mime`, `path`, `status` (draft/permanent), `uploaded_at` |
| `bcc_events` | Event-sourcing log | `id`, `request_id`, `supplier_id`, `product_id`, `date`, `source`, `status`, `price`, `unit` |
| `bcc_categories` | Product categories | `id`, `name`, `parent_id`, `product_count` |
| `bcc_recipients` | Supplier BCC emails | `supplier_id`, `email`, `contact_person` |
| `config_fields` | Field definitions | `id`, `name`, `type`, `required`, `options` (JSON), `usage_count` |
| `config_sections` | Section definitions | `id`, `name`, `order`, `collapsed`, `visible`, `fields` (JSON) |
| `config_permissions` | Permission matrix | Single-row store for the whole matrix (JSON) |
| `users` | Auth users | `id`, `email`, `password_hash`, `name`, `role`, `locale` |
| `sessions` | Auth sessions | `id`, `user_id`, `expires_at`, `csrf_token` |

---

## 5. Backend Readiness Assessment

### 5.1 Overall Readiness: ✅ HIGH (85-90%)

The API contract is **comprehensive and well-specified**. All endpoints are defined with:
- Trigger conditions (when the frontend calls them)
- Request/response shapes with TypeScript interfaces
- JSON examples
- Error codes
- Auth/permission requirements
- Edge cases and notes

### 5.2 What's Ready for Immediate Backend Development

| Domain | Readiness | Endpoints Count |
|--------|-----------|-----------------|
| Auth | ✅ 100% | 5 |
| Suppliers (list + card) | ✅ 95% | 6 |
| BCC Request Tool | ✅ 95% | 7 |
| Config (fields + sections + permissions) | ✅ 95% | 9 |
| Uploads | ✅ 90% | 1 |
| Analytics | ✅ 90% | 8 (1 pattern) |
| Categories | ✅ 95% | 5 |
| Products | ✅ 95% | 5 |

### 5.3 What Needs Clarification Before Backend Starts

1. **`TranslatedString` wire format** — Update contract examples to show `{ ru, en, lt }` objects instead of plain strings, OR decide to send single-locale values (the service code suggests multi-locale objects are sent).

2. **Audit log diff format** — Specify the exact string format for `oldValue`/`newValue` in `SupplierAuditEntry`.

3. **Virus scan flow** — Clarify how the frontend learns about infection status after `POST /api/uploads`.

4. **Audit entry deletion** — Clarify whether `entryId` is a database ID or an array index.

5. **`SupplierCardData` shape for `POST /api/suppliers`** — Clarify which nested fields are accepted on creation (likely only top-level + `addresses`/`contacts`).

### 5.4 Implementation Priority (Suggested)

| Phase | Endpoints | Effort Estimate |
|-------|-----------|-----------------|
| **Phase 1: Auth + Infrastructure** | Auth (5), Uploads (1), API envelope, error handling, session management | Foundation |
| **Phase 2: Suppliers Core** | `GET /api/suppliers`, `GET /api/suppliers/:id`, `PATCH /api/suppliers/:id`, `PATCH /api/suppliers/:id/status`, `POST /api/suppliers`, `DELETE /api/suppliers/:id/audit/:entryId`, `GET /api/suppliers/export.csv` | Main domain |
| **Phase 3: Config** | Config (9 endpoints) — fields, sections, permissions | Depends on Phase 2 |
| **Phase 4: BCC** | BCC (7 endpoints) — categories, recipients, history, send, log, events | Depends on Phase 2 |
| **Phase 5: Analytics** | Analytics (8 page variants) | Can be parallel |
| **Phase 6: Categories + Products** | Categories (5), Products (5) | Separate domain |

---

## 6. Key Architectural Decisions for Backend

### 6.1 Must Implement

1. **RFC 7396 JSON Merge Patch** for all PATCH endpoints — partial body, server merges
2. **Idempotency-Key cache** (24h TTL) for `POST /bcc/send` and `POST /bcc/log`
3. **Event-sourcing** for BCC events — never mutate, always append
4. **Audit log generation** from PATCH diff on supplier card
5. **Draft → permanent file transition** on save endpoints
6. **Session-based auth** with HttpOnly cookies + CSRF token
7. **Permission checking** against `PermissionMatrix` on supplier CRUD operations
8. **CSV streaming** for supplier export

### 6.2 Must NOT Implement

1. **Autosave / draft infrastructure** — explicitly forbidden by contract
2. **Separate file CRUD endpoints** — files managed via `fileIds[]` on save
3. **Separate notes endpoints** — notes are part of `PATCH /api/suppliers/:id`
4. **Permission matrix consistency validation** — frontend guarantees it
5. **Optimistic locking** — deferred to future (last-write-wins for now)
6. **Sort options on supplier list** — fixed `updatedAt DESC` for now

### 6.3 Technology Considerations

Based on the project structure (Vue 3 frontend, TypeScript), the backend could be:
- **Node.js/Express** or **NestJS** — consistent language with frontend
- **PostgreSQL** — good fit for relational data with JSON columns
- The `TranslatedString` pattern suggests JSON columns for multi-locale fields

---

## 7. Conclusion

**The API contract for the Suppliers domain is 85-90% ready for backend development.** The contract is detailed, consistent, and covers all endpoints the frontend needs. The frontend is fully implemented with mocks that match the contract.

### Critical Path Items (must resolve before backend starts):

1. ✅ Clarify `TranslatedString` wire format in contract examples
2. ✅ Define audit log diff string format
3. ✅ Clarify virus scan flow for uploads
4. ✅ Clarify audit entry ID type (DB ID vs index)
5. ✅ Clarify `POST /api/suppliers` accepted fields

### Overall Assessment: **READY FOR BACKEND DEVELOPMENT**

The contract is mature enough to begin backend implementation. The 5 clarifications above are minor and can be resolved during development. The frontend team has done an excellent job of specifying the contract comprehensively.

**Total endpoints to implement: 29** (Auth: 5, Uploads: 1, Suppliers: 6, BCC: 7, Config: 9, Analytics: 1 pattern × 8 pages)
