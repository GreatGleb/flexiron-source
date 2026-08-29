# Инвентаризация: refactor-prompts 07–09 (поставщики, переводы)

Общий вывод по пачке: цель всех трёх планов — перевод сущностей поставщика и конфига
карточки на `TranslatedString { ru, en, lt }` — в коде достигнута. Механизм другой:
вместо параллельных функций/композаблов `*Translated` рядом со старыми (как предлагали
планы) миграция сделана **на месте** — старые `getSuppliers()`, `createSupplier()`,
`useSuppliers()`, `useSupplierCreate()`, `useCardConfig()` сами работают с
`TranslatedString` и отдают `tf`. Ни одной функции/файла с суффиксом `Translated`
(кроме общего `useTranslatedData.ts`) в `src/` нет; эндпоинтов `/translated` у
поставщиков и конфига нет (они есть только у клиентов и заказов).

Проверка отсутствия параллельного API:
```
$ grep -rn "getSuppliersTranslated\|createSupplierTranslated\|useSuppliersTranslated\|useSupplierCreateTranslated\|useCardConfigTranslated\|getFieldLibraryTranslated\|getSectionsTranslated\|getPermissionsTranslated\|/translated" src/
src/services/mocks/index.ts:470:  if (path === '/api/clients' || path === '/api/clients/translated') {
src/services/mocks/index.ts:534:  if (path === '/api/orders' || path === '/api/orders/translated') {
$ ls src/composables/ | grep -i translat
useTranslatedData.ts
```

---

## 1. roo_code/plans/refactor/refactor-prompts/07-supplier-card-config-page.md

**Вердикт: сделано** (незакрытых чекбоксов: 0)

Достигнуто всё, что видит пользователь; расходится только транзитное строительство
(параллельные `*Translated`-функции), которое в конечном состоянии не нужно.

Доказательство:
```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/refactor/refactor-prompts/07-supplier-card-config-page.md
0

$ sed -n '1,60p' src/types/config.ts
import type { TranslatedString } from '@/types/i18n'
...
export interface FieldDefinition { id: string; name: TranslatedString; ...; options?: TranslatedString[] }
export interface SectionConfig  { id: string; name: TranslatedString; ... }
export interface PermissionItem { itemId: string; name: TranslatedString; type: 'section' | 'field'; parentId?: string }

$ grep -c "name: {" src/services/mocks/config.ts   # 17
$ grep -c "name: '" src/services/mocks/config.ts   # 0
# MOCK_FIELD_LIBRARY: name/options — { ru, en, lt } (f-company, f-status с 6 options, ...)
# MOCK_SECTIONS: name — { ru, en, lt } (sec-general ... sec-notes)
# buildMockPermissions() (config.ts:190-201) кладёт в items уже TranslatedString:
#   items.push({ itemId: sec.id, name: sec.name, type: 'section' })
#   name: fieldDef?.name ?? { ru: f.fieldId, en: f.fieldId, lt: f.fieldId }

$ grep -n "useTranslatedField\|^export function\|tf," src/composables/useCardConfig.ts
13:import { useTranslatedField } from './useTranslatedData'
15:export function useCardConfig() {
17:  const { tf } = useTranslatedField()
115:    tf,

$ grep -n "useCardConfig\|useLabelResolver\|resolveLabel\|tf(\|GlassPanel :loading" src/views/admin/suppliers/SupplierCardConfigPage.vue
10:import { useCardConfig } from '@/composables/useCardConfig'
43:} = useCardConfig()
51:  return fieldLibrary.value.filter((f) => tf(f.name).toLowerCase().includes(q))
377:  editSectionName.value = tf(sec.name)
532:  <template v-if="loading">
533:    <GlassPanel :loading="true" :skeleton-rows="8" />
535:  <template v-else-if="error">
536:    <div class="error-state">{{ error }}</div>
599: :name="tf(f.name)"      654: :name="tf(sec.name)"      755: {{ tf(item.name) }}
# resolveLabel / useLabelResolver в файле нет

$ grep -rn "useLabelResolver" src/
(пусто — композабл удалён из проекта целиком)
```

Что расходится с текстом плана (работы не требует):
- п.3: `getFieldLibraryTranslated()` / `getSectionsTranslated()` / `getPermissionsTranslated()`
  не добавлены. `configService.ts` содержит только `getFieldLibrary/getSections/getPermissions`,
  которые и так возвращают `TranslatedString`; `createField`/`patchField`/`patchSection`
  дополнительно нормализуют вход через `toTranslatedString(payload.name, locale)`.
- п.4: `useCardConfigTranslated()` нет — `tf` отдаёт сам `useCardConfig()`.

Файлы из плана: frontend_vue/src/types/config.ts, frontend_vue/src/services/mocks/config.ts,
frontend_vue/src/services/configService.ts, frontend_vue/src/composables/useCardConfig.ts,
frontend_vue/src/views/admin/suppliers/SupplierCardConfigPage.vue

---

## 2. roo_code/plans/refactor/refactor-prompts/08-supplier-create-page.md

**Вердикт: частично** (незакрытых чекбоксов: 0)

Типы, моки, композабл, страница и маршрутизация моков — сделаны. Не сделан п.5 в
рекомендованном виде: форма даёт править только текущий язык, а не все три.

Доказательство сделанного:
```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/refactor/refactor-prompts/08-supplier-create-page.md
0

$ sed -n '12,45p' src/types/supplier.ts
export interface Supplier { id: string; company: TranslatedString; contactPerson: TranslatedString; ... }
export interface SupplierCardData extends Supplier { statusReason: TranslatedString; ... }

$ grep -n "company:\|contactPerson:\|statusReason:" src/services/mocks/suppliers.ts
10:    company: { ru: 'Steel Plus OÜ', en: 'Steel Plus OÜ', lt: 'Steel Plus OÜ' },
11:    contactPerson: { ru: 'Андрес Тамм', en: 'Andres Tamm', lt: 'Andres Tamm' },
... (все 6 поставщиков MOCK_SUPPLIERS)
135:    statusReason: { ... }            # MOCK_CARD
310:    statusReason: { ru: '', en: '', lt: '' }
417-421: mockPatchSupplier мержит company/contactPerson/statusReason через mergeTranslatedString
469-491: mockCreateSupplier: company/contactPerson/statusReason ?? { ru: '', en: '', lt: '' }

$ sed -n '9,41p' src/composables/useSupplierCreate.ts
function emptyCard(defaultCurrency: string): SupplierCardData {
  company: { ru: '', en: '', lt: '' }, contactPerson: { ru: '', en: '', lt: '' },
  statusReason: { ru: '', en: '', lt: '' }, ... }
# validate(): if (!tf(supplier.value.company).trim()) return 'company_required'
# save(): await createSupplier(supplier.value, locale.value)

$ grep -n "api/suppliers'" -A 3 src/services/mocks/index.ts
917:  if (path === '/api/suppliers') {
918:    return delay(mockCreateSupplier(body as Parameters<typeof mockCreateSupplier>[0]) as T)
```

Чего нет:
- п.5 `SupplierFormSections.vue` — реализован **Вариант A** плана, а не рекомендованный
  **Вариант B**: один инпут на поле, через computed-прокси в текущую локаль:
  ```
  src/components/admin/SupplierFormSections.vue:21 function setTranslatedField(field, value)
  :30 const companyModel = computed({ get: () => tf(supplier.value.company), set: (v) => setTranslatedField('company', v) })
  :35 contactPersonModel   :41 statusReason-модель
  :174 v-model="companyModel"   :208 v-model="contactPersonModel"
  ```
  Трёх инпутов RU/EN/LT (`lang-input-group`) в файле нет — переводы на других языках
  через форму ввести нельзя.
- п.3 (сервис) `createSupplierTranslated()` не добавлен: `createSupplier(payload, locale)`
  один и сам нормализует `company/contactPerson/statusReason` через `toTranslatedString`
  (suppliersService.ts:66-77). Работы не требует.
- п.4 `useSupplierCreateTranslated()` не добавлен — миграция сделана внутри
  `useSupplierCreate()`. Работы не требует.
- п.6: `SupplierCreatePage.vue:6,17` импортирует `useSupplierCreate` (не `...Translated`) —
  следствие того же решения.

Файлы из плана: frontend_vue/src/types/supplier.ts, frontend_vue/src/services/suppliersService.ts,
frontend_vue/src/services/mocks/suppliers.ts, frontend_vue/src/composables/useSupplierCreate.ts,
frontend_vue/src/components/admin/SupplierFormSections.vue,
frontend_vue/src/views/admin/suppliers/SupplierCreatePage.vue,
frontend_vue/src/services/mocks/index.ts, frontend_vue/src/composables/useSupplierCreateTranslated (упомянут в импорте примера)

---

## 3. roo_code/plans/refactor/refactor-prompts/09-suppliers-list-page.md

**Вердикт: сделано** (незакрытых чекбоксов: 0)

Доказательство:
```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/refactor/refactor-prompts/09-suppliers-list-page.md
0

$ grep -n "useSuppliers\|tf(\|company" src/views/admin/suppliers/SuppliersListPage.vue
14:import { useSuppliers } from '@/composables/useSuppliers'
35:const { suppliers, loading, error, filters, pagination, load, changeStatus, tf } = useSuppliers()
168:  company: TranslatedString
186:    company: supplier.company,
208:      tf(s.company),            # exportCsv
466:  {{ tf(s.company) }}           # таблица
561:  :company-name="tf(s.company)" # канбан
582:  company: tf(pendingMove.company),  # модалка подтверждения переноса

$ sed -n '258,277p' src/services/mocks/suppliers.ts   # поиск по всем трём языкам
      const matchesSearch =
        s.company.ru.toLowerCase().includes(q) ||
        s.company.en.toLowerCase().includes(q) ||
        s.company.lt.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)

$ grep -n "useTranslatedField" src/composables/useSuppliers.ts
4:import { useTranslatedField } from './useTranslatedData'
8:  const { tf } = useTranslatedField()

$ grep -n "api/suppliers'" -A 12 src/services/mocks/index.ts   # 332-344: GET маршрут на mockGetSuppliers
```

Что расходится с текстом плана (работы не требует):
- `getSuppliersTranslated()` / `useSuppliersTranslated()` не добавлены — `getSuppliers()` и
  `useSuppliers()` сами возвращают `TranslatedString` и `tf`.
- CSV-экспорт отдаёт значение текущей локали (`tf(s.company)`), а не предложенный планом
  порядок `company.en ?? company.ru`.
- Фильтр рейтинга в моке — точное совпадение (`s.rating !== filters.rating`), а не `>=`
  из примера плана. Пример плана описывал не тот код, который был; п.3 плана требовал
  только поиска по трём языкам — он есть.
- п.7 `KanbanCard.vue` изменений не требовал и не получил — страница передаёт уже
  переведённую строку.

Файлы из плана: frontend_vue/src/types/supplier.ts, frontend_vue/src/services/suppliersService.ts,
frontend_vue/src/services/mocks/suppliers.ts, frontend_vue/src/composables/useSuppliers.ts,
frontend_vue/src/views/admin/suppliers/SuppliersListPage.vue, frontend_vue/src/services/mocks/index.ts,
frontend_vue/src/components/admin/KanbanCard.vue, frontend_vue/src/composables/useSuppliersTranslated (упомянут в импорте примера)
