# Bugs — граф миграций разошёлся на две головы

Источник: цикл проверок, линза Б2 (модель ↔ миграция ↔ контракт), при починке
[`contract-sync-services-bugs.md`](contract-sync-services-bugs.md) БАГ-01 — миграцию услуг
некуда было прицепить.
Область: `backend/alembic/versions/**`, шаг приёмки `alembic upgrade head` из
[`verify.md`](../../skills/verify.md).
Начато: 2026-09-07.

---

## ✅ БАГ-01 — `alembic upgrade head` не работал вообще: две головы вместо одной

**File:** `backend/alembic/versions/15f2c7d4e9b0_enlarge_logo_url_to_text.py:20`,
`backend/alembic/versions/a1b2c3d4e5f6_phase_15_product_uom_restructure.py:20`
**Severity:** Critical — шаг приёмки бэкенда падал на любой задаче, ещё не дойдя до её кода; поднять базу с нуля было нельзя.
**Источник:** Б2

### Problem

Обе ревизии объявляли `down_revision = 'bbd27a3881a5'`, то есть росли из одного родителя:

```
bbd27a3881a5 -> 15f2c7d4e9b0 (head), enlarge_logo_url_to_text
bbd27a3881a5 -> a1b2c3d4e5f6 (head), phase_15_product_uom_restructure
```

Обе добавлены **одним коммитом** `34e94f6` («feat: currency & FIFO cost + product UOM
restructure») с проставленными руками id — то есть это не осознанное ветвление, а недосмотр:
второй файл писали, не спросив у alembic текущую голову.

Следствие — `alembic upgrade head` падал, не применив ни одной ревизии:

```
FAILED: Multiple head revisions are present for given argument 'head';
please specify a specific target revision, '<branchname>@head' to narrow to
a specific head, or 'heads' for all heads
```

Этот шаг стоит в приёмке бэкенда в [`verify.md`](../../skills/verify.md) («Бэкенд: приёмка и
линзы Б1–Б5», строка `alembic upgrade head`). Значит он не проходил ни разу с 2026-06-16 —
и никто этого не заметил, потому что в окружении не было ни базы, ни `asyncpg`, и шаг молча
пропускался.

### Fix

Ревизия слияния `backend/alembic/versions/a6cd643b6f75_merge_logo_url_and_product_uom_heads.py`:
`down_revision = ('15f2c7d4e9b0', 'a1b2c3d4e5f6')`, схему не меняет ничем. Сделана штатным
`alembic merge`, а не руками — ровно та ошибка, которая породила развилку.

**Проверено на живой базе** (Postgres 14 в докере, отдельный контейнер на порту 5433, чтобы не
трогать чужую базу на 5432): `alembic heads` отдаёт одну голову, `alembic upgrade head` с нуля
проходит все 19 ревизий, `alembic downgrade -1` работает.

**Подтверждено не автором правки 2026-09-07.** Граф разобран независимо: 19 файлов ревизий,
`revision`/`down_revision` сведены в цепочку — голова ровно одна (`7fff8d1e5810`), и до слияния
их было две, `15f2c7d4e9b0` и `a1b2c3d4e5f6`, обе из `bbd27a3881a5`. `alembic upgrade head` на
пустой базе прошёл все 19 ревизий (exit 0), `downgrade -1` и повторный `upgrade` тоже.

### Future rule

Развилку видно одной командой, и она машинная: `alembic heads` обязан печатать **ровно одну**
строку. Это дешевле, чем `upgrade`, не требует базы вообще и ловит весь класс «id проставили
руками». Просится в приёмку бэкенда рядом с `alembic upgrade head` — с оговоркой из
[`verify.md`](../../skills/verify.md): шаг вводится только зелёным, а зелёным он стал именно
сейчас.

Второе: пропущенная проверка не отличается от пройденной, если её нельзя запустить. Здесь
шаг три месяца стоял в скиле, не выполнялся ни разу и потому не защищал ничего — тот же класс,
что `python -m pyright … || echo skipping` из того же файла. Окружение оказалось поднимаемым:
`pip install --target` плюс `docker run postgres` — четыре минуты.

---

## БАГ-02 — `alembic check` краснеет: модели и миграции расходятся в девяти таблицах

**File:** `backend/app/modules/settings/shared/models.py:82`, `backend/app/modules/uploads/shared/models.py`, и далее — полный список в выводе команды
**Severity:** Medium — расхождение не мешает работе сегодня, но обесценивает `alembic check` как гейт: он краснеет всегда, значит его красное ничего не сообщает.
**Источник:** Б2

### Problem

`alembic check` на чистой базе, доведённой до головы, находит расхождение модели и схемы
в девяти таблицах. Два разных класса:

1. **`UniqueConstraint` в модели против `UNIQUE INDEX` в миграции.** Модель объявляет
   `UniqueConstraint("tenant_id", "code", name="uq_currencies_tenant_code")`
   (`backend/app/modules/settings/shared/models.py:82`), а миграция создала уникальный
   **индекс** с тем же именем. Для Postgres это разные объекты, и autogenerate предлагает
   снять индекс и поставить constraint. Так же у `field_definitions`,
   `product_field_values`, `role_permissions`, `user_permissions`, `users`, `sessions`.
2. **Тип разошёлся:** `uploaded_files.size` — `BIGINT` в базе против `Integer` в модели.

Воспроизведение (нужны `asyncpg` и база):

```
cd backend && alembic check
ERROR [alembic.util.messaging] New upgrade operations detected: [('remove_index', …
```

**Домена `services` в этом списке нет** — проверено грепом по выводу:
`grep -c "table=<services>\|'services'"` → 0. То есть починка services БАГ-01 сюда не
добавила ничего, и это отдельный, более старый долг.

### Fix

TBD — решать по классам, а не одной ревизией. Для класса 1 надо выбрать, что считать
источником истины (индекс или constraint), и привести к нему обе стороны; для класса 2
достаточно `BigInteger` в модели. Пока не сделано, `alembic check` в приёмку не ставить: он
краснел бы с рождения — запрещено правилом «шаг гейта вводится только зелёным» из
[`verify.md`](../../skills/verify.md).

### Future rule

`alembic check` — это и есть машинная линза Б2, которую скил до сих пор описывал словами
(«поля, `nullable`, `server_default` совпадают во всех трёх местах»). Как только расхождение
разобрано, шаг становится настоящим гейтом и снимает с человека всю графу.

---

| ✅ БАГ-01 | Contract | `alembic/versions/*` | две головы: `upgrade head` падал, не применив ничего |
| БАГ-02 | Contract | `alembic check` | модели и миграции расходятся в девяти таблицах |
