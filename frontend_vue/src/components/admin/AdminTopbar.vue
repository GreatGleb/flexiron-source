<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import SvgIcon from './SvgIcon.vue'
import NotificationDropdown from './NotificationDropdown.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useSettings } from '@/composables/useSettings'

const { t, locale, availableLocales } = useI18n()
const { toggle } = useSidebar()
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
      <NotificationDropdown />
      <router-link :to="{ name: 'admin-settings-profile' }" class="user-profile" data-test="topbar-user">
        <div class="user-avatar">
          <SvgIcon name="user-avatar" width="22" height="22" />
        </div>
        <div class="user-info">
          <span class="user-name">{{ userName }}</span>
          <span class="user-role">{{ userRole }}</span>
        </div>
      </router-link>
    </div>
  </header>
</template>
