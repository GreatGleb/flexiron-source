---
description: Improved prompts with validation and smaller steps
---

# Prompt Examples: Orders Page

Each prompt outputs max 20-50 lines to prevent bugs.

---

## PHASE 1: STRUCTURE

### Prompt 1: Find Reference Pages
```
Find reference pages for [new-page].html:

STEP 1: LIST existing pages
Command: ls demo/panini/pages/

STEP 2: IDENTIFY similar pages by criteria:
- Same layout type (single/2-col/3-col grid)
- Similar sections count (±2)
- Same purpose category (entity-card/list/form/dashboard)

STEP 3: READ each candidate page
DO NOT PROCEED without reading the actual HTML!

STEP 4: VERIFY similarity
Check if candidate has:
- Same grid class or similar column structure
- Same partial types (glass-panel, modal, table)
- Similar state patterns (loading/error/empty)

IF NO similar pages found:
- Use closest match and note differences
- Or use empty output with "NO SIMILAR PAGES FOUND"

Output:
```
## REFERENCES FOUND

1. [page-name].html
   - Purpose: [one sentence]
   - Similar to new page because: [specific reasons: layout, sections, partials]

2. [page-name].html
   - Purpose: [one sentence]
   - Similar to new page because: [specific reasons: layout, sections, partials]

OR: NO SIMILAR PAGES FOUND - will need custom structure
```

MAX 20 lines. DO NOT write code.
```

**EXAMPLE:**
```
## REFERENCES FOUND

1. bcc-request.html
   - Purpose: BCC email request tool for suppliers
   - Similar: has 3-column grid with filters and table

2. card.html
   - Purpose: Supplier profile card with editable fields
   - Similar: has multiple glass-panel sections with forms
```

---

### Prompt 2: Extract Patterns
```
Extract patterns from reference page:

Page: [paste reference from Prompt 1]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
DO NOT PROCEED without reading this file!

STEP 2: READ the reference page HTML
Extract actual patterns, not assumptions.

STEP 3: EXTRACT all partials with params
For each partial found, list:
- Partial name
- Required params (from PARTIAL_SPECS.md)
- Optional params used (from actual HTML)
- Count (Nx)

STEP 4: EXTRACT all CSS classes
Grep for class="..." and categorize:
- Layout classes (grid, container, columns)
- Component classes (panel, button, input)
- Utility classes (spacing, visibility)

STEP 5: EXTRACT states
Check for:
- loading="{{loading}}" or loading="true"
- Error handling blocks
- Empty state messages

Output:
```
## PATTERNS: [page name]

LAYOUT:
- Type: [single / 2-col / 3-col grid]
- Container: [class]
- Columns: [list]
- Responsive: [mobile behavior]

STATES:
- Loading: [skeleton/spinner/none] - [how implemented]
- Error: [inline/toast/none] - [how implemented]
- Empty: [placeholder/message/none] - [how implemented]

PARTIALS:
- [partial] (Nx)
  - Required: [params from PARTIAL_SPECS.md]
  - Optional used: [params from HTML]

CSS CLASSES:
- Layout: [list]
- Components: [list]
- Utility: [list]
```

MAX 30 lines. DO NOT write code.
```

**EXAMPLE:**
```
## PATTERNS: bcc-request.html

LAYOUT:
- Type: 3-column grid
- Container: .bcc-grid
- Responsive: stacks on mobile

STATES:
- Loading: skeleton (glass-panel loading=true)
- Error: none (JS handles)
- Empty: placeholder text

PARTIALS:
- glass-panel (4x) - requires: title
- multi-select (1x) - requires: id
- modal (1x) - requires: id

CSS CLASSES:
- Layout: .bcc-grid, .col-left/center/right
- Components: .glass-panel, .custom-select
```

---

### Prompt 3: Choose Grid Class
```
Choose grid class for [new-page].html:

Requirements from TZ:
- [paste relevant TZ requirements]

STEP 1: VERIFY existing grid classes
Grep CSS for grid classes:
Command: grep -r "\-grid" demo/assets/css/ | grep -v "color"
List all found grid classes with their definitions.

STEP 2: CHECK responsive breakpoints
Grep for @media queries:
Command: grep -r "@media" demo/assets/css/
Note breakpoints used (992px, 1200px, etc.)

STEP 3: MATCH TZ requirements
Check if TZ specifies:
- Column count
- Column proportions
- Responsive behavior

STEP 4: DECIDE grid class
Rules:
- Entity card (suppliers/customers/partners) + TZ matches -> USE .entity-card-grid
- Existing grid matches TZ -> USE existing
- No match -> CREATE NEW [page]-grid
- NEW classes MUST end with -grid suffix

STEP 5: IF NEW grid needed
Define:
- Name: [page]-grid (MUST have -grid suffix)
- Columns: [proportions like "1fr 2fr 1fr"]
- Breakpoint: [use existing 992px/1200px if possible]
- Stacking: [which columns stack on mobile]

Output:
```
## GRID DECISION

EXISTING GRIDS FOUND:
- [class]: [columns] - [purpose]

CHOSEN: [.entity-card-grid / [existing] / NEW]
REASON: [why this fits TZ requirements]

IF NEW:
- Name: [page]-grid
- Columns: [proportions]
- Breakpoint: [992px / 1200px / custom]
- Stacking: [which columns stack first]
- CSS NEEDED: will create in PHASE 9
```

MAX 20 lines. DO NOT write code.
```

**EXAMPLE:**
```
## GRID DECISION

Chosen: .orders-grid (NEW)
Reason: Orders page has unique 2-col layout (filters + table), not entity card

NEW grid:
- Name: .orders-grid
- Columns: 1fr 2fr
- Responsive: stacks on mobile at 992px
```

### Prompt 4: Define Layout
```
Define LAYOUT for [new-page].html:

Purpose: [one sentence from TZ]

Grid from Prompt 3: [paste grid decision]

STEP 1: VERIFY container class
If using existing grid: grep for container class in CSS
Command: grep -r "[container-class]" demo/assets/css/
If NOT FOUND: WARN - class may not exist

STEP 2: CROSS-REFERENCE with Prompt 3
Ensure:
- Container matches grid decision
- Columns match grid proportions
- Breakpoint matches grid breakpoint

STEP 3: DEFINE column classes
For multi-column layouts:
- List each column class (.col-left, .col-center, .col-right)
- Verify naming convention matches existing patterns

STEP 4: DEFINE responsive behavior
- Which columns stack on mobile?
- In what order?
- At which breakpoint?

Output:
```
## LAYOUT: [page name]

- Type: [single / 2-col / 3-col grid]
- Container: [class name] - [exists / NEW from Prompt 3]
- Columns: [list with classes]
- Responsive: [stacking behavior at breakpoint]
- CSS NEEDED: [none / list if NEW]
```

MAX 15 lines. DO NOT write code.
```

**EXAMPLE:**
```
## LAYOUT: orders.html

- Type: 2-column grid
- Container: .orders-grid
- Columns: .col-filters, .col-table
- Responsive: stacks on mobile at 992px
```

---

### Prompt 5: Define Sections
```
Define SECTIONS for [new-page].html:

Layout from Prompt 4: [paste layout]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
DO NOT PROCEED without reading this file!

STEP 2: FOR EACH section define:
- Title and i18n key (format: page.[key])
- Purpose (one sentence)
- Position (must match layout columns)
- States (loading/error/empty)
- Partials with ALL params

STEP 3: VERIFY partial params
For each partial, list:
- Required params (MUST have)
- Optional params (SHOULD have if needed)
- Badge params: badgeCount, badge, badgeKey (if section shows count/badge)

STEP 4: VERIFY position matches layout
- 3-col grid: left/center/right
- 2-col grid: left/right
- Single: full

STEP 5: VERIFY states completeness
- Data sections (tables, lists): MUST have loading/error/empty
- Static sections (filters, forms): can have none

Output per section:
```
## SECTION: [name]

- Title: "[text]"
- TitleKey: "page.[key]"
- Purpose: [one sentence]
- Position: [left/center/right/full] - [matches layout: yes/no]
- Loading: [skeleton/none] - [implementation]
- Error: [inline/none] - [implementation]
- Empty: [message/none] - [implementation]
- Partials:
  - [partial]: [required params], [optional params used]
```

MAX 20 lines per section. DO NOT write code.
```

**EXAMPLE:**
```
## SECTION: Filters

- Title: "Filters"
- TitleKey: "page.filters"
- Purpose: Filter orders by date, status, supplier
- Position: left
- Loading: none (static)
- Error: none
- Empty: none
- Partials: glass-panel (title, titleKey, hasBody), custom-select (id, fieldId), datepicker (id, fieldId)

## SECTION: Orders Table

- Title: "Orders"
- TitleKey: "page.orders"
- Purpose: Display orders list with actions
- Position: right
- Loading: skeleton (skeletonWidth="100%", skeletonHeight="300px")
- Error: inline "Failed to load orders"
- Empty: message "No orders found"
- Partials: glass-panel (title, titleKey, loading, skeletonWidth, skeletonHeight, hasBody, badgeCount, badge, badgeKey), table-row-actions (editAction, deleteAction)
```

---

### Prompt 6: Define Modals & Interactions
```
Define MODALS and INTERACTIONS for [new-page].html:

Sections from Prompt 5: [paste section names]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
Check modal partial params before defining.

STEP 2: FOR EACH modal define:
- Title and i18n key (format: modal.[key])
- Purpose (one sentence)
- Size (small/medium/large)
- Fields (max 8 fields per modal)
- Partials with ALL params

STEP 3: VERIFY modal partial params
Modal requires: id
Modal optional: titleKey, hasFooter
List ALL params for each modal.

STEP 4: DEFINE interactions with explicit triggers
Format: [Source] -> [Target]: [trigger event]
Examples:
- Filters form -> Orders Table: on filter change (JS: reload)
- Create button -> Create Modal: on click (JS: openModal)
- Table row edit -> Edit Modal: on click (JS: openModal with data)

STEP 5: DEFINE CSS NEEDED
List new CSS classes needed:
- Modal-specific classes
- Interaction-related classes
- Animation classes

Output:
```
## MODALS

1. [Name]
   - TitleKey: "modal.[key]"
   - Purpose: [one sentence]
   - Size: [small/medium/large]
   - Fields: [list, max 8]
   - Partials:
     - modal: id="[id]", titleKey="modal.[key]", hasFooter="true"
     - [other partials with params]

## INTERACTIONS

- [Source] -> [Target]: [trigger] (JS: [function name])
- [Source] -> [Target]: [trigger] (JS: [function name])

## CSS NEEDED (new)

- [class]: [purpose]
- [class]: [purpose]
```

MAX 25 lines. DO NOT write code.
```

**EXAMPLE:**
```
## MODALS

1. Create Order
   - TitleKey: "modal.create_order"
   - Purpose: Create new order
   - Fields: supplier, products, quantity, delivery_date, notes
   - Size: medium
   - Partials: modal (id, titleKey, hasFooter), custom-select, datepicker, input-group

## INTERACTIONS

- Filters form -> Orders Table: filter change reloads table
- Create button -> Create Order modal: opens modal
- Table row edit -> Edit Order modal: opens with data

## CSS NEEDED (new)

- .orders-grid: 2-column layout
- .filter-row: filter input row spacing
```

### Prompt 7: Validate Partials
```
Validate PARTIALS for [new-page].html:

Sections from Prompt 5: [paste section partials]
Modals from Prompt 6: [paste modal partials]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
DO NOT PROCEED without reading this file!

STEP 2: FOR EACH partial check:
- Does partial exist in PARTIAL_SPECS.md?
- Are required params present in definition?
- Are optional params appropriate for use case?

STEP 3: VERIFY badge params
If section has badge/count, check:
- badgeCount param present
- badge param present (badge text)
- badgeKey param present (i18n key)

STEP 4: VERIFY nested partials
If partial uses other partials inside:
- Check nested partial exists
- Check nested partial params

STEP 5: CROSS-REFERENCE with Prompt 5 & 6
Ensure all partials from sections and modals are validated.

Output:
```
## PARTIALS VALIDATION

[ ] [partial]: [exists / NOT FOUND]
    - Required params: [present / MISSING: list]
    - Optional params: [appropriate / MISSING: list]
    - Badge params: [present / N/A]

[ ] [partial]: [exists / NOT FOUND]
    - Required params: [present / MISSING: list]
    - Optional params: [appropriate / MISSING: list]

MISSING PARTIALS: [list / none]
MISSING PARAMS: [list / none]

STATUS: [VALID / NEEDS FIX: list issues]
```

MAX 20 lines. DO NOT write code.
```

**EXAMPLE:**
```
## PARTIALS VALIDATION

[ ] glass-panel: exists - required params present
[ ] custom-select: exists - required params present
[ ] datepicker: exists - required params present
[ ] modal: exists - required params present
[ ] table-row-actions: exists - required params present

STATUS: VALID
```

---

### Prompt 8: Validate Layout & CSS
```
Validate LAYOUT and CSS for [new-page].html:

Layout from Prompt 4: [paste layout]
CSS from Prompt 6: [paste CSS needed]

STEP 1: VERIFY container class exists
Grep CSS for container class:
Command: grep -r "[container-class]" demo/assets/css/
If NOT FOUND and not NEW: ERROR - class missing

STEP 2: CHECK layout constraints
- Grid columns <= 3? (more breaks layout)
- Sections count <= 6? (more overloads page)
- Modal fields <= 8? (more overloads modal)

STEP 3: VERIFY new CSS classes
- New classes <= 5? (more indicates over-engineering)
- Each new class has purpose documented?
- Naming follows convention? (prefix-, -suffix patterns)

STEP 4: VERIFY i18n key patterns
Check all i18n keys follow patterns:
- page.[key] - for page sections
- modal.[key] - for modals
- side.[key] - for sidebar
- form.[key] - for form labels
- btn.[key] - for buttons
- msg.[key] - for messages

STEP 5: CROSS-REFERENCE with Prompt 3 & 4
Ensure:
- Container matches grid decision
- Columns match layout definition
- Breakpoint matches responsive definition

Output:
```
## LAYOUT & CSS VALIDATION

LAYOUT:
[ ] Grid columns: [valid / too many: N]
[ ] Sections count: [valid / too many: N]

MODALS:
[ ] Fields count: [valid / too many: N]

CSS:
[ ] Container: [exists / NEW / MISSING]
[ ] New classes: [N] ([valid / too many])
[ ] Naming convention: [valid / issues: list]

I18N KEYS:
[ ] Pattern: [valid / issues: list]
[ ] All keys documented: [yes / no]

CROSS-REFERENCE:
[ ] Container matches grid: [yes / no]
[ ] Columns match layout: [yes / no]

STATUS: [VALID / NEEDS FIX: list issues]
```

MAX 20 lines. DO NOT write code.
```

**EXAMPLE:**
```
## LAYOUT & CSS VALIDATION

LAYOUT:
[ ] Grid columns: valid (2)
[ ] Sections count: valid (2)

MODALS:
[ ] Fields count: valid (5)

CSS:
[ ] Container: new (ok) - .orders-grid
[ ] New classes: 2 (valid)

I18N KEYS:
[ ] Pattern: valid

STATUS: VALID
```

---

### Prompt 9: Validate States & Responsive
```
Validate STATES and RESPONSIVE for [new-page].html:

Sections from Prompt 5: [paste sections with states]
Layout from Prompt 4: [paste layout]

STEP 1: VERIFY states completeness
For each section check:
- Has loading state? (data sections MUST have)
- Has error state? (data sections MUST have)
- Has empty state? (data sections MUST have)
- Static sections can have "none" for all

STEP 2: VERIFY mobile stacking
Check layout defines:
- Which columns stack on mobile?
- In what order? (first column on top?)
- At which breakpoint?

STEP 3: VERIFY breakpoint matches existing
Grep CSS for @media queries:
Command: grep -r "@media" demo/assets/css/
Check if breakpoint used in layout matches existing:
- 992px (standard mobile stacking)
- 1200px (large screen intermediate)
If custom breakpoint: WARN - may need new @media rule

STEP 4: CROSS-REFERENCE with Prompt 3 & 4
Ensure:
- Breakpoint matches grid decision
- Stacking matches layout definition
- Responsive behavior consistent

Output:
```
## STATES & RESPONSIVE VALIDATION

STATES:
[ ] All sections have states: [yes / MISSING in: names]
[ ] Data sections complete: [yes / INCOMPLETE: names]
[ ] Static sections appropriate: [yes / ISSUES: names]

RESPONSIVE:
[ ] Mobile stacking: [defined / MISSING]
[ ] Stacking order: [defined / MISSING]
[ ] Breakpoint: [matches existing: 992px/1200px / CUSTOM: needs @media]

CROSS-REFERENCE:
[ ] Breakpoint matches grid: [yes / no]
[ ] Stacking matches layout: [yes / no]

ISSUES: [list / none]

STATUS: [VALID / NEEDS FIX: list issues]
```

MAX 15 lines. DO NOT write code.
```

**EXAMPLE:**
```
## STATES & RESPONSIVE VALIDATION

STATES:
[ ] All sections have states: yes

RESPONSIVE:
[ ] Mobile stacking: defined (stacks on mobile)
[ ] Breakpoint: matches existing (992px)

STATUS: VALID
```

---

## PHASE 2: PARTIALS

### Prompt 10: List Partials by Section
```
List PARTIALS for each section in [new-page].html:

INPUT REQUIRED: Sections from Prompt 5
IF INPUT missing: ERROR - run Prompt 5 first, STOP

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
EXTRACT and OUTPUT:
- Container partials: [list names]
- UI partials: [list names]
- Input partials: [list names]
- Options partials: [list names]
IF OUTPUT empty: ERROR - PARTIAL_SPECS.md not read, STOP

STEP 2: IDENTIFY partials for each section from INPUT
For each section:
- Container partials (glass-panel, modal)
- UI partials (custom-select, datepicker, etc.)
- Input partials (input-group, multi-select, etc.)
- Action partials (table-row-actions)

STEP 3: CHECK DEPENDENCIES
For each partial that needs options:
- custom-select needs: currencies / units / supplier_statuses
- input-suffix-select needs: currencies or units
- tag-input may need: tag

STEP 4: VERIFY options partials exist
Command: ls demo/panini/partials/options/[name].html
If NOT FOUND: WARN - options partial missing

STEP 5: VERIFY partials exist in directory
Command: ls demo/panini/partials/[category]/
Check each partial exists before listing.

## CHECKPOINT

INPUT RECEIVED: [yes/no - sections from Prompt 5]
PARTIAL_SPECS.md READ: [yes/no - output produced]
PARTIALS VERIFIED: [N partials checked / NOT VERIFIED]

STATUS: [VALID / NEEDS FIX: list issues]

IF NEEDS FIX: STOP - fix issues, re-run this prompt
IF VALID: Proceed to Prompt 11, bring Partials list

Output:
```
## SECTION: [name]

PARTIALS:
- [partial-name] - [purpose] - [VERIFIED: exists / NOT FOUND]
- [options-name] - [dependency for custom-select] - [VERIFIED: exists / NOT FOUND]

DEPENDENCIES:
- [partial] requires [options partial] - [SATISFIED / MISSING]
```

MAX 30 lines. DO NOT write code.
```

**EXAMPLE:**
```
## CHECKPOINT

INPUT RECEIVED: yes - 4 sections from Prompt 5
PARTIAL_SPECS.md READ: yes - 37 partials extracted
PARTIALS VERIFIED: 12 partials checked

STATUS: VALID

## SECTION: Filters

PARTIALS:
- glass-panel - container for filters - VERIFIED: exists
- custom-select (status) - status dropdown - VERIFIED: exists
- supplier_statuses - options for status select - VERIFIED: exists
- datepicker (date from) - date range start - VERIFIED: exists
- datepicker (date to) - date range end - VERIFIED: exists

DEPENDENCIES:
- custom-select (status) requires supplier_statuses - SATISFIED

## SECTION: Orders Table

PARTIALS:
- glass-panel - container with loading state - VERIFIED: exists
- table-row-actions - edit/delete buttons per row - VERIFIED: exists

DEPENDENCIES: none
```

---

### Prompt 11: Map Params for UI Partials
```
Map PARAMS for UI partials in [new-page].html:

INPUT REQUIRED: UI partials from Prompt 10
IF INPUT missing: ERROR - run Prompt 10 first, STOP

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
EXTRACT and OUTPUT:
- UI partials with required params: [list each with required params]
- UI partials with i18n params: [list titleKey, labelKey, placeholderKey, etc.]
IF OUTPUT empty: ERROR - PARTIAL_SPECS.md not read, STOP

STEP 2: FOR EACH UI partial from INPUT:
- Required params (must have)
- Optional params (useful for this page)
- Our values (what we'll pass)

STEP 3: VERIFY params from specs
If param not in PARTIAL_SPECS.md:
- Read actual partial file from demo/panini/partials/ui/[name].html
- Extract params from partial code

STEP 4: CROSS-REFERENCE with Prompt 10
Ensure:
- Partial exists (from 10 verification)
- Options partial linked (for custom-select)

## CHECKPOINT

INPUT RECEIVED: [yes/no - UI partials from Prompt 10]
PARTIAL_SPECS.md READ: [yes/no - output produced]
CROSS-REFERENCE: [yes/no - matches Prompt 10]

STATUS: [VALID / NEEDS FIX: list issues]

IF NEEDS FIX: STOP - fix issues, re-run this prompt
IF VALID: Proceed to Prompt 12, bring Params list

Output:
```
## PARTIAL: [name] ([section])

Required: [param names]
Optional: [relevant params]
Our values: [param="value" list]
Options: [options partial name if applicable]
```

MAX 30 lines. DO NOT write code.
```

**EXAMPLE:**
```
## CHECKPOINT

INPUT RECEIVED: yes - 5 UI partials from Prompt 10
PARTIAL_SPECS.md READ: yes - required params extracted
CROSS-REFERENCE: yes - all partials match

STATUS: VALID

## PARTIAL: custom-select (status filter)

Required: id
Optional: fieldId, defaultValue
Our values: id="status-filter", fieldId="order_status", defaultValue="all"

## PARTIAL: datepicker (date from)

Required: id
Optional: fieldId, value, displayDate
Our values: id="date-from", fieldId="date_from"

## PARTIAL: modal (create order)

Required: id, title
Optional: titleKey, size, hasFooter, cancelLabelKey, saveLabelKey
Our values: id="create-modal", title="Create Order", titleKey="modal.create_order", size="medium", hasFooter=true
```

---

### Prompt 12: Map Params for Container Partials
```
Map PARAMS for container partials in [new-page].html:

INPUT REQUIRED: Container partials from Prompt 10
IF INPUT missing: ERROR - run Prompt 10 first, STOP

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
EXTRACT and OUTPUT:
- Container partials with required params: [list each with required params]
- Container partials with i18n params: [list titleKey, labelKey, etc.]
- Badge params available: [badgeCount, badge, badgeKey]
IF OUTPUT empty: ERROR - PARTIAL_SPECS.md not read, STOP

STEP 2: FOR EACH container partial from INPUT:
- Required params (must have)
- Optional params (useful for this page)
- Our values (what we'll pass)

STEP 3: VERIFY params from specs
If param not in PARTIAL_SPECS.md:
- Read actual partial file from demo/panini/partials/[category]/[name].html
- Extract params from partial code

STEP 4: INCLUDE badge params for glass-panel
If section shows count/badge:
- badgeCount: number or variable
- badge: text to show
- badgeKey: i18n key for badge

STEP 5: CROSS-REFERENCE with Prompt 10
Ensure partial exists (from 10 verification)

## CHECKPOINT

INPUT RECEIVED: [yes/no - container partials from Prompt 10]
PARTIAL_SPECS.md READ: [yes/no - output produced]
CROSS-REFERENCE: [yes/no - matches Prompt 10]

STATUS: [VALID / NEEDS FIX: list issues]

IF NEEDS FIX: STOP - fix issues, re-run this prompt
IF VALID: Proceed to Prompt 13, bring all params

Output:
```
## PARTIAL: [name] ([section])

Required: [param names]
Optional: [relevant params]
Our values: [param="value" list]
Badge: [badge params if applicable]
```

MAX 30 lines. DO NOT write code.
```

**EXAMPLE:**
```
## CHECKPOINT

INPUT RECEIVED: yes - 3 container partials from Prompt 10
PARTIAL_SPECS.md READ: yes - required params extracted
CROSS-REFERENCE: yes - all partials match

STATUS: VALID

## PARTIAL: glass-panel (Filters section)

Required: title
Optional: titleKey, hasBody
Our values: title="Filters", titleKey="page.filters", hasBody=true

## PARTIAL: glass-panel (Orders Table section)

Required: title
Optional: titleKey, loading, skeletonWidth, skeletonHeight, hasBody, badgeCount, badge, badgeKey
Our values: title="Orders", titleKey="page.orders", loading=true, skeletonWidth="100%", skeletonHeight="300px", hasBody=true, badgeCount=5, badge="5", badgeKey="page.orders_count"

## PARTIAL: input-group (price field)

Required: (none)
Optional: label, labelKey, hint, hintTooltip
Our values: label="Price", labelKey="field.price", hint="Enter price in selected currency"
```

---

### Prompt 13: Identify New Partials
```
Identify NEW partials needed for [new-page].html:

Existing partials from Prompt 11 and 12: [paste combined list]

STEP 1: IDENTIFY missing components
What functionality is missing from existing partials?

STEP 2: FOR EACH missing component:
1. Check if existing partial can be extended
2. If NEW needed - define spec

STEP 3: VERIFY "Similar to" partial exists
Command: ls demo/panini/partials/[category]/[similar-name].html
If NOT FOUND: STOP - must have similar partial to reference

STEP 4: READ "Similar to" partial
Read the similar partial file to understand structure.
DO NOT create new partial without reference!

STEP 5: COUNT new partials
If N > 3: STOP - simplify page first
Too many new partials indicates over-engineering.

Output:
```
## NEW PARTIALS ANALYSIS

MISSING: [component description]
- Can existing work? [yes/no - reason]
- If NO:
  - Name: [name].html
  - Purpose: [one sentence]
  - Params: [list with types]
  - Similar to: [existing partial] (VERIFIED: exists, READ: yes/no)
  - Category: [ui/atoms/components/sections/tables/layout]

SUMMARY:
- New partials: [N]
- Status: [OK / STOP - simplify page first (N > 3)]
```

MAX 25 lines. DO NOT write code.
```

**EXAMPLE:**
```
## NEW PARTIALS ANALYSIS

MISSING: Order status badge in table
- Can existing work? no - need colored status indicator
- New partial:
  - Name: order-status-badge.html
  - Purpose: Display colored status badge
  - Params: status (string, required), size (string, optional)
  - Similar to: tag.html (VERIFIED: exists in ui/)

MISSING: Order row actions
- Can existing work? yes - table-row-actions.html
- Use with: editAction="editOrder(id)", deleteAction="deleteOrder(id)"

SUMMARY:
- New partials: 1
- Status: OK (<= 3)
```

---

### Prompt 14: Validate Partials List
```
VALIDATE partials for [new-page].html:

Existing partials: [paste from Prompt 11 and 12]
New partials: [paste from Prompt 13]
Dependencies from Prompt 10: [paste dependencies list]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
DO NOT PROCEED without reading this file!

STEP 2: FOR EACH EXISTING partial:
- EXISTS in demo/panini/partials/ ?
- Required params present in PARTIAL_SPECS.md?
- Optional params appropriate?

STEP 3: FOR EACH NEW partial:
- Similar exists? (from Prompt 14)
- Similar was READ? (from Prompt 14)
- Can avoid creating?

STEP 4: VERIFY DEPENDENCIES
Cross-reference with Prompt 10:
- custom-select has options partial?
- input-suffix-select has currencies/units?
- All dependencies SATISFIED?

STEP 5: COUNT total partials
- Total partials: [N]
- If N > 10: WARN - review if all needed
- If N > 15: STOP - simplify page

Output:
```
## VALIDATION RESULT

EXISTING PARTIALS:
[ ] [name]: required params [present / MISSING: list]
[ ] [name]: required params [present / MISSING: list]

NEW PARTIALS:
[ ] [name]: [necessary / can reuse existing] - similar [VERIFIED / NOT READ]

DEPENDENCIES:
[ ] [partial] has [options partial] - [SATISFIED / MISSING]

COUNT: [N] partials total
STATUS: [OK / WARN: review / STOP: simplify]

OVERALL STATUS: [VALID / NEEDS REVISION: list issues]
```

MAX 25 lines. DO NOT write code.
```

**EXAMPLE:**
```
## VALIDATION RESULT

EXISTING PARTIALS:
[ ] glass-panel: required params present
[ ] custom-select: required params present
[ ] supplier_statuses: required params present
[ ] datepicker: required params present
[ ] table-row-actions: required params present

NEW PARTIALS:
[ ] order-status-badge: necessary (no existing alternative)

DEPENDENCIES:
[ ] custom-select (status) has supplier_statuses

COUNT: 6 partials total

STATUS: VALID
```

---

## PHASE 3: NEW PARTIALS (if needed)

### Prompt 15: Create Simple Partial
```
Create ONE simple partial: [name].html

Spec from Prompt 14:
- Purpose: [text]
- Params: [list with types]
- Similar to: [partial name]
- Category: [ui/atoms/components/sections/tables/layout]
- Complexity: SIMPLE (no helpers, no nested partials)

STEP 1: READ the "Similar to" partial file
Command: Read demo/panini/partials/[category]/[similar-name].html
DO NOT PROCEED without reading this file!

STEP 2: VERIFY partial doesn't exist
Command: ls demo/panini/partials/[category]/[name].html
If EXISTS: STOP - choose different name

STEP 3: EXTRACT CSS classes from similar partial
List all CSS classes used in similar partial.
These are the patterns to follow.

STEP 4: VERIFY CSS classes exist (optional)
If using existing classes: grep CSS to verify.
If creating new classes: note for PHASE 9.

STEP 5: CREATE partial following patterns:
- Follow HTML structure from reference
- Use class naming: glass-*, panel-*, tag-*, status-*, etc.
- Include data-i18n for visible text
- Handle optional params with {{#if}}
- Save to: demo/panini/partials/[category]/[name].html
- MAX 20 lines

STEP 6: LIST i18n keys needed
All data-i18n values need translations in lang files.

Output:
1. Partial HTML code
2. Usage example: {{> [name] param="value"}}
3. CSS classes used: [list - existing/new]
4. i18n keys needed: [list]
```

**EXAMPLE:**
```html
<!-- demo/panini/partials/ui/order-status-badge.html -->
<span class="status-badge status-{{status}}">
  <span data-i18n="status.{{status}}">{{status}}</span>
</span>

<!-- Usage: -->
{{> order-status-badge status="active"}}
```

---

### Prompt 16: Create Partial with Helpers
```
Create ONE partial with helpers: [name].html

Spec from Prompt 14:
- Purpose: [text]
- Params: [list with types]
- Similar to: [partial name]
- Category: [ui/atoms/components/sections/tables/layout]
- Complexity: HELPERS (uses times, lte, eq, concat)

STEP 1: READ the "Similar to" partial file
Command: Read demo/panini/partials/[category]/[similar-name].html
DO NOT PROCEED without reading this file!

STEP 2: VERIFY partial doesn't exist
Command: ls demo/panini/partials/[category]/[name].html
If EXISTS: STOP - choose different name

STEP 3: VERIFY helpers exist
Check helper files in demo/panini/helpers/:
- times.js - for iteration
- lte.js - for <= comparison
- eq.js - for equality
- concat.js - for string concatenation

STEP 4: IDENTIFY helpers needed
From similar partial, list:
- Which helpers are used
- Helper syntax patterns
- Parent context usage (../)

STEP 5: CREATE partial with helpers:
- Block syntax: {{#times N}}...{{/times}}
- Parent context: ../paramName (access parent scope)
- Inline helpers: (lte this ../rating)
- Save to: demo/panini/partials/[category]/[name].html
- MAX 30 lines

STEP 6: VERIFY helper syntax
Common errors to avoid:
- Missing {{/helper}} closing tag
- Wrong helper name (time vs times)
- Missing ../ for parent context

STEP 7: LIST i18n keys needed

Output:
1. Partial HTML code
2. Usage example: {{> [name] param="value"}}
3. Helpers used: [list with syntax check]
4. CSS classes used: [list - existing/new]
5. i18n keys needed: [list]
```

**EXAMPLE:**
```html
<!-- demo/panini/partials/ui/rating-display.html -->
<div class="rating-stars">
  {{#times 5}}
  <svg class="star-svg{{#if (lte this ../rating)}} active{{/if}}" width="24" height="24">
    <path d="M12 2l3.09 6.26L22 9.27z"/>
  </svg>
  {{/times}}
</div>

<!-- Usage: -->
{{> rating-display rating=4}}

<!-- Note: ../rating accesses parent scope -->
```

---

### Prompt 17: Create Partial with Nested Partials
```
Create ONE partial with nested partials: [name].html

Spec from Prompt 14:
- Purpose: [text]
- Params: [list with types]
- Similar to: [partial name]
- Category: [ui/atoms/components/sections/tables/layout]
- Complexity: NESTED (calls other partials)

STEP 1: READ the "Similar to" partial file
Command: Read demo/panini/partials/[category]/[similar-name].html
DO NOT PROCEED without reading this file!

STEP 2: VERIFY partial doesn't exist
Command: ls demo/panini/partials/[category]/[name].html
If EXISTS: STOP - choose different name

STEP 3: IDENTIFY nested partials needed
From similar partial, list:
- Which nested partials are called
- What params are passed to them

STEP 4: VERIFY each nested partial exists
For each nested partial:
Command: ls demo/panini/partials/[nested-category]/[nested-name].html
If NOT FOUND: STOP - nested partial missing

STEP 5: READ nested partial to verify params
Read each nested partial file to check:
- Required params for nested partial
- Optional params available
- Correct param names

STEP 6: CREATE partial with nested partials:
- Nested partial syntax: {{> partial-name param="value"}}
- Common nested partials: icon, tag, custom-select
- Pass params to nested: {{> icon name="x-close" width="14"}}
- Save to: demo/panini/partials/[category]/[name].html
- MAX 20 lines

STEP 7: LIST i18n keys needed

Output:
1. Partial HTML code
2. Usage example: {{> [name] param="value"}}
3. Nested partials used: [list with VERIFIED params]
4. CSS classes used: [list - existing/new]
5. i18n keys needed: [list]
```

**EXAMPLE:**
```html
<!-- demo/panini/partials/ui/tag.html -->
<div class="tag">{{label}}{{> icon name="x-close" width="14" class="tag-remove"}}</div>

<!-- Usage: -->
{{> tag label="Electronics"}}

<!-- Nested partials used: icon -->
```

### Prompt 18: Validate Partial Code
```
VALIDATE CODE for [name].html:

Partial created: [paste from Prompt 15/16/17]

STEP 1: CROSS-REFERENCE with Prompt 14
Check partial matches what was planned:
- Same category?
- Same params?
- Same complexity?

STEP 2: CHECK helpers (if used)
For each helper used:
- VERIFY: Read demo/panini/helpers/[helper].js
- Check helper name is correct (times not time)
- Block syntax: {{#times N}}...{{/times}}
- Closing tag present?
- Parent context: ../paramName

STEP 3: CHECK nested partials (if used)
For each nested partial:
- VERIFY: ls demo/panini/partials/[category]/[nested].html
- If NOT FOUND: ERROR - nested partial missing
- Check params passed match nested partial's requirements

STEP 4: CHECK params usage
- All declared params used?
- Optional params have {{#if}} handling?
- No hardcoded values that should be params?

STEP 5: CHECK i18n keys
- All visible text has data-i18n?
- Keys follow pattern (page.*, status.*, etc.)?

Common errors:
- Missing {{/helper}} closing tag
- Wrong helper name (time vs times)
- Missing ../ for parent context
- Nested partial doesn't exist
- Hardcoded text without i18n

Output:
```
## CODE VALIDATION

CROSS-REFERENCE: [matches Prompt 14 / MISMATCH: list]

HELPERS: [valid / issues: list / N/A]
- [helper]: [VERIFIED exists / NOT FOUND]
- Syntax: [valid / issues]

NESTED PARTIALS: [valid / issues: list / N/A]
- [partial]: [VERIFIED exists / NOT FOUND]
- Params: [valid / MISMATCH]

PARAMS: [valid / issues: list]
I18N KEYS: [valid / issues: list]

STATUS: [CODE VALID / NEEDS FIX: list]
```

MAX 20 lines. DO NOT write code.
```

**EXAMPLE 1: Valid code**
```
## CODE VALIDATION

[ ] Helpers: valid (times, lte used correctly)
[ ] Nested partials: valid (icon exists)
[ ] Params usage: valid (status used, size optional)

STATUS: CODE VALID
```

**EXAMPLE 2: Invalid code**
```
## CODE VALIDATION

[ ] Helpers: ERROR - missing {{/times}} closing tag
[ ] Nested partials: missing - {{> custom-icon}} not found
[ ] Params usage: valid

STATUS: NEEDS FIX

Fix:
1. Add {{/times}} after loop content
2. Use {{> icon}} instead of custom-icon
```

---

### Prompt 19: Validate Partial Integration
```
VALIDATE INTEGRATION for [name].html:

Partial code: [paste validated code from 18]
Saved to: demo/panini/partials/[category]/[name].html

STEP 1: VERIFY file saved
Command: ls demo/panini/partials/[category]/[name].html
If NOT FOUND: ERROR - partial not saved

STEP 2: EXTRACT CSS classes from partial
Grep for all class attributes:
Command: grep -o 'class="[^"]*"' demo/panini/partials/[category]/[name].html
List all unique CSS classes.

STEP 3: VERIFY each CSS class exists
For each class:
Command: grep -r "\.[class-name]" demo/assets/css/
If NOT FOUND: mark as needs definition

STEP 4: RUN build test
Command: cd demo && gulp build
If ERROR: list error details

STEP 5: CHECK registration needed
- Add to PARTIAL_SPECS.md?
- Add i18n keys to translations?

Output:
```
## INTEGRATION VALIDATION

FILE SAVED: [yes / no - ERROR]

CSS CLASSES:
- [class]: [exists in: file / NEEDS DEFINITION]
- [class]: [exists in: file / NEEDS DEFINITION]

BUILD: [success / ERROR: details]

REGISTRATION NEEDED:
[ ] PARTIAL_SPECS.md: [name, params, usage]
[ ] i18n keys: [list]

STATUS: [INTEGRATION VALID / NEEDS WORK: list]

NEXT STEPS:
- Add CSS for: [missing classes]
- Add to PARTIAL_SPECS.md
- Add i18n keys to lang files
```

MAX 20 lines. DO NOT write code.
```

**EXAMPLE 1: Valid integration**
```
## INTEGRATION VALIDATION

[ ] CSS classes: all exist (status-badge in _status-pills.css)
[ ] Build: success
[ ] Registration: needed

STATUS: INTEGRATION VALID

NEXT STEPS:
- Add to PARTIAL_SPECS.md: status-badge, params: status, size
- Add i18n keys: status.*
```

**EXAMPLE 2: Needs CSS work**
```
## INTEGRATION VALIDATION

[ ] CSS classes: need definition - status-pill-new
[ ] Build: success
[ ] Registration: needed

STATUS: NEEDS WORK

NEXT STEPS:
- Add .status-pill-new to CSS
- Add to PARTIAL_SPECS.md
- Add i18n keys
```

Repeat Prompts 15-19 for each new partial (one at a time).

**Prompt selection guide:**
- 15: Simple partial (no helpers, no nested)
- 16: With helpers (times, lte, etc.)
- 17: With nested partials ({{> icon}})
- 18: Always (code validation)
- 19: Always (integration validation)

---

## PHASE 4: DATA

### Prompt 20: Page State & Simple Data
```
Define PAGE STATE and SIMPLE DATA for [page].html

Sections from Prompt 5: [paste section names - ONLY simple form sections]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
Check partial params for data fields needed.

STEP 2: READ existing JS files in demo/assets/js/
Find 1-2 similar pages and extract:
- Variable naming patterns
- Data structure patterns
- Initial value patterns
DO NOT PROCEED without reading existing JS!

STEP 3: CROSS-REFERENCE with Prompt 11 and 12
Ensure data fields match partial params:
- custom-select needs options array
- datepicker needs Date or null
- input needs string

STEP 4: DEFINE data following patterns
NAMING CONVENTION:
- JS variables: camelCase (filtersData, formData)
- HTML IDs: kebab-case (status-filter, date-from)
- Map: HTML id="status-filter" -> JS statusFilter OR status (documented)

STEP 5: VERIFY initial values
- Selects: NOT null - use 'all' or first option
- Dates: null or Date object
- Strings: '' or default value

For each SIMPLE section (forms, filters), define:
- State variables (loading, error, selected)
- Form fields with:
  - Field name (camelCase)
  - HTML ID mapping (kebab-case)
  - Initial value (NOT null for selects)
  - Type annotation

DO NOT define collections/arrays here - use Prompt 21.

Output:
```
## PAGE STATE

const pageState = {
  loading: false,
  error: null
};

## SECTION: [name] (simple form)

const [section]Data = {
  // fieldName: value // id="html-id" | Type
  status: 'all',      // id="status-filter" | string
  dateFrom: null,     // id="date-from" | Date | null
};

PATTERNS USED: [from existing JS files]
```

MAX 25 lines. DO NOT write JS file.
```

**EXAMPLE:**
```js
## PAGE STATE

const pageState = {
  loading: false,
  error: null
};

## SECTION: Filters

const filtersData = {
  status: 'all',      // id="status-filter" | string - matches select options
  dateFrom: null,     // id="date-from" | Date | null
  dateTo: null,       // id="date-to" | Date | null
  supplier: 'all'     // id="supplier-filter" | string - NOT null, has default
};
```

**COMMON ERRORS:**
```js
// WRONG: null for select with default
status: null          // should be: 'all' or first option

// WRONG: wrong naming convention
status_filter: 'all'  // should be: statusFilter or status

// WRONG: missing HTML ID mapping
status: 'all'         // missing: // id="status-filter"
```

---

### Prompt 21: Collections & Pagination
```
Define COLLECTIONS and PAGINATION for [page].html

Sections from Prompt 5: [paste section names - ONLY table/list sections]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
Check table partial requirements.

STEP 2: READ existing JS files in demo/assets/js/
Find 1-2 pages with tables and extract:
- Collection naming patterns
- Pagination structure
- Selected/expanded patterns
DO NOT PROCEED without reading existing JS!

STEP 3: CROSS-REFERENCE with Prompt 5
Ensure each table section has collection data.

STEP 4: DEFINE collections following patterns
For each COLLECTION section (tables, lists), define:
- Array variable (empty initial: [])
- Pagination structure (if applicable)
- Selected/expanded state (if applicable)
- Type reference (Array<Type>)

STEP 5: VERIFY initial values
- Arrays: [] NOT null
- Pagination: { page: 1, limit: 20, total: 0 }
- Selected: [] for multi, null for single

Output:
```
## SECTION: [name] (collection)

const [section]Data = {
  items: [],              // Array<Type> - empty initial
  pagination: {           // if applicable
    page: 1,
    limit: 20,
    total: 0
  },
  selected: [],           // if applicable
  expanded: null          // if applicable
};

PATTERNS USED: [from existing JS files]
```

MAX 25 lines. DO NOT write JS file.
```

**EXAMPLE:**
```js
## SECTION: Orders Table

const ordersData = {
  orders: [],             // Array<Order> - empty initial
  pagination: {
    page: 1,
    limit: 20,
    total: 0
  }
};

## SECTION: Products List

const productsData = {
  products: [],           // Array<Product>
  selected: [],           // Array<string> - selected IDs
  expanded: null          // string | null - expanded category
};
```

**COMMON ERRORS:**
```js
// WRONG: null for array
orders: null             // should be: [] (empty array)

// WRONG: missing pagination for table
orders: []               // missing: pagination for server-side

// WRONG: wrong type reference
orders: []               // missing: // Array<Order>
```

---

### Prompt 22: Types & Nested Structures
```
Define TYPES for [page].html

Data from Prompt 20/21: [paste section data]

STEP 1: READ existing types in demo/assets/js/
Check if similar types already exist.
REUSE if exists - do not duplicate!

STEP 2: CROSS-REFERENCE with API contracts
If API documentation available, read it.
If not, check existing API calls for response structure.

STEP 3: DEFINE types following rules
TYPE RULES:
- Required by default (no ?)
- Optional only if API returns optional (add ?)
- Use union types for status: 'pending' | 'completed'
- Use Date for dates, string for IDs
- Match backend API response field names EXACTLY

STEP 4: VERIFY field names match API
Common error: frontend uses different names than backend.
Check: API returns "supplier" not "supplierId".

For each collection/array, define TypeScript-like interface:
- Field names match API response
- Types: string, number, boolean, Date, Array<Type>
- Optional fields: field? (ONLY if API returns optional)

Output:
```
## TYPES

type [Type]Status = 'pending' | 'completed';

interface [Type] {
  id: string;              // required
  fieldName: string;       // required
  optionalField?: string;  // optional (API returns this)
}

EXISTING TYPES REUSED: [list / none]
API FIELDS MATCHED: [yes / needs verification]
```

MAX 30 lines. DO NOT write JS file.
```

**EXAMPLE:**
```js
## TYPES

type OrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

interface Order {
  id: string;
  supplier: string;
  status: OrderStatus;     // union type, not string
  total: number;
  currency: string;
  createdAt: Date;         // Date type, not string
  items: OrderItem[];
  notes?: string;          // optional - API may not return
}

interface OrderItem {
  product: string;
  quantity: number;
  unit: string;
  price: number;
}
```

**COMMON ERRORS:**
```js
// WRONG: string for status (no type safety)
status: string;           // should be: OrderStatus

// WRONG: string for date
createdAt: string;        // should be: Date

// WRONG: all fields optional
id?: string;              // should be: id: string (required)

// WRONG: wrong field name (doesn't match API)
supplierId: string;       // should be: supplier (match API)
```

---

### Prompt 23: Read APIs (GET)
```
Define READ API CONTRACTS for [page].html

Data from Prompt 20/21: [paste section data]
Types from Prompt 22: [paste types]

STEP 1: READ existing API patterns in demo/assets/js/
Find 1-2 pages with similar APIs and extract:
- Endpoint format (/api/ prefix?)
- Auth requirement pattern
- Error response format
- Loading state handling
DO NOT PROCEED without reading existing API code!

STEP 2: CROSS-REFERENCE with Prompt 20 data
Ensure response fields match data structures.

STEP 3: DEFINE APIs following patterns
For each READ operation (list, detail, search), define:
- Method: GET
- Endpoint with query params
- Auth requirement
- Request: query params (from filters)
- Response: match collection types
- Error: structure
- Loading: which variable
- Used in: which section

STEP 4: VERIFY endpoint format
Check: /api/ prefix, correct path, query param format.

STEP 5: VERIFY loading state exists
Check: loading variable defined in Prompt 20.

Output:
```
## API: [name] (GET)
- Method: GET
- Endpoint: /api/[path]?[params]
- Auth: required
- Request: { page, limit, [filter params] }
- Response: { items: Type[], pagination: {...} }
- Error: { error: string, code: number }
- Loading: [variable name] - [DEFINED in 15a / MISSING]
- Used in: [section name]
- Mock data: [yes/no]

PATTERNS USED: [from existing API files]
```

MAX 25 lines. DO NOT write code.
```

**EXAMPLE:**
```
## API: getOrders (GET)
- Method: GET
- Endpoint: /api/orders?page=1&limit=20&status=all
- Auth: required
- Request: { page, limit, status, dateFrom, dateTo, supplier }
- Response: { orders: Order[], pagination: { page, limit, total } }
- Error: { error: string, code: number }
- Loading: ordersData.loading
- Used in: Orders Table section
- Mock data: yes

## API: getOrderDetail (GET)
- Method: GET
- Endpoint: /api/orders/:id
- Auth: required
- Request: { id }
- Response: { order: Order }
- Error: { error: string, code: number }
- Loading: orderDetailData.loading
- Used in: Order Detail modal
- Mock data: yes
```

**COMMON ERRORS:**
```
// WRONG: missing pagination in response
- Response: { orders: Order[] }  // missing: pagination

// WRONG: missing query params
- Endpoint: /api/orders         // should show: ?page=1&limit=20

// WRONG: wrong endpoint format
- Endpoint: orders              // should be: /api/orders
```

---

### Prompt 24: Write APIs (POST/PUT/DELETE)
```
Define WRITE API CONTRACTS for [page].html

Data from Prompt 20: [paste form data]
Types from Prompt 22: [paste types]

STEP 1: READ existing API patterns in demo/assets/js/
Find 1-2 pages with write APIs and extract:
- Validation error format
- Success response format
- Loading state handling
DO NOT PROCEED without reading existing API code!

STEP 2: CROSS-REFERENCE with Prompt 20 form data
Ensure request body matches form fields.

STEP 3: DEFINE APIs following patterns
For each WRITE operation (create, update, delete), define:
- Method: POST/PUT/DELETE
- Endpoint with path params
- Auth requirement
- Request: body params (from forms)
- Response: created/updated item or success flag
- Error: validation errors structure
- Loading: which variable
- Used in: which modal/section

STEP 4: VERIFY loading state exists
Check: loading variable defined in Prompt 20 or modal state.

STEP 5: VERIFY validation error structure
Check: details array with field-level errors.

Output:
```
## API: [name] (POST/PUT/DELETE)
- Method: [POST/PUT/DELETE]
- Endpoint: /api/[path]/[:id]
- Auth: required
- Request: { [body params] }
- Response: { item: Type } | { success: boolean }
- Error: { error: string, code: number, details: [{ field, message }] }
- Loading: [variable name] - [DEFINED / MISSING]
- Used in: [modal name]
- Mock data: [yes/no]

PATTERNS USED: [from existing API files]
```

MAX 25 lines. DO NOT write code.
```

**EXAMPLE:**
```
## API: createOrder (POST)
- Method: POST
- Endpoint: /api/orders
- Auth: required
- Request: { supplier, items[], deliveryDate, notes }
- Response: { orderId, status }
- Error: { error: string, code: number, details: [{ field, message }] }
- Loading: modalState.creating
- Used in: Create Order modal
- Mock data: yes

## API: updateOrder (PUT)
- Method: PUT
- Endpoint: /api/orders/:id
- Auth: required
- Request: { status, notes }
- Response: { order: Order }
- Error: { error: string, code: number, details: [] }
- Loading: modalState.updating
- Used in: Edit Order modal
- Mock data: yes

## API: deleteOrder (DELETE)
- Method: DELETE
- Endpoint: /api/orders/:id
- Auth: required
- Request: { id }
- Response: { success: boolean }
- Error: { error: string, code: number }
- Loading: modalState.deleting
- Used in: Delete Confirmation modal
- Mock data: yes
```

**COMMON ERRORS:**
```
// WRONG: missing validation error details
- Error: { error: string }      // missing: details: [{ field, message }]

// WRONG: missing loading state
// should have: - Loading: modalState.creating

// WRONG: missing auth
- Auth: optional                 // should be: required (check existing)
```

---

### Prompt 25: Validate Data Mapping
```
VALIDATE DATA MAPPING for [page].html:

Data from Prompt 20: [paste simple data]
Data from Prompt 21: [paste collections]
Partials from Prompt 11/12: [paste partial params]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
Check partial params for data requirements.

STEP 2: READ HTML file (if exists)
Extract actual HTML IDs from the page.
Command: grep -o 'id="[^"]*"' demo/panini/pages/[page].html

STEP 3: CROSS-REFERENCE data with partials
For each partial used:
- Check data fields match partial params
- Check HTML ID matches JS field name (with conversion)
- Example: id="status-filter" -> statusFilter OR status

STEP 4: VERIFY initial values
- Selects have default (NOT null)?
- Forms have correct initial state?
- Arrays are empty [] (NOT null)?

STEP 5: VERIFY naming conventions
- Variables match existing code style?
- IDs match HTML element IDs?

Output:
```
## VALIDATION RESULT

DATA MAPPING:
[ ] Each section has data: [yes / missing: list]
[ ] Data fields match partial params: [yes / mismatch: list]
[ ] HTML ID -> JS field mapping: [valid / mismatch: list]

INITIAL VALUES:
[ ] Selects have defaults: [yes / null found: list]
[ ] Arrays are empty: [yes / null found: list]
[ ] Forms have correct state: [yes / issue: description]

NAMING:
[ ] Variables match code style: [yes / issue: description]
[ ] IDs match HTML: [yes / mismatch: list]

CROSS-REFERENCE:
[ ] PARTIAL_SPECS.md checked: [yes / no]
[ ] HTML IDs extracted: [yes / no - page not created yet]

STATUS: [DATA MAPPING VALID / NEEDS REVISION: list issues]
```

MAX 25 lines. DO NOT write code.
```

**EXAMPLE 1: Valid mapping**
```
## VALIDATION RESULT

DATA MAPPING:
[ ] Each section has data: yes
[ ] Data fields match partial params: yes
[ ] HTML ID -> JS field mapping: valid

INITIAL VALUES:
[ ] Selects have defaults: yes
[ ] Arrays are empty: yes
[ ] Forms have correct state: yes

NAMING:
[ ] Variables match code style: yes
[ ] IDs match HTML: yes

STATUS: DATA MAPPING VALID
```

**EXAMPLE 2: Invalid mapping**
```
## VALIDATION RESULT

DATA MAPPING:
[ ] Each section has data: yes
[ ] Data fields match partial params: MISMATCH
    - filtersData.statusType should be status (partial id="status-filter")
[ ] HTML ID -> JS field mapping: MISMATCH
    - HTML id="date-from" but JS uses dateFrom (OK: documented)
    - HTML id="supplier-filter" but JS uses supplierId (WRONG)

INITIAL VALUES:
[ ] Selects have defaults: MISMATCH
    - filtersData.supplier is null (should be 'all')
[ ] Arrays are empty: yes
[ ] Forms have correct state: yes

NAMING:
[ ] Variables match code style: yes
[ ] IDs match HTML: MISMATCH (see above)

STATUS: NEEDS REVISION
```

---

### Prompt 26: Validate API & Types
```
VALIDATE API & TYPES for [page].html:

Types from Prompt 22: [paste types]
APIs from Prompt 23: [paste GET APIs]
APIs from Prompt 24: [paste Write APIs]
Data from Prompt 20/21: [paste data variables]

STEP 1: CROSS-REFERENCE APIs with Types
For each API:
- Response fields match type fields?
- Request params match form fields?
- List any mismatches.

STEP 2: CROSS-REFERENCE APIs with Data
For each API loading state:
- Loading variable defined in Prompt 20?
- If modal: loading in modalState?
- List any missing variables.

STEP 3: VERIFY error handling
For each API:
- Has error structure?
- Validation errors have details array?
- List any missing error structures.

STEP 4: VERIFY type consistency
- Types match data initial values?
- Union types used for status (not string)?
- Date types used for dates (not string)?
- Required fields not marked optional?

STEP 5: CROSS-REFERENCE all components
Ensure Types, APIs, and Data are all aligned.

Output:
```
## VALIDATION RESULT

API CONSISTENCY:
[ ] Response matches types: [yes / mismatch: list]
[ ] Request matches form fields: [yes / mismatch: list]

LOADING STATES:
[ ] Each API has loading: [yes / missing: list]
[ ] Loading variables exist: [yes / missing: list]

ERROR HANDLING:
[ ] Each API has error: [yes / missing: list]
[ ] Validation errors have details: [yes / missing: list]

TYPE CONSISTENCY:
[ ] Types match initial values: [yes / mismatch: list]
[ ] Union types for status: [yes / string used: list]
[ ] Date types for dates: [yes / string used: list]

CROSS-REFERENCE:
[ ] Types-APIs-Data aligned: [yes / issues: list]

STATUS: [API & TYPES VALID / NEEDS REVISION: list issues]
```

MAX 25 lines. DO NOT write code.
```

**EXAMPLE 1: Valid API & Types**
```
## VALIDATION RESULT

API CONSISTENCY:
[ ] Response matches types: yes
[ ] Request matches form fields: yes

LOADING STATES:
[ ] Each API has loading: yes
[ ] Loading variables exist: yes

ERROR HANDLING:
[ ] Each API has error: yes
[ ] Validation errors have details: yes

TYPE CONSISTENCY:
[ ] Types match initial values: yes
[ ] Union types for status: yes
[ ] Date types for dates: yes

STATUS: API & TYPES VALID
```

**EXAMPLE 2: Invalid API & Types**
```
## VALIDATION RESULT

API CONSISTENCY:
[ ] Response matches types: yes
[ ] Request matches form fields: yes

LOADING STATES:
[ ] Each API has loading: MISSING
    - createOrder API has no loading state
[ ] Loading variables exist: MISSING
    - modalState.creating not defined

ERROR HANDLING:
[ ] Each API has error: yes
[ ] Validation errors have details: MISSING
    - createOrder error missing details: [{ field, message }]

TYPE CONSISTENCY:
[ ] Types match initial values: yes
[ ] Union types for status: MISMATCH
    - Order.status is string (should be OrderStatus)
[ ] Date types for dates: yes

STATUS: NEEDS REVISION
```

---

## PHASE 5: i18n (Translations)

### Prompt 27: Labels & Buttons Keys
```
List LABELS and BUTTONS i18n keys for [page].html

INPUT REQUIRED: Sections from Prompt 5, Partials from Prompt 11 and 12
IF INPUT missing: ERROR - run Prompt 5, 11, 12 first, STOP

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
EXTRACT and OUTPUT:
- Partials with titleKey: [list partials]
- Partials with labelKey: [list partials]
- Partials with actionKey: [list partials]
- Partials with badgeKey: [list partials]
IF OUTPUT empty: ERROR - PARTIAL_SPECS.md not read, STOP

STEP 2: READ existing lang files
Find reusable keys in demo/panini/lang/*.json:
- Common buttons: btn.save, btn.cancel, btn.delete, btn.close, btn.apply
- Common fields: field.status, field.date, field.price
EXTRACT and OUTPUT:
- Reusable keys found: [list keys and files]
IF OUTPUT empty: WARN - no reusable keys found

STEP 3: READ existing page HTML (if exists)
Extract data-i18n patterns from similar pages.

STEP 4: CROSS-REFERENCE with partial params from INPUT
For each partial with i18n param:
- Ensure key is defined
- Ensure partial param is annotated in output

STEP 5: DEFINE keys following naming convention
- page.* for page content (page.status, page.date_from)
- btn.* for buttons (btn.apply, btn.create_order)
- field.* for form fields (field.price, field.quantity)
- modal.* for modal titles (modal.create_order)

## CHECKPOINT

INPUT RECEIVED: [yes/no - sections and partials from Prompt 5, 11, 12]
PARTIAL_SPECS.md READ: [yes/no - i18n params extracted]
LANG FILES READ: [yes/no - reusable keys found]
CROSS-REFERENCE: [yes/no - all partials have keys]

STATUS: [VALID / NEEDS FIX: list issues]

IF NEEDS FIX: STOP - fix issues, re-run this prompt
IF VALID: Proceed to Prompt 28, bring i18n keys list

Output:
```
## SECTION: [name]

LABELS:
- [element]: [key] | "[default text]" | [partial param]

PLACEHOLDERS:
- [element]: [key] | "[default text]"

BUTTONS:
- [element]: [key] | "[default text]" | [partial param]

REUSE:
- [key]: exists in [lang file].json

PARTIAL PARAMS CHECKED: [yes / no]
```

MAX 40 lines. DO NOT write code.
```

**EXAMPLE:**
```
## CHECKPOINT

INPUT RECEIVED: yes - 4 sections, 12 partials from Prompt 5, 11, 12
PARTIAL_SPECS.md READ: yes - 8 i18n params extracted
LANG FILES READ: yes - 15 reusable keys found
CROSS-REFERENCE: yes - all partials have keys

STATUS: VALID

## SECTION: Filters

LABELS:
- panel-title: page.filters | "Filters" | glass-panel titleKey
- status-filter: page.status | "Status"
- date-from: page.date_from | "Date From"

PLACEHOLDERS:
- supplier-search: page.search_suppliers | "Search suppliers..."

BUTTONS:
- apply-btn: btn.apply_filters | "Apply Filters"
- reset-btn: btn.reset | "Reset"

REUSE:
- btn.reset: exists in common.json

PARTIAL PARAMS CHECKED: yes
```

**COMMON ERRORS:**
```
// WRONG: missing titleKey from partial
LABELS:
- panel-title: page.filters | "Filters"  // MISSING: glass-panel has titleKey param

// WRONG: creating duplicate key
- save-btn: btn.save_order | "Save"  // WRONG: btn.save already exists in common.json

// WRONG: missing key for button
- apply-btn: "Apply"  // MISSING: btn.apply key

// WRONG: missing partial param annotation
- panel-title: page.filters | "Filters"  // MISSING: | glass-panel titleKey
```

### Prompt 28: Errors, Tooltips & Special Keys
```
List ERRORS, TOOLTIPS and SPECIAL i18n keys for [page].html

INPUT REQUIRED: Sections from Prompt 5, APIs from Prompt 23 and 24, i18n keys from Prompt 27
IF INPUT missing: ERROR - run Prompt 5, 23, 24, 27 first, STOP

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
EXTRACT and OUTPUT:
- Partials with hintKey: [list partials]
- Partials with hintTooltip: [list partials]
- Partials with placeholderKey: [list partials]
IF OUTPUT empty: ERROR - PARTIAL_SPECS.md not read, STOP

STEP 2: READ existing lang files
Find reusable error keys in demo/panini/lang/*.json:
- Common errors: error.load_failed, error.save_failed, error.delete_failed
- Common validation: error.field_required, error.invalid_email
EXTRACT and OUTPUT:
- Reusable error keys: [list keys and files]
DO NOT duplicate existing keys!

STEP 3: CROSS-REFERENCE with API error responses from INPUT
For each API from Prompt 16:
- Extract error messages needed
- Match with error keys

STEP 4: CATEGORIZE keys
- ERRORS: validation errors, API errors (from Prompt 16)
- TOOLTIPS: help text, hints (from partials with hintKey)
- MESSAGES: empty states, loading states
- PLURALS: items count (use _one/_other suffixes)

STEP 5: DEFINE interpolation and plurals
INTERPOLATION:
- Single: "{{count}} items selected"
- Multiple: "{{supplier}}: {{count}} orders"
- JS usage: i18n.t('page.orders_count', { count: 5, supplier: 'ABC' })

PLURAL FORMS:
- items_one: "{{count}} item"
- items_other: "{{count}} items"
- ALWAYS create both _one and _other together!

## CHECKPOINT

INPUT RECEIVED: [yes/no - sections, APIs, i18n keys from Prompt 5, 23, 24, 27]
PARTIAL_SPECS.md READ: [yes/no - hint/tooltip params extracted]
LANG FILES READ: [yes/no - reusable error keys found]
API CROSS-REFERENCE: [yes/no - all APIs have error keys]

STATUS: [VALID / NEEDS FIX: list issues]

IF NEEDS FIX: STOP - fix issues, re-run this prompt
IF VALID: Proceed to Prompt 29, bring all i18n keys

Output:
```
## SECTION: [name]

ERRORS:
- [case]: [key] | "[default text]" | [API/JS source]

TOOLTIPS:
- [element]: [key] | "[default text]" | [partial param]

MESSAGES:
- [state]: [key] | "[default text]"

PLURALS:
- [key]_one: "[text]"
- [key]_other: "[text]"

REUSE:
- [key]: exists in [lang file].json

API ERRORS CHECKED: [yes / no]
```

MAX 40 lines. DO NOT write code.
```

**EXAMPLE:**
```
## CHECKPOINT

INPUT RECEIVED: yes - sections, APIs, i18n keys from Prompt 5, 23, 24, 27
PARTIAL_SPECS.md READ: yes - hint/tooltip params extracted
LANG FILES READ: yes - 8 reusable error keys found
API CROSS-REFERENCE: yes - all APIs have error keys

STATUS: VALID

## SECTION: Orders Table

ERRORS:
- load-failed: error.load_orders | "Failed to load orders" | API GET /api/orders
- delete-failed: error.delete_order | "Failed to delete order {{id}}" | API DELETE

TOOLTIPS:
- status-help: page.status_tooltip | "Order status info" | input-group hintTooltip

MESSAGES:
- empty: page.no_orders | "No orders found"
- loading: page.loading_orders | "Loading orders..."

PLURALS:
- orders_one: "{{count}} order"
- orders_other: "{{count}} orders"

REUSE:
- error.load_failed: exists in common.json

API ERRORS CHECKED: yes
```

**COMMON ERRORS:**
```
// WRONG: no interpolation for dynamic value
- delete-failed: error.delete | "Failed to delete"  // MISSING: "{{id}}" from API

// WRONG: only _one without _other
- items_one: "{{count}} item"  // MISSING: items_other

// WRONG: wrong error naming
- error: "Failed"  // should be: error.load_orders

// WRONG: missing API source
- load-failed: error.load_orders | "Failed"  // MISSING: | API GET /api/orders

// WRONG: creating duplicate error
- load-failed: error.orders_load | "Failed"  // WRONG: error.load_failed exists
```

---

### Prompt 29: Create New Language File
```
Create NEW language file for [page].html

Language: [en-US / ru / etc]
Keys from Prompt 27: [paste labels/buttons]
Keys from Prompt 28: [paste errors/special]

STEP 1: VERIFY file does NOT exist
Command: ls demo/panini/lang/[lang]/admin/[page].json
If EXISTS: STOP - use Prompt 30 instead!

STEP 2: READ existing lang files for common keys
Find common keys in demo/panini/lang/[lang]/common.json:
- btn.save, btn.cancel, btn.delete, btn.close
- error.load_failed, error.save_failed
DO NOT duplicate - reuse common keys!

STEP 3: CROSS-REFERENCE with Prompt 27/28 keys
Ensure all keys from 27 and 28 are included.

STEP 4: DEFINE interpolation syntax
- Use {{variable}} for dynamic values
- Example: "{{count}} items selected"

STEP 5: DEFINE plural suffixes
- _one for singular (1 item)
- _other for plural (2+ items)
- ALWAYS include both!

STEP 6: CHECK for duplicates
- Same key used twice within this file? List duplicates.

STEP 7: CHECK consistency with other pages
- Common keys (btn.save, btn.cancel) match other pages?

Output:
```json
{
  "page": { "[key]": "[text]" },
  "btn": { "[key]": "[text]" },
  "error": { "[key]": "[text]" },
  "modal": { "[key]": "[text]" },
  "nav": { "[key]": "[text]" }
}
```

File: demo/panini/lang/[lang]/admin/[page].json

COMMON KEYS REUSED: [list]
MAX 30 lines.
```

**EXAMPLE:**
```json
{
  "page": {
    "orders": "Orders",
    "filters": "Filters",
    "no_orders": "No orders found",
    "orders_count_one": "{{count}} order",
    "orders_count_other": "{{count}} orders"
  },
  "btn": {
    "apply_filters": "Apply Filters",
    "create_order": "Create Order"
  },
  "error": {
    "load_orders": "Failed to load orders",
    "invalid_date": "End date must be after start date"
  },
  "modal": {
    "create_order": "Create Order",
    "confirm_delete": "Delete this order?"
  },
  "nav": {
    "orders": "Orders"
  }
}
```

**COMMON ERRORS:**
```json
// WRONG: file already exists
// Use Prompt 30 for MERGE instead!

// WRONG: missing interpolation
"no_orders": "No orders"  // should be: "{{count}} orders"

// WRONG: duplicate key
"page": { "orders": "Orders" },
"modal": { "orders": "Orders" }  // duplicate: orders

// WRONG: wrong plural suffix
"orders_count": "{{count}} orders"  // missing: _one/_other suffixes
```

---

### Prompt 30: Merge Language File
```
MERGE language file for [page].html (file exists!)

Language: [en-US / ru / etc]
Existing file: demo/panini/lang/[lang]/admin/[page].json
New keys from Prompt 27: [paste labels/buttons]
New keys from Prompt 28: [paste errors/special]

STEP 1: VERIFY file exists
Command: ls demo/panini/lang/[lang]/admin/[page].json
If NOT FOUND: STOP - use Prompt 29 instead!

STEP 2: READ existing lang file
DO NOT PROCEED without reading existing file!
Extract all existing keys.

STEP 3: LIST keys to PRESERVE (existing)
All existing keys must be preserved.
DO NOT overwrite any existing key!

STEP 4: LIST keys to ADD (new)
From Prompt 27 and 28, list new keys only.
Check if key already exists - skip if exists.

STEP 5: CHECK consistency
- New common keys (btn.save) match existing translation?
- If mismatch: WARN but preserve existing.

STEP 6: CROSS-REFERENCE with Prompt 27/28
Ensure all needed keys are either preserved or added.

Output:
```
## MERGE PLAN

PRESERVE (existing):
- [key]: "[existing text]"

ADD (new):
- [key]: "[new text]"

RESULT:
```json
{
  "page": {
    "existing_key": "Existing text",  // preserved
    "new_key": "New text"  // added
  }
}
```

EXISTING FILE READ: [yes / no]
ALL KEYS ACCOUNTED: [yes / missing: list]
```

MAX 30 lines. DO NOT write code.
```

**EXAMPLE:**
```
## MERGE PLAN

PRESERVE (existing):
- page.orders: "Orders"
- page.old_key: "Old Value"

ADD (new):
- page.filters: "Filters"
- page.no_orders: "No orders found"
- btn.apply_filters: "Apply Filters"

RESULT:
```json
{
  "page": {
    "orders": "Orders",  // preserved
    "old_key": "Old Value",  // preserved
    "filters": "Filters",  // added
    "no_orders": "No orders found"  // added
  },
  "btn": {
    "apply_filters": "Apply Filters"  // added
  }
}
```
```

**COMMON ERRORS:**
```json
// WRONG: overwriting existing key
"orders": "All Orders"  // WRONG: preserve "Orders"

// WRONG: removing existing key
// Always preserve ALL existing keys!

// WRONG: inconsistent common key
// Existing: btn.save = "Save"
// New: btn.save = "Save Order"  // WRONG: keep existing!
```

### Prompt 31: Validate HTML/JS i18n Mapping
```
VALIDATE i18n keys mapping for [page].html:

HTML file: [page].html
Lang file: [paste from Prompt 29 or 30]
JS file: [paste from Prompt 45 - i18n.t() calls]

STEP 1: GREP data-i18n in HTML
Command: grep -o 'data-i18n="[^"]*"' demo/panini/pages/[page].html
Extract all data-i18n keys.

STEP 2: GREP i18n.t() in JS
Command: grep -o "i18n\.t('[^']*'" demo/assets/js/[page]_logic.js
Extract all i18n.t() keys.

STEP 3: CROSS-REFERENCE with lang file
For each HTML data-i18n key:
- Key exists in lang file?
For each JS i18n.t() key:
- Key exists in lang file?

STEP 4: CHECK key naming convention
- page.* for page content
- btn.* for buttons
- error.* for error messages
- modal.* for modal content
- field.* for form fields
- nav.* for navigation

STEP 5: CHECK interpolation
- {{variable}} in lang value -> variable passed in JS?
- VERIFY: JS i18n.t('key', { variable: value }) matches lang

STEP 6: CHECK plural forms
- _one suffix -> has _other suffix?
- _zero suffix (if applicable)?

Output:
```
## VALIDATION RESULT

HTML-LANG MAPPING:
[ ] data-i18n keys in HTML: [N] found
[ ] Keys match lang file: [yes / MISSING: list]

JS-LANG MAPPING:
[ ] i18n.t() calls in JS: [N] found
[ ] Keys match lang file: [yes / MISSING: list]

NAMING CONVENTION:
[ ] All keys follow convention: [yes / WRONG: list]

INTERPOLATION:
[ ] Variables match: [yes / MISMATCH: list]

PLURAL FORMS:
[ ] _one/_other pairs: [complete / INCOMPLETE: list]

GREP COMMANDS RUN: [yes / no]
STATUS: [MAPPING VALID / NEEDS REVISION: list issues]
```

MAX 25 lines. DO NOT write code.
```

**EXAMPLE 1: Valid mapping**
```
## VALIDATION RESULT

HTML-LANG MAPPING:
[ ] data-i18n keys in HTML: 12 found
[ ] Keys match lang file: yes

JS-LANG MAPPING:
[ ] i18n.t() calls in JS: 5 found
[ ] Keys match lang file: yes

NAMING CONVENTION:
[ ] All keys follow convention: yes

INTERPOLATION:
[ ] Variables match: yes ({{count}} in JS)

PLURAL FORMS:
[ ] _one/_other pairs: complete

STATUS: MAPPING VALID
```

**EXAMPLE 2: Invalid mapping**
```
## VALIDATION RESULT

HTML-LANG MAPPING:
[ ] data-i18n keys in HTML: 12 found
[ ] Keys match lang file: MISSING
    - data-i18n="page.supplier" not in lang file

JS-LANG MAPPING:
[ ] i18n.t() calls in JS: 5 found
[ ] Keys match lang file: MISSING
    - i18n.t('error.network') not in lang file

NAMING CONVENTION:
[ ] All keys follow convention: WRONG
    - "button-save" should be btn.save

INTERPOLATION:
[ ] Variables match: MISMATCH
    - lang: "{{count}} orders" but JS: i18n.t('page.orders', { total: 5 })

PLURAL FORMS:
[ ] _one/_other pairs: INCOMPLETE
    - items_one exists but items_other missing

STATUS: NEEDS REVISION
```

**COMMON ERRORS:**
```
// WRONG: data-i18n without lang key
<span data-i18n="page.supplier">Supplier</span>  // MISSING: page.supplier in lang

// WRONG: i18n.t() without lang key
i18n.t('error.network')  // MISSING: error.network in lang

// WRONG: interpolation mismatch
lang: "{{count}} orders"  // JS: i18n.t('page.orders', { total: 5 })

// WRONG: wrong key naming
"button-save"  // should be: btn.save
```

---

### Prompt 32: Validate Partial Keys & Consistency
```
VALIDATE partial i18n keys and consistency for [page].html:

HTML file: [page].html
Lang file: [paste from Prompt 29 or 30]
Partials from Prompt 11 and 12: [paste partials with i18n params]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
Check ALL i18n params for each partial:
- titleKey, badgeKey, labelKey, actionKey, hintKey, placeholderKey
DO NOT PROCEED without reading PARTIAL_SPECS.md!

STEP 2: CROSS-REFERENCE partial params with lang file
For each partial with i18n param:
- titleKey value exists in lang file?
- badgeKey value exists in lang file?
- labelKey value exists in lang file?
- hintKey value exists in lang file?

STEP 3: CHECK for duplicates
- Same key used twice in lang file?
- List any duplicates found.

STEP 4: CHECK for unused keys
- Keys in lang file but NOT in HTML or JS?
- List any unused keys.

STEP 5: CHECK consistency with other pages
- READ common.json or other lang files
- Common keys (btn.save, btn.cancel) match?
- If mismatch: WARN but do not change.

Output:
```
## VALIDATION RESULT

PARTIAL KEYS:
[ ] titleKey params: [present / MISSING: list]
[ ] badgeKey params: [present / MISSING: list]
[ ] labelKey params: [present / MISSING: list]
[ ] hintKey params: [present / MISSING: list]

DUPLICATES:
- Found: [none / list]

UNUSED KEYS:
- Found: [none / list]

CONSISTENCY:
[ ] Common keys match other pages: [yes / MISMATCH: list]

PARTIAL_SPECS.md READ: [yes / no]
STATUS: [PARTIAL KEYS VALID / NEEDS REVISION: list issues]
```

MAX 25 lines. DO NOT write code.
```

**EXAMPLE 1: Valid partial keys**
```
## VALIDATION RESULT

PARTIAL KEYS:
[ ] titleKey params: present (page.filters, page.orders)
[ ] badgeKey params: present (page.orders_count)
[ ] labelKey params: present (field.price)
[ ] hintKey params: present (hint.currency)

DUPLICATES:
- Found: none

UNUSED KEYS:
- Found: none

CONSISTENCY:
[ ] Common keys match other pages: yes (btn.save = "Save")

STATUS: PARTIAL KEYS VALID
```

**EXAMPLE 2: Invalid partial keys**
```
## VALIDATION RESULT

PARTIAL KEYS:
[ ] titleKey params: MISSING
    - glass-panel titleKey="page.pricing" but no page.pricing in lang
[ ] hintKey params: MISSING
    - input-group hintKey="hint.currency" but no hint.currency in lang

DUPLICATES:
- Found: page.orders (used in page and modal sections)

UNUSED KEYS:
- Found: page.old_key (not in HTML or JS)

CONSISTENCY:
[ ] Common keys match other pages: MISMATCH
    - btn.save = "Save Order" but common.json has btn.save = "Save"

STATUS: NEEDS REVISION
```

**COMMON ERRORS:**
```
// WRONG: partial param without lang key
{{> glass-panel titleKey="page.pricing"}}  // MISSING: page.pricing in lang
{{> input-group hintKey="hint.currency"}}  // MISSING: hint.currency in lang

// WRONG: duplicate key
"page": { "orders": "Orders" },
"modal": { "orders": "Orders" }  // duplicate: orders

// WRONG: inconsistent common key
// This page: btn.save = "Save Order"
// Other pages: btn.save = "Save"  // MUST be consistent!

// WRONG: unused key in lang file
"page.old_key": "Old text"  // NOT used in HTML or JS - remove!
```

### Prompt 32b: Validate i18n Integration
```
VALIDATE i18n INTEGRATION for [page].html:

HTML file: [page].html
JS file: [page]_logic.js
Lang file: [from Prompt 29/30]

STEP 1: GREP translationEngine usage in JS
Command: grep -n "translationEngine" demo/assets/js/[page]_logic.js
LIST all usages found:
- translateNewElements: [N calls / NOT FOUND]
- onLanguageChange: [registered / NOT FOUND]
- t() calls: [N calls / NOT FOUND]

STEP 2: CHECK translateNewElements calls
For each JS function that creates DOM elements dynamically:
- Function name: [name]
- Creates elements: [describe]
- Calls translateNewElements(): [yes / NO - MUST ADD]
- Passes correct container: [yes / no]

STEP 3: CHECK language change callback
Command: grep -n "onLanguageChange\|language-changed" demo/assets/js/[page]_logic.js
IF page has table/list with i18n content:
- Callback registered: [yes / NO - table won't update on language change]
- Callback rebuilds content: [yes / no]

STEP 4: CHECK data-i18n attribute format
Command: grep -o 'data-i18n="[^"]*"' demo/panini/pages/[page].html
For each key found:
- Format correct: [page.*, btn.*, field.*, modal.* / WRONG: "button-save", "text"]
- No hardcoded English without data-i18n: [check labels, buttons]

STEP 5: CHECK dynamic element i18n attributes
For each JS function that creates DOM elements:
- Adds data-i18n to text elements: [yes / NO - elements won't translate]
- Example: element.setAttribute('data-i18n', 'page.key')

STEP 6: CHECK badge/indicator i18n
For override badges, status indicators:
- Has data-i18n attribute: [yes / NO]
- Has corresponding lang key: [yes / NO]

Output:
```
## I18N INTEGRATION TEST

TRANSLATION ENGINE USAGE:
- translateNewElements: [N calls / NOT FOUND - CRITICAL]
- onLanguageChange: [registered / NOT FOUND - table won't update]
- t() calls: [N calls]

DYNAMIC ELEMENTS:
- [function]: translateNewElements [present / MISSING]
- [function]: data-i18n attributes [added / MISSING]

LANGUAGE CHANGE:
- Table rebuilds on language change: [yes / NO - NEED CALLBACK]

BADGE/INDICATOR I18N:
- Override badge: data-i18n [present / MISSING]
- Status indicators: data-i18n [present / MISSING]

ISSUES FOUND: [N]
STATUS: [I18N INTEGRATION VALID / NEEDS FIX: list issues]
```

MAX 30 lines. DO NOT write code.
```

**EXAMPLE 1: Valid i18n integration**
```
## I18N INTEGRATION TEST

TRANSLATION ENGINE USAGE:
- translateNewElements: 3 calls (addTableRow, showBadge, updateStatus)
- onLanguageChange: registered for orders table
- t() calls: 5 calls

DYNAMIC ELEMENTS:
- addTableRow: translateNewElements present, data-i18n added
- showBadge: translateNewElements present, data-i18n added

LANGUAGE CHANGE:
- Table rebuilds on language change: yes

BADGE/INDICATOR I18N:
- Override badge: data-i18n present
- Status indicators: data-i18n present

ISSUES FOUND: 0
STATUS: I18N INTEGRATION VALID
```

**EXAMPLE 2: Invalid i18n integration**
```
## I18N INTEGRATION TEST

TRANSLATION ENGINE USAGE:
- translateNewElements: NOT FOUND - CRITICAL
- onLanguageChange: NOT FOUND - table won't update
- t() calls: 2 calls

DYNAMIC ELEMENTS:
- addTableRow: translateNewElements MISSING
- addTableRow: data-i18n attributes MISSING
- showBadge: translateNewElements MISSING

LANGUAGE CHANGE:
- Table rebuilds on language change: NO - NEED CALLBACK

BADGE/INDICATOR I18N:
- Override badge: data-i18n MISSING
- Status indicators: data-i18n MISSING

ISSUES FOUND: 7
STATUS: NEEDS FIX: translateNewElements missing, onLanguageChange missing, badges missing i18n
```

**COMMON ERRORS:**
```js
// WRONG: dynamic element without data-i18n
const badge = document.createElement('span');
badge.textContent = 'Override';  // MISSING: badge.setAttribute('data-i18n', 'badge.override');
badge.textContent = i18n.t('badge.override');  // BETTER but still needs data-i18n for language change

// WRONG: creating element but not calling translateNewElements
const row = document.createElement('tr');
row.innerHTML = '<td data-i18n="page.status">Status</td>';
table.appendChild(row);
// MISSING: translationEngine.translateNewElements(row);

// WRONG: no language change callback for table
// Table content won't update when user switches language
// MUST ADD: translationEngine.onLanguageChange(() => rebuildTable());

// WRONG: badge hidden with opacity:0
.override-badge { opacity: 0; }  // Badge exists but invisible!
// CHECK CSS: element must be visible
```

---

## PHASE 6: HTML ASSEMBLY

### Prompt 33: HTML Section - Structure & Layout
```
Create HTML STRUCTURE for SECTION: [name]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
Check glass-panel params:
- title (required), titleKey, loading, skeletonWidth, skeletonHeight, hasBody
DO NOT PROCEED without reading PARTIAL_SPECS.md!

STEP 2: READ reference page for patterns
Command: Read demo/panini/pages/suppliers/card.html
Extract:
- Grid structure for entity pages
- Glass-panel usage patterns
- Column class names

STEP 3: IDENTIFY page type from Prompt 5
- Entity page: has grid layout
- List page: vertical stack

STEP 4: CREATE structure following patterns

=== LAYOUT STRUCTURE ===

ENTITY PAGE:
- Wrapper: <div class="main-card-content">
- Grid: <div class="entity-card-grid">
- Columns: .entity-col-left | .entity-col-center | .entity-col-right
- Full-width: AFTER grid closing </div>

LIST PAGE:
- No grid, sections stack vertically
- Each section wrapped in glass-panel

=== GLASS-PANEL (ALWAYS INCLUDE) ===

- title="..." (REQUIRED)
- titleKey="page.xxx" (if i18n)
- loading=true (REQUIRED)
- skeletonWidth="XX%" (with loading)
- skeletonHeight="XXpx" (with loading)
- hasBody=true (REQUIRED)

Optional: actionLabel + actionKey + actionId

=== COMMON ERRORS ===

- Missing loading=true → no loading state
- Missing hasBody=true → content not wrapped
- Full-width section inside grid
- Missing .entity-card-grid for entity pages

Output: Section wrapper with glass-panel. MAX 15 lines.

PATTERNS USED: [from reference page]
```

**EXAMPLE OUTPUT (Entity Page Column):**
```html
<div class="entity-col-left">
    {{#> glass-panel title="Status" titleKey="page.status" loading=true skeletonWidth="80%" skeletonHeight="100px" hasBody=true}}
        [Content from Prompt 34]
    {{/glass-panel}}
</div>
```

**EXAMPLE OUTPUT (List Page Section):**
```html
{{#> glass-panel title="Filters" titleKey="page.filters" loading=true skeletonWidth="60%" skeletonHeight="80px" hasBody=true}}
    [Content from Prompt 34]
{{/glass-panel}}
```

---

### Prompt 34: HTML Section - Content & Styling
```
Create HTML CONTENT for SECTION: [name]

Partials from Prompt 11/12:
- [list partials with required params]

Data from Prompt 20/21/22:
- [list data variables]

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
Check ALL partial params for each partial used.
DO NOT PROCEED without reading PARTIAL_SPECS.md!

STEP 2: CROSS-REFERENCE with Prompt 11 and 12
Ensure all partials listed are used with correct params.

STEP 3: CROSS-REFERENCE with Prompt 20/21 data
Ensure data variables match HTML IDs and partial params.

STEP 4: USE ONLY existing CSS classes
Inputs: .glass-input, .field-label, .input-group, .dirty-check
Buttons: .btn, .btn-primary, .btn-secondary, .btn-save
Status: .status-pill, .pill-success, .pill-warning, .pill-error

DO NOT invent new classes. If needed, note for CSS phase.

STEP 5: VALIDATE icon names
Available: warehouse-box, alert-tag, sales-up, profit-coin, alert-triangle,
stats-bars, materials-swatch, sales-trend, staff-user, offer-tag,
cart-shopping, check-success, clock-history, trend-growth, swap-arrows,
balance-scale, clock-time, report-clipboard, check-circle, info-circle,
settings-gear, x-close, x-circle, edit-pencil, save-disk, chevron-down,
upload-arrow, calendar, plus-add, pie-chart, grid-products, menu-bars,
search, bell-notification, chevron-right, email

Usage: {{> icon name="save-disk" width="18" height="18"}}

STEP 6: APPLY spacing rules
- LAST input-group in group: style="margin-bottom:0;"
- Grid layouts: style="display:grid;grid-template-columns:1fr 1fr;gap:20px;"
- AVOID other inline styles

=== COMMON ERRORS ===

- Wrong icon name -> build error
- Invented CSS class -> broken styling
- Missing margin-bottom:0 -> extra spacing
- Missing data-i18n on labels
- Duplicate ID (check other sections)

Output: Section content ONLY. MAX 25 lines.

PARTIAL_SPECS.md READ: [yes / no]
CSS CLASSES USED: [list - all existing / NEW: list]
```

**EXAMPLE OUTPUT (Form Content):**
```html
<div class="input-group">
    <label class="field-label" data-i18n="page.status">Status</label>
    {{#> custom-select id="status-filter" fieldId="order_status" defaultValue="all"}}
        <div class="custom-select-option" data-value="all">All</div>
        <div class="custom-select-option" data-value="pending">Pending</div>
        <div class="custom-select-option" data-value="completed">Completed</div>
    {{/custom-select}}
</div>
<div class="input-group" style="margin-bottom:0;">
    <label class="field-label" data-i18n="page.date">Date</label>
    {{> datepicker id="date-filter" fieldId="date"}}
</div>
```

**Repeat 21a + 21b for each section.**

---

### Prompt 35: Assemble Full Page HTML
```
ASSEMBLE full [page].html

STEP 1: READ demo/panini/layouts/default.html
Understand layout structure:
- Where {{pageTitle}} is used
- Where {{> content}} is placed
- What partials are included

STEP 2: READ demo/panini/pages/suppliers/card.html
Extract patterns for:
- Entity page grid structure
- Glass-panel usage
- Column classes

STEP 3: IDENTIFY page type from Prompt 5
- ENTITY PAGE (card/detail): Has 3-column grid
- LIST PAGE (table/filters): No grid, vertical stack

STEP 4: ASSEMBLE sections from Prompt 33/34
Follow section order from Prompt 5.

STEP 5: CREATE frontmatter
- layout: default
- title: [Page Title]
- pageTitle: [Page Title] (for {{pageTitle}} in layout)
- activeNav: [nav_key] (must exist in sidebar)
- langFile: admin/[page] (must match Prompt 29/30)
- customCss: admin/[page].css
- customJs: admin/[page]_logic

=== ENTITY PAGE STRUCTURE ===

1. HEADER ACTIONS (optional):
   <div class="flex-end" style="margin-bottom: 32px;">
       <div class="entity-action-bar no-margin pos-static flex-group">
           <button class="btn btn-primary" id="action-btn">...</button>
       </div>
   </div>

2. GRID WRAPPER:
   <div class="main-card-content">
       <div class="entity-card-grid">
           <div class="entity-col-left">[sections]</div>
           <div class="entity-col-center">[sections]</div>
           <div class="entity-col-right">[sections]</div>
       </div>
       
       [FULL-WIDTH SECTIONS outside grid]
   </div>

=== LIST PAGE STRUCTURE ===

1. HEADER ACTIONS (optional):
   <div class="flex-end" style="margin-bottom: 32px;">
       <button class="btn btn-primary" id="add-btn">...</button>
   </div>

2. SECTIONS (vertical stack):
   {{#> glass-panel ...}}...{{/glass-panel}}
   {{#> glass-panel ...}}...{{/glass-panel}}

=== FRONTMATTER REQUIRED ===

- layout: default
- title: [Page Title]
- pageTitle: [Page Title] (for {{pageTitle}} in layout)
- activeNav: [nav_key] (must exist in sidebar)
- langFile: admin/[page] (must match Prompt 29/30)
- customCss: admin/[page].css
- customJs: admin/[page]_logic

=== COMMON ERRORS ===

- Missing pageTitle (layout uses {{pageTitle}})
- Wrong langFile path (must match Prompt 29/30 output)
- Missing activeNav (sidebar highlight won't work)
- Sections in wrong order (check Prompt 5 section order)
- Missing .main-card-content wrapper for entity pages
- Missing .entity-card-grid for entity pages
- Full-width section inside grid (should be after </div> grid)
- glass-panel without loading=true (violates Prompt 33/34)

Output: Complete HTML file with frontmatter.

LAYOUT READ: [yes / no]
REFERENCE PAGE READ: [yes / no]
```

**EXAMPLE OUTPUT (List Page):**
```html
---
layout: default
title: Orders
pageTitle: Orders
activeNav: orders
langFile: admin/orders
customCss: admin/orders.css
customJs: admin/orders_logic
---
<!-- HEADER ACTIONS -->
<div class="flex-end" style="margin-bottom: 32px;">
    <button class="btn btn-primary" id="add-order-btn">
        {{> icon name="plus-add" width="18" height="18"}}
        <span data-i18n="btn.add_order">Add Order</span>
    </button>
</div>

<!-- FILTERS SECTION -->
{{#> glass-panel title="Filters" titleKey="page.filters" loading=true skeletonWidth="60%" skeletonHeight="80px" hasBody=true}}
...
{{/glass-panel}}

<!-- ORDERS TABLE SECTION -->
{{#> glass-panel title="Orders" titleKey="page.orders" loading=true skeletonWidth="40%" skeletonHeight="200px" hasBody=true}}
...
{{/glass-panel}}
```

**EXAMPLE OUTPUT (Entity Page):**
```html
---
layout: default
title: Supplier Profile
pageTitle: Supplier Profile
activeNav: supplier_list
langFile: admin/supplier_card
customCss: admin/supplier_card.css
customJs: admin/supplier_card_logic
---
<!-- HEADER ACTIONS -->
<div class="flex-end" style="margin-bottom: 32px;">
    <div class="entity-action-bar no-margin pos-static flex-group">
        <button class="btn btn-save" id="save-btn">
            {{> icon name="save-disk" width="18" height="18"}}
            <span data-i18n="btn.save">Save</span>
        </button>
    </div>
</div>

<div class="main-card-content">
    <div class="entity-card-grid">
        <div class="entity-col-left">
            {{#> glass-panel title="Status" loading=true skeletonWidth="80%" skeletonHeight="100px" hasBody=true}}
            ...
            {{/glass-panel}}
        </div>
        <div class="entity-col-center">
            ...
        </div>
        <div class="entity-col-right">
            ...
        </div>
    </div>
    <!-- FULL-WIDTH SECTION outside grid -->
    {{#> glass-panel title="Audit History" loading=true panelClass="audit-panel-wide" hasBody=true}}
    ...
    {{/glass-panel}}
</div>
```

---

### Prompt 36: Validate HTML - Structure
```
VALIDATE STRUCTURE for [page].html

STEP 1: READ .windsurf/workflows/PARTIAL_SPECS.md
Check required params for each partial.
DO NOT PROCEED without reading PARTIAL_SPECS.md!

STEP 2: GREP partial calls
Command: grep -o '{{#>[^}]*}}' demo/panini/pages/[page].html
Command: grep -o '{{>[^}]*}}' demo/panini/pages/[page].html
List all partial calls.

STEP 3: CHECK each partial call
For each {{#> partial}} and {{> partial}}:
- Partial name exists in PARTIAL_SPECS.md?
- Required params present?
- Block partials have closing {{/partial}}?

STEP 4: CHECK glass-panel completeness
- [ ] title present (REQUIRED)
- [ ] loading=true present (REQUIRED)
- [ ] hasBody=true present (REQUIRED)

STEP 5: CHECK layout validation
Entity pages MUST have:
- [ ] <div class="main-card-content"> wrapper
- [ ] <div class="entity-card-grid"> grid container
- [ ] .entity-col-left / .entity-col-center / .entity-col-right
- [ ] Full-width sections OUTSIDE grid

List pages MUST have:
- [ ] No grid structure
- [ ] Sections stack vertically

STEP 6: GREP IDs and check duplicates
Command: grep -o 'id="[^"]*"' demo/panini/pages/[page].html
- Check for duplicates
- Check match with Prompt 20/21 data selectors

=== COMMON ERRORS ===

- Missing loading=true on glass-panel
- Missing hasBody=true on glass-panel
- Missing {{/glass-panel}} closing tag
- Duplicate IDs across sections
- Full-width section inside grid

Output:
```
## STRUCTURE VALIDATION

PARTIAL CALLS:
[ ] glass-panel: title [present/MISSING]
[ ] glass-panel: loading [present/MISSING]
[ ] glass-panel: hasBody [present/MISSING]
[ ] custom-select: id [present/MISSING]
[ ] datepicker: id [present/MISSING]
Total: [N] partials

LAYOUT:
- Page type: [entity/list]
- Grid structure: [valid/MISSING/INVALID]
- Full-width sections: [outside grid / INSIDE GRID ERROR]

IDS:
- Total: [N]
- Duplicates: [none / LIST THEM]

PARTIAL_SPECS.md READ: [yes / no]
GREP COMMANDS RUN: [yes / no]
STATUS: [STRUCTURE VALID / NEEDS FIX: [issues]]
```
```

**EXAMPLE OUTPUT (Valid):**
```
## STRUCTURE VALIDATION

PARTIAL CALLS:
[x] glass-panel (3x): title, loading, hasBody present
[x] custom-select (2x): id present
[x] datepicker (1x): id present
Total: 6 partials

LAYOUT:
- Page type: entity
- Grid structure: valid
- Full-width sections: outside grid

IDS:
- Total: 12
- Duplicates: none

STATUS: STRUCTURE VALID
```

---

### Prompt 37: Validate HTML - Content
```
VALIDATE CONTENT for [page].html

STEP 1: GREP data-i18n attributes
Command: grep -o 'data-i18n="[^"]*"' demo/panini/pages/[page].html
List all data-i18n keys.

STEP 2: CROSS-REFERENCE with Prompt 27/28
Check all keys exist in lang file.
Pattern: "page.[key]" / "modal.[key]" / "btn.[key]"

STEP 3: GREP CSS classes
Command: grep -o 'class="[^"]*"' demo/panini/pages/[page].html
Check each class:
- Existing classes (Prompt 54 reference)
- New classes (Prompt 57 list)

STEP 4: CHECK required classes
- [ ] .glass-input on all inputs/textareas
- [ ] .field-label on all labels
- [ ] .input-group wrapping label+input pairs
- [ ] .dirty-check on form fields (if form has save)

STEP 5: GREP icons and validate
Command: grep -o '{{> icon[^}]*}}' demo/panini/pages/[page].html
Check all {{> icon name="..."}}:
- Name must be in available icons list (Prompt 34)
- width/height specified

STEP 6: CHECK spacing
Check last input-group in each group:
- [ ] Has style="margin-bottom:0;" on last input-group

Check inline styles:
- [ ] Only allowed: margin-bottom:0, font-family:'JetBrains Mono', display:grid
- [ ] WARN if other inline styles used

STEP 7: CHECK helper syntax
Check helpers:
- (array ...) and (obj ...) are INLINE: {{> partial columns=(array ...)}}
- {{#times}}, {{#lte}}, {{#eq}}, {{#concat}} are BLOCK with closing tag

STEP 7b: CHECK element visibility (CRITICAL for badges/indicators)
Command: grep -n "opacity:\|visibility:\|display:" demo/assets/css/admin/[page].css
For each badge, indicator, status element that should be visible:
- opacity: 0? -> ERROR - element hidden
- visibility: hidden? -> ERROR - element hidden
- display: none? -> ERROR - element hidden

SPECIFIC CHECKS:
- Override badges: MUST have opacity: 1 (not 0)
- Status indicators: MUST be visible
- Dynamic badges created by JS: MUST have CSS that shows them

CHECK CSS selectors for badges:
Command: grep -o "\..*badge.*{" demo/assets/css/admin/[page].css
- Badge class exists: [yes / NO]
- Badge has opacity/visibility that hides it: [no / YES - ERROR]

=== COMMON ERRORS ===

- data-i18n key not in lang file
- Using CSS class that doesn't exist
- Icon name not in available list
- Missing margin-bottom:0 on last input-group
- (array) used as block helper (should be inline)

Output:
```
## CONTENT VALIDATION

I18N KEYS:
- Total: [N]
- Pattern: [valid / ISSUES]
- Missing from lang file: [none / LIST]

CSS CLASSES:
- Existing: [list]
- New (need CSS): [list]
- Missing required: [none / LIST]

ICONS:
- Total: [N]
- Invalid names: [none / LIST]

SPACING:
- Last input-group fix: [applied / MISSING on X groups]
- Inline styles audit: [ok / WARNINGS]

HELPERS:
- Syntax: [valid / ERRORS]

VISIBILITY:
- Badges visible: [yes / ERROR: opacity:0 found]
- Status indicators visible: [yes / ERROR: hidden]

GREP COMMANDS RUN: [yes / no]
STATUS: [CONTENT VALID / NEEDS FIX: [issues]]
```
```

**EXAMPLE OUTPUT (Invalid):**
```
## CONTENT VALIDATION

I18N KEYS:
- Total: 15
- Pattern: issues
- Missing from lang file: "page.old_key"

CSS CLASSES:
- Existing: glass-panel, field-label
- New (need CSS): "filter-advanced" (not in Prompt 57)
- Missing required: .glass-input on #field-notes

ICONS:
- Total: 2
- Invalid names: "plus-icon" (should be "plus-add")

SPACING:
- Last input-group fix: MISSING on 2 groups
- Inline styles audit: WARN - style="color:red" used

HELPERS:
- Syntax: valid

VISIBILITY:
- Badges visible: ERROR - .override-badge has opacity: 0
- Status indicators visible: yes

STATUS: NEEDS FIX: missing i18n, missing CSS, invalid icon, spacing issues, badge hidden
```

---

### Prompt 38: Validate HTML - Build & Final
```
VALIDATE BUILD for [page].html

STEP 1: CHECK accessibility
Check:
- Labels have for="" or wrapping
- Buttons have text or aria-label
- Tables have headers

STEP 2: RUN build command
Command: cd demo && gulp build
Execute build and check for errors.

STEP 3: CROSS-REFERENCE with Prompt 36 and 37
Combine results from all validation steps.

STEP 4: CREATE final status
Combine results from 23a + 23b + 23c:
- Structure: [VALID / NEEDS FIX]
- Content: [VALID / NEEDS FIX]
- Build: [SUCCESS / ERRORS]

STEP 5: CHECK for expected console errors
List potential JavaScript errors that would appear in browser console:
- Missing function references (window.* not set)
- Undefined variables
- i18n key not found warnings
- Missing translationEngine calls

STEP 6: DEFINE functional test checklist
Manual tests needed after build succeeds:
- Language change: table content updates
- Dropdowns: open on click, close on outside click
- Dynamic elements: i18n applied after creation
- Form dirty checking: works correctly
- Save button: triggers correct handler

Output:
```
## BUILD VALIDATION

ACCESSIBILITY:
- Labels: [ok / issues]
- Buttons: [ok / issues]
- Tables: [ok / issues]

BUILD: [success / errors]

## CONSOLE ERRORS EXPECTED

MISSING FUNCTIONS: [none / list]
UNDEFINED VARIABLES: [none / list]
I18N KEY WARNINGS: [none / list]

## FUNCTIONAL TEST CHECKLIST

LANGUAGE CHANGE:
- Table content updates: [not tested / PASS / FAIL]

DROPDOWNS:
- Opens on click: [not tested / PASS / FAIL]
- Closes on outside click: [not tested / PASS / FAIL]

DYNAMIC ELEMENTS:
- i18n applied after creation: [not tested / PASS / FAIL]

FORM DIRTY CHECKING:
- Works correctly: [not tested / PASS / FAIL]

SAVE BUTTON:
- Triggers correct handler: [not tested / PASS / FAIL]

## FINAL STATUS

STRUCTURE: [VALID / NEEDS FIX: [issues]]
CONTENT: [VALID / NEEDS FIX: [issues]]
BUILD: [SUCCESS / ERRORS]

BUILD COMMAND RUN: [yes / no]
OVERALL: [HTML VALID / NEEDS FIX]
```
```

**EXAMPLE OUTPUT (Valid):**
```
## BUILD VALIDATION

ACCESSIBILITY:
- Labels: ok (all wrapped in input-group)
- Buttons: ok (all have text + icon)
- Tables: ok (headers present)

BUILD: success

## CONSOLE ERRORS EXPECTED

MISSING FUNCTIONS: none
UNDEFINED VARIABLES: none
I18N KEY WARNINGS: none

## FUNCTIONAL TEST CHECKLIST

LANGUAGE CHANGE:
- Table content updates: not tested (manual test needed)

DROPDOWNS:
- Opens on click: not tested (manual test needed)
- Closes on outside click: not tested (manual test needed)

DYNAMIC ELEMENTS:
- i18n applied after creation: not tested (manual test needed)

## FINAL STATUS

STRUCTURE: VALID
CONTENT: VALID
BUILD: SUCCESS

OVERALL: HTML VALID - proceed to manual testing
```

**EXAMPLE OUTPUT (Invalid):**
```
## BUILD VALIDATION

ACCESSIBILITY:
- Labels: ok
- Buttons: ISSUE - #icon-btn has no text or aria-label
- Tables: ok

BUILD: error - partial datepicker missing id

## CONSOLE ERRORS EXPECTED

MISSING FUNCTIONS: toggleEditRow (window.* not set)
UNDEFINED VARIABLES: none
I18N KEY WARNINGS: page.supplier not found in lang file

## FUNCTIONAL TEST CHECKLIST

LANGUAGE CHANGE:
- Table content updates: FAIL - onLanguageChange not registered

DROPDOWNS:
- Opens on click: PASS
- Closes on outside click: PASS

DYNAMIC ELEMENTS:
- i18n applied after creation: FAIL - translateNewElements not called

## FINAL STATUS

STRUCTURE: NEEDS FIX: duplicate ID
CONTENT: NEEDS FIX: missing i18n, invalid icon
BUILD: ERRORS: partial missing id, helper syntax

OVERALL: NEEDS FIX - see details above
```

---

## PHASE 7: LOGIC

### Prompt 39: Function Types
```
Define FUNCTION SIGNATURES (basic) for orders_logic.js

INPUT REQUIRED: HTML from Prompt 35, APIs from Prompt 23 and 24
IF INPUT missing: ERROR - run Prompt 23, 24, 35 first, STOP

STEP 1: READ existing JS patterns
Command: Read demo/assets/js/admin/supplier_card_logic.js
EXTRACT and OUTPUT:
- Function naming patterns: [list patterns]
- Event handler patterns: [list patterns]
- Init function patterns: [list patterns]
IF OUTPUT empty: ERROR - JS file not read, STOP

STEP 2: GREP HTML for interactive elements from INPUT
Command: grep -o 'id="[^"]*"' demo/panini/pages/[page].html
Command: grep -o 'class="[^"]*"' demo/panini/pages/[page].html
EXTRACT and OUTPUT:
- Buttons: [list IDs/classes from HTML]
- Forms: [list form IDs from HTML]
- Dropdowns: [list .custom-select IDs from HTML]
- Tables: [list table IDs from HTML]
- Modals: [list modal IDs from HTML]
IF OUTPUT empty: ERROR - HTML not grepped, STOP

STEP 3: CROSS-REFERENCE with Prompt 16 APIs from INPUT
Ensure functions match API calls defined.

STEP 4: DEFINE function signatures following patterns
FUNCTION TYPES:
- Event Handler: triggered by user action (click, change, keydown)
- Utility: called by other functions (helper logic)
- Init: called on page load (DOMContentLoaded)

FUNCTION NAMING:
- Event handlers: handle[Action] (handleClick, handleSubmit)
- Utilities: [action][Target] (validateForm, captureState)
- Init: initPage, init[PageName]

FUNCTION SIZE:
- MAX 25 lines per function
- If >25 lines: split into helper functions

GLOBAL FUNCTIONS (for onclick in HTML):
- Needs window.* prefix: [yes/no] - exposed globally?
- Example: window.toggleEditRow, window.handleSave

## CHECKPOINT

INPUT RECEIVED: [yes/no - HTML and APIs from Prompt 23, 24, 35]
EXISTING JS READ: [yes/no - patterns extracted]
HTML GREPPED: [yes/no - interactive elements extracted]
API CROSS-REFERENCE: [yes/no - functions match APIs]

STATUS: [VALID / NEEDS FIX: list issues]

IF NEEDS FIX: STOP - fix issues, re-run this prompt
IF VALID: Proceed to Prompt 40, bring function signatures

Output format:
```
## FUNCTION: [name]([params])

- Params: [param1, param2] or "none"
- Type: [Event Handler / Utility / Init]
- Purpose: [text]
- Triggers: [event type on selector] (Event Handler only)
- Reads: [DOM elements / data]
- Modifies: [DOM elements / data]
- Returns: [type]
- Async: [yes/no]
- Global: [yes/no - needs window.* prefix?]
```

MAX 40 lines. DO NOT write code.

COMMON ERRORS:
- Missing window.* prefix for onclick handlers
- Function >25 lines (should split)
- Wrong function type classification
- Function for non-existent HTML element
```

**EXAMPLE OUTPUT for orders.html:**
```
## CHECKPOINT

INPUT RECEIVED: yes - HTML and APIs from Prompt 23, 24, 35
EXISTING JS READ: yes - 5 patterns extracted
HTML GREPPED: yes - 12 interactive elements found
API CROSS-REFERENCE: yes - functions match APIs

STATUS: VALID

## FUNCTION: initPage()

- Params: none
- Type: Init
- Purpose: Initialize page, capture initial form values, setup dirty listeners
- Triggers: DOMContentLoaded
- Reads: .dirty-check inputs, .glass-panel.loading
- Modifies: initialState object, removes .loading from panels
- Returns: void
- Async: no
- Global: no

## FUNCTION: validateForm(formData)

- Params: formData (object)
- Type: Utility
- Purpose: Validate form data before submit
- Triggers: N/A (called by handleSubmit)
- Reads: formData object
- Modifies: none
- Returns: { valid: boolean, errors: array }
- Async: no
- Global: no

## FUNCTION: toggleEditRow(btn)

- Params: btn (element)
- Type: Event Handler
- Purpose: Toggle edit mode for table row, create dropdowns dynamically
- Triggers: click on .action-btn-wrap (edit icon)
- Reads: row cells content
- Modifies: row cells (adds .custom-select-wrap), row .entity-editing class
- Returns: void
- Async: no
- Global: yes (window.toggleEditRow for onclick)
```

### Prompt 40: Function Patterns
```
Add PATTERNS to function signatures from Prompt 39

Functions:
- [paste from Prompt 39]

STEP 1: CROSS-REFERENCE with Prompt 39
Ensure all functions from 39 are covered.

STEP 2: READ existing JS for pattern examples
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract:
- Async pattern (try/catch, loading, toast)
- Dirty checking pattern
- Modal pattern

STEP 3: APPLY patterns to each function

ASYNC RULES (for Async: yes functions):
- MUST have try/catch block
- MUST have loading state (.loading class on button)
- MUST have toast feedback (success/error via translationEngine)
- MUST validate inputs before fetch

DIRTY CHECKING (for form-modifying functions):
- Dirty: [yes/no] - modifies form inputs?
- Calls checkDirty: [yes/no] - after modification?
- Updates table-dirty-flag: [yes/no] - for table edits?

MODAL FUNCTIONS:
- Opens modal: [modal id]
- Closes modal: [modal id]
- Clears form: [yes/no] - reset inputs on close?
- Locks scroll: [yes/no] - sets document.body.style.overflow = 'hidden'?

FORM SUBMIT FUNCTIONS:
- MUST call e.preventDefault() to prevent page reload

SEARCH INPUT FUNCTIONS:
- Needs debounce: [yes/no] - delays API calls by 300ms

TABLE EDITING (for toggleEditRow/toggleEditLog functions):
- Creates dropdowns: [yes/no] - dynamically creates .custom-select-wrap?
- Calls initCustomSelect: [yes/no] - for new dropdowns?

INLINE ONCLICK (for delete/remove actions in HTML):
- MUST call checkDirty() after DOM removal

I18N:
- Uses translationEngine: [yes/no] - for dynamic text/titles?

Output format (use ONLY relevant fields):
- Async functions: Loading, Toast, I18N
- Modal functions: Opens/Closes, Clears form, Locks scroll
- Table editing: Creates dropdowns, Calls initCustomSelect
- Search inputs: Needs debounce
- Form modifying: Dirty, Calls checkDirty

EXISTING JS READ: [yes / no]
CROSS-REFERENCE 39: [yes / no]
MAX 35 lines. DO NOT write code.

COMMON ERRORS:
- Missing loading state for async function
- Missing toast feedback for user actions
- Missing checkDirty() call after form modification
- Missing initCustomSelect() for dynamically created dropdowns
- Missing translationEngine for dynamic text
- Missing e.preventDefault() for form submit
- Missing scroll lock for modal open/close
- Missing debounce for search input
```

**EXAMPLE OUTPUT for orders.html:**
```
## FUNCTION: loadOrders(page, filters)

- Loading: #orders-table
- Toast: msg.load_success / msg.load_error
- I18N: yes (toast messages)

## FUNCTION: toggleEditRow(btn)

- Creates dropdowns: yes (product select)
- Calls initCustomSelect: yes
- I18N: yes (dropdown options text)

## FUNCTION: searchProducts(query)

- Needs debounce: yes (300ms)
- I18N: yes (loading/error messages)

## FUNCTION: openCreateModal()

- Opens modal: #create-modal
- Clears form: yes
- Locks scroll: yes
- I18N: no
```

### Prompt 41: Init & Global Handlers
```
Define INIT SETUP and GLOBAL HANDLERS for orders.html

Functions:
- [paste from Prompt 40]

STEP 1: READ existing JS for init/global patterns
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract:
- Init setup pattern
- Global handler pattern
- Dirty checking setup

STEP 2: GREP HTML for forms and dropdowns
Command: grep -o '<form\|\.dirty-check\|\.custom-select\|\.datepicker' demo/panini/pages/[page].html
Determine what init/global setup is needed.

STEP 3: CROSS-REFERENCE with Prompt 40
Ensure init/global handlers match function definitions.

STEP 4: DEFINE init setup (ONLY for pages with forms)
INIT SETUP (ONLY for pages with forms):
- Check HTML for <form> or .dirty-check elements
- Create #table-dirty-flag hidden input (for editable tables)
- Add input/change listeners to .dirty-check elements -> call checkDirty
- Staggered panel loading: remove .loading with 300ms + (index * 100ms) delay
- Call captureState() with setTimeout(1500ms) after panels loaded

STEP 5: DEFINE global handlers (ONLY for pages with dropdowns)
GLOBAL HANDLERS (ONLY for pages with dropdowns):
- Check HTML for .custom-select, .tag-dropdown, .datepicker
- document click: close all .custom-select-list, .tag-dropdown, .datepicker-popup
- Reset z-index on closed elements
- Escape key: close modals, dropdowns when e.key === 'Escape'

MODAL CLICK OUTSIDE:
- Click on modal backdrop (e.target === modal) closes modal

Output format:
```
## INIT: [setup name]

- Purpose: [description]
- Creates: [DOM elements created]
- Calls: [functions called]

## GLOBAL: [type]

- Handler: [function name]
- Purpose: [description]
```

EXISTING JS READ: [yes / no]
HTML GREPPED: [yes / no]
MAX 30 lines.

COMMON ERRORS:
- Missing #table-dirty-flag creation for editable tables
- Missing .dirty-check input/change listeners
- Missing staggered loading for .glass-panel.loading
- Missing Escape key handler for modals/dropdowns
- Missing click outside handler for modals
- Adding init setup when page has no forms
```

**EXAMPLE OUTPUT for orders.html:**
```
## INIT: table-dirty-flag

- Purpose: Track table edits for dirty checking
- Creates: hidden input #table-dirty-flag.dirty-check
- Calls: none

## INIT: dirty-check listeners

- Purpose: Trigger checkDirty on form input changes
- Creates: none
- Calls: checkDirty on input/change events for .dirty-check elements

## GLOBAL: document click

- Handler: closeAllDropdowns
- Purpose: Close all .custom-select-list, .tag-dropdown, .datepicker-popup

## GLOBAL: keydown Escape

- Handler: closeOnEscape
- Purpose: Close modals and dropdowns when Escape key pressed
```

**ALTERNATIVE OUTPUT for analytics.html (no forms):**
```
## INIT: staggered panel loading

- Purpose: Animate panels loading sequentially
- Creates: none
- Calls: Removes .loading class with 300ms + (index * 100ms) delay per panel

## GLOBAL: document click

- Handler: closeAllDropdowns
- Purpose: Close all .custom-select-list, .tag-dropdown, .datepicker-popup

NOTE: No dirty-check setup needed - page has no forms
```

### Prompt 42: Event Delegation
```
Define EVENT DELEGATION MAP for orders.html

Functions:
- [paste from Prompt 40]

STEP 1: READ existing JS for event delegation patterns
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract:
- Event delegation pattern
- Stop propagation usage
- Z-index management

STEP 2: CROSS-REFERENCE with Prompt 40
Ensure event handlers match function definitions.

STEP 3: DEFINE event delegation map

EVENT DELEGATION PATTERN:
- Use document delegation for dynamic elements (table rows, list items)
- Use container delegation for modals (#modal-id)

STOP PROPAGATION (for dropdown triggers):
- MUST call e.stopPropagation() to prevent global close handler
- Required for: .custom-select-trigger, .datepicker-trigger, .tag-input

Z-INDEX MANAGEMENT (for dropdowns/popups):
- Element: zIndex = "9999" when open, "1" when closed
- Parent .glass-panel: zIndex = "5000" when open, "1" when closed

DYNAMIC ELEMENTS:
- Creates elements: [yes/no] - adds new DOM nodes?
- Needs translationEngine.translateNewElements: [yes/no]
- Needs initCustomSelect: [yes/no] - for dropdowns in new elements?

EVENT TYPES:
- click: buttons, links, triggers
- change: selects, checkboxes, radios
- input: text fields (real-time validation)
- keydown: Enter key in inputs (e.key === 'Enter')

DEBOUNCE:
- Search inputs MUST use debounce (300ms delay)

Output format:
```
## EVENT: [type] on [selector]

- Handler: [function name]
- Delegation: [document / container element]
- StopPropagation: [yes/no] (dropdown triggers = yes)
- Z-Index: [yes/no - needs management?]
- Creates elements: [yes/no]
- Note: [special handling - debounce, initCustomSelect, etc.]
```

EXISTING JS READ: [yes / no]
CROSS-REFERENCE 24b: [yes / no]
MAX 30 lines.

COMMON ERRORS:
- Wrong event type (click vs change for inputs)
- Missing delegation for dynamic elements
- Missing e.stopPropagation() for dropdowns
- Missing initCustomSelect() for dropdowns in new elements
- Missing debounce for search inputs
- Missing z-index management for dropdowns
- Missing translationEngine.translateNewElements for dynamic content
```

**EXAMPLE OUTPUT for orders.html:**
```
## EVENT: click on .custom-select-trigger

- Handler: toggleDropdown
- Delegation: document
- StopPropagation: yes (prevent global close)
- Z-Index: yes (wrap + parent .glass-panel)
- Creates elements: no
- Note: none

## EVENT: click on #btn-add-row

- Handler: addTableRow
- Delegation: document
- StopPropagation: no
- Z-Index: no
- Creates elements: yes (tr element with .custom-select-wrap)
- Note: Call translationEngine.translateNewElements(row), then initCustomSelect()

## EVENT: keydown on .tag-input

- Handler: addTag
- Delegation: document
- StopPropagation: no
- Z-Index: no
- Creates elements: yes (.tag element)
- Note: Check e.key === 'Enter', e.preventDefault(), call checkDirty()
```

### Prompt 43: Validate Selectors
```
VALIDATE selectors and basic structure

STEP 1: GREP HTML for selectors
Command: grep -o 'id="[^"]*"\|class="[^"]*"' demo/panini/pages/[page].html
Extract all IDs and classes.

STEP 2: CROSS-REFERENCE with Prompt 39 functions
Check each selector used in functions:
- [selector] -> found? [yes/no]

STEP 3: GREP for .dirty-check classes
Command: grep '\.dirty-check' demo/panini/pages/[page].html
- All form inputs have .dirty-check class?
- Required for checkDirty() to track them

STEP 4: CHECK function count
- If > 8: WARN - consider splitting logic file

STEP 5: CHECK global functions
- Functions used in HTML onclick have window.* prefix?

Output:
```
## VALIDATION RESULT

SELECTORS:
[ ] [selector]: [found / NOT FOUND in HTML]
[ ] [selector]: [found / NOT FOUND in HTML]

DIRTY-CHECK CLASSES:
[ ] All form inputs have .dirty-check: [yes / NO - missing: #field1, #field2]

FUNCTION COUNT: [N] ([valid / too many])

GLOBAL FUNCTIONS: [all have window.* / MISSING for: func1, func2]

HTML GREPPED: [yes / no]
STATUS: [SELECTORS VALID / NEEDS REVISION: list issues]
```

MAX 20 lines.
```

**EXAMPLE OUTPUT for orders.html:**
```
## VALIDATION RESULT

SELECTORS:
[ ] #apply-filters-btn: found
[ ] #orders-table: found
[ ] .custom-select-trigger: found
[ ] #nonexistent-btn: NOT FOUND in HTML

DIRTY-CHECK CLASSES:
[ ] All form inputs have .dirty-check: NO - missing #customer-name, #order-date

FUNCTION COUNT: 6 (valid)

GLOBAL FUNCTIONS: MISSING for toggleEditRow (needs window.*)

STATUS: NEEDS REVISION - selector not found, dirty-check classes missing, global function missing
```

### Prompt 44: Validate Patterns
```
VALIDATE advanced patterns in logic spec

Functions:
- [paste from Prompt 40]

Events:
- [paste from Prompt 41/42]

STEP 1: CROSS-REFERENCE with Prompt 40 and 41/42
Ensure all functions and events are covered.

STEP 2: CHECK async patterns
- All Async: yes have Loading: specified?
- All Async: yes have Toast: specified?
- All Async: yes have I18N: yes?

STEP 3: CHECK dirty checking
- All Dirty: yes functions have Calls checkDirty: yes?
- Init function captures initialState?
- captureState called with setTimeout(1500ms)?

STEP 4: CHECK event delegation
- Dynamic elements use document delegation?
- All dropdowns have StopPropagation: yes?

STEP 5: CHECK z-index management
- All dropdowns have Z-Index: yes?

STEP 6: CHECK dynamic elements
- All Creates elements: yes have Note about translationEngine?
- All dropdowns in new elements have Needs initCustomSelect: yes?

STEP 7: CHECK init setup
- #table-dirty-flag created for editable tables?
- .dirty-check listeners added (input/change)?
- Staggered panel loading defined?

STEP 8: CHECK modal patterns
- All modal functions have Locks scroll: yes?
- Escape key handler defined?
- Click outside modal handler defined?

STEP 9: CHECK form patterns
- All form submit handlers have e.preventDefault()?
- All search inputs have debounce?

Output:
```
## VALIDATION RESULT

## ASYNC & I18N:
[ ] All async functions have Loading: [yes / NO - missing: func1, func2]
[ ] All async functions have Toast: [yes / NO - missing: func1, func2]

## DIRTY & INIT:
[ ] All Dirty: yes have Calls checkDirty: [yes / NO - missing: func1]
[ ] Init function defined: [yes / NO]

## DELEGATION & Z-INDEX:
DELEGATION: [correct / needs revision - reason]
STOP PROPAGATION: [all dropdowns have yes / MISSING for: selector1]
Z-INDEX: [all handled / MISSING for: selector1, selector2]

## MODAL & FORM:
[ ] All modals have Locks scroll: [yes / NO - missing: func1]
[ ] All form submits have preventDefault: [yes / NO - missing: func1]

ERRORS FOUND: [N]
STATUS: [PATTERNS VALID / NEEDS REVISION]
```

MAX 40 lines.
```

**EXAMPLE OUTPUT for orders.html:**
```
## VALIDATION RESULT

## ASYNC & I18N:
[ ] All async functions have Loading: yes
[ ] All async functions have Toast: yes

## DIRTY & INIT:
[ ] All Dirty: yes have Calls checkDirty: yes
[ ] Init function defined: yes

## DELEGATION & Z-INDEX:
DELEGATION: correct - dynamic rows use document delegation
STOP PROPAGATION: MISSING for .datepicker-trigger
Z-INDEX: MISSING for .datepicker-trigger

## MODAL & FORM:
[ ] All modals have Locks scroll: MISSING for openCreateModal
[ ] All form submits have preventDefault: yes

ERRORS FOUND: 3
STATUS: NEEDS REVISION - stopPropagation, z-index, modal scroll lock missing
```

**ALTERNATIVE OUTPUT for suppliers.html (VALID):**
```
## VALIDATION RESULT

## ASYNC & I18N:
[ ] All async functions have Loading: yes
[ ] All async functions have Toast: yes

## DIRTY & INIT:
[ ] All Dirty: yes have Calls checkDirty: yes
[ ] Init function defined: yes

## DELEGATION & Z-INDEX:
DELEGATION: correct
STOP PROPAGATION: all dropdowns have yes
Z-INDEX: all handled

## MODAL & FORM:
[ ] All modals have Locks scroll: yes
[ ] All form submits have preventDefault: yes

ERRORS FOUND: 0
STATUS: PATTERNS VALID
```

### Prompt 44b: Validate JS Completeness
```
VALIDATE JS COMPLETENESS for [page]_logic.js:

INPUT REQUIRED: Functions from Prompt 39, Events from Prompt 42, JS file from Prompt 45-53
IF INPUT missing: ERROR - run Prompt 39, 42, 45-53 first, STOP

STEP 1: GREP all function definitions
Command: grep -n "^function\|^async function\|const.*=.*function\|const.*=.*async" demo/assets/js/[page]_logic.js
EXTRACT and OUTPUT:
- All functions found: [list function names]
- Total count: [N]
IF OUTPUT empty: ERROR - no functions found in JS, STOP

STEP 2: CROSS-REFERENCE with Prompt 39 signatures from INPUT
For each function defined in Prompt 39:
- Function exists in JS: [yes / NO - MISSING]
- Params match: [yes / MISMATCH]
- Async signature correct: [yes / MISMATCH]
- Global exposure (window.*) correct: [yes / NO - MISSING for onclick handlers]

STEP 3: CHECK global function exposure
Command: grep -n "window\." demo/assets/js/[page]_logic.js
For each function used in HTML onclick:
- Has window.* assignment: [yes / NO - onclick won't work]
- Example: window.toggleEditRow = toggleEditRow

STEP 4: CHECK event listener registration
Command: grep -n "addEventListener\|\.onclick\|document\.on" demo/assets/js/[page]_logic.js
For each event from Prompt 42 INPUT:
- Listener registered: [yes / NO - event won't fire]
- Correct selector used: [yes / MISMATCH]

STEP 5: CHECK required utility functions
Command: grep -n "function showToast\|function checkDirty\|function captureState\|function debounce" demo/assets/js/[page]_logic.js
For each utility used in Prompt 40 patterns:
- Function exists: [yes / NO - MISSING]
- Implementation present: [yes / just reference]

STEP 6: CHECK DOMContentLoaded setup
Command: grep -n "DOMContentLoaded\|document.addEventListener('DOMContentLoaded'" demo/assets/js/[page]_logic.js
- Init function called on load: [yes / NO - page won't initialize]

STEP 7: CHECK function implementation completeness
For each function that was implemented:
- Has all required logic from Prompt 40: [yes / INCOMPLETE]
- Error handling present (async): [yes / NO]
- Loading state managed (async): [yes / NO]

## CHECKPOINT

INPUT RECEIVED: [yes/no - functions, events, JS from Prompt 39, 42, 45-53]
FUNCTIONS GREPPED: [yes/no - N functions found]
CROSS-REFERENCE: [yes/no - all Prompt 39 functions match]
EVENT LISTENERS: [yes/no - all Prompt 42 events registered]

STATUS: [JS COMPLETE / NEEDS IMPLEMENTATION: list issues]

IF NEEDS IMPLEMENTATION: STOP - fix issues, re-run this prompt
IF VALID: Proceed to Prompt 54 (CSS Styles)

Output:
```
## JS COMPLETENESS TEST

FUNCTIONS:
- Defined in JS: [N]
- Defined in Prompt 39: [M]
- Missing: [list / none]

GLOBAL EXPOSURE:
- [function]: window.* [present / MISSING - onclick won't work]

EVENT LISTENERS:
- [event on selector]: listener [registered / MISSING - won't fire]

UTILITIES:
- showToast: [exists / MISSING]
- checkDirty: [exists / MISSING]
- captureState: [exists / MISSING]
- debounce: [exists / MISSING]

INIT SETUP:
- DOMContentLoaded calls init: [yes / NO - page won't initialize]

IMPLEMENTATION COMPLETENESS:
- [function]: [complete / INCOMPLETE: missing error handling / loading state]

ISSUES FOUND: [N]
STATUS: [JS COMPLETE / NEEDS IMPLEMENTATION: list]
```

MAX 35 lines. DO NOT write code.
```

**EXAMPLE 1: Complete JS**
```
## JS COMPLETENESS TEST

FUNCTIONS:
- Defined in JS: 8
- Defined in Prompt 39: 8
- Missing: none

GLOBAL EXPOSURE:
- toggleEditRow: window.* present
- handleSave: window.* present

EVENT LISTENERS:
- click on .custom-select-trigger: listener registered
- click on #save-btn: listener registered
- keydown on .tag-input: listener registered

UTILITIES:
- showToast: exists
- checkDirty: exists
- captureState: exists
- debounce: exists

INIT SETUP:
- DOMContentLoaded calls init: yes

IMPLEMENTATION COMPLETENESS:
- loadOrders: complete (error handling, loading state)
- toggleEditRow: complete

ISSUES FOUND: 0
STATUS: JS COMPLETE
```

**EXAMPLE 2: Incomplete JS**
```
## JS COMPLETENESS TEST

FUNCTIONS:
- Defined in JS: 5
- Defined in Prompt 39: 8
- Missing: validateForm, openCreateModal, handleDelete

GLOBAL EXPOSURE:
- toggleEditRow: window.* MISSING - onclick won't work
- handleSave: window.* MISSING - onclick won't work

EVENT LISTENERS:
- click on .custom-select-trigger: listener registered
- click on #save-btn: listener MISSING - won't fire
- keydown on .tag-input: listener MISSING - won't fire

UTILITIES:
- showToast: MISSING
- checkDirty: exists
- captureState: MISSING
- debounce: MISSING

INIT SETUP:
- DOMContentLoaded calls init: NO - page won't initialize

IMPLEMENTATION COMPLETENESS:
- loadOrders: INCOMPLETE: missing error handling
- toggleEditRow: INCOMPLETE: missing initCustomSelect call

ISSUES FOUND: 11
STATUS: NEEDS IMPLEMENTATION: missing functions, global exposure, event listeners, utilities, init setup
```

**COMMON ERRORS:**
```js
// WRONG: function defined but not exposed globally
function toggleEditRow(btn) { ... }
// MISSING: window.toggleEditRow = toggleEditRow;
// RESULT: onclick="toggleEditRow(this)" won't work

// WRONG: event listener not registered
// Prompt 42 says: click on #save-btn
// But JS has no: document.querySelector('#save-btn').addEventListener('click', handleSave);

// WRONG: utility function referenced but not defined
// Prompt 40 says: Toast: msg.load_success
// But showToast() function doesn't exist in JS

// WRONG: async function without error handling
async function loadOrders() {
    const data = await fetchOrders();  // NO try/catch - will crash on error
}

// WRONG: missing DOMContentLoaded setup
// Page has initPage() but it's never called
// MISSING: document.addEventListener('DOMContentLoaded', initPage);
```

---

## PHASE 8: JS IMPLEMENTATION

### Prompt 45: Implement Sync Function
```
Implement SYNC function: [name]

Signature:
- [paste from Prompt 39]

STEP 1: READ existing JS patterns
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract:
- Optional chaining patterns
- Early return patterns
- checkDirty() usage
DO NOT PROCEED without reading existing JS!

STEP 2: CROSS-REFERENCE with Prompt 39
Ensure function signature matches definition.

STEP 3: IMPLEMENT following patterns
Requirements:
- Use optional chaining (?.) for selectors
- Provide fallback values (|| 'default')
- Call checkDirty() after state changes
- MAX 20 lines

PATTERNS:
- Optional chaining: document.querySelector('#id')?.value || 'default'
- Early return: if (!el) return; at start
- Array of IDs: ['id1', 'id2'].forEach(id => ...) for DRY code
- classList.toggle with force: el.classList.toggle('class', condition)

COMMON ERRORS:
- Missing ?. on querySelector
- Wrong selector (check HTML)
- Forgetting checkDirty() call
- Hardcoded loops instead of Array.forEach
- Deep nesting instead of early return
- Missing null check before using value

Output: ONLY this function code.

EXISTING JS READ: [yes / no]
```

**EXAMPLE: Sync function with optional chaining:**
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

### Prompt 46: Implement Async Function
```
Implement ASYNC function: [name]

Signature:
- [paste from Prompt 39]

STEP 1: READ existing JS patterns
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract:
- Async pattern (try/catch, loading, finally)
- showToast pattern
- Error handling pattern
DO NOT PROCEED without reading existing JS!

STEP 2: CROSS-REFERENCE with Prompt 39
Ensure function signature matches definition.

STEP 3: IMPLEMENT following patterns
Requirements:
- Add try/catch error handling
- Add loading states (btn?.classList.add('loading'))
- Use finally for cleanup
- Call checkDirty() after state changes
- MAX 25 lines

PATTERNS:
- Loading state: btn?.classList.add('loading') / remove in finally
- Error handling: try { await... } catch { showToast() } finally { cleanup }
- Nested setTimeout: setTimeout(() => { action; setTimeout(() => cleanup, delay); }, delay)
- showToast: create container if not exists, append toast, remove after delay

COMMON ERRORS:
- Missing try/catch for async
- Missing loading state
- Missing finally cleanup
- Toast/notification not removed from DOM (memory leak)
- Missing error message to user

Output: ONLY this function code.

EXISTING JS READ: [yes / no]
```

**EXAMPLE: Async function with loading state:**
```js
async function loadOrders(page = 1, filters = {}) {
    const btn = document.querySelector('#load-btn');
    btn?.classList.add('loading');
    
    try {
        const data = await fetchOrders(page, filters);
        renderOrdersTable(data);
    } catch (err) {
        showToast('Error loading orders');
    } finally {
        btn?.classList.remove('loading');
    }
}
```

---

### Prompt 47: Implement Dropdown Component
```
Implement DROPDOWN: [name] (dropdown, datepicker, custom select)

Signature:
- [paste from Prompt 39]

STEP 1: READ existing JS patterns
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract:
- Dropdown pattern (stopPropagation, z-index)
- Close others pattern
- Panel z-index pattern
DO NOT PROCEED without reading existing JS!

STEP 2: CROSS-REFERENCE with Prompt 39
Ensure function signature matches definition.

STEP 3: IMPLEMENT following patterns
Requirements:
- Add e.stopPropagation() for dropdowns
- Manage z-index for dropdowns
- Close other dropdowns when opening
- Call checkDirty() after state changes
- MAX 25 lines

PATTERNS:
- z-index: wrap.style.zIndex = isOpen ? "9999" : "1"
- Close others: document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'))
- Panel z-index: wrap.closest('.glass-panel').style.zIndex = isOpen ? "5000" : "1"

COMMON ERRORS:
- Missing e.stopPropagation() in dropdowns
- Missing z-index for dropdown (covered by other panel)
- Forgetting to close other dropdowns

Output: ONLY this function code.

EXISTING JS READ: [yes / no]
```

**EXAMPLE: Dropdown with z-index and close others:**
```js
function initDropdown(id) {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    const trigger = wrap.querySelector('.dropdown-trigger');
    const list = wrap.querySelector('.dropdown-list');
    
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = list.classList.toggle('open');
        
        // z-index management
        wrap.style.zIndex = isOpen ? "9999" : "1";
        const panel = wrap.closest('.glass-panel');
        if (panel) panel.style.zIndex = isOpen ? "5000" : "1";
        
        // Close other dropdowns
        document.querySelectorAll('.dropdown-list').forEach(l => {
            if (l !== list) l.classList.remove('open');
        });
    });
}
```

---

### Prompt 48: Implement Dynamic Element
```
Implement DYNAMIC ELEMENT: [name] (add note, add tag, add file, dynamic list)

Signature:
- [paste from Prompt 39]

STEP 1: READ existing JS patterns
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract:
- Dynamic element pattern (createElement, appendChild)
- translationEngine usage
- Global function pattern
DO NOT PROCEED without reading existing JS!

STEP 2: CROSS-REFERENCE with Prompt 39
Ensure function signature matches definition.

STEP 3: IMPLEMENT following patterns
Requirements:
- Add i18n for dynamic elements
- createElement + appendChild pattern
- Call checkDirty() after state changes
- MAX 25 lines

PATTERNS:
- i18n new elements: if (typeof translationEngine !== 'undefined') translationEngine.translateNewElements(el)
- Translation fallback: typeof translationEngine !== 'undefined' ? translationEngine.getValueByPath(dict, 'key') : 'fallback'
- Global functions: window.fnName = function() { } for onclick handlers
- createElement + appendChild: document.body.appendChild(el) after createElement
- Container check: if (!container) { create + appendChild } before use

COMMON ERRORS:
- Missing translationEngine check (crash if undefined)
- Forgetting translateNewElements for dynamic content
- createElement without appendChild (element not in DOM)
- Duplicate containers (missing if (!container) check)

Output: ONLY this function code.

EXISTING JS READ: [yes / no]
```

**EXAMPLE: Dynamic element with i18n:**
```js
function addNote(text) {
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.innerHTML = `<div class="note-text">${text}</div>`;
    
    notesList.prepend(noteItem);
    
    // Translate new element
    if (typeof translationEngine !== 'undefined') {
        translationEngine.translateNewElements(noteItem);
    }
    checkDirty();
}
```

Use Prompt 47 for dropdowns/datepickers, 48 for dynamic elements/global functions.

### Prompt 49: Setup JS State & References
```
SETUP orders_logic.js - Part 1: State & References

STEP 1: READ existing JS patterns
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract:
- DOMContentLoaded pattern
- Staggered loading pattern
- Hidden input creation
- State variable pattern
DO NOT PROCEED without reading existing JS!

STEP 2: CROSS-REFERENCE with Prompt 41
Ensure init setup matches definition.

STEP 3: IMPLEMENT setup following patterns
Add:
- DOMContentLoaded wrapper
- Staggered loading for panels (baseDelay + index * 100)
- DOM element references at top (saveBtn, mandatoryField)
- Hidden inputs for state tracking (createElement + appendChild to body)
- State variables (initialState, filtersData)

PATTERNS:
- Staggered delay: baseDelay + (index * 100) for sequential animation
- Hidden input: type='hidden', className='dirty-check', appendChild to body
- Early null check: if (!el) return; before using element

COMMON ERRORS:
- Missing appendChild for hidden inputs
- Wrong className (dirty-check vs dirtyCheck)
- Forgetting to set input.value
- Missing DOMContentLoaded wrapper

Output: ONLY setup code (lines 1-30).

EXISTING JS READ: [yes / no]
```

**EXAMPLE OUTPUT:**
```js
window.addEventListener('DOMContentLoaded', () => {
    // 1. Staggered loading for panels
    const panels = document.querySelectorAll('.glass-panel.loading');
    panels.forEach((panel, index) => {
        const baseDelay = 300;
        const staggeredDelay = baseDelay + (index * 100);
        setTimeout(() => panel.classList.remove('loading'), staggeredDelay);
    });
    
    // 2. DOM element references
    const saveBtn = document.getElementById('save-btn');
    const mandatoryField = document.getElementById('field-name');
    
    // 3. Hidden inputs for state tracking
    const tableDirtyFlag = document.createElement('input');
    tableDirtyFlag.type = 'hidden';
    tableDirtyFlag.id = 'table-dirty-flag';
    tableDirtyFlag.className = 'dirty-check';
    tableDirtyFlag.value = '0';
    document.body.appendChild(tableDirtyFlag);
    
    // 4. State variables
    let initialState = {};
    let filtersData = {};
```

### Prompt 50: Assemble Helpers & Global Functions
```
ASSEMBLE orders_logic.js - Part 2a: Helpers & Global Functions

STEP 1: READ existing JS patterns
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract:
- Helper function pattern
- Global function pattern (window.*)
- Component initializer pattern
DO NOT PROCEED without reading existing JS!

STEP 2: CROSS-REFERENCE with Prompt 45/46/47
Ensure all functions from 45/46/47 exist.

STEP 3: CROSS-REFERENCE with Prompt 49
Ensure setup from 49 exists.

STEP 4: ASSEMBLE functions following patterns
Add:
- Helper functions (showToast, captureState)
- Global functions for onclick (window.fnName = fn)
- Component initializers (initCustomSelect, initDatePicker)

PATTERNS:
- Global function: window.fnName = function() { } for onclick in HTML
- Helper: not exposed to window, internal use only

COMMON ERRORS:
- Missing window. prefix for onclick handlers
- Forgetting to define helper before using

EXISTING JS READ: [yes / no]
CROSS-REFERENCE 27a/27b/27c: [yes / no]
MAX 50 lines

Output: Functions section only.
```

**EXAMPLE OUTPUT:**
```js
    // 5. Helper functions (not exposed)
    function showToast(msg) { ... }
    function captureState() { ... }
    
    // 6. Main functions
    function applyFilters() { ... }
    function loadOrders() { ... }
    
    // 7. Global functions for onclick handlers
    window.checkDirty = () => { ... };
    window.handleSave = function() { ... };
    window.toggleEdit = function(btn) { ... };
    
    // 8. Component initializers
    function initCustomSelect(id) { ... }
    function initDatePicker(id) { ... }
```

---

### Prompt 51: Assemble Events & Init Calls
```
ASSEMBLE orders_logic.js - Part 2b: Events & Init Calls

STEP 1: READ existing JS patterns
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract:
- Event listener pattern
- Event delegation pattern
- Init call pattern
- Opacity fix pattern
DO NOT PROCEED without reading existing JS!

STEP 2: CROSS-REFERENCE with Prompt 50
Ensure functions from 50 exist.

STEP 3: CROSS-REFERENCE with Prompt 41/42
Ensure events match definition.

STEP 4: ASSEMBLE events following patterns
Add:
- Event listeners on .dirty-check elements
- Global click handler (close dropdowns)
- Event delegation setup
- Init calls
- setTimeout captureState (1500ms)
- Opacity fix for i18n

PATTERNS:
- Event listener: .forEach(el => el.addEventListener('event', handler))
- Init call: initComponent('id') after definition
- Delayed init: setTimeout(captureState, 1500) for DOM ready

COMMON ERRORS:
- Forgetting to call init functions
- Missing .dirty-check event listeners
- Forgetting setTimeout(captureState, 1500)
- Missing opacity fix for i18n elements

EXISTING JS READ: [yes / no]
CROSS-REFERENCE 28b-1: [yes / no]
MAX 40 lines

Output: Events section only.
```

**EXAMPLE OUTPUT:**
```js
    // 9. Event listeners on .dirty-check elements
    document.querySelectorAll('.dirty-check').forEach(input => {
        input.addEventListener('input', checkDirty);
        input.addEventListener('change', checkDirty);
    });
    
    // 10. Global click handler (close dropdowns)
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-list').forEach(d => d.classList.remove('open'));
    });
    
    // 11. Event delegation setup
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        // ... handle actions
    });
    
    // 12. Init calls
    initCustomSelect('select-status');
    initDatePicker('datepicker-main');
    
    // 13. Delayed initial state capture
    setTimeout(captureState, 1500);
    
    // 14. Opacity fix for i18n
    setTimeout(() => {
        document.querySelectorAll('[data-i18n]').forEach(el => el.style.opacity = '1');
    }, 100);
});
```

Run Prompt 49, then 50, then 51 to complete the file.
### Prompt 52: Validate Selectors & Functions
```
VALIDATE orders_logic.js - Part 1: Selectors & Functions

STEP 1: GREP HTML for IDs and classes
Command: grep -o 'id="[^"]*"' demo/panini/pages/[page].html
Command: grep -o 'class="[^"]*"' demo/panini/pages/[page].html
Extract all IDs and classes.

STEP 2: GREP JS for selectors
Command: grep -o "querySelector\('[^']*'\)" demo/assets/js/[page]_logic.js
Command: grep -o 'querySelector\("[^"]*"\)' demo/assets/js/[page]_logic.js
Extract all selectors used in JS.

STEP 3: CROSS-REFERENCE selectors with HTML
For each selector in JS:
- querySelector('#id') -> id exists in HTML?
- querySelector('.class') -> class exists in HTML?

STEP 4: GREP for data-action attributes
Command: grep -o 'data-action="[^"]*"' demo/panini/pages/[page].html
Check event delegation matches.

STEP 5: GREP for global functions
Command: grep -o 'window\.[a-zA-Z]*' demo/assets/js/[page]_logic.js
Command: grep -o 'onclick="[^"]*"' demo/panini/pages/[page].html
Cross-reference window.* with onclick handlers.

STEP 6: RUN build
Command: cd demo && gulp build

MAX 20 lines output

Output:
```
## VALIDATION RESULT

SELECTORS:
[ ] '#load-btn': found
[ ] '.order-item': found
[ ] '#missing-id': NOT FOUND

EVENT HANDLERS:
[ ] data-action="delete": matches

GLOBAL FUNCTIONS:
[ ] window.handleSave: defined
[ ] window.toggleEditRow: defined
[ ] onclick="window.toggleEditRow(this)": matches

GREP COMMANDS RUN: [yes / no]
BUILD: success

STATUS: SELECTORS VALID / NEEDS FIX
COMMON ERRORS:
- Typo in selector (#loadBtn vs #load-btn)
- Missing data-action attribute in HTML
- onclick="window.fn()" but window.fn not defined
```

**EXAMPLE: Valid result:**
```
## VALIDATION RESULT

SELECTORS:
[+] '#save-btn': found
[+] '.dirty-check': found (5 elements)

EVENT HANDLERS:
[+] data-action="save": matches

GLOBAL FUNCTIONS:
[+] window.handleSave: defined

BUILD: success

STATUS: SELECTORS VALID
```

---

### Prompt 53: Validate Patterns & Safety
```
VALIDATE orders_logic.js - Part 2: Patterns & Safety

STEP 1: READ existing JS for pattern reference
Command: Read demo/assets/js/admin/supplier_card_logic.js
Extract patterns for validation.

STEP 2: GREP for i18n safety
Command: grep 'typeof translationEngine' demo/assets/js/[page]_logic.js
Command: grep 'translateNewElements' demo/assets/js/[page]_logic.js
Check:
- typeof translationEngine !== 'undefined' check present?
- translationEngine.translateNewElements(el) called after createElement?

STEP 3: GREP for state management
Command: grep 'checkDirty' demo/assets/js/[page]_logic.js
Command: grep 'captureState' demo/assets/js/[page]_logic.js
Command: grep '\.dirty-check' demo/assets/js/[page]_logic.js
Check:
- checkDirty() called after state changes?
- setTimeout(captureState, 1500) present?
- Event listeners on .dirty-check elements?

STEP 4: GREP for z-index pattern
Command: grep 'zIndex' demo/assets/js/[page]_logic.js
Check: wrap.style.zIndex = isOpen ? "high" : "1" for dropdowns?

STEP 5: GREP for DOM safety
Command: grep 'createElement' demo/assets/js/[page]_logic.js
Command: grep 'appendChild' demo/assets/js/[page]_logic.js
Check:
- createElement followed by appendChild?
- classList.toggle with force parameter?

MAX 25 lines output

Output:
```
## VALIDATION RESULT

I18N SAFETY:
[ ] typeof translationEngine !== 'undefined': present
[ ] translationEngine.translateNewElements(): called after createElement

STATE MANAGEMENT:
[ ] checkDirty() calls: present (5 locations)
[ ] setTimeout(captureState, 1500): present
[ ] Event listeners on .dirty-check: present

Z-INDEX PATTERN:
[ ] wrap.style.zIndex: correct pattern

DOM SAFETY:
[ ] createElement + appendChild: all elements added

GREP COMMANDS RUN: [yes / no]
STATUS: PATTERNS VALID / NEEDS FIX
```

COMMON ERRORS:
- Missing translationEngine check (crash if undefined)
- Forgetting translateNewElements for dynamic content
- Missing checkDirty() call after state change
- Missing setTimeout(captureState, 1500)
- createElement without appendChild (element not in DOM)
```

**EXAMPLE: Valid result:**
```
## VALIDATION RESULT

I18N SAFETY:
[+] typeof translationEngine !== 'undefined': present
[+] translationEngine.translateNewElements(): called after createElement

STATE MANAGEMENT:
[+] checkDirty() calls: present (5 locations)
[+] setTimeout(captureState, 1500): present

STATUS: PATTERNS VALID
```

---

## PHASE 9: STYLES

### Prompt 54: CSS Reference
```
Read CSS reference for [page].html

STEP 1: READ CSS variables file
Command: Read demo/assets/css/admin/_variables.css
DO NOT PROCEED without reading _variables.css!

STEP 2: EXTRACT available variables
AVAILABLE CSS VARIABLES:
- Colors: --primary, --primary-dark, --danger
- Layout: --sidebar-w (280px), --header-h (64px)
- Glass: --glass-light, --glass-border, --glass-glow
- Text: --text, --text-dim, --text-nav

NOTE: NO --spacing-*, --color-*, --radius-* exist!

STEP 3: GREP for existing patterns
Command: grep -r "\.entity-card-grid\|\.btn-save\|\.glass-input" demo/assets/css/admin/
Identify reusable classes.

EXISTING PATTERNS (reuse, don't create new):

**Grid:**
- .entity-card-grid: 3-column (1fr 2fr 1fr)
- .bcc-grid: 3-column for BCC
- .entity-col-left/center/right

**Buttons:**
- .btn-save, .btn-secondary, .btn-primary, .btn-text, .btn-sm, .btn-icon

**Forms:**
- .glass-input, .field-label, .input-group

**States:**
- .loading, .active, .open, .dirty

BREAKPOINTS: 1200px, 992px, 600px

Z-INDEX: 10 (sticky), 100 (panel dropdown), 1001 (dropdown), 9999 (modal), 10000 (toast)

COLORS: #1890FF (primary), #ff4d4f (danger), #52c41a (success)

VARIABLES FILE READ: [yes / no]
MAX 30 lines. DO NOT write CSS.
```

**EXAMPLE OUTPUT:**
```
## CSS REFERENCE READ

VARIABLES: --primary, --sidebar-w, --glass-light, --text
GRID: .entity-card-grid, .entity-col-*
BUTTONS: .btn-save, .btn-secondary, .btn-primary
FORMS: .glass-input, .field-label, .input-group
STATES: .loading, .active, .open, .dirty
BREAKPOINTS: 1200px, 992px, 600px
Z-INDEX: 10/100/1001/9999/10000
COLORS: #1890FF, #ff4d4f, #52c41a
```

### Prompt 55: CSS Analysis
```
Analyze CSS needs for [page].html

Input: Output from Prompt 54 (CSS Reference)

STEP 1: GREP HTML for all classes
Command: grep -o 'class="[^"]*"' demo/panini/pages/[page].html
Extract all class="..." values.

STEP 2: GROUP classes by type
Group by: layout, component, utility

STEP 3: GREP each class in CSS files
Command: grep -r "\.class-name" demo/assets/css/admin/
VERIFY each class exists before marking as NEW.

Check files (priority order):
1. demo/assets/css/admin/main.css (primary)
2. demo/assets/css/admin/components/_*.css
3. demo/assets/css/admin/base-layout.css

STEP 4: CROSS-REFERENCE with Prompt 54
Ensure reusable classes are identified.

COMMON ERRORS:
- Creating .page-grid when .entity-card-grid exists -> REUSE
- Creating .btn-submit when .btn-save exists -> REUSE
- Marking class as NEW when it exists -> VERIFY grep first
- Class found in multiple files -> LIST ALL files

Output:
```
## CSS ANALYSIS

REUSE (exists in [file]):
- .class-name - [file.css]

NEW (not found):
1. .[class-name]
   - Purpose: [text]
   - Properties: [list]
   - Responsive: [1200px/992px/600px behavior]
   - Z-index: [if applicable]
   - Used in: [section]
```

GREP COMMANDS RUN: [yes / no]
MAX 25 lines. DO NOT write CSS.
```

**EXAMPLE OUTPUT for orders.html:**
```
## CSS ANALYSIS

REUSE (exists in main.css):
- .glass-panel - components/_glass-panel.css
- .custom-select - components/_custom-select.css
- .btn, .btn-primary, .btn-secondary - main.css
- .flex-end, .flex-group - main.css

NEW (not found):
1. .orders-grid
   - Purpose: 2-column layout for filters + table
   - Properties: display: grid, gap: 24px
   - Responsive: 992px -> 1 column
   - Used in: page wrapper

2. .filter-row
   - Purpose: Single filter input row
   - Properties: display: flex, gap: 12px
   - Responsive: 600px -> wrap
   - Used in: Filters section
```

### Prompt 56: CSS Patterns Reference
```
Read CSS patterns for creating styles.

STEP 1: READ CSS variables file
Command: Read demo/assets/css/admin/_variables.css
DO NOT PROCEED without reading _variables.css!

STEP 2: EXTRACT available variables
AVAILABLE CSS VARIABLES:
- Colors: --primary, --primary-dark, --danger
- Layout: --sidebar-w, --header-h
- Glass: --glass-light, --glass-border, --glass-glow
- Text: --text, --text-dim, --text-nav

WARNING: NO --spacing-*, --color-*, --radius-* exist!

STEP 3: GREP for existing patterns
Command: grep -r "gap:\|padding:\|backdrop-filter:" demo/assets/css/admin/
Extract spacing and effect patterns.

PATTERNS (use these, don't invent new):

**Spacing:**
- Gap: 12px (small), 16px (medium), 24px (large)
- Padding: 4px 10px, 6px 12px, 8px 16px, 16px 24px, 20px 24px

**Dropdown/Popup:**
- background: rgba(40, 42, 48, 0.95)
- backdrop-filter: blur(25px) saturate(180%)
- border-radius: 10px, z-index: 1001

**Glass Panel:**
- background: var(--glass-light)
- backdrop-filter: blur(28px)

**Transitions:** 0.2s (fast), 0.3s (normal), 0.5s cubic-bezier (smooth)

**Font sizes:** 10px, 11px, 12px, 13px, 14px, 18px

**Border radius:** 4px, 6px, 8px, 10px, 12px, 14px, 16px, 20px, 50%

**Animations:** spin, skeleton-loading (use existing)

**Hover:** translateY(-1px), scale(1.1), background change

BREAKPOINTS: 1200px, 992px, 600px

VARIABLES FILE READ: [yes / no]
MAX 35 lines. DO NOT write CSS.
```

**EXAMPLE OUTPUT:**
```
## CSS PATTERNS READ

SPACING: gap 12/16/24px, padding 4px 10px / 6px 12px / 8px 16px
DROPDOWN: rgba(40,42,48,0.95), blur(25px), z-index 1001
GLASS: var(--glass-light), blur(28px)
TRANSITIONS: 0.2s / 0.3s / 0.5s cubic-bezier
FONT: 10/11/12/13/14/18px
RADIUS: 4/6/8/10/12/14/16/20px, 50%
ANIMATIONS: spin, skeleton-loading (existing)
HOVER: translateY(-1px), scale(1.1)
BREAKPOINTS: 1200px, 992px, 600px
```

### Prompt 57: Create CSS Block
```
Create CSS for: [class name]

Purpose: [text]
Properties: [list]
Responsive: [behavior]

Input: Output from Prompt 56 (CSS Patterns Reference)

STEP 1: GREP for variable existence
Command: grep "var(--[a-z-]*)" demo/assets/css/admin/_variables.css
Check variable exists in _variables.css before using.

STEP 2: CROSS-REFERENCE with Prompt 56
Ensure patterns match reference.

STEP 3: CREATE CSS block following patterns

COMMON ERRORS:
- Using --spacing-lg -> NOT DEFINED, use 24px
- Using --color-white -> NOT DEFINED, use #fff
- Wrong breakpoint (768px) -> USE 992px
- Missing backdrop-filter for dropdown -> ADD blur(25px)
- Wrong z-index (50) -> USE 1001
- Creating new @keyframes -> USE existing spin
- Missing :hover for button -> ADD hover state
- Using translateY(2px) -> USE translateY(-1px)

Requirements:
- Use available CSS variables OR hardcoded values
- Include responsive @media if layout class
- MAX 25 lines

Output: ONLY this CSS block.

GREP COMMAND RUN: [yes / no]
```

**EXAMPLE OUTPUT for .orders-grid:**
```css
.orders-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 24px;
}

@media (max-width: 992px) {
    .orders-grid {
        grid-template-columns: 1fr;
    }
}
```

**EXAMPLE OUTPUT for .filter-row:**
```css
.filter-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

@media (max-width: 600px) {
    .filter-row {
        flex-wrap: wrap;
    }
}
```

**COMMON ERRORS EXAMPLE:**
```css
/* WRONG: Non-existent variables */
.orders-grid {
    gap: var(--spacing-lg);     /* ERROR: --spacing-lg not defined */
    color: var(--color-white);  /* ERROR: --color-white not defined */
}

/* CORRECT: Use hardcoded values */
.orders-grid {
    gap: 24px;                  /* OK: direct value */
    color: #fff;                /* OK: hex value */
}

/* WRONG: Wrong breakpoint */
@media (max-width: 768px) { }   /* ERROR: project uses 992px */

/* CORRECT: Use project breakpoint */
@media (max-width: 992px) { }   /* OK: matches existing */
```

Repeat Prompt 57 for each new class (one at a time).

### Prompt 58: Assemble CSS File
```
ASSEMBLE [page].css

CSS blocks from Prompt 57:
- [paste all blocks]

VERIFY 1: Each block validated in Prompt 57.
VERIFY 2: Check [page].css doesn't exist yet.
  - If EXISTS: ABORT - use Prompt 59 (Merge CSS) instead
VERIFY 3: grep each class in main.css, components/_*.css, base-layout.css - no duplicates!

FILE PLACEMENT:
- Save to: demo/assets/css/admin/[page].css
- DO NOT add @import '_variables.css' (already in base-layout.css)
- File will be auto-included via gulp build (check gulpfile.js if not)

FRONTMATTER LINK:
- Add to [page].html frontmatter: customCss: [page].css
- Example: customCss: orders

COMMON ERRORS:
- Missing header comment -> ADD standard header
- Wrong order -> layout first, then components, then responsive
- Duplicate selectors -> MERGE into one block
- Class already in main.css -> REMOVE from new file
- Using non-existent variables -> USE hardcoded values
- Overwriting existing file -> CHECK file doesn't exist
- Missing frontmatter link -> ADD customCss to frontmatter

Requirements:
- Add file header comment (page name, purpose)
- Order: layout -> components -> responsive
- NO @import statement needed
- NO classes that exist in main.css
- MAX 50 lines total

Output: Complete CSS file.
```

**EXAMPLE OUTPUT for orders.css:**
```css
/*
 * Orders Page Styles
 * Purpose: 2-column layout with filters and table
 */

/* Layout */
.orders-grid {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 24px;
}

/* Components */
.filter-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

/* Responsive */
@media (max-width: 992px) {
    .orders-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 600px) {
    .filter-row {
        flex-wrap: wrap;
    }
}
```

### Prompt 59: CSS Validation Checks
```
Validate [page].css

CRITICAL: Read demo/assets/css/admin/_variables.css FIRST.

AVAILABLE VARIABLES:
- --primary, --primary-dark, --danger
- --sidebar-w, --header-h
- --glass-light, --glass-border, --glass-glow
- --text, --text-dim, --text-nav

NOTE: NO --spacing-*, --color-*, --radius-* exist!

VERIFY: grep each class in [page].html to confirm usage.

CHECKS:

1. Class usage: Each class exists in [page].html?
2. Variables: All vars defined in _variables.css?
3. Responsive: Layout classes have @media? Breakpoints 1200px/992px/600px?
4. Design patterns: Gap 12/16/24px? Glass backdrop-filter: blur(28px)?
5. Z-index: Dropdowns 1001? Modals 9999? Toasts 10000?
6. Colors: #1890FF (primary), #ff4d4f (danger), #52c41a (success)?
7. Frontmatter: customCss: [page] exists?
8. Animations: spin/skeleton-loading exist in main.css?
9. Hover states: Buttons have :hover?
10. State classes: .loading/.active/.open exist in main.css?
11. Run: gulp build

COMMON ERRORS:
- Using --spacing-lg, --color-white -> NOT DEFINED
- Wrong breakpoint (768px) -> USE 992px
- Wrong z-index (50, 200) -> USE hierarchy
- Color typo (#1890ff) -> USE #1890FF
- Missing customCss in frontmatter -> ADD
- Missing :hover for button -> ADD

MAX 30 lines. DO NOT write CSS.
```

**EXAMPLE OUTPUT:**
```
## VALIDATION CHECKS

1. Classes: .orders-grid, .filter-row -> both in HTML ✓
2. Variables: --primary, --glass-light -> both defined ✓
3. Responsive: 992px breakpoint -> matches ✓
4. Patterns: gap 24px -> standard ✓
5. Z-index: none used -> N/A ✓
6. Colors: #1890FF -> correct ✓
7. Frontmatter: customCss: orders -> present ✓
8. Animations: none -> N/A ✓
9. Hover: .filter-row -> no hover needed ✓
10. States: none -> N/A ✓
11. Build: gulp build -> success ✓

STATUS: ALL CHECKS PASSED
```

### Prompt 60: Validation Report
```
Generate validation report for [page].css

Input: Results from Prompt 59 (CSS Validation Checks)

Output format:
```
## CSS VALIDATION

CLASSES:
[ ] .[class]: [used in HTML / UNUSED]

VARIABLES:
[ ] --[var]: [defined / UNDEFINED]

RESPONSIVE:
[ ] Breakpoint: [matches / different]

DESIGN PATTERNS:
[ ] Gap values: [12/16/24px / arbitrary]
[ ] Glass effect: [correct / missing]

Z-INDEX:
[ ] Values: [matches hierarchy / conflicts]

COLORS:
[ ] Consistency: [#1890FF / typo]

FRONTMATTER:
[ ] customCss: [present / MISSING]

BUILD: [success / errors]

STATUS: [CSS VALID / NEEDS FIX]

If NEEDS FIX:
- Fix: [description]
```

MAX 25 lines. DO NOT write CSS.
```

**EXAMPLE 1: Valid CSS**
```
## CSS VALIDATION

CLASSES:
[ ] .orders-grid: used in HTML
[ ] .filter-row: used in HTML

VARIABLES:
[ ] --primary: defined in _variables.css
[ ] --glass-light: defined in _variables.css
[ ] No undefined variables

RESPONSIVE:
[ ] Breakpoint: 992px (matches existing)

DESIGN PATTERNS:
[ ] Gap values: 24px, 12px (standard)
[ ] Glass effect: N/A (no glass classes)

BUILD: success

STATUS: CSS VALID
```

**EXAMPLE 2: Needs Fix**
```
## CSS VALIDATION

CLASSES:
[ ] .orders-grid: used in HTML
[ ] .filter-row: UNUSED - not found in HTML

VARIABLES:
[ ] --spacing-lg: UNDEFINED - NOT IN _variables.css, use 24px
[ ] --color-white: UNDEFINED - NOT IN _variables.css, use #fff

RESPONSIVE:
[ ] Breakpoint: 768px (different from existing 992px)

DESIGN PATTERNS:
[ ] Gap values: 13px (arbitrary) -> USE 12px or 16px
[ ] Glass effect: missing backdrop-filter for .panel-glass

BUILD: success

STATUS: NEEDS FIX

Fix:
1. Remove .filter-row or add to HTML
2. Replace --spacing-lg with 24px (not defined)
3. Replace --color-white with #fff (not defined)
4. Change breakpoint from 768px to 992px
5. Change gap from 13px to 12px or 16px
```

---

## PHASE 10: INTEGRATION

### Prompt 61: Add Analytics Nav-Item
```
Add Analytics page link to sidebar (BEFORE group label)

STEP 1: READ sidebar.html
Read demo/panini/partials/layout/sidebar.html
DO NOT PROCEED without reading!

STEP 2: VERIFY NO DUPLICATE
Grep: grep "[path]" demo/panini/partials/layout/sidebar.html
If FOUND: STOP - nav link already exists

STEP 3: VERIFY PAGE EXISTS
Check: demo/panini/pages/[path].html
If NOT FOUND: STOP - create page first (PHASE 6)

STEP 4: VERIFY I18N KEY UNIQUE
Grep: grep "side.[key]" demo/assets/js/lang/*.json
If FOUND: STOP - key already used

STEP 5: VERIFY ICON EXISTS
Check icon in EXISTING ICONS list below
If NOT FOUND: STOP - choose from list

EXISTING ICONS:
pie-chart, stats-bars, sales-up, profit-coin, trend-growth,
alert-triangle, alert-tag, clock-history, clock-time

PATTERN (Analytics nav-item):
```html
<li><a href="{{root}}analytics/[page].html" class="nav-link{{#if activeNav}} {{activeNav}}{{/if}}">
    {{> icon name="[icon]" class="nav-icon"}}
    <span data-i18n="side.[key]">[Label]</span>
</a></li>
```

INSERT POSITION:
- BEFORE <div class="nav-group-label"> (line 15)
- AFTER last Analytics nav-item

**⚠️ CRITICAL BUG:** activeNav pattern is BROKEN!
CSS expects `.nav-link.active` but activeNav adds different class.
**REQUIRED FIX:** Change to `class="nav-link{{#if activeNav}} active{{/if}}"`

COMMON ERRORS:
- Missing {{root}} helper
- Using non-existent icon
- Inserting AFTER group label (wrong position)
- Missing activeNav pattern in class

Output: ONLY the <li> element
```

**EXAMPLE:**
```html
<li><a href="{{root}}analytics/reports.html" class="nav-link{{#if activeNav}} {{activeNav}}{{/if}}">
    {{> icon name="stats-bars" class="nav-icon"}}
    <span data-i18n="side.reports">Reports</span>
</a></li>
```

### Prompt 62: Add Module Nav-Item
```
Add Module page link to sidebar (AFTER group label)

STEP 1: READ sidebar.html
Read demo/panini/partials/layout/sidebar.html
DO NOT PROCEED without reading!

STEP 2: VERIFY NO DUPLICATE
Grep: grep "[path]" demo/panini/partials/layout/sidebar.html
If FOUND: STOP - nav link already exists

STEP 3: VERIFY PAGE EXISTS
Check: demo/panini/pages/[path].html
If NOT FOUND: STOP - create page first (PHASE 6)

STEP 4: VERIFY I18N KEY UNIQUE
Grep: grep "side.[key]" demo/assets/js/lang/*.json
If FOUND: STOP - key already used

STEP 5: VERIFY ICON EXISTS
Check icon in EXISTING ICONS list below
If NOT FOUND: STOP - choose from list

EXISTING ICONS:
grid-products, warehouse-box, cart-shopping, staff-user,
profit-coin, balance-scale, swap-arrows, materials-swatch

PATTERN (Module nav-item):
```html
<li><a href="{{root}}admin/[page].html" class="nav-link">
    {{> icon name="[icon]" class="nav-icon"}}
    <span data-i18n="side.[key]">[Label]</span>
</a></li>
```

**NOTE:** NO activeNav pattern in sidebar!
(Page frontmatter MAY have activeNav, but sidebar link does NOT use it)

INSERT POSITION:
- AFTER <div class="nav-group-label" data-i18n="side.modules">
- AFTER last Module nav-item in group
- Maintain logical order within group

GROUP LOGIC:
- If FIRST item in new category: add <div class="nav-group-label">
- If adding to existing group: NO additional label

COMMON ERRORS:
- Adding activeNav pattern (Analytics only!)
- Missing {{root}} helper
- Using non-existent icon
- Inserting BEFORE group label (wrong position)

Output: ONLY the <li> element (or <li> + <div> if new group)
```

**EXAMPLE (add to existing group):**
```html
<li><a href="{{root}}admin/orders.html" class="nav-link">
    {{> icon name="cart-shopping" class="nav-icon"}}
    <span data-i18n="side.orders">Orders</span>
</a></li>
```

**EXAMPLE (new group):**
```html
<div class="nav-group-label" data-i18n="side.logistics">Logistics</div>
<li><a href="{{root}}admin/shipping.html" class="nav-link">
    {{> icon name="swap-arrows" class="nav-icon"}}
    <span data-i18n="side.shipping">Shipping</span>
</a></li>
```

### Prompt 63: Add Settings Link
```
Add Settings page link to sidebar-footer

STEP 1: READ sidebar.html
Read demo/panini/partials/layout/sidebar.html
DO NOT PROCEED without reading!

STEP 2: VERIFY NO DUPLICATE
Grep: grep "[path]" demo/panini/partials/layout/sidebar.html
If FOUND: STOP - link already exists

STEP 3: VERIFY PAGE EXISTS
Check: demo/panini/pages/[path].html
If NOT FOUND: STOP - create page first (PHASE 6)

STEP 4: VERIFY I18N KEY UNIQUE
Grep: grep "side.[key]" demo/assets/js/lang/*.json
If FOUND: STOP - key already used

STEP 5: VERIFY ICON EXISTS
Check icon in EXISTING ICONS list
If NOT FOUND: STOP - choose from list

PATTERN (Settings link):
```html
<a href="{{root}}admin/[page].html" class="settings-link">
    {{> icon name="[icon]" class="nav-icon"}}
    <span data-i18n="side.[key]">[Label]</span>
</a>
```

**KEY DIFFERENCES from nav-items:**
- NO <li> wrapper
- class="settings-link" (NOT "nav-link")
- Located in sidebar-footer (after lang-switcher)

INSERT POSITION:
- In sidebar-footer div
- AFTER lang-switcher
- BEFORE closing </div> of sidebar-footer

COMMON ERRORS:
- Wrapping in <li> (Settings links have NO wrapper!)
- Using class="nav-link" (use "settings-link")
- Missing {{root}} helper
- Inserting in <ul class="nav"> (wrong location)

Output: ONLY the <a> element
```

**EXAMPLE:**
```html
<a href="{{root}}admin/settings.html" class="settings-link">
    {{> icon name="settings-gear" class="nav-icon"}}
    <span data-i18n="side.settings">Settings</span>
</a>
```

### Prompt 64: Remove Sidebar Link
```
Remove [PAGE] link from sidebar

USE WHEN:
- Page is being deleted
- Page is being moved/renamed
- Nav link needs cleanup

STEP 1: READ demo/panini/partials/layout/sidebar.html
DO NOT PROCEED without reading this file!

STEP 2: FIND THE NAV LINK
Grep for page path: grep "[path]" demo/panini/partials/layout/sidebar.html
If NOT FOUND: STOP - nav link doesn't exist, nothing to remove

STEP 3: IDENTIFY ELEMENT TYPE
Check if it's:
- **Analytics nav-item**: <li><a href="{{root}}analytics/..." class="nav-link{{#if activeNav}}...">...</a></li>
  - Located BEFORE <div class="nav-group-label"> (line 15)
  - Has activeNav pattern in class
  - Real href path (NOT "#")
- **Module nav-item**: <li><a href="#" class="nav-link">...</a></li>
  - Located AFTER <div class="nav-group-label">
  - NO activeNav pattern in sidebar (but page frontmatter MAY have activeNav!)
  - href="#" (placeholder)
- **Settings link**: <a href="...[path]..." class="settings-link">...</a>
  - Located in sidebar-footer (line 50-53)
  - NO <li> wrapper
- **Group label**: <div class="nav-group-label">...</div> (if last item in group)

STEP 4: CHECK GROUP STATUS
If removing last item in a group:
- Check if <div class="nav-group-label"> exists above the <li>
- If yes: REMOVE both the <li> AND the <div class="nav-group-label">
- If no (other items remain): REMOVE only the <li>

STEP 5: IDENTIFY LINES TO REMOVE
Count lines to remove:
- **Analytics nav-item**: 4 lines (lines 11-14 pattern)
- **Module nav-item**: 4 lines (lines 16-19, 20-23, etc.)
- **Settings link**: 4 lines (lines 50-53)
- **Last item in group**: 5 lines (1 line <div> + 4 lines <li>)

CRITICAL: Verify line count matches actual file structure!

OUTPUT FORMAT:
Show the EXACT lines to remove from sidebar.html

COMMON ERRORS:
- Removing wrong element (double-check path match)
- Leaving orphan group label (check if last in group)
- Breaking sidebar structure (verify HTML remains valid)
- Not removing associated i18n keys (separate task - PHASE 5)
- **Wrong line count** - nav-items are 4 lines, NOT 1 line!
- **Removing Analytics as Module** - Analytics has NO group label!
- **Not checking activeNav pattern** - Analytics nav-items have special class pattern

Output: Lines to remove from sidebar.html
```

**EXAMPLE OUTPUT (remove Analytics nav-item - NO group label):**
```
REMOVE from demo/panini/partials/layout/sidebar.html:
Line 11-14 (Analytics nav-item - NO group label to remove):
<li><a href="{{root}}analytics/dashboard.html" class="nav-link{{#if activeNav}} {{activeNav}}{{/if}}">
    {{> icon name="pie-chart" class="nav-icon"}}
    <span data-i18n="side.analytics">Analytics</span>
</a></li>
```

**EXAMPLE OUTPUT (remove Module nav-item - check group):**
```
REMOVE from demo/panini/partials/layout/sidebar.html:
Line 28-31 (Module nav-item - check if group label needs removal):
<li><a href="#" class="nav-link">
    {{> icon name="cart-shopping" class="nav-icon"}}
    <span data-i18n="side.supply">Procurement</span>
</a></li>

WARN: If this is the LAST item in Modules group, also remove line 15:
<div class="nav-group-label" data-i18n="side.modules">Modules</div>
```

**EXAMPLE OUTPUT (remove last item in group - remove label too):**
```
REMOVE from demo/panini/partials/layout/sidebar.html:
Line 32-35 (nav-group-label "Finance" is now empty):
<div class="nav-group-label" data-i18n="side.finance">Finance</div>
<li><a href="#" class="nav-link">
    {{> icon name="profit-coin" class="nav-icon"}}
    <span data-i18n="side.finance">Finance</span>
</a></li>
```

**EXAMPLE OUTPUT (remove Settings link):**
```
REMOVE from demo/panini/partials/layout/sidebar.html:
Line 50-53:
<a href="#" class="settings-link">
    {{> icon name="settings-gear" class="nav-icon"}}
    <span data-i18n="side.settings">Settings</span>
</a>
```

### Prompt 65: Update Scripts (Frontmatter)
```
VERIFY scripts integration for [PAGE]

STEP 1: READ demo/panini/pages/[page].html
If NOT FOUND: STOP - create page first (PHASE 6)
Check existing frontmatter before modifying!

STEP 2: READ script loading patterns
- **customJs**: loaded in `demo/panini/partials/layout/footer-scripts.html`
- **customCss**: loaded in `demo/panini/partials/layout/head.html`
- **langFile**: loaded in `demo/panini/partials/layout/footer-scripts.html`

Understand how each is loaded via frontmatter.

STEP 3: VERIFY FILES EXIST (if customJs/customCss specified)
- JS file: demo/assets/js/[customJs].js
- CSS file: demo/assets/css/[customCss].css
- Lang file: demo/assets/js/lang/[langFile].js
If NOT FOUND: WARN - file will be 404 until created

STEP 4: VERIFY LAYOUT EXISTS
Read demo/panini/layouts/ directory
Available layouts: default.html (ONLY ONE EXISTS)
If layout not found: STOP - page won't render correctly

WARN: "admin" layout does NOT exist - use "default" for all pages!

STEP 5: WARN IF FILES ALREADY USED
Grep for customJs/customCss in other pages:
- grep "customJs: \"[path]\"" demo/panini/pages/**/*.html
- grep "customCss: \"[path]\"" demo/panini/pages/**/*.html
If FOUND: WARN - file already used by another page (may cause conflicts)

CRITICAL: Scripts/CSS are added via frontmatter, NOT hardcoded!
FORBIDDEN: Adding <script> or <link> tags directly in footer-scripts.html

REQUIRED frontmatter fields:
- layout: "default" (ONLY valid layout - admin.html does NOT exist!)
- title: "[Page Title]"
- pageTitle: "[Page Title]" (displayed in page header)
- activeNav: "[nav_class]" (BOTH Analytics AND Module pages use this!)
  - Analytics: `activeNav: analytic_xxx`
  - Modules: `activeNav: xxx` (e.g., `supplier_list`, `bcc_request`)
  - NOTE: Only Analytics sidebar links use activeNav pattern!
- titleKey: "page.[key]" (optional, for i18n page title)
- customJs: "[path]" (without .js extension, relative to assets/js/)
- customCss: "[path]" (without .css extension, relative to assets/css/)
- langFile: "[path]" (optional, for i18n page-specific keys)

PRESERVE EXISTING VALUES:
- If frontmatter already has layout/title: KEEP them
- If adding customJs/customCss: ADD to existing frontmatter
- NEVER overwrite existing values without explicit instruction

Pattern from footer-scripts.html:
{{#if langFile}}<script src="../../assets/js/lang/{{langFile}}.js"></script>{{/if}}
{{#if customJs}}<script src="../../assets/js/{{customJs}}.js"></script>{{/if}}

Pattern from head.html:
{{#if customCss}}<link rel="stylesheet" href="../../assets/css/{{customCss}}">{{/if}}

**NOTE:** customCss has NO .css extension in the path!

PATH RULES:
- customJs: "admin/orders_logic" -> loads assets/js/admin/orders_logic.js
- customCss: "admin/orders" -> loads assets/css/admin/orders.css
- NO file extension in frontmatter values!

OPTIONAL FIELDS (not all pages need):
- customJs: omit if page has no custom JavaScript
- customCss: omit if page uses only shared CSS
- langFile: omit if page uses only common i18n keys

COMMON ERRORS:
- Hardcoding <script> in footer-scripts.html (BREAKS other pages!)
- Including .js or .css extension in frontmatter
- Wrong relative path (must be from assets/js/ or assets/css/)
- Missing layout field (page won't render correctly)
- Forgetting langFile for page-specific i18n
- Overwriting existing frontmatter values
- Specifying non-existent layout
- Specifying files that don't exist (will 404)
- Using customJs/customCss already used by another page (conflicts)
- Missing STEP 5 check for duplicate file references
- **Not realizing customCss is in head.html, NOT footer-scripts.html!**
- **Adding .css extension to customCss** - head.html pattern has NO extension!

Output: COMPLETE frontmatter block for page.
```

**EXAMPLE OUTPUT (new Analytics page - needs activeNav):**
```yaml
---
layout: default
title: Reports
pageTitle: Reports Dashboard
titleKey: page.reports
activeNav: analytic_reports
langFile: analytics/reports
customCss: analytics/reports
customJs: analytics/reports_logic
---
```

**EXAMPLE OUTPUT (new Module page - NO activeNav):**
```yaml
---
layout: default
title: Orders
pageTitle: Orders Management
langFile: admin/orders
customCss: admin/orders
customJs: admin/orders_logic
---
```

**EXAMPLE OUTPUT (existing page - PRESERVE and ADD):**
```yaml
# Existing frontmatter:
---
layout: default
title: Suppliers
pageTitle: Supplier Profile
activeNav: supplier_list
---

# ADD these lines (preserve layout, title, pageTitle, activeNav):
langFile: admin/suppliers
customCss: admin/suppliers
customJs: admin/suppliers_logic
```

**EXAMPLE OUTPUT (page without custom JS/CSS):**
```yaml
---
layout: default
title: Dashboard
pageTitle: Dashboard
---
# No customJs/customCss needed - uses shared files only
```

### Prompt 66: Remove Scripts from Frontmatter
```
Remove customJs/customCss/langFile from [PAGE] frontmatter

USE WHEN:
- JS/CSS files were deleted or merged
- Page no longer needs custom scripts
- Cleaning up unused langFile
- Refactoring to use shared resources

STEP 1: READ demo/panini/pages/[page].html
If NOT FOUND: STOP - page doesn't exist

STEP 2: IDENTIFY FIELDS TO REMOVE
Check frontmatter for:
- customJs: "[path]" - remove if JS file deleted
- customCss: "[path]" - remove if CSS file deleted
- langFile: "[path]" - remove if lang file deleted

STEP 3: VERIFY FILES DON'T EXIST (optional safety check)
Check if files were intentionally deleted:
- demo/assets/js/[customJs].js
- demo/assets/css/[customCss].css
- demo/assets/js/lang/[langFile].js
If files EXIST: WARN - are you sure you want to remove reference?

STEP 4: IDENTIFY FIELDS TO PRESERVE
KEEP these fields (DO NOT remove):
- layout: required for page rendering (always "default")
- title: required for page title
- pageTitle: required for page header display
- activeNav: required for BOTH Analytics AND Module pages (may be used for JS logic, tracking)
- titleKey: optional but preserve if exists
- Any other custom frontmatter fields

STEP 5: VERIFY NO HARDCODED REFERENCES
Grep page HTML for hardcoded references:
- grep "<script" demo/panini/pages/[page].html
- grep "<link" demo/panini/pages/[page].html
If FOUND: page has hardcoded scripts, review before removing frontmatter

STEP 6: VALIDATE YAML SYNTAX AFTER EDIT
After removing fields, verify:
- No trailing whitespace
- No missing newlines
- Proper indentation (no tabs)

OUTPUT FORMAT:
Show BEFORE and AFTER frontmatter

COMMON ERRORS:
- Removing layout or title (breaks page)
- Removing customJs but JS still referenced in HTML
- Not checking if files exist first
- Breaking frontmatter YAML syntax

Output: Updated frontmatter block
```

**EXAMPLE OUTPUT (remove JS only):**
```yaml
# BEFORE:
---
layout: default
title: Orders
pageTitle: Orders Management
langFile: admin/orders
customCss: admin/orders
customJs: admin/orders_logic
---

# AFTER:
---
layout: default
title: Orders
pageTitle: Orders Management
langFile: admin/orders
customCss: admin/orders
---
# Removed: customJs (orders_logic.js was merged into shared.js)
```

**EXAMPLE OUTPUT (remove all custom files):**
```yaml
# BEFORE:
---
layout: default
title: Dashboard
pageTitle: Dashboard
langFile: admin/dashboard
customCss: admin/dashboard
customJs: admin/dashboard_logic
---

# AFTER:
---
layout: default
title: Dashboard
pageTitle: Dashboard
---
# Removed: langFile, customCss, customJs (page now uses shared resources only)
```

**EXAMPLE OUTPUT (WARN - files still exist):**
```
WARNING: Files still exist!
- demo/assets/js/admin/orders_logic.js EXISTS
- Are you sure you want to remove customJs reference?

If yes, remove from frontmatter:
---
layout: default
title: Orders
pageTitle: Orders Management
langFile: admin/orders
customCss: admin/orders
---
```

### Prompt 67: Build & File Validation
```
BUILD & FILE validation for [PAGE]

STEP 1: VERIFY ALL PHASES COMPLETED
Check:
[ ] PHASE 1-3: Structure defined
[ ] PHASE 4: Data files (if needed)
[ ] PHASE 5: i18n keys added
[ ] PHASE 6: HTML page created
[ ] PHASE 7-8: JS logic implemented
[ ] PHASE 9: CSS classes defined
[ ] PHASE 10: Sidebar link added

STEP 2: BUILD TEST
Run: cd demo && gulp build
Expected: Build successful, no errors
If FAIL: Check error message, fix issue

STEP 3: FILE EXISTENCE CHECK
Verify files exist:
- demo/panini/pages/[page].html
- demo/assets/css/[customCss].css (if customCss in frontmatter)
- demo/assets/js/[customJs].js (if customJs in frontmatter)
- demo/assets/js/lang/[langFile].js (if langFile in frontmatter)

COMMON ERRORS:
- Build fails: check partials, helpers, syntax
- Missing page file: create first
- Missing CSS/JS: will 404
- Wrong path in frontmatter: check extensions

Output format:
```
## BUILD & FILE VALIDATION

PHASES: [all complete / missing: list]
BUILD: [success / fail - error]
FILES:
[ ] Page: [exists / missing]
[ ] CSS: [exists / missing / N/A]
[ ] JS: [exists / missing / N/A]
[ ] Lang: [exists / missing / N/A]
```
```

**EXAMPLE:**
```
## BUILD & FILE VALIDATION

PHASES: all complete
BUILD: success
FILES:
[ ] Page: exists
[ ] CSS: exists
[ ] JS: exists
[ ] Lang: exists
```

### Prompt 68: i18n & Partials Validation
```
i18N & PARTIALS validation for [PAGE]

STEP 1: EXTRACT I18N KEYS
Command: grep -o 'data-i18n="[^"]*"' demo/panini/pages/[page].html
If NO DATA-I18N found: WARN - page may have hardcoded text

STEP 2: VALIDATE I18N KEY FORMAT
For each key found:
- MUST contain dot separator (e.g., "side.orders" not "orders")
- If NO dot: WARN - invalid format

STEP 3: VERIFY I18N KEYS IN ALL LANG FILES
For each key, check in:
- demo/assets/js/lang/en.json
- demo/assets/js/lang/ru.json
- demo/assets/js/lang/lt.json
If NOT found in any: MISSING - add to that lang file

STEP 4: EXTRACT PARTIALS
Grep: grep -o '{{> [^}]*}}' demo/panini/pages/[page].html
List all partials used

STEP 5: VERIFY PARTIALS EXIST
Read .windsurf/workflows/PARTIAL_SPECS.md
For each partial:
- Check exists in PARTIAL_SPECS.md
- Verify required params are present

COMMON ERRORS:
- Missing i18n key in one lang file
- Invalid i18n format (no dot)
- Partial not in PARTIAL_SPECS.md
- Missing required param for partial

Output format:
```
## I18N & PARTIALS VALIDATION

I18N KEYS: [count] found
[ ] Format: [all valid / invalid: list]
[ ] en.json: [all present / missing: list]
[ ] ru.json: [all present / missing: list]
[ ] lt.json: [all present / missing: list]

PARTIALS: [count] used
[ ] All exist: [yes / missing: list]
[ ] Params valid: [yes / issues: list]
```
```

### Prompt 69: CSS, Frontmatter & Sidebar Validation
```
CSS, FRONTMATTER & SIDEBAR validation for [PAGE]

STEP 1: CSS CLASSES VALIDATION
Extract: grep -o 'class="[^"]*"' demo/panini/pages/[page].html
For each unique class:
- Grep: grep -r "\.class-name" demo/assets/css/
- If NOT found: CSS class missing

STEP 2: FRONTMATTER VALIDATION
Required fields:
- layout: "default" (ONLY valid - admin.html does NOT exist!)
- title: present
- pageTitle: present
- activeNav: present (BOTH Analytics AND Module pages)
  - Analytics: `activeNav: analytic_xxx`
  - Modules: `activeNav: xxx`
- titleKey: optional
- customJs: no .js extension
- customCss: no .css extension

STEP 3: SIDEBAR LINK VALIDATION
Grep: grep "[page]" demo/panini/partials/layout/sidebar.html
Expected: Nav link with correct href

**⚠️ CRITICAL BUG CHECK:**
CSS expects `.nav-link.active` but activeNav adds DIFFERENT class!
If Analytics page:
- Check nav-link has activeNav pattern (even though broken)
- **REQUIRED FIX:** sidebar.html should use `class="nav-link{{#if activeNav}} active{{/if}}"`

STEP 4: UNIQUE ID VALIDATION
Extract: grep -o 'id="[^"]*"' demo/panini/pages/[page].html
Check duplicates: sort | uniq -d
If duplicates: ID conflict

STEP 5: ACCESSIBILITY CHECK
- [ ] All <img> have alt
- [ ] All <button> have aria-label or text
- [ ] All <input> have label or aria-label

COMMON ERRORS:
- layout: "admin" - DOES NOT EXIST!
- Missing activeNav
- activeNav CSS MISMATCH
- CSS class not defined
- Sidebar link missing
- Duplicate IDs

Output format:
```
## CSS, FRONTMATTER & SIDEBAR VALIDATION

CSS CLASSES: [all defined / missing: list]

FRONTMATTER:
[ ] layout: [default / WRONG: value]
[ ] title: [present / missing]
[ ] pageTitle: [present / missing]
[ ] activeNav: [present / missing]

SIDEBAR LINK: [correct / missing / wrong path]

UNIQUE IDs: [no duplicates / duplicates: list]

ACCESSIBILITY: [pass / issues: list]

ISSUES: [list / none]
```
```

**EXAMPLE OUTPUT (Analytics page):**
```
## FINAL VALIDATION

PHASES COMPLETED:
[ ] PHASE 1-3: yes
[ ] PHASE 4: yes
[ ] PHASE 5: yes
[ ] PHASE 6: yes
[ ] PHASE 7-8: yes
[ ] PHASE 9: yes
[ ] PHASE 10: yes

BUILD: success

FILE EXISTENCE:
[ ] Page HTML: exists - demo/panini/pages/analytics/reports.html
[ ] CSS file: exists - demo/assets/css/analytics/reports.css
[ ] JS file: exists - demo/assets/js/analytics/reports_logic.js
[ ] Lang file: exists - demo/assets/js/lang/analytics/reports.js

FRONTMATTER:
[ ] layout: default - CORRECT
[ ] title: Reports - present
[ ] pageTitle: Reports Dashboard - present
[ ] activeNav: analytic_reports - CORRECT for Analytics page
[ ] titleKey: page.reports - present

I18N KEYS: all present - found 12 keys, all in en.json, ru.json, lt.json

PARTIALS: all valid - glass-panel, custom-select, modal, table-row-actions

CSS CLASSES: all defined - found 8 unique classes, all in reports.css

SIDEBAR LINK: correct - href="{{root}}analytics/reports.html" with activeNav pattern

UNIQUE IDs: no duplicates - found 5 unique IDs

ONCLICK HANDLERS: all defined - openModal, closeModal, submitForm

ACCESSIBILITY: pass - all images have alt, buttons have text

MANUAL TESTS:
[ ] Page loads: pass
[ ] Sidebar navigation: pass
[ ] activeNav highlight: pass - nav-link has 'analytic_reports' class
[ ] Filters work: pass
[ ] Table displays: pass
[ ] Modal opens: pass
[ ] Actions trigger: pass
[ ] Responsive layout: pass
[ ] i18n works: pass

ISSUES FOUND: none

STATUS: INTEGRATION COMPLETE
```

**EXAMPLE OUTPUT (Module page - NO activeNav):**
```
## FINAL VALIDATION

PHASES COMPLETED:
[ ] PHASE 1-3: yes
[ ] PHASE 4: N/A
[ ] PHASE 5: yes
[ ] PHASE 6: yes
[ ] PHASE 7-8: yes
[ ] PHASE 9: yes
[ ] PHASE 10: yes

BUILD: success

FILE EXISTENCE:
[ ] Page HTML: exists - demo/panini/pages/admin/orders.html
[ ] CSS file: exists - demo/assets/css/admin/orders.css
[ ] JS file: exists - demo/assets/js/admin/orders_logic.js
[ ] Lang file: exists - demo/assets/js/lang/admin/orders.js

FRONTMATTER:
[ ] layout: default - CORRECT
[ ] title: Orders - present
[ ] pageTitle: Orders Management - present
[ ] activeNav: NOT SET - CORRECT for Module page

I18N KEYS: all present - found 12 keys, all in en.json, ru.json, lt.json

PARTIALS: all valid - glass-panel, custom-select, modal, table-row-actions

CSS CLASSES: all defined - found 8 unique classes, all in orders.css

SIDEBAR LINK: correct - href="{{root}}admin/orders.html"

UNIQUE IDs: no duplicates - found 5 unique IDs

ONCLICK HANDLERS: all defined - openModal, closeModal, submitForm

ACCESSIBILITY: pass - all images have alt, buttons have text

MANUAL TESTS:
[ ] Page loads: pass
[ ] Sidebar navigation: pass
[ ] Filters work: pass
[ ] Table displays: pass
[ ] Modal opens: pass
[ ] Actions trigger: pass
[ ] Responsive layout: pass
[ ] i18n works: pass

ISSUES FOUND: none

STATUS: INTEGRATION COMPLETE
```

### Prompt 70: Cleanup Validation (Page Deletion)
```
CLEANUP VALIDATION for [PAGE] deletion

USE WHEN:
- Page is being deleted
- Page is being archived/deprecated
- Verifying cleanup after removal

STEP 1: VERIFY PAGE DELETED
Check page file deleted:
- demo/panini/pages/[page].html - should NOT exist
If EXISTS: WARN - page still exists, delete first

STEP 2: VERIFY SIDEBAR LINK REMOVED
Grep sidebar for page path:
Command: grep "[path]" demo/panini/partials/layout/sidebar.html
Expected: NOT FOUND
If FOUND: Sidebar link still exists - use Prompt 64 to remove

STEP 3: VERIFY FRONTMATTER CLEANED (if page moved/renamed)
If page was renamed, check old frontmatter references removed:
- Old customJs reference removed?
- Old customCss reference removed?
- Old langFile reference removed?
- Old activeNav reference removed? (BOTH Analytics AND Module pages have activeNav!)

STEP 4: VERIFY JS/CSS FILES REMOVED (if no longer used)
Check if custom files were deleted:
- demo/assets/js/[customJs].js - should NOT exist (or verify no other pages use it)
- demo/assets/css/[customCss].css - should NOT exist (or verify no other pages use it)
If EXISTS: Check if other pages reference these files

STEP 5: VERIFY I18N KEYS REMOVED (optional)
If page-specific i18n keys no longer needed:
- Check if keys are used elsewhere
- If not used: can be removed from lang files
Command: grep -r "side\.[key]" demo/panini/pages/ demo/panini/partials/
If NOT FOUND in other files: safe to remove from lang files

STEP 6: VERIFY NO ORPHAN REFERENCES
Search for any remaining references to deleted page:
- grep -r "[page-name]" demo/panini/pages/
- grep -r "[page-name]" demo/panini/partials/
- grep -r "[page-name]" demo/assets/js/
- grep -r "[page-name]" demo/assets/css/
If FOUND: Review and remove orphan references

WARN: If partials reference the page, check if partial is still used by other pages

STEP 7: BUILD TEST
Run: cd demo && gulp build
Expected: Build successful, no errors

OUTPUT FORMAT:
```
## CLEANUP VALIDATION

PAGE FILE: [deleted / still exists - DELETE FIRST]

SIDEBAR LINK: [removed / still exists - USE PROMPT 64]

FRONTMATTER: [cleaned / still has references]

JS/CSS FILES: [deleted / still exist - check usage]

I18N KEYS: [removed / still in lang files / used elsewhere]

ORPHAN REFERENCES: [none found / found: list]

BUILD: [success / fail - error]

ISSUES: [list / none]

STATUS: [CLEANUP COMPLETE / NEEDS CLEANUP: list]
```

COMMON ERRORS:
- Deleting page but leaving sidebar link (404 on click)
- Leaving orphan JS/CSS files (unused files)
- Removing i18n keys used by other pages
- Not checking for references in other files
- Breaking build due to missing partials
- Leaving activeNav in other pages' frontmatter (wrong reference)
- Not checking if JS file has event listeners for deleted page elements

Output: Cleanup validation report
```

**EXAMPLE OUTPUT (successful cleanup):**
```
## CLEANUP VALIDATION

PAGE FILE: deleted - demo/panini/pages/admin/old-page.html removed

SIDEBAR LINK: removed - no references found in sidebar.html

FRONTMATTER: N/A - page deleted

JS/CSS FILES: deleted - old-page.js and old-page.css removed

I18N KEYS: removed - side.oldPage keys removed from all lang files

ORPHAN REFERENCES: none found

BUILD: success

ISSUES: none

STATUS: CLEANUP COMPLETE
```

**EXAMPLE OUTPUT (needs cleanup):**
```
## CLEANUP VALIDATION

PAGE FILE: deleted - demo/panini/pages/admin/old-page.html removed

SIDEBAR LINK: STILL EXISTS - found in sidebar.html line 28
ACTION NEEDED: Use Prompt 64 to remove sidebar link

FRONTMATTER: N/A - page deleted

JS/CSS FILES: still exist
- demo/assets/js/admin/old-page.js EXISTS - check if used elsewhere
- demo/assets/css/admin/old-page.css EXISTS - check if used elsewhere

I18N KEYS: still in lang files
- side.oldPage found in en.json, ru.json, lt.json
- Check if used elsewhere: grep -r "side.oldPage" demo/panini/

ORPHAN REFERENCES: found
- demo/panini/partials/layout/footer.html references "old-page"

BUILD: success (but has orphan references)

ISSUES:
1. Sidebar link still exists - USE PROMPT 64
2. JS/CSS files still exist - verify usage or delete
3. i18n keys still in lang files - verify usage or remove
4. Orphan reference in footer.html

STATUS: NEEDS CLEANUP: 4 issues found
```

---

## Summary: Prompt Flow

```
PHASE 1: Prompts 1-9 (Structure - Reference, Layout, Sections, Validation)
PHASE 2: Prompts 10-14 (Partials List & New Partials)
PHASE 3: Prompts 15-19 (repeat for each new partial)
PHASE 4: Prompts 20-26 (Data)
PHASE 5: Prompts 27-32 (i18n Translations)
PHASE 6: Prompts 33-38 (HTML Assembly)
PHASE 7: Prompts 39-44 (Logic Spec)
PHASE 8: Prompts 45-53 (JS Implementation)
PHASE 9: Prompts 54-60 (CSS Styles)
PHASE 10: Prompts 61-70 (Integration)
```

**Totals:**
- Base prompts: 70
- Repeat prompts: depends on complexity (new partials, sections, functions, classes)
- Expected total: ~70-100 prompts
- Max lines per prompt: 10-50
- Expected bugs: < 5
