import type {
  DashboardData,
  KpiItem,
  ChartBarItem,
  AlertItem,
  AnalyticsSectionPreview,
} from '@/types/analytics'

const kpiDashboard: KpiItem[] = [
  {
    key: 'revenue',
    value: '€1 248 000',
    delta: '+12%',
    trend: 'up',
    icon: 'chart-bar',
    iconColor: 'blue',
  },
  { key: 'orders', value: '342', delta: '+8%', trend: 'up', icon: 'package', iconColor: 'green' },
  { key: 'suppliers', value: '47', delta: '-2', trend: 'down', icon: 'users', iconColor: 'gold' },
  { key: 'deficit', value: '3', delta: '+1', trend: 'down', icon: 'alert', iconColor: 'red' },
]

const salesByCategory: ChartBarItem[] = [
  { label: 'Sheets', value: 420000, percentage: 34 },
  { label: 'Pipes', value: 280000, percentage: 22 },
  { label: 'Beams', value: 195000, percentage: 16 },
  { label: 'Rebars', value: 155000, percentage: 12 },
  { label: 'Lintels', value: 110000, percentage: 9 },
  { label: 'Other', value: 88000, percentage: 7 },
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
