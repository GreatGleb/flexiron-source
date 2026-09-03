# Domain: Suppliers — Single-Locale Save Refactoring

## Prerequisites

Phase 1 (infrastructure) must be completed first. The utilities `toTranslatedString()` and `mergeTranslatedString()` must exist in `src/types/i18n.ts`.

## Goal

Update Suppliers domain so that:
- **Create:** sends only user's locale for TranslatedString fields
- **Patch:** sends only changed locale, merges with existing
- **Read:** `tf()` falls back to any non-empty language

## TranslatedString fields in Suppliers

- `company`
- `contactPerson`
- `statusReason`
- `addresses[].value` (each address value is TranslatedString)
- `contacts[].value` (each contact value is TranslatedString)
- `files[].name` (each file name is TranslatedString)
- `auditLog[].action` (each audit log action is TranslatedString)
- `priceHistory[].priceNote` (each price note is TranslatedString)

## Files to modify

### 1. Service: [`suppliersService.ts`](../frontend_vue/src/services/suppliersService.ts)

**a) `createSupplier` (or `createSupplierTranslated`)**

Wrap all TranslatedString fields with `toTranslatedString()`:

```ts
import { toTranslatedString } from '@/types/i18n'

export async function createSupplier(data: CreateSupplierData, locale: string) {
  return apiPost('/api/suppliers', {
    company: toTranslatedString(data.company, locale),
    contactPerson: toTranslatedString(data.contactPerson, locale),
    statusReason: data.statusReason ? toTranslatedString(data.statusReason, locale) : undefined,
    addresses: data.addresses?.map(a => ({
      ...a,
      value: toTranslatedString(a.value, locale),
    })),
    contacts: data.contacts?.map(c => ({
      ...c,
      value: toTranslatedString(c.value, locale),
    })),
    files: data.files?.map(f => ({
      ...f,
      name: toTranslatedString(f.name, locale),
    })),
    // auditLog and priceHistory are typically server-generated, but if sent:
    auditLog: data.auditLog?.map(log => ({
      ...log,
      action: toTranslatedString(log.action, locale),
    })),
    priceHistory: data.priceHistory?.map(ph => ({
      ...ph,
      priceNote: ph.priceNote ? toTranslatedString(ph.priceNote, locale) : undefined,
    })),
    // other fields...
  })
}
```

**b) `patchSupplier` (or `patchSupplierTranslated`)**

When building the PATCH payload, wrap TranslatedString fields. This is more complex due to nested arrays:

```ts
export async function patchSupplier(id: string, data: Record<string, any>, locale: string) {
  const payload: Record<string, any> = {}
  
  // Simple TranslatedString fields
  const simpleTsFields = ['company', 'contactPerson', 'statusReason']
  for (const key of simpleTsFields) {
    if (data[key] !== undefined) {
      payload[key] = toTranslatedString(data[key], locale)
    }
  }
  
  // Array fields with TranslatedString inside
  if (data.addresses) {
    payload.addresses = data.addresses.map(a => ({
      ...a,
      value: toTranslatedString(a.value, locale),
    }))
  }
  if (data.contacts) {
    payload.contacts = data.contacts.map(c => ({
      ...c,
      value: toTranslatedString(c.value, locale),
    }))
  }
  if (data.files) {
    payload.files = data.files.map(f => ({
      ...f,
      name: toTranslatedString(f.name, locale),
    }))
  }
  
  // Other non-translated fields
  for (const [key, value] of Object.entries(data)) {
    if (!simpleTsFields.includes(key) && !['addresses', 'contacts', 'files', 'auditLog', 'priceHistory'].includes(key)) {
      payload[key] = value
    }
  }
  
  return apiPatch(`/api/suppliers/${id}`, payload)
}
```

### 2. Mock: [`mocks/suppliers.ts`](../frontend_vue/src/services/mocks/suppliers.ts)

**a) `mockCreateSupplier`** — store incoming TranslatedString fields as-is

**b) `mockPatchSupplier`** — merge TranslatedString fields using `mergeTranslatedString()`:

```ts
import { mergeTranslatedString } from '@/types/i18n'

// Simple fields:
if (existing && patchData.company) {
  existing.company = mergeTranslatedString(existing.company, patchData.company)
}

// Array fields — need to match by index or id:
if (patchData.addresses) {
  patchData.addresses.forEach((addr, i) => {
    if (existing.addresses[i]) {
      existing.addresses[i].value = mergeTranslatedString(
        existing.addresses[i].value, addr.value
      )
    }
  })
}
```

### 3. Composable: [`useSuppliers.ts`](../frontend_vue/src/composables/useSuppliers.ts)

- Remove the `translated` option
- Always use translated service functions
- Pass `locale` to save functions

```ts
export function useSuppliers() {
  const { locale } = useI18n()
  
  async function create(data) {
    return suppliersService.createSupplier(data, locale.value)
  }
  
  async function patch(id, data) {
    return suppliersService.patchSupplier(id, data, locale.value)
  }
}
```

### 4. Composable: [`useSupplierCard.ts`](../frontend_vue/src/composables/useSupplierCard.ts)

Same changes — remove `translated` option, pass `locale` to save/patch.

### 5. Composable: [`useSupplierCreate.ts`](../frontend_vue/src/composables/useSupplierCreate.ts)

Same changes — remove `translated` option, pass `locale` to create.

### 6. Views

**`SuppliersListPage.vue`** — remove `translated: true`
**`SupplierCardPage.vue`** — remove `translated: true`
**`SupplierCreatePage.vue`** — remove `translated: true`

## Verification

- `vue-tsc --noEmit` passes
- Creating a supplier sends only the user's locale for all TranslatedString fields
- Patching a supplier merges TranslatedString fields (doesn't overwrite other languages)
- Nested arrays (addresses, contacts, files) are handled correctly
- Reading a supplier shows fallback to any non-empty language
