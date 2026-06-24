<template>
  <BackButton />

  <div class="container">
    <div class="hero-card">
      <div class="logo-container">
        <img :src="logoUrl" alt="Flexiron Logo" class="logo-icon" />
      </div>

      <h1>{{ t('reg.title') }}</h1>

      <div class="trial-banner">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{{ t('reg.trial') }}</span>
      </div>

      <!-- General error message (non-field-level) -->
      <div v-if="submitError && !hasFieldErrors" class="form-error">
        {{ submitError }}
      </div>

      <!-- Registration form (hidden when secret link is shown) -->
      <form v-if="!secretLink" class="form-grid" novalidate @submit.prevent="onSubmit">
        <h2 class="form-section-title">{{ t('reg.contactsTitle') }}</h2>

        <div class="form-group" :class="{ 'field-error': fieldErrors.first_name }">
          <label class="form-label">{{ t('reg.firstNameLabel') }}</label>
          <input
            v-model="form.first_name"
            type="text"
            class="form-input"
            :class="{ 'input-error': fieldErrors.first_name }"
            :placeholder="t('reg.firstNamePlaceholder')"
            @input="clearFieldError('first_name')"
          />
          <span v-if="fieldErrors.first_name" class="field-hint">{{ fieldErrors.first_name }}</span>
        </div>

        <div class="form-group" :class="{ 'field-error': fieldErrors.last_name }">
          <label class="form-label">{{ t('reg.lastNameLabel') }}</label>
          <input
            v-model="form.last_name"
            type="text"
            class="form-input"
            :class="{ 'input-error': fieldErrors.last_name }"
            :placeholder="t('reg.lastNamePlaceholder')"
            @input="clearFieldError('last_name')"
          />
          <span v-if="fieldErrors.last_name" class="field-hint">{{ fieldErrors.last_name }}</span>
        </div>

        <div class="form-group" :class="{ 'field-error': fieldErrors.email }">
          <label class="form-label">{{ t('reg.emailLabel') }}</label>
          <input
            v-model="form.email"
            type="email"
            class="form-input"
            :class="{ 'input-error': fieldErrors.email }"
            :placeholder="t('common.emailPlaceholder')"
            @input="clearFieldError('email')"
          />
          <span v-if="fieldErrors.email" class="field-hint">{{ fieldErrors.email }}</span>
        </div>

        <div class="form-group" :class="{ 'field-error': fieldErrors.phone }">
          <label class="form-label">{{ t('reg.phoneLabel') }}</label>
          <input
            v-model="form.phone"
            type="tel"
            class="form-input"
            :class="{ 'input-error': fieldErrors.phone }"
            :placeholder="t('common.phonePlaceholder')"
            @input="clearFieldError('phone')"
          />
          <span v-if="fieldErrors.phone" class="field-hint">{{ fieldErrors.phone }}</span>
        </div>

        <div class="form-group col-span-2" :class="{ 'field-error': fieldErrors.password }">
          <label class="form-label">{{ t('reg.pwdLabel') }}</label>
          <div class="input-icon-wrapper">
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              class="form-input"
              :class="{ 'input-error': fieldErrors.password }"
              :placeholder="t('common.pwdPlaceholder')"
              @input="clearFieldError('password')"
            />
            <div
              class="input-action-icon"
              :title="t('reg.showPassword')"
              @click="showPassword = !showPassword"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
          </div>
          <span v-if="fieldErrors.password" class="field-hint">{{ fieldErrors.password }}</span>
        </div>

        <h2 class="form-section-title" style="margin-top: 0.5rem">{{ t('reg.companyTitle') }}</h2>

        <div class="form-group col-span-2" :class="{ 'field-error': fieldErrors.company_name }">
          <label class="form-label">{{ t('reg.companyLabel') }}</label>
          <input
            v-model="form.company_name"
            type="text"
            class="form-input"
            :class="{ 'input-error': fieldErrors.company_name }"
            :placeholder="t('reg.companyPlaceholder')"
            @input="clearFieldError('company_name')"
          />
          <span v-if="fieldErrors.company_name" class="field-hint">{{
            fieldErrors.company_name
          }}</span>
        </div>

        <div class="form-group" :class="{ 'field-error': fieldErrors.vat_code }">
          <label class="form-label">{{ t('reg.vatLabel') }}</label>
          <input
            v-model="form.vat_code"
            type="text"
            class="form-input"
            :class="{ 'input-error': fieldErrors.vat_code }"
            :placeholder="t('reg.vatPlaceholder')"
            @input="clearFieldError('vat_code')"
          />
          <span v-if="fieldErrors.vat_code" class="field-hint">{{ fieldErrors.vat_code }}</span>
        </div>

        <div class="form-group" :class="{ 'field-error': fieldErrors.country }">
          <label class="form-label">{{ t('reg.countryLabel') }}</label>
          <input
            v-model="form.country"
            type="text"
            class="form-input"
            :class="{ 'input-error': fieldErrors.country }"
            :placeholder="t('reg.countryPlaceholder')"
            @input="clearFieldError('country')"
          />
          <span v-if="fieldErrors.country" class="field-hint">{{ fieldErrors.country }}</span>
        </div>

        <div class="col-span-2">
          <button type="submit" class="cta-button" :disabled="isLoading">
            {{ isLoading ? t('reg.loading') : t('reg.btnSubmit') }}
          </button>
          <p class="terms-note">
            {{ t('reg.terms') }}
            <router-link to="/terms" target="_blank">{{ t('reg.termsLink') }}</router-link
            >.
          </p>
        </div>
      </form>

      <!-- Secret link popup after successful registration -->
      <div v-else class="secret-link-section">
        <div class="secret-link-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            width="48"
            height="48"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h2 class="secret-link-title">{{ t('reg.secretLinkTitle') }}</h2>
        <p class="secret-link-desc">{{ t('reg.secretLinkDesc') }}</p>
        <div class="secret-link-field">
          <input
            ref="secretLinkInput"
            :value="secretLink"
            class="form-input secret-link-input"
            type="text"
            readonly
            @click="copySecretLink"
          />
          <button class="secret-link-copy-btn" @click="copySecretLink">
            {{ copied ? t('reg.copied') : t('reg.copy') }}
          </button>
        </div>
        <p class="secret-link-warning">{{ t('reg.secretLinkWarning') }}</p>
        <button class="cta-button" @click="goToDashboard">
          {{ t('reg.goToDashboard') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useHead } from '@/composables/useHead'
import { useAuth } from '@/composables/useAuth'
import { ApiRequestError } from '@/types/api'
import BackButton from '@/components/BackButton.vue'
import logoUrl from '@images/Flexiron_Logo_White.svg'
import '@styles/public/register.css'

const { t } = useI18n()
const router = useRouter()
const { register, isLoading } = useAuth()

const showPassword = ref(false)
const submitError = ref(null)
const secretLink = ref(null)
const copied = ref(false)

const secretLinkInput = ref(null)

/**
 * Reactive form state with v-model binding.
 * Keys match the field names expected by the backend.
 */
const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  company_name: '',
  vat_code: '',
  country: '',
})

/**
 * Per-field error messages.
 * Key = field name, value = error message string.
 * Cleared individually on input via clearFieldError().
 */
const fieldErrors = reactive({
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  company_name: '',
  vat_code: '',
  country: '',
})

/** True if any field has an active error (controls form-level error visibility). */
const hasFieldErrors = computed(() => Object.values(fieldErrors).some((v) => v !== ''))

useHead({
  title: () => t('reg.seo.title'),
  description: () => t('reg.seo.description'),
})

/** Clear error for a single field when user starts typing in it. */
function clearFieldError(field) {
  if (fieldErrors[field]) {
    fieldErrors[field] = ''
  }
  // Also clear the general submit error since user is correcting
  if (submitError.value) {
    submitError.value = null
  }
}

async function onSubmit() {
  submitError.value = null

  // Clear previous field errors
  for (const key of Object.keys(fieldErrors)) {
    fieldErrors[key] = ''
  }

  // Client-side validation
  let hasClientError = false
  if (!form.first_name.trim()) {
    fieldErrors.first_name = t('reg.validation.required')
    hasClientError = true
  }
  if (!form.last_name.trim()) {
    fieldErrors.last_name = t('reg.validation.required')
    hasClientError = true
  }
  if (!form.email.trim()) {
    fieldErrors.email = t('reg.validation.required')
    hasClientError = true
  }
  if (!form.password) {
    fieldErrors.password = t('reg.validation.required')
    hasClientError = true
  }
  if (!form.company_name.trim()) {
    fieldErrors.company_name = t('reg.validation.required')
    hasClientError = true
  }
  if (!form.vat_code.trim()) {
    fieldErrors.vat_code = t('reg.validation.required')
    hasClientError = true
  }

  if (hasClientError) return

  try {
    const link = await register({
      email: form.email.trim(),
      password: form.password,
      company_name: form.company_name.trim(),
      vat_code: form.vat_code.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim() || undefined,
      locale: 'ru',
    })
    // Show secret link popup
    secretLink.value = link
  } catch (err) {
    if (err instanceof ApiRequestError) {
      // Map backend field errors to form fields
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field in fieldErrors) {
            fieldErrors[field] = message
          }
        }
      }
      // Only show top-level error if no field-specific errors were set
      if (!hasFieldErrors.value) {
        submitError.value = err.message
      }
    } else {
      submitError.value = err instanceof Error ? err.message : t('reg.errorFailed')
    }
  }
}

async function copySecretLink() {
  if (!secretLink.value) return
  try {
    await navigator.clipboard.writeText(secretLink.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    if (secretLinkInput.value) {
      secretLinkInput.value.select()
    }
  }
}

function goToDashboard() {
  router.push('/admin/analytics/dashboard')
}
</script>

<style scoped>
.container {
  align-items: flex-start;
}
.hero-card {
  margin: auto;
}

/* Secret link section */
.secret-link-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
}

.secret-link-icon {
  color: #1890ff;
}

.secret-link-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: white;
  margin: 0;
}

.secret-link-desc {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  line-height: 1.5;
  margin: 0;
}

.secret-link-field {
  display: flex;
  gap: 8px;
  width: 100%;
  max-width: 500px;
}

.secret-link-input {
  flex: 1;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  color: #1890ff !important;
}

.secret-link-copy-btn {
  padding: 0.5rem 1rem;
  background: rgba(24, 144, 255, 0.15);
  border: 1px solid rgba(24, 144, 255, 0.3);
  border-radius: 8px;
  color: #1890ff;
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.secret-link-copy-btn:hover {
  background: rgba(24, 144, 255, 0.25);
}

.secret-link-warning {
  font-size: 0.75rem;
  color: rgba(255, 107, 107, 0.8);
  text-align: center;
  margin: 0;
}

.secret-link-section .cta-button {
  margin-top: 0.5rem;
}
</style>
