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

## Live Site

The landing page and the demo app are one Vue build, deployed via GitHub Pages:

- **[Landing (Lithuanian)](https://greatgleb.github.io/Flexiron-Enterprise/lt/)** —
  also [`/en/`](https://greatgleb.github.io/Flexiron-Enterprise/en/); `/ru/` is link-only and `noindex`.
- **[Demo app](https://greatgleb.github.io/Flexiron-Enterprise/admin/analytics/dashboard)** — old
  `/Flexiron-Enterprise/demo/…` links redirect here.

### Deploying a build

`site/` is the build output (`outDir` in `vite.config.ts`, base `/Flexiron-Enterprise/`) and is
gitignored here — it is published from the separate repo `GreatGleb/Flexiron-Enterprise`, whose
Pages source is the repo root.

```bash
bash frontend_vue/scripts/publish-pages.sh --dry-run   # what would change in ../Flexiron-Enterprise
bash frontend_vue/scripts/publish-pages.sh             # build + copy; it prints the commit/push to run
```

The script runs `npm run build:site`: the Vite build, then `scripts/prerender-landing.mjs`, which
opens the built site in a browser and saves the finished markup of `/lt/`, `/en/`, `/ru/` and the
root (= the Lithuanian page, canonical `/lt/`) as real `index.html` files, plus `sitemap.xml`. It
checks its own output (language, canonical, `noindex` on ru, no hidden reveal state) and fails the
build otherwise. Without it a search engine would get a 404 and an empty page at `/lt/`.

GitHub Pages has no server-side routing: a refresh on an app path (`/admin/orders`) has no file
behind it and returns 404. The fix is the pair `public/404.html` (stores the requested path in
`sessionStorage`, redirects to the base) plus the inline script in `index.html` (restores the path
via `history.replaceState` before the router initialises, and clears the prerendered landing markup
so it does not flash). GitHub only guarantees `404.html` **at the root of the publishing source** —
which is where the build now puts it.

`.nojekyll` is equally load-bearing. GitHub Pages runs the tree through Jekyll by default, and
Jekyll drops "every file or directory beginning with `.`, `_`, `#` or `~`" — which silently ate the
CSS chunks Vite names after the `src/styles/**/_*.css` partials (7 of 35 in the 2026-08-31 build).
It now lives in `public/`, so every build carries it.

---
*Created by GreatGleb for the Flexiron ecosystem.*