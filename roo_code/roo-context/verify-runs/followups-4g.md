# Пункт 4g — имена формул пересчёта: один типизированный союз вместо трёх словарей

План: [`review-followups.md` § 4g](../../plans/general/review-followups.md)
Прогон: 2026-08-27, автономный. Отметку ✅ в плане ставит не автор правки.

---

## 1. Воспроизведение

Все четыре факта пункта проверены грепом ДО единой правки.

**(а) Союз знает три имени и живёт в двух местах:**

```
$ grep -rn "ConversionFormulaType" src/ tests/
src/types/settings.ts:46:export type ConversionFormulaType = 'weight_per_meter' | 'area_to_weight' | 'pcs_to_weight'
src/types/settings.ts:63:  formulaType?: ConversionFormulaType
```

**(б) У товара — свободная строка, и в сидах имена не из союза:**

```
$ grep -rn "FormulaType" src/ tests/     # вывод сгруппирован по файлам: 46 строк сидов с
                                         # `: null,` не перечислены поштучно
src/types/product.ts:69:  purchaseToWarehouseFormulaType: string | null
src/types/product.ts:71:  warehouseToSaleFormulaType: string | null
src/composables/useProductCard.ts:29,31        (ProductForm — тоже string | null)
src/composables/useProductCard.ts:280,295      form.value.*FormulaType = 'static'
src/services/productsService.ts:41,43          createProduct — string | null
src/services/mocks/products.ts:14002,14129     mockCreateProduct / mockPatchProduct — string | null
src/services/mocks/products.ts:49              purchaseToWarehouseFormulaType: 'weight_per_unit'
src/services/mocks/products.ts:288,290         purchaseToWarehouse/warehouseToSale: 'static'
```

`weight_per_unit` нет ни в одном справочнике; `static` — имя из **другого** союза
(`ConversionType = 'static' | 'dynamic'`), то есть в поле формулы оно значило «формулы нет».
Писал его `useProductCard`, когда подставлял коэффициент, а `findConversionFactor`
(`useProductCard.ts:155-163`) берёт коэффициент **только у статических** правил справочника.

**(в) Мёртвые ключи перевода:**

```
$ grep -rn "conversion_formula" src/ tests/
src/i18n/admin/products.ts:45-48   (ru), :312-315 (en), :580-583 (lt)   — и больше нигде
$ grep -rn "products\.\${\|\`products\." src/ tests/
(пусто — ключ `products.*` нигде не собирается строкой)
```

То есть ни статического потребителя, ни динамического: ветка отображения не появилась. Вместе
с тремя именами мёртв и заголовок `conversion_formula: 'Формула'` — по тому же тесту. Так же
поступил прецедент `70c7463`: там вместе с тремя `price_unit_*` удалён и осиротевший
`field_price_unit`.

**(г) Имена формул рисуются только из набора, совпадающего с типом:**

```
$ grep -rn "formula_" src/ | grep -v conversion_formula
src/i18n/admin/settings.ts:161-163, 384-386, 607-609   (ru/en/lt — три имени)
src/views/admin/settings/UnitsSettings.vue:35          t(`settingsUom.formula_${formulaType}`)
src/views/admin/settings/SettingsLayout.vue:267-269    список из трёх литералов
```

Уточнение к пункту: рисует **два** экрана, а не один — `UnitsSettings.vue` (подпись строки
таблицы) и `SettingsLayout.vue` (варианты селекта). Оба берут `settingsUom.formula_*`.

**Вывод: воспроизводится полностью.**

---

## 2. Что сделано

Один список — `CONVERSION_FORMULA_TYPES` в `src/types/settings.ts`; тип выводится из него,
а не наоборот. Рядом — предикат `isConversionFormulaType()` для строк, приходящих из формы.

| Файл | Было | Стало |
|---|---|---|
| `src/types/settings.ts` | союз литералов | рантаймовый `CONVERSION_FORMULA_TYPES` + выведенный тип + предикат |
| `src/types/product.ts` | `*FormulaType: string \| null` | `ConversionFormulaType \| null` |
| `src/composables/useProductCard.ts` | `ProductForm` — `string \| null`; `= 'static'` | тип из союза; `= null` (коэффициент есть — формулы нет) |
| `src/services/productsService.ts` | `createProduct` — `string \| null` | `ConversionFormulaType \| null` |
| `src/services/mocks/products.ts` | сигнатуры `string \| null`; сиды `'weight_per_unit'`, `'static'` ×2 | сигнатуры из союза; `'pcs_to_weight'`, `null` ×2 |
| `src/views/admin/settings/SettingsLayout.vue` | `formulaType: string`, каст `as UomConversion['formulaType']`, три литерала в опциях | `ConversionFormulaType \| ''`, опции из `CONVERSION_FORMULA_TYPES`, каст заменён проверкой |
| `src/views/admin/settings/UnitsSettings.vue` | параметр `string` + запасная ветка «ключ не нашёлся» | параметр из союза, ветка не нужна |
| `src/i18n/admin/products.ts` | 4 мёртвых ключа × 3 локали | удалены (12 строк) |
| `src/types/conversionFormula.spec.ts` | — | новый: подпись есть у каждого имени во всех локалях; свободная строка не проходит за имя |

**Два решения, которые пункт оставлял на реализацию, и почему так:**

1. `'weight_per_unit'` → `'pcs_to_weight'`. Это одна и та же формула под двумя именами:
   удаляемый перевод звал её «Вес единицы (шт→кг)», живой зовёт «Штуки → Вес (шт × кг/шт)».
   Заменять на `null` было бы стиранием единственного динамического примера в сидах.
2. `'static'` → `null`. `static` — значение `ConversionType`, и в поле формулы оно значило
   «формулы нет, пересчёт коэффициентом». Ровно это и означает `null`: у прочих
   семнадцати сидов формула `null` при заданных коэффициентах. Добавлять `'static'` в союз
   нельзя — тогда два союза снова смешаются, а у `UomConversion` статичность уже записана
   в `type`.

Читателей у этих полей, кроме формы карточки и payload'а PATCH, нет (грепы выше), поэтому
смена значения ничего на экране не меняет.

---

## 3. Приёмка

```
$ cd frontend_vue && npm run verify        # typecheck · lint · dupes · format:check · test:unit
exit=0
All matched files use Prettier code style!
 Test Files  25 passed (25)
      Tests  580 passed (580)

$ npm run test:audit                        # тронут src/services/mocks/products.ts
exit=0
 Test Files  22 passed (22)
      Tests  97 passed (97)

$ npx vite build                            # шаблон SettingsLayout правился — питфолл #67
exit=0  ✓ built in 8.11s

$ npx playwright test tests/e2e/admin/settings/settings.spec.ts \
                     tests/e2e/admin/products/products.spec.ts --reporter=line
exit=0
81 passed (1.8m)
```

E2E — уровень 1 по `verify.md`: правка лежит в двух областях (справочник единиц и карточка
товара), общего пола не касается.

---

## 4. Линзы

| Линза | Чем проверял | Что вернулось | Вывод |
|---|---|---|---|
| Л1 | `grep -n "structuredClone\|toRaw(\|useHead(" src/composables/useProductCard.ts` | 0 вхождений | новых вотчеров нет, правка — присваивание внутри существующего; чисто |
| Л2 | скрипт сверки наборов ключей `ru/en/lt` в `src/i18n/admin/products.ts` | `ru 257 · en 257 · lt 257`, наборы равны | удаление симметрично по локалям |
| Л2 | `grep -c "formula_<имя>:" src/i18n/admin/settings.ts` для трёх имён | по 3 (ru/en/lt) | динамический ключ `settingsUom.formula_*` резолвится всегда; закреплено спекой |
| Л3 | `grep -n "formulaType" roo_code/roo-context/03-api-contract.md` | строки 2005, 2264, 2279, 2293 — `formulaType?: ConversionFormulaType` | контракт уже описывает поле союзом, правки не требует |
| Л3 | `grep -n "purchaseToWarehouse\|warehouseToSale" roo_code/roo-context/03-api-contract.md` | пусто | **припарковано** (см. §5): полей конверсии товара в контракте нет вовсе — пробел старше этого пункта |
| Л4 | typecheck по `STORE: Product[]` + инверсия | возврат `'weight_per_unit'` даёт `TS2322` | сид больше не может назвать формулу именем, которого нет |
| Л5 | `grep -rn "weight_per_meter\|area_to_weight\|pcs_to_weight" src/ tests/` | единственное перечисление — `src/types/settings.ts:56-58`; остальное — подписи в i18n, значения в сидах и опции, собранные из этого же массива | второй реализации списка нет |
| Л6 | `npx vite build` + чтение диффа шаблона | exit 0; обработчик `@update:model-value` — вызов одной функции | питфолл #67 соблюдён, `CustomSelect` используется как прежде |
| Л7 | `git diff --stat` | роутер, флаги, права не тронуты | вне области |
| Л8 | чтение `save()`/`useDirtyCheck` + e2e | `'static'` больше не попадает в delta; при смене единиц устаревшее имя формулы затирается `null` | потери данных нет: поле было и остаётся необязательным |
| Л9 | `grep -rn "await page.waitForLoadState" tests/` | 0 | регресса нет |
| Л9 | инверсии новой спеки (ниже) | обе краснеют | утверждения настоящие |
| Л10 | `npx vite build`, `npm run verify` | exit 0 | i18n-индекс, роутер, типы согласованы |

### Инверсии (Л9 — обязательны, тесты тронуты)

Спека новая, поэтому инверсия на каждое утверждение:

```
1) Убрал 'formula_pcs_to_weight' из ru-блока src/i18n/admin/settings.ts
$ npx vitest run src/types/conversionFormula.spec.ts
 Tests  1 failed | 4 passed        ← «каждое имя формулы подписано в локали ru»
(файл восстановлен из копии, grep снова даёт 3 вхождения)

2) Дописал 'weight_per_unit' в CONVERSION_FORMULA_TYPES
$ npx vitest run src/types/conversionFormula.spec.ts
 Tests  4 failed | 1 passed        ← «свободная строка не проходит за имя формулы» + подписи
(союз возвращён к трём именам)

3) Инверсия типового гейта: вернул 'weight_per_unit' в сид prod-001
$ npm run typecheck
src/services/mocks/products.ts(50,5): error TS2322: Type '"weight_per_unit"' is not
assignable to type '"weight_per_meter" | "area_to_weight" | "pcs_to_weight" | null'.
```

Третья инверсия важнее первых двух: она доказывает, что типизация полей товара —
настоящий гейт, а не комментарий.

---

## 5. Припарковано (вне области пункта)

- **Л3, `03-api-contract.md` § `PATCH /api/products/:id`** — в теле запроса перечислены
  только `name/sku/description/price/minStock/fieldValues/linkedSuppliers`. Полей единиц и
  конверсии (`purchaseUomId`, `warehouseUomId`, `saleUomId`, `*FormulaType`, `*Factor`,
  `priceQuantity`, `currencyId`, `weightPerWarehouseUnitKg`) там нет ни одного — при том что
  клиент их шлёт. Пробел появился с перестройкой единиц (`product-uom-restructure-plan.md`) и
  к именам формул не сводится, поэтому в 4g не чинится. Свип это не пачкает.

---

## 6. Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 4g
Итераций: 1 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK · format OK · unit 580 OK
                   test:audit 97 OK · vite build OK · e2e ур. 1 — 81 passed
Линзы:             Л1–Л10 подтверждены
Найдено за прогон: 1       Починено: 0      Отклонено: 0
Припарковано:      1 — пробел контракта по PATCH /api/products/:id
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
