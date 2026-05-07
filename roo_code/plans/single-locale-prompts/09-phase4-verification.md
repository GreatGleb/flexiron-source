# Phase 4: Verification

## Prerequisites

All previous phases (Phase 1, all domains, Phase 3 cleanup) must be completed.

## Goal

Verify that the refactoring compiles, builds, and passes tests.

## Steps

### 1. TypeScript check

```bash
cd frontend_vue && npx vue-tsc --noEmit
```

Expected: zero errors.

If there are errors, fix them. Common issues:
- Missing imports of `toTranslatedString` or `mergeTranslatedString`
- Wrong function signatures (missing `locale` parameter)
- References to removed non-translated functions
- References to removed `translated` option

### 2. Build check

```bash
cd frontend_vue && npm run build
```

Expected: successful build with no errors.

### 3. E2E tests

```bash
cd frontend_vue && npx playwright test
```

Expected: all tests pass.

If tests fail, investigate:
- Are mock handlers returning correct data?
- Is `tf()` working correctly with single-locale data?
- Are PATCH operations merging correctly?

## What to check manually (if needed)

1. Open the app in browser
2. Switch locale to Russian
3. Create a new category with name "Тест"
4. Save → verify only `{ ru: "Тест" }` was sent (check network tab)
5. Switch locale to English
6. Edit the same category, change name to "Test"
7. Save → verify only `{ en: "Test" }` was sent
8. Switch locale to Lithuanian
9. View the category → should see "Test" (fallback to en since lt is empty)
10. Repeat for Products, Suppliers, BCC, Config
