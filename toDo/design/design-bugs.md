# Design Bugs — Ошибки реализованного дизайна

> Здесь описаны конкретные несоответствия, которые **не должны быть**: 
> либо противоречат дизайн-системе, либо реализованы непоследовательно в разных местах кода.
> Каждый пункт — задача на исправление.

---

## 1. JetBrains Mono не применяется в `.data-table` (основная таблица аналитики)

**Дизайн-система требует** JetBrains Mono для всех технических/числовых данных.

**В коде** шрифт уже применён в нескольких местах:
- `_price-input.css` — поля цен ✓
- `_audit-log.css` — лог аудита ✓
- `_email-template.css` — редактор письма ✓
- `_checkbox-list.css`, `_checklist.css` — коды в чеклистах ✓
- `bcc_request.css` — ID запросов, request ID ✓
- `SupplierFormSections.vue:157` — inline style на код компании ✓

**Но НЕ применён** в `.data-table` — основном классе таблицы, который используется во всех аналитических страницах (Warehouse, Staff, Supply, Logistics, Deficit) и в Suppliers List, Products. Числовые колонки в этих таблицах отображаются в Inter.

**Исправление**: добавить в `erp-base.css` к `.data-table` правило для числовых ячеек, либо добавить утилитарный класс `.mono { font-family: 'JetBrains Mono', monospace; }` и применять на `<td>` с техническими данными.

---

## 2. `.btn-secondary` применяется как для Cancel/Back, так и для активных действий

**Задуманная семантика** (по дизайн-системе `15_button_system`):
- `btn-primary` — синий, главное CTA (Create, Send, Confirm)
- `btn-secondary` — **серый/neutral**, отказ от действия (Cancel, Discard, Back)

**Проблема 1 — CSS**: `.btn-secondary` сейчас **синий** (`background: #1890ff`, box-shadow). Нужен серый/ghost стиль.

**Проблема 2 — Неправильные применения**: ряд активных action-кнопок ошибочно используют `btn-secondary` вместо `btn-primary`:

| Файл | Строка | Кнопка | Должно быть |
|---|---|---|---|
| `SuppliersListPage.vue` | 366 | Save View | `btn-primary` (синий — сохранение) |
| `SupplierCardPage.vue` | 104 | BCC Tool | `btn-primary` (синий — запуск действия) |
| `BccRequestPage.vue` | 535, 544 | Log Request | `btn-primary` (синий — добавление) |
| `CategoryCardPage.vue` | 300 | Add Field | `btn-primary` (синий — добавление) |

**Корректное применение `btn-secondary`** (серый по дизайн-системе) — эти кнопки правильно используют secondary, но сейчас синие из-за CSS:

| Файл | Строка | Кнопка | Почему secondary |
|---|---|---|---|
| `SuppliersListPage.vue` | 292 | Export CSV | Export = Neutral/Gray по дизайн-системе |
| `SuppliersListPage.vue` | 312 | BCC Request (nav) | Пассивная навигация к инструменту |
| `ProductsPage.vue` | 99 | Категории (nav) | Пассивная навигация |
| `ProductsPage.vue` | 108 | Услуги (nav) | Пассивная навигация |
| `SupplierCardPage.vue` | 112 | Card Config (nav) | Навигация к настройкам |

**Корректные применения `btn-secondary`** (Cancel/Discard/Back — должны остаться, только получить серый стиль): `BccRequestPage:1099`, `SuppliersListPage:629`, `CategoriesPage:168,190`, `ProductCardPage:50,59`, `SupplierCreatePage:53`, `SupplierCardConfigPage:860,883,906,929,962,995,1036`, `CategoryCardPage:183,346`, `ProductsPage:204,231`, `SupplierCardPage:324`.

---

## 3. Мёртвый CSS — `.status-badge` и `.status-*` не используются нигде

В коде определена вторая система бейджей, которая **нигде не применяется**:

**Dead CSS** — классы прописаны в двух файлах одновременно:
- `src/styles/admin/components/_status-pills.css` строки 51–87
- `src/styles/admin/main.css` строки 1211–1247

Классы: `.status-badge`, `.status-sent`, `.status-responded`, `.status-no_response`, `.status-partial`, `.status-all_responded`.

Ни один `.vue` файл их не использует. Все компоненты (включая `BccRequestPage.vue`, где они изначально планировались) используют систему `.status-pill` + `.pill-*`.

**Проблема двойная:**
1. Дублирование: одни и те же классы в двух CSS-файлах
2. Dead code: занимает место, вводит в заблуждение

**Исправление**: удалить блок `.status-badge`/`.status-*` из обоих файлов.

---

## 4. Мёртвый CSS `.pill-purple` + дублирование `.pill-suspended`

**`.pill-purple`**: определён в `_status-pills.css:34` и `main.css:1195` — ни один `.vue` файл его не использует. Dead code.

**`.pill-suspended`**: используется в `SuppliersListPage.vue:74` и `SupplierFormSections.vue:21` — живой. Но определён в **трёх** местах одновременно: `_status-pills.css:39`, `main.css:1200`, `suppliers_list.css:894`. Тройное дублирование.

**Цвет `#ff7a45`** (оранжевый для Suspended) не входит в официальную палитру дизайн-системы, но семантически обоснован (между Warning-жёлтым и Danger-красным). Нужно просто задокументировать.

**Исправление**: удалить `.pill-purple` из обоих файлов; оставить `.pill-suspended` только в `_status-pills.css`, убрать дубли из `main.css` и `suppliers_list.css`.

---

## 5. Dashboard — 4 KPI вместо 5

Дизайн (`05.3_Dashboard.md`) описывает **5 KPI-карточек**: Стоимость склада, Дебиторка, Продажи за неделю, Активные заказы, Дефицит позиций.

В коде — только **4 карточки**, пятая (Дефицит, красный, со счётчиком позиций номенклатуры) отсутствует. При этом данные о дефиците есть в системе (есть аналитика дефицита).

---

## 6. Dashboard — статичные хардкод-значения в KPI и графике

KPI значения в `DashboardPage.vue` (`127 400 EUR`, `38 750 EUR` и т.д.) и значения bar-chart — **захардкожены напрямую в шаблоне**, а не берутся из composable/service/mock.

Все остальные страницы используют `useAnalytics()` → сервис → mock. Dashboard выбивается из этой архитектуры и нарушает паттерн DDD.

---

## 7. Dashboard — тип графика не соответствует дизайну

Дизайн (`05.3`) описывает **линейный график** (line chart) с двумя кривыми: продажи в € (синяя) и объём в тоннах (белая), с периодом (7 дней / месяц) и selector'ом периода.

В коде — **горизонтальный bar chart** по категориям металла. Нет переключателя периода. Разные данные. Дизайн-мокап `06_dashboard_cards.png` показывает именно table/card-style виджеты, которые ближе к тому, что есть в коде, — но это противоречит текстовой спецификации `05.3`.

---

## 8. Glass inner-glow на sidebar реализован через box-shadow, не border

Дизайн `05.2_Sidebar.md` специфицирует правую границу сайдбара:
```
border-right: 1px solid rgba(255,255,255,0.35)
box-shadow: inset -1px 0 0 rgba(255,255,255,0.2)
```

В коде (`base-layout.css`):
```css
box-shadow: 5px 0 20px rgba(0,0,0,0.3);
```

Реализован тёмный shadow наружу (для глубины), но нет светлой правой обводки (inner glow). Эффект стекла работает, но не точно по спецификации.

---

## 9. Table row height не соответствует дизайн-системе

Дизайн (`09_master_table`) определяет:
- Default row height: **40px**
- Compact: 32px
- Relaxed: 48px

В CSS (`_tables.css`) `history-table td` имеет `padding: 0.75rem` (12px top+bottom = ~24px + content), что даёт строки ~36-40px. Но явного `height: 40px` нет — высота нестабильна при разном контенте. Нет классов `.compact` и `.relaxed`.

---

## 10. Zebra striping не реализована

Дизайн (`09_master_table`) описывает зебра-полосы: чётные строки `#FBFCFD` (светло-серый), нечётные `#FFFFFF`. 

В коде таблицы (`_tables.css`) нет правила `tr:nth-child(even)`. Зебра отсутствует. При этом дизайн-система относит её к базовым требованиям мастер-таблицы.

> Примечание: в dark-mode системе zebra логичнее реализовать через `rgba(255,255,255,0.02)` для чётных строк.

---

## 11. Hover на таблице: неправильный цвет

Дизайн (`09_master_table`) определяет hover-цвет строки: **`#F0F7FF`** (светло-голубой).

В коде (`_tables.css`) hover:
```css
tr:hover td { background: rgba(255,255,255,0.04); }
```
Это почти невидимый белый (не голубой). Должно быть что-то на основе синего primary: `rgba(24,144,255,0.06)`.

---

## 12. Две конкурирующие CSS-переменные — `erp-base.css` vs `_variables.css`

В проекте **два файла с CSS-переменными**:

**`erp-base.css` (полный, импортируется в `main.js`):**
```css
--primary, --primary-dark, --danger, --warning, --success,
--sidebar-w, --header-h, --glass-light, --glass-border, --glass-glow,
--text, --text-dim, --text-nav
```

**`_variables.css` (неполный, импортируется через `admin-core.scss`):**
```css
--primary, --primary-dark, --danger,
--sidebar-w, --header-h, --glass-light, --glass-border, --glass-glow,
--text, --text-dim, --text-nav
```

`_variables.css` **не содержит** `--success` и `--warning`, которые есть в `erp-base.css`. При этом оба файла объявляют `:root { --primary: #1890ff }` — дублирование. Если значения когда-либо разойдутся, возникнет трудноотлаживаемая проблема.

**Исправление**: удалить `_variables.css`, все переменные хранить только в `erp-base.css`. Или добавить в `_variables.css` недостающие `--success` и `--warning`.

---

## 13. Font-weight page-title: 700 вместо 600

Дизайн типографики (`13_typography_system.md`): H1 = Inter **Semi-bold (600)**.

В коде (`base-layout.css`):
```css
.page-title { font-weight: 700; }
```
Используется Bold (700), а не Semi-bold (600).

---

## 14. Зелёные кнопки (Success) не реализованы

По дизайн-системе (`15_button_system`) зелёный — отдельный семантический тип для **завершения этапов**: Pay Invoice, Complete Cutting, Ship Order, Approve, Confirm.

В коде нет класса `.btn-success` (зелёного). Все подтверждающие действия сейчас либо синие (`btn-primary`), либо отсутствуют как страницы. Пока операционных страниц (заказы, отгрузка, оплата) нет — это не критично, но класс должен быть готов заранее.

**Исправление**: добавить в `_buttons.css` `.btn-success { background: var(--success); color: #fff; }` с hover-состоянием.

> Примечание: `btn-save.dirty` = синий — это **правильно** по дизайн-системе. Save относится к Corporate Blue (saving, creating, adding). Зелёный — только для завершения бизнес-этапа (Pay, Ship, Complete).
