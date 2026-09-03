# Инвентаризация планов — часть 007

Каталог: `roo_code/plans/bugs` (5 планов). Код не менялся.

---

## 1. `roo_code/plans/bugs/clients-api-contract-analysis.md` — **частично**

Чекбоксов: 0 (`grep -c "^[[:space:]]*- \[ \]"` → 0).

Плана как такового нет — это анализ контракта, объявляющий четыре бага (БАГ-9…БАГ-12)
и два минора.

### Что проверено

```
$ grep -n "export function mock" frontend_vue/src/services/mocks/clients.ts
935:export function mockGetClients
939:export function mockGetClient
943:export function mockCreateClient
972:export function mockPatchClient
995:export function mockDeleteClient
1009:export function mockDeleteClientAuditEntry
1017:export function mockAddClientInteraction
1030:export function mockDeleteClientInteraction
1043:export function mockGetClientAudit
```

- **БАГ-10 (валидация POST) — СДЕЛАНО.** `mockCreateClient` (943-968) бросает
  `VALIDATION_ERROR: name/companyCode/email is required` и `CONFLICT: companyCode already
  exists`; в коде даже стоит комментарий «Валидация required полей (БАГ-10)».
- **БАГ-11 (CONFLICT при удалении) — СДЕЛАНО, но не по буквe плана.** `mockDeleteClient`
  (995-1007) спрашивает заказы у модуля заказов через `registerClientOrderLookup`
  (`src/services/mocks/orders.ts:1227`), а не считает по `orderHistory`:
  `throw new Error('CONFLICT: client has orders')`.
- **БАГ-12 (мёртвый роут audit delete) — СДЕЛАНО.** `mockDeleteClientAuditEntry`
  существует (clients.ts:1009), экспортирован (`mocks/index.ts:92`) и вызывается роутером
  (`mocks/index.ts:1502`); есть спека `src/services/mocks/audit-entry-identity.spec.ts:65`.
- **БАГ-9 (`orderHistory` в типе Client и моках) — НЕ сделан буквально и сделан по смыслу.**
  `grep -rn "orderHistory" src/` даёт только три комментария, объясняющих, что засеянный
  `orderHistory` был выдуманным и удалён осознанно (clients.ts:1000,
  useClientCard.ts:34, ClientsListPage.vue:91). Поля в `src/types/client.ts` нет. История
  заказов на карточке есть, но берётся из модуля заказов: `useClientCard` держит
  `orders`/`ordersLoading`, карточка рендерит их (`ClientCardPage.vue:363-414`, пустое
  состояние `clients.no_orders`).

### Что осталось

- Поля `orderHistory` в `Client` нет и не будет — решение задокументировано в коде,
  требование плана устарело. Поднимать не надо, но и «сделано целиком» сказать нельзя.
- Пункт 4 плана: `VALIDATION_ERROR` в `mockPatchClient` (972-977) по-прежнему отсутствует —
  только `CLIENT_NOT_FOUND`. Ошибки так и возвращаются `throw`, а не как `ApiResponse`.
- `dynamicFields` в `ClientFormData` нет (`grep -rn dynamicFields src/types/client.ts` — пусто);
  план помечал это как ⚠️.

---

## 2. `roo_code/plans/bugs/clients-bugs.md` — **сделано**

Чекбоксов: 0. Восемь багов, все помечены ✅ самим планом; код это подтверждает.

```
$ grep -n "_entity-card-layout" src/views/admin/clients/ClientsListPage.vue
16:import '@styles/admin/components/_entity-card-layout.css'     # БАГ-1
$ grep -n "empty-state" src/styles/admin/clients_list.css
140:.page-clients .empty-state {                                  # БАГ-2
$ grep -n "main-card-content" src/styles/admin/client_card.css
61:.page-client-card .main-card-content {                         # БАГ-3
65:.page-client-card .main-card-content .entity-card-grid {
$ grep -n "text-muted" src/styles/admin/client_card.css
70:.page-client-card .text-muted {                                # БАГ-4
$ grep -n "btn_retry" src/views/admin/clients/ClientsListPage.vue
274:  <button class="btn btn-primary" @click="load">{{ t('clients.btn_retry') }}</button>   # БАГ-5
$ grep -rn "btn_retry" src/i18n/admin/clients.ts
13/116/219: ru/en/lt                                             # БАГ-5, все три локали
$ grep -n "btn_delete" src/views/admin/clients/ClientCardPage.vue
594:  v-tooltip="t('clients.btn_delete')"                          # БАГ-7
$ sed -n 1043,1046p src/services/mocks/clients.ts
export function mockGetClientAudit(clientId: string): StockAuditEntry[] {
  const client = STORE.find((c) => c.id === clientId)
  return structuredClone(client?.auditLog ?? [])                  # БАГ-8
}
```

### Отклонение по букве (работы не требует)

- **БАГ-6** требовал убрать `useRouter` из импорта. Сейчас `useRouter` импортирован
  (`ClientCardPage.vue:3`) **и используется**: `router.push({ name: 'admin-order-card' … })`
  на строке 104 — переход на карточку заказа из списка заказов клиента. Правило «каждый
  импорт используется» соблюдено; удалять импорт нельзя.
- **БАГ-7:** тултип исправлен, но на строке 652 остался `t('btn.delete')` — этот ключ
  теперь существует глобально (`src/i18n/admin/warehouse.ts:679-682`: `btn: { cancel, delete,
  retry }`), так что сырой ключ не покажется.

---

## 3. `roo_code/plans/bugs/e2e-orders-row-total-race.md` — **сделано**

Чекбоксов: 0. Отчёт о починенном недетерминизме теста (помечен «✅ починен 2026-08-18»).

```
$ sed -n 106,124p frontend_vue/tests/e2e/admin/orders/orders.spec.ts
    await waitForDataReady(page)
    await page.fill('[data-test="orders-filter-search"] input', 'ORD-2026-005')
    const row = page.locator('[data-test="orders-row"]').first()
    await expect(row).toBeVisible()
    // The filter is applied by a request, and the old table is still on screen
    // until it answers. Read the number before the money, …
    await expect(row).toContainText('ORD-2026-005')
    const listTotal = (await row.locator('[data-test="orders-row-total"]').textContent())!
```

Утверждение номера заказа стоит **до** чтения суммы — ровно та починка, которую описывает
план; плюс `waitForDataReady` перед вводом фильтра. Осталось: ничего.

---

## 4. `roo_code/plans/bugs/fix-4-remaining-products-bugs.md` — **частично**

Чекбоксов: 0. Четыре бага (БАГ-40…БАГ-43) в четыре шага.

- **БАГ-43 — СДЕЛАНО.**
  ```
  $ grep -n "section_fields_title" src/i18n/admin/products.ts
  23:  section_fields_title: 'Поля категории ({path})'
  290: 'Category Fields ({path})'
  558: 'Kategorijos laukai ({path})'
  $ grep -n "section_fields" src/views/admin/products/ProductCardPage.vue
  541: ? t('products.section_fields_title', {
  544: : t('products.section_fields')
  ```
- **БАГ-40 — СДЕЛАНО, включая рекурсию.** `ProductsPage.vue:53-63` — `getCategoryPath(cat)`
  поднимается по `parentId` через `catItems` в цикле `while` и склеивает `' → '`; обновлены
  и `categoryOptions` (66-69), и `categoryFilterOptions` (71-73).
- **БАГ-41 — ПОЧТИ, один пробел.** В `mocks/categories.ts` у cat-7…cat-13 добавлены все
  требованные поля: Weight per meter (cat-7…cat-12), Flange/Web thickness (cat-7, cat-8),
  Second side width (cat-9), Tensile + Yield strength (cat-10), Tensile (cat-12),
  Connection type + Weight kg (cat-13). `fieldCount` совпадает с числом собственных полей
  (7,6,6,6,6,5,5 — пересчитано вручную по файлу).
  **Но `fieldValues` в `mocks/products.ts` для cat-10 пропускают `f-10-4` (Weight per
  meter):**
  ```
  $ grep -o "'f-10-[0-9]*'" src/services/mocks/products.ts | sort -u
  'f-10-1' 'f-10-2' 'f-10-3' 'f-10-5' 'f-10-6'      ← f-10-4 отсутствует
  $ grep -n "f-10-" src/services/mocks/products.ts
  12843 f-10-1 / 12851 f-10-2 / 12859 f-10-3 / 12872 f-10-5 / 12884 f-10-6   (prod-107)
  12978 f-10-1 / 12986 f-10-2 / 12994 f-10-3 / 13007 f-10-5 / 13019 f-10-6   (второй товар)
  ```
  У остальных категорий полный набор (например `f-7-1…f-7-7` присутствуют все).
- **БАГ-42 — СДЕЛАНО в объявленном объёме (ключи), использования нет.**
  ```
  $ grep -c "^      category_[A-Z]" src/i18n/admin/products.ts   → 39  (13 × 3 локали)
  $ grep -c "^      field_[A-Z]" src/i18n/admin/products.ts      → 114 (38 × 3)
  $ grep -c "^      enum_[A-Z]" src/i18n/admin/products.ts       → 114 (38 × 3)
  ```
  Все три батча плана (категории, поля, enum) есть в ru/en/lt и с запасом. В шаблонах эти
  ключи не используются: `grep -rn "category_\${\|field_\${\|enum_\${" src/` — пусто, мок
  отдаёт уже локализованные `{ru,en,lt}`. План сам разрешал отложить применение
  («использование в шаблонах может быть отложено»), так что это не долг, а мёртвые ключи.

### Что осталось

- Добавить `fieldValues` для `f-10-4` (Weight per meter) двум товарам cat-10 (prod-107 и
  второй, около строк 12793 и 12928 `products.ts`) — либо решить, что вес берётся из
  `weightPerWarehouseUnitKg` товара, и тогда убрать поле из категории.
- Опционально: 114+39 i18n-ключей никем не читаются — либо подключить их к рендерингу
  динамических полей, либо признать мёртвым кодом.

---

## 5. `roo_code/plans/bugs/fix-clients-delete-modal-text.md` — **сделано**

Чекбоксов: 0. Четыре изменения — все на месте.

```
$ grep -n -A8 'data-test="clients-delete-modal"' src/views/admin/clients/ClientsListPage.vue
456:  <p>{{ t('clients.confirm_delete', { name: deletingClientName }) }}</p>
457:  <p v-if="deletingClientHasOrders" class="text-warning">
458:    {{ t('clients.delete_warning_orders') }}
$ sed -n 82,86p src/views/admin/clients/ClientsListPage.vue
const deletingClientName = computed(() => {
  if (!deletingId.value) return ''
  const client = items.value.find((c) => c.id === deletingId.value)
  return client?.name ?? ''
})
$ sed -n 68,75p src/composables/useClients.ts
} catch (e) {
  const msg = String(e)
  if (msg.includes('CONFLICT')) {
    toast.error(t('clients.toast_error_delete_conflict'))
  } else {
    toast.error(t('clients.toast_error_delete'))
  }
}
$ grep -n "confirm_delete\|delete_warning_orders\|toast_error_delete_conflict" src/i18n/admin/clients.ts
19,20,50   (ru)   122,123,153 (en)   225,226,256 (lt)
```

Сверх плана: предупреждение показывается условно (`v-if="deletingClientHasOrders"`), а
факт наличия заказов спрашивается у модуля заказов; кнопка удаления ждёт ответа
(`deletingClientOrdersUnknown`). Осталось: ничего.
