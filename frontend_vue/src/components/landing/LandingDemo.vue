<template>
  <section class="landing-section landing-demo" data-test="landing-demo">
    <div class="landing-container">
      <div class="landing-demo-strip" data-reveal>
        <div class="landing-demo-text">
          <h2 class="landing-h2 landing-demo-title">{{ demo.title }}</h2>
          <p class="landing-text">{{ demo.text }}</p>
        </div>
        <router-link
          :to="demo.cta.to"
          class="landing-btn landing-btn--primary"
          data-test="landing-demo-open"
        >
          {{ demo.cta.label }}
        </router-link>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/*
 * Секция 11 лендинга — полоса «Посмотрите сами» (план, таблица «Структура страницы»).
 * Кнопка ведёт в демо тем же механизмом языка, что и кнопка hero (решение 3,
 * useLandingAppLang в LandingPage) — второго правила здесь нет.
 */
import { computed } from 'vue'
import '@styles/public/landing.css'
import { useLandingContent } from '@/composables/useLandingContent'

const content = useLandingContent()
const demo = computed(() => content.value.demo)
</script>
