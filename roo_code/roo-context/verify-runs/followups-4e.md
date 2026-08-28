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

---

## Отклонено приёмкой — 2026-08-27

Вердикт «чистый свип» выше относится к тому, что было сделано, и приёмка его подтвердила.
Пункт всё равно закрыт не полностью: требование «Сиды привести в согласие» выполнено только
для ссылок, а вторая копия имени товара осталась в том же файле, на тех же записях, которые
пункт называет поимённо.

### Что сошлось (перепроверено приёмкой независимо, не со слов автора)

- `productName` действительно исчез из партии, обрезка и движения. В
  `src/types/warehouse.ts` поле осталось только у `WarehouseDeficit` (404),
  `DeficitListItem` (430), `StockOverviewItem` (531) и `StockPatchPayload` (560) — дефицит и
  остаток пункт не называет. В трёх сид-файлах grep `productName` даёт 0/0/0.
- Подпись собирается одним резолвером `productLabel` (`src/domain/product.ts:25`) через
  `useProductNames`. Все пять мест показа (`WarehousePage` 2228/2267/2739/2817/3288, три
  карточки, страница резки) обслуживаются загрузчиками, которые тянут справочник вместе с
  данными: `loadBatches`/`loadOffcuts`/`loadMovements` (`useWarehouse.ts:219/245/271`),
  `useWarehouseBatch:198`, `useWarehouseMovementCard:36`, `useWarehouseOffcutCard:199` и
  `selectBatch` (`useWarehouseCutting.ts:105`). Других потребителей `useProductNames` нет.
- Дефект прямого входа реален, и тест на него не декоративный: инверсия
  (`const loaded = await getBatch(id)`) кладёт новый тест в красное с
  `unexpected value "—"` на строке 90, exit=1; с правкой — 12 passed.
- Цифры воспроизведения сошлись: партий 100, товаров в каталоге 114 — «114» в плане было
  числом товаров, а не партий.

### Основание отклонения

Пункт в разделе «Факты» перечисляет ТРИ хранилища, где `prod-012` зовётся по-разному, и одно
из них — «`src/mocks/warehouse-batches.ts` (whb-088…whb-090) — „Арматура 12мм“»
(`review-followups.md:389`). После правки этот файл по-прежнему называет `prod-012` «Арматура
12мм»: заголовок секции над `whb-088` (`warehouse-batches.ts:2763`) и поле `notes` самой
записи — `'Rebar A500C. Partial consumption.'` (`warehouse-batches.ts:2782`) — при каталожном
имени «Стальной лист S235 2мм 1250×2500». Удалена одна копия из двух; расхождение, которое
пункт описывает, живо в том же файле на той же записи.

Масштаб замерен, он не единичный:

- 15 из 15 заголовков-комментариев `// ── prod-XXX: …` в `warehouse-batches.ts` называют
  товар не так, как каталог: prod-016 «Кислород газообразный» против «Стальной лист S355 6мм
  2000×4000», prod-007 «Аргон газообразный» против «УШМ 125мм», prod-004 «Труба стальная
  50мм» против «Стальная труба 100x5».
- 20 из 100 партий несут в ХРАНИМОМ поле `notes` описание другого товара: whb-097 (Steel
  Sheet S355 6mm) — `'Oxygen cylinder 40L. 2 cylinders consumed.'`, whb-082 (Angle Grinder
  125mm) — `'Argon cylinder 40L, full.'`, whb-088 — `'Rebar A500C…'`, whb-084 (Steel Sheet
  S355 5mm) — `'I-beam 200mm…'`, и так далее. Это не комментарий: `notes` рисуется на карточке
  партии (`WarehouseBatchCard.vue:1067`, `data-test="field-notes"`), то есть ровно тот эффект,
  которым пункт мотивирован — «расхождение читается как разные товары» — остался на экране: в
  шапке лист, в примечании кислородный баллон. Комментарий автора в `src/domain/product.ts`
  как раз хвалится, что журнал больше не подписывает списание листа «Oxygen gas» — а сид всё
  ещё подписывает.

Ни `notes`, ни заголовки не названы ни в правке, ни в списке «осознанно НЕ чинилось» (§5) —
то есть это не отклонённое требование, а незамеченное. Владельца у этих строк, кроме 4e, в
плане нет: grep по `whb-088|whb-097|Кислород|Oxygen|Rebar|Арматура` по `review-followups.md`
даёт единственное попадание — строку 389 внутри самого 4e.

### Объём возврата в работу

Узкий: привести `notes` партий и заголовки секций в согласие со ссылкой — или объявить их
отдельным пунктом вслух. Уже сделанное — снятие поля, резолвер, выравнивание ссылок, правка
`selectBatch` и её тест — переделывать не нужно.

### Что откачено

Откачен только `313850e` («прямой вход на резку тоже приносит справочник товаров») —
`git revert --no-edit 313850e`, без конфликтов. `f57bd29` (снятие поля, резолвер,
выравнивание ссылок) оставлен в ветке: приёмка его подтвердила, а решение по нему принимает
человек вместе с требованием про сиды. Отметку ✅ в плане автор не ставил — с вердиктом
согласуется.

---

# Возврат в работу — 2026-08-28

Прогон автономный. Отклонение от 2026-08-27 закрывалось ВПЕРЁД, руками: `git revert` реверта
(`ba50844`) даёт конфликт и механически не восстанавливается. Отметку ✅ в плане автор не ставит.

Два незакрытых долга, оба из разбора приёмки:

1. **Регресс.** Откат `313850e` унёс подтверждённую приёмкой правку `selectBatch` вместе с
   незакрытым пунктом. Прямой вход на резку снова показывал прочерк вместо имени товара.
2. **Суть пункта.** Вторая копия имени товара жива в сиде партий: заголовки секций и `notes`.

---

## 1. Воспроизведение — обе находки на текущем коде

### 1.1 Регресс `selectBatch`

```
$ sed -n '97,101p' frontend_vue/src/composables/useWarehouseCutting.ts
  async function selectBatch(id: string) {
    batchLoading.value = true
    try {
      const loaded = await getBatch(id)

$ grep -n "ensureProductNames" frontend_vue/src/composables/useWarehouseCutting.ts
13:import { ensureProductNames } from './useProductNames'
86:        ensureProductNames(),        ← единственный вызов, внутри loadBatches()

$ grep -n "batchId\|selectBatch" frontend_vue/src/views/admin/warehouse/WarehouseCuttingPage.vue
116:  const preselected = route.query.batchId
117:  if (typeof preselected === 'string' && preselected) selectBatch(preselected)
118:  else loadBatches()
```

Справочник — модульный `ref` в `useProductNames.ts`, наполняемый только через
`ensureProductNames()`. Вход `?batchId=` идёт веткой 117, список партий не грузит, значит
справочник пуст, а шаблон рисует `productName(batch.productId)` — `productLabel` отдаёт `'—'`.
Подтверждено прогоном (инверсия И1 ниже): `Expected "Steel Pipe 100x5", Received "—"`.

### 1.2 Вторая копия имени в сиде партий

Обе новые проверки написаны ДО правки данных и обе на невправленном коде красные:

```
$ npx vitest run src/services/mocks/warehouse-product-reference.spec.ts
 × заметка партии описывает партию, а не товар
   expected [ …(54) ] to deeply equal []
   + "whb-088: rebar"            (prod-012 = Steel Sheet S235 2mm 1250×2500)
   + "whb-097: oxygen"           (prod-016 = Steel Sheet S355 6mm 2000×4000)
   + "whb-082: argon"            (prod-007 = Angle Grinder 125mm)
   + "whb-084: beam"             (prod-010 = Steel Sheet S355 5mm 1500×3000)
   … 50 строк опущено
 × заголовок секции называет товар так же, как каталог
   expected [ …(15) ] to deeply equal []
   + "prod-004: «Труба стальная 50мм / Steel pipe 50mm / …» ≠ «Steel Pipe 100x5»"
   + "prod-012: «Арматура 12мм / Rebar 12mm / Armatūra 12mm» ≠ «Steel Sheet S235 2mm 1250×2500»"
   + "prod-016: «Кислород газообразный / Oxygen gas / …» ≠ «Steel Sheet S355 6mm 2000×4000»"
   … 12 строк опущено
 Tests  2 failed | 4 passed (6)
```

**Поправка к цифре разбора:** заголовков `// ── prod-XXX: …` пятнадцать, и расходились с
каталогом **14 из 15**, а не 15 из 15: `prod-003` («Стальная труба 60x4») каталогу не
противоречил — расходился только язык. Пятнадцатым в списке выше он стоит потому, что
проверка требует точного совпадения с `name.en`.

Заметок, называющих товар, оказалось **54 из 100**, а не 20: разбор считал те, что называют
ЧУЖОЙ товар, проверка — любое упоминание товара вообще (см. §2, почему именно так).

---

## 2. Что сделано

### 2.1 `selectBatch` тянет справочник вместе с партией

Правка восстановлена **побайтово** — `git diff` даёт те же хеши блобов, что откаченный
`313850e` (`index 4cb19ab..a944e50`), то есть подтверждённое приёмкой не переписано, а
возвращено:

```
-      const loaded = await getBatch(id)
+      const [loaded] = await Promise.all([getBatch(id), ensureProductNames()])
```

Вместе с ней возвращён её e2e-тест (`cutting.spec.ts`, «a batch opened by its direct link
still names the product»).

### 2.2 Имя товара перестало копироваться в сид партий

**Заметка (`notes`) — то же лечение, что у снятого поля: имя не выравнивается, а перестаёт
храниться.** `notes` описывает ПАРТИЮ (сколько израсходовано, какой сертификат, где лежит), и
товара не называет вовсе. Причина, по которой правится не 20 заметок «про чужой товар», а все
54, называющие товар: «согласовать» свободный текст с каталогом машина не может, а значит
согласие продержится ровно до следующей правки каталога — ровно та болезнь, от которой пункт
и избавлялся, только в тексте вместо поля. Правильная заметка про свой товар («Rebar A500C
12mm — certificate CERT-071 attached» у партии арматуры) — такая же копия, как неправильная,
и живёт до первого переименования.

Правлено 60 заметок: 54 по словарю каталога плюс шесть, которые словарь не ловит и которые
найдены чтением, — `whb-006`/`whb-007` («Plywood» у партии титанового листа: фанеры в каталоге
нет вовсе, поэтому слова нет и в словаре), `whb-024` («76mm diameter» при каталожных 50×3),
`whb-030`, `whb-083` (габарит чужого товара после первой правки), `whb-088`.

**Заголовок секции** — комментарий, пользователю он не виден, и без имени в файле на три с
лишним тысячи строк нужную запись не найти. Поэтому имя в нём осталось, но приколочено к
каталогу проверкой: разойтись молча больше не может. Пятнадцать заголовков переписаны на
`name.en` каталога; у `prod-003` пометка «(3 UoM demo)» переехала перед двоеточием, чтобы
проверка сравнивала имя, а не имя с примечанием.

**Шестнадцатая копия — в сиде движений:** `// ── whb-001 (Steel sheet 2mm, 1000 kg)` при
каталожном «Steel Sheet 3mm». Строка одна, болезнь та же; имя из неё убрано совсем
(`// ── whb-001 (prod-001, 1000 kg)`), потому что ссылки здесь достаточно.

### 2.3 Чем это теперь держится

Две проверки в `src/services/mocks/warehouse-product-reference.spec.ts` — файле, который уже
владеет правилом «склад ссылается на товар, а не хранит его имя»:

- **заметка партии описывает партию, а не товар** — словарь строится ИЗ каталога (все имена,
  все три локали, слова от четырёх букв), руками не пишется и потому не устаревает;
- **заголовок секции называет товар так же, как каталог** — заголовки читаются из самого файла
  сида регуляркой и сверяются с `name.en`.

**Что этот словарь НЕ ловит, сказано вслух.** Порог в четыре буквы взят намеренно:
трёхбуквенные обрывки каталожных имён («Cut-off Wheel» даёт `cut` и `off`) совпадают с обычным
английским, и заметка «500 kg written off» краснела бы ни за что. Цена порога — коды профилей
`IPE`, `UPN`, `HEA` и слово `MIG` сквозь него проходят; они называют стандарт профиля и способ
сварки, а не товар из каталога. Множественное число учтено отдельно (`wheels` → `wheel`),
иначе `whb-083` («Cut-off wheels» у партии оцинкованного листа) проскочил бы.

### Файлы

```
frontend_vue/src/composables/useWarehouseCutting.ts               (возврат 313850e, побайтово)
frontend_vue/src/mocks/warehouse-batches.ts                       (15 заголовков + 60 заметок)
frontend_vue/src/mocks/warehouse-movements.ts                     (1 заголовок)
frontend_vue/src/services/mocks/warehouse-product-reference.spec.ts (+2 проверки)
frontend_vue/tests/e2e/admin/warehouse/cutting.spec.ts            (возврат 313850e, +1 тест)
```

---

## 3. Приёмка

Итерация 1 — единственная, свип чистый.

```
$ cd frontend_vue && npm run verify
> typecheck    vue-tsc --noEmit                                    exit 0
> lint         eslint src/ tests/ *.ts --max-warnings=0            exit 0
> dupes        jscpd src        686 clones · 9.20 % (порог 10 %)   exit 0
> format:check prettier --check src/ tests/
               All matched files use Prettier code style!          exit 0
> test:unit    vitest run       30 файлов, 645 тестов — passed     exit 0
exit=0
```

```
$ npm run test:audit
 Test Files  22 passed (22)
      Tests  97 passed (97)
exit=0

$ npx vite build          # компилятор шаблонов, питфолл #67
✓ built in 8.31s
exit=0
```

E2E, уровень 1 — правка в одной области (склад) плюс те, кто читает тот же мок:

```
$ npx playwright test tests/e2e/admin/warehouse tests/e2e/admin/analytics/warehouse.spec.ts \
    tests/e2e/admin/analytics/deficit.spec.ts tests/e2e/admin/analytics/supply.spec.ts \
    --reporter=line --workers=3
  168 passed (2.9m)      exit=0

$ npx playwright test tests/e2e/admin/orders tests/e2e/admin/settings \
    tests/e2e/admin/analytics/dashboard.spec.ts --reporter=line --workers=3
  1 failed · 178 passed (3.5m)      exit=1
```

**Разбор красного.** Упал `orders.spec.ts:1842` «a price printed wrong is corrected in the
open, not rewritten»: `Expected 115.5, Received 120.5` — исправление цены строки не
применилось к моменту чтения. К этой правке отношения не имеет, и это не «наверное»:

```
$ npx playwright test tests/e2e/admin/orders/orders.spec.ts \
    -g "corrected in the open, not rewritten" --workers=1
  1 passed (16.4s)      exit=0

$ npx playwright test tests/e2e/admin/orders --reporter=line --workers=3
  120 passed (2.8m)     exit=0

$ grep -rn "warehouse-batches" frontend_vue/src/ --include=*.ts | grep -v spec
frontend_vue/src/mocks/warehouse.ts:1:export { mockBatches } from './warehouse-batches'
```

То есть: тест зелёный и поодиночке, и в своей группе, а пути от мока заказов к сиду партий нет
вовсе — `services/mocks/orders.ts` импортирует `reservations`, `clients`, `settings`,
`products`, `services`, домен цен; `warehouse-batches` не импортирует ни он, ни его импорты.
Правка комментариев и текстовых заметок в сиде склада на цену строки заказа повлиять не может.
Это гоночное чтение семейства #64 в чужой спеке, а не находка этого пункта; в bugs-file не
уводится, потому что воспроизводится не она, а её отсутствие.

Финальный прогон на итоговом дереве (после правки заголовка в сиде движений):

```
$ npx vite build                                                   exit=0
$ npx playwright test tests/e2e/admin/warehouse --workers=3
  77 passed (1.7m)                                                 exit=0
```

### Линзы

**Л1 — реактивность.**
```
$ grep -n "structuredClone\|toRaw(\|useHead(\|watch(" \
    src/composables/useWarehouseCutting.ts src/mocks/warehouse-batches.ts \
    src/services/mocks/warehouse-product-reference.spec.ts tests/e2e/admin/warehouse/cutting.spec.ts
src/composables/useWarehouseCutting.ts:140:  watch(
```
Единственное вхождение — вотчер, существовавший до правки; `git diff` по файлу состоит из
одной строки `selectBatch` и комментария к ней, вотчера не касается. Ни `structuredClone`, ни
`toRaw` не добавлено. `ensureProductNames()` в `Promise.all` не создаёт нового состояния:
справочник — тот же модульный `ref`, а повторный вызов возвращает уже висящее обещание.

**Л2 — i18n.** Новых ключей нет. Заметки партий остались английскими — проверено:
```
$ grep -n "notes: '.*[А-Яа-я]" src/mocks/warehouse-batches.ts
(exit 1 — ни одного)
$ grep -c "notes: '" src/mocks/warehouse-batches.ts
100
```
Кириллица в файле осталась только там, где она — данные перевода (`supplierName`, имена файлов,
свойства аудита: `{ ru, en, lt }`), и в одном поле `location` (`whb-001`), где русский текст
приписан к адресу ячейки. Последнее — питфолл #33 вне области пункта, см. §5.

**Л3 — контракт и HTTP.** Новых вызовов нет: правка `selectBatch` зовёт уже описанный
`GET /api/products/list`. Примеры ответов в контракте на изменённые заметки не ссылаются:
```
$ grep -rn "Rebar A500C\|Oxygen cylinder\|Cut-off wheels\|Plywood\|Steel pipe 50mm" \
    roo_code/roo-context/03-api-contract.md
715: … "alerts": [{ "type": "deficit", "description": "Rebar A500C below safety stock" … }]
```
Единственное попадание — текст оповещения дашборда про дефицит, к заметкам партий отношения не
имеющий. Дописывать контракт нечем: ни поле, ни метод, ни форма ответа не менялись.

**Л4 — мок = правда.** Согласие сида с каталогом стало машинным по обеим оставшимся копиям
(§2.3), обе проверки красные на невправленных данных (§1.2) и зелёные после. Демо больше не
«украшено»: партия стального листа не подписана кислородным баллоном.

**Л5 — один источник.**
```
$ grep -rn "productLabel\|_productName" src/ --include=*.ts --include=*.vue | grep -v "\.spec\."
src/domain/product.ts:25:export function productLabel(
src/composables/useProductNames.ts:48:      productLabel(productId, products.value, locale.value)
src/services/mocks/warehouse.ts:129:function _productName(productId)      ← сторона сервера
src/services/mocks/warehouse.ts:135,146                                    ← поиск и сортировка
src/types/warehouse.ts:75 — комментарий
```
Второй реализации подписи не появилось: на клиенте один `productLabel`, в моке один
`_productName`. Хелперы новой проверки (`nameWords`, `catalogVocabulary`, `namesCatalogWord`)
живут только в спеке и правила «как зовут товар» не содержат — они его ищут.
Машинная часть: `npm run dupes` 9.20 % при пороге 10 (было 9.39 % — заметки стали короче),
sonarjs внутри `lint` — чисто.

**Л6 — UI и CSS.** Ни одного `.vue` не тронуто:
```
$ git diff --stat -- 'frontend_vue/src/views' 'frontend_vue/src/components'
(пусто)
```

**Л7 — права, флаги, роутинг.**
```
$ git diff --stat -- frontend_vue/src/router frontend_vue/src/config/featureFlags.ts \
    frontend_vue/tests/e2e/helpers/flags.ts
(пусто)
```

**Л8 — сохранение и потеря данных.** `selectBatch` получил вторую загрузку в том же
`Promise.all`; ничего не пишется, `batch.value` присваивается тем же значением, ветка `catch`
не изменилась. Заметки — сид, а не пользовательский ввод: правка сида не может затереть
несохранённое.

**Л9 — тесты, которые ничего не утверждают.** Машинная часть:
```
$ grep -rn "await page.waitForLoadState" tests/
(exit 1 — пусто)
```
Инверсии, по одной на утверждение; каждый раз ломалась ОДНА запись, а не весь файл, — иначе
краснота ничего не доказывает про конкретное утверждение:

| # | что сломано | что покраснело |
|---|---|---|
| И1 | `selectBatch` вернули к `const loaded = await getBatch(id)` | e2e «direct link still names the product»: `Expected "Steel Pipe 100x5", Received "—"`, exit=1 |
| И2 | `whb-088.notes` → `'Rebar A500C. Partial consumption.'` | «заметка описывает партию, а не товар»: `expected [ 'whb-088: rebar' ] to deeply equal []` |
| И3 | заголовок `prod-012` → `«Rebar 12mm»` | «заголовок называет товар так же, как каталог»: `expected [ 'prod-012: «Rebar 12mm» ≠ «Steel Sheet S235 2mm 1250×2500»' ]` |

Откат каждой инверсии возвращал зелёное (`6 passed`, e2e `1 passed`).

Утверждения защищены от бездействия (питфолл #68): у обеих новых проверок стоит
`expect(vocabulary.size).toBeGreaterThan(0)`, `expect(BATCH_SEED.length).toBeGreaterThan(0)`,
`expect(headers.length).toBeGreaterThan(0)` — пустой словарь, пустой сид или неразобранный файл
иначе давали бы `toEqual([])` как успех. У e2e-теста непустота имени проверяется отдельно, иначе
равенство двух прочерков сошлось бы как совпадение.

**Л10 — целостность.** `npx vite build` exit 0 на итоговом дереве. Роутер, флаги и i18n не
трогались (Л7), новых файлов не добавлено.

---

## 4. Что НЕ чинилось и почему — список полный, это и есть предмет прошлого отказа

- **Заметки обрезков и движений.** `13 из 13` и `98 из 98` написаны по-русски
  (`grep -c "notes: '.*[А-Яа-я]"`), и часть называет материал: «Остаток алюминиевого листа
  после раскроя» у `who-011`, чья партия `whb-006` ссылается на титановый лист; «Перемещение
  круглой трубы», «Раскрой листа». Болезнь та же. Не чинится здесь по двум причинам, и обе
  проверяемые: (1) разбор приёмки называет заголовки секций и `notes` ПАРТИЙ, а задача велит
  чинить названное; (2) построенная здесь машинная проверка на этот текст не работает в
  принципе — словарь сверяет точные словоформы, а «листа» ≠ «лист», так что согласие пришлось
  бы либо доказывать иначе, либо сперва перевести заметки на английский (питфолл #33). Это
  отдельная работа с отдельным объёмом, а не строка правки. **Кандидат в отдельный пункт плана.**
- **`location` у `whb-001`** — `'Rack: A-01 | Row: 01 | Cell: 01\nNotes: Часть партии также
  в ячейках 02-03 этого же ряда'`: русский текст в поле адреса. Питфолл #33, товара не
  называет, к имени товара отношения не имеет.
- **`StockOverviewItem.productName` и `WarehouseDeficit.productName`** — хранимая копия имени в
  остатке и дефиците. Пункт называет партию, обрезок и движение; остаток и дефицит — нет.
  Как и в прошлый раз: кандидат в отдельный пункт.
- **`OrderLine.productName`** — снимок момента, а не копия справочника. Не находка.
- **Три «врущие толщины»** (`who-001`, `who-005`, `who-011`) — пункт прямо запрещает гадать,
  какая из трёх правд верна.
- **`movement.batchNumber` — тоже копия.** Пункт её не называет.
- **`orders.spec.ts:1842`** — гоночное чтение в чужой спеке, разобрано выше по трём командам.
- **Коды профилей `IPE`/`UPN`/`HEA` и слово `MIG` в заметках** — сквозь порог словаря проходят
  осознанно, цена названа в §2.3.

---

## Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 4e — возврат в работу после отказа приёмки
Итераций: 1 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK (9.20 %) · format OK · unit OK (645)
                   test:audit OK (97) · vite build OK
                   e2e ур. 1 OK (168 + 178 при одном разобранном чужом флейке + 77 финально)
Линзы:             Л1–Л10 подтверждены, каждая с командой и выводом
Найдено за прогон: 2 (оба из разбора приёмки)   Починено: 2   Отклонено: 0
В bugs-file ушло:  0 (восемь отложенных перечислены в §4 — они не новые)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Отклонено приёмкой — 2026-08-28 (второй отказ, по неполноте)

Приёмщик подтвердил как верное: `productName` действительно исчез из объектов партии,
обрезка и движения; `offcut.productId === batch.productId` — 13 из 13; обе проверки не
декоративны; регресс `selectBatch` восстановлен и покрыт e2e; вся машинная приёмка зелёная.

Отклонено за то, чего нет:

1. **Лечение применено к одному сиду из трёх.** «Хранимые `productName` в партиях,
   обрезках и движениях — убрать» — вторая копия имени свободным текстом убрана только из
   `warehouse-batches.ts`. В обрезках и движениях она осталась и рисуется тем же полем:
   `WarehouseOffcutCard.vue:742` и `WarehouseMovementCard.vue:666` — оба
   `data-test="field-notes"`, ровно как `WarehouseBatchCard.vue:1067`, на который ссылался
   первый отказ. Названные приёмщиком случаи: `who-011`, `who-008`, `who-010`, `who-009`,
   `who-013`, `whm-071`, `whm-060`, `whm-048`, `whm-036`.
2. **Отвод в §4 не проходит.** Причина «словарь сверяет точные словоформы, а „листа“ ≠
   „лист“» мешает МАШИННОЙ СТРАЖЕ, а не починке: вычеркнуть упоминание товара из текста
   словаря не требует и на русском работает так же.
3. **Отдельного пункта в плане не появилось.** `git show 5189821 --stat` план не трогает,
   запись «кандидат в отдельный пункт» живёт только в этом журнале — владельца, кроме 4e,
   у этих строк нет.
4. **Стража односторонняя.** `warehouse-product-reference.spec.ts` читал только
   `../../mocks/warehouse-batches.ts`; сиды обрезков и движений не покрыты ничем, включая
   заголовок `warehouse-movements.ts:1746`, который этой же правкой чинился руками.

---

# Проход 3 — 2026-08-28: та же болезнь долечена в обрезках и движениях

Автономный. Отметку ✅ в плане ставит не автор правки.

## 1. Воспроизведение — всё названное лежит в коде

Замер сделан ДО правки, временной спекой (`src/__tmp4e_probe.spec.ts`, удалена после
замера): словарь строится из каталога, обе стороны приводятся к русской основе, и по этому
словарю читаются `notes` всех трёх сидов и все строки комментариев.

```
$ npx vitest run src/__tmp4e_probe.spec.ts

### BATCH: 0 of 100                 ← прошлая правка держится
### OFFCUT: 7 of 13
who-003 [алюминиев,лист] :: Остаток после раскроя алюминиевого листа
who-006 [труб]           :: Обрезок трубы после резки
who-009 [проволок]       :: Остаток проволоки после сварки
who-010 [электрод]       :: Остаток электродов, брак
who-011 [алюминиев,лист] :: Остаток алюминиевого листа после раскроя
who-012 [труб]           :: Половина трубы после резки
who-013 [проволок]       :: Остаток проволоки после сварки

### MOVEMENT: 32 of 98
whm-071 [труб]                    :: Резка трубы на опорные стойки
whm-060 [водогазопроводн,труб]    :: Перемещение водогазопроводной трубы
whm-048 [шлифовальн,круг]         :: Выдача шлифовальных кругов
whm-036 [сварочн,проволок,lincoln]:: Поступление сварочной проволоки Lincoln
… (28 строк опущено)

### COMMENTS mocks/warehouse-offcuts.ts: 15
### COMMENTS mocks/warehouse-movements.ts: 2
```

Пять из девяти названных приёмщиком записей словарь ловит сам; `who-008` («Остаток **газа**»)
он пропускает — «газ» три буквы, ниже порога, — и это ровно та причина, по которой к словарю
всегда прилагается чтение (у партий так же нашлись шесть).

Стража действительно односторонняя, одной командой:

```
$ grep -n "readFileSync\|from '\.\./\.\./mocks" src/services/mocks/warehouse-product-reference.spec.ts
5:import { mockBatches as BATCH_SEED } from '../../mocks/warehouse-batches'
128:    const source = readFileSync(new URL('../../mocks/warehouse-batches.ts', …
```

Сиды обрезков и движений в спеке не упоминались вовсе.

## 2. Что сделано

### 2.1 Заметки обрезков и движений перестали называть товар

То же лечение, что у партий: имя не выравнивается с каталогом, а перестаёт храниться.
`notes` описывает событие или остаток — сколько израсходовано, куда положено, по какому
заказу, — и товара не называет.

- **обрезки — 8 заметок** (7 по словарю плюс `who-008` чтением). Пример: `who-011`
  «Остаток алюминиевого листа после раскроя» → «Остаток после раскроя, годен в дело»
  (каталог по `prod-020` — «Титановый лист 2мм Grade 5»);
- **движения — 41 заметка** (32 по словарю плюс девять чтением: «фанеры», «профнастила»,
  «нержавейки», «двутавра», «металлопроката», «газа» — этих слов в каталоге нет вовсе, а в
  заметках они были). Пример: `whm-036` «Поступление сварочной проволоки Lincoln» →
  «Поступление от поставщика по накладной» (партия — газ Ar/CO2).

Заметки, называющие операцию, а не товар («Брак при резке», «Продажа ООО „МеталлСтрой“»,
«Передано в производство»), не тронуты — их 62 из 111.

### 2.2 Комментарии этих двух сидов тоже перестали называть товар

- `warehouse-movements.ts:1972` — `who-001: available → created from cutting` →
  `created when the batch was cut`: слово `cutting` совпадает с каталожным «Cutting Oil».
  Ложное срабатывание, но лечится дешевле, чем заводится исключением (см. §2.3);
- `warehouse-movements.ts:2210` — `must equal` → `must match` по той же причине (`Equal Angle`);
- `warehouse-offcuts.ts` — 13 заголовков `// ── 1. Sheet (cat-2) ──` заменены на
  `// ── who-001 ──`. Они были не просто копией, а **устаревшей** копией: у `who-008`…`who-013`
  заголовок говорил «Sheet (cat-2)», тогда как записи `offcutType: 'linear'`, `cat-4`. Тип и
  категория живут в самой записи — заголовку хватает идентификатора;
- `warehouse-offcuts.ts` — пояснение над `who-006` переписано без слов «трубы»/«листа»:
  смысл (линейный кусок на партии в м² невыразим) сохранён, ссылки названы явно.

Заголовок `warehouse-movements.ts:1746` уже был починен прошлым проходом руками — теперь он
приколочен проверкой, а не памятью автора (инверсия И3 ниже).

### 2.3 Чем это теперь держится

`src/services/mocks/warehouse-product-reference.spec.ts`, тот же файл, что владеет правилом:

- **«заметка складской записи описывает запись, а не товар»** — бывшая проверка по одному
  сиду партий читает теперь все три (`BATCH_SEED`, `OFFCUT_SEED`, `MOVEMENT_SEED`);
- **«комментарии в сидах обрезков и движений товар не называют»** — новая: строки `//` обоих
  файлов читаются с диска и сверяются с тем же словарём;
- **«заголовок секции в сиде партий называет товар так же, как каталог»** — без изменений.

Одно правило — одна реализация: словарь, основа и сверка написаны по одному разу и
используются тремя проверками (`grep -rln "nameWords\|namesCatalogWord\|RU_ENDINGS" src tests`
даёт единственный файл).

**Русская морфология.** Прошлый проход отвёл эту работу тем, что словарь сверяет точные
словоформы. Теперь обе стороны приводятся к основе: отсекается самое длинное окончание из
списка, если после него остаётся не меньше четырёх букв. «листа» → «лист», «трубы» → «труб»,
«электродов» → «электрод». Латиница через отсечение не проходит (окончания кириллические),
поэтому английские заметки партий работают как работали — `### BATCH: 0 of 100` замерено и
под новым словарём.

**Что словарь НЕ ловит — сказано вслух.** Порог в четыре буквы пропускает «газ», `IPE`, `UPN`,
`HEA`, `MIG`; слов, которых в каталоге нет («фанера», «профнастил», «двутавр»), в нём нет по
построению. Оба класса ловятся чтением, и в этом проходе поймано десять таких записей.

**Цена с другой стороны — ложные срабатывания, и она принята сознательно:** `cutting` из
«Cutting Oil», `equal` из «Equal Angle», «материал» из «Материал без категории» краснеют в
тексте, который называет операцию. Разбирать их исключениями значило бы завести список,
который устаревает молча, — ровно та болезнь, от которой пункт избавляется. Дешевле написать
заметку словами, которых в каталоге нет.

**Границы стражи названы честно:** комментарии сида ПАРТИЙ под запрет не попадают — там
записи сгруппированы по товару, заголовок имя называет по делу и приколочен к каталогу
отдельной проверкой. Правило одно, повёрнуто двумя сторонами: имя в комментарии либо сверено
с каталогом, либо его нет.

### Файлы

```
frontend_vue/src/mocks/warehouse-offcuts.ts                        (8 заметок, 13 заголовков, 1 пояснение)
frontend_vue/src/mocks/warehouse-movements.ts                      (41 заметка, 2 комментария)
frontend_vue/src/services/mocks/warehouse-product-reference.spec.ts (+1 проверка, 1 расширена)
```

## 3. Приёмка

Итерация 1 — единственная, свип чистый.

```
$ cd frontend_vue && npm run verify                                  exit=0
> typecheck    vue-tsc --noEmit
> lint         eslint src/ tests/ *.ts --max-warnings=0
> dupes        jscpd src        686 clones · 9.19 % (порог 10 %)
> format:check prettier --check src/ tests/   All matched files use Prettier code style!
> test:unit    Test Files 30 passed (30) · Tests 646 passed (646)

$ npm run test:audit                    Test Files 22 passed · Tests 97 passed
$ npx vite build                        ✓ built in 8.38s, exit=0
$ npx playwright test tests/e2e/admin/warehouse --reporter=line --workers=3
  77 passed (1.8m)                      exit=0
```

Уровень e2e — первый: правка лежит в сидах склада и в одной спеке. Круг «кто читает тот же
мок» снят грепом, а не на глаз:

```
$ grep -rln "mocks/warehouse" tests/e2e --include=*.ts
tests/e2e/admin/warehouse/warehouse.spec.ts
tests/e2e/mocks/warehouse.ts
```

Вне гейта:

```
$ npm run audit      found 0 vulnerabilities
$ npm run deadcode   Unused exports (58) · Unused exported types (21)   ← база 59/22, роста нет
$ npm run test:unit:coverage   All files 99.5 / 96.24 / 100 / 99.38     ← пороги 99/96/100/99
```

### Линзы

**Л9 — инверсия, пять штук.** Каждое утверждение ломается отдельно, а не файл целиком.

| # | что сломано | результат |
|---|---|---|
| И1 | `who-011` вернул «Остаток алюминиевого листа после раскроя» | × заметка складской записи описывает запись, а не товар — 1 failed |
| И2 | `whm-071` вернул «Резка трубы на опорные стойки» | × та же — 1 failed |
| И3 | `warehouse-movements.ts:1746` вернул `(Steel sheet 2mm, 1000 kg)` | × комментарии… — `+ "warehouse-movements.ts:1746: [steel, sheet] …"` |
| И4 | заголовок обрезков стал `who-001 (Steel Sheet 3mm)` | × комментарии… — `+ "warehouse-offcuts.ts:5: [steel, sheet] …"` |
| И5 | всем обрезкам проставлен `notes: null` | × заметка… — сработала проверка непустоты, а не пустой успех |

После каждой инверсии дерево восстанавливалось из копии; контрольный прогон на восстановленном
дереве — `Tests 7 passed (7)`.

И3 — прямой ответ на четвёртый пункт отказа: раньше возврат имени в этот заголовок не красил
ничего.

**Л4 (мок = правда)** — `grep -rn "productName" src/mocks/warehouse-*.ts src/services/mocks/warehouse.ts`:
в сидах партий, обрезков и движений вхождений нет; остаются только `warehouse-deficit.ts`
(дефицит — не то, что называет пункт, отложено с прошлого прохода).

**Л5 (один источник правила)** — `grep -rln "nameWords\|namesCatalogWord\|RU_ENDINGS\|catalogVocabulary" src tests`
→ единственный файл, `warehouse-product-reference.spec.ts`. Плюс машинная часть: `npm run dupes`
9.19 % при пороге 10, sonarjs внутри `lint` — зелено.

**Л1 (реактивность)** — `grep -n "structuredClone\|toRaw(\|useHead(\|watch(" ` по трём тронутым
файлам: пусто. Правка — данные и спека, реактивного кода в ней нет.

**Л2 (i18n)** — `notes` по типам (`src/types/warehouse.ts:114,239,372`) это `string | null`, не
`TranslatedString`: локалей у него нет, `tf()` к нему не применяется, файлы `src/i18n/` не
тронуты (`git diff --stat -- src/i18n` пуст). Русский текст в этих заметках — долг питфолла
#33, он был до правки и остаётся после; здесь он не чинится, потому что пункт про имя товара,
а перевод сидов — отдельный объём (см. §4).

**Л3 (контракт и HTTP)** — `git diff --name-only` даёт три файла, среди них нет ни сервиса, ни
композабла, ни мок-роутера: вызовов и методов правка не касается. Форма `notes` не менялась.

**Л6, Л7, Л8** — `git diff --name-only -- src/views src/router src/config src/composables` пуст:
шаблоны, роуты, флаги и сохранение не тронуты.

**Л10 (целостность)** — `vite build` собирается (exit 0), полный юнит-прогон 646 зелёный, e2e
склада 77 зелёных.

## 4. Что НЕ чинилось — и чем это отличается от прошлого раза

- **Русский язык заметок склада (питфолл #33).** Здесь правились ТЕКСТЫ, а не язык: заметка
  переписана теми же словами, что была, минус имя товара. Перевод 111 заметок обрезков и
  движений на английский — отдельный объём и отдельный риск (e2e читают текст полей), и
  словарю он не нужен: русская основа проверена этим же прогоном. Отличие от прошлого отказа
  в том, что тогда язык был назван причиной НЕ чинить пункт, а теперь пункт починен, и язык —
  честно оставшийся отдельный долг.
- **`StockOverviewItem.productName` и `WarehouseDeficit.productName`** — остаток и дефицит; пункт
  называет партию, обрезок и движение. Отложено с прошлого прохода, не новое.
- **`OrderLine.productName`** — снимок момента, а не копия справочника. Не находка.
- **`movement.batchNumber`** — тоже копия, пункт её не называет.
- **Три «врущие толщины»** (`who-001`, `who-005`, `who-011`) — пункт прямо запрещает гадать.
- **Заголовки категорий в сиде партий** (`// ── cat-2: Листы / Sheets / Lakštai ──`) — копия имени
  КАТЕГОРИИ, не товара. Тот же класс, другой справочник; пункт про товар.

## Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 4e — проход 3, долечивание обрезков и движений
Итераций: 1 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK (9.19 %) · format OK · unit OK (646)
                   test:audit OK (97) · vite build OK · e2e ур. 1 OK (77)
Вне гейта:         audit 0 high · deadcode 0 файлов / 58 экспортов / 21 тип · coverage 99.5
Линзы:             Л1–Л10 подтверждены, каждая с командой и выводом
Найдено за прогон: 4 (все из разбора приёмки)   Починено: 4   Отклонено: 0
В bugs-file ушло:  0 (шесть отложенных перечислены в §4 — они не новые)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
