# План: Settings — Admin Config (MVP Block 1)

> **Цель:** Создать страницу `/admin/settings` — единый центр администрирования системы.
> **Референс:** `SupplierCardConfigPage.vue` — архитектура с табами/секциями, composable `useCardConfig`, сервис `configService.ts`

---

## 1. Что нужно создать

### 1.1 Новые типы (`types/settings.ts`)

```typescript
// Реквизиты компании
export interface CompanyInfo {
  name: string
  legalAddress: string
  vatCode: string
  bankName: string
  bankAccount: string
  logo?: string  // base64 or URL
}

// Глобальные константы
export interface GlobalConstants {
  vatRate: number          // e.g. 21
  defaultMargin: number    // e.g. 15
  defaultCurrency: string  // 'EUR'
  defaultDiscount: number  // e.g. 0
}

// Валюта
export interface Currency {
  id: string
  code: string        // 'EUR', 'USD', 'GBP'
  name: TranslatedString
  exchangeRate: number // relative to default currency
  isDefault: boolean
  updatedAt?: string
}

// Единица измерения
export interface Uom {
  id: string
  code: string         // 'kg', 'pcs', 'm', 'm3'
  name: TranslatedString
  category: UomCategory // 'weight' | 'length' | 'area' | 'volume' | 'quantity'
}

// Матрица пересчёта UOM
export interface UomConversion {
  id: string
  fromUomId: string
  toUomId: string
  factor: number       // e.g. 1 pallet = 40 boxes → factor: 40
}

// Статус заказа
export interface OrderStatus {
  id: string
  name: TranslatedString
  color: string        // HEX
  order: number
  system?: boolean     // system statuses can't be deleted
}

// Сектор склада
export interface WarehouseSector {
  id: string
  code: string         // 'A1', 'B5'
  name: TranslatedString
  zone?: string
}

// Пользователь
export interface SettingUser {
  id: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'warehouse' | 'accounting' | 'viewer'
  active: boolean
  lastLogin?: string
}

// Общий тип для Settings
export interface AppSettings {
  company: CompanyInfo
  constants: GlobalConstants
  currencies: Currency[]
  uoms: Uom[]
  conversions: UomConversion[]
  orderStatuses: OrderStatus[]
  sectors: WarehouseSector[]
  users: SettingUser[]
}
```

### 1.2 Сервис (`services/settingsService.ts`)

```typescript
// GET /api/settings — получить все настройки
export async function getSettings(): Promise<AppSettings>

// PUT /api/settings — атомарно сохранить все настройки
export async function saveSettings(settings: AppSettings): Promise<void>

// Отдельные эндпоинты для каждого раздела (опционально):
// GET/PUT /api/settings/company
// GET/PUT /api/settings/constants
// GET/PUT /api/settings/currencies
// GET/PUT /api/settings/uoms
// GET/PUT /api/settings/statuses
// GET/PUT /api/settings/sectors
// GET/PUT /api/settings/users
```

### 1.3 Моки (`services/mocks/settings.ts`)

Создать `MOCK_SETTINGS` с полным набором данных по умолчанию:
- Company: Flexiron UAB, адрес в Вильнюсе, VAT etc.
- Constants: PVM 21%, margin 15%, EUR
- Currencies: EUR (default), USD (rate 1.08), GBP (rate 0.86)
- UOM: kg, pcs, m, m2, m3
- Conversions: 1 pallet = 40 boxes (если применимо)
- Statuses: 8 статусов из текущего заказа (new → confirmed → picking → packing → shipped → delivered → paid → cancelled) + цвета
- Sectors: A1-A5, B1-B5, C1-C3
- Users: 4-5 тестовых пользователя по ролям

### 1.4 Композабл (`composables/useSettings.ts`)

По аналогии с `useCardConfig.ts`:
- `settings` — реактивный `AppSettings`
- `loading`, `saving`, `error`
- `load()` — fetch всех настроек
- `save()` — атомарное сохранение
- Для каждой секции — отдельные helper-функции (addCurrency, removeCurrency, addUom, ...)

### 1.5 Страница (`views/admin/settings/SettingsPage.vue`)

Таб-ориентированная страница (как `WarehousePage.vue`):

```
┌─────────────────────────────────────────────┐
│  Настройки системы                          │
│                                             │
│  [Компания] [Финансы] [Ед.изм] [Статусы]    │
│  [Склад] [Пользователи] [Шаблоны]           │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Содержимое выбранного таба         │    │
│  │                                     │    │
│  │  [Сохранить] [Отмена]               │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

#### Таб 1: Компания (Company Info)
- Поля: название, юр.адрес, VAT код, банк, счёт
- Загрузка логотипа (через `DropZone` или file input)
- Все поля на одной форме

#### Таб 2: Финансы (Global Constants + Currencies)
- **Global constants**: PVM ставка (InputGroup), маржа по умолчанию (InputGroup), валюта по умолчанию (select)
- **Валюты**: таблица (код, курс, флаг дефолтной) + кнопка "Добавить валюту" → модалка с кодом и курсом

#### Таб 3: Единицы измерения (UOM)
- **Справочник UOM**: таблица (код, название, категория) + кнопка "Добавить"
- **Матрица пересчёта**: таблица (из → в → коэффициент) + кнопка "Добавить правило"

#### Таб 4: Статусы заказов (Order Statuses)
- Список статусов с color picker
- Drag-and-drop для изменения порядка
- Кнопка "Добавить статус" → модалка: название + цвет
- Системные статусы нельзя удалить (как в `ConfigSectionCard`)

#### Таб 5: Карта склада (Warehouse Sectors)
- Таблица секторов (код, название, зона)
- Кнопка "Добавить сектор"
- Возможность удаления (если нет привязанных партий)

#### Таб 6: Пользователи (Users)
- Таблица: email, имя, роль, активность
- Кнопка "Добавить пользователя" → модалка: email, имя, пароль, роль
- Смена роли через select
- Возможность деактивировать

#### Таб 7: Шаблоны документов (Document Templates)
- Заглушка на первый релиз (текст "Будет реализовано в следующей версии")
- Архитектурный задел: список шаблонов + загрузка файла

### 1.6 i18n (`i18n/admin/settings.ts`)

Новый файл переводов для Settings, по аналогии с `cardConfig.ts`:
```typescript
export const adminSettings = {
  ru: {
    settings: {
      title: 'Настройки системы',
      tabs: {
        company: 'Компания',
        finance: 'Финансы',
        uom: 'Единицы измерения',
        statuses: 'Статусы заказов',
        warehouse: 'Карта склада',
        users: 'Пользователи',
        documents: 'Шаблоны документов',
      },
      // ... поля для каждой секции
    },
    // ...
  },
  en: { /* ... */ },
  lt: { /* ... */ },
}
```

Добавить импорт в `i18n/admin/index.ts`.

### 1.7 Стили (`styles/admin/settings.scss`)

По аналогии с `supplier_card_config.css` — базовые стили для табов и форм настроек.

### 1.8 Роутер

Добавить в `router/index.ts`:
```typescript
{
  path: 'settings',
  name: 'admin-settings',
  component: () => import('@/views/admin/settings/SettingsPage.vue'),
  meta: { layout: 'admin', featureFlag: 'adminSettings' as FeatureFlagKey },
}
```

### 1.9 Feature flag

Добавить в `featureFlags.ts`:
```typescript
adminSettings: true,
```

### 1.10 Sidebar

В `AdminSidebar.vue` — заменить `<a href="#"` на `<router-link :to="{ name: 'admin-settings' }"` для кнопки Settings.

---

## 2. Архитектура

```
frontend_vue/src/
├── types/
│   └── settings.ts              ← новые типы
├── services/
│   ├── settingsService.ts       ← новый сервис
│   └── mocks/
│       └── settings.ts          ← новые моки
├── composables/
│   └── useSettings.ts           ← новый композабл
├── views/
│   └── admin/
│       └── settings/
│           └── SettingsPage.vue ← новая страница
├── components/
│   └── admin/
│       └── settings/            ← (опционально) под-компоненты для табов
├── i18n/
│   └── admin/
│       ├── settings.ts          ← новые переводы
│       └── index.ts             ← добавить импорт
├── styles/
│   └── admin/
│       └── settings.scss        ← новые стили
├── config/
│   └── featureFlags.ts          ← добавить флаг adminSettings
└── router/
    └── index.ts                 ← добавить роут
```

---

## 3. Порядок реализации

| Шаг | Что делать | Файлы |
|-----|-----------|-------|
| 1 | Типы + моки | `types/settings.ts`, `services/mocks/settings.ts` |
| 2 | Сервис | `services/settingsService.ts` (+ регистрация моков в `mocks/index.ts`) |
| 3 | Композабл | `composables/useSettings.ts` |
| 4 | i18n | `i18n/admin/settings.ts` (+ index.ts) |
| 5 | Feature flag + роут | `featureFlags.ts`, `router/index.ts` |
| 6 | Страница Settings | `views/admin/settings/SettingsPage.vue` |
| 7 | Стили | `styles/admin/settings.scss` (+ импорт в главный файл) |
| 8 | Sidebar | `AdminSidebar.vue` — заменить заглушку на router-link |

---

## 4. Что переиспользуем из существующего

| Компонент | Как используем |
|-----------|---------------|
| `GlassPanel.vue` | Оборачиваем каждый таб |
| `InputGroup.vue` | Формы реквизитов, констант |
| `CustomSelect.vue` | Выбор валюты, роли, категории UOM |
| `AppModal.vue` | Модалки: добавить валюту, UOM, статус, пользователя |
| `DropZone.vue` | Загрузка логотипа |
| `SvgIcon.vue` | Иконки |
| `AppTag.vue` | Цветовые метки статусов |
| `ConfigSectionCard.vue` | Как референс для секций (не для прямого использования) |
| `ViewTabs.vue` | Переключение табов (как в WarehousePage) |
| `ToastContainer.vue` | Уведомления о сохранении |
| `configService.ts` | Паттерн для settingsService |

---

## 5. Примечания

- **Атомарное сохранение:** весь блок настроек сохраняется одной кнопкой, как в `useCardConfig.saveConfig()`
- **Валидация:** обязательные поля (название компании, VAT, PVM ставка) подсвечиваются при пустом значении
- **Моки:** на старте не нужно поднимать бэкенд — все данные живут в `MOCK_SETTINGS`
- **Связь с существующим:** настройки статусов из Settings должны влиять на список статусов в `OrderCardPage` (но это задача интеграции, не входит в этот блок)
