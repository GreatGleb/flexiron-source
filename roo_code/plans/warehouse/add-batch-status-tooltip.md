# План: Добавить info-hint с разными подсказками к статусному pill в карточке партии

## Текущее состояние

Сейчас статусный pill в шапке карточки партии ([`WarehouseBatchCard.vue:171-173`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:171)) выглядит так:

```html
<span class="pill pill-lg" :class="BATCH_STATUS_PILL[batch.status]" data-test="batch-card-status-pill">
  {{ t(`warehouse.batch_status_${batch.status}`) }}
</span>
```

Нет никакой подсказки — только цветной текст статуса.

## Что нужно сделать

Добавить иконку `(i)` рядом со статусным pill, которая при наведении показывает разный текст-пояснение для каждого статуса партии.

## Изменения

### 1. Файл: [`frontend_vue/src/i18n/admin/warehouse.ts`](../../frontend_vue/src/i18n/admin/warehouse.ts)

Добавить новые ключи переводов для подсказок статусов (для всех 3 языков: ru, en, lt):

```ts
// Batch status hints
batch_status_hint_available: 'Партия полностью доступна для использования и резервирования',
batch_status_hint_reserved: 'Партия зарезервирована под активные заказы или производство',
batch_status_hint_partial: 'Часть партии уже израсходована, часть ещё доступна',
batch_status_hint_depleted: 'Партия полностью израсходована. Доступного остатка нет',
batch_status_hint_quarantine: 'Партия временно заблокирована. Использование недоступно до выяснения причин',
```

### 2. Файл: [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue)

Изменить строки 171-173 — добавить `info-hint` рядом с pill:

```html
<span class="batch-status-wrapper" data-test="batch-card-status-wrapper">
  <span class="pill pill-lg" :class="BATCH_STATUS_PILL[batch.status]" data-test="batch-card-status-pill">
    {{ t(`warehouse.batch_status_${batch.status}`) }}
  </span>
  <span
    v-tooltip="t(`warehouse.batch_status_hint_${batch.status}`)"
    class="info-hint"
    data-test="batch-card-status-hint"
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  </span>
</span>
```

**Важно:** Используем `v-tooltip` (Vue-директиву), а не CSS `::after`, потому что:
- В проекте уже есть стили, отключающие `::after` для `info-hint` внутри определённых контейнеров ([`warehouse_list.css:824-828`](../../frontend_vue/src/styles/admin/warehouse_list.css:824))
- `v-tooltip` даёт более гибкое позиционирование и не конфликтует с CSS-правилами

### 3. Файл: [`frontend_vue/src/styles/admin/components/_entity-card-layout.css`](../../frontend_vue/src/styles/admin/components/_entity-card-layout.css) (опционально)

Если pill и иконка отображаются некорректно (например, иконка переносится на новую строку), добавить стиль:

```css
.batch-status-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
```

## Сводка изменений

| Файл | Тип изменения |
|------|--------------|
| `frontend_vue/src/i18n/admin/warehouse.ts` | Добавить 5 новых ключей `batch_status_hint_*` для ru, en, lt |
| `frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue` | Заменить одиночный `<span class="pill">` на обёртку `batch-status-wrapper` с pill + info-hint |
| `frontend_vue/src/styles/admin/components/_entity-card-layout.css` | Добавить стиль `.batch-status-wrapper` (если потребуется) |

## Тексты подсказок для каждого статуса

| Статус | RU | EN | LT |
|--------|----|----|----|
| `available` | Партия полностью доступна для использования и резервирования | Batch is fully available for use and reservation | Partija visiškai prieinama naudojimui ir rezervavimui |
| `reserved` | Партия зарезервирована под активные заказы или производство | Batch is reserved for active orders or production | Partija rezervuota aktyviems užsakymams ar gamybai |
| `partial` | Часть партии уже израсходована, часть ещё доступна | Part of the batch has been consumed, some remains available | Dalis partijos jau sunaudota, dalis dar prieinama |
| `depleted` | Партия полностью израсходована. Доступного остатка нет | Batch is fully consumed. No remaining stock available | Partija visiškai sunaudota. Likučio nėra |
| `quarantine` | Партия временно заблокирована. Использование недоступно до выяснения причин | Batch is temporarily blocked. Usage is unavailable pending investigation | Partija laikinai užblokuota. Naudojimas negalimas, kol bus išsiaiškintos priežastys |
