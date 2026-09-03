# Инвентаризация: roo_code/plans/orders/orders-backend-contract.md

- **Путь:** `roo_code/plans/orders/orders-backend-contract.md` (427 строк, 85 614 байт)
- **Вердикт:** частично
- **Незакрытых чекбоксов:** 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`) — документ-контракт, не список задач

## Что план утверждает и требует

Это контракт «что должен реализовать сервер, чтобы фронтенд заработал без правок:
достаточно переключить `VITE_USE_MOCKS=false`». Референс — мок
`frontend_vue/src/services/mocks/orders.ts`. Требования делятся на три группы:

1. **серверная реализация** ~34 эндпоинтов `/api/orders/*`, `/api/sales-crm/stats`,
   `/api/settings/order-permissions` с версионированием, идемпотентностью, FIFO,
   каталогом ошибок §6;
2. **клиентская половина контракта** — мок как эталон сервера, `ordersService`,
   который шлёт `version`/`If-Match` и `Idempotency-Key`, типы, конверт правки строки;
3. **один явно отложенный пункт фронтенда** — §5: режим для роли без `seeCost`,
   в котором карточка перестаёт считать цены локально и показывает серверные числа
   (план сам говорит: «Второе — работа на фронтенде, которая ещё не сделана»).

## Доказательства

### Серверной части нет вовсе

```
$ ls backend/app/modules/
auth  bcc  billing  finance  __init__.py  notifications  products  services
settings  suppliers  warehouse

$ grep -rn "api/orders\|sales-crm" backend/ 2>/dev/null | head
(пусто)

$ find backend/app/modules -maxdepth 3 -type d -name features -exec sh -c 'echo "{}:"; ls {}' \;
backend/app/modules/notifications/features: __init__.py
backend/app/modules/billing/features:       __init__.py
backend/app/modules/finance/features:       __init__.py
backend/app/modules/auth/features:          __init__.py login magic_link me register
backend/app/modules/suppliers/features:     __init__.py
backend/app/modules/settings/features:      crud __init__.py profile
backend/app/modules/bcc/features:           __init__.py
backend/app/modules/products/features:      create_product get_product_detail __init__.py
backend/app/modules/services/features:      __init__.py
backend/app/modules/warehouse/features:     __init__.py
```

Модуля `orders` нет, слайсов заказов нет, ни одного маршрута `/api/orders` в
`backend/` нет. `GET /api/settings/order-permissions` тоже только на клиенте:

```
$ grep -rn "order-permissions\|order_permissions" backend/ frontend_vue/src | head
frontend_vue/src/services/mocks/index.ts:381:  if (path === '/api/settings/order-permissions') ...
frontend_vue/src/services/settingsService.ts:35:  return apiGet<OrderPermissions>('/api/settings/order-permissions', ...)
```

### Клиентская половина контракта на месте и сходится сама с собой

`ordersService.ts` вызывает все описанные пути (34 вызова, включая
`/status-plan`, `/ship-plan`, `/return-plan`, `/returns`, `/allocate-total`,
`/items/:id/split`, `/items/:id/correct`, `/shipments/:id/cancel`, `/reserve`,
`/reservations`, `/invoices`, `/payments`, `/audit/:entryId`, `/files/:fileId`),
проносит `version` в теле и `ifMatch(version)` в `DELETE`, и ставит
`Idempotency-Key` на отгрузке, возврате и платеже.

Все коды ошибок §6 заведены (проверено по каждому):
`ORDER_VERSION_CONFLICT`, `ORDER_FILE_NOT_FOUND`, `ALLOCATIONS_NOT_ACCEPTED`,
`CATALOG_SERVICE_NOT_FOUND`, `CATALOG_PRODUCT_NOT_FOUND`, `UNKNOWN_SORT_KEY`,
`UNKNOWN_SORT_DIRECTION`, `INVALID_PAGE`, `INVALID_DATE_FILTER`,
`NUMBER_NOT_FINITE`, `UNKNOWN_ORDER_STATUS`, `RETURN_BATCH_NOT_FOUND`,
`CORRECTION_EXCEEDS_ORIGINAL`, `CORRECTION_NEEDS_CHANGE`, `LINE_NOT_FROZEN` —
все встречаются и в `src/services/orderLineEdits.ts`, и в `src/services/mocks/orders.ts`.
Есть `withdrawsOriginal`, `heldReleased`, `restored`, `returnedQuantity`,
`sensitive` на записи истории.

Механическая проверка каталога кодов, которую план требует «держать в проекте
навсегда», существует и зелёная:

```
$ npx vitest run --config vitest.audit.config.ts src/services/mocks/order-audit-contract-conformance.spec.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  185ms
```

Отдельно проверены места, которые план описывает как «сегодня сломано» — они
починены, то есть план в этих абзацах описывает прошлое:

- `POST /items` не принимает себестоимость: `mockAddOrderItem` вызывает
  `refuseStatedCost(statedCost)` и `if (data.quantity === 0) throw ZERO_QUANTITY`,
  `requireFiniteNumbers({...})` до первой записи (orders.ts:1962–2000);
- неизвестный товар отклоняется так же, как услуга: `CATALOG_PRODUCT_NOT_FOUND`
  (orders.ts:2002);
- `localStorage` внутри серверной функции больше нет — единственное упоминание
  в orders.ts:342 это комментарий «код, который бэкенд запустить не сможет»,
  имя пишется из `CATALOGUE_LANGUAGE`;
- дефициты убираются вместе со строкой и заказом (orders.ts:992, 1955, 2222);
- `resetPrice` едет с числом: `LineEditEnvelope.defaultDiscountPercent`
  (`src/types/order.ts:533–549`), и `deltaToOps` применяет операции в
  документированном порядке.

### Один пункт фронтенда из §5 действительно не сделан

Роль без `seeCost` теряет колонки себестоимости и наценки и записи истории с
`sensitive: 'cost'` (`OrderCardPage.vue:289`, `:309`), но карточка по-прежнему
считает цены локально и не отключает правки, выводимые из себестоимости:

```
$ sed -n 350,353p src/views/admin/orders/OrderCardPage.vue
function canEdit(line: OrderLine, field: CellField | 'resetPrice' | 'resetCost'): boolean {
  if ((field === 'unitCost' || field === 'resetCost') && !canSetManualCost.value) return false
  return canEditLineField(toPricingLine(line), field)
}
```

`resetPrice` доступен независимо от `canSeeCost`, суммы считает `calcLine`
локально. Это ровно тот отложенный режим, который план и называет несделанным;
он и не нужен, пока сервер отдаёт себестоимость всем — но требование контракта
не закрыто.

## Что осталось

- **весь бэкенд**: модуль `orders`, модели и миграции таблиц заказов, ~34
  эндпоинта, версионирование `If-Match`, идемпотентность, FIFO-раскладка и
  снятие удержания теми же партиями, планирование до записи, каталог ошибок §6,
  `/api/sales-crm/stats`, серверное `GET /api/settings/order-permissions`,
  вырезание себестоимости под `seeCost`, порт `orderPricing.ts` на язык бэкенда;
- **фронтенд**: режим §5.2 — не пересчитывать цены локально и отключить правки от
  себестоимости для роли без `seeCost` (нужен в тот день, когда сервер начнёт
  вырезать себестоимость).

## Пункты плана

Чекбоксов в плане нет — вердикт даётся целиком по документу.
