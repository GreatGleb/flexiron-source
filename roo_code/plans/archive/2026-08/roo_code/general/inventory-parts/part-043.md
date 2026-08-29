# Инвентаризация планов — часть 043 (roo_code/plans/warehouse, 5 планов)

Код НЕ менялся. Чекбоксов нет ни в одном плане пачки (`grep -c "^[[:space:]]*- \[ \]"` = 0 для всех пяти).

---

## 1. roo_code/plans/warehouse/add-offcut-movements.md — **частично**

### Что есть

```
$ grep -n "offcutId" src/types/warehouse.ts
308:  offcutId: string | null      # WarehouseMovement
343:  offcutId: string | null      # MovementListItem
360:  offcutId?: string | null     # MovementCreatePayload
573:  offcutId: string | null      # StockReservation, к плану не относится
593:  offcutId?: string            # WarehouseFilters
```
```
$ grep -n "offcutId" src/services/warehouseService.ts
174:  if (filters.offcutId) params.offcutId = filters.offcutId   # getMovements
$ grep -n "offcutId" src/services/mocks/warehouse.ts
872:    offcutId: id,                 # mockCreateOffcut -> mockCreateMovement
906:    offcutId: m.offcutId,         # toMovementListItem
929:    offcutId?: string             # mockGetMovements filter signature
956:  if (filters.offcutId) filtered = filtered.filter((m) => m.offcutId === filters.offcutId)
990:  offcutId?: string | null       # mockCreateMovement payload
1017:    offcutId: data.offcutId ?? null
1090:      if (data.offcutId != null) {   # перенос location на обрезок
```
- 2.3.1 transfer при смене location привязан к `offcutId` — `src/composables/useWarehouseOffcutCard.ts` (`createMovement({ type:'transfer', offcutId: updated.id, batchId: updated.batchId, … })`).
- 2.3.2 status-change movement в карточке — там же, `if (delta.status && delta.status !== oldStatus)`.
- 2.3.3 из списка — `useWarehouse.ts:350 updateOffcutStatus(id, status, offcut)` создаёт движение; `WarehousePage.vue:2788,2797` передают третьим аргументом сам `offcut`.
- 2.4 маппинг статус→тип есть дважды: `useWarehouseOffcutCard.ts:29 OFFCUT_STATUS_TO_MOVEMENT_TYPE` и `useWarehouse.ts:337` (копия, не общий модуль).
- 2.5 резка пишет движения: `mockExecuteCutting` (warehouse.ts:1266) → `mockCreateOffcut` → движение типа `offcut` + отдельный `write-off` на пропил/отход.
- 2.6 `loadMovements()` фильтрует по `offcutId`, не по `referenceId`.
- 2.7 ссылка на обрезок в `WarehouseMovementCard.vue:264-300` (`v-if="movement.offcutId"`, router-link, `data-test="field-offcut-link"`).
- 2.8 мок принимает и фильтрует `offcutId` (строки выше).
- i18n `col_offcut` есть во всех трёх локалях (warehouse.ts:41, 723, 1417).

### Чего нет
Ключей примечания хватает только на половину статусов — `notes: t('warehouse.movement_offcut_${status}')` для четырёх из восьми отдаёт сырой ключ:
```
$ for k in available reserved used in_production sold scrapped expensed returned_to_supplier in_storage; do echo "$k: $(grep -c "movement_offcut_$k:" src/i18n/admin/warehouse.ts)"; done
available: 3   reserved: 3   used: 3   in_production: 0   sold: 3
scrapped: 3    expensed: 0   returned_to_supplier: 0      in_storage: 0
```
Ключ `movement_offcut_used` есть, но статуса `used` в `OffcutStatus` нет — перевод повешен на несуществующий статус, а на реально нажимаемый в списке `in_production` (WarehousePage.vue:2788) перевода нет.
Также: опциональное поле `offcutNumber` в `WarehouseMovement` не добавлено (план помечал его как «опционально»); `unit` в `createMovement` из плановых снипетов не передаётся ни в одном из двух вызовов.

Файлы плана: frontend_vue/src/types/warehouse.ts, frontend_vue/src/services/warehouseService.ts, frontend_vue/src/services/mocks/warehouse.ts, frontend_vue/src/composables/useWarehouseOffcutCard.ts, frontend_vue/src/composables/useWarehouse.ts, frontend_vue/src/views/admin/warehouse/WarehousePage.vue, frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue, frontend_vue/src/i18n/admin/warehouse.ts, frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue

---

## 2. roo_code/plans/warehouse/add-offcuts-remaining-filters.md — **частично**

### Что есть
- `WarehouseFilters` (types/warehouse.ts:580-597): `productId?`, `categoryIds?: string[]`, `batchNumber?` — категория сделана МНОЖЕСТВЕННОЙ (`categoryIds`), а план просил одиночный `categoryId?: string`.
- `useWarehouse.ts:99-109 offcutFilters` содержит `productId: undefined, categoryIds: [], batchNumber: undefined`.
- `getOffcuts()` (warehouseService.ts:128-135) передаёт `productId`, `categoryIds`, `batchNumber`.
- `mockGetOffcuts` (mocks/warehouse.ts:759-795) фильтрует по всем трём: `productId` (783), `categoryIds` (787-790), `batchNumber` (792-794).
- `/api/products/list` — обработчик мока `src/services/mocks/index.ts:437`; `getProductList()` — `src/services/productsService.ts:113-117`.
- i18n `filter_product_all` и `filter_batch_placeholder` есть во всех трёх локалях (warehouse.ts:143-144, 825-826, 1409-1410).
- UI: Category (MultiSelect, `warehouse-offcuts-category-filter`) и Batch (SearchInput, `warehouse-offcuts-batch-filter`) в блоке фильтров вкладки offcuts, WarehousePage.vue:1094-1113.

### Чего нет
Фильтра **Product** в UI вкладки «Обрезки» нет:
```
$ grep -n "offcutFilters" src/views/admin/warehouse/WarehousePage.vue
… 1061 search, 1069 status, 1078 unit, 1087 offcutType, 1098 categoryIds, 1108 batchNumber …
```
`offcutFilters.productId` нигде не привязан к контролу, `getProductList()` в WarehousePage.vue не вызывается (`grep -n getProductList src/views/admin/warehouse/WarehousePage.vue` — пусто). То есть весь тракт (тип → реактив → сервис → мок → эндпоинт) готов, а выбирать товар пользователю нечем.
Плюс `productId` не попадает в сохранённое представление вкладки: `buildViewParams` для `tab === 'offcuts'` (warehouseService.ts:282-289) переносит status/unit/offcutType/categoryIds/batchNumber, но не productId.

Файлы плана: types/warehouse.ts, composables/useWarehouse.ts, services/warehouseService.ts, services/mocks/warehouse.ts, services/mocks/index.ts, views/admin/warehouse/WarehousePage.vue, services/productsService.ts, i18n/admin/warehouse.ts

---

## 3. roo_code/plans/warehouse/analysis-cutting-vs-spec.md — **сделано**

План — аналитическая записка; его исполняемая часть — таблица «Что нужно исправить» из пяти строк. Все пять закрыты, и закрыты именно так, как записка требовала (а её описание кода на момент написания уже неверно).

1. Остаток партии уменьшается при создании обрезка — `mockCreateOffcut` (mocks/warehouse.ts:828-880): `if (material.material > batch.quantityRemaining) throw new Error('INSUFFICIENT_QUANTITY')`, и комментарий над функцией: «Количество партии уменьшает ТОЛЬКО `writeMovement`». То есть списание идёт через движение — ровно вариант, который записка называла правильным.
2. Движение при создании обрезка создаётся: `await mockCreateMovement({ type: 'offcut', batchId: data.batchId, offcutId: id, quantity: material.material, … })` (warehouse.ts:869-877).
3. `files` у обрезка есть — `types/warehouse.ts:235 files?: WarehouseBatchFile[]` в `WarehouseOffcut`; DropZone в карточке — `WarehouseOffcutCard.vue:14` (импорт) и `:933` (использование); загрузка/удаление в `useWarehouseOffcutCard.ts` (`onFilesUploaded`, `removeFile`, `fileIdsToAttach`).
4. UI резки есть: `src/views/admin/warehouse/WarehouseCuttingPage.vue` + `src/composables/useWarehouseCutting.ts` + маршрут `admin-warehouse-cutting` (`src/router/index.ts:292`) + вход из карточки партии (`WarehouseBatchCard.vue:1355`, `data-test="batch-card-cutting-link"`).
5. `mockExecuteCutting` (mocks/warehouse.ts:1266-1319) больше не заглушка: проверяет партию, пустой список, отрицательные kerf/waste, применимость пропила к линейной единице, считает `computeCuttingConsumption`, отказывает при нехватке и рассогласовании `sourceQuantity`, создаёт обрезки через `mockCreateOffcut` и списывает пропил+отход одним `write-off`.

Пункты записки, помеченные в ней как незапланированные («умный подбор обрезков при раскрое»), к исполнению не требовались; авто-вес по плотности при этом появился — `src/domain/cutting.ts::resolveOffcutWeight`, используется в `useWarehouseOffcutCard.ts:14` и `WarehouseOffcutCard.vue:7`.

Файлы плана: frontend_vue/src/services/mocks/warehouse.ts, frontend_vue/src/services/mocks/index.ts, frontend_vue/src/types/warehouse.ts, frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue, WarehouseOffcutCard.vue

---

## 4. roo_code/plans/warehouse/auto-create-movement-on-location-change.md — **частично**

### Что есть (шаги 1, 2, 3, 5)
`useWarehouseBatch.ts` — импорт `createMovement` (строка 8) и в `save()`:
```
250:      const oldLocation = batch.value.location
260:      if (oldLocation !== newLocation) {
262:          await createMovement({ type: 'transfer', batchId: updated.id,
265:            quantity: updated.quantityRemaining, fromLocation: oldLocation,
267:            toLocation: newLocation, movedAt: new Date().toISOString(),
269:            notes: t('warehouse.movement_auto_location_change') })
271:          toast.success(t('warehouse.toast_movement_auto_created'))
273:        } catch { toast.info(t('warehouse.toast_movement_auto_failed')) }
275:        await loadMovements()
```
i18n (шаг 3) — `movement_auto_location_change` (warehouse.ts:294, 973, 1654), `toast_movement_auto_created` / `toast_movement_auto_failed` (562-563, 1242-1243, +LT). Шаг 2 по тексту плана изменений не требовал. Шаг 5 обеспечен вызовом `loadMovements()` внутри composable — как план и предполагал.

### Чего нет (шаг 4)
`mockPatchBatch` движение НЕ создаёт — на его месте пустая заглушка:
```
$ sed -n 743,746p src/services/mocks/warehouse.ts
  // If location changed, auto-create a transfer movement
  if (delta.location && delta.location !== batch.location) {
    // (This is handled by useWarehouseBatch composable)
  }
```
Это похоже на осознанный отказ (иначе на одно сохранение легло бы два движения), но план требовал именно мок, и в моке пусто. Ветка вдобавок мёртвая: `Object.assign` на строке 738 уже перезаписал `batch.location`, так что `delta.location !== batch.location` всегда ложно.

Файлы плана: frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue, frontend_vue/src/composables/useWarehouseBatch.ts, frontend_vue/src/services/warehouseService.ts, frontend_vue/src/types/warehouse.ts, frontend_vue/src/composables/useDirtyCheck.ts, frontend_vue/src/i18n/admin/warehouse.ts, frontend_vue/src/services/mocks/warehouse.ts, frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue

---

## 5. roo_code/plans/warehouse/auto-create-movement-on-offcut-location-change.md — **частично**

### Что есть (шаги 1, 3)
`useWarehouseOffcutCard.ts::save()` — `import { createMovement }` (строка 9), `const oldLocation = offcut.value.location` перед патчем, затем:
```
      if (oldLocation !== newLocation) {
        movementsToCreate.push(createMovement({ type: 'transfer', offcutId: updated.id,
          batchId: updated.batchId, quantity: updated.quantity,
          fromLocation: oldLocation, toLocation: newLocation,
          movedAt: new Date().toISOString(),
          notes: t('warehouse.movement_auto_location_change') }).catch(() => {}))
      }
      … if (oldLocation !== newLocation) toast.success(t('warehouse.toast_movement_auto_created'))
```
Сделано даже больше плана: движение несёт `offcutId` (план предлагал только `batchId`), и список движений обрезка перезагружается (`await loadMovements()`), хотя план утверждал, что списка в карточке нет — он есть.
Шаг 3 (i18n) подтверждён: все три ключа на месте во всех трёх локалях (см. часть 4).

### Чего нет (шаг 2) и где план врёт
`mockPatchOffcut` движение не создаёт:
```
$ sed -n 881,890p src/services/mocks/warehouse.ts
export async function mockPatchOffcut(id, data) {
  const offcut = offcutStore.find((o) => o.id === id)
  if (!offcut) throw new Error('OFFCUT_NOT_FOUND')
  Object.assign(offcut, data, { updatedAt: new Date().toISOString() })
  return { ...offcut }
}
```
При этом раздел «Current Architecture» плана утверждает, что эталон — `mockPatchBatch()` уже авто-создаёт движение (строки 399-424). Это неверно: там пустая заглушка (см. часть 4). Ни один из двух моков движение по смене location не пишет — обратное направление (движение `transfer` переносит `location` на обрезок/партию) реализовано в `mockCreateMovement`, warehouse.ts:1090, и покрыто `src/services/mocks/warehouse-transfer-location.spec.ts`.
Ошибка в предупреждающем тосте: план требовал `toast_movement_auto_failed` при отказе, в коде вместо этого `.catch(() => {})` — отказ проглатывается молча, а успешный тост показывается всё равно.

Файлы плана: frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue, frontend_vue/src/composables/useWarehouseOffcutCard.ts, frontend_vue/src/services/mocks/warehouse.ts, frontend_vue/src/composables/useWarehouseBatch.ts, frontend_vue/src/i18n/admin/warehouse.ts
