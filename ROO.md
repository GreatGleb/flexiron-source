# Flexiron Enterprise — Roo Code Instructions

## 🔴 CRITICAL: Roo Code workspace rules (NON-NEGOTIABLE)

### 1. All Roo Code files go to `roo_code/`
Any new file created for Roo Code workflow, skills, plans, or process improvements — MUST be placed in `roo_code/` directory. NOT in root.

- Skills → `roo_code/skills/`
- Plans → `roo_code/plans/` — **NEVER create plans in the root directory (`./`). All plans go here.**
- Context → `roo_code/roo-context/`

> ⚠️ **Plan creation rule:** When creating a new plan file (`.md`, `.txt`, or any other format), it MUST be placed under `roo_code/plans/<domain>/`. Creating plan files in the root directory (`./plan.md`, `./plan.txt`, etc.) is strictly forbidden. If you catch yourself about to write a plan to the root — STOP and redirect to `roo_code/plans/`.

> ⚠️ **Archive rule (инвариант, не разовая уборка):** в `roo_code/plans/` вне архива лежат
> **только актуальные планы**. План перестал быть актуальным — он **сразу** уезжает в
> `roo_code/plans/archive/<YYYY-MM>/` по месяцу, когда закрылся. Не «когда-нибудь потом
> разберём», а тем же действием, которым признали неактуальным.
>
> Раскладка внутри месяца — по источнику: `archive/<YYYY-MM>/roo_code/<домен>/` и
> `archive/<YYYY-MM>/toDo/`. Имя файла и домен сохраняются.
>
> **Неактуален** — это любое из:
> - работа плана найдена в коде целиком (выполнен);
> - цель достигнута другим способом, а предписанные артефакты так и не появились (сделано иначе);
> - премисса плана исчезла — описанного кода нет ни в проблемном, ни в решённом виде;
> - это снимок/промпт/чекпоинт/записка разового употребления, который уже отработал.
>
> **Актуален** — план, работа по которому ещё предстоит, и живой справочный документ
> (действующий контракт домена, политика прогонов, текущая очередь работы).
>
> Переносить — `git mv`, чтобы история файла не рвалась. После переноса **проверить
> относительные ссылки резолвом по файловой системе** — и те, что внутри перенесённого
> файла, и те, что вели на него снаружи. Правило разбора и доказательная база —
> [`roo_code/plans/archive/2026-08/README.md`](roo_code/plans/archive/2026-08/README.md).

### 2. After `ask_followup_question` — STOP and WAIT
Do NOT call any other tools until the user responds. No preparatory commands, no searches, no file reads, nothing. Wait for the user's answer first.

**Why:** The user must choose an option before any action is taken. Pre-executing commands after a question violates user trust.

**Enforcement:** If I catch myself starting to call a tool after `ask_followup_question` without user response — I must abort and wait.

### 3. NEVER guess settings — always verify the actual source
When the user asks about a configuration setting or timeout behavior:

1. **Do NOT assume** what a setting does based on its name
2. **Do NOT add settings** to `settings.json` without verifying the exact key name and behavior
3. **Always verify** by reading the extension's source code:
   - Read the setting definition in `package.json` (type, default, min, max)
   - Read the official description in `package.nls.json`
   - Read how the setting is actually used in `dist/extension.js`
4. **Use `Select-String`** to find the exact usage pattern in the minified JS
5. **Only then** modify `settings.json`

**Concrete example of past mistake:** The user asked me to wait 5 minutes for their answers. I assumed `roo-cline.timeout` was the correct setting name. It wasn't — the real name is `roo-cline.commandExecutionTimeout`. And even that setting controls **shell command runtime** (max time for `npm run build` etc.), NOT **question waiting time**. The question waiting is controlled by the `timeout` parameter on `execute_command` tool calls (the `agentTimeout` mechanism), not by any `settings.json` value.

**Rule:** If I don't know the exact setting name and behavior — I search the extension source FIRST, ask the user SECOND, modify settings THIRD. Never the other way around.

### 4. Session start protocol — read skills BEFORE any code
At the START of every session, BEFORE writing any code, creating any plan, or making any edit:

1. **Read [`roo_code/skills/vue-rules.md`](roo_code/skills/vue-rules.md) completely** — полностью — все питфоллы и раздел "Applying this skill"
2. **Read [`roo_code/skills/verify.md`](roo_code/skills/verify.md)** — цикл проверок. Он центральный: остальные скилы не описывают проверку сами, а вызывают его. Не прочитан — проверять будешь по памяти, то есть никак
3. **If task involves a page** → also read [`roo_code/skills/create-page.md`](roo_code/skills/create-page.md)
4. **If task involves a plan** → also read [`roo_code/skills/create-plan.md`](roo_code/skills/create-plan.md)
5. **If task involves bugs** → also read [`roo_code/skills/fix-bugs.md`](roo_code/skills/fix-bugs.md)

**Why:** Skills contain accumulated lessons from real bugs. Skipping them = repeating past mistakes. The 30 seconds to read a skill saves 30 minutes of fixing.

**Enforcement:** If I start writing code without having read the relevant skill(s) — I must STOP, read the skill(s), and only then continue.

### 5. These rules are ALWAYS in effect
ROO.md is read at session start. The rules above are permanent and apply to every session. If a rule seems ignored — re-read this file.

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

## Два режима работы

Скилы описывают оба; путать их нельзя.

| | Интерактивный | Автономный |
|---|---|---|
| Кто запустил | человек в чате | скрипт прогона (workflow) |
| Стопы между фазами и багами | есть, ждут ответа | нет |
| Неясность в задаче | спросить и ждать | задача **падает** с указанием, чего нет в плане; догадка запрещена |
| Источник багов | ручное тестирование | линзы цикла проверок |
| Признак «готово» | человек посмотрел | чистый свип цикла из [`verify.md`](roo_code/skills/verify.md) |
| Подтверждение починки | человек | отдельный агент-скептик, не автор правки |
| Мерж ветки | человек | только по чистому свипу, `--no-ff`, без пуша |

**Режим не угадывается.** Автономный — только когда задачу запустил скрипт. Во всех остальных случаях интерактивный, со стопами.

Правило «после `ask_followup_question` — СТОП и ждать» (раздел 2 выше) действует в интерактивном режиме. В автономном вопросов не задают вовсе: спрашивать некого, а незаданный вопрос превращается в догадку, которую никто не увидит.

Политика автономных прогонов — ветка, коммит на задачу, условия остановки, требование чистого дерева: [`roo_code/plans/general/autonomous-run-policy-plan.md`](roo_code/plans/general/autonomous-run-policy-plan.md).

## Project Context

### Tech Stack
- **Frontend:** Vue 3 (Composition API, `<script setup>`), Vite, Vue Router, Pinia
- **Styling:** Custom CSS (no Tailwind), scoped styles in `.vue` files
- **i18n:** Custom i18n system (`src/i18n/`)
- **Testing:** Playwright for e2e tests
- **Backend:** `backend/` — FastAPI, Modular Monolith + Vertical Slice (see `/create-api-feature`).
  Состояние на 2026-08-22: десять модулей, модели у девяти, 17 миграций — и всего восемь
  вертикальных слайсов (auth ×4, products ×2, settings ×2). То есть схема заложена, а
  эндпоинтов почти нет. Модуля `orders` нет вовсе: `billing` — это тарифы SaaS (plans,
  tenant_plans, feature_definitions), а не заказы клиентов.
- **API-контракт:** переводится в `roo_code/roo-context/api/<домен>.md` — по файлу на домен,
  плюс `00-conventions.md`. Сверка с кодом машинная: `contract-conformance.spec.ts` внутри
  `npm run test:unit`, состояние печатается строкой `[контракт] сведено доменов: …`. План работы
  и порядок фаз — [`roo_code/plans/api/contract-sync-plan.md`](roo_code/plans/api/contract-sync-plan.md).
  Пока сверка не закончена, `roo_code/roo-context/03-api-contract.md` остаётся на месте как
  источник для переноса — но он устарел, и читать его без сверки с кодом нельзя.
  Файла `toDo/admin-api-contract.md`, на который тут ссылались раньше, в репозитории нет.

### Key Directories
- `frontend_vue/src/` — main source code
- `frontend_vue/src/views/` — page components (admin/ and public/)
- `frontend_vue/src/composables/` — reusable logic
- `frontend_vue/src/types/` — TypeScript type definitions
- `frontend_vue/src/i18n/` — translations
- `frontend_vue/src/styles/` — CSS files
- `backend/app/modules/<module>/features/<feature>/` — вертикальные слайсы бэкенда
- `backend/app/modules/<module>/shared/models.py` — модели модуля
- `backend/app/core/` — инфраструктура, трогать только по необходимости
- `backend/alembic/versions/` — миграции
- `roo_code/roo-context/` — project context for AI (design docs, plans, specs)
- `roo_code/skills/` — Roo Code skills
- `toDo/` — original project documentation (design specs, plans, bugs)

### Coding Conventions
- Vue 3 Composition API with `<script setup lang="ts">`
- Scoped styles in `<style scoped>`
- TypeScript for logic, Vue for templates
- Composables follow `useXxx` naming pattern
- i18n keys use dot notation: `page.section.element`
- Feature flags in `src/config/featureFlags.ts`

## Skills Directory

**All skills are located at:** [`roo_code/skills/`](roo_code/skills/)

This directory contains 10 skill files. **Every session starts with awareness of these skills.** When a task matches a skill's purpose — read and follow that skill. Do not wait to be told.

---

## Skills Decision Matrix

Use this matrix to determine which skill to invoke for any given task. **Read the skill file completely before executing.**

| Trigger / Task Description | Skill to Invoke | File |
|---|---|---|
| User mentions a page, section, task continuation, or any work stage | **Orchestrator** — determines current stage and transitions between skills | [`orchestrate.md`](roo_code/skills/orchestrate.md) |
| Creating a new implementation plan for a page (no plan exists yet) | **create-plan** — writes complete plan covering all 11 phases | [`create-plan.md`](roo_code/skills/create-plan.md) |
| Implementing a page from an existing plan (phase-by-phase) | **create-page** — executes plan phases 0–10 with stops after each | [`create-page.md`](roo_code/skills/create-page.md) |
| Before manual testing — deep automated verification of a newly implemented page | **pre-manual-check** — runs 8 groups of checks, writes bugs to file | [`pre-manual-check.md`](roo_code/skills/pre-manual-check.md) |
| User sends a bug list, describes UI issues, or pastes problems | **add-bug** — auto-triggered, formats and records bugs to bugs-file | [`add-bug.md`](roo_code/skills/add-bug.md) |
| Fixing bugs from a bugs-file (one bug per cycle, max 5 verification iterations) | **fix-bugs** — read → verify → plan → fix → verify cycle | [`fix-bugs.md`](roo_code/skills/fix-bugs.md) |
| After all bugs fixed — root cause analysis and skill improvement | **update-skills** — finds gaps in create-page/create-plan/vue-rules and closes them | [`update-skills.md`](roo_code/skills/update-skills.md) |
| Any verification of written code — after a phase, after a fix, before a merge | **verify** — цикл проверок: машинная приёмка + 10 линз, до чистого свипа или 30 итераций | [`verify.md`](roo_code/skills/verify.md) |
| Adding a FastAPI backend feature inside an existing module | **create-api-feature** — schemas → repository → domain → action | [`create-api-feature.md`](roo_code/skills/create-api-feature.md) |
| Writing or checking a section of the API contract for the backend | **api-contract** — порядок чтения кода, формат раздела, линзы К1–К7, свой цикл | [`api-contract.md`](roo_code/skills/api-contract.md) |
| Writing Vue 3 code, adding `:class` bindings, editing mocks, building forms, adding pages/components, refactoring, choosing HTTP methods, debugging CSS/reactivity | **vue-rules** — полный список питфоллов + save UX + HTTP methods + contract-first rules | [`vue-rules.md`](roo_code/skills/vue-rules.md) |

---

## When to Use Skills — Detailed Guidance

### 🔴 ALWAYS read the relevant skill when:

1. **Starting any page implementation** → read [`orchestrate.md`](roo_code/skills/orchestrate.md) first, then [`create-page.md`](roo_code/skills/create-page.md) and [`vue-rules.md`](roo_code/skills/vue-rules.md)
2. **Writing any plan** → read [`create-plan.md`](roo_code/skills/create-plan.md) and [`create-page.md`](roo_code/skills/create-page.md) completely
3. **Fixing any bug** → read [`fix-bugs.md`](roo_code/skills/fix-bugs.md) before touching code
4. **Before manual testing** → read [`pre-manual-check.md`](roo_code/skills/pre-manual-check.md)
5. **After fixing bugs** → read [`update-skills.md`](roo_code/skills/update-skills.md)
6. **Writing any Vue code** → read [`vue-rules.md`](roo_code/skills/vue-rules.md) — весь список питфоллов, до конца
7. **Verifying anything you wrote** → read [`verify.md`](roo_code/skills/verify.md) — проверка это цикл, а не один проход; выход только по чистому свипу

### 🟡 Consider reading when:

- **User reports a problem** → could be a bug → [`add-bug.md`](roo_code/skills/add-bug.md) may auto-trigger
- **Task involves multiple pages or complex workflow** → [`orchestrate.md`](roo_code/skills/orchestrate.md) manages transitions
- **You're unsure which skill applies** → read [`orchestrate.md`](roo_code/skills/orchestrate.md) — it determines the correct stage

### 🟢 Not needed when:

- Simple questions or explanations (use general knowledge)
- Tasks unrelated to frontend development (e.g., backend, infrastructure)

---

## Skill Invocation Protocol

1. **Identify** — when a task starts, check the decision matrix above
2. **Read** — open the skill file and read it **completely** before taking any action
3. **Follow** — execute the skill's instructions step by step
4. **Complete** — after the skill finishes, check if another skill should follow (orchestrator handles this automatically)

**If multiple skills apply** (e.g., create-page + vue-rules) — read both. Skills are designed to complement each other.

---

## Orchestrator (main entry point — run this first)

When user mentions a page, bugs, work stage, section, or task continuation — **IMMEDIATELY**:
1. Read [`roo_code/skills/orchestrate.md`](roo_code/skills/orchestrate.md)
2. Determine Plan ID and current stage from files
3. Announce stage to user and continue

**Do NOT wait for commands. Do NOT respond "waiting for list" without starting orchestrator.**

---

## Individual Skills Reference

| Command | Skill File | Purpose |
|---|---|---|
| `/create-plan` | [`create-plan.md`](roo_code/skills/create-plan.md) | Writes page implementation plan |
| `/create-page` | [`create-page.md`](roo_code/skills/create-page.md) | Executes plan phase by phase (11 phases, 0–10) |
| `/pre-manual-check <plan>` | [`pre-manual-check.md`](roo_code/skills/pre-manual-check.md) | 8 grouped check categories before manual test |
| `add-bug` | [`add-bug.md`](roo_code/skills/add-bug.md) | Auto-trigger when user sends bug list |
| `/fix-bugs <plan> [bug]` | [`fix-bugs.md`](roo_code/skills/fix-bugs.md) | Fix bugs from file, max 5 verification iterations per bug |
| `/update-skills <plan>` | [`update-skills.md`](roo_code/skills/update-skills.md) | For each ✅ bug find root cause → add to skills |
| `/verify` | [`verify.md`](roo_code/skills/verify.md) | Цикл проверок — машинная приёмка + 10 линз, выход только по чистому свипу (лимит 30 итераций) |
| `/create-api-feature` | [`create-api-feature.md`](roo_code/skills/create-api-feature.md) | Backend feature: schemas → repository → domain → action |
| `/api-contract <домен>` | [`api-contract.md`](roo_code/skills/api-contract.md) | Раздел контракта для бэкенда по коду: аудит → контракт → линзы К1–К7 |
| `/vue-rules` | [`vue-rules.md`](roo_code/skills/vue-rules.md) | Vue 3 pitfalls and rules (полный список) |

## Воркфлоу

Скрипты прогонов живут в `roo_code/workflows/`, Claude Code видит их через симлинки в
`.claude/workflows/`. Скил описывает, КАК делать одну задачу; воркфлоу — кто и в каком порядке
раздаёт задачи, где коммиты, когда стоп.

| Скрипт | Что гоняет |
|---|---|
| [`implement-followups.js`](roo_code/workflows/implement-followups.js) | пункты `review-followups.md`: реализация → скептик → коммит |
| [`inventory-plans.js`](roo_code/workflows/inventory-plans.js) | инвентаризация планов: что из них уже в коде |
| [`contract-sync.js`](roo_code/workflows/contract-sync.js) | сверка API-контракта: аудит доменов → соглашения → написание → финал. Скил задачи — [`api-contract.md`](roo_code/skills/api-contract.md), план — [`contract-sync-plan.md`](roo_code/plans/api/contract-sync-plan.md) |

## MCP Servers

Configuration location depends on the client — there is no shared file.

- **Claude Code:** project-level `.mcp.json` in the repo root, or the `mcpServers` key in `~/.claude.json`. As of 2026-08-09 neither exists — no MCP servers are configured.
- **Roo Code (Windows machine only):** `C:/Users/great/AppData/Roaming/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`. The Linux equivalent would be `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/`, but that directory does not exist here — the extension is not installed on this machine.

## Skills and Claude Code

The skill files live in `roo_code/skills/` and are the single source of truth for both clients. Claude Code discovers them through symlinks: `.claude/skills/<name>/SKILL.md` → `../../../roo_code/skills/<name>.md`. Editing a file in `roo_code/skills/` updates both; a new skill needs a matching symlink created by hand.

The `arguments:` frontmatter block is Roo Code syntax. Claude Code ignores it and passes arguments through as free-form text, so a skill invoked as `/fix-bugs 1.1` receives `1.1` as a raw string.
