# Инвентаризация планов — часть 009

Каталог: `roo_code/plans/bugs` (пачка «переводы / structuredClone», 5 планов).
Код не менялся. Проверки выполнялись из `frontend_vue`.

## Общий контекст пачки

Все пять планов написаны вокруг одного рефакторинга переводов. Фактическое состояние кода:
данные носят `TranslatedString` (`{ru,en,lt}`), отображение идёт через `tf()` из
`useTranslatedField`, запись — через `toTranslatedString` (сервисы) и `mergeLocaleValue`
(UI). Ни генерации i18n-ключей из сырых данных, ни `*Translated`-композаблов/эндпоинтов в
коде нет:

```
$ grep -rn "replace(/\[\^a-zA-Z0-9\]" src/          # (пусто)
$ grep -rn "productNameLabel\|categoryLabel\|fieldLabel\|enumLabel\|resolveLabel" src/   # (пусто)
$ grep -rn "useCategoriesTranslated\|useProductsTranslated\|useSuppliersTranslated\|useBccRequestTranslated\|getCategoriesTranslated\|getBccRecipientsTranslated" src/   # (пусто)
$ git log --oneline --all -S "recipients/translated" | head
116bccf added roo_code\plans        # строка есть только в самом плане, в коде её не было никогда
```

Типы чисты на момент инвентаризации:

```
$ npx vue-tsc --noEmit ; echo exit=$?
exit=0
```

---

## 1. `roo_code/plans/bugs/fix-raw-i18n-keys-architectural.md`

**Вердикт: непонятно** (чекбоксов: 16)

План описывает подход «i18n-ключ генерируется из сырого значения regex-ом» и предлагает
заменить его словарём `labelLookup` + `resolveLabel`. В коде нет ни описанной проблемы, ни
предложенного решения: regex-генерации ключей нет, четырёх функций (`productNameLabel`,
`categoryLabel`, `fieldLabel`, `enumLabel`) нет, а `labelLookup.ts`, `useLabelResolver.ts` и
скрипта генерации не существует. Задача решена другим путём — данные несут `TranslatedString`,
страницы рендерят `tf(item.name)`.

Доказательство:

```
$ ls src/i18n/labelLookup.ts src/composables/useLabelResolver.ts scripts/generate-label-lookup.mjs
ls: cannot access 'src/i18n/labelLookup.ts': No such file or directory
ls: cannot access 'src/composables/useLabelResolver.ts': No such file or directory
ls: cannot access 'scripts/generate-label-lookup.mjs': No such file or directory

$ grep -rn "productNameLabel\|categoryLabel\|fieldLabel\|enumLabel\|resolveLabel" src/
(пусто)

$ grep -rn "getCategoryPath" src/
src/views/admin/products/ProductCardPage.vue:47,314,542   (импорт из useProductCard + вызовы)
src/views/admin/warehouse/WarehousePage.vue:525,538
src/views/admin/products/ProductsPage.vue:53,68,72
src/composables/useProductCard.ts:109,315

$ sed -n 109,118p src/composables/useProductCard.ts
  function getCategoryPath(categoryId: string): string {
    const parts: string[] = []
    let current = categories.value.find((c) => c.id === categoryId)
    while (current) {
      parts.unshift(tf(current.name))      # ← tf, а не сгенерированный ключ
      ...

$ grep -n "'products\.\|\"products\." src/views/admin/suppliers/SuppliersListPage.vue src/views/admin/suppliers/SupplierCardPage.vue
(пусто)

$ grep -n "tf(" src/views/admin/products/CategoriesPage.vue | head -3
54:  ...items.value.map((item) => ({ value: item.id, label: tf(item.name) })),
158:                      {{ tf(item.name) }}
162:                <td>{{ item.parentName ? tf(item.parentName) : '—' }}</td>
```

Что осталось: ничего из плана не применимо. `getCategoryPath` жив (в `ProductsPage.vue`,
`useProductCard.ts`, плюс копия в `WarehousePage.vue`), но строит путь через `tf()` и
i18n-ключей не генерирует — на `resolveLabel` его никто не заменял и заменять не нужно.
План стоит признать устаревшим, а не незапущенным.

Пункты:

| Пункт | Вердикт | Доказательство |
|---|---|---|
| Создать `src/i18n/labelLookup.ts` с полным маппингом | не начато | `ls src/i18n/labelLookup.ts` → No such file |
| Создать `src/composables/useLabelResolver.ts` | не начато | `ls src/composables/useLabelResolver.ts` → No such file |
| Заменить `productNameLabel` в ProductsPage.vue | непонятно | функции нет вовсе (`grep productNameLabel src/` пусто); имя рендерится `tf(item.name)` (ProductsPage.vue:392) |
| Заменить `categoryLabel` в ProductsPage.vue | непонятно | `grep categoryLabel src/` пусто; категория — `tf(item.categoryName)` (ProductsPage.vue:396) |
| Заменить `getCategoryPath` в ProductsPage.vue | непонятно | функция есть (ProductsPage.vue:53), но собирает путь из `tf()`; на `resolveLabel` не заменена, i18n-ключей не строит |
| Заменить `fieldLabel` в ProductCardPage.vue | непонятно | `grep fieldLabel src/` пусто |
| Заменить `enumLabel` в ProductCardPage.vue | непонятно | `grep enumLabel src/` пусто |
| Заменить `fieldLabel` в CategoryCardPage.vue | непонятно | `grep fieldLabel src/` пусто; поля — `tf(field.name)` (CategoryCardPage.vue:135) |
| Заменить `categoryLabel` в CategoryCardPage.vue | непонятно | `grep categoryLabel src/` пусто |
| Заменить `categoryLabel` в CategoriesPage.vue | непонятно | `grep categoryLabel src/` пусто; `tf(item.name)` (CategoriesPage.vue:158) |
| Заменить `categoryLabel` и `getCategoryPath` в useProductCard.ts | непонятно | `categoryLabel` отсутствует; `getCategoryPath` жив (useProductCard.ts:109) и работает через `tf()` |
| Создать скрипт `scripts/generate-label-lookup.mjs` | не начато | `ls` → No such file |
| Проверить SuppliersListPage.vue — нет products.* | сделано | `grep "'products\." SuppliersListPage.vue` → пусто |
| Проверить SupplierCardPage.vue — нет products.* | сделано | `grep "'products\." SupplierCardPage.vue` → пусто |
| Визуально проверить все страницы | непонятно | машинно не проверяется |
| Запустить `vue-tsc --noEmit` | сделано | `npx vue-tsc --noEmit` → exit=0 |

Файлы из плана: `src/i18n/labelLookup.ts`, `src/composables/useLabelResolver.ts`,
`ProductsPage.vue`, `ProductCardPage.vue`, `CategoryCardPage.vue`, `CategoriesPage.vue`,
`useProductCard.ts`, `scripts/generate-label-lookup.mjs`, `src/i18n/admin.ts`,
`SuppliersListPage.vue`, `SupplierCardPage.vue`.

---

## 2. `roo_code/plans/bugs/fix-remaining-translation-bugs.md`

**Вердикт: непонятно** (чекбоксов: 0)

План требует добавить в мок-роутер четыре маршрута `/api/bcc/categories|recipients|history/translated`
и `/api/categories/translated`. Этих маршрутов в коде нет — но нет и того, что их запрашивало:
композаблов `useBccRequestTranslated`, `useCategoriesTranslated` и сервисных функций
`getBccRecipientsTranslated`, `getCategoriesTranslated` не существует, и в истории git строка
`recipients/translated` встречается только в самом файле плана.

Доказательство:

```
$ grep -n "translated" src/services/mocks/index.ts
470:  if (path === '/api/clients' || path === '/api/clients/translated') {
534:  if (path === '/api/orders' || path === '/api/orders/translated') {

$ grep -rn "/translated" src/services/*.ts
(пусто)

$ grep -rn "useBccRequestTranslated\|useCategoriesTranslated\|getBccRecipientsTranslated\|getCategoriesTranslated" src/
(пусто)

$ grep -n "export async function" src/services/bccService.ts
6:  getBccCategories   10: getBccRecipients   14: getBccHistory
25: sendBccRequest     49: logBccRequest      69: acceptBccResponse   76: markBccNoResponse

$ git log --oneline --all -S "recipients/translated" | head
116bccf added roo_code\plans
```

Что осталось: предписанных маршрутов нет, но и вызывать их некому — оба бага недостижимы.
Побочное наблюдение (не из плана): в `src/services/mocks/index.ts:470,534` живут ветки
`/api/clients/translated` и `/api/orders/translated`, которые никто не вызывает — остаток того
же подхода.

Файлы из плана: `frontend_vue/src/composables/useBccRequest.ts`,
`frontend_vue/src/services/bccService.ts`, `frontend_vue/src/services/mocks/index.ts`,
`frontend_vue/src/views/admin/products/CategoriesPage.vue`,
`frontend_vue/src/composables/useCategories.ts`,
`frontend_vue/src/services/categoriesService.ts`.

---

## 3. `roo_code/plans/bugs/fix-structuredClone-translation-bug.md`

**Вердикт: сделано** (чекбоксов: 0)

Все девять сабтасков закрыты — в двух случаях иным способом, чем предписано, но с тем же
результатом: ни одной смены типа ref, ни одной глубокой мутации reactive-прокси в шаблонах,
ни одного `deep: true` на объекте с `TranslatedString`.

Доказательство по сабтаскам:

```
# S1 CategoryCardPage computed setters — null вместо '' as unknown as TranslatedString
$ sed -n 67,86p src/views/admin/products/CategoryCardPage.vue
const formName = computed({
  get: () => (form.value.name ? tf(form.value.name) : ''),
  set: (v) => { form.value.name = v ? mergeLocaleValue(form.value.name, v, locale.value) : null },
})
... formDescription — то же

$ grep -rn "as unknown as TranslatedString" src/
src/services/mocks/categories.ts:1504     # мок, не форма

# S2/S8 ProductCardPage / useProductCard — form.name хранит TranslatedString
$ grep -n "name:" src/composables/useProductCard.ts | head
19:  name: TranslatedString | null       # тип ProductForm
51:    name: null,
189:        name: data.name,                # не tf(data.name)
$ sed -n 80,86p src/views/admin/products/ProductCardPage.vue
const formName = computed({ get: () => ... tf(form.value.name) ... ,
  set: (v) => { form.value.name = v ? mergeLocaleValue(form.value.name, v, locale.value) : null } })
$ grep -n "v-model=\"formName\"" src/views/admin/products/ProductCardPage.vue
309:  <input v-model="formName" ...>

# S3 SupplierFormSections — inline @input заменён на computed-модели с заменой объекта целиком
$ sed -n 21,33p src/components/admin/SupplierFormSections.vue
  const translated = mergeLocaleValue(supplier.value[field] as ..., value, locale.value)
  supplier.value = { ...supplier.value, [field]: translated }
const companyModel = computed({ get: ... tf(supplier.value.company) ..., set: (v) => setTranslatedField('company', v) })

# S4 BccRequestPage — computed-модели + v-model:subject/body
$ grep -n "subjectModel\|bodyModel\|update:subject" src/views/admin/suppliers/BccRequestPage.vue
56:const subjectModel = computed({    63:const bodyModel = computed({
824:  v-model:subject="subjectModel"   825:  v-model:body="bodyModel"

# S5 SupplierCardConfigPage — editSectionName стал plain string ref + computed-модель
$ grep -n "editSectionName" src/views/admin/suppliers/SupplierCardConfigPage.vue
366:const editSectionName = ref('')
367:const editSectionNameModel = computed({ get/set над строкой }
997:  v-model="editSectionNameModel"

# S6 useSupplierCard — своего deep-watch больше нет, dirty-check делегирован
$ grep -n "watch\|useDirtyCheck" src/composables/useSupplierCard.ts
4:import { useDirtyCheck } from './useDirtyCheck'
17:  const dirty = useDirtyCheck(supplier)        # внутри — watchEffect + toRaw

# S7 useCategoryCard — form.name инициализируется null
$ grep -n "name: null" src/composables/useCategoryCard.ts
29:    name: null,

# нигде не осталось прямых мутаций локалей из шаблона
$ grep -rn "\.ru = " src/ --include=*.vue
(пусто)

# S9 типы
$ npx vue-tsc --noEmit ; echo exit=$?
exit=0
```

Отклонения от буквы плана (результат тот же): S5 решён превращением `editSectionName` в
строковый ref, а не computed над `TranslatedString`; S6 — общим `useDirtyCheck` на
`watchEffect`, а не ручным `JSON.stringify(toRaw(...))` в композабле.

Файлы из плана: `frontend_vue/src/views/admin/products/CategoryCardPage.vue`,
`frontend_vue/src/views/admin/products/ProductCardPage.vue`,
`frontend_vue/src/components/admin/SupplierFormSections.vue`,
`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue`,
`frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue`,
`frontend_vue/src/composables/useSupplierCard.ts`,
`frontend_vue/src/composables/useCategoryCard.ts`,
`frontend_vue/src/composables/useProductCard.ts`.

---

## 4. `roo_code/plans/bugs/fix-structuredClone-v2.md`

**Вердикт: сделано** (чекбоксов: 0)

Оба предписанных шага в коде, буквально, с комментариями, повторяющими обоснование плана.

```
$ sed -n 1,50p src/composables/useDirtyCheck.ts
import { ref, watchEffect, toRaw, type Ref } from 'vue'
function deepTouch(obj: unknown): void { ... }        # обход прокси до toRaw
  // Use watchEffect instead of watch with deep: true.
  watchEffect(() => {
    deepTouch(source.value)
    isDirty.value = JSON.stringify(toRaw(source.value)) !== snapshot
  })

$ sed -n 169,175p src/views/admin/products/CategoryCardPage.vue
// Use watchEffect instead of watch with deep: true.
// watchEffect does NOT use structuredClone on the reactive proxy internally,
watchEffect(() => {
  dd.setItems(toRaw(localFields.value))
})

$ npx vue-tsc --noEmit ; echo exit=$?
exit=0
```

Плюс к плану: проблема «кнопка сохранения не загорается» закрыта функцией `deepTouch()`,
которая проходит все листья через прокси до вызова `toRaw` — глубокие зависимости
отслеживаются. Пункт 4 плана (ручная проверка в браузере) машинно не проверяется, но
поведение зафиксировано тестами `src/composables/order-audit-concurrency.spec.ts:226` и
`src/composables/useOrderCard.review.spec.ts:8`, которые прямо опираются на `isDirty` из
`watchEffect`.

Файлы из плана: `frontend_vue/src/composables/useDirtyCheck.ts`,
`frontend_vue/src/views/admin/products/CategoryCardPage.vue`.

---

## 5. `roo_code/plans/bugs/fix-toTranslatedString-merge-bug.md`

**Вердикт: частично** (чекбоксов: 0)

Шаг 1 и Шаг 2 выполнены: функция слияния добавлена (под именем `mergeLocaleValue` —
имя `mergeTranslatedString` в коде занято другой функцией, сливающей `Partial<TranslatedString>`
для PATCH), и все девять проблемных вызовов P0/P1 переведены на неё. Шаг 3 (P3) не выполнен.

```
$ sed -n 48,66p src/types/i18n.ts
/** Merges a single-locale value into an existing TranslatedString. ... */
export function mergeLocaleValue(existing: TranslatedString | null | undefined,
                                value: string, locale: string): TranslatedString {
  const result = existing ? { ...existing } : { ru: '', en: '', lt: '' }
  if (locale in result) result[locale as keyof TranslatedString] = value
  return result
}

$ grep -rn "mergeLocaleValue(" src/ | grep -v types/i18n.ts
src/views/admin/suppliers/BccRequestPage.vue:59   template.subject = mergeLocaleValue(template.subject, v, locale.value)     # P0 (план: стр. 56)
src/views/admin/suppliers/BccRequestPage.vue:66   template.body    = mergeLocaleValue(template.body, v, locale.value)        # P0 (план: стр. 61)
src/views/admin/suppliers/BccRequestPage.vue:402  source: SOURCE_TRANSLATIONS[source] ?? mergeLocaleValue(undefined, source, locale.value)  # P0 (план: стр. 407)
src/components/admin/SupplierFormSections.vue:22  setTranslatedField → mergeLocaleValue(existing, value, locale)             # P0 (план: стр. 20)
src/views/admin/products/CategoryCardPage.vue:70,84   name/description                                                       # P1 (план: 69, 83)
src/views/admin/products/ProductCardPage.vue:83,90    name/description                                                       # P1 (план: 43, 50)
src/composables/useCardConfig.ts:86              if (sec) sec.name = mergeLocaleValue(sec.name, name, locale.value)         # P1 (план: стр. 86)
# сверх плана той же правкой закрыты: useWarehouseStockCard.ts:105,116; ServiceCardPage.vue:30,37; SupplierCardPage.vue:46

$ grep -rn "toTranslatedString(" src/ | grep -v "src/types/i18n.ts" | grep -v "src/services/"
src/views/admin/suppliers/SupplierCardConfigPage.vue:317,413,459    # «потенциально нормально» по плану — создание новых секций/полей
src/views/admin/products/CategoryCardPage.vue:147,152               # то же — новые custom fields
src/composables/useProductCard.ts:178                               # НЕ в списке плана: description при создании поля
```

Что осталось:
- **P3 (Шаг 3, помечен «опционально») не сделан.** `SupplierCardPage.vue:46` по-прежнему
  оборачивает имя файла в `TranslatedString`, только теперь через `mergeLocaleValue(undefined, u.name, locale.value)`
  вместо `toTranslatedString`. План требовал хранить имя файла строкой.
- Пять «потенциально нормально» вызовов оставлены как есть — план это и рекомендовал.
- Расхождение имён: предписанный `mergeTranslatedString(existing, value, locale)` в коде
  называется `mergeLocaleValue`; под именем `mergeTranslatedString` живёт другая функция
  (`existing`, `Partial<TranslatedString>`), используемая в моках.

Файлы из плана: `frontend_vue/src/types/i18n.ts`,
`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue`,
`frontend_vue/src/components/admin/SupplierFormSections.vue`,
`frontend_vue/src/views/admin/products/CategoryCardPage.vue`,
`frontend_vue/src/views/admin/products/ProductCardPage.vue`,
`frontend_vue/src/composables/useCardConfig.ts`,
`frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue`,
`frontend_vue/src/views/admin/suppliers/SupplierCardPage.vue`,
`frontend_vue/src/services/bccService.ts`, `frontend_vue/src/services/categoriesService.ts`,
`frontend_vue/src/services/productsService.ts`, `frontend_vue/src/services/suppliersService.ts`,
`frontend_vue/src/services/configService.ts`, `frontend_vue/src/services/mocks/products.ts`.
