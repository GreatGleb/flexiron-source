# Fix: Row Height Flicker During Filter Transitions

## Problem

When the user toggles stock filters (deficit, in-stock, search, etc.), the product column rows briefly collapse to a small height before snapping back to the correct size. This flicker is visible to the user.

## Root Cause

[`syncTableRowHeights()`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:262) is **asynchronous** — it uses double `requestAnimationFrame`:

```
Pass 1: reset all row style.height to ''  (causes collapse)
requestAnimationFrame → requestAnimationFrame → Pass 2: measure + set heights
```

The current [`startFilterTransition()`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:111) flow:

```
filteringStock = true          → table hidden (visibility:hidden), skeleton shows
nextTick() → syncTableRowHeights() called
  ├─ Pass 1: reset heights to ''  (table is hidden, no visual issue)
  ├─ rAF scheduled (async)...
  └─ function returns immediately
filteringStock = false          ← ⚠️ TABLE BECOMES VISIBLE WITH RESET HEIGHTS!
  ...later (next frame)...
  rAF → rAF → Pass 2: set heights  (too late, flicker already happened)
```

The `visibility: hidden` approach from my previous edit is correct in principle — it keeps the table in the DOM with correct `offsetHeight`. But the timing is wrong: `filteringStock` becomes `false` **before** the double rAF completes, so the user sees the table with reset (empty) heights.

## Solution

Make `startFilterTransition()` wait for `syncTableRowHeights()` to fully complete before revealing the table.

### Step 1: Convert `syncTableRowHeights()` to return a Promise

```typescript
function syncTableRowHeights(): Promise<void> {
  const fixedTbody = fixedTableEl.value?.querySelectorAll<HTMLElement>('tbody tr')
  const scrollTbody = scrollTableEl.value?.querySelectorAll<HTMLElement>('tbody tr')
  const fixedThead = fixedTableEl.value?.querySelectorAll<HTMLElement>('thead tr')
  const scrollThead = scrollTableEl.value?.querySelectorAll<HTMLElement>('thead tr')

  if (!fixedTbody || !scrollTbody) return Promise.resolve()

  // Pass 1: Reset all heights so the browser can compute natural sizes
  fixedTbody.forEach(tr => { tr.style.height = '' })
  scrollTbody.forEach(tr => { tr.style.height = '' })
  fixedThead?.forEach(tr => { tr.style.height = '' })
  scrollThead?.forEach(tr => { tr.style.height = '' })

  // Pass 2: Double requestAnimationFrame guarantees browser reflow is complete.
  // Return a Promise so callers can await completion.
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const maxLen = Math.min(fixedTbody.length, scrollTbody.length)
        for (let i = 0; i < maxLen; i++) {
          const h = Math.max(fixedTbody[i]!.offsetHeight, scrollTbody[i]!.offsetHeight)
          if (h > 0) {
            fixedTbody[i]!.style.height = h + 'px'
            scrollTbody[i]!.style.height = h + 'px'
          }
        }

        if (fixedThead && scrollThead) {
          const hdrLen = Math.min(fixedThead.length, scrollThead.length)
          for (let i = 0; i < hdrLen; i++) {
            const hh = Math.max(fixedThead[i]!.offsetHeight, scrollThead[i]!.offsetHeight)
            if (hh > 0) {
              fixedThead[i]!.style.height = hh + 'px'
              scrollThead[i]!.style.height = hh + 'px'
            }
          }
        }

        resolve()
      })
    })
  })
}
```

### Step 2: Update `startFilterTransition()` to await the Promise

```typescript
async function startFilterTransition() {
  if (filterTimer) clearTimeout(filterTimer)
  filteringStock.value = true
  // Phase 1: skeleton shows, real table becomes visibility:hidden
  await nextTick()
  // Phase 2: sync heights on the invisible real table — no visual flicker
  await syncTableRowHeights()
  // Phase 3: hide skeleton, show real table with correct heights already set
  filteringStock.value = false
}
```

### Step 3: Update callers that don't need the Promise

The existing callers of `syncTableRowHeights()` (in `onMounted`, `watch(stockItems)`, resize handler, ResizeObserver) don't need to await — they can just call it without `await`. The Promise will resolve asynchronously but that's fine for those cases.

### Step 4: Keep the existing template/CSS changes

The template structure with `.stock-table-area` wrapper, `v-show` skeleton, and `.stock-table-hidden` class is correct and should be kept:

- [`stock-table-area`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:484) — `position: relative` wrapper
- [`v-show="filteringStock"`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:487) — skeleton overlay, `position: absolute`
- [`stock-table-hidden`](frontend_vue/src/views/admin/warehouse/WarehousePage.vue:504) — `visibility: hidden` on real table (keeps layout, correct offsetHeight)

## Why This Works

1. User toggles filter → `filteredStockItems` recomputes → Vue re-renders table rows
2. `startFilterTransition()` sets `filteringStock = true` → skeleton shows, real table becomes `visibility: hidden` (invisible but still in DOM with correct `offsetHeight`)
3. `await nextTick()` → Vue flushes DOM updates, new rows are rendered (but hidden)
4. `await syncTableRowHeights()` → Pass 1 resets heights (invisible, no flicker), double rAF fires, Pass 2 measures and sets correct heights
5. `filteringStock = false` → skeleton hides, real table becomes visible with correct heights already applied

The user never sees the height reset because the table is invisible during the entire sync process.
