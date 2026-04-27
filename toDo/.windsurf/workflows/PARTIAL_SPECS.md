# Partial Specifications

Complete reference for all partials with parameters, types, and usage examples.

---

## Sections

### glass-panel.html

Main container with loading states and optional action button.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `title` | string | yes | - | Panel title text |
| `titleKey` | string | no | - | i18n key for title |
| `loading` | boolean | no | false | Show skeleton loader |
| `skeletonWidth` | string | no | - | Width of skeleton (e.g., "60%") |
| `skeletonHeight` | string | no | - | Height of skeleton (e.g., "80px") |
| `hasBody` | boolean | no | false | Wrap content in `.panel-body` div |
| `panelClass` | string | no | - | Additional CSS classes |
| `badge` | string | no | - | Badge text |
| `badgeKey` | string | no | - | i18n key for badge |
| `badgeCount` | string/number | no | - | Number before badge text |
| `actionLabel` | string | no | - | Action button text |
| `actionKey` | string | no | - | i18n key for action |
| `actionId` | string | no | - | Action button ID |

**Usage:**
```handlebars
{{#> glass-panel title="My Panel" titleKey="page.my_panel" loading=true hasBody=true}}
  Content here
{{/glass-panel}}
```

---

### analytics-sub-nav.html

Sub-navigation for analytics pages.

**Parameters:** (check file for details)

---

## UI Components

### custom-select.html

Styled dropdown select.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Wrapper element ID |
| `fieldId` | string | no | - | Hidden input ID for form |
| `defaultValue` | string | no | - | Initial selected value |
| `triggerContent` | string | no | - | Custom trigger HTML |
| `triggerStyle` | string | no | - | Inline style for trigger |

**Usage:**
```handlebars
{{#> custom-select id="status-select" fieldId="status" defaultValue="Active"}}
  {{> supplier_statuses}}
{{/custom-select}}
```

---

### custom-select-sm.html

Small variant of custom-select.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Wrapper element ID |
| `fieldId` | string | no | - | Hidden input ID |
| `defaultValue` | string | no | - | Initial selected value |

**Usage:**
```handlebars
{{#> custom-select-sm id="unit-select" defaultValue="kg"}}
  {{> units}}
{{/custom-select-sm}}
```

---

### datepicker.html

Date input with calendar popup.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Wrapper element ID |
| `fieldId` | string | no | - | Hidden input ID |
| `value` | string | no | - | Date value (YYYY-MM-DD) |
| `displayDate` | string | no | - | Formatted date for display |

**Usage:**
```handlebars
{{> datepicker id="contract-date" fieldId="contract_date" value="2024-01-15"}}
```

---

### dropzone.html

File upload dropzone.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `inputId` | string | yes | - | File input ID |
| `hint` | string | no | - | Hint text (HTML allowed) |
| `hintKey` | string | no | - | i18n key for hint |

**Usage:**
```handlebars
{{> dropzone inputId="file-upload" hint="Drag & Drop files<br>(PDF, Images)"}}
```

---

### email-template.html

Email subject and body inputs.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Wrapper element ID |
| `subjectLabel` | string | no | "Subject" | Subject field label |
| `subjectLabelKey` | string | no | - | i18n key for subject label |
| `subject` | string | no | - | Default subject value |
| `subjectPlaceholderKey` | string | no | - | i18n key for subject placeholder |
| `bodyLabel` | string | no | "Message Body" | Body field label |
| `bodyLabelKey` | string | no | - | i18n key for body label |
| `bodyPlaceholder` | string | no | - | Body placeholder text |
| `bodyPlaceholderKey` | string | no | - | i18n key for body placeholder |
| `body` | string | no | - | Default body text |

**Usage:**
```handlebars
{{#> email-template id="email" subject="Price Request"}}
  {{> dropzone inputId="attachments"}}
{{/email-template}}
```

---

### icon.html

SVG icon renderer.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | - | Icon name (see list below) |
| `width` | number | no | 24 | SVG width |
| `height` | number | no | 24 | SVG height |
| `strokeColor` | string | no | currentColor | Stroke color |
| `strokeWidth` | number | no | 2 | Stroke width |
| `class` | string | no | - | CSS class |
| `style` | string | no | - | Inline style |
| `onclick` | string | no | - | Click handler |
| `onmouseover` | string | no | - | Mouseover handler |
| `onmouseout` | string | no | - | Mouseout handler |

**Available Icons:**
`warehouse-box`, `alert-tag`, `sales-up`, `profit-coin`, `alert-triangle`, `stats-bars`, `materials-swatch`, `sales-trend`, `staff-user`, `offer-tag`, `cart-shopping`, `check-success`, `clock-history`, `trend-growth`, `swap-arrows`, `balance-scale`, `clock-time`, `report-clipboard`, `check-circle`, `info-circle`, `settings-gear`, `x-close`, `x-circle`, `edit-pencil`, `save-disk`, `chevron-down`, `upload-arrow`, `calendar`, `plus-add`, `pie-chart`, `grid-products`, `menu-bars`, `search`, `bell-notification`, `chevron-right`, `email`

**Usage:**
```handlebars
{{> icon name="edit-pencil" width="14" height="14"}}
```

---

### input-group.html

Label + input wrapper with optional hint.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `label` | string | no | - | Label text |
| `labelKey` | string | no | - | i18n key for label |
| `hint` | string | no | - | Hint tooltip text |
| `hintTooltip` | string | no | - | i18n key for hint tooltip |
| `style` | string | no | - | Inline style for wrapper |

**Usage:**
```handlebars
{{#> input-group label="Price" labelKey="field.price" hint="Enter price in EUR"}}
  <input type="number" class="glass-input">
{{/input-group}}
```

---

### input-suffix-select.html

Number input with suffix dropdown (e.g., price + currency).

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `selectId` | string | yes | - | Wrapper element ID |
| `inputId` | string | yes | - | Number input ID |
| `fieldId` | string | no | - | Hidden input ID |
| `placeholder` | string | no | - | Input placeholder |
| `defaultValue` | string | no | - | Default suffix value |

**Usage:**
```handlebars
{{#> input-suffix-select selectId="min-price" inputId="min_value" defaultValue="EUR"}}
  {{> currencies}}
{{/input-suffix-select}}
```

---

### modal.html

Modal dialog with header, body, optional footer.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Modal element ID |
| `title` | string | yes | - | Modal title |
| `titleKey` | string | no | - | i18n key for title |
| `size` | string | no | - | Size: "small", "medium", "large" |
| `isOpen` | boolean | no | false | Show modal open |
| `hasFooter` | boolean | no | false | Show footer buttons |
| `cancelLabel` | string | no | "Cancel" | Cancel button text |
| `cancelLabelKey` | string | no | - | i18n key for cancel |
| `saveLabel` | string | no | "Save" | Save button text |
| `saveLabelKey` | string | no | - | i18n key for save |

**Usage:**
```handlebars
{{#> modal id="edit-modal" title="Edit Item" size="small" hasFooter=true}}
  <div class="modal-form">
    <!-- form content -->
  </div>
{{/modal}}
```

---

### multi-select.html

Multi-select dropdown with tags.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Wrapper element ID |
| `placeholder` | string | no | - | Placeholder text |
| `placeholderKey` | string | no | - | i18n key for placeholder |

**Usage:**
```handlebars
{{#> multi-select id="categories" placeholder="Select products..."}}
  {{!-- Tags populated by JS --}}
{{/multi-select}}
```

---

### checkbox-list.html

Searchable checkbox list with select all/deselect all.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Wrapper element ID |
| `searchable` | boolean | no | false | Show search input |
| `showControls` | boolean | no | false | Show select/deselect all |
| `selectLabel` | string | no | "Select All" | Select all button text |
| `selectLabelKey` | string | no | - | i18n key for select all |
| `deselectLabel` | string | no | "Deselect All" | Deselect all button text |
| `deselectLabelKey` | string | no | - | i18n key for deselect all |
| `selectedText` | string | no | "selected" | Text after count |
| `selectedTextKey` | string | no | - | i18n key for selected text |
| `searchPlaceholder` | string | no | "Search..." | Search input placeholder |
| `searchPlaceholderKey` | string | no | - | i18n key for search placeholder |

**Usage:**
```handlebars
{{#> checkbox-list id="recipients" searchable=true showControls=true}}
  {{!-- Checkboxes populated by JS --}}
{{/checkbox-list}}
```

---

### price-input.html

Price input with unit select.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Wrapper element ID |
| `value` | number | no | - | Initial value |
| `placeholder` | string | no | - | Input placeholder |
| `unit` | string | no | - | Default unit |
| `units` | array | no | - | Array of unit strings |

**Usage:**
```handlebars
{{> price-input id="price" value="100" unit="kg"}}
```

---

### price-input-sm.html

Small variant of price-input with built-in unit options.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Wrapper element ID |
| `value` | number | no | - | Initial value |
| `placeholder` | string | no | - | Input placeholder |
| `unit` | string | no | "kg" | Default unit (kg, m, piece, ton) |

**Usage:**
```handlebars
{{> price-input-sm id="item-price" value="50" unit="ton"}}
```

---

### rating-select.html

Dropdown with star ratings.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Wrapper element ID |
| `fieldId` | string | no | - | Hidden input ID |
| `rating` | number | no | 0 | Initial rating (1-5) |

**Usage:**
```handlebars
{{> rating-select id="reliability" fieldId="reliability_rating" rating=4}}
```

---

### rating-stars.html

Display stars for rating.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `active` | number | yes | - | Number of active stars (1-5) |

**Usage:**
```handlebars
{{> rating-stars active=4}}
```

---

### table-row-actions.html

Edit/delete action buttons for table rows.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `editAction` | string | no | - | Edit button onclick handler |
| `deleteAction` | string | no | - | Delete button onclick handler |

**Usage:**
```handlebars
{{> table-row-actions editAction="editRow(this)" deleteAction="deleteRow(123)"}}
```

---

### tag-input.html

Tag container with input.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Wrapper element ID |
| `placeholderKey` | string | no | - | i18n key for placeholder |
| `readonly` | boolean | no | false | Disable input |
| `hasDropdown` | boolean | no | false | Add dropdown structure |
| `dropdownId` | string | no | - | Dropdown element ID |
| `dropdownContent` | string | no | - | Dropdown HTML content |

**Usage:**
```handlebars
{{#> tag-input id="spec-tags"}}
  {{> tag label="Steel"}}
  {{> tag label="Grade A"}}
{{/tag-input}}
```

---

### tag.html

Single tag with remove button.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `label` | string | yes | - | Tag text |

**Usage:**
```handlebars
{{> tag label="Steel"}}
```

---

## Components

### kpi-card.html

KPI metric display card.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `label` | string | yes | - | Metric label |
| `labelKey` | string | no | - | i18n key for label |
| `value` | string/number | yes | - | Metric value |
| `unit` | string | no | - | Unit text |
| `delta` | string | no | - | Change indicator |
| `deltaKey` | string | no | - | i18n key for delta |
| `deltaClass` | string | no | - | CSS class (positive/negative) |
| `iconName` | string | no | - | Icon name |
| `iconClass` | string | no | - | Icon CSS class |

**Usage:**
```handlebars
{{> kpi-card label="Total Sales" value="1,234" unit="EUR" delta="+12%" deltaClass="positive"}}
```

---

### acard.html

Analytics card with metrics and link.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `href` | string | yes | - | Link URL |
| `num` | string/number | no | - | Number display |
| `numKey` | string | no | - | i18n key for num |
| `title` | string | yes | - | Card title |
| `titleKey` | string | no | - | i18n key for title |

**Usage:**
```handlebars
{{#> acard href="/analytics/sales" num="12" title="Sales Reports"}}
  {{> ametric key="metric.total" label="Total" value="45K"}}
{{/acard}}
```

---

### bar-chart-row.html

Horizontal bar chart row.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `label` | string | yes | - | Row label |
| `labelKey` | string | no | - | i18n key for label |
| `value` | string/number | yes | - | Value display |
| `width` | number | yes | - | Bar width percentage |
| `gradient` | string | no | - | CSS gradient for bar |

**Usage:**
```handlebars
{{> bar-chart-row label="Steel" value="45%" width=45 gradient="linear-gradient(90deg, #1890FF, #69C0FF)"}}
```

---

## Atoms

### ametric.html

Single metric for acard.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `key` | string | no | - | i18n key for label |
| `label` | string | yes | - | Label text |
| `value` | string | yes | - | Value text |
| `valueKey` | string | no | - | i18n key for value |
| `class` | string | no | - | CSS class for value |

**Usage:**
```handlebars
{{> ametric label="Total" value="45K" class="positive"}}
```

---

### file-item.html

File list item with download/delete.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | yes | - | File name |
| `downloadUrl` | string | no | - | Download URL |
| `downloadName` | string | no | - | Download file name |

**Usage:**
```handlebars
{{> file-item name="drawing.pdf" downloadUrl="/files/drawing.pdf"}}
```

---

### note-item.html

Note item with date and remove.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `date` | string | yes | - | Note date |
| `text` | string | yes | - | Note text |

**Usage:**
```handlebars
{{> note-item date="2024-01-15" text="Updated pricing"}}
```

---

## Tables

### alerts-table.html

Alerts table structure.

**Usage:**
```handlebars
{{#> alerts-table}}
  <tr><td>Price Alert</td><td>Price exceeded limit</td><td>Active</td></tr>
{{/alerts-table}}
```

---

### history-table.html

Generic history table with configurable columns.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `tbodyId` | string | no | - | tbody element ID |
| `columns` | array | no | - | Column definitions |
| `rows` | array | no | - | Row data (if provided, renders automatically) |

**Column Object:**
```js
{ label: "Date", i18n: "th.date", width: "100px", style: "text-align:center" }
```

**Usage:**
```handlebars
{{> history-table tbodyId="history-body" columns=columnsData rows=rowsData}}
```

---

### history-row.html

History table row.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Row ID |
| `requestId` | string | no | - | Request ID |
| `date` | string | yes | - | Date value |
| `requestBadge` | string | no | - | Request badge text |
| `categories` | string | no | - | Categories text |
| `supplierName` | string | no | - | Supplier name |
| `status` | string | yes | - | Status class |
| `statusLabel` | string | yes | - | Status display text |
| `price` | string | no | - | Response price |
| `unit` | string | no | - | Price unit |

**Usage:**
```handlebars
{{> history-row id="row-1" date="2024-01-15" status="completed" statusLabel="Completed"}}
```

---

### request-history-table.html

Request history table for BCC page.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Table wrapper ID |
| `requests` | array | no | null | Request data (populated by JS) |

**Usage:**
```handlebars
{{> request-history-table id="history-table" requests=null}}
```

---

## Options

### currencies.html

Currency options for custom-select.

**Values:** EUR, USD, PLN, GBP

**Usage:**
```handlebars
{{#> custom-select id="currency"}}
  {{> currencies}}
{{/custom-select}}
```

---

### units.html

Unit options for custom-select.

**Values:** kg, m, piece, ton

**Usage:**
```handlebars
{{#> custom-select id="unit"}}
  {{> units}}
{{/custom-select}}
```

---

### supplier_statuses.html

Supplier status options with colored pills.

**Values:** Active, Preferred, New, Under Review, Suspended, Blocked

**Usage:**
```handlebars
{{#> custom-select id="status"}}
  {{> supplier_statuses}}
{{/custom-select}}
```

---

## Helpers Required

These Handlebars helpers must be registered:

- `eq` - Equality comparison: `{{#eq a b}}...{{/eq}}`
- `times` - Iterate N times: `{{#times 5}}...{{/times}}`
- `lte` - Less than or equal: `{{#lte a b}}...{{/lte}}`
- `concat` - String concatenation: `{{concat a b}}`
- `each` - Array iteration (built-in)

---

## Common Patterns

### Glass Panel with Loading
```handlebars
{{#> glass-panel title="Section" loading=true skeletonWidth="60%" skeletonHeight="80px" hasBody=true}}
  {{> datepicker id="date"}}
{{/glass-panel}}
```

### Input with Label and Hint
```handlebars
{{#> input-group label="Price" hint="Enter price in selected currency"}}
  {{#> input-suffix-select selectId="price-wrap" inputId="price" defaultValue="EUR"}}
    {{> currencies}}
  {{/input-suffix-select}}
{{/input-group}}
```

### Custom Select with Options
```handlebars
{{#> custom-select id="status-select" fieldId="status" defaultValue="Active"}}
  {{> supplier_statuses}}
{{/custom-select}}
```

### Modal with Form
```handlebars
{{#> modal id="edit-modal" title="Edit" titleKey="modal.edit" size="small" hasFooter=true cancelLabelKey="btn.cancel" saveLabelKey="btn.save"}}
  <div class="modal-form">
    {{#> input-group label="Name"}}
      <input type="text" class="glass-input" id="edit-name">
    {{/input-group}}
  </div>
{{/modal}}
```

---

## Additional UI Components

### kanban-card.html

Draggable card for kanban board.

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | string | yes | - | Supplier ID |
| `companyName` | string | yes | - | Company name |
| `rating` | number | yes | - | Rating 1-5 |
| `categories` | array | no | - | Category tags |
| `leadTime` | number | no | - | Lead time in days |
| `hasDeficit` | boolean | no | false | Show deficit indicator |

**Usage:**
```handlebars
{{!-- categories populated by JS via {{#each}} --}}
{{> kanban-card id="123" companyName="Steel Co" rating=4 leadTime=7 hasDeficit=true}}
```

---

### view-tabs.html

View switcher tabs (Table/Kanban).

**Parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `activeView` | string | yes | - | Current view: "table" or "kanban" |

**Usage:**
```handlebars
{{> view-tabs activeView="table"}}
```
