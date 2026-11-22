<template>
  <address class="landing-contacts">
    <a :href="`mailto:${CONTACTS.email}`" class="landing-contacts-link">{{ CONTACTS.email }}</a>
    <a :href="phoneHref" class="landing-contacts-link">{{ CONTACTS.phone }}</a>
  </address>
</template>

<script setup lang="ts">
/*
 * Контакты из src/config/landing.ts — одна разметка на подвал и на форму заявки
 * (состояния error и disabled), чтобы ссылки и правило tel: жили в одном месте (Л5).
 */
import '@styles/public/landing.css'
import { CONTACTS } from '@/config/landing'

/** tel: без пробелов и скобок — так номер набирается на телефоне. */
const phoneHref = `tel:${CONTACTS.phone.replace(/[^\d+]/g, '')}`
</script>
