/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_USE_MOCKS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * Флаги, которые приложение вешает на `window` для тестов.
 *
 * `__mockMode` ставится синхронно в `main.ts` до любого ожидания: без него тест не
 * может отличить «мок ещё грузится» от «моков нет вовсе», кроме как по часам.
 */
interface Window {
  __mockMode?: boolean
}
