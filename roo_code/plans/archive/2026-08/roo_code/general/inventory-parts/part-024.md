# Инвентаризация: roo_code/plans/orders/pricing-section-rework-plan.md

- **Путь:** `roo_code/plans/orders/pricing-section-rework-plan.md`
- **Вердикт:** частично
- **Незакрытых чекбоксов:** 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`)

## Структура плана

План сам объявляет три из четырёх разделов устаревшими:

- Раздел 1 — карточка товара, переименование `field_price` → `field_purchase_price`
  («Закупочная цена» / «Purchase price») + подсказка «Цена за единицу товара при
  закупке». Помечен как актуальный.
- Раздел 2 (карточка заказа: `costPrice`, `vatPercent`, `marginPercent` на заказе),
  раздел 3 (формула `себестоимость × (1+ндс) × (1+маржа) × (1−скидка)`) и заказные
  строки раздела 4 — помечены ⛔ УСТАРЕЛО, «не выполнять», заменены
  `order-pricing-model.md` / `order-pricing-frontend-plan.md`.

То есть единственное живое требование плана — раздел 1.

## Доказательства

### Раздел 1 — НЕ выполнен (переименования нет, эволюция пошла в другую сторону)

```
$ grep -n "field_price\|field_purchase_price\|field_sale_uom\|field_currency\|section_price" frontend_vue/src/i18n/admin/products.ts
21:      section_price: 'Цена',
33:      field_price: 'Цена продажи (по умолчанию)',
37:      field_price_quantity: 'Цена за N единиц',
38:      field_currency: 'Валюта',
39:      field_sale_uom: 'Единица продажи',
288:      section_price: 'Price',
300:      field_price: 'Default sale price',
304:      field_price_quantity: 'Price per N units',
305:      field_currency: 'Currency',
306:      field_sale_uom: 'Sale unit',
556:      section_price: 'Kaina',
568:      field_price: 'Pardavimo kaina (pagal nutylėjimą)',
572:      field_price_quantity: 'Kaina už N vnt.',
573:      field_currency: 'Valiuta',
574:      field_sale_uom: 'Pardavimo vnt.',
```

Ключ `field_purchase_price` в i18n отсутствует вовсе; `field_price` жив под именем
`field_price` и подписан как **цена продажи**, а не закупочная — противоположная
семантика тому, что требовал план. Подсказки («Цена за единицу товара при закупке»)
нет: единственный `*_hint` в ценовой области — отсутствует, есть только
`field_category_hint`, `weight_per_unit_hint`, `dropzone_hint`
(`grep -n "hint" frontend_vue/src/i18n/admin/products.ts`).

```
$ grep -rn "field_price\|field_purchase_price" frontend_vue/src/views/admin/products/ProductCardPage.vue
352:              <InputGroup :label="t('products.field_price')" :required="false">
363:                  :label="t('products.field_price_quantity')"
```

Ценовая секция страницы использует `products.field_price` без подсказки; `field_price_quantity`
и `field_sale_uom` оставлены — это единственное, что совпало с планом, но оставление
поля работой не является.

Закупочная сторона в карточке товара решена иначе — отдельными полями, которых план не
предусматривал:

```
$ grep -n "field_supplier_price\|field_avg_cost_price\|field_avg_sale_price\|purchase_price\|purchasePrice" frontend_vue/src/views/admin/products/ProductCardPage.vue
397:              <InputGroup :label="t('products.field_avg_cost_price')">
411:              <InputGroup :label="t('products.field_avg_sale_price')">
643:                      <th>{{ t('products.field_supplier_price') }}</th>
769:        <InputGroup :label="t('products.field_supplier_price')" :required="false">
```

В i18n рядом с `field_price` живут `field_supplier_price: 'Цена поставщика'`,
`field_avg_cost_price: 'Средняя себестоимость'`, `field_avg_sale_price: 'Средняя цена
продажи'`. Проблема плана («непонятно, закупочная это или продажная») закрыта, но не
его способом: поле уточнили как продажную по умолчанию и добавили отдельные закупочные
и средние цены.

### Разделы 2–4 — устарели по существу, новая модель в коде

```
$ grep -rn "vatPercent\|marginPercent" frontend_vue/src/types/order.ts
103:  marginPercent: number
110:   * change reprices it through `marginPercent`. Never set together with
172:  marginPercent: number
443:  vatPercent: number

$ grep -rn "costPrice\|vatPercent\|marginPercent" frontend_vue/src/composables/useOrderCard.ts
112:  vatPercent: number
123:  'vatPercent',
147:    vatPercent: settings.constants.vatRate,
283:      if (Number.isNaN(val.vatPercent)) val.vatPercent = 0
357:  const totals = computed(() => rollupOrder(lines.value, form.value.vatMode, form.value.vatPercent))
362:    const rolled = rollupOrder(lines.value, form.value.vatMode, form.value.vatPercent)
392:        vatPercent: order.value.vatPercent,
840:    return round2(netToGross(net, form.value.vatMode, form.value.vatPercent))
1483:    const priceBefore = line.unitCost * (1 + line.marginPercent / 100)
1507:      line.marginPercent = marginFor(line.unitCost, priceBefore)
1668:    const targetNet = grossToNet(targetGross, form.value.vatMode, form.value.vatPercent)
1675:      achievedGross: achievableGross(targetGross, form.value.vatMode, form.value.vatPercent)...
1813:      { field: 'marginPercent', value: form.value.defaultMarginPercent },
1863:      after: rollupOrder(after, form.value.vatMode, form.value.vatPercent).totalGross,
```

`marginPercent` — на строке (`line.marginPercent`), `vatPercent` — на заказе вместе с
`vatMode`, `costPrice` в форме заказа отсутствует. Это ровно то, что план описывает как
действующую модель вместо своих разделов 2–3: расчёт идёт через `rollupOrder`,
`netToGross`/`grossToNet`, а не по формуле раздела 3. Требований этих разделов выполнять
не нужно, и они не выполнены — согласованно.

## Что осталось

Открыт один пункт — раздел 1:

- ключ `field_price` не переименован в `field_purchase_price`, подписи остались
  «Цена продажи (по умолчанию)» / «Default sale price» / «Pardavimo kaina»;
- подсказка «Цена за единицу товара при закупке» не добавлена ни в i18n, ни в шаблон.

Прежде чем делать: требование раздела 1 конфликтует с тем, как код развился. `field_price`
сейчас осознанно **продажная** цена по умолчанию, а закупочная сторона представлена
`field_supplier_price` и `field_avg_cost_price`. Переименовать `field_price` в
«Закупочная цена» — значит соврать про поле. Раздел 1 стоит считать устаревшим наравне с
разделами 2–4 и закрыть план, а не исполнять буквально.

## Пункты

| Пункт | Вердикт | Доказательство |
|---|---|---|
| Раздел 1: `field_price` → `field_purchase_price` (Закупочная цена / Purchase price) | не начато | `grep` по `frontend_vue/src/i18n/admin/products.ts`: ключа `field_purchase_price` нет; `field_price: 'Цена продажи (по умолчанию)'` (стр. 33), `'Default sale price'` (300) |
| Раздел 1: подсказка «Цена за единицу товара при закупке» | не начато | `grep -n "hint" frontend_vue/src/i18n/admin/products.ts` → только `field_category_hint`, `weight_per_unit_hint`, `dropzone_hint` |
| Раздел 1: `field_price_quantity` оставить | сделано | `ProductCardPage.vue:363` использует `products.field_price_quantity` |
| Раздел 1: `field_sale_uom` оставить | сделано | `frontend_vue/src/i18n/admin/products.ts:39,306,574` — ключ жив, используется в ценовой секции страницы |
| Раздел 2 (`costPrice`/`vatPercent`/`marginPercent` на заказе, реструктуризация секции) | не начато (устарело по плану) | `useOrderCard.ts` не содержит `costPrice`; `marginPercent` живёт на строке (`line.marginPercent`, стр. 1483/1507) |
| Раздел 3 (формула `× (1+ндс) × (1+маржа) × (1−скидка)`) | не начато (устарело по плану) | расчёт идёт через `rollupOrder`/`netToGross`/`grossToNet` — `useOrderCard.ts:357,840,1668` |
| Раздел 4: мок-заказы получают `vatPercent`/`marginPercent` заказа | непонятно / устарело | заказная часть раздела 4 помечена устаревшей самим планом вместе с разделом 2 |
