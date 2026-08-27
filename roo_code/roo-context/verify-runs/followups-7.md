# Пункт 7 — обрезок можно выбрать в строке заказа

План: [`review-followups.md` § 7](../../plans/general/review-followups.md)
Прогон: 2026-08-27, автономный. Отметку ✅ в плане ставит не автор правки.

---

## 1. Воспроизведение

Пункт утверждает две вещи, и обе проверены грепом ДО единой правки.

**(а) В диалоге добавления позиций нет ни одного упоминания обрезков.**

```
$ grep -rn "offcut" -i src/views/admin/orders/
$ echo "exit=$?"
exit=0        # вывод пуст: ни одного совпадения во всём каталоге заказов
$ ls src/views/admin/orders/
AddLineModeChooser.vue  AddOrderItemsModal.vue  AddOrderServicesModal.vue
OrderCardPage.vue       OrderCreatePage.vue     OrdersListPage.vue
```

Пункт называл файлы `AddOrderItemsModal.vue` и `AddLineModeChooser.vue` — они лежат в
`src/views/admin/orders/`, а не в `src/components/admin/orders/` (такого каталога нет).
Совпадений ноль в обоих.

**(б) FIFO строится только из партий, `offcutId` жёстко `null`.**

```
$ grep -n "offcutId" src/services/mocks/warehouse.ts | head
…
1553:    offcutId: null,          ← внутри mockFifoAllocation
```

Прочитано целиком: `mockFifoAllocation` перебирает `batchesForProduct(productId)` и каждому
элементу `FifoBatch` проставляет `offcutId: null`. Обрезки в пул не попадают вовсе.

**Вывод:** пункт воспроизводится дословно. Обрезок в заказ не попадал ни одним путём.

---

## 2. Что сделано

Пункт принял решение сам («Разумно — только руками»), поэтому догадок здесь нет: обрезки в
автоматический FIFO НЕ попадают, а попадают выбором руками. Реализованы все четыре «Надо».

### Правило — одно и в одном месте

`src/services/orderLines.ts` → `offcutAllocation(offcut, batch)`. Что аллокация обрезка
устроена именно так, решает эта функция и только она:

- `batchId: null` — материал куска ушёл с партии в момент резки (`mockCreateOffcut` пишет
  движение `offcut`, а движение единственный владелец количества партии). Названная партия
  вычла бы его второй раз;
- количество — **материал куска в единице ПАРТИИ** через `resolveOffcutMaterial`, а не
  `offcut.quantity` (счётчик кусков, «1 шт»);
- себестоимость — цена партии-родителя за единицу;
- `null` — отказ, а не ноль: кусок, размер которого в единице партии невыразим, количества
  не имеет.

### Склад

- `mockGetOffcutOffers(productId)` — куски, которые строка может взять: только `available`,
  только этого товара, только выразимые. Собирает `OffcutOffer` через `offcutAllocation`;
- `mockOffcutAllocations(productId, ids)` — аллокации под выбранные куски, с поимёнными
  отказами `OFFCUT_NOT_FOUND` / `OFFCUT_PRODUCT_MISMATCH` / `OFFCUT_NOT_AVAILABLE` /
  `OFFCUT_SIZE_NOT_EXPRESSIBLE`;
- новый тип `OffcutOffer` и маршрут `GET /api/warehouse/offcuts/offers`. Отдельный тип и
  отдельный маршрут, потому что `OffcutListItem` не знает ни толщины, ни единицы партии, ни
  её цены — а без них кусок нельзя ни выразить в количестве строки, ни оценить. Считать это
  на клиенте значило бы завести вторую реализацию `offcutAllocation`.

Маршрут зарегистрирован **выше** `/offcuts/:id`: `/offcuts/offers` подходит под шаблон
карточки, и обобщённое совпадение увело бы запрос в «обрезок не найден».

### Заказ

- `POST /api/orders/:id/items` принимает `offcutIds`. Выбранные куски — это то, ЧЕМ строка
  уже покрыта; `coverFromStock` добирает остаток из партий FIFO, то есть кусок стоит первым
  и партией не подменяется;
- отказ `OFFCUTS_EXCEED_QUANTITY`, когда выбранных кусков больше, чем помещается в строку:
  обрезок неделим, и урезать его значило бы списать половину куска;
- отказ `OFFCUTS_WITH_BATCH` — партия целиком и отдельные куски это два разных ответа на
  один вопрос, и ниже победил бы прочитанный первым;
- `mockReserveOrder` держит именно кусок: `batchId: null`, `offcutId` — свой. Без этой
  ветки строка, покрытая обрезком, никогда не становилась бы «зарезервирована» целиком
  (`fullyReserved` считает по `reservedForLine`). `holdOnBatch` теперь ключуется парой
  (партия, кусок), иначе два разных обрезка (у обоих `batchId` пустой) слились бы в один
  хват. Для существующих вызовов это ноль изменений: во всех них `offcutId` был `null`.

### Экран

`AddOrderItemsModal.vue`: под каждой выбранной строкой — таблица доступных обрезков
(размеры, вес, партия-родитель ссылкой на её карточку, место хранения, сколько кусок
заберёт из строки). Выбор пишет `offcutIds` и **поднимает количество строки** под выбранные
куски, чтобы отказ сервера не прилетал на сохранении. Рядом — ссылка «Создать обрезок» на
экран резки (`admin-warehouse-cutting`), показывается только при включённом флаге
`warehouseCutting`: ссылка на маршрут, который отобьёт гвард, — мёртвая ссылка.

Список спрашивается только для товаров, уже положенных в заказ, и сбрасывается при каждом
открытии диалога — кусок мог уйти в другой заказ между двумя открытиями.

### Чего пункт НЕ просил и чего здесь нет

Отгрузки обрезка нет. `planShipment` пропускает аллокацию без партии (`if (!batch) continue`)
и сообщает недостачу — то есть отказа-падения не будет, но списать кусок с полки движением
`sale` сегодня нельзя. Это отдельное решение (списывать ли партию-родителя второй раз, как
кусок помечается проданным), и пункт 7 его не принимает. Записано здесь, чтобы никто не
принял «выбрать можно» за «продать можно до конца».

---

## 3. Файлы

```
frontend_vue/src/services/orderLines.ts                     offcutAllocation — правило
frontend_vue/src/types/warehouse.ts                         OffcutOffer
frontend_vue/src/services/warehouseService.ts               getOffcutOffers
frontend_vue/src/services/mocks/warehouse.ts                mockGetOffcutOffers, mockOffcutAllocations
frontend_vue/src/services/mocks/index.ts                    маршрут /offcuts/offers
frontend_vue/src/services/mocks/orders.ts                   offcutIds в POST /items, ветка резерва
frontend_vue/src/services/mocks/reservations.ts             reservedOnOffcut, ключ хвата
frontend_vue/src/services/ordersService.ts                  offcutIds в payload
frontend_vue/src/services/orderLineEdits.ts                 шесть кодов → сообщения
frontend_vue/src/composables/useOrderCard.ts                проброс offcutIds
frontend_vue/src/composables/useOrderCreate.ts              проброс offcutIds
frontend_vue/src/i18n/admin/orders.ts                       15 ключей × 3 локали
frontend_vue/src/views/admin/orders/AddOrderItemsModal.vue  выбор кусков + ссылка
frontend_vue/src/services/mocks/offcut-order-pick.spec.ts   новая спека (6 проверок)
frontend_vue/src/services/mocks/offcut-offers-route.spec.ts новая спека (2 проверки)
frontend_vue/tests/e2e/admin/orders/order-offcuts.spec.ts   новая e2e-спека (3 проверки)
roo_code/plans/orders/orders-backend-contract.md            §6 коды, §5 payload
roo_code/roo-context/03-api-contract.md                     GET /offcuts/offers
```

---

## 4. Машинная приёмка

```
$ cd frontend_vue && npm run verify
> typecheck · lint · dupes · format:check · test:unit
vue-tsc --noEmit                       — без вывода, exit 0
eslint src/ tests/ *.ts --max-warnings=0 — без вывода, exit 0
jscpd: Total 543 files, 682 clones, 18878 (9.32%) — порог 10 % в .jscpd.json
prettier --check src/ tests/           — All matched files use Prettier code style!
vitest run                             — Test Files 27 passed, Tests 588 passed (было 25 / 580)
exit=0
```

```
$ npm run test:audit
 Test Files  22 passed (22)
      Tests  97 passed (97)
```

**Приёмка нашла настоящее — дважды, и оба раза до коммита.**

1. `order-audit-authority-1` покраснел: `POST item quantity = -5` возвращал
   `OFFCUTS_EXCEED_QUANTITY` вместо отказа про количество. Причина: сумма пустого набора
   кусков — ноль, а `0 > -5` истинно. Проверка сужена до `chosen.length > 0 && …`;
2. `order-audit-contract-conformance` покраснел дважды: шесть новых кодов не были в §6
   контракта, и четыре из них были заведены в таблице сообщений, но «никем не бросаются»
   (они бросаются в `warehouse.ts`, которого нет в списке источников спеки). Обе половины
   закрыты записью раздела «Обрезки, выбранные руками» в §6.

Вне гейта:

```
$ npm run audit     → found 0 vulnerabilities
$ npm run deadcode  → Unused exports (58), Unused exported types (21)
                      база из verify.md — 59 и 22, то есть не выросло
$ npx vite build    → ✓ built in 8.14s, exit 0   (питфолл #67: шаблон компилируется)
```

---

## 5. Линзы

| Линза | Чем проверял | Что вернулось | Вывод |
|---|---|---|---|
| **Л1** реактивность | чтение всех новых `ref` в модалке | `Map`/`Set` заменяются целиком (`new Map(...)`), `watch({deep:true})` не добавлялся, `structuredClone`/`toRaw` не появились | чисто |
| **Л2** i18n | скрипт-счётчик по `src/i18n/admin/orders.ts` | все 15 ключей ровно по 3 вхождения (ru/en/lt), `@` в новых значениях нет | чисто |
| **Л3** контракт и HTTP | новая спека `offcut-offers-route.spec.ts` через сервисный слой + `test:audit` | 2 passed; conformance-спека сверяет §6 с тем, что бросает мок | чисто после правки контракта |
| **Л4** мок = правда | чтение `mockGetOffcutOffers` / `mockOffcutAllocations` | возвращают новые объекты, а не ссылку на `offcutStore`; русских строк в данные не добавлено | чисто |
| **Л5** один источник | `grep -rn "offcutId:" src/ \| grep -v null` и `grep -rn resolveOffcutMaterial src/` | аллокацию из обрезка строит ровно одно место — `orderLines.ts:242`; обе функции мока зовут его | чисто |
| **Л6** UI и CSS | чтение шаблона + `npx vite build` | `name-link` определён локально (#63), пустое состояние внутри карточки и не мигает при загрузке (#30, #52), брейкпоинт 600px (#29), `@click` однооператорный (#67), HTML-комментариев в шаблоне нет (#9) | чисто |
| **Л7** права, флаги, роутинг | `grep -n "admin-warehouse-cutting\|admin-warehouse-batch" src/router/index.ts` | обе строки есть; ссылка на резку под флагом `warehouseCutting`; новых флагов не заведено | чисто |
| **Л8** сохранение | чтение `save()` в `useOrderCard` | ошибка добавления строки идёт через `lineEditErrorKey`, невыведенная строка остаётся в `pendingItems`; clean-slate не нарушен — выбор кусков живёт локально до Save | чисто |
| **Л9** тесты | инверсия, 7 штук — см. ниже | каждое проверяемое поведение краснит СВОЙ тест | чисто |
| **Л10** целостность | `git status`, роутер и i18n-индекс не менялись | новых маршрутов и доменов переводов нет; `npx vite build` поднимается | чисто |

### Л9 — инверсия по каждому утверждению

Ломалось по одному, спека прогонялась, поведение возвращалось точной обратной заменой
(`git restore` запрещён и не применялся).

| Что сломано | exit | Покраснело |
|---|---|---|
| `mockGetOffcutOffers` перестал фильтровать по `status` | 1 | 4 теста, включая «предлагает только свободные куски» |
| `mockFifoAllocation` стал возвращать `offcutId` | 1 | «в автоматический FIFO обрезки не попадают» |
| выбранные куски выброшены из `coverFromStock` | 1 | «выбранный кусок становится аллокацией», «резервирование держит кусок» |
| снят отказ `OFFCUTS_EXCEED_QUANTITY` | 1 | «отказывает, когда куски не помещаются» |
| снят отказ `OFFCUT_PRODUCT_MISMATCH` | 1 | «отказывает куску чужого товара» |
| ветка обрезка убрана из `mockReserveOrder` | 1 | «резервирование держит именно этот кусок» |
| маршрут `/offcuts/offers` убран из диспетчера | 1 | обе проверки маршрута |

Ни один тест не остался зелёным на сломанном поведении.

---

## 6. E2E

Правка задела `src/services/mocks/index.ts` — общий пол по классификации `verify.md`,
поэтому уровень 2: полный набор, дважды на одном дереве.

Новая спека `tests/e2e/admin/orders/order-offcuts.spec.ts` — три проверки. Товар и номер
партии читаются с самой складской вкладки (питфолл #15: данные не зашиты), свободный кусок
узнаётся по кнопке «отметить использованным» — она рисуется только при статусе `available`.
Признак — строка про ИМЕННО ЭТОТ кусок, а не «панель появилась» (#64). Количество перед
выбором ставится в 0.01, чтобы подтягивание было видно любым куском: «стало не меньше
материала» устроило бы и бездействие (#68).

Инверсия по каждой из трёх (правка возвращалась точной обратной заменой):

| Что сломано | Покраснело |
|---|---|
| таблица кусков перестала рисоваться | 2 из 3 |
| снято подтягивание количества | «выбор куска поднимает количество» |
| убрана ссылка на резку | «рядом стоит ссылка на экран резки» |

Полные прогоны — код возврата снят сразу после команды, вердикт по строкам
`passed`/`failed`/`flaky`, а не по последней строке:

```
$ npx playwright test --workers=3 > p7-e2e-A.txt 2>&1; echo "exit=$?"
  1015 passed (17.7m)
exit=0
$ grep -cE " failed| flaky| skipped" p7-e2e-A.txt
0

$ npx playwright test --workers=3 > p7-e2e-B.txt 2>&1; echo "exit=$?"
  1015 passed (17.8m)
exit=0
```

Пара зелёная на одном дереве.

---

## 7. Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 7 — выбор обрезков в заказе
Итераций: 3 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK (9.32%) · format OK · unit OK (588)
                   test:audit OK (97) · e2e уровень 2 — 1015 passed ×2
Вне гейта:         npm run audit — 0 high · deadcode — 58 экспортов, 21 тип (база 59/22)
Линзы:             Л1–Л10 подтверждены
Найдено за прогон: 3       Починено: 3      Отклонено: 0
В bugs-file ушло:  0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Три находки — все свои и все от приёмки, не от чтения: отказ про количество, перекрытый
отказом про обрезки; шесть кодов вне §6 контракта; четыре кода с сообщением, но «никем не
бросаемые». Все три починены до коммита.
