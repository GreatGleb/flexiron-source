---
description: Prompt for refining PHASE 6 (HTML Assembly) in new chat session
---

# PHASE 6 Refinement - COMPLETE

## Analysis Summary

| Prompt | Lines | Workload | GLM-5 | Decision |
|--------|-------|----------|-------|----------|
| 21 | ~40 | Medium | Medium | Keep + safeguards |
| 22 | ~25 | Low | Low | Keep + safeguards |
| 23 | ~40 | Medium | Medium | Keep + safeguards |

**No splits needed** - all prompts within acceptable range.

## Improvements Made

### Prompt 21: HTML Section by Section
- Added CRITICAL: Read PARTIAL_SPECS.md for ALL partial params
- Added VERIFY: Read similar page for reference pattern
- Added cross-reference to Prompt 10b-1/10b-2 (partials) and 15a-1/15a-2/15b (data)
- Added COMMON ERRORS section (missing params, wrong syntax, missing data-i18n, duplicate IDs)
- Clarified block vs inline partial syntax

### Prompt 22: Assemble Full Page
- Added VERIFY: Read layout file for structure
- Added frontmatter validation with all required fields
- Added pageTitle explanation (layout uses {{pageTitle}})
- Added COMMON ERRORS section (missing pageTitle, wrong langFile, missing activeNav, wrong order)
- Added full example output with frontmatter

### Prompt 23: Validate HTML
- Added CRITICAL: Read PARTIAL_SPECS.md for required params
- Added CSS CLASSES validation (existing vs new)
- Added ACCESSIBILITY checks (labels, buttons, tables)
- Added cross-reference to Prompt 15b (data selectors), 18a/18b (i18n keys), 30/31 (CSS)
- Added COMMON ERRORS section
- Added both valid AND invalid example outputs

## Bug Prevention Mechanisms

| Problem | Solution |
|---------|----------|
| Missing required param | CRITICAL + PARTIAL_SPECS.md check |
| Wrong partial syntax | COMMON ERRORS + block vs inline clarification |
| Duplicate IDs | Validation step in Prompt 23 |
| Missing data-i18n | COMMON ERRORS + cross-reference to 18a/18b |
| Missing CSS class | CSS CLASSES validation in Prompt 23 |
| Accessibility issues | New ACCESSIBILITY check section |
| Wrong frontmatter | VERIFY layout + COMMON ERRORS |
| Missing pageTitle | Frontmatter validation + explanation |

## Cross-Phase References Verified

**Inbound:**
- Prompt 10b-1/10b-2 (partials list) - referenced in 21
- Prompt 15a-1/15a-2/15b (data) - referenced in 21, 23
- Prompt 18a/18b (i18n keys) - referenced in 21, 23
- Prompt 5 (sections) - referenced in 22

**Outbound:**
- Prompt 27 (JS file reference) - customJs in frontmatter
- Prompt 30 (CSS classes) - referenced in 23
- Prompt 34 (sidebar navigation) - activeNav in frontmatter

## Files Updated

- `.windsurf/workflows/prompt-examples.md` - PHASE 6 prompts (lines 2271-2523)
- `.windsurf/workflows/create-page.md` - no changes needed (prompt numbers unchanged)
