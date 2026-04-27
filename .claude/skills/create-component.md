---
name: create-component
description: Create a Vue 3 component from a Handlebars partial in demo/panini/partials
user_invocable: true
arguments:
  - name: partial
    description: "Partial name (e.g., glass-panel, kpi-card, custom-select, modal, datepicker, dropzone, rating-stars, tag-input, kanban-card, multi-select, etc.)"
    required: true
---

# Create Vue Component from Handlebars Partial

Convert a Panini/Handlebars partial into a Vue 3 SFC component.

## Steps

1. **Find the partial** `$ARGUMENTS` in `demo/panini/partials/`:
   - Search in subdirectories: `atoms/`, `components/`, `sections/`, `ui/`, `tables/`

2. **Read CLAUDE.md** at `frontend_vue/CLAUDE.md` for all patterns and rules.

3. **Identify the CSS file** for this component:
   - Check `demo/assets/css/admin/components/` for matching `_name.css`
   - Common mappings: glass-panel → `_glass-panel.css`, modal → `_modal.css`, custom-select → `_custom-select.css`

4. **Determine component location**:
   - Core UI controls → `src/components/admin/ui/`
   - Table components → `src/components/admin/tables/`
   - Layout/section components → `src/components/admin/`

5. **Create the Vue component**:

   - `<script setup lang="ts">`:
     - `defineProps<{}>()` with typed props replacing Handlebars parameters
     - `defineEmits<{}>()` for events
     - `useI18n()` if component has translatable text
   - Template:
     - Convert Handlebars markup to Vue template
     - `{{> @partial-block}}` → `<slot />`
     - Named blocks → named slots
     - `{{variable}}` → props
     - `data-i18n="key"` → `{{ t('key') }}`
   - CSS import from `@assets/css/admin/components/` (NOT scoped, NOT copied)

6. **For interactive components** (CustomSelect, Modal, TagInput, etc.):
   - Implement `v-model` support: `modelValue` prop + `update:modelValue` emit
   - Encapsulate UI behavior (open/close, keyboard nav, click-outside)
   - Use `<Teleport to="body">` for overlays (modals, dropdowns if needed)

7. **Verify**:
   - Run `npm run typecheck` in `frontend_vue/`
   - Run `npm run lint` in `frontend_vue/`
   - Report any errors found

## Rules

- Follow ALL patterns from `frontend_vue/CLAUDE.md`
- Single Responsibility: one component = one UI task
- Open/Closed: extend via slots and props, not source edits
- Every v-model component: `modelValue` prop + `update:modelValue` emit
- Never copy CSS — import from `@assets`
- Never manipulate DOM directly — use Vue refs and reactivity
