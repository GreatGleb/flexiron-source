---
description: Prompt for refining PHASE 2 in new chat session
---

# PHASE 2 Refinement - COMPLETE

## Summary

| Prompt | Lines | GLM-5 | Decision |
|--------|-------|-------|----------|
| 10a | ~40 | Medium | Keep + safeguards |
| 10b-1 | ~38 | Medium | Split from 10b |
| 10b-2 | ~38 | Medium | Split from 10b |
| 11 | ~38 | Medium | Keep + safeguards |
| 12 | ~42 | Medium | Keep + safeguards |

**Key Improvements:** PARTIAL CATEGORIES, DEPENDENCY CHECK, VERIFY file existence

---

## Original Prompt for New Chat

Use this prompt in a new chat to refine PHASE 2 of the page generation workflow.

---

## Prompt for New Chat

```
Refine PHASE 2 of the page generation workflow in `.windsurf/workflows/prompt-examples.md`.

PHASE 1 was already refined with these changes:
- Split into 9 sub-prompts (1-9)
- Each prompt: 10-25 lines instruction + example
- All have "DO NOT write code"
- Added grid class selection guidance
- Added responsive validation
- Added badgeCount params

PHASE 2 current state (Prompts 10-12):
- Prompt 10: List Existing Partials
- Prompt 11: Identify New Partials
- Prompt 12: Validate Partials List

Tasks for PHASE 2:
1. Analyze if prompts are too large (like PHASE 1 was)
2. Check if they need splitting into sub-prompts
3. Verify all have "DO NOT write code" where appropriate
4. Check internal references are correct
5. Ensure output format matches PHASE 1 style

Reference files:
- `.windsurf/workflows/prompt-examples.md` - main workflow file
- `.windsurf/workflows/create-page.md` - workflow description
- `demo/panini/PARTIAL_SPECS.md` - partials documentation

Goal: Ensure PHASE 2 prevents bugs, style inconsistencies, and design deviations.
```

---

## Context from PHASE 1 Work

**What was done:**
- Split 3 prompts into 9 sub-prompts
- Renumbered all phases (1-36 total)
- Updated all internal references
- Updated Summary section

**Pattern to follow:**
- Each sub-prompt: ~15-25 lines instruction
- Clear output format
- Example after each prompt
- "DO NOT write code" for spec/analysis prompts
- "MAX N lines" based on output type

**PHASE 1 structure for reference:**
| Prompt | Focus | MAX lines |
|--------|-------|-----------|
| 1 | Find references | 15 |
| 2 | Extract patterns | 25 |
| 3 | Choose grid | 15 |
| 4 | Define layout | 10 |
| 5 | Define sections | 15/section |
| 6 | Define modals | 20 |
| 7 | Validate partials | 15 |
| 8 | Validate layout | 15 |
| 9 | Validate states | 10 |
