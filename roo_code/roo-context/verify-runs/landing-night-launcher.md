# Цикл проверок: запускалка ночи лендинга + deny-лист Claude-автора (2026-11-20)

Область: `roo_code/workflows/landing-night/` (night.py, check.sh, night-run.sh — перенос из 3D_website),
`roo_code/workflows/headless_backends.py` + `test_headless_backends.py` (AUTHOR_DENY / REVIEW_DENY).
Фронтенд не тронут. Линзы: Л3, Л5, Л9, Л10 (Л1, Л2, Л4, Л6–Л8 — фронтендовые, к области неприменимы).

## Итерация 1

Машинная приёмка: `bash roo_code/workflows/landing-night/check.sh landing` (PW_PORT=5373) на этом дереве —
`npm run verify` код 0 (86 файлов, 1263 passed / 3 skipped), e2e navigation+smoke+i18n 49 passed, код 0.

- **Л3** — HTTP-вызовов в области нет (оркестратор зовёт CLI и git). Неприменима.
- **Л5** — `grep -rn "Bash(git commit:\*)" roo_code/ --include=*.py --include=*.js`: базовый deny-лист записан
  в `headless_backends.py:AUTHOR_DENY` и в `landing-night/night.py:DENY`; `REVIEW_DENY` одинаков в обоих.
  **Находка** `landing-night/night.py:DENY:второй-экземпляр`. Попытка починки импортом откатана: AUTHOR_DENY
  живёт на ветке `fix/night-author-deny`, а ночь лендинга идёт от `main`, где его нет — импорт там падает.
  **Припарковано** с комментарием в `night.py` над DENY: после слияния ветки в main — импорт.
- **Л9** — инверсия теста deny-листа: `AUTHOR_DENY=("WebFetch",)`, `REVIEW_DENY=("Write",)` →
  `test_author_on_claude_cannot_touch_git_timers_or_web` и `test_reviewer_on_claude_cannot_run_commands_or_write`:
  как есть 2/2 зелёные, с инверсией 2 failures. Тест настоящий.
  Запускалка — подставной claude (`LANDING_CLAUDE`) в клоне scratchpad: правка в `frontend_vue/src/` → коммит
  `night: L-01`; правка в `backend/` → blocked + stash. Инверсия: `ALLOWED` с `backend/` → та же правка
  закоммичена (b9ad693 в клоне). Первая попытка инверсии промахнулась (#71): сторож заблокировал саму
  незакоммиченную подмену `night.py` — подмена закоммичена, повтор дал ожидаемое.
- **Л10** — `py_compile night.py`, `bash -n` обоих скриптов, `night.py --dry-run` — 9 задач.

Найдено 1 (Л5), починено 0, припарковано 1. Код менялся (импорт и откат) → итерация 2.

## Итерация 2

Тот же код, что после отката (+ комментарий-пометка). `py_compile`, `bash -n` ×2, `--dry-run` (11 строк: шапка + 9 задач);
подставной claude на итоговом night.py: L-01 → committed, L-02 с правкой в `backend/` → blocked (плюс
восстановленный из stash прошлой попытки `backend/evil.py` — `resume` работает). Новых находок нет.
`python3 -m unittest test_headless_backends` — результат ниже.

## Отчёт

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Цикл проверок: запускалка ночи лендинга + deny-лист автора
Итераций: 2 из 30        Вердикт: чистый свип
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Машинная приёмка:  npm run verify OK · e2e ур. 1 (navigation, smoke, i18n) OK · unittest headless — см. ниже
Линзы:             Л3 (неприменима), Л5, Л9, Л10 подтверждены
Найдено за прогон: 1       Починено: 0      Припарковано: 1 (Л5, второй экземпляр deny-листа до слияния веток)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
