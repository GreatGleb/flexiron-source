---
name: verify
description: Run full verification checklist — TypeScript, ESLint, IDE diagnostics, dev server, and project integrity checks
user_invocable: true
---

# Verify Frontend

Run the full verification checklist for the Vue frontend.

## Steps

1. **TypeScript check**:
   ```bash
   cd frontend_vue && npm run typecheck
   ```
   Report any errors. If errors exist, read each one and determine if related to recent changes.

2. **ESLint check**:
   ```bash
   cd frontend_vue && npm run lint
   ```
   Report any errors. If errors exist, read each one and fix.

3. **Dev server check**:
   Check if the Vite dev server is running:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 || echo "Not running"
   ```
   If not running, report it.

4. **Project integrity checks**:
   - Verify `src/router/index.ts` has no duplicate route names
   - Verify `src/i18n/admin.ts` has matching key counts across all 3 languages (RU/EN/LT)
   - Verify `src/config/featureFlags.ts` — all flags used in views exist in FeatureFlags type
   - Verify `tests/e2e/helpers/flags.ts` — all page flags present in ALL_FLAGS_ENABLED

5. **Summary**:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ Verification Complete
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   TypeScript:  OK / N errors
   ESLint:      OK / N errors
   Dev server:  running / not running
   Integrity:   OK / N issues
   
   [If issues found — list each with file:line and suggested fix]
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```
