# Инвентаризация планов — часть 044 (roo_code/plans/warehouse, пачка 4 планов)

Проверено 2026-08-26. Код не изменялся.

---

## 1. roo_code/plans/warehouse/correction-behavior-refinement.md

**Вердикт: сделано**

Чекбоксов в плане: 0.

План требует 5 правок (таблица «Summary of Changes»). Все пять есть в коде.

Доказательство:

```
$ grep -n "correction\|selectedAggregateQuantity\|totalInStockAfter\|isFormValid\|watch(type" frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue
...
220:  if (dir === 'correction') {
223:      const delta = (quantity.value || 0) - selectedAggregateQuantity.value
254:    } else if (quantity.value === selectedAggregateQuantity.value) {
255:      e.quantity = t('warehouse.correction_no_change')
279:const isFormValid = computed(() => {
283:    if (quantity.value === selectedAggregateQuantity.value) return false
486:watch(type, (newType, oldType) => {
487:  if (newType === 'correction') {
488:    quantity.value = selectedAggregateQuantity.value
489:  } else if (oldType === 'correction') {
```

Пофайлово:

- **A. watch(type)** — CreateMovementModal.vue:484-492, дословно как в плане:
  `if (newType === 'correction') quantity.value = selectedAggregateQuantity.value; else if (oldType === 'correction') quantity.value = 0`.
  Дополнительно есть watch на `[selectedAggregateType, selectedSaleId]` (строки 464-482), который тоже синхронизирует `quantity` — плана не нарушает.
- **B. validate()** — строки 251-256: `if (quantity.value < 0) e.quantity = t('validation.min', { min: 0 })` иначе
  `else if (quantity.value === selectedAggregateQuantity.value) e.quantity = t('warehouse.correction_no_change')`.
- **C. isFormValid** — строки 281-284: обе проверки (`< 0` и `=== selectedAggregateQuantity`).
- **D. totalInStockAfter** — строки 220-228: дельта применяется только при `selectedAggregateType.value === 'receipt'`, иначе `return base`. Комментарий 206-208 описывает именно это.
- **E. Шаблон** — ошибка выводится под полем корректировки: строка 733 `<p v-if="errors.quantity" class="field-error">{{ errors.quantity }}</p>` внутри блока `field_selected_after` (712-737), поле редактируемое только при `isCorrection`.
- **i18n ключ** в трёх языках:

```
$ grep -rn "correction_no_change" frontend_vue/src/
src/i18n/admin/warehouse.ts:443:      correction_no_change: 'Значение должно отличаться от исходного',
src/i18n/admin/warehouse.ts:1121:      correction_no_change: 'Value must differ from the original',
src/i18n/admin/warehouse.ts:1799:      correction_no_change: 'Reikšmė turi skirtis nuo pradinės',
src/views/admin/warehouse/CreateMovementModal.vue:255:      e.quantity = t('warehouse.correction_no_change')
```

Осталось: ничего.

Файлы, упомянутые в плане: `CreateMovementModal.vue`, `i18n/admin/warehouse.ts`.

---

## 2. roo_code/plans/warehouse/enhance-movement-modal-with-batch-summary.md

**Вердикт: частично**

Чекбоксов в плане: 0.

Есть (пункты 1-2 и «Steps» 1,2,4, плюс размер модалки):

- `size="large"` — CreateMovementModal.vue:552.
- Пропсы `batch`, `movements`, `aggregates`, `activeSales` — строки 37-43; родитель их передаёт: WarehouseBatchCard.vue:1532-1540 (`:batch`, `:movements`, `:aggregates`, `:active-sales`).
- Секция сводки — `class="batch-summary-section"` (562), `batch-total-stat` с `batch.quantity` + единица (564-577), инструкция (578-581).
- Агрегатные карточки — `aggregate-cards` / `aggregate-card` (583-628), фильтр `a.quantity > 0`, карты типов, цвета через классы `agg-card-*` (строки 93-105), скрыты `return` и `transfer` (`HIDDEN_AGGREGATE_TYPES`, 107).
- i18n-ключи `batch_summary_*` во всех трёх локалях: warehouse.ts:630-650 (ru), 1310-1330 (en), 1987-2007 (lt) — включая `select_all`, `deselect_all`, `no_movements`.
- CSS в `_forms.css`: `.batch-summary-section` (205), `.batch-total-stat` (222), `.aggregate-cards` (277), `.aggregate-card` (284), а также `.movement-card-list` (573), `.movement-select-card` (579), `.movement-card-checkbox` (600).

Нет (пункт 3 «Individual Movement Cards» целиком и часть пункта 2):

- Список отдельных движений с чекбоксами в шаблоне отсутствует. Классы из плана не встречаются ни в одном шаблоне:

```
$ grep -rn "movement-select-card\|movement-card-list" frontend_vue/src/ --include=*.vue
(пусто)
```
  То есть CSS для них написан, а разметки нет.
- Пропс `movements` объявлен, но нигде в компоненте не используется:

```
$ grep -n "movements" frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue
40:  movements?: MovementListItem[]
```
- Нет ссылки на карточку движения — в модалке нет ни `router-link`, ни иконки `external-link`:

```
$ grep -n "external-link\|router-link" frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue
(пусто)
```
- Нет «Select All / Deselect All» и пустого состояния — ключи не используются:

```
$ grep -rn "batch_summary_select_all\|batch_summary_deselect_all\|batch_summary_no_movements" frontend_vue/src/ --include=*.vue
(пусто)
```
- Агрегаты НЕ вычисляются из `movements`, как требует план («computed aggregates from movements»), а приходят готовым пропсом `aggregates` (`aggregateEntries`, строки 111-122).
- Мультивыбор чекбоксами заменён одиночным выбором (radio-поведение): `selectedAggregateType` — один `ref<string | null>` (126), `selectAggregateType` сбрасывает предыдущий (132-136). Вместо списка движений реализована секция «Активные продажи» (`active-sales-section`, 630-655) с одиночным выбором — этого в плане нет.

Итог: реализована сводка партии (пункты 1-2) в переработанном виде — выбор одиночный и служит формой, а не «чисто информационными» чекбоксами; список отдельных движений (пункт 3) не реализован, хотя его CSS и i18n остались в проекте как мёртвый след.

Файлы, упомянутые в плане:
`frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`,
`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`,
`frontend_vue/src/i18n/admin/warehouse.ts`,
`frontend_vue/src/styles/admin/components/_forms.css`.

---

## 3. roo_code/plans/warehouse/enrich-batch-mock-locations.md

**Вердикт: сделано**

Чекбоксов в плане: 0.

Требования: (1) все 100 партий с `location` в формате `Rack: X | Row: Y | Cell: Z`, (2) ≥50 партий с `\nNotes: ...`, (3) парсинг и карточка работают.

Доказательство (разбор файла мока регэкспом, учитывая переносы строк в prettier-форматировании):

```
$ python3 - <<'PY'
import re
s=open('frontend_vue/src/mocks/warehouse-batches.ts').read()
locs=re.findall(r"location:\s*\n?\s*('(?:[^'\\]|\\.)*'|null)", s)
print("found", len(locs))
print("bad:", len([l for l in locs if not l.startswith("'Rack: ")]))
print("with notes:", len([l for l in locs if '\\nNotes: ' in l]))
PY
found 100
bad: 0
with notes: 55
```

Ровно 55 партий с заметками о месте — цифра из плана («Total with notes: 55 batches (55%)»).
Легаси-строк вида `"A-01-01"` не осталось (`bad: 0`). Пример: warehouse-batches.ts:19-20
`'Rack: A-01 | Row: 01 | Cell: 01\nNotes: Часть партии также в ячейках 02-03 этого же ряда'` —
дословно сценарий 1 из плана.

Парсинг и обратная сборка на месте (план требовал только проверить):
`useWarehouseBatch.ts:34-38` — регэкспы `LOCATION_RACK_RE/ROW_RE/CELL_RE/NOTES_RE`;
`parseLocation` (40-66) с fallback на легаси; `composeLocation` (68-77) собирает
`Rack: ... | Row: ... | Cell: ...` + `\nNotes: ...`, вызывается при сохранении (242-248).
Карточка рендерит все четыре поля: WarehouseBatchCard.vue:1091, 1118, 1145, 1173
(`field_location_rack/row/cell/notes`).

Осталось: ничего. Единственная непроверенная строка плана — ручной осмотр UI (пункт «Verification»), который машинно не воспроизводится; данные и код под ним соответствуют.

Файлы, упомянутые в плане:
`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`,
`frontend_vue/src/composables/useWarehouseBatch.ts`,
`frontend_vue/src/mocks/warehouse-batches.ts`,
`frontend_vue/src/types/warehouse.ts`.

---

## 4. roo_code/plans/warehouse/enrich-batch-mock-notes.md

**Вердикт: сделано**

Чекбоксов в плане: 0.

План: заменить `notes: null` осмысленными текстами у всех партий (в плане их 74).

Доказательство:

```
$ grep -c "notes: null" frontend_vue/src/mocks/warehouse-batches.ts
0
$ grep -c "^ *notes:" frontend_vue/src/mocks/warehouse-batches.ts
100
$ grep -c "id: 'whb-" frontend_vue/src/mocks/warehouse-batches.ts
100
```

Ни одного `notes: null` — заполнены все 100 партий (мок с момента написания плана вырос с 74 до 100, новые тоже с заметками).

Тексты совпадают с планом дословно (с типографскими правками тире и «м²»):

```
$ grep -n "notes:" frontend_vue/src/mocks/warehouse-batches.ts | head -20
23:    notes: 'Certificate CERT-001 attached. Batch partially consumed for order #ORD-2025-042.',
90:    notes: 'New supplier SteelInvest. Full batch intact, awaiting allocation.',
240:    notes: 'Galvanized sheet — store indoors to prevent white rust.',
356:    notes: 'Plywood — keep dry. Remaining 60m² stored in F-01-01.',
406:    notes: 'Certificate CERT-012 attached. 100kg issued to production.',
...
```

Заметки, которые план велел сохранить как есть, сохранены:

```
$ grep -n "'Almost empty'\|'40L cylinders'\|'Premium electrodes'\|'New supplier batch'\|'Mostly consumed'\|'Stainless steel - handle with care'" frontend_vue/src/mocks/warehouse-batches.ts
284:    notes: 'New supplier batch',
311:    notes: 'Mostly consumed',
521:    notes: 'Stainless steel - handle with care',
1358:    notes: 'Premium electrodes',
1589:    notes: '40L cylinders',
1795:    notes: 'Almost empty',
```

Осталось: ничего.

Файлы, упомянутые в плане: `frontend_vue/src/mocks/warehouse-batches.ts`.
