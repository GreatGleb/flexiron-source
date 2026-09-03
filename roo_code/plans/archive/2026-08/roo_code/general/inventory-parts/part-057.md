# Инвентаризация: roo_code/plans/warehouse/warehouse-page-plan.md

- Путь: `roo_code/plans/warehouse/warehouse-page-plan.md`
- Вердикт: **частично** (реализовано с большим перевесом сверх плана, но три-четыре названных в плане пункта в коде отсутствуют)
- Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`)

## Доказательства

```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/warehouse/warehouse-page-plan.md
0

$ ls frontend_vue/src/types/warehouse.ts frontend_vue/src/services/warehouseService.ts \
     frontend_vue/src/services/mocks/warehouse.ts frontend_vue/src/i18n/admin/warehouse.ts \
     frontend_vue/src/styles/admin/warehouse*
src/i18n/admin/warehouse.ts
src/services/mocks/warehouse.ts
src/services/warehouseService.ts
src/styles/admin/warehouse_list.css      <-- НЕ warehouse.css, как в плане
src/styles/admin/warehouse_map.css
src/types/warehouse.ts

$ ls frontend_vue/src/composables | grep -i warehouse
useWarehouse.ts
useWarehouseBatch.ts
useWarehouseBatchCreate.ts
useWarehouseCutting.ts
useWarehouseDeficitCard.ts
useWarehouseMap.ts
useWarehouseMovementCard.ts
useWarehouseOffcutCard.ts
useWarehouseOffcutCreate.ts
useWarehouseStockCard.ts
# useWarehouseOffcuts.ts / useWarehouseDeficit.ts / useWarehouseMovement.ts —
# отдельными файлами НЕ существуют: списки обрезков/дефицита живут внутри useWarehouse.ts
$ grep -n "offcutFilters\|deficitFilters\|offcutsPagination\|deficitPagination" frontend_vue/src/composables/useWarehouse.ts
99:  const offcutFilters = reactive<WarehouseFilters>({
125:  const deficitFilters = reactive<WarehouseFilters>({
173:  const offcutsPagination = usePagination(25)
175:  const deficitPagination = usePagination(25)

$ ls frontend_vue/src/views/admin/warehouse
CreateMovementModal.vue
WarehouseBatchCard.vue
WarehouseBatchCreatePage.vue
WarehouseCuttingPage.vue
WarehouseDeficitCard.vue
WarehouseMapPage.vue
WarehouseMovementCard.vue
WarehouseOffcutCard.vue
WarehouseOffcutCreatePage.vue
WarehousePage.vue
WarehouseStockCard.vue
# CreateBatchModal.vue / CreateOffcutModal.vue отсутствуют — заменены отдельными
# страницами создания; CreateMovementModal.vue есть, но выведен из UI:
$ grep -n "DEPRECATED" frontend_vue/src/views/admin/warehouse/WarehousePage.vue
30:// DEPRECATED: import CreateMovementModal from './CreateMovementModal.vue' (movement creation removed from UI)
104:  // DEPRECATED: showCreateMovementModal (removed from UI)
# и e2e прямо утверждает обратное плану:
$ grep -n "no create button" frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts
325:  test.describe('Movements tab — no create button', () => {

$ grep -n "warehouse" frontend_vue/src/router/index.ts   (сокращённо)
255: warehouse/stock/:id        -> WarehouseStockCard.vue
261: warehouse/batches/:id      -> WarehouseBatchCard.vue
267: warehouse/offcuts/new      -> WarehouseOffcutCreatePage.vue  (flag warehouseOffcutCreate)
273: warehouse/offcuts/:id      -> WarehouseOffcutCard.vue
279: warehouse/batches/new      -> WarehouseBatchCreatePage.vue
285: warehouse/movements/:id    -> WarehouseMovementCard.vue
291: warehouse/cutting          -> WarehouseCuttingPage.vue       (flag warehouseCutting)
297: warehouse/map              -> WarehouseMapPage.vue           (flag warehouseMap)
303: warehouse/deficit/:id      -> WarehouseDeficitCard.vue
315: warehouse/:tab(stock|batches|offcuts|movements|deficit)? -> WarehousePage.vue
# Роутов /admin/warehouse/offsets и /admin/warehouse/movement (и страниц
# WarehouseBatchesPage.vue / WarehouseOffcutsPage.vue / WarehouseMovement.vue) нет —
# вкладки реализованы параметром :tab на одной странице.

$ grep -n "warehouse" frontend_vue/src/types/features.ts
4:  adminWarehouse: boolean
37:  warehouseOffcuts: boolean
38:  warehouseDeficit: boolean
39:  warehouseQrPrint: boolean
40:  warehouseMap: boolean
41:  warehouseCutting: boolean
44-48: warehouse{Stock,Batches,Offcuts,Movements,Deficit}PageConfig: boolean
51:  warehouseOffcutCreate: boolean
# Но три section-level флага плана нигде не читаются:
$ grep -rn "warehouseQrPrint\|warehouseOffcuts\b\|warehouseDeficit\b" frontend_vue/src \
    --include=*.vue --include=*.ts | grep -v "types/features\|config/featureFlags"
(пусто)

$ grep -n "warehouse" frontend_vue/src/i18n/admin/index.ts
10:import { adminWarehouse } from './warehouse'
# Файла src/i18n/admin.ts, указанного планом, не существует — переводы подключены
# через src/i18n/admin/index.ts. Ключи плоские (tab_stock), а не вложенные (tabs.stock):
$ sed -n '5,12p' frontend_vue/src/i18n/admin/warehouse.ts
      title: 'Склад'
      header_title: 'Управление складом'
      tab_stock / tab_batches / tab_offcuts / tab_movements / tab_deficit

$ grep -c "^  {" frontend_vue/src/mocks/warehouse-batches.ts   -> 100  (план: 15+)
$ grep -c "^  {" frontend_vue/src/mocks/warehouse-offcuts.ts   -> 13   (план: 10+)
$ grep -c "^  {" frontend_vue/src/mocks/warehouse-movements.ts -> 98   (план: 30+)
$ grep -c "^  {" frontend_vue/src/mocks/warehouse-deficit.ts   -> 20
$ grep -o "location: '[^']*'" frontend_vue/src/mocks/warehouse-batches.ts | sort -u | wc -l
74   (план: 5+ секторов)

$ grep -rn "warehouse/locations" frontend_vue/src
(пусто)  — эндпоинта GET /api/warehouse/locations из контракта плана нет
# Прочие эндпоинты есть, но сводка — /api/warehouse/stock, а не /api/warehouse:
$ grep -n "'/api/warehouse" frontend_vue/src/services/mocks/index.ts   (сокращённо)
606: /api/warehouse/stock      647: /api/warehouse/batches
692: /api/warehouse/offcuts    738: /api/warehouse/movements
762: /api/warehouse/deficit    797: /api/warehouse/export/(stock|batches|offcuts|movements|deficit)
1095: /api/warehouse/cutting   + карточки/audit/aggregates/active-sales/PATCH/DELETE

$ grep -rin "qrcode\|qr_code\|qrCode\|Lipduk" frontend_vue/src --include=*.ts --include=*.vue
(пусто)  — модалки QR/печати Lipdukas нет; в типе есть только поле `qrData`
$ grep -n "qrData" frontend_vue/src/types/warehouse.ts
233:  qrData: string | null

$ grep -rn "Заказы в минус\|Пополнение склада\|subTab" frontend_vue/src/views/admin/warehouse/WarehousePage.vue
(пусто)  — двух подвкладок дефицита нет, вкладка одна плоская

$ grep -n "useDirtyCheck" frontend_vue/src/composables/useWarehouseBatch.ts
17:import { useDirtyCheck } from './useDirtyCheck'
130:  const dirty = useDirtyCheck(form)

$ grep -c "test(" frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts
# 45+ тестов в warehouse.spec.ts (460 строк), плюс cutting.spec.ts, offcut-area.spec.ts,
# offcut-weight.spec.ts, warehouse-map.spec.ts в том же каталоге
```

## Что есть

Вся инфраструктура (типы, сервис, моки, i18n, флаги, CSS), главная страница с пятью
вкладками и серверными фильтрами/пагинацией/экспортом CSV, карточки партии, обрезка,
движения, дефицита, остатка, страницы создания партии и обрезка, страница резки, карта
склада, e2e-набор шире, чем 9 кейсов плана. Объём кода значительно превосходит план:
статусов партии 11 против 5, типов движений 11 против 5, добавлены audit-эндпоинты,
aggregates, active-sales, cost breakdown, per-tab page-config флаги.

## Чего нет

1. **QR / Lipdukai** — ни модалки «QR-код», ни кнопки печати, ни какого-либо использования
   `qrData`; флаг `warehouseQrPrint` объявлен и нигде не читается.
2. **Две подвкладки дефицита** («Заказы в минус» / «Пополнение склада» по 02.3_Deficit_Management.md)
   — вкладка «Дефицит» плоская.
3. **`GET /api/warehouse/locations`** — эндпоинта нет ни в сервисе, ни в моках.
4. **Флаги `warehouseOffcuts` / `warehouseDeficit`** объявлены, но вкладки ими не скрываются
   (флаги мертвы).
5. **Модалки прихода/расхода/отрезания** — заменены страницами; создание движения
   осознанно выведено из UI (`CreateMovementModal.vue` помечен DEPRECATED, e2e требует
   отсутствия кнопки). Расхождение с планом намеренное, но план на этот счёт устарел.
6. **Названия из плана, которых нет буквально:** `src/styles/admin/warehouse.css`,
   `src/i18n/admin.ts`, `useWarehouseOffcuts.ts`, `useWarehouseDeficit.ts`,
   `useWarehouseMovement.ts`, `CreateBatchModal.vue`, `CreateOffcutModal.vue`,
   `WarehouseBatchesPage.vue`, `WarehouseOffcutsPage.vue`, `WarehouseMovement.vue`,
   роуты `/admin/warehouse/offsets` и `/admin/warehouse/movement`; сигнатуры сервиса
   плана (`getWarehouseItems`, `patchWarehouseBatch`, `getWarehouseLocations`, …) носят
   другие имена (`getStockOverview`, `patchBatch`, …).

## Пункты «Порядок реализации» (23 шага, чекбоксов в плане нет)

| # | Шаг | Вердикт |
|---|---|---|
| 1 | `src/types/warehouse.ts` | сделано (шире плана; имена полей другие) |
| 2 | `src/services/warehouseService.ts` | частично — все эндпоинты кроме `locations`, имена функций другие |
| 3 | `src/services/mocks/warehouse.ts` | сделано |
| 4 | мок-роуты в `mocks/index.ts` | частично — нет `/api/warehouse/locations`, сводка на `/stock` |
| 5 | feature flags в `features.ts` | частично — объявлены, три не используются |
| 6 | `src/i18n/admin/warehouse.ts` | сделано (ключи плоские) |
| 7 | подключить переводы в `src/i18n/admin.ts` | частично — подключено через `i18n/admin/index.ts`, файла плана нет |
| 8 | `useWarehouse.ts` | сделано |
| 9 | `WarehousePage.vue` — вкладки, таблицы, фильтры | сделано |
| 10 | `src/styles/admin/warehouse.css` | частично — есть `warehouse_list.css` + `warehouse_map.css` |
| 11 | роуты в `router/index.ts` | частично — вместо `offsets`/`movement` параметр `:tab` и карточки |
| 12 | `useWarehouseBatch.ts` | сделано (с `useDirtyCheck`) |
| 13 | `WarehouseBatchCard.vue` | сделано (файлы, обрезки, движения, аудит, discard) |
| 14 | роут `/admin/warehouse/batches/:id` | сделано |
| 15 | `CreateBatchModal.vue` | частично — вместо модалки `WarehouseBatchCreatePage.vue` |
| 16 | `CreateMovementModal.vue` | частично — файл есть, из UI выведен намеренно |
| 17 | `CreateOffcutModal.vue` | частично — вместо модалки `WarehouseOffcutCreatePage.vue` + `WarehouseCuttingPage.vue` |
| 18 | `useWarehouseMovement.ts` | частично — есть `useWarehouseMovementCard.ts`, создания движения нет |
| 19 | `useWarehouseOffcuts.ts` | частично — логика внутри `useWarehouse.ts`, отдельного файла нет |
| 20 | `useWarehouseDeficit.ts` | частично — то же |
| 21 | вкладки «Обрезки» и «Дефицит» | частично — вкладки есть, двух подвкладок дефицита нет |
| 22 | `tests/e2e/admin/warehouse/warehouse.spec.ts` | сделано (шире 9 кейсов) |
| 23 | моки API в e2e | сделано |
| — | Модалка «QR-код» (раздел 3.3 п.4) | не начато |
