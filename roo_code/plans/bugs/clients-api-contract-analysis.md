# API Contract Analysis — Clients

Сравнение спецификации из `toDo/admin-api-contract.md` с текущей реализацией моков, сервисов и типов.

---

## 1. GET /api/clients — List

**Contract:** `search?, status?, page?, pageSize?` → `PaginatedResponse<Client>`

| Aspect | Status | Details |
|--------|--------|---------|
| Параметры запроса | ✅ | search (name, companyCode, email), status |
| Пагинация | ✅ | page, pageSize, slice + total/totalPages |
| Ответ | ✅ | `{ items, total, page, pageSize, totalPages }` |

**Вывод:** ✅ OK

---

## 2. GET /api/clients/:id — Single

**Contract:** → `ApiResponse<Client>` — "full client data with order history"

| Aspect | Status | Details |
|--------|--------|---------|
| Эндпоинт | ✅ | `mockGetClient` возвращает structuredClone |
| Ошибка NOT_FOUND | ✅ | `throw new Error('CLIENT_NOT_FOUND')` |
| **Order history** | ❌ | Контракт обещает `orderHistory`, но в типе `Client` и моках его нет |

**Вывод:** ❌ **БАГ-9** — отсутствует поле `orderHistory` / `orders` в Client типе и мок-данных

---

## 3. POST /api/clients — Create

**Contract:** Required: `name`, `companyCode`, `email`. Optional: `vatCode`, `address`, `phone`, `status`, `notes`, `dynamicFields`
Errors: `VALIDATION_ERROR`, `CONFLICT` (duplicate companyCode)

| Aspect | Status | Details |
|--------|--------|---------|
| Эндпоинт | ✅ | `mockCreateClient` создаёт ID + createdAt |
| **Валидация required полей** | ❌ | Нет проверки name, companyCode, email |
| **Ошибка VALIDATION_ERROR** | ❌ | Мок не возвращает validation error |
| **Ошибка CONFLICT** | ❌ | Нет проверки duplicate companyCode |
| **dynamicFields** | ⚠️ | Contract упоминает, но тип `ClientFormData` его не включает |

**Вывод:** ❌ **БАГ-10** — отсутствует валидация обязательных полей и соответствующие ошибки

---

## 4. PATCH /api/clients/:id — Update

**Contract:** `Partial<Client>` (delta only) → `ApiResponse<Client>`. Errors: `NOT_FOUND`, `VALIDATION_ERROR`

| Aspect | Status | Details |
|--------|--------|---------|
| Эндпоинт | ✅ | `mockPatchClient` с Object.assign |
| Delta only | ✅ | `useClientCard` шлёт diff от useDirtyCheck |
| **NOT_FOUND** | ⚠️ | Мок бросает ошибку, но не как ApiResponse |
| **VALIDATION_ERROR** | ❌ | Нет возврата validation error |

**Вывод:** ⚠️ Минор — NOT_FOUND обрабатывается, но не как ApiResponse

---

## 5. DELETE /api/clients/:id — Delete

**Contract:** → `ApiResponse<null>`. Errors: `NOT_FOUND`, `CONFLICT` (active orders)

| Aspect | Status | Details |
|--------|--------|---------|
| Эндпоинт | ✅ | `mockDeleteClient` с splice |
| NOT_FOUND | ✅ | Бросает ошибку если клиент не найден |
| **CONFLICT (active orders)** | ❌ | Нет проверки на активные заказы |

**Вывод:** ❌ **БАГ-11** — отсутствует CONFLICT при удалении клиента с активными заказами

---

## 6. GET /api/clients/:id/audit — Audit log

| Aspect | Status | Details |
|--------|--------|---------|
| Эндпоинт | ✅ | `mockGetClientAudit` (теперь с structuredClone) |

**Вывод:** ✅ OK (БАГ-8 уже исправлен)

---

## 7. DELETE /api/clients/:id/audit/:entryIndex — Delete audit entry

| Aspect | Status | Details |
|--------|--------|---------|
| Эндпоинт | ✅ | Роут зарегистрирован (line 751-753) |
| **Функция мока** | ❌ | Роут есть, но не вызывает никакой mock-функции — просто `return delay(undefined as T)` |
| Функция в `clients.ts` | ❌ | Нет `mockDeleteClientAuditEntry` |

**Вывод:** ❌ **БАГ-12** — DELETE audit entry зарегистрирован в роутере, но не вызывает реальную mock-функцию

---

## Сводка новых багов

| ID | Тип | Контракт | Суть |
|----|-----|----------|------|
| БАГ-9 | Missing feature | GET /api/clients/:id | Отсутствует `orderHistory` в типе Client и мок-данных |
| БАГ-10 | Validation | POST /api/clients | Нет валидации required полей (name, companyCode, email) и ошибок |
| БАГ-11 | Error handling | DELETE /api/clients/:id | Нет CONFLICT при удалении клиента с активными заказами |
| БАГ-12 | Mock stub | DELETE /api/clients/:id/audit/:index | Роут есть, но не вызывает mock-функцию — мёртвый код |
