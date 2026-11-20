const path = require('path')
const pptxgen = require('pptxgenjs')
const React = require('react')
const ReactDOMServer = require('react-dom/server')
const sharp = require('sharp')
const fa = require('react-icons/fa6')
const { applyTheme } = require('/home/greatgleb/.claude/skills/synced/13598d83-d319-43a5-8490-4cd285762df2_84998f6c-11de-40a9-8dd3-0e6e0b4e6411/pptx/scripts/apply_theme.js')

const DIR = __dirname
const IMG = (n) => path.join(DIR, 'img', n)
const OUT = path.join(DIR, 'Flexiron-презентация.pptx')

const THEME = {
  name: 'Flexiron',
  headFontFace: 'Arial',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '141A2B', lt1: 'FFFFFF', dk2: '1B2340', lt2: 'EEF2F7',
    accent1: '2F80ED', accent2: 'F2994A', accent3: '27AE60', accent4: 'EB5757',
    accent5: '6B7489', accent6: '0F1424', hlink: '2F80ED', folHlink: '7B61FF',
  },
}
const HEX = THEME.colors

async function icon(name, hex, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(fa[name], { color: '#' + hex, size: String(size) }),
  )
  const buf = await sharp(Buffer.from(svg)).png().toBuffer()
  return 'image/png;base64,' + buf.toString('base64')
}

;(async () => {
  const pres = new pptxgen()
  pres.layout = 'LAYOUT_WIDE' // 13.333 x 7.5
  pres.title = 'Flexiron — презентация продукта'
  pres.author = 'Flexiron'
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace }
  const C = pres.SchemeColor

  // ---------- layouts ----------
  pres.defineSlideMaster({
    title: 'DARK_TITLE',
    background: { color: HEX.dk2 },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 2.6, w: 6.0, h: 1.4, fontSize: 54, bold: true, color: C.background1, valign: 'top', margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 4.05, w: 5.6, h: 1.8, fontSize: 20, color: 'C9D3E6', valign: 'top', margin: 0 }, text: '' } },
    ],
  })
  pres.defineSlideMaster({
    title: 'CONTENT',
    background: { color: HEX.lt1 },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.95, fontSize: 30, bold: true, color: C.text1, valign: 'middle', margin: 0 }, text: '' } },
      { text: { text: 'Flexiron', options: { x: 0.6, y: 7.0, w: 3, h: 0.3, fontSize: 10, color: HEX.accent5, margin: 0 } } },
    ],
    slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: HEX.accent5, align: 'right' },
  })
  pres.defineSlideMaster({
    title: 'DARK_CONTENT',
    background: { color: HEX.dk2 },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.95, fontSize: 30, bold: true, color: C.background1, valign: 'middle', margin: 0 }, text: '' } },
    ],
  })

  const shot = (slide, file, x, y, w, h, name) =>
    slide.addImage({
      path: IMG(file), x, y, w, h, objectName: name, altText: name,
      shadow: { type: 'outer', color: '000000', opacity: 0.28, blur: 14, offset: 4, angle: 90 },
    })

  const iconCircle = async (slide, name, x, y, d, bg, fg, objName) => {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { type: 'none' }, objectName: objName + ' фон' })
    const pad = d * 0.27
    slide.addImage({ data: await icon(name, fg), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, objectName: objName })
  }

  const T = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, valign: 'top', fontSize: 15, color: C.text1, ...o })

  // ---------- 1. Title ----------
  pres.addSection({ title: 'Начало' })
  let s = pres.addSlide({ masterName: 'DARK_TITLE', sectionTitle: 'Начало' })
  T(s, 'ERP/CRM ДЛЯ МЕТАЛЛОБАЗ И МЕТАЛЛОЦЕНТРОВ', { x: 0.6, y: 2.0, w: 6, h: 0.4, fontSize: 14, bold: true, color: C.accent2, charSpacing: 2 })
  s.addText('Flexiron', { placeholder: 'title' })
  s.addText('Склад, резка, заказы и деньги металлобазы — в одной системе вместо десятка таблиц Excel', { placeholder: 'body' })
  shot(s, 'landing.jpg', 6.75, 1.95, 6.0, 3.375, 'Стартовая страница Flexiron')
  T(s, 'Скриншоты в презентации — из работающей программы на демонстрационных данных', { x: 6.75, y: 5.5, w: 6.0, h: 0.4, fontSize: 11, italic: true, color: '9AA6C0' })

  // ---------- 2. Problem ----------
  pres.addSection({ title: 'Задача' })
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Задача' })
  s.addText('Где металлобаза теряет деньги, пока учёт живёт в Excel', { placeholder: 'title' })
  const pains = [
    ['FaScissors', 'Обрезки пропадают из учёта', 'Остаток листа или трубы после резки нигде не записан. Его не находят, когда он нужен, — и режут новый.'],
    ['FaPercent', 'Маржа видна слишком поздно', 'Себестоимость заказа собирают вручную. Реальная прибыль становится известна в конце месяца, а не при продаже.'],
    ['FaBoxesStacked', 'Остатки расходятся с полкой', 'Резерв под заказ, частичные отгрузки и списания ведутся в разных файлах и не сходятся между собой.'],
    ['FaEnvelopesBulk', 'Закупка — по одному письму', 'Цены у поставщиков запрашивают по очереди и сравнивают в почте. История запросов теряется.'],
  ]
  for (let i = 0; i < 4; i++) {
    const col = i % 2, row = Math.floor(i / 2)
    const x = 0.6 + col * 6.2, y = 1.65 + row * 2.3, w = 5.9, h = 2.0
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: C.background2 }, line: { type: 'none' }, objectName: `Карточка проблемы ${i + 1}` })
    await iconCircle(s, pains[i][0], x + 0.35, y + 0.35, 0.75, HEX.accent2, 'FFFFFF', `Иконка проблемы ${i + 1}`)
    T(s, pains[i][1], { x: x + 1.35, y: y + 0.33, w: w - 1.65, h: 0.45, fontSize: 19, bold: true, fontFace: THEME.headFontFace })
    T(s, pains[i][2], { x: x + 1.35, y: y + 0.85, w: w - 1.65, h: 1.0, fontSize: 15, color: C.text2 })
  }
  T(s, 'Flexiron спроектирован по рабочим Excel-таблицам действующей металлобазы: учёт металла, обрезки, счета.', { x: 0.6, y: 6.35, w: 12.1, h: 0.4, fontSize: 14, italic: true, color: C.accent5 })

  // ---------- 3. Overview flow ----------
  pres.addSection({ title: 'Продукт' })
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Продукт' })
  s.addText('Один контур: от закупки металла до оплаты заказа', { placeholder: 'title' })
  const steps = [
    ['FaEnvelopesBulk', 'Поставщики', 'запрос цен сразу нескольким'],
    ['FaWarehouse', 'Склад', 'партии со своей себестоимостью'],
    ['FaScissors', 'Резка', 'обрезок остаётся на складе'],
    ['FaCartShopping', 'Заказ', 'товары, услуги, маржа'],
    ['FaTruck', 'Отгрузка', 'полностью или частями'],
    ['FaMoneyBillWave', 'Оплата', 'оплачено и к доплате'],
  ]
  const sw = 1.75, gap = (12.1 - 6 * sw) / 5
  for (let i = 0; i < steps.length; i++) {
    const x = 0.6 + i * (sw + gap)
    await iconCircle(s, steps[i][0], x + (sw - 1.1) / 2, 2.0, 1.1, i === 2 ? HEX.accent2 : HEX.accent1, 'FFFFFF', `Шаг ${i + 1}`)
    T(s, steps[i][1], { x, y: 3.3, w: sw, h: 0.45, fontSize: 18, bold: true, align: 'center', fontFace: THEME.headFontFace })
    T(s, steps[i][2], { x, y: 3.8, w: sw, h: 0.8, fontSize: 14, color: C.text2, align: 'center' })
    if (i < steps.length - 1) {
      s.addShape(pres.shapes.RIGHT_ARROW, { x: x + sw - 0.05, y: 2.45, w: gap + 0.1, h: 0.2, fill: { color: 'C5CDDB' }, line: { type: 'none' }, objectName: `Стрелка ${i + 1}` })
    }
  }
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.0, w: 12.1, h: 1.35, rectRadius: 0.12, fill: { color: C.background2 }, line: { type: 'none' }, objectName: 'Плашка аналитики' })
  await iconCircle(s, 'FaChartLine', 0.95, 5.27, 0.8, HEX.dk2, 'FFFFFF', 'Иконка аналитики')
  T(s, [
    { text: 'Аналитика видит весь контур. ', options: { bold: true } },
    { text: 'Прибыли и убытки, задолженность, дефицит товара, причины отказов клиентов — без ручных выгрузок, потому что все данные уже в одной системе.' },
  ], { x: 2.05, y: 5.22, w: 10.4, h: 0.95, fontSize: 16, valign: 'middle' })

  // ---------- 4. Warehouse ----------
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Продукт' })
  s.addText('Склад: каждая партия со своей себестоимостью', { placeholder: 'title' })
  shot(s, 'batches.jpg', 0.6, 1.55, 12.1, 3.35, 'Таблица партий склада')
  const whPoints = [
    ['Приход партиями', 'Поставщик, дата и закупочная цена остаются при каждой партии.'],
    ['Резерв под заказ', 'Зарезервированное не продадут второй раз.'],
    ['FIFO-себестоимость', 'Заказ берёт сначала старые партии — по их реальной закупочной цене.'],
    ['Дефицит', 'Товары ниже минимального запаса — и статус закупки по каждому.'],
  ]
  const cw = (12.1 - 3 * 0.35) / 4
  whPoints.forEach(([h, d], i) => {
    const x = 0.6 + i * (cw + 0.35)
    T(s, h, { x, y: 5.25, w: cw, h: 0.4, fontSize: 17, bold: true, fontFace: THEME.headFontFace, color: C.accent1 })
    T(s, d, { x, y: 5.7, w: cw, h: 1.05, fontSize: 14, color: C.text2 })
  })

  // ---------- 5. Cutting (dark emphasis) ----------
  s = pres.addSlide({ masterName: 'DARK_CONTENT', sectionTitle: 'Продукт' })
  s.addText('Резка: остаток после резки не теряется', { placeholder: 'title' })
  shot(s, 'cutting.jpg', 5.3, 1.6, 7.4, 4.45, 'Экран резки материала')
  const cutSteps = [
    'Выбрать партию: лист, трубу, профиль',
    'Указать куски — длину и количество',
    'Система добавит ширину реза на каждый пропил и покажет, сколько спишется и что останется',
  ]
  cutSteps.forEach((t, i) => {
    const y = 1.65 + i * 1.2
    s.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.55, h: 0.55, fill: { color: HEX.accent2 }, line: { type: 'none' }, objectName: `Номер шага ${i + 1}` })
    T(s, String(i + 1), { x: 0.6, y, w: 0.55, h: 0.55, fontSize: 18, bold: true, align: 'center', valign: 'middle', color: 'FFFFFF' })
    T(s, t, { x: 1.4, y: y - 0.02, w: 3.6, h: 1.1, fontSize: 16, color: 'E3E8F2' })
  })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.35, w: 4.4, h: 1.3, rectRadius: 0.12, fill: { color: HEX.accent6 }, line: { type: 'none' }, objectName: 'Плашка про обрезок' })
  T(s, 'Обрезок становится отдельной позицией склада со ссылкой на исходную партию — его видно в поиске и можно продать.', { x: 0.85, y: 5.48, w: 3.95, h: 1.05, fontSize: 14, color: 'FFFFFF', valign: 'middle' })

  // ---------- 6. Order lines ----------
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Продукт' })
  s.addText('Заказ: товары и услуги, маржа по каждой строке', { placeholder: 'title' })
  shot(s, 'order-lines.jpg', 0.6, 1.6, 8.0, 4.0, 'Строки заказа')
  const ordPoints = [
    ['FaHammer', 'Услуги в том же заказе', 'Резка, доставка, упаковка — со своей себестоимостью.'],
    ['FaPercent', 'Маржа и скидка по строке', 'Менеджер видит, сколько заработает, ещё до отгрузки.'],
    ['FaTruck', 'Отгрузка частями', '«Отгружено 16 из 40» — остальное ждёт в резерве.'],
  ]
  for (let i = 0; i < ordPoints.length; i++) {
    const y = 1.6 + i * 1.55
    await iconCircle(s, ordPoints[i][0], 8.85, y, 0.6, HEX.accent1, 'FFFFFF', `Иконка заказа ${i + 1}`)
    T(s, ordPoints[i][1], { x: 9.65, y: y + 0.08, w: 3.05, h: 0.4, fontSize: 16, bold: true, fontFace: THEME.headFontFace })
    T(s, ordPoints[i][2], { x: 9.65, y: y + 0.52, w: 3.05, h: 0.85, fontSize: 14, color: C.text2 })
  }
  T(s, 'При добавлении товара в заказ система сама предлагает подходящие обрезки со склада.', { x: 0.6, y: 5.85, w: 8.0, h: 0.6, fontSize: 14, italic: true, color: C.accent5 })

  // ---------- 7. Order money ----------
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Продукт' })
  s.addText('Деньги заказа считаются, а не вводятся', { placeholder: 'title' })
  shot(s, 'order-fin.jpg', 0.6, 1.55, 4.95, 5.27, 'Финансовый расчёт заказа')
  const money = [
    ['Себестоимость', 'Складывается из строк заказа и складских партий. Руками её не правят.'],
    ['Наценка, скидка, НДС', 'Задаются на заказ целиком, НДС — по выбранному режиму. Основание ставки попадает в счёт.'],
    ['Итог можно ввести вручную', 'Договорились с клиентом на круглую сумму — система сама разнесёт её по позициям.'],
    ['Оплачено и к доплате', 'Платежи привязаны к заказу, долг клиента виден сразу.'],
  ]
  money.forEach(([h, d], i) => {
    const y = 1.6 + i * 1.3
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.0, y, w: 6.7, h: 1.12, rectRadius: 0.1, fill: { color: C.background2 }, line: { type: 'none' }, objectName: `Карточка денег ${i + 1}` })
    T(s, h, { x: 6.3, y: y + 0.14, w: 6.2, h: 0.38, fontSize: 17, bold: true, fontFace: THEME.headFontFace })
    T(s, d, { x: 6.3, y: y + 0.52, w: 6.2, h: 0.55, fontSize: 14, color: C.text2 })
  })

  // ---------- 8. Suppliers ----------
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Продукт' })
  s.addText('Закупка: запрос цен сразу нескольким поставщикам', { placeholder: 'title' })
  const supPoints = [
    ['FaEnvelopesBulk', 'Одно письмо — всем', 'Система собирает письмо по шаблону и отправляет всем скрытой копией.'],
    ['FaClockRotateLeft', 'История запросов', 'Кому, когда, что запрашивали и ответил ли поставщик.'],
    ['FaUsers', 'База поставщиков', 'Специализация, рейтинг, сроки поставки.'],
  ]
  for (let i = 0; i < supPoints.length; i++) {
    const y = 1.75 + i * 1.6
    await iconCircle(s, supPoints[i][0], 0.6, y, 0.6, HEX.accent1, 'FFFFFF', `Иконка закупки ${i + 1}`)
    T(s, supPoints[i][1], { x: 1.4, y: y + 0.08, w: 3.2, h: 0.4, fontSize: 16, bold: true, fontFace: THEME.headFontFace })
    T(s, supPoints[i][2], { x: 1.4, y: y + 0.52, w: 3.2, h: 0.95, fontSize: 14, color: C.text2 })
  }
  shot(s, 'bcc.jpg', 4.95, 2.0, 7.75, 3.0, 'Экран запроса цен поставщикам')

  // ---------- 9. Analytics ----------
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Продукт' })
  s.addText('Аналитика: прибыль и проблемы видны без выгрузок', { placeholder: 'title' })
  shot(s, 'dashboard.jpg', 0.6, 1.6, 6.21, 3.4, 'Панель управления')
  shot(s, 'pl.jpg', 7.16, 1.6, 5.54, 3.4, 'Отчёт о прибылях и убытках')
  T(s, [{ text: 'Панель руководителя. ', options: { bold: true, color: C.text1 } }, { text: 'Стоимость склада, дебиторская задолженность, выручка, прибыль, дефицит и уведомления о рисках.' }], { x: 0.6, y: 5.3, w: 6.21, h: 0.9, fontSize: 14, color: C.text2 })
  T(s, [{ text: 'Прибыли и убытки. ', options: { bold: true, color: C.text1 } }, { text: 'От продаж до операционной прибыли — по статьям, за месяц.' }], { x: 7.16, y: 5.3, w: 5.54, h: 0.9, fontSize: 14, color: C.text2 })

  // ---------- 10. Configurable ----------
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Продукт' })
  s.addText('Настраивается под то, как работает ваша компания', { placeholder: 'title' })
  shot(s, 'statuses.jpg', 0.6, 1.6, 7.3, 3.72, 'Настройка статусов заказа')
  const cfg = [
    ['FaListCheck', 'Свои статусы заказа', 'Названия, цвета и порядок — под ваш процесс'],
    ['FaRulerHorizontal', 'Свои единицы измерения', 'Килограммы, штуки, метры, м², м³ — и свои'],
    ['FaLanguage', 'Три языка', 'Русский, литовский, английский'],
    ['FaClockRotateLeft', 'Журнал действий', 'Кто и что изменил в системе'],
  ]
  for (let i = 0; i < cfg.length; i++) {
    const y = 1.6 + i * 1.13
    await iconCircle(s, cfg[i][0], 8.3, y, 0.6, HEX.accent1, 'FFFFFF', `Иконка настройки ${i + 1}`)
    T(s, cfg[i][1], { x: 9.1, y: y - 0.02, w: 3.6, h: 0.38, fontSize: 16, bold: true, fontFace: THEME.headFontFace })
    T(s, cfg[i][2], { x: 9.1, y: y + 0.37, w: 3.6, h: 0.5, fontSize: 14, color: C.text2 })
  }

  // ---------- 11. Now / next + CTA ----------
  pres.addSection({ title: 'Итог' })
  s = pres.addSlide({ masterName: 'DARK_CONTENT', sectionTitle: 'Итог' })
  s.addText('Что уже есть и что дальше', { placeholder: 'title' })
  const colCard = (x, head, items, accent, name) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 5.9, h: 3.0, rectRadius: 0.12, fill: { color: HEX.accent6 }, line: { type: 'none' }, objectName: name })
    T(s, head, { x: x + 0.35, y: 1.85, w: 5.2, h: 0.45, fontSize: 19, bold: true, color: accent, fontFace: THEME.headFontFace })
    T(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 8 } })), { x: x + 0.35, y: 2.45, w: 5.3, h: 2.0, fontSize: 16, color: 'E3E8F2' })
  }
  colCard(0.6, 'Уже в системе', [
    'Склад, партии, резерв и дефицит',
    'Резка с учётом пропила и учёт обрезков',
    'Заказы с услугами, маржой и отгрузками',
    'Поставщики и запросы цен',
    'Оплаты, архив документов, аналитика',
  ], HEX.accent3, 'Колонка «уже есть»')
  colCard(6.8, 'В разработке', [
    'Печать счетов и CMR',
    'Складские наклейки с QR-кодом',
    'Связь с программами оптимизации раскроя',
  ], HEX.accent2, 'Колонка «дальше»')
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 5.1, w: 12.1, h: 1.2, rectRadius: 0.12, fill: { color: HEX.accent1 }, line: { type: 'none' }, objectName: 'Призыв' })
  T(s, 'Интересно посмотреть вживую? Ответьте на это письмо — покажу Flexiron за 30\u00A0минут.', { x: 0.95, y: 5.1, w: 11.4, h: 1.2, fontSize: 20, bold: true, color: 'FFFFFF', valign: 'middle', fontFace: THEME.headFontFace })

  await pres.writeFile({ fileName: OUT })
  await applyTheme(OUT, THEME)
  console.log('written', OUT)
})().catch((e) => { console.error(e); process.exit(1) })
