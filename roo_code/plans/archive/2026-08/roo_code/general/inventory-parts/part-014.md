# Инвентаризация планов — часть 014

Каталог: `roo_code/plans/general`. Код не менялся.

---

## 1. `roo_code/plans/general/mvp-roadmap.md` — **частично**

Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0). Пункты — таблицы блоков 1–7, вердикт по каждому ниже.

### Доказательство (сводка команд)

```
$ ls frontend_vue/src/views/admin/
analytics clients finance notifications orders products sales-crm settings suppliers warehouse

$ ls frontend_vue/src/views/admin/settings/
CompanySettings.vue FinanceSettings.vue LogsSettings.vue OrderStatusesSettings.vue
ProfileSettings.vue SettingsLayout.vue UnitsSettings.vue

$ ls frontend_vue/src/views/admin/finance/
DocumentArchivePage.vue FinanceSubNav.vue IncomingPaymentCardPage.vue
IncomingPaymentsPage.vue OutgoingPaymentCardPage.vue OutgoingPaymentsPage.vue

$ grep -n "export async function\|apiPost\|apiPatch" frontend_vue/src/services/financeService.ts
1:import { apiGet, apiPatch } from './api'
11:export async function getPayments(...)   29:getPayment   33:patchPayment   40:getArchive
   → создания операции руками нет: только GET и PATCH

$ grep -rln "orderDocumentGen" frontend_vue/src/
frontend_vue/src/types/features.ts
frontend_vue/src/config/featureFlags.ts
   → флаг нигде в UI не читается

$ grep -rn "jspdf\|pdfmake\|pdf-lib\|print()" frontend_vue/src frontend_vue/package.json
   → только имена файлов-моков (*.pdf), библиотеки генерации нет

$ grep -rn "reserv" frontend_vue/src/services/ordersService.ts
350:export async function reserveOrderStock(  354: apiPost(`/api/orders/${orderId}/reserve`)
358: apiGet(`/api/orders/${orderId}/reservations`)
$ ls frontend_vue/src/services/mocks/reservations.ts   → есть (единый стор резервов)
$ grep -n "order-reserve-btn" frontend_vue/src/views/admin/orders/OrderCardPage.vue → 1761

$ grep -rn "available\|STOCK" frontend_vue/src/services/mocks/orders.ts
1706: if (plan.shortages.length > 0) throw new Error('STATUS_BLOCKED_BY_STOCK')
3048: if (plan.shortages.length > 0) throw new Error('SHIPMENT_EXCEEDS_STOCK')
   → отрицательный остаток НЕ разрешён, отгрузка блокируется (обратное решение)

$ grep -rln "PurchaseOrder\|purchaseOrder" frontend_vue/src | grep -v mocks/warehouse
frontend_vue/src/types/warehouse.ts  (поля purchaseOrderId)
$ grep -rn "purchase" frontend_vue/src/router/index.ts → ничего

$ grep -rn "kanban" frontend_vue/src/views/admin/orders/OrdersListPage.vue → ничего
$ grep -n "orderKanbanView" frontend_vue/src/config/featureFlags.ts → 59: orderKanbanView: false

$ grep -rln "picking\|pickList" frontend_vue/src → ничего

$ grep -rn "api/settings/users\|api/users" frontend_vue/src/services/*.ts frontend_vue/src/services/mocks/index.ts
   → ничего (нет CRUD пользователей)

$ grep -n ":to\|to=" frontend_vue/src/components/admin/AdminSidebar.vue
65: /admin/analytics/dashboard   79: admin-products   90: admin-warehouse
101: admin-sales-crm   112: /admin/suppliers   123: /admin/finance/incoming
136,162: admin-settings-profile   → «Финансы» и «Настройки» в сайдбаре реальные ссылки,
   шестерёнка уже не заглушка `<a href="#">`
```

### Что есть / чего нет по блокам

| Пункт плана | Вердикт | Чем подтверждено |
|---|---|---|
| Сайдбар: Финансы → новая страница | сделано (иначе, чем описано) | не один `FinancePage`, а три: incoming / outgoing / archive + `FinanceSubNav` |
| Сайдбар: Настройки → новая страница | сделано | `SettingsLayout.vue` + 6 вкладок, роуты `admin-settings-*` |
| 1. Settings: Компания | сделано | `CompanySettings.vue`, `/api/settings/company` |
| 1. Settings: Финансы (PVM, маржа, валюты) | сделано | `FinanceSettings.vue`, `/api/settings/currencies`, `/api/settings/constants` |
| 1. Settings: Единицы измерения + матрица | сделано | `UnitsSettings.vue`, `/api/settings/uoms`, `/api/settings/conversions` |
| 1. Settings: Статусы заказов (порядок) | сделано | `OrderStatusesSettings.vue`, `/api/settings/order-statuses/reorder` |
| 1. Settings: Карта склада (секторы) | частично | `WarehouseMapPage.vue` — загрузка картинки (`DropZone`, `useWarehouseMap`), секторов нет; и живёт в разделе Склад, не в Настройках |
| 1. Settings: Пользователи (CRUD + роли) | не начато | нет страницы, нет эндпоинта; `LogsSettings.vue` только читает список для фильтра |
| 2. Лента финансовых операций | частично | ленты платежей и архив документов есть, поиск/фильтр/пагинация есть |
| 2. Ссылка на источник из операции | сделано | `payment-view-btn` → карточка платежа, карточки платежей ссылаются на заказ |
| 2. Ручной ввод операции (модалка) | не начато | `financeService.ts` не умеет POST |
| 3.1 Логика пакета документов (Local/Export) | не начато | `orderDocumentGen` не читается ни одним компонентом |
| 3.2 Предпросмотр перед генерацией | не начато | тем же грепом |
| 3.3 Генерация PDF (Invoice, CMR, KPO…) | не начато | ни одной PDF-библиотеки в проекте |
| 3.4 Архив документов | частично | `DocumentArchivePage.vue` — список метаданных (invoice/facture/waybill/cmr), самих файлов и версионности нет |
| 4.1 Резервирование товара | сделано | `mocks/reservations.ts`, `POST /api/orders/:id/reserve`, кнопка `order-reserve-btn` |
| 4.2 Списание при отгрузке | сделано | shipments пишут движения `sale`, `orders.spec.ts:1525-1533` («movement points back at the shipment») |
| 4.3 Отрицательные остатки → сигнал закупщику | не начато (решено наоборот) | `SHIPMENT_EXCEEDS_STOCK` / `STATUS_BLOCKED_BY_STOCK` — минус запрещён |
| 4.4 Механизм «Отрезать» из заказа | частично | резка есть отдельной страницей `WarehouseCuttingPage.vue`; из заказа — нет, `orderCuttingTool: false` и флаг нигде не читается |
| 5.1–5.5 Purchase Orders | не начато | нет сущности, роутов, страниц; только поле `purchaseOrderId` в типах дефицита/движений и `PO-2025-*` в моках |
| 6.1 Inline-редактирование товаров | сделано | `orderLineEdits.ts` + `ALL_LINE_CELLS` (quantity, unitCost, marginPercent, discountPercent, unitPrice, lineTotal) |
| 6.2 Отображение НДС и скидок | сделано | `totals.totalVat` в карточке, колонка `orders.col_discount` |
| 6.3 Маржинальность услуг | сделано | колонки `col_margin_percent` / `col_margin_amount` под `canSeeCost` в обеих таблицах |
| 6.4 История заказов в клиенте | сделано | `client-card-order-history` + `client-card-order-table` в `ClientCardPage.vue` |
| 6.5 Валидация email/companyCode | сделано | `ClientCreatePage.vue:51-70` — name, email (обязателен + формат), companyCode |
| 6.6 Канбан-доска заказов | не начато | `orderKanbanView: false`, в `OrdersListPage.vue` слова kanban нет |
| 7.1 Рейсы (Shipments) | сделано | `orderShipments: true`, `/api/orders/:id/shipments`, частичные отгрузки и отмена |
| 7.2 Задания кладовщику, QR-сканирование | не начато | `picking`/`pickList` в коде нет |
| 7.3 Интеграция с бухгалтерией (экспорт) | не начато | совпадения только в i18n-строках и настройках, кода экспорта нет |

**Осталось:** пользователи в настройках, секторы карты склада, ручная финансовая операция, весь блок генерации документов (3.1–3.3), отрицательные остатки/сигнал закупщику, резка из заказа, Purchase Orders целиком, канбан заказов, задания кладовщику, экспорт в бухгалтерию.

Упомянутых путей файлов кода в плане нет (ссылки только на другие планы: `settings-plan.md`, `toDo/plans/2-crm-analysis-plan.md`).

---

## 2. `roo_code/plans/general/phase10-clients-prompt.md` — **сделано**

Незакрытых чекбоксов: 0.

### Доказательство

```
$ ls frontend_vue/tests/e2e/admin/clients/
clients.spec.ts  clients.spec.ts-snapshots
$ wc -l frontend_vue/tests/e2e/admin/clients/clients.spec.ts
873

$ grep -c "^  test(\|^test(\|  testWithFlags(" frontend_vue/tests/e2e/admin/clients/clients.spec.ts
   → 60+ тестов в describe-блоках: structure, table view, search, status filter,
     pagination, delete modal, empty state, create structure/validation/flow,
     card structure, fields & save flow, audit log, order history (+empty),
     interaction history, error state, флаг OFF → /404, i18n RU/EN/LT,
     визуальные снапшоты по секциям @1440

$ grep -n "clients" frontend_vue/tests/e2e/smoke.spec.ts
37: { path: '/admin/clients', label: 'clients-list' }
38: { path: '/admin/clients/new', label: 'client-create' }
39: { path: '/admin/clients/CL-001', label: 'client-card' }
$ grep -n "clients" frontend_vue/tests/e2e/navigation.spec.ts
49,50,55,56,60,61,62 — три маршрута клиентов
$ grep -n "adminClients" frontend_vue/tests/e2e/feature-flags.spec.ts frontend_vue/tests/e2e/helpers/flags.ts
feature-flags.spec.ts:27,28,29 — три маршрута под флагом
helpers/flags.ts:30 — adminClients: true
$ grep -n "console\|pageerror" frontend_vue/tests/e2e/smoke.spec.ts
57-62,95 — консольные ошибки и битые ответы проверяются на каждой странице списка
```

### Отклонения от буквы плана (не «не сделано», а сделано иначе)

- `beforeEach` с `page.route('**/api/clients/**')` не используется: приложение ходит в собственный мок-слой (`src/services/mocks/clients.ts`, 55 клиентов), тесты работают через `openAdminPage`/`waitForDataReady`. Цель (детерминированные данные) достигнута.
- Пункт «Load & no-crash без консольных ошибок» закрыт не спеком клиентов, а `smoke.spec.ts`, где эта проверка общая для всех маршрутов, включая три клиентских.
- Референсы плана `tests/e2e/admin/suppliers/list.spec.ts` и `card.spec.ts` в репозитории называются `suppliers-list.spec.ts` и `supplier-card.spec.ts` — устаревшие пути в плане, работы за собой не тянут.
- Все перечисленные в плане `data-test` присутствуют, спек проверяет ещё и то, чего в плане не было: историю взаимодействий, пустую историю заказов, CONFLICT-случай («a client with orders is not offered for deletion»).

**Осталось:** ничего. Прогон плейрайта в рамках инвентаризации не запускался (инвентаризация не меняет и не гоняет код), поэтому «зелёный» не утверждается — утверждается наличие и содержание всех требуемых тестов и регистраций.

---

## 3. `roo_code/plans/general/prompt-for-new-session.md` — **частично**

Незакрытых чекбоксов: 0. План — отчёт о проверке порядка мок-маршрутов; сам отчёт в нём уже написан, актуальной осталась одна находка.

### Доказательство

```
$ wc -l frontend_vue/src/services/mocks/index.ts
1700              (в плане ссылки на строки 84-379 — файл с тех пор вырос вчетверо)

$ grep -n "translated" frontend_vue/src/services/mocks/index.ts
470:  if (path === '/api/clients' || path === '/api/clients/translated') {
534:  if (path === '/api/orders' || path === '/api/orders/translated') {
   → ни одного /translated для suppliers, products, categories, bcc, config —
     маршрутов из таблиц плана в коде больше нет

$ grep -rn "translated" frontend_vue/src/services/*.ts
только configService.ts:33-37,63-67 — локальная переменная translatedPatch
$ grep -rn "createSupplierTranslated" frontend_vue/src/
   → ничего: функция-вызывающая сторона удалена

$ grep -n "api/suppliers\|api/products\|api/categories" frontend_vue/src/services/mocks/index.ts
313 /api/suppliers/export.csv | 323 /api/suppliers/list | 332 /api/suppliers |
346 regex /^\/api\/suppliers\/([^/]+)$/ | 412 /api/categories | 418 regex карточки |
423 /api/products | 437 /api/products/list | 446 regex карточки
   → правило «явный путь и список до regex карточки» соблюдено

$ (проверены и остальные ресурсы)
GET: warehouse stock/batches/offcuts/deficit — regex карточки `([^/]+)$` не может
перехватить `/audit`, `/cost`, `/aggregates` (одна секция в группе), конфликта нет.
`movements`: regex карточки (733) стоит ДО списка (738) — стилистически против правила
плана, функционально безвредно: regex требует хвостовой сегмент.
POST: общий диспетчер `/^(\/api\/orders\/)([^/]+)(\/[^/]+)$/` (1008) не возвращает
ничего, если подпуть не один из трёх (shipments/payments/returns), поэтому не
затеняет reserve/invoices/items/services/files ниже (1037-1083).
PATCH: 1163 `/suppliers/:id/status` до 1170 `/suppliers/:id` — правильно.
```

### Что есть / чего нет

- **Есть:** сама проверка (отчёт с таблицами) выполнена и записана в план; правила порядка в текущем коде соблюдены — специфичные пути и списки стоят до regex карточек, единственное отступление (movements) безвредно.
- **Нет:** предложенное планом исправление — добавить в `postMock()` обработчик `path === '/api/suppliers/translated'` — не внесено. Оно стало неактуальным: `createSupplierTranslated()` удалена вместе со всем семейством `/translated`-эндпоинтов, кроме clients и orders. То есть проблема закрыта не тем способом, который в плане.
- **Расходится с кодом:** обе таблицы маршрутов и все номера строк плана описывают прошлое состояние файла (24 GET-маршрута против нынешних ~60, включая orders, warehouse, finance, settings, notifications, services, clients).

**Осталось:** ничего действующего. Если план держат как чек-лист, его таблицы надо переписать под текущий `mocks/index.ts` — но это работа по документу, не по коду.

Упомянутые файлы кода: `frontend_vue/src/services/mocks/index.ts`, `frontend_vue/src/services/productsService.ts`, `frontend_vue/src/services/suppliersService.ts`, `frontend_vue/src/services/categoriesService.ts`, `frontend_vue/src/services/configService.ts`, `frontend_vue/src/services/bccService.ts` — все существуют.
