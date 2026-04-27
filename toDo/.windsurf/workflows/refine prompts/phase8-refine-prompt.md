---
description: Prompt for refining PHASE 8 (JS Implementation) in new chat session
---

# PHASE 8 Refinement - COMPLETE

## Summary

| Prompt | Lines | GLM-5 | Decision |
|--------|-------|-------|----------|
| 27 | ~50 | Medium | Keep per function |
| 28 | ~40 | Low | Keep - structure |
| 29 | ~40 | Low | Keep - validation |

**Key Improvements:** Structure template, async patterns, global functions, i18n check, z-index, toast patterns

---

## Original Objective

Analyze and refine PHASE 8 prompts (27-29) using the methodology from memory `fc71c6c9-707a-4019-b642-b5d9ff547f38`.

## Methodology

### 1. Size Analysis for GLM-5

For each prompt, count:
- Instruction lines
- Example lines
- Total lines

Target: **35-45 lines** per prompt
If >50 lines: consider split

### 2. Workload Analysis

- File reads needed (specs, directory, actual files)
- Items to process (functions, selectors, events)
- Decisions per item
- Context complexity: Low/Medium/High

### 3. GLM-5 Comfort Level

| Level | Criteria |
|-------|----------|
| Low | Single clear task, linear workflow, no branching |
| Medium | 2-3 file reads, multiple items, cross-reference |
| High | Many items, nested decisions, potential context overflow |

### 4. Decision Matrix

| Comfort | Action |
|---------|--------|
| Low | Keep as is |
| Medium | Keep, add safeguards |
| High | Split into 2-3 prompts |

### 5. Required Elements per Prompt

- CRITICAL: Reference existing JS patterns
- VERIFY: Check actual file/directory
- "DO NOT write code" (for spec prompts)
- MAX N lines limit
- Example output

---

## Current PHASE 8 Structure

### Prompt 27: Implement Single Function (~35 lines)

```
Implement function: [name]

Signature:
- [paste from Prompt 24]

Event map:
- [paste from Prompt 25]

Reference:
- demo/assets/js/admin/supplier_card_logic.js

Requirements:
- Use event delegation
- Add error handling
- Add loading states if async
- MAX 25 lines

Output: ONLY this function code.
```

**EXAMPLE OUTPUT for applyFilters():**
```js
function applyFilters() {
    const status = document.querySelector('#status-filter input[type="hidden"]')?.value || 'all';
    const dateFrom = document.querySelector('#date-from input[type="hidden"]')?.value || null;
    const dateTo = document.querySelector('#date-to input[type="hidden"]')?.value || null;
    
    filtersData.status = status;
    filtersData.dateFrom = dateFrom;
    filtersData.dateTo = dateTo;
    
    loadOrders(1, filtersData);
}
```

---

### Prompt 28: Assemble JS File (~10 lines)

```
ASSEMBLE orders_logic.js

Functions:
- [paste all functions]

Add:
- DOMContentLoaded wrapper
- Initial data load
- Export if needed

Output: Complete JS file.
```

---

### Prompt 29: Validate JS (~30 lines)

```
VALIDATE orders_logic.js:

1. Check selectors vs HTML:
   - querySelector('[selector]') -> exists?

2. Check event delegation:
   - data-action attributes match?

3. Run: gulp build

Output:
```
## VALIDATION RESULT

SELECTORS:
[ ] '[selector]': [found / NOT FOUND in HTML]

EVENT HANDLERS:
[ ] data-action="[value]": [matches / mismatch]

BUILD: [success / errors]

STATUS: [JS VALID / NEEDS FIX]
```
```

---

## Analysis Tasks

### Task 1: Size Analysis

| Prompt | Instructions | Example | Total | Target | Status |
|--------|-------------|---------|-------|--------|--------|
| 27 | ~18 | ~14 | ~32 | 35-45 | **BELOW** - needs async example |
| 28 | ~12 | 0 | ~12 | 35-45 | **CRITICAL** - too short, no example |
| 29 | ~10 | ~13 | ~23 | 35-45 | **BELOW** - needs invalid example |

### Task 2: Workload Analysis

**Prompt 27:**
- File reads: 1 (reference JS)
- Items: 1 function
- Decisions: event delegation, error handling, async/sync, loading states
- **Complexity: Medium** - requires understanding reference pattern

**Prompt 28:**
- File reads: 0
- Items: 5-15 functions
- Decisions: order, exports, wrapper structure
- **Complexity: Low-Medium** - simple assembly but needs structure knowledge

**Prompt 29:**
- File reads: 1 (HTML for selectors)
- Items: all selectors + event handlers
- Decisions: validation per item
- **Complexity: Medium** - multiple cross-checks

### Task 3: GLM-5 Comfort Level

| Prompt | Comfort | Reason |
|--------|---------|--------|
| 27 | **Medium** | 1 file read, pattern matching, multiple decisions |
| 28 | **Low** | Simple assembly, but lacks structure template |
| 29 | **Medium** | Cross-reference HTML vs JS, multiple items |

### Task 4: Identify Gaps

| Element | Prompt 27 | Prompt 28 | Prompt 29 |
|---------|-----------|-----------|-----------|
| CRITICAL reference | ✓ | ✗ | ✗ |
| VERIFY file check | ✗ | ✗ | ✓ |
| MAX lines limit | ✓ | ✗ | ✗ |
| Example output | ✓ | ✗ | ✓ |
| Common errors | ✗ | ✗ | ✗ |
| Alternative examples | ✗ | ✗ | ✗ |

### Task 5: Propose Improvements

**Prompt 27 improvements:**
1. Add VERIFY: Check reference file exists before implementation
2. Add async example: Function with loading state (fetch/timeout pattern)
3. Add common errors: Missing `?.`, wrong selector, missing `e.stopPropagation()`
4. Add event delegation example: Pattern with `data-action` attributes

**Prompt 28 improvements:**
1. Add CRITICAL: Reference existing JS file structure
2. Add VERIFY: Check all functions exist before assembly
3. Add MAX lines: Limit per assembled file
4. Add example output: Complete JS file structure template
5. Add global functions setup: `window.fnName` pattern for onclick handlers

**Prompt 29 improvements:**
1. Add CRITICAL: Reference HTML file path
2. Add invalid example: Selector NOT FOUND case
3. Add common errors: Typos in selectors, missing `data-action`, z-index conflicts
4. Add MAX lines: Validation output limit
5. Add i18n check: Verify `data-i18n` attributes

---

## Expected Output

After analysis, provide:

1. **Size Analysis Table** - with actual line counts ✓
2. **Workload Analysis** - for each prompt ✓
3. **GLM-5 Comfort Level** - with justification ✓
4. **Gap Analysis** - missing elements ✓
5. **Improvement Proposals** - specific changes ✓
6. **Final Structure** - if split/merge needed ✓

---

## Final Structure

### Final Optimized Prompts (9 total):

| Prompt | Content | Lines | GLM-5 |
|--------|---------|-------|-------|
| 27a | Sync functions (optional chaining, fallbacks) | ~40 | Low |
| 27b | Async functions (try/catch, loading states) | ~40 | Low |
| 27c-1 | Dropdowns (z-index, close others) | ~45 | Low |
| 27c-2 | Dynamic Elements (i18n, createElement) | ~40 | Low |
| 28a | Setup (staggered loading, DOM refs) | ~45 | Low |
| 28b-1 | Helpers & Global Functions | ~40 | Low |
| 28b-2 | Events & Init Calls | ~45 | Low |
| 29a | Validate Selectors & Functions | ~40 | Low |
| 29b | Validate Patterns & Safety | ~45 | Low |

**All prompts now within 35-45 lines target for GLM-5.**

### Applied Improvements:

**Prompt 27a (Sync Function):**
- Added CRITICAL reference
- Added VERIFY read reference file
- Added PATTERNS (4): optional chaining, early return, Array of IDs, classList.toggle
- Added COMMON ERRORS (6 items)
- Added 1 example
- MAX 20 lines output
- **Reduced from ~50 to ~40 lines**

**Prompt 27b (Async Function):**
- Added CRITICAL reference
- Added VERIFY read reference file
- Added PATTERNS (4): loading state, error handling, nested setTimeout, showToast
- Added COMMON ERRORS (5 items)
- Added 1 example
- MAX 25 lines output
- **Reduced from ~55 to ~40 lines**

**Prompt 27c-1 (Dropdown Component):**
- Added CRITICAL reference
- Added VERIFY read reference file
- Added PATTERNS (3): z-index, close others, panel z-index
- Added COMMON ERRORS (3 items)
- Added 1 example (dropdown with z-index)
- MAX 25 lines output

**Prompt 27c-2 (Dynamic Element):**
- Added CRITICAL reference
- Added VERIFY read reference file
- Added PATTERNS (5): i18n new elements, translation fallback, global functions, createElement+appendChild, container check
- Added COMMON ERRORS (4 items)
- Added 1 example
- MAX 25 lines output
- **Reduced from ~50 to ~40 lines**

**Prompt 28a (Setup):**
- Added CRITICAL reference
- Added VERIFY read reference file
- Added PATTERNS (3): staggered delay, hidden input, early null check
- Added COMMON ERRORS (4 items)
- Added 1 example
- Output: lines 1-30 only

**Prompt 28b-1 (Helpers & Global Functions):**
- Added CRITICAL reference
- Added VERIFY all functions exist
- Added PATTERNS (2): global function, helper
- Added COMMON ERRORS (2 items)
- Added 1 example
- MAX 50 lines
- **Split from 28b (~80 lines)**

**Prompt 28b-2 (Events & Init Calls):**
- Added CRITICAL reference
- Added VERIFY functions exist
- Added PATTERNS (3): event listener, init call, delayed init
- Added COMMON ERRORS (4 items)
- Added 1 example
- MAX 40 lines
- **Split from 28b (~80 lines)**

**Prompt 29a (Validate Selectors):**
- Added CRITICAL HTML file reference
- Added VERIFY read HTML file
- Added PATTERNS (3): grep HTML for id, grep HTML for class, grep JS for window
- Added COMMON ERRORS (3 items)
- Added 1 example
- MAX 20 lines output
- **Reduced from ~55 to ~40 lines**

**Prompt 29b (Validate Patterns):**
- Added CRITICAL reference file
- Added VERIFY read reference file
- Added PATTERNS (3): grep JS for translationEngine, checkDirty, setTimeout
- Added COMMON ERRORS (10 items)
- Added 1 example
- MAX 25 lines output
- **Reduced from ~60 to ~45 lines**

### Bug Prevention:

| Problem | Solution |
|---------|----------|
| Missing ?. on querySelector | Common errors list |
| Wrong selector | VERIFY read HTML |
| Missing e.stopPropagation() | Common errors list |
| No structure template | 14-section example output |
| Missing global functions | window.fnName pattern + validation |
| Missing i18n check | Added to validation |
| z-index conflicts | PATTERNS section + validation |
| Missing translationEngine check | PATTERNS section + validation |
| Forgetting translateNewElements | PATTERNS section + validation |
| Missing checkDirty() call | PATTERNS section + validation |
| Missing setTimeout captureState | Structure template + validation |
| Missing staggered loading | Structure template |
| Missing global click handler | Structure template |
| Missing opacity fix | Structure template |
| createElement without appendChild | PATTERNS section + validation |
| Missing DOM element references | Structure template + validation |
| Missing hidden inputs for state | Structure template + validation |
| Missing event listeners on .dirty-check | Structure template + validation |
| Race condition in classList.toggle | PATTERNS section + validation |
| Toast/notification memory leak | PATTERNS section + validation |
| Hardcoded loops instead of Array.forEach | PATTERNS section |
| Duplicate containers | PATTERNS section + validation |

---

## File Reference

- **Prompts file:** `.windsurf/workflows/prompt-examples.md` (lines 3374-3459)
- **Reference JS:** `demo/assets/js/admin/supplier_card_logic.js`
- **Methodology:** Memory `fc71c6c9-707a-4019-b642-b5d9ff547f38`
