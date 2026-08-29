# План: Отображать единицу измерения в поле "Выбранное количество"

## Проблема
В модалке создания движения в поле "Выбранное количество" (`selectedMovementsQuantity`) отображается только голое число без единицы измерения. Пользователь хочет видеть единицу измерения товара (шт, кг, м, м²).

## Текущее состояние
- В карточках движений (`.movement-card-qty`) единица уже отображается через `t('warehouse.unit_' + movement.unit)`.
- В поле "Выбранное количество" (read-only input) — только число.

## Изменения

### 1. `frontend_vue/src/views/admin/warehouse/CreateMovementModal.vue`

**Скрипт:**
- Добавить computed `batchUnitLabel`:
  ```ts
  const batchUnitLabel = computed(() => {
    if (!props.batch?.unit) return ''
    return t(`warehouse.unit_${props.batch.unit}`)
  })
  ```

**Шаблон (строки ~451-461):**
- Заменить read-only input на отображение числа + единицы измерения:
  ```html
  <div class="form-group">
    <label class="field-label">{{ t('warehouse.field_selected_quantity') }}</label>
    <div class="selected-qty-display" data-test="create-movement-selected-qty">
      {{ selectedMovementsQuantity }}
      <span class="qty-unit">{{ batchUnitLabel }}</span>
    </div>
  </div>
  ```

### 2. `frontend_vue/src/styles/admin/components/_forms.css`

- Добавить стили для `.selected-qty-display` (аналог read-only input, но с поддержкой inline-элементов):
  ```css
  .selected-qty-display {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
    min-height: 38px;
    box-sizing: border-box;
  }
  .selected-qty-display .qty-unit {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.35);
  }
  ```
