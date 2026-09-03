# Plan: Add Mock File Data to Warehouse Batches

## Problem

In [`warehouse-batches.ts`](../../frontend_vue/src/mocks/warehouse-batches.ts), all 74 mock batch objects are missing the `files` field (it's `undefined` / implicitly empty array). The [`WarehouseBatch`](../../frontend_vue/src/types/warehouse.ts:36) type defines `files: WarehouseBatchFile[]` (line 38), and the [`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) UI renders a file list section using [`FileItem`](../../frontend_vue/src/components/admin/FileItem.vue) and [`DropZone`](../../frontend_vue/src/components/admin/ui/DropZone.vue) components. Without mock file data, the file section appears empty for all batches.

The user specifically noted that `whb-002` has an empty `files` field and wants mock data added there and in other batches too.

## Solution

Add realistic `files` arrays to a selection of batches across different categories. Not every batch needs files — some should remain empty to reflect real-world scenarios where not all batches have attached documents.

### File Types to Use

Based on the [`WarehouseBatchFile`](../../frontend_vue/src/types/warehouse.ts:26) interface:

```typescript
interface WarehouseBatchFile {
  id: string
  name: TranslatedString    // { ru, en, lt }
  size: number              // bytes
  type: string              // MIME type
  uploadedAt: string        // date string YYYY-MM-DD
}
```

### Mock File Templates

Create reusable file objects that can be spread into batches:

| File ID | Name (ru/en/lt) | Size | MIME Type | Description |
|---------|-----------------|------|-----------|-------------|
| `f-inv-001` | Накладная / Invoice / Važtaraštis | 245760 | application/pdf | Invoice document |
| `f-inv-002` | Счет-фактура / Invoice / Sąskaita faktūra | 184320 | application/pdf | Tax invoice |
| `f-cer-001` | Сертификат качества / Quality cert. / Kokybės sert. | 102400 | application/pdf | Quality certificate |
| `f-cer-002` | Сертификат соответствия / Compliance cert. / Atitikties sert. | 153600 | application/pdf | Compliance certificate |
| `f-pho-001` | Фото партии / Batch photo / Partijos nuotrauka | 512000 | image/jpeg | Photo of received goods |
| `f-pho-002` | Фото маркировки / Label photo / Etiketės nuotrauka | 384000 | image/jpeg | Photo of labeling |
| `f-del-001` | Транспортная накладная / Waybill / Krovinio važtaraštis | 296960 | application/pdf | Delivery waybill |
| `f-spe-001` | Спецификация / Specification / Specifikacija | 204800 | application/pdf | Product specification |
| `f-pac-001` | Упаковочный лист / Packing list / Pakuotės lapas | 143360 | application/pdf | Packing list |
| `f-lab-001` | Протокол испытаний / Test report / Bandymų ataskaita | 225280 | application/pdf | Laboratory test report |

### Which Batches Get Files

Distribute files across categories, prioritizing batches that are most likely to have documents in real scenarios:

**cat-2: Листы / Sheets** (batches with certificates or notable entries):
- `whb-001` (has `certificateRef: 'CERT-001'`) → 2 files: invoice + quality cert
- `whb-002` (user specifically requested) → 3 files: invoice, waybill, compliance cert
- `whb-003` (has `certificateRef: 'CERT-007'`) → 2 files: invoice + quality cert
- `whb-008` (has `certificateRef: 'CERT-012'`) → 1 file: invoice
- `whb-012` (has `certificateRef: 'CERT-016'`, notes about stainless steel) → 2 files: invoice + test report
- `whb-014` → 1 file: batch photo

**cat-4: Трубы / Pipes**:
- `whb-019` → 2 files: invoice + waybill
- `whb-027` (has `certificateRef: 'CERT-030'`) → 2 files: invoice + quality cert
- `whb-028` → 1 file: invoice

**cat-5: Расходные материалы**:
- `whb-032` → 1 file: invoice
- `whb-037` (notes: 'Premium electrodes') → 2 files: invoice + specification
- `whb-042` → 1 file: packing list

**cat-6: Газы / Gases**:
- `whb-044` (notes: '40L cylinders') → 1 file: waybill
- `whb-048` → 1 file: invoice

**cat-7: Абразив / Abrasives**:
- `whb-051` → 1 file: invoice

**cat-8: Инструмент / Tools**:
- `whb-055` → 1 file: invoice

**cat-9: Оборудование / Equipment** (all have certificates):
- `whb-058` (has `certificateRef: 'CERT-061'`) → 3 files: invoice, quality cert, batch photo
- `whb-059` (has `certificateRef: 'CERT-062'`) → 2 files: invoice + compliance cert
- `whb-060` (has `certificateRef: 'CERT-063'`) → 2 files: invoice + specification
- `whb-061` (has `certificateRef: 'CERT-064'`) → 2 files: invoice + batch photo

**cat-10: Балки и швеллеры / Beams & Channels**:
- `whb-062` (has `certificateRef: 'CERT-065'`) → 2 files: invoice + quality cert
- `whb-063` (has `certificateRef: 'CERT-066'`) → 2 files: invoice + compliance cert
- `whb-066` → 1 file: invoice

**cat-11: Арматура / Rebar**:
- `whb-068` (has `certificateRef: 'CERT-071'`) → 2 files: invoice + quality cert
- `whb-069` (has `certificateRef: 'CERT-072'`) → 1 file: invoice

**cat-12: Профили / Profiles**:
- `whb-070` → 1 file: invoice

**cat-13: Фитинги / Fittings**:
- `whb-073` → 1 file: invoice

### Batches That Remain Without Files

The following batches should keep `files: []` (or no files field) to reflect real-world scenarios where documents haven't been uploaded yet:
- `whb-004`, `whb-005`, `whb-006`, `whb-007`, `whb-009`, `whb-010`, `whb-011`, `whb-013`, `whb-015`, `whb-016`, `whb-017`, `whb-018`
- `whb-020`–`whb-026`, `whb-029`–`whb-031`
- `whb-033`–`whb-036`, `whb-038`–`whb-041`, `whb-043`
- `whb-045`–`whb-047`, `whb-049`, `whb-050`
- `whb-052`–`whb-054`
- `whb-056`, `whb-057`
- `whb-064`, `whb-065`, `whb-067`
- `whb-071`, `whb-072`
- `whb-074`

## Implementation

The change is limited to a single file: [`frontend_vue/src/mocks/warehouse-batches.ts`](../../frontend_vue/src/mocks/warehouse-batches.ts).

For each selected batch, add a `files` array property with the appropriate mock file objects. The file objects should use realistic `uploadedAt` dates (around the batch's `receivedAt` date or shortly after).

### Example for whb-002

```typescript
{
  id: 'whb-002',
  // ... existing fields ...
  files: [
    {
      id: 'f-inv-002',
      name: {
        ru: 'Счет-фактура',
        en: 'Invoice',
        lt: 'Sąskaita faktūra',
      },
      size: 184320,
      type: 'application/pdf',
      uploadedAt: '2025-03-15',
    },
    {
      id: 'f-del-001',
      name: {
        ru: 'Транспортная накладная',
        en: 'Waybill',
        lt: 'Krovinio važtaraštis',
      },
      size: 296960,
      type: 'application/pdf',
      uploadedAt: '2025-03-16',
    },
    {
      id: 'f-cer-002',
      name: {
        ru: 'Сертификат соответствия',
        en: 'Compliance certificate',
        lt: 'Atitikties sertifikatas',
      },
      size: 153600,
      type: 'application/pdf',
      uploadedAt: '2025-03-18',
    },
  ],
  // ... rest of fields ...
}
```

## Files to Modify

1. [`frontend_vue/src/mocks/warehouse-batches.ts`](../../frontend_vue/src/mocks/warehouse-batches.ts) — Add `files` arrays to selected batches

No other files need changes since:
- The type [`WarehouseBatch`](../../frontend_vue/src/types/warehouse.ts:36) already defines `files: WarehouseBatchFile[]`
- The service layer [`warehouse.ts`](../../frontend_vue/src/services/mocks/warehouse.ts) already handles files in `mockPatchBatch` (lines 337-347)
- The composable [`useWarehouseBatch.ts`](../../frontend_vue/src/composables/useWarehouseBatch.ts) already handles file operations
- The UI [`WarehouseBatchCard.vue`](../../frontend_vue/src/views/admin/warehouse/WarehouseBatchCard.vue) already renders files via `FileItem` and `DropZone`
