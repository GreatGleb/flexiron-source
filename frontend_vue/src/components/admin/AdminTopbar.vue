<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SvgIcon from './SvgIcon.vue'
import { useSidebar } from '@/composables/useSidebar'

const { t, locale, availableLocales } = useI18n()
const { toggle } = useSidebar()

function switchLang(code: string) {
  locale.value = code
  localStorage.setItem('flexiron_lang', code)
  document.documentElement.lang = code
}
</script>

<template>
  <header class="topbar" data-test="topbar-root">
    <button class="menu-toggle" data-test="topbar-menu-toggle" @click.stop="toggle">
      <SvgIcon name="menu-bars" :width="24" :height="24" />
    </button>

    <div class="topbar-right">
      <div class="search-wrap">
        <SvgIcon name="search" class="search-icon" />
        <input type="text" data-test="topbar-search" :placeholder="t('head.search')" />
      </div>
      <div class="lang-switcher" data-test="topbar-lang-switcher">
        <a
          v-for="code in availableLocales"
          :key="code"
          href="#"
          class="lang-btn"
          :data-test="`topbar-lang-${code}`"
          :class="{ active: locale === code }"
          @click.prevent="switchLang(code)"
        >
          {{ code.toUpperCase() }}
        </a>
      </div>
      <button class="notif-btn" data-test="topbar-notifications">
        <SvgIcon name="bell-notification" />
        <span class="badge-dot"></span>
      </button>
      <div class="user-profile" data-test="topbar-user">
        <div class="user-avatar">MV</div>
        <div class="user-info">
          <span class="user-name">{{ t('head.user') }}</span>
          <span class="user-role">{{ t('head.role') }}</span>
        </div>
      </div>
    </div>
  </header>
</template>
