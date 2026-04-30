---
description: Prompt for refining PHASE 10 (Integration) in new chat session
---

# PHASE 10 Refinement - COMPLETE

## Objective

Analyze and improve PHASE 10 prompts (34-36) for GLM-5 optimization and bug prevention.

## Final Structure

**PHASE 10: Integration (6 Prompts)**

| Prompt | Lines | GLM-5 | Type | Key Safeguards |
|--------|-------|-------|------|----------------|
| 34 | ~95 | Low | Add | 5 VERIFY steps, icon check, duplicate check, page exists, i18n unique |
| 34b | ~75 | Low | Remove | Group status check, orphan label detection |
| 35 | ~105 | Low | Add | 5 VERIFY steps, PRESERVE existing, layout check, duplicate file WARN |
| 35b | ~85 | Low | Remove | File existence WARN, hardcoded reference check, YAML syntax |
| 36 | ~190 | Low | Validate | 11 STEP validation, EXTRACT commands, data-i18n format check, accessibility |
| 36b | ~140 | Low | Cleanup | Orphan references, i18n removal check, partial dependency WARN |

## CRITICAL FINDINGS (From Deep Analysis)

### 1. ⚠️ activeNav DOES NOT WORK WITH CURRENT CSS!

**THE BUG:**
- CSS: `.nav-link.active` (erp-base.css line 181)
- HTML: `class="nav-link{{#if activeNav}} {{activeNav}}{{/if}}"`
- Frontmatter: `activeNav: analytic_dashboard`
- Result: `class="nav-link analytic_dashboard"` → **NO HIGHLIGHT!**

**REQUIRED FIX in sidebar.html line 11:**
```html
<!-- BEFORE (BROKEN): -->
<li><a href="{{root}}analytics/dashboard.html" class="nav-link{{#if activeNav}} {{activeNav}}{{/if}}">

<!-- AFTER (CORRECT): -->
<li><a href="{{root}}analytics/dashboard.html" class="nav-link{{#if activeNav}} active{{/if}}">
```

**Until fixed:** activeNav in frontmatter is USELESS for sidebar highlighting!

### 2. ⚠️ activeNav CONFUSION - Analytics vs Module Pages

**DISCOVERED:**
- **Sidebar nav-links:** Analytics has `{{#if activeNav}}` pattern, Modules do NOT
- **Frontmatter:** BOTH Analytics AND Module pages have `activeNav` field!
- **Why?** activeNav in Module pages may be for JS logic, analytics tracking

**Pattern:**
```yaml
# Analytics page:
activeNav: analytic_dashboard  # sidebar link uses {{#if activeNav}} pattern

# Module page:
activeNav: supplier_list       # sidebar link does NOT use {{#if activeNav}} pattern
```

**When adding to sidebar:** Match the pattern of the GROUP!

### 3. Layout - admin.html DOES NOT EXIST!

- **ONLY `default.html` exists** in `demo/panini/layouts/`
- All pages use `layout: default`

### 4. customCss is in head.html, NOT footer-scripts.html!

**Script loading locations:**
- `customJs` → `footer-scripts.html`
- `langFile` → `footer-scripts.html`
- `customCss` → `head.html` (different file!)

### 5. Nav-item line count is 4 lines, NOT 1!

Prompt 34b was saying "1 line" but actual nav-items are 4 lines.

### 6. Required Frontmatter Fields

```yaml
layout: default          # ONLY valid value!
title: Page Title
pageTitle: Page Title    # Displayed in page header
activeNav: xxx          # BOTH Analytics AND Module pages! (BROKEN until CSS fix)
titleKey: page.xxx      # Optional, for i18n title
customJs: path          # Without .js extension
customCss: path         # Without .css extension (loaded in head.html!)
langFile: path          # Optional, for page-specific i18n
```

---

## SPLIT IMPLEMENTED (Final Structure)

### PHASE 10 Prompts - Final Structure

| Prompt | Lines | GLM-5 | Focus |
|--------|-------|-------|-------|
| **34a** | ~55 | LOW | Add Analytics Nav-Item |
| **34b** | ~60 | LOW | Add Module Nav-Item |
| **34c** | ~55 | LOW | Add Settings Link |
| **34d** | ~90 | MEDIUM | Remove Sidebar Link |
| **35** | ~120 | MEDIUM | Update Scripts (Frontmatter) |
| **35b** | ~80 | MEDIUM | Remove Scripts from Frontmatter |
| **36a** | ~55 | MEDIUM | Build & File Validation |
| **36b** | ~50 | MEDIUM | i18n & Partials Validation |
| **36c** | ~70 | MEDIUM | CSS, Frontmatter & Sidebar Validation |
| **36d** | ~90 | MEDIUM | Cleanup Validation (Page Deletion) |

### Result Summary

| Before | After |
|--------|-------|
| 6 prompts | **10 prompts** |
| Avg ~130 lines | Avg ~70 lines |
| 2 HIGH complexity | **0 HIGH complexity** |

### Prompt 34 Splits

**34a: Add Analytics Nav-Item** (~55 lines)
- Focus: Analytics pages BEFORE group label
- Pattern: `class="nav-link{{#if activeNav}} {{activeNav}}{{/if}}"`
- CRITICAL BUG warning included

**34b: Add Module Nav-Item** (~60 lines)
- Focus: Module pages AFTER group label
- Pattern: `class="nav-link"` (NO activeNav in sidebar)
- Group logic included

**34c: Add Settings Link** (~55 lines)
- Focus: Settings in sidebar-footer
- Pattern: `<a class="settings-link">` (NO `<li>` wrapper)

**34d: Remove Sidebar Link** (~90 lines)
- Handles all 3 types removal
- Group label cleanup logic

### Prompt 36 Splits

**36a: Build & File Validation** (~55 lines)
- Phases check, build test, file existence
- Simple, linear workflow

**36b: i18n & Partials Validation** (~50 lines)
- i18n keys format and presence
- Partials existence and params

**36c: CSS, Frontmatter & Sidebar Validation** (~70 lines)
- CSS classes validation
- Frontmatter required fields
- Sidebar link check
- CRITICAL BUG CHECK for activeNav

**36d: Cleanup Validation** (~90 lines)
- Page deletion cleanup
- Orphan reference detection

---

## Deep Analysis - Edge Cases & Failure Scenarios

### Prompt 34 - Sidebar (Add)

| Problem | Why it happens | Solution Added |
|---------|----------------|----------------|
| Duplicate nav link | Page already in sidebar | STEP 2: grep sidebar, STOP if found |
| Page doesn't exist | Link to 404 | STEP 3: verify page file exists |
| i18n key conflict | Key already used elsewhere | STEP 4: grep lang files for key |
| Wrong order in group | Inserted randomly | ORDER IN GROUP section |
| Settings vs nav confusion | Wrong wrapper element | Settings example: NO `<li>` wrapper |
| **activeNav pattern wrong** | Analytics vs Modules differ | ACTIVE STATE PATTERN section |
| Non-existent icon | Icon not in icon.html | STEP 5: VERIFY icon exists |
| Empty group label | Group has no items | WARN: check if label should exist |
| **Missing activeNav in Analytics** | No highlight on sidebar | MUST have `{{#if activeNav}}` pattern |

### Prompt 34b - Sidebar (Remove) - NEW

| Problem | Why it happens | Solution Added |
|---------|----------------|----------------|
| Orphan group label | Last item removed, label stays | STEP 4: check group status |
| Wrong element removed | Multiple similar paths | STEP 3: identify element type |
| Sidebar broken | Removed wrong lines | STEP 5: count lines to remove |
| i18n keys not removed | Separate task forgotten | COMMON ERRORS reminder |

### Prompt 35 - Scripts (Add)

| Problem | Why it happens | Solution Added |
|---------|----------------|----------------|
| JS/CSS file doesn't exist | 404 on load | STEP 3: verify files exist, WARN |
| **Layout: admin used** | admin.html DOES NOT EXIST! | WARN: use `layout: default` ONLY |
| Overwrites existing values | Lost configuration | PRESERVE EXISTING VALUES section |
| Page doesn't exist | Can't modify | STEP 1: STOP if page not found |
| Not all pages need JS/CSS | Unnecessary files | OPTIONAL FIELDS section |
| Duplicate file reference | Conflicts with other pages | STEP 5: WARN if files already used |
| **Missing pageTitle** | Page header empty | REQUIRED: pageTitle field |
| **Missing activeNav** | Analytics highlight broken | REQUIRED for Analytics pages |

### Prompt 35b - Scripts (Remove) - NEW

| Problem | Why it happens | Solution Added |
|---------|----------------|----------------|
| Files still exist | Not deleted, just reference removed | STEP 3: WARN if files exist |
| Layout/title removed | Accidental deletion | STEP 4: PRESERVE list |
| **pageTitle/activeNav removed** | Accidental deletion | STEP 4: PRESERVE pageTitle, activeNav |
| Hardcoded scripts in page | Not using frontmatter | STEP 5: grep for hardcoded refs |
| YAML syntax broken | Bad edit | STEP 6: VALIDATE YAML SYNTAX |

### Prompt 36 - Validation (Create)

| Problem | Why it happens | Solution Added |
|---------|----------------|----------------|
| Only checks "side.[key]" | Misses other data-i18n | EXTRACT all data-i18n from HTML |
| Only checks specific CSS | Misses classes in HTML | EXTRACT all class names from HTML |
| onclick handlers undefined | JS errors on click | STEP 9: verify handlers exist |
| Duplicate IDs | JS selector breaks | STEP 8: check for duplicates |
| Missing accessibility | Screen reader fails | STEP 10: accessibility checklist |
| Partial params missing | Build succeeds but broken | STEP 4: verify required params |
| Hardcoded text | No data-i18n attributes | WARN if NO DATA-I18N found |
| Wrong i18n format | Missing dot separator | Check format: MUST contain dot |
| **layout: admin used** | admin.html DOES NOT EXIST! | STEP 6: WARN if not "default" |
| **activeNav mismatch** | Frontmatter has it, nav-link doesn't | STEP 7: CHECK activeNav MATCHES |
| **Missing pageTitle** | Page header empty | STEP 6: verify pageTitle present |

### Prompt 36b - Validation (Cleanup) - NEW

| Problem | Why it happens | Solution Added |
|---------|----------------|----------------|
| Sidebar link remains | Forgot to remove | STEP 2: verify removed |
| JS/CSS orphan files | Unused files left | STEP 4: check file usage |
| i18n keys orphan | Still in lang files | STEP 5: check usage elsewhere |
| References in other files | Not searched broadly | STEP 6: grep all directories |
| Build breaks | Missing dependencies | STEP 7: build test |
| Partial references page | Partial still used | WARN: check partial usage elsewhere |
| CSS references missed | Only searched JS | STEP 6: grep demo/assets/css/ |
| **activeNav orphan** | Left in other pages' frontmatter | STEP 3: check activeNav removed |
| **JS event listeners** | Still listening for deleted elements | COMMON ERRORS: check JS file |

## Complete Bug Prevention Matrix

### Prompt 34 - Sidebar (Add)

| Problem | Prevention |
|---------|------------|
| Wrong element (`<a class="nav-item">`) | PATTERN section + 3 examples |
| Missing `{{root}}` | COMMON ERRORS + example |
| Non-existent icon | EXISTING ICONS list (36 valid names) |
| Wrong position | INSERT POSITION + ORDER IN GROUP |
| Missing group label | GROUP LOGIC (when to add) |
| Active state in nav-link | COMMON ERRORS (layout-level) |
| Duplicate nav link | STEP 2: grep sidebar first |
| Page doesn't exist | STEP 3: verify page file |
| i18n key conflict | STEP 4: grep lang files |
| Settings wrapper wrong | Settings example: NO `<li>` |

### Prompt 34b - Sidebar (Remove)

| Problem | Prevention |
|---------|------------|
| Removing wrong element | STEP 3: identify element type |
| Leaving orphan group label | STEP 4: check if last in group |
| Breaking sidebar structure | STEP 5: count lines exactly |
| Not removing i18n keys | COMMON ERRORS reminder |

### Prompt 35 - Scripts (Add)

| Problem | Prevention |
|---------|------------|
| Hardcoded script tag | FORBIDDEN + "BREAKS other pages!" |
| .js extension in value | PATH RULES + COMMON ERRORS |
| Missing layout | REQUIRED fields + STEP 4 verify |
| Missing langFile | REQUIRED fields (optional but listed) |
| Overwrites existing frontmatter | PRESERVE EXISTING VALUES |
| Wrong relative path | PATH RULES with mapping |
| JS/CSS file doesn't exist | STEP 3: verify + WARN |
| Layout doesn't exist | STEP 4: check layouts/ |
| Page doesn't exist | STEP 1: STOP if not found |
| Unnecessary JS/CSS | OPTIONAL FIELDS section |

### Prompt 35b - Scripts (Remove)

| Problem | Prevention |
|---------|------------|
| Removing layout/title | STEP 4: PRESERVE list |
| Files still exist | STEP 3: WARN if exist |
| Hardcoded refs in page | STEP 5: grep check |
| YAML syntax broken | COMMON ERRORS |

### Prompt 36 - Validation (Create)

| Problem | Prevention |
|---------|------------|
| Incomplete phases | STEP 0 checklist (7 phases) |
| Missing files | STEP 2 explicit file list |
| Missing i18n keys | STEP 3 EXTRACT + grep |
| Missing partials | STEP 4 + PARTIAL_SPECS.md |
| Missing partial params | STEP 4: verify required params |
| Missing CSS classes | STEP 5 EXTRACT + grep |
| Missing sidebar link | STEP 7 grep command |
| Duplicate IDs | STEP 8: extract + uniq -d |
| onclick handlers undefined | STEP 9: grep JS file |
| Missing accessibility | STEP 10: 5-item checklist |
| Build passes but errors | STEP 11: manual tests (10 items) |
| Console errors missed | Manual test: "F12 -> Console" |

### Prompt 36b - Validation (Cleanup)

| Problem | Prevention |
|---------|------------|
| Sidebar link remains | STEP 2: grep sidebar |
| JS/CSS orphan files | STEP 4: check usage |
| i18n keys orphan | STEP 5: grep all files |
| References in other files | STEP 6: broad grep |
| Build breaks | STEP 7: build test |

## Files Referenced

1. `demo/panini/partials/layout/sidebar.html` - nav item pattern, activeNav (Analytics vs Modules)
2. `demo/panini/partials/layout/footer-scripts.html` - scripts pattern via frontmatter
3. `demo/panini/partials/ui/icon.html` - valid icon names (36 total)
4. **`demo/panini/layouts/default.html`** - ONLY layout that EXISTS (admin.html does NOT exist!)
5. `.windsurf/workflows/PARTIAL_SPECS.md` - partial validation

**CRITICAL:** Verify layout exists BEFORE recommending in prompts!

## Valid Icons (from icon.html)

```
warehouse-box, alert-tag, sales-up, profit-coin, alert-triangle,
stats-bars, materials-swatch, sales-trend, staff-user, offer-tag,
cart-shopping, check-success, clock-history, trend-growth, swap-arrows,
balance-scale, clock-time, report-clipboard, check-circle, info-circle,
settings-gear, x-close, x-circle, edit-pencil, save-disk, chevron-down,
upload-arrow, calendar, plus-add, pie-chart, grid-products, menu-bars,
search, bell-notification, chevron-right, email
```

## grep Commands Reference

```bash
# Prompt 34 - Sidebar (Add)
grep "[path]" demo/panini/partials/layout/sidebar.html  # Check duplicate
grep "side\.[key]" demo/assets/js/lang/*.json            # Check i18n unique

# Prompt 34b - Sidebar (Remove)
grep "[path]" demo/panini/partials/layout/sidebar.html  # Find nav link

# Prompt 35b - Scripts (Remove)
grep "<script" demo/panini/pages/[page].html  # Check hardcoded refs

# Prompt 36 - Validation (Create)
grep -o 'data-i18n="[^"]*"' demo/panini/pages/[page].html  # Extract all i18n
grep -o 'class="[^"]*"' demo/panini/pages/[page].html       # Extract all classes
grep -o 'id="[^"]*"' demo/panini/pages/[page].html | sort | uniq -d  # Duplicate IDs
grep -o 'onclick="[^"]*"' demo/panini/pages/[page].html    # Extract handlers
grep "function [name]" demo/assets/js/[customJs].js        # Verify handler exists

# Prompt 36b - Validation (Cleanup)
grep "[path]" demo/panini/partials/layout/sidebar.html  # Verify removed
grep -r "[page-name]" demo/panini/pages/                 # Find orphan refs
grep -r "[page-name]" demo/panini/partials/              # Find orphan refs
grep -r "side\.[key]" demo/panini/pages/ demo/panini/partials/  # Check i18n usage
```

## Methodology Applied

### Size Analysis:
- Prompt 34: ~95 lines (instruction ~65 + example ~30) - acceptable
- Prompt 34b: ~75 lines (instruction ~50 + example ~25) - acceptable
- Prompt 35: ~105 lines (instruction ~70 + example ~35) - acceptable
- Prompt 35b: ~85 lines (instruction ~60 + example ~25) - acceptable
- Prompt 36: ~190 lines (instruction ~130 + example ~60) - comprehensive
- Prompt 36b: ~140 lines (instruction ~100 + example ~40) - acceptable

### GLM-5 Comfort Level:
- All 6 prompts: **Low** (linear workflow, explicit steps)
- No split needed despite larger size (steps are sequential, not branching)

### Required Elements Added:
- **STEP N with STOP conditions** - early exit on errors
- **EXTRACT commands** - grep -o to get all values
- **VERIFY steps** - check before proceeding
- **PRESERVE section** - don't overwrite existing
- **OPTIONAL FIELDS** - not all pages need everything
- **Accessibility checklist** - 5 items for a11y
- **3 examples per prompt** - cover different scenarios
- **Cleanup prompts** - 34b, 35b, 36b for deletion scenarios
