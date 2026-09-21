# Задача settings-c5 — валидация тел запросов

**Ждёт:** `settings-c4` — каждая проверка отдаёт свой код, а не общий `VALIDATION_ERROR`;
без глобального обработчика код приедет пятисотым.

## Что читать

- [`roo_code/plans/settings/settings-backend-plan.md`](../plans/settings/settings-backend-plan.md) —
  **раздел 3** (таблица кодов), **раздел 6** (строка C5), **раздел 7** (приёмка);
- [`roo_code/roo-context/api/settings.md`](../roo-context/api/settings.md);
- [`roo_code/skills/verify.md`](../skills/verify.md), линзы **Б5**, **Л3**, **Л9**.

## Что можно править

```
backend/app/modules/settings/features/crud/schemas.py
backend/app/modules/settings/features/crud/domain.py
backend/app/modules/settings/features/crud/repository.py
frontend_vue/src/            (разбор новых кодов на вкладках)
roo_code/roo-context/api/settings.md
```

## Что сделать

Каждая проверка ниже отдаёт **свой** код из таблицы раздела 3, а не общий `VALIDATION_ERROR`.

1. **Связка `factor`/формула у правила пересчёта** — `CONVERSION_FACTOR_REQUIRED` (422) при
   `type === 'static'` без `factor`, `CONVERSION_FORMULA_REQUIRED` (422) при `dynamic` без
   формулы. Сегодня правило создаётся пустым, и пересчёт молча не срабатывает (БАГ-20).
2. **Замкнутый перечень категорий единиц** — `UOM_CATEGORY_UNKNOWN` (422). Сегодня
   `String(20)` примет любой текст, и единица выпадет из всех группировок.
3. **Дубль пары у правила пересчёта** — `CONVERSION_PAIR_TAKEN` (409). Проверка на сервере
   есть, но отвечает голым `ConflictError` (`crud/domain.py:376-379`) — дать ей имя.
4. **Уникальность кода валюты на `PATCH`** — `CURRENCY_CODE_TAKEN` (409), БАГ-10.
   `UniqueConstraint` в модели есть, но без перехвата даёт 500, а не отказ.
5. **`defaultCurrency` по списку валют** — `DEFAULT_CURRENCY_UNKNOWN` (422).
6. **`logoUrl` не base64** — `LOGO_URL_NOT_A_URL` (422), БАГ-18.
7. **Полнота списка у `reorder`** — `ORDER_STATUS_REORDER_INCOMPLETE` (422) на список, где
   не все статусы арендатора либо есть чужой `id`. Сегодня это цикл из N `UPDATE`
   (`crud/repository.py:358-370`): чужой `id` не совпадает ни с одной строкой и молча
   ничего не делает, неполный список оставляет часть статусов со старым `sort_order` —
   две записи получают один номер.
   **Атомарность здесь чинится не транзакцией** (один `commit` у него уже есть), а отказом
   на неполном и чужом списке.
8. **`order` уходит из схемы `PATCH` статуса** — порядком управляет `reorder`, а не правка
   одной записи.

**Чего эта задача не делает.** `CONSTANT_OUT_OF_RANGE` — границ владелец не назначал
(**В2**), это слайс C15. Перенумерацию после удаления не трогать — вопрос **В14**, слайс C14.

**Л9 обязательна.** На каждое новое утверждение — инверсия: сломать проверяемое поведение и
убедиться, что тест краснеет. Тест, не покрасневший на сломанном коде, — не тест. Если
НИЧЕГО не покраснело, это подозрение, что сломано не то место, а не вывод «тест слеп».

## Приёмка

```bash
cd backend && python3 -m pytest tests -q
cd frontend_vue && npm run verify
cd frontend_vue && CONTRACT_REFS=roo_code/roo-context/api/settings.md npx vitest run src/services/contractRefs.spec.ts
./roo_code/night-2026-09-21/приёмка.sh c5
```

| что | ждём | сегодня |
|---|---|---|
| файлов с `ORDER_STATUS_REORDER_INCOMPLETE` в `backend/app` | >0 | 0 |
| то же во `frontend_vue/src` | >0 | 0 |
| `order` в схеме `PATCH` статуса (`crud/schemas.py`) | 0 | 4 |
| `raise ValidationError` в `crud/domain.py` | больше прежних 2 | 2 |

Плюс: на каждый код из списка — строка в разделе своего эндпоинта контракта, и
`CONTRACT_REFS` по `settings.md` не добавляет битых ссылок.
