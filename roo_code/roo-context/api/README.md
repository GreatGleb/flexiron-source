# Контракт API — индекс и карта

Контракт разложен по доменам: **один домен — один файл**. Имя файла — первый сегмент пути
после `/api/`, без исключений, поэтому «где описан эндпоинт» считается машиной, а не
помнится человеком: `/api/warehouse/stock/:id` → `warehouse.md`.

> **Этот файл генерируется.** Правка руками теряется при следующем запуске — менять надо
> генератор `frontend_vue/src/services/contractReadme.spec.ts`.
>
> ```bash
> cd frontend_vue && CONTRACT_README_WRITE=1 npx vitest run src/services/contractReadme.spec.ts
> ```

Он же и сторож: без переменной та же спека сверяет карту с инвентарём кода и краснеет на
эндпоинте, которого в карте нет, и на ссылке, которая никуда не ведёт.

## Файлы

[`00-conventions.md`](00-conventions.md) — общее для всех доменов: envelope, PATCH против PUT,
`TranslatedString`, пагинация, даты и деньги, коды ошибок, `Idempotency-Key`. Доменный файл на
общее правило **ссылается**, а не повторяет его.

Строка без ссылки — доменного файла на момент генерации ещё нет: домен в коде есть, сверка до
него не дошла. Живое состояние печатает `contract-conformance.spec.ts` строкой
`[контракт] сведено доменов: …` на каждом `npm run test:unit`.

| файл | эндпоинтов в коде |
|---|---|
| `analytics.md` | 1 |
| `audit-feed.md` | 2 |
| [`auth.md`](auth.md) | 5 |
| `bcc.md` | 7 |
| [`categories.md`](categories.md) | 6 |
| `clients.md` | 10 |
| `config.md` | 12 |
| `finance.md` | 5 |
| `notifications.md` | 4 |
| `orders.md` | 33 |
| `products.md` | 7 |
| `sales-crm.md` | 1 |
| `services.md` | 5 |
| `settings.md` | 31 |
| `suppliers.md` | 8 |
| `uploads.md` | 1 |
| `warehouse.md` | 37 |
| **итого** | **175** |

## Карта: метод и путь → файл

Все 175 эндпоинтов, которые фронтенд действительно зовёт (инвентарь `scanCode()`:
вызовы `apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete`/`apiUpload` вне моков и спек).
Параметр пути нормализован в `:id` — в доменном файле он назван осмысленно (`:orderId`).

Наличие строки здесь **не** значит, что эндпоинт описан: это карта адресов, а не состояние
работы. Что описано, а что нет — та же строка прогона спеки.

| метод | путь | файл |
|---|---|---|
| `GET` | `/api/analytics/:id` | `analytics.md` |
| `GET` | `/api/audit-feed` | `audit-feed.md` |
| `GET` | `/api/audit-feed/users` | `audit-feed.md` |
| `GET` | `/api/auth/link` | `auth.md` |
| `GET` | `/api/auth/me` | `auth.md` |
| `POST` | `/api/auth/login` | `auth.md` |
| `POST` | `/api/auth/logout` | `auth.md` |
| `POST` | `/api/auth/register` | `auth.md` |
| `GET` | `/api/bcc/categories` | `bcc.md` |
| `GET` | `/api/bcc/history` | `bcc.md` |
| `GET` | `/api/bcc/recipients` | `bcc.md` |
| `POST` | `/api/bcc/events/:id/no-response` | `bcc.md` |
| `POST` | `/api/bcc/events/:id/response` | `bcc.md` |
| `POST` | `/api/bcc/log` | `bcc.md` |
| `POST` | `/api/bcc/send` | `bcc.md` |
| `DELETE` | `/api/categories/:id` | `categories.md` |
| `GET` | `/api/categories` | `categories.md` |
| `GET` | `/api/categories/:id` | `categories.md` |
| `PATCH` | `/api/categories/:id` | `categories.md` |
| `POST` | `/api/categories` | `categories.md` |
| `PUT` | `/api/categories/:id/fields` | `categories.md` |
| `DELETE` | `/api/clients/:id` | `clients.md` |
| `DELETE` | `/api/clients/:id/audit/:id` | `clients.md` |
| `DELETE` | `/api/clients/:id/interactions/:id` | `clients.md` |
| `GET` | `/api/clients` | `clients.md` |
| `GET` | `/api/clients/:id` | `clients.md` |
| `GET` | `/api/clients/:id/audit` | `clients.md` |
| `GET` | `/api/clients/:id/invoices` | `clients.md` |
| `PATCH` | `/api/clients/:id` | `clients.md` |
| `POST` | `/api/clients` | `clients.md` |
| `POST` | `/api/clients/:id/interactions` | `clients.md` |
| `DELETE` | `/api/config/fields/:id` | `config.md` |
| `DELETE` | `/api/config/sections/:id` | `config.md` |
| `GET` | `/api/config/fields` | `config.md` |
| `GET` | `/api/config/permissions` | `config.md` |
| `GET` | `/api/config/sections` | `config.md` |
| `PATCH` | `/api/config/fields/:id` | `config.md` |
| `PATCH` | `/api/config/sections/:id` | `config.md` |
| `POST` | `/api/config/fields` | `config.md` |
| `POST` | `/api/config/sections` | `config.md` |
| `PUT` | `/api/config/fields` | `config.md` |
| `PUT` | `/api/config/permissions` | `config.md` |
| `PUT` | `/api/config/sections` | `config.md` |
| `GET` | `/api/finance/archive` | `finance.md` |
| `GET` | `/api/finance/payments` | `finance.md` |
| `GET` | `/api/finance/payments/:id` | `finance.md` |
| `GET` | `/api/finance/receivables` | `finance.md` |
| `PATCH` | `/api/finance/payments/:id` | `finance.md` |
| `GET` | `/api/notifications` | `notifications.md` |
| `GET` | `/api/notifications/unread-count` | `notifications.md` |
| `PATCH` | `/api/notifications/:id/read` | `notifications.md` |
| `PATCH` | `/api/notifications/read-all` | `notifications.md` |
| `DELETE` | `/api/orders/:id` | `orders.md` |
| `DELETE` | `/api/orders/:id/audit/:id` | `orders.md` |
| `DELETE` | `/api/orders/:id/files/:id` | `orders.md` |
| `DELETE` | `/api/orders/:id/items/:id` | `orders.md` |
| `DELETE` | `/api/orders/:id/payments/:id` | `orders.md` |
| `DELETE` | `/api/orders/:id/services/:id` | `orders.md` |
| `GET` | `/api/orders` | `orders.md` |
| `GET` | `/api/orders/:id` | `orders.md` |
| `GET` | `/api/orders/:id/invoices` | `orders.md` |
| `GET` | `/api/orders/:id/payments` | `orders.md` |
| `GET` | `/api/orders/:id/reservations` | `orders.md` |
| `GET` | `/api/orders/:id/return-plan` | `orders.md` |
| `GET` | `/api/orders/:id/returns` | `orders.md` |
| `GET` | `/api/orders/:id/ship-plan` | `orders.md` |
| `GET` | `/api/orders/:id/shipments` | `orders.md` |
| `GET` | `/api/orders/:id/status-plan` | `orders.md` |
| `PATCH` | `/api/orders/:id` | `orders.md` |
| `PATCH` | `/api/orders/:id/items/:id` | `orders.md` |
| `PATCH` | `/api/orders/:id/services/:id` | `orders.md` |
| `PATCH` | `/api/orders/:id/status` | `orders.md` |
| `POST` | `/api/orders` | `orders.md` |
| `POST` | `/api/orders/:id/allocate-total` | `orders.md` |
| `POST` | `/api/orders/:id/files` | `orders.md` |
| `POST` | `/api/orders/:id/invoices` | `orders.md` |
| `POST` | `/api/orders/:id/items` | `orders.md` |
| `POST` | `/api/orders/:id/items/:id/correct` | `orders.md` |
| `POST` | `/api/orders/:id/items/:id/split` | `orders.md` |
| `POST` | `/api/orders/:id/payments` | `orders.md` |
| `POST` | `/api/orders/:id/reserve` | `orders.md` |
| `POST` | `/api/orders/:id/returns` | `orders.md` |
| `POST` | `/api/orders/:id/services` | `orders.md` |
| `POST` | `/api/orders/:id/shipments` | `orders.md` |
| `POST` | `/api/orders/:id/shipments/:id/cancel` | `orders.md` |
| `DELETE` | `/api/products/:id` | `products.md` |
| `DELETE` | `/api/products/:id/audit/:id` | `products.md` |
| `GET` | `/api/products` | `products.md` |
| `GET` | `/api/products/:id` | `products.md` |
| `GET` | `/api/products/list` | `products.md` |
| `PATCH` | `/api/products/:id` | `products.md` |
| `POST` | `/api/products` | `products.md` |
| `GET` | `/api/sales-crm/stats` | `sales-crm.md` |
| `DELETE` | `/api/services/:id` | `services.md` |
| `GET` | `/api/services` | `services.md` |
| `GET` | `/api/services/:id` | `services.md` |
| `PATCH` | `/api/services/:id` | `services.md` |
| `POST` | `/api/services` | `services.md` |
| `DELETE` | `/api/settings/conversions/:id` | `settings.md` |
| `DELETE` | `/api/settings/currencies/:id` | `settings.md` |
| `DELETE` | `/api/settings/order-statuses/:id` | `settings.md` |
| `DELETE` | `/api/settings/uoms/:id` | `settings.md` |
| `DELETE` | `/api/settings/warehouse-map` | `settings.md` |
| `GET` | `/api/settings/company` | `settings.md` |
| `GET` | `/api/settings/constants` | `settings.md` |
| `GET` | `/api/settings/conversions` | `settings.md` |
| `GET` | `/api/settings/currencies` | `settings.md` |
| `GET` | `/api/settings/mail` | `settings.md` |
| `GET` | `/api/settings/order-permissions` | `settings.md` |
| `GET` | `/api/settings/order-statuses` | `settings.md` |
| `GET` | `/api/settings/profile` | `settings.md` |
| `GET` | `/api/settings/uoms` | `settings.md` |
| `GET` | `/api/settings/warehouse-map` | `settings.md` |
| `PATCH` | `/api/settings/company` | `settings.md` |
| `PATCH` | `/api/settings/constants` | `settings.md` |
| `PATCH` | `/api/settings/conversions/:id` | `settings.md` |
| `PATCH` | `/api/settings/currencies/:id` | `settings.md` |
| `PATCH` | `/api/settings/mail` | `settings.md` |
| `PATCH` | `/api/settings/order-statuses/:id` | `settings.md` |
| `PATCH` | `/api/settings/profile` | `settings.md` |
| `PATCH` | `/api/settings/uoms/:id` | `settings.md` |
| `POST` | `/api/settings/change-password` | `settings.md` |
| `POST` | `/api/settings/conversions` | `settings.md` |
| `POST` | `/api/settings/currencies` | `settings.md` |
| `POST` | `/api/settings/mail/test` | `settings.md` |
| `POST` | `/api/settings/order-statuses` | `settings.md` |
| `POST` | `/api/settings/uoms` | `settings.md` |
| `PUT` | `/api/settings/order-statuses/reorder` | `settings.md` |
| `PUT` | `/api/settings/warehouse-map` | `settings.md` |
| `DELETE` | `/api/suppliers/:id/audit/:id` | `suppliers.md` |
| `GET` | `/api/suppliers` | `suppliers.md` |
| `GET` | `/api/suppliers/:id` | `suppliers.md` |
| `GET` | `/api/suppliers/export.csv` | `suppliers.md` |
| `GET` | `/api/suppliers/list` | `suppliers.md` |
| `PATCH` | `/api/suppliers/:id` | `suppliers.md` |
| `PATCH` | `/api/suppliers/:id/status` | `suppliers.md` |
| `POST` | `/api/suppliers` | `suppliers.md` |
| `POST` | `/api/uploads` | `uploads.md` |
| `DELETE` | `/api/warehouse/batches/:id` | `warehouse.md` |
| `DELETE` | `/api/warehouse/batches/:id/audit/:id` | `warehouse.md` |
| `DELETE` | `/api/warehouse/deficit/:id` | `warehouse.md` |
| `DELETE` | `/api/warehouse/deficit/:id/audit/:id` | `warehouse.md` |
| `DELETE` | `/api/warehouse/movements/:id/audit/:id` | `warehouse.md` |
| `DELETE` | `/api/warehouse/offcuts/:id` | `warehouse.md` |
| `DELETE` | `/api/warehouse/offcuts/:id/audit/:id` | `warehouse.md` |
| `DELETE` | `/api/warehouse/stock/:id/audit/:id` | `warehouse.md` |
| `GET` | `/api/warehouse/batches` | `warehouse.md` |
| `GET` | `/api/warehouse/batches/:id` | `warehouse.md` |
| `GET` | `/api/warehouse/batches/:id/active-sales` | `warehouse.md` |
| `GET` | `/api/warehouse/batches/:id/aggregates` | `warehouse.md` |
| `GET` | `/api/warehouse/batches/:id/audit` | `warehouse.md` |
| `GET` | `/api/warehouse/deficit` | `warehouse.md` |
| `GET` | `/api/warehouse/deficit/:id` | `warehouse.md` |
| `GET` | `/api/warehouse/deficit/:id/audit` | `warehouse.md` |
| `GET` | `/api/warehouse/export/:id` | `warehouse.md` |
| `GET` | `/api/warehouse/movements` | `warehouse.md` |
| `GET` | `/api/warehouse/movements/:id` | `warehouse.md` |
| `GET` | `/api/warehouse/movements/:id/audit` | `warehouse.md` |
| `GET` | `/api/warehouse/offcuts` | `warehouse.md` |
| `GET` | `/api/warehouse/offcuts/:id` | `warehouse.md` |
| `GET` | `/api/warehouse/offcuts/:id/audit` | `warehouse.md` |
| `GET` | `/api/warehouse/offcuts/offers` | `warehouse.md` |
| `GET` | `/api/warehouse/stock` | `warehouse.md` |
| `GET` | `/api/warehouse/stock/:id` | `warehouse.md` |
| `GET` | `/api/warehouse/stock/:id/audit` | `warehouse.md` |
| `GET` | `/api/warehouse/stock/:id/cost` | `warehouse.md` |
| `PATCH` | `/api/warehouse/batches/:id` | `warehouse.md` |
| `PATCH` | `/api/warehouse/deficit/:id` | `warehouse.md` |
| `PATCH` | `/api/warehouse/offcuts/:id` | `warehouse.md` |
| `PATCH` | `/api/warehouse/stock/:id` | `warehouse.md` |
| `POST` | `/api/warehouse/batches` | `warehouse.md` |
| `POST` | `/api/warehouse/cutting` | `warehouse.md` |
| `POST` | `/api/warehouse/deficit` | `warehouse.md` |
| `POST` | `/api/warehouse/movements` | `warehouse.md` |
| `POST` | `/api/warehouse/offcuts` | `warehouse.md` |
