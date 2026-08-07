<script setup lang="ts">
/**
 * How a new line should be priced when the order already carries hand-made
 * prices — model, section 10.
 *
 * Shown only when there is something to ask. An order nobody has repriced by
 * hand gets no question at all: the line simply takes the order's defaults.
 */
import { useI18n } from 'vue-i18n'
import { formatCents, type AddLineMode } from '@/domain/orderPricing'

const props = defineProps<{
  modes: AddLineMode[]
  /** The discount the order really gave — the number "order terms" means. */
  effectiveDiscount: number
}>()

const model = defineModel<AddLineMode>({ required: true })

const { t } = useI18n()

function hintFor(mode: AddLineMode): string {
  if (mode === 'order_terms') {
    // Same rounding as the panel this number is read off — `toFixed` rounds by
    // the binary value, so 9.705 showed 9.70 here next to 9.71 in the panel.
    return t('orders.add_mode_order_terms_hint', { discount: formatCents(props.effectiveDiscount) })
  }
  return t(`orders.add_mode_${mode}_hint`)
}
</script>

<template>
  <div v-if="modes.length > 0" class="add-mode-chooser" data-test="add-mode-chooser">
    <h3 class="add-mode-title">{{ t('orders.add_mode_title') }}</h3>
    <label
      v-for="mode in modes"
      :key="mode"
      class="add-mode-option"
      :class="{ active: model === mode }"
      :data-test="'add-mode-' + mode"
    >
      <input v-model="model" type="radio" :value="mode" class="add-mode-radio" />
      <span class="add-mode-text">
        <span class="add-mode-label">{{ t('orders.add_mode_' + mode) }}</span>
        <span class="add-mode-hint">{{ hintFor(mode) }}</span>
      </span>
    </label>
  </div>
</template>

<style scoped>
.add-mode-chooser {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 0 4px;
}

.add-mode-title {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  margin: 0;
}

.add-mode-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.add-mode-option:hover {
  border-color: rgba(255, 255, 255, 0.24);
}

.add-mode-option.active {
  border-color: rgba(80, 160, 255, 0.6);
  background: rgba(80, 160, 255, 0.08);
}

.add-mode-radio {
  margin-top: 3px;
  accent-color: #50a0ff;
}

.add-mode-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.add-mode-label {
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.9);
}

.add-mode-hint {
  font-size: 0.76rem;
  color: rgba(255, 255, 255, 0.45);
}
</style>
