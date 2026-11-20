<template>
  <section class="landing-section landing-pains" data-test="landing-pains">
    <div class="landing-container">
      <h2 class="landing-h2" data-reveal>{{ pains.title }}</h2>
      <ul class="landing-pains-grid">
        <li
          v-for="item in pains.items"
          :key="item.title"
          class="landing-card landing-pain"
          data-test="landing-pain"
          data-reveal
        >
          <span v-if="item.icon" class="landing-icon-circle landing-icon-circle--accent">
            <LandingIcon :name="item.icon" />
          </span>
          <div>
            <h3 class="landing-h3">{{ item.title }}</h3>
            <p class="landing-text">{{ item.text }}</p>
          </div>
        </li>
      </ul>
      <p class="landing-note" data-test="landing-pains-note">{{ pains.note }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
/*
 * Секция 2 лендинга: четыре потери металлобазы и строка о происхождении продукта
 * (слайд 2 презентации). Кружки иконок — оранжевые, как на слайде.
 */
import '@styles/public/landing.css'
import { landingRu } from '@/content/landing.ru'
import LandingIcon from './LandingIcon.vue'

const pains = landingRu.pains
</script>
