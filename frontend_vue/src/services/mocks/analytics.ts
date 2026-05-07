import type {
  DashboardData,
  KpiItem,
  ChartBarItem,
  AlertItem,
  AnalyticsSectionPreview,
  DeadstockItem,
  TurnoverItem,
  TopClientItem,
  RefusalReasonItem,
  SupplierItem,
  SupplyCategoryItem,
  ManagerItem,
  WorkerItem,
  RevenueItem,
  RouteItem,
  LoadItem,
  PlRowItem,
  CalendarEvent,
  DeficitItem,
  RefusalVolumeItem,
} from '@/types/analytics'
import type { TranslatedString } from '@/types/i18n'

// ─── Dashboard ───────────────────────────────────────────────────────────────

const kpiDashboard: KpiItem[] = [
  { key: 'revenue', value: '127 400', delta: '+7%', trend: 'up', icon: 'chart-bar', iconColor: 'blue' },
  { key: 'procurement', value: '38 750', delta: '-3%', trend: 'down', icon: 'receipt', iconColor: 'red' },
  { key: 'margin', value: '84 200', delta: '+12%', trend: 'up', icon: 'trending-up', iconColor: 'green' },
  { key: 'profit', value: '14 870', delta: '0%', trend: 'neutral', icon: 'currency', iconColor: 'gold' },
  { key: 'deficit', value: '8', delta: '+2', trend: 'down', icon: 'alert', iconColor: 'red' },
]

const salesByCategory: ChartBarItem[] = [
  { label: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' }, value: 32400, percentage: 78 },
  { label: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' }, value: 22800, percentage: 55 },
  { label: { ru: 'Профиль', en: 'Profile', lt: 'Profilis' }, value: 15900, percentage: 38 },
  { label: { ru: 'Прутки', en: 'Rods', lt: 'Strypai' }, value: 8200, percentage: 20 },
  { label: { ru: 'Лом', en: 'Scraps', lt: 'Laužas' }, value: 4900, percentage: 12 },
]

const alerts: AlertItem[] = [
  {
    type: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
    description: {
      ru: 'Запас листа 2 мм критически мал',
      en: 'Sheet 2mm stock critically low',
      lt: '2 mm lakšto atsargos kritiškai mažos',
    },
    status: 'critical',
  },
  {
    type: { ru: 'Поставка', en: 'Delivery', lt: 'Pristatymas' },
    description: {
      ru: 'Поставка NordMetal просрочена на 3 дня',
      en: 'NordMetal delivery 3 days overdue',
      lt: 'NordMetal pristatymas vėluoja 3 dienas',
    },
    status: 'overdue',
  },
  {
    type: { ru: 'Поставщик', en: 'Supplier', lt: 'Tiekėjas' },
    description: {
      ru: 'Рейтинг UralSteel JSC упал до 2★',
      en: 'UralSteel JSC rating dropped to 2★',
      lt: 'UralSteel JSC reitingas nukrito iki 2★',
    },
    status: 'risk',
  },
  {
    type: { ru: 'BCC', en: 'BCC', lt: 'BCC' },
    description: {
      ru: 'Запрос цен ожидает ответа от 2 поставщиков',
      en: 'Price request pending from 2 suppliers',
      lt: 'Kainos užklausa laukia atsakymo iš 2 tiekėjų',
    },
    status: 'pending',
  },
]

const sectionPreviews: AnalyticsSectionPreview[] = [
  {
    key: 'warehouse',
    title: { ru: 'Склад', en: 'Warehouse', lt: 'Sandėlis' },
    metrics: [
      { label: { ru: 'Общий запас', en: 'Total stock', lt: 'Bendras sandėlis' }, value: '1 240 t', status: 'ok' },
      { label: { ru: 'Позиции с низким запасом', en: 'Low stock items', lt: 'Mažos atsargos' }, value: '3', status: 'bad' },
    ],
  },
  {
    key: 'sales',
    title: { ru: 'Продажи', en: 'Sales', lt: 'Pardavimai' },
    metrics: [
      { label: { ru: 'Этот месяц', en: 'This month', lt: 'Šis mėnuo' }, value: '€248 000', status: 'ok' },
      { label: { ru: 'К прошлому месяцу', en: 'vs last month', lt: 'Palyginti su praėjusiu mėn.' }, value: '+12%', status: 'ok' },
    ],
  },
  {
    key: 'supply',
    title: { ru: 'Закупки', en: 'Supply', lt: 'Pirkimai' },
    metrics: [
      { label: { ru: 'Открытые заказы', en: 'Open orders', lt: 'Atviri užsakymai' }, value: '18', status: 'ok' },
      { label: { ru: 'Просрочено', en: 'Overdue', lt: 'Vėluoja' }, value: '2', status: 'bad' },
    ],
  },
  {
    key: 'staff',
    title: { ru: 'Сотрудники', en: 'Staff', lt: 'Darbuotojai' },
    metrics: [
      { label: { ru: 'Сотрудников', en: 'Employees', lt: 'Darbuotojų' }, value: '24', status: 'ok' },
      { label: { ru: 'В отпуске', en: 'On leave', lt: 'Atostogauja' }, value: '2', status: 'warn' },
    ],
  },
]

const dashboardData: DashboardData = {
  kpis: kpiDashboard,
  salesByCategory,
  alerts,
  sectionPreviews,
}

// ─── Warehouse ───────────────────────────────────────────────────────────────

const warehouseDeadstock: DeadstockItem[] = [
  {
    name: { ru: 'Лист 2×1000×2000', en: 'Sheet 2×1000×2000', lt: 'Lakštas 2×1000×2000' },
    zone: 'A2', sum: 4200,
    age: { ru: '7 мес.', en: '7 mos.', lt: '7 mėn.' },
    ageStatus: 'danger',
  },
  {
    name: { ru: 'Пруток 20 L3000', en: 'Rod 20 L3000', lt: 'Strypas 20 L3000' },
    zone: 'B4', sum: 1850,
    age: { ru: '9 мес.', en: '9 mos.', lt: '9 mėn.' },
    ageStatus: 'danger',
  },
  {
    name: { ru: 'Уголок 50×50×4', en: 'Angle 50×50×4', lt: 'Kampainis 50×50×4' },
    zone: 'A5', sum: 3100,
    age: { ru: '6 мес.', en: '6 mos.', lt: '6 mėn.' },
    ageStatus: 'warning',
  },
  {
    name: { ru: 'Нержавейка 1 мм', en: 'Stainless 1mm', lt: 'Nerūdijantis 1 mm' },
    zone: 'C1', sum: 2640,
    age: { ru: '6 мес.', en: '6 mos.', lt: '6 mėn.' },
    ageStatus: 'warning',
  },
  {
    name: { ru: 'Труба 40×4', en: 'Pipe 40×4', lt: 'Vamzdis 40×4' },
    zone: 'B2', sum: 780,
    age: { ru: '6+ мес.', en: '6+ mos.', lt: '6+ mėn.' },
    ageStatus: 'success',
  },
]

const warehouseTurnover: TurnoverItem[] = [
  {
    label: { ru: 'Трубы', en: 'Pipes', lt: 'Vamzdžiai' },
    percentage: 85,
    value: { ru: '22 дня', en: '22 days', lt: '22 d.' },
    color: 'green',
  },
  {
    label: { ru: 'Листы', en: 'Sheets', lt: 'Lakštai' },
    percentage: 65,
    value: { ru: '31 день', en: '31 day', lt: '31 d.' },
    color: 'blue',
  },
  {
    label: { ru: 'Профиль', en: 'Profile', lt: 'Profilis' },
    percentage: 50,
    value: { ru: '38 дней', en: '38 days', lt: '38 d.' },
    color: 'blue',
  },
  {
    label: { ru: 'Прутки', en: 'Rods', lt: 'Strypai' },
    percentage: 35,
    value: { ru: '54 дня', en: '54 days', lt: '54 d.' },
    color: 'yellow',
  },
  {
    label: { ru: 'Нержавейка', en: 'Stainless', lt: 'Nerūdijantis' },
    percentage: 20,
    value: { ru: '78 дней', en: '78 days', lt: '78 d.' },
    color: 'red',
  },
]

const warehouseKpis: KpiItem[] = [
  { key: 'kpi1', value: '127 400', delta: '+7%', trend: 'up', icon: 'chart-bar', iconColor: 'blue' },
  { key: 'kpi2', value: '12', delta: '-2', trend: 'down', icon: 'alert', iconColor: 'red' },
  { key: 'kpi3', value: '38', delta: '0%', trend: 'neutral', icon: 'trending-up', iconColor: 'gold' },
  { key: 'kpi4', value: '8.4', delta: '+1%', trend: 'up', icon: 'check', iconColor: 'green' },
]

const warehouseData: DashboardData = {
  kpis: warehouseKpis,
  salesByCategory: [],
  alerts: [],
  sectionPreviews: [],
  deadstock: warehouseDeadstock,
  turnover: warehouseTurnover,
}

// ─── Sales ───────────────────────────────────────────────────────────────────

const salesKpis: KpiItem[] = [
  { key: 'kpi1', value: '84 200', delta: '+12%', trend: 'up', icon: 'trending-up', iconColor: 'green' },
  { key: 'kpi2', value: '47', delta: '+5', trend: 'up', icon: 'users', iconColor: 'blue' },
  { key: 'kpi3', value: '63', delta: '0%', trend: 'neutral', icon: 'receipt', iconColor: 'gold' },
  { key: 'kpi4', value: '11 400', delta: '-3%', trend: 'down', icon: 'alert', iconColor: 'red' },
]

const salesTopClients: TopClientItem[] = [
  { name: { ru: 'UAB Metalis', en: 'UAB Metalis', lt: 'UAB Metalis' } as TranslatedString, value: 18400, percentage: 88, color: 'blue' },
  { name: { ru: 'SIA Steel Pro', en: 'SIA Steel Pro', lt: 'SIA Steel Pro' } as TranslatedString, value: 13100, percentage: 62, color: 'blue' },
  { name: { ru: 'Metallurg Ltd', en: 'Metallurg Ltd', lt: 'Metallurg Ltd' } as TranslatedString, value: 9500, percentage: 45, color: 'blue' },
  { name: { ru: 'AS Rauad OÜ', en: 'AS Rauad OÜ', lt: 'AS Rauad OÜ' } as TranslatedString, value: 6300, percentage: 30, color: 'green' },
  { name: { ru: 'UAB Plieno', en: 'UAB Plieno', lt: 'UAB Plieno' } as TranslatedString, value: 4000, percentage: 19, color: 'green' },
]

const salesRefusalReasons: RefusalReasonItem[] = [
  { label: { ru: 'Цена', en: 'Price', lt: 'Kaina' }, percentage: 62, color: 'red' },
  { label: { ru: 'Сроки', en: 'Lead time', lt: 'Terminai' }, percentage: 28, color: 'yellow' },
  { label: { ru: 'Ассортимент', en: 'Assortment', lt: 'Asortimentas' }, percentage: 10, color: 'blue' },
]

const salesData: DashboardData = {
  kpis: salesKpis,
  salesByCategory: [],
  alerts: [],
  sectionPreviews: [],
  topClients: salesTopClients,
  refusalReasons: salesRefusalReasons,
}

// ─── Supply ──────────────────────────────────────────────────────────────────

const supplyKpis: KpiItem[] = [
  { key: 'kpi1', value: '58 200', delta: '0%', trend: 'neutral', icon: 'receipt', iconColor: 'blue' },
  { key: 'kpi2', value: '84', delta: '+5%', trend: 'up', icon: 'check', iconColor: 'green' },
  { key: 'kpi3', value: '3', delta: '+1', trend: 'down', icon: 'clock', iconColor: 'red' },
  { key: 'kpi4', value: '+4.2', delta: '-0.5', trend: 'down', icon: 'trending-up', iconColor: 'gold' },
]

const supplySuppliers: SupplierItem[] = [
  { name: { ru: 'Metalis LT', en: 'Metalis LT', lt: 'Metalis LT' } as TranslatedString, deliveries: 8, ontime: 87, status: { ru: 'Надёжный', en: 'Reliable', lt: 'Patikimas' }, statusType: 'success' },
  { name: { ru: 'ArcelorMittal', en: 'ArcelorMittal', lt: 'ArcelorMittal' } as TranslatedString, deliveries: 5, ontime: 100, status: { ru: 'Надёжный', en: 'Reliable', lt: 'Patikimas' }, statusType: 'success' },
  { name: { ru: 'StalProm LLC', en: 'StalProm LLC', lt: 'StalProm LLC' } as TranslatedString, deliveries: 6, ontime: 50, status: { ru: 'Риск', en: 'Risk', lt: 'Rizika' }, statusType: 'danger' },
  { name: { ru: 'SIA BalticMetal', en: 'SIA BalticMetal', lt: 'SIA BalticMetal' } as TranslatedString, deliveries: 4, ontime: 75, status: { ru: 'Мониторинг', en: 'Monitor', lt: 'Stebėti' }, statusType: 'warning' },
]

const supplyCategories: SupplyCategoryItem[] = [
  { label: { ru: 'Труба', en: 'Pipe', lt: 'Vamzdis' }, percentage: 72, change: '+5.1%', color: 'yellow' },
  { label: { ru: 'Лист', en: 'Sheet', lt: 'Lakštas' }, percentage: 45, change: '+2.8%', color: 'blue' },
  { label: { ru: 'Уголок', en: 'Angle', lt: 'Kampainis' }, percentage: 30, change: '+1.9%', color: 'blue' },
  { label: { ru: 'Нержавейка', en: 'Stainless', lt: 'Nerūdijantis' }, percentage: 90, change: '+9.3%', color: 'red' },
]

const supplyData: DashboardData = {
  kpis: supplyKpis,
  salesByCategory: [],
  alerts: [],
  sectionPreviews: [],
  suppliers: supplySuppliers,
  supplyCategories,
}

// ─── Staff ───────────────────────────────────────────────────────────────────

const staffManagers: ManagerItem[] = [
  { name: { ru: 'Андрей', en: 'Andrew', lt: 'Andrejus' }, sales: 28400, deals: 21, margin: '22.4%', rating: { ru: 'Топ', en: 'Top', lt: 'Geriausias' }, ratingType: 'success' },
  { name: { ru: 'Светлана', en: 'Svetlana', lt: 'Svetlana' }, sales: 22100, deals: 18, margin: '19.1%', rating: { ru: 'Хорошо', en: 'Good', lt: 'Gerai' }, ratingType: 'success' },
  { name: { ru: 'Дмитрий', en: 'Dmitry', lt: 'Dmitrijus' }, sales: 18700, deals: 14, margin: '14.2%', rating: { ru: 'Мониторинг', en: 'Monitor', lt: 'Stebėti' }, ratingType: 'warning' },
  { name: { ru: 'Ирена', en: 'Irena', lt: 'Irena' }, sales: 15000, deals: 10, margin: '11.8%', rating: { ru: 'Низкий', en: 'Low', lt: 'Žemas' }, ratingType: 'danger' },
]

const staffWorkers: WorkerItem[] = [
  { name: { ru: 'Тарас', en: 'Taras', lt: 'Tarasas' }, orders: 94, avgTime: { ru: '38 мин', en: '38 min', lt: '38 min.' }, errors: 0, errorType: 'success' },
  { name: { ru: 'Алексей', en: 'Alexey', lt: 'Aleksejus' }, orders: 87, avgTime: { ru: '44 мин', en: '44 min', lt: '44 min.' }, errors: 2, errorType: 'warning' },
  { name: { ru: 'Пётр', en: 'Petr', lt: 'Petras' }, orders: 76, avgTime: { ru: '51 мин', en: '51 min', lt: '51 min.' }, errors: 5, errorType: 'danger' },
]

const staffRevenues: RevenueItem[] = [
  { name: { ru: 'Андрей', en: 'Andrew', lt: 'Andrejus' }, value: 28400, percentage: 85, color: 'green' },
  { name: { ru: 'Светлана', en: 'Svetlana', lt: 'Svetlana' }, value: 22100, percentage: 65, color: 'blue' },
  { name: { ru: 'Дмитрий', en: 'Dmitry', lt: 'Dmitrijus' }, value: 18700, percentage: 50, color: 'yellow' },
  { name: { ru: 'Ирена', en: 'Irena', lt: 'Irena' }, value: 15000, percentage: 38, color: 'red' },
]

const staffData: DashboardData = {
  kpis: [],
  salesByCategory: [],
  alerts: [],
  sectionPreviews: [],
  managers: staffManagers,
  workers: staffWorkers,
  revenues: staffRevenues,
}

// ─── Logistics ───────────────────────────────────────────────────────────────

const logisticsKpis: KpiItem[] = [
  { key: 'kpi1', value: '34', delta: '+3', trend: 'up', icon: 'truck', iconColor: 'blue' },
  { key: 'kpi2', value: '7.4', delta: '0%', trend: 'neutral', icon: 'package', iconColor: 'green' },
  { key: 'kpi3', value: '5', delta: '+2', trend: 'down', icon: 'clock', iconColor: 'red' },
  { key: 'kpi4', value: '62', delta: '+5%', trend: 'up', icon: 'trending-up', iconColor: 'gold' },
]

const logisticsRoutes: RouteItem[] = [
  { route: { ru: 'Вильнюс — Каунас', en: 'Vilnius — Kaunas', lt: 'Vilnius — Kaunas' }, trips: 12, load: 8.2, revenue: 4800, status: { ru: 'Прибыльный', en: 'Profitable', lt: 'Pelningas' }, statusType: 'success' },
  { route: { ru: 'Вильнюс — Рига', en: 'Vilnius — Riga', lt: 'Vilnius — Ryga' }, trips: 8, load: 7.1, revenue: 3600, status: { ru: 'Прибыльный', en: 'Profitable', lt: 'Pelningas' }, statusType: 'success' },
  { route: { ru: 'Вильнюс — Варшава', en: 'Vilnius — Warsaw', lt: 'Vilnius — Varšuva' }, trips: 5, load: 9.4, revenue: 5200, status: { ru: 'Прибыльный', en: 'Profitable', lt: 'Pelningas' }, statusType: 'success' },
  { route: { ru: 'Каунас — Таллин', en: 'Kaunas — Tallinn', lt: 'Kaunas — Talinas' }, trips: 4, load: 4.1, revenue: 1200, status: { ru: 'Окупается', en: 'Breakeven', lt: 'Atsiperka' }, statusType: 'warning' },
  { route: { ru: 'Паневежис — Лиепая', en: 'Panevėžys — Liepaja', lt: 'Panevėžys — Liepoja' }, trips: 5, load: 2.3, revenue: 400, status: { ru: 'Убыточный', en: 'Loss', lt: 'Nuostolingas' }, statusType: 'danger' },
]

const logisticsLoads: LoadItem[] = [
  { label: { ru: '1 нед.', en: 'Wk 1', lt: '1 sav.' }, percentage: 82, value: '8.2 t', color: 'green' },
  { label: { ru: '2 нед.', en: 'Wk 2', lt: '2 sav.' }, percentage: 74, value: '7.4 t', color: 'blue' },
  { label: { ru: '3 нед.', en: 'Wk 3', lt: '3 sav.' }, percentage: 69, value: '6.9 t', color: 'yellow' },
  { label: { ru: '4 нед.', en: 'Wk 4', lt: '4 sav.' }, percentage: 61, value: '6.1 t', color: 'yellow' },
]

const logisticsData: DashboardData = {
  kpis: logisticsKpis,
  salesByCategory: [],
  alerts: [],
  sectionPreviews: [],
  routes: logisticsRoutes,
  loads: logisticsLoads,
}

// ─── P&L Report ──────────────────────────────────────────────────────────────

const plRows: PlRowItem[] = [
  { label: { ru: 'Продажи', en: 'Sales', lt: 'Pardavimai' }, value: '+ 84 200 €', type: 'positive' },
  { label: { ru: '', en: '', lt: '' }, value: '', type: 'total', isDivider: true },
  { label: { ru: 'Себестоимость', en: 'COGS', lt: 'Savikaina' }, value: '− 58 200 €', type: 'negative' },
  { label: { ru: 'Валовая прибыль', en: 'Gross profit', lt: 'Bendrasis pelnas' }, value: '= 26 000 €', type: 'positive' },
  { label: { ru: '', en: '', lt: '' }, value: '', type: 'total', isDivider: true },
  { label: { ru: 'Логистика', en: 'Logistics', lt: 'Logistika' }, value: '− 6 800 €', type: 'negative' },
  { label: { ru: 'Аренда', en: 'Rent', lt: 'Nuoma' }, value: '− 2 100 €', type: 'negative' },
  { label: { ru: 'Зарплаты', en: 'Salaries', lt: 'Atlyginimai' }, value: '− 3 130 €', type: 'negative' },
  { label: { ru: '', en: '', lt: '' }, value: '', type: 'total', isDivider: true },
  { label: { ru: 'Операционная прибыль', en: 'Operating profit', lt: 'Veiklos pelnas' }, value: '14 870 €', type: 'positive' },
]

const calendarEvents: CalendarEvent[] = [
  { date: { ru: '2 апр', en: 'Apr 2', lt: 'Balandžio 2' }, client: 'UAB Metalis', amount: '+ 8 400 €' },
  { date: { ru: '5 апр', en: 'Apr 5', lt: 'Balandžio 5' }, client: 'SIA Steel Pro', amount: '+ 5 100 €' },
  { date: { ru: '8 апр', en: 'Apr 8', lt: 'Balandžio 8' }, client: 'Metallurg LLC', amount: '+ 3 750 €' },
  { date: { ru: '10 апр', en: 'Apr 10', lt: 'Balandžio 10' }, client: 'AS Rauad OÜ', amount: '+ 2 900 €' },
  { date: { ru: '12 апр', en: 'Apr 12', lt: 'Balandžio 12' }, client: 'Metalis LT', amount: '− 18 000 €', isNegative: true },
  { date: { ru: '14 апр', en: 'Apr 14', lt: 'Balandžio 14' }, client: 'UAB Plieno', amount: '+ 1 600 €' },
]

const plReportData: DashboardData = {
  kpis: [],
  salesByCategory: [],
  alerts: [],
  sectionPreviews: [],
  plRows,
  calendarEvents,
}

// ─── Deficit ─────────────────────────────────────────────────────────────────

const deficitKpis: KpiItem[] = [
  { key: 'kpi1', value: '8', delta: '+2', trend: 'down', icon: 'alert', iconColor: 'red' },
  { key: 'kpi2', value: '4 800', delta: '+600', trend: 'down', icon: 'currency', iconColor: 'gold' },
  { key: 'kpi3', value: '5', delta: '0', trend: 'neutral', icon: 'package', iconColor: 'blue' },
  { key: 'kpi4', value: '3', delta: '-1', trend: 'up', icon: 'check', iconColor: 'green' },
]

const deficitItems: DeficitItem[] = [
  { name: { ru: 'Труба 60×3', en: 'Pipe 60×3', lt: 'Vamzdis 60×3' }, stock: '0.4', min: '2', refusals: 4, status: { ru: 'Критично', en: 'Critical', lt: 'Kritiška' }, statusType: 'danger' },
  { name: { ru: 'Лист 3 мм', en: 'Sheet 3mm', lt: 'Lakštas 3 mm' }, stock: '0.8', min: '3', refusals: 3, status: { ru: 'Критично', en: 'Critical', lt: 'Kritiška' }, statusType: 'danger' },
  { name: { ru: 'Профиль 80×80', en: 'Profile 80×80', lt: 'Profilis 80×80' }, stock: '1.1', min: '2', refusals: 2, status: { ru: 'Низкий', en: 'Low', lt: 'Žemas' }, statusType: 'warning' },
  { name: { ru: 'Пруток 30 мм', en: 'Rod 30mm', lt: 'Strypas 30 mm' }, stock: '0.6', min: '1.5', refusals: 2, status: { ru: 'Низкий', en: 'Low', lt: 'Žemas' }, statusType: 'warning' },
  { name: { ru: 'Уголок 63×63', en: 'Angle 63×63', lt: 'Kampainis 63×63' }, stock: '1.8', min: '2', refusals: 1, status: { ru: 'Низкий', en: 'Low', lt: 'Žemas' }, statusType: 'warning' },
]

const refusalVolumes: RefusalVolumeItem[] = [
  { name: { ru: 'Труба 60×3', en: 'Pipe 60×3', lt: 'Vamzdis 60×3' }, percentage: 90, value: '4 t', color: 'red' },
  { name: { ru: 'Лист 3 мм', en: 'Sheet 3mm', lt: 'Lakštas 3 mm' }, percentage: 75, value: '5 t', color: 'red' },
  { name: { ru: 'Профиль 80×80', en: 'Profile 80×80', lt: 'Profilis 80×80' }, percentage: 50, value: '2 t', color: 'yellow' },
  { name: { ru: 'Пруток 30 мм', en: 'Rod 30mm', lt: 'Strypas 30 mm' }, percentage: 40, value: '1.5 t', color: 'yellow' },
  { name: { ru: 'Уголок 63×63', en: 'Angle 63×63', lt: 'Kampainis 63×63' }, percentage: 25, value: '1 t', color: 'blue' },
]

const deficitData: DashboardData = {
  kpis: deficitKpis,
  salesByCategory: [],
  alerts: [],
  sectionPreviews: [],
  deficitItems,
  refusalVolumes,
}

// ─── Mock resolver ───────────────────────────────────────────────────────────

export function mockGetAnalyticsPage(page: string): DashboardData {
  switch (page) {
    case 'dashboard': return dashboardData
    case 'warehouse': return warehouseData
    case 'sales': return salesData
    case 'supply': return supplyData
    case 'staff': return staffData
    case 'logistics': return logisticsData
    case 'pl-report': return plReportData
    case 'deficit': return deficitData
    default: return {
      kpis: [],
      salesByCategory: [],
      alerts: [],
      sectionPreviews: [],
    }
  }
}
