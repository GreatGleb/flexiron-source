# InBox LT — Project Instructions

## Verification Rule (non-negotiable)

Every claim about code must be proven by a tool before it is written or stated.

**Mandatory protocol for every single claim:**
1. State the claim
2. State explicitly: "I will verify this with: `[tool]` — `[exact query]`"
3. Run it
4. Show the result
5. Only then write the conclusion

Steps 2–4 are never skipped — even if the claim seems obvious. Especially if it seems obvious.

**Why each step matters:**
- Step 2 forces awareness that verification is needed — prevents "I didn't think to check"
- Step 3–4 prevents misinterpretation — the result is visible, not assumed
- No exceptions for "large tasks" — attention does not decrease per item

Explore agent gives structural overview — it does not replace targeted verification. Logical deduction is not a substitute for grep.

## Skills

### Оркестратор (главный — запускать его)
- автотриггер — `.claude/skills/orchestrate.md` — включается сам когда пользователь говорит "создай страницу X" или "продолжи страницу X". Управляет полным циклом через суб-агентов: create-plan → create-page (9 фаз) → pre-manual-check → fix-bugs → Phase 10 → update-skills. Пользователь только подтверждает переходы и присылает баги.

### Отдельные скилы (запускаются оркестратором или вручную при необходимости)
- `/create-plan` — `.claude/skills/create-plan.md` — пишет план реализации страницы с первой попытки
- `/create-page` — `.claude/skills/create-page.md` — выполняет план фаза за фазой
- `/pre-manual-check 1.1` — `.claude/skills/pre-manual-check.md` — 20 целевых проверок перед ручным тестом (по одному промпту за стоп)
- `add-bug` — `.claude/skills/add-bug.md` — автотриггер когда пользователь присылает список багов; записывает в bugs-файл без команды
- `/fix-bugs 1.1` — `.claude/skills/fix-bugs.md` — исправлять баги из файла по одному за стоп; опционально `/fix-bugs 1.1 БАГ-13` для конкретного бага
- `/update-skills 1.1` — `.claude/skills/update-skills.md` — для каждого ✅ бага найти КОРЕНЬ → добавить в `create-page.md` / `create-plan.md` / `vue-rules.md`; один баг за стоп
