# План: Добавить field-hint подсказки под нередактируемые поля в карточке партии

## Текущее состояние

В карточке остатка ([`WarehouseStockCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseStockCard.vue)) под каждым `readonly` полем есть `<span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>`, который объясняет причину, почему поле нельзя редактировать.

В карточке партии ([`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue)) такие подсказки есть **только** у поля "Остаток" (stock/productName) — строка 348. Остальные `readonly` поля не имеют `field-hint`.

## Какие поля нужно изменить

### Левая колонка (entity-col-left)

| Поле | Строки | readonly? | Есть field-hint? |
|------|--------|-----------|------------------|
| supplier | 314-320 | ✅ да | ❌ нет |
| stock / productName | 341-348 | ✅ да | ✅ уже есть (строка 348) |

### Центральная колонка (entity-col-center)

| Поле | Строки | readonly? | Есть field-hint? |
|------|--------|-----------|------------------|
| remaining | 407-414 | ✅ да | ❌ нет |
| totalCost | 468-474 | ✅ да | ❌ нет |

### Правая колонка (entity-col-right)

| Поле | Строки | readonly? | Есть field-hint? |
|------|--------|-----------|------------------|
| receivedAt | 495-501 | ✅ да | ❌ нет |
| expiresAt | 514-520 | ✅ да | ❌ нет |

## Изменения

### 1. [`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) — добавить `<span class="field-hint">` под 5 readonly полей

Для каждого readonly поля добавить строку после закрывающего `</input>`:

```html
<span class="field-hint">{{ t('warehouse.hint_readonly') }}</span>
```

**Конкретные места:**

1. **supplier** (после строки 320): добавить `field-hint` после `</input>`
2. **remaining** (после строки 414): добавить `field-hint` после `</input>`
3. **totalCost** (после строки 474): добавить `field-hint` после `</input>`
4. **receivedAt** (после строки 501): добавить `field-hint` после `</input>`
5. **expiresAt** (после строки 520): добавить `field-hint` после `</input>`

### 2. i18n — НЕ требуется

Ключ `hint_readonly` уже существует во всех 3 языках:
- ru: `'Значение рассчитывается автоматически и не редактируется'`
- en: `'Value is calculated automatically and cannot be edited'`
- lt: `'Vertė apskaičiuojama automatiškai ir negali būti redaguojama'`

### 3. CSS — НЕ требуется

Стили `.field-hint` уже существуют в общей таблице стилей.

## Сводка изменений

| Файл | Изменения |
|------|-----------|
| `frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue` | Добавить 5 строк `<span class="field-hint">` под readonly поля |
