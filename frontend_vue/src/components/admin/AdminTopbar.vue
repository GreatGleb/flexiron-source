<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import SvgIcon from './SvgIcon.vue'
import NotificationDropdown from './NotificationDropdown.vue'
import { useSidebar } from '@/composables/useSidebar'
import { useAuth } from '@/composables/useAuth'

const { t, locale, availableLocales } = useI18n()
const { toggle } = useSidebar()
const { user: authUser, logout: authLogout } = useAuth()
const router = useRouter()

const isMenuOpen = ref(false)

const userName = computed(() => {
  if (!authUser.value) return t('head.user')
  if (authUser.value.first_name && authUser.value.last_name)
    return `${authUser.value.first_name} ${authUser.value.last_name}`
  if (authUser.value.first_name) return authUser.value.first_name
  return t('head.user')
})

const userRole = computed(() => {
  if (!authUser.value?.role) return t('head.role')
  return t(`settingsUsers.role_${authUser.value.role}`)
})

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})

function handleOutsideClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.user-profile')) {
    isMenuOpen.value = false
  }
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

function closeMenu() {
  isMenuOpen.value = false
}

function goToSettings() {
  closeMenu()
  router.push({ name: 'admin-settings-profile' })
}

async function handleLogout() {
  closeMenu()
  await authLogout('/')
}

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
      <div class="user-profile" data-test="topbar-user" @click.stop="toggleMenu">
        <div class="user-avatar">
          <SvgIcon name="user-avatar" width="22" height="22" />
        </div>
        <div class="user-info">
          <span class="user-name">{{ userName }}</span>
          <span class="user-role">{{ userRole }}</span>
        </div>

        <Transition name="dropdown-fade">
          <div v-if="isMenuOpen" class="user-dropdown" @click.stop>
            <button class="user-dropdown-item" @click="goToSettings">
              <SvgIcon name="settings" width="16" height="16" />
              {{ t('head.settings') }}
            </button>
            <div class="user-dropdown-divider" />
            <button class="user-dropdown-item logout" @click="handleLogout">
              <SvgIcon name="corner-up-left" width="16" height="16" />
              {{ t('head.logout') }}
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </header>
</template>

<style scoped>
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
