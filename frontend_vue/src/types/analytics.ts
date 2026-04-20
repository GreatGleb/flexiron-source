export type AnalyticsPageKey =
  | 'dashboard'
  | 'warehouse'
  | 'sales'
  | 'supply'
  | 'staff'
  | 'logistics'
  | 'pl-report'
  | 'deficit'

export interface KpiItem {
  key: string
  value: string
  delta: string
  trend: 'up' | 'down' | 'neutral'
  icon: string
  iconColor: 'blue' | 'red' | 'green' | 'gold'
}

export interface AlertItem {
  type: string
  description: string
  status: 'critical' | 'overdue' | 'risk' | 'pending' | 'ok'
}

export interface ChartBarItem {
  label: string
  value: number
  percentage: number
}

export interface AnalyticsSectionPreview {
  key: string
  title: string
  metrics: AnalyticsMetricItem[]
}

export interface AnalyticsMetricItem {
  label: string
  value: string
  status?: 'ok' | 'bad' | 'warn'
}

export interface DashboardData {
  kpis: KpiItem[]
  salesByCategory: ChartBarItem[]
  alerts: AlertItem[]
  sectionPreviews: AnalyticsSectionPreview[]
}
