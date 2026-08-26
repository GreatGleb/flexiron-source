# Инвентаризация — часть 018

## roo_code/plans/orders/3.2-order-page-shared-components.md

**Вердикт:** сделано
**Незакрытых чекбоксов:** 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0)

План — «журнал выполнения» на 9 фаз, все помечены «сделана». Проверил каждую фазу
в коде отдельно; утверждениям плана не верил, искал и остатки прошлого состояния.

### Доказательства по фазам

**Фаза 1 + 9 — `AutoResizeTextarea`**
```
$ ls src/components/admin/ui/AutoResizeTextarea.vue
-rw-rw-r-- 1 greatgleb greatgleb 2211 Aug 12 14:43 src/components/admin/ui/AutoResizeTextarea.vue

$ grep -rln "AutoResizeTextarea" src/          # 21 файл
SupplierFormSections.vue, ui/EmailTemplate.vue, ClientCardPage, ClientCreatePage,
IncomingPaymentCardPage, OutgoingPaymentCardPage, OrderCardPage, OrderCreatePage,
CategoriesPage, CategoryCardPage, ProductCardPage, ServiceCardPage, ServicesPage,
CreateMovementModal, WarehouseBatchCard, WarehouseBatchCreatePage, WarehouseCuttingPage,
WarehouseDeficitCard, WarehouseMovementCard, WarehouseOffcutCard, WarehouseOffcutCreatePage

$ grep -rn "<textarea" src/ | wc -l
1
src/components/admin/ui/AutoResizeTextarea.vue:75:  <textarea ref="el" :value="modelValue ?? ''" @input="onInput" />

$ grep -rn "autoResizeNotes" src/
(пусто — семи копий из таблицы B1 больше нет)
```
Единственный сырой `<textarea>` в `src/` — внутри самого компонента. `CreateBatchModal.vue`
из плана в репозитории уже нет (в `warehouse/` только `WarehouseBatchCard.vue` и
`WarehouseBatchCreatePage.vue`) — файл ушёл более поздним рефакторингом, не пробел плана.

**Фаза 2 — `DatePicker` в модалке платежа**
```
$ grep -rn 'type="date"' src/
(пусто)
$ grep -n "DatePicker\|payment-date" src/views/admin/orders/OrderCardPage.vue
13:import DatePicker from '@/components/admin/ui/DatePicker.vue'
2587:        <DatePicker v-model="paymentDate" data-test="payment-date" />
```

**Фаза 3 — `SuffixSelect`**
```
$ ls src/components/admin/ui/SuffixSelect.vue   → есть (3630 байт)
$ grep -rn "SuffixSelect" src/ --include=*.vue | grep -v ui/SuffixSelect.vue
BccRequestPage.vue:1042, OrderCardPage.vue:1280, WarehouseBatchCard.vue:782,
WarehouseBatchCreatePage.vue:572          → ровно 4 места из плана
$ grep -rn "currencyOpen\|custom-select-wrap'" (те же 4 файла)
(пусто — самодельное состояние и клик-аутсайд снесены)
$ grep -rn "field-currency-trigger|trigger-test" src/
trigger-test="field-currency-trigger" в OrderCardPage:1283, WarehouseBatchCard:786,
WarehouseBatchCreatePage:575 → data-test складских тестов сохранены
```

**Фаза 4 — одно радио**
```
$ find src/styles -name "_radio.css"
src/styles/admin/components/_radio.css
$ grep -rn "_radio.css" src/
OrderCreatePage.vue:26, FinanceSettings.vue:10, AddLineModeChooser.vue:12
   (подключён из компонентов-потребителей — ловушка #16 соблюдена)
$ grep -rn "client-radio" src/
(пусто)
$ grep -n "radio-input|radio-custom" ...
AddLineModeChooser.vue:44-45, OrderCreatePage.vue:303,307, FinanceSettings.vue:99,104
```
`accent-color` у радио чузера больше нет (в `AddLineModeChooser` остался только
`.add-mode-option .radio-custom` — раскладка, не второй вариант контрола).

**Фаза 5 — C1-C4, B4**
```
$ grep -rn "\.field-error|\.required-star|\.static-suffix|\.icon-flip-x" src/styles/
_global.css:46 .icon-flip-x
_input-suffix.css:48,52 .static-suffix
_forms.css:69 .required-star, :74 .field-error, :81 .modal-body p.field-error
$ grep -n "field-error|required-star|icon-flip-x|radio" src/styles/admin/orders_create.css
(пусто — из локального файла всё убрано)
$ grep -rn "rotate(180deg)" src/views/admin/orders/
(пусто)
$ grep -n "EUR|useSettings|defaultCurrency" src/views/admin/orders/AddOrderServicesModal.vue
6: import { useSettings }   27: const { settings } = useSettings()
341,404,410: settings.constants.defaultCurrency   (' EUR' зашитого нет)
$ grep -n "input-with-suffix|static-suffix" src/views/admin/orders/OrderCreatePage.vue
483,490,496,503,509,516,522,529 → четыре итога получили суффикс валюты
$ grep -n "x-close" src/views/admin/orders/OrderCardPage.vue
2102: <SvgIcon name="x-close" :width="14" :height="14" />
$ grep -n "x-close" src/components/admin/SvgIcon.vue → 58
```
Оставшийся сырой `<svg>` в `OrderCardPage:1042` — это `.info-hint` (подсказка статуса),
не кнопка удаления из B4.

**Фаза 6 — `usePagination` в модалках**
```
$ grep -n "usePagination|watchEffect|totalPages" AddOrderItemsModal.vue AddOrderServicesModal.vue
Items:    8: import { usePagination }   275: usePagination(5)   299: watchEffect
Services: 7: import { usePagination }   190: usePagination(5)   214: watchEffect
```
Скопированной `pageNumbers()` в модалках нет.

**Фаза 7 — `Pagination.vue`**
```
$ ls src/components/admin/ui/Pagination.vue → есть (3630/3xxx байт)
$ grep -rln "ui/Pagination|<Pagination" src/ | wc -l
18
(ClientsListPage, DocumentArchivePage, IncomingPaymentsPage, OutgoingPaymentsPage,
 NotificationsPage, AddOrderItemsModal, AddOrderServicesModal, OrderCreatePage,
 OrdersListPage, CategoriesPage, ProductsPage, ServicesPage, LogsSettings,
 BccRequestPage, SuppliersListPage, WarehouseBatchCreatePage,
 WarehouseOffcutCreatePage, WarehousePage)
$ grep -n "compact" src/components/admin/ui/Pagination.vue
33: compact?: boolean    55: :class="{ 'pagination-compact': compact }"
```
План обещал 17 файлов — в коде 18, компактный вариант пропом есть, модалки его передают
(`:compact="true"`, AddOrderItemsModal:638).

**Фаза 8 — `AppModal` вместо `window.confirm`**
```
$ grep -rn "window.confirm" src/
OrderCreatePage.vue:148:  * This was the one `window.confirm` in the admin — …   (только комментарий)
$ grep -n "onBeforeRouteLeave|AppModal|confirm_leave|hasPendingChanges" OrderCreatePage.vue
3: onBeforeRouteLeave   14: import AppModal   156: hasPendingChanges
178: onBeforeRouteLeave(() => …)   572-598: <AppModal> с confirm_leave_stay/discard
```

### Что осталось (не влияет на вердикт)

- `.client-pagination` (26px-переопределения, `orders_create.css:75-145`) всё ещё
  приватная копия размеров: `OrderCreatePage:322` оборачивает общий `<Pagination>`
  этим классом вместо пропа `:compact`. Фаза 7 перечисляла три приватные копии
  (две модалки заказа + BCC) и их убрала; список клиентов на странице создания в том
  перечне не значился, так что это не невыполненный пункт плана, а соседний хвост.
- Раздел D («мёртвый код») план явно вынес за рамки задачи. Фактическое состояние:
  `PriceInput.vue` и `CheckboxList.vue` в `src/` больше не находятся вовсе;
  `_inline-edit.css` по-прежнему не импортируется ни одним файлом
  (`grep -rn "_inline-edit" src/` — пусто); `orders_card.css:187-194` всё ещё гасит
  спиннеры для `.cell-input` при глобальном правиле в `utilities/_global.css`.
- Пункты «Общей проверки в конце» (typecheck/eslint/vitest/playwright, снапшоты,
  браузерный проход) — это прогоны, а не состояние кода; здесь не воспроизводились.

### Пункты плана

Чекбоксов в файле нет (0). Фазы проверены поштучно, вердикты выше: фазы 1-9 — сделаны.
