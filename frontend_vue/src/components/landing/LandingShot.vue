<template>
  <figure class="landing-shot" data-test="landing-shot">
    <div class="landing-shot-window">
      <div class="landing-shot-bar" aria-hidden="true">
        <span class="landing-shot-dot" />
        <span class="landing-shot-dot" />
        <span class="landing-shot-dot" />
      </div>
      <img
        class="landing-shot-img"
        :src="image.src"
        :alt="image.alt"
        :width="image.width"
        :height="image.height"
        :loading="lazy ? 'lazy' : 'eager'"
        decoding="async"
      />
    </div>
    <figcaption v-if="caption" class="landing-shot-caption">{{ caption }}</figcaption>
  </figure>
</template>

<script setup lang="ts">
/*
 * Скриншот в рамке «окно программы» (план, «Дизайн»): стекло, радиус, тень, полоса с тремя
 * точками сверху. Клик не нужен. width/height — натуральный размер файла, чтобы место
 * под картинку было занято до загрузки; ниже первого экрана — lazy (решение 8).
 * Используется hero (L-04) и секциями фич (L-05).
 */
import '@styles/public/landing.css'
import type { LandingImage } from '@/types/landing'

withDefaults(defineProps<{ image: LandingImage; caption?: string; lazy?: boolean }>(), {
  caption: '',
  lazy: true,
})
</script>
