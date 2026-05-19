# Flexiron Enterprise — Roo Code Instructions

## 🔴 CRITICAL: Roo Code workspace rules (NON-NEGOTIABLE)

### 1. All Roo Code files go to `roo_code/`
Any new file created for Roo Code workflow, skills, plans, or process improvements — MUST be placed in `roo_code/` directory. NOT in root.

- Skills → `roo_code/skills/`
- Plans → `roo_code/plans/` — **NEVER create plans in the root directory (`./`). All plans go here.**
- Context → `roo_code/roo-context/`

> ⚠️ **Plan creation rule:** When creating a new plan file (`.md`, `.txt`, or any other format), it MUST be placed under `roo_code/plans/<domain>/`. Creating plan files in the root directory (`./plan.md`, `./plan.txt`, etc.) is strictly forbidden. If you catch yourself about to write a plan to the root — STOP and redirect to `roo_code/plans/`.

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

### 3. These rules are ALWAYS in effect
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

## Project Context

### Tech Stack
- **Frontend:** Vue 3 (Composition API, `<script setup>`), Vite, Vue Router, Pinia
- **Styling:** Custom CSS (no Tailwind), scoped styles in `.vue` files
- **i18n:** Custom i18n system (`src/i18n/`)
- **Testing:** Playwright for e2e tests
- **Backend:** Not in this repo (API contract in `toDo/admin-api-contract.md`)

### Key Directories
- `frontend_vue/src/` — main source code
- `frontend_vue/src/views/` — page components (admin/ and public/)
- `frontend_vue/src/composables/` — reusable logic
- `frontend_vue/src/types/` — TypeScript type definitions
- `frontend_vue/src/i18n/` — translations
- `frontend_vue/src/styles/` — CSS files
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

This directory contains 9 skill files. **Every session starts with awareness of these skills.** When a task matches a skill's purpose — read and follow that skill. Do not wait to be told.

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
| Running full verification (typecheck + lint + integrity checks) | **verify** — runs checklist and reports results | [`verify.md`](roo_code/skills/verify.md) |
| Writing Vue 3 code, adding `:class` bindings, editing mocks, building forms, adding pages/components, refactoring, choosing HTTP methods, debugging CSS/reactivity | **vue-rules** — 33 pitfalls + save UX + HTTP methods + contract-first rules | [`vue-rules.md`](roo_code/skills/vue-rules.md) |

---

## When to Use Skills — Detailed Guidance

### 🔴 ALWAYS read the relevant skill when:

1. **Starting any page implementation** → read [`orchestrate.md`](roo_code/skills/orchestrate.md) first, then [`create-page.md`](roo_code/skills/create-page.md) and [`vue-rules.md`](roo_code/skills/vue-rules.md)
2. **Writing any plan** → read [`create-plan.md`](roo_code/skills/create-plan.md) and [`create-page.md`](roo_code/skills/create-page.md) completely
3. **Fixing any bug** → read [`fix-bugs.md`](roo_code/skills/fix-bugs.md) before touching code
4. **Before manual testing** → read [`pre-manual-check.md`](roo_code/skills/pre-manual-check.md)
5. **After fixing bugs** → read [`update-skills.md`](roo_code/skills/update-skills.md)
6. **Writing any Vue code** → read [`vue-rules.md`](roo_code/skills/vue-rules.md) — especially pitfalls #1–#33
7. **Running verification** → read [`verify.md`](roo_code/skills/verify.md)

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
| `/verify` | [`verify.md`](roo_code/skills/verify.md) | Run verification checklist (typecheck + lint + integrity checks) |
| `/vue-rules` | [`vue-rules.md`](roo_code/skills/vue-rules.md) | Vue 3 pitfalls and rules (33 pitfalls) |

## MCP Servers

MCP server configuration is in:
`C:/Users/great/AppData/Roaming/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`
