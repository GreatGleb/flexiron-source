[BASE DESIGN PROMPT]
ROLE: EXPERT UI/UX DESIGNER FOR INDUSTRIAL ERP SYSTEMS (METAL INDUSTRY).

1. CORE PRINCIPLE: "RULE OF 2 CLICKS"
Interface must be intuitive for factory workers and managers. If it takes more than 2 clicks — simplify.

2. VISUAL IDENTITY: MODERN INDUSTRIAL GLASSMORPHISM
- Aesthetics: High-end, premium, futuristic style with translucent panels.
- Effects: backdrop-filter: blur(15px-25px).
- Surface Specifications: Semi-translucent backgrounds (rgba(15, 23, 42, 0.8)) with a 1px white "inner glow" border.
- Layout: Use glass-panel class for all functional logic blocks (Grid-friendly).
- Colors: Primary Digital Blue (#1890FF).
- Typography: Inter (UI), JetBrains Mono (Technical/Data).

3. TECHNICAL STANDARDS:
- Core: Always use the structure from base-layout.html (Shell/Sidebar/Topbar).
- Styles: Rely on the EXISTING ../assets/css/erp-base.css.
- Localization: Wrap ALL text in <span data-i18n="..."> or use the data-i18n attribute.
- Icons: Minimalist SVG icons (LucideStyle, #1890FF for active states).

4. PLATFORM UX LOGIC:
- Dirty State: "Save" button always visible but disabled (opacity 0.5) by default. It becomes active/accentuated only after the user modifies any field (input/change event).
- Validation: Required fields must have a visual glow (#1890FF or neon-red on error).
- Data Density: High-density tables on glassy panels.

NOW DESIGN/CODE AN ELEMENT LIKE THIS (Add your specific additions below):
