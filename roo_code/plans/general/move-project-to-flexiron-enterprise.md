# Plan: Move Project from `InBox LT` to `flexiron_enterprise`

## Overview

Move the entire project directory from `C:\Users\great\Documents\bussiness\InBox LT` to `C:\Users\great\Documents\bussiness\flexiron_enterprise`. The project is a Vue 3 + TypeScript frontend (package name `flexiron-frontend`) with Git history, JetBrains IDE config, and build artifacts.

## Risk Assessment

**Low risk.** The project uses only **relative paths** internally (Vite aliases like `@/`, `@styles/`, `@images/`). No config files contain hardcoded absolute paths to the project root that would break functionality. The main concerns are:

1. **JetBrains `.idea/`** — contains absolute paths that will become stale
2. **Build output (`demo/`, `dist/`)** — stale cached files referencing old paths in source maps
3. **Git remote** — unaffected (uses GitHub URL, not local path)
4. **Vite `outDir`** — uses relative path `../demo`, will resolve correctly from new location
5. **Vite `base`** — uses `/Flexiron-Enterprise/demo/` for builds, unaffected

---

## Identified Issues

### 1. JetBrains `.idea/` — stale absolute paths (LOW impact)

**Files affected:**
- [`.idea/InBox LT.iml`](.idea/InBox%20LT.iml) — module file named after old directory
- [`.idea/modules.xml`](.idea/modules.xml) — references `InBox LT.iml` by name
- [`.idea/workspace.xml`](.idea/workspace.xml) — contains:
  - `last_opened_file_path: "C:/Users/great/Documents/bussiness/InBox LT"`
  - `ts.external.directory.path: "C:\\Users\\great\\Documents\\bussiness\\InBox LT\\frontend_vue\\node_modules\\typescript\\lib"`
  - Recent file copy/move paths with `InBox LT`

**Impact:** JetBrains IDE (WebStorm/PHPStorm) will show stale paths in recent files and may not auto-detect the project. **Not critical** — IDE will prompt to re-attach or you can re-open the project from the new location.

### 2. Build output directories (`demo/`, `dist/`) — stale source maps (LOW impact)

**Files affected:**
- `demo/app/*.js` — minified JS bundles with inline source maps referencing old paths
- `frontend_vue/dist/assets/*.js` — same

**Impact:** Source maps in old builds will reference `InBox LT` paths. **Not critical** — these are build artifacts. After moving, run a fresh `npm run build` to regenerate clean bundles.

### 3. Old AI IDE configs — stale absolute paths (NO impact, legacy)

**Files affected:**
- [`toDo/old ai ide configs/.claude/settings.local.json`](toDo/old%20ai%20ide%20configs/.claude/settings.local.json) — contains multiple `Bash(cd *InBox LT*)` patterns

**Impact:** These are legacy Claude Code configs in a `toDo/` archive folder. **Not used by anything.** Safe to ignore.

### 4. Python scripts in `xlx tables/` — hardcoded absolute path (LOW impact)

**Files affected:**
- [`xlx tables/rename_files.py`](xlx%20tables/rename_files.py) — line 5: `folder = r'c:\Users\great\Documents\bussiness\InBox LT\xlx tables'`
- [`xlx tables/deep_analyze.py`](xlx%20tables/deep_analyze.py) — line 6: `file_path = r'c:\Users\great\Documents\bussiness\InBox LT\xlx tables\...'`

**Impact:** These scripts will break if run from the new location without updating the path. **Low priority** — utility scripts, not part of the application.

### 5. Brand name "InBox LT" in email templates (NO impact on move)

**Files affected:**
- [`frontend_vue/src/composables/useBccRequest.ts`](frontend_vue/src/composables/useBccRequest.ts) — email template subject/body contains "InBox LT" as company name
- [`frontend_vue/src/views/admin/suppliers/BccRequestPage.vue`](frontend_vue/src/views/admin/suppliers/BccRequestPage.vue) — same
- [`frontend_vue/tests/e2e/admin/suppliers/bcc-request.spec.ts`](frontend_vue/tests/e2e/admin/suppliers/bcc-request.spec.ts) — test assertion expects "InBox LT"

**Impact:** These are **business content** (company name in email templates), not path references. **Do NOT change** — unless you want to rebrand the company name from "InBox LT" to something else.

### 6. Document titles/headers referencing "InBox LT" (NO impact on move)

**Files affected (43 files total):**
- [`ROO.md`](ROO.md) — `# InBox LT — Roo Code Instructions`
- [`frontend_vue/CLAUDE.md`](frontend_vue/CLAUDE.md) — `# InBox LT — Frontend Vue (Admin Migration)`
- Multiple `roo_code/` and `toDo/` markdown files reference "InBox LT" in titles

**Impact:** These are **document titles and descriptions**, not functional paths. Cosmetic only. Update if you want the new directory name reflected in docs.

---

## Migration Steps

### Step 1: Clean up before moving

1. **Commit any pending changes** in Git
2. **Stop any running dev servers** (Vite, etc.)
3. **Delete build artifacts** (optional but recommended):
   - Delete `demo/` directory — will be regenerated on next build
   - Delete `frontend_vue/dist/` directory — will be regenerated on next build

### Step 2: Move the directory

Using File Explorer or command line:
```
move "C:\Users\great\Documents\bussiness\InBox LT" "C:\Users\great\Documents\bussiness\flexiron_enterprise"
```

Or using PowerShell:
```powershell
Move-Item "C:\Users\great\Documents\bussiness\InBox LT" "C:\Users\great\Documents\bussiness\flexiron_enterprise"
```

### Step 3: Update JetBrains `.idea/` config (optional, for IDE users)

After moving, open the project in JetBrains IDE from the new location. The IDE will:
- Detect the project at the new path
- Prompt to re-attach or create a new `.idea/` folder
- You can safely delete the old `.idea/InBox LT.iml` and `.idea/modules.xml` will auto-regenerate

Alternatively, manually update:
1. Rename [`.idea/InBox LT.iml`](.idea/InBox%20LT.iml) → `.idea/flexiron_enterprise.iml`
2. Update [`.idea/modules.xml`](.idea/modules.xml) to reference the new `.iml` filename

### Step 4: Update utility scripts (optional)

Update hardcoded paths in:
- [`xlx tables/rename_files.py`](xlx%20tables/rename_files.py) — change `InBox LT` to `flexiron_enterprise`
- [`xlx tables/deep_analyze.py`](xlx%20tables/deep_analyze.py) — change `InBox LT` to `flexiron_enterprise`

### Step 5: Rebuild (verify everything works)

```bash
cd frontend_vue
npm install   # optional — node_modules/ is relative, should work as-is
npm run typecheck
npm run lint
npm run build
npm run dev   # verify in browser
```

### Step 6: Update Git remote (if needed)

The Git remote is already set to `https://github.com/GreatGleb/flexiron-source.git` — this is a URL, not a local path, so it's **unaffected**.

### Step 7: Update document headers (cosmetic)

Optionally update "InBox LT" → "Flexiron Enterprise" in:
- [`ROO.md`](ROO.md) — line 1
- [`frontend_vue/CLAUDE.md`](frontend_vue/CLAUDE.md) — line 1
- Various `roo_code/` and `toDo/` markdown files

---

## What Will NOT Break

| Component | Why it's safe |
|-----------|---------------|
| **Vite config** | Uses relative paths (`./src`, `../demo`) — resolves from new location |
| **TypeScript paths** | Uses `@/*`, `@styles/*`, `@images/*` aliases — relative to `tsconfig.json` |
| **Vue Router** | All routes are relative paths |
| **i18n translations** | No path dependencies |
| **CSS imports** | Uses `@styles` alias — relative |
| **Service/mock imports** | All relative imports |
| **Git history** | `.git/` moves with the directory — all commits preserved |
| **node_modules/** | Installed with relative paths — works from any location |
| **Playwright tests** | `baseURL` is `http://localhost:5173` — no filesystem dependency |
| **GitHub Pages deploy** | Uses `base: '/Flexiron-Enterprise/demo/'` — no local path dependency |

---

## Summary

| Issue | Severity | Action Required |
|-------|----------|-----------------|
| `.idea/` stale paths | Low | Re-open project in IDE after move |
| Build artifacts (`demo/`, `dist/`) | Low | Delete before move, rebuild after |
| `xlx tables/*.py` hardcoded paths | Low | Update if you use these scripts |
| Document titles "InBox LT" | None | Cosmetic, update if desired |
| Email templates "InBox LT" | None | Business content, do not change |
| Git remote | None | Already uses GitHub URL |
| Vite/TS/ESLint configs | None | All relative paths |
