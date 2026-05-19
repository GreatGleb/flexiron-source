# Type System Reference — Flexiron Enterprise

All types are in [`frontend_vue/src/types/`](../frontend_vue/src/types/). 7 files total.

---

## [`api.ts`](../frontend_vue/src/types/api.ts) — Generic API Types

```ts
interface ApiResponse<T> {
  data: T
  success: boolean
  message?: string
}

interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface PaginationParams {
  page: number
  pageSize: number
}
```

- `ApiResponse<T>` is the envelope pattern — all API responses wrapped in `{ data, success, message }`
- `PaginatedResponse<T>` used for list endpoints (suppliers, products, categories, BCC history)

---

## [`features.ts`](../frontend_vue/src/types/features.ts) — Feature Flags

```ts
interface FeatureFlags {
  // Page-level (16)
  adminDashboard: boolean
  adminWarehouse: boolean
  adminSales: boolean
  adminSupply: boolean
  adminStaff: boolean
  adminLogistics: boolean
  adminPlReport: boolean
  adminDeficit: boolean
  suppliersList: boolean
  supplierCard: boolean
  supplierCreate: boolean
  supplierCardConfig: boolean
  bccRequest: boolean
  adminCategories: boolean
  adminProducts: boolean
  adminServices: boolean

  // Section-level (9)
  dashboardAlerts: boolean
  dashboardCharts: boolean
  supplierKanbanView: boolean
  supplierExport: boolean
  bccHistory: boolean
  permissionsEditor: boolean
  categoryFieldReorder: boolean
  categorySupplierLinks: boolean
  productSupplierLinks: boolean
}

type FeatureFlagKey = keyof FeatureFlags
```

---

## [`analytics.ts`](../frontend_vue/src/types/analytics.ts) — Analytics Types

```ts
type AnalyticsPageKey = 'dashboard' | 'warehouse' | 'sales' | 'supply' | 'staff'
  | 'logistics' | 'pl-report' | 'deficit'

interface KpiItem {
  key: string
  value: string
  delta: string
  trend: 'up' | 'down' | 'neutral'
  icon: string
  iconColor: 'blue' | 'red' | 'green' | 'gold'
}

interface AlertItem {
  type: string
  description: string
  status: 'critical' | 'overdue' | 'risk' | 'pending' | 'ok'
}

interface ChartBarItem {
  label: string
  value: number
  percentage: number
}

interface AnalyticsSectionPreview {
  key: string
  title: string
  metrics: AnalyticsMetricItem[]
}

interface AnalyticsMetricItem {
  label: string
  value: string
  status?: 'ok' | 'bad' | 'warn'
}

interface DashboardData {
  kpis: KpiItem[]
  salesByCategory: ChartBarItem[]
  alerts: AlertItem[]
  sectionPreviews: AnalyticsSectionPreview[]
}
```

---

## [`supplier.ts`](../frontend_vue/src/types/supplier.ts) — Supplier Types

```ts
type SupplierStatus = 'active' | 'preferred' | 'new' | 'under_review' | 'suspended' | 'blocked'

interface Supplier {
  id: string
  company: string
  contactPerson: string
  email: string
  phone: string
  status: SupplierStatus
  categories: string[]
  rating: number          // 1-5
  country: string
  city: string
  tags: string[]
  notes: string
  leadTime: number        // days
  lastBccDate: string | null
  hasDeficit: boolean
  createdAt: string
  updatedAt: string
}

interface SupplierFilters {
  search: string
  status: string          // 'all' | SupplierStatus
  categories: string[]
  rating: number
}

interface SupplierCardData extends Supplier {
  statusReason: string
  contractDate: string
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

interface SupplierPriceEntry {
  date: string
  productName: string
  price: number
  unit: string
}

interface SupplierAuditEntry {
  date: string
  user: string
  action: string
  details: string
}

interface SupplierAddress {
  type: string     // 'Legal' | 'Shipping' | 'Billing'
  line1: string
  city: string
  country: string
  zip: string
}

interface SupplierContact {
  name: string
  role: string
  email: string
  phone: string
}

interface SupplierFile {
  id: string
  name: string
  size: number
  type: string
  uploadedAt: string
}

interface SupplierHistoryItem {
  date: string
  event: string
  user: string
}
```

---

## [`product.ts`](../frontend_vue/src/types/product.ts) — Product Types

```ts
type PriceUnit = 'EUR/vnt' | 'EUR/kg' | 'EUR/m'

interface ProductFieldValue {
  fieldId: string
  fieldName: string
  fieldType: string    // 'text' | 'number' | 'enum' | 'boolean' | 'date' | 'tags' | 'file'
  value: unknown       // string | number | boolean | string[] | null
  inherited: boolean
  options: string[]    // for enum type
}

interface LinkedSupplier {
  id: string
  name: string
  price: number | null
  priceUnit: PriceUnit | null
  leadDays: number | null
}

interface ProductListItem {
  id: string
  name: string
  categoryId: string
  categoryName: string
  sku: string | null
  price: number | null
  priceUnit: PriceUnit | null
  minStock: number | null
  createdAt: string
}

interface Product {
  id: string
  name: string
  categoryId: string
  categoryName: string
  sku: string | null
  description: string | null
  price: number | null
  minStock: number | null
  priceUnit: PriceUnit | null
  createdAt: string
  fieldValues: ProductFieldValue[]
  linkedSuppliers: LinkedSupplier[]
}

interface ProductFilters {
  search: string
  categoryIds: string[]
  sortBy: string | null     // 'name' | 'category' | 'price'
  sortDir: 'asc' | 'desc'
}
```

---

## [`category.ts`](../frontend_vue/src/types/category.ts) — Category Types

```ts
type CategoryFieldType = 'text' | 'number' | 'enum' | 'boolean' | 'date' | 'tags' | 'file'

interface CategoryField {
  id: string
  name: string
  type: CategoryFieldType
  required: boolean
  order: number
  options: string[]    // for enum type
}

interface Category {
  id: string
  name: string
  parentId: string | null
  description: string | null
  fieldCount: number
  productCount: number
  inheritedFields: CategoryField[]
  fields: CategoryField[]
  linkedSuppliers: LinkedSupplier[]
}

interface CategoryListItem {
  id: string
  name: string
  parentId: string | null
  description: string | null
  level: number        // 0 = root, 1 = child, 2 = grandchild
  fieldCount: number
  productCount: number
}

interface CategoryFilters {
  search: string
}
```

---

## [`bcc.ts`](../frontend_vue/src/types/bcc.ts) — BCC Types

```ts
interface BccCategory {
  id: string
  name: string
  productCount: number
  children?: BccCategory[]
}

interface BccRecipient {
  id: string
  company: string
  email: string
  contactPerson: string
  selected: boolean
}

type BccEventStatus = 'sent' | 'responded' | 'no_response'

interface BccRequest {
  id: string
  requestId: string
  date: string
  supplierId: string
  supplierName: string
  productId: string
  productName: string
  source: string       // 'BCC Tool' | 'Email' | 'Phone' | 'Messenger' | 'Other'
  status: BccEventStatus
  price?: number
  unit?: string
}

interface BccEmailTemplate {
  subject: string
  body: string
  attachments: BccAttachment[]
}

interface BccAttachment {
  id: string
  name: string
  size: number
  type: string
}
```

---

## [`config.ts`](../frontend_vue/src/types/config.ts) — Configurator Types

```ts
type FieldType = 'enum' | 'number' | 'text' | 'date' | 'boolean' | 'tags'

interface FieldDefinition {
  id: string
  name: string
  type: FieldType
  required: boolean
  usageCount: number
  hidden?: boolean
  options?: string[]
}

interface SectionConfig {
  id: string
  name: string
  order: number
  collapsed: boolean
  visible: boolean
  system?: boolean
  fields: SectionField[]
}

interface SectionField {
  fieldId: string
  order: number
  visible: boolean
}

type PermissionAction = 'read' | 'edit' | 'create' | 'delete'

interface PermissionMatrix {
  roles: string[]
  users: Record<string, string[]>           // role → email[]
  rolePermissions: Record<string, Record<string, Record<PermissionAction, boolean>>>
  userPermissions: Record<string, Record<string, Record<string, Partial<Record<PermissionAction, boolean>>>>>
  items: PermissionItem[]
}

interface PermissionItem {
  itemId: string
  name: string
  type: 'section' | 'field'
  parentId?: string
}
```

---

## Type Relationships

```
Category (has fields + inheritedFields + linkedSuppliers)
  └── CategoryField (id, name, type, required, order, options)
  └── LinkedSupplier (from product.ts)

Product (has fieldValues + linkedSuppliers)
  └── ProductFieldValue (fieldId, fieldName, fieldType, value, inherited, options)
  └── LinkedSupplier (id, name, price, priceUnit, leadDays)

Supplier (base list item)
  └── SupplierCardData extends Supplier (full card with addresses, contacts, files, history, etc.)

BccRequest (event-sourcing row: product × supplier)
  └── BccRecipient (supplier with selected flag)
  └── BccCategory (product category tree)

FieldDefinition (configurator field library)
SectionConfig (configurator section with fields)
PermissionMatrix (role-based + user-level permissions)
```
