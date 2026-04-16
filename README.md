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

## Live Demo (Prototype)

The original HTML prototype is deployed via GitHub Pages:

**[Open Flexiron Enterprise Demo](https://greatgleb.github.io/Flexiron-Enterprise/demo/public/)**

---
*Created by GreatGleb for the Flexiron ecosystem.*
