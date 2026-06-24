<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useSettings } from '@/composables/useSettings'

const { t, locale, availableLocales } = useI18n()
const route = useRoute()
const { close } = useSidebar()
const { settings, load: loadSettings } = useSettings()

const userName = computed(() => {
  const p = settings.profile
  if (p.firstName && p.lastName) return `${p.firstName} ${p.lastName}`
  if (p.firstName) return p.firstName
  return t('head.user')
})

const userRole = computed(() => {
  const role = settings.profile.role
  return role ? t(`settingsUsers.role_${role}`) : t('head.role')
})

const isAnalyticsActive = computed(() => route.path.startsWith('/admin/analytics'))
const isSuppliersActive = computed(() => route.path.startsWith('/admin/suppliers'))
const isProductsActive = computed(() => route.path.startsWith('/admin/products'))
const isWarehouseActive = computed(() => route.path.startsWith('/admin/warehouse'))
const isSalesCrmActive = computed(
  () =>
    route.path.startsWith('/admin/sales-crm') ||
    route.path.startsWith('/admin/clients') ||
    route.path.startsWith('/admin/orders'),
)
const isFinanceActive = computed(() => route.path.startsWith('/admin/finance'))
const isSettingsActive = computed(() => route.path.startsWith('/admin/settings'))

onMounted(() => {
  loadSettings()
})

function switchLang(code: string) {
  locale.value = code
  localStorage.setItem('flexiron_lang', code)
  document.documentElement.lang = code
}
</script>

<template>
  <aside class="sidebar" data-test="sidebar-root">
    <div class="logo-wrap">
      <button class="sidebar-close" data-test="sidebar-close-btn" @click="close">
        <SvgIcon name="x-close" :width="24" :height="24" />
      </button>
      <a class="logo-link" href="#" data-test="sidebar-logo">
        <img class="logo-img" src="@images/Flexiron_Logo_White.svg" alt="Flexiron" />
      </a>
    </div>

    <ul class="nav" data-test="sidebar-nav">
      <li>
        <router-link
          to="/admin/analytics/dashboard"
          class="nav-link"
          data-test="sidebar-nav-analytics"
          :class="{ active: isAnalyticsActive }"
        >
          <SvgIcon name="pie-chart" class="nav-icon" />
          <span>{{ t('side.analytics') }}</span>
        </router-link>
      </li>

      <div class="nav-group-label">{{ t('side.modules') }}</div>

      <li>
        <router-link
          :to="{ name: 'admin-products' }"
          class="nav-link"
          data-test="sidebar-nav-items"
          :class="{ active: isProductsActive }"
        >
          <SvgIcon name="tag" class="nav-icon" />
          <span>{{ t('side.items') }}</span>
        </router-link>
      </li>
      <li>
        <router-link
          :to="{ name: 'admin-warehouse' }"
          class="nav-link"
          data-test="sidebar-nav-warehouse"
          :class="{ active: isWarehouseActive }"
        >
          <SvgIcon name="warehouse-box" class="nav-icon" />
          <span>{{ t('side.warehouse') }}</span>
        </router-link>
      </li>
      <li>
        <router-link
          :to="{ name: 'admin-sales-crm' }"
          class="nav-link"
          data-test="sidebar-nav-sales"
          :class="{ active: isSalesCrmActive }"
        >
          <SvgIcon name="staff-user" class="nav-icon" />
          <span>{{ t('side.sales') }}</span>
        </router-link>
      </li>
      <li>
        <router-link
          to="/admin/suppliers"
          class="nav-link"
          data-test="sidebar-nav-suppliers"
          :class="{ active: isSuppliersActive }"
        >
          <SvgIcon name="warehouse-box" class="nav-icon" />
          <span>{{ t('side.suppliers') }}</span>
        </router-link>
      </li>
      <li>
        <router-link
          to="/admin/finance/incoming"
          class="nav-link"
          data-test="sidebar-nav-finance"
          :class="{ active: isFinanceActive }"
        >
          <SvgIcon name="profit-coin" class="nav-icon" />
          <span>{{ t('side.finance') }}</span>
        </router-link>
      </li>
    </ul>

    <div class="sidebar-footer" data-test="sidebar-footer">
      <router-link
        :to="{ name: 'admin-settings-profile' }"
        class="user-profile"
        data-test="sidebar-user"
      >
        <div class="user-avatar">
          <SvgIcon name="user-avatar" width="22" height="22" />
        </div>
        <div class="user-info">
          <span class="user-name">{{ userName }}</span>
          <span class="user-role">{{ userRole }}</span>
        </div>
      </router-link>
      <div class="lang-switcher" data-test="sidebar-lang-switcher">
        <a
          v-for="code in availableLocales"
          :key="code"
          href="#"
          class="lang-btn"
          :data-test="`sidebar-lang-${code}`"
          :class="{ active: locale === code }"
          @click.prevent="switchLang(code)"
        >
          {{ code.toUpperCase() }}
        </a>
      </div>
      <router-link
        :to="{ name: 'admin-settings-profile' }"
        class="settings-link"
        data-test="sidebar-settings"
        :class="{ active: isSettingsActive }"
      >
        <SvgIcon name="settings-gear" class="nav-icon" />
        <span>{{ t('side.settings') }}</span>
      </router-link>
    </div>
  </aside>
</template>
