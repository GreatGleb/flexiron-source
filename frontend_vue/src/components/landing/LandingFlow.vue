<template>
  <section id="flow" class="landing-section landing-flow" data-test="landing-flow">
    <div class="landing-container">
      <h2 class="landing-h2" data-reveal>{{ flow.title }}</h2>
      <ol class="landing-flow-steps">
        <li
          v-for="step in flow.steps"
          :key="step.title"
          class="landing-flow-step"
          :class="{ 'landing-flow-step--accent': step.accent }"
          data-test="landing-flow-step"
          data-reveal
        >
          <span
            v-if="step.icon"
            class="landing-icon-circle landing-icon-circle--lg"
            :class="step.accent ? 'landing-icon-circle--accent' : 'landing-icon-circle--primary'"
            data-test="landing-flow-step-icon"
          >
            <LandingIcon :name="step.icon" :size="28" />
          </span>
          <h3 class="landing-h3 landing-flow-step-title">{{ step.title }}</h3>
          <p class="landing-text landing-flow-step-text">{{ step.text }}</p>
          <span class="landing-flow-arrow" aria-hidden="true" />
        </li>
      </ol>
      <div class="landing-card landing-flow-note" data-test="landing-flow-note" data-reveal>
        <span class="landing-icon-circle landing-icon-circle--dark">
          <LandingIcon :name="flow.note.icon" />
        </span>
        <p class="landing-text">
          <strong class="landing-flow-note-lead">{{ flow.note.lead }}</strong>
          {{ flow.note.text }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/*
 * Секция 3 лендинга: один контур от закупки до оплаты (слайд 3 презентации). Шаг с
 * accent (резка) — акцентом --landing-accent, остальные — var(--primary). Стрелка между
 * шагами — у каждого шага, кроме последнего (скрывается в CSS).
 */
import '@styles/public/landing.css'
import { landingRu } from '@/content/landing.ru'
import LandingIcon from './LandingIcon.vue'

const flow = landingRu.flow
</script>
