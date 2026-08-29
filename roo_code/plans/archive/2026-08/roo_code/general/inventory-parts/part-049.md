# Инвентаризация планов — часть 049

Каталог: `roo_code/plans/warehouse` (пачка из 4 планов). Код не менялся.

---

## 1. roo_code/plans/warehouse/fix-warehouse-phase2-bugs-remaining-tabs.md

**Вердикт: частично**

Чекбоксов в плане: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0).

### Что требует план
Шаги 1–4: заменить в шаблоне префиксы `batch_status_`/`offcut_status_`/`movement_type_`/`deficit_priority_`/`deficit_status_` на `status_`/`type_`/`priority_`.
Шаг 5: добавить CSS-класс `.btn-danger-ghost`.
Шаг 6: переписать `skipNextPageWatch` в `useWarehouse.ts`, убрать флаг.

### Доказательства

Шаги 1–4 — в `WarehousePage.vue` уже целевые префиксы:
```
$ grep -n "t(\`warehouse\." src/views/admin/warehouse/WarehousePage.vue | grep -i "status\|type_\|priority"
2239:                    {{ t(`warehouse.status_${batch.status}`) }}
2738:                    {{ t(`warehouse.offcut_type_${offcut.offcutType}`) }}
2769:                    {{ t(`warehouse.status_${offcut.status}`) }}
3270:                    {{ t(`warehouse.type_${mov.type.replace(/-/g, '_')}`) }}
3714:                    {{ t(`warehouse.deficit_priority_badge_${item.priority}`) }}
3719:                    {{ t(`warehouse.status_${item.status}`) }}
```
Проблема `write-off` vs `write_off` закрыта дважды: в шаблоне `.replace(/-/g,'_')`, и в i18n есть оба варианта ключа во всех трёх локалях:
```
$ grep -c "'movement_type_write-off'" src/i18n/admin/warehouse.ts   → 3
$ grep -c "'movement_type_return-to-supplier'" src/i18n/admin/warehouse.ts → 3
$ grep -n "^  [a-z][a-z]: {" src/i18n/admin/warehouse.ts  → 3:ru, 685:en, 1366:lt
```
Покрытие ключей для всех значений `BatchStatus` (11 значений) — по 3 локали и для `batch_status_*`, и для `status_*`:
```
$ for s in available in_storage in_production sold scrapped expensed returned_to_supplier partial depleted reserved converted_to_offcuts; do grep -c "batch_status_$s:" ...; done
все = 3
$ ... grep -c "^      status_$s:" ...
все = 3
```
`deficit_priority_badge_low/medium/high/critical` есть (warehouse.ts:342-345 ru и аналоги в en/lt).

Шаг 5 — класс есть:
```
$ grep -rn "btn-danger-ghost" src/
src/styles/admin/warehouse_list.css:1009:.btn-danger-ghost {
src/styles/admin/warehouse_list.css:1014:.btn-danger-ghost:hover {
```

Шаг 6 — флаг НЕ убран, а переименован:
```
$ grep -rn "skipNextPageWatch" src/  → только useCategories.ts, useServices.ts, useNotifications.ts (в useWarehouse.ts нет)
$ grep -n "suppressPageWatch" src/composables/useWarehouse.ts
394:  let suppressPageWatch = false
408:      suppressPageWatch = current.page.value !== 1
419:      suppressPageWatch = stockPagination.page.value !== 1
... (та же схема во всех watch(filters) и watch(sort), проверка в 5 watch([page,pageSize]))
```
Композабл при этом переписан по-настоящему: пять независимых пагинаций/фильтров/флагов `*Initialized`, `watch(filters)` теперь берёт пагинацию активного таба через `tabPaginationMap[activeTab.value]`, page-watchers сторожат `activeTab`.

Пункты B (delete_title/delete_confirm) и C2 (`pill-mint`) — на месте:
```
$ grep -c "delete_title\|delete_confirm" src/i18n/admin/warehouse.ts → 9
$ grep -rn "pill-mint" src/styles/ → _status-pills.css:39, suppliers_list.css:830, main.css:1240
```

### Что осталось
- `WarehouseBatchCard.vue` шаблон по-прежнему на старых префиксах (`batch_status_${batch.status}` строки 415, 1044; `movement_type_${movement.type}` строка 1304; `offcut_status_${offcut.status}` строка 1410) — план требовал заменить на `status_`. Сырых ключей это не даёт: старые наборы в i18n полные, включая дефисные варианты типов движений. Работа косметическая.
- Флаг `suppressPageWatch` в `useWarehouse.ts` — план требовал его убрать. Двойной загрузки схема не даёт (при page===1 `reset()` не меняет значение и watcher не срабатывает), но буква шага 6 не выполнена; флаг один на пять табов.
- Ручная проверка вкладок в браузере (шаг «Проверка») из кода не подтверждается.

### Пункты
Чекбоксов нет — вердикты по шагам плана: шаги 1–4 сделано, шаг 5 сделано, шаг 6 частично, раздел D (BatchCard) не начато (но безвредно), разделы B и C2 сделано.

---

## 2. roo_code/plans/warehouse/fix-warehouse-stock-delete-mock.md

**Вердикт: не начато** (премисса плана при этом устарела — см. ниже)

Чекбоксов в плане: 0.

### Что требует план
Три правки: `mockDeleteStockItem(productId)` в `services/mocks/warehouse.ts`, его импорт в `services/mocks/index.ts`, роут `DELETE /api/warehouse/stock/{id}` в `deleteMock`.

### Доказательства
Ни одной из трёх правок нет:
```
$ grep -rn "mockDeleteStockItem" src/     → (пусто)
$ grep -rn "STOCK_ITEM_NOT_FOUND" src/
src/services/mocks/warehouse.ts:473:  if (!item) throw new Error('STOCK_ITEM_NOT_FOUND')
src/services/mocks/warehouse.ts:484:  if (!item) throw new Error('STOCK_ITEM_NOT_FOUND')   ← это get/patch, не delete
$ grep -n "warehouse\\\\/stock" src/services/mocks/index.ts
626: .../cost$ (GET)  633: card (GET)  642: /audit$ (GET)  1298: PATCH  1407: audit DELETE
```
В `deleteMock` роута `/api/warehouse/stock/{id}` нет.

Ни в сервисе, ни в композабле нет вызывающей стороны:
```
$ grep -n "deleteStock\|deleteStockItemApi" src/composables/useWarehouse.ts src/services/warehouseService.ts src/views/admin/warehouse/WarehousePage.vue
src/services/warehouseService.ts:320:export async function deleteStockAuditEntry(...)   ← только аудит
```

Кнопки удаления на вкладке Stock больше нет — в UI три конфирма (batch/offcut/deficit):
```
$ grep -n "confirmDelete" src/views/admin/warehouse/WarehousePage.vue
599: confirmDeleteBatch  604: confirmDeleteOffcut  609: confirmDeleteDeficit
$ sed -n 614,621p ... handleDelete(): ветки только batch | offcut | deficit
```
При этом в типе `deletingItem` литерал `'stock'` остался (WarehousePage.vue:596) — мёртвая ветка союза. Ключа `toast_stock_deleted` из «Verification Steps» в i18n нет (`grep -rn toast_stock_deleted src/` — пусто).

### Что осталось
Весь план. Но баг, который он лечит, недостижим: удаления остатка в UI нет и вызова API тоже. Реализовать план буквально — значит добавить мок под несуществующий вызов. Решение нужно на уровне «нужна ли кнопка удаления остатка», а не «добавить мок».

### Пункты
Чекбоксов нет. Три Layer'а плана: Layer 1 не начато, Layer 2 не начато, Layer 3 не начато.

---

## 3. roo_code/plans/warehouse/fix-warehouse-table-row-padding.md

**Вердикт: сделано**

Чекбоксов в плане: 0.

### Доказательства
Change 1 (фиксированная колонка Stock) и Change 2 (`td:first-child` остальных таблиц):
```
$ sed -n 905,910p src/styles/admin/warehouse_list.css
.stock-table-fixed .data-table td {
  white-space: normal;
  height: auto;
  padding-top: 11px;
  padding-bottom: 11px;
}
$ sed -n 929,933p src/styles/admin/warehouse_list.css
.data-table-wrapper .data-table td:first-child {
  height: auto;
  padding-top: 11px;
  padding-bottom: 11px;
}
```
Change 3 (все четыре брейкпоинта, значения ровно как в плане — 10/8/6/5):
```
$ sed -n 793,827p src/styles/admin/warehouse_list.css
/* ─── Responsive: vertical padding for product name cells ─── */
@media (max-width: 768px) { .stock-table-fixed .data-table td, .data-table-wrapper .data-table td:first-child { padding-top: 10px; padding-bottom: 10px; } }
@media (max-width: 600px) { ... 8px ... }
@media (max-width: 480px) { ... 6px ... }
@media (max-width: 320px) { ... 5px ... }
```
Базовое правило, из-за которого всё началось, на месте и не тронуто (это и предполагалось):
```
$ grep -n "^\.data-table td" -A6 src/styles/erp-base.css
712:.data-table td { height: 40px; padding: 0 0.75rem; ... }
```

### Что осталось
Ничего из кодовой части. Пункты «Verification» — визуальные, машинно не проверяются.

### Пункты
Чекбоксов нет. Change 1 сделано, Change 2 сделано, Change 3 сделано.

---

## 4. roo_code/plans/warehouse/generalize-offcuts-for-all-categories.md

**Вердикт: частично**

Чекбоксов в плане: 0 (шаги помечены в тексте ✅/🔄).

### Доказательства

Шаг 1 (типы) — сделано:
```
$ grep -n "offcutType\|categoryId" src/types/warehouse.ts
215/217 (WarehouseOffcut), 250/251 (OffcutListItem), 266/267 (OffcutCreatePayload — опциональные), 589/590 (фильтры)
```

Шаг 3 (мок-сервис) — сделано:
```
$ grep -n "offcutType\|categoryId" src/services/mocks/warehouse.ts
765/786: фильтр по offcutType   787-790: фильтр по categoryIds
848-849: mockCreateOffcut → categoryId: data.categoryId ?? null, offcutType: data.offcutType ?? 'sheet'
1301: mockExecuteCutting → mockCreateOffcut({ ...offcut, batchId }) — новые поля проходят
```

Шаг 6 (переводы) — сделано, три локали:
```
$ grep -n "col_length" src/i18n/admin/warehouse.ts
73/74 (ru), 755/756 (en), 1449/1450 (lt)
```

Шаг 5 (таблица) — ЧАСТИЧНО. Заголовок переименован, содержимое ячейки нет:
```
$ grep -n "col_length\|col_dimensions" src/views/admin/warehouse/WarehousePage.vue
2456:                      {{ t('warehouse.col_length') }}
2457:                      ... col_length_hint
$ sed -n 2750,2762p src/views/admin/warehouse/WarehousePage.vue
<td><template v-if="offcut.lengthMm">
  <span class="offcut-dimensions">{{ t('warehouse.offcut_dimensions', { length: offcut.lengthMm, width: offcut.widthMm ?? '—' }) }}</span>
</template><span v-else class="text-muted">—</span></td>
```
То есть под шапкой «Длина, мм» рендерится «Д×Ш». Хуже: шаблон перевода ждёт три параметра, а передают два —
```
$ grep -n "offcut_dimensions" src/i18n/admin/warehouse.ts
231:      offcut_dimensions: '{length}×{width}×{thickness} мм',   (и 913 en, 1593 lt)
```
`{thickness}` подстановки не получает.

Шаг 2 (мок-данные) — НЕ сделано и премисса не совпадает. План говорит «33 обрезка, 20 sheet + 13 linear, категории cat-2..cat-12». Реально:
```
$ grep -c "^  {" src/mocks/warehouse-offcuts.ts        → 13
$ grep -c "offcutType: 'sheet'"  ... → 6
$ grep -c "offcutType: 'linear'" ... → 7
$ grep -n "categoryId:" src/mocks/warehouse-offcuts.ts
cat-2 ×5, cat-4 ×2, cat-5 ×3, затем cat-2, cat-4, cat-5   (всего 3 категории)
```
Категорий cat-7…cat-12 в обрезках нет вовсе, хотя в каталоге они есть (`src/services/mocks/categories.ts`: cat-1…cat-13). Требования шага 2 — «~20 sheet / ~20 linear, все 9 категорий, перемешать» — не выполнены; первые пять записей по-прежнему подряд cat-2.

### Что осталось
- Шаг 2 целиком: линейных обрезков по категориям cat-7…cat-12 в моке нет, баланс 6/7 вместо ~20/20, начало списка сгруппировано по cat-2.
- Хвост шага 5: ячейка колонки «Длина, мм» показывает `Д×Ш` через `offcut_dimensions`, а не одну длину; заодно у этого перевода недоданный `{thickness}`.
- Отдельно: в таблице обрезков появилась колонка типа (`offcut_type_${offcut.offcutType}`, WarehousePage.vue:2738) — сверх плана, к его требованиям не относится.

### Пункты
Чекбоксов нет. Шаг 1 сделано, шаг 2 не начато, шаг 3 сделано, шаг 4 сделано (правок не требовал), шаг 5 частично, шаг 6 сделано.
