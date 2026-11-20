<template>
  <footer class="landing-footer" data-test="landing-footer">
    <div class="landing-container landing-footer-inner">
      <address class="landing-footer-contacts" data-test="landing-footer-contacts">
        <span class="landing-footer-company">{{ CONTACTS.company }}</span>
        <a :href="`mailto:${CONTACTS.email}`" class="landing-footer-contact">{{
          CONTACTS.email
        }}</a>
        <a :href="phoneHref" class="landing-footer-contact">{{ CONTACTS.phone }}</a>
        <a
          :href="`https://t.me/${CONTACTS.telegram}`"
          class="landing-footer-contact"
          target="_blank"
          rel="noopener"
        >
          @{{ CONTACTS.telegram }}
        </a>
      </address>
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
import { CONTACTS } from '@/config/landing'
import { landingRu } from '@/content/landing.ru'

const footer = landingRu.footer
/** tel: без пробелов и скобок — так номер набирается на телефоне. */
const phoneHref = `tel:${CONTACTS.phone.replace(/[^\d+]/g, '')}`
</script>
