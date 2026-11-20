<template>
  <section
    class="landing-section landing-feature"
    :class="[
      `landing-feature--shot-${feature.shotSide}`,
      { 'landing-feature--dark': feature.dark },
    ]"
    :data-test="testId"
  >
    <div class="landing-container landing-feature-inner">
      <div class="landing-feature-body">
        <h2 class="landing-h2 landing-feature-title">{{ feature.title }}</h2>

        <ol v-if="feature.steps" class="landing-feature-steps">
          <li
            v-for="(step, index) in feature.steps"
            :key="step"
            class="landing-feature-step"
            data-test="landing-feature-step"
          >
            <span class="landing-feature-step-num" aria-hidden="true">{{ index + 1 }}</span>
            <p class="landing-text">{{ step }}</p>
          </li>
        </ol>

        <ul
          v-if="feature.points"
          class="landing-feature-points"
          :class="{ 'landing-feature-points--cards': feature.pointsAsCards }"
        >
          <li
            v-for="point in feature.points"
            :key="point.title"
            class="landing-feature-point"
            :class="{ 'landing-card': feature.pointsAsCards }"
            data-test="landing-feature-point"
          >
            <span v-if="point.icon" class="landing-icon-circle landing-icon-circle--primary">
              <LandingIcon :name="point.icon" />
            </span>
            <div>
              <h3 class="landing-h3 landing-feature-point-title">{{ point.title }}</h3>
              <p class="landing-text">{{ point.text }}</p>
            </div>
          </li>
        </ul>

        <p
          v-if="feature.note"
          :class="feature.dark ? 'landing-feature-plaque' : 'landing-note'"
          data-test="landing-feature-note"
        >
          {{ feature.note }}
        </p>
      </div>

      <LandingShot class="landing-feature-shot" :image="feature.image" />
    </div>
  </section>
</template>

<script setup lang="ts">
/*
 * Секции 4–10 лендинга (план roo_code/plans/landing/landing-plan.md, «Структура страницы»):
 * один компонент на все фичи — данные из landingRu.features и landingRu.config, отдельные
 * компоненты на фичу запрещены (Л5). Что рисовать, решают поля данных, а не id:
 *   steps         — нумерованные шаги (резка, слайд 5);
 *   points        — пункты с заголовком, с иконкой, если она задана;
 *   pointsAsCards — пункты карточками (деньги заказа, слайд 7);
 *   note          — у тёмной секции плашка (обрезок, слайд 5), у остальных сноска (слайд 6);
 *   shotSide      — сторона скриншота на широком экране; в DOM текст всегда первым,
 *                   чтобы порядок чтения не зависел от чередования;
 *   dark          — тёмная акцентная секция (резка).
 * Скриншот — ниже первого экрана, поэтому LandingShot с lazy по умолчанию (решение 8).
 * Надзаголовка у фич нет: в презентации его нет, и в landing.ru.ts он не заведён (L-01).
 */
import { computed } from 'vue'
import '@styles/public/landing.css'
import type { LandingFeature } from '@/types/landing'
import LandingIcon from './LandingIcon.vue'
import LandingShot from './LandingShot.vue'

const props = defineProps<{ feature: LandingFeature }>()

/** data-test по таблице плана: секция 10 — landing-config, остальные — landing-feature-<id>. */
const testId = computed(() =>
  props.feature.id === 'config' ? 'landing-config' : `landing-feature-${props.feature.id}`,
)
</script>
