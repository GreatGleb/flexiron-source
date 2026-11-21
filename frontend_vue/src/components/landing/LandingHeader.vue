<template>
  <header
    class="landing-header"
    :class="{ 'landing-header--scrolled': scrolled, 'landing-header--menu-open': menuOpen }"
    data-test="landing-header"
  >
    <div class="landing-header-inner">
      <router-link :to="LANDING_PATH[lang]" class="landing-header-logo">
        <img :src="logoUrl" :alt="header.logoAlt" width="180" height="24" />
      </router-link>

      <button
        ref="toggleEl"
        type="button"
        class="landing-header-toggle"
        :aria-expanded="menuOpen ? 'true' : 'false'"
        aria-controls="landing-header-menu"
        :aria-label="header.menuLabel"
        data-test="landing-menu-toggle"
        @click="toggleMenu"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            v-if="menuOpen"
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <path
            v-else
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>

      <div id="landing-header-menu" class="landing-header-menu" data-test="landing-menu">
        <nav class="landing-header-nav">
          <a
            v-for="item in header.nav"
            :key="item.anchor"
            :href="`#${item.anchor}`"
            class="landing-header-link"
            data-test="landing-nav-link"
            @click="closeMenu"
          >
            {{ item.label }}
          </a>
        </nav>
        <div class="landing-header-actions">
          <nav class="landing-lang" :aria-label="header.langLabel" data-test="landing-lang">
            <router-link
              v-for="code in SWITCHER_LANGS"
              :key="code"
              :to="LANDING_PATH[code]"
              :class="['landing-lang-link', { 'landing-lang-link--active': code === lang }]"
              :aria-current="code === lang ? 'page' : undefined"
              :lang="code"
              :data-test="`landing-lang-${code}`"
              @click="closeMenu"
            >
              {{ code.toUpperCase() }}
            </router-link>
          </nav>
          <router-link
            :to="header.login.to"
            class="landing-btn landing-btn--ghost"
            data-test="landing-login"
            @click="closeMenu"
          >
            {{ header.login.label }}
          </router-link>
          <a
            :href="`#${header.cta.anchor}`"
            class="landing-btn landing-btn--primary"
            data-test="landing-header-cta"
            @click="closeMenu"
          >
            {{ header.cta.label }}
          </a>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import '@styles/public/landing.css'
import logoUrl from '@/assets/images/Flexiron_Logo_White.svg'
import {
  LANDING_PATH,
  SWITCHER_LANGS,
  useLandingContent,
  useLandingLang,
} from '@/composables/useLandingContent'

/** Порог прокрутки, после которого шапка получает стеклянный фон (план, «Движение»). */
const SCROLL_THRESHOLD = 8

const lang = useLandingLang()
const content = useLandingContent()
const header = computed(() => content.value.header)
const scrolled = ref(false)
const menuOpen = ref(false)
const toggleEl = ref<HTMLElement | null>(null)

function onScroll() {
  scrolled.value = window.scrollY > SCROLL_THRESHOLD
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !menuOpen.value) return
  closeMenu()
  toggleEl.value?.focus()
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('keydown', onKeydown)
})
</script>
