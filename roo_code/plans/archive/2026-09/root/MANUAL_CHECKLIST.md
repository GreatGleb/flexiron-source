# Manual Verification Checklist — Currency & FIFO + UOM Restructure

> Проверь каждую страницу и каждое поле перед коммитом.
> Отмечай `[x]` когда проверил.

---

## 1. 🏭 Товары → Список (`/admin/products`)

- [ ] Таблица товаров отображается
- [ ] Поиск и фильтр по категории работают
- [ ] Клик по товару ведёт в карточку

## 2. 🏭 Товары → Карточка (`/admin/products/:id`)

### Price section
- [ ] Поле **Default sale price** — отображается
- [ ] Поле **Avg cost price** — отображается (read-only)
- [ ] Поле **Avg sale price** — отображается (read-only)

### Suppliers table
- [ ] Цена каждого поставщика отображается с валютой: `100.00 EUR`
- [ ] Кнопка "Add supplier" работает
- [ ] Добавленный поставщик виден с валютой

### UOM section
- [ ] **Purchase UOM** — выбран/отображается
- [ ] **Warehouse UOM** — выбран/отображается
- [ ] **Sale UOM** — выбран/отображается
- [ ] **Purchase → Warehouse factor** — поле ввода
- [ ] **Warehouse → Sale factor** — поле ввода

### Currency section
- [ ] **Currency** — выбран/отображается

## 3. 🏭 Товары → Создание (`/admin/products/create`)

- [ ] Все поля (name, SKU, category, price, currency, UOM, conversion) отображаются
- [ ] Сохранение работает (появится в списке)

## 4. 📂 Категории (`/admin/categories`)

- [ ] Список категорий отображается
- [ ] Создание новой категории работает
- [ ] Редактирование категории работает

## 5. 📦 Склад → Главная (`/admin/warehouse`)

- [ ] Вкладки переключаются: Stock / Batches / Movements / Offcuts / Deficit
- [ ] Stock — общий остаток по продуктам отображается

## 6. 📦 Склад → Создание Batch (`/admin/warehouse/batches/create`)

- [ ] **Currency** — не хардкод `EUR`, а значение из настроек (например `EUR` или другое)
- [ ] **Product** — при выборе товара auto-fill **Unit** из `warehouseUomId`
- [ ] **Product** — при выборе товара auto-fill **Currency** из валюты товара
- [ ] **Supplier** — при выборе поставщика pre-fill **Received Currency ID** из LinkedSupplier
- [ ] **Conversion Preview** — если purchase UOM ≠ warehouse UOM, показывается предпросмотр
- [ ] **Audit поля** — `Received Quantity`, `Received Unit Price`, `Exchange Rate` видны
- [ ] Кнопка **Save** работает

## 7. 📦 Склад → Batch Card (`/admin/warehouse/batches/:id`)

- [ ] Все поля отображаются: batch number, supplier, quantity, unit, unit price, total cost
- [ ] Поле **Currency** отображается
- [ ] Audit поля видны: received quantity, received unit price, exchange rate

## 8. 📦 Склад → Movements (`/admin/warehouse/movements`)

- [ ] Создание movement: поле **Currency** (из batch)
- [ ] Movement card: отображается currency

## 9. 📦 Склад → Offcuts (`/admin/warehouse/offcuts`)

- [ ] Создание offcut работает
- [ ] Offcut card отображается

## 10. 📦 Склад → Deficit (`/admin/warehouse/deficit`)

- [ ] Дефицит отображается по продуктам

## 11. 📋 Заказы → Список (`/admin/orders`)

- [ ] Список заказов отображается
- [ ] Поиск/фильтры работают

## 12. 📋 Заказы → Создание (`/admin/orders/create`)

- [ ] Поле **Currency** в форме заказа (default из settings)
- [ ] Выбор клиента работает
- [ ] Кнопка "Add Items" открывает модалку

## 13. 📋 Заказы → Модалка добавления товаров

### Таблица товаров (верхняя часть)
- [ ] Колонка **Product** — название товара
- [ ] Колонка **Available** — доступное количество на складе (с конверсией sale UOM)
- [ ] Если остаток низкий (< minStock) — подсвечивается красным
- [ ] Колонка **Avg Cost** — FIFO-цена (средняя себестоимость)
- [ ] При наведении на Avg Cost — tooltip: "Avg cost: X.XX EUR"
- [ ] При выборе товара — **unitPrice** берётся из FIFO cost, не из `product.price`

### Таблица выбранных товаров (нижняя часть)
- [ ] Колонки: Item, Qty, Unit, **Unit Price**, **Cost** (FIFO), Total, Action
- [ ] **Cost** — отображает FIFO-цену за единицу
- [ ] **Unit Price** — отображается с валютой (не хардкод `EUR`)
- [ ] **Total** — отображается с валютой (не хардкод `EUR`)
- [ ] При изменении Qty — пересчёт FIFO cost

### Сохранение
- [ ] Кнопка **Save** — выбранные товары добавляются в заказ

## 14. 📋 Заказы → Карточка (`/admin/orders/:id`)

- [ ] Items отображаются с `receivedCurrency`, `exchangeRate`
- [ ] Цены отображаются с валютой
- [ ] Редактирование/удаление items работает

## 15. ⚙️ Настройки → Company (`/admin/settings/company`)

- [ ] Настройки компании загружаются
- [ ] Сохранение работает

## 16. ⚙️ Настройки → Finance (`/admin/settings/finance`)

- [ ] **Default Currency** — отображается
- [ ] **VAT Rate** — отображается
- [ ] Список **Currencies** — отображается
- [ ] Можно добавить/редактировать валюту

## 17. ⚙️ Настройки → Units (`/admin/settings/units`)

- [ ] Список единиц (kg, m, pcs, m²) отображается
- [ ] Можно создать/редактировать UOM

## 18. 🏢 Поставщики → BCC Request (`/admin/suppliers/bcc`)

- [ ] Форма BCC запроса работает
- [ ] Отправка запроса работает

## 19. 🏢 Поставщики → Card Config (`/admin/suppliers/card-config`)

- [ ] Настройка карточки поставщика работает

## 20. 📊 Аналитика — все страницы

- [ ] **Dashboard** — данные загружаются
- [ ] **Deficit** — данные загружаются
- [ ] **Logistics** — данные загружаются
- [ ] **P&L Report** — данные загружаются
- [ ] **Sales** — данные загружаются
- [ ] **Staff** — данные загружаются
- [ ] **Supply** — данные загружаются
- [ ] **Warehouse** — данные загружаются

## 21. 🔐 Публичные страницы

- [ ] **Login** — форма и вход работают
- [ ] **Register** — форма и регистрация работают
- [ ] **Auth Link Handler** — magic link работает
- [ ] **Screens** — страница отображается

## 22. 🌐 Локализация

- [ ] Переключить на **RU** — все новые надписи на русском
- [ ] Переключить на **EN** — все новые надписи на английском
- [ ] Переключить на **LT** — все новые надписи на литовском
- [ ] Нет битых ключей (ключи вида `field_...` вместо текста)

## 23. 🖥️ Консоль браузера

- [ ] Нет ошибок в консоли (F12 → Console)
- [ ] Нет 404 на API запросы (F12 → Network)
- [ ] Моки работают без ошибок (если VITE_USE_MOCKS=true)

---

## 📝 Итого

| Раздел | Статус |
|--------|--------|
| 1-3. Товары | `[ ]` |
| 4. Категории | `[ ]` |
| 5-10. Склад | `[ ]` |
| 11-14. Заказы | `[ ]` |
| 15-17. Настройки | `[ ]` |
| 18-19. Поставщики | `[ ]` |
| 20. Аналитика | `[ ]` |
| 21. Публичные | `[ ]` |
| 22. Локализация | `[ ]` |
| 23. Консоль | `[ ]` |
