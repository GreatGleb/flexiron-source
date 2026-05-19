---
name: orchestrate
description: Orchestrator for full page implementation workflow. Auto-trigger when user mentions a page, section, or task continuation. Determines current state from files and transitions between skills automatically.
user_invocable: true
arguments:
  - name: id
    description: "Page identifier e.g. '1.2' → matches roo_code/plans/*/1.2-*-plan.md"
    required: false
---

# Orchestrate — Page Implementation Orchestrator

Knows the full algorithm and determines where to start from file state. Manages transitions BETWEEN skills only — does NOT manage stops inside skills.

---

## CRITICAL RULES

1. **State = files** — current stage determined only by files, not memory
2. **Resume without questions** — determine stage, explain to user, continue
3. **After skill completes → immediately announce next** without asking user
4. **Inline execution** — skills run in same context, not as sub-agents

---

## Step 0: Determine Plan ID & Current Stage

### Extract Plan ID

From user message:
- "create page 1.2" → id = "1.2"
- "continue products" → Glob `roo_code/plans/` → find file with "products" → extract id

If unclear → ask once: "Specify page ID (e.g. 1.2)"

### Determine current stage from files

Read in order, stop at first match:

```
1. roo_code/plans/*/{id}-*-plan.md DOES NOT exist
   → Stage: CREATE-PLAN

2. Plan exists, but src/views/admin/**/*Page.vue for this page DOES NOT exist
   → Stage: CREATE-PAGE (Phase 0)

3. Vue file exists, bugs-file roo_code/plans/bugs/{id}-*-bugs.md DOES NOT exist
   → Ask: "Page partially created or all Phase 0–9 complete?"
     - Not complete → Stage: CREATE-PAGE (continue from needed phase)
     - Complete → Stage: PRE-MANUAL-CHECK

4. Bugs-file exists, unfixed bugs (without ✅)
   → Stage: FIX-BUGS

5. All bugs ✅, test spec tests/e2e/admin/**/{domain}.spec.ts DOES NOT exist
   → Stage: PHASE-10

6. Spec exists, bugs have ✅ that haven't been through update-skills
   → Stage: UPDATE-SKILLS

7. All done
   → Report: "Page {id} fully complete"
```

### Announce to user

```
Page {id}: [NEW / resuming from stage X]
Starting: [current stage name]
```

---

## Execution Algorithm

Execute stages in order. After each skill completes → STOP, wait for confirmation before next skill.

Stop format (between skills):
```
⏸ STOP — [Skill] complete
[Brief summary: what was created/fixed]
Next: [next stage name]
Continue?
```

---

### Stage CREATE-PLAN

Execute skill `roo_code/skills/create-plan.md` fully.

After completion:
```
⏸ STOP — create-plan complete
Plan: roo_code/plans/*/{id}-*-plan.md
Next: create-page Phase 0–9
Continue?
```

---

### Stage CREATE-PAGE (Phase 0–9)

Execute `roo_code/skills/create-page.md` Phase 0–9.

Skill makes its own stops after each phase.

After Phase 9:
```
⏸ STOP — create-page Phase 0–9 complete
Next: pre-manual-check (20 automated checks)
Continue?
```

---

### Stage PRE-MANUAL-CHECK

Execute `roo_code/skills/pre-manual-check.md` fully.

After all 20 checks:
```
⏸ STOP — pre-manual-check complete
Issues written to bugs-file.
Next: manual testing — test UI and send bug list.
```
Wait for user's bug list.

---

### Bug cycle (repeats until fully closed)

```
LOOP:
  1. User sends bug list (any count)
     → add-bug auto-records all to bugs-file
     ⏸ STOP: "Recorded {N} bugs. Start fixing?"

  2. fix-bugs — fixes one per stop, marks ✅

  3. After all current bugs fixed:
     ⏸ STOP: "All bugs fixed ✅
              Found new bugs during testing?
              → Yes, here's the list: [...] → return to step 1
              → No → exit cycle, proceed to Phase 10"

REPEAT until user confirms "no new bugs"
```

---

### Stage PHASE-10

Execute `roo_code/skills/create-page.md` starting from Phase 10.

After completion:
```
⏸ STOP — Phase 10 complete
Playwright tests written and green ✅
Next: update-skills
Continue?
```

---

### Stage UPDATE-SKILLS

Execute `roo_code/skills/update-skills.md`.

After all bugs:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Page {id} fully complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
create-plan      ✅
create-page      ✅ Phase 0–9
pre-manual-check ✅
fix-bugs         ✅
Phase 10         ✅ Playwright tests
update-skills    ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
