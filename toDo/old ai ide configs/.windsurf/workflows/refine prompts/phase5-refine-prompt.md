---
description: Prompt for refining PHASE 5 (i18n) in new chat session
---

# PHASE 5 Refinement - COMPLETE

## Summary

| Prompt | Lines | GLM-5 | Decision |
|--------|-------|-------|----------|
| 18a | ~35 | Low | Split - extract keys |
| 18b | ~35 | Low | Split - categorize |
| 19a | ~40 | Low | Simple pages |
| 19b | ~40 | Low | Complex pages |
| 20a | ~30 | Low | Validate keys |
| 20b | ~30 | Low | Validate completeness |

**Key Improvements:** Split by complexity, naming conventions, ALL lang files check

---

## Original Prompt for New Chat

Use this prompt in a new chat session to refine PHASE 5 (i18n) prompts 18-20.

## Methodology (from PHASE 2-4)

**1. Size Analysis for GLM-5:**
- Instruction lines: count
- Example lines: count
- Total: target 35-45 lines
- If >50 lines: consider split

**2. Workload Analysis:**
- File reads needed (specs, directory, actual files)
- Items to process (sections, keys, categories)
- Decisions per item
- Context complexity: Low/Medium/High

**3. GLM-5 Comfort Level:**
- Low: Single clear task, linear workflow, no branching
- Medium: 2-3 file reads, multiple items, cross-reference
- High: Many items, nested decisions, potential context overflow

**4. Decision Matrix:**
| Comfort | Action |
|---------|--------|
| Low | Keep as is |
| Medium | Keep, add safeguards |
| High | Split into 2-3 prompts |

**5. Required Elements per Prompt:**
- CRITICAL: Check .windsurf/workflows/PARTIAL_SPECS.md
- VERIFY: Check actual file/directory
- "DO NOT write code" (for spec prompts)
- MAX N lines limit
- Example output (valid AND invalid if applicable)
- COMMON ERRORS section

---

## Current PHASE 5 Prompts

### Prompt 18: List i18n Keys by Section (~57 lines)

**Current Issues:**
- No CRITICAL check for partials with titleKey, badgeKey
- No VERIFY for existing lang files
- No connection to HTML data-i18n attributes
- Missing plural forms consideration
- Missing interpolation variables

**Analysis:**
| Metric | Value |
|--------|-------|
| Size | ~57 lines (above target) |
| Workload | Multiple sections, 5 key types per section |
| GLM-5 Comfort | Medium |
| Decision | Split into 18a (Labels & Buttons) + 18b (Errors & Special) |

---

### Prompt 19: Create Language File Structure (~60 lines)

**Current Issues:**
- No VERIFY for existing lang files path
- No check for duplicate keys
- No interpolation syntax guidance
- No plural forms guidance

**Analysis:**
| Metric | Value |
|--------|-------|
| Size | ~60 lines (above target) |
| Workload | Simple JSON creation |
| GLM-5 Comfort | Low |
| Decision | Keep, add safeguards |

---

### Prompt 20: Validate i18n Keys (~35 lines)

**Current Issues:**
- **NO EXAMPLE** - critical missing!
- No check for data-i18n in HTML
- No check for interpolation variables
- No check for plural forms
- No check for missing keys in lang file

**Analysis:**
| Metric | Value |
|--------|-------|
| Size | ~35 lines (OK) |
| Workload | Cross-reference multiple sources |
| GLM-5 Comfort | Medium |
| Decision | Keep, add example + safeguards |

---

## Potential Bugs to Prevent

| Bug | Cause | Solution |
|-----|-------|----------|
| Missing titleKey | Forgot partial params | CRITICAL check PARTIAL_SPECS.md |
| Missing data-i18n | HTML has key not in lang file | VERIFY grep HTML for data-i18n |
| Duplicate keys | Same key in different sections | Check duplicates in validation |
| Wrong key format | page.Status instead of page.status | Naming convention check |
| Missing interpolation | `{{count}}` not in value | Interpolation check |
| Missing plural | "1 item" vs "5 items" | Plural forms check |
| Wrong lang path | /lang/en/ instead of /lang/en-US/ | VERIFY existing path |

---

## Required Improvements

### Prompt 18a: Labels & Buttons (~40 lines)
- CRITICAL: Check PARTIAL_SPECS.md for titleKey, badgeKey params
- VERIFY: Read existing lang files for key patterns
- Categories: LABELS, PLACEHOLDERS, BUTTONS
- Naming convention: page.*, btn.*
- Common errors section

### Prompt 18b: Errors & Special (~40 lines)
- Categories: ERRORS, TOOLTIPS, MESSAGES (empty, loading)
- Plural forms: item vs items
- Interpolation: `{{count}}`, `{{name}}`
- Naming convention: error.*, modal.*
- Common errors section

### Prompt 19: Create Language File (~45 lines)
- VERIFY: Check existing lang file path: demo/panini/lang/[lang]/
- VERIFY: Read existing lang files for structure
- Interpolation syntax: `{{variable}}`
- Plural forms: `_one`, `_other` suffixes
- Common errors section

### Prompt 20: Validate i18n (~50 lines)
- **Add example** (valid AND invalid)
- Check data-i18n in HTML vs lang file
- Check interpolation variables match
- Check plural forms completeness
- Check key naming convention
- Common errors section

---

## Analysis Format Example

```
## Prompt 18a Analysis

**Size:**
- Instruction: ~25 lines
- Example: ~15 lines
- Total: ~40 lines (OK)

**Workload:**
- File reads: 2 (PARTIAL_SPECS.md, existing lang files)
- Items: 3 categories × N sections
- Decisions: Key naming, interpolation
- Context: Low-Medium

**GLM-5 Comfort:** Low-Medium

**Decision:** Keep, add safeguards

**Safeguards:**
1. CRITICAL: Check PARTIAL_SPECS.md for titleKey, badgeKey
2. VERIFY: Read existing lang files
3. Naming convention explicit
4. Common errors section
```

---

## Instructions

1. Read current PHASE 5 prompts from `.windsurf/workflows/prompt-examples.md`
2. Apply methodology to each prompt
3. Decide: keep, split, or merge
4. Add CRITICAL/VERIFY safeguards
5. Add examples if missing
6. Add COMMON ERRORS sections
7. Update `.windsurf/workflows/create-page.md` if prompt numbers change
8. Ensure all prompts prevent:
   - Missing keys in HTML
   - Missing titleKey/badgeKey from partials
   - Duplicate keys
   - Wrong key format
   - Missing interpolation
   - Missing plural forms
