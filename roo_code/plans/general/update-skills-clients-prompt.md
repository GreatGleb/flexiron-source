# Update Skills — Clients Section (CRM 3.2)

## Контекст

Страницы Клиентов (CRM 3.2) полностью реализованы:

- **List:** [`ClientsListPage.vue`](frontend_vue/src/views/admin/clients/ClientsListPage.vue) — `/admin/clients`
- **Create:** [`ClientCreatePage.vue`](frontend_vue/src/views/admin/clients/ClientCreatePage.vue) — `/admin/clients/new`
- **Card:** [`ClientCardPage.vue`](frontend_vue/src/views/admin/clients/ClientCardPage.vue) — `/admin/clients/:id`

Все баги исправлены (8 CSS/i18n/import багов + 4 API-контракт бага). PRE-MANUAL-CHECK пройден.

## Что нужно сделать

Выполни скилл [`roo_code/skills/update-skills.md`](roo_code/skills/update-skills.md) с plan=`clients`:

```
/update-skills clients
```

Это запустит анализ багов из [`roo_code/plans/bugs/clients-bugs.md`](roo_code/plans/bugs/clients-bugs.md).

---

## Полный список багов для анализа (12 шт.)

### Из clients-bugs.md (БАГ-1 — БАГ-8)

| ID | Тип | Суть | Future rule |
|----|-----|------|-------------|
| БАГ-1 | CSS | `ClientsListPage.vue` — missing `_entity-card-layout.css` import, классы `entity-action-bar`/`no-margin` не загружены | Any page using `entity-action-bar` or `no-margin` must explicitly import `_entity-card-layout.css` |
| БАГ-2 | CSS | `clients_list.css` — missing `.empty-state` class definition | Every page with an empty state must define `.empty-state` in its own page CSS file |
| БАГ-3 | CSS | `client_card.css` — missing `.main-card-content` class (used by both CreatePage and CardPage) | Card page CSS files must define `.main-card-content` if the template uses it |
| БАГ-4 | CSS | `ClientCardPage.vue` — uses `.text-muted` class which exists only in `warehouse_list.css`, не глобально | Only use CSS classes that are globally available (admin-core.scss imports) or defined in the page's own CSS file |
| БАГ-5 | Template | `ClientsListPage.vue` — error retry button uses `t('clients.title')` вместо `t('clients.btn_retry')` | Error state retry buttons must use a dedicated i18n key (`btn_retry`), not the page title |
| БАГ-6 | Imports | `ClientCardPage.vue` — unused `useRouter` import (dead code) | Every import must be used in the template or script. Unused imports are dead code |
| БАГ-7 | i18n | `ClientCardPage.vue` — audit delete tooltip uses `t('btn.delete')` — ключ не существует, должен быть `t('clients.btn_delete')` | All i18n keys must use the domain prefix (`clients.*`). Cross-namespace or unprefixed keys cause runtime display of raw key strings |
| БАГ-8 | Mock | `mockGetClientAudit` missing `structuredClone` — возвращает raw STORE reference | All mock read functions must return `structuredClone(...)`. No exceptions |

### Из clients-api-contract-analysis.md (БАГ-9 — БАГ-12)

| ID | Тип | Суть | Контракт |
|----|-----|------|----------|
| БАГ-9 | Missing feature | GET /api/clients/:id — отсутствует `orderHistory` в типе Client и мок-данных | Contract promises `orderHistory`, но его нет |
| БАГ-10 | Validation | POST /api/clients — нет валидации required полей (name, companyCode, email) и ошибок | Contract specifies required fields + VALIDATION_ERROR |
| БАГ-11 | Error handling | DELETE /api/clients/:id — нет CONFLICT при удалении клиента с активными заказами | Contract specifies CONFLICT error code |
| БАГ-12 | Mock stub | DELETE /api/clients/:id/audit/:index — роут есть, но не вызывает mock-функцию | Мёртвый код — зарегистрирован, но не реализован |

---

## Предварительный анализ gap'ов

### БАГ-1 — CSS import gap
- **Уже есть в:** `create-page.md` Phase 6 (BUG-17 prevention, lines 656-659) + vue-rules Pitfall #16
- **Вопрос:** правило есть, но баг всё равно произошёл. Нужно ли добавить явный чеклист "verify all CSS classes used in template have corresponding imports" в Phase 6 Checkpoint 6?
- **Возможный gap:** В `create-page.md` Phase 6 Checkpoint 6 (Dead CSS check) проверяет только "defined but not used", но НЕ проверяет "used but not defined/imported". Добавить обратную проверку.

### БАГ-2 — Missing `.empty-state` CSS
- **Уже есть в:** `create-page.md` Phase 6 (BUG-18/19 prevention, line 662-663) — упоминает `.empty-state`, но только как напоминание.
- **Возможный gap:** В `create-page.md` Phase 7 (Template Data Bindings) нет явного требования: "Add `.empty-state` with `display: flex; flex-direction: column; align-items: center` to page CSS". Required CSS section (lines 750-767) не включает `.empty-state`.
- **Цель для добавления:** `create-page.md` Phase 7 — добавить `.empty-state` в required CSS rules.

### БАГ-3 — Missing `.main-card-content` CSS
- **Уже есть в:** `create-page.md` Phase 6 BUG-18/19 — "Every CSS class used in the template is defined in the page CSS"
- **Возможный gap:** правило слишком общее. Нет явного требования для card pages: define `.main-card-content { max-width: 100% }` и `.entity-card-grid { max-width: 1400px }`.
- **Цель для добавления:** `create-page.md` Phase 6 — добавить явное правило для `.main-card-content` в card page CSS.

### БАГ-4 — `.text-muted` cross-page dependency
- **Уже есть в:** vue-rules Pitfall #16 — "Component must import its own CSS styles"
- **Возможный gap:** правило про imports, но не про использование классов из других страниц. Нужно явно запретить использование CSS-классов, определённых в page-specific файлах других страниц.
- **Цель для добавления:** `vue-rules.md` — новый pitfall: запрет на использование CSS-классов из page-specific CSS других страниц.

### БАГ-5 — Error retry button wrong i18n key
- **Уже есть в:** `create-page.md` не описывает error state детально.
- **Возможный gap:** В `create-page.md` Phase 7 нет шаблона для error state с retry button. Нет указания, что retry button должен использовать `btn_retry` key.
- **Цель для добавления:** `create-page.md` Phase 7 — добавить error state section с retry button pattern и i18n key `btn_retry`.

### БАГ-6 — Unused import
- **Уже есть в:** Нет в skills. Это базовый code hygiene.
- **Возможный gap:** Слишком специфично для одной страницы? Но можно добавить в `vue-rules.md` как pitfall: после рефакторинга/удаления использования — проверять неиспользуемые imports. Или в Phase 9 verification checklist.
- **Цель:** `vue-rules.md` — новый pitfall: "After removing a feature/component usage, grep the file for unused imports".

### БАГ-7 — Cross-namespace i18n key
- **Уже есть в:** `create-page.md` Phase 5 (line 536-537) — "No cross-namespace i18n references" + "Include ALL button/label keys from template"
- **Вопрос:** правило есть. Баг произошёл из-за того, что использовался `btn.delete` (dot notation) вместо `clients.btn_delete`.
- **Возможный gap:** Правило не предупреждает о dot-notation keys (`btn.delete` требует структуры `{ btn: { delete: '...' } }`). Добавить предупреждение: "Keys with dot notation like `t('btn.delete')` require nested i18n object structure — use flat keys with underscore: `t('domain.btn_delete')`".
- **Цель:** `create-page.md` Phase 5 — добавить правило про dot-notation vs flat keys.

### БАГ-8 — Missing structuredClone in mock
- **Уже есть в:** `create-page.md` Phase 2 (lines 146-147, 160) + vue-rules Pitfall #13
- **Вопрос:** правило есть. Баг произошёл в функции, которая была добавлена ПОЗЖЕ создания initial mocks.
- **Возможный gap:** В `create-page.md` нет инструкции: "When adding NEW mock read functions to existing mock file — apply `structuredClone` rule". Phase 2 описывает только создание нового mock файла.
- **Цель:** `create-page.md` Phase 2 — добавить "When adding a new mock function to an existing file, verify it returns `structuredClone(...)`".

### БАГ-9 to БАГ-12 (API contract bugs)
- **БАГ-9** — `orderHistory` missing in type + mock. Domain-specific для Clients. Не добавлять в skills.
- **БАГ-10** — Validation missing in mock. Generic: в `create-page.md` Phase 3 (Service Layer) или Phase 2 (Mock) нет требования добавлять validation error в mock handlers.
  - **Цель для добавления:** `create-page.md` Phase 2 — добавить: "Mock create/POST handlers must validate required fields per contract and return VALIDATION_ERROR".
- **БАГ-11** — CONFLICT missing in DELETE mock. Generic: в `create-page.md` Phase 2 нет требования про CONFLICT удаления.
  - **Цель для добавления:** `create-page.md` Phase 2 — добавить: "Mock DELETE handlers must check for CONFLICT conditions (active references) per contract".
- **БАГ-12** — Mock route registered but handler not implemented. Проблема регистрации route без реализации.
  - **Цель для добавления:** `create-page.md` Phase 2 — добавить в проверку: "Verify every registered mock route has a corresponding handler function".

---

## Сводка потенциальных target skills

| Target skill | Что добавить |
|-------------|-------------|
| `create-page.md` Phase 2 | structuredClone правило для новых mock-функций; validation в mock POST handlers; CONFLICT в mock DELETE handlers; проверка handler'ов для всех зарегистрированных routes |
| `create-page.md` Phase 5 | Предупреждение о dot-notation i18n keys (`t('btn.delete')` vs `t('domain.btn_delete')`) |
| `create-page.md` Phase 6 | Явное правило для `.main-card-content` + `.entity-card-grid` в card page CSS; обратная проверка "used but not imported" в Checkpoint 6 |
| `create-page.md` Phase 7 | `.empty-state` в required CSS rules; error state section с retry button pattern и i18n key `btn_retry` |
| `create-page.md` Phase 9 | Verification checklist: проверка неиспользуемых imports после рефакторинга |
| `vue-rules.md` | Новый pitfall: запрет использования CSS-классов из page-specific CSS других страниц; новый pitfall: проверка unused imports |

---

## Порядок выполнения

1. Выполни `/update-skills clients`
2. Skills прочитает [`roo_code/plans/bugs/clients-bugs.md`](roo_code/plans/bugs/clients-bugs.md)
3. Для каждого БАГ-а (1-8) — определи root cause, target skill и location
4. Дополнительно прочитай [`roo_code/plans/bugs/clients-api-contract-analysis.md`](roo_code/plans/bugs/clients-api-contract-analysis.md) — баги БАГ-9 to БАГ-12 (PAT-* skipped)
5. Примени изменения в skills
6. Выведи completion report
