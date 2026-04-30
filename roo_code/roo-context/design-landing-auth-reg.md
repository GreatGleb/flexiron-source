# Design Context: Landing, Auth & Registration Pages

> Consolidated design reference for Flexiron public-facing pages.
> Sources: [`toDo/design/screen_specs/00.0_Landing.md`](toDo/design/screen_specs/00.0_Landing.md), [`00.1_Auth.md`](toDo/design/screen_specs/00.1_Auth.md), [`00.2_Registration.md`](toDo/design/screen_specs/00.2_Registration.md)

---

## 00.0 Landing Page

### Visual Concept
- **Style:** Modern Glassmorphism on industrial backdrop
- **Background:** Full-screen high-quality industrial photo (metal processing/laser cutting) with `backdrop-filter: blur(25px)` + dark gradient overlay
- **Hero Card:** Semi-transparent panel (`rgba(255, 255, 255, 0.1)`) with matte glass effect, 1px inner glow border, soft deep shadow

### Content
| Element | Details |
|---------|---------|
| Logo | [`Flexiron_Logo_White.svg`](frontend_vue/src/assets/images/Flexiron_Logo_White.svg) — Inter Bold, increased letter-spacing |
| Title | "Экосистема управления металлоцентром" — Inter Semibold 32px |
| Subtitle | "Прозрачный учет, умный склад и автоматизация обрезков в один клик. ERP-система нового поколения для производства и торговли металлом." — Inter Regular 16px, line-height 1.5 |
| CTA Buttons | "Регистрация" (Solid Blue Glass gradient `#1890FF`) + "Демо-версия" (Outline Glass, transparent with white border) |
| Footer | "Поддержка", "О продукте", "Условия использования", "Карта экранов" — 12px links |

### Interactions
- **Hover:** Soft brightness increase / blur density change on buttons
- **Click:** Smooth form transition (card transforms into login/register form without disappearing)

### Implementation Status
- **Component:** [`LandingPage.vue`](frontend_vue/src/views/public/LandingPage.vue) — ✅ Implemented
- **CSS:** [`public.css`](frontend_vue/src/styles/public/public.css) — ✅ Shared styles (glass card, buttons, footer, responsive)
- **i18n:** [`public.js`](frontend_vue/src/i18n/public.js) — ✅ RU/EN/LT translations for `landing.*` keys

---

## 00.1 Authorization (Login)

### Visual Concept
- **Type:** Pop-up modal window appearing over the Landing page
- **Container:** Rounded glass card with strong background blur

### Form Fields
| Field | Details |
|-------|---------|
| Login | Single field supporting 3 formats (Nickname / Email / Phone) — placeholder: "Никнейм, Email или Телефон" |
| Password | Field with eye icon for visibility toggle + "Забыли пароль?" link below |

### Controls
- **Button "Войти":** Primary action (Blue Glass style)
- **Checkbox "Запомнить меня":** Session persistence
- **Navigation:** "Нет аккаунта? Зарегистрироваться" link at form bottom

### Validation
- Red neon highlight on invalid input
- Tooltip with hint: "Пользователь не найден" or "Неверный пароль"

### Implementation Status
- **Component:** [`LoginPage.vue`](frontend_vue/src/views/public/LoginPage.vue) — ✅ Implemented (basic form, eye toggle, remember checkbox, forgot link)
- **CSS:** [`login.css`](frontend_vue/src/styles/public/login.css) — ✅ Auth form styles, checkbox, forgot link
- **i18n:** [`public.js`](frontend_vue/src/i18n/public.js) — ✅ RU/EN/LT translations for `login.*` keys
- **TODO:** Auth logic (`onSubmit` is a stub), validation UI (red neon + tooltips)

---

## 00.2 Registration

### Process Structure

#### Step 1: Quick Registration (Pop-up)
- **Type:** Modal window over Landing
- **Fields:** Full Name / Nickname, E-mail, Phone, Password
- **Goal:** Instantly capture contact data

#### Step 2: Company Details (Full Screen Form)
- **Type:** Separate page (no app header/menu)
- **Fields:** Company Name, Company Code / VAT, Country / City

### Trial Logic
- Notice at form top: "После регистрации вам будет доступен пробный ограниченный функционал на **14 дней бесплатно**"
- Final CTA: "Создать компанию и начать"

### Paywall Preview
- Lock icon (padlock) for locked features
- Grayscale style for locked menu items/buttons
- Click triggers popup: "Данная функция доступна в тарифе [Premium]. [Подключить подписку]"

### Post-Registration
- Auto login + redirect to Director Dashboard after successful account creation

### Implementation Status
- **Component:** [`RegisterPage.vue`](frontend_vue/src/views/public/RegisterPage.vue) — ✅ Implemented (combined Step 1 + Step 2 on one page)
- **CSS:** [`register.css`](frontend_vue/src/styles/public/register.css) — ✅ Form grid, trial banner, section titles
- **i18n:** [`public.js`](frontend_vue/src/i18n/public.js) — ✅ RU/EN/LT translations for `reg.*` keys
- **TODO:** Registration logic (`onSubmit` is a stub), Step 1→Step 2 separation (currently combined), paywall lock UI

---

## Shared Design System

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page Title (h1) | Inter | 3rem (desktop) → 1.75rem (mobile) | 700 |
| Subtitle | Inter | 1.125rem → 0.9rem | 400 |
| Body/Inputs | Inter | 0.95rem | 400 |
| Footer links | Inter | 0.875rem | 400 |
| Labels | Inter | 0.875rem | 500 |

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#1890ff` | Buttons, links, focus rings |
| `--primary-dark` | `#005bb5` | Button gradient end |
| `--card-bg` | `rgba(255, 255, 255, 0.08)` | Glass card background |
| `--card-border` | `rgba(255, 255, 255, 0.15)` | Glass card border |
| `--text-main` | `#ffffff` | Primary text |
| `--text-secondary` | `rgba(255, 255, 255, 0.7)` | Secondary/subtitle text |

### Glassmorphism Card
```css
.hero-card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 4rem;
  max-width: 800px;
  width: 100%;
  text-align: center;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05),
              0 25px 50px -12px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  animation: fadeUp 0.8s ease-out forwards;
}
```

### Buttons
- **Primary:** `linear-gradient(135deg, #1890ff, #005bb5)` — blue glass with glow shadow
- **Secondary:** `rgba(255, 255, 255, 0.05)` with white border — outline glass style
- **Hover:** translateY(-2px), increased shadow/glow
- **Active:** translateY(0), inset shadow

### Responsive Breakpoints
| Breakpoint | Adjustments |
|------------|-------------|
| ≤1024px (tablet) | Card padding: 3rem 2rem, h1: 2.5rem |
| ≤768px (mobile L) | Card padding: 2.5rem 1.25rem, h1: 2rem, stacked layout |
| ≤480px (mobile S) | Card padding: 1.5rem 1rem, h1: 1.75rem, CTA full-width column |
| ≤400px (XS) | Lang switcher scaled down |

### Animations
- **Page load:** `fadeUp` — fade-in + translateY(20px→0) over 0.8s
- **Button hover:** Radial gradient overlay opacity transition
- **Footer link hover:** Underline slide-in effect

---

## File Map

| File | Purpose |
|------|---------|
| [`LandingPage.vue`](frontend_vue/src/views/public/LandingPage.vue) | Landing page component |
| [`LoginPage.vue`](frontend_vue/src/views/public/LoginPage.vue) | Login form component |
| [`RegisterPage.vue`](frontend_vue/src/views/public/RegisterPage.vue) | Registration form component |
| [`public.css`](frontend_vue/src/styles/public/public.css) | Shared public page styles (glass card, buttons, footer, forms) |
| [`login.css`](frontend_vue/src/styles/public/login.css) | Login-specific styles (auth form, checkbox, forgot link) |
| [`register.css`](frontend_vue/src/styles/public/register.css) | Registration-specific styles (form grid, trial banner) |
| [`public.js`](frontend_vue/src/i18n/public.js) | i18n translations (RU/EN/LT) for all public pages |
| [`erp-base.css`](frontend_vue/src/styles/erp-base.css) | Base styles (background image, overlay, CSS variables) |
| [`App.vue`](frontend_vue/src/App.vue) | Root layout (bg-image, bg-overlay, LangSwitcher, RouterView) |
| [`router/index.ts`](frontend_vue/src/router/index.ts) | Route definitions for `/`, `/login`, `/register` |
