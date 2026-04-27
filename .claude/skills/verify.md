---
name: verify
description: Run verification checklist — TypeScript, ESLint, IDE diagnostics
user_invocable: true
---

# Verify Frontend

Run the full verification checklist for the Vue frontend.

## Steps

1. **TypeScript check**:
   ```bash
   cd frontend_vue && npm run typecheck
   ```
   Report any errors.

2. **ESLint check**:
   ```bash
   cd frontend_vue && npm run lint
   ```
   Report any errors.

3. **IDE diagnostics** (if available):
   Use `mcp__ide__getDiagnostics` to check for errors in open files.

4. **Dev server check**:
   Check if the Vite dev server is running:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
   ```
   If not running, report it.

5. **Summary**:
   Output a clear summary:
   - TypeScript: OK / N errors
   - ESLint: OK / N errors
   - IDE: OK / N issues
   - Dev server: running / not running
