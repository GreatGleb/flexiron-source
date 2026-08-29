# Add `converted_to_offcuts` Batch Status

## Цель
Добавить новый статус партии `converted_to_offcuts` — когда 100% партии передано в обрезки.

## Затрагиваемые файлы (6)

### 1. [`frontend_vue/src/types/warehouse.ts`](../../frontend_vue/src/types/warehouse.ts)
- Добавить `'converted_to_offcuts'` в union `BatchStatus` (line 10)

### 2. [`frontend_vue/src/i18n/admin/warehouse.ts`](../../frontend_vue/src/i18n/admin/warehouse.ts)
Добавить в RU/EN/LT разделы:

| Key | RU | EN | LT |
|-----|----|----|----|
| `status_converted_to_offcuts` | Переведена в обрезки | Converted to offcuts | Perkelta į atraižas |
| `batch_status_converted_to_offcuts` | Переведена в обрезки | Converted to offcuts | Perkelta į atraižas |
| `batch_status_hint_converted_to_offcuts` | Вся партия передана в обрезки | Entire batch transferred to offcuts | Visa partija perkelta į atraižas |

### 3. [`frontend_vue/src/styles/admin/components/_status-pills.css`](../../frontend_vue/src/styles/admin/components/_status-pills.css)
Добавить `.pill-offcut` — серый цвет `#8c8c8c` (как `agg-card-offcut`):
```css
.pill-offcut {
  background: rgba(140, 140, 140, 0.2);
  border: 1px solid rgba(140, 140, 140, 0.3);
  color: #8c8c8c;
}
```

### 4. [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue)
- Добавить в `BATCH_STATUS_PILL` (line 72): `converted_to_offcuts: 'pill-offcut'`

### 5. [`frontend_vue/src/views/admin/warehouse/WarehousePage.vue`](../../frontend_vue/src/views/admin/warehouse/WarehousePage.vue)
- В `BATCH_STATUS_OPTIONS` (line 374): добавить `{ value: 'converted_to_offcuts', label: t('warehouse.batch_status_converted_to_offcuts') }`
- В `BATCH_STATUS_PILL` (line 508): добавить `converted_to_offcuts: 'pill-offcut'`

### 6. [`frontend_vue/src/services/mocks/warehouse.ts`](../../frontend_vue/src/services/mocks/warehouse.ts)
- В `AGGREGATE_TO_STATUS` (line 77): `offcut: 'converted_to_offcuts'`
- В `computeBatchStatus` (line 87): статус уже будет корректно вычисляться через `AGGREGATE_TO_STATUS`, когда `offcut` — единственный агрегат
