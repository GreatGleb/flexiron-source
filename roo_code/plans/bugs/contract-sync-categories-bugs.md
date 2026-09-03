# Bugs — contract-sync / домен categories

Источник: сверка контракта с кодом по плану
[`roo_code/plans/api/contract-sync-plan.md`](../api/contract-sync-plan.md), фаза аудита,
линзы К2–К4. Аудит: [`roo_code/plans/api/audit/categories.md`](../api/audit/categories.md).
Область: `frontend_vue/src/services/categoriesService.ts`,
`frontend_vue/src/services/mocks/categories.ts`, ветки categories в
`frontend_vue/src/services/mocks/index.ts`, `frontend_vue/src/composables/useCategories.ts`,
`frontend_vue/src/composables/useCategoryCard.ts`,
`frontend_vue/src/views/admin/products/CategoryCardPage.vue`,
`backend/app/modules/products/shared/models.py`.
Начато: 2026-09-04.

План сверки код не правит: расхождение решается в пользу кода, а место, где неверным выглядит
сам код, уходит сюда.

---

## БАГ-01 — код ошибки удаления читается из `message`, а настоящий API кладёт его в `code`

**File:** `frontend_vue/src/composables/useCategories.ts:43-47`, `frontend_vue/src/services/mocks/index.ts:1491`
**Severity:** High — против настоящего бэкенда оба осмысленных сообщения об ошибке удаления пропадут, останется общий «что-то пошло не так».
**Источник:** К3 (каждый код доходит до человекочитаемого сообщения)

### Problem

`deleteCategory` сравнивает с кодом **текст исключения**:

```ts
const code = e instanceof Error ? e.message : ''
if (code === 'CATEGORY_HAS_PRODUCTS') { … } else if (code === 'CATEGORY_HAS_CHILDREN') { … }
```

Под моками это работает случайно: `mocks/index.ts:1491` бросает `new Error(result.code)`, то
есть кладёт код именно в `message`. Настоящий клиент так не делает — `unwrap()` собирает
`ApiRequestError`, у которого `message` это человеческий текст сервера, а машинный код лежит
в отдельном поле `code` (`frontend_vue/src/types/api.ts:28-31`, заполнение —
`frontend_vue/src/services/api.ts:71-79`). Значит при живом бэкенде обе ветки не сработают
никогда, и пользователь на попытку удалить непустую категорию получит общий
`categories.toast_error` вместо «Нельзя удалить — в категории есть товары»
(`frontend_vue/src/i18n/admin/categories.ts:61-62`).

### Fix

Читать `code` у `ApiRequestError` (с откатом на `message` для мока, пока мок бросает голый
`Error`), либо привести мок к общему виду — бросать `ApiRequestError` с заполненными `status`
и `code`. Второе лучше: оно чинит класс, а не один вызов.

### Future rule

Мок, который бросает `new Error(code)`, делает разбор ошибок непроверяемым: тест на моках
зелёный, продакшен красный. Ветка мока обязана бросать то же исключение, что и `unwrap()`.

---

## БАГ-02 — `productCount` в моке категорий разошёлся с моком товаров

**File:** `frontend_vue/src/services/mocks/categories.ts:405,459,85`, `frontend_vue/src/services/mocks/products.ts`
**Severity:** High — правило «нельзя удалить категорию с товарами» под моками не срабатывает там, где товары есть.
**Источник:** К2 (мок ↔ код), Mock data

### Problem

`productCount` — статическое число в сторе категорий, оно не считается по товарам и не растёт
при создании товара (в `mocks/categories.ts` нет ни одного обращения к товарам). Замер:

```
$ grep -o "categoryId: 'cat-[0-9]*'" src/services/mocks/products.ts | sort | uniq -c
  30 cat-2   26 cat-4   22 cat-5   21 cat-6   2 cat-7 … cat-13
```

против объявленного в сторе категорий: `cat-2` → `productCount: 12`
(`mocks/categories.ts:85`), `cat-5` → `0` (`:405`), `cat-6` → `0` (`:459`).

Следствие: `mockDeleteCategory` разрешает удалить `cat-5` и `cat-6`, у которых по два десятка
товаров, потому что проверяет именно это поле (`mocks/categories.ts:1480`). У товаров остаётся
`categoryId`, указывающий в никуда. На схеме такое удаление невозможно —
`products.category_id` объявлен `ondelete="RESTRICT"`
(`backend/alembic/versions/25245d4bf874_phase_3_categories_products.py:62`), то есть мок
демонстрирует поведение, которого у сервера не будет.

### Fix

Считать `productCount` по стору товаров при чтении категории, а не хранить числом. Если
хранение принципиально (на схеме это колонка, `backend/app/modules/products/shared/models.py:36-38`)
— пересчитывать его в `mockCreateProduct`/`mockPatchProduct`/`mockDeleteProduct` и привести
стартовые значения в соответствие с моком товаров.

### Future rule

Счётчик, который хранится числом и вычисляется в другом файле, расходится всегда. Мок обязан
считать производное значение, а не объявлять его — иначе он не reference implementation,
а декорация (см. память `mock-data-must-be-true`).

---

## БАГ-03 — селект родителя видит только первые 25 категорий

**File:** `frontend_vue/src/views/admin/products/CategoryCardPage.vue:62-65,88-93`
**Severity:** Medium — сегодня в моке 13 категорий, порог не достигнут; у арендатора с 26 категориями 26-ю нельзя выбрать родителем.
**Источник:** К4 (форма запроса), Contract

### Problem

`loadCategoryList()` зовёт `getCategories({ search: '' })` без второго и третьего аргумента,
а у подписи стоят дефолты `page = 1, pageSize = 25`
(`frontend_vue/src/services/categoriesService.ts:9-10`). Результат кладётся в `allCategories`
и напрямую становится списком вариантов родителя
(`CategoryCardPage.vue:88-93`). Ни признака «есть ещё», ни второй страницы код не запрашивает:
`res.total` не читается вовсе.

Второй потребитель того же справочника обходит это вручную: `useProductCard.ts:132` зовёт
`getCategories({ search: '' }, 1, 999)`. То есть один и тот же список берётся двумя разными
способами, и правильный из них — не тот, что в карточке категории.

### Fix

Либо завести отдельный лёгкий ответ для селектов (весь список без пагинации), либо явно
запрашивать `pageSize` достаточного размера и проверять `res.total` — тихо обрезанный
справочник хуже ошибки. Решение о форме — владельцу, оно записано в
`roo_code/plans/api/audit/00-решения-владельца.md`.

---

## БАГ-04 — «категория не найдена» приходит текстом, а не кодом, и текст показывается пользователю

**File:** `frontend_vue/src/services/mocks/categories.ts:1419`, `frontend_vue/src/composables/useCategoryCard.ts:92`
**Severity:** Medium — на экран попадает английская техническая строка мимо i18n.
**Источник:** К3 (коды ошибок)

### Problem

`mockGetCategory` бросает `new Error(\`Category ${id} not found\`)` — сообщение, а не код.
`useCategoryCard.load()` кладёт `e.message` прямо в `error`, который рисуется на странице.
Пользователь-литовец на битой ссылке видит `Category cat-99 not found`.

Домен при этом код имеет: `CATEGORY_NOT_FOUND` объявлен в `mockDeleteCategory`
(`mocks/categories.ts:1479`) и обещан старым контрактом для этого самого пути
(`roo_code/roo-context/03-api-contract.md:926`). До человекочитаемого сообщения он не доходит
нигде: в `useCategories.ts:48-50` он падает в общий `categories.toast_error`, ключа под него
в `frontend_vue/src/i18n/admin/categories.ts` нет.

### Fix

Бросать `CATEGORY_NOT_FOUND` вместо текста и завести ключ перевода. Ту же правку сделать в
`mockPatchCategory` и `mockPutCategoryFields` — см. БАГ-05.

---

## БАГ-05 — PATCH и PUT возвращают `undefined` вместо ошибки для несуществующей категории

**File:** `frontend_vue/src/services/mocks/categories.ts:1456-1458,1490-1492`
**Severity:** Medium — сохранение удалённой в другой вкладке категории завершается «успехом», данные молча теряются.
**Источник:** К4 (формы ответа), К5

### Problem

`mockPatchCategory` объявлен как `Category | undefined` и на несуществующем id возвращает
`undefined` (`:1456-1458`); `mockPutCategoryFields` — то же (`:1490-1492`). Ветка
`mocks/index.ts:1201-1207` (PATCH) и `:1172-1175` (PUT) отдают это значение как **успешный**
ответ. Клиент результата не проверяет: `useCategoryCard.save()` кладёт оба промиса в
`Promise.all` и на успехе показывает `categories.toast_saved`
(`frontend_vue/src/composables/useCategoryCard.ts:112-114`).

Сравнить с соседом по тому же файлу: `mockDeleteCategory` для того же случая возвращает
`{ ok: false, code: 'CATEGORY_NOT_FOUND' }` (`:1479`) — то есть в одном моке два разных
договора об одной и той же ситуации.

### Fix

Бросать `CATEGORY_NOT_FOUND` из обеих функций, а подписи привести к `Category` /
`CategoryField[]` без `| undefined`.

### Future rule

`| undefined` в возвращаемом типе мок-функции — это необъявленный код ошибки. Ситуация «нет
такой записи» описывается кодом, одинаковым во всех функциях домена.

---

## БАГ-06 — родителем можно назначить собственного потомка; на цикле мок зависает

**File:** `frontend_vue/src/views/admin/products/CategoryCardPage.vue:88-93`, `frontend_vue/src/services/mocks/categories.ts:1468-1473,1328-1336,1374-1381`
**Severity:** High — воспроизводимое зависание вкладки, а на сервере — недостижимое поддерево.
**Источник:** К2 (правило живёт только в моке), Runtime

### Problem

Селект родителя исключает только саму категорию:

```ts
...allCategories.value.filter((c) => c.id !== id).map(…)   // CategoryCardPage.vue:91
```

Потомки в списке остаются. `mockPatchCategory` принимает любой `parentId` без проверки
(`:1468-1473`). Назначив категории `cat-1` родителем её собственного потомка `cat-2`, получаем
цикл `cat-1 → cat-2 → cat-1`, на котором:

- `getLevel` крутится в `while (current?.parentId)` без выхода (`:1329-1335`) — вызывается
  из `toListItem` для каждой строки списка (`:1355`), то есть список категорий больше не
  открывается вовсе;
- `cascadeInheritedFields` рекурсивно обходит потомков и возвращается в исходную категорию
  (`:1374-1381`) — переполнение стека прямо в момент сохранения;
- `depthFirstSort` стартует с `visit(null)` (`:1370`) и участников цикла в выдачу не включает —
  категории исчезают из списка молча.

### Fix

Проверять цикл на записи: перед сменой `parentId` подняться от кандидата вверх и отвергнуть,
если встретилась сама категория. Код ошибки — TBD, в домене подходящего нет. Селект родителя
дополнительно должен прятать всё поддерево, а не только саму категорию, но это не замена
серверной проверке.

### Future rule

Дерево, у которого запись не проверяет цикл, ломает не запись, а чтение — и ломает в другом
месте, где причину уже не видно.

---

## БАГ-07 — `putCategoryFields` шлёт ключ `fieldName`, которого нет ни в типе, ни в разборе мока

**File:** `frontend_vue/src/services/categoriesService.ts:65-71`
**Severity:** Low — лишнее поле на проводе; вредно тем, что описывает бэкенду несуществующий договор.
**Источник:** К4 (формы запроса)

### Problem

```ts
fields: fields.map((f) => ({
  ...f,
  fieldName: typeof f.name === 'string' ? toTranslatedString(f.name, locale) : f.name,
  …
}))
```

`...f` уже кладёт `name`, а `fieldName` добавляется рядом как дубликат. В типе `CategoryField`
поля `fieldName` нет (`frontend_vue/src/types/category.ts:6-13`), и мок его не читает:
`mockPutCategoryFields` работает с `f.name` (`mocks/categories.ts:1497`). Похоже на перенос
из товаров, где `ProductFieldValue.fieldName` существует (`frontend_vue/src/types/product.ts`).

Тернарник при этом мёртв: из карточки `f.name` всегда `TranslatedString`, строкой оно не
приходит никогда (`CategoryCardPage.vue:147`, `useCategoryCard.ts:139`).

### Fix

Убрать `fieldName` из тела запроса. Если серверу нужно именно `fieldName` — тогда убрать
`name`, а не слать оба.

---

## БАГ-08 — правка поля категории стирает его переводы на двух других языках

**File:** `frontend_vue/src/views/admin/products/CategoryCardPage.vue:132-157`
**Severity:** High — необратимая потеря данных при обычном редактировании; ловится только сменой языка.
**Источник:** К4, i18n

### Problem

`openEditField` кладёт в черновик **одну** локаль: `name: tf(field.name)` (`:135`),
`options: field.options.map((o) => tf(o))` (`:137`). `submitFieldModal` заворачивает
результат обратно через `toTranslatedString(name, locale.value)` (`:147`, `:152`), а тот по
построению ставит двум другим языкам пустую строку
(`frontend_vue/src/types/i18n.ts:19-24`).

Слияние на приёме не спасает: `mockPutCategoryFields` делает
`mergeTranslatedString(старое, пришедшее)` (`mocks/categories.ts:1497-1506`), а
`mergeTranslatedString` пропускает всё, что `!== undefined`
(`frontend_vue/src/types/i18n.ts:43`) — пустая строка проходит и затирает.

Соседний код в том же файле делает правильно: имя и описание самой категории редактируются
через `mergeLocaleValue`, который сохраняет остальные языки (`CategoryCardPage.vue:70`, `:84`;
`frontend_vue/src/types/i18n.ts:52-60`). То есть в одном компоненте два разных обращения с
`TranslatedString`.

Вторая половина того же места: слияние в моке идёт **по индексу** — `cat.fields[i]`
(`mocks/categories.ts:1498`, `:1503`), а не по `id`. После drag-and-drop или удаления поля из
середины базой слияния становится чужое поле.

### Fix

В `openEditField`/`submitFieldModal` использовать `mergeLocaleValue` поверх исходного
`field.name` и исходных `field.options`, как это уже сделано для заголовка карточки.
В `mockPutCategoryFields` искать прежнее поле по `f.id`, а не по позиции.

### Future rule

`toTranslatedString` пригоден только для **создания** значения. Для правки существующего
`TranslatedString` есть `mergeLocaleValue` — иначе редактирование в одном языке стирает два
других. Это уже второй такой случай в проекте (см. `fix-toTranslatedString-merge-bug.md`).

---

## Сводка

| | Тип | Файл | Суть |
|---|---|---|---|
| | Contract | `useCategories.ts` | БАГ-01: код ошибки удаления читается из `message`, у API он в `code` |
| | Mock data | `mocks/categories.ts` | БАГ-02: `productCount` статичен и разошёлся с моком товаров |
| | Contract | `CategoryCardPage.vue` | БАГ-03: селект родителя видит только первые 25 категорий |
| | i18n | `mocks/categories.ts` | БАГ-04: «не найдена» отдаётся текстом, а не кодом, и текст на экране |
| | Runtime | `mocks/categories.ts` | БАГ-05: PATCH и PUT возвращают `undefined` вместо ошибки |
| | Runtime | `CategoryCardPage.vue` | БАГ-06: родителем можно назначить потомка — цикл, зависание `getLevel` |
| | Contract | `categoriesService.ts` | БАГ-07: лишний ключ `fieldName` в теле `PUT /:id/fields` |
| | i18n | `CategoryCardPage.vue` | БАГ-08: правка поля стирает переводы двух других языков |
