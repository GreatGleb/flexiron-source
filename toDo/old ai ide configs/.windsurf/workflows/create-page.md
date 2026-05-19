---
description: Multi-layer page development workflow for admin pages
---

# Multi-Layer Page Development

## Concept

Instead of generating entire pages at once (which causes bugs), develop in **10 sequential phases** with **validation checkpoints**:

1. **Structure** (Prompts 1-9) - HTML skeleton, sections layout, states
2. **Partials** (Prompts 10-14) - component registry (existing vs new)
   - **VALIDATE** - Check .windsurf/workflows/PARTIAL_SPECS.md for correct params
3. **New Partials** (Prompts 15-19) - create missing partials if needed
   - **VALIDATE** - Build test, CSS check, specs registration
4. **Data** (Prompts 20-26) - JS variables, types, API contracts
   - **VALIDATE** - Verify data contracts match HTML and partials
5. **i18n** (Prompts 27-32b) - translation keys (labels, placeholders, tooltips, errors)
   - **VALIDATE** - Check key naming conventions, partial i18n params
   - **VALIDATE (32b)** - i18n integration: translateNewElements, onLanguageChange, dynamic element i18n
6. **HTML Assembly** (Prompts 33-38) - assemble full page HTML
   - **VALIDATE** - Structure, content, build test
   - **VALIDATE (37)** - CSS visibility check (badges, indicators must be visible)
   - **VALIDATE (38)** - Console errors check, functional test checklist
7. **Logic** (Prompts 39-44b) - function signatures, patterns
   - **VALIDATE** - Verify selectors match HTML IDs
   - **VALIDATE (44b)** - JS completeness: functions defined, global exposure, event listeners, utilities
8. **JS Implementation** (Prompts 45-53) - write actual JS code
   - **VALIDATE** - Syntax, patterns, async handling
9. **CSS Styles** (Prompts 54-60) - CSS classes
   - **VALIDATE** - Check CSS compiles
10. **Integration** (Prompts 61-63+) - final integration test
    - **VALIDATE** - Full page test, cross-reference all layers

Each phase is approved before moving to the next. **Max 50 lines per generation.**

---

## CRITICAL RULES - NEVER SKIP

1. **NEVER SKIP PROMPTS** - Every prompt is mandatory
2. **NEVER SHORTCUT** - Generate max 50 lines per prompt
3. **NEVER COMBINE** - One prompt = one step
4. **CHECKPOINT after every prompt** - Validate before proceeding
5. **IF INPUT missing** - STOP, return to previous prompt
6. **IF OUTPUT empty** - STOP, re-read file and extract data
7. **IF STATUS: NEEDS FIX** - STOP, fix issues, re-run current prompt
8. **NEVER GUESS params** - Always check PARTIAL_SPECS.md
9. **NEVER GENERATE entire files** - Build incrementally

**Violation of these rules = BUGS**

---

## Sources (Reference Documents)

When creating a page, read these documents for context:

### Page Specifications
- `design/screen_specs/[XX.X_Page_Name].md` - Detailed page requirements (sections, fields, validation)
- `design/Flexiron_ERP_Sitemap.md` - Site structure, navigation, section placement

### UI & Design
- `design/UI_map_of_ui elements_Flexiron.md` - UI components, DNA specs, styles
- `design/ui elements mockups png/` - Visual mockups

### Business Logic
- `toDo/Flexiron_ERP_Process_Algorithm.md` - ERP business processes, algorithms
- `toDo/Flexiron_ERP_CRM.md` - CRM requirements
- `toDo/ZeroCode&BackEnd parts.md` - Zero-code and backend specs

### Partials Registry
- `.windsurf/workflows/PARTIAL_SPECS.md` - All available partials with parameters

---

## CRITICAL: Always Check PARTIAL_SPECS.md

Before using any partial, check `.windsurf/workflows/PARTIAL_SPECS.md` for:
- Required vs optional parameters
- Parameter types (string, boolean, number, array)
- Default values
- Usage examples

**Never guess parameter names** - always verify in specs.

---

## Existing Partials Registry

### Sections
- `glass-panel.html` - main container with loading states, title, badge, action
- `analytics-sub-nav.html` - sub-navigation for analytics pages

### UI Components
- `custom-select.html` - styled dropdown (id required)
- `custom-select-sm.html` - small variant of custom-select
- `datepicker.html` - date input with calendar (id required)
- `dropzone.html` - file upload zone (inputId required)
- `email-template.html` - email subject and body inputs (id required)
- `input-group.html` - label + input wrapper with hint
- `input-suffix-select.html` - input with suffix dropdown (selectId, inputId required)
- `modal.html` - modal dialog (id, title required)
- `multi-select.html` - multi-select dropdown with tags (id required)
- `checkbox-list.html` - searchable checkbox list (id required)
- `price-input.html` - price input with unit select (id required)
- `price-input-sm.html` - small variant of price-input
- `rating-select.html` - rating dropdown (id required)
- `rating-stars.html` - star display (active required)
- `table-row-actions.html` - edit/delete buttons
- `tag-input.html` - tags container (id required)
- `tag.html` - single tag with remove (label required)
- `icon.html` - SVG icons (name required)

### Components
- `kpi-card.html` - metric display (label, value required)
- `acard.html` - analytics card with link (href, title required)
- `bar-chart-row.html` - bar chart row (label, value, width required)

### Atoms
- `ametric.html` - single metric (label, value required)
- `file-item.html` - file list item (name required)
- `note-item.html` - note item (date, text required)

### Tables
- `alerts-table.html` - alerts table structure
- `history-table.html` - generic history table (columns, rows optional)
- `history-row.html` - history table row (id, date, status, statusLabel required)
- `request-history-table.html` - request history for BCC (id required)

### Options
- `currencies.html` - EUR, USD, PLN, GBP
- `units.html` - kg, m, piece, ton
- `supplier_statuses.html` - Active, Preferred, New, Under Review, Suspended, Blocked

### Layout (in layouts/)
- `default.html` - main layout wrapper
- `header.html`, `sidebar.html`, `footer-scripts.html`, `head.html`

---

## Prompt Examples

See `/prompt-examples` for detailed prompts demonstrating the full workflow.

**Total prompts: 60-65** (depends on page complexity)

**Phases:**
1. Structure (Prompts 1-9) - reference analysis, structure definition, validation
2. Partials (Prompts 10-14) - existing partials selection, new partials planning
3. New Partials (Prompts 15-19) - create and validate new partials (repeat per partial)
4. Data (Prompts 20-26) - page state, collections, types, APIs, validation
5. i18n (Prompts 27-32b) - labels, errors, tooltips, lang file creation/validation, **i18n integration test**
6. HTML Assembly (Prompts 33-38) - section HTML, full page assembly, validation, **visibility check**, **functional test checklist**
7. Logic (Prompts 39-44b) - function signatures, patterns, event handlers, **JS completeness test**
8. JS Implementation (Prompts 45-53) - write JS code, validation
9. CSS Styles (Prompts 54-60) - CSS classes, validation
10. Integration (Prompts 61-63+) - sidebar nav, final build, cross-reference

---

## Benefits of This Approach

| Problem | Solution |
|---------|----------|
| 500 lines of buggy code | Max 50 lines per prompt |
| Missing imports/partials | Explicit partials layer + PARTIAL_SPECS.md check |
| Inconsistent styling | Check existing CSS first |
| Data structure confusion | Define contracts before code |
| Hard to debug | Each phase is isolated |
| Wrong param names | CRITICAL: Check PARTIAL_SPECS.md |
| Missing i18n keys | Cross-reference partial params with lang file |
| JS/HTML mismatch | Validate selectors match HTML IDs |
| Build errors | Validate after each phase |

---

## Quick Reference: When to Create New Partial

Create NEW partial when:
- Component appears 2+ times on page
- Component will be used on other pages
- Component has 3+ configuration options

Use INLINE HTML when:
- One-time use
- Simple structure (< 10 lines)
- Highly specific to this page context

---

## Validation Rules

### Before Writing Code
1. Check .windsurf/workflows/PARTIAL_SPECS.md for parameter names
2. Verify partial exists in registry
3. Check existing CSS for classes you plan to use

### After Each Generation
1. Run `gulp build` to check for errors
2. Verify all IDs in HTML match JS selectors
3. Verify all partial params match specs

### Checkpoint System (CRITICAL)

**Every prompt has CHECKPOINT section with:**
- INPUT RECEIVED: [yes/no] - must be yes from previous prompt
- OUTPUT PRODUCED: [list] - must have concrete data
- STATUS: [VALID / NEEDS FIX]

**Blocking Rules:**
- IF INPUT missing: STOP - run previous prompt first
- IF OUTPUT empty: STOP - re-read file and extract data
- IF STATUS: NEEDS FIX: STOP - fix issues, re-run current prompt

**Cross-Reference Chain:**
```
Prompt 5 (Sections) -> Prompt 10 (Partials) -> Prompt 11 (UI Params) -> Prompt 12 (Container Params)
Prompt 27 (i18n) -> Prompt 28 (Errors) -> Prompt 32b (i18n Integration)
Prompt 39 (Functions) -> Prompt 42 (Events) -> Prompt 44b (JS Completeness)
```

**Mandatory Output Requirements:**
- Every READ step must EXTRACT and OUTPUT concrete data
- Empty output = ERROR - file not read correctly
- "yes" without data = ERROR - superficial verification

### Max Lines Per Generation
- **HTML partial**: 30 lines
- **JS function**: 20 lines
- **CSS block**: 25 lines

If more needed, split into multiple prompts.

---

## Common Errors to Avoid

| Error | Prevention |
|-------|-------------|
| Wrong param name | Check .windsurf/workflows/PARTIAL_SPECS.md |
| Missing required param | Check "Required" column in specs |
| Wrong ID in JS | Copy-paste ID from HTML |
| Missing helper import | Check helpers: times, lte, eq, concat (block), array, obj (inline) |
| CSS class conflict | Check existing CSS files first |
| Missing loading=true | Always include on glass-panel |
| Missing hasBody=true | Always include on glass-panel with content |
| Null for select default | Use 'all' or first option, NOT null |
| Null for array initial | Use [] NOT null |
| Missing i18n key | Check partial params: titleKey, labelKey, hintKey, etc. |
| Wrong icon name | Check available icons list in PARTIAL_SPECS.md |
| Full-width section in grid | Place AFTER grid closing </div> |
| Missing {{/helper}} | Block helpers need closing tag |
| (array) as block helper | (array) is INLINE: {{> partial columns=(array ...)}} |
| **translateNewElements not called** | **Prompt 32b: Check dynamic elements get i18n applied** |
| **onLanguageChange not registered** | **Prompt 32b: Tables must rebuild on language change** |
| **Badge hidden with opacity:0** | **Prompt 37: Check CSS visibility for badges/indicators** |
| **window.* not set for onclick** | **Prompt 44b: Global functions need window.* exposure** |
| **Event listener not registered** | **Prompt 44b: Check addEventListener for each event** |
| **showToast not defined** | **Prompt 44b: Utility functions must exist** |
| **DOMContentLoaded not calling init** | **Prompt 44b: Init must be called on page load** |
