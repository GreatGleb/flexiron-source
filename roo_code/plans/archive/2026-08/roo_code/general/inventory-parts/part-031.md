# Инвентаризация: roo_code/plans/refactor/refactor-prompts (01–03)

Проверено 2026-08-26. Код не менялся.

Все три плана — одна пачка про перевод каталога на `TranslatedString { ru, en, lt }`
(типы → моки → сервис → композабл → страница + скелетон). Цель достигнута во всех трёх,
но **не тем способом, который написан в планах**: планы велят добавить ПАРАЛЛЕЛЬНЫЕ
`getProductsTranslated()` / `useProductsTranslated()` / `getCategoriesTranslated()` /
`useCategoriesTranslated()` и эндпоинты `/api/products/translated`,
`/api/products/:id/translated`, `/api/categories/translated`, «старые НЕ удаляем».
В коде вместо этого миграция на месте: старые `getProducts` / `getProduct` /
`getCategories` и `useProducts` / `useProductCard` / `useCategories` сами отдают и
разрешают `TranslatedString`, дублей нет, `/translated`-путей для products и categories
нет (они есть только для clients и orders — `src/services/mocks/index.ts:470,534`).
`useLabelResolver.ts` удалён целиком, `resolveLabel` в `src/` не встречается ни разу.

Незакрытых чекбоксов в планах нет ни в одном (`grep -c "^[[:space:]]*- \[ \]"` → 0/0/0),
поэтому пунктовой разбивки нет — сверялся по разделам «Файлы для изменения».

---

## 1. 01-products-page.md — сделано

Вердикт: **сделано** (цель), с осознанным отклонением от буквы плана — см. преамбулу.

Доказательства:

```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/refactor/refactor-prompts/01-products-page.md
0

$ cat frontend_vue/src/types/product.ts
import type { TranslatedString } from './i18n'
...
export interface ProductFieldValue {
  fieldName: TranslatedString
  options?: TranslatedString[]
}
export interface LinkedSupplier { name: TranslatedString ... }
export interface ProductListItem { name: TranslatedString; categoryName: TranslatedString | null ... }
export interface Product { name: TranslatedString; categoryName: TranslatedString | null;
                           description: TranslatedString | null ... }
   (description переведён шире, чем требовал план — в плане он оставался string | null)

$ head -60 frontend_vue/src/services/mocks/products.ts
    name: { ru: 'Стальной лист 3мм', en: 'Steel Sheet 3mm', lt: 'Plieno lakštas 3mm' },
    categoryName: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
    description: { ru: 'Горячекатаный...', en: 'Hot-rolled...', lt: 'Karštai...' },
        fieldName: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' },

$ grep -n "linkedSuppliers" -A6 frontend_vue/src/services/mocks/products.ts | grep "name:"
129- name: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' },
251- ... 398- Nordic Steel AB ... 528- Metal Trade LT ... 635- ...   (все обёрнуты)

$ grep -n "options: \['" frontend_vue/src/services/mocks/products.ts frontend_vue/src/services/mocks/categories.ts
   (пусто — плоских строковых options не осталось)

$ grep -rn "resolveLabel" frontend_vue/src/
   (пусто)
$ ls frontend_vue/src/composables/useLabelResolver.ts
ls: cannot access ...: No such file or directory

$ grep -n "export function" frontend_vue/src/composables/useProducts.ts
9:export function useProducts() {
$ sed -n 1,15p frontend_vue/src/composables/useProducts.ts
6:import { useTranslatedField } from './useTranslatedData'
12:  const { tf } = useTranslatedField()

$ grep -n "useProducts\|tf(" frontend_vue/src/views/admin/products/ProductsPage.vue
7:import { useProducts } from '@/composables/useProducts'
34:const { items, loading, error, filters, load, deleteProduct, pagination, toggleSort, tf } =
54:  const parts: string[] = [tf(cat.name)]          # модалка фильтра
60:    parts.unshift(tf(parent.name))                # модалка фильтра
392:                  {{ tf(item.name) }}
396:              <td>{{ item.categoryName ? tf(item.categoryName) : '—' }}</td>

$ grep -n "GlassPanel\|error-state" frontend_vue/src/views/admin/products/ProductsPage.vue
12:import GlassPanel from '@/components/admin/GlassPanel.vue'
293:    <GlassPanel :loading="loading" :skeleton-rows="8" data-test="products-table">
294:      <div v-if="error" class="error-state" data-test="products-error">

$ npx vue-tsc --noEmit   → exit=0, вывода нет
```

Что осталось: ничего из содержания. Не сделано только буквальное требование
«добавить рядом со старым, старое НЕ удаляем» — и делать этого уже не нужно:
единственный путь уже переведён, дубли были бы второй правдой об одном.
Скелетон реализован как `:loading="loading"` на самом `GlassPanel`, а не
`v-if="loading"`-веткой из плана — эффект тот же.

## 2. 02-product-card-page.md — сделано

Вердикт: **сделано** (цель), то же отклонение: `getProductTranslated()` /
`useProductCardTranslated()` не появились, работает миграция на месте.

Доказательства:

```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/refactor/refactor-prompts/02-product-card-page.md
0

Типы product.ts и category.ts — см. выкладки в п.1 и п.3 (CategoryListItem.name и
.parentName уже TranslatedString).

$ head -40 frontend_vue/src/services/mocks/categories.ts
    name: { ru: 'Металл', en: 'Metal', lt: 'Metalas' },
    description: { ru: 'Все виды металлопродукции', en: '...', lt: '...' },
        name: { ru: 'Марка стали', en: 'Steel grade', lt: 'Plieno markė' },

$ grep -n "export function" frontend_vue/src/composables/useProductCard.ts
37:export function useProductCard(id: string) {
$ grep -n "Translated" frontend_vue/src/composables/useProductCard.ts
8:import { useTranslatedField } from './useTranslatedData'
10:import { toTranslatedString } from '@/types/i18n'
19:  name: TranslatedString | null
20:  description: TranslatedString | null
40:  const { tf } = useTranslatedField()
174-179: нормализация description → TranslatedString

$ sed -n 105,120p frontend_vue/src/composables/useProductCard.ts
  function getCategoryPath(categoryId: string): string {
    ...
      parts.unshift(tf(current.name))          # ровно как в плане

$ sed -n 1,55p frontend_vue/src/views/admin/products/ProductCardPage.vue
8:import { useProductCard } from '@/composables/useProductCard'
...  tf,
} = useProductCard(id)
$ grep -c "tf(" frontend_vue/src/views/admin/products/ProductCardPage.vue
11

$ grep -n "v-if=\"loading\"\|GlassPanel :loading=\"true\"\|v-else-if=\"error\"" frontend_vue/src/views/admin/products/ProductCardPage.vue
239:  <template v-if="loading">
243:          <GlassPanel :loading="true" :skeleton-rows="4" />
244:          <GlassPanel :loading="true" :skeleton-rows="3" />
247/250: ещё две
255:  <template v-else-if="error">

$ npx vue-tsc --noEmit   → exit=0
```

Что осталось: ничего. Скелетон здесь сделан буквально по плану (v-if/v-else-if/v-else),
даже богаче — четыре панели вместо одной.

## 3. 03-categories-page.md — сделано

Вердикт: **сделано** (цель), то же отклонение: `getCategoriesTranslated()` /
`useCategoriesTranslated()` не появились.

Доказательства:

```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/refactor/refactor-prompts/03-categories-page.md
0

$ cat frontend_vue/src/types/category.ts
import type { TranslatedString } from './i18n'
export interface CategoryField { name: TranslatedString; options: TranslatedString[] ... }
export interface Category { name: TranslatedString; description: TranslatedString | null ... }
export interface CategoryListItem { name: TranslatedString; parentName: TranslatedString | null ... }
   (description переведён шире, чем требовал план)

Моки categories.ts — см. выкладку в п.2; parentName собирается getParentName()
в frontend_vue/src/services/mocks/categories.ts:1352.

$ grep -n "export async function" frontend_vue/src/services/categoriesService.ts
7:getCategories  19:getCategory  23:createCategory  38:patchCategory
56:deleteCategory  60:putCategoryFields          — отдельной *Translated нет

$ sed -n 1,20p frontend_vue/src/composables/useCategories.ts
6:import { useTranslatedField } from './useTranslatedData'
9:export function useCategories() {
12:  const { tf } = useTranslatedField()

$ grep -n "useCategories()\|GlassPanel\|error-state\|v-if=\"loading\"" frontend_vue/src/views/admin/products/CategoriesPage.vue
4:import GlassPanel from '@/components/admin/GlassPanel.vue'
43:const { items, loading, error, filters, pagination, load, deleteCategory, tf } = useCategories()
113:    <template v-if="loading">
114:      <GlassPanel :loading="true" :skeleton-rows="6" data-test="categories-loading" />
117:    <template v-else-if="error">
118:      <div class="error-state" data-test="categories-error">{{ error }}</div>
122:      <GlassPanel data-test="categories-table">

$ npx vue-tsc --noEmit   → exit=0
```

Что осталось: ничего. Композабл получил ещё и пагинацию, которой в плане не было.

---

## Вывод для прогона

Пачку 01–03 в работу брать не нужно. Единственное расхождение с текстом планов —
отсутствие параллельных `*Translated`-функций и `/translated`-эндпоинтов для
products/categories; это не долг, а решение против дублирования: старые функции
сами переведены, `useLabelResolver` удалён. Если кто-то соберётся «дозакрыть» планы
буквально, он создаст вторую реализацию рядом с первой — ровно тот питфолл, из-за
которого проект уже трижды разбирал находки аудита заказов.
