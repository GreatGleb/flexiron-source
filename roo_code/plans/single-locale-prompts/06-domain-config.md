# Domain: Config — Single-Locale Save Refactoring

## Prerequisites

Phase 1 (infrastructure) must be completed first. The utilities `toTranslatedString()` and `mergeTranslatedString()` must exist in `src/types/i18n.ts`.

## Goal

Update Config domain so that:
- **Create/update fields:** sends only user's locale for field name
- **Create/update sections:** sends only user's locale for section name
- **Read:** `tf()` falls back to any non-empty language

## TranslatedString fields in Config

- Field `name`
- Section `name`
- Permission item `name` (if editable)

## Files to modify

### 1. Service: [`configService.ts`](../frontend_vue/src/services/configService.ts)

**a) `createField` (or `createFieldTranslated`)**

```ts
import { toTranslatedString } from '@/types/i18n'

export async function createField(data: CreateFieldData, locale: string) {
  return apiPost('/api/config/fields', {
    ...data,
    name: toTranslatedString(data.name, locale),
  })
}
```

**b) `patchField` (or `patchFieldTranslated`)**

```ts
export async function patchField(id: string, data: Record<string, any>, locale: string) {
  const payload: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === 'name') {
      payload[key] = toTranslatedString(value, locale)
    } else {
      payload[key] = value
    }
  }
  return apiPatch(`/api/config/fields/${id}`, payload)
}
```

**c) `createSection` (or `createSectionTranslated`)**

```ts
export async function createSection(data: CreateSectionData, locale: string) {
  return apiPost('/api/config/sections', {
    ...data,
    name: toTranslatedString(data.name, locale),
  })
}
```

**d) `patchSection` (or `patchSectionTranslated`)**

```ts
export async function patchSection(id: string, data: Record<string, any>, locale: string) {
  const payload: Record<string, any> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === 'name') {
      payload[key] = toTranslatedString(value, locale)
    } else {
      payload[key] = value
    }
  }
  return apiPatch(`/api/config/sections/${id}`, payload)
}
```

### 2. Mock: [`mocks/config.ts`](../frontend_vue/src/services/mocks/config.ts)

**a) `mockCreateField` / `mockPatchField`** — store/merge TranslatedString fields

```ts
import { mergeTranslatedString } from '@/types/i18n'

// In mockPatchField:
if (existing && patchData.name) {
  existing.name = mergeTranslatedString(existing.name, patchData.name)
}
```

**b) `mockCreateSection` / `mockPatchSection`** — same pattern for section name

### 3. Composable: [`useCardConfig.ts`](../frontend_vue/src/composables/useCardConfig.ts)

- Remove the `translated` option
- Always use translated service functions
- Pass `locale` to create/patch functions

```ts
export function useCardConfig() {
  const { locale } = useI18n()
  
  async function createField(data) {
    return configService.createField(data, locale.value)
  }
  
  async function patchField(id, data) {
    return configService.patchField(id, data, locale.value)
  }
  
  async function createSection(data) {
    return configService.createSection(data, locale.value)
  }
  
  async function patchSection(id, data) {
    return configService.patchSection(id, data, locale.value)
  }
}
```

### 4. View

**`SupplierCardConfigPage.vue`** — remove `translated: true` from composable call

## Verification

- `vue-tsc --noEmit` passes
- Creating a field/section sends only the user's locale for name
- Patching a field/section merges TranslatedString fields
- Reading config data shows fallback to any non-empty language
