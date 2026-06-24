<script setup lang="ts">
import { inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import { useTranslatedField } from '@/composables/useTranslatedData'
import type { AppSettings, UomConversion } from '@/types/settings'

const { t } = useI18n()
const { tf } = useTranslatedField()

const settings = inject<AppSettings>('settings')!
const removeUom = inject<(id: string) => void>('removeUom')!
const removeConversion = inject<(id: string) => void>('removeConversion')!
const uomModal = inject<Ref<boolean>>('uomModal')!
const conversionModal = inject<Ref<boolean>>('conversionModal')!
const updateConversion =
  inject<(id: string, patch: Partial<UomConversion>) => void>('updateConversion')!

/** Resolve UoM code from id — returns translated code or a fallback label */
const getUomCode = (id: string): string => {
  const u = settings.uoms.find((u) => u.id === id)
  if (u) return tf(u.code)
  // Fallback: extract a readable hint from the internal id
  const hint = id.replace(/^uom-/, '')
  return hint || id
}

/** Check if conversion is dynamic */
const isDynamic = (conv: UomConversion): boolean => conv.type === 'dynamic'

/** Get translated formula type label */
const formulaTypeLabel = (formulaType?: string): string => {
  if (!formulaType) return ''
  const key = `settingsUom.formula_${formulaType}`
  const translated = t(key)
  return translated !== key ? translated : formulaType
}

/** Normalize comma → dot for decimal input */
const handleFactorInput = (id: string, event: Event) => {
  const target = event.target as HTMLInputElement
  const val = target.value.replace(',', '.')
  target.value = val
  updateConversion(id, { factor: Number(val) })
}
</script>

<template>
  <GlassPanel class="settings-panel">
    <div class="uom-table-header">
      <h3>{{ t('settingsUom.uoms') }}</h3>
      <button class="btn btn-secondary" data-test="settings-uom-add" @click="uomModal = true">
        <SvgIcon name="plus-add" width="14" height="14" />
        {{ t('settingsUom.add_uom') }}
      </button>
    </div>

    <div v-if="settings.uoms.length" class="data-table-wrapper">
      <table class="data-table" data-test="settings-uom-table">
        <thead>
          <tr>
            <th>{{ t('settingsUom.code') }}</th>
            <th>{{ t('settingsUom.name') }}</th>
            <th>{{ t('settingsUom.category') }}</th>
            <th class="text-right"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in settings.uoms" :key="u.id">
            <td>
              <strong>{{ tf(u.code) }}</strong>
            </td>
            <td>{{ tf(u.name) }}</td>
            <td>{{ t(`settingsUom.category_${u.category}`) }}</td>
            <td class="text-right">
              <button
                v-tooltip="t('btn.delete')"
                class="action-icon-btn action-danger"
                data-test="settings-uom-delete"
                @click="removeUom(u.id)"
              >
                <SvgIcon name="x-close" width="14" height="14" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="uom-empty">
      {{ t('settingsUom.add_uom') }}
    </div>

    <div class="conversion-section">
      <div class="uom-table-header">
        <h3>{{ t('settingsUom.conversions') }}</h3>
        <button
          class="btn btn-secondary"
          data-test="settings-conversion-add"
          @click="conversionModal = true"
        >
          <SvgIcon name="plus-add" width="14" height="14" />
          {{ t('settingsUom.add_conversion') }}
        </button>
      </div>

      <div v-if="settings.conversions.length" class="data-table-wrapper">
        <table class="data-table" data-test="settings-conversion-table">
          <thead>
            <tr>
              <th>{{ t('settingsUom.from') }}</th>
              <th>{{ t('settingsUom.to') }}</th>
              <th>{{ t('settingsUom.conversion_type') }}</th>
              <th>{{ t('settingsUom.factor') }}</th>
              <th class="text-right"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="conv in settings.conversions" :key="conv.id">
              <td>
                <strong>{{ getUomCode(conv.fromUomId) }}</strong>
              </td>
              <td>
                <strong>{{ getUomCode(conv.toUomId) }}</strong>
              </td>
              <td>
                <span
                  v-if="isDynamic(conv)"
                  v-tooltip="formulaTypeLabel(conv.formulaType)"
                  class="formula-badge"
                >
                  {{ t('settingsUom.conversion_type_dynamic_badge') }}
                </span>
                <span v-else class="static-label">
                  {{ t('settingsUom.conversion_type_static') }}
                </span>
              </td>
              <td>
                <input
                  v-if="!isDynamic(conv)"
                  type="number"
                  step="0.0001"
                  class="glass-input"
                  :value="String(conv.factor ?? '').replace(',', '.')"
                  data-test="settings-conversion-factor"
                  @input="handleFactorInput(conv.id, $event)"
                />
                <span
                  v-else
                  v-tooltip="t('settingsUom.factor_disabled_hint')"
                  class="dynamic-factor"
                >
                  &mdash;
                </span>
              </td>
              <td class="text-right">
                <button
                  v-tooltip="t('btn.delete')"
                  class="action-icon-btn action-danger"
                  data-test="settings-conversion-delete"
                  @click="removeConversion(conv.id)"
                >
                  <SvgIcon name="x-close" width="14" height="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="uom-empty">
        {{ t('settingsUom.no_conversions') }}
      </div>
    </div>
  </GlassPanel>
</template>

<style scoped>
/* ─── Table header row ─── */
.uom-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.uom-table-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: rgba(255, 255, 255, 0.75);
}

/* ─── Conversion section — separated from UoM table ─── */
.conversion-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
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

.text-right {
  text-align: right;
}

/* ─── Bright, readable table cell text ─── */
.data-table td:first-child strong {
  color: #ffffff;
  font-weight: 600;
}

.data-table td:nth-child(2) {
  color: rgba(255, 255, 255, 0.8);
}

/* ─── Formula badge (dynamic rules) ─── */
.formula-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 600;
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  border: 1px solid rgba(139, 92, 246, 0.3);
  white-space: nowrap;
  cursor: help;
}

/* ─── Static label in type column ─── */
.static-label {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.55);
}

/* ─── Disabled factor for dynamic rules ─── */
.dynamic-factor {
  display: inline-block;
  padding: 6px 10px;
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.35);
  font-style: italic;
  cursor: help;
}

/* ─── Glass input inside table cells (compact) ─── */
.data-table .glass-input {
  max-width: 120px;
  padding: 6px 10px;
  font-size: 13px;
  height: 32px;
  color: #ffffff;
}

/* ─── Empty state ─── */
.uom-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted, #6b7280);
  font-size: 0.875rem;
}
</style>
