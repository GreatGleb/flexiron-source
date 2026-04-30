---
name: add-bug
description: Record manually found bugs to the bugs file. Auto-trigger when user sends a bug list, describes UI issues, or pastes problems without explicit command. Plan ID inferred from context or asked once.
user_invocable: true
arguments:
  - name: plan
    description: "Plan file identifier, e.g. '1.1' → toDo/plans/bugs/1.1-products-bugs.md"
    required: true
---

# Add Bug — Record manual bug to file

User describes found bugs in free form. Task: format and write to bugs-file.

---

## Steps

**1. Determine bugs-file:**
- Find plan file: `toDo/plans/{plan}-*-plan.md` (e.g. `1.1-products-plan.md`)
- Bugs-file: same name, directory `toDo/plans/bugs/`, `-plan.md` → `-bugs.md`
- Read summary table → determine NEXT_BUG_ID

**2. Read user description:**
- User writes what they found — free form, any language
- If unclear: file, severity, or specific manifestation → ask one clarifying question (not multiple)

**3. Format and record bug:**

```markdown
## БАГ-[N] — [Short title]

**File:** `[file or component if known]`  
**Severity:** High / Medium / Low — [one phrase why]

### Problem

[What happens — specifically, as user sees the bug]

### Fix

[What needs to be done — if obvious from description; otherwise: "TBD"]

### Future rule

[How to avoid — if applicable; otherwise omit]
```

Add row to summary table at end of file:
```
| БАГ-[N] | [Type] | `[file]` | [Summary] |
```

**4. Confirm:**

```
✅ БАГ-[N] recorded in [path to bugs-file]
[Short title as confirmation]
```

---

## Bug types for table

| Type | When |
|---|---|
| Runtime | Behavioral error during operation |
| TypeScript | Type error |
| CSS | Visual error, incorrect styles |
| Design | Non-compliance with project design patterns |
| Mock data | Incorrect data in mock STORE |
| i18n | Translation issue |
| Code style | Code rule violation (comments, patterns) |
| UX | Inconvenient or unexpected user behavior |
