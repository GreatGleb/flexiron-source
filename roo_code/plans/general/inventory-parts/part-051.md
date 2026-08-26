# Инвентаризация: roo_code/plans/warehouse (пачка 051)

Три плана про обрезки: автотесты новых страниц, страница создания обрезка,
движения по обрезкам. Код проверялся 2026-08-26, ничего не менялось.

---

## 1. roo_code/plans/warehouse/new-tasks-autotests-plan.md — ЧАСТИЧНО

Незакрытых чекбоксов: 0 (`grep -c '^[[:space:]]*- \[ \]'` → 0).

### Что есть

Все пять шагов плана заведены, каркас на месте.

```
$ grep -n "^export " frontend_vue/tests/e2e/mocks/warehouse.ts
76:export async function mockProductList(
99:export async function mockProductDetail(page: Page, productId: string, status?: number)
121:export async function mockSupplierList(page: Page, data = MOCK_SUPPLIERS_LIST, status?: number)
...
$ grep -n "test.describe" frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts
325:  test.describe('Movements tab — no create button', () => {
341:  test.describe('Batch create page', () => {
419:  test.describe('Offcut create page', () => {
```

- Шаг 1 (моки products/suppliers) — сделан целиком: три хелпера в `tests/e2e/mocks/warehouse.ts`.
- Шаг 2 (Batch create page) — 6 тестов: загрузка панелей, выбор товара радиокнопкой,
  сабмит пустой формы, сохранение с редиректом, отмена, наличие поиска.
- Шаг 3 (Offcut create page) — 3 теста: загрузка со секцией файлов
  (`offcut-create-files-section`, `-file-dropzone`, `-file-list`), появление панели партий
  после выбора товара, отмена.
- Шаг 4 (нет кнопки создания движения) — сделан: `expect(getByTestId('warehouse-new-movement-btn')).toHaveCount(0)`.
- Утверждение плана про Task 1 («движение создаётся только через WarehousePage, модалка DEPRECATED»)
  верно наполовину: `CreateMovementModal.vue` жив и импортируется карточкой партии
  (`WarehouseBatchCard.vue:18`, рендер 1532, кнопка `batch-card-add-movement-btn`).
  Сам компонент это и признаёт в шапке: «ЖИВОЙ КОМПОНЕНТ». Требуемая планом проверка
  касалась только тулбара движений — она сделана.

### Чего нет

- Шаг 2, п.2 полностью: поиск товара не набирается, фильтр категории не выбирается,
  «supplier dropdown becomes enabled» не проверяется. Последний тест блока вместо
  фильтрации только смотрит, что input с placeholder «Search» виден.
- Шаг 2, п.3 «Verify all form fields»: перечислены batch number, lot code, quantity,
  unit (readonly), unit price, currency, received date, expiry date, certificate, notes —
  проверяется только видимость панелей `batch-create-left/center/right-panel`
  и `batch-create-location-section`, ни одного поля по отдельности.
- Шаг 2, п.4: тест «validation errors» никаких ошибок не ассертит —
  после клика по save проверяет `expect(getByTestId('batch-create-page')).toBeVisible()`.
  Это тест, который не может упасть по своей теме.
- Шаг 3, п.2 наполовину: партия не выбирается (только факт появления панели).
- Шаг 3, п.3 целиком: размеры (length/width/thickness/weight), quantity, unit readonly,
  notes, поля локации — не проверяются, хотя data-test на странице есть.
- Шаг 5 (прогон `npx playwright test .../warehouse.spec.ts`) в рамках инвентаризации не запускался.

### filesMentioned
frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue,
frontend_vue/src/views/admin/warehouse/WarehousePage.vue,
frontend_vue/src/composables/useWarehouse.ts,
frontend_vue/src/views/admin/warehouse/WarehouseOffcutCreatePage.vue,
frontend_vue/src/components/admin/FileItem.vue,
frontend_vue/src/components/admin/ui/DropZone.vue,
frontend_vue/src/views/admin/warehouse/WarehouseBatchCreatePage.vue,
frontend_vue/src/composables/useWarehouseBatchCreate.ts,
frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue,
frontend_vue/tests/e2e/admin/warehouse/warehouse.spec.ts,
frontend_vue/tests/e2e/mocks/warehouse.ts

---

## 2. roo_code/plans/warehouse/offcut-create-page-plan.md — СДЕЛАНО

Незакрытых чекбоксов: 0.

### Доказательство

```
$ ls frontend_vue/src/composables/useWarehouseOffcutCreate.ts \
     frontend_vue/src/views/admin/warehouse/WarehouseOffcutCreatePage.vue
оба существуют
$ ls frontend_vue/src/views/admin/warehouse/CreateOffcutModal.vue
ls: cannot access ...: No such file or directory
$ grep -rn "CreateOffcutModal\|showCreateOffcutModal" frontend_vue/src/
(пусто)

$ grep -rn "warehouseOffcutCreate" frontend_vue/src/
src/router/index.ts:270:  meta: { layout: 'admin', featureFlag: 'warehouseOffcutCreate' as FeatureFlagKey }
src/types/features.ts:51:  warehouseOffcutCreate: boolean
src/config/featureFlags.ts:72:  warehouseOffcutCreate: true,

$ grep -n "offcut" frontend_vue/src/router/index.ts
267: path: 'warehouse/offcuts/new'
268: name: 'admin-warehouse-offcut-create'
273: path: 'warehouse/offcuts/:id'      ← create стоит ПЕРЕД :id, как требует план
274: name: 'admin-warehouse-offcut'

$ grep -n "offcut-create\|new-offcut" frontend_vue/src/views/admin/warehouse/WarehousePage.vue
858: data-test="warehouse-new-offcut-btn"
859: @click="router.push({ name: 'admin-warehouse-offcut-create' })"
```

Все 19 i18n-ключей из таблицы плана есть в трёх языках (по 3 вхождения каждый):
offcut_create_title, _save, _cancel, _select_product, _select_batch, _no_batches,
_no_batches_hint, _search_product, _search_batch, _all_categories,
field_length/width/thickness/weight/quantity/location/notes_placeholder,
toast_offcut_created, toast_offcut_create_error.

Состояние композабла соответствует плану: `productSearch`, `productCategoryFilter`,
`selectedProductId`, `selectedBatchId`, `noBatchesMessage`, `loadProducts()`,
`loadBatches(productId)`. Страница отдаёт data-test на все секции плана, включая
трёхколоночную раскладку (`offcut-create-left/center/right-panel`), локацию и файлы.

### Чего нет
Ничего из требований плана. Реализация ушла дальше плана: добавлены секция файлов и
предвыбор товара/партии из query (`preselectedBatchId`, `preselectedProductId`) —
планом не описано, но и не противоречит ему.

### filesMentioned
frontend_vue/src/composables/useWarehouseOffcutCreate.ts,
frontend_vue/src/views/admin/warehouse/WarehouseOffcutCreatePage.vue,
frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue,
frontend_vue/src/views/admin/warehouse/CreateOffcutModal.vue,
frontend_vue/src/views/admin/warehouse/WarehousePage.vue,
frontend_vue/src/views/admin/warehouse/SupplierCardPage.vue,
frontend_vue/src/views/admin/warehouse/SupplierCreatePage.vue,
frontend_vue/src/types/features.ts,
frontend_vue/src/config/featureFlags.ts,
frontend_vue/src/router/index.ts,
frontend_vue/src/i18n/admin/warehouse.ts,
frontend_vue/src/services/productsService.ts,
frontend_vue/src/services/warehouseService.ts

(Пути SupplierCardPage.vue / SupplierCreatePage.vue в плане даны без каталога —
это ссылки-аналогии, реальные файлы лежат в `src/views/admin/suppliers/`.)

---

## 3. roo_code/plans/warehouse/offcut-movements-plan.md — ЧАСТИЧНО

Незакрытых чекбоксов: 16 (`grep -c '^[[:space:]]*- \[ \]'` → 16).

### Главное расхождение с планом

Модель статусов обрезка переписана целиком. Планом заявлено
`OffcutStatus = 'available' | 'reserved' | 'used' | 'scrap'`, в коде:

```
$ sed -n '34,42p' frontend_vue/src/types/warehouse.ts
export type OffcutStatus =
  | 'available' | 'reserved' | 'in_production' | 'sold'
  | 'scrapped' | 'expensed' | 'returned_to_supplier' | 'in_storage'
```

Статусов `used` и `scrap` больше нет — их роль играют `expensed` / `in_production`
и `scrapped`. `MovementType` тоже расширен до 11 значений, у движения появился
`offcutId` (`types/warehouse.ts:308,343,360,573,593`) — плановое «no offcutId field»
устарело.

Второе расхождение: движения создаёт НЕ мок, а композабл. `mockPatchOffcut` теперь
пустой, без единого движения:

```
$ sed -n '881,889p' frontend_vue/src/services/mocks/warehouse.ts
export async function mockPatchOffcut(id, data) {
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  Object.assign(offcut, data, { updatedAt: new Date().toISOString() })
  return { ...offcut }
}
```

Вся логика в `useWarehouseOffcutCard.save()` (строки 287–330) плюс таблица
соответствия в том же файле, строки 30–39:

```
const OFFCUT_STATUS_TO_MOVEMENT_TYPE: Record<OffcutStatus, MovementType> = {
  available: 'return', reserved: 'transfer', in_production: 'production',
  sold: 'sale', scrapped: 'write-off', expensed: 'expense',
  returned_to_supplier: 'return-to-supplier', in_storage: 'storage',
}
```

То есть цель плана (движение на каждую смену статуса) достигнута шире, чем он просил,
но ни одна из правок не лежит там, куда план её адресовал.

### Найденная дыра, планом не покрытая

Ключи примечания есть только для старого набора статусов:

```
$ for k in in_production expensed returned_to_supplier in_storage used available reserved scrapped sold; \
    do echo "movement_offcut_$k: $(grep -c movement_offcut_$k src/i18n/admin/warehouse.ts)"; done
movement_offcut_in_production: 0
movement_offcut_expensed: 0
movement_offcut_returned_to_supplier: 0
movement_offcut_in_storage: 0
movement_offcut_used: 3          ← ключ-сирота, статуса used больше нет
movement_offcut_available: 3
movement_offcut_reserved: 3
movement_offcut_scrapped: 3
movement_offcut_sold: 3
```

Композабл зовёт `t('warehouse.movement_offcut_' + delta.status)` — для четырёх статусов
из восьми в примечание движения уйдёт сырой ключ.

### Пункты

- **1.1** Эндпоинт резки в `services/mocks/index.ts` — СДЕЛАНО.
  `grep -n cutting src/services/mocks/index.ts` → `1095: if (path === '/api/warehouse/cutting')`.
- **1.2** UI для запуска резки — СДЕЛАНО (план утверждал, что его нет).
  Есть страница `src/views/admin/warehouse/WarehouseCuttingPage.vue`, композабл
  `useWarehouseCutting.ts`, маршрут `warehouse/cutting` → `admin-warehouse-cutting`
  (`router/index.ts:291-292`) и ссылка с карточки партии
  (`WarehouseBatchCard.vue:1355,1357`, data-test `batch-card-cutting-link`).
  Плюс e2e `tests/e2e/admin/warehouse/cutting.spec.ts`.
- **1.3** Расходное движение резки с `referenceType: 'cutting'` — ЧАСТИЧНО.
  `mockExecuteCutting` (`mocks/warehouse.ts:1266-1319`) пишет `referenceType: 'cutting'`
  на правильный `batch.id`, но тип движения `write-off`, а не `expense`, и только на
  пропил+отход. Списание материала под сами обрезки ушло в `mockCreateOffcut`
  (строки 869-876) движением типа `offcut` с `offcutId`. Схема проводок другая, чем в плане.
- **2.1** Transfer с корректными from/toLocation — СДЕЛАНО, но в композабле
  (`useWarehouseOffcutCard.ts:296-309`), не в моке: `fromLocation: oldLocation`,
  `toLocation: newLocation`, примечание `movement_auto_location_change`.
- **2.2** Движение ссылается на партию обрезка — СДЕЛАНО: `batchId: updated.batchId`,
  и вдобавок `offcutId: updated.id`.
- **2.3** Краевые случаи null→value и value→null — СДЕЛАНО. `composeLocation`
  (строки 75-84) возвращает `null` при пустых полях, условие `oldLocation !== newLocation`
  срабатывает в обе стороны.
- **3.1** Расход при статусе `used` в `mockPatchOffcut` — ЧАСТИЧНО. Статуса `used` нет;
  ближайший `expensed` даёт движение `expense`, но из композабла, а не из мока.
- **3.2** i18n для примечания — ЧАСТИЧНО. `movement_offcut_used` есть в трёх языках,
  но соответствующего статуса нет; для реального `expensed` ключа нет вообще.
- **4.1** Списание при `scrap` в `mockPatchOffcut` — ЧАСТИЧНО. `scrapped` → `write-off`
  через таблицу в композабле; мок не тронут.
- **4.2** i18n для списания — СДЕЛАНО: `movement_offcut_scrapped` в ru/en/lt (3 вхождения).
- **5.1** `'sold'` в `OffcutStatus` — СДЕЛАНО (`types/warehouse.ts:38`).
- **5.2** `'sold'` в `OFFCUT_STATUSES` — СДЕЛАНО (`WarehouseOffcutCard.vue:26`, массив из 8).
- **5.3** `'sold'` в `OFFCUT_STATUS_PILL` — СДЕЛАНО: `sold: 'pill-mint'`
  (`WarehouseOffcutCard.vue:88`), класс определён в
  `src/styles/admin/components/_status-pills.css:39`.
- **5.4** Расход при `sold` — ЧАСТИЧНО. Движение создаётся, но типа `sale`
  (не `expense` с `referenceType: 'sale'`) и из композабла.
- **5.5** `offcut_status_sold` и `offcut_status_hint_sold` — СДЕЛАНО, оба по 3 вхождения
  (`i18n/admin/warehouse.ts:210,219` и парные en/lt).
- **6.1** Хелпер `createOffcutMovement()` в моке — ЧАСТИЧНО. В моке такого хелпера нет
  (`grep -n createOffcutMovement` → пусто), дублирование снято иначе: одной таблицей
  `OFFCUT_STATUS_TO_MOVEMENT_TYPE` и одним вызовом `createMovement` в композабле.

### Отдельно: краевой случай 4 плана нарушен осознанно
План писал «откат статуса движения не создаёт (нельзя «раз-использовать» обрезок)».
Код создаёт: `available: 'return'` в таблице, условие только `delta.status !== oldStatus`.
Возврат в наличие теперь проводка `return`.

### filesMentioned
frontend_vue/src/types/warehouse.ts,
frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue,
frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue,
frontend_vue/src/services/mocks/warehouse.ts,
frontend_vue/src/services/mocks/index.ts,
frontend_vue/src/services/warehouseService.ts,
frontend_vue/src/composables/useWarehouseOffcutCard.ts,
frontend_vue/src/i18n/admin/warehouse.ts
