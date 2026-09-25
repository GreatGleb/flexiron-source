# Задача settings-c1 — схема настроек: снятие лишнего

**Ждёт:** ничего. **После неё:** `settings-c2`, затем `settings-c9` — та же модель и та же
цепочка миграций, параллелить нельзя.

## Что читать

- [`roo_code/plans/settings/settings-backend-plan.md`](../plans/settings/settings-backend-plan.md) —
  **раздел 2** (конфликты схемы и контракта), **раздел 6** (строка C1), **раздел 7** (приёмка);
- решения [П22, П23, П44, П68](../plans/api/audit/00-решения-владельца.md) — дословно, а не по памяти;
- [`roo_code/roo-context/api/settings.md`](../roo-context/api/settings.md) — контракт домена;
- [`roo_code/skills/verify.md`](../skills/verify.md), линзы **Б1–Б5**.

## Что можно править

```
backend/app/modules/settings/shared/models.py
backend/app/modules/settings/features/crud/schemas.py
backend/app/modules/settings/features/crud/domain.py
backend/app/modules/settings/features/crud/repository.py
backend/alembic/versions/<новая ревизия>.py
backend/alembic/_alembic_imports.py
roo_code/roo-context/api/settings.md
```

## Что сделать

Удаления и смены политики ссылок делаются **до** сидов (C3): иначе сид пришлось бы
переписывать, а `RESTRICT` — проверять на уже засеянных данных.

1. **Снять `exchange_rate` у валюты (П23).** Курса в проекте нет нигде: валюты
   сосуществуют, а смена валюты заказа — смена подписи, не пересчёт. Поле уходит из модели
   и из схем. Опора — П24: денежных агрегатов у домена нет ни одного, сводить суммы к одной
   валюте нечем и никто этого не делает, то есть снятие ничего не ломает вверх по течению.

2. **`CASCADE` → `RESTRICT` у правил пересчёта (П44).** Справочник, на который ссылаются,
   не должен утаскивать ссылающихся за собой. Обе внешние ссылки на `uoms.id` в правиле
   пересчёта получают `ondelete="RESTRICT"` — их ровно две, и приёмка ждёт именно двух.

3. **`default_currency` перестаёт быть хранимой колонкой (П22 + П68).** Значение
   производно: валюта по умолчанию — та, у которой поднят `is_default`. Хранимых
   производных домен не заводит. Саму выработку значения и инвариант «ровно одна» ставит
   C6 — **эта задача только снимает колонку**, не строя инварианта.

4. **Миграция.** Одна ревизия на все три изменения, вверх и вниз. Новых моделей задача не
   заводит, но если появится — зарегистрировать в `_alembic_imports.py`.

5. **Контракт.** Раздел, описывавший снятые поля, привести в соответствие. Метка
   `Бэкенд: **не реализован**` снимается той же задачей, что и слайс, — но только у
   разделов, которых слайс действительно коснулся.

**Чего делать нельзя.** Возвращать колонку `default_currency`, сославшись на исключение
П72: оно про **чужие** данные, копируемые колонкой, а `is_default` лежит в той же таблице
валют того же модуля. На собственные производные исключение не распространяется.

## Приёмка

```bash
cd backend && python3 -m pytest tests -q
cd backend && python3 -c "from app.main import app; print('ok')"
cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head
cd frontend_vue && npm run verify
cd frontend_vue && CONTRACT_REFS=roo_code/roo-context/api/settings.md npx vitest run src/services/contractRefs.spec.ts
./roo_code/night-2026-09-21/приёмка.sh c1
```

| что | ждём | сегодня |
|---|---|---|
| `grep -c exchange_rate settings/shared/models.py` | 0 | 1 |
| `grep -c exchange_rate settings/features/crud/schemas.py` | 0 | 3 |
| `grep -c 'ForeignKey("uoms.id", ondelete="RESTRICT")' models.py` | 2 | 0 |
| `grep -c default_currency settings/shared/models.py` | 0 | 1 |

`alembic upgrade head` и `alembic downgrade -1` обязаны проходить оба: миграция без
обратного хода — это не миграция, а односторонняя дверь.
