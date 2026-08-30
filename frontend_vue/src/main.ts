import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { vTooltip } from './composables/useTooltip'

/* Existing shared styles from demo */
import '@styles/erp-base.css'
import '@styles/public/public.css'
/*
 * Полосы прокрутки для Firefox — здесь, а не в `admin-core.scss`, потому что тот
 * подключается из `AdminLayout` и до публичных страниц не достаёт, а прокручиваемая
 * область есть и там (`.terms-content`). Chrome файл не трогает по построению: внутри
 * стоит `@supports not selector(::-webkit-scrollbar)`, куда webkit-движки не заходят.
 */
import '@styles/scrollbars-firefox.css'

/*
 * В мок-режиме мок-слой — это и есть слой данных приложения, поэтому он грузится на
 * старте, а не первым же запросом (`apiGet` тянет его динамическим import()).
 *
 * Разница видна не в приложении, а в тестах: пока модуль не исполнился, на window нет
 * счётчика запросов, и ожидание «данные пришли» не может отличить «мок ещё не загружен»
 * от «страница ничего не спрашивает». Под нагрузкой чанк не успевал за отведённые ему
 * 2 секунды, ожидание сдавалось, и проверка гонялась с пустой страницей.
 */
if (import.meta.env.VITE_USE_MOCKS !== 'false') {
  // Синхронно — до любого ожидания: «слой данных здесь мок, счётчик запросов будет».
  // Асинхронный import() исполняется тиком позже, и без этого флага тест не может
  // отличить «модуль ещё грузится» от «моков нет вовсе», кроме как по часам.
  window.__mockMode = true
  void import('./services/mocks/index')
}

createApp(App).use(router).use(i18n).directive('tooltip', vTooltip).mount('#app')
