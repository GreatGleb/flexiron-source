<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useNotifications } from '@/composables/useNotifications'
import SvgIcon from './SvgIcon.vue'
import { NOTIFICATION_TYPE_ICONS } from '@/types/notifications'
import type { Notification, NotificationType } from '@/types/notifications'

const { t, locale } = useI18n()
const router = useRouter()

const { unreadCount, markAsRead, markAllAsRead, loadUnreadCount } = useNotifications()

const isOpen = ref(false)
const dropdownItems = ref<Notification[]>([])

// Load top 5 notifications for dropdown — into LOCAL ref, not shared items
async function loadDropdownItems() {
  const { load, items } = useNotifications()
  await load()
  // Keep only top 5 for the dropdown — local copy, avoids mutating shared items
  dropdownItems.value = items.value.slice(0, 5)
}

function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    loadDropdownItems()
  }
}

function close() {
  isOpen.value = false
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.notif-dropdown-wrapper')) {
    close()
  }
}

function onNotificationClick(notification: Notification) {
  if (!notification.isRead) {
    markAsRead(notification.id)
  }
  close()
  router.push({ name: notification.entityRouteName, params: { id: notification.entityId } })
}

function onMarkAllRead() {
  markAllAsRead()
}

function formatTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHrs = Math.floor(diffMs / 3600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return t('notifications.just_now')
  if (diffMin < 60) return t('notifications.minutes_ago', { n: diffMin })
  if (diffHrs < 24) return t('notifications.hours_ago', { n: diffHrs })
  return t('notifications.days_ago', { n: diffDays })
}

function notificationIcon(type: NotificationType): string {
  return NOTIFICATION_TYPE_ICONS[type] || 'bell-notification'
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  loadUnreadCount()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="notif-dropdown-wrapper">
    <button class="notif-btn" data-test="topbar-notifications" @click.stop="toggle">
      <SvgIcon name="bell-notification" />
      <span v-if="unreadCount > 0" class="badge-dot">{{ unreadCount }}</span>
    </button>

    <Transition name="dropdown-fade">
      <div v-if="isOpen" class="notif-dropdown" data-test="notif-dropdown">
        <div class="notif-dropdown-header">
          <span class="notif-dropdown-title">{{ t('notifications.title') }}</span>
        </div>

        <div v-if="dropdownItems.length === 0" class="notif-dropdown-empty">
          {{ t('notifications.empty') }}
        </div>

        <div v-else class="notif-dropdown-list">
          <button
            v-for="notification in dropdownItems"
            :key="notification.id"
            class="notif-item"
            :class="{ 'notif-item--unread': !notification.isRead }"
            @click="onNotificationClick(notification)"
          >
            <div class="notif-item-icon">
              <SvgIcon :name="notificationIcon(notification.type)" :width="18" :height="18" />
            </div>
            <div class="notif-item-content">
              <span class="notif-item-message">{{
                notification.message[locale as keyof typeof notification.message] ||
                notification.message.en
              }}</span>
              <span class="notif-item-time">{{ formatTime(notification.createdAt) }}</span>
            </div>
          </button>
        </div>

        <div class="notif-dropdown-footer">
          <router-link
            :to="{ name: 'admin-notifications' }"
            class="notif-footer-link"
            @click="close"
          >
            <SvgIcon name="list-status" :width="14" :height="14" />
            {{ t('notifications.view_all') }}
          </router-link>
          <button class="notif-footer-btn" @click="onMarkAllRead">
            <SvgIcon name="check" :width="14" :height="14" />
            {{ t('notifications.mark_all_read') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notif-dropdown-wrapper {
  position: relative;
}

.notif-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
}

.notif-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.badge-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-size: 0.625rem;
  font-weight: 700;
  color: #fff;
  background: #ef4444;
  border-radius: 9px;
  line-height: 1;
}

.notif-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px;
  max-height: 480px;
  background: rgba(30, 30, 40, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 500;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notif-dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.notif-dropdown-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #fff;
}

.notif-dropdown-empty {
  padding: 32px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 0.8125rem;
}

.notif-dropdown-list {
  overflow-y: auto;
  flex: 1;
}

.notif-item {
  display: flex;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.notif-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.notif-item--unread {
  background: rgba(59, 130, 246, 0.06);
  border-left: 3px solid #3b82f6;
}

.notif-item-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
}

.notif-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.notif-item-message {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-item--unread .notif-item-message {
  color: #fff;
  font-weight: 600;
}

.notif-item-time {
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.4);
}

.notif-dropdown-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.15);
}

.notif-footer-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: #3b82f6;
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background 0.15s;
}

.notif-footer-link:hover {
  background: rgba(59, 130, 246, 0.1);
}

.notif-footer-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.6);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.notif-footer-btn:hover {
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.08);
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
