# Инвентаризация: roo_code/plans/refactor/single-locale-prompts (планы 07–09)

Дата: 2026-08-26. Код не менялся. Все три плана — без чекбоксов (`grep -c "^[[:space:]]*- \[ \]"` → 0).

Общий контекст пачки: рефакторинг «single-locale save» в коде УЖЕ выполнен, но
в другом наименовании эндпоинтов, чем предполагают тексты планов. В приложении и
в живом контракте (`roo_code/roo-context/03-api-contract.md`) вообще нет понятия
`/translated`: каждый ресурс имеет один plain-эндпоинт, отдающий `TranslatedString`,
а запись однолокальная через `toTranslatedString(value, locale)`.

Доказательство отсутствия `/translated`:

```
$ grep -rn "/translated" frontend_vue/src/
src/services/mocks/index.ts:470:  if (path === '/api/clients' || path === '/api/clients/translated') {
src/services/mocks/index.ts:534:  if (path === '/api/orders' || path === '/api/orders/translated') {
$ grep -rn "translated" roo_code/roo-context/03-api-contract.md
(пусто)
$ grep -rn "clients/translated\|orders/translated" frontend_vue/src frontend_vue/tests | grep -v mocks/index.ts
(пусто — вызывающих нет, это мёртвые алиасы в моке)
```

Инфраструктура фазы 1 на месте: `frontend_vue/src/types/i18n.ts` содержит
`toTranslatedString`, `mergeTranslatedString`, `mergeLocaleValue`;
`useTranslatedData.ts` `tf()` падает в `field.ru || field.en || field.lt || ''`.

---

## 1. roo_code/plans/refactor/single-locale-prompts/07-domain-analytics.md

**Вердикт: сделано**

План — только проверочный: убедиться, что read-only домен Analytics уже корректен
(нет опции `translated`, читается через `tf()`, тайпчек проходит).

Доказательство:

```
$ cat frontend_vue/src/services/analyticsService.ts
import { apiGet } from './api'
import type { AnalyticsPageKey, DashboardData } from '@/types/analytics'

export async function getAnalyticsPage(page: AnalyticsPageKey): Promise<DashboardData> {
  return apiGet<DashboardData>(`/api/analytics/${page}`)
}

$ grep -c "translated?" frontend_vue/src/composables/useAnalytics.ts
0
$ grep -n "useTranslatedField\|tf" frontend_vue/src/composables/useAnalytics.ts
4:import { useTranslatedField } from './useTranslatedData'
10:  const { tf } = useTranslatedField()
26:  return { data, loading, error, load, tf }

$ grep -rln "tf(" frontend_vue/src/views/admin/analytics/ | wc -l
8   (все восемь страниц аналитики)

$ grep -n "TranslatedString" frontend_vue/src/types/analytics.ts | head -3
1:import type { TranslatedString } from './i18n'
15:  label: TranslatedString
33:  type: TranslatedString

$ cd frontend_vue && npx vue-tsc --noEmit; echo EXIT=$?
EXIT=0
```

Единственной второй функции (`getAnalyticsPageTranslated`) не существует, опции
`translated` нет, `tf()` используется на всех страницах — то есть срабатывает ветка
плана «no changes needed».

**Оговорка (не влияет на вердикт):** буква плана предлагает при необходимости
«switch to translated endpoints». Такого эндпоинта нет ни в моке
(`src/services/mocks/index.ts:308` матчит `^/api/analytics/(.+)$`), ни в контракте —
ветка беспредметна по всей пачке, а не только в Analytics.

**Осталось:** ничего.

**Файлы, упомянутые в плане:** `frontend_vue/src/services/analyticsService.ts`,
`frontend_vue/src/composables/useAnalytics.ts`.

---

## 2. roo_code/plans/refactor/single-locale-prompts/08-phase3-global-cleanup.md

**Вердикт: частично**

Три пункта из четырёх выполнены и проверены. Пункт 2 (моки) в коде реализован
в ОБРАТНОМ наименовании: план велит удалить plain-роуты и оставить `/translated`,
а в коде остались ровно plain-роуты, а `/translated` не существует. Дублирования
(мёртвого кода) при этом нет, то есть цель пункта достигнута, требование — нет.

### Пункт 1 — убрать не-translated функции сервисов, снять суффикс `Translated`: СДЕЛАНО

```
$ grep -rn "Translated" frontend_vue/src/services/*.ts | grep -v "toTranslatedString\|TranslatedString"
(пусто — ни одной функции с суффиксом Translated не осталось)

$ grep -n "^export async function" frontend_vue/src/services/categoriesService.ts
7:export async function getCategories(
19:export async function getCategory(id: string): Promise<Category> {
23:export async function createCategory(
38:export async function patchCategory(
56:export async function deleteCategory(id: string): Promise<void> {
60:export async function putCategoryFields(
```
Аналогично по одному экземпляру каждой функции в `productsService.ts`,
`suppliersService.ts`, `bccService.ts`, `configService.ts`, `analyticsService.ts`.
Запись однолокальная: `categoriesService.ts:32` `name: toTranslatedString(data.name, locale)`,
`configService.ts:24,35,65`, `bccService.ts:39,40,61`, `suppliersService.ts:37,42,47,66,71,76`,
`productsService.ts:50,53,88,93,100,101,107`.

### Пункт 2 — GET-роуты в моке: НЕ соответствует букве плана

```
$ grep -n "if (path === '/api/\(categories\|products\|suppliers\|bcc\|config\)" frontend_vue/src/services/mocks/index.ts
332:  if (path === '/api/suppliers') {
351:  if (path === '/api/bcc/categories') return delay(mockGetBccCategories() as T)
352:  if (path === '/api/bcc/recipients') {
356:  if (path === '/api/bcc/history') {
408:  if (path === '/api/config/fields') return delay(mockGetFieldLibrary() as T)
409:  if (path === '/api/config/sections') return delay(mockGetSections() as T)
410:  if (path === '/api/config/permissions') return delay(mockGetPermissions() as T)
412:  if (path === '/api/categories') {
423:  if (path === '/api/products') {
```
Это ровно те строки, которые план требует УДАЛИТЬ, и они единственные: роутов
`/api/categories/translated`, `/api/products/translated` и т.д. в моке нет вовсе
(см. общий grep по `/translated` выше). Дублей GET на ресурс нет.

Остаточный мусор в моке: `src/services/mocks/index.ts:470` и `:534` — алиасы
`|| '/api/clients/translated'` и `|| '/api/orders/translated'` без единого вызывающего.
Эти домены в списке плана не значатся, но это тот самый мёртвый код, который фаза 3
собиралась вычистить.

### Пункт 3 — снять опцию `translated` у composables: СДЕЛАНО

```
$ for f in useCategories useCategoryCard useProducts useProductCard useSuppliers \
           useSupplierCard useSupplierCreate useBccRequest useCardConfig useAnalytics; do
    printf "%-18s exists=%s translated?=%s\n" $f \
      $([ -f frontend_vue/src/composables/$f.ts ] && echo yes || echo NO) \
      $(grep -c "translated?" frontend_vue/src/composables/$f.ts)
  done
useCategories      exists=yes translated?=0
useCategoryCard    exists=yes translated?=0
useProducts        exists=yes translated?=0
useProductCard     exists=yes translated?=0
useSuppliers       exists=yes translated?=0
useSupplierCard    exists=yes translated?=0
useSupplierCreate  exists=yes translated?=0
useBccRequest      exists=yes translated?=0
useCardConfig      exists=yes translated?=0
useAnalytics       exists=yes translated?=0
```

### Пункт 4 — удалить `useLabelResolver`, если не используется: СДЕЛАНО

```
$ grep -rn "useLabelResolver" frontend_vue/src frontend_vue/tests
(пусто — ни определения, ни вызовов)
```

### Приёмка плана

```
$ cd frontend_vue && npx vue-tsc --noEmit; echo EXIT=$?
EXIT=0
$ cd frontend_vue && npm run build 2>&1 | tail -1
✓ built in 8.49s   (EXIT=0)
```

**Осталось:** решить, что делать с пунктом 2. Либо признать его выполненным по цели
и переписать текст плана под фактическое наименование (plain-эндпоинты, `/translated`
не существует), либо — если пункт всё ещё что-то значит — вычистить два мёртвых
алиаса `/api/clients/translated` и `/api/orders/translated` в
`frontend_vue/src/services/mocks/index.ts:470,534`.

**Файлы, упомянутые в плане:** `categoriesService.ts`, `productsService.ts`,
`suppliersService.ts`, `bccService.ts`, `configService.ts`, `analyticsService.ts`,
`mocks/index.ts`, `useCategories.ts`, `useCategoryCard.ts`, `useProducts.ts`,
`useProductCard.ts`, `useSuppliers.ts`, `useSupplierCard.ts`, `useSupplierCreate.ts`,
`useBccRequest.ts`, `useCardConfig.ts`, `useAnalytics.ts`.

---

## 3. roo_code/plans/refactor/single-locale-prompts/09-phase4-verification.md

**Вердикт: частично**

Из трёх машинных шагов два прогнаны здесь и зелёные, третий (полный e2e) прогнан
выборочно; ручной чеклист из 10 пунктов не имеет автоматического покрытия вовсе.

### Шаг 1 — TypeScript: СДЕЛАНО

```
$ cd frontend_vue && npx vue-tsc --noEmit; echo EXIT=$?
EXIT=0
```
Ноль ошибок — то есть нет ни ссылок на удалённые не-translated функции, ни на
удалённую опцию `translated`, ни потерянных импортов `toTranslatedString` /
`mergeTranslatedString`.

### Шаг 2 — Build: СДЕЛАНО

```
$ cd frontend_vue && npm run build 2>&1 | tail -4
(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 8.49s
EXIT=0
```
(предупреждение о размере чанков — не ошибка; вывод идёт в `demo/app/`, git чист:
`git status --porcelain` → только неотслеживаемый `roo_code/plans/general/inventory-parts/`)

### Шаг 3 — E2E: ЧАСТИЧНО (выборка, не весь набор)

```
$ cd frontend_vue && npx playwright test tests/e2e/admin/products/categories.spec.ts --reporter=line | tail -1
  45 passed (2.2m)   EXIT=0
```
Полный `npx playwright test` (≈961 теста) в рамках инвентаризации не запускался.
Дополнительно: рабочее дерево сейчас на ветке `e2e-networkidle-1c`, где e2e-спеки
массово переписывались (см. `roo_code/roo-context/verify-runs/e2e-networkidle-1c.md`),
так что зелёный полный прогон нужно подтверждать заново, а не ссылаться на прошлый.

### Ручной чеклист (пункты 1–10): НЕ ПОКРЫТ

Ключевое утверждение плана — «в запросе ушло только `{ ru: "Тест" }`» — не проверяется
ни одним тестом:

```
$ grep -rln "toTranslatedString\|mergeTranslatedString\|mergeLocaleValue" frontend_vue/tests
(пусто)
$ grep -rn "ru: ''\|en: ''\|lt: ''" frontend_vue/tests
(пусто)
```
То есть однолокальность payload'а и фолбэк `tf()` на непустой язык держатся только
на коде сервисов и на глазах человека; регрессия здесь пройдёт мимо набора.

**Осталось:** полный прогон Playwright и автотест на однолокальный payload
(create → в запросе заполнен только текущий язык; patch → мок склеивает через
`mergeTranslatedString`; чтение при пустом текущем языке → фолбэк).

**Файлы, упомянутые в плане:** явных путей к файлам кода в плане нет — только команды
(`npx vue-tsc --noEmit`, `npm run build`, `npx playwright test`) и имена утилит
`toTranslatedString` / `mergeTranslatedString`.
