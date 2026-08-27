# Пункт 4e — имя товара перестало храниться в партии, обрезке и движении

План: [`review-followups.md` § 4e](../../plans/general/review-followups.md)
Прогон: 2026-08-27, автономный. Отметку ✅ в плане ставит не автор правки.

---

## 1. Воспроизведение

Пункт назван цифрами, поэтому и воспроизведён цифрами: временной спекой, прочитавшей все
три сида и каталог товаров разом. Замер сделан ДО единой правки.

```
$ npx vitest run src/__tmp4e.spec.ts   # временная спека, удалена после замера
batches: 100 offcuts: 13 movements: 98 products: 114

BATCH name mismatch: 92/100
whb-006 (prod-020): batch="Фанера 10мм 1525x1525" catalog="Титановый лист 2мм Grade 5"
whb-088 (prod-012): batch="Арматура 12мм"          catalog="Стальной лист S235 2мм 1250×2500"
whb-077 (prod-004): batch="Труба стальная 50мм"    catalog="Стальная труба 100x5"
… (89 строк опущено)

OFFCUT ref mismatch: 10/13; name mismatch: 13/13
who-002: batch=whb-004(prod-009) offcut.productId=prod-001 refBad=true nameBad=true
who-007: batch=whb-008(prod-021) offcut.productId=prod-013 refBad=true nameBad=true
…

MOVEMENT ref mismatch: 80/98; name mismatch: 96/98
whb-027 -> prod-027 vs batch prod-032
whb-005 -> prod-005 vs batch prod-009
…
```

Совпадает с пунктом дословно: `prod-012` зовётся тремя разными именами, десять обрезков из
тринадцати висят на партии чужого товара, у одиннадцати (замер дал тринадцать — считались все
три локали) расходится имя. Плюс цифра, которую пункт просил снять при взятии: **92 партии из
100** называют себя не тем товаром, на который ссылаются.

Кроме того найден механизм, которого в пункте нет и который делает картину хуже: в
`src/services/mocks/warehouse.ts` уже стоял `_resolveProductName(entity)`, переписывавший
`productName` партии и движения из каталога при сборке стора.

```
$ git show HEAD:frontend_vue/src/services/mocks/warehouse.ts | grep -n "_resolveProductName"
121:function _resolveProductName(entity: { productId: string; productName: TranslatedString }): void {
174:  _resolveProductName(b)
181:  _resolveProductName(m)
```

То есть копию **чинили**, а не убирали — ровно то, что пункт запрещает («перестаёт
существовать как хранимое поле, а не „исправляется“»). Хуже: у движения кривой была сама
ССЫЛКА, и почин­ка имени по ней делала строку правдоподобной — журнал показывал имя товара,
которого в его партии нет.

Обрезкам такой починки не досталось вовсе: `_resolveProductName` их не трогал.

Вывод: воспроизводится полностью.

---

## 2. Что сделано

**Величина убрана, а не выровнена.** `productName` удалён из шести интерфейсов
`src/types/warehouse.ts`: `WarehouseBatch`, `BatchListItem`, `WarehouseOffcut`,
`OffcutListItem`, `WarehouseMovement`, `MovementListItem`. Из сидов удалено 100 + 13 + 98
вхождений.

**Ссылки приведены в согласие.** `offcut.productId` и `movement.productId` переставлены на
`productId` их партии — 13 и 98 записей. `offcut.categoryId` переставлен туда же (категория
товара партии): поле лежит в той же записи и после переезда ссылки указывало бы на категорию
уже другого товара.

**Разойтись больше негде.** `productId` убран из `OffcutCreatePayload`: `mockCreateOffcut`
берёт товар у партии. Раньше payload нёс свой `productId`, а `productName` копировался из
партии — то есть расхождение было заложено в конструкцию.

**Подпись собирается на месте показа.** Новые `src/domain/product.ts` (`productLabel`) и
`src/composables/useProductNames.ts` — тем же образцом, что `unitLabel` + `useUnitLabel`
из п. 4c/4d. Справочник тянет `GET /api/products/list` (`getProductList`, до сих пор был в
реестре «клиент написан, UI нет»), один раз на сессию, модульным синглтоном.

Загрузчики склада ждут справочник **вместе** со своими данными
(`Promise.all([getBatches(...), ensureProductNames()])`) — в `useWarehouse` (три вкладки),
`useWarehouseBatch`, `useWarehouseOffcutCard`, `useWarehouseMovementCard`,
`useWarehouseCutting`. Иначе строка обгоняет справочник и показывает прочерк, а потом
дёргается.

**Поиск и сортировка по имени остались серверными** — это join по `productId`, а не поле:
`_productName` / `_matchesProductName` / `_compareProductName` в моке, по одной реализации
правила на три списка. `_resolveProductName` удалён.

**Контракт дописан** (`03-api-contract.md`): `productName` убран из примеров ответов партии
и движения, `productId` — из payload резки; добавлены два пункта в раздел типов склада;
`GET /api/products/list` вынут из реестра «UI нет».

### Файлы

```
src/types/warehouse.ts
src/domain/product.ts                                   (новый)
src/domain/product.spec.ts                              (новый)
src/composables/useProductNames.ts                      (новый)
src/services/mocks/warehouse-product-reference.spec.ts  (новый)
src/mocks/warehouse-batches.ts
src/mocks/warehouse-offcuts.ts
src/mocks/warehouse-movements.ts
src/services/mocks/warehouse.ts
src/services/mocks/cutting.spec.ts
src/services/mocks/warehouse-transfer-location.spec.ts
src/composables/useWarehouse.ts
src/composables/useWarehouseBatch.ts
src/composables/useWarehouseCutting.ts
src/composables/useWarehouseMovementCard.ts
src/composables/useWarehouseOffcutCard.ts
src/composables/useWarehouseOffcutCreate.ts
src/views/admin/warehouse/WarehousePage.vue
src/views/admin/warehouse/WarehouseBatchCard.vue
src/views/admin/warehouse/WarehouseOffcutCard.vue
src/views/admin/warehouse/WarehouseMovementCard.vue
src/views/admin/warehouse/WarehouseCuttingPage.vue
roo_code/roo-context/03-api-contract.md
```

---

## 3. Пять дискриминаторов — проверка починки на ней самой

Пункт требует: после починки ссылок выведенный вес обязан сойтись **с одной из сторон**
таблицы; не сойдётся ни с одной — починка неверна. Замер на починенном дереве:

```
обрезок | хранимый вес | выведенный                 | товар ПАРТИИ
who-001 | 2.36         | 2.355   (geometry)         | prod-001 Steel Sheet 3mm
who-005 | 2.92         | 4.7844  (geometry)         | prod-020 Titanium Sheet 2mm Grade 5
who-011 | 3.28         | 5.38245 (geometry)         | prod-020 Titanium Sheet 2mm Grade 5
who-006 | 9.24         | 17.565  (per-unit-weight)  | prod-004 Steel Pipe 100x5
who-012 | 18.48        | 35.13   (per-unit-weight)  | prod-004 Steel Pipe 100x5
who-007 | 3.15         | 0.864   (per-unit-weight)  | prod-021 Steel Pipe 20x2.5
```

Все шесть попали в колонку «выводится по ссылке» таблицы пункта — 2.355, 4.78, 5.38, 17.565,
35.13, 0.864 — до знака. То есть ссылка теперь ведёт туда, куда пункт и предсказывал.

Три «врущие толщины» (who-001, who-005, who-011) **не чинились** — пункт прямо это
запрещает: гадать, какая из трёх правд верна, нельзя. Расхождение хранимого веса с выведенным
осталось видимым и осталось задачей.

Механизм вывода веса при этом не менялся: `resolveOffcutWeight` брал товар ПАРТИИ ещё до этого
пункта (комментарий в `src/domain/cutting.ts` на п. 4e и ссылается). Значит цифры выше —
подтверждение, а не следствие правки.

---

## 4. Приёмка

Итерация 1 — единственная, свип чистый.

```
$ npm run verify
> typecheck   vue-tsc --noEmit                       exit 0
> lint        eslint src/ tests/ *.ts --max-warnings=0   exit 0
> dupes       jscpd src                              Found 681 clones · 9.39 % (порог 10 %)
> format:check prettier --check src/ tests/          All matched files use Prettier code style!
> test:unit   vitest run                             24 файла, 575 тестов — passed
exit=0
```

```
$ npm run test:audit
 Test Files  22 passed (22)
      Tests  97 passed (97)
exit=0
```

```
$ npx vite build          # компилятор шаблонов, питфолл #67
✓ built in 8.55s
exit=0
```

E2E, уровень 1 (правка в одной области — вкладки склада, три карточки, страница резки; плюс
те, кто читает тот же мок: заказы, лента логов, дашборд):

```
$ npx playwright test tests/e2e/admin/warehouse tests/e2e/admin/analytics/warehouse.spec.ts \
    tests/e2e/admin/analytics/deficit.spec.ts tests/e2e/admin/analytics/supply.spec.ts \
    --reporter=line --workers=3
  167 passed (3.0m)      exit=0

$ npx playwright test tests/e2e/admin/orders tests/e2e/admin/settings \
    tests/e2e/admin/analytics/dashboard.spec.ts --reporter=line --workers=3
  174 passed (3.5m)      exit=0
```

### Линзы

**Л1 — реактивность.**
```
$ grep -n "structuredClone\|toRaw(\|useHead(\|watch(" <13 тронутых файлов>
```
Ни `structuredClone`, ни `toRaw` не добавлено. `useHead` в трёх карточках берёт геттер
`() => pageTitle.value`, а `pageTitle` — `computed`, внутри которого зовётся
`productName(id)`; тот читает `products.value` (модульный `ref`) и `locale.value`, то есть обе
зависимости регистрируются эффектом computed. Смена языка и приход справочника перерисовывают
и заголовок, и ячейки. `ensureProductNames` вынесен из `useProductNames` отдельным экспортом
намеренно: он не зовёт `useI18n()` и потому вызывается из композаблов вне setup-контекста.

**Л2 — i18n.** Новых ключей нет. Параметр `{productName}` у `offcut_card_title`,
`movement_card_title` присутствует во всех трёх локалях (строки 459/470, 1131/1143,
1803/1814 в `src/i18n/admin/warehouse.ts`) и по-прежнему заполняется — значением
`productName(id)` вместо `tf(...)`. Счётчики ключей по локалям сошлись во всех 16 доменах
(`ru == en == lt`). Сырых точечных ключей в DOM тронутых шаблонов нет. Побочно: из моков ушло
211 русских строк `productName` — питфолл #33 стало меньше, а не больше.

**Л3 — контракт и HTTP.** Новый вызов один — `GET /api/products/list`; мок для него есть
(`src/services/mocks/index.ts:437`), метод GET по смыслу (чтение справочника). Контракт
дописан (см. §2). Формы ответов партии/движения и payload резки приведены в соответствие с
типами.

**Л4 — мок = правда.** Согласие сидов теперь проверяется машиной, а не глазами —
`warehouse-product-reference.spec.ts`: ноль обрезков и ноль движений с чужим товаром, ноль
висячих ссылок на несуществующий товар. Замер после правки:
```
offcut.productId != batch.productId: 0
movement.productId != batch.productId: 0
висячих ссылок: 0
```

**Л5 — один источник.**
```
$ grep -rn "\.find((p) => p.id ===\|products.value.find" src/ --include=*.ts --include=*.vue | grep -v spec
```
Правило «имя товара по id» теперь записано один раз на каждой стороне провода:
`productLabel` (клиент, выбор локали) и `_productName`/`_matchesProductName`/
`_compareProductName` (мок, поиск и сортировка). Вторых реализаций подписи не осталось.
Машинная часть: `npm run dupes` 9.39 % при пороге 10, sonarjs внутри `lint` — чисто.

**Л6 — UI и CSS.** Правка узел-в-узел: `{{ tf(x.productName) }}` → `{{ productName(x.productId) }}`.
Ни классов, ни элементов, ни `:title` не тронуто; `data-test="field-product-name"` на месте.
Многооператорных inline-обработчиков не появилось (питфолл #67) — сборка это и подтверждает.

**Л7 — права, флаги, роутинг.** `git diff --stat -- src/router src/config/featureFlags.ts
tests/e2e/helpers/flags.ts` пуст.

**Л8 — сохранение и потеря данных.** Изменился один поток — создание обрезка. Валидация
`!form.batchId || !form.productId` стала `!form.batchId || !selectedProductId.value`; раньше
`form.productId` заполнялся тем же вотчером из `selectedProductId`, то есть условие
эквивалентно, а в тик до срабатывания вотчера — строже. Ничего не сохраняется раньше Save,
`load()` несохранённое не трогает.

**Л9 — тесты, которые ничего не утверждают.** Машинная часть:
`grep -rn "await page.waitForLoadState" tests/` — пусто (exit 1).
Инверсии, по одной на утверждение (все пять сломали код и покраснели, откат вернул зелёное):

| # | что сломано | что покраснело |
|---|---|---|
| И1 | `who-001.productId` → `prod-004` | «у каждого обрезка товар тот же, что у его партии»: `expected [ 'who-001: prod-004 ≠ prod-001' ] to deeply equal []` |
| И2 | `whm-070.productId` → `prod-001` | «у каждого движения товар тот же…»: `expected [ 'whm-070: prod-001 ≠ prod-032' ]` |
| И3 | `whm-070.productId` → `prod-999` | «каждая складская ссылка есть в каталоге»: `expected [ 'whm-070 → prod-999' ]` |
| И4 | `_matchesProductName` возвращает false для найденного товара | «поиск по имени товара находит партию»: `expected 0 to be greater than 0` |
| И5 | `productLabel` вместо прочерка отдаёт `productId` | два утверждения: `expected 'prod-999' to be '—'`, `expected 'prod-001' to be '—'` |

Утверждения о наборах защищены от пустоты (`expect(offcuts.length).toBeGreaterThan(0)` и
т. п.) — иначе `toEqual([])` проходило бы на пустом списке (питфолл #68).

Тронутые чужие спеки (`cutting.spec.ts`, `warehouse-transfer-location.spec.ts`) — из payload
обрезка убрано поле, которого больше нет в типе; ни одно утверждение не менялось.

**Л10 — целостность.** `npx vite build` — exit 0. Дублей имён роутов не добавилось,
`src/i18n/admin/index.ts` импортирует все 16 доменов, флаги не трогались.

---

## 5. Что НЕ чинилось и почему

- **`StockOverviewItem.productName` и `WarehouseDeficit.productName`** — та же болезнь, но
  пункт называет три сущности: партию, обрезок и движение. Остаток и дефицит по-прежнему
  хранят имя копией, и в `projectStockRow` она по-прежнему переписывается из каталога
  (`src/services/mocks/warehouse.ts:392`). Это кандидат в отдельный пункт плана.
- **`OrderLine.productName`** — снимок момента, а не копия справочника: строка заказа обязана
  не меняться вслед за каталогом, как и её `unitCost`. Не находка.
- **Три «врущие толщины»** (who-001, who-005, who-011) — см. §3, пункт прямо запрещает гадать.
- **`mockGetOffcuts` отдаёт ссылки на объекты стора** (`paginate([...offcutStore], …)`,
  питфолл #13) — дефект существовал до правки и правкой не задет.
- **`movement.batchNumber` — тоже копия** (номера партии). Пункт её не называет; проверять и
  чинить в этом прогоне не стал, чтобы не смешивать два правила в одном коммите.

---

## Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 4e — productName со склада
Итераций: 1 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK (9.39 %) · format OK · unit OK (575)
                   test:audit OK (97) · vite build OK · e2e ур. 1 OK (167 + 174)
Линзы:             Л1–Л10 подтверждены
Найдено за прогон: 0 новых       Починено: пункт целиком      Отклонено: 0
В bugs-file ушло:  0 (пять отложенных перечислены в §5 — они не новые)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
