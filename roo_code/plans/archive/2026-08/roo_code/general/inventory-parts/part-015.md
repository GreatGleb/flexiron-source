# Инвентаризация: roo_code/plans/archive/2026-08/review-followups.md

**Вердикт: частично**

Чекбоксов в плане нет (`grep -c "^[[:space:]]*- \[ \]"` → 0). Единицы работы — нумерованные
разделы 1 … 13. Из 22 разделов **8 сделаны** (шесть из них план сам помечает ✅, ещё один —
п. 4 — сделан, но пометки не имеет), **2 частично**, **12 не начаты**.

## Доказательства

### Сделано

```
$ ls frontend_vue/src/views/admin/settings/LogsSettings.vue \
     frontend_vue/src/composables/useAuditFeed.ts \
     frontend_vue/src/services/mocks/auditFeed.ts
src/composables/useAuditFeed.ts
src/services/mocks/auditFeed.ts
src/views/admin/settings/LogsSettings.vue

$ grep -n "logs\|VALID_TABS" src/views/admin/settings/SettingsLayout.vue
90:    key: 'logs',
91:    path: '/admin/settings/logs',
105:const VALID_TABS: readonly string[] = SETTINGS_TABS.map((tab) => tab.key)   # выведен, не второй список
$ grep -n "settingsAuditLog\|warehouseMap\|warehouseCutting" src/config/featureFlags.ts
27:  settingsAuditLog: true
45:  warehouseMap: true
47:  warehouseCutting: true
```
→ п. 1 (Логи) сделан. Тесты на месте: `src/services/mocks/auditFeed.spec.ts`,
`tests/e2e/admin/settings/audit-log.spec.ts`.

```
$ grep -rn "waitForLoadState" tests/ | wc -l   → 3   (все три — комментарии)
$ grep -rn "networkidle" tests/ | wc -l        → 15  (все — комментарии)
```
→ п. 1c сделан: ни одного вызова `waitForLoadState('networkidle')` в тестах.
Хелперы `openAdminPage` / `openAdminCard` — `tests/e2e/helpers/admin.ts`.

```
$ ls src/views/admin/warehouse/WarehouseMapPage.vue src/composables/useWarehouseMap.ts   → оба есть
$ find tests -name warehouse-map.spec.ts   → tests/e2e/admin/warehouse/warehouse-map.spec.ts
```
→ п. 3 (карта склада) сделан.

```
$ sed -n '19,50p' src/types/service.ts
export interface Service { … currencyId: string; uomId: string … }   # ServicePriceUnit больше нет
$ grep -rn "currencyId\|uomId" src/services/mocks/services.ts | head -3
32: currencyId: svc.currencyId
33: uomId: svc.uomId
86: function assertKnownPricing(currencyId, uomId)
$ grep -n "uom-h" src/services/mocks/settings.ts   → 121:  id: 'uom-h'
$ grep -n "unit_h" src/i18n/admin/orders.ts        → 146 / 625 / 1103  (ru/en/lt)
$ grep -rn "priceUnit" src/views/admin/products/ServicesPage.vue   → ноль (подпись собирает serviceUnitLabel)
```
→ **п. 4 (услуги: валюта и единица из справочника) сделан целиком, хотя ✅ в плане не стоит.**
Подпись выводится в `src/domain/servicePricing.ts` (`serviceUnitLabel`), поля-подписи в типе нет,
карточка услуги правит `currencyId` / `uomId`, `uom-h` в справочнике и `unit_h` в трёх языках есть.

```
$ grep -n "batch.location\|offcut.location" src/services/mocks/warehouse.ts
1098:  offcut.location = destination
1106:  batch.location = destination
$ ls src/services/mocks/warehouse-transfer-location.spec.ts   → есть
```
→ п. 6 сделан.

```
$ grep -n "offcutAreaM2\|weightPerWarehouseUnitKg" src/domain/cutting.ts
167: export function offcutAreaM2(...): number | null
307: const perUnit = product?.weightPerWarehouseUnitKg
$ find tests -name cutting.spec.ts → tests/e2e/admin/warehouse/cutting.spec.ts
```
→ п. 5 (5.1, 5.2, 5.3a, 5.3b) сделан.

```
$ grep -rn "}} мм\|}} кг" src/views/admin/**/*.vue → ноль
```
→ п. 4h сделан.

### Частично

**п. 1b — проверки отсутствия рядом с полной навигацией.** Сплошного прохода не было:
починены только те места, что всплыли в 1c.
```
$ grep -rn "питфолл #66" frontend_vue/tests | head
suppliers-list.spec.ts:601, :619, products.spec.ts:670
```
Три следа в двух файлах против заявленных в плане 102 утверждений в 20 файлах. Проверки
инверсией по остальным местам нет.

**п. 4f — `CreateMovementModal.vue`.** Шапка исправлена (план это и говорит):
```
$ head -8 src/views/admin/warehouse/CreateMovementModal.vue
ЖИВОЙ КОМПОНЕНТ. Создание движения убрано со СТРАНИЦЫ склада … осталось на КАРТОЧКЕ ПАРТИИ
```
Четыре копии условия на месте, `REFERENCE_REQUIRED_TYPES` не существует:
```
$ grep -rn "REFERENCE_REQUIRED_TYPES" src/ → ноль
$ grep -n "type.value === 'expense' || type.value === 'write-off'" src/views/admin/warehouse/CreateMovementModal.vue
268, 293, 328, 341
```

### Не начато

```
п. 2  (триггеры уведомлений)
$ grep -c "id:" src/services/mocks/notifications.ts → 21 статичных записи
$ grep -rn "notifications" src/services/mocks/{orders,warehouse,finance}.ts → ноль
$ find backend/app/modules/notifications -type f → только models/dependencies/interface, features/ пуст

п. 2b (ветка no-mock-module)
$ grep -c "test(" tests/e2e/ready-exits.spec.ts → 3, ни один не про no-mock-module
$ grep -n "no-mock-module" tests/e2e/ready-exits.spec.ts → ноль
(ветка живёт в tests/e2e/helpers/ready.ts:42,134 и недостижима под моками)

п. 4b (code.en в ХРАНИМЫЕ данные)
$ sed -n '207p' src/views/admin/products/ProductCardPage.vue
  ...settings.uoms.find(...)?.code.en ...   → по-прежнему пишется в LinkedSupplier.priceUnit

п. 4c (две системы подписи единиц)
$ grep -rn "orders.unit_" src/ | wc -l → 11 мест; ключей 5 (unit_kg/m/pcs/m2/h) на 8 единиц.
Решение не принято — комментарий в AddOrderServicesModal.vue:93 прямо отсылает к п. 4c.

п. 4d (batch.unit строкой)
$ grep -n "StockUnit" src/types/warehouse.ts
52: export type StockUnit = string   (+ 9 полей этого типа)
$ grep -n "LINEAR_BATCH_UNITS\|STOCK_UNIT_BY_UOM_ID" src/domain/cutting.ts → оба живы

п. 4e (productName копией)
$ grep -c "productName" src/mocks/warehouse-batches.ts src/mocks/warehouse-offcuts.ts → 100 и 13
$ grep -n "productName" src/types/warehouse.ts → 10 полей, хранимых

п. 4g (три словаря имён формул)
$ grep -n "ConversionFormulaType" src/types/settings.ts → 46: три имени, как было
$ sed -n '69,72p' src/types/product.ts → purchaseToWarehouseFormulaType: string | null (не союз)
$ grep -rn "conversion_formula" src/ → только src/i18n/admin/products.ts (мёртвые ключи на месте)

п. 7  (обрезки в заказе)
$ grep -rn "offcut" src/views/admin/orders/AddOrderItemsModal.vue → ноль
$ grep -n "offcutId: null" src/services/mocks/warehouse.ts → 1548 (FIFO по-прежнему только партии)

п. 8 / п. 9 (страна клиента, условия оплаты)
$ grep -rn "country\|paymentTerms" src/types/client.ts → ноль (есть только address:18)

п. 10 (сводка счетов клиента)
$ grep -rn "invoice" src/views/admin/clients/ClientCardPage.vue → ноль

п. 11 (подпись и тема BCC)
$ grep -rn "InBox LT" src/ | wc -l → 9   (BccRequestPage.vue:509-511, useBccRequest.ts:16-18,21-23)

п. 12 (почтовый сервер в настройках)
$ grep -rni "smtp\|mailServer" src/types/ src/views/admin/settings/ backend/app → ноль

п. 13 (финансы ↔ оплаты заказа)
$ grep -n "Math.random\|pick(\|orderId" src/services/mocks/finance.ts
78: status: pick(['pending','completed','overdue'])
79: amount: rnd(500, 15000)
84: orderId: ORDERS[idx]!.id
87: description: `Payment for order ${…}`
89: paidAt: Math.random() > 0.5 ? … : null
→ случайные суммы под настоящими номерами заказов, как и описано в плане
```

## Что осталось сделать

- п. 1b — сплошной проход по e2e с проверкой инверсией
- п. 2, 2b, 4b, 4c, 4d, 4e, 4g, 7, 8, 9, 10, 11, 12, 13 — целиком
- п. 4f — свести четыре копии условия в `REFERENCE_REQUIRED_TYPES`

## Пункты плана с вердиктами

| Раздел | Вердикт |
|---|---|
| 1. Настройки → «Логи» | сделано |
| 1c. E2E: networkidle | сделано |
| 1b. E2E: проверки отсутствия | частично |
| 2. Бэкенд: триггеры уведомлений | не начато |
| 2b. Ветка no-mock-module | не начато |
| 3. Карта склада | сделано |
| 4. Услуги: валюта и единица | сделано (пометки в плане нет) |
| 4b. code.en в хранимые данные | не начато |
| 4c. Две системы подписи единиц | не начато |
| 4d. batch.unit строкой | не начато |
| 4e. productName копией | не начато |
| 4f. CreateMovementModal | частично (шапка да, REFERENCE_REQUIRED_TYPES нет) |
| 4h. Две русские строки | сделано |
| 4g. Имена формул: три словаря | не начато |
| 5. Резка металла (5.1–5.3b) | сделано |
| 6. Перемещение и место хранения | сделано |
| 7. Обрезки в заказе | не начато |
| 8. Клиент: страна | не начато |
| 9. Клиент: условия оплаты | не начато |
| 10. Клиент: сводка счетов | не начато |
| 11. BCC: подпись и тема | не начато |
| 12. Почтовый сервер | не начато |
| 13. Финансы ↔ оплаты заказа | не начато |
