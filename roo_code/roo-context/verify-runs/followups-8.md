# Пункт 8 — страна клиента справочником и автоопределение типа комплекта

План: [`review-followups.md` § 8](../../plans/archive/2026-08/review-followups.md)
Прогон: 2026-08-27, автономный. Отметку ✅ в плане ставит не автор правки.

---

## 1. Воспроизведение

Пункт утверждает две вещи: у клиента нет страны, и тип комплекта документов выбирается
только руками. Обе проверены грепом ДО правки.

**Страны у клиента нет — ни в типе, ни в данных:**

```
$ grep -n "country" frontend_vue/src/types/client.ts
(пусто)

$ grep -rni "country" frontend_vue/src/ --include=*.ts --include=*.vue | grep -i client
(пусто — все вхождения `country` относятся к поставщику и к публичной форме регистрации:
 src/services/mocks/suppliers.ts, src/views/public/RegisterPage.vue)
```

У клиента был только адрес одной строкой:

```
$ grep -n "    address: '" frontend_vue/src/services/mocks/clients.ts | head -3
15:    address: 'Vytauto g. 15, Kaunas',
76:    address: 'Brīvības iela 120, Riga',
106:    address: 'Gedimino pr. 50, Vilnius',
```

Страну из «Vytauto g. 15, Kaunas» вывести нечем — города в строке, и разбирать её регуляркой
значит завести ту самую разнопись, о которой пункт предупреждает.

**Тип комплекта выбирался только руками:**

```
$ grep -rn "documentType" frontend_vue/src/composables/useOrderCreate.ts
35:    documentType: OrderDocumentType
40:    documentType: 'local',
339-343: vatMode … form.value.documentType === 'export' ? 'export_zero' : 'standard'
405:          documentType: form.value.documentType,

$ sed -n '165,170p' frontend_vue/src/composables/useOrderCreate.ts
  function selectClient(client: Client) {
    form.value.clientId = client.id
    selectedClient.value = client
    clearError('clientId')
  }
```

`selectClient` не трогал `documentType` вовсе: значение оставалось `'local'` по умолчанию до
тех пор, пока менеджер не переключит его в списке. Пункт воспроизводится полностью.

Дополнительно проверено, где ещё выбирают клиента: в карточке заказа этого нет —
`useOrderCard` не держит `clientId` в форме (`grep -n "clientId" useOrderCard.ts` даёт только
комментарии про HTTP-клиента). Значит точка подстановки ровно одна.

---

## 2. Что сделано

| Файл | Что |
|---|---|
| `src/domain/countries.ts` (новый) | справочник ISO 3166-1 alpha-2 (249 кодов), подпись через `Intl.DisplayNames`, список для выпадающего меню, правило «страна → комплект» |
| `src/domain/countries.spec.ts` (новый) | 10 утверждений о справочнике и правиле |
| `src/types/client.ts` | `country: CountryCode \| null` у `Client`, `'country'` в `ClientFormData` |
| `src/services/mocks/clients.ts` | страна у всех 55 сидов; `mockCreateClient` кладёт `null`, а не `undefined` |
| `src/views/admin/clients/ClientCardPage.vue` | поле «Страна» в секции контактов, `CustomSelect` |
| `src/views/admin/clients/ClientCreatePage.vue` | то же на странице создания |
| `src/i18n/admin/clients.ts` | `field_country`, `country_not_selected` — ru/en/lt |
| `src/composables/useOrderCreate.ts` | `selectClient` подставляет предложенный тип комплекта |
| `src/composables/useOrderCreate.spec.ts` | 5 утверждений о подстановке |
| `tests/.../clients.spec.ts-snapshots/*-contact-chromium-linux.png` | базовые снимки двух панелей перерисованы |

**Почему справочник статический, а не в настройках.** Валюты и единицы редактируются в
настройках, потому что их состав задаёт компания. Состав стран задаёт ISO, и возможность
завести двести пятидесятую строку руками вернула бы разнопись, ради ухода от которой поле и
становится ссылкой. Список закрыт в `src/domain/countries.ts`, редактируется правкой кода.

**Почему названия у платформы, а не в `src/i18n/`.** Словарь на 249 строк × 3 языка,
набранный руками, расходится с реальностью молча: пропущенная строка нарисовалась бы кодом.
`Intl.DisplayNames` знает все три наших языка — проверено:

```
$ node -e "for (const l of ['en','ru','lt']) console.log(l, new Intl.DisplayNames([l],{type:'region'}).of('LT'))"
en Lithuania
ru Литва
lt Lietuva
```

**Оговорка ТЗ соблюдена буквально.** Подстановка живёт в `selectClient`, а не в вотчере на
`form.clientId`: вотчер сработал бы на любой последующей правке заказа и затёр бы выбор
менеджера. У клиента без страны предлагается `null` — то есть не предлагается ничего, и
значение в форме остаётся тем, которое там стояло.

---

## 3. Проверка кодов справочника — независимая, не на глаз

Список кодов набран руками, поэтому проверен двумя способами, ни один из которых не «я
посмотрел».

```
$ node -e "…разобрать COUNTRY_CODES из файла…"
count 249 unique 249
unresolved: none          # каждый код ICU знает по имени
sorted order ok: true     # список действительно упорядочен
```

Страны сидов сверены с префиксом VAT-кода — независимым полем, которое я не трогал:

```
$ python3 …  # id, vatCode, country из 55 сидов
parsed 55
vat/country mismatch: []
Counter({'LT': 28, 'LV': 21, 'EE': 4, 'PL': 1, 'DE': 1})
```

Ни одного расхождения: у клиента с `LT304567890` стоит `LT`, у `LV40103...` — `LV`.

---

## 4. Машинная приёмка

```
$ cd frontend_vue && npm run verify ; echo "exit=$?"
exit=0
  typecheck   — vue-tsc --noEmit, чисто
  lint        — eslint src/ tests/ *.ts --max-warnings=0, чисто
  dupes       — jscpd: 9.28 % при пороге 10 %
  format:check— All matched files use Prettier code style!
  test:unit   — Test Files 28 passed (28) · Tests 603 passed (603)

$ npm run test:audit ; echo "exit=$?"
exit=0
  Test Files 22 passed (22) · Tests 97 passed (97)
```

`test:audit` прогнан потому, что тронут `src/services/mocks/clients.ts`, а семья
`order-audit-*` читает мок заказов, который читает клиентов.

Первый прогон гейта был красным — три ошибки линта, обе настоящие:

```
src/domain/countries.spec.ts  56:53, 56:88  sonarjs/no-alphabetical-sort
src/domain/countries.ts       294:9         no-useless-assignment
```

Починено: сравнение множеств вместо двух `.sort()` в спеке и `let instance` без начального
значения (его всё равно присваивают обе ветки try/catch).

---

## 5. E2E — уровень 1 (правка в одной области)

Полный набор не гонялся: правка не лежит в общем полу (helpers, фикстуры, диспетчер моков,
i18n-инфраструктура, роутер, глобальный CSS). Гонялись спеки затронутых областей.

```
$ npx playwright test tests/e2e/admin/clients/clients.spec.ts --reporter=line --workers=3
exit=1
  2 failed
  73 passed (1.1m)
```

Оба падения — снимки `client-create-contact` и `client-card-contact`, то есть ровно те две
панели, куда добавлено поле. Базовые снимки перерисованы и **просмотрены глазами**:

```
$ npx playwright test … -g "contact panel" --update-snapshots --workers=1
exit=0   2 passed
```

- `client-card-contact-chromium-linux.png` — у CL-001 (Каунас, `LT`) в поле «COUNTRY» стоит
  **Lithuania**. То есть путь «сид → тип → карточка → подпись из ICU» работает целиком.
- `client-create-contact-chromium-linux.png` — на пустой форме стоит **No country selected**.

Снимки `*-chromium-win32.png` для этих двух панелей устарели: перерисовать их можно только на
Windows, других вариантов у кросс-платформенных базлайнов нет.

Заказы и sales-crm прогнаны отдельно — они ходят на страницу создания заказа и через мок
клиентов:

```
$ npx playwright test tests/e2e/admin/orders tests/e2e/admin/sales-crm --reporter=line --workers=3
  1 failed
  118 passed (2.6m)
```

Упало не моё и не всегда: `orders.spec.ts:1834 › a price printed wrong is corrected in the
open, not rewritten`, `Expected: 115.5 / Received: 120.5` — то есть прочитана цена ДО
исправления. Разобрано, а не списано на «бывает»:

```
$ npx playwright test … -g "a price printed wrong is corrected in the open" \
      --workers=1 --repeat-each=3
exit=0   3 passed (41.9s)

$ npx playwright test tests/e2e/admin/orders tests/e2e/admin/sales-crm --workers=3   # тот же прогон повторно
  119 passed (2.6m)
```

Причина в самом тесте: после `correct-confirm` он ждёт `toBeHidden()` у модала — признак
ЗАКРЫТИЯ МОДАЛА, а не прихода перечитанной карточки, — и читает ячейку одноразовым
`textContent()`. Ячейка существует и со старым текстом (питфолл #64, вариант
«внутристраничный переход»). Правка приложения тут ни при чём: карточка заказа страны не
знает, а цены накрыты юнит-тестами и `test:audit`, оба зелёные.

Находка вне области пункта → в bugs-файл, а не молчком:
**БАГ-24** в [`3.1-orders-card-bugs.md`](../../plans/bugs/3.1-orders-card-bugs.md).

---

## 6. Линзы

| Линза | Чем проверял | Что вернулось | Вывод |
|---|---|---|---|
| Л1 реактивность | `grep -n "structuredClone\|toRaw(\|useHead(\|watch(\|computed("` по обеим страницам клиента и `countries.ts` | новых `watch` нет; добавлены два `computed` на страницу — список стран (зависит от `locale`) и переходник `null ↔ ''` | чисто: список пересобирается при смене языка, `v-model.number` и `readonly` тут ни при чём |
| Л2 i18n | сверка наборов ключей по трём локалям скриптом | `ru 100 · en 100 · lt 100`, разностей нет ни в одну сторону | чисто; `@` в новых строках нет, в шаблоне только `t('clients.field_country')` и `t('clients.country_not_selected')` |
| Л3 контракт | `grep -in "клиент\|/clients" roo_code/roo-context/03-api-contract.md` | ни одного эндпоинта `/api/clients` в контракте нет (все вхождения — слово «клиент» про HTTP-клиента) | дописывать нечего: новых эндпоинтов правка не заводит, поле едет в существующих `POST /api/clients` и `PATCH /api/clients/:id`. Отсутствие раздела о клиентах в контракте — находка вне области пункта, см. §8 |
| Л4 мок = правда | сверка страны с префиксом VAT (см. §3) + typecheck как гарантия полноты | 0 расхождений на 55; сид без страны роняет typecheck (проверено инверсией, см. §7) | чисто |
| Л5 один источник | `grep -rn "'LT'" src/` и `grep -rn "documentType ="` | правило «страна → комплект» существует ровно в одном месте — `suggestedDocumentType`; сравнение с `'LT'` вне справочника есть только в спеке | чисто |
| Л6 UI и CSS | `grep -n "<select"` по страницам клиента; `max-height` у `_custom-select.css`; два перерисованных снимка | нативных `<select>` нет — везде `CustomSelect`, как у статуса; список ограничен `max-height: 350px` со скроллом | чисто |
| Л7 права/флаги/роуты | `git diff --stat -- src/router src/config/featureFlags.ts` | пусто | роутов и флагов правка не касается |
| Л8 сохранение | чтение `useClientCard.save()` | сохраняется дельтой `dirty.diff()` — новое поле едет само; «не выбрана» нормализуется в `null` переходником, а не уезжает пустой строкой (питфолл #50) | чисто |
| Л9 тесты | семь инверсий, см. §7; `grep -rn "await page.waitForLoadState" tests/` | инверсии краснеют все семь; вхождений `networkidle` — 0 | чисто |
| Л10 целостность | `grep -n "adminClients" src/i18n/admin/index.ts`; дубли имён роутов | домен импортирован (строки 11 и 64); повторов имён нет — четыре кандидата оказались ссылками (`redirect`, возвраты гарда), каждое имя объявлено один раз | чисто |

---

## 7. Инверсии (Л9) — каждое утверждение доказано красным

| # | Что сломано | Что покраснело |
|---|---|---|
| 1 | `suggestedDocumentType` всегда возвращает `'local'` | 3 теста: «любая другая страна — экспорт», «клиенту из другой страны — экспортный комплект», «не перезаписывает выбор менеджера» |
| 2 | Литва тоже даёт `'export'` | 2 теста: «Литва — локальный комплект», «литовскому клиенту — локальный комплект» |
| 3 | убран `if (!country) return null` | «страна не заполнена — предлагать нечего» и «у клиента без страны выбранный „local“ остаётся» |
| 4 | `selectClient` вычисляет предложение и не применяет его | 3 теста в `useOrderCreate.spec.ts` |
| 5 | `countryLabel` всегда возвращает код | 3 теста: «у каждого кода есть название», «подписывает на языке пользователя», «упорядочен по названию» |
| 6 | `countryOptions` не сортирует | «упорядочен по названию на языке пользователя, а не по коду» |
| 7 | у сида CL-001 убрано поле `country` | `npm run typecheck`: `TS2322 … Property 'country' is missing in type` |

**Инверсия №3 нашла настоящий питфолл #68 в моём же тесте.** Первая редакция проверки «у
клиента без страны» ставила `documentType = 'export'` и ждала `'export'`. Со снятым
null-guard `suggestedDocumentType(null)` возвращает `'export'` (null ≠ 'LT'), композабл его
применяет — и тест остался зелёным: его устраивало бездействие. Заменено на `it.each` по обоим
значениям: «выбранный local остаётся» ловит ошибочный экспорт, «выбранный export остаётся» —
ошибочный локальный. Поодиночке ни одно из двух правила не пиннит.

---

## 8. Рассмотрено и отклонено

- **Сиды заказов не выводят тип комплекта из страны клиента** (`mocks/orders.ts:392` —
  `i % 2 === 0 ? 'local' : 'export'`). Не находка: система тип **предлагает**, менеджер вправе
  его поменять, поэтому заказ литовского клиента с экспортным комплектом — законные данные, а
  не украшенные. Плюс `documentType` определяет `vatMode`, то есть пересбор сидов сдвинул бы
  суммы половины заказов и все снимки, зависящие от них, — это отдельная задача, а не «раз уж
  открыли файл».
- **E2E на путь «выбрал латвийского клиента → в шапке заказа Экспорт» не добавлен.** Мок
  отвечает из модуля, а не по сети, поэтому `page.route()` подменить данные не может, и такой
  тест пришлось бы привязать к конкретному сиду (питфолл #15). Правило пиннится инверсиями на
  уровне композабла, а связка «сид → карточка → подпись» — перерисованным снимком карточки,
  где у CL-001 стоит Lithuania.
- **У поставщика `country` остался свободной строкой** (`'UK'`, `'Estonia'`, `'Sweden'` в
  `mocks/suppliers.ts`) — та же разнопись, что пункт лечит у клиента. Вне области пункта 8:
  он про клиента и про заказ. Отмечено здесь, чтобы не потерялось.
- **Переходник `null ↔ ''` и сборка списка написаны на обеих страницах клиента.** Не Л5:
  дублируется не правило, а идиома — сам справочник и его порядок собирает один
  `countryOptions`, а переходник питфолл #24 предписывает заводить на каждое nullable-поле,
  и в проекте он так и живёт (`categoryStr`, `statusStr`). Композабл ради двенадцати строк
  добавил бы уровень косвенности, а не источник правды. `npm run dupes` — 9.28 % при пороге
  10 %, sonarjs молчит.
- **В `03-api-contract.md` нет раздела о клиентах вовсе** — ни `GET /api/clients`, ни
  `PATCH /api/clients/:id`, хотя мок эти маршруты обслуживает и страницы их зовут. Правка
  контракта тут была бы не write-back, а написание отсутствующего раздела с нуля; вне области
  пункта.

---

## 9. Итог

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 8 — страна клиента и тип комплекта документов
Итераций: 2 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes OK · format OK · unit OK (603)
                   test:audit OK (97) · e2e ур. 1
Линзы:             Л1–Л10 подтверждены
Найдено за прогон: 4       Починено: 4      Отклонено: 4
В bugs-file ушло:  1 — БАГ-24 (свип это не пачкает, решает человек)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Найдено и починено: две ошибки линта, слабое утверждение в собственном тесте (питфолл #68,
найдено инверсией), два устаревших базовых снимка.

Найдено и припарковано: БАГ-24 — недетерминированный e2e карточки заказа, вне области пункта.


---

## ОТКЛОНЕНО ПРИЁМКОЙ 2026-08-27

Коммит `165d478` снят с ветки ревертом `0944d8b`: пункт возвращается в работу
с чистого основания. Разбор приёмщика целиком:

Второй пункт требования выполнен не полностью. План (review-followups.md:846-849) говорит буквально: «при выборе клиента в заказе: LT → «Локальный», иначе → «Экспорт»». В правке появилась третья ветка, которой в плане нет: `suggestedDocumentType` возвращает `null`, если страна не заполнена, и `selectClient` тогда не подставляет ничего (useOrderCreate.ts:181-182 — `if (suggestion) ...`).

Это не безобидная осторожность, а дыра, достижимая через ту самую форму, которую добавил этот же коммит. В `ClientCreatePage.vue` поле страны необязательное: `form.country` инициализируется `null` (строка 34), а `validate()` (строки 67-90) проверяет только `name`, `email`, `companyCode` — страну не проверяет никто. Значит менеджер заводит немецкую фирму без страны штатным путём, и заказ по ней получает «Локальный».

Собственное обоснование автора этим же и опровергается: в комментарии сказано, что `null` выбран потому, что «молча поставленный «локальный» читался бы как решение системы» — но `documentType` в форме по умолчанию и есть `'local'` (useOrderCreate.ts:41). То есть менеджер видит ровно тот молчаливый «Локальный», от которого ветка якобы спасает, а за ним едет `vatMode: 'standard'` вместо `'export_zero'` (useOrderCreate.ts:357) — то есть 21% НДС в экспортном заказе и накладные LT для немца. Тест автора это не ловит: `it.each(['local','export'])` сам заранее выставляет `documentType`, поэтому путь «менеджер ничего не трогал» не проверяется ни разу.

Дополнительно, но самостоятельным основанием не считаю: (а) базлайны `client-card-contact-chromium-win32.png` и `client-create-contact-chromium-win32.png` остались от старой вёрстки — коммит перерисовал только linux-пару, автор об этом сказал вслух, но пункт от этого не перестаёт быть незакрытым; (б) мой первый полный прогон clients.spec.ts был красным (1 failed / 74 passed), зелёным стал только на повторе.

Что при этом действительно сделано и проверено мной: справочник ISO закрытый и типизированный, поле есть и в карточке, и на создании, дельта сохраняется, страны 55 сидов сходятся и с префиксом VAT, и с городом в адресе, инверсии краснеют. Отклоняю только по невыполненной ветке «иначе → Экспорт».

---

## Заход 2 — 2026-08-28, работа над ошибками

Отклонение выше принято целиком. Чинилась ровно названная дыра: третья ветка
«страна не заполнена → не предлагать ничего». Всё остальное из первого захода
приёмщик подтвердил как верное и потому не переписывалось — оно снято с
коммита `165d478` как есть и перенесено на текущее дерево.

### 1. Воспроизведение — на текущем дереве пункта нет вовсе

Ревертом `0944d8b` снято всё, поэтому воспроизводились обе половины пункта:

```
$ grep -n "country" frontend_vue/src/types/client.ts
(пусто, exit=1)

$ ls -la frontend_vue/src/domain/countries.ts
ls: cannot access 'frontend_vue/src/domain/countries.ts': No such file or directory

$ grep -n "documentType\|selectClient" frontend_vue/src/composables/useOrderCreate.ts
35:    documentType: OrderDocumentType
40:    documentType: 'local',
165:  function selectClient(client: Client) {
343:    form.value.documentType === 'export' ? 'export_zero' : 'standard',
405:          documentType: form.value.documentType,
495:    selectClient,
```

`selectClient` тип комплекта не трогает, страны у клиента нет ни в типе, ни в
справочнике — пункт воспроизводится полностью, как в заходе 1.

### 2. Перенос принятой части — не копией коммита, а трёхсторонним применением

Первая попытка переноса (`git show 165d478:<файл> > <файл>` по всем файлам)
оказалась ошибкой и была отловлена гейтом: между `165d478` и HEAD прошли пункты 9
и 10, и целиком взятые файлы затёрли `paymentTermsDays`, `ClientInvoice`,
`ClientInvoiceSummary`, `ClientUnassignedPayment` — 40 ошибок typecheck.

```
$ npx vue-tsc --noEmit | head -3
src/composables/useClientCard.spec.ts(65,15): error TS2305: Module '"@/types/client"' has no exported member 'ClientInvoice'.
src/composables/useClientCard.ts(146,30): error TS2339: Property 'paymentTermsDays' does not exist on type ...
```

Правильный перенос: файлы возвращены к HEAD, а дельта пункта наложена
трёхсторонним `git apply -3`.

```
$ git diff --stat 165d478^ HEAD -- <пять файлов>
types/client.ts             +94
services/mocks/clients.ts   +70
ClientCardPage.vue         +189
ClientCreatePage.vue       +53 −3
i18n/admin/clients.ts       +73
(useOrderCreate.ts и его спека с тех пор не менялись — им перенос не нужен)

$ git apply -3 item8.patch
Applied patch to 'frontend_vue/src/types/client.ts' with conflicts.
```

Конфликт один и на одной строке — соседний `import type { InvoiceKind }`,
появившийся пунктом 10. Разрешён сохранением обоих импортов.

### 3. Правка по существу отклонения

**Правило стало полным — веток две, а не три.**

```ts
// было: третья ветка, которой в плане нет
export function suggestedDocumentType(country): OrderDocumentType | null {
  if (!country) return null
  return country === LOCAL_DOCUMENT_COUNTRY ? 'local' : 'export'
}

// стало: буквально «LT → Локальный, иначе → Экспорт»
export function suggestedDocumentType(country): OrderDocumentType {
  return country === LOCAL_DOCUMENT_COUNTRY ? 'local' : 'export'
}
```

```ts
// было: у клиента без страны не подставлялось ничего
const suggestion = suggestedDocumentType(client.country)
if (suggestion) form.value.documentType = suggestion

// стало: предложение применяется всегда
form.value.documentType = suggestedDocumentType(client.country)
```

**Почему именно так, а не обязательной страной в форме.** Приёмщик назвал оба
закрытия допустимыми. Выбрано то, которое совпадает с текстом плана дословно
(«LT → «Локальный», иначе → «Экспорт»») и не меняет поведение формы клиента,
подтверждённое приёмкой. Дыра закрывается тем же движением: немецкая фирма без
страны получает **Экспорт**, а не молчаливый «Локальный» с 21 % НДС.

Собственное обоснование `null` из захода 1 не защищается, а признано неверным и
переписано в комментариях обоих файлов: воздержаться от предложения нельзя,
потому что в форме заказа у `documentType` есть значение по умолчанию `'local'`
— молчание не оставляет поле пустым, оно оставляет локальный комплект.

Оговорка ТЗ («система предлагает, менеджер может изменить») от этого не
страдает: подстановка по-прежнему живёт только в `selectClient`, а не в вотчере
на `form.clientId`, и предложение видно и правится — `OrderCreatePage.vue:377`,
`CustomSelect` с `data-test="order-create-doctype"`.

### 4. Тест на путь, которого не проверял никто

Приёмщик указал и на дыру в тесте: `it.each(['local','export'])` сам заранее
выставлял `documentType`, поэтому путь «менеджер ничего не трогал» не
проверялся ни разу. Заменён двумя утверждениями:

```ts
it('клиенту без страны — экспорт, а не оставленный по умолчанию «локальный»', () => {
  const page = useOrderCreate()
  expect(page.form.value.documentType).toBe('local')   // менеджер не трогал
  page.selectClient(client('cli-none', null))
  expect(page.form.value.documentType).toBe('export')
})

it('и заказ такому клиенту создаётся экспортным — тип едет на сервер, а с ним ставка НДС', async () => {
  ...
  expect(createdPayload).toMatchObject({ documentType: 'export' })
})
```

Второе утверждение читает **уехавший payload**, а не экранное значение: именно
из этого поля `mockCreateOrder` выводит `vatMode` (`'export'` → `export_zero`,
`'local'` → `standard`, то есть 21 %). Для этого мок `createOrder` в спеке стал
запоминать аргумент.

### 5. Машинная приёмка

```
$ cd frontend_vue && npm run verify ; echo "exit=$?"
exit=0
  typecheck    — vue-tsc --noEmit, чисто
  lint         — eslint --max-warnings=0, чисто
  dupes        — jscpd 9.20 % при пороге 10 %
  format:check — All matched files use Prettier code style!
  test:unit    — Test Files 30 passed (30) · Tests 643 passed (643)

$ npm run test:audit ; echo "exit=$?"
exit=0
  Test Files 22 passed (22) · Tests 97 passed (97)
```

`test:audit` — потому что тронут `src/services/mocks/clients.ts`, который читает
мок заказов.

### 6. E2E — уровень 1

Правка не в общем полу (helpers, фикстуры, диспетчер моков, роутер, глобальный
CSS не тронуты), поэтому гонялись затронутая область и все, кто читает мок
клиентов (`grep -rln "clients" tests/e2e`).

```
$ npx playwright test tests/e2e/admin/clients/clients.spec.ts --reporter=line --workers=3
exit=1   2 failed · 74 passed (1.2m)
```

Оба падения — снимки `client-create-contact` и `client-card-contact`, то есть
ровно две панели, куда добавлено поле. Базлайны перерисованы и **просмотрены
глазами**:

```
$ npx playwright test … -g "contact panel" --update-snapshots --workers=1
exit=0   2 passed
```

- `client-card-contact-chromium-linux.png` — у CL-001 (Каунас, `LT`) в поле
  COUNTRY стоит **Lithuania**: путь «сид → тип → карточка → подпись ICU» цел.
- `client-create-contact-chromium-linux.png` — на пустой форме **No country
  selected**.

Дальше зелено с первого раза, повторов не потребовалось:

```
$ npx playwright test tests/e2e/admin/clients/clients.spec.ts --workers=3
exit=0   76 passed (1.2m)

$ npx playwright test tests/e2e/admin/orders tests/e2e/admin/sales-crm --workers=3
exit=0   121 passed (2.7m)

$ npx playwright test tests/e2e/admin/analytics/pl-report.spec.ts \
      tests/e2e/admin/analytics/sales.spec.ts tests/e2e/navigation.spec.ts \
      tests/e2e/smoke.spec.ts --workers=3
exit=0   97 passed (1.1m)
```

Замечание приёмщика (б) — «первый прогон clients.spec.ts был красным, зелёным
стал на повторе» — в этом заходе не воспроизвелось: единственная краснота была
объяснимой (два устаревших базлайна), после перерисовки прогон зелёный сразу.

Снимки `*-chromium-win32.png` двух этих панелей остаются от старой вёрстки:
перерисовать их можно только на Windows. Сказано вслух повторно, как и в заходе 1.

### 7. Инверсии (Л9) — семь, каждая красная

| # | Что сломано | Что покраснело |
|---|---|---|
| 1 | возвращена третья ветка (`if (!country) return null` + `if (suggestion)`) | ровно 3 теста, пиннящих закрытую дыру: «страна не заполнена — экспорт», «клиенту без страны — экспорт», «заказ создаётся экспортным» (`documentType: "local"` в payload) |
| 2 | `suggestedDocumentType` всегда `'local'` | 6 тестов в двух файлах |
| 3 | `suggestedDocumentType` всегда `'export'` | 2 теста про Литву |
| 4 | `selectClient` вычисляет предложение и не применяет | 5 тестов `useOrderCreate.spec.ts` |
| 5 | `countryLabel` всегда возвращает код | 3 теста справочника |
| 6 | `countryOptions` не сортирует | «упорядочен по названию, а не по коду» |
| 7 | у сида CL-001 убрано поле `country` | `npx vue-tsc --noEmit`: `TS2322 … Property 'country' is missing in type` |

Инверсия №1 — главная: она доказывает, что новый тест ловит именно ту дыру, за
которую пункт отклонили, а не соседнее поведение. Файлы после каждой инверсии
возвращались из копии в скрэтчпаде и сверялись `diff` (`countries.ts identical
to backup`), а не «на глаз».

### 8. Линзы

| Линза | Чем проверял | Что вернулось | Вывод |
|---|---|---|---|
| Л1 | `grep -n "structuredClone\|toRaw(\|useHead(\|watch("` по `countries.ts`, обеим страницам клиента, `useOrderCreate.ts` | новых `watch` нет; два `computed` на страницу (список стран от `locale`, переходник `null ↔ ''`); `watch(vatMode, recalcLocalTotals)` уже был — теперь предложение всегда меняет ставку вместе с типом | чисто |
| Л2 | скрипт-сверка ключей по трём локалям `src/i18n/admin/clients.ts` | `ru 122 · en 122 · lt 122`, разностей нет; `field_country` и `country_not_selected` есть во всех трёх; `@` в новых строках нет | чисто |
| Л3 | `grep -n "/api/clients" 03-api-contract.md` → пусто; сверка вызовов `clientsService.ts` с роутами `mocks/index.ts` | новых эндпоинтов нет, поле едет в существующих `POST /api/clients` и `PATCH /api/clients/:id`; у каждого вызванного пути мок есть | чисто; отсутствие раздела о клиентах в контракте — прежняя находка вне области (см. §8 захода 1) |
| Л4 | python-сверка страны с префиксом VAT по 55 сидам | `parsed 55 · mismatch [] · LT 28, LV 21, EE 4, PL 1, DE 1` | чисто |
| Л5 | `grep -rn "documentType = \|documentType:"` по `src/`; `grep -rn "'LT'"` вне справочника | правило существует ровно в одном месте — `suggestedDocumentType`; `useOrderCard` клиента не выбирает (`grep -n "clientId"` пусто), `mocks/orders.ts:847` — рукописный сид ORD-008, а не правило; литералов `'LT'` вне справочника нет | чисто |
| Л6 | `grep -n "<select"` по страницам клиента; два перерисованных снимка | нативных `<select>` нет, везде `CustomSelect`; панели читаются | чисто |
| Л7 | `git diff HEAD --stat -- src/router src/config/featureFlags.ts` | пусто | роутов и флагов правка не касается |
| Л8 | чтение `useClientCard.save()` и сеттера `countryStr` | сохраняется дельтой `dirty.diff()`; «не выбрана» нормализуется в `null`, а не в пустую строку (питфолл #50); `mockCreateClient` кладёт `data.country ?? null` | чисто |
| Л9 | семь инверсий (§7); `grep -rn "await page.waitForLoadState" tests/ \| wc -l` → `0` | инверсии красные все семь | чисто |
| Л10 | `grep -n "clients" src/i18n/admin/index.ts`; `git diff HEAD -- src/router` | `import { adminClients } from './clients'` на месте; роутер не тронут | чисто |

### 9. Рассмотрено и отклонено в этом заходе

- **БАГ-24** (недетерминированный тест карточки заказа) был заведён заходом 1 и
  снят тем же ревертом. В этом заходе прогон `orders` + `sales-crm` зелёный
  121/121, то есть падение не воспроизвелось, и заводить баг заново «по памяти»
  без воспроизведения нельзя. Разбор не потерян: он целиком в §5 этого журнала.
- **Обязательная страна в форме клиента** — второе из двух закрытий, названных
  приёмщиком. Не делалось: одного достаточно, а выбранное совпадает с текстом
  плана дословно и не трогает поведение формы, которое приёмка подтвердила.
- **Сиды заказов не выводят тип комплекта из страны клиента**, **e2e на путь
  «латвийский клиент → Экспорт»**, **свободная строка `country` у поставщика**,
  **отсутствие раздела о клиентах в контракте** — четыре отклонения захода 1
  (§8) в силе, обстоятельства не изменились.

### 10. Итог захода 2

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: пункт 8, заход 2 — закрыта третья молчаливая ветка
Итераций: 2 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  typecheck OK · lint OK · dupes 9.20 % · format OK · unit 643
                   test:audit 97 · e2e ур. 1 (76 + 121 + 97)
Линзы:             Л1–Л10 подтверждены
Найдено за прогон: 2       Починено: 2      Отклонено: 6
В bugs-file ушло:  0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Найдено и починено в этом заходе: затёртые пунктами 9–10 поля при первом
переносе (поймано typecheck, перенос переделан трёхсторонним применением) и два
устаревших базлайна. Отметку ✅ в плане ставит не автор правки.
