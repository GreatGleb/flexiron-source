# PROMPT: GENERATE 04.1 SUPPLIER CARD

> [BASE DESIGN PROMPT] +
> 
> DESIGN AND CODE A NEW PAGE: `supplier_card.html`
> 
> ## 1. PAGE ARCHITECTURE
> - **Main Structure**: Use the fixed left sidebar and top-bar from `base-layout.html`.
> - **Content Layout (3 Columns)**:
>     - **Left Column (25%)**: Status Badge, Basic Info (Company Name, VAT, Addresses), Main Contact.
>     - **Center Column (50%)**: 
>         - Procurement Settings (BCC-Email Tags, Specialization Badges).
>         - Logistics Info (Lead Time, Min Order, Payment Terms).
>         - **Zero-Code Section**: Dynamic fields grid (2 columns) with placeholders for "Contract Date" and "Internal Rating".
>     - **Right Column (25%)**: 
>         - Stock History Feed (Small interactive table).
>         - Attachment Zone (Drag-and-drop UI for documents).
> 
> ## 2. CORE INTERACTION: DIRTY STATE LOGIC
> - **Action Bar**: Place "Save" and "Cancel" buttons at the top right of the main content area.
> - **Logic**: Implement a JavaScript listener that tracks any `input` or `change` events.
>     - Before any change: "Save" button is `disabled` (opacity 0.4).
>     - After any change: "Save" button becomes active (Primary Blue glow).
> - **Verification**: Field `Pirkėjas` (Company Name) is mandatory. The button remains disabled if this field is cleared.
> 
> ## 3. COMPONENT DETAILS
> - **BCC-Email Tags**: Use an input field where pressing 'Enter' or ',' converts the text into a removable tag (badge with an 'x').
> - **Glass Panels**: Wrap each major section in a `<div class="glass-panel">` with a `backdrop-filter: blur(20px)`.
> - **Localization**: Tag every label and placeholder with `data-i18n` IDs (e.g., `data-i18n="supplier.name"`).
> 
> ## 4. MOBILE TRANSFORMATION
> - On screens < 992px, reorder the stack: **Center (Action) -> Left (Details) -> Right (History/Files)**.
> 
> ## 5. ASSET REFERENCES
> - Use: `../assets/css/erp-base.css`
> - Logo: `../assets/images/Flexiron_Logo_White.svg`
