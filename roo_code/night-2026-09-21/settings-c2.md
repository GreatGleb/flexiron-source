# Задача settings-c2 — схема настроек: новые поля

**Ждёт:** `settings-c1` — та же модель и та же цепочка миграций. Начинать только после
того, как приёмка C1 сошлась целиком.

## Что читать

- [`roo_code/plans/settings/settings-backend-plan.md`](../plans/settings/settings-backend-plan.md) —
  **раздел 1** (строки П11, П31, П19, П20), **раздел 6** (строка C2), **раздел 7** (приёмка);
- решения [П11, П19, П20, П32, П34, П52, П62, П66, П73](../plans/api/audit/00-решения-владельца.md);
- [`roo_code/roo-context/api/settings.md`](../roo-context/api/settings.md);
- [`roo_code/skills/verify.md`](../skills/verify.md), линзы **Б1–Б5**.

## Что можно править

```
backend/app/modules/settings/shared/models.py
backend/app/modules/settings/features/crud/schemas.py
backend/app/modules/settings/features/crud/domain.py
backend/app/modules/settings/features/crud/repository.py
backend/alembic/versions/<новая ревизия>.py
roo_code/roo-context/api/settings.md
```

## Что сделать

Одна миграция на все добавления, и она идёт после C1 по той же причине, по которой C1 идёт
первой: сид (C3) обязан увидеть окончательный набор колонок.

1. **Часовой пояс и страна компании** (П62, П66) и **код подтверждения** (П73).
2. **Пятая–седьмая константы:** отсрочка платежа (П32), ширина реза (П34), срок брони (П52).
   Имена колонок, которых ждёт приёмка: `payment_deferral_days`, `default_kerf_mm`,
   `reservation_hold_days`.
3. **П11 у логотипа: колонка хранит идентификатор файла, а не ссылку.** Сегодня
   `logo_url` живёт в модели, и отдача идёт статикой. Колонка становится `logo_file_id`,
   ссылка производна и собирается на чтении подписанной на ~15 минут.
   **Поле `logoUrl` в теле запроса и в ответе при этом ОСТАЁТСЯ** — клиент по-прежнему
   присылает ссылку от `POST /api/uploads`, сервер опознаёт в ней свой файл и хранит
   идентификатор; не опознав — отвечает прежним `LOGO_URL_NOT_A_URL`, нового кода не нужно.
   Сам механизм подписывания живёт в `backend/app/core/uploads` и общий для всех доменов —
   **эта задача его не строит**.
4. **Контракт.** Правило копирования значения (П19) стоит отдельной строкой в разделе
   `## Правила домена` контракта — внести той же задачей.

**Чего делать нельзя.** Заводить размер страницы настройкой (П20): пагинация настройкой
арендатора не становится. Приёмка сторожит это нулём — и сегодня он уже нулевой, то есть
строка охраняет от регресса, а не отмечает прогресс.

## Приёмка

```bash
cd backend && python3 -m pytest tests -q
cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head
cd frontend_vue && npm run verify
cd frontend_vue && CONTRACT_REFS=roo_code/roo-context/api/settings.md npx vitest run src/services/contractRefs.spec.ts
./roo_code/night-2026-09-21/приёмка.sh c2
```

| что | ждём | сегодня |
|---|---|---|
| три новые константы в `models.py` | 3 | 0 |
| `timezone\|country_code\|confirmation_code` в `models.py` | 3 | 1 |
| файлов с `logo_url` в `backend/app` | 0 | 6 |
| `grep -c logo_file_id models.py` | >0 | 0 |
| `page_size\|pagesize\|per_page` в `settings/` | 0 | 0 (сторож) |
| `logo_url\|logoUrl` в `crud/schemas.py` | >0 | 2 (сторож) |

Два последних — сторожа: они зелены и до работы и охраняют значение от регресса. Зелёный
сторож выполненной работой не является.
