import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { isEnabled } from '@/config/featureFlags'
import type { FeatureFlagKey } from '@/types/features'
import LandingPage from '@/views/public/LandingPage.vue'
import NotFoundPage from '@/views/public/NotFoundPage.vue'
import AboutPage from '@/views/public/AboutPage.vue'
import LoginPage from '@/views/public/LoginPage.vue'
import RegisterPage from '@/views/public/RegisterPage.vue'
import AuthLinkHandler from '@/views/public/AuthLinkHandler.vue'
import SupportPage from '@/views/public/SupportPage.vue'
import TermsPage from '@/views/public/TermsPage.vue'
import ScreensPage from '@/views/public/ScreensPage.vue'

/** List of route names that are publicly accessible without auth. */
const PUBLIC_ROUTES = new Set<string>([
  'landing',
  'login',
  'register',
  'about',
  'support',
  'terms',
  'auth-link',
  'screens',
  'not-found',
])

/**
 * Check if an auth token exists in either localStorage or sessionStorage.
 * This is a synchronous check used by the router guard (avoids importing
 * useAuth which depends on useRouter context).
 */
function hasAuthToken(): boolean {
  return !!(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'))
}

const routes: RouteRecordRaw[] = [
  /* ── Public pages ── */
  {
    path: '/',
    name: 'landing',
    component: LandingPage,
  },
  {
    path: '/login',
    name: 'login',
    component: LoginPage,
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterPage,
  },
  {
    path: '/about',
    name: 'about',
    component: AboutPage,
  },
  {
    path: '/support',
    name: 'support',
    component: SupportPage,
  },
  {
    path: '/terms',
    name: 'terms',
    component: TermsPage,
  },
  {
    path: '/auth/link',
    name: 'auth-link',
    component: AuthLinkHandler,
  },
  {
    path: '/screens',
    name: 'screens',
    component: ScreensPage,
  },

  /* ── Admin ── */
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { layout: 'admin' },
    redirect: '/admin/analytics/dashboard',
    children: [
      /* Analytics */
      {
        path: 'analytics/dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/admin/analytics/DashboardPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminDashboard' as FeatureFlagKey },
      },
      {
        path: 'analytics/warehouse',
        name: 'admin-analytics-warehouse',
        component: () => import('@/views/admin/analytics/WarehousePage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
      },
      {
        path: 'analytics/sales',
        name: 'admin-sales',
        component: () => import('@/views/admin/analytics/SalesPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminSales' as FeatureFlagKey },
      },
      {
        path: 'analytics/supply',
        name: 'admin-supply',
        component: () => import('@/views/admin/analytics/SupplyPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminSupply' as FeatureFlagKey },
      },
      {
        path: 'analytics/staff',
        name: 'admin-staff',
        component: () => import('@/views/admin/analytics/StaffPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminStaff' as FeatureFlagKey },
      },
      {
        path: 'analytics/logistics',
        name: 'admin-logistics',
        component: () => import('@/views/admin/analytics/LogisticsPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminLogistics' as FeatureFlagKey },
      },
      {
        path: 'analytics/pl-report',
        name: 'admin-pl-report',
        component: () => import('@/views/admin/analytics/PlReportPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminPlReport' as FeatureFlagKey },
      },
      {
        path: 'analytics/deficit',
        name: 'admin-deficit',
        component: () => import('@/views/admin/analytics/DeficitPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminDeficit' as FeatureFlagKey },
      },

      /* Sales & CRM */
      {
        path: 'sales-crm',
        name: 'admin-sales-crm',
        component: () => import('@/views/admin/sales-crm/SalesCrmPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminSalesCrm' as FeatureFlagKey },
      },

      /* Orders */
      {
        path: 'orders',
        name: 'admin-orders',
        component: () => import('@/views/admin/orders/OrdersListPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminOrders' as FeatureFlagKey },
      },
      {
        path: 'orders/new',
        name: 'admin-order-create',
        component: () => import('@/views/admin/orders/OrderCreatePage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminOrders' as FeatureFlagKey },
      },
      {
        path: 'orders/:id',
        name: 'admin-order-card',
        component: () => import('@/views/admin/orders/OrderCardPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminOrders' as FeatureFlagKey },
      },

      /* Clients */
      {
        path: 'clients',
        name: 'admin-clients',
        component: () => import('@/views/admin/clients/ClientsListPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminClients' as FeatureFlagKey },
      },
      {
        path: 'clients/new',
        name: 'admin-client-create',
        component: () => import('@/views/admin/clients/ClientCreatePage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminClients' as FeatureFlagKey },
      },
      {
        path: 'clients/:id',
        name: 'admin-client-card',
        component: () => import('@/views/admin/clients/ClientCardPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminClients' as FeatureFlagKey },
      },

      /* Suppliers */
      {
        path: 'suppliers',
        name: 'admin-suppliers',
        component: () => import('@/views/admin/suppliers/SuppliersListPage.vue'),
        meta: { layout: 'admin', featureFlag: 'suppliersList' as FeatureFlagKey },
      },
      {
        path: 'suppliers/config',
        name: 'admin-supplier-config',
        component: () => import('@/views/admin/suppliers/SupplierCardConfigPage.vue'),
        meta: { layout: 'admin', featureFlag: 'supplierCardConfig' as FeatureFlagKey },
      },
      {
        path: 'suppliers/bcc-request',
        name: 'admin-bcc-request',
        component: () => import('@/views/admin/suppliers/BccRequestPage.vue'),
        meta: { layout: 'admin', featureFlag: 'bccRequest' as FeatureFlagKey },
      },
      {
        path: 'suppliers/new',
        name: 'admin-supplier-create',
        component: () => import('@/views/admin/suppliers/SupplierCreatePage.vue'),
        meta: { layout: 'admin', featureFlag: 'supplierCreate' as FeatureFlagKey },
      },
      {
        path: 'suppliers/:id',
        name: 'admin-supplier-card',
        component: () => import('@/views/admin/suppliers/SupplierCardPage.vue'),
        meta: { layout: 'admin', featureFlag: 'supplierCard' as FeatureFlagKey },
      },
      {
        path: 'products',
        name: 'admin-products',
        component: () => import('@/views/admin/products/ProductsPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminProducts' as FeatureFlagKey },
      },
      {
        path: 'products/:id',
        name: 'admin-product-card',
        component: () => import('@/views/admin/products/ProductCardPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminProducts' as FeatureFlagKey },
      },
      {
        path: 'products/categories',
        name: 'admin-categories',
        component: () => import('@/views/admin/products/CategoriesPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminCategories' as FeatureFlagKey },
      },
      {
        path: 'products/categories/:id',
        name: 'admin-category-card',
        component: () => import('@/views/admin/products/CategoryCardPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminCategories' as FeatureFlagKey },
      },
      {
        path: 'products/services',
        name: 'admin-services',
        component: () => import('@/views/admin/products/ServicesPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminServices' as FeatureFlagKey },
      },
      {
        path: 'products/services/:id',
        name: 'admin-service-card',
        component: () => import('@/views/admin/products/ServiceCardPage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminServices' as FeatureFlagKey },
      },

      /* Warehouse */
      {
        path: 'warehouse/stock/:id',
        name: 'admin-warehouse-stock-card',
        component: () => import('@/views/admin/warehouse/WarehouseStockCard.vue'),
        meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
      },
      {
        path: 'warehouse/batches/:id',
        name: 'admin-warehouse-batch',
        component: () => import('@/views/admin/warehouse/WarehouseBatchCard.vue'),
        meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
      },
      {
        path: 'warehouse/offcuts/new',
        name: 'admin-warehouse-offcut-create',
        component: () => import('@/views/admin/warehouse/WarehouseOffcutCreatePage.vue'),
        meta: { layout: 'admin', featureFlag: 'warehouseOffcutCreate' as FeatureFlagKey },
      },
      {
        path: 'warehouse/offcuts/:id',
        name: 'admin-warehouse-offcut',
        component: () => import('@/views/admin/warehouse/WarehouseOffcutCard.vue'),
        meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
      },
      {
        path: 'warehouse/batches/new',
        name: 'admin-warehouse-batch-create',
        component: () => import('@/views/admin/warehouse/WarehouseBatchCreatePage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
      },
      {
        path: 'warehouse/movements/:id',
        name: 'admin-warehouse-movement',
        component: () => import('@/views/admin/warehouse/WarehouseMovementCard.vue'),
        meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
      },
      {
        path: 'warehouse/deficit/:id',
        name: 'admin-warehouse-deficit',
        component: () => import('@/views/admin/warehouse/WarehouseDeficitCard.vue'),
        meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
      },
      {
        path: 'notifications',
        name: 'admin-notifications',
        component: () => import('@/views/admin/notifications/NotificationsPage.vue'),
        meta: { layout: 'admin', featureFlag: 'notificationsPage' as FeatureFlagKey },
      },
      {
        path: 'warehouse/:tab(stock|batches|offcuts|movements|deficit)?',
        name: 'admin-warehouse',
        component: () => import('@/views/admin/warehouse/WarehousePage.vue'),
        meta: { layout: 'admin', featureFlag: 'adminWarehouse' as FeatureFlagKey },
      },

      /* Finance */
      {
        path: 'finance/incoming',
        name: 'admin-finance-incoming',
        component: () => import('@/views/admin/finance/IncomingPaymentsPage.vue'),
        meta: { layout: 'admin', featureFlag: 'financeIncoming' as FeatureFlagKey },
      },
      {
        path: 'finance/incoming/:id',
        name: 'admin-finance-incoming-payment',
        component: () => import('@/views/admin/finance/IncomingPaymentCardPage.vue'),
        meta: { layout: 'admin', featureFlag: 'financeIncoming' as FeatureFlagKey },
      },
      {
        path: 'finance/outgoing',
        name: 'admin-finance-outgoing',
        component: () => import('@/views/admin/finance/OutgoingPaymentsPage.vue'),
        meta: { layout: 'admin', featureFlag: 'financeOutgoing' as FeatureFlagKey },
      },
      {
        path: 'finance/outgoing/:id',
        name: 'admin-finance-outgoing-payment',
        component: () => import('@/views/admin/finance/OutgoingPaymentCardPage.vue'),
        meta: { layout: 'admin', featureFlag: 'financeOutgoing' as FeatureFlagKey },
      },
      {
        path: 'finance/archive',
        name: 'admin-finance-archive',
        component: () => import('@/views/admin/finance/DocumentArchivePage.vue'),
        meta: { layout: 'admin', featureFlag: 'financeDocumentArchive' as FeatureFlagKey },
      },

      /* Settings */
      {
        path: 'settings',
        children: [
          {
            path: '',
            name: 'admin-settings',
            component: () => import('@/views/admin/settings/SettingsLayout.vue'),
            meta: { layout: 'admin', featureFlag: 'adminSettings' as FeatureFlagKey },
            children: [
              {
                path: '',
                redirect: { name: 'admin-settings-profile' },
              },
              {
                path: 'profile',
                name: 'admin-settings-profile',
                component: () => import('@/views/admin/settings/ProfileSettings.vue'),
              },
              {
                path: 'company',
                name: 'admin-settings-company',
                component: () => import('@/views/admin/settings/CompanySettings.vue'),
              },
              {
                path: 'finance',
                name: 'admin-settings-finance',
                component: () => import('@/views/admin/settings/FinanceSettings.vue'),
              },
              {
                path: 'units',
                name: 'admin-settings-units',
                component: () => import('@/views/admin/settings/UnitsSettings.vue'),
              },
              {
                path: 'order-statuses',
                name: 'admin-settings-order-statuses',
                component: () => import('@/views/admin/settings/OrderStatusesSettings.vue'),
              },
            ],
          },
        ],
      },
    ],
  },

  /* ── Catch-all ── */
  {
    path: '/404',
    name: 'not-found',
    component: NotFoundPage,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/404',
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Auth guard — protect admin routes, redirect logged-in users away from auth pages
router.beforeEach((to) => {
  // Mock mode: skip all auth checks so admin is freely accessible
  const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'
  if (USE_MOCKS) return

  const isPublic = PUBLIC_ROUTES.has(to.name as string)
  const isAuthPage = to.name === 'login' || to.name === 'register'
  const tokenExists = hasAuthToken()

  // Not authenticated → redirect to login (unless already on a public page)
  if (!isPublic && !tokenExists) {
    return { name: 'login' }
  }

  // Already authenticated on login/register → redirect to admin dashboard
  if (isAuthPage && tokenExists) {
    return { name: 'admin-dashboard' }
  }
})

// Feature flag guard — redirect to /404 if route is disabled
router.beforeEach((to) => {
  const flag = to.meta?.featureFlag as FeatureFlagKey | undefined
  if (flag && !isEnabled(flag)) {
    return { name: 'not-found' }
  }
})
