import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command, mode, isPreview }) => {
  // Load env variables for proxy
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // Сайт целиком — лендинг и программа — в корне репозитория публикации (этап 2 лендинга, SEO):
    // https://greatgleb.github.io/Flexiron-Enterprise/. Старые ссылки /demo/… ловит роутер.
    // `vite preview` (пререндер, scripts/prerender-landing.mjs) отдаёт ту же сборку — и с той же базой.
    base: command === 'build' || isPreview ? '/Flexiron-Enterprise/' : '/',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@styles': fileURLToPath(new URL('./src/styles', import.meta.url)),
        '@images': fileURLToPath(new URL('./src/assets/images', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: '../site',
      emptyOutDir: true,
      assetsDir: 'app',
    },
  }
})
