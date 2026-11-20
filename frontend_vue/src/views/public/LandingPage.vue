<template>
  <div class="page-landing" data-test="page-landing">
    <LandingHeader />

    <main class="landing-main">
      <LandingHero />
      <LandingPains />
      <LandingFlow />
      <div id="features" class="landing-features">
        <LandingFeature v-for="feature in content.features" :key="feature.id" :feature="feature" />
        <LandingConfig />
      </div>
      <LandingDemo />
      <LandingRoadmap />
      <LandingLeadForm />
    </main>

    <LandingFooter />
  </div>
</template>

<script setup lang="ts">
/*
 * Каркас лендинга (L-03): секции 0–14 в порядке таблицы плана
 * roo_code/plans/landing/landing-plan.md. Секции 1–3 — компоненты L-04 (единственный h1
 * страницы — в LandingHero). Секции 4–9 — LandingFeature по landingRu.features, секция 10 —
 * LandingConfig (L-05). Секции 11–13 — LandingDemo, LandingRoadmap, LandingLeadForm (L-06).
 *
 * id="features" — обёртка секций 4–10: на неё ведёт пункт шапки «Возможности».
 */
import { onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { landingRu } from '@/content/landing.ru'
import LandingHeader from '@/components/landing/LandingHeader.vue'
import LandingFooter from '@/components/landing/LandingFooter.vue'
import LandingHero from '@/components/landing/LandingHero.vue'
import LandingPains from '@/components/landing/LandingPains.vue'
import LandingFlow from '@/components/landing/LandingFlow.vue'
import LandingFeature from '@/components/landing/LandingFeature.vue'
import LandingConfig from '@/components/landing/LandingConfig.vue'
import LandingDemo from '@/components/landing/LandingDemo.vue'
import LandingRoadmap from '@/components/landing/LandingRoadmap.vue'
import LandingLeadForm from '@/components/landing/LandingLeadForm.vue'
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
