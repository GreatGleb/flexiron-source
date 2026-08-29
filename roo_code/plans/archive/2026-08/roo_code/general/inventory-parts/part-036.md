# Инвентаризация: roo_code/plans/sales-crm (part-036)

Дата: 2026-08-26. Код не менялся.

---

## 1. roo_code/plans/sales-crm/01-sales-crm-initial-plan.md

**Вердикт: частично** (незакрытых чекбоксов: 9)

### Что план требовал и что есть

Все девять файлов из раздела «What Needs to Be Created/Modified» существуют и связаны:

```
$ grep -n "sales-crm\|admin-sales-crm\|adminSalesCrm" src/router/index.ts
139:        path: 'sales-crm',
140:        name: 'admin-sales-crm',
141:        component: () => import('@/views/admin/sales-crm/SalesCrmPage.vue'),
142:        meta: { layout: 'admin', featureFlag: 'adminSalesCrm' as FeatureFlagKey },

$ grep -n "adminSalesCrm" src/config/featureFlags.ts src/types/features.ts tests/e2e/helpers/flags.ts
src/config/featureFlags.ts:24:  adminSalesCrm: true,
src/types/features.ts:21:  adminSalesCrm: boolean
tests/e2e/helpers/flags.ts:32:  adminSalesCrm: true,

$ grep -n "sidebar-nav-sales\|isSalesCrmActive" src/components/admin/AdminSidebar.vue
31:const isSalesCrmActive = computed(
101:          :to="{ name: 'admin-sales-crm' }"
103:          data-test="sidebar-nav-sales"
104:          :class="{ active: isSalesCrmActive }"

$ sed -n '31,37p' src/components/admin/AdminSidebar.vue
const isSalesCrmActive = computed(
  () =>
    route.path.startsWith('/admin/sales-crm') ||
    route.path.startsWith('/admin/clients') ||
    route.path.startsWith('/admin/orders'),
)

$ grep -n "sales-crm" src/views/public/ScreensPage.vue
157:  { id: '3.0', routeName: 'admin-sales-crm', titleKey: 'salesCrm.header_title' },

$ grep -n "salesCrm" src/i18n/admin/index.ts
13:import { adminSalesCrm } from './salesCrm'

$ ls src/views/admin/sales-crm/
SalesCrmPage.vue
```

Мёртвая ссылка `<a href="#">` из раздела «The Problem» устранена — теперь `router-link`.

Паритет ключей i18n по трём локалям (ru/en/lt по 20 ключей, симметричная разница пуста):

```
ru 20 / en 20 / lt 20
ru-en diff set()
ru-lt diff set()
```

Гейт фича-флага (`router/index.ts:443-454`) возвращает `{ name: 'not-found' }` для выключенного флага.

`npm run typecheck` — 0 ошибок, `npm run lint` — 0 ошибок (полный вывод: только строки npm-скрипта, диагностик нет).

### Чего нет

Плана как проектного решения больше нет: описанная в нём **посадочная страница с двумя карточками** («Клиенты» — «Открыть», «Заказы» — «Скоро ⏳») заменена **дашбордом** на 279 строк: четыре KPI-плитки (`sales-crm-kpi-active-orders`, `-new-clients`, `-pending-orders`, `-sales-mtd`), панели «последние заказы» и «последние клиенты», четыре быстрых действия, композабл `useSalesCrmDashboard`.

Ключевое расхождение: раздел «Заказы — placeholder / future» устарел — раздел заказов построен (`admin-orders`, `adminOrders: true`, `tests/e2e/admin/orders/`), и карточка «Скоро» невозможна и не нужна. Ключи `clients_link`, `clients_desc`, `orders_link`, `orders_desc` из плана в i18n лежат, но **никем не используются** (`grep -rn "salesCrm.clients_link\|salesCrm.orders_link\|salesCrm.clients_desc\|salesCrm.orders_desc" src/` — пусто), ключа `orders_coming_soon` нет вовсе. Это остатки от плановой версии страницы.

### Пункты чек-листа (раздел 7)

| Пункт | Вердикт | Доказательство |
|---|---|---|
| `npm run typecheck` — 0 errors | сделано | `npm run typecheck` → только строки npm-скрипта, ни одной диагностики |
| `npm run lint` — 0 errors | сделано | `npm run lint` (`--max-warnings=0`) → чисто |
| Sidebar «Продажи и CRM» ведёт на `/admin/sales-crm` | сделано | AdminSidebar.vue:101 `:to="{ name: 'admin-sales-crm' }"`; router/index.ts:139-142 |
| Sidebar подсвечивается на `/admin/sales-crm` или `/admin/clients` | сделано | AdminSidebar.vue:31-36 — плюс `/admin/orders` сверх плана |
| Карточка «Клиенты» ведёт на `/admin/clients` | сделано | SalesCrmPage.vue:71 и :222 — `:to="{ name: 'admin-clients' }"`; но это быстрое действие и ссылка панели, а не карточка из макета плана |
| Карточка «Заказы» показывает placeholder | не начато | SalesCrmPage.vue:79 и :155 ведут на реальный `admin-orders`; `grep -rn "orders_coming_soon" src/` — пусто. Пункт отменён построенным разделом заказов |
| Весь текст переводится в RU/EN/LT | сделано | salesCrm.ts: ru/en/lt по 20 ключей, симметричная разница пуста |
| `adminSalesCrm: false` → редирект на /404 | сделано | router/index.ts:443-454 — `beforeEach` по всем `to.matched`, `return { name: 'not-found' }` |
| Страница клиентов работает самостоятельно | сделано | router/index.ts:167-171 отдельный маршрут `admin-clients`; спеки `tests/e2e/admin/clients/` на месте |

### Упомянутые файлы кода
frontend_vue/src/types/client.ts, frontend_vue/src/services/clientsService.ts, frontend_vue/src/services/mocks/clients.ts, frontend_vue/src/services/mocks/index.ts, frontend_vue/src/i18n/admin/clients.ts, frontend_vue/src/i18n/admin/index.ts, frontend_vue/src/composables/useClients.ts, frontend_vue/src/composables/useClientCard.ts, frontend_vue/src/views/admin/clients/ClientsListPage.vue, frontend_vue/src/views/admin/clients/ClientCardPage.vue, frontend_vue/src/router/index.ts, frontend_vue/src/config/featureFlags.ts, frontend_vue/src/components/admin/AdminSidebar.vue, frontend_vue/src/i18n/admin/salesCrm.ts, frontend_vue/src/views/admin/sales-crm/SalesCrmPage.vue, frontend_vue/src/types/features.ts, frontend_vue/src/views/public/ScreensPage.vue, frontend_vue/tests/e2e/helpers/flags.ts, toDo/Flexiron_ERP_CRM.md

---

## 2. roo_code/plans/sales-crm/add-client-auditlog-mock-data.md

**Вердикт: сделано** (незакрытых чекбоксов: 0)

Все восемь шагов «Порядка выполнения» реализованы; реализация местами шире плана.

```
$ cat src/types/client.ts | head -3
import type { StockAuditEntry } from '@/types/warehouse'
...
  /** Client change audit log */
  auditLog?: StockAuditEntry[]

$ grep -n "mockGetClientAudit\|mockDeleteClientAuditEntry\|auditLog: \[\]" src/services/mocks/clients.ts
966:    auditLog: [],                      # mockCreateClient
1009:export function mockDeleteClientAuditEntry(clientId: string, entryId: string): void {
1043:export function mockGetClientAudit(clientId: string): StockAuditEntry[] {
1045:  return structuredClone(client?.auditLog ?? [])

$ grep -n "clients/.*audit" src/services/mocks/index.ts
522:  const clientAuditMatch = path.match(/^\/api\/clients\/([^/]+)\/audit$/)
1500:  const clientAuditDeleteMatch = path.match(/^\/api\/clients\/([^/]+)\/audit\/([^/]+)$/)

$ grep -n "getClientAudit\|deleteClientAuditEntry" src/services/clientsService.ts
28:export async function getClientAudit(clientId: string): Promise<StockAuditEntry[]>
32:export async function deleteClientAuditEntry(clientId: string, entryId: string): Promise<void>

$ grep -n "audit" src/composables/useClientCard.ts
28:  const auditLog = ref<StockAuditEntry[]>([])
29:  const auditLoading = ref(false)
115:  async function loadAudit() { ... }

$ grep -n "audit" src/views/admin/clients/ClientCardPage.vue
136:  loadAudit()
558:        <div class="audit-panel-wide" data-test="client-card-audit">
565:                <table class="audit-log-table" data-test="client-card-audit-table">
577:                    <tr v-for="a in auditLog" :key="a.id" data-test="client-card-audit-row">
```

Мок-данные — ровно те десять клиентов и ровно то число записей, что в таблице плана (подсчёт по `userInitials` внутри блока каждого клиента):

```
CL-001 entries= 3   CL-002 entries= 2   CL-003 entries= 1
CL-005 entries= 2   CL-008 entries= 2   CL-011 entries= 3
CL-013 entries= 2   CL-022 entries= 2   CL-031 entries= 2
CL-050 entries= 1
```

Пользователи и properties — из списка плана (`Система/System/Sistema` + `SY`, `Клиент создан/Client created/Klientas sukurtas`, `Статус/Status/Būsena`, `Телефон/Phone/Telefonas` и т. д.).

i18n: восемь ключей плана (`section_audit`, `audit_col_*`, `no_audit_entries`, `loading`) есть во всех трёх локалях — clients.ts:57-64 (ru), 160-167 (en), 263-270 (lt).

### Отличия от буквы плана (в пользу кода, не против)
- `StockAuditEntry` теперь несёт `id` (types/warehouse.ts:474), сиды его не пишут — `sealAuditIds` присваивает при сборке STORE (clients.ts:918), `shiftAuditSeries` привязывает журнал к демо-часам (clients.ts:927). Поэтому удаление записи идёт по `entryId`, а не по `entryIndex` из плана — и это правильнее: индекс ломается на удалении.
- Статусный переход записан `inactive → active`, а не `new → active` из плана: значения `new` в типе `Client.status` нет.
- CSS живёт не в `styles/admin/client_card.css`, а в общем `styles/admin/components/_audit-log.css` (`.audit-panel-wide`, `.audit-log-table`), который импортирует ClientCardPage.vue:19. Класс `.audit-panel` из плана не используется.
- Опциональный пункт «mockPatchClient дописывает запись в auditLog» не реализован: `mockPatchClient` (clients.ts:973-976) только `Object.assign`. План помечает его как необязательный.

### Упомянутые файлы кода
types/client.ts, services/mocks/clients.ts, services/mocks/index.ts, services/clientService.ts (в репозитории — clientsService.ts; файла с таким именем нет), composables/useClientCard.ts, ClientCardPage.vue, i18n/admin/clients.ts, styles/admin/client_card.css, @/types/warehouse

---

## 3. roo_code/plans/sales-crm/create-client-page.md

**Вердикт: сделано** (незакрытых чекбоксов: 0)

```
$ sed -n '166,184p' src/router/index.ts
      { path: 'clients',      name: 'admin-clients',       ... ClientsListPage.vue }
      { path: 'clients/new',  name: 'admin-client-create', ... ClientCreatePage.vue }
      { path: 'clients/:id',  name: 'admin-client-card',   ... ClientCardPage.vue }
```
Порядок соблюдён: `clients/new` (строка 173) стоит до `clients/:id` (строка 179) — критическое требование плана.

```
$ ls -la src/views/admin/clients/
ClientCardPage.vue    24466
ClientCreatePage.vue   8505
ClientsListPage.vue   17207

$ grep -n "showCreateModal\|createClient\|ClientFormData\|admin-client-create" src/views/admin/clients/ClientsListPage.vue
221:          :to="{ name: 'admin-client-create' }"
223:          data-test="clients-new-btn"
284:        <router-link :to="{ name: 'admin-client-create' }" class="btn btn-primary">
```
Модалка создания, `showCreateModal`, `creating`, `newForm`, `handleCreate`, импорты `createClient` и `ClientFormData` из списка — все удалены (ни одного вхождения). Оставшийся `AppModal` (строка 450) — модалка удаления, которую план велел сохранить. Кнопка пустого состояния (строка 284) тоже переведена на маршрут.

ClientCreatePage.vue: все 16 test id из раздела «Test IDs» на месте — `client-create-page` (108), `-title` (120), `-action-bar` (124), `-cancel-btn` (129), `-save-btn` (139), `-general` (153), `-contact` (203), `-status` (236), `field-name` (164), `field-company-code` (181), `field-vat` (187), `field-address` (209), `field-phone` (214), `field-email` (227), `field-status` (241), `field-notes` (195). Секции аудита нет. `saving` блокирует кнопки, успех ведёт `router.push({ name: 'admin-client-card', params: { id: created.id } })` (строка 94), отмена — `{ name: 'admin-clients' }` (строка 103).

Валидация шире плана: кроме обязательного `name` (строка 55) — обязательный `email` с проверкой формата (60, 63) и обязательный `companyCode` (68), все через `field-error` + `has-error`.

### Упомянутые файлы кода
frontend_vue/src/router/index.ts, frontend_vue/src/views/admin/clients/ClientCreatePage.vue, frontend_vue/src/views/admin/clients/ClientsListPage.vue, frontend_vue/src/i18n/admin/clients.ts, frontend_vue/src/views/admin/clients/ClientCardPage.vue
