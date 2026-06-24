<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useNotifications } from '@/composables/useNotifications'
import { NOTIFICATION_TYPE_ICONS } from '@/types/notifications'
import type { Notification, NotificationType } from '@/types/notifications'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import Breadcrumb from '@/components/admin/Breadcrumb.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import CustomSelect from '@/components/admin/ui/CustomSelect.vue'
import SearchInput from '@/components/admin/ui/SearchInput.vue'

import '@styles/admin/components/_pagination.css'
import '@styles/admin/orders_list.css'

const { t, locale } = useI18n()
const router = useRouter()

useHead({
  title: () => `Flexiron — ${t('notifications.page_title')}`,
  description: () => t('notifications.page_title'),
})

const { items, loading, error, filters, pagination, load, markAsRead, markAllAsRead } =
  useNotifications()

// ─── Type filter options ───
const TYPE_OPTIONS = computed(() => [
  { value: 'all', label: t('notifications.filter_type_all') },
  { value: 'order_status', label: t('notifications.type_order_status') },
  { value: 'stock_deficit', label: t('notifications.type_stock_deficit') },
  { value: 'supplier_response', label: t('notifications.type_supplier_response') },
  { value: 'batch_received', label: t('notifications.type_batch_received') },
  { value: 'reserve_expiring', label: t('notifications.type_reserve_expiring') },
  { value: 'payment_overdue', label: t('notifications.type_payment_overdue') },
  { value: 'payment_received', label: t('notifications.type_payment_received') },
  { value: 'warehouse_ready', label: t('notifications.type_warehouse_ready') },
])

// ─── Status filter options ───
const STATUS_OPTIONS = computed(() => [
  { value: 'all', label: t('notifications.filter_status_all') },
  { value: 'unread', label: t('notifications.filter_status_unread') },
  { value: 'read', label: t('notifications.filter_status_read') },
])

const statusFilter = computed({
  get: () => {
    if (filters.isRead === true) return 'read'
    if (filters.isRead === false) return 'unread'
    return 'all'
  },
  set: (v: string) => {
    if (v === 'read') filters.isRead = true
    else if (v === 'unread') filters.isRead = false
    else filters.isRead = null
  },
})

// ─── Search with debounce ───
const searchInput = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchInput, (v) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filters.search = v
  }, 300)
})

// ─── Pagination ───
const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
]

const pageSizeStr = computed({
  get: () => String(pagination.pageSize.value),
  set: (v: string) => {
    pagination.pageSize.value = Number(v)
    pagination.reset()
  },
})

function notificationIcon(type: NotificationType): string {
  return NOTIFICATION_TYPE_ICONS[type] || 'bell-notification'
}

function onRowClick(notification: Notification) {
  if (!notification.isRead) {
    markAsRead(notification.id)
  }
  router.push({ name: notification.entityRouteName, params: { id: notification.entityId } })
}

async function handleMarkAllRead() {
  await markAllAsRead()
  load()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

function toggleSort() {
  if (filters.sortBy === 'createdAt') {
    filters.sortDir = filters.sortDir === 'asc' ? 'desc' : 'asc'
  } else {
    filters.sortBy = 'createdAt'
    filters.sortDir = 'desc'
  }
}

onMounted(() => {
  load()
})
</script>

<template>
  <div class="page-orders" data-test="page-notifications">
    <Breadcrumb
      :items="[
        { label: t('side.analytics'), to: { name: 'admin-dashboard' } },
        { label: t('notifications.page_title') },
      ]"
    />
    <div class="page-header" data-test="notifications-header">
      <h1 class="page-title">{{ t('notifications.page_title') }}</h1>
      <div class="entity-action-bar no-margin pos-static">
        <button class="btn btn-secondary" @click="handleMarkAllRead">
          <SvgIcon name="check" :width="16" :height="16" />
          <span>{{ t('notifications.mark_all_read') }}</span>
        </button>
      </div>
    </div>

    <div class="filters-bar" data-test="notifications-filters">
      <div class="filters-bar-header">
        <span>{{ t('notifications.filter_type') }}</span>
      </div>
      <div class="filters-bar-content">
        <div class="filter-group" data-test="notifications-filter-search">
          <label class="field-label">{{ t('notifications.col_message') }}</label>
          <SearchInput
            v-model="searchInput"
            :placeholder="t('notifications.col_message')"
            data-test="notifications-search"
          />
        </div>
        <div class="filter-group" data-test="notifications-filter-type">
          <label class="field-label">{{ t('notifications.filter_type') }}</label>
          <CustomSelect v-model="filters.type" :options="TYPE_OPTIONS" />
        </div>
        <div class="filter-group" data-test="notifications-filter-status">
          <label class="field-label">{{ t('notifications.filter_status') }}</label>
          <CustomSelect v-model="statusFilter" :options="STATUS_OPTIONS" />
        </div>
      </div>
    </div>

    <GlassPanel :loading="loading" :skeleton-rows="8" data-test="notifications-table">
      <div v-if="error && !loading" class="error-state" data-test="notifications-error">
        <SvgIcon name="alert-triangle" :width="48" :height="48" />
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="load">{{ t('orders.btn_retry') }}</button>
      </div>

      <div
        v-else-if="!loading && items.length === 0"
        class="empty-state"
        data-test="notifications-empty"
      >
        <SvgIcon name="bell-notification" :width="48" :height="48" />
        <p>{{ t('notifications.empty') }}</p>
      </div>

      <div v-else class="data-table-wrapper">
        <table class="data-table">
          <colgroup>
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>{{ t('notifications.col_type') }}</th>
              <th>{{ t('notifications.col_message') }}</th>
              <th>
                <button class="th-sort-btn" @click="toggleSort">
                  {{ t('notifications.col_date') }}
                  <span class="sort-icon-group">
                    <SvgIcon
                      name="chevron-up"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'createdAt' && filters.sortDir === 'asc',
                      }"
                    />
                    <SvgIcon
                      name="chevron-down"
                      :width="16"
                      :height="16"
                      class="sort-icon"
                      :class="{
                        active: filters.sortBy === 'createdAt' && filters.sortDir === 'desc',
                      }"
                    />
                  </span>
                </button>
              </th>
              <th>{{ t('notifications.col_status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="notification in items"
              :key="notification.id"
              class="notif-row"
              :class="{ 'notif-row--unread': !notification.isRead }"
              data-test="notifications-row"
              @click="onRowClick(notification)"
            >
              <td>
                <div class="notif-type-cell">
                  <SvgIcon :name="notificationIcon(notification.type)" :width="18" :height="18" />
                  <span>{{ t(`notifications.type_${notification.type}`) }}</span>
                </div>
              </td>
              <td>
                <span class="notif-message">{{
                  notification.message[locale as keyof typeof notification.message] ||
                  notification.message.en
                }}</span>
              </td>
              <td class="notif-date">{{ formatDate(notification.createdAt) }}</td>
              <td>
                <span v-if="!notification.isRead" class="status-pill status-pill--unread">
                  {{ t('notifications.status_unread') }}
                </span>
                <span v-else class="text-muted">
                  {{ t('notifications.status_read') }}
                </span>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="pagination.total.value > 0">
            <tr>
              <td colspan="4">
                <div class="pagination-bar" data-test="notifications-pagination">
                  <div class="page-size" data-test="notifications-page-size">
                    <span>{{ t('orders.page_size') }}</span>
                    <CustomSelect
                      v-model="pageSizeStr"
                      :options="PAGE_SIZE_OPTIONS"
                      :open-up="true"
                      class="custom-select-sm"
                    />
                  </div>
                  <div class="pagination-nav">
                    <button
                      class="btn btn-icon btn-sm"
                      :disabled="!pagination.hasPrev.value"
                      :style="{ display: pagination.totalPages.value <= 1 ? 'none' : 'flex' }"
                      @click="pagination.prev()"
                    >
                      <SvgIcon
                        name="chevron-right"
                        :width="14"
                        :height="14"
                        style="transform: rotate(180deg)"
                      />
                    </button>
                    <div class="pagination-pages">
                      <template v-for="(p, i) in pagination.pageNumbers()" :key="i">
                        <span v-if="p === '...'" class="pagination-ellipsis">...</span>
                        <button
                          v-else
                          class="page-btn"
                          :class="{ active: p === pagination.page.value }"
                          @click="pagination.goTo(p as number)"
                        >
                          {{ p }}
                        </button>
                      </template>
                    </div>
                    <button
                      class="btn btn-icon btn-sm"
                      :disabled="!pagination.hasNext.value"
                      :style="{ display: pagination.totalPages.value <= 1 ? 'none' : 'flex' }"
                      @click="pagination.next()"
                    >
                      <SvgIcon name="chevron-right" :width="14" :height="14" />
                    </button>
                  </div>
                  <div class="pagination-info">
                    <span>{{ pagination.showingFrom.value }}-{{ pagination.showingTo.value }}</span>
                    <span>&nbsp;{{ t('orders.of') }}&nbsp;</span>
                    <span>{{ pagination.total.value }}</span>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </GlassPanel>
  </div>
</template>

<style>
.notif-row {
  cursor: pointer;
  transition: background 0.15s;
}

.notif-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.notif-row--unread {
  border-left: 3px solid #3b82f6;
}

.notif-row--unread td:first-child {
  padding-left: 13px;
}

.notif-type-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8125rem;
}

.notif-message {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
}

.notif-row--unread .notif-message {
  color: #fff;
  font-weight: 600;
}

.notif-date {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
}

.status-pill--unread {
  display: inline-block;
  padding: 2px 10px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.12);
  border-radius: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.text-muted {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.4);
}
</style>
