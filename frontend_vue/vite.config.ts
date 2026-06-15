import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ command, mode }) => {
  // Load env variables for proxy
  const env = loadEnv(mode, process.cwd(), '')

  return {
    base: command === 'build' ? '/Flexiron-Enterprise/demo/' : '/',
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
      outDir: '../demo',
      emptyOutDir: true,
      assetsDir: 'app',
    },
  }
})
