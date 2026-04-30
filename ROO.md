# InBox LT — Roo Code Instructions

## 🔴 CRITICAL: Roo Code workspace rules (NON-NEGOTIABLE)

### 1. All Roo Code files go to `roo_code/`
Any new file created for Roo Code workflow, skills, plans, or process improvements — MUST be placed in `roo_code/` directory. NOT in root.

- Skills → `roo_code/skills/`
- Plans → `roo_code/plans/`
- Context → `roo_code/roo-context/`

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

## Skills & Orchestration

### Orchestrator (main — run this first)
When user mentions a page, bugs, work stage, section, or task continuation — **IMMEDIATELY**:
1. Read `roo_code/skills/orchestrate.md`
2. Determine Plan ID and current stage from files
3. Announce stage to user and continue

**Do NOT wait for commands. Do NOT respond "waiting for list" without starting orchestrator.**

### Individual Skills
- `/create-plan` — [`roo_code/skills/create-plan.md`](roo_code/skills/create-plan.md) — writes page implementation plan
- `/create-page` — [`roo_code/skills/create-page.md`](roo_code/skills/create-page.md) — executes plan phase by phase (11 phases, 0–10)
- `/pre-manual-check <plan>` — [`roo_code/skills/pre-manual-check.md`](roo_code/skills/pre-manual-check.md) — 8 grouped check categories before manual test
- `add-bug` — [`roo_code/skills/add-bug.md`](roo_code/skills/add-bug.md) — auto-trigger when user sends bug list
- `/fix-bugs <plan> [bug]` — [`roo_code/skills/fix-bugs.md`](roo_code/skills/fix-bugs.md) — fix bugs from file, max 5 verification iterations per bug
- `/update-skills <plan>` — [`roo_code/skills/update-skills.md`](roo_code/skills/update-skills.md) — for each ✅ bug find root cause → add to skills
- `/verify` — [`roo_code/skills/verify.md`](roo_code/skills/verify.md) — run verification checklist (typecheck + lint + integrity checks)
- `/vue-rules` — [`roo_code/skills/vue-rules.md`](roo_code/skills/vue-rules.md) — Vue 3 pitfalls and rules (33 pitfalls)

## MCP Servers

MCP server configuration is in:
`C:/Users/great/AppData/Roaming/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`
