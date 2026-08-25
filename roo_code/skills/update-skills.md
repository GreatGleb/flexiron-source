---
name: update-skills
description: После починки багов — найти пробел в скилах, который позволил багу появиться, и пробел в линзах, который позволил ему дожить до человека. Правка идёт точно в место решения.
user_invocable: true
arguments:
  - name: plan
    description: "Plan file identifier, e.g. '1.1' → roo_code/plans/bugs/1.1-products-bugs.md"
    required: true
---

# Update Skills — Root cause analysis and skill updates

After fixing bugs — find WHY the skill allowed each bug, and close that exact gap.

**Принцип:** не копировать «future rule» из бага в скил. Понять, что в скиле было описано слишком коротко, невнятно или отсутствовало — и написать ровно туда.

**У каждого бага, дожившего до человека, два пробела, а не один:**

1. **Реализация допустила** — пробел в `create-page.md`, `create-plan.md` или `vue-rules.md`;
2. **Проверка не поймала** — пробел в линзах [`verify.md`](verify.md) или в группах [`pre-manual-check.md`](pre-manual-check.md).

Второй важнее первого. Пробел в реализации стоит одного бага; пробел в проверке пропускает этот баг снова и снова, а в автономном прогоне — молча, потому что там кроме линз смотреть некому. Закрывать надо оба.

---

## CRITICAL RULES

1. **Root cause first** — before any edit answer: "In which skill and where did this bug become possible?"
2. **Find the gap, not the symptom** — if bug is "too little data", cause isn't "add more data" but "skill didn't specify minimum for this case"
3. **Exact location** — edit goes into specific phase/section where developer would make the decision — not at end of file
4. **No duplicates** — Grep before inserting
5. **Only ✅ fixed** — unfixed bugs not touched
6. **Стопы — по режиму.** Интерактивно: один баг — один стоп. Автономно: стопов нет, разбор идёт подряд, итог одним отчётом.
7. **Оба пробела на каждый баг** — и в реализации, и в проверке. Закрыт один из двух — разбор не закончен.

---

## Step 0: Initialization

```
1. Determine bugs-file:
   - roo_code/plans/*/{plan}-*-plan.md → roo_code/plans/bugs/{plan}-*-bugs.md

2. Read bugs-file entirely

3. Collect list:
   - Only "## ✅ БАГ-N"
   - PAT-* — skip

4. Read skills that may be updated:
   - roo_code/skills/create-page.md — fully
   - roo_code/skills/create-plan.md — fully
   - roo_code/skills/vue-rules.md — fully
   - roo_code/skills/verify.md — линзы Л1–Л10
   - roo_code/skills/pre-manual-check.md — 6 групп

5. Интерактивно: показать план разбора и дождаться подтверждения.
   Автономно: сразу к первому багу
```

**Plan format:**
```
Bugs for analysis from {BUGS_FILE}:

  БАГ-01 — [summary]
  БАГ-05 — [summary]
  ...

Skipped (PAT-*): PAT-01, PAT-02

Start analysis?
```

---

## Single bug analysis cycle

---

### Step A — Read the bug

From bug section:
- `### Problem` — what happened
- `### Fix` — how it was fixed
- `### Future rule` — what was written as lesson (starting point, not final answer)

---

### Step B — Root cause analysis: why did the skill allow this?

This is the most important step. Ask:

**1. What decision was being made when this bug occurred?**
- Which implementation phase?
- What was the developer writing at that moment (mock data? template? CSS? composable?)?

**2. Planning gap or implementation gap?**

This determines the target skill:

- **Planning gap** → bug could have been prevented if plan explicitly stated the requirement.
  Signs: plan didn't specify data structure, mock volume, field list, entity relationships, required categories.
  → Target skill: `roo_code/skills/create-plan.md`

- **Implementation gap** → requirement was clear from context, but page creation skill didn't describe how to implement correctly.
  Signs: CSS pattern, composable structure, v-model contract, step order.
  → Target skill: `roo_code/skills/create-page.md`

```
Examples:
  Bug "cat-2 has no inherited fields in mock"
  → Plan should have specified: "for each category list inheritedFields and include in product mock data"
  → Planning gap → create-plan.md

  Bug ".empty-state not defined in card CSS"
  → Requirement was obvious (class used in template), but skill didn't describe that .empty-state is not global
  → Implementation gap → create-page.md Phase 7
```

**3. What was in the target skill at this location?**
- Read the corresponding section of the target skill
- Was there an instruction that could have prevented this bug?
- If yes — why didn't it help: too brief, no example, no explicit requirement?
- If no — this is a gap

**4. Formulate root cause:**

```
Bug happened because:
  In [skill], [phase/section] — [what was missing or insufficiently described]
```

**5. Determine target skill and location:**

| Gap type | Target skill | Location |
|---|---|---|
| Data structure requirement not in plan | `create-plan.md` | data structure / mock section |
| Mock volume or composition not in plan | `create-plan.md` | mock data section |
| Entity relationships not in plan | `create-plan.md` | relevant section |
| Any other planning gap | `create-plan.md` | relevant section |
| Mock data writing pattern | `create-page.md` | Phase 2: Mock Data |
| Service writing pattern | `create-page.md` | Phase 3: Service Layer |
| Composable writing pattern | `create-page.md` | Phase 4: Composable |
| Translation writing pattern | `create-page.md` | Phase 5: i18n |
| Template/CSS writing pattern | `create-page.md` | Phase 6 or 7 |
| Route/flag registration pattern | `create-page.md` | Phase 8 |
| Final verification pattern | `create-page.md` | Phase 9: Verification |
| Repeatable pattern across pages | `vue-rules.md` | new pitfall at end |
| Specific to one page | nowhere — leave in bugs-file |
| **Линза должна была поймать, но не поймала** | `verify.md` | линза Л<N> — дописать предмет проверки |
| **Ни одна линза этого класса не покрывает** | `verify.md` | новая линза (их 10; одиннадцатая только если предмет действительно другой) |
| **Приёмка новой страницы пропустила** | `pre-manual-check.md` | группа 1–6 по предмету |
| **Стадия потерялась при переходе** | `orchestrate.md` | определение стадии или её описание |
| **Находка записана так, что её нельзя починить** | `add-bug.md` | формат записи |

---

### Step C — Verify gap doesn't already exist

Grep keywords in target file and section:
- Found sufficiently detailed rule → **don't duplicate**, explain why skipping
- Found mention but too brief → propose expanding existing location
- Not found → insert new

---

### Step D — Formulate text for insertion

**For create-page.md or create-plan.md:**

Text must be specific and actionable — not general advice:

```
❌ Bad: "Add realistic data"
✅ Good: "For tables with pagination — minimum 50 records in STORE.
          Fewer = pagination doesn't activate, scroll not testable."

❌ Bad: "Check CSS classes"
✅ Good: "`.empty-state` is NOT global — not in admin-core.scss.
          If component uses `.empty-state` — define in its own page CSS."
```

Insertion format — embed in existing list or phase text, don't add new heading:
```markdown
- **[Specific requirement]** — [why exactly this way, consequence if violated]
```

**For vue-rules.md (new pitfall):**

```markdown
### [N]. [Specific title]

[Situation description — what happens and why it's non-obvious]

**Fix:** [specific solution]

```example if needed```
```

Number = last existing + 1.

---

### Step E — Apply

1. Make edits
2. Re-read changed fragment — verify it reads naturally in context
2a. **Новый питфолл обязан попасть в линзу.** Добавил `#69` в `vue-rules.md` — допиши его номер
   в ту линзу `verify.md`, которая этот класс проверяет. Питфолл, не упомянутый ни в одной линзе,
   не проверяется никогда: цикл гоняет линзы, а не список питфоллов.
3. **Счётчики питфоллов править НЕ надо — их нет.** Ссылки из ROO.md и других скиллов
   говорят «все питфоллы», без диапазона и без числа. Единственный счёт стоит в
   `vue-rules.md`, у самого списка, строкой «Питфоллов сейчас N» — правь только её.

   Почему это отдельным пунктом: десять копий этого числа дважды за двое суток
   указывали мимо. Сначала `#1–#33` в ROO.md отправляло читателя остановиться на
   тридцать третьем из шестидесяти семи, потом обновлённое `#1–#67` устарело через
   ОДИН добавленный питфолл. Правило появилось после второго раза.

---

### STOP — format after each bug

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ БАГ-[N] analyzed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Root cause: in [skill], [phase] — [what was missing]

Added:
  [file] → [phase/section]: [what was added — one phrase]

  /  Skipped: [reason — duplicate / too specific]

Remaining: [N] bugs
Next: БАГ-[N+1] — [summary]
Continue?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Completion

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Analysis complete — skills updated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Gaps closed: [N]
  create-page.md Phase X: [what]
  vue-rules.md: pitfalls #N, #N+1
  ...

Skipped (duplicates / too specific): [N]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Special cases

**Bug too specific to this page:**
E.g. "inherited fields for cat-2 in products mock" — this is data, not pattern. Doesn't go into skills. Report: "Domain-specific for Products, not adding to skills."

**Insertion location unclear:**
Интерактивно — показать два варианта с аргументами и спросить. Автономно — выбрать более узкое
место (конкретная фаза важнее общего раздела) и записать выбор в отчёт: спросить в прогоне некого,
а правка в общий раздел растворяется и не срабатывает.

**Rule already partially exists but insufficiently detailed:**
Propose expanding existing text, not adding new block. Show before/after.
