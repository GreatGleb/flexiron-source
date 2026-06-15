<template>
  <div class="container">
    <div class="hero-card">
      <!-- Loading state -->
      <div v-if="loading" class="auth-link-status">
        <div class="spinner"></div>
        <p>{{ t('authLink.verifying') }}</p>
      </div>

      <!-- Error state — link invalid / expired -->
      <div v-else-if="error" class="auth-link-status error">
        <div class="logo-container">
          <img :src="logoUrl" alt="Flexiron Logo" class="logo-icon" />
        </div>

        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="status-icon">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>

        <h1>{{ t('authLink.errorTitle') }}</h1>
        <p class="subtitle">{{ error }}</p>

        <div class="cta-group">
          <router-link to="/support" class="cta-button">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span>{{ t('authLink.contactSupport') }}</span>
          </router-link>

          <router-link to="/" class="cta-button secondary">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>{{ t('authLink.backHome') }}</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { apiGet } from '@/services/api'
import { useHead } from '@/composables/useHead'
import logoUrl from '@images/Flexiron_Logo_White.svg'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const loading = ref(true)
const error = ref<string | null>(null)

useHead({
  title: () => t('authLink.seo.title'),
  description: () => t('authLink.seo.description'),
})

/** Try to extract an email from the API response, supporting multiple formats. */
function extractEmail(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null

  const obj = data as Record<string, unknown>

  // Format 1: { email: "..." } — MagicLinkVerifyResponse
  if (typeof obj.email === 'string') return obj.email

  // Format 2: { user: { email: "..." }, session: {...} } — LoginResponse
  if (obj.user && typeof obj.user === 'object') {
    const user = obj.user as Record<string, unknown>
    if (typeof user.email === 'string') return user.email
  }

  return null
}

onMounted(async () => {
  const rawToken = route.query.token
  const token = typeof rawToken === 'string' ? rawToken : null

  // No token → redirect to 404
  if (!token) {
    await router.replace('/404')
    return
  }

  try {
    // Fetch with a 10-second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const result = await apiGet<unknown>('/api/auth/link', { token })

    clearTimeout(timeoutId)

    // Extract email — supports both { email } and { user: { email } } formats
    const email = extractEmail(result)

    if (!email) {
      throw new Error('Invalid response: email not found')
    }

    // Store email in sessionStorage (cleared on tab close, not in URL)
    sessionStorage.setItem('prefilled_email', email)

    // Redirect to login page — email will be read from sessionStorage
    // The user still needs to enter their password
    await router.replace('/login')
  } catch (err) {
    console.warn('[AuthLink] Verification failed:', err)
    error.value = t('authLink.invalidLink')
    loading.value = false
  }
})
</script>

<style scoped>
.auth-link-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: white;
}

.auth-link-status p {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.8);
}

.auth-link-status.error .subtitle {
  color: #ff6b6b;
  font-size: 1.125rem;
  margin-bottom: 2rem;
}

.status-icon {
  width: 56px;
  height: 56px;
  color: #ff6b6b;
  margin-bottom: 0.5rem;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
