<template>
  <section class="landing-section landing-hero" data-test="landing-hero">
    <div class="landing-container landing-hero-inner">
      <div class="landing-hero-text">
        <p class="landing-eyebrow" data-test="landing-hero-eyebrow" data-reveal="load">
          {{ hero.eyebrow }}
        </p>
        <h1 class="landing-hero-title" data-reveal="load">{{ hero.title }}</h1>
        <p class="landing-hero-subtitle" data-reveal="load">{{ hero.subtitle }}</p>
        <div class="landing-hero-actions" data-reveal="load">
          <a
            :href="`#${hero.ctaLead.anchor}`"
            class="landing-btn landing-btn--primary"
            data-test="landing-hero-lead"
          >
            {{ hero.ctaLead.label }}
          </a>
          <router-link
            :to="hero.ctaDemo.to"
            class="landing-btn landing-btn--ghost"
            data-test="landing-hero-demo"
            @click="prepareDemoLang"
          >
            {{ hero.ctaDemo.label }}
          </router-link>
        </div>
      </div>
      <LandingShot
        class="landing-hero-shot"
        :image="hero.image"
        :caption="hero.caption"
        :lazy="false"
        data-reveal="load"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
/*
 * Секция 1 лендинга (план, таблица «Структура страницы»; слайд 1 презентации).
 * Единственный h1 страницы. «Заказать показ» — якорь на форму заявки, «Открыть демо» —
 * переход в демо по-русски (решение 3, useLandingDemoLang). Скриншот на первом экране —
 * без lazy.
 */
import '@styles/public/landing.css'
import { landingRu } from '@/content/landing.ru'
import { useLandingDemoLang } from '@/composables/useLandingDemoLang'
import LandingShot from './LandingShot.vue'

const hero = landingRu.hero
const { prepareDemoLang } = useLandingDemoLang()
</script>
