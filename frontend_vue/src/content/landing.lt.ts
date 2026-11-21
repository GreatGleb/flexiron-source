/**
 * Литовские тексты лендинга — основной язык (`/lt`, корень `/` ведёт сюда; этап 2, пункт 4 —
 * roo_code/plans/landing/landing-stage-2-plan.md).
 *
 * Перевод русского набора landing.ru.ts — смысл тот же, фактов и цифр сверх него нет. Перевёл
 * агент, носитель не вычитывал (решение владельца). Форму (ключи, длины списков, имена картинок)
 * сверяет landing.content.spec.ts.
 */
import type { LandingContent, LandingImage } from '@/types/landing'
import dashboardJpg from '@/assets/images/landing/lt/dashboard.jpg'
import batchesJpg from '@/assets/images/landing/lt/batches.jpg'
import cuttingJpg from '@/assets/images/landing/lt/cutting.jpg'
import orderLinesJpg from '@/assets/images/landing/lt/order-lines.jpg'
import orderFinJpg from '@/assets/images/landing/lt/order-fin.jpg'
import bccJpg from '@/assets/images/landing/lt/bcc.jpg'
import plJpg from '@/assets/images/landing/lt/pl.jpg'
import statusesJpg from '@/assets/images/landing/lt/statuses.jpg'

const img = (src: string, alt: string, width: number, height: number): LandingImage => ({
  src,
  alt,
  width,
  height,
})

export const landingLt: LandingContent = {
  seo: {
    title: 'Flexiron — ERP/CRM metalo bazėms ir metalo centrams',
    description:
      'Metalo bazės sandėlis, pjaustymas, užsakymai ir pinigai — vienoje sistemoje vietoj dešimties Excel lentelių',
  },

  header: {
    logoAlt: 'Flexiron',
    nav: [
      { label: 'Galimybės', anchor: 'features' },
      { label: 'Kaip tai veikia', anchor: 'flow' },
      { label: 'Kas jau yra', anchor: 'roadmap' },
      { label: 'Užklausa', anchor: 'lead' },
    ],
    login: { label: 'Prisijungti', to: '/login' },
    cta: { label: 'Palikti užklausą', anchor: 'lead' },
    menuLabel: 'Meniu',
    langLabel: 'Kalba',
  },

  hero: {
    eyebrow: 'ERP/CRM metalo bazėms ir metalo centrams',
    title: 'Metalo bazės sandėlis, pjaustymas, užsakymai ir pinigai — vienoje sistemoje',
    subtitle: 'vietoj dešimties Excel lentelių',
    ctaLead: { label: 'Užsakyti pristatymą', anchor: 'lead' },
    ctaDemo: { label: 'Atidaryti demo', to: '/admin' },
    image: img(dashboardJpg, 'Valdymo skydelis', 2600, 1423),
    caption: 'Iš veikiančios programos, su demonstraciniais duomenimis',
  },

  pains: {
    title: 'Kur metalo bazė praranda pinigus, kol apskaita gyvena Excel',
    items: [
      {
        icon: 'scissors',
        title: 'Atraižos dingsta iš apskaitos',
        text: 'Lakšto ar vamzdžio likutis po pjaustymo niekur neužrašomas. Kai jo prireikia, jo neranda — ir pjauna naują.',
      },
      {
        icon: 'percent',
        title: 'Marža matoma per vėlai',
        text: 'Užsakymo savikaina skaičiuojama rankomis. Tikrasis pelnas paaiškėja mėnesio pabaigoje, o ne pardavimo metu.',
      },
      {
        icon: 'boxes-stacked',
        title: 'Likučiai nesutampa su lentyna',
        text: 'Rezervai užsakymams, dalinės išsiuntos ir nurašymai vedami skirtinguose failuose ir tarpusavyje nesutampa.',
      },
      {
        icon: 'envelopes-bulk',
        title: 'Pirkimai — po vieną laišką',
        text: 'Kainų tiekėjų klausiama paeiliui, o palyginama pašte. Užklausų istorija pasimeta.',
      },
    ],
    note: 'Flexiron sukurtas pagal veikiančios metalo bazės darbines Excel lenteles: metalo apskaitą, atraižas, sąskaitas.',
  },

  flow: {
    title: 'Vienas ciklas: nuo metalo pirkimo iki užsakymo apmokėjimo',
    steps: [
      { icon: 'envelopes-bulk', title: 'Tiekėjai', text: 'kainų užklausa iš karto keliems' },
      { icon: 'warehouse', title: 'Sandėlis', text: 'partijos su savo savikaina' },
      { icon: 'scissors', title: 'Pjaustymas', text: 'atraiža lieka sandėlyje', accent: true },
      { icon: 'cart-shopping', title: 'Užsakymas', text: 'prekės, paslaugos, marža' },
      { icon: 'truck', title: 'Išsiuntimas', text: 'visas arba dalimis' },
      { icon: 'money-bill-wave', title: 'Apmokėjimas', text: 'apmokėta ir liko sumokėti' },
    ],
    note: {
      icon: 'chart-line',
      lead: 'Analitika mato visą ciklą.',
      text: 'Pelnas ir nuostoliai, skolos, prekių trūkumas, klientų atsisakymų priežastys — be rankinių eksportų, nes visi duomenys jau vienoje sistemoje.',
    },
  },

  features: [
    {
      id: 'warehouse',
      title: 'Sandėlis: kiekviena partija su savo savikaina',
      shotSide: 'left',
      image: img(batchesJpg, 'Sandėlio partijų lentelė', 2600, 720),
      points: [
        {
          title: 'Pajamavimas partijomis',
          text: 'Tiekėjas, data ir pirkimo kaina išlieka prie kiekvienos partijos.',
        },
        { title: 'Rezervas užsakymui', text: 'Rezervuoto antrą kartą neparduos.' },
        {
          title: 'FIFO savikaina',
          text: 'Užsakymas pirmiausia ima senesnes partijas — pagal jų tikrą pirkimo kainą.',
        },
        {
          title: 'Trūkumas',
          text: 'Prekės žemiau minimalaus atsargų kiekio — ir kiekvienos pirkimo būsena.',
        },
      ],
    },
    {
      id: 'cutting',
      title: 'Pjaustymas: likutis po pjaustymo nepasimeta',
      shotSide: 'right',
      dark: true,
      image: img(cuttingJpg, 'Medžiagos pjaustymo ekranas', 2000, 1203),
      steps: [
        'Pasirinkti partiją: lakštą, vamzdį, profilį',
        'Nurodyti gabalus — ilgį ir kiekį',
        'Sistema prie kiekvieno pjūvio pridės pjūvio plotį ir parodys, kiek bus nurašyta ir kas liks',
      ],
      note: 'Atraiža tampa atskira sandėlio pozicija su nuoroda į pradinę partiją — ji matoma paieškoje ir ją galima parduoti.',
    },
    {
      id: 'order',
      title: 'Užsakymas: prekės ir paslaugos, marža kiekvienoje eilutėje',
      shotSide: 'left',
      image: img(orderLinesJpg, 'Užsakymo eilutės', 2000, 1000),
      points: [
        {
          icon: 'hammer',
          title: 'Paslaugos tame pačiame užsakyme',
          text: 'Pjaustymas, pristatymas, pakavimas — su savo savikaina.',
        },
        {
          icon: 'percent',
          title: 'Marža ir nuolaida eilutei',
          text: 'Vadybininkas mato, kiek uždirbs, dar prieš išsiuntimą.',
        },
        {
          icon: 'truck',
          title: 'Išsiuntimas dalimis',
          text: '„Išsiųsta 16 iš 40“ — likusi dalis laukia rezerve.',
        },
      ],
      note: 'Pridedant prekę į užsakymą, sistema pati pasiūlo tinkamas atraižas iš sandėlio.',
    },
    {
      id: 'money',
      title: 'Užsakymo pinigai skaičiuojami, o ne įvedami',
      shotSide: 'right',
      pointsAsCards: true,
      image: img(orderFinJpg, 'Užsakymo finansinis skaičiavimas', 1200, 1277),
      points: [
        {
          title: 'Savikaina',
          text: 'Susideda iš užsakymo eilučių ir sandėlio partijų. Rankomis jos netaiso.',
        },
        {
          title: 'Antkainis, nuolaida, PVM',
          text: 'Nustatomi visam užsakymui, PVM — pagal pasirinktą režimą. Tarifo pagrindas patenka į sąskaitą.',
        },
        {
          title: 'Galutinę sumą galima įvesti rankomis',
          text: 'Susitarėte su klientu dėl apvalios sumos — sistema pati paskirstys ją pozicijoms.',
        },
        {
          title: 'Apmokėta ir liko sumokėti',
          text: 'Mokėjimai susieti su užsakymu, kliento skola matoma iš karto.',
        },
      ],
    },
    {
      id: 'suppliers',
      title: 'Pirkimai: kainų užklausa iš karto keliems tiekėjams',
      shotSide: 'left',
      image: img(bccJpg, 'Kainų užklausos tiekėjams ekranas', 2600, 1008),
      points: [
        {
          icon: 'envelopes-bulk',
          title: 'Vienas laiškas — visiems',
          text: 'Sistema surenka laišką pagal šabloną ir išsiunčia visiems slapta kopija.',
        },
        {
          icon: 'clock-rotate-left',
          title: 'Užklausų istorija',
          text: 'Kam, kada, ko klausta ir ar tiekėjas atsakė.',
        },
        {
          icon: 'users',
          title: 'Tiekėjų bazė',
          text: 'Specializacija, reitingas, pristatymo terminai.',
        },
      ],
    },
    {
      id: 'analytics',
      title: 'Analitika: pelnas ir problemos matomi be eksportų',
      shotSide: 'right',
      image: img(plJpg, 'Pelno ir nuostolių ataskaita', 1560, 958),
      points: [
        {
          title: 'Vadovo skydelis',
          text: 'Sandėlio vertė, debitorinė skola, pajamos, pelnas, trūkumas ir pranešimai apie rizikas.',
        },
        {
          title: 'Pelnas ir nuostoliai',
          text: 'Nuo pardavimų iki veiklos pelno — pagal straipsnius, už mėnesį.',
        },
      ],
    },
  ],

  config: {
    id: 'config',
    title: 'Pritaikoma prie to, kaip dirba jūsų įmonė',
    shotSide: 'left',
    image: img(statusesJpg, 'Užsakymo būsenų nustatymai', 2600, 1326),
    points: [
      {
        icon: 'list-check',
        title: 'Savos užsakymo būsenos',
        text: 'Pavadinimai, spalvos ir tvarka — pagal jūsų procesą',
      },
      {
        icon: 'ruler-horizontal',
        title: 'Savi matavimo vienetai',
        text: 'Kilogramai, vienetai, metrai, m², m³ — ir savi',
      },
      { icon: 'language', title: 'Dvi kalbos', text: 'Lietuvių ir anglų' },
      { icon: 'clock-rotate-left', title: 'Veiksmų žurnalas', text: 'Kas ir ką pakeitė sistemoje' },
    ],
  },

  demo: {
    title: 'Pažiūrėkite patys',
    text: 'Visa programa su demonstraciniais duomenimis, be registracijos',
    cta: { label: 'Atidaryti demo', to: '/admin' },
  },

  roadmap: {
    title: 'Kas jau yra ir kas toliau',
    done: {
      title: 'Jau sistemoje',
      items: [
        'Sandėlis, partijos, rezervas ir trūkumas',
        'Pjaustymas su pjūvio pločiu ir atraižų apskaita',
        'Užsakymai su paslaugomis, marža ir išsiuntimais',
        'Tiekėjai ir kainų užklausos',
        'Mokėjimai, dokumentų archyvas, analitika',
      ],
    },
    next: {
      title: 'Kuriama',
      items: [
        'Sąskaitų ir CMR spausdinimas',
        'Sandėlio lipdukai su QR kodu',
        'Ryšys su pjaustymo optimizavimo programomis',
      ],
    },
  },

  lead: {
    title: 'Norite pamatyti gyvai?',
    text: 'Palikite užklausą — parodysiu Flexiron per 30 minučių.',
    fields: {
      name: { label: 'Vardas' },
      company: { label: 'Įmonė' },
      contact: { label: 'Telefonas arba el. paštas' },
      message: {
        label: 'Komentaras',
        placeholder: 'Kiek turite sandėlių, kiek vadybininkų, ką dabar vedate Excel',
      },
    },
    submit: 'Siųsti užklausą',
    consent:
      'Spausdami mygtuką sutinkate, kad jūsų kontaktiniai duomenys būtų naudojami atsakyti į užklausą',
    success: 'Ačiū! Susisieksime per vieną darbo dieną',
    error: 'Nepavyko išsiųsti. Parašykite mums tiesiogiai:',
    disabled: 'Parašykite mums tiesiogiai',
    errors: {
      required: 'Užpildykite šį lauką',
      invalidContact: 'Patikrinkite telefoną arba el. paštą',
      tooLong: 'Tekstas per ilgas',
    },
    captcha: {
      required: 'Patvirtinkite, kad nesate robotas, — užklausa bus išsiųsta iš karto po patikros',
      failed: 'Apsauga nuo robotų neįsikėlė. Perkraukite puslapį arba parašykite mums tiesiogiai:',
    },
  },

  footer: {
    links: [
      { label: 'Pagalba', to: '/support' },
      { label: 'Apie produktą', to: '/about' },
      { label: 'Sąlygos', to: '/terms' },
    ],
    copyright: '© Flexiron',
  },
}
