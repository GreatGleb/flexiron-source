# Plan: Enrich Mock Notes for Warehouse Batches

## Problem

In [`frontend_vue/src/mocks/warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts), the `notes` field is `null` for **69 out of 74** batches. Only 5 batches have any notes at all. The user specifically noted that `whb-002` has an empty `notes` field and wants richer mock data across all batches.

## Current State

| Batch IDs | notes | Status |
|-----------|-------|--------|
| whb-001, whb-002, whb-003, whb-006–whb-011, whb-013–whb-036, whb-038–whb-043, whb-045–whb-049, whb-051–whb-074 | `null` | ❌ Empty |
| whb-004 | `'New supplier batch'` | ✅ Has note |
| whb-005 | `'Mostly consumed'` | ✅ Has note |
| whb-012 | `'Stainless steel - handle with care'` | ✅ Has note |
| whb-037 | `'Premium electrodes'` | ✅ Has note |
| whb-044 | `'40L cylinders'` | ✅ Has note |
| whb-050 | `'Almost empty'` | ✅ Has note |

## Approach

Add realistic, context-aware notes to each batch. Notes should reflect:

1. **Product category** (sheets, pipes, consumables, gases, abrasives, tools, equipment, beams, rebar, profiles, fittings)
2. **Batch status** (available, partial, depleted, quarantine)
3. **Supplier relationship** (new supplier, regular supplier, quality issues)
4. **Storage conditions** (special handling for stainless steel, gases, etc.)
5. **Quality observations** (certificate status, visual inspection results)
6. **Usage context** (which production orders this batch is used for)

## Proposed Notes by Category

### Sheets / Листы (whb-001–whb-018)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-001 | `'Certificate CERT-001 attached. Batch partially consumed for order #ORD-2025-042.'` | Has cert, partially used |
| whb-002 | `'New supplier SteelInvest. Full batch intact, awaiting allocation.'` | Full batch, new supplier |
| whb-003 | `'Galvanized sheet - store indoors to prevent white rust.'` | Galvanized material needs care |
| whb-004 | Keep existing `'New supplier batch'` | Already has note |
| whb-005 | Keep existing `'Mostly consumed'` | Already has note |
| whb-006 | `'Plywood - keep dry. Remaining 60m2 stored in F-01-01.'` | Moisture-sensitive material |
| whb-007 | `'Second plywood batch from DrevProm. Lower price due to bulk discount.'` | Price context |
| whb-008 | `'Certificate CERT-012 attached. 100kg issued to production.'` | Has cert, some used |
| whb-009 | `'Full batch from SteelInvest. No certificate - awaiting from supplier.'` | No cert, new supplier |
| whb-010 | `'Full batch, untouched. Stored in A-04-01.'` | Fresh batch |
| whb-011 | `'50kg consumed for prototype order. Remaining 550kg available.'` | Partial usage |
| whb-012 | Keep existing `'Stainless steel - handle with care'` | Already has note |
| whb-013 | `'Aluminum sheet - store separately from carbon steel to avoid contamination.'` | Material-specific handling |
| whb-014 | `'Corrugated sheet batch with photo documentation attached.'` | Has photo file |
| whb-015 | `'Second corrugated batch from ListMet. 30m2 consumed.'` | Partial usage |
| whb-016 | `'Oldest batch in stock (Jan 2025). 100kg consumed.'` | Age context |
| whb-017 | `'Fresh batch from SteelInvest. Full quantity available.'` | New batch |
| whb-018 | `'Chequer plate - new product in stock. Full batch.'` | New product |

### Pipes / Трубы (whb-019–whb-031)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-019 | `'180m consumed for railing production. Invoice and waybill attached.'` | Partial usage, has docs |
| whb-020 | `'40m consumed for structural frames.'` | Partial usage |
| whb-021 | `'20m consumed. Heavy section - requires forklift for movement.'` | Handling note |
| whb-022 | `'Full batch from TrubService. Round pipe 50mm.'` | Fresh batch |
| whb-023 | `'Second round pipe batch - lower price than previous (5.80 vs 6.00/m).'` | Price comparison |
| whb-024 | `'30m consumed. 76mm diameter - used for handrails.'` | Usage context |
| whb-025 | `'50m consumed for gas line installation project.'` | Usage context |
| whb-026 | `'50m consumed. Second supplier (TruboMet) - cheaper than TrubService.'` | Supplier comparison |
| whb-027 | `'Stainless pipe - certificate CERT-030 attached. 10m consumed.'` | Special material, has cert |
| whb-028 | `'50m consumed for small parts jig. Invoice attached.'` | Partial usage |
| whb-029 | `'Full batch from TrubService. Competitive pricing at 2.10/m.'` | Fresh batch |
| whb-030 | `'20m consumed. Heavy profile 100x50 - stored at B-10-01.'` | Partial usage |
| whb-031 | `'50m consumed. Most-used pipe size for general fabrication.'` | Usage context |

### Consumables / Расходные материалы (whb-032–whb-043)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-032 | `'150kg consumed. High turnover item - reorder when below 100kg.'` | Usage + reorder hint |
| whb-033 | `'Fresh batch. Price reduced to 2.75/kg from 2.80.'` | Price change |
| whb-034 | `'80kg consumed. Status: partial - reorder soon.'` | Low stock warning |
| whb-035 | `'60kg consumed. Electrodes 4mm - used for heavy welding.'` | Usage context |
| whb-036 | `'20kg consumed. Wire 0.8mm - used for thin sheet welding.'` | Usage context |
| whb-037 | Keep existing `'Premium electrodes'` | Already has note |
| whb-038 | `'Full batch. ESAB OK 48.00 - premium quality electrodes.'` | Fresh batch |
| whb-039 | `'Full batch. Lincoln L-56 wire - compatible with most MIG welders.'` | Compatibility note |
| whb-040 | `'Full batch. ESAB OK Autrod 12.64 - for stainless steel welding.'` | Application note |
| whb-041 | `'40kg consumed. Flux for submerged arc welding.'` | Partial usage |
| whb-042 | `'Full batch. Lincoln 860 flux - 25kg pails. Invoice attached.'` | Packaging note |
| whb-043 | `'Full batch. ER70S-6 wire - general purpose MIG wire.'` | General purpose note |

### Gases / Газы (whb-044–whb-050)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-044 | Keep existing `'40L cylinders'` | Already has note |
| whb-045 | `'Fresh batch of 30 cylinders. Stored in D-01-02.'` | New batch |
| whb-046 | `'5 cylinders consumed. Argon - used for TIG welding.'` | Partial usage |
| whb-047 | `'Full batch. Corgon 18 mix - optimal for MIG welding carbon steel.'` | Application note |
| whb-048 | `'7 cylinders consumed. Oxygen - used for plasma cutting.'` | Partial usage |
| whb-049 | `'Full batch. Propane 50L - used for heating and cutting.'` | Fresh batch |
| whb-050 | Keep existing `'Almost empty'` | Already has note |

### Abrasives / Абразив (whb-051–whb-054)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-051 | `'200 pcs consumed. High usage item - maintain min stock 200.'` | Usage + reorder hint |
| whb-052 | `'Fresh batch. Better price than previous (0.75 vs 0.80/pcs).'` | Price improvement |
| whb-053 | `'60 pcs consumed. Grinding wheels 125mm.'` | Partial usage |
| whb-054 | `'Fresh batch. New stock of grinding wheels.'` | New batch |

### Tools / Инструмент (whb-055–whb-057)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-055 | `'20 pcs consumed. HSS drill bits 10mm - high demand size.'` | Partial usage |
| whb-056 | `'15 pcs consumed. M10 taps - used for thread repair.'` | Partial usage |
| whb-057 | `'Full batch. M10 dies - complement to M10 taps in stock.'` | Complementary item |

### Equipment / Оборудование (whb-058–whb-061)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-058 | `'1 unit issued to workshop. Certificate CERT-061 attached. Serial: MIG-250-001.'` | Has cert, 1 used |
| whb-059 | `'Full batch of 3 units. Certificate CERT-062 attached.'` | Has cert, full batch |
| whb-060 | `'Full batch of 2 units. Certificate CERT-063 attached. High-value item.'` | High-value note |
| whb-061 | `'Full batch of 2 units. Certificate CERT-064 attached. ESAB Rebel EMP 235.'` | Has cert |

### Beams & Channels / Балки и швеллеры (whb-062–whb-067)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-062 | `'Full batch. IPE 200 beam - certificate CERT-065 attached.'` | Has cert |
| whb-063 | `'Full batch. HEA 300 heavy beam - certificate CERT-066 attached.'` | Has cert |
| whb-064 | `'15m consumed. UPN 100 channel - used for framing.'` | Partial usage |
| whb-065 | `'Full batch. UPN 200 heavy channel.'` | Fresh batch |
| whb-066 | `'20m consumed. Equal angle 50x50x5 - versatile size.'` | Partial usage |
| whb-067 | `'Full batch. Unequal angle 80x60x6 - special size.'` | Fresh batch |

### Rebar / Арматура (whb-068–whb-069)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-068 | `'800kg consumed. Rebar A500C 12mm - certificate CERT-071 attached.'` | Has cert, partial usage |
| whb-069 | `'Full batch. Rebar B500C 16mm - certificate CERT-072 attached.'` | Has cert |

### Profiles / Профили (whb-070–whb-072)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-070 | `'20m consumed. Square tube 40x40x3 - common size for frames.'` | Partial usage |
| whb-071 | `'Full batch. Rectangular tube 80x40x4 - heavy duty profile.'` | Fresh batch |
| whb-072 | `'50kg consumed. Galvanized wire 3mm - used for binding and fencing.'` | Partial usage |

### Fittings / Фитинги (whb-073–whb-074)

| ID | Proposed Notes | Rationale |
|----|---------------|-----------|
| whb-073 | `'30 pcs consumed. Elbow 90° DN50 - used in piping project.'` | Partial usage |
| whb-074 | `'Full batch. Flange DN100 PN16 - high pressure rating.'` | Fresh batch |

## Implementation

The change is straightforward: replace `notes: null` with meaningful string values in the mock data file [`frontend_vue/src/mocks/warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts). Only the `notes` field values change — no other fields or structure are modified.

## Files to Modify

- [`frontend_vue/src/mocks/warehouse-batches.ts`](frontend_vue/src/mocks/warehouse-batches.ts) — update `notes` field for all 74 batches
