---
description: Prompt for refining PHASE 7 (Logic) in new chat session
---

# PHASE 7 Refinement - COMPLETE

## Summary

| Prompt | Lines | GLM-5 | Decision |
|--------|-------|-------|----------|
| 24 | ~50 | Medium | Keep + async rules |
| 25 | ~50 | Medium | Keep + delegation patterns |
| 26 | ~40 | Low | Keep + expanded validation |

**Key Improvements:** Async patterns, event delegation, selector validation, toast feedback

---

## Original Objective

Refine PHASE 7 prompts (24-26) for Logic specification to improve robustness and prevent bugs. Apply the same methodology established in PHASE 2-6.

## Current PHASE 7 Structure

### Prompt 24: Function Signatures (~50 lines)
- Defines function signatures for page logic
- Input: Interactions from Prompt 6
- Output: Function name, purpose, triggers, reads, modifies, returns, async

### Prompt 25: Event Map (~50 lines)
- Defines event bindings for page
- Input: Functions from Prompt 24
- Output: Event type, selector, handler, delegation, data source

### Prompt 26: Validate Logic Spec (~30 lines)
- Validates selectors exist in HTML
- Checks function count
- Checks event delegation

---

## COMPLETE Methodology (from PHASE 6 work)

### 1. Size Analysis for GLM-5
- Instruction lines: count
- Example lines: count
- Total: target 35-45 lines
- If >50 lines: consider split

### 2. Workload Analysis
- File reads needed (HTML for selectors, existing JS for patterns)
- Items to process (functions, events, selectors)
- Decisions per item
- Context complexity: Low/Medium/High

### 3. GLM-5 Comfort Level
- Low: Single clear task, linear workflow, no branching
- Medium: 2-3 file reads, multiple items, cross-reference
- High: Many items, nested decisions, potential context overflow

### 4. Decision Matrix
| Comfort | Action |
|---------|--------|
| Low | Keep as is |
| Medium | Keep, add safeguards |
| High | Split into 2-3 prompts |

### 5. Required Elements per Prompt
- CRITICAL: Check existing JS patterns
- VERIFY: Check selectors in HTML
- MAX N lines limit
- Example output
- COMMON ERRORS section

---

## Deep Conceptual Review (from PHASE 6)

For each prompt, think through:

### Reliability Questions
1. Can this prompt cause bugs? Which ones?
2. Are all required patterns explicitly stated?
3. Are all forbidden patterns explicitly forbidden?
4. Are there edge cases not covered?

### Style/Pattern Consistency
1. Does it reference real existing code patterns?
2. Does it enforce naming conventions?
3. Does it prevent common mistakes?

### Cross-Phase References
1. Does it reference correct input from previous phases?
2. Does it output correct format for next phases?
3. Are all referenced prompt numbers correct?

---

## JS Patterns to Enforce (from supplier_card_logic.js)

### Event Delegation Pattern
```js
document.addEventListener('click', (e) => {
    // Close all dropdowns
    document.querySelectorAll('.custom-select-list').forEach(l => l.classList.remove('open'));
});
```

### Loading States Pattern
```js
saveBtn.classList.add('loading');
// async operation
saveBtn.classList.remove('loading');
```

### Error Handling Pattern
```js
try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed');
    showToast(successMessage);
} catch (error) {
    showToast(errorMessage);
}
```

### Dirty Checking Pattern
```js
function checkDirty() {
    let isDirty = false;
    document.querySelectorAll('.dirty-check').forEach(input => {
        if (input.value !== initialState[input.id]) isDirty = true;
    });
    saveBtn.classList.toggle('dirty', isDirty);
}
```

### Z-Index Management Pattern
```js
wrap.style.zIndex = isOpen ? "9999" : "1";
if (wrap.closest('.glass-panel')) wrap.closest('.glass-panel').style.zIndex = isOpen ? "5000" : "1";
```

---

## Bug Prevention Checklist

### Common Bugs in Logic Layer
- [ ] Selector not found in HTML
- [ ] Wrong event type (click vs change)
- [ ] Missing event delegation
- [ ] Missing error handling in async functions
- [ ] Missing loading states
- [ ] Function does too many things (>25 lines)
- [ ] Missing data validation
- [ ] Wrong data attribute name (data-id vs data-value)
- [ ] Memory leaks (event listeners not cleaned)
- [ ] Race conditions in async code
- [ ] Missing toast feedback for user actions
- [ ] Missing z-index management for dropdowns

---

## Questions for Each Prompt

### Prompt 24: Function Signatures
1. Size: Instruction lines + Example lines = ?
2. Workload: How many functions to define? How many file reads?
3. GLM-5 Comfort: Low/Medium/High?
4. Missing safeguards for async functions?
5. Missing function size limit?
6. Need to split?

### Prompt 25: Event Map
1. Size: Instruction lines + Example lines = ?
2. Workload: How many events to define? How many file reads?
3. GLM-5 Comfort: Low/Medium/High?
4. Missing event delegation patterns?
5. Missing data attribute validation?
6. Need to split?

### Prompt 26: Validate Logic Spec
1. Size: Instruction lines + Example lines = ?
2. Workload: How many selectors to check? How many file reads?
3. GLM-5 Comfort: Low/Medium/High?
4. Missing validation checks?
5. Missing async pattern validation?
6. Need to split?

---

## Files to Reference

### For Analysis
- `.windsurf/workflows/prompt-examples.md` (lines 2830-2972) - Current PHASE 7 prompts
- `demo/assets/js/admin/supplier_card_logic.js` - Reference JS patterns
- `demo/panini/pages/suppliers/card.html` - Reference for selectors

### For Cross-Phase References
- Prompt 6: Interactions list
- Prompt 15b: Data selectors
- Prompt 21a/21b: HTML with IDs
- Prompt 27: JS Implementation

---

## Expected Output

### Analysis Table
| Prompt | Lines | Workload | GLM-5 | Decision |
|--------|-------|----------|-------|----------|
| 24 | ? | ? | ? | ? |
| 25 | ? | ? | ? | ? |
| 26 | ? | ? | ? | ? |

### Improved Prompts
- [ ] Prompt 24 with safeguards (async rules, size limits, error handling)
- [ ] Prompt 25 with safeguards (delegation patterns, selector validation)
- [ ] Prompt 26 with expanded validation (async patterns, toast feedback)
- [ ] Or split prompts if needed (24a/24b, 25a/25b, 26a/26b)

### Cross-Phase References Update
- Update references to Prompt 6 (Interactions)
- Update references to Prompt 15b (Data selectors)
- Update references to Prompt 21a/21b (HTML IDs)
- Update references to Prompt 27 (JS Implementation)

---

## Instructions for New Chat

1. Read `.windsurf/workflows/phase7-refine-prompt.md` (this file)
2. Read `.windsurf/workflows/prompt-examples.md` lines 2830-2972 (PHASE 7)
3. Read `demo/assets/js/admin/supplier_card_logic.js` for JS patterns
4. Analyze each prompt using the methodology above
5. Perform deep conceptual review for each prompt
6. Create improved prompts with safeguards
7. Update `prompt-examples.md` with improved prompts
8. Update `create-page.md` if prompt numbers change
