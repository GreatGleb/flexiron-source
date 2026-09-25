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

**2026-09-22.** Число 19 — на дату записи (2026-09-07); сегодня в `alembic/versions/` **23**
ревизии, голова по-прежнему одна — `c9e4a1f70b23`. Перечень и замер — в
[`db-5433-and-bug02-close-2026-09-22.md`](../../roo-context/verify-runs/db-5433-and-bug02-close-2026-09-22.md), §2.

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

## БАГ-02 — `alembic check` краснеет: модели и миграции расходятся в восьми таблицах

**File:** `backend/app/modules/settings/shared/models.py:78`, [`backend/app/core/uploads/models.py`](../../../backend/app/core/uploads/models.py:24), и далее — полный список в выводе команды
**Severity:** Medium — расхождение не мешает работе сегодня, но обесценивает `alembic check` как гейт: он краснеет всегда, значит его красное ничего не сообщает.
**Источник:** Б2

### Problem

`alembic check` на чистой базе, доведённой до головы, находит расхождение модели и схемы
в восьми таблицах (15 операций). Два разных класса:

1. **`UniqueConstraint` в модели против `UNIQUE INDEX` в миграции.** Модель объявляет
   `UniqueConstraint("tenant_id", "code", name="uq_currencies_tenant_code")`
   (`backend/app/modules/settings/shared/models.py:78`), а миграция создала уникальный
   **индекс** с тем же именем. Для Postgres это разные объекты, и autogenerate предлагает
   снять индекс и поставить constraint. Так же у `field_definitions`,
   `product_field_values`, `role_permissions`, `user_permissions`, `users`, `sessions`.
2. **Тип разошёлся:** `uploaded_files.size` — `BIGINT` в базе против `Integer` в модели.

**2026-09-22.** Список перемерен: класс 1 — семь таблиц, класс 2 — `uploaded_files`, всего
**восемь**, и **15 операций**. Имени у валюты модель и база **не** делили: в базе уникальность
валюты — индекс `ix_currencies_tenant_code`, а не `uq_currencies_tenant_code` (у `role_permissions`,
`user_permissions` и `field_definitions` имя `uq_*` совпадало с модельным). Итог правки и замеры —
[`db-5433-and-bug02-close-2026-09-22.md`](../../roo-context/verify-runs/db-5433-and-bug02-close-2026-09-22.md).

Воспроизведение (нужны `asyncpg` и база):

```
cd backend && alembic check
ERROR [alembic.util.messaging] New upgrade operations detected: [('remove_index', …
```

**Домена `services` в этом списке нет** — проверено грепом по выводу:
`grep -c "table=<services>\|'services'"` → 0. То есть починка services БАГ-01 сюда не
добавила ничего, и это отдельный, более старый долг.

### Fix

**Сделано 2026-09-22 — и только на стороне моделей.** Источником истины выбран **индекс** (он и
лежит в базе), и модели приведены к нему: пять объявлений уникальности переписаны из
`UniqueConstraint` в `Index(..., unique=True)` с **теми же именами, что в БД**
(`uq_role_permission`, `uq_user_permission`, `uq_field_definitions_tenant_name`,
`ix_currencies_tenant_code`, `ix_product_field_values_product_field`); `uploaded_files.size`
объявлен `BigInteger`; `users` получил парную уникальность `(tenant_id, email)` и индекс
`updated_at`; `sessions` — объявления индексов на FK `user_id` и `expires_at`. Пять файлов,
**ни одной ревизии не заведено и ни один объект базы не снят**: правка не DDL, поэтому класс 1
решён без выбора «индекс или constraint» ценой переезда схемы — схема не трогалась вовсе.

После правки `alembic check` печатает `No new upgrade operations detected.` (exit 0) — проверено
трижды, включая базу, поднятую с нуля, и после ноги `downgrade -1` + `upgrade head`. Живой прогон,
приёмочная нога и все числа — в
[`db-5433-and-bug02-close-2026-09-22.md`](../../roo-context/verify-runs/db-5433-and-bug02-close-2026-09-22.md).
Тогда же уточнён счёт: не «девять таблиц», а **восемь** и **15 операций**.

Правило из [`verify.md`](../../skills/verify.md) соблюдено: шаг вводится зелёным — зелёным он стал
здесь, и шаг поставлен в тот же день — в линзу Б2 того же файла.

### Future rule

`alembic check` — это и есть машинная линза Б2, которую скил до сих пор описывал словами
(«поля, `nullable`, `server_default` совпадают во всех трёх местах»). Как только расхождение
разобрано, шаг становится настоящим гейтом и снимает с человека всю графу.

---

| ✅ БАГ-01 | Contract | `alembic/versions/*` | две головы: `upgrade head` падал, не применив ничего |
| ✅ БАГ-02 | Contract | `alembic check` | расходились восемь таблиц / 15 операций; закрыто 2026-09-22 правкой моделей (без DDL) |

---

## Закрытие — 2026-09-22

**Что изменено:** только модели — пять файлов (`settings`, `suppliers`, `products`, `auth`,
`core/uploads`): `UniqueConstraint` → `Index(..., unique=True)` с именами из БД, `size` →
`BigInteger`, парная уникальность `(tenant_id, email)` и индексы `sessions`. **Ни одной ревизии,
ни одного DDL-объекта, ни одного снятого объекта в базе.** Ход и before/after по каждому пункту —
в §Fix выше и в
[`db-5433-and-bug02-close-2026-09-22.md`](../../roo-context/verify-runs/db-5433-and-bug02-close-2026-09-22.md), §4–§5.

**Чем доказано (живая схема, Postgres 14, отдельный контейнер на 5433):** цепочка из **23**
ревизий с нуля (exit 0), нога `downgrade -1` + `upgrade head` (48 → 47 → 48 таблиц), `alembic check`
→ `No new upgrade operations detected.` (exit 0), парная уникальность email у арендатора держит
базу (`sqlstate=23505`), `size` в базе остаётся `bigint` (проба 3 000 000 000). Бэкенд-набор —
43 теста, `OK`. Всё это — в том же журнале, §6.

**Три собственные формулировки этой записи исправлены:** «девять таблиц» → **восемь таблиц
(15 операций)** (заголовок, текст, сводная таблица); несуществующий путь в поле `File`
(`backend/app/modules/uploads/shared/models.py`) → реальный
[`backend/app/core/uploads/models.py`](../../../backend/app/core/uploads/models.py:24); «19 ревизий»
в БАГ-01 помечено как число на дату записи (сегодня 23). Исторический текст при этом сохранён.

**Решено владельцем 2026-09-22:** `.env` снят с отслеживания (`git rm --cached backend/.env`) и закрыт
`.gitignore`, на диске остаётся на 5433, а порт 5433 стал документированным умолчанием в
`backend/.env.example` и `backend/alembic.ini:5` — там это была **согласованность, а не безопасность**:
с плейсхолдерными `user:password` тот URL получил бы отказ аутентификации, а не запись в чужую базу,
— посторонний `roo_code/zoo-code-auto-approve.json` в коммит не вошёл, а автоматизация `alembic check`
остаётся шагом [`verify.md`](../../skills/verify.md) и **намеренно не в CI** (сервиса Postgres там нет).
