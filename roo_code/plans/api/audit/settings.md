# Аудит контракта — settings

Эндпоинтов в коде: **31**. Реализовано бэкендом: **24** (DELETE /api/settings/conversions/:id, DELETE /api/settings/currencies/:id, DELETE /api/settings/order-statuses/:id, DELETE /api/settings/uoms/:id, GET /api/settings/company, GET /api/settings/constants, GET /api/settings/conversions, GET /api/settings/currencies, GET /api/settings/order-statuses, GET /api/settings/profile, GET /api/settings/uoms, PATCH /api/settings/company, PATCH /api/settings/constants, PATCH /api/settings/conversions/:id, PATCH /api/settings/currencies/:id, PATCH /api/settings/order-statuses/:id, PATCH /api/settings/profile, PATCH /api/settings/uoms/:id, POST /api/settings/change-password, POST /api/settings/conversions, POST /api/settings/currencies, POST /api/settings/order-statuses, POST /api/settings/uoms, PUT /api/settings/order-statuses/reorder).

Источник истины по эндпоинту: бэкенд → мок+клиент → замысел. Пустая графа = задача не закрыта.
Утверждение без `файл:строка` не записывается. Код не правится: место, где он выглядит
неверным, — находка в `roo_code/plans/bugs/contract-sync-settings-bugs.md`.

## Эндпоинты

### DELETE /api/settings/conversions/:id
- Вызывающий: `src/services/settingsService.ts:101`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:413`
- Мок: `mocks/index.ts:1642`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/settings/currencies/:id
- Вызывающий: `src/services/settingsService.ts:65`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:266`
- Мок: `mocks/index.ts:1632`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/settings/order-statuses/:id
- Вызывающий: `src/services/settingsService.ts:136`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:482`
- Мок: `mocks/index.ts:1647`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/settings/uoms/:id
- Вызывающий: `src/services/settingsService.ts:83`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:334`
- Мок: `mocks/index.ts:1637`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/settings/warehouse-map
- Вызывающий: `src/services/settingsService.ts:156`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1652`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/settings/company
- Вызывающий: `src/services/settingsService.ts:27`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:146`
- Мок: `mocks/index.ts:381`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/settings/constants
- Вызывающий: `src/services/settingsService.ts:43`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:179`
- Мок: `mocks/index.ts:382`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/settings/conversions
- Вызывающий: `src/services/settingsService.ts:89`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:359`
- Мок: `mocks/index.ts:386`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/settings/currencies
- Вызывающий: `src/services/settingsService.ts:53`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:212`
- Мок: `mocks/index.ts:384`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/settings/mail
- Вызывающий: `src/services/settingsService.ts:166`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:389`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/settings/order-permissions
- Вызывающий: `src/services/settingsService.ts:37`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:383`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/settings/order-statuses
- Вызывающий: `src/services/settingsService.ts:107`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:427`
- Мок: `mocks/index.ts:387`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/settings/profile
- Вызывающий: `src/services/settingsService.ts:185`
- Бэкенд: `backend/app/modules/settings/features/profile/action.py:75`
- Мок: `mocks/index.ts:388`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/settings/uoms
- Вызывающий: `src/services/settingsService.ts:71`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:291`
- Мок: `mocks/index.ts:385`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/settings/warehouse-map
- Вызывающий: `src/services/settingsService.ts:146`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:390`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/settings/company
- Вызывающий: `src/services/settingsService.ts:31`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:160`
- Мок: `mocks/index.ts:1339`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/settings/constants
- Вызывающий: `src/services/settingsService.ts:47`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:193`
- Мок: `mocks/index.ts:1343`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/settings/conversions/:id
- Вызывающий: `src/services/settingsService.ts:97`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:399`
- Мок: `mocks/index.ts:1364`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/settings/currencies/:id
- Вызывающий: `src/services/settingsService.ts:61`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:252`
- Мок: `mocks/index.ts:1356`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/settings/mail
- Вызывающий: `src/services/settingsService.ts:170`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1351`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/settings/order-statuses/:id
- Вызывающий: `src/services/settingsService.ts:124`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:468`
- Мок: `mocks/index.ts:1378`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/settings/profile
- Вызывающий: `src/services/settingsService.ts:189`
- Бэкенд: `backend/app/modules/settings/features/profile/action.py:98`
- Мок: `mocks/index.ts:1347`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/settings/uoms/:id
- Вызывающий: `src/services/settingsService.ts:79`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:320`
- Мок: `mocks/index.ts:1372`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/settings/change-password
- Вызывающий: `src/services/settingsService.ts:197`
- Бэкенд: `backend/app/modules/settings/features/profile/action.py:127`
- Мок: `mocks/index.ts:1134`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/settings/conversions
- Вызывающий: `src/services/settingsService.ts:93`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:373`
- Мок: `mocks/index.ts:1130`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/settings/currencies
- Вызывающий: `src/services/settingsService.ts:57`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:226`
- Мок: `mocks/index.ts:1126`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/settings/mail/test
- Вызывающий: `src/services/settingsService.ts:179`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1135`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/settings/order-statuses
- Вызывающий: `src/services/settingsService.ts:115`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:441`
- Мок: `mocks/index.ts:1132`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/settings/uoms
- Вызывающий: `src/services/settingsService.ts:75`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:305`
- Мок: `mocks/index.ts:1128`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PUT /api/settings/order-statuses/reorder
- Вызывающий: `src/services/settingsService.ts:128`
- Бэкенд: `backend/app/modules/settings/features/crud/action.py:456`
- Мок: `mocks/index.ts:1147`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PUT /api/settings/warehouse-map
- Вызывающий: `src/services/settingsService.ts:152`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1155`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

## Обязанности сервера

Заполняется как НАБЛЮДЕНИЕ: что знает мок, что знает бэкенд, где во фронте стоит константа
на месте серверного значения. Ответ «нигде» — это не решение, а строка в
`00-решения-владельца.md` с указанием домена.

- Значения по умолчанию и их владелец:
- События и уведомления:
- Запись в аудит-лог:
- Кастомные поля:
- Настройки, которых мок не отслеживает:
- Мультиарендность:
- Права — в какой функции проверяются:
- Транзакционность и идемпотентность:
- Производные значения (считать, не хранить):

## Правила домена, которых нет в контракте

Самое ценное содержимое аудита: эндпоинты машина перечислит и без человека, а правило,
живущее только в моке или доменном слое, — нет.

## Находки про код → contract-sync-settings-bugs.md
