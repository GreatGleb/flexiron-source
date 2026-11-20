<template>
  <section id="lead" class="landing-section landing-lead" data-test="landing-lead">
    <div class="landing-container landing-lead-inner">
      <div class="landing-lead-intro">
        <h2 class="landing-h2">{{ lead.title }}</h2>
        <p class="landing-text">{{ lead.text }}</p>
      </div>

      <form
        class="landing-card landing-lead-form"
        data-test="landing-lead-form"
        :data-state="state"
        novalidate
        @submit.prevent="onSubmit"
      >
        <p v-if="state === 'success'" class="landing-lead-success" data-test="landing-lead-success">
          {{ lead.success }}
        </p>

        <template v-else>
          <div
            v-for="field in fields"
            :key="field.key"
            :class="['landing-lead-field', { 'landing-lead-field--invalid': errors[field.key] }]"
          >
            <label :for="`landing-lead-${field.key}`" class="landing-lead-label">
              {{ field.label }}<span v-if="field.required" class="landing-lead-required">*</span>
            </label>
            <textarea
              v-if="field.key === 'message'"
              :id="`landing-lead-${field.key}`"
              :ref="(el) => setInput(field.key, el)"
              v-model="draft[field.key]"
              class="landing-lead-input landing-lead-textarea"
              :placeholder="field.placeholder"
              :aria-invalid="errors[field.key] ? 'true' : 'false'"
              :aria-describedby="errors[field.key] ? `landing-lead-${field.key}-error` : undefined"
              :data-test="`landing-lead-${field.key}`"
              rows="4"
              @blur="validateField(field.key)"
              @input="onInput(field.key)"
            ></textarea>
            <input
              v-else
              :id="`landing-lead-${field.key}`"
              :ref="(el) => setInput(field.key, el)"
              v-model="draft[field.key]"
              class="landing-lead-input"
              type="text"
              :autocomplete="field.autocomplete"
              :aria-required="field.required ? 'true' : undefined"
              :aria-invalid="errors[field.key] ? 'true' : 'false'"
              :aria-describedby="errors[field.key] ? `landing-lead-${field.key}-error` : undefined"
              :data-test="`landing-lead-${field.key}`"
              @blur="validateField(field.key)"
              @input="onInput(field.key)"
            />
            <p
              v-if="errors[field.key]"
              :id="`landing-lead-${field.key}-error`"
              class="landing-lead-error"
              :data-test="`landing-lead-${field.key}-error`"
            >
              {{ errorText(field.key) }}
            </p>
          </div>

          <input
            v-model="draft.website"
            class="landing-lead-trap"
            type="text"
            name="website"
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
            data-test="landing-lead-website"
          />

          <div
            v-if="state === 'disabled'"
            class="landing-lead-direct"
            data-test="landing-lead-disabled"
          >
            <p class="landing-lead-direct-text">{{ lead.disabled }}</p>
            <LandingContacts />
          </div>
          <template v-else>
            <button
              type="submit"
              class="landing-btn landing-btn--primary landing-lead-submit"
              :disabled="state === 'sending'"
              data-test="landing-lead-submit"
            >
              {{ lead.submit }}
            </button>
            <p class="landing-lead-consent">{{ lead.consent }}</p>
            <div
              v-if="state === 'error'"
              class="landing-lead-direct landing-lead-direct--error"
              role="alert"
              data-test="landing-lead-failed"
            >
              <p class="landing-lead-direct-text">{{ lead.error }}</p>
              <LandingContacts />
            </div>
          </template>
        </template>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
/*
 * Секция 13 лендинга — форма заявки (план, «Форма заявки»). Логика — useLandingLead,
 * правило валидации — src/domain/landingLead.ts, отправка — landingLeadService. Здесь только
 * разметка, тексты из landingRu.lead и фокус на первое неверное поле после отправки.
 *
 * data-state на <form>: idle / sending / success / error / disabled. В success поля
 * заменяются благодарностью; в error введённое остаётся, ниже — контакты; в disabled
 * (адрес Apps Script пуст, решение 4) вместо кнопки — «Напишите нам напрямую» и контакты.
 */
import '@styles/public/landing.css'
import { landingRu } from '@/content/landing.ru'
import { useLandingLead } from '@/composables/useLandingLead'
import type { LeadField } from '@/domain/landingLead'
import LandingContacts from './LandingContacts.vue'

const lead = landingRu.lead
const { draft, errors, state, validateField, firstInvalid, submit } = useLandingLead()

const fields: {
  key: LeadField
  label: string
  placeholder?: string
  required: boolean
  autocomplete: string
}[] = [
  { key: 'name', ...lead.fields.name, required: true, autocomplete: 'name' },
  { key: 'company', ...lead.fields.company, required: false, autocomplete: 'organization' },
  { key: 'contact', ...lead.fields.contact, required: true, autocomplete: 'on' },
  { key: 'message', ...lead.fields.message, required: false, autocomplete: 'off' },
]

const inputs: Partial<Record<LeadField, HTMLElement>> = {}

function setInput(field: LeadField, el: unknown) {
  if (el instanceof HTMLElement) inputs[field] = el
  else delete inputs[field]
}

function errorText(field: LeadField): string {
  const code = errors.value[field]
  return code ? lead.errors[code] : ''
}

/** Ошибку поля, которую человек уже увидел, снимаем, как только значение стало верным. */
function onInput(field: LeadField) {
  if (errors.value[field]) validateField(field)
}

async function onSubmit() {
  await submit()
  const field = firstInvalid()
  if (field) inputs[field]?.focus()
}
</script>
