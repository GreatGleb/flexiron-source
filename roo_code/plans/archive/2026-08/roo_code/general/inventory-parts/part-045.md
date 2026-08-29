# Инвентаризация планов — часть 045 (roo_code/plans/warehouse, пачка 4 планов)

Код не менялся. Все выводы проверены командами из frontend_vue/.

---

## 1. roo_code/plans/warehouse/extract-batch-location-section.md — **сделано**

Чекбоксов в плане: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0).

Требовалось: секция «Местоположение на складе» отдельной GlassPanel в карточке партии,
поля rack/row/cell/notes, parse/compose в `useWarehouseBatch.ts`, i18n на трёх языках,
`.location-grid` в 3 колонки, удаление старого одиночного поля `location`.

Доказательство:

```
$ grep -n "parseLocation\|composeLocation\|locationRack\|locationNotes" src/composables/useWarehouseBatch.ts
41:function parseLocation(raw: string | null): {
42:  locationRack: string
45:  locationNotes: string
47:  const fallback = { locationRack: '', locationRow: '', locationCell: '', locationNotes: '' }
65:  return { ...fallback, locationRack: raw }        # legacy-фоллбек как в плане
68:function composeLocation(rack: string, row: string, cell: string, notes: string): string | null
106:    locationRack: string   (в form-стейте; поля location в форме нет)
200:      const parsed = parseLocation(data.location)      # load()
242:      const newLocation = composeLocation(...)         # save()
278:      const parsed = parseLocation(updated.location)   # после save
308:    const parsed = parseLocation(batch.value.location) # discard()

$ sed -n 68,76p src/composables/useWarehouseBatch.ts
function composeLocation(rack, row, cell, notes): string | null {
  const parts: string[] = []
  if (rack || row || cell) parts.push(`Rack: ${rack} | Row: ${row} | Cell: ${cell}`)
  if (notes) parts.push(`Notes: ${notes}`)
  return parts.length > 0 ? parts.join('\n') : null      # всё пусто → null, как в плане
}

$ grep -n "batch-card-location-section\|section_batch_location\|location-grid" src/views/admin/warehouse/WarehouseBatchCard.vue
1084:          :title="t('warehouse.section_batch_location')"
1085:          data-test="batch-card-location-section"
1088:            <div class="location-grid">
# порядок: entity-card-grid закрывается на 1078-1082, секция места 1083-1198,
# section_batch_movements — 1280. То есть между гридом и «Движениями», как требовал план.

$ grep -rn 'data-test="field-location"' src/
(ничего, exit 1)   # старое одиночное поле удалено во всём проекте

$ grep -n "section_batch_location\|field_location_rack\|field_location_notes_hint" src/i18n/admin/warehouse.ts
402,403,410  (ru)   1080,1081,1088 (en)   1759,1760,1767 (lt)
# все 9 ключей есть во всех трёх локалях, значения совпадают с таблицами плана

$ sed -n 177,188p src/styles/admin/components/_entity-card-layout.css
.location-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
@media (max-width: 600px) { .location-grid { grid-template-columns: 1fr; gap: 10px; } }
```

Осталось: ничего. Реализация пошла дальше плана — те же поля есть и на страницах
создания (`WarehouseBatchCreatePage.vue` + `useWarehouseBatchCreate.ts`) и в моке
(`src/services/mocks/warehouse.ts:585` — свой `parseLocation`), чего план не требовал.

Файлы из плана: frontend_vue/src/composables/useWarehouseBatch.ts,
frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue,
frontend_vue/src/i18n/admin/warehouse.ts, frontend_vue/src/types/warehouse.ts,
frontend_vue/src/mocks/warehouse-batches.ts.

Примечание: путь `frontend_vue/src/mocks/warehouse-batches.ts` из плана в репозитории
не существует (моки живут в `src/services/mocks/warehouse.ts`), но план и не требовал
его менять («What NOT to Change»), так что на вердикт это не влияет.

---

## 2. roo_code/plans/warehouse/extract-offcut-location-section.md — **сделано**

Чекбоксов в плане: 0.

Требовалось: то же самое в карточке обрезка — parse/compose скопировать из
`useWarehouseBatch.ts`, форму перевести на четыре подполя, секцию поставить между
`entity-card-grid` и секцией аудита, новых i18n-ключей не добавлять.

Доказательство:

```
$ grep -n "parseLocation\|composeLocation\|location" src/composables/useWarehouseOffcutCard.ts
48:function parseLocation(raw: string | null)          # копия хелпера
75:function composeLocation(rack, row, cell, notes)
100-112: form-стейт: locationRack/locationRow/locationCell/locationNotes (поля location нет)
200-206: load() → parseLocation(data.location)
279-286: save() → delta.location = composeLocation(...)
333-339: пере-парс после save
359-365: discard() → parseLocation(offcut.value.location)

$ grep -n "offcut-card-location-section\|section_batch_location\|location-grid" src/views/admin/warehouse/WarehouseOffcutCard.vue
750:          :title="t('warehouse.section_batch_location')"
751:          data-test="offcut-card-location-section"
754:            <div class="location-grid">
# entity-card-grid открыт на 347 и закрыт перед 749; секция аудита — 943
# ("audit-panel-wide"), то есть секция места стоит после грида и до аудита.

$ grep -rn 'data-test="field-location"' src/
(ничего)    # старое одиночное поле из правой колонки убрано
```

i18n-ключи переиспользованы (`warehouse.section_batch_location` и т.д.) — новых не
добавляли, как и требовал план. `.location-grid` уже был из партии.

Осталось: ничего.

Файлы из плана: frontend_vue/src/composables/useWarehouseOffcutCard.ts,
frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue,
frontend_vue/src/types/warehouse.ts, frontend_vue/src/i18n/admin/warehouse.ts,
frontend_vue/src/composables/useWarehouseBatch.ts (источник хелперов),
frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue (образец секции).

---

## 3. roo_code/plans/warehouse/fix-batch-card-custom-select-overlap.md — **сделано**

Чекбоксов в плане: 0.

Три шага плана: `position: relative` на `.glass-panel` в загружаемом
`_glass-panel.css`; правило `:has(.custom-select-list.open) { z-index: 100 !important }`
там же; подъём `.entity-card-grid` в `_entity-card-layout.css`.

Доказательство:

```
$ sed -n 1,12p src/styles/admin/components/_glass-panel.css
.glass-panel {
  margin-bottom: 24px;
  position: relative;            # шаг 1
}
/* When a dropdown/popup is open inside a glass panel, elevate it ... */
.glass-panel:has(.custom-select-list.open) {
  z-index: 100 !important;       # шаг 2
}

$ sed -n 16,19p src/styles/admin/components/_entity-card-layout.css
.entity-card-grid:has(.custom-select-list.open) {
  position: relative;
  z-index: 1;                    # шаг 3
}
```

Осталось: ничего. Оба файла действительно загружаются (`_glass-panel.css` и
`_entity-card-layout.css` — через admin-core.scss / импорты компонентов), а
`main.css` план и не просил править.

Файлы из плана: frontend_vue/src/styles/admin/main.css,
frontend_vue/src/styles/admin/components/_glass-panel.css,
frontend_vue/src/styles/admin/admin-core.scss,
frontend_vue/src/layouts/AdminLayout.vue,
frontend_vue/src/styles/admin/components/_entity-card-layout.css.

---

## 4. roo_code/plans/warehouse/fix-batch-card-i18n-keys.md — **сделано**

Чекбоксов в плане: 0.

Требовалось: добавить `btn.cancel` / `btn.delete` в трёх локалях `warehouse.ts`
(вариант A) и заменить `t('warehouse.btn_delete')` на `t('btn.delete')` в модалке
удаления партии.

Доказательство:

```
$ grep -n -A4 "^\s*btn: {" src/i18n/admin/warehouse.ts
679:    btn: { cancel: 'Отмена', delete: 'Удалить', retry: 'Повторить' }      # ru
1360:   btn: { cancel: 'Cancel', delete: 'Delete', retry: 'Retry' }           # en
2037:   btn: { cancel: 'Atšaukti', delete: 'Ištrinti', retry: 'Bandyti dar kartą' }  # lt

$ grep -n "btn.delete\|btn.cancel\|warehouse.btn_delete" src/views/admin/warehouse/WarehouseBatchCard.vue
477:              {{ t('warehouse.btn_delete_batch') }}     # другая кнопка (шапка), не модалка
1499:                        v-tooltip="t('btn.delete')"
1566:            {{ t('btn.cancel') }}                      # модалка удаления партии
1575:            {{ saving ? t('btn.delete') + '...' : t('btn.delete') }}   # правка плана применена
1615:            {{ t('btn.cancel') }}                      # модалка аудита
1623:            {{ t('btn.delete') }}
```

`t('warehouse.btn_delete')` в файле больше не встречается (остался только
`warehouse.btn_delete_batch` — другой ключ, кнопка в шапке, плана не касался).
Утверждение плана «`btn.cancel`/`btn.delete` не существуют ни в одном i18n-файле»
на сегодня устарело — ключи есть, вместе с бонусным `btn.retry`.

Осталось: ничего.

Файлы из плана: frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue,
frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue,
frontend_vue/src/views/admin/warehouse/WarehousePage.vue,
frontend_vue/src/views/admin/warehouse/WarehouseOffcutCard.vue,
frontend_vue/src/views/admin/warehouse/WarehouseMovementCard.vue,
frontend_vue/src/views/admin/warehouse/WarehouseDeficitCard.vue,
frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue,
frontend_vue/src/views/admin/warehouse/CreateBatchModal.vue,
frontend_vue/src/i18n/admin/warehouse.ts,
frontend_vue/src/i18n/admin/suppliers.ts,
frontend_vue/src/i18n/admin/common.ts.

---

Итог пачки: все четыре плана реализованы полностью. Работы по ним нет.
