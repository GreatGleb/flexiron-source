import type {
  DashboardData,
  KpiItem,
  ChartBarItem,
  AlertItem,
  AnalyticsSectionPreview,
} from '@/types/analytics'

const kpiDashboard: KpiItem[] = [
  { key: 'revenue', value: '127 400', delta: '+7%', trend: 'up', icon: 'chart-bar', iconColor: 'blue' },
  { key: 'procurement', value: '38 750', delta: '-3%', trend: 'down', icon: 'receipt', iconColor: 'red' },
  { key: 'margin', value: '84 200', delta: '+12%', trend: 'up', icon: 'trending-up', iconColor: 'green' },
  { key: 'profit', value: '14 870', delta: '0%', trend: 'neutral', icon: 'currency', iconColor: 'gold' },
  { key: 'deficit', value: '8', delta: '+2', trend: 'down', icon: 'alert', iconColor: 'red' },
]

const salesByCategory: ChartBarItem[] = [
  { label: 'Pipes', value: 32400, percentage: 78 },
  { label: 'Sheets', value: 22800, percentage: 55 },
  { label: 'Profile', value: 15900, percentage: 38 },
  { label: 'Rods', value: 8200, percentage: 20 },
  { label: 'Scraps', value: 4900, percentage: 12 },
]

const alerts: AlertItem[] = [
  { type: 'sheets', description: 'Sheet 2mm stock critically low', status: 'critical' },
  { type: 'delivery', description: 'NordMetal delivery 3 days overdue', status: 'overdue' },
  { type: 'supplier', description: 'UralSteel JSC rating dropped to 2★', status: 'risk' },
  { type: 'bcc', description: 'Price request pending from 2 suppliers', status: 'pending' },
]

const sectionPreviews: AnalyticsSectionPreview[] = [
  {
    key: 'warehouse',
    title: 'Warehouse',
    metrics: [
      { label: 'Total stock', value: '1 240 t', status: 'ok' },
      { label: 'Low stock items', value: '3', status: 'bad' },
    ],
  },
  {
    key: 'sales',
    title: 'Sales',
    metrics: [
      { label: 'This month', value: '€248 000', status: 'ok' },
      { label: 'vs last month', value: '+12%', status: 'ok' },
    ],
  },
  {
    key: 'supply',
    title: 'Supply',
    metrics: [
      { label: 'Open orders', value: '18', status: 'ok' },
      { label: 'Overdue', value: '2', status: 'bad' },
    ],
  },
  {
    key: 'staff',
    title: 'Staff',
    metrics: [
      { label: 'Employees', value: '24', status: 'ok' },
      { label: 'On leave', value: '2', status: 'warn' },
    ],
  },
]

const dashboardData: DashboardData = {
  kpis: kpiDashboard,
  salesByCategory,
  alerts,
  sectionPreviews,
}

const genericPageData = (_pageKey: string): DashboardData => ({
  kpis: [
    {
      key: 'kpi1',
      value: '1 240 t',
      delta: '+5%',
      trend: 'up',
      icon: 'chart-bar',
      iconColor: 'blue',
    },
    { key: 'kpi2', value: '18', delta: '-2', trend: 'down', icon: 'package', iconColor: 'green' },
    {
      key: 'kpi3',
      value: '€85 000',
      delta: '+3%',
      trend: 'up',
      icon: 'chart-bar',
      iconColor: 'gold',
    },
    { key: 'kpi4', value: '98%', delta: '+1%', trend: 'up', icon: 'check', iconColor: 'green' },
  ],
  salesByCategory: [
    { label: 'Category A', value: 420000, percentage: 42 },
    { label: 'Category B', value: 280000, percentage: 28 },
    { label: 'Category C', value: 190000, percentage: 19 },
    { label: 'Other', value: 110000, percentage: 11 },
  ],
  alerts: [],
  sectionPreviews: [],
})

export function mockGetAnalyticsPage(page: string): DashboardData {
  if (page === 'dashboard') return dashboardData
  return genericPageData(page)
}
