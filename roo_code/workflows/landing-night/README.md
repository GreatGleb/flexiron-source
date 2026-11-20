# Ночь лендинга

Очередь [`roo_code/plans/landing/tasks.json`](../../plans/landing/tasks.json) (план —
[`landing-plan.md`](../../plans/landing/landing-plan.md)) без присмотра: на каждую задачу автор
Claude Code → проверка путей → `check.sh` → приёмщик только на чтение → коммит `night: L-xx`.

Перенесено 2026-11-20 из 3D_website (`docs/planning/edition-2/run/night.py`, `night-run.sh`, где
этой схемой собрано 31 задача из 33). Логика оркестратора не менялась; заменены пути, запреты,
промпты и проверка.

```
tasks.json ──► night.py ──► на каждую задачу по порядку:
                 1. автор: claude --print, bypassPermissions + deny-лист (DENY)
                 2. оркестратор: изменены только ALLOWED? HEAD и ветка не тронуты?
                 3. check.sh: npm run verify + e2e лендинга (у e2e_full — полный набор)
                 4. приёмщик: отдельная сессия --restricted, только чтение, вердикт по done
                 5. замечания или красная проверка → один круг доработки автором
                 6. принято → коммит «night: L-xx»; нет → git stash «night-blocked L-xx»,
                    зависящие задачи пропускаются
```

## Запуск

```bash
python3 roo_code/workflows/landing-night/night.py --dry-run          # что будет выполнено
bash roo_code/workflows/landing-night/night-run.sh --only L-01       # пробная одна задача
bash roo_code/workflows/landing-night/night-run.sh                   # вся очередь
bash roo_code/workflows/landing-night/night-run.sh --resume          # продолжить на auto/night-landing-*
```

Пережить закрытие терминала:
`systemd-run --user --collect --unit=flexiron-landing-night bash ~/PycharmProjects/flexiron-source/roo_code/workflows/landing-night/night-run.sh`,
ход — `journalctl --user -fu flexiron-landing-night`.

`night-run.sh` откажется стартовать, если: дерево не чистое (`git status`); занят порт `PW_PORT`
(5373) или следующий за ним — Playwright переиспользовал бы чужой dev-сервер с другим окружением;
нет `frontend_vue/node_modules`. Ветку `auto/night-landing-<время>` он создаёт от текущего HEAD,
push на время ночи отключён.

Журналы и сводка: `~/.local/share/flexiron-landing/night-<время>/` (`СВОДКА.md`, `journal.jsonl`,
промпты и ответы сессий, логи `check.sh`). Вердикты приёмщика по всем ночам — `review-stats.jsonl` там же.
Утром: смотреть `СВОДКА.md`, ветку, `git stash list`; сливать в рабочую ветку — человеку.

Параметры — переменные `LANDING_*` (см. шапку `night-run.sh`): часы, минуты на задачу, модель,
доля недельного лимита (по умолчанию 15 % от 120 млн учитываемых токенов = 18 млн), где работает
приёмщик, число доработок.

## Что проверено до первой ночи (2026-11-20)

- `--dry-run` видит 9 задач; флаги `--print --output-format --add-dir --permission-mode
  --disallowedTools --restricted` есть в claude 2.1.329.
- Подставной claude (`LANDING_CLAUDE=<скрипт>`) в отдельном клоне: правка в `frontend_vue/src/` →
  принято, коммит `night: L-01`; правка в `backend/` → `blocked`, работа в stash `night-blocked L-02`,
  заметка коммитом `night-note`, `--dry-run` после этого видит L-01 выполненной.
- Инверсия: с `backend/` в `ALLOWED` та же правка закоммичена — блокировку даёт именно проверка путей.
- Настоящая модель не запускалась ни разу: первый настоящий прогон — `--only L-01`.
- Журнал цикла проверок — [`verify-runs/landing-night-launcher.md`](../../roo-context/verify-runs/landing-night-launcher.md).

## Долг

`DENY`/`REVIEW_DENY` в `night.py` — вторая копия `AUTHOR_DENY`/`REVIEW_DENY` из `../headless_backends.py`:
там список живёт на ветке `fix/night-author-deny`, а эта ночь идёт от `main`. После слияния — импорт.
