# Fix: Make Notes Textarea in Batch Card Resizable and Auto-Expanding

## Problem

The Notes field in [`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:547) is a `<textarea>` with inline styles that **disable** vertical resizing and keep it at a fixed small height:

```html
<textarea
  v-model="form.notes"
  class="glass-input"
  data-test="field-notes"
  style="min-height: 60px; resize: none;"
/>
```

This means:
1. The user **cannot** drag to resize the textarea vertically
2. If there is pre-existing text (e.g., when editing a batch that already has notes), the textarea stays at 60px height and the content is hidden behind a scrollbar — the user has to scroll to see all the text

## Reference Implementation

The [`EmailTemplate.vue`](../../frontend_vue/src/components/admin/ui/EmailTemplate.vue:38) component's body textarea works well:

```html
<textarea
  class="glass-input body-input"
  data-test="email-template-body"
  rows="8"
  ...
/>
```

With CSS in [`_email-template.css`](../../frontend_vue/src/styles/admin/components/_email-template.css:29):
```css
.email-body-input {
  resize: vertical;
  min-height: 150px;
}
```

The global [`textarea.glass-input`](../../frontend_vue/src/styles/admin/components/_forms.css:31) rule already sets `resize: vertical` and `min-height: 50px`, but the batch card overrides it with inline styles.

## Solution

Two changes are needed:

### 1. Remove inline styles from the textarea in [`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:547)

Change from:
```html
<textarea
  v-model="form.notes"
  class="glass-input"
  data-test="field-notes"
  style="min-height: 60px; resize: none;"
/>
```

To:
```html
<textarea
  v-model="form.notes"
  class="glass-input batch-notes-input"
  data-test="field-notes"
/>
```

### 2. Add a CSS rule for `.batch-notes-input` in the warehouse list CSS

In [`warehouse_list.css`](../../frontend_vue/src/styles/admin/warehouse_list.css), add:

```css
/* Batch card notes textarea — auto-expanding with constrained max-height */
textarea.batch-notes-input {
  resize: vertical;
  min-height: 80px;
  max-height: 300px;
  line-height: 1.5;
}
```

**Why these values:**
- `resize: vertical` — allows the user to drag-resize vertically (like the email body)
- `min-height: 80px` — slightly taller than the current 60px, enough to show ~3 lines of text comfortably
- `max-height: 300px` — prevents the textarea from growing infinitely; at 300px (~15 lines) it becomes scrollable
- `line-height: 1.5` — improves readability for multi-line notes

**Auto-expand behavior:** By removing the fixed height and using `min-height` + `max-height`, the textarea will naturally grow to fit its content up to 300px. The browser's default behavior for `<textarea>` is to show all content within its height constraints, so if the loaded text is, say, 150px worth, the textarea will display at ~150px without needing a scrollbar.

## Files to Modify

| File | Change |
|------|--------|
| [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue:547) | Remove inline `style` attribute, add class `batch-notes-input` |
| [`frontend_vue/src/styles/admin/warehouse_list.css`](../../frontend_vue/src/styles/admin/warehouse_list.css) | Add `.batch-notes-input` CSS rule |

## Testing Notes

- Verify the textarea shows all content on page load (no scrollbar for short text)
- Verify the user can drag-resize vertically
- Verify the textarea does not grow beyond ~300px
- Verify on mobile that the textarea still works well (the global responsive rules for `textarea.glass-input` will still apply)
