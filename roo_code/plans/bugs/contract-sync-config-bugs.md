# Bugs — contract-sync / домен config

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К4. Аудит: [`roo_code/plans/api/audit/config.md`](../api/audit/config.md).
Область: `frontend_vue/src/services/configService.ts`,
`frontend_vue/src/services/mocks/config.ts`, ветки config в
`frontend_vue/src/services/mocks/index.ts`, `frontend_vue/src/composables/useCardConfig.ts`,
`frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue`,
`frontend_vue/src/types/config.ts`, `backend/app/modules/suppliers/shared/models.py`,
`backend/app/modules/auth/shared/models.py`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

---

## БАГ-01 — тост «сохранено» показывается и когда сохранение упало

**File:** `frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue:474-477`, `frontend_vue/src/composables/useCardConfig.ts:56-58`
**Severity:** High — пользователь уходит со страницы уверенным, что конфигурация сохранена, а её нет.
**Источник:** К2 (мок ↔ контракт ↔ код)

### Problem

`saveConfig()` ловит любую ошибку трёх PUT'ов внутрь и кладёт её в `error.value`, наружу не
пробрасывая:

```ts
} catch (e) {
  error.value = e instanceof Error ? e.message : 'Failed to save config'
}
```

Вызывающий про это не знает и показывает успех безусловно:

```ts
async function save() {
  await saveConfig()
  toast.show(t('notification.config_saved'))
}
```

Хуже того, `error.value` управляет **всей** разметкой страницы: ветка `v-else-if="error"` рисует
голую строку ошибки вместо конфигуратора (`SupplierCardConfigPage.vue:535-537`, при `loading === false`
после успешной загрузки — `:532-538`). Значит на упавшем Save пользователь одновременно получает
тост «конфигурация сохранена» и пустой экран с текстом ошибки вместо своей несохранённой работы —
локальное состояние `fieldLibrary`/`sections`/`permissions` живо в памяти, но показать его больше
нечем.

### Fix

TBD — либо `saveConfig()` пробрасывает ошибку и `save()` показывает тост только на успехе, либо
`saveConfig()` возвращает признак результата.

### Future rule

Композабл, который гасит ошибку в собственное состояние, обязан вернуть вызывающему признак
успеха; иначе `await` без исключения читается как «получилось».

---

## БАГ-02 — Save молча не отправляет ничего, если матрица прав не загрузилась

**File:** `frontend_vue/src/composables/useCardConfig.ts:45-46`
**Severity:** High — вместе с БАГ-01 даёт тост «сохранено» при нуле отправленных запросов.
**Источник:** К2

### Problem

```ts
async function saveConfig() {
  if (!permissions.value) return
```

`permissions.value` равен `null` (`useCardConfig.ts:21`) ровно в том случае, когда `load()` упал —
все три чтения идут одним `Promise.all` (`:30-34`), и падение любого оставляет `null` во всех трёх
рефах. То есть при недоступном `GET /api/config/permissions` кнопка Save перестаёт отправлять
**и библиотеку полей, и секции**, хотя к правам они отношения не имеют. Никакого сигнала наружу
ранний `return` не даёт.

### Fix

TBD — решить, обязан ли Save быть атомарным на все три сущности; если да, гейт должен быть виден
пользователю (задизейбленная кнопка), а не молчаливым `return`.

---

## БАГ-03 — мёртвая ветка перевода имени в `patchField` и `patchSection`

**File:** `frontend_vue/src/services/configService.ts:33-36`, `:63-66`
**Severity:** Medium — код, который выглядит работающим и не может сработать никогда.
**Источник:** К4 (формы запроса и ответа)

### Problem

```ts
const translatedPatch: Partial<FieldDefinition> = { ...patch }
if (patch.name && typeof patch.name === 'string') {
  translatedPatch.name = toTranslatedString(patch.name, locale)
}
```

`FieldDefinition['name']` объявлен как `TranslatedString` (`frontend_vue/src/types/config.ts:7`),
`SectionConfig['name']` — тоже (`:17`). Значит `typeof patch.name === 'string'` ложно всегда, тело
условия недостижимо, а третий параметр `locale` (`configService.ts:31`, `:61`) не используется
вовсе. Обе функции при этом не вызываются ниоткуда (см. БАГ-05), поэтому дефект невидим.

### Fix

TBD — либо ветка убирается вместе с параметром `locale`, либо подпись меняется так, чтобы приём
строки был законным.

### Future rule

Условие, которое TypeScript сужает до `never`, — не защита, а декорация. Ветка, недостижимая по
типам, обязана либо исчезнуть, либо получить тип, при котором она достижима.

---

## БАГ-04 — `createSection` шлёт имя строкой, и мок размножает её на три языка

**File:** `frontend_vue/src/services/configService.ts:54-55`, `frontend_vue/src/services/mocks/config.ts:306-310`
**Severity:** Medium — новая секция получает один и тот же текст в `ru`, `en` и `lt`.
**Источник:** К4

### Problem

Парная функция для полей заворачивает имя в переводы текущей локали:

```ts
return apiPost<FieldDefinition>('/api/config/fields', {
  ...payload,
  name: toTranslatedString(payload.name, locale),
})
```

а для секций — нет:

```ts
export async function createSection(payload: { name: string }): Promise<SectionConfig> {
  return apiPost<SectionConfig>('/api/config/sections', payload)
}
```

Мок это компенсирует по-своему, копируя строку во все три локали
(`mocks/config.ts:307-310`), тогда как `toTranslatedString` оставил бы две пустыми
(`frontend_vue/src/types/i18n.ts:19-25`). Получаются три разных поведения на одну операцию
«назвать сущность»: поле через сервис, секция через сервис, и локальный путь страницы
(`SupplierCardConfigPage.vue:459`), который использует `toTranslatedString`.

### Fix

TBD — выбрать одно поведение для новых имён и применить его во всех трёх местах.

---

## БАГ-05 — шесть клиентских функций домена не вызываются ниоткуда

**File:** `frontend_vue/src/services/configService.ts:15`, `:28`, `:40`, `:54`, `:58`, `:70`
**Severity:** Medium — половина клиентского слоя домена не покрыта ни одним путём выполнения.
**Источник:** К2

### Problem

`grep -rn "\bcreateField\b\|\bpatchField\b\|\bdeleteField\b\|\bcreateSection\b\|\bpatchSection\b\|\bdeleteSection\b" frontend_vue/src --include=*.ts --include=*.vue`
вне `configService.ts` находит только **одноимённые локальные** функции чужой логики:
`createField` страницы конфигуратора (`SupplierCardConfigPage.vue:309`, правит массив в памяти) и
`deleteField` карточки категории (`frontend_vue/src/composables/useCategoryCard.ts:142` — другой
домен). Ни один из шести эндпоинтов не вызывается: всё, что делает пользователь, копится локально
и уходит тремя PUT'ами по кнопке Save (`frontend_vue/src/composables/useCardConfig.ts:51-55`), как
и написано комментарием на странице (`SupplierCardConfigPage.vue:307-308`).

Ветки в моке при этом существуют (`mocks/index.ts:943`, `:946`, `:1220`, `:1229`, `:1476`, `:1482`)
и поддерживаются, а пять из шести эндпоинтов числятся в реестре «Клиент написан, UI нет»
(`roo_code/roo-context/03-api-contract.md:3029-3034`) — `PUT /api/config/fields` в реестр не попал
и в старом контракте не описан вовсе.

### Fix

**Разблокировано — П65 (б).** [`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md), строка 1549:

> **решено 2026-09-10:** пока не читает и читать не начнёт: замысел «у каждой сущности своя
> конфигурация карточки» откладывается, раздел выключается фича-флагом `supplierCardConfig`, а в
> мок-режиме остаётся → П65 (б)

Работа по коду: раздел конфигуратора уходит под фича-флаг `supplierCardConfig`; шесть точечных
функций (`configService.ts:15,28,40,54,58,70`) и их ветки мока (`mocks/index.ts:943,946,1220,1229,1476,1482`)
остаются вместе с разделом, а не подключаются и не снимаются — это следствие «в мок-режиме
остаётся как было», а не отдельное решение.

## БАГ-06 — `PUT /api/config/permissions` под моками не сохраняет ничего

**File:** `frontend_vue/src/services/mocks/config.ts:265-267`
**Severity:** High — правки матрицы прав теряются при перезагрузке, и это не видно ниоткуда.
**Источник:** К2

### Problem

```ts
export function mockSavePermissions(_matrix: PermissionMatrix): void {
  // no-op in mock
}
```

Парные `mockSaveFieldLibrary` (`:240-248`) и `mockSaveSections` (`:254-259`) в стор пишут, а этот —
нет. Ветка PUT при этом отвечает успехом (`mocks/index.ts:1166-1169`), клиент верит своему
локальному состоянию и `load()` после Save не делает
(`frontend_vue/src/composables/useCardConfig.ts:45-61`) — поэтому на экране всё выглядит
сохранённым до первой перезагрузки. E2E этого тоже не ловит: в
`frontend_vue/tests/e2e/admin/suppliers/supplier-card-config.spec.ts` нет ни одного теста, который
после Save перезагружал бы страницу.

### Fix

TBD — либо мок сохраняет матрицу, как две другие сущности, либо `no-op` объясняется в комментарии
как намеренный и покрывается тестом.

### Future rule

Мок называет себя reference implementation. Три парные операции Save, одна из которых пустая, —
это не мок, а половина мока: расхождение обязано быть либо закрыто, либо явно задокументировано.

---

## БАГ-07 — матрица прав строится один раз и не знает о созданных полях и секциях

**File:** `frontend_vue/src/services/mocks/config.ts:232`
**Severity:** Medium — созданный элемент не появляется в матрице, удалённый из неё не исчезает.
**Источник:** К2

### Problem

```ts
export const MOCK_PERMISSIONS: PermissionMatrix = buildMockPermissions()
```

`grep -n "buildMockPermissions" frontend_vue/src/services/mocks/config.ts` даёт ровно два
попадания: объявление (`:189`) и этот вызов (`:232`). Ни `mockCreateField` (`:269-282`), ни
`mockCreateSection` (`:306-321`), ни `mockDeleteField` (`:298-304`), ни `mockDeleteSection`
(`:334-337`), ни `mockSaveSections` (`:254-259`) матрицу не пересобирают. Старый контракт требует
обратного прямо: «Сервер обязан добавлять item, когда создаётся section / field»
(`roo_code/roo-context/03-api-contract.md:683`).

Дополнительно `items[].name` держит **ссылку** на объект имени из `MOCK_SECTIONS` /
`MOCK_FIELD_LIBRARY` (`:193`, `:198`), а `mockSaveSections` заменяет содержимое стора новыми
объектами после JSON-раундтрипа (`:256-258`) — после первого же Save имена в матрице перестают
следовать за переименованиями.

### Fix

TBD — пересобирать матрицу при каждом изменении состава, сохраняя уже выставленные права.

---

## БАГ-08 — `mockUpdateField` и `mockUpdateSection` возвращают `null` вместо ошибки

**File:** `frontend_vue/src/services/mocks/config.ts:289`, `:325`
**Severity:** Medium — PATCH несуществующего id отвечает успехом с пустым телом.
**Источник:** К3 (коды ошибок)

### Problem

```ts
const field = MOCK_FIELD_LIBRARY.find((f) => f.id === id)
if (!field) return null
```

Ветка мока отдаёт это как успешный ответ (`mocks/index.ts:1229-1236`, `:1220-1227`), а подписи
клиента обещают сущность: `Promise<FieldDefinition>` (`frontend_vue/src/services/configService.ts:32`)
и `Promise<SectionConfig>` (`:62`). Старый контракт для секции обещает `404 NOT_FOUND`
(`roo_code/roo-context/03-api-contract.md:674`), но такого кода в домене нет:
`grep -c "throw" frontend_vue/src/services/mocks/config.ts` → `0`.

### Fix

TBD — завести коды домена (`FIELD_NOT_FOUND`, `SECTION_NOT_FOUND`) и бросать их, как это делают
моки соседних доменов.

---

## БАГ-09 — `mockUpdateField` и `mockUpdateSection` мутируют объект патча вызывающего

**File:** `frontend_vue/src/services/mocks/config.ts:291-293`, `:327-329`
**Severity:** Low — побочный эффект на объекте, который принадлежит вызывающему.
**Источник:** К2

### Problem

```ts
if (patch.name) {
  patch.name = mergeTranslatedString(field.name, patch.name)
}
```

Слияние пишется обратно в **аргумент**, а не в локальную копию. Реальный сервер тело запроса
вызывающему не возвращает, поэтому под моками поведение отличается от боевого: `translatedPatch`,
который клиент собрал в `configService.ts:33`/`:63`, после вызова оказывается изменённым.

### Fix

Слить в локальную переменную, аргумент не трогать.

---

## БАГ-10 — мок удаляет системную секцию и встроенное поле без возражений

**File:** `frontend_vue/src/services/mocks/config.ts:334-337`, `:298-304`
**Severity:** Medium — единственный запрет живёт в вёрстке и не переживёт прямой вызов API.
**Источник:** К3

### Problem

`mockDeleteSection` не смотрит на `section.system` (`frontend_vue/src/types/config.ts:24-25`), а
`mockDeleteField` — ни на какой признак встроенности. Во фронте встроенность определяется
префиксом id (`SupplierCardConfigPage.vue:303-305`), и защита сводится к тому, что у системной
секции кнопка удаления задизейблена (проверено e2e —
`frontend_vue/tests/e2e/admin/suppliers/supplier-card-config.spec.ts:260-266`). Старый контракт
обещает `403 IMMUTABLE` (`roo_code/roo-context/03-api-contract.md:644`, `:650`), но кода
`IMMUTABLE` в проекте нет: `grep -rn "IMMUTABLE" frontend_vue/src backend/app` — пусто.

На схеме признак встроенности **есть и он другой** — колонка `is_builtin`
(`backend/app/modules/suppliers/shared/models.py:256-258`), которой нет ни в типе фронта, ни в
моке; колонки `system` у секции на схеме нет вовсе
(`grep -c '"system"' backend/alembic/versions/e24a3922ed01_phase_7_config.py` → `0`).

### Fix

**ЖДЁТ ВЛАДЕЛЬЦА — вопрос отвечен отказом отвечать.**
Перепроверено 2026-09-12: [`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md), строка 1539 несёт
вердикт

> **решено 2026-09-07:** **не отвечено** — вопрос стоял в графе «Права», но он про защищённые
> объекты, а не про роли; остаётся открытым

и с 2026-09-07 второй строки под него не заведено. Формально строка «закрыта» (у неё есть
подпункт `**решено**`), содержательно — нет: в счёт «все 189 строк закрыты» она входит, а ответа
не даёт.

Соседнее решено и вопрос не закрывает: §2 назначил коды отказа — `SECTION_IS_SYSTEM` и
`FIELD_IS_BUILTIN`, оба 409 ([`../api/audit/00-решения-владельца.md`](../api/audit/00-решения-владельца.md), строка 1552), — но
какой признак настоящий, колонка `is_builtin` схемы или префикс `f-custom-` во фронте, не сказал
никто. Контракт домена это фиксирует прямым текстом
(`roo_code/roo-context/api/config.md:717-721`).

**Чего не хватает:** строки в файле решений формата
`- config · Источник истины · какой признак «этого удалять нельзя» настоящий · …` — то есть того
же вопроса, переставленного из графы «Права» в графу, которой он принадлежит.

## БАГ-11 — `toggleFieldLibraryHidden` не вызывается, и `hidden` не выставляется никогда

**File:** `frontend_vue/src/composables/useCardConfig.ts:95-98`, `:114`, `frontend_vue/src/types/config.ts:11-12`
**Severity:** Low — поле типа, которого не бывает в данных.
**Источник:** К4

### Problem

Композабл экспортирует `toggleFieldLibraryHidden` (`:114`), но потребитель его не разбирает:
деструктуризация на странице перечисляет тринадцать имён и этого среди них нет
(`SupplierCardConfigPage.vue:28-43`). `grep -rn "toggleFieldLibraryHidden" frontend_vue/src` даёт
только объявление и строку экспорта. Значит `FieldDefinition.hidden` (`types/config.ts:12`,
комментарий «Hidden from the supplier card rendering») не получает значения ни от мока
(`mocks/config.ts:269-282` его не выставляет), ни от UI. Колонки под него на схеме тоже нет
(`backend/alembic/versions/e24a3922ed01_phase_7_config.py:27-39`).

### Fix

TBD — подключить кнопку скрытия поля в библиотеке либо снять поле из типа вместе с функцией.

---

## БАГ-12 — `usageCount` не пересчитывается ничем

**File:** `frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue:320`, `:416`, `:433-440`
**Severity:** Medium — число на бейдже поля не связано с реальностью.
**Источник:** К2

### Problem

Счётчик проставляется руками и по-разному: поле, созданное в библиотеке, получает `usageCount: 0`
(`:320`), поле, добавленное сразу в секцию, — `usageCount: 1` (`:416`). Снятие поля с секции
(`confirmRemoveFieldFromSection`, `:433-440`) счётчик не трогает, добавление существующего поля в
секцию — тоже. В сторе мока это статические числа
(`frontend_vue/src/services/mocks/config.ts:17,24,39,46,53,60,67,82,89,96,103,110`), а бейдж
показывается по ним (`frontend_vue/src/components/admin/FieldLibraryItem.vue:51-55`). Смысл при этом
разошёлся уже внутри фронта: подсказка бейджа — `field.used_in_sections`
(`FieldLibraryItem.vue:53`), то есть «в скольких секциях поле размещено», а мок хранит числа до 12
при пяти секциях всего (`mocks/config.ts:17`, `:24`, `:53`).

Смысл, который счётчику приписывает старый контракт, — «сколько супплайеров реально заполнили это
поле» (`roo_code/roo-context/03-api-contract.md:629`) — не реализуем: хранилища значений полей у
поставщика нет ни во фронте (`frontend_vue/src/types/supplier.ts:12-31`), ни на схеме
(таблицы `supplier_field_values` не существует —
`grep -n "__tablename__" backend/app/modules/suppliers/shared/models.py`).

### Fix

TBD — определить, что именно считает `usageCount` (число секций, где поле размещено, или число
заполненных значений), и считать это в одном месте.

---

## БАГ-13 — комментарий обещает POST, которого в функции нет

**File:** `frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue:442`, `:451-472`
**Severity:** Low — комментарий-ложь рядом с местом, где такой запрос ожидался бы.
**Источник:** К2

### Problem

```
// ─── Add new section: open modal → POST → scroll to it ───
```

`confirmAddSection` (`:451-472`) собирает объект секции локально и пушит его в `sections.value`
(`:466`); ни `createSection`, ни какой-либо иной сетевой вызов в теле не встречается. Соседний
блок при этом объясняет верно — «создание/удаление НЕ уходит на сервер» (`:307-308`).

### Fix

Привести комментарий в соответствие с телом функции.

---

## БАГ-14 — идентификаторы новых сущностей выдаются `Date.now()`

**File:** `frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue:316`, `:410`, `:458`, `frontend_vue/src/services/mocks/config.ts:274`, `:312`
**Severity:** Medium — два объекта, созданных в одну миллисекунду, получают одинаковый id.
**Источник:** К2

### Problem

`id: \`f-custom-${Date.now()}\`` и `id: \`sec-new-${Date.now()}\`` — пять мест, ни одно из них не
защищено счётчиком. Дальше по этому id идёт вся адресация: `fieldById` (`:54-56`), удаление поля
(`:350-361`), матрица прав (`itemId`, `frontend_vue/src/types/config.ts:60`). Дубликат id даст два
элемента, которые невозможно различить ни в UI, ни в правах.

Соседний домен эту же задачу решает счётчиком: `f-perm-${++fieldSeq}`
(`frontend_vue/src/services/mocks/categories.ts:1507`).

### Fix

TBD — выдавать временный id счётчиком, как в моке категорий; постоянный всё равно назначает
сервер (на схеме это `gen_random_uuid()`,
`backend/alembic/versions/e24a3922ed01_phase_7_config.py:29`).

---

## Сводка

| Статус | Тип | Файл | Суть |
|---|---|---|---|
| | Save UX | `SupplierCardConfigPage.vue` | БАГ-01 — тост «сохранено» при упавшем сохранении |
| | Save UX | `useCardConfig.ts` | БАГ-02 — Save молча не шлёт ничего без матрицы прав |
| | Типы | `configService.ts` | БАГ-03 — мёртвая ветка перевода имени в двух PATCH-функциях |
| | Контракт | `configService.ts` | БАГ-04 — `createSection` шлёт имя строкой, мок копирует её на три языка |
| | Мёртвый код | `configService.ts` | БАГ-05 — шесть из двенадцати клиентских функций без вызывающего |
| | Мок | `mocks/config.ts` | БАГ-06 — `PUT /permissions` не сохраняет ничего |
| | Мок | `mocks/config.ts` | БАГ-07 — матрица прав строится один раз и не знает о новых элементах |
| | Коды ошибок | `mocks/config.ts` | БАГ-08 — PATCH несуществующего id отвечает `null`, а не ошибкой |
| | Мок | `mocks/config.ts` | БАГ-09 — обновление мутирует объект патча вызывающего |
| | Права | `mocks/config.ts` | БАГ-10 — удаляются системная секция и встроенное поле |
| | Мёртвый код | `useCardConfig.ts` | БАГ-11 — `hidden` не выставляется никогда |
| | Данные | `SupplierCardConfigPage.vue` | БАГ-12 — `usageCount` не пересчитывается ничем |
| | Комментарий | `SupplierCardConfigPage.vue` | БАГ-13 — комментарий обещает POST, которого нет |
| | Идентификаторы | `SupplierCardConfigPage.vue` | БАГ-14 — id из `Date.now()`, коллизия в одну миллисекунду |
