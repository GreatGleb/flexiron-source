---
description: Prompt for refining PHASE 4 in new chat session
---

# PHASE 4 Refinement - COMPLETE

## Summary

| Prompt | Lines | GLM-5 | Decision |
|--------|-------|-------|----------|
| 15a-1 | ~35 | Low | Split - simple data |
| 15a-2 | ~35 | Low | Split - complex data |
| 15b | ~35 | Low | Keep - mock data |
| 16 | ~30 | Low | Keep - validate |
| 17 | ~30 | Low | Keep - test data |

**Key Improvements:** Split by complexity, array/obj helpers validated, JSON structure patterns

---

## Original Prompt for New Chat

Use this prompt in a new chat to refine PHASE 4 of the page generation workflow.

---

## Prompt for New Chat

```
Refine PHASE 4 of the page generation workflow in `.windsurf/workflows/prompt-examples.md`.

PHASE 3 was refined with these changes:
- Split Prompt 13 into 13a (simple), 13b (helpers), 13c (nested partials)
- Split Prompt 14 into 14a (code validation), 14b (integration validation)
- Each prompt: ~35-40 lines, Low GLM-5 comfort
- Added prompt selection guide
- **CRITICAL LEARNING:** `array` and `obj` helpers are VALID (not forbidden)
- **CRITICAL LEARNING:** Check CSS classes via grep in demo/assets/css/
- **CRITICAL LEARNING:** Verify nested partials exist before using
- **CRITICAL LEARNING:** Category selection (ui/atoms/components/sections/tables/layout)

PHASE 4 current state (Prompts 15-17):
- Prompt 15: Data Structures
- Prompt 16: Validate Data
- Prompt 17: Mock Data

Tasks for PHASE 4:
1. Review current state of Prompts 15-17
2. Analyze each prompt for GLM-5 comfort (see methodology below)
3. YOU decide: split or keep based on analysis
4. If improvements needed, apply them directly
5. Update create-page.md if prompt numbers change

IMPORTANT: You make the decision about split/keep based on:
- Size analysis (target: 35-45 lines)
- Workload analysis (file reads, decisions)
- GLM-5 comfort level

Reference files:
- `.windsurf/workflows/prompt-examples.md` - main workflow file
- `.windsurf/workflows/create-page.md` - workflow description
- `.windsurf/workflows/PARTIAL_SPECS.md` - partial patterns

Goal: Ensure PHASE 4 prevents bugs, style inconsistencies, and design deviations.
```

---

## Methodology from PHASE 2-3 Work

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
3. If YES to both -> Keep, add safeguards if needed
4. If NO to either -> Split or enhance

### 5. Required Elements Checklist
For each prompt, verify:
- [ ] CRITICAL: Check .windsurf/workflows/PARTIAL_SPECS.md (if relevant)
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
| Instruction | ~20 lines | OK |
| Example | ~15 lines | OK |
| Total | ~35 lines | Optimal |

**Workload Analysis:**
- File reads: 2 (specs + directory)
- Items: 3-5 data structures
- Decisions: 2-3 per item

**GLM-5 Comfort:** Low (simple linear task)

**Decision:** Keep as is
```

---

## PHASE 3 Final Structure for Reference

| Prompt | Lines | GLM-5 | Decision |
|--------|-------|-------|----------|
| 13a | ~35 | Low | Split from 13 (simple) |
| 13b | ~40 | Low-Medium | Split from 13 (helpers) |
| 13c | ~35 | Low | Split from 13 (nested) |
| 14a | ~40 | Low | Split from 14 (code) |
| 14b | ~40 | Low | Split from 14 (integration) |

**Pattern:**
- Instruction: ~20 lines
- Example: ~15-20 lines
- Total: ~35-45 lines
- All have CRITICAL/VERIFY checks
- All have "DO NOT write code" (except code generation prompts)

---

## Common Data Issues to Prevent

| Problem | Solution |
|---------|----------|
| Missing data contract | Define before code |
| Wrong variable names | Match HTML IDs |
| Missing loading states | Define for each section |
| Missing error states | Define for each section |
| Missing empty states | Define for each section |
| API contract mismatch | Validate against backend |
| Data doesn't match partials | Cross-reference with Prompt 11 |
| Missing i18n data | Define translation keys |

---

## Connection to Previous Phases

PHASE 4 must connect to:
- **Prompt 5** (sections list) - data per section
- **Prompt 11** (partials spec) - data for each partial
- **Prompt 12** (validation) - match data structure

**Example:** If Prompt 11 defined `order-status-badge` with `status` param,
PHASE 4 must define data with `status` field.

---

## Real Examples from Codebase

**Valid data structure (from suppliers/card.html):**
```javascript
const supplierData = {
  id: 'SUP-001',
  name: 'Acme Corp',
  status: 'active', // matches custom-select options
  rating: 4, // matches rating-select
  tags: ['Electronics', 'Supplier'], // matches tag-input
  pricing: [
    { date: '2024-01', product: 'Widget', stock: 100 }
  ]
};
```

**Invalid data (common mistakes):**
```javascript
// WRONG: status doesn't match options
status: 'approved' // but options are: active, pending, inactive

// WRONG: rating is string instead of number
rating: '4' // should be: 4

// WRONG: tags is string instead of array
tags: 'Electronics, Supplier' // should be: ['Electronics', 'Supplier']
```

---

## Important Notes from PHASE 2-3 Work

**WARN vs Prohibition:**
- WARN messages are suggestions, NOT hard limits
- Example: "If N > 10: WARN" means "review if all needed"
- May be valid if functionality requires all items
- User should review and decide

**Model Autonomy:**
- YOU analyze each prompt
- YOU decide split vs keep
- YOU apply improvements directly
- Don't ask user for every decision
- Only ask if genuinely uncertain

**Pattern from PHASE 2-3:**
- Instruction: ~20 lines
- Example: ~15-20 lines
- Total: ~35-45 lines
- All have CRITICAL/VERIFY checks
- All have "DO NOT write code" (except code generation prompts)

**Specific improvements from PHASE 3:**
1. Split by complexity (simple vs helpers vs nested)
2. Add VERIFY checks for existence (files, partials, CSS)
3. Add Common errors section
4. Add Usage examples
5. Add NEXT STEPS for post-processing

**Helper validation (from PHASE 3):**
- Block helpers: times, lte, eq, concat
- Inline helpers: array, obj (for data structures)
- Both are VALID - do NOT mark as forbidden
