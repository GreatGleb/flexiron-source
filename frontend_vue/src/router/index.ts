import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { isEnabled } from '@/config/featureFlags'
import type { FeatureFlagKey } from '@/types/features'
import LandingPage from '@/views/public/LandingPage.vue'
import NotFoundPage from '@/views/public/NotFoundPage.vue'
import AboutPage from '@/views/public/AboutPage.vue'
import LoginPage from '@/views/public/LoginPage.vue'
import RegisterPage from '@/views/public/RegisterPage.vue'
import SupportPage from '@/views/public/SupportPage.vue'
import TermsPage from '@/views/public/TermsPage.vue'
import ScreensPage from '@/views/public/ScreensPage.vue'

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
        name: 'admin-warehouse',
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

// Feature flag guard — redirect to /404 if route is disabled
router.beforeEach((to) => {
  const flag = to.meta?.featureFlag as FeatureFlagKey | undefined
  if (flag && !isEnabled(flag)) {
    return { name: 'not-found' }
  }
})
