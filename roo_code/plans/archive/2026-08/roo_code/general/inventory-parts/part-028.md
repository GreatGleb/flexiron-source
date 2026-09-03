# Инвентаризация: roo_code/plans/products/uom-restructure-completion-plan.md

**Вердикт: частично**
**Незакрытых чекбоксов в плане: 23** (`grep -c "^[[:space:]]*- \[ \]"` → 23)

## Что есть, чего нет

Шаги 1, 2 и 5 (кроме одного пункта) реализованы. Шаг 3 (конвертация при создании
движения) не начат. Шаг 4 сделан наполовину: маржа и цена продажи за складскую
единицу есть, цены за единицу продажи и цены из карточки товара в карточке партии нет.

### Доказательства

**Шаг 1 — мок с 3 UoM: сделано**

```
$ grep -n "purchaseToWarehouseFactor\|warehouseToSaleFactor" src/services/mocks/products.ts | sed -n '5,6p'
src/services/mocks/products.ts:292:    purchaseToWarehouseFactor: 0.001,
src/services/mocks/products.ts:294:    warehouseToSaleFactor: 1000,

$ sed -n 270,295p src/services/mocks/products.ts
    id: 'prod-003',
    name: { ru: 'Стальная труба 60x4', ... }
    ...
    // 3 different UoMs: purchase=kg, warehouse=t, sale=kg
    saleUomId: 'uom-kg',
    warehouseUomId: 'uom-t',
    purchaseUomId: 'uom-kg',
    purchaseToWarehouseFormulaType: 'static',
    purchaseToWarehouseFactor: 0.001,
    warehouseToSaleFormulaType: 'static',
    warehouseToSaleFactor: 1000,

$ grep -n "prod-003\|whb-075" src/mocks/warehouse-batches.ts
121:  // ── prod-003: Стальная труба 60x4 (3 UoM demo) ──
124:    id: 'whb-075',
125:    productId: 'prod-003',
163:    productId: 'prod-003',   (whb-076)
```
whb-075: `quantity: 10`, `unit: 't'`, `receivedQuantity: 10000`, `receivedUnitId: 'uom-kg'`,
`purchaseToWarehouseRate: 0.001`. whb-076: `quantity: 8`, `unit: 't'`. Обе партии в тоннах.

**Шаг 2 — конвертация продажи в AddOrderItemsModal: сделано**

```
$ grep -n "saleUom\|warehouseUom\|StockOverview\|warehouseQty" src/views/admin/orders/AddOrderItemsModal.vue
5:import { getStockOverview, getBatchCostBreakdown } from '@/services/warehouseService'
11:import type { StockOverviewItem } from '@/types/warehouse'
88:const stockMap = ref<Map<string, StockOverviewItem>>(new Map())
106:function getAvailableInSaleUoM(product: ProductListItem): { qty: number; label: string } | null
116:    const saleQty = warehouseQty * product.warehouseToSaleFactor
121:      label: `${saleQty.toFixed(2)} ${saleUomCode} (${warehouseQty.toFixed(2)} ${warehouseUomCode} × ${product.warehouseToSaleFactor})`,
133:function saleQtyToWarehouseQty(product, saleQty) { ... return saleQty / product.warehouseToSaleFactor }
201:  warehouseQty: number            (SelectedOrderItem)
245:      warehouseQty: saleQtyToWarehouseQty(product, saleQty),
418:        item.warehouseQty = saleQtyToWarehouseQty(product, qty)
514:        warehouseQty: item.warehouseQty,     (в emit 'add')
605-610: колонка наличия в шаблоне через getAvailableInSaleUoM
```
Цена берётся из `product.price` (`priceFor`, строка 434), единица строки — `getProductUnit`
по `saleUomId` (строка 150). Поля в загрузке есть: `src/types/product.ts:41-43`
(`ProductListItem.saleUomId/warehouseUomId/warehouseToSaleFactor`), маппинг —
`src/services/productsService.ts:39-44,73-78`.

**Шаг 3 — конвертация при создании движения: не начато**

```
$ grep -rn "warehouseToSaleFactor" src/views/admin/warehouse/ src/composables/
src/composables/useProductCard.ts:32,64,75,82,186,202,240,290,294   — только карточка товара
```
В `CreateMovementModal.vue` (852 строки) нет ни `warehouseToSaleFactor`, ни `saleUom`,
ни какой-либо конвертации; `onSave` (строки 496–527) кладёт `quantity: quantity.value`
как есть. Количество вводится и подписывается складской единицей партии
(`props.batch.unit`, строки 235–240, 572, 621) — то есть движение и так в складской UoM,
но пути «из единицы продажи» не существует. `MovementCreatePayload`
(`src/types/warehouse.ts:356-371`) полей конвертации не имеет. Ссылочные поля
`referenceId`/`referenceType` общие и были раньше; в списке типов есть `'sale'`
(строка 433), привязки к id заказа нет — единственное упоминание заказа в моке
движений: `src/mocks/warehouse-movements.ts:2301: referenceId: 'ORD-2025-010'`.

**Шаг 4 — маржа и цена продажи в карточке партии: частично**

```
$ grep -rn "marginPercent\|sellingPrice" src/types/warehouse.ts src/views/admin/warehouse/WarehouseBatchCard.vue src/composables/useWarehouseBatch.ts
src/types/warehouse.ts:118: /** Profit margin percent (editable, default from settings.constants.defaultMargin) */
src/types/warehouse.ts:119:  marginPercent: number | null
src/composables/useWarehouseBatch.ts:104,119,207,285,315   — форма + дефолт settings.constants.defaultMargin
src/views/admin/warehouse/WarehouseBatchCard.vue:69: const sellingPrice = computed(...unitPrice * (1 + margin / 100))
src/views/admin/warehouse/WarehouseBatchCard.vue:76: const totalSellingValue = ...
src/views/admin/warehouse/WarehouseBatchCard.vue:845: v-model.number="form.marginPercent"
src/views/admin/warehouse/WarehouseBatchCard.vue:879: sellingPrice (readonly-поле)
```
Есть: `marginPercent` в типе, редактируемое поле маржи (`data-test="field-margin-percent"`),
`sellingPrice` за складскую UoM (`field-selling-price`), `field-total-cost`,
`field-total-selling-value`, дефолт из настроек (`src/services/mocks/settings.ts:29:
defaultMargin: 15`). Сохранение работает: `marginPercent` в форме под dirty-трекингом,
`delta = dirty.diff()` уходит в `patchBatch`, мок делает `Object.assign(batch, delta)`
(`src/services/mocks/warehouse.ts:738`) — но в `BatchPatchPayload`
(`src/types/warehouse.ts:188-202`) поля `marginPercent` нет, оно проходит через каст.

Нет: `sellingPricePerSaleUoM` — грепом по проекту ноль совпадений; поля «цена продажи
за единицу продажи» и «цена из карточки товара (readonly)» в карточке партии
отсутствуют (`grep -n "product_price\|product\.price\|saleUom" WarehouseBatchCard.vue
useWarehouseBatch.ts` → пусто; в i18n ключей `field_product_price` /
`selling_price_per` тоже нет).

**Шаг 5 — проверка API: частично**

```
$ grep -rn "api/products" backend/app --include=*.py | grep prefix
backend/app/modules/products/features/get_product_detail/action.py:25:router = APIRouter(prefix="/api/products", ...)
backend/app/modules/products/features/create_product/action.py:20:router = APIRouter(prefix="/api/products", ...)
$ ls backend/app/modules/products/features/
create_product  get_product_detail  __init__.py
```
Списочного `GET /api/products` в бэкенде нет вовсе — только `GET /api/products/{id}`
и `POST /api/products`. Деталь отдаёт нужное:
`get_product_detail/schemas.py:35 price_unit`, `:41-43 purchase_uom_id / warehouse_uom_id /
sale_uom_id`; реконструкция — `get_product_detail/domain.py:26 _reconstruct_price_unit`,
`:76-93`.

```
$ npm run typecheck
> vue-tsc --noEmit
(без ошибок)
```

## Осталось сделать
- Шаг 3 целиком: конвертация `warehouseQty = saleQty / warehouseToSaleFactor` при
  расходном/продажном движении, привязка движения к id заказа, поля конвертации в
  `MovementCreatePayload`.
- Шаг 4: `sellingPricePerSaleUoM`, отображение цены продажи за единицу продажи и цены
  из карточки товара; по желанию — `marginPercent` в `BatchPatchPayload`.
- Шаг 5: списочный `GET /api/products` (эндпоинта нет — проверять нечего).

## Пункты плана

| № | Пункт | Вердикт |
|---|---|---|
| 1 | Шаг 1: prod-003 с тремя UoM (purchase=kg, warehouse=t, sale=kg, факторы 0.001 / 1000) | сделано |
| 2 | Шаг 1: партии prod-003 в тоннах, whb-075 на 10 t | сделано |
| 3 | Шаг 1: существующие партии prod-003 перевести в тонны | сделано |
| 4 | Шаг 2: загрузить StockOverviewItem по каждому товару | сделано |
| 5 | Шаг 2: конвертировать наличие при warehouseUomId !== saleUomId | сделано |
| 6 | Шаг 2: показать конвертированное наличие с расшифровкой | сделано |
| 7 | Шаг 2: поле количества остаётся в saleUoM | сделано |
| 8 | Шаг 2: цена за saleUoM из product.price | сделано |
| 9 | Шаг 2: хранить и sale qty, и складское количество | сделано |
| 10 | Шаг 2: saleUomId / warehouseUomId / warehouseToSaleFactor в загрузке товара | сделано |
| 11 | Шаг 3: конвертация warehouseQty = saleQty / factor для расхода/продажи | не начато |
| 12 | Шаг 3: движение создаётся/хранится в warehouseUoM | частично |
| 13 | Шаг 3: ссылка на id заказа в reference-полях движения | частично |
| 14 | Шаг 3: обновить MovementCreatePayload под данные конвертации | не начато |
| 15 | Шаг 4: marginPercent в типе WarehouseBatch, дефолт из настроек | сделано |
| 16 | Шаг 4: computed sellingPrice = unitPrice × (1 + margin/100) | сделано |
| 17 | Шаг 4: computed sellingPricePerSaleUoM = sellingPrice / factor | не начато |
| 18 | Шаг 4: шесть полей в карточке партии (закупка, маржа, цена продажи, цена за единицу продажи, цена из карточки товара, итого себестоимость) | частично |
| 19 | Шаг 4: сохранение marginPercent при обновлении партии | сделано |
| 20 | Шаг 5: GET /api/products отдаёт sale_uom_id / warehouse_uom_id / purchase_uom_id | не начато |
| 21 | Шаг 5: GET /api/products/:id отдаёт price_unit + новые UoM-поля | сделано |
| 22 | Шаг 5: ответы мок-API совпадают с типами фронтенда | сделано |
| 23 | Шаг 5: прогнать build / type-check без ошибок типов | сделано |
