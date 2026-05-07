import type { TranslatedString } from './i18n'

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
  /** Translated alert type label (e.g. "Листы" / "Sheets" / "Lakštai") */
  type: TranslatedString
  /** Translated alert description */
  description: TranslatedString
  status: 'critical' | 'overdue' | 'risk' | 'pending' | 'ok'
}

export interface ChartBarItem {
  /** Translated category label (e.g. "Трубы" / "Pipes" / "Vamzdžiai") */
  label: TranslatedString
  value: number
  percentage: number
}

export interface AnalyticsSectionPreview {
  key: string
  /** Translated section title (e.g. "Склад" / "Warehouse" / "Sandėlis") */
  title: TranslatedString
  metrics: AnalyticsMetricItem[]
}

export interface AnalyticsMetricItem {
  /** Translated metric label (e.g. "Общий запас" / "Total stock" / "Bendras sandėlis") */
  label: TranslatedString
  value: string
  status?: 'ok' | 'bad' | 'warn'
}

/** A row in a deadstock / inventory table */
export interface DeadstockItem {
  /** Translated item name */
  name: TranslatedString
  zone: string
  sum: number
  /** Translated age label (e.g. "7 мес." / "7 mos." / "7 mėn.") */
  age: TranslatedString
  ageStatus: 'danger' | 'warning' | 'success'
}

/** A row in a turnover bar chart */
export interface TurnoverItem {
  /** Translated category label */
  label: TranslatedString
  percentage: number
  /** Translated value label (e.g. "22 дня" / "22 days" / "22 d.") */
  value: TranslatedString
  color: 'green' | 'blue' | 'yellow' | 'red'
}

/** A client entry in top-clients chart */
export interface TopClientItem {
  /** Translated client name */
  name: TranslatedString
  value: number
  percentage: number
  color: 'blue' | 'green'
}

/** A refusal reason entry */
export interface RefusalReasonItem {
  /** Translated reason label */
  label: TranslatedString
  percentage: number
  color: 'red' | 'yellow' | 'blue'
}

/** A supplier row in supply table */
export interface SupplierItem {
  /** Translated supplier name */
  name: TranslatedString
  deliveries: number
  ontime: number
  /** Translated status label */
  status: TranslatedString
  statusType: 'success' | 'danger' | 'warning'
}

/** A category price-change row */
export interface SupplyCategoryItem {
  /** Translated category label */
  label: TranslatedString
  percentage: number
  change: string
  color: 'yellow' | 'blue' | 'red'
}

/** A manager performance row */
export interface ManagerItem {
  /** Translated manager name */
  name: TranslatedString
  sales: number
  deals: number
  margin: string
  /** Translated rating label */
  rating: TranslatedString
  ratingType: 'success' | 'warning' | 'danger'
}

/** A warehouse worker row */
export interface WorkerItem {
  /** Translated worker name */
  name: TranslatedString
  orders: number
  /** Translated avg time label (e.g. "38 мин" / "38 min" / "38 min.") */
  avgTime: TranslatedString
  errors: number
  errorType: 'success' | 'warning' | 'danger'
}

/** A revenue dynamics bar entry */
export interface RevenueItem {
  /** Translated person name */
  name: TranslatedString
  value: number
  percentage: number
  color: 'green' | 'blue' | 'yellow' | 'red'
}

/** A logistics route row */
export interface RouteItem {
  /** Translated route label */
  route: TranslatedString
  trips: number
  load: number
  revenue: number
  /** Translated status label */
  status: TranslatedString
  statusType: 'success' | 'warning' | 'danger'
}

/** A weekly load entry */
export interface LoadItem {
  /** Translated week label */
  label: TranslatedString
  percentage: number
  value: string
  color: 'green' | 'blue' | 'yellow'
}

/** A P&L breakdown row */
export interface PlRowItem {
  /** Translated label */
  label: TranslatedString
  value: string
  type: 'positive' | 'negative' | 'total'
  isDivider?: boolean
}

/** A calendar event in P&L */
export interface CalendarEvent {
  /** Translated date label */
  date: TranslatedString
  client: string
  amount: string
  isNegative?: boolean
}

/** A deficit item row */
export interface DeficitItem {
  /** Translated item name */
  name: TranslatedString
  stock: string
  min: string
  refusals: number
  /** Translated status label */
  status: TranslatedString
  statusType: 'danger' | 'warning'
}

/** A refusal volume entry */
export interface RefusalVolumeItem {
  /** Translated item name */
  name: TranslatedString
  percentage: number
  value: string
  color: 'red' | 'yellow' | 'blue'
}

/**
 * Dashboard data returned by the analytics API.
 * All user-facing string fields (label, title, description, type)
 * are TranslatedString — the server returns all language variants,
 * and the frontend picks the right one based on current locale.
 */
export interface DashboardData {
  kpis: KpiItem[]
  salesByCategory: ChartBarItem[]
  alerts: AlertItem[]
  sectionPreviews: AnalyticsSectionPreview[]
  /** Warehouse-specific: deadstock table rows */
  deadstock?: DeadstockItem[]
  /** Warehouse-specific: turnover bar chart */
  turnover?: TurnoverItem[]
  /** Sales-specific: top clients */
  topClients?: TopClientItem[]
  /** Sales-specific: refusal reasons */
  refusalReasons?: RefusalReasonItem[]
  /** Supply-specific: supplier table rows */
  suppliers?: SupplierItem[]
  /** Supply-specific: category price changes */
  supplyCategories?: SupplyCategoryItem[]
  /** Staff-specific: manager performance */
  managers?: ManagerItem[]
  /** Staff-specific: warehouse workers */
  workers?: WorkerItem[]
  /** Staff-specific: revenue dynamics */
  revenues?: RevenueItem[]
  /** Logistics-specific: route table rows */
  routes?: RouteItem[]
  /** Logistics-specific: weekly load chart */
  loads?: LoadItem[]
  /** P&L-specific: breakdown rows */
  plRows?: PlRowItem[]
  /** P&L-specific: calendar events */
  calendarEvents?: CalendarEvent[]
  /** Deficit-specific: deficit items */
  deficitItems?: DeficitItem[]
  /** Deficit-specific: refusal volumes */
  refusalVolumes?: RefusalVolumeItem[]
}
