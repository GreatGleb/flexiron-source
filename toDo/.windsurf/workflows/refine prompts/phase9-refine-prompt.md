---
description: Prompt for refining PHASE 9 (CSS Styles) in new chat session
---

# PHASE 9 Refinement - COMPLETE

## Summary

| Prompt | Lines | GLM-5 | Decision |
|--------|-------|-------|----------|
| 30a | ~35 | Low | Split - layout |
| 30b | ~35 | Low | Split - components |
| 31a | ~35 | Low | Split - buttons |
| 31b | ~35 | Low | Split - states |
| 32 | ~35 | Low | Keep - variables |
| 33 | ~40 | Low | Keep - validation |

**Key Improvements:** Split into 7 prompts, real CSS variables, design patterns, z-index, animations

---

## Original Objective

Analyze and refine PHASE 9 prompts (30-33) using the methodology from memory `fc71c6c9-707a-4019-b642-b5d9ff547f38`.

## Methodology

### 1. Size Analysis for GLM-5

For each prompt, count:
- Instruction lines
- Example lines
- Total lines

Target: **35-45 lines** per prompt
If >50 lines: consider split

### 2. Workload Analysis

- File reads needed (HTML, CSS files, variables)
- Items to process (classes, variables, responsive rules)
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

- CRITICAL: Reference existing CSS variables
- VERIFY: Check actual CSS files
- MAX lines limit
- Example output

---

## Current PHASE 9 Prompts

### Prompt 30: List CSS Needs

**Current size:** ~30 lines (instructions + example)

**Workload:**
- Read: orders.html (scan classes)
- Read: base-layout.css, main.css (check existing)
- Output: REUSE vs NEW classification

**GLM-5 Comfort:** Low

**Gap Analysis:**
| Element | Present | Missing |
|---------|---------|---------|
| CRITICAL reference | - | variables.css |
| VERIFY check | - | grep CSS files |
| MAX lines limit | + | - |
| Example output | + | - |
| Common errors | - | - |

---

### Prompt 31: Create CSS Block

**Current size:** ~20 lines (instructions + example)

**Workload:**
- Read: _variables.css (CSS vars)
- Output: Single CSS block

**GLM-5 Comfort:** Low

**Gap Analysis:**
| Element | Present | Missing |
|---------|---------|---------|
| CRITICAL reference | + | - |
| VERIFY check | - | - |
| MAX lines limit | + | - |
| Example output | + | - |
| Common errors | - | - |
| Responsive pattern | - | - |

---

### Prompt 32: Assemble CSS File

**Current size:** ~10 lines (instructions only)

**Workload:**
- Input: All CSS blocks
- Output: Complete CSS file with header

**GLM-5 Comfort:** Low

**Gap Analysis:**
| Element | Present | Missing |
|---------|---------|---------|
| CRITICAL reference | - | - |
| VERIFY check | - | - |
| MAX lines limit | - | - |
| Example output | - | - |
| Common errors | - | - |

---

### Prompt 33: Validate CSS

**Current size:** ~25 lines (instructions + output format)

**Workload:**
- Read: orders.html (class usage)
- Read: _variables.css (variable definitions)
- Run: gulp build

**GLM-5 Comfort:** Low

**Gap Analysis:**
| Element | Present | Missing |
|---------|---------|---------|
| CRITICAL reference | - | - |
| VERIFY check | + | - |
| MAX lines limit | - | - |
| Example output | + | - |
| Common errors | - | - |

---

## Tasks

### Task 1: Size Analysis

| Prompt | Instructions | Example | Total | Status |
|--------|--------------|---------|-------|--------|
| 30 | ~15 | ~15 | ~30 | OK |
| 31 | ~15 | ~10 | ~25 | OK |
| 32 | ~5 | 0 | ~5 | Too small |
| 33 | ~15 | ~10 | ~25 | OK |

### Task 2: Workload Analysis

| Prompt | File Reads | Items | Decisions | Complexity |
|--------|------------|-------|-----------|------------|
| 30 | 3 (HTML + 2 CSS) | Many classes | Low | Low |
| 31 | 1 (variables) | 1 class | Low | Low |
| 32 | 0 | All blocks | Low | Low |
| 33 | 2 (HTML + vars) | Many classes | Low | Low |

### Task 3: GLM-5 Comfort Level

All prompts: **Low** comfort level.

### Task 4: Propose Improvements

**Prompt 30 improvements:**
1. Add CRITICAL: Reference _variables.css for CSS vars
2. Add VERIFY: grep existing CSS files for class existence
3. Add COMMON ERRORS: Missing responsive, wrong variable name

**Prompt 31 improvements:**
1. Add VERIFY: Check variable exists in _variables.css
2. Add COMMON ERRORS: Hardcoded values, missing responsive
3. Add PATTERNS: Mobile-first, CSS variables usage

**Prompt 32 improvements:**
1. Add example output with header comment
2. Add COMMON ERRORS: Missing header, wrong order
3. Expand to ~20-25 lines

**Prompt 33 improvements:**
1. Add CRITICAL: Reference _variables.css
2. Add COMMON ERRORS: Unused class, undefined variable
3. Add example output (valid + invalid)

### Task 5: Final Structure

**No split needed** - all prompts within acceptable range after improvements.

| Prompt | Current | After Improvements | Action |
|--------|---------|---------------------|--------|
| 30 | ~30 | ~40 | Add CRITICAL, VERIFY, COMMON ERRORS |
| 31 | ~25 | ~45 | Add VERIFY, COMMON ERRORS, PATTERNS, error examples |
| 32 | ~5 | ~30 | Add example, COMMON ERRORS, file header pattern |
| 33 | ~25 | ~45 | Add CRITICAL, COMMON ERRORS, 2 examples (valid/invalid) |

---

## CRITICAL BUGS FOUND (Second Pass)

### Bug 1: NON-EXISTENT CSS Variables in Examples
**Problem:** Examples used `--spacing-lg`, `--spacing-md`, `--color-white` which DON'T EXIST in `_variables.css`

**Real Variables:**
```css
--primary, --primary-dark, --danger
--sidebar-w, --header-h
--glass-light, --glass-border, --glass-glow
--text, --text-dim, --text-nav
```

**Impact:** GLM-5 would generate CSS with undefined variables -> broken styles

### Bug 2: Missing Breakpoints
**Problem:** Only mentioned 992px, but project uses:
- 1200px: intermediate 2-column
- 992px: mobile stacking
- 600px: button stacking

### Bug 3: Wrong CSS Patterns
**Problem:** Indicated patterns like `--color-*`, `--spacing-*`, `--radius-*` don't exist
**Real patterns:** gap: 12px/16px/24px, backdrop-filter: blur(28px)

### Bug 4: Missing File Checks
**Problem:** Prompt 32 didn't check if file already exists (overwrite risk)

---

## Improvements Applied (Final)

### Prompt 30: List CSS Needs
- **FIXED:** Added REAL variable list from `_variables.css`
- **FIXED:** Note that `--spacing-*`, `--color-*`, `--radius-*` DON'T EXIST
- **FIXED:** All 3 breakpoints (1200px/992px/600px)
- **FIXED:** Example uses hardcoded values, not fake variables
- Added VERIFY: grep each class before marking as NEW
- Added COMMON ERRORS with real examples

### Prompt 31: Create CSS Block
- **FIXED:** REAL variable list in CRITICAL section
- **FIXED:** WARNING about non-existent variables
- **FIXED:** PATTERNS from actual CSS (gap: 12/16/24px, backdrop-filter)
- **FIXED:** All 3 breakpoints
- **FIXED:** Examples use hardcoded values (24px, 12px) not fake variables
- **FIXED:** COMMON ERRORS show WRONG vs CORRECT with real examples

### Prompt 32: Assemble CSS File
- **FIXED:** VERIFY 2: Check file doesn't exist (avoid overwrite)
- **FIXED:** Note: NO @import needed (already in base-layout.css)
- **FIXED:** Example uses hardcoded values
- Added COMMON ERRORS: non-existent variables, file overwrite

### Prompt 33: Validate CSS
- **FIXED:** REAL variable list in CRITICAL section
- **FIXED:** Note about non-existent variables
- **FIXED:** DESIGN PATTERNS validation (gap values, glass effect)
- **FIXED:** Examples show REAL validation (not fake --spacing-lg)
- Added all 3 breakpoints in RESPONSIVE check
- Added DESIGN PATTERNS section in output

---

## Bug Prevention Mechanisms (Final)

| Problem | Solution |
|---------|----------|
| Using non-existent variable (--spacing-lg) | CRITICAL: REAL variable list + WARNING |
| Using non-existent variable (--color-white) | COMMON ERRORS: use #fff or rgba() |
| Wrong breakpoint (768px) | BREAKPOINTS: 1200px/992px/600px |
| Arbitrary gap values (13px, 17px) | DESIGN PATTERNS: 12/16/24px only |
| Missing backdrop-filter for glass | DESIGN PATTERNS validation |
| Marking existing class as NEW | VERIFY grep before marking |
| Overwriting existing CSS file | VERIFY 2: file doesn't exist |
| Missing responsive for layout | RESPONSIVE validation |
| Unused CSS class | VERIFY grep in HTML |
| Missing file header | COMMON ERRORS + example |

---

---

## Final Edge Cases (Fourth Pass)

### Additional Bugs Found:

| Bug | Prompt | Impact | Fix |
|-----|--------|--------|-----|
| Missing button variants | 30 | Creating .btn-submit duplicate | Added EXISTING BUTTON VARIANTS section |
| Missing state classes | 30 | Creating .loading-spinner | Added STATE CLASSES section |
| Missing form patterns | 30 | Creating .input-field | Added FORM PATTERNS section |
| Missing animation keyframes | 31 | Creating new @keyframes spin | Added Animations section |
| Missing hover patterns | 31 | Missing :hover or wrong translateY | Added Hover Effects section |
| VERIFY 3 only main.css | 32 | Missing duplicates in components | Added components/_*.css check |
| Missing gulp build note | 32 | CSS not included in build | Added gulp build note |
| Missing animation validation | 33 | Using undefined animation | Added Check animations |
| Missing hover validation | 33 | Missing :hover state | Added Check hover states |
| Missing state class validation | 33 | Using undefined .loading | Added Check state classes |

### Final Edge Case Protection:

**Prompt 30:**
- EXISTING BUTTON VARIANTS: .btn-save, .btn-secondary, .btn-primary, .btn-text, .btn-sm, .btn-icon
- STATE CLASSES: .loading, .active, .open, .dirty
- FORM PATTERNS: .glass-input, .field-label, .input-group

**Prompt 31:**
- Animations: spin, skeleton-loading, select-open (use existing)
- Hover Effects: translateY(-1px), scale(1.1), background changes

**Prompt 32:**
- VERIFY 3: grep in main.css AND components/_*.css
- Gulp build: file auto-included via gulp

**Prompt 33:**
- Check animations: @keyframes must exist in main.css
- Check hover states: interactive elements need :hover
- Check state classes: .loading/.active/.open must exist

---

## Deep Analysis (Third Pass)

### Additional Bugs Found:

| Bug | Prompt | Impact | Fix |
|-----|--------|--------|-----|
| Missing grid patterns | 30 | Duplicate .entity-card-grid | Added EXISTING GRID PATTERNS section |
| Missing color patterns | 30 | Inconsistent colors | Added COLOR PATTERNS section |
| Missing z-index hierarchy | 30, 31 | Conflicts | Added Z-INDEX HIERARCHY |
| Missing dropdown patterns | 31 | Wrong backdrop-filter | Added Dropdown/Popup patterns |
| Missing transition patterns | 31 | Arbitrary timing | Added Transitions patterns |
| Missing font-size patterns | 31 | Arbitrary sizes | Added Font sizes patterns |
| Missing padding patterns | 31 | Arbitrary padding | Added Padding patterns |
| Missing border-radius patterns | 31 | Arbitrary radius | Added Border radius patterns |
| Missing frontmatter link | 32 | CSS not loaded | Added FRONTMATTER LINK section |
| Missing class conflict check | 32 | Duplicate in main.css | Added VERIFY 3 |
| Missing z-index validation | 33 | Overlay conflicts | Added Check z-index conflicts |
| Missing color validation | 33 | Typos (#1890ff) | Added Check color consistency |
| Missing frontmatter validation | 33 | CSS not loaded | Added Check frontmatter |

### Final Design Patterns Added:

**Prompt 30:**
- EXISTING GRID PATTERNS: .entity-card-grid, .bcc-grid, .entity-col-*
- COLOR PATTERNS: #1890FF, #ff4d4f, #52c41a
- Z-INDEX HIERARCHY: 10/100/1001/9999/10000

**Prompt 31:**
- Spacing: gap 12/16/24px, padding patterns
- Dropdown/Popup: backdrop-filter: blur(25px), z-index: 1001
- Glass Panel: backdrop-filter: blur(28px)
- Transitions: 0.2s/0.3s/0.5s cubic-bezier
- Font sizes: 10/11/12/13/14/18px
- Border radius: 4/6/8/10/12/14/16/20/50px

**Prompt 32:**
- VERIFY 3: grep in main.css for duplicates
- FRONTMATTER LINK: customCss: [page]

**Prompt 33:**
- Z-INDEX validation section
- COLOR consistency validation
- FRONTMATTER validation

---

---

## Final Split (Fifth Pass) - GLM-5 Optimization

### Size Analysis Before Split:

| Prompt | Lines | GLM-5 | Decision |
|--------|-------|-------|----------|
| 30 | ~100 | HIGH | SPLIT into 30a + 30b |
| 31 | ~115 | HIGH | SPLIT into 31a + 31b |
| 32 | ~65 | MEDIUM | KEEP as is |
| 33 | ~80 | HIGH | SPLIT into 33a + 33b |

### Final Structure After Split:

| Prompt | Lines | GLM-5 | Purpose |
|--------|-------|-------|--------|
| 30a | ~30 | Low | CSS Reference (variables, patterns) |
| 30b | ~25 | Low | CSS Analysis (scan HTML, output) |
| 31a | ~35 | Low | CSS Patterns Reference |
| 31b | ~25 | Low | Create CSS Block |
| 32 | ~65 | Medium | Assemble CSS File |
| 33a | ~30 | Low | CSS Validation Checks |
| 33b | ~25 | Low | Validation Report |

### Split Benefits:

1. **GLM-5 Comfort:** All prompts now Low/Medium (was High)
2. **Reduced Context:** Each prompt has single responsibility
3. **Better Accuracy:** Less chance to miss patterns
4. **Easier Debugging:** Isolated failures

### Workflow After Split:

```
Prompt 30a (Reference)
    ↓
Prompt 30b (Analysis)
    ↓
Prompt 31a (Patterns) [once per session]
    ↓
Prompt 31b (Create) [repeat for each class]
    ↓
Prompt 32 (Assemble)
    ↓
Prompt 33a (Validation Checks)
    ↓
Prompt 33b (Report)
```

---

## Output

**COMPLETED (5 passes):**
1. `.windsurf/workflows/prompt-examples.md` - PHASE 9 split into 7 prompts
2. This file - all bugs + patterns + edge cases + split docs

**Pass Summary:**
- Pass 1: Fixed non-existent CSS variables
- Pass 2: Added real design patterns
- Pass 3: Added grid/color/z-index patterns
- Pass 4: Added button variants, state classes, animations
- Pass 5: Split into 7 prompts for GLM-5 optimization

**Total Prompts:** 7 (was 4)
**Average Size:** ~35 lines (was ~90 lines)
**GLM-5 Comfort:** All Low/Medium (was High)

**All Protected Against:**
- Non-existent variables
- Duplicate classes
- Wrong breakpoints
- Wrong z-index
- Wrong colors
- Missing backdrop-filter
- Missing hover states
- Missing animations
- Arbitrary spacing
- Arbitrary font sizes
- Arbitrary border-radius
- Missing frontmatter
- Overwriting files
