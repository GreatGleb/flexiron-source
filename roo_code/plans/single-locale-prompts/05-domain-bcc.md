# Domain: BCC — Single-Locale Save Refactoring

## Prerequisites

Phase 1 (infrastructure) must be completed first. The utilities `toTranslatedString()` and `mergeTranslatedString()` must exist in `src/types/i18n.ts`.

## Goal

Update BCC domain so that:
- **Send request:** sends only user's locale for template subject/body
- **Log request:** sends only user's locale for source field
- **Read:** `tf()` falls back to any non-empty language

## TranslatedString fields in BCC

- Template `subject` (when sending a BCC request)
- Template `body` (when sending a BCC request)
- `source` field (when logging a BCC request)

## Files to modify

### 1. Service: [`bccService.ts`](../frontend_vue/src/services/bccService.ts)

**a) `sendBccRequest` (or `sendBccRequestTranslated`)**

```ts
import { toTranslatedString } from '@/types/i18n'

export async function sendBccRequest(data: SendBccData, locale: string) {
  return apiPost('/api/bcc/send', {
    ...data,
    subject: toTranslatedString(data.subject, locale),
    body: toTranslatedString(data.body, locale),
  })
}
```

**b) `logBccRequest` (or `logBccRequestTranslated`)**

```ts
export async function logBccRequest(data: LogBccData, locale: string) {
  return apiPost('/api/bcc/log', {
    ...data,
    source: toTranslatedString(data.source, locale),
  })
}
```

### 2. Mock: [`mocks/bcc.ts`](../frontend_vue/src/services/mocks/bcc.ts)

**a) `mockSendBccRequest`** — store incoming TranslatedString fields as-is

**b) `mockLogBccRequest`** — store incoming TranslatedString fields as-is

### 3. Composable: [`useBccRequest.ts`](../frontend_vue/src/composables/useBccRequest.ts)

- Remove the `translated` option
- Always use translated service functions
- Pass `locale` to send/log functions

```ts
export function useBccRequest() {
  const { locale } = useI18n()
  
  async function send(data) {
    return bccService.sendBccRequest(data, locale.value)
  }
  
  async function log(data) {
    return bccService.logBccRequest(data, locale.value)
  }
}
```

### 4. View

**`BccRequestPage.vue`** — remove `translated: true` from composable call

## Verification

- `vue-tsc --noEmit` passes
- Sending a BCC request sends only the user's locale for subject/body
- Logging a BCC request sends only the user's locale for source
- Reading BCC data shows fallback to any non-empty language
