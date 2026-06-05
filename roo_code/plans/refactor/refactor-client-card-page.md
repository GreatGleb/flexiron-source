# Plan: Refactor ClientCardPage to match ProductCardPage

## Files to modify

| File | Changes |
|------|---------|
| `frontend_vue/src/i18n/admin/clients.ts` | Add `section_contact: 'Контактные данные'` / `'Contact Information'` / `'Kontaktinė informacija'` |
| `frontend_vue/src/views/admin/clients/ClientCardPage.vue` | Full rewrite matching ProductCardPage patterns |
| `frontend_vue/src/styles/admin/client_card.css` | Full rewrite with flex layout |

## Key Changes

### 1. Breadcrumbs
Before: `Клиенты / Название`
After: `Продажи и CRM (link) / Клиенты (link) / Клиент CL-001 — UAB Metalica (current)`

### 2. Header
- Add `product-card-header-row` wrapper with h1 title + action buttons
- Use `btn-save` with `.dirty`/`.loading` classes (matching product card)
- Show "Отменить изменения" + "Сохранить" buttons

### 3. Layout grid
- Wrap in `entity-card-grid` (3 columns)
- LEFT panel: "Основная информация" — name, company code, VAT code, notes
- CENTER panel: "Контактные данные" — address, phone, email
- RIGHT panel: "Статус" — CustomSelect with active/inactive

### 4. InputGroup component
- Use `<InputGroup>` instead of bare `.input-group` divs (matching product card)

### 5. Loading & error states
- Loading: dedicated skeleton template (like product card)
- Error: proper error page with `entity-not-found` and back link
