# Инвентаризация планов — часть 053

Каталог: `roo_code/plans/warehouse` (6 планов). Код не менялся.

Общая проверка типов (доказательство для всех планов пачки):

```
$ cd frontend_vue && npx vue-tsc --noEmit; echo exit=$?
exit=0
```

Ключевой факт для всей пачки: архитектура ушла от модалок к отдельным страницам
(`WarehouseBatchCreatePage.vue`, `WarehouseOffcutCreatePage.vue`, `WarehouseCuttingPage.vue`)
и к карточкам-страницам (`WarehouseOffcutCard.vue`, `WarehouseDeficitCard.vue`,
`WarehouseMovementCard.vue`), а создание движения из списка убрано осознанно
(в коде помечено `DEPRECATED: ... movement creation removed from UI`). Планы фаз 4–5
описывают модально-композабловую схему, которой в коде нет.

---

## 1. `roo_code/plans/warehouse/phase4-subtask4-useWarehouseMovement.md` — частично

Требуется файл `frontend_vue/src/composables/useWarehouseMovement.ts` с `create()`/`remove()`.

```
$ ls frontend_vue/src/composables/ | grep -i warehouse
useWarehouseBatchCreate.ts
useWarehouseBatch.ts
useWarehouseCutting.ts
useWarehouseDeficitCard.ts
useWarehouseMap.ts
useWarehouseMovementCard.ts
useWarehouseOffcutCard.ts
useWarehouseOffcutCreate.ts
useWarehouseStockCard.ts
useWarehouse.ts

$ grep -rn "useWarehouseMovement\b" frontend_vue/src frontend_vue/tests
(пусто)

$ grep -rn "createMovement" frontend_vue/src | head
src/views/admin/warehouse/CreateMovementModal.vue:17: import { createMovement } from '@/services/warehouseService'
src/views/admin/warehouse/CreateMovementModal.vue:525: await createMovement(payload)
src/composables/useWarehouseOffcutCard.ts:298,315: createMovement({...})
src/composables/useWarehouseBatch.ts:262,406: await createMovement({...})
src/services/warehouseService.ts:182: export async function createMovement(...)

$ grep -rn "toast_movement_created" frontend_vue/src/views frontend_vue/src/composables
src/views/admin/warehouse/CreateMovementModal.vue:526: toast.success(t('warehouse.toast_movement_created'))
src/composables/useWarehouseBatch.ts:414: toast.success(t('warehouse.toast_movement_created'))

$ grep -rn "deleteMovement" frontend_vue/src | head
src/services/warehouseService.ts:350: deleteMovementAuditEntry(...)   # только запись аудита
(функции deleteMovement(id) в сервисе НЕТ)
```

Есть: создание движения с тостом `toast_movement_created` — но внутри
`CreateMovementModal.vue` и `useWarehouseBatch.ts`, не в композабле.
Нет: самого файла `useWarehouseMovement.ts`; нет `remove()` — и не на что опереться:
`deleteMovement(id)` в `warehouseService.ts` отсутствует, план ссылается на строку 149,
которой соответствует другая функция. То есть план в части удаления опирается на
несуществующий сервис.

Пункты:
- [ ] Composable created at `useWarehouseMovement.ts` — **не начато** (файла нет, grep пуст)
- [ ] Provides `create()` and `remove()` — **не начато** (`create` есть, но в модалке/`useWarehouseBatch`; `remove` нет нигде, сервисной `deleteMovement` нет)
- [ ] Uses `useToast` — **частично** (тост создания есть в `CreateMovementModal.vue:526`, но не в композабле)
- [ ] Properly typed — **непонятно** (нечего типизировать: файла нет; общий `vue-tsc` чист)
- [ ] Loading states exposed — **не начато** (в `CreateMovementModal.vue` состояние локальное, наружу не выдаётся)

---

## 2. `roo_code/plans/warehouse/phase5-subtask1-useWarehouseOffcutsAndDeficit.md` — частично

```
$ ls frontend_vue/src/composables | grep -E "useWarehouseOffcuts\.ts|useWarehouseDeficit\.ts"
(пусто)

$ grep -rn "useWarehouseOffcuts|useWarehouseDeficit\b" frontend_vue/src frontend_vue/tests
(пусто)

$ grep -n "function \(delete\|update\)[A-Za-z]*\|toast_" frontend_vue/src/composables/useWarehouse.ts
316: async function deleteOffcut(id)      319: toast.success('warehouse.toast_offcut_deleted')
326: async function deleteDeficit(id)     329: toast.success('warehouse.toast_deficit_deleted')
350: async function updateOffcutStatus(...) 366: toast_offcut_saved
373: async function updateDeficitPriority(id, priority) 376: toast_deficit_saved
383: async function updateDeficitStatus(id, status)     386: toast_deficit_saved

$ grep -rn "createOffcut\b" frontend_vue/src
src/composables/useWarehouseOffcutCreate.ts:317: const offcut = await createOffcut(form)
src/composables/useWarehouseOffcutCreate.ts:318: toast.success(t('warehouse.toast_offcut_created'))

$ grep -rn "createDeficitItem" frontend_vue/src --include=*.ts --include=*.vue
src/services/warehouseService.ts:233: export async function createDeficitItem(...)
(вызывающих НЕТ — дефицит вручную не создаётся ниоткуда)
```

Есть: удаление обрезка и дефицита с тостами (`useWarehouse.ts:316,326`), обновление
дефицита (`patchDeficitItem` в `useWarehouse.ts:375,385` и `useWarehouseDeficitCard.ts:85`),
создание обрезка с тостом (`useWarehouseOffcutCreate.ts:317`).
Нет: двух заявленных файлов; нет вызова `createDeficitItem` — создание дефицита в UI
отсутствует полностью.

Пункты:
- [ ] `useWarehouseOffcuts.ts` с `create()`/`remove()` — **не начато** (файла нет; логика разнесена по `useWarehouseOffcutCreate.ts` и `useWarehouse.ts`)
- [ ] `useWarehouseDeficit.ts` с `create()`/`update()`/`remove()` — **не начато** (файла нет; `update`/`remove` есть в `useWarehouse.ts`, `create` не вызывается нигде)
- [ ] Both use `useToast` — **частично** (тосты есть, но в других модулях: `useWarehouse.ts:37`, `useWarehouseOffcutCreate.ts:318`)
- [ ] Both properly typed — **непонятно** (файлов нет; общий `vue-tsc --noEmit` = 0 ошибок)
- [ ] Loading states exposed — **частично** (флаги загрузки живут в `useWarehouse.ts`/`useWarehouseOffcutCreate.ts`, отдельных `creating/updating/deleting` из плана нет)

---

## 3. `roo_code/plans/warehouse/phase5-subtask2-improve-tabs.md` — частично

```
$ ls frontend_vue/src/views/admin/warehouse/
CreateMovementModal.vue  WarehouseBatchCard.vue  WarehouseBatchCreatePage.vue
WarehouseCuttingPage.vue WarehouseDeficitCard.vue WarehouseMapPage.vue
WarehouseMovementCard.vue WarehouseOffcutCard.vue WarehouseOffcutCreatePage.vue
WarehousePage.vue WarehouseStockCard.vue
(CreateBatchModal.vue и CreateOffcutModal.vue НЕ существуют)

$ grep -n "CreateMovementModal|showCreateOffcutModal" frontend_vue/src/views/admin/warehouse/WarehousePage.vue
30: // DEPRECATED: import CreateMovementModal ... (movement creation removed from UI)
104: // DEPRECATED: showCreateMovementModal (removed from UI)
(showCreateOffcutModal в странице не используется вовсе)

$ grep -n "showCreateOffcutModal|onOffcutCreated" frontend_vue/src/composables/useWarehouse.ts
44: const showCreateOffcutModal = ref(false)
48: function onOffcutCreated() { showCreateOffcutModal.value = false; loadOffcuts() }
648: showCreateOffcutModal,        # экспортируется, но в шаблоне не читается — мёртвое состояние

# i18n-ключи плана
btn_mark_used: 3   btn_mark_scrap: 3
deficit_priority_badge_critical/high/medium/low: 3/3/3/3   (три локали — есть)
offcut_type_sheet_badge: 0   offcut_type_linear_badge: 0   (нет; в коде другие ключи offcut_type_sheet/linear, warehouse.ts:233-234)

# CSS-классы плана (grep по src/styles)
offcut-type-badge: warehouse_list.css:1076,1085,1089  — ЕСТЬ
inline-action-btn: warehouse_list.css:469..518        — ЕСТЬ
tab-empty-state:  warehouse_list.css:109..143         — ЕСТЬ
deficit-priority-badge:   0 правил нигде в проекте    — НЕТ (класс навешан: WarehousePage.vue:3711-3712)
deficit-amount-critical:  0 правил                    — НЕТ (навешан: WarehousePage.vue:3700)
deficit-amount-high:      0 правил                    — НЕТ (навешан: WarehousePage.vue:3701)

# data-test: имена другие, чем в плане
план: offcuts-tab-cutting-btn / offcuts-tab-empty-state / deficit-tab-add-btn / deficit-tab-empty-state — 0 вхождений
код:  warehouse-offcuts-cut-btn (874), warehouse-offcuts-empty (2304), warehouse-offcuts-cut-btn-empty (2313),
      offcut-mark-used-btn (2787), offcut-mark-scrap-btn (2796),
      warehouse-deficit-empty (3358), deficit-mark-in-progress-btn (3737), deficit-mark-resolved-btn (3748)

$ grep -rn "updateDeficitPriority" frontend_vue/src
src/composables/useWarehouse.ts:373 (объявление), :669 (экспорт)  — вызывающих в шаблоне НЕТ
```

Есть: бейдж типа обрезка + CSS, размеры в строке (`offcut_dimensions`), быстрые действия
«использован/утиль» с CSS `inline-action-btn`, быстрые смены статуса дефицита
(in_progress/resolved), улучшенные пустые состояния с иконкой и CTA (`tab-empty-state`),
6 из 8 i18n-ключей во всех трёх локалях.
Нет: модалок CreateBatch/CreateOffcut (заменены страницами), интеграции CreateMovementModal
в страницу (снята осознанно), состояния модалки, которое реально используется
(`showCreateOffcutModal` мёртв), inline-смены приоритета (`updateDeficitPriority` без вызова),
кнопки «Добавить в дефицит», двух i18n-ключей `offcut_type_*_badge`, и трёх CSS-классов
дефицита — классы в разметке есть, правил нет ни одного (ровно тот же дефект, что в примере
из задания).

Пункты:
- [ ] Три модалки интегрированы в WarehousePage — **не начато** (двух файлов нет, третий помечен DEPRECATED)
- [ ] Modal open/close state в `useWarehouse.ts` — **частично** (`showCreateOffcutModal` есть, но нигде не читается)
- [ ] Обработчики перезагружают данные вкладки — **частично** (`onOffcutCreated()` есть в `useWarehouse.ts:48`, не подключён; создание идёт через отдельные страницы с редиректом)
- [ ] Offcuts: бейджи типа и размеры — **сделано** (`WarehousePage.vue:2735-2762`, CSS `warehouse_list.css:1076`)
- [ ] Offcuts: inline-действия used/scrap — **сделано** (`WarehousePage.vue:2787,2796`, CSS `:469-518`)
- [ ] Deficit: цветовое кодирование приоритета — **частично** (классы навешаны `WarehousePage.vue:3700-3712`, CSS-правил нет)
- [ ] Deficit: inline смена статуса/приоритета — **частично** (статус есть: `:3737,3748`; приоритет — нет, `updateDeficitPriority` не вызывается)
- [ ] Улучшенные пустые состояния — **сделано** (`:2304` с CTA, `:3358`; CSS `warehouse_list.css:109-143`)
- [ ] Новые i18n-ключи в 3 локалях — **частично** (6 из 8; `offcut_type_sheet_badge`/`offcut_type_linear_badge` отсутствуют)
- [ ] Новые CSS-классы — **частично** (3 из 6: нет `deficit-priority-badge`, `deficit-amount-critical`, `deficit-amount-high`)
- [ ] Все `data-test` добавлены — **частично** (атрибуты есть, но ни одно из 8 имён из плана не совпадает)
- [ ] Компилируется без ошибок TS — **сделано** (`npx vue-tsc --noEmit` → exit=0)

---

## 4. `roo_code/plans/warehouse/phase6-subtask1-e2e-mocks.md` — частично

```
$ ls -l frontend_vue/tests/e2e/mocks/warehouse.ts
-rw-rw-r-- 20105 warehouse.ts

$ grep -n "^export" frontend_vue/tests/e2e/mocks/warehouse.ts
76 mockProductList        99 mockProductDetail      121 mockSupplierList
199 mockStockList         225 mockBatchesList       251 mockBatchDetail
277 mockCreateBatch       298 mockUpdateBatch       319 mockDeleteBatch
340 mockOffcutsList       366 mockCreateOffcut      387 mockDeleteOffcut
408 mockMovementsList     434 mockCreateMovement    455 mockCutting
476 mockDeficitList       502 mockCreateDeficit     523 mockUpdateDeficit
544 mockDeleteDeficit     565 mockStockDetail       594 mockWarehouseEndpoints

$ grep -n "pageSize|totalPages|searchParams.get" frontend_vue/tests/e2e/mocks/warehouse.ts
140: ): { items: T[]; total: number; page: number; pageSize: number; totalPages: number }
141-147: page/pageSize из query, slice, totalPages

$ head -6 frontend_vue/tests/e2e/mocks/warehouse.ts
import { mockBatches } from '../../../src/mocks/warehouse-batches'   # и остальные четыре
```

Все 10 гранулярных функций из плана есть, плюс шесть сверх плана. Пагинация и
`status?: number` (симуляция ошибок) есть у каждого мока. Данные берутся из `src/mocks/`.
Не хватает одного из 17 эндпоинтов: `DELETE /api/warehouse/movements/:id` не мокается
(функции `mockDeleteMovement` нет) — впрочем, приложение его и не вызывает: в
`warehouseService.ts` нет `deleteMovement`.

Пункты:
- [ ] Файл `tests/e2e/mocks/warehouse.ts` создан — **сделано** (20105 байт)
- [ ] Все 17 эндпоинтов мокаются — **частично** (16 из 17; нет DELETE movements/:id)
- [ ] Пагинация у списков — **сделано** (хелпер на строках 140-147)
- [ ] Гранулярные функции — **сделано** (все 10 имён из плана присутствуют)
- [ ] Симуляция ошибок — **сделано** (параметр `status?: number` у всех моков)
- [ ] Использует данные из `src/mocks/` — **сделано** (импорты строк 2-6)
- [ ] Следует существующему паттерну e2e-моков — **сделано** (`page.route` + `route.fallback()` при несовпадении метода, как в остальных спеках)

---

## 5. `roo_code/plans/warehouse/phase6-subtask2-e2e-spec.md` — частично

```
$ ls -l frontend_vue/tests/e2e/admin/warehouse/
cutting.spec.ts  offcut-area.spec.ts  offcut-weight.spec.ts
warehouse-map.spec.ts  warehouse.spec.ts (24593 байт)

$ grep -n "test.describe|  test(" frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts
describe: Warehouse module / Page layout / Stock tab / Batches tab / Batch card /
Offcuts tab / Offcut card / Movements tab / Movement card / Deficit tab / Deficit card /
Stock card / "Movements tab — no create button" / Batch create page / Offcut create page
(~50 тестов)

$ grep -rn "FeatureFlag|featureFlag|adminWarehouse" frontend_vue/tests/e2e/admin/warehouse/*.spec.ts
(пусто — теста на фича-флаг нет, хотя helpers/flags.ts существует)

$ grep -rln "batch-card-delete|batch-card-edit" frontend_vue/tests/e2e/
(пусто — тестов на правку и удаление партии нет)

$ sed -n '1,9p' frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts
import { mockWarehouseEndpoints, mockProductList, mockProductDetail, mockSupplierList } from '../../mocks/warehouse'
```

Есть: все 5 вкладок, карточки (batch/offcut/movement/deficit/stock) включая состояния
ошибки, быстрые действия обрезков и дефицита, страницы создания партии и обрезка
(валидация, сохранение, отмена, фильтры), перехват маршрутов через мок из подзадачи 1.
Нет: теста на фича-флаг `adminWarehouse` (сценарий 10 плана), тестов правки и удаления
партии, теста создания движения — вместо него сознательно обратный тест
«should NOT have a new movement button in toolbar» (создание движения из списка убрано).
Прогон `npx playwright test` я не запускал — менять/пачкать дерево нельзя.

Пункты:
- [ ] Файл `tests/e2e/admin/warehouse/warehouse.spec.ts` создан — **сделано** (24593 байта, ~50 тестов)
- [ ] Покрыты все 5 вкладок — **сделано** (describe: Stock/Batches/Offcuts/Movements/Deficit)
- [ ] Покрыты просмотр, правка и удаление карточки партии — **частично** (только просмотр и ошибка; grep `batch-card-delete|batch-card-edit` по tests/ пуст)
- [ ] Покрыты модалки создания партии/движения/обрезка — **частично** (страницы создания партии и обрезка покрыты; движение — обратным тестом, модалок нет)
- [ ] Покрыт гард фича-флага — **не начато** (grep `adminWarehouse` по спекам пуст)
- [ ] Используются перехваты маршрутов — **сделано** (импорт `mockWarehouseEndpoints` из `../../mocks/warehouse`)
- [ ] Следует существующим паттернам — **сделано** (`../../fixtures`, `helpers/admin` — `navigateToAdmin`/`openAdminPage`)
- [ ] Все тесты проходят на `npx playwright test` — **непонятно** (прогон не запускался: инвентаризация без изменений дерева)

---

## 6. `roo_code/plans/warehouse/refactor-warehouse-mock-data.md` — частично (чекбоксов 0)

```
$ ls -l frontend_vue/src/mocks/ | grep warehouse
warehouse-batches.ts   113464
warehouse-deficit.ts    12274
warehouse-movements.ts  72800
warehouse-offcuts.ts    14126
warehouse-stock.ts      39829
warehouse.ts              301

$ cat frontend_vue/src/mocks/warehouse.ts
export { mockBatches } from './warehouse-batches'
export { mockOffcuts } from './warehouse-offcuts'
export { mockMovements, mockBatchAggregates, mockBatchActiveSales } from './warehouse-movements'
export { mockDeficit } from './warehouse-deficit'
export { mockStockOverview } from './warehouse-stock'

$ grep -n "^export const" frontend_vue/src/mocks/warehouse-*.ts
warehouse-batches.ts:1    export const mockBatches = [          # БЕЗ аннотации типа
warehouse-deficit.ts:421  export const mockDeficit: WarehouseDeficit[] = sealAuditIds(...)
warehouse-movements.ts:2503 export const mockMovements: WarehouseMovement[] = sealAuditIds(...)
warehouse-movements.ts:2509 export const mockBatchAggregates: Record<...>
warehouse-movements.ts:2528 export const mockBatchActiveSales: Record<...>
warehouse-offcuts.ts:406  export const mockOffcuts: WarehouseOffcut[] = sealAuditIds(...)
warehouse-stock.ts:1394   export const mockStockOverview: StockOverviewItem[] = sealAuditIds(...)

$ grep -n "import" frontend_vue/src/mocks/warehouse-batches.ts
(пусто — тип WarehouseBatch не импортируется)

$ cd frontend_vue && npx vue-tsc --noEmit; echo exit=$?
exit=0
```

Есть: разделение на 5 файлов ровно с теми именами, что в плане, барель-реэкспорт в
`warehouse.ts` (путь `@/mocks/warehouse` для `src/services/mocks/warehouse.ts` цел),
шаг 3 (нуль ошибок TS) выполняется. Данные с тех пор выросли — «Future Improvement»
плана про ~100 позиций стока фактически закрыт.
Не сделано: `mockBatches` экспортируется без аннотации типа `WarehouseBatch[]` —
единственный из пяти массивов, у которого тип не заявлен (требование шага 1);
`warehouse-movements.ts` экспортирует ещё два объекта помимо массива, то есть «один
массив на файл» не соблюдён.

Пунктов-чекбоксов в плане нет.
