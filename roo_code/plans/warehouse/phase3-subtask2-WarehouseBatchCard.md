# Phase 3, Subtask 2: Enhance `WarehouseBatchCard.vue`

## What needs to be done

Refactor the existing [`WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) to use the new [`useWarehouseBatch`](frontend_vue/src/composables/useWarehouseBatch.ts) composable and add the following sections:

1. **Edit form** — toggle between view and edit mode with inline editing
2. **Files section** — display attached files (placeholder for now, no file upload yet)
3. **Offcuts section** — table of offcuts created from this batch
4. **Movements section** — table of movements for this batch
5. **Audit log section** — display `createdAt` / `updatedAt` timestamps

## Files to modify

- [`frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue`](frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) — complete rewrite of template and script

## Context

### Current state of the component

The existing component (134 lines) has:
- Inline `load()` function fetching batch by route param ID
- Basic read-only display: breadcrumb, status pill, batch info section, quantities section, dates section, notes section
- Error state with retry button
- Skeleton loading via `GlassPanel`

### What needs to change

The component should be refactored to:

1. **Use `useWarehouseBatch` composable** instead of inline logic
2. **Add edit/view mode toggle** — a button "Edit" that switches to edit mode, showing form inputs instead of `<dl>` lists
3. **Add delete button** with confirmation (use `AppModal` for confirmation dialog)
4. **Add movements section** — a mini-table showing movements for this batch
5. **Add offcuts section** — a mini-table showing offcuts created from this batch
6. **Add audit section** — display `createdAt` and `updatedAt`
7. **Add files section** — placeholder section showing "No files attached" with a note that file upload is coming

### Existing composable (being created in Subtask 1)

```ts
// useWarehouseBatch(id: string) returns:
{
  batch, loading, saving, error,
  form, isAnythingDirty,
  movements, movementsLoading,
  offcuts, offcutsLoading,
  load, save, discard, remove,
  loadMovements, loadOffcuts,
  tf
}
```

### Existing components to use

- [`GlassPanel`](frontend_vue/src/components/admin/GlassPanel.vue) — panel with skeleton loading
- [`Breadcrumb`](frontend_vue/src/components/admin/Breadcrumb.vue) — navigation breadcrumbs
- [`SvgIcon`](frontend_vue/src/components/admin/SvgIcon.vue) — icons
- [`AppModal`](frontend_vue/src/components/admin/ui/AppModal.vue) — confirmation dialog for delete

### Existing CSS classes (from [`warehouse_list.css`](frontend_vue/src/styles/admin/warehouse_list.css:344))

- `.page-batch-card` — page wrapper
- `.batch-card-content` — content wrapper
- `.batch-card-header` — header with title + status pill
- `.batch-card-grid` — CSS grid for sections
- `.batch-card-section` — individual section card
- `.batch-card-section-full` — full-width section
- `.batch-card-dl` — definition list for key-value display
- `.batch-card-actions` — action buttons row
- `.batch-notes` — notes text styling
- `.pill`, `.pill-lg`, `.pill-success`, `.pill-info`, `.pill-warning`, `.pill-muted`, `.pill-danger` — status pills

### New CSS needed (add to [`warehouse_list.css`](frontend_vue/src/styles/admin/warehouse_list.css))

- `.batch-card-edit-form` — form layout for edit mode
- `.batch-card-form-row` — form row with label + input
- `.batch-card-mini-table` — compact table for movements/offcuts sections
- `.batch-card-audit` — audit log display
- `.batch-card-files` — files section placeholder
- `.batch-card-mode-toggle` — edit/view mode toggle button styling

### i18n keys needed (add to [`i18n/admin/warehouse.ts`](frontend_vue/src/i18n/admin/warehouse.ts))

For all three locales (ru/en/lt), add:

```ts
// Batch card - edit mode
section_batch_offcuts: 'Offcuts from this batch' / 'Обрезки из этой партии' / 'Šios partijos atraižos'
section_batch_audit: 'Audit log' / 'Аудит' / 'Auditas'
section_batch_files: 'Files' / 'Файлы' / 'Failai'
btn_edit_batch: 'Edit batch' / 'Редактировать партию' / 'Redaguoti partiją'
btn_view_mode: 'View' / 'Просмотр' / 'Peržiūra'
btn_delete_batch: 'Delete batch' / 'Удалить партию' / 'Ištrinti partiją'
confirm_delete_batch: 'Are you sure you want to delete this batch? This action cannot be undone.' / 'Вы уверены, что хотите удалить эту партию? Это действие нельзя отменить.' / 'Ar tikrai norite ištrinti šią partiją? Šio veiksmo negalima atšaukti.'
field_created_at: 'Created' / 'Создано' / 'Sukurta'
field_updated_at: 'Updated' / 'Обновлено' / 'Atnaujinta'
no_files: 'No files attached' / 'Нет прикреплённых файлов' / 'Nėra pridėtų failų'
files_coming_soon: 'File upload will be available in a future update' / 'Загрузка файлов будет доступна в будущем обновлении' / 'Failų įkėlimas bus pasiekiamas ateityje'
```

### Test IDs

Add `data-test` attributes:
- `batch-card-edit-btn`
- `batch-card-delete-btn`
- `batch-card-save-btn`
- `batch-card-discard-btn`
- `batch-card-form`
- `batch-card-movements-section`
- `batch-card-offcuts-section`
- `batch-card-audit-section`
- `batch-card-files-section`
- `batch-card-delete-modal`

## Template structure

```html
<div class="page-batch-card" data-test="page-batch-card">
  <Breadcrumb :items="[...]" />

  <GlassPanel :loading="loading" :skeleton-rows="12">
    <!-- Error state -->
    <div v-if="error" class="error-state" data-test="batch-card-error">...</div>

    <div v-else-if="batch" class="batch-card-content">
      <!-- Header: title + status pill + mode toggle -->
      <div class="batch-card-header">
        <h1 class="page-title">{{ tf(batch.productName) }}</h1>
        <span class="pill pill-lg" :class="BATCH_STATUS_PILL[batch.status]">...</span>
        <div class="batch-card-actions">
          <button v-if="!isEditing" @click="isEditing = true" data-test="batch-card-edit-btn">Edit</button>
          <button v-else @click="save" data-test="batch-card-save-btn">Save</button>
          <button v-if="isEditing" @click="discard; isEditing = false" data-test="batch-card-discard-btn">Discard</button>
          <button @click="showDeleteModal = true" data-test="batch-card-delete-btn">Delete</button>
        </div>
      </div>

      <!-- View mode: grid of sections -->
      <div v-if="!isEditing" class="batch-card-grid">
        <!-- Batch info section -->
        <div class="batch-card-section">...</div>
        <!-- Quantities section -->
        <div class="batch-card-section">...</div>
        <!-- Dates section -->
        <div class="batch-card-section">...</div>
        <!-- Notes section (full width) -->
        <div class="batch-card-section batch-card-section-full">...</div>
      </div>

      <!-- Edit mode: form -->
      <div v-else class="batch-card-edit-form" data-test="batch-card-form">
        <!-- form inputs for batchNumber, lotCode, quantity, unitPrice, location, certificateRef, status, notes -->
      </div>

      <!-- Movements section -->
      <div class="batch-card-section batch-card-section-full" data-test="batch-card-movements-section">
        <h3>Movements</h3>
        <table class="batch-card-mini-table" v-if="movements.length">...</table>
        <p v-else>No movements</p>
      </div>

      <!-- Offcuts section -->
      <div class="batch-card-section batch-card-section-full" data-test="batch-card-offcuts-section">
        <h3>Offcuts</h3>
        <table class="batch-card-mini-table" v-if="offcuts.length">...</table>
        <p v-else>No offcuts</p>
      </div>

      <!-- Files section -->
      <div class="batch-card-section batch-card-section-full" data-test="batch-card-files-section">
        <h3>Files</h3>
        <p>No files attached</p>
        <p class="text-muted">File upload coming soon</p>
      </div>

      <!-- Audit section -->
      <div class="batch-card-section batch-card-section-full" data-test="batch-card-audit-section">
        <h3>Audit</h3>
        <dl class="batch-card-dl">
          <dt>Created</dt><dd>{{ batch.createdAt }}</dd>
          <dt>Updated</dt><dd>{{ batch.updatedAt }}</dd>
        </dl>
      </div>
    </div>
  </GlassPanel>

  <!-- Delete confirmation modal -->
  <AppModal v-if="showDeleteModal" @confirm="remove" @cancel="showDeleteModal = false" />
</div>
```

## Acceptance criteria

- [ ] Component uses `useWarehouseBatch` composable instead of inline logic
- [ ] View mode displays all existing info sections (batch info, quantities, dates, notes)
- [ ] Edit mode shows form inputs for editable fields with Save/Discard buttons
- [ ] Delete button with confirmation modal works
- [ ] Movements section shows related movements in a mini-table
- [ ] Offcuts section shows related offcuts in a mini-table
- [ ] Files section shows placeholder
- [ ] Audit section shows created/updated timestamps
- [ ] All new i18n keys added for ru/en/lt
- [ ] All new CSS classes added
- [ ] All `data-test` attributes added
- [ ] Component compiles without TypeScript errors
