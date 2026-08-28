# Пункт 4 — услуги: валюта и единица из справочника

Цель: `roo_code/plans/general/review-followups.md`, раздел «## 4. Услуги: валюта и единица из
справочника (находка 1.3-A)».

Это **вторая** попытка. Первая объявила пункт устаревшим («воспроизвести не удалось») и была
отклонена приёмкой: фронтенд действительно переведён, но пункт перечисляет затрагиваемое как
«тип `Service` и **payload'ы**», а payload'ы услуг живут в единственном живом контракте
`roo_code/roo-context/03-api-contract.md` (ROO.md), и там союз оставался объявлен как живой тип.
Грep первой попытки был ограничен `src/` и `tests/` — контракт в него не попал.

## Итерация 1

### Воспроизведение

```
$ grep -n "ServicePriceUnit\|priceUnit" roo_code/roo-context/03-api-contract.md
1133:- `ServicePriceUnit` = `'EUR/vnt' | 'EUR/kg' | 'EUR/m' | 'EUR/h'`
1165:        { "id": "svc-1", …, "sellingPrice": 25.00, "priceUnit": "EUR/h" }
1182:    priceUnit?: ServicePriceUnit   // default: 'EUR/vnt'
1213:      "priceUnit": "EUR/h",
1230:    priceUnit?: ServicePriceUnit
1244:- `useDirtyCheck` для `name`/`costPrice`/`sellingPrice`/`priceUnit`/`description`
```

Шесть живых вхождений — воспроизводится. Ни `currencyId`, ни `uomId` в разделе Services не
встречались ни разу. То есть бэкенд, собранный по контракту, принимал бы и отдавал ровно тот союз,
который пункт требовал убрать, а фронтенд шлёт `currencyId` + `uomId` — расхождение боевое.

Сторона кода (её трогать было нельзя — подтверждена приёмщиком как верная):

```
$ grep -rn "ServicePriceUnit" frontend_vue/src frontend_vue/tests
(пусто)
```

`src/types/service.ts` несёт `currencyId: string` + `uomId: string`; `servicesService.ts` шлёт их в
POST и PATCH; `mocks/services.ts` проверяет оба id по справочнику (`assertKnownPricing`).

### Правка

Единственный файл — `roo_code/roo-context/03-api-contract.md`, раздел «Admin — Services (1.3)»:

| Строка | Было | Стало |
|---|---|---|
| 1133 | `- ServicePriceUnit = 'EUR/vnt' \| …` в списке живых типов | абзац: союза больше нет, цена = сумма + `currencyId` + `uomId` из справочников |
| 1165 | пример `GET /api/services`: `"priceUnit": "EUR/h"` | `"currencyId": "cur-eur", "uomId": "uom-h"` |
| 1182 | body `POST`: `priceUnit?: ServicePriceUnit // default: 'EUR/vnt'` | `currencyId: string` + `uomId: string` (обязательные, как в `ServiceCreatePayload`), с дефолтами клиента |
| 1213 | пример `GET /api/services/:id`: `"priceUnit": "EUR/h"` | `"currencyId": "cur-eur"`, `"uomId": "uom-h"` |
| 1230 | body `PATCH`: `priceUnit?: ServicePriceUnit` | `currencyId?: string` + `uomId?: string` |
| 1244 | поля `useDirtyCheck`: `…/priceUnit/…` | `…/currencyId/uomId/…` |

Значения в примерах не выдуманы: `cur-eur`, `uom-h`, `uom-pcs` — реальные id из
`src/services/mocks/settings.ts` (строки 45, 121, 78), и формат совпадает с примерами
`GET /api/settings/currencies` (строка 2169 контракта) и `GET /api/settings/uoms` (2235).
Дефолты `cur-eur` / `uom-pcs` взяты из `ServicesPage.vue:59-60` и `:100-101`, а не назначены здесь.

### Машинная приёмка

```
$ cd frontend_vue && npm run verify
> typecheck (vue-tsc --noEmit)             — без вывода, OK
> lint (eslint src/ tests/ *.ts --max-warnings=0) — без вывода, OK
> dupes (jscpd src)                        — Total 9.28 % при пороге 10 %, OK
> format:check (prettier --check src/ tests/) — All matched files use Prettier code style!
> test:unit (vitest run)                   — Test Files 29 passed (29) · Tests 615 passed (615)
```

Правка — только markdown, но гейт прогнан целиком: «пройденный на три четверти» гейтом не
считается (verify.md).

### Линзы

**Л3 — контракт и HTTP.** Собран список вызовов страниц услуг и сверён с роутами мока и с
контрактом, поштучно:

```
$ grep -n "'/api/services" frontend_vue/src/services/servicesService.ts
23: apiGet  '/api/services'          (список)
27: apiGet  `/api/services/${id}`    (карточка)
40: apiPost '/api/services'          (создание)
72: apiPatch `/api/services/${id}`   (правка)
76: apiDelete `/api/services/${id}`  (удаление)

$ grep -n "'/api/services'\|api\\\\/services" frontend_vue/src/services/mocks/index.ts
452  GET  /api/services            465  GET    /api/services/:id
944  POST /api/services            1224 PATCH  /api/services/:id
1492 DELETE /api/services/:id
```

Пять вызовов — пять роутов мока — пять разделов контракта. Методы под смысл операции: POST/DELETE
как quick-action, PATCH дельтой при clean-slate — так и записано в «Save UX — Services» и так и
работает `useServiceCard.save()` (`dirty.diff()` → `patchService`). Поля `currencyId`/`uomId` теперь
одинаковы во всех трёх местах: тип (`src/types/service.ts`), провод (`servicesService.ts`), контракт.
Вывод: чисто.

**Л5 — один источник правила.**

```
$ grep -rn "ServicePriceUnit" frontend_vue/src frontend_vue/tests roo_code/roo-context backend
roo_code/roo-context/03-api-contract.md:1134:Союза `ServicePriceUnit` … больше нет: …
roo_code/roo-context/verify-runs/followups-4b.md:70:… (историческая запись чужого журнала)
```

Второго живого объявления союза не осталось: единственное вхождение в контракте — отрицающее.
Вывод: чисто.

**Л10 — целостность.** Ссылки, добавленные в контракт, ведут в существующие его же разделы:
`GET /api/settings/currencies` — строка 2169, `GET /api/settings/uoms` — строка 2235 (проверено
`grep -n "GET /api/settings"`). Первая правка дополнительно развела список-буллеты и абзац пустой
строкой, иначе абзац стал бы продолжением последнего пункта списка. Вывод: чисто.

**Л9 — тесты.** `git status --porcelain` → одна строка, `M roo_code/roo-context/03-api-contract.md`.
Ни одного теста не тронуто, поэтому инверсия не требуется (она обязательна, когда тесты правятся).
Отдельно рассмотрено и отклонено: заводить юнит-тест, который грепает контракт на `priceUnit`.
Механизма «тест на документ» в проекте нет, и его появление — решение шире этого пункта.

Остальные линзы (Л1, Л2, Л4, Л6, Л7, Л8) к правке одного markdown-файла неприменимы: ни
реактивности, ни переводов, ни мока, ни CSS, ни прав, ни сохранения данных она не касается.

### Свип

Новых находок в области пункта — ноль. Свип чистый на первой итерации (правка не задевала кода,
поэтому подтверждения линз не сбрасывались повторно).

## Замечено, но НЕ тронуто

Расхождения контракта с кодом, увиденные в том же разделе, но лежащие вне названного остатка
(«убрать `ServicePriceUnit`/`priceUnit`, вписать `currencyId`+`uomId`»). Не чиню, чтобы не
переписывать принятое и не догадываться там, где пункт молчит; решает человек:

1. **Код ошибки 404 разный.** Контракт (1143): `SERVICE_NOT_FOUND`. Мок
   (`mocks/services.ts`, `mockGetService`/`mockPatchService`): `CATALOG_SERVICE_NOT_FOUND`.
2. **Отказ по неизвестному id справочника не описан.** `assertKnownPricing` бросает
   `SERVICE_CURRENCY_NOT_FOUND` / `SERVICE_UOM_NOT_FOUND`; в списке кодов их нет. HTTP-статус для
   них не назначен нигде — назначить его здесь было бы догадкой.
3. **`name` в body POST.** Контракт: `name: string`. На проводе — `TranslatedString`
   (`servicesService.createService` зовёт `toTranslatedString` до `apiPost`).
4. **`costPrice`/`sellingPrice` в body POST** помечены необязательными с `default: 0`, а
   `ServiceCreatePayload` требует оба.
5. **`sortBy`** в query перечисляет `name | costPrice | sellingPrice`, а `ServiceFilters.sortBy`
   и мок знают ещё `createdAt`.
6. **`updatedAt`** есть у `Service` и в моке, но не в примерах ответов контракта.
7. **Планы `roo_code/plans/services/services-page-plan.md` и
   `roo_code/plans/general/inventory-parts/part-015.md`, `part-038.md`** упоминают союз. Это
   исторические планы, а не живой контракт (ROO.md: живой — один), и правка там была бы
   переписыванием того, как всё было.
