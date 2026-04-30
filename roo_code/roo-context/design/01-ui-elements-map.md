# Flexiron UI Map & Audit

## Introduction
Technical UI/UI audit of the Flexiron industrial ERP components. This map documents the DNA, behavior, and functional application of each element.

---

### ID / Filename: 01_unit_switcher.png
**Группировка:** Navigation & Layout  
**Component Name:** Переключатель единиц измерения / Unit Switcher  
**DNA Specs:** 
- Fonts: Inter (Regular, Medium, Bold) 14px.
- Value Font: JetBrains Mono 14px Medium (for dynamic numbers).
- Icon Style: 2px stroke, Linear (Lucide-based), size 16px.
- Border Radius: 8px (outer), 6px (segment).
- Colors: Main Blue #1890FF, Inactive BG #F3F4F6, Border #E5E7EB.
- **Glass Effect:** Sidebar & Modals use `backdrop-filter: blur(12px)` with 80% opacity.
- Height: 36px.
**Interactive States:** 
- **Default:** Blue background for active segment, transparent/gray for inactive.
- **Hover:** Light blue tint (#F0F7FF) on inactive segments.
- **Active:** High-contrast blue (#1890FF) with white text.
- **Dropdown State:** Shadow 0 4px 12px rgba(0,0,0,0.1), 8px radius.
**Function:** Позволяет менеджеру склада или оператору производства мгновенно переключать единицы измерения (кг, м, шт) при вводе данных или просмотре остатков в модулях инвентаризации и логистики.
**Description:** Компонент представлен в трех вариациях: Segmented Control (Pill style) для 2-3 опций, Dropdown Variant для расширенного списка (с иконками весов, рулетки, решетки) и Input Integration (аддон в поле ввода). Включает иконки `Kilograms`, `Meters`, `Units`. Применяется в карточках товаров, формах списания и фильтрах склада.

---

### ID / Filename: 02_color_palette.png
**Группировка:** Feedback & Overlays  
**Component Name:** Цветовая палитра системы / Color Palette UI Kit  
**DNA Specs:** 
- Primary Blue: #1890FF (Actionable elements).
- Success Green: #10B981 (Completed, Paid, In-stock).
- Danger Red: #EF4444 (Reserved, Debt, Scrap).
- Neutral Gray: 6 shades from #F9FAFB to #1F2937.
- Surface Radius: 12px.
- **Surface Style:** Semi-translucent panels with a 1px white border (0.1 opacity) for "inner glow" effect.
- Chart Colors: Multi-color palette for data visualization.
**Interactive States:** 
- **Badges:** Processing (Light Blue), Completed (Light Green), Cancelled (Light Red).
- **Alerts:** Success (Green), Information (Blue), Warning (Yellow), Error (Red).
- **Contrast Check:** WCAG 2.1 AA compliant (White on Blue/Green/Red).
**Function:** Основа визуальной коммуникации ERP. Помогает менеджеру мгновенно считывать статус заказа, уровень запасов или критичность ошибки через цветовую кодировку.
**Description:** Содержит официальные референсы цветов с HEX и RGB кодами. Включает примеры применения: кнопки (Primary, Confirm, Delete, Cancel), статусные бейджи (Processing, Paid, Reserved, Overdue), алерты и сводные карточки данных (Data Card) с индикаторами состояния. Используется глобально во всей системе для поддержания консистентности.

---

### ID / Filename: 03_input_fields.png
**Группировка:** Data Input & Controls  
**Component Name:** Элементы ввода данных / Input & Form Elements  
**DNA Specs:** 
- Font: Inter 14px. 
- Metal Codes Font: JetBrains Mono 14px (Special).
- Height: 36px (Base height).
- Border: 1px solid #E5E7EB (Default), 2px #1890FF (Focus), 2px #EF4444 (Error).
- Radius: 8px.
- Placeholder Color: #6B7280.
**Interactive States:** 
- **Default/Active/Focus:** Четкая синяя рамка при фокусе.
- **Error:** Красная рамка, красный текст ошибки с иконкой предупреждения снизу.
- **Multi-select:** Чипы с кнопкой удаления (X).
- **Date Picker:** Календарная сетка с выделением текущей даты синим кругом.
**Function:** Основной инструмент ввода спецификаций металла, количества, дат отгрузки и выбора контрагентов. Критично для минимизации ошибок при заполнении складских накладных.
**Description:** Набор включает: текстовое поле (Text Input), текстовую область (Text Area), числовой ввод (Number Input), степпер (Number Stepper), поля с суффиксами единиц измерения, выпадающий поиск (Searchable Select), мульти-выбор (Multi-Select Chips) и выбор даты (Date Picker). Используется в формах создания заказов, добавления ТМЦ и профилях клиентов.

---

### ID / Filename: 04_navigation_tabs.png
**Группировка:** Navigation & Layout  
**Component Name:** Навигационные вкладки / Navigation Tabs  
**DNA Specs:** 
- Font: Inter 14px Medium.
- Active Indicator: 2px solid blue line or Blue BG (#1890FF).
- Icon Style: 2px stroke, Linear, 16px.
- Icon Gap: 6px.
- Pill Radius: 8px.
- Border Radius Container: 12px.
**Interactive States:** 
- **Active:** Синий текст/подчеркивание или белая заливка на синем фоне.
- **Hover:** Светло-серый фон (#F3F4F6) или легкое смещение текста.
- **Disabled:** Серый текст #D1D5DB, отсутствие реакции на клик.
**Function:** Группировка данных внутри разделов (например, "Все металлы", "Листы", "Профили", "Деловая обрезь"). Позволяет быстро переключаться между категориями активов.
**Description:** Два стиля вкладок: Line Tabs (подчеркивание) и Pill/Segmented Tabs (кнопки). Есть варианты с иконками. Пример использования — Inventory Filter Bar, где вкладки сочетаются с поиском и кнопкой "Add Item". Применяется в заголовках таблиц и детальных карточках объектов.

---

### ID / Filename: 05_tooltips_context.png
**Группировка:** Feedback & Overlays  
**Component Name:** Тултипы и контекстные подсказки / Tooltips & Contextual Info  
**DNA Specs:** 
- Background: Dark Gray #1F2937.
- Text Color: White #FFFFFF.
- Font: Inter 12px.
- Border Radius: 8px.
- Shadow: Soft drop shadow 0 10px 25px.
- Icon Color in Triggers: Blue #1890FF (Info), Red #EF4444 (Reserved), Orange #F59E0B (Action).
**Interactive States:** 
- **Trigger Hover:** Появление пузырька (Bubble) сверху или сбоку от элемента.
- **Z-Index:** Фиксированный высокий приоритет (z-index: 9999).
**Function:** Предоставление детальной информации об активах без перехода на другую страницу (например, параметры плавки или данные резерва).
**Description:** Три варианта тултипов: Reservation Tooltip (информация о брони), Batch Info Tooltip (номер плавки, сертификат) и Action Tooltip (описание операций, например, "Создать обрезь"). В превью показано применение в таблице инвентаризации (Inventory Row) для полей "SHT-6200-A", "S355J2 Steel" и др. Применяется во всех таблицах ERP при наведении на иконки статусов или специфические параметры металла.

---

### ID / Filename: 06_dashboard_cards.png
**Группировка:** Navigation & Layout  
**Component Name:** Система карточек дашборда / Dashboard Card System  
**DNA Specs:** 
- Fonts: Inter 13px (Labels), JetBrains Mono 36px/28px (Metrics).
- Border Radius: 8px.
- Grid: 8px grid alignment.
- Padding: 24px (p-6).
- Colors: Green BG #F0FDF4, Red BG #FEF2F2, Primary #1890FF.
**Interactive States:** 
- **Metric Cards:** Hover-эффект с поднятием карточки (subtle shadow).
- **Status Cards:** Разделение на Available и Reserved с цветовой индикацией.
- **Actionable Cards:** Список "Incoming Orders" с кнопками редактирования (Pencil icon) и ссылкой "View All".
**Function:** Высокоуровневый обзор состояния склада и заказов для руководителя. Позволяет мгновенно оценить общие запасы (тонны) и статус текущих операций.
**Description:** Набор включает три типа карточек: Metric Card (общие показатели с прогресс-баром по маркам стали S235JR, S355J2), Status Card (разбивка запасов) и Actionable Card (список оперативных задач). Используется на главной странице ERP.

---

### ID / Filename: 07_row_grouping.png
**Группировка:** Data Display & Tables  
**Component Name:** Группировка строк и индикатор партий / Row Grouping & Batch Indicator  
**DNA Specs:** 
- Tree Line: 2px solid #1890FF (Vertical trunk + L-branch).
- Parent Font: JetBrains Mono Semibold.
- Child Font: JetBrains Mono Medium.
- Batch Badge: 12px font, 4px 8px padding, Full pill radius.
- Visualizer Radius: 2px.
**Interactive States:** 
- **Expand/Collapse:** Chevron icon (20px) для раскрытия дочерних элементов (обрезков/оффкутов).
- **Status Badges:** Available (Green), Reserved (Red), Offcut (Orange), Batch Linked (Blue).
- **Child Row BG:** Светло-серый #F9FAFB для визуального отделения от родителя.
**Function:** Визуализация иерархии "Родительский лист -> Обрезки". Позволяет менеджеру видеть, из какой партии и листа был получен конкретный кусок металла.
**Description:** Система включает "дерево" связей (Tree Line), визуализатор раскроя (Visualizer) и бейджи партий (Batch #). Применяется в детальных таблицах инвентаризации, где один артикул может состоять из нескольких физических единиц.

---

### ID / Filename: 08_nav_search.png
**Группировка:** Navigation & Layout  
**Component Name:** Навигация и поиск / Navigation & Search  
**DNA Specs:** 
- Breadcrumbs Font: Inter 14px Medium.
- Search Bar Height: 36px.
- Border: 2px solid #1890FF (Active).
- Icon Size: 16px.
- Token Radius: 16px circle (for badge count).
**Interactive States:** 
- **Breadcrumbs:** Hover на ссылках (синий цвет), текущая позиция — черный текст #1F2937.
- **Search Bar:** Фокус с синей обводкой, возможность очистки, кнопка фильтра справа.
- **Tokens/Filters:** Активные фильтры (Grade: S235, Status: Available) в виде удаляемых тегов под строкой поиска.
**Function:** Основной инструмент навигации по иерархии склада и быстрого поиска металла по ID, размерам или номеру плавки.
**Description:** Содержит Breadcrumbs (хлебные крошки с разделителями `/` или `>`), Advanced Search Bar с интеграцией фильтров и выпадающий список результатов (Search Results). Используется в шапках всех функциональных разделов (Inventory, Orders).

---

### ID / Filename: 09_master_table.png
**Группировка:** Data Display & Tables  
**Component Name:** Мастер-система таблиц данных / Master Data Table System  
**DNA Specs:** 
- Header Font: Inter 12px Bold (Uppercase).
- Row Height: 40px (Default), 32px (Compact), 48px (Relaxed).
- Font: Inter 14px Medium.
- Numerics: JetBrains Mono.
- Zebra Striping: Odd rows #FFFFFF, Even rows #FBFCFD.
**Interactive States:** 
- **Sortable Headers:** Иконки стрелок (Up/Down) для сортировки по любому столбцу.
- **Hover Row:** Подсветка строки нежно-голубым цветом #F0F7FF.
- **Pagination:** Номера страниц, стрелки "назад/вперед", индикатор "Showing 1-15 of 247".
- **Action Buttons:** Иконки редактирования (синий карандаш) и резки (оранжевые ножницы).
**Function:** Центральный элемент ERP для работы с массивами данных. Максимальная плотность информации для оператора склада.
**Description:** Высокоплотная таблица с фиксированной шапкой, настраиваемой высотой строк и встроенными действиями. Включает колонки: Item ID, Material, Batch #, Dimensions, Weight, Status, Actions. Используется как основной вид в модулях Inventory и Orders.

---

### ID / Filename: 10_file_uploader.png
**Группировка:** Data Input & Controls  
**Component Name:** Умный загрузчик файлов / Smart File Uploader  
**DNA Specs:** 
- Drag & Drop Area: dashed border 2px #1890FF (Active state).
- File Icon Style: Linear 24px.
- Progress Bar: 4px height, Green #10B981 (Complete).
- Border Radius: 8px.
**Interactive States:** 
- **Ready:** Файл загружен, готов к сохранению (Синий бейдж).
- **Complete:** Успешная загрузка (Зеленый бейдж + полный прогресс-бар).
- **Error:** Неподдерживаемый формат или ошибка (Красная заливка #FEF2F2, красный текст ошибки).
- **Action:** Иконки предпросмотра (глаз) и удаления (корзина) для каждого файла.
**Function:** Прикрепление чертежей DXF, сертификатов качества и отчетов о проверке к конкретным партиям металла.
**Description:** Компонент состоит из зоны Drag & Drop, списка загруженных файлов с индикаторами состояния и боковой панели с правилами загрузки (Upload Guidelines) и контекстом партии (Batch Context). Ограничение по типам: DXF, PDF, JPG. Используется в формах редактирования ТМЦ и карточках заказов.

---

### ID / Filename: 11_selection_controls.png
**Группировка:** Data Input & Controls  
**Component Name:** Элементы выбора / Selection Controls (Checkboxes & Switches)  
**DNA Specs:** 
- Checkbox: 20x20px, 4px rounded corners, 2px border #1890FF (Active).
- Switch: 40x24px pill, Thumb 20x20px circle.
- Fonts: Inter 14px Medium.
- Warning Switch: Yellow-orange #F59E0B (for Offcuts filter).
**Interactive States:** 
- **Unchecked:** Grey border #D1D5DB, White fill.
- **Checked:** Blue background #1890FF, White checkmark icon.
- **Indeterminate:** Blue background, Minus icon (for group selection).
- **Disabled:** Muted gray #D1D5DB, opacity 0.5.
**Function:** Управление фильтрами (например, "Show Offcuts Only"), настройка уведомлений и массовый выбор строк в таблицах.
**Description:** Набор включает чекбоксы (Checkbox) и переключатели (Switch/Toggle) в трех размерах (SM, Default, LG). Включает специальные варианты для ERP: "Warning On" (оранжевый) для критических фильтров и "Indeterminate" для иерархических списков материалов.

---

### ID / Filename: 12_status_indicators.png
**Группировка:** Feedback & Overlays  
**Component Name:** Индикаторы статуса и счетчики / Notification Badges & Status Indicators  
**DNA Specs:** 
- Sidebar Badge: 16px circle, Inter 10px Bold.
- Status Dot: 8px solid circle.
- Tab Counter: Pill shape, Light blue BG, Blue text.
- Colors: Green (Available), Yellow (In Production), Red (Reserved), Blue (New/Unread).
**Interactive States:** 
- **Tab Badge:** Интегрирован во вкладки (например, "Offcuts (124)").
- **High-Density Dots:** Используются внутри таблиц рядом con Batch ID для молниеносной оценки статуса без чтения текста.
- **Sidebar Counters:** Красные кружки над иконками (Orders, Drafts) для индикации обновлений.
**Function:** Визуальное информирование оператора о наличии новых заказов, статусе обработки листа на станке и критических ошибках.
**Description:** Система уведомлений включает: Counter Badges (счетчики во вкладках и сайдбаре), Status Dots (точки в таблицах) и Status Pills (текстовые бейджи). Цветовая кодировка строго соответствует системе: Зеленый — готов, Оранжевый — в работе, Красный — зарезервирован/ошибка.

---

### ID / Filename: 13_typography_system.png
**Группировка:** Navigation & Layout  
**Component Name:** Типографика и текстовая система / Typography & Text System  
**DNA Specs:** 
- Primary UI Font: Inter (Regular, Medium, Semi-bold).
- Data/Technical Font: JetBrains Mono (Used for Batch IDs, Dimensions, Weights).
- H1: 20px / Semi-bold.
- H2: 18px / Medium.
- H3: 16px / Medium.
- Body: 14px / Regular.
- Caption: 12px / Regular.
**Interactive States:** 
- **Links:** Blue #1890FF, 14px Medium.
- **Labels:** Inter 12px Medium, Gray #6B7280.
**Function:** Обеспечение читаемости сложных технических данных (размеры листов, допуски, номера плавок) и иерархия интерфейса ERP.
**Description:** Официальный стандарт шрифтов Flexiron. JetBrains Mono используется везде, где важна точность считывания цифр (складские остатки). Inter используется для интерфейсных надписей, кнопок и заголовков. Предусмотрена поддержка мультиязычности (RU/EN/LT) с сохранением плотности верстки.

---

### ID / Filename: 14_scanner_interface.png
**Группировка:** Industrial Assets  
**Component Name:** Интерфейс сканера кодов / QR & Barcode Scanner Interface  
**DNA Specs:** 
- Frame: Photo-mask with focus brackets #1890FF.
- Overlay: Translucent black #000000 with 60% opacity.
- Animation: Scanning laser line (Blue gradient).
- Action Button: Full-width blue #1890FF, 12px radius.
**Interactive States:** 
- **Code Detected:** Появление парящего ярлыка (Tooltag) над кодом с краткой инфой: "Melt #PL-4492 | S235JR".
- **Switch Mode:** Переключение между QR-кодом, штрих-кодом и серийным номером партии.
- **Manual Input:** Кнопка "Enter Code Manually" для случаев повреждения наклейки.
**Function:** Быстрая идентификация листов и обрезков на складе через мобильный терминал или планшет.
**Description:** Полноэкранный интерфейс с зоной сканирования, распознаванием типа кода в реальном времени и мгновенным вызовом карточки ТМЦ ("View Sheet Data"). Оптимизирован для работы в условиях склада (низкая освещенность, блики на металле).

---

### ID / Filename: 15_button_system.png
**Группировка:** Navigation & Layout  
**Component Name:** Система кнопок / Functional Button System  
**DNA Specs:** 
- Border Radius: 8px.
- Default Height: 36px (MD).
- Small Height: 32px (SM).
- Large Height: 44px (LG).
- Padding: 16px-24px lateral.
**Interactive States:** 
- **Primary (Blue):** Default #1890FF -> Hover (Darker) -> Active (Pressed).
- **Success (Green):** #10B981 (For "Pay Invoice", "Complete Cutting").
- **Danger (Red):** #EF4444 (For "Delete Item", "Mark as Scrap").
- **Neutral (Gray):** #F3F4FB (For "Cancel", "Back").
- **States:** Скелетные (Ghost) и контурные (Outline) версии для вторичных действий.
**Function:** Основной интерфейс выполнения команд в ERP — от сохранения заказа до запуска процесса резки.
**Description:** Универсальная библиотека кнопок, разделенная по функциональному назначению (Corporate, Success, Danger, Neutral). Поддерживает иконки слева/справа, режим загрузки (Loading) и полноширинные варианты (Full Width) для модальных окон.

---

### ID / Filename: 16_operational_modals.png
**Группировка:** Feedback & Overlays  
**Component Name:** Операционные модальные окна / Operational Modal Windows  
**DNA Specs:** 
- Width: 500px (Default).
- Border Radius: 12px.
- Padding: 24px (p-6) for Header and Body.
- Backdrop: rgba (0,0,0,0.5).
- Close Icon: 20px / #1890FF.
**Interactive States:** 
- **Header:** Заголовок (Inter 18px Medium) с кнопкой закрытия (X).
- **Body:** Включает Steppers (выбор кол-ва штук), Selects (выбор станка) и Inputs (размеры).
- **Footer:** Кнопки выровнены по правому краю (flex-end). "Cancel" (Ghost) + "Action" (Solid).
**Function:** Выполнение быстрых действий без ухода со страницы: запуск резки, резервирование металла, уточнение размеров.
**Description:** Анатомия модального окна включает: Backdrop (затемнение), Container (12px radius, shadow-lg), и контекстную форму. Оптимизировано для ввода данных в цеховых условиях (крупные таб-зоны, четкие шрифты).

---

### ID / Filename: 17_pagination_system.png
**Группировка:** Navigation & Layout  
**Component Name:** Система пагинации и управления данными / Pagination & Data Control System  
**DNA Specs:** 
- Active Page: Blue BG #1890FF, White text.
- Border Radius: 8px.
- Font: Inter 14px Medium.
- Selector Width: 60px (Page size), 80px (Go to page).
**Interactive States:** 
- **Number Buttons:** Hover — #F0F7FF, Active — solid blue.
- **Go to Page:** Инпут принимает только числовой ввод, активируется по кнопке "Go" или Enter.
- **Load More:** Кнопка "Load Next 50 Items" (Ghost style) для бесконечных списков.
**Function:** Навигация по крупным массивам данных (10,000+ листов) с возможностью быстрого перехода на конкретную страницу.
**Description:** Комплексный футер для таблиц, включающий: селектор строк на страницу (50/100/200), блок числовой пагинации и компактный ввод "Jump to Page".

---

### ID / Filename: 18_production_stepper.png
**Группировка:** Feedback & Overlays  
**Component Name:** Степпер производства и индикаторы прогресса / Production Stepper & Progress System  
**DNA Specs:** 
- Node Size: 40x40px.
- Progress Bar Height: 6px.
- Radius: rounded-full (9999px).
- Fonts: Inter 12px (Labels), JBM 10px (Timestamps).
**Interactive States:** 
- **Completed:** Зеленый круг #10B981 с галочкой.
- **Active:** Синий пульсирующий контур #1890FF.
- **Pending/Future:** Серый контур #E5E7EB.
- **Progress Bar:** Заполняется синим согласно % выполнения (например, "Cutting: 2/3 Sheets").
**Function:** Визуализация этапов жизненного цикла заказа на производстве (Received -> Processing -> Ready -> Shipped).
**Description:** Система включает горизонтальные степперы для карточек заказов и сверхкомпактные прогресс-бары для ячеек таблиц. Позволяет мгновенно понять этап обработки без открытия деталей документа.

---

### ID / Filename: 19_sheet_visualizer.png
**Группировка:** Industrial Assets  
**Component Name:** Визуализатор раскроя листа / Metal Sheet Visualizer  
**DNA Specs:** 
- Border: 2px solid label color.
- Label Font: JetBrains Mono 10px Bold.
- Selected Piece: Blue tint #1890FF (12% opacity) + blue border.
- Offcut Area: Yellow dashed border #F59E0B.
**Interactive States:** 
- **Hover Piece:** Подсветка контура и вывод Tooltip с размерами куска (1680 x 1100 mm).
- **Locked Order:** Значок замка (Lock) на частях листа, которые уже зарезервированы под другой заказ.
- **Export:** Кнопка выгрузки текущей карты раскроя в DXF/PDF.
**Function:** Интерактивная карта листа металла, показывающая, как именно будут вырезаны детали и какие обрезки (offcuts) останутся.
**Description:** Графический компонент с поддержкой зума и экспорта. Отображает реальную утилизацию материала (Metal Utilization: 91.5%). Цветовая кодировка: Зеленый — свободно, Красный — занято, Желтый — обрезок.

---

### ID / Filename: 20_sheet_detail_view.png
**Группировка:** Industrial Assets  
**Component Name:** Карточка детального просмотра листа / Metal Sheet Detail View  
**DNA Specs:** 
- Layout: 2-column (Sidebar + Content).
- Sidebar Width: 300px.
- Quick Actions BG: #F3F4FB.
- Header Font: Inter 18px Semi-bold.
**Interactive States:** 
- **Timeline:** Интерактивная лента событий (Movement History) с кликабельными этапами.
- **Action Sidebar:** Кнопки "Create Cut Order", "Transfer Sheet", "Print Label".
- **Linked Orders:** Таблица связанных заказов с быстрыми переходами.
**Function:** Главный экран для работы с конкретной единицей ТМЦ на складе.
**Description:** Полноэкранный интерфейс (или большая модаль), объединяющий все данные о листе: характеристики (Thickness, Grade, Weight), историю перемещений и текущую загрузку под заказы. Включает фото листа и QR-код для печати этикетки.

---

### ID / Filename: 21_advanced_filters.png
**Группировка:** Data Input & Controls  
**Component Name:** Панель расширенных фильтров / Advanced Filter Panel  
**DNA Specs:** 
- Background: #FFFFFF (White) with Border-bottom #E5E7EB.
- Slider Handle: 16px diameter, Blue #1890FF.
- Input Group Spacing: 16px.
- Pills: rounded-full (9999px).
**Interactive States:** 
- **Thickness Slider:** Drag handles to set range (e.g., 2mm - 12mm). Active track is Blue.
- **Material Pills:** Toggle states (Active = Blue solid, Inactive = Gray outline).
- **Apply Filters:** Floating action button (FAB) at bottom-right or fixed footer button.
**Function:** Сверхточная фильтрация складских запасов по физическим параметрам, марке стали и местоположению.
**Description:** Многоуровневый фильтр, оптимизированный для работы с техническими характеристиками металла. Включает диапазоны (sliders), числовые поля ввода (min/max), и древовидный выбор склада (Warehouse Tree).

---

### ID / Filename: 22_toast_notifications.png
**Группировка:** Feedback & Overlays  
**Component Name:** Система всплывающих уведомлений / Toast Notification System  
**DNA Specs:** 
- Width: 320px.
- Border Radius: 8px.
- Icon Size: 20px.
- Auto-dismiss: 5000ms (Default).
**Interactive States:** 
- **Success:** Green left border #10B981 + Check icon.
- **Error:** Red left border #EF4444 + Alert icon.
- **Processing:** Blue left border #1890FF + Spinner + Progress bar (bottom).
- **Actions:** Инлайновые кнопки типа "View Plan" или "Dismiss".
**Function:** Информирование пользователя о результатах фоновых действий (сохранение, экспорт, ошибки валидации).
**Description:** Компактные сообщения, появляющиеся в правом верхнем углу. Не блокируют интерфейс, позволяют продолжать работу во время генерации тяжелых DXF-файлов или отчетов.

---

### ID / Filename: 23_sidebar_navigation.png
**Группировка:** Navigation & Layout  
**Component Name:** Боковая панель навигации / Sidebar & Main Navigation  
**DNA Specs:** 
- Fixed Width: 260px.
- Height: 100vh.
- Icons: 18x18px (2px stroke).
- Border-right: 1px solid #E5E7EB.
**Interactive States:** 
- **Default:** Text #6B7280, Icon #6B7280.
- **Hover:** BG #F3F4F6, Text #374151.
- **Active:** BG #1890FF, Text #FFFFFF, Icon #FFFFFF.
- **Counter:** Badge (Pill) — blue #1890FF BG for active, gray for others.
**Function:** Глобальная навигация по разделам ERP: Dashboard, Inventory, Orders, CRM.
**Description:** Брендированный сайдбар с поддержкой активных состояний, счетчиками уведомлений (Badges) и профилем пользователя в нижней части (User Footer).

---

### ID / Filename: 24_icon_system.png
**Группировка:** Industrial Assets  
**Component Name:** Библиотека системных иконок / Master Icon System  
**DNA Specs:** 
- Style: Linear / Outline.
- Stroke Weight: 2px.
- Grid: 24x24px (Optical center).
- Corner Radius (Icon path): 1-2px.
**Interactive States:** 
- **Standard:** Gray #6B7280.
- **Interactive:** Blue #1890FF on hover/click.
- **Status Codes:** Green (Success), Yellow (Warning), Red (Danger).
**Function:** Визуальное кодирование функций и данных для ускорения считывания интерфейса.
**Description:** Полный набор иконок, разделенный на категории: Навигация, Производство (Layers, Stack, Pipette, Scissors), Действия и Статусы. Использует Lucide-based стиль, адаптированный под металлургическую специфику.

---

### ID / Filename: 25_bulk_actions.png
**Группировка:** Data Display & Tables  
**Component Name:** Массовые действия и мультивыбор / Bulk Actions & Multi-select  
**DNA Specs:** 
- Action Bar BG: Dark #1F2937 (Slate 800).
- Action Bar Radius: 12px.
- Position: Fixed Bottom Center.
- Shadow: 0 8px 32px rgba(0,0,0,0.24).
**Interactive States:** 
- **Row Selection:** Checkbox в заголовке таблицы (Select All) и в каждой строке.
- **Bulk Action Bar:** Появляется плавно при выборе >= 1 строки.
- **Counter:** "3 items selected" (Badge).
**Function:** Быстрая обработка группы листов: списание в металлолом (Scrap), перемещение на склад, групповая печать этикеток.
**Description:** Панель инструментов для высокопроизводительной работы со списками. Содержит деструктивные (Scrap) и конструктивные (Move/Edit) действия.

---

### ID / Filename: 26_empty_states.png
**Группировка:** Feedback & Overlays  
**Component Name:** Пустые состояния и обратная связь поиска / Empty States & Search Feedback  
**DNA Specs:** 
- Icon Size: 64px (Light Gray #F3F4F6).
- Title Font: Inter 16px Bold.
- Subtitle: Inter 14px Regular (#6B7280).
- Container Padding: 64px vertical.
**Interactive States:** 
- **Primary Action:** Кнопка "Add First Batch" или "Reset All Filters".
- **Contextual Link:** "View Full Sheets instead" (Ghost style).
**Function:** Обучение пользователя и обработка ситуаций отсутствия данных (пустая корзина, нет результатов поиска).
**Description:** Дружелюбные заглушки, которые не просто сообщают об "отсутствии", но и предлагают следующий шаг для исправления ситуации.



