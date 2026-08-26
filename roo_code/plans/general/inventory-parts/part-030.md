# Инвентаризация: roo_code/plans/refactor (часть 030)

Проверено 2026-08-26. Код не менялся.

---

## 1. roo_code/plans/refactor/single-locale-save-refactor.md

**Вердикт: частично** (незакрытых чекбоксов: 0 — план ведёт список подзадач нумерацией, не чекбоксами)

### Что уже сделано (доказательства)

Фаза 1 — инфраструктура: сделана целиком.

`cat frontend_vue/src/composables/useTranslatedData.ts` — `tf()` ровно в целевом виде:
```ts
function tf(field: TranslatedString | null | undefined): string {
  if (!field) return ''
  const currentLocale = locale.value as keyof TranslatedString
  if (field[currentLocale]) return field[currentLocale]
  // Fallback to any non-empty language
  return field.ru || field.en || field.lt || ''
}
```
`cat frontend_vue/src/types/i18n.ts` — есть `toTranslatedString(value, locale)`, `mergeTranslatedString(existing, incoming)` и сверх плана
`mergeLocaleValue(existing, value, locale)` (для UI-мержа при редактировании).

Фаза 2 — домены 1–4, 6 сделаны; домен 5 (Config) — почти.

`grep -rn "translated: true\|translated?:" frontend_vue/src --include=*.ts --include=*.vue` → пусто.
Опция `translated` вырезана из композаблов и вьюх полностью.

`grep -rn "Translated(" frontend_vue/src | grep -v "toTranslatedString|mergeTranslatedString|useTranslatedField"` → пусто.
То есть Фаза 3.1 (удалить старые не-translated функции, переименовать `*Translated` → оригинальное имя) выполнена:
ни одной функции `get*Translated`/`create*Translated` в сервисах не осталось.

Categories: `categoriesService.ts` — `createCategory(..., locale)` строка 32 `name: toTranslatedString(data.name, locale)`,
`patchCategory(..., locale)` строка 48, `putCategoryFields(..., locale)` строки 68–69.
`mocks/categories.ts` — `mockPatchCategory` строки 1460–1462 и `mockPutCategoryFields` 1497–1502 мержат через `mergeTranslatedString`.
`useCategoryCard.ts:110-111` передаёт `locale.value`. `CategoriesPage.vue:80` — тоже.
`CategoryCardPage.vue` — `mergeLocaleValue` для name/description (70, 84), `toTranslatedString` для field name/options (147, 152).

Products: `productsService.ts` — `createProduct(..., locale)` 50–53, `patchProduct(..., locale)` 88–107,
включая вложенные `fieldValues[].fieldName`, `fieldValues[].options[]`, `linkedSuppliers[].name` (строки 96–108) —
как требует раздел «Важно» домена 2. `mocks/products.ts` — `toTranslatedString` при create (14132–14219),
`mergeTranslatedString` при patch (14287–14290). `useProductCard.ts:178,256` передаёт locale.
`ProductCardPage.vue:83,90` — `mergeLocaleValue`. `useProducts.ts` — только чтение/удаление, сохранения нет, менять было нечего.

Suppliers: `suppliersService.ts` — `patchSupplier(id, patch, locale)` и `createSupplier(payload, locale)` оборачивают
`company`, `contactPerson`, `statusReason`. `mocks/suppliers.ts:417-422` мержит те же три поля.
`useSupplierCard.ts:40`, `useSupplierCreate.ts:68` передают `locale.value`.
`SupplierFormSections.vue:22-42` — `setTranslatedField` через `mergeLocaleValue`.
Раздел «Важно» домена 3 частично устарел: `addresses[]` в `types/supplier.ts:82-89` — обычные строки,
никакого `addresses[].value: TranslatedString` там нет; `contacts[]`, `priceHistory[]`, `auditLog[]` в UI не редактируются
(`grep contacts` по SupplierCardPage.vue и SupplierFormSections.vue — только отображение).
`files[].name` оборачивается: `SupplierCardPage.vue:46` `mergeLocaleValue(undefined, u.name, locale.value)`.

BCC: `bccService.ts` — `sendBccRequest(..., locale)` 39–40 (subject/body), `logBccRequest(..., locale)` 61 (source).
`useBccRequest.ts:95,120` передаёт locale. Моки `mockSendBccRequest`/`mockLogBccRequest` (bcc.ts:267,277) принимают payload как есть — как план и требовал (4.3).

Config: `configService.ts` — `createField(..., locale)` 24, `patchField(..., locale)` 35, `patchSection(..., locale)` 65.
`mocks/config.ts:292,328` — `mergeTranslatedString` в `mockUpdateField`/`mockUpdateSection`.
`useCardConfig.ts:86` — `mergeLocaleValue`. `SupplierCardConfigPage.vue:317,413,459` — `toTranslatedString`.
Пункт 5.6 (убрать `translated: true`) закрыт.

Analytics (домен 6): `analyticsService.ts` — единственная `getAnalyticsPage`, эндпоинт один (`/api/analytics/${page}`);
`grep "translated\|locale" src/composables/useAnalytics.ts` → пусто, опции `translated` там нет. Оба пункта 6.1–6.2 закрыты
(6.1 закрыт иначе, чем предполагал план: не «уже используется translated endpoint», а разделения на два эндпоинта больше нет).

Фаза 3.4: `useLabelResolver` в проекте отсутствует — `ls src/composables | grep -i label` пусто,
`grep -rn "useLabelResolver" src` пусто. Удалён.

Фаза 4.1: `cd frontend_vue && npx vue-tsc --noEmit` → exit=0, ноль ошибок.

### Что осталось

1. **Пункт 5.2, половина про `createSection`** — не сделан. `frontend_vue/src/services/configService.ts:54`:
   `export async function createSection(payload: { name: string }): Promise<SectionConfig>` — ни параметра `locale`,
   ни `toTranslatedString`. (Функция при этом мёртвая: `grep -rn "createSection" src tests` вне сервиса и мока
   даёт только регистрацию маршрута в `mocks/index.ts:115,925`.)
2. **Пункт 5.4, половина про `mockCreateSection`** — не сделан и содержит ровно тот антипаттерн, против которого написан план.
   `frontend_vue/src/services/mocks/config.ts:306-309`:
   ```ts
   const name: TranslatedString =
     typeof payload.name === 'string'
       ? { ru: payload.name, en: payload.name, lt: payload.name }
       : payload.name
   ```
3. **Фаза 3.2 выполнена в обратную сторону.** План требовал оставить в `mocks/index.ts` только `/translated`-маршруты;
   фактически убрали `/translated`, оставив обычные пути — но два алиаса дожили:
   `src/services/mocks/index.ts:470` `path === '/api/clients' || path === '/api/clients/translated'` и
   `:534` то же для `/api/orders`. Вызывающих `/translated` в коде нет (`grep -rn "/translated" src` вне index.ts — пусто).
   Цель («один набор маршрутов») достигнута, буква пункта — нет.
4. **Мелкий остаток того же антипаттерна в домене BCC:** `src/views/admin/suppliers/BccRequestPage.vue:308`
   `name: { ru: u.name, en: u.name, lt: u.name }` для имени вложения (аналогичное место в SupplierCardPage.vue
   уже переведено на `mergeLocaleValue`). Прямо в подзадачах 4.1–4.5 не названо.
5. Фазы 4.2/4.3 (`npm run build`, `npx playwright test`) в этой инвентаризации не запускались — проверен только `vue-tsc`.

---

## 2. roo_code/plans/refactor/translation-refactor-audit-plan.md

**Вердикт: сделано** (незакрытых чекбоксов: 0)

Это отчёт-сводка на 6 починок; проверены все шесть.

1. `createCategoryTranslated()` в `categoriesService.ts` — функция существует под унифицированным именем `createCategory`
   (переименование из Фазы 3.1 соседнего плана) и оборачивает name/description: `categoriesService.ts:32,34`
   `name: toTranslatedString(data.name, locale)`. Обёртка теперь одноязычная, а не `{ru,en,lt}` — это осознанное развитие,
   а не откат: одноязычность и есть цель `single-locale-save-refactor.md`.
2. `CategoriesPage.vue` — вызов идёт через `createCategory({ name, parentId, description }, locale.value)` (строки 74–82),
   строкой в plain-виде ничего не отправляется.
3. `BccRequestPage.vue` — `showToast(t('bcc.preselected', { company: tf(supplier.company) }))` (строка 548). `tf()` на месте.
4. `CategoryCardPage.vue:219` — `.map((s) => ({ value: s.id, label: tf(s.company) }))`. `tf()` на месте.
5. `SupplierCardConfigPage.vue` — `v-model="editSectionNameModel"` (строка 997), где `editSectionNameModel` —
   `computed` со строковым get/set (строки 367–372). Объект `TranslatedString` во `v-model` не попадает.
6. `ProductCardPage.vue` — `name: s.company` передаётся объектом (строка 211), а подпись обёрнута:
   `label: tf(s.company)` (строка 764).

Проверка из отчёта воспроизведена: `cd frontend_vue && npx vue-tsc --noEmit` → exit=0, ноль ошибок.
`npm run build` не запускался.
