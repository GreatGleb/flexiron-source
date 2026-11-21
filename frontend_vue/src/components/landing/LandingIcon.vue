<template>
  <svg
    class="landing-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle v-for="(c, i) in shape.circles" :key="`c${i}`" :cx="c[0]" :cy="c[1]" :r="c[2]" />
    <path v-for="(d, i) in shape.paths" :key="`p${i}`" :d="d" />
  </svg>
</template>

<script setup lang="ts">
/*
 * Иконки лендинга — инлайн SVG (план: без иконок и шрифтов с CDN). Набор — те же
 * пятнадцать смыслов, что у react-icons/fa6 в presentation/build.js, но контурным
 * рисунком 24×24 в духе остальных иконок Flexiron (SvgIcon.vue), а не копией Font Awesome.
 * Record по типу LandingIcon: забытая иконка роняет typecheck, а не рисует пустоту (#17).
 */
import { computed } from 'vue'
import '@styles/public/landing.css'
import type { LandingIcon } from '@/types/landing'

interface IconShape {
  paths: string[]
  circles?: [number, number, number][]
}

const ICONS: Record<LandingIcon, IconShape> = {
  scissors: {
    circles: [
      [6, 6, 3],
      [6, 18, 3],
    ],
    paths: ['M20 4 8.12 15.88', 'M14.47 14.48 20 20', 'M8.12 8.12 12 12'],
  },
  percent: {
    circles: [
      [6.5, 6.5, 2.5],
      [17.5, 17.5, 2.5],
    ],
    paths: ['M19 5 5 19'],
  },
  'boxes-stacked': { paths: ['M3 13h8v8H3z', 'M13 13h8v8h-8z', 'M8 3h8v8H8z'] },
  'envelopes-bulk': { paths: ['M7 5V3h14v11h-3', 'M3 8h14v12H3z', 'M3 9l7 5 7-5'] },
  warehouse: { paths: ['M3 21V9l9-5 9 5v12', 'M7 21v-8h10v8', 'M7 17h10'] },
  'cart-shopping': {
    circles: [
      [9, 21, 1],
      [20, 21, 1],
    ],
    paths: ['M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6'],
  },
  truck: {
    circles: [
      [5.5, 18.5, 2.5],
      [18.5, 18.5, 2.5],
    ],
    paths: ['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7z'],
  },
  'money-bill-wave': {
    circles: [[12, 12, 3]],
    paths: [
      'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
      'M6 12h.01M18 12h.01',
    ],
  },
  'chart-line': { paths: ['M3 3v18h18', 'M7 15l4-4 3 3 6-6'] },
  hammer: {
    paths: [
      'M15 12l-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9',
      'M17.64 15 22 10.64',
      'M20.91 11.7l-1.25-1.25a3.2 3.2 0 0 1-.93-2.25v-.86L16 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91',
    ],
  },
  'clock-rotate-left': { paths: ['M3 12a9 9 0 1 0 3-6.7L3 8', 'M3 3v5h5', 'M12 7v5l4 2'] },
  users: {
    circles: [[9, 7, 4]],
    paths: [
      'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
      'M23 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75',
    ],
  },
  'list-check': { paths: ['M3 6l2 2 3-3', 'M3 13l2 2 3-3', 'M11 7h10', 'M11 14h10', 'M11 20h10'] },
  'ruler-horizontal': {
    paths: [
      'M3 8h18a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z',
      'M6 8v3M10 8v4M14 8v3M18 8v4',
    ],
  },
  language: {
    circles: [[12, 12, 10]],
    paths: [
      'M2 12h20',
      'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    ],
  },
}

const props = withDefaults(defineProps<{ name: LandingIcon; size?: number }>(), { size: 24 })

const shape = computed(() => ICONS[props.name])
</script>
