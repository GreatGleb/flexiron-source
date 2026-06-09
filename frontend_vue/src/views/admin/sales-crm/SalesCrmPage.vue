<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useRouter } from 'vue-router'
import { useSalesCrmDashboard } from '@/composables/useSalesCrmDashboard'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'

import '@styles/admin/sales_crm.css'

const { t } = useI18n()
const router = useRouter()

const {
  recentOrders,
  recentClients,
  loading,
  error,
  activeOrdersCount,
  pendingOrdersCount,
  newClientsThisMonth,
  totalSalesMtd,
  load,
} = useSalesCrmDashboard()

useHead({
  title: () => `Flexiron — ${t('salesCrm.title')}`,
  description: () => t('salesCrm.header_title'),
})

function goToClients() {
  router.push({ name: 'admin-clients' })
}

function goToOrders() {
  router.push({ name: 'admin-orders' })
}

function goToOrderCard(id: string) {
  router.push({ name: 'admin-order-card', params: { id } })
}

function goToNewOrder() {
  router.push({ name: 'admin-order-create' })
}

function goToNewClient() {
  router.push({ name: 'admin-client-create' })
}

function goToClientCard(id: string) {
  router.push({ name: 'admin-client-card', params: { id } })
}

function formatCurrency(value: number): string {
  return `€ ${value.toFixed(2)}`
}
</script>

<template>
  <div class="page-sales-crm" data-test="page-sales-crm">
    <!-- Header -->
    <div class="page-header" data-test="sales-crm-header">
      <h1 class="page-title">{{ t('salesCrm.header_title') }}</h1>
    </div>

    <!-- Loading state -->
    <div v-if="loading && !recentOrders.length" class="sales-crm-loading" data-test="sales-crm-loading">
      <div v-for="n in 4" :key="n" class="skeleton-kpi" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="error-state" data-test="sales-crm-error">
      <p>{{ error }}</p>
      <button class="btn btn-primary" @click="load">{{ t('salesCrm.btn_retry') }}</button>
    </div>

    <!-- Dashboard content -->
    <template v-else>
      <!-- ─── KPI Cards Row ─── -->
      <div class="sales-crm-kpi-grid" data-test="sales-crm-kpis">
        <GlassPanel class="sales-crm-kpi-card" data-test="sales-crm-kpi-active-orders">
          <div class="sales-crm-kpi-icon kpi-icon--blue">
            <SvgIcon name="shopping-cart" :width="24" :height="24" />
          </div>
          <div class="sales-crm-kpi-body">
            <span class="sales-crm-kpi-value">{{ activeOrdersCount }}</span>
            <span class="sales-crm-kpi-label">{{ t('salesCrm.kpi_active_orders') }}</span>
          </div>
        </GlassPanel>

        <GlassPanel class="sales-crm-kpi-card" data-test="sales-crm-kpi-new-clients">
          <div class="sales-crm-kpi-icon kpi-icon--green">
            <SvgIcon name="users" :width="24" :height="24" />
          </div>
          <div class="sales-crm-kpi-body">
            <span class="sales-crm-kpi-value">{{ newClientsThisMonth }}</span>
            <span class="sales-crm-kpi-label">{{ t('salesCrm.kpi_new_clients') }}</span>
          </div>
        </GlassPanel>

        <GlassPanel class="sales-crm-kpi-card" data-test="sales-crm-kpi-pending-orders">
          <div class="sales-crm-kpi-icon kpi-icon--gold">
            <SvgIcon name="clock" :width="24" :height="24" />
          </div>
          <div class="sales-crm-kpi-body">
            <span class="sales-crm-kpi-value">{{ pendingOrdersCount }}</span>
            <span class="sales-crm-kpi-label">{{ t('salesCrm.kpi_pending_orders') }}</span>
          </div>
        </GlassPanel>

        <GlassPanel class="sales-crm-kpi-card" data-test="sales-crm-kpi-sales-mtd">
          <div class="sales-crm-kpi-icon kpi-icon--green">
            <SvgIcon name="profit-coin" :width="24" :height="24" />
          </div>
          <div class="sales-crm-kpi-body">
            <span class="sales-crm-kpi-value">{{ formatCurrency(totalSalesMtd) }}</span>
            <span class="sales-crm-kpi-label">{{ t('salesCrm.kpi_sales_mtd') }}</span>
          </div>
        </GlassPanel>
      </div>

      <!-- ─── Two-column Content ─── -->
      <div class="sales-crm-content-grid" data-test="sales-crm-content">
        <!-- Left column: stacked panels -->
        <div class="sales-crm-left-column">
          <!-- Recent Orders -->
          <GlassPanel class="sales-crm-panel" data-test="sales-crm-recent-orders">
            <div class="sales-crm-panel-header">
              <h2 class="sales-crm-panel-title">{{ t('salesCrm.recent_orders') }}</h2>
              <router-link :to="{ name: 'admin-orders' }" class="sales-crm-panel-link">
                {{ t('salesCrm.view_all_orders') }}
                <SvgIcon name="chevron-right" :width="14" :height="14" />
              </router-link>
            </div>

            <div v-if="recentOrders.length === 0" class="sales-crm-empty" data-test="sales-crm-recent-empty">
              <SvgIcon name="shopping-cart" :width="36" :height="36" />
              <p>{{ t('orders.empty') }}</p>
            </div>

            <div v-else class="data-table-wrapper">
              <table class="data-table sales-crm-orders-table">
                <thead>
                  <tr>
                    <th>{{ t('orders.col_order_number') }}</th>
                    <th>{{ t('orders.col_client') }}</th>
                    <th>{{ t('orders.col_status') }}</th>
                    <th>{{ t('orders.col_total') }}</th>
                    <th>{{ t('orders.col_date') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="order in recentOrders"
                    :key="order.id"
                    class="sales-crm-order-row"
                    data-test="sales-crm-order-row"
                    @click="goToOrderCard(order.id)"
                  >
                    <td>
                      <router-link
                        :to="{ name: 'admin-order-card', params: { id: order.id } }"
                        class="name-link"
                        @click.stop
                      >
                        {{ order.orderNumber }}
                      </router-link>
                    </td>
                    <td>{{ order.clientName }}</td>
                    <td>
                      <span class="order-status-badge" :class="`order-status--${order.status}`">
                        {{ t(`orders.status_${order.status}`) }}
                      </span>
                    </td>
                    <td>{{ order.currency }} {{ order.totalAmount.toFixed(2) }}</td>
                    <td>{{ new Date(order.createdAt).toLocaleDateString() }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassPanel>

          <!-- Recent Clients -->
          <GlassPanel class="sales-crm-panel" data-test="sales-crm-recent-clients">
            <div class="sales-crm-panel-header">
              <h2 class="sales-crm-panel-title">{{ t('salesCrm.recent_clients') }}</h2>
              <router-link :to="{ name: 'admin-clients' }" class="sales-crm-panel-link">
                {{ t('salesCrm.view_all_clients') }}
                <SvgIcon name="chevron-right" :width="14" :height="14" />
              </router-link>
            </div>

            <div v-if="recentClients.length === 0" class="sales-crm-empty" data-test="sales-crm-recent-clients-empty">
              <SvgIcon name="folder" :width="36" :height="36" />
              <p>{{ t('clients.empty') }}</p>
            </div>

            <div v-else class="data-table-wrapper">
              <table class="data-table sales-crm-clients-table">
                <thead>
                  <tr>
                    <th>{{ t('clients.col_name') }}</th>
                    <th>{{ t('clients.col_company_code') }}</th>
                    <th>{{ t('clients.col_phone') }}</th>
                    <th>{{ t('clients.col_created_at') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="client in recentClients"
                    :key="client.id"
                    class="sales-crm-client-row"
                    data-test="sales-crm-client-row"
                    @click="goToClientCard(client.id)"
                  >
                    <td>
                      <router-link
                        :to="{ name: 'admin-client-card', params: { id: client.id } }"
                        class="name-link"
                        @click.stop
                      >
                        {{ client.name }}
                      </router-link>
                    </td>
                    <td>{{ client.companyCode }}</td>
                    <td>{{ client.phone }}</td>
                    <td>{{ new Date(client.createdAt).toLocaleDateString() }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </GlassPanel>
        </div>

        <!-- Right: Quick Actions -->
        <GlassPanel class="sales-crm-panel" data-test="sales-crm-quick-actions">
          <div class="sales-crm-panel-header">
            <h2 class="sales-crm-panel-title">{{ t('salesCrm.quick_actions') }}</h2>
          </div>

          <div class="sales-crm-quick-actions-list">
            <button class="sales-crm-quick-action-btn" data-test="sales-crm-action-new-order" @click="goToNewOrder">
              <div class="sales-crm-quick-action-icon" style="background: rgba(24, 144, 255, 0.15); color: #1890ff;">
                <SvgIcon name="shopping-cart" :width="20" :height="20" />
              </div>
              <div class="sales-crm-quick-action-body">
                <span class="sales-crm-quick-action-title">{{ t('salesCrm.new_order') }}</span>
                <span class="sales-crm-quick-action-desc">{{ t('salesCrm.new_order_desc') }}</span>
              </div>
              <SvgIcon name="chevron-right" :width="14" :height="14" class="sales-crm-quick-action-arrow" />
            </button>

            <button class="sales-crm-quick-action-btn" data-test="sales-crm-action-new-client" @click="goToNewClient">
              <div class="sales-crm-quick-action-icon" style="background: rgba(82, 196, 26, 0.15); color: #52c41a;">
                <SvgIcon name="users" :width="20" :height="20" />
              </div>
              <div class="sales-crm-quick-action-body">
                <span class="sales-crm-quick-action-title">{{ t('salesCrm.new_client') }}</span>
                <span class="sales-crm-quick-action-desc">{{ t('salesCrm.new_client_desc') }}</span>
              </div>
              <SvgIcon name="chevron-right" :width="14" :height="14" class="sales-crm-quick-action-arrow" />
            </button>

            <button class="sales-crm-quick-action-btn" data-test="sales-crm-action-clients-list" @click="goToClients">
              <div class="sales-crm-quick-action-icon" style="background: rgba(114, 46, 209, 0.15); color: #722ed1;">
                <SvgIcon name="folder" :width="20" :height="20" />
              </div>
              <div class="sales-crm-quick-action-body">
                <span class="sales-crm-quick-action-title">{{ t('salesCrm.clients_list') }}</span>
                <span class="sales-crm-quick-action-desc">{{ t('salesCrm.clients_list_desc') }}</span>
              </div>
              <SvgIcon name="chevron-right" :width="14" :height="14" class="sales-crm-quick-action-arrow" />
            </button>

            <button class="sales-crm-quick-action-btn" data-test="sales-crm-action-orders-list" @click="goToOrders">
              <div class="sales-crm-quick-action-icon" style="background: rgba(245, 106, 0, 0.15); color: #f56a00;">
                <SvgIcon name="shopping-cart" :width="20" :height="20" />
              </div>
              <div class="sales-crm-quick-action-body">
                <span class="sales-crm-quick-action-title">{{ t('salesCrm.orders_list') }}</span>
                <span class="sales-crm-quick-action-desc">{{ t('salesCrm.orders_list_desc') }}</span>
              </div>
              <SvgIcon name="chevron-right" :width="14" :height="14" class="sales-crm-quick-action-arrow" />
            </button>
          </div>
        </GlassPanel>
      </div>

    </template>
  </div>
</template>

<style>
@import '@styles/admin/sales_crm.css';
</style>
