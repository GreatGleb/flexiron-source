/**
 * Английские тексты лендинга (`/en`, этап 2, пункт 4 — roo_code/plans/landing/landing-stage-2-plan.md).
 *
 * Перевод русского набора landing.ru.ts — смысл тот же, фактов и цифр сверх него нет. Форму
 * (ключи, длины списков, имена картинок) сверяет landing.content.spec.ts.
 */
import type { LandingContent, LandingImage } from '@/types/landing'
import dashboardJpg from '@/assets/images/landing/en/dashboard.jpg'
import batchesJpg from '@/assets/images/landing/en/batches.jpg'
import cuttingJpg from '@/assets/images/landing/en/cutting.jpg'
import orderLinesJpg from '@/assets/images/landing/en/order-lines.jpg'
import orderFinJpg from '@/assets/images/landing/en/order-fin.jpg'
import bccJpg from '@/assets/images/landing/en/bcc.jpg'
import plJpg from '@/assets/images/landing/en/pl.jpg'
import statusesJpg from '@/assets/images/landing/en/statuses.jpg'

const img = (src: string, alt: string, width: number, height: number): LandingImage => ({
  src,
  alt,
  width,
  height,
})

export const landingEn: LandingContent = {
  seo: {
    title: 'Flexiron — ERP/CRM for metal stockholders and service centres',
    description:
      'Stock, cutting, orders and money of a metal stockholder — in one system instead of a dozen Excel sheets',
  },

  header: {
    logoAlt: 'Flexiron',
    nav: [
      { label: 'Features', anchor: 'features' },
      { label: 'How it works', anchor: 'flow' },
      { label: 'What is ready', anchor: 'roadmap' },
      { label: 'Contact', anchor: 'lead' },
    ],
    login: { label: 'Log in', to: '/login' },
    cta: { label: 'Request a demo', anchor: 'lead' },
    menuLabel: 'Menu',
    langLabel: 'Language',
  },

  hero: {
    eyebrow: 'ERP/CRM for metal stockholders and service centres',
    title: 'Stock, cutting, orders and money of a metal stockholder — in one system',
    subtitle: 'instead of a dozen Excel sheets',
    ctaLead: { label: 'Book a walkthrough', anchor: 'lead' },
    ctaDemo: { label: 'Open the demo', to: '/admin' },
    image: img(dashboardJpg, 'Management dashboard', 2600, 1423),
    caption: 'From the working system, on demo data',
  },

  pains: {
    title: 'Where a metal stockholder loses money while the books live in Excel',
    items: [
      {
        icon: 'scissors',
        title: 'Offcuts drop out of the books',
        text: 'The rest of a sheet or tube after cutting is recorded nowhere. Nobody finds it when it is needed — and a new one gets cut.',
      },
      {
        icon: 'percent',
        title: 'Margin shows up too late',
        text: 'Order cost is put together by hand. The real profit becomes known at the end of the month, not at the sale.',
      },
      {
        icon: 'boxes-stacked',
        title: 'Stock disagrees with the shelf',
        text: 'Reservations, partial shipments and write-offs live in different files and never add up.',
      },
      {
        icon: 'envelopes-bulk',
        title: 'Purchasing — one email at a time',
        text: 'Supplier prices are requested one by one and compared in the inbox. The request history gets lost.',
      },
    ],
    note: 'Flexiron is designed from the working Excel sheets of an operating metal stockholder: metal stock, offcuts, invoices.',
  },

  flow: {
    title: 'One loop: from buying metal to the order being paid',
    steps: [
      { icon: 'envelopes-bulk', title: 'Suppliers', text: 'one price request to many' },
      { icon: 'warehouse', title: 'Stock', text: 'batches with their own cost' },
      { icon: 'scissors', title: 'Cutting', text: 'the offcut stays in stock', accent: true },
      { icon: 'cart-shopping', title: 'Order', text: 'goods, services, margin' },
      { icon: 'truck', title: 'Shipping', text: 'in full or in parts' },
      { icon: 'money-bill-wave', title: 'Payment', text: 'paid and still due' },
    ],
    note: {
      icon: 'chart-line',
      lead: 'Analytics sees the whole loop.',
      text: 'Profit and loss, receivables, stock shortages, reasons customers say no — without manual exports, because all the data is already in one system.',
    },
  },

  features: [
    {
      id: 'warehouse',
      title: 'Stock: every batch with its own cost',
      shotSide: 'left',
      image: img(batchesJpg, 'Stock batches table', 2600, 720),
      points: [
        {
          title: 'Receiving in batches',
          text: 'Supplier, date and purchase price stay with every batch.',
        },
        { title: 'Reserved for an order', text: 'What is reserved will not be sold twice.' },
        {
          title: 'FIFO cost',
          text: 'An order takes the oldest batches first — at their real purchase price.',
        },
        {
          title: 'Shortages',
          text: 'Items below minimum stock — and the purchasing status of each.',
        },
      ],
    },
    {
      id: 'cutting',
      title: 'Cutting: the rest after cutting is not lost',
      shotSide: 'right',
      dark: true,
      image: img(cuttingJpg, 'Material cutting screen', 2000, 1203),
      steps: [
        'Pick a batch: sheet, tube, profile',
        'Enter the pieces — length and quantity',
        'The system adds the kerf for every cut and shows what will be written off and what remains',
      ],
      note: 'The offcut becomes its own stock item linked to the source batch — it shows up in search and can be sold.',
    },
    {
      id: 'order',
      title: 'Order: goods and services, margin on every line',
      shotSide: 'left',
      image: img(orderLinesJpg, 'Order lines', 2000, 1000),
      points: [
        {
          icon: 'hammer',
          title: 'Services in the same order',
          text: 'Cutting, delivery, packing — each with its own cost.',
        },
        {
          icon: 'percent',
          title: 'Margin and discount per line',
          text: 'The manager sees what they will earn before anything ships.',
        },
        {
          icon: 'truck',
          title: 'Shipping in parts',
          text: '“Shipped 16 of 40” — the rest waits in reserve.',
        },
      ],
      note: 'When an item is added to an order, the system itself suggests matching offcuts from stock.',
    },
    {
      id: 'money',
      title: 'Order money is calculated, not typed in',
      shotSide: 'right',
      pointsAsCards: true,
      image: img(orderFinJpg, 'Order financial calculation', 1200, 1277),
      points: [
        {
          title: 'Cost',
          text: 'Built from the order lines and stock batches. Nobody edits it by hand.',
        },
        {
          title: 'Markup, discount, VAT',
          text: 'Set for the whole order, VAT by the chosen regime. The rate basis goes onto the invoice.',
        },
        {
          title: 'The total can be entered by hand',
          text: 'Agreed a round sum with the customer — the system spreads it across the lines itself.',
        },
        {
          title: 'Paid and still due',
          text: 'Payments are tied to the order, the customer’s debt is visible at once.',
        },
      ],
    },
    {
      id: 'suppliers',
      title: 'Purchasing: one price request to several suppliers',
      shotSide: 'left',
      image: img(bccJpg, 'Supplier price request screen', 2600, 1008),
      points: [
        {
          icon: 'envelopes-bulk',
          title: 'One email — to everyone',
          text: 'The system builds the email from a template and sends it to everyone in blind copy.',
        },
        {
          icon: 'clock-rotate-left',
          title: 'Request history',
          text: 'Who, when, what was requested and whether the supplier replied.',
        },
        {
          icon: 'users',
          title: 'Supplier base',
          text: 'Specialisation, rating, delivery times.',
        },
      ],
    },
    {
      id: 'analytics',
      title: 'Analytics: profit and problems visible without exports',
      shotSide: 'right',
      image: img(plJpg, 'Profit and loss report', 1560, 958),
      points: [
        {
          title: 'Management dashboard',
          text: 'Stock value, receivables, revenue, profit, shortages and risk notifications.',
        },
        {
          title: 'Profit and loss',
          text: 'From sales to operating profit — by line item, per month.',
        },
      ],
    },
  ],

  config: {
    id: 'config',
    title: 'Set up the way your company works',
    shotSide: 'left',
    image: img(statusesJpg, 'Order status settings', 2600, 1326),
    points: [
      {
        icon: 'list-check',
        title: 'Your own order statuses',
        text: 'Names, colours and order — to fit your process',
      },
      {
        icon: 'ruler-horizontal',
        title: 'Your own units',
        text: 'Kilograms, pieces, metres, m², m³ — and your own',
      },
      { icon: 'language', title: 'Two languages', text: 'Lithuanian and English' },
      { icon: 'clock-rotate-left', title: 'Activity log', text: 'Who changed what in the system' },
    ],
  },

  demo: {
    title: 'See for yourself',
    text: 'The whole system on demo data, no sign-up',
    cta: { label: 'Open the demo', to: '/admin' },
  },

  roadmap: {
    title: 'What is ready and what comes next',
    done: {
      title: 'Already in the system',
      items: [
        'Stock, batches, reservations and shortages',
        'Cutting with kerf and offcut tracking',
        'Orders with services, margin and shipments',
        'Suppliers and price requests',
        'Payments, document archive, analytics',
      ],
    },
    next: {
      title: 'In development',
      items: [
        'Printing invoices and CMR',
        'Stock labels with a QR code',
        'Link to cutting optimisation software',
      ],
    },
  },

  lead: {
    title: 'Want to see it live?',
    text: 'Leave a request — I will show you Flexiron in 30 minutes.',
    fields: {
      name: { label: 'Name' },
      company: { label: 'Company' },
      contact: { label: 'Phone or email' },
      message: {
        label: 'Comment',
        placeholder: 'How many warehouses and managers you have, what you keep in Excel now',
      },
    },
    submit: 'Send request',
    consent:
      'By pressing the button you agree to your contact details being used to reply to the request',
    success: 'Thank you! We will get back to you within one business day',
    error: 'Could not send. Write to us directly:',
    disabled: 'Write to us directly',
    errors: {
      required: 'Please fill in this field',
      invalidContact: 'Check the phone number or email',
      tooLong: 'The text is too long',
    },
    captcha: {
      required: 'Confirm you are not a robot — the request will go out right after the check',
      failed: 'The bot check did not load. Reload the page or write to us directly:',
    },
  },

  footer: {
    links: [
      { label: 'Support', to: '/support' },
      { label: 'About', to: '/about' },
      { label: 'Terms', to: '/terms' },
    ],
    copyright: '© Flexiron',
  },
}
