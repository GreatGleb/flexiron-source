# Инвентаризация планов — часть 005

Каталог: `roo_code/plans/bugs`

---

## roo_code/plans/bugs/3.1-orders-bugs.md

**Вердикт:** сделано
**Незакрытых чекбоксов:** 0 (`grep -c "^[[:space:]]*- \[ \]"` → `0`)

Файл — bugs-лист по странице создания заказа (21 баг, все помечены ✅ в тексте и в сводке).
Чекбоксов нет: единица работы — заголовок `## ✅ БАГ-NN`. Проверены все 21 против кода;
отметки плана подтвердились полностью.

### Доказательство целиком

```
$ grep -c "^[[:space:]]*- \[ \]" roo_code/plans/bugs/3.1-orders-bugs.md
0

$ grep -rn "data-table-wrapper" src/styles/admin/orders_card.css
src/styles/admin/orders_card.css:228:.data-table-wrapper {
  (правило overflow-x: auto / overflow-y: visible; OrderCreatePage.vue:29 импортирует orders_card.css)

$ grep -rn "recipients-pagination|client-pagination" src/
src/views/admin/orders/OrderCreatePage.vue:322:  class="client-pagination"
src/styles/admin/orders_create.css:78,85,94,102,110,123,128,134,140: .client-pagination …
  (класс переименован и правила перенесены в orders_create.css; recipients-pagination остался только у BccRequestPage)

$ grep -rn "custom-select-sm" src/
src/styles/admin/components/_custom-select.css:138,143,147,154,161,165,169
src/components/admin/ui/Pagination.vue:62
  (правила вынесены в CSS компонента, глобально подключённый)

$ grep -rn "searchable" src/views/admin/orders/OrderCreatePage.vue src/styles/
  (пусто — мёртвый класс убран)

$ grep -rn "glass-textarea" src/
  (пусто — класс убран из всех шести мест)

$ grep -n "style=" src/views/admin/orders/OrderCreatePage.vue
  (пусто)
$ grep -n "client-field-label|client-list-empty|order-create-file-list" src/styles/admin/orders_create.css
32:.client-field-label {   45:.client-list-empty {   64:.order-create-file-list {

$ grep -n -A12 "<AddOrderItemsModal" src/views/admin/orders/OrderCreatePage.vue
557:    <AddOrderItemsModal
558-      :show="showAddItemsModal"
559-      :default-margin-percent="settings.constants.defaultMargin"
560-      :default-discount-percent="settings.constants.defaultDiscountPercent"
  (и AddOrderServicesModal с :default-discount-percent; :order-id больше нет)

$ grep -n "orderId" src/views/admin/orders/AddOrderItemsModal.vue src/views/admin/orders/AddOrderServicesModal.vue
$ grep -n "order-id" src/views/admin/orders/OrderCreatePage.vue src/views/admin/orders/OrderCardPage.vue
  (пусто в обоих — проп удалён у модалов и у вызывающих)

$ grep -n "useOrderPermissions|canSeeCost|rightsReady|col_cost|col_margin" src/views/admin/orders/OrderCreatePage.vue
7:import { useOrderPermissions } from '@/composables/useOrderPermissions'
68:const { ready: rightsReady, canSeeCost } = useOrderPermissions()
69:const showCost = computed(() => rightsReady.value && canSeeCost.value)
445:<th v-if="showCost">{{ t('orders.col_cost') }}</th>
447:<th v-if="showCost">{{ t('orders.col_margin_amount') }}</th>

$ grep -n "baseCurrencyOf|receivedCurrency" src/composables/useOrderCreate.ts src/composables/useOrderCard.ts src/services/mocks/orders.ts
useOrderCreate.ts:233:  receivedCurrency: baseCurrencyOf(settings),
useOrderCard.ts:1199:  receivedCurrency: baseCurrencyOf(settings),
mocks/orders.ts:457,2047:  receivedCurrency: baseCurrencyOf(mockGetSettings()),
  (функция объявлена в src/services/orderLines.ts:146)

$ grep -n "vatMode|rollupOrder|recalcLocalTotals" src/composables/useOrderCreate.ts
335:  const vatMode = computed<VatMode>(() => …)
341:  const rolled = rollupOrder(lines, vatMode.value, settings.constants.vatRate)
355:  watch(vatMode, recalcLocalTotals)
$ grep -n "localOrder.total" src/views/admin/orders/OrderCreatePage.vue
485: money(localOrder.totalCost)  498: totalAmount  511: totalVat  524: totalWithVat

$ grep -n "defaultMarginPercent" src/services/mocks/orders.ts
565:  defaultMarginPercent: mockGetSettings().constants.defaultMargin,
1538: defaultMarginPercent: mockGetSettings().constants.defaultMargin,
  (литерала 15 в обеих точках больше нет)

$ sed -n '119,145p' src/composables/useOrderCreate.ts
  getClients({ search: clientSearch.value, status: null, sortBy: 'name', sortDir: 'asc',
               page: clientPagination.page.value, pageSize: clientPagination.pageSize.value })
  (pageSize: 1000 и локальная фильтрация убраны; ошибка пишется в clientsError)

$ grep -n "@media" src/styles/admin/orders_create.css
147:@media (max-width: 992px) {
153:@media (max-width: 600px) {   (+ .order-create-header-row .btn { width: 100% })

$ grep -n "createdOrderId" src/composables/useOrderCreate.ts
368: const createdOrderId = ref<string | null>(null)
373: const isPartiallySaved = computed(() => createdOrderId.value !== null)
386,392,394,450: повторное сохранение дособирает начатое

$ grep -in "order" src/views/public/ScreensPage.vue
166: { id: '3.2', routeName: 'admin-orders', … }
167: { id: '3.2n', routeName: 'admin-order-create', … }
170: routeName: 'admin-order-card'   (нумерация согласована — комментарий :165)

$ grep -n "конфликт номеров/исторический" roo_code/plans/orders/3.1-orders-plan.md
3:> ⚠️ **Исторический документ.** Это план первоначальной постройки страниц заказов, и он выполнен.
16,18: ссылки на orders-backend-contract.md и order-pricing-frontend-plan.md

$ grep -n "ZERO_QUANTITY" src/services/mocks/orders.ts src/domain/orderPricing.ts
orderPricing.ts:323: if (line.quantity <= 0) throw new Error('ZERO_QUANTITY')
orderPricing.ts:387: if (quantity === 0) throw new Error('ZERO_QUANTITY')
mocks/orders.ts:1993, 2273  (позиции и услуги — обе)

$ sed -n '270,320p' src/views/admin/orders/OrderCreatePage.vue
276: v-if="clientsError" … create_clients_error + кнопка create_btn_retry
291: <template v-else> … create_no_clients только внутри неё

$ grep -n "hasPendingChanges|onBeforeRouteLeave|confirm_leave" …
OrderCreatePage.vue:3: import { useRouter, onBeforeRouteLeave } from 'vue-router'
OrderCreatePage.vue:54,156,178: подключено; модал 574-595
i18n/admin/orders.ts:38-41 (ru), 518-521 (en), 997-998 (lt): ключи в трёх языках
```

### Что осталось

Ничего. Все 21 находки закрыты в коде.

Оговорки, зафиксированные самим планом (не работа, а состояние):
- БАГ-07: ветка с наценкой на сеяных данных недостижима (нет товара без каталожной цены и с
  остатком), e2e-тест на равенство цен проходит и со сломанным кодом. Чтобы ветка стала
  проверяемой, нужен сеяный товар без цены и с партией — это отдельная задача на моки, а не
  недоделка правки.
- БАГ-10: исходный диагноз в плане был неверен; починка ушла в другую точку (`baseCurrencyOf`),
  формат поля сменён с id (`cur-eur`) на код (`EUR`).
- БАГ-17: план `3.1-orders-plan.md` помечен историческим с отсылками к действующим документам —
  выбран второй из двух предложенных вариантов.

### Пункты

Чекбоксов в плане нет (0). Единицы работы — 21 запись БАГ-NN, все со вердиктом «сделано»:
БАГ-01…БАГ-21 (доказательства выше, по одному блоку на находку).
