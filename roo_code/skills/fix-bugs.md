---
name: fix-bugs
description: Fix bugs from the bugs file one at a time. Each bug: read → verify → plan → fix → verify cycle (up to 5 iterations) → mark ✅. Never self-approves verification.
user_invocable: true
arguments:
  - name: plan
    description: "Plan file identifier, e.g. '1.1' → toDo/plans/bugs/1.1-products-bugs.md"
    required: true
  - name: bug
    description: "Optional: specific bug ID, e.g. 'БАГ-13'. If omitted — show list and let user choose."
    required: false
---

# Fix Bugs — Bug fixing workflow

One bug = one complete cycle. Each step fully before next.

---

## CRITICAL RULES

1. **Read before touch** — read ENTIRE file before editing, not just the bug line
2. **Verify the problem exists** — Grep or Read proves problem is there BEFORE changing anything
3. **Plan before edit** — describe what will change and why, before opening Edit
4. **Minimal change** — change exactly what's needed. No refactoring around, no "while we're at it"
5. **Check callers** — if changing public API (function, prop, type) → grep all consumers
6. **Min 2 stops per bug** — STOP-1 (after fix) + STOP-2 (result). Verification cycle max 5 iterations.
7. **Mark ✅ only after verification cycle complete** — not after fix, not "probably passes"
8. **Never self-approve** — after fix, don't proceed to verification without user confirmation
9. **Stop on each error iteration** — found errors in cycle → show errors → ask confirmation → only then fix
10. **NEVER use `git restore` or `git checkout` on tracked files** — these permanently destroy uncommitted changes. Use `git show HEAD:<path>` to read committed version, then manually apply only needed parts. If uncommitted changes were destroyed, use `git reflog` + `git show` before any further writes.

---

## Step 0: Initialization (once)

```
1. Determine bugs-file:
   - Find toDo/plans/{plan}-*-plan.md (e.g. 1.1-products-plan.md)
   - Bugs-file: same prefix, directory toDo/plans/bugs/, suffix -bugs.md
   - Example: "1.1" → toDo/plans/bugs/1.1-products-bugs.md

2. Read bugs-file entirely

3. List unfixed bugs:
   - "## БАГ-N" without "✅" → unfixed
   - "## ✅ БАГ-N" → already fixed, skip
   - "## PAT-N" → pattern, not code — skip unless explicitly specified

4. If bug argument specified → go directly to it
   If not → show list (format below) and wait for user choice
```

**List format:**
```
Unfixed bugs — {BUGS_FILE}:

  БАГ-01 [Type] — summary
  БАГ-05 [Runtime] — summary
  ...

Already fixed: ✅ БАГ-03, ✅ БАГ-07
PAT-* (patterns, not code): PAT-01, PAT-02

Which to start with? (or "all in order")
```

---

## Single bug fix cycle

---

### Step A — Read and understand bug fully

1. Read bug section in bugs-file:
   - `**File:**` — affected files list
   - `**Severity:**` — priority and context
   - `### Problem` — what happens, why it's a bug
   - `### Fix` — what's written as solution (may be "TBD")

2. Read EACH file from `**File:**` entirely (not just the bug line):
   - Understand structure around problem area
   - Find all places where problem may manifest

3. If `### Fix` = "TBD" or incomplete:
   - Study problem from `### Problem`
   - Formulate fix plan and SHOW to user before applying
   - Wait for confirmation

---

### Step B — Verify the problem

Before any edit — prove problem exists:

- **CSS class missing** → Grep class in component's imported files → confirm not found
- **Wrong type** → Read file → find bug line
- **Logic error** → Read function → trace value through code
- **Mock data** → Read STORE → verify missing field
- **Wrong route name** → Grep name in router/index.ts → confirm mismatch

If problem NOT reproducible (already fixed):
```
Problem from БАГ-N not reproducible in current code.
Possibly fixed in another session.
Mark ✅ without changes?
```

---

### Step C — Plan the fix

Before opening Edit — describe plan:

```
File: src/...
Line ~N: [what's there] → [what it becomes]
Reason: [why this solves the problem]
Side effects: [none / or: check X]
```

If fix affects public API (export, prop, type):
- Grep all consumers (components, composables, tests)
- List in plan which other files need changes

---

### Step D — Apply fix

Edit rules:
- Change exactly what's described in plan
- Don't touch adjacent code (formatting, order, style) unless related to bug
- If bug in multiple files → fix all within this step

After edit — read changed fragment again and verify it looks correct.

---

### STOP-1 — After fix applied

Announce to user and request confirmation to start verification:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
БАГ-[N] — [title] — fix applied
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changes:
  [file] line ~N: [what was] → [what became]

Ready to start verification cycle (bug fixed? → TZ → patterns, up to 5 iterations).
Start?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Wait for confirmation. Do not start verification until user responds.**

---

### Step E — Verification cycle (up to 5 iterations)

Starts only after user confirmation on STOP-1.

**Each iteration — 3 levels by priority:**

---

**Level 1 — Bug fixed? (main check)**

Read changed files and `### Problem` section.
Ask: _is this specific behavior now impossible?_

- CSS bug → find class in file → verify rule applies to correct selector
- JS/TS bug → trace logic from problem source to result
- Mock bug → read STORE → verify field now exists and is correct
- Component bug → find in template/script → verify fix is active

If bug **NOT fixed** — find reason and describe in iteration STOP.

---

**Level 2 — TZ compliance**

Check against `### Fix` in bugs-file:
- All fix points implemented?
- Nothing missed from description?

---

**Level 3 — Project patterns**

Verify fix doesn't violate rules from `frontend_vue/CLAUDE.md` and `roo_code/skills/vue-rules.md`:
- Correct component usage?
- No forbidden patterns (HTML comments, span instead of input, router.back() etc.)?

---

**After all 3 levels:**

- **Clean** → exit cycle → go to Step F
- **Problems found, iteration < 5** → STOP-iteration → wait for confirmation → fix → counter +1 → repeat
- **Iteration = 5, problems remain** → exit cycle → Step F → in STOP-2 indicate limit

**STOP-iteration format (when problems found):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Iteration [N]/5 — problems found
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Level 1 / 2 / 3]:
  [problem description]
  [what's wrong: file, line, reason]

Will fix: [plan in one line]
Continue?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Step F — Check adjacent code (if needed)

Only for CSS, Design, Runtime bug types — quick check that fix didn't break neighbors:

- **CSS bug** → Grep changed class across other components → didn't break globally?
- **Runtime bug in composable** → Grep function across views → all callers get what they expect?
- **Mock bug** → Grep changed ID/field → didn't break other mock functions?

If nothing adjacent — skip this step.

---

### Step G — Mark ✅ in bugs-file

Two changes in bugs-file:

**1. Bug section header:**
```
## БАГ-N — [title]
         ↓
## ✅ БАГ-N — [title]
```

**2. Summary table row:**
```
| БАГ-N | Type | file | summary |
         ↓
| ✅ БАГ-N | Type | file | summary |
```

---

### STOP-2 — format after verification cycle

**If verification passed (0 errors):**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ БАГ-[N] fixed — [title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changes:
  [file] line ~N: [what was] → [what became]

Verification (iteration [X]/5): ✅ clean

Remaining unfixed: [N]
  [list of remaining with brief description]

Next: БАГ-[N+1] — [summary]
Fix?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**If limit 5 iterations reached and errors remain:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ БАГ-[N] — verification limit reached (5/5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Changes applied, but verification errors remain (5/5):
  [list remaining errors briefly]

Recommendation: [what to try manually]

Remaining unfixed: [N]
  [list]

Next: БАГ-[N+1] — [summary]
Continue?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Completion

After all bugs closed — run typecheck + lint once:

```bash
cd frontend_vue && npm run typecheck && npm run lint
```

**If errors found:**
- Read each error
- Determine which file and if related to fixed bugs
- Fix — same rules: Read → plan → Edit → read result
- Re-run until 0 errors
- If error clearly unrelated to fixed bugs — report to user separately, don't fix silently

**If no errors:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All bugs fixed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fixed this session: [N]
  ✅ БАГ-N — title
  ✅ БАГ-N — title
  ...

typecheck: ✅ 0 errors
lint:      ✅ 0 errors

Bugs-file: [path]

Next step: manual testing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Special cases

### Fixing "TBD"
`### Fix` is "TBD" → study `### Problem` → formulate fix → **show user and wait for confirmation** before editing.

### Multiple files in one bug
Fix all within one cycle → one ✅ mark.

### PAT-* (patterns)
Patterns describe future rules — don't require code changes. Skip automatically. If user specified PAT-N explicitly — explain: "This is a pattern, not a bug. Code intentionally unchanged."

### Bug in multiple unrelated places
If `**File:**` contains files with unrelated logic (e.g. composable AND CSS) — fix both in one cycle, one ✅ mark.

### Regression after final typecheck
If typecheck + lint in Completion shows errors in files NOT from fixed bugs:
- Read errors
- If related to any fix → fix
- If unrelated → report to user separately, don't fix silently
