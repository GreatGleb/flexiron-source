<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { useSidebar } from '@/composables/useSidebar'

const { t, locale, availableLocales } = useI18n()
const route = useRoute()
const { close } = useSidebar()

const isAnalyticsActive = computed(() => route.path.startsWith('/admin/analytics'))
const isSuppliersActive = computed(() => route.path.startsWith('/admin/suppliers'))

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
        <a href="#" class="nav-link" data-test="sidebar-nav-items">
          <SvgIcon name="grid-products" class="nav-icon" />
          <span>{{ t('side.items') }}</span>
        </a>
      </li>
      <li>
        <a href="#" class="nav-link" data-test="sidebar-nav-warehouse">
          <SvgIcon name="warehouse-box" class="nav-icon" />
          <span>{{ t('side.warehouse') }}</span>
        </a>
      </li>
      <li>
        <a href="#" class="nav-link" data-test="sidebar-nav-sales">
          <SvgIcon name="staff-user" class="nav-icon" />
          <span>{{ t('side.sales') }}</span>
        </a>
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
        <a href="#" class="nav-link" data-test="sidebar-nav-finance">
          <SvgIcon name="profit-coin" class="nav-icon" />
          <span>{{ t('side.finance') }}</span>
        </a>
      </li>
    </ul>

    <div class="sidebar-footer" data-test="sidebar-footer">
      <div class="user-profile" data-test="sidebar-user">
        <div class="user-avatar">MV</div>
        <div class="user-info">
          <span class="user-name">{{ t('head.user') }}</span>
          <span class="user-role">{{ t('head.role') }}</span>
        </div>
      </div>
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
      <a href="#" class="settings-link" data-test="sidebar-settings">
        <SvgIcon name="settings-gear" class="nav-icon" />
        <span>{{ t('side.settings') }}</span>
      </a>
    </div>
  </aside>
</template>
