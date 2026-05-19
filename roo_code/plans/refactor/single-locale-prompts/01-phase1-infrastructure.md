# Phase 1: Core Infrastructure

## Context

This is the first phase of the Single-Locale Save refactoring. It must be completed before any domain-specific tasks.

## Goal

Update the core translation infrastructure to support single-locale saves.

## Changes needed

### 1. Update `tf()` in `useTranslatedData.ts`

**File:** [`frontend_vue/src/composables/useTranslatedData.ts`](../frontend_vue/src/composables/useTranslatedData.ts)

Find the `tf()` function. Currently it falls back to `field.ru` only. Change it to fall back to **any non-empty language**:

```ts
// Current:
function tf(field: TranslatedString | null | undefined): string {
  if (!field) return ''
  return field[locale.value as keyof TranslatedString] ?? field.ru
}

// Target:
function tf(field: TranslatedString | null | undefined): string {
  if (!field) return ''
  const currentLocale = locale.value as keyof TranslatedString
  if (field[currentLocale]) return field[currentLocale]
  // Fallback to any non-empty language
  return field.ru || field.en || field.lt || ''
}
```

### 2. Create `toTranslatedString()` utility

**File:** [`frontend_vue/src/types/i18n.ts`](../frontend_vue/src/types/i18n.ts) (create if not exists)

Create a pure utility function that wraps a string value into a `TranslatedString` for a specific locale:

```ts
import type { TranslatedString } from './types' // adjust import path as needed

export function toTranslatedString(value: string, locale: string): TranslatedString {
  const result: TranslatedString = { ru: '', en: '', lt: '' }
  if (locale in result) {
    result[locale as keyof TranslatedString] = value
  }
  return result
}
```

### 3. Create `mergeTranslatedString()` utility

In the same file, create a merge utility for PATCH operations:

```ts
export function mergeTranslatedString(
  existing: TranslatedString | null | undefined,
  incoming: Partial<TranslatedString>
): TranslatedString {
  return {
    ru: existing?.ru || '',
    en: existing?.en || '',
    lt: existing?.lt || '',
    ...Object.fromEntries(
      Object.entries(incoming).filter(([, v]) => v !== undefined && v !== null)
    ),
  }
}
```

## Verification

- `vue-tsc --noEmit` passes
- The `tf()` function now falls back to any non-empty language
- `toTranslatedString('Hello', 'en')` returns `{ ru: '', en: 'Hello', lt: '' }`
- `mergeTranslatedString({ ru: 'Привет', en: '', lt: '' }, { en: 'Hello' })` returns `{ ru: 'Привет', en: 'Hello', lt: '' }`
