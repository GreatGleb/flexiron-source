# Баги — страницы Клиентов (CRM 3.2)

## Summary

| ID | Type | File | Summary |
|---|---|---|---|
| ✅ БАГ-1 | CSS | `ClientsListPage.vue` | Missing `_entity-card-layout.css` import — `entity-action-bar` class not loaded |
| ✅ БАГ-2 | CSS | `clients_list.css` | Missing `.empty-state` class definition |
| ✅ БАГ-3 | CSS | `client_card.css` | Missing `.main-card-content` class — used by both ClientCreatePage and ClientCardPage |
| ✅ БАГ-4 | CSS | `ClientCardPage.vue` | Uses `.text-muted` class which is only defined in warehouse_list.css, not globally |
| ✅ БАГ-5 | Template | `ClientsListPage.vue` | Error state retry button uses `t('clients.title')` instead of a retry label |
| ✅ БАГ-6 | Imports | `ClientCardPage.vue` | Unused `useRouter` import — imported but never used |
| ✅ БАГ-7 | i18n | `ClientCardPage.vue` | Audit delete tooltip uses `t('btn.delete')` — key doesn't exist, should be `t('clients.btn_delete')` |
| ✅ БАГ-8 | Mock | `services/mocks/clients.ts` | `mockGetClientAudit` missing `structuredClone` — returns raw STORE reference |

---

## ✅ БАГ-1 — ClientsListPage: missing `_entity-card-layout.css` import

**File:** `frontend_vue/src/views/admin/clients/ClientsListPage.vue:13-14`
**Severity:** Medium — classes may not apply, causing layout shift

### Problem

The template uses `entity-action-bar no-margin pos-static` on the header action bar (line 102), but the component only imports `_pagination.css` and `clients_list.css`. The classes `entity-action-bar` and `no-margin` are defined in `_entity-card-layout.css`, which is NOT imported. (`pos-static` is globally available from `_flex.css`).

### Fix

Add import:
```ts
import '@styles/admin/components/_entity-card-layout.css'
```

### Future rule

Any page using `entity-action-bar` or `no-margin` must explicitly import `_entity-card-layout.css`.

---

## ✅ БАГ-2 — clients_list.css: missing `.empty-state` class

**File:** `frontend_vue/src/styles/admin/clients_list.css`
**Severity:** Medium — empty state may render without proper layout (no flex centering)

### Problem

The template (line 143) uses `class="empty-state"` but this class is not defined in `clients_list.css`. It is NOT in admin-core.scss. It exists only in `_checkbox-list.css` (component-scoped) and `suppliers_list.css` (different page).

### Fix

Add to `clients_list.css`:
```css
.page-clients .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  text-align: center;
  gap: 16px;
}
```

### Future rule

Every page with an empty state must define `.empty-state` in its own page CSS file.

---

## ✅ БАГ-3 — client_card.css: missing `.main-card-content` class

**File:** `frontend_vue/src/styles/admin/client_card.css`
**Severity:** Low — grid still renders, but missing max-width constraint

### Problem

Both `ClientCreatePage.vue` (line 129) and `ClientCardPage.vue` (line 149) use `class="main-card-content"`. This class is only defined in `products_card.css` (`.main-card-content { max-width: 100% }` and nested `.entity-card-grid { max-width: 1400px }`). Neither `client_card.css` nor `_entity-card-layout.css` define it.

### Fix

Add to `client_card.css`:
```css
.page-client-card .main-card-content {
  max-width: 100%;
}
.page-client-card .main-card-content .entity-card-grid {
  max-width: 1400px;
}
```

### Future rule

Card page CSS files must define `.main-card-content` if the template uses it.

---

## ✅ БАГ-4 — ClientCardPage: `.text-muted` not globally accessible

**File:** `frontend_vue/src/views/admin/clients/ClientCardPage.vue:215`
**Severity:** Low — inline style fallback, but `.text-muted` class may not apply

### Problem

The audit loading state uses `class="text-muted"` (line 215). This class is only defined in `warehouse_list.css` — not in admin-core.scss or any globally imported stylesheet. The page also has an inline `style="padding: 12px 0;"` on the same element, so the visual impact is limited, but the class does nothing.

### Fix

Replace with inline style or add `.text-muted` to client_card.css:
```css
.page-client-card .text-muted {
  color: rgba(255, 255, 255, 0.35);
}
```

### Future rule

Only use CSS classes that are globally available (`admin-core.scss` imports) or defined in the page's own CSS file.

---

## ✅ БАГ-5 — ClientsListPage: error retry button shows wrong label

**File:** `frontend_vue/src/views/admin/clients/ClientsListPage.vue:140`
**Severity:** Low — functional but confusing (button shows "Clients" instead of "Retry")

### Problem

The error state retry button uses `{{ t('clients.title') }}` as its label, which renders "Clients / Клиенты / Klientai" — not a retry action. Should be "Retry" / "Повторить" / "Bandyti dar kartą".

### Fix

Change to:
```vue
<button class="btn btn-primary" @click="load">{{ t('clients.btn_retry') }}</button>
```
And add `btn_retry` key to all 3 locales in i18n.

### Future rule

Error state retry buttons must use a dedicated i18n key (`btn_retry`), not the page title.

---

## ✅ БАГ-6 — ClientCardPage: unused `useRouter` import

**File:** `frontend_vue/src/views/admin/clients/ClientCardPage.vue:3`
**Severity:** Low — no runtime impact, but violates import hygiene rule

### Problem

`useRouter` is imported from `vue-router` (line 3) but never used in the template or script. The page doesn't perform any navigation — save is handled by the composable, and there are no router-link/router-push calls.

### Fix

Remove `useRouter` from the import:
```ts
import { useRoute } from 'vue-router'
```

### Future rule

Every import must be used in the template or script. Unused imports are dead code.

---

## ✅ БАГ-7 — ClientCardPage: audit delete tooltip uses non-existent i18n key

**File:** `frontend_vue/src/views/admin/clients/ClientCardPage.vue:249`
**Severity:** Medium — tooltip shows raw key "btn.delete" in runtime

### Problem

The audit delete button uses `v-tooltip="t('btn.delete')"`. The key `btn.delete` (with dot notation) doesn't exist in any i18n file — it would require a `{ btn: { delete: '...' } }` structure. The correct key is `t('clients.btn_delete')`.

### Fix

Change to:
```vue
v-tooltip="t('clients.btn_delete')"
```

### Future rule

All i18n keys must use the domain prefix (`clients.*`). Cross-namespace or unprefixed keys cause runtime display of raw key strings.

---

## ✅ БАГ-8 — mockGetClientAudit missing structuredClone

**File:** `frontend_vue/src/services/mocks/clients.ts:167-170`
**Severity:** Medium — mutations to returned entries leak back to STORE

### Problem

`mockGetClientAudit` returns `client?.auditLog ?? []` directly, without `structuredClone`. While the composable assigns a new array (`.filter()`), individual entry objects are still references — if any entry is mutated in-place, it modifies STORE.

### Fix

```ts
export function mockGetClientAudit(clientId: string): StockAuditEntry[] {
  const client = STORE.find((c) => c.id === clientId)
  return structuredClone(client?.auditLog ?? [])
}
```

### Future rule

All mock read functions must return `structuredClone(...)`. No exceptions.
