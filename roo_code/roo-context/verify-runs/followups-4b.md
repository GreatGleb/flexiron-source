# Пункт 4b — код единицы по-английски в ХРАНИМЫХ данных (карточка товара)

План: [`review-followups.md` § 4b](../../plans/archive/2026-08/review-followups.md)
Прогон: 2026-08-27, автономный. Отметку ✅ в плане ставит не автор правки.

---

## 1. Воспроизведение

```
$ sed -n '200,215p' frontend_vue/src/views/admin/products/ProductCardPage.vue
  // Use product's priceUnit (reconstructed by backend) or build from currency + saleUom
  const unit =
    product.value?.priceUnit ||
    (form.value.currencyId && form.value.saleUomId
      ? `${settings.currencies.find(...)?.code ?? ''}/${settings.uoms.find(...)?.code.en ?? ''}`
      : null)
  const entry: LinkedSupplier = {
    ...
    priceUnit: unit,
```

Дефект на месте: `uom.code.en` — код единицы всегда английский, и собранная строка не
показывается, а уходит в `LinkedSupplier.priceUnit`, то есть в данные.

Второе утверждение пункта («у `Product.priceUnit` ровно один читатель — эта самая строка»)
проверено грепом:

```
$ grep -rn "\.priceUnit" frontend_vue/src frontend_vue/tests
src/views/admin/products/ProductCardPage.vue:205:    product.value?.priceUnit ||
src/domain/servicePricing.spec.ts:76:   # комментарий про услуги
src/views/admin/orders/AddOrderServicesModal.vue:98:  # комментарий про услуги
src/services/mocks/services.ts:81:      # комментарий про услуги
src/types/service.ts:16:               # комментарий про услуги
```

Единственное настоящее чтение — строка 205. У `LinkedSupplier.priceUnit` и
`ProductListItem.priceUnit` читателей нет вовсе: ни одного `s.priceUnit` в шаблонах.

---

## 2. Что сделано

**Хранится ссылка, а не подпись.** `LinkedSupplier.priceUnit: string | null` →
`priceUomId: string | null` — id единицы из справочника. Валюта цены поставщика уже лежит
рядом в `currency`, второй раз хранить её в склеенной строке значило бы завести вторую
правду об одной величине (Л5). Подпись собирается там, где её показывают — как у услуг
(`serviceUnitLabel`).

Переименование, а не смена значения при том же имени: `priceUnit` со значением `uom-kg`
врал бы следующему читателю.

**Легаси-поле удалено.** `Product.priceUnit` (помечено `legacy: reconstructed from
currency+saleUom`) держалось ради строки 205 — она ушла, поле тоже. За ним обязан был уйти
`ProductListItem.priceUnit`: его заполняла `toListItem()` из `p.priceUnit`, других
источников нет. Клиент это поле никогда и не отправлял — ни `createProduct`, ни
`patchProduct` его в payload не кладут (проверено чтением `productsService.ts`).

| Файл | Что |
|---|---|
| `src/types/product.ts` | `LinkedSupplier.priceUnit` → `priceUomId` + комментарий почему; удалены `Product.priceUnit` и `ProductListItem.priceUnit` |
| `src/views/admin/products/ProductCardPage.vue` | `submitAddSupplier()` пишет `priceUomId: form.value.saleUomId \|\| null`; склейка подписи удалена |
| `src/views/admin/products/CategoryCardPage.vue` | `priceUnit: null` → `priceUomId: null` |
| `src/services/mocks/products.ts` | 135 подписей поставщиков → id (`EUR/vnt`→`uom-pcs`, `EUR/kg`→`uom-kg`, `EUR/m`→`uom-m`); 119 строк `Product.priceUnit` удалены вместе с полем в create/patch/toListItem |
| `src/services/mocks/categories.ts` | 26 `priceUnit: null` → `priceUomId: null` (все внутри `linkedSuppliers`) |
| `tests/e2e/mocks/warehouse.ts` | то же в мок-ответе `prod-001` |
| `src/types/service.ts`, `src/domain/servicePricing.ts`, `src/domain/servicePricing.spec.ts`, `src/domain/cutting.ts` | четыре комментария описывали дефект в настоящем времени («как это делает карточка товара») — после правки это ложь, время исправлено |

Чего **не** трогал: `priceUnit` услуг (`ServicePriceUnit`, разделы услуг в контракте) —
это открытый пункт 4; `useWarehouseBatchCreate.ts:131` пишет `uom.code.en` в `form.unit`,
та же болезнь в партиях — это открытый пункт 4d.

**Контракт.** `roo_code/roo-context/03-api-contract.md`: `priceUnit` убран из примеров и
payload'ов `POST /api/products`, `PATCH /api/products/:id`, `GET /api/products`,
`GET /api/products/:id`, из строки Save UX; в `linkedSuppliers` показан `priceUomId`;
в Notes к PATCH добавлено, что это ссылка на справочник, а не подпись. Разделы услуг не
тронуты.

---

## 3. Приёмка

```
$ cd frontend_vue && npm run verify
exit=0
  typecheck   — vue-tsc --noEmit, пусто
  lint        — eslint --max-warnings=0, пусто
  dupes       — Total 9.36 % при пороге 10 % (было 9.69 %: удалились дублирующиеся строки моков)
  format      — All matched files use Prettier code style!
  test:unit   — Test Files 21 passed (21), Tests 553 passed (553)
```

E2E, уровень 1 (правка в одной области: карточка товара, карточка категории, мок склада —
`tests/e2e/mocks/warehouse.ts` читает только `warehouse.spec.ts`, проверено
`grep -rln "mocks/warehouse" tests/`):

```
$ npx playwright test tests/e2e/admin/products/products.spec.ts \
    tests/e2e/admin/products/categories.spec.ts \
    tests/e2e/admin/warehouse/warehouse.spec.ts --workers=3 --reporter=line > e2e-4b.txt 2>&1
exit=0
151 passed (4.7m)      # строк failed / flaky / skipped в выводе нет
```

Полный набор не гонялся: общий пол (`tests/e2e/helpers/`, диспетчер моков, i18n, роутер,
глобальный CSS) не тронут.

---

## 4. Линзы

| Линза | Чем проверял | Что вернулось | Вывод |
|---|---|---|---|
| **Л1** реактивность | `grep -n "structuredClone\|toRaw(\|useHead(\|watch(" ProductCardPage.vue CategoryCardPage.vue types/product.ts` | `useHead` ×2, `watch` и `toRaw` в CategoryCardPage — всё вне правки | чисто: правка — чтение `form.value.saleUomId` внутри обработчика, новых watch/computed нет |
| **Л2** i18n | `git status --short` по `src/i18n/` | ни одного файла | чисто: ключей не добавлял и не удалял, в DOM ничего нового не выводится |
| **Л3** контракт | чтение `productsService.ts` целиком + `grep -n "priceUnit" 03-api-contract.md` | в сервисе `priceUnit` не отправлялся никогда; в контракте остались только разделы услуг | чисто: методы и пути не менялись, write-back сделан |
| **Л4** мок = правда | скрипт-сверка: для каждого `prod-*` в `mocks/products.ts` сравнить `saleUomId` товара с `priceUomId` каждого его поставщика | `несовпадений: 0` | чисто: мок не украшен, единица поставщика та же, что единица продажи товара. Заодно: старое значение в моке было `EUR/vnt` — литовский код, тогда как код писал английский; расхождение видно было прямо в моке |
| **Л5** один источник | `grep -rn "code\.en" src/ tests/` и `grep -rn '}/\${' src/` | склейка подписи осталась ровно одна — `serviceUnitLabel` в `src/domain/servicePricing.ts:28`, локале-зависимая; в карточке товара второй склейки больше нет | чисто в области правки. Вне области: `useWarehouseBatchCreate.ts:131` пишет `code.en` в хранимое `form.unit` — это пункт 4d плана, не завожу дубль |
| **Л6** UI/CSS | `git diff` по двум `.vue` | обе правки внутри `<script setup>`, `<template>` не тронут | чисто: визуальных изменений нет — поле и раньше нигде не отображалось |
| **Л7** права/флаги/роутинг | `git status --short` по `src/router/`, `src/config/featureFlags.ts`, `tests/e2e/helpers/flags.ts` | ни одного файла | чисто |
| **Л8** сохранение | чтение `useProductCard.ts:98-127,220-254` | baseline `originalLinkedSuppliers` — `JSON.stringify` загруженного массива; порядок ключей нового элемента (`id,name,price,priceUomId,leadDays,currency`) совпадает с моковым | чисто: dirty-детект не сломан, `load()` не трогал |
| **Л9** тесты | инверсия: в `serviceUnitLabel` заменил `uom.code[key] \|\| uom.code.en` на `uom.code.en` | `expect(...'lt').toBe('EUR/vnt')` → `Received: "EUR/pcs"`, `Test Files 1 failed`, затем восстановление и `diff` с копией — расхождений нет, `11 passed` | тест настоящий. Трогал я в спеке только комментарий; утверждения не менял |
| **Л10** целостность | `npm run verify` (typecheck по всему `src/` и `tests/`) + подъём dev-сервера через `webServer` в `playwright.config.ts` при e2e-прогоне | зелено, сервер поднялся | чисто |

Находок за прогон: 0 новых. В bugs-file ничего не уходило.

---

## 5. Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 4b review-followups
Итераций: 1 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes 9.36 % · format OK · unit 553/553 · e2e ур. 1 — 151 passed
Линзы:             Л1–Л10 подтверждены
Найдено за прогон: 0       Починено: 0      Отклонено: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Замечание о дереве: в момент прогона в рабочем каталоге лежали чужие незакоммиченные
правки (`mocks/notifications.ts`, `mocks/orders.ts`, `mocks/bcc.ts`,
`mocks/warehouse.ts`, новый `notification-triggers.spec.ts`) — параллельная задача по
уведомлениям. В коммит 4b они не попали: `git add` перечислял файлы поимённо.
Приёмка прогонялась на дереве вместе с ними и была зелёной.

---

# Второй заход, 2026-08-28: недостающая проверка

Приёмка отклонила первый заход не за код. Код верен и лежит коммитом `c7e15c8`; приёмщик
восстановил дефект в `ProductCardPage.vue:209` — `priceUomId` снова стал собранной подписью
`${currency.code}/${uom.code.en}` — и **весь гейт остался зелёным**: typecheck 0, vitest
passed, `products.spec.ts` 61 passed. То есть правку ничто не держало.

Причина: единственный e2e, доходящий до `submitAddSupplier` («confirm adds supplier to list»),
утверждает только, что модалка скрылась и текста `No suppliers linked` нет. Что записалось в
данные — не смотрит, и любое значение поля его устраивает. Это питфолл #64 в чистом виде:
ждали элемент вместо того, что должно было оказаться в данных.

## 1. Воспроизведение

```
$ grep -rn "priceUomId" frontend_vue/tests/
(пусто)
```

Утверждения про хранимую единицу в тестах нет ни одного — подтверждено на текущем дереве.

Код на месте и верен (менять его запрещено):

```
$ sed -n '203,211p' frontend_vue/src/views/admin/products/ProductCardPage.vue
  const entry: LinkedSupplier = {
    ...
    priceUomId: form.value.saleUomId || null,
```

## 2. Что сделано

Один новый тест в `frontend_vue/tests/e2e/admin/products/products.spec.ts` —
`product-card › suppliers › added supplier keeps the unit as a dictionary id, not a composed label`.
Кода приложения не тронуто ни строки (`git diff -- src/views/admin/products/ProductCardPage.vue`
пуст).

**Почему через хранилище, а не через DOM.** Единица поставщика нигде не отображается: в
таблице поставщиков карточки три колонки — имя, цена, срок (`ProductCardPage.vue:638-640`).
Проверить хранимое поле через разметку нельзя в принципе, поэтому тест читает то самое
хранилище, куда ушло сохранение. Под моками запроса в сеть нет — роль бэкенда играет
мок-модуль, а dev-сервер Vite отдаёт его по URL исходника, и приложение уже загрузило ровно
этот URL. Значит `import('/src/services/mocks/products.ts')` внутри `page.evaluate` возвращает
ТОТ ЖЕ экземпляр модуля, а не вторую копию данных.

Утверждений три, и каждое своё:

| Утверждение | Что ловит |
|---|---|
| `before.saleUomId` совпадает с `/^uom-/` | положительный контроль: без единицы продажи у товара сравнивать было бы не с чем, и остальное прошло бы на любом коде |
| `added[0].priceUomId === before.saleUomId` | в данные уехала ссылка, а не подпись |
| справочник единиц содержит `added[0].priceUomId` | ссылка разрешается: собранная строка в справочнике не находится никогда — то есть тест краснеет и на литовской подписи `EUR/vnt`, а не только на английской |

Перед чтением хранилища тест жмёт Save и ждёт, пока кнопка снова станет неактивной: добавление
поставщика — clean-slate, до сохранения данные его не видят.

## 3. Инверсия (Л9) — главное доказательство

Дефект восстановлен ровно тем же способом, каким его восстанавливал приёмщик: `priceUomId`
снова собирается из `currency.code` и `uom.code.en`.

```
$ npx vue-tsc --noEmit
typecheck exit=0                       # статика на дефекте молчит, как и раньше

$ npx playwright test tests/e2e/admin/products/products.spec.ts -g "dictionary id" --workers=1 --reporter=line
e2e exit=1
  Error: в данные уехала подпись вместо ссылки
  Expected: "uom-pcs"
  Received: "EUR/pcs"
  1 failed
```

Дальше файл восстановлен из копии (не `git restore`), расхождения с закоммиченным нет:

```
$ git diff -- src/views/admin/products/ProductCardPage.vue | wc -l
0
```

и тест снова зелёный (см. прогон ниже). То есть красное вызвано именно дефектом, а не
случайностью.

## 4. Приёмка

```
$ cd frontend_vue && npm run verify
exit=0
  typecheck   — vue-tsc --noEmit, пусто
  lint        — eslint --max-warnings=0, пусто
  dupes       — 9.20 % при пороге 10 %
  format      — All matched files use Prettier code style!
  test:unit   — Test Files 30 passed (30), Tests 643 passed (643)
```

E2E, уровень 1 (правка — в самом спеке, область та же карточка товара):

```
$ npx playwright test tests/e2e/admin/products/products.spec.ts --workers=3 --reporter=line > e2e-products.txt 2>&1
exit=0
62 passed (2.0m)      # строк failed / flaky / skipped в выводе нет; было 61, стало 62
```

## 5. Линзы

| Линза | Чем проверял | Что вернулось | Вывод |
|---|---|---|---|
| **Л9** тесты | инверсия (раздел 3) + `grep -rn "await page.waitForLoadState" frontend_vue/tests/` | тест краснеет на восстановленном дефекте; греп пуст (exit 1) | подтверждена: утверждение настоящее, ожиданий по времени не заведено |
| **Л3** контракт | `grep -n "priceUnit" roo_code/roo-context/03-api-contract.md` | пусто | чисто: контракт про удалённое поле больше не говорит, эндпоинты не менялись |
| **Л5** один источник | `grep -rn "import(url)\|/src/services/mocks/" frontend_vue/tests/` | три строки, все внутри одного хелпера `storedProduct` | чисто: второй реализации чтения хранилища из браузера нет |
| **Л10** целостность | `npm run verify` (typecheck по `src/` и `tests/`) + подъём dev-сервера при e2e | зелено, сервер поднялся | чисто |
| **Л1, Л2, Л4, Л6, Л7, Л8** | `git status --short` | изменены только `tests/e2e/admin/products/products.spec.ts`, `roo-context/frontend-types.md`, `roo-context/frontend-services.md` | не применимы: кода приложения, переводов, моков, стилей, флагов и логики сохранения не тронуто |

## 6. Заодно: контекстные документы

`roo_code/roo-context/frontend-types.md` и `frontend-services.md` описывали удалённое поле
`priceUnit` — пять мест:

- `LinkedSupplier.priceUnit` → `priceUomId: string | null` с пометкой, что это id справочника,
  а не подпись;
- `ProductListItem.priceUnit` и `Product.priceUnit` — строки убраны, полей нет в коде
  (`src/types/product.ts`);
- схема связей в конце файла — `LinkedSupplier (id, name, price, priceUomId, leadDays)`;
- `frontend-services.md`, тип `delta` у `patchProduct` — `'priceUnit'` убран из `Pick`.

```
$ grep -rn "priceUnit" roo_code/roo-context/frontend-types.md roo_code/roo-context/frontend-services.md
(пусто)
```

## 7. Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 4b — недостающее утверждение
Итераций: 1 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes 9.20 % · format OK · unit 643/643 · e2e ур. 1 — 62 passed
Линзы:             Л3, Л5, Л9, Л10 подтверждены; Л1, Л2, Л4, Л6, Л7, Л8 не применимы (кода приложения нет в правке)
Найдено за прогон: 0       Починено: 0      Отклонено: 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Заготовка прошлого агента из `git stash` («недостающее утверждение по 4b») прочитана и взята
за основу: подход тот же, инверсия прогнана заново на текущем дереве. Сам stash не тронут.
