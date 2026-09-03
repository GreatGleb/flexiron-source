# Инвентаризация: roo_code/plans/refactor/single-locale-prompts (планы 01–06)

Проверено 2026-08-26. Код не менялся. Все команды выполнены из `frontend_vue/`.
Чекбоксов (`- [ ]`) нет ни в одном из шести планов — `grep -c` даёт 0, поэтому `items` пуст везде.

Общий вывод: рефакторинг Single-Locale Save в основном выполнен. Инфраструктура и три
домена из пяти совпадают с планом; в products и config расхождения в моке/мёртвом сервисе,
в suppliers плана требует того, чего в типах нет.

---

## 01-phase1-infrastructure.md — сделано

Требуется: `tf()` с фолбэком на любой непустой язык, `toTranslatedString()`,
`mergeTranslatedString()` в `src/types/i18n.ts`.

Доказательство:
```
$ grep -n "function tf" -A 12 src/composables/useTranslatedData.ts
26:  function tf(field: TranslatedString | null | undefined): string {
27-    if (!field) return ''
28-    const currentLocale = locale.value as keyof TranslatedString
29-    if (field[currentLocale]) return field[currentLocale]
30-    // Fallback to any non-empty language
31-    return field.ru || field.en || field.lt || ''
32-  }

$ cat src/types/i18n.ts
export interface TranslatedString { ru: string; en: string; lt: string }
export function toTranslatedString(value: string, locale: string): TranslatedString { ... }
export function mergeTranslatedString(existing, incoming): TranslatedString {
  return { ru: existing?.ru || '', en: existing?.en || '', lt: existing?.lt || '',
    ...Object.fromEntries(Object.entries(incoming).filter(([, v]) => v !== undefined)) }
}
export function mergeLocaleValue(existing, value, locale): TranslatedString { ... }  // сверх плана
```

Микро-расхождение (работы не создаёт, но зафиксировано): фильтр в `mergeTranslatedString`
— `v !== undefined`, план просил `v !== undefined && v !== null`. Все три примера из
раздела Verification плана при этом дают ожидаемый результат. Бонусом есть
`mergeLocaleValue()`, которого в плане нет — им пользуется UI-слой (см. suppliers/config).

Файлы плана: frontend_vue/src/composables/useTranslatedData.ts, frontend_vue/src/types/i18n.ts

---

## 02-domain-categories.md — сделано

Доказательство:
```
$ sed -n '23,70p' src/services/categoriesService.ts
createCategory(data, locale) -> name: toTranslatedString(data.name, locale),
                                description: data.description ? toTranslatedString(...) : null
patchCategory(id, delta, locale) -> цикл по Object.entries, name|description -> toTranslatedString
putCategoryFields(id, fields, locale) -> fieldName: toTranslatedString(f.name, locale),
                                         options: o -> toTranslatedString(o, locale)

$ grep -n "mergeTranslatedString" src/services/mocks/categories.ts
1460: cat.name = mergeTranslatedString(cat.name, delta.name)
1462: cat.description = mergeTranslatedString(...)
1497: name: mergeTranslatedString(cat.fields[i]?.name ?? {ru:'',en:'',lt:''}, f.name)
1502: options: mergeTranslatedString(cat.fields[i]?.options?.[oi] ?? {...}, o)

$ sed -n '1422,1440p' src/services/mocks/categories.ts
mockCreateCategory({ name: TranslatedString, ... }) -> name: data.name   // as-is

$ grep -n "useCategoryCard\|patchCategory\|putCategoryFields" src/composables/useCategoryCard.ts
14:  const { t, locale } = useI18n()
110: calls.push(patchCategory(id, patchDelta, locale.value))
111: if (fieldsChanged.value) calls.push(putCategoryFields(id, localFields.value, locale.value))

$ grep -n "useCategories(\|useCategoryCard(" src/views/admin/products/CategoriesPage.vue src/views/admin/products/CategoryCardPage.vue
CategoriesPage.vue:43: ... = useCategories()          // без { translated: true }
CategoryCardPage.vue:51: } = useCategoryCard(id)

$ sed -n '71,82p' src/views/admin/products/CategoriesPage.vue
await createCategory({ name, parentId, description }, locale.value)
```
Опции `translated` не осталось ни в композаблах, ни во вьюхах; отдельных
`categoriesServiceTranslated` файлов нет (`ls src/services/`). Создание категории живёт
не в `useCategories`, а прямо в `CategoriesPage.handleCreate` — и локаль туда передаётся.

Файлы плана: frontend_vue/src/services/categoriesService.ts, frontend_vue/src/services/mocks/categories.ts, frontend_vue/src/composables/useCategories.ts, frontend_vue/src/composables/useCategoryCard.ts, CategoriesPage.vue, CategoryCardPage.vue

---

## 03-domain-products.md — частично

Есть:
```
$ sed -n '45,110p' src/services/productsService.ts
createProduct(data, locale) -> name: toTranslatedString(...), description: toTranslatedString(...)
patchProduct(id, delta, locale) -> name, description, fieldValues[].fieldName,
      fieldValues[].options[], linkedSuppliers[].name  — все через toTranslatedString

$ grep -n "patchProduct\|locale" src/composables/useProductCard.ts
38:  const { t, locale } = useI18n()
256: await patchProduct(id, delta, locale.value)

$ grep -n "useProducts(\|useProductCard(" src/views/admin/products/ProductsPage.vue src/views/admin/products/ProductCardPage.vue
ProductsPage.vue:35: useProducts()        // без { translated: true }
ProductCardPage.vue:54: } = useProductCard(id)

$ sed -n '201,213p' src/views/admin/products/ProductsPage.vue
const created = await createProduct({ ... }, locale.value)

$ grep -n "mergeTranslatedString" src/services/mocks/products.ts
14287: name: patchName ? mergeTranslatedString(existing.name, patchName) : existing.name,
14290: categoryName: ... mergeTranslatedString(existing.categoryName, patchCategoryName)
```

Нет (пункт 2b плана — merge в моке):
```
$ sed -n '14320,14332p' src/services/mocks/products.ts
    fieldValues: data.fieldValues ?? existing.fieldValues,
    linkedSuppliers: data.linkedSuppliers ?? existing.linkedSuppliers,
$ sed -n '14284,14285p' src/services/mocks/products.ts
    description: patchDescription !== undefined ? patchDescription : existing.description,
```
То есть `mockPatchProduct` заменяет `fieldValues` и `linkedSuppliers` целиком, без
поэлементного `mergeTranslatedString` для `fieldName` / `options[]` / `name`, и заменяет
(не сливает) `description`. Сервис при этом посылает их одной локалью — значит в моке
остальные языки этих полей теряются, именно то, от чего план страховался примером в §2b.

Файлы плана: frontend_vue/src/services/productsService.ts, frontend_vue/src/services/mocks/products.ts, frontend_vue/src/composables/useProducts.ts, frontend_vue/src/composables/useProductCard.ts, ProductsPage.vue, ProductCardPage.vue

---

## 04-domain-suppliers.md — частично

Есть (простые поля):
```
$ sed -n '27,80p' src/services/suppliersService.ts
patchSupplier(id, patch, locale)  -> company, contactPerson, statusReason через toTranslatedString
createSupplier(payload, locale)   -> те же три поля

$ grep -n "mergeTranslatedString" src/services/mocks/suppliers.ts
417: company: mergeTranslatedString(base.company, patch.company)
419: contactPerson: mergeTranslatedString(...)
422: statusReason: mergeTranslatedString(...)

$ grep -n "locale" src/composables/useSupplierCard.ts src/composables/useSupplierCreate.ts
useSupplierCard.ts:40: supplier.value = await patchSupplier(id, patch, locale.value)
useSupplierCreate.ts:68: const created = await createSupplier(supplier.value, locale.value)

$ grep -n "useSuppliers(\|useSupplierCard(\|useSupplierCreate(" src/views/admin/suppliers/*.vue
SuppliersListPage.vue:35: useSuppliers()
SupplierCardPage.vue:28:  useSupplierCard(id.value)
SupplierCreatePage.vue:17: useSupplierCreate()
```

Нет (вложенные массивы из §1a/§1b/§2b плана):
```
$ grep -n "addresses\|contacts\|files\|auditLog\|priceHistory" src/services/suppliersService.ts
(пусто — ни одно вложенное поле не оборачивается ни в create, ни в patch)
$ grep -n "addresses\|contacts\|files" src/services/mocks/suppliers.ts | grep mergeTranslated
(пусто — поэлементного слияния массивов в моке нет)
```

Важная поправка к плану: перечисленных им полей частью просто нет в типах.
```
$ sed -n '81,103p' src/types/supplier.ts
interface SupplierAddress { type; line1; line2?; city; country; zip }   // .value нет, всё строки
interface SupplierContact { name: TranslatedString; role: TranslatedString; email; phone }  // .value нет
interface SupplierFile { id; name: TranslatedString; size; type; uploadedAt }
SupplierPriceEntry: product/unit/source — TranslatedString, поля priceNote нет
```
Единственное вложенное TranslatedString, которое реально пишет UI — `files[].name`, и оно
уже создаётся одной локалью на уровне вьюхи:
```
$ sed -n '41,52p' src/views/admin/suppliers/SupplierCardPage.vue
supplier.value.files.push({ ..., name: mergeLocaleValue(undefined, u.name, locale.value), ... })
```
`contacts[]` в UI не редактируется вовсе; `auditLog` / `priceHistory` пишет сервер.
Остаётся: либо дописать обёртку/слияние для `files[].name` (и, если понадобится,
`contacts[].name|role`) в сервисе и моке, либо переписать список полей в плане под
настоящие типы. Как написано, план целиком не выполним — потому «частично», а не «сделано».

Файлы плана: frontend_vue/src/services/suppliersService.ts, frontend_vue/src/services/mocks/suppliers.ts, frontend_vue/src/composables/useSuppliers.ts, frontend_vue/src/composables/useSupplierCard.ts, frontend_vue/src/composables/useSupplierCreate.ts, SuppliersListPage.vue, SupplierCardPage.vue, SupplierCreatePage.vue

---

## 05-domain-bcc.md — сделано

Доказательство:
```
$ sed -n '25,65p' src/services/bccService.ts
sendBccRequest(payload, locale) -> subject: toTranslatedString(payload.subject, locale),
                                   body: toTranslatedString(payload.body, locale)
logBccRequest(payload, locale)  -> source: toTranslatedString(payload.source, locale)

$ sed -n '267,282p' src/services/mocks/bcc.ts
mockSendBccRequest({ ..., subject: TranslatedString | string, body: TranslatedString | string })
mockLogBccRequest({ ..., source: TranslatedString | string })   // принимает as-is, ничего не разворачивает

$ grep -n "locale" src/composables/useBccRequest.ts
29:  const { locale } = useI18n()
95:  ... sendBccRequest({...}, locale.value)
120: ... logBccRequest({...}, locale.value)

$ grep -n "useBccRequest(" src/views/admin/suppliers/BccRequestPage.vue
54: } = useBccRequest()      // без { translated: true }
```
Дополнительно: шаблон письма во вьюхе правится через `mergeLocaleValue`
(BccRequestPage.vue:59,66,402) — существующие переводы не затираются.

Файлы плана: frontend_vue/src/services/bccService.ts, frontend_vue/src/services/mocks/bcc.ts, frontend_vue/src/composables/useBccRequest.ts, BccRequestPage.vue

---

## 06-domain-config.md — частично

Есть:
```
$ cat src/services/configService.ts
createField(payload, locale) -> name: toTranslatedString(payload.name, locale)      ✔
patchField(id, patch, locale) -> name -> toTranslatedString                          ✔
patchSection(id, patch, locale) -> name -> toTranslatedString                        ✔

$ grep -n "mergeTranslatedString" src/services/mocks/config.ts
292: patch.name = mergeTranslatedString(field.name, patch.name)      // mockUpdateField    ✔
328: patch.name = mergeTranslatedString(section.name, patch.name)    // mockUpdateSection  ✔

$ grep -n "useCardConfig(" src/views/admin/suppliers/SupplierCardConfigPage.vue
43: } = useCardConfig()     // без { translated: true }               ✔

$ grep -n "toTranslatedString" src/views/admin/suppliers/SupplierCardConfigPage.vue
317: name: toTranslatedString(nameStr, locale.value),   // создание поля
413: name: toTranslatedString(nameStr, locale.value),   // добавление поля в секцию
459: name: toTranslatedString(name, locale.value),      // создание секции
$ grep -n "mergeLocaleValue" src/composables/useCardConfig.ts
86: if (sec) sec.name = mergeLocaleValue(sec.name, name, locale.value)   // renameSection
```

Нет:
```
$ grep -n "export async function createSection" -A 2 src/services/configService.ts
createSection(payload: { name: string }): Promise<SectionConfig>
  return apiPost('/api/config/sections', payload)      // ни locale, ни toTranslatedString
$ sed -n '305,312p' src/services/mocks/config.ts
mockCreateSection: typeof payload.name === 'string' ? { ru: name, en: name, lt: name } : payload.name
   // тройное заполнение — ровно то поведение, которое рефакторинг убирал
```
Плюс расхождение формы: `useCardConfig` вообще не вызывает `createField/patchField/
createSection/patchSection` — конфиг накапливается локально и уходит батчем
`saveFieldLibrary/saveSections/savePermissions` (PUT). Проверено:
```
$ grep -rn "createSection\|createField(\|patchSection\|patchField(" src/ --include=*.ts --include=*.vue | grep -v "export"
src/views/admin/suppliers/SupplierCardConfigPage.vue:309:function createField()   // локальная функция вьюхи, не сервис
```
То есть четыре сервисные функции из плана — мёртвый код, а живой путь (батч-PUT) уже
пишет одну локаль. Остаётся: привести `createSection` + `mockCreateSection` к правилу
(или удалить неиспользуемые функции осознанно). Пункт «Permission item `name`» из плана
не проверяем: редактируемого имени у пункта прав в коде нет.

Файлы плана: frontend_vue/src/services/configService.ts, frontend_vue/src/services/mocks/config.ts, frontend_vue/src/composables/useCardConfig.ts, SupplierCardConfigPage.vue

---

## Замечание про пачку

В каталоге лежат ещё три плана, не входившие в эту задачу и не проверенные здесь:
07-domain-analytics.md, 08-phase3-global-cleanup.md, 09-phase4-verification.md.
