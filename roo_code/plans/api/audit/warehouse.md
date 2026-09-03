# Аудит контракта — warehouse

Эндпоинтов в коде: **37**. Реализовано бэкендом: **0**.

Источник истины по эндпоинту: бэкенд → мок+клиент → замысел. Пустая графа = задача не закрыта.
Утверждение без `файл:строка` не записывается. Код не правится: место, где он выглядит
неверным, — находка в `roo_code/plans/bugs/contract-sync-warehouse-bugs.md`.

## Эндпоинты

### DELETE /api/warehouse/batches/:id
- Вызывающий: `src/services/warehouseService.ts:115`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1607`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/warehouse/batches/:id/audit/:id
- Вызывающий: `src/services/warehouseService.ts:343`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1441`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/warehouse/deficit/:id
- Вызывающий: `src/services/warehouseService.ts:257`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1625`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/warehouse/deficit/:id/audit/:id
- Вызывающий: `src/services/warehouseService.ts:373`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1467`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/warehouse/movements/:id/audit/:id
- Вызывающий: `src/services/warehouseService.ts:363`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1456`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/warehouse/offcuts/:id
- Вызывающий: `src/services/warehouseService.ts:165`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1613`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/warehouse/offcuts/:id/audit/:id
- Вызывающий: `src/services/warehouseService.ts:353`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1447`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### DELETE /api/warehouse/stock/:id/audit/:id
- Вызывающий: `src/services/warehouseService.ts:333`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1435`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/batches
- Вызывающий: `src/services/warehouseService.ts:99`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:658`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/batches/:id
- Вызывающий: `src/services/warehouseService.ts:103`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:679`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/batches/:id/active-sales
- Вызывающий: `src/services/warehouseService.ts:209`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:698`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/batches/:id/aggregates
- Вызывающий: `src/services/warehouseService.ts:205`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:693`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/batches/:id/audit
- Вызывающий: `src/services/warehouseService.ts:339`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:688`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/deficit
- Вызывающий: `src/services/warehouseService.ts:238`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:779`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/deficit/:id
- Вызывающий: `src/services/warehouseService.ts:242`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:798`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/deficit/:id/audit
- Вызывающий: `src/services/warehouseService.ts:369`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:807`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/export/:id
- Вызывающий: `src/services/warehouseService.ts:323`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:813`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/movements
- Вызывающий: `src/services/warehouseService.ts:191`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:755`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/movements/:id
- Вызывающий: `src/services/warehouseService.ts:199`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:750`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/movements/:id/audit
- Вызывающий: `src/services/warehouseService.ts:359`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:745`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/offcuts
- Вызывающий: `src/services/warehouseService.ts:138`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:703`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/offcuts/:id
- Вызывающий: `src/services/warehouseService.ts:153`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:730`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/offcuts/:id/audit
- Вызывающий: `src/services/warehouseService.ts:349`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:739`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/offcuts/offers
- Вызывающий: `src/services/warehouseService.ts:149`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:726`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/stock
- Вызывающий: `src/services/warehouseService.ts:50`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:617`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/stock/:id
- Вызывающий: `src/services/warehouseService.ts:54`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:644`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/stock/:id/audit
- Вызывающий: `src/services/warehouseService.ts:329`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:653`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### GET /api/warehouse/stock/:id/cost
- Вызывающий: `src/services/warehouseService.ts:75`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:637`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/warehouse/batches/:id
- Вызывающий: `src/services/warehouseService.ts:111`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1301`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/warehouse/deficit/:id
- Вызывающий: `src/services/warehouseService.ts:253`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1311`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/warehouse/offcuts/:id
- Вызывающий: `src/services/warehouseService.ts:161`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1328`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### PATCH /api/warehouse/stock/:id
- Вызывающий: `src/services/warehouseService.ts:61`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1321`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/warehouse/batches
- Вызывающий: `src/services/warehouseService.ts:107`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1105`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/warehouse/cutting
- Вызывающий: `src/services/warehouseService.ts:217`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1117`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/warehouse/deficit
- Вызывающий: `src/services/warehouseService.ts:246`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1121`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/warehouse/movements
- Вызывающий: `src/services/warehouseService.ts:195`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1113`
- Форма запроса:
- Форма ответа:
- Коды ошибок:
- Save-режим:
- Пробел контракта:
- Источник истины:

### POST /api/warehouse/offcuts
- Вызывающий: `src/services/warehouseService.ts:157`
- Бэкенд: **нет**
- Мок: `mocks/index.ts:1109`
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

## Находки про код → contract-sync-warehouse-bugs.md
