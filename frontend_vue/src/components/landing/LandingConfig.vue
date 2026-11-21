<template>
  <LandingFeature :feature="content.config" />
</template>

<script setup lang="ts">
/*
 * Секция 10 лендинга «Настраивается под то, как работает ваша компания» (слайд 10).
 * Форма данных та же, что у фич 4–9, поэтому рисует её LandingFeature — второй
 * разметки той же секции нет (Л5). Отдельный компонент — только точка подключения
 * секции 10 в LandingPage по таблице плана.
 */
import '@styles/public/landing.css'
import { useLandingContent } from '@/composables/useLandingContent'
import LandingFeature from './LandingFeature.vue'

const content = useLandingContent()
</script>
