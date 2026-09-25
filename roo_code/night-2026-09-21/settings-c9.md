# Задача settings-c9 — карта склада

**Ждёт:** `settings-c2` — заводит колонки в том же `models.py` и следующую ревизию в той же
цепочке миграций. С C4/C5 не пересекается и может идти после них или до них.

## Что читать

- [`roo_code/plans/settings/settings-backend-plan.md`](../plans/settings/settings-backend-plan.md) —
  **раздел 1** (строки П11 и П31 — они управляют слайсом прямо), **раздел 6** (строка C9),
  **раздел 7** (приёмка);
- решения [П11, П31, П65](../plans/api/audit/00-решения-владельца.md) — дословно;
- [`roo_code/roo-context/api/settings.md`](../roo-context/api/settings.md) — три эндпоинта карты;
- [`roo_code/skills/create-api-feature.md`](../skills/create-api-feature.md) — порядок слоёв;
- [`roo_code/skills/verify.md`](../skills/verify.md), линзы **Б1–Б5**.

## Что можно править

```
backend/app/modules/settings/features/warehouse_map/    (новая фича целиком)
backend/app/modules/settings/shared/models.py
backend/app/main.py                                     (регистрация роутера)
backend/alembic/versions/<новая ревизия>.py
backend/alembic/_alembic_imports.py
roo_code/roo-context/api/settings.md
```

## Что сделать

Порядок слоёв внутри слайса задан не этим планом:
`schemas.py` → `repository.py` → `domain.py` → `action.py`, импорт-проверка после каждого
файла, регистрация роутера в `app/main.py`, регистрация новой модели в `_alembic_imports.py`.

1. **Хранилище карты** — таблица `warehouse_map`, метаданные в JSON.
2. **Три эндпоинта** карты по контракту (`GET`, `PUT`, `DELETE`).
3. **П11 — колонка хранит идентификатор файла, а не ссылку.** `map_file_id`, не `map_url`.
   Ссылка производна, подписана и живёт ~15 минут; собирается на чтении. Бинарник грузится
   штатным `POST /api/uploads`.
4. **П31 — сохранение карты снимает с её файла пометку черновика.** `PUT` карты **и есть**
   тот `Save`, о котором говорит П31. Следствие: карта, загруженная и не подтверждённая,
   исчезает сама по TTL — спрашивать про неё владельца не нужно.
5. **Контракт.** Снять метку `Бэкенд: **не реализован**` с трёх разделов карты: число таких
   меток в `settings.md` обязано убыть с 4 до 1.

**Чего эта задача не строит — и это не забывчивость.** Ни подписывание ссылок, ни уборщик
черновиков здесь не пишутся: они живут в `backend/app/core/uploads` и общие для всех
доменов. Пока их нет, отдача идёт прежней статикой (`backend/app/main.py:75`) — слайс это
не блокирует. Механизм сегодня не работает ни одним звеном (загрузчик жёстко пишет
`is_draft=False`, `draft_ttl_hours` не читается нигде, `expires_at` не заполняется,
уборщика нет) — и чинить его C9 не обязан.

**Чего в плане нет.** Кто удаляет файл карты, который **был привязан и осиротел** после
замены или удаления, — вопрос владельца **В4**, и он открыт. Задача этого не решает: `PUT`
и `DELETE` делают свою работу, осиротевший бинарник остаётся. Если по ходу окажется, что
без ответа слайс не пишется — **задача падает** со словами «в плане этого нет», догадка
запрещена.

## Приёмка

```bash
cd backend && python3 -m pytest tests -q
cd backend && python3 -c "from app.modules.settings.features.warehouse_map.action import router; print('ok')"
cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head
cd frontend_vue && npm run verify
cd frontend_vue && CONTRACT_REFS=roo_code/roo-context/api/settings.md npx vitest run src/services/contractRefs.spec.ts
./roo_code/night-2026-09-21/приёмка.sh c9
```

| что | ждём | сегодня |
|---|---|---|
| `grep -c warehouse_map settings/shared/models.py` | >0 | 0 |
| `grep -c map_file_id models.py` | >0 | 0 |
| `grep -c map_url models.py` | 0 | 0 (сторож П11) |
| файлов с `is_draft` в `settings/` | >0 | 0 |
| `@router` в `warehouse_map/action.py` | 3 | 0 |
| меток «не реализован» в `settings.md` | 1 | 4 |

Последняя строка — та самая «метка контракта снимается той же задачей, что и слайс».
`contract-conformance.spec.ts` покраснеет сама, если метка осталась.
