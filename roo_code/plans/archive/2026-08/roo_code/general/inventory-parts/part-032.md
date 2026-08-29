# Инвентаризация планов — часть 032

Каталог: `roo_code/plans/refactor/refactor-prompts` (планы 04, 05, 06 — рефакторинг переводов страниц).
Код НЕ менялся. Проверки только на чтение (grep / cat / `npx vue-tsc --noEmit`).

## Общий вывод по пачке

Цель всех трёх планов достигнута: пользовательские строки этих страниц — `TranslatedString { ru, en, lt }`,
моки отдают все три языка, страницы рендерят через `tf()` из `useTranslatedField()`, `useLabelResolver`
в проекте отсутствует полностью (`grep -rln useLabelResolver frontend_vue/src/` → пусто).

Отличие от буквы планов — одно и то же во всех трёх: планы требовали **параллельных** сущностей
(`getCategoryTranslated()` рядом с `getCategory()`, `useCategoryCardTranslated()` рядом с
`useCategoryCard()`, эндпоинты `/api/.../translated`) и явно писали «старую НЕ удаляем».
В коде вместо этого **старые функции и композаблы переведены на месте**, дублей нет:

```
$ grep -rn "getCategoryTranslated\|useCategoryCardTranslated\|getBccCategoriesTranslated\|getBccRecipientsTranslated\|getBccHistoryTranslated\|useBccRequestTranslated\|getSupplierTranslated\|useSupplierCardTranslated" frontend_vue/src frontend_vue/tests
(пусто)

$ grep -rn "/translated" frontend_vue/src
frontend_vue/src/services/mocks/index.ts:470:  if (path === '/api/clients' || path === '/api/clients/translated') {
frontend_vue/src/services/mocks/index.ts:534:  if (path === '/api/orders' || path === '/api/orders/translated') {
```

Поэтому вердикт каждого плана — **частично**: результат есть, предписанная планом структура
«две функции рядом» — нет. Работы при этом не осталось: параллельные `*Translated`-обёртки —
устаревшая часть плана, добавлять их сейчас значит плодить дубли. Не поднимать заново.

Типизация чистая: `cd frontend_vue && npx vue-tsc --noEmit` → `exit=0`, вывод пустой (0 строк).

---

## 1. `roo_code/plans/refactor/refactor-prompts/04-category-card-page.md`

**Вердикт: частично**
Незакрытых чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0).

### Что есть

`frontend_vue/src/types/category.ts` — целиком по плану и дальше него:
```
import type { TranslatedString } from './i18n'
CategoryField.name: TranslatedString ; options: TranslatedString[]
Category.name: TranslatedString ; description: TranslatedString | null   (план оставлял string | null)
CategoryListItem.name / parentName: TranslatedString | null
```

`frontend_vue/src/services/mocks/categories.ts` — 197 вхождений `ru:`; ни одного
пользовательского поля плоской строкой:
```
$ grep -nE "(name|description|options):[[:space:]]*'" frontend_vue/src/services/mocks/categories.ts
(пусто)
```

`frontend_vue/src/composables/useCategoryCard.ts` — импортирует `useTranslatedField`,
держит `const { tf } = useTranslatedField()`, форма типизирована как
`{ name: TranslatedString | null; parentId: string | null; description: TranslatedString | null }`,
возвращает `tf` в конце. Логика `load/save/discard/addField/updateField/deleteField/reorderFields`
совпадает с телом плана (плюс проброс `locale.value` в `patchCategory` / `putCategoryFields`).

`frontend_vue/src/views/admin/products/CategoryCardPage.vue` — `resolveLabel` 0 вхождений,
`tf(` 13 вхождений (включая все перечисленные в плане места: `category.name`, `form.name`,
`field.name`, `field.options`, `allCategories.find(...)!.name`, `s.company`, `s.name`).
Скелетон и ошибка ровно как в плане:
```
244:  <template v-if="loading">
245:    <GlassPanel :loading="true" :skeleton-rows="6" />
247:  <template v-else-if="error">
```

### Чего нет
- `getCategoryTranslated()` в `frontend_vue/src/services/categoriesService.ts` — нет; используется
  переведённая на месте `getCategory(id)` → `/api/categories/${id}`, без суффикса `/translated`.
- `useCategoryCardTranslated()` — нет; переведён сам `useCategoryCard()`.

---

## 2. `roo_code/plans/refactor/refactor-prompts/05-bcc-request-page.md`

**Вердикт: частично**
Незакрытых чекбоксов: 0.

### Что есть

`frontend_vue/src/types/bcc.ts` — все семь полей из плана переведены:
`BccCategory.name`, `BccRecipient.company` и `.contactPerson`, `BccRequest.supplierName`,
`.productName`, `.source`, `BccEmailTemplate.subject` и `.body`, `BccAttachment.name` —
все `TranslatedString`; `BccRequest.unit?: string` оставлен строкой, как и требовал план.

`frontend_vue/src/services/mocks/bcc.ts` — 41 `ru:`; единственная плоская строка среди
проверяемых полей — `185: unit: 'ton'`, а `unit` план переводить не требовал. Категории и
история — точь-в-точь пример плана (`{ ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }`,
`source: { ru: 'BCC Инструмент', en: 'BCC Tool', lt: 'BCC įrankis' }`).

`frontend_vue/src/composables/useBccRequest.ts` — `useTranslatedField`, `const { tf } = ...`,
`DEFAULT_TEMPLATE` с тремя языками в `subject`/`body`, `tf` в возврате; `send()` и `log()`
приводят строку к текущей локали через `tf()`.

`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue` — `resolveLabel` 0, `tf(` 17
(в том числе `prod.name`, `cat.name`, `p.name`, `evt.productName`, `evt.supplierName`, `r.company`).
Скелетон и ошибка:
```
607:  <template v-if="loading && categories.length === 0 && recipients.length === 0">
608:    <GlassPanel :loading="true" :skeleton-rows="8" />
611:    <div class="error-state">{{ error }}</div>
```

### Чего нет
- `getBccCategoriesTranslated()`, `getBccRecipientsTranslated()`, `getBccHistoryTranslated()`
  в `frontend_vue/src/services/bccService.ts` — нет; работают переведённые на месте
  `getBccCategories()` / `getBccRecipients()` / `getBccHistory()` на `/api/bcc/...` без `/translated`.
- `useBccRequestTranslated()` — нет; переведён сам `useBccRequest()`.

---

## 3. `roo_code/plans/refactor/refactor-prompts/06-supplier-card-page.md`

**Вердикт: частично**
Незакрытых чекбоксов: 0.

### Что есть

`frontend_vue/src/types/supplier.ts` — `Supplier.company`, `.contactPerson`,
`SupplierCardData.statusReason`, `SupplierPriceEntry.product`/`.unit`/`.source`,
`SupplierContact.name`/`.role`, `SupplierFile.name`, `SupplierHistoryItem.action`/`.user`/`.details`
— все `TranslatedString`. Технические поля из «Примечания» плана остались как были.
Отличие в лучшую сторону: `SupplierAuditEntry` теперь не отдельная копия, а
`export type SupplierAuditEntry = StockAuditEntry`, и в `frontend_vue/src/types/warehouse.ts:474`
у `StockAuditEntry` поля `user: TranslatedString` и `property: TranslatedString` — требование
плана выполнено через единый тип (там же появился `id`, которого в плане не было).

`frontend_vue/src/services/mocks/suppliers.ts` — 62 `ru:`; `MOCK_SUPPLIERS[0]` совпадает с
примером плана дословно (`company: { ru: 'Steel Plus OÜ', ... }`,
`contactPerson: { ru: 'Андрес Тамм', en: 'Andres Tamm', lt: 'Andres Tamm' }`), а `contacts`,
`files`, `history`, `priceHistory` (включая `unit: { ru: 'кг', en: 'kg', lt: 'kg' }` и
`unit: null`), `auditLog` — все с тремя языками. Плоских строк в переводимых полях нет.

`frontend_vue/src/composables/useSupplierCard.ts` — `useTranslatedField`, `const { tf } = ...`,
`load()` / `save()` как в плане (плюс `locale.value` в `patchSupplier`), возвращает `tf`.

`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue` — `resolveLabel` 0, `tf(` 6:
`tf(p.product)` (требование плана), а также `tf(p.unit)`, `tf(p.source)`, `tf(f.name)`,
`tf(a.user)`, `tf(a.property)`. Загрузка и ошибка есть, но не одним `GlassPanel :skeleton-rows="6"`,
а пофайловым скелетоном по панелям:
```
145:  <div v-if="loading && !supplier" class="main-card-content" data-test="supplier-card-loading">
148:    <GlassPanel :title="t('sp.status_title')" :loading="true" :skeleton-rows="3" />
163:  <div v-else-if="error" class="main-card-content" data-test="supplier-card-error">
```

### Чего нет
- `getSupplierTranslated()` в `frontend_vue/src/services/suppliersService.ts` — нет; используется
  переведённая на месте `getSupplier(id)`.
- `useSupplierCardTranslated()` — нет; переведён сам `useSupplierCard()`.
- Скелетон не в форме `<GlassPanel :loading="true" :skeleton-rows="6" />` из плана — вариант
  по панелям, задачу «показать загрузку и ошибку» закрывает.
