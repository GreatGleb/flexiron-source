---
description: Prompt for refining PHASE 3 in new chat session
---

# PHASE 3 Refinement - COMPLETE

## Summary

| Prompt | Lines | GLM-5 | Decision |
|--------|-------|-------|----------|
| 13 | ~75 | Medium | Keep + 3 examples |
| 14 | ~100 | Medium | Keep + 3 examples |

**Key Improvements:** Category selection, VERIFY partial existence, CSS grep validation, helper validation

---

## Original Prompt for New Chat

Use this prompt in a new chat to refine PHASE 3 of the page generation workflow.

---

## Prompt for New Chat

```
Refine PHASE 3 of the page generation workflow in `.windsurf/workflows/prompt-examples.md`.

PHASE 2 was already refined with these changes:
- Split Prompt 10b into 10b-1 (UI) + 10b-2 (Container)
- Added PARTIAL CATEGORIES and DEPENDENCY CHECK to 10a
- Added VERIFY checks for file existence
- Added examples to all prompts
- All prompts: 35-45 lines total (instruction + example)
- All have "DO NOT write code" and MAX lines

PHASE 3 current state (Prompts 13-14) - ALREADY MODIFIED:
- Prompt 13: Create Single Partial (~40 lines WITH example)
- Prompt 14: Validate New Partial (~35 lines WITH example)

Tasks for PHASE 3:
1. Review current state of Prompts 13-14
2. Analyze each prompt for GLM-5 comfort (see methodology below)
3. YOU decide: split or keep based on analysis
4. If improvements needed, apply them directly
5. Update create-page.md if prompt numbers change

IMPORTANT: You make the decision about split/keep based on:
- Size analysis (target: 35-45 lines)
- Workload analysis (file reads, decisions)
- GLM-5 comfort level

Reference files:
- `.windsurf/workflows/prompt-examples.md` - main workflow file (lines 763-850)
- `.windsurf/workflows/create-page.md` - workflow description
- `.windsurf/workflows/PARTIAL_SPECS.md` - partial patterns

Goal: Ensure PHASE 3 prevents bugs, style inconsistencies, and design deviations.
```

---

## Methodology from PHASE 2 Work

**GLM-5 Analysis Framework:**

### 1. Size Analysis
Count lines in each prompt:
- Instruction lines: [count]
- Example lines: [count]
- Total: [count]

**Target: 35-45 lines total**
- If <30: Too short, may need more detail
- If 35-45: Optimal for GLM-5
- If >50: Consider split

### 2. Workload Analysis
- File reads needed: [specs, directory, actual files]
- Items to process: [sections, partials, params]
- Decisions per item: [count]
- Context complexity: Low/Medium/High

### 3. GLM-5 Comfort Level
| Level | Characteristics | Action |
|-------|-----------------|--------|
| Low | Single clear task, linear workflow, no branching | Keep as is |
| Medium | 2-3 file reads, multiple items, cross-reference | Keep, add safeguards |
| High | Many items, nested decisions, potential context overflow | Split into 2-3 prompts |

### 4. Decision Process
After analysis, YOU decide:
1. Is prompt size optimal? (35-45 lines)
2. Is GLM-5 comfort acceptable? (Low/Medium)
3. If YES to both → Keep, add safeguards if needed
4. If NO to either → Split or enhance

### 5. Required Elements Checklist
For each prompt, verify:
- [ ] CRITICAL: Check .windsurf/workflows/PARTIAL_SPECS.md
- [ ] VERIFY: Check actual file/directory
- [ ] "DO NOT write code" (for spec prompts)
- [ ] MAX N lines limit
- [ ] Example output

### Example Analysis Format
```
### Prompt X: [Name]

**Size Analysis:**
| Metric | Value | Assessment |
|--------|-------|------------|
| Instruction | ~20 lines | ✅ OK |
| Example | ~15 lines | ✅ OK |
| Total | ~35 lines | ✅ Optimal |

**Workload Analysis:**
- File reads: 2 (specs + directory)
- Items: 3-5 partials
- Decisions: 2-3 per item

**GLM-5 Comfort:** 🟢 Low (simple linear task)

**Decision:** ✅ Keep as is
```

---

## PHASE 2 Final Structure for Reference

| Prompt | Lines | GLM-5 | Decision |
|--------|-------|-------|----------|
| 10a | ~40 | Medium | Keep + safeguards |
| 10b-1 | ~38 | Medium | Split from 10b |
| 10b-2 | ~38 | Medium | Split from 10b |
| 11 | ~38 | Medium | Keep + safeguards |
| 12 | ~42 | Medium | Keep + safeguards |

**Pattern:**
- Instruction: ~20 lines
- Example: ~15-20 lines
- Total: ~35-45 lines
- All have CRITICAL/VERIFY checks
- All have "DO NOT write code" (except code generation prompts)

---

## Current PHASE 3 State (Already Modified)

**Prompt 13 (Create Single Partial) - Current:**
- ✅ Has example HTML output
- ✅ Has CRITICAL: Read reference partial
- ✅ Has VERIFY: Read "Similar to" file
- ✅ Connected to Prompt 11's "Similar to" field
- Size: ~40 lines total

**Prompt 14 (Validate New Partial) - Current:**
- ✅ Has example output
- ✅ Has "DO NOT write code"
- ✅ Has MAX 15 lines limit
- ✅ Has input reference from Prompt 13
- Size: ~35 lines total

**Your Task:**
1. Verify these improvements are correct
2. Check if further improvements needed
3. Apply any additional safeguards

## Potential Additional Improvements

**Prompt 13:**
- Add more detailed HTML example with multiple params?
- Add helper usage examples (times, lte)?

**Prompt 14:**
- Add gulp build error examples?
- Add common issues checklist?

---

## Bug Prevention Mechanisms

| Problem | Solution | Status |
|---------|----------|--------|
| Wrong style reference | VERIFY read "Similar to" file | ✅ Added |
| Missing example | Add HTML example | ✅ Added |
| Inconsistent validation | Add checklist example | ✅ Added |
| No connection to PHASE 2 | Use "Similar to" from Prompt 11 | ✅ Added |

## Important Notes from PHASE 2 Work

**WARN vs Prohibition:**
- WARN messages are suggestions, NOT hard limits
- Example: "If N > 10: WARN" means "review if all needed"
- May be valid if functionality requires all items
- User should review and decide

**Example of WARN Logic:**
```
N > 10 → WARN → Check: really needed?
         ↓
    Yes, all needed → OK, keep all
    No, some extra → Simplify
```

**Model Autonomy:**
- YOU analyze each prompt
- YOU decide split vs keep
- YOU apply improvements directly
- Don't ask user for every decision
- Only ask if genuinely uncertain

**Pattern from PHASE 2:**
- Instruction: ~20 lines
- Example: ~15-20 lines
- Total: ~35-45 lines
- All have CRITICAL/VERIFY checks
- All have "DO NOT write code" (except code generation prompts)
