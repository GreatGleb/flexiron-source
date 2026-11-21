<template>
  <section id="roadmap" class="landing-section landing-roadmap" data-test="landing-roadmap">
    <div class="landing-container">
      <h2 class="landing-h2" data-reveal>{{ roadmap.title }}</h2>
      <div class="landing-roadmap-grid">
        <div
          v-for="column in columns"
          :key="column.kind"
          :class="['landing-card', 'landing-roadmap-col', `landing-roadmap-col--${column.kind}`]"
          :data-test="`landing-roadmap-${column.kind}`"
          data-reveal
        >
          <h3 class="landing-h3 landing-roadmap-title">{{ column.title }}</h3>
          <ul class="landing-roadmap-list">
            <li v-for="item in column.items" :key="item" class="landing-text landing-roadmap-item">
              {{ item }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/*
 * Секция 12 лендинга — «Что уже есть и что дальше» (слайд 11): две колонки, заголовок
 * «Уже в системе» зелёный (--landing-ok), «В разработке» оранжевый (--landing-accent).
 * Перенос честный, как на слайде (решение 6 плана).
 */
import { computed } from 'vue'
import '@styles/public/landing.css'
import { useLandingContent } from '@/composables/useLandingContent'

const content = useLandingContent()
const roadmap = computed(() => content.value.roadmap)
const columns = computed(
  () =>
    [
      { kind: 'done', ...roadmap.value.done },
      { kind: 'next', ...roadmap.value.next },
    ] as const,
)
</script>
