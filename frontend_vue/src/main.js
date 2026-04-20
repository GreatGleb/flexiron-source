import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { vTooltip } from './composables/useTooltip'

/* Existing shared styles from demo */
import '@styles/erp-base.css'
import '@styles/public/public.css'

createApp(App).use(router).use(i18n).directive('tooltip', vTooltip).mount('#app')
