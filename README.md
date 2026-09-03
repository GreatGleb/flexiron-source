# Flexiron Enterprise

![Vue.js](https://img.shields.io/badge/Vue.js_3-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Sass](https://img.shields.io/badge/Sass-CC6699?style=for-the-badge&logo=sass&logoColor=white)

**Flexiron Enterprise** — high-performance Business Management Platform (SaaS) for metal processing centers and industrial commerce.

This repository contains the frontend source code for the production application.

## Repository Structure

```
├── frontend_vue/   # Production frontend (Vue 3 + TypeScript + Vite)
└── toDo/           # Planning, specifications, and migration docs
```

### `frontend_vue/`
The production single-page application built with:
- **Vue 3** (Composition API, `<script setup>`)
- **Vue Router** — client-side routing
- **vue-i18n** — multi-language support (EN, RU, LT)
- **Vite** — build tooling
- **Sass** — styling
- **Feature Flags** — runtime toggles for gradual rollout (page-level + section-level)
- **Mock / Real API layer** — services swap between mock data and `/api/*` via env flag
- **ESLint + Prettier** — code quality and formatting
- **Playwright** — E2E testing

### `toDo/`
Internal planning documents: migration plans, task lists, process algorithms, and specs.

## Core Modules

The platform covers the full lifecycle of an ERP/CRM system:
1. **Products** — standard templates, categories, custom services
2. **Warehouse** — physical inventory, batch tracking, warehouse map
3. **Sales & CRM** — order processing (Kanban/List), client database, fleet logistics
4. **Supplying** — supplier database, automated BCC price requests
5. **Accounting** — incoming/outgoing payments, PDF document archive
6. **System Settings** — zero-code document editor, roles (ACL), configurations
7. **Analytics** — executive dashboards, sales stats, turnover analysis, P&L reports

## UI / UX Concept
The interface employs a responsive **"Industrial Glassmorphism"** aesthetic — frosted glass blurs, clean typography (Inter), and translucent layers over a dark indigo canvas. Premium, modern feel without sacrificing the extreme data density required by B2B enterprise software.

## Development

```bash
# Install dependencies
cd frontend_vue
npm install

# Start dev server
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Build for production
npm run build

# Run E2E tests
npm run test:e2e
```

## Live Demo

The Vue SPA build is deployed via GitHub Pages:

**[Open Flexiron Enterprise Demo](https://greatgleb.github.io/Flexiron-Enterprise/demo/)**

### Deploying a build

`demo/` is the build output (`outDir` in `vite.config.ts`) and is gitignored here — it is
published from the separate repo `GreatGleb/Flexiron-Enterprise`, whose Pages source is the
repo root. Hence the base path `/Flexiron-Enterprise/demo/`.

```bash
cd frontend_vue && npm run build
rsync -a --delete demo/ ../Flexiron-Enterprise/demo/    # from the source repo root
cp demo/404.html ../Flexiron-Enterprise/404.html        # see below — do not skip
cd ../Flexiron-Enterprise && git add -A && git commit -m "build: ..." && git push origin main
```

The `cp` is not optional. GitHub Pages has no server-side routing: a refresh on any path
deeper than the base (`/demo/admin/orders`) has no file behind it and returns 404. The fix is
the pair `public/404.html` (stores the requested path in `sessionStorage`, redirects to the
base) plus the inline script in `index.html` (restores the path via `history.replaceState`
before the router initialises). GitHub's docs only guarantee that `404.html` is honoured **at
the root of the publishing source**, and say nothing about subdirectories — so the copy at the
repo root is the one that actually works, while `demo/404.html` is just where the build puts it.

`.nojekyll` at that same root is equally load-bearing. GitHub Pages runs the tree through Jekyll
by default, and Jekyll drops "every file or directory beginning with `.`, `_`, `#` or `~`" — which
silently ate the CSS chunks Vite names after the `src/styles/**/_*.css` partials (7 of 35 in the
2026-08-31 build; which ones get their own chunk varies per build, so renaming them is not a fix).
Both files live outside `demo/`, so `rsync --delete` never touches them — but a fresh clone of the
demo repo must keep them.

---
*Created by GreatGleb for the Flexiron ecosystem.*