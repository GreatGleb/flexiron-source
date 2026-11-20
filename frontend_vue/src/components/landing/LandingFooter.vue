<template>
  <footer class="landing-footer" data-test="landing-footer">
    <div class="landing-container landing-footer-inner">
      <LandingContacts data-test="landing-footer-contacts" />
      <nav class="landing-footer-nav">
        <router-link
          v-for="link in footer.links"
          :key="link.to"
          :to="link.to"
          class="landing-footer-link"
          data-test="landing-footer-link"
        >
          {{ link.label }}
        </router-link>
      </nav>
      <p class="landing-footer-copy">{{ footer.copyright }}</p>
    </div>
  </footer>
</template>

<script setup lang="ts">
import '@styles/public/landing.css'
import { landingRu } from '@/content/landing.ru'
import LandingContacts from './LandingContacts.vue'

const footer = landingRu.footer
</script>
