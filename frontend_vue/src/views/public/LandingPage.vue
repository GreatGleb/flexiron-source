<template>
  <div class="page-landing" data-test="page-landing">
    <LandingHeader />

    <main class="landing-main">
      <section class="landing-section" data-test="landing-hero">
        <div class="landing-container">
          <h1>{{ content.hero.title }}</h1>
        </div>
      </section>
      <section class="landing-section" data-test="landing-pains"></section>
      <section id="flow" class="landing-section" data-test="landing-flow"></section>
      <div id="features" class="landing-features">
        <section class="landing-section" data-test="landing-feature-warehouse"></section>
        <section class="landing-section" data-test="landing-feature-cutting"></section>
        <section class="landing-section" data-test="landing-feature-order"></section>
        <section class="landing-section" data-test="landing-feature-money"></section>
        <section class="landing-section" data-test="landing-feature-suppliers"></section>
        <section class="landing-section" data-test="landing-feature-analytics"></section>
        <section class="landing-section" data-test="landing-config"></section>
      </div>
      <section class="landing-section" data-test="landing-demo"></section>
      <section id="roadmap" class="landing-section" data-test="landing-roadmap"></section>
      <section id="lead" class="landing-section" data-test="landing-lead"></section>
    </main>

    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
/*
 * Каркас лендинга (L-03): секции 0–14 в порядке таблицы плана
 * roo_code/plans/landing/landing-plan.md. Содержимое секций 1–13 дописывают L-04…L-06;
 * h1 в hero стоит уже сейчас, чтобы у страницы был заголовок (navigation/smoke его ждут),
 * — L-04 заменит его компонентом LandingHero.
 *
 * id="features" — обёртка секций 4–10: на неё ведёт пункт шапки «Возможности».
 */
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { landingRu } from '@/content/landing.ru'
import LandingHeader from '@/components/landing/LandingHeader.vue'
import LandingFooter from '@/components/landing/LandingFooter.vue'
import '@styles/public/landing.css'

/** Язык текстов лендинга — только русский на первом этапе (решения 1 и 2 плана). */
const LANDING_LANG = 'ru'

const content = landingRu
const { locale } = useI18n()

useHead({ title: content.seo.title, description: content.seo.description })

onMounted(() => {
  document.documentElement.lang = LANDING_LANG
})

onUnmounted(() => {
  document.documentElement.lang = locale.value
})
</script>
