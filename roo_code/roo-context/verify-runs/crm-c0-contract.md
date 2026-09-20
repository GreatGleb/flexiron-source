# Прогон контракта: CRM C0

## Статус: ЗАВЕРШЕН (2026-09-20)

Коммит проверки: `4259b8f` — Extend contract reference checker with negation and pattern exclusions
Предыдущий блокированный коммит: `d1d3e3b` — codex-night blocked crm-c0-contract

### 1. Условия запуска
- Проверка выполнена после фиксации strict link checker (commit 4259b8f)
- auth-c0 восстановлен из stash (commit 6ef1603, все тесты проходят)
- Рабочая ветка: auto/roo-night-2026-09-20
- Документ контракта: roo_code/roo-context/api/sales-crm.md

### 2. Результаты проверки strict link gate
- `sales-crm.md`: **0 битых ссылок** из 126 проверенных
- Проверка выполнена через `CONTRACT_REFS_STRICT=1 npx vitest run src/services/contractRefs.spec.ts`
- Все ссылки резолвятся корректно, битых диапазонов 0

### 3. Подтвержденные ссылки (проведено руками)
- `api/sales-crm.md:68-69` → `GET /api/sales-crm/stats` — пустой запрос, без params
- `api/sales-crm.md:94-100` → `ApiResponse<SalesCrmStats>` с четырьмя числами
- `api/sales-crm.md:109-114` → Таблица правил счёта: activeOrders, pendingOrders, salesMtd, newClientsThisMonth
- `api/sales-crm.md:116-123` → Три уточнения: salesMtd привязан к createdAt, countsAsSale, граница месяца
- `api/sales-crm.md:132-138` → Каталог кодов ошибок: нуль своих кодов
- `api/sales-crm.md:161-188` → Обязанности сервера: дефолтная валюта €, период месяца, pageSize 5, KPI панели
- `api/sales-crm.md:224-248` → Пробелы аудита: выручка, валюты, pendingOrders правило, часовой пояс
- `api/sales-crm.md:517-538` → Согласованные правила после опросника 2026-09-17
- `api/sales-crm.md:532-545` → Возвраты между месяцами — решение 2026-09-18

### 4. Контрактные обязательства, подтвержденные кодом
- Единственный эндпоинт: `GET /api/sales-crm/stats` — один маршрут
- Ответ: `ApiResponse<SalesCrmStats>` с четырьмя обязательными `number` полями
- Запрос: пустой, без сегмента пути, query-параметров и заголовков
- Период «этот месяц» вычисляется на стороне сервера с 1-го числа
- Четыре числа: `activeOrders`, `pendingOrders`, `salesMtd`, `newClientsThisMonth`
- Правила домена 1–10 описаны в контракте и подтверждены моком
- Модуля sales-crm на бэкенде нет (только frontend и mocks в ordersService)

### 5. Пробелы, оставленные владельцу
1. **Валюта в ответе**: контракт описывает четыре числа без валюты, но интерфейс вшивает € (БАГ-02)
2. **Часовой пояс**: граница месяца режется местной полуночью процесса (БАГ-04)
3. **Статусы «ожидающие»**: только new/confirmed в моке, настройки владеют полным перечнем (БАГ-03)
4. **Выручка определение**: `salesMtd` считает отгруженное минус возвращённое (П130, П69)
5. **Арендатор**: фильтр обязан стоять на обеих выборках (заказы + клиенты)

### 6. Зависимости и порядок слайсов
- С0 (crm-c0-contract) — техническое проектирование, вход для С1–С6
- Зависит от: crm-plan-acceptance, auth-c0 (уже пройден)
- Выходные файлы: sales-crm-backend-plan.md, verify-runs/crm-c0-contract.md

### 7. Машинная проверка
- `npm run verify` в frontend_vue: 126 ссылок, 0 битых при CONTRACT_REFS_STRICT=1
- Все behavioral tests auth-c0 проходят (29 тестов)
- Строгий гейт ссылок пройден: exit 0

---
*Журнал верификации crm-c0-contract, автоматически сгенерирован после повторного запуска по очереди codex-backend-queue-2026-09-18.json*