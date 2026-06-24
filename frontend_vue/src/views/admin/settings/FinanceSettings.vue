<script setup lang="ts">
import { inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import InputGroup from '@/components/admin/ui/InputGroup.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import { useTranslatedField } from '@/composables/useTranslatedData'
import type { AppSettings, Currency } from '@/types/settings'

const { t } = useI18n()
const { tf } = useTranslatedField()

const settings = inject<AppSettings>('settings')!
const updateConstants =
  inject<(patch: Partial<AppSettings['constants']>) => void>('updateConstants')!
const removeCurrency = inject<(id: string) => void>('removeCurrency')!
const updateCurrency = inject<(id: string, patch: Partial<Currency>) => void>('updateCurrency')!
const handleSetDefaultCurrency = inject<(id: string) => void>('handleSetDefaultCurrency')!
const currencyModal = inject<Ref<boolean>>('currencyModal')!

/** Normalize comma → dot for decimal input */
const handleRateInput = (id: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const val = target.value.replace(',', '.')
  target.value = val
  updateCurrency(id, { exchangeRate: Number(val) })
}
</script>

<template>
  <GlassPanel>
    <div class="settings-form">
      <InputGroup :label="t('settingsFinance.vatRate')">
        <input
          :value="settings.constants.vatRate"
          class="glass-input"
          type="number"
          step="0.1"
          data-test="settings-finance-vat-rate"
          @input="updateConstants({ vatRate: Number(($event.target as HTMLInputElement).value) })"
        />
      </InputGroup>

      <InputGroup :label="t('settingsFinance.defaultMargin')">
        <input
          :value="settings.constants.defaultMargin"
          class="glass-input"
          type="number"
          step="0.1"
          data-test="settings-finance-default-margin"
          @input="
            updateConstants({ defaultMargin: Number(($event.target as HTMLInputElement).value) })
          "
        />
      </InputGroup>

      <InputGroup :label="t('settingsFinance.defaultDiscount')">
        <input
          :value="settings.constants.defaultDiscountPercent"
          class="glass-input"
          type="number"
          step="0.1"
          data-test="settings-finance-default-discount"
          @input="
            updateConstants({
              defaultDiscountPercent: Number(($event.target as HTMLInputElement).value),
            })
          "
        />
      </InputGroup>
    </div>

    <div class="currency-section">
      <div class="currency-table-header">
        <h3>{{ t('settingsFinance.currencies') }}</h3>
        <button
          class="btn btn-secondary"
          data-test="settings-finance-add-currency"
          @click="currencyModal = true"
        >
          <SvgIcon name="plus-add" width="14" height="14" />
          {{ t('settingsFinance.add_currency') }}
        </button>
      </div>

      <div v-if="settings.currencies.length" class="data-table-wrapper">
        <table class="data-table" data-test="settings-finance-currencies-table">
          <thead>
            <tr>
              <th>{{ t('settingsFinance.currency_code') }}</th>
              <th>{{ t('settingsFinance.currency_name') }}</th>
              <th>{{ t('settingsFinance.exchange_rate') }}</th>
              <th>{{ t('settingsFinance.is_default') }}</th>
              <th class="text-right"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cur in settings.currencies" :key="cur.id">
              <td>
                <strong>{{ cur.code }}</strong>
              </td>
              <td>{{ tf(cur.name) }}</td>
              <td>
                <input
                  type="number"
                  step="0.0001"
                  class="glass-input"
                  :value="String(cur.exchangeRate).replace(',', '.')"
                  data-test="settings-finance-currency-rate"
                  @input="handleRateInput(cur.id, $event)"
                />
              </td>
              <td>
                <label class="radio-label">
                  <input
                    type="radio"
                    class="radio-input"
                    name="default-currency"
                    :checked="cur.isDefault"
                    @change="handleSetDefaultCurrency(cur.id)"
                  />
                  <span class="radio-custom"></span>
                </label>
              </td>
              <td class="text-right">
                <button
                  v-tooltip="t('btn.delete')"
                  class="action-icon-btn"
                  :class="{ 'action-danger': !cur.isDefault, 'action-disabled': cur.isDefault }"
                  data-test="settings-finance-currency-delete"
                  :disabled="cur.isDefault"
                  @click="removeCurrency(cur.id)"
                >
                  <SvgIcon name="x-close" width="14" height="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="currency-empty">
        {{ t('settingsFinance.add_currency') }}
      </div>
    </div>
  </GlassPanel>
</template>

<style scoped>
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 480px;
  margin-bottom: 32px;
}

.currency-section {
  margin-top: 32px;
}

.currency-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.currency-table-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: rgba(255, 255, 255, 0.75);
}

.currency-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted, #6b7280);
  font-size: 0.875rem;
}

/* ─── Input text color — pure white override ─── */
.glass-input {
  color: #ffffff;
}
.glass-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

/* Custom radio for dark theme */
.radio-label {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.radio-input {
  display: none;
}

.radio-custom {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  position: relative;
  transition: all 0.2s;
  flex-shrink: 0;
}

.radio-input:checked + .radio-custom {
  border-color: #1890ff;
  background: rgba(24, 144, 255, 0.15);
  box-shadow: 0 0 6px rgba(24, 144, 255, 0.3);
}

.radio-input:checked + .radio-custom::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 8px;
  height: 8px;
  background: #1890ff;
  border-radius: 50%;
}

/* ─── Table cell padding — more breathing room ─── */
.data-table td {
  padding: 12px 16px;
  vertical-align: middle;
}

.data-table td:last-child {
  padding-right: 8px;
  width: 48px;
}

.data-table th {
  padding: 10px 16px;
}

.data-table th:last-child {
  padding-right: 8px;
  width: 48px;
}

/* ─── Bright, readable table cell text ─── */
.data-table td:first-child strong {
  color: #ffffff;
  font-weight: 600;
}

.data-table td:nth-child(2) {
  color: rgba(255, 255, 255, 0.8);
}

.text-right {
  text-align: right;
}

/* Disabled action icon button — muted, non-interactive */
.action-icon-btn.action-disabled {
  opacity: 0.25;
  cursor: not-allowed;
  pointer-events: none;
  border-color: transparent;
  background: transparent;
}
</style>
