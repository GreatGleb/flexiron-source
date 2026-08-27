# Пункт 4d — `batch.unit` переехал со свободной строки на ссылку на справочник

План: [`review-followups.md` § 4d](../../plans/general/review-followups.md)
Прогон: 2026-08-27, автономный. Отметку ✅ в плане ставит не автор правки.

---

## 1. Воспроизведение

Пункт называет четыре факта. Проверен каждый — на закоммиченном дереве (`git show HEAD:`),
до единой правки.

**(а) `StockUnit = string`, и поле этого типа стоит на четырнадцати сущностях.**

```
$ git show HEAD:frontend_vue/src/types/warehouse.ts | grep -n "StockUnit"
52:export type StockUnit = string
89:  unit: StockUnit      # WarehouseBatch
147: 163: 226: 256: 273: 314: 347: 403: 425: 499: 508: 526:
549:  unit?: StockUnit     # StockPatchPayload
```

Четырнадцать полей: партия, строка списка партий, payload создания партии, обрезок,
строка списка обрезков, payload обрезка, движение, строка списка движений, дефицит,
строка списка дефицита, агрегат статусов, активная продажа, строка остатков, патч остатка.

**(б) Значения в сидах партий — те самые, что в пункте.**

```
$ git show HEAD:frontend_vue/src/mocks/warehouse-batches.ts | grep -o "unit: '[^']*'" | sort | uniq -c | sort -rn
     35 unit: 'm'
     30 unit: 'kg'
     29 unit: 'pcs'
      4 unit: 'm2'
      2 unit: 't'
```

**(в) Сопоставление строки с кодом справочника вырождалось в сравнение с `code.en` — три раза.**

```
$ git grep -n "u.code.en === code\|code.en === code" HEAD -- frontend_vue/src
useWarehouseBatchCreate.ts:398   resolveUnitLabel — подпись по code.en
services/mocks/warehouse.ts:77   _resolveUomId — код → id по code.en/ru/lt
WarehouseBatchCard.vue:57        resolveUnitLabel — вторая копия той же подписи
```

Плюс два места, где **английский код уезжал в данные или в фильтр**:

```
$ git show HEAD:frontend_vue/src/composables/useWarehouseBatchCreate.ts | sed -n '125,133p'
  function autoFillUnit(product: Product | null) {
      const uom = settings.uoms.find((u) => u.id === product.warehouseUomId)
      if (uom) form.unit = uom.code.en || uom.code.ru || uom.code.lt || form.unit

$ git show HEAD:frontend_vue/src/views/admin/warehouse/WarehousePage.vue | sed -n '418,424p'
      // value = English code (used for filtering against DB/stored data)
      const value = u.code.en || u.code.ru || u.code.lt || '?'
```

То есть карточка создания партии брала у товара ССЫЛКУ и клала в партию английскую
ПОДПИСЬ — тот же дефект, что чинился в п. 4b, — а фильтр списка сравнивал `code.en`
с хранимой строкой. Для `uom-m2` (`'м²' / 'm²' / 'm²'`) хранимое `'m2'` не совпадало
ни с одним языком: фильтр «м²» на четырёх партиях в м² не находил ничего.

**(г) Оба списка-моста в `cutting.ts` на месте.**

```
$ git show HEAD:frontend_vue/src/domain/cutting.ts | grep -n "LINEAR_BATCH_UNITS\|STOCK_UNIT_BY_UOM_ID"
29:export const LINEAR_BATCH_UNITS: readonly StockUnit[] = ['m', 'mm']
33:  return LINEAR_BATCH_UNITS.includes(unit)
201:const STOCK_UNIT_BY_UOM_ID: Readonly<Record<string, StockUnit>> = {
316:    ? STOCK_UNIT_BY_UOM_ID[product.warehouseUomId]
```

Пункт воспроизведён полностью.

**Найдена ТРЕТЬЯ система подписи, которой в тексте пункта нет.** П. 4c разбирал
`orders.unit_*`; у склада оказалась своя семья — `warehouse.unit_{kg,m,pcs,m2,t,mm}`,
шесть ключей, 24 обращения вида ``t(`warehouse.unit_${x}`, x)`` в девяти представлениях.
Второй аргумент — дефолт, поэтому единица без ключа рисовалась своим кодом. Она уходит
вместе с этим пунктом: подпись теперь собирает справочник.

---

## 2. Что сделано

Миграция **по типу**, как требует пункт (прецедент п. 4): сначала сменён тип, дальше
`vue-tsc` перечислил все места, и ни одно не осталось на усмотрение глаза.

### Тип

`src/types/warehouse.ts`: `StockUnit` удалён; все четырнадцать полей `unit` стали
`uomId: string` — ссылка на `Uom.id` справочника настроек. Фильтры (`WarehouseFilters.unit`,
`StockFilters.unit`) и значение сортировки `'unit'` — тоже `uomId`.

### Данные

Пять файлов сидов: `unit: 'kg'` → `uomId: 'uom-kg'` и так далее, 306 строк. Плюс
агрегаты статусов партии в `warehouse-movements.ts` (10 объектов в одну строку).

### Подпись

Все 24 места `t('warehouse.unit_…')` заменены на `useUnitLabel()` — композабл,
появившийся в п. 4c и уже подписывающий единицы в заказах. Шесть ключей
`warehouse.unit_*` удалены из всех трёх локалей.

Удалены три реализации одного правила подписи:
`resolveUnitLabel` в `useWarehouseBatchCreate.ts`, `resolveUnitLabel` в
`WarehouseBatchCard.vue` (обе — сравнение с `code.en`) и локальный
``computed(() => t(`warehouse.unit_${unit}`))`` в `WarehouseCuttingPage.vue`.

### Мосты

- `STOCK_UNIT_BY_UOM_ID` — удалён: `product.warehouseUomId` уходит в резолвер как есть.
- `LINEAR_BATCH_UNITS` — удалён, и это не переименование в `['uom-m','uom-mm']`.
  `isLinearBatchUnit` теперь ВЫВОДИТСЯ из `REQUIRED_DIMENSION`: линейна та единица,
  у которой размер куска определяется одной только длиной. Два выражения одного правила
  стали одним.
- `_resolveUomId(data.unit)` в `mockCreateBatch` — заменён на `data.uomId`.

`PIECE_SIZE` и `REQUIRED_DIMENSION` переехали на ключи `uom-*`.

### Границы

- **Карточка создания партии.** `autoFillUnit` копирует `product.warehouseUomId`
  целиком, а не его английский код.
- **Фильтр единиц в списках склада.** `value` опции — `u.id`, а не `code.en`.
- **Сохранённый фильтр в localStorage.** Значение, записанное до этой правки, держит
  код (`'kg'`) и теперь не совпало бы ни с одной строкой — пользователь получил бы
  пустую таблицу без причины. Загрузка принимает только `''` или значение с префиксом
  `uom-`.
- **Дефицит по недостаче заказа.** `recordShortage` — единственное место, где строка
  заказа (она хранит id справочника без начала: `'pcs'`) встречается со складом.
  Преобразование одно и живёт рядом с обратным: `uomIdFromOrderLineUnit` в
  `src/domain/uom.ts`, и `uomCode` теперь спрашивает его, а не повторяет `replace`.
- **Колонка единицы в выборе товара** (`WarehouseBatchCreatePage`) читала
  `(p as { unit?: string }).unit` — поля, которого у строки списка товаров нет.
  Приведение типом молчало, колонка показывала прочерк ВСЕГДА. Теперь это
  `unitLabel(p.warehouseUomId)` — складская единица товара, то есть будущая единица партии.

### Строки заказа — сознательно НЕ тронуты

`OrderItem.unit` (`'pcs'`) — не `StockUnit` и никогда им не был; пункт говорит про
`uomId` там, где сейчас `StockUnit`. Огрызок остаётся, преобразование на границе одно
и названо выше.

### Контракт

`roo_code/roo-context/03-api-contract.md`: описание типов склада, примеры ответов
(партия, агрегаты, активные продажи, строка движения), query-параметры `unit?` → `uomId?`
у движений и обрезков, payload резки и таблица «`batch.uomId` → размер куска».

---

## 3. Приёмка

```
$ cd frontend_vue && npm run verify        # typecheck · lint · dupes · format:check · test:unit
exit=0
 Test Files  22 passed (22)
      Tests  565 passed (565)

$ npm run test:audit                       # тронуты файлы семьи order-audit-*
exit=0
 Test Files  22 passed (22)
      Tests  97 passed (97)
```

`format:check` первым прогоном был красным на шести файлах — `prettier --write`,
повторный прогон зелёный.

---

## 4. Линзы

Область: склад целиком (типы, сиды, мок, композаблы, девять представлений), домен резки,
контракт. Прогнаны все десять.

**Л1 — реактивность.** Ни один `watch`/`structuredClone`/`toRaw`/`useHead` не добавлен и
не удалён:

```
$ for f in $(git diff --name-only); do grep -n "structuredClone\|toRaw(\|useHead(\|watch(" $f; done
```

— вывод совпадает с тем, что было до правки (все вхождения вне изменённых строк).
Новая реактивная поверхность одна: `useUnitLabel()` возвращает функцию, читающую
`settings.uoms` и `locale.value` в момент вызова, то есть внутри рендера — смена языка
перерисовывает подпись. Так это уже работает в заказах с п. 4c.

**Л2 — i18n.** Машинная часть:

```
$ npx tsx -e "import { adminWarehouse as w } from './src/i18n/admin/warehouse' …"
ru 599 en 599 lt 599
ru-en []  en-ru []  ru-lt []  lt-ru []
unit keys left: []
```

Три локали совпадают по набору ключей, шесть `unit_*` ушли из всех трёх. Сырых точечных
ключей в DOM не появляется: `unitLabel` возвращает код справочника либо сам id, но не ключ.

**Л3 — контракт и HTTP.** Ни одного нового эндпоинта и ни одной смены метода. Имена
параметров сверены поштучно: сервис пишет `params.uomId` (10 мест,
`src/services/warehouseService.ts`), диспетчер мока читает `params?.uomId` (5 мест,
`src/services/mocks/index.ts`), сигнатуры пяти списочных функций мока объявляют `uomId?`.
Контракт дописан (раздел 2 выше).

**Л4 — мок = правда.** Главная проверка пункта: каждая единица в сидах обязана
существовать в справочнике — до правки это было неверно по построению.

```
$ npx tsx -e "…сверка uomId сидов со справочником MOCK_SETTINGS.uoms…"
batches        100 distinct: uom-kg,uom-t,uom-m2,uom-m,uom-pcs | unknown: []
offcuts         13 distinct: uom-pcs,uom-kg                    | unknown: []
movements       98 distinct: uom-m,uom-pcs,uom-kg              | unknown: []
deficit         20 distinct: uom-pcs,uom-kg                    | unknown: []
stock           72 distinct: uom-pcs,uom-m,uom-kg              | unknown: []
aggregates      10 distinct: uom-kg                            | unknown: []
activeSales      3 distinct: uom-kg                            | unknown: []
```

Ни одной неизвестной ссылки. 100 партий = 35+30+29+4+2 из воспроизведения.

**Л5 — один источник правила.** Убрано пять вторых экземпляров: `LINEAR_BATCH_UNITS`
(второе выражение линейности рядом с `REQUIRED_DIMENSION`), `STOCK_UNIT_BY_UOM_ID`
(мост ссылка↔строка), два `resolveUnitLabel`, локальный `unitLabel` резки. Проверка
на остаток:

```
$ grep -rn "code.en === \|u.code.en ||" src/ --include=*.ts --include=*.vue
useWarehouseBatchCreate.ts:198   label опций (value = u.id) — подпись, не сопоставление
ProductCardPage/ProductsPage/WarehousePage — сборка label опций, value = u.id
services/mocks/warehouse.ts:77   _resolveUomId
```

`_resolveUomId` **рассмотрен и оставлен**: после правки он не участвует в пути
`batch.unit` вовсе — единственный вызов нормализует `receivedUnitId` у сидов, а сиды
уже держат `uom-kg` (`grep -o "receivedUnitId: '[^']*'"` → две записи, обе `uom-kg`),
то есть ветка сегодня недостижима. Это чужое поле и чужая область; трогать его внутри
этого пункта значило бы «раз уж открыли файл».

**Л6 — UI и CSS.** Ни одного имени класса не изменено, ни одного `data-test` не
переименовано (`warehouse-stock-unit-filter`, `field-unit`, `field-received-unit` на
месте) — правка касается только выражений в биндингах. Разметка не двигалась.

**Л7 — права, флаги, роутинг.** Ни роутов, ни флагов, ни прав правка не касается.

**Л8 — сохранение и потеря данных.** Единица нигде не редактируется: и в карточке
партии, и в карточке остатка поле — `readonly` с `:value`, то есть в дельту
`useDirtyCheck.diff()` не попадает ни до, ни после. `mockPatchStockItem` применяет
дельту через `Object.assign`, имя поля ему безразлично. Отдельно закрыт единственный
путь потери — сохранённый фильтр в localStorage (раздел «Границы»).

**Л9 — тесты, которые ничего не утверждают.** Тесты тронуты, поэтому инверсия —
три штуки, каждая на своё утверждение.

*Инверсия 1 — вывод линейности.* `REQUIRED_DIMENSION['uom-mm']` → `['lengthMm','widthMm']`:

```
$ npx vitest run src/domain/cutting.spec.ts
× линейность ВЫВОДИТСЯ из таблицы требований, а не из второго списка
× метр и миллиметр — да, вес, штуки и площадь — нет
× 3 мм — это 0.003 метра и 3 миллиметра
× пять строк геометрии считают из размеров
Tests  4 failed | 29 passed (33)
```

Старая версия этого теста (`expect([...LINEAR_BATCH_UNITS]).toEqual(['m','mm'])`)
сверяла список сам с собой и на такую поломку не отреагировала бы вовсе.

*Инверсия 2 — единица движения.* `writeMovement`: `uomId: batch.uomId` → `'uom-pcs'`:

```
$ npx vitest run src/services/mocks/cutting.spec.ts
× на каждый кусок движение offcut на его материал
Tests  1 failed | 20 passed (21)
```

Ровно одно утверждение, ровно то, которое про это.

*Инверсия 3 — сиды.* Первой партии вернул код вместо ссылки (`uomId: 'kg'`):

```
$ npx vitest run src/domain/cutting.spec.ts
× каждая единица партии из сидов умеет считать размер куска
× у каждого обрезка из сидов есть размер под единицу его партии
Tests  2 failed | 31 passed (33)
```

Все три инверсии откачены, `npm run verify` после отката зелёный (раздел 3).

**Л10 — целостность.** `vue-tsc` чист по всему дереву, включая шаблоны — то есть
компилятор шаблонов прошёл по каждому изменённому `.vue` (питфолл #67). Роутер и
`i18n/admin/index.ts` не менялись. Полный набор Playwright — ниже.

---

## 5. Две правки, найденные линзами по ходу, а не текстом пункта

**(1) Запасной вариант подписи.** `unitLabel` возвращал сам аргумент, когда справочник
ещё не ответил. Пока туда приходил огрызок (`'kg'`) это читалось как единица; с этого
пункта приходит ссылка, и в окне до ответа сайдбара в таблице стоял бы `uom-kg`. Теперь
запасной вариант — короткая форма id, и правило «id без начала» живёт в одном месте
(`shortUomCode`), которое спрашивают и `orderLineUnit`, и подпись, а
`uomIdFromOrderLineUnit` — его обратная сторона.

Инверсия (Л9): вернул `?? unit` —

```
$ npx vitest run src/domain/uom.spec.ts
× склад присылает ССЫЛКУ — до ответа справочника видно `kg`, а не `uom-kg`
AssertionError: expected 'uom-kg' to be 'kg'
Tests  1 failed | 10 passed (11)
```

**(2) Имя помощника.** В шести представлениях подпись звалась `uomLabel`, в трёх
`unitLabel` — одна правка, два имени. Приведено к `unitLabel`, как в модуле заказов.

---

## 6. E2E — уровень 2, полный набор дважды

Правка задевает `src/services/mocks/index.ts` (диспетчер) и `src/i18n/admin/warehouse.ts` —
это общий пол по классификации `verify.md`, а на общем полу мало одного зелёного прогона.

```
$ cd frontend_vue && npm run test:e2e > e2e3.txt 2>&1; echo "exit=$?"
  1012 passed (16.9m)
exit=0

$ cd frontend_vue && npm run test:e2e > e2e4.txt 2>&1; echo "exit=$?"
  1012 passed (16.4m)
exit=0
```

Оба прогона на одном дереве, подряд, без правок между ними. Код возврата снят сразу после
команды, без конвейера; вердикт — по нему и по строкам `failed`/`flaky`, а не по последней
строке.

### Два прогона до этого были красными, и это НЕ код

Первый прогон дал 3 падения, второй — 10. Разбор:

- падают всякий раз РАЗНЫЕ спеки из разных модулей (клиенты, создание заказа, категории,
  раскладка, склад, smoke) — то есть не место в коде;
- снимок страницы у каждого падения одинаковый: в DOM только переключатель языка, то есть
  приложение не смонтировалось вовсе;
- `smoke.spec.ts` — единственный, кто ловит ошибки сети, — назвал причину:
  `FAILED net::ERR_NETWORK_CHANGED script http://localhost:5173/src/i18n/messages.ts`;
- `ip -o link show` на этой машине показывает docker-мосты и veth со свежими индексами
  (14272, 14273, 14437, 14477): контейнеры поднимались и гасли по ходу прогона, Chromium
  на смену интерфейса отвечает `ERR_NETWORK_CHANGED`, а `retries: 0` локально ничего не
  маскирует.

Проверка от обратного: набор склада — тот, который правка задевает сильнее всего —
прогнан отдельно и зелёный, `76 passed (1.6m)`, exit=0. После этого два полных прогона
подряд прошли начисто, без единой правки кода между красными и зелёными.

Вывод записан как есть: красное было средой, а не находкой. Доказательство — не «потом
позеленело», а названная сетевая ошибка в логе и изолированный зелёный прогон затронутой
области.

---

## 7. Вне гейта итерации

```
$ npm run audit          # npm audit --audit-level=high
found 0 vulnerabilities

$ npm run deadcode       # knip
Unused files (0) · Unused exports (59) · Unused exported types (22)
```

База 2026-08-25 — 59 экспортов и 22 типа. Роста нет: `StockUnit` ушёл из типов,
новых экспортов пункт не добавил (`shortUomCode` не экспортируется).

```
$ npm run test:unit:coverage
All files  100 stmts · 97.32 branch · 100 funcs · 100 lines     exit=0
```

Пороги (99/96/100/99) держатся.

---

## 8. Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 4d — batch.unit → uomId
Итераций: 3 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK · format OK · unit OK (566)
                   test:audit OK (97) · e2e уровень 2 — 1012/1012 дважды
Вне гейта:         npm run audit — 0 high · deadcode — 0 файлов, 59 экспортов, 22 типа
Линзы:             Л1–Л10 подтверждены
Найдено за прогон: 3       Починено: 3      Отклонено: 1 (`_resolveUomId`, вне области)
В bugs-file ушло:  0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Найдено и починено по ходу: колонка единицы в выборе товара, читавшая несуществующее поле;
сохранённый фильтр в localStorage, который после переезда не совпал бы ни с чем; запасной
вариант подписи, показывавший сырой id.

