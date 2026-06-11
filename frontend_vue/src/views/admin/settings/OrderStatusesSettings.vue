<script setup lang="ts">
import { ref, inject, type Ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import GlassPanel from '@/components/admin/GlassPanel.vue'
import SvgIcon from '@/components/admin/SvgIcon.vue'
import { useTranslatedField } from '@/composables/useTranslatedData'
import type { AppSettings, OrderStatusSetting } from '@/types/settings'

const { t, locale } = useI18n()
const { tf } = useTranslatedField()

const settings = inject<AppSettings>('settings')!
const removeOrderStatus = inject<(id: string) => void>('removeOrderStatus')!
const updateOrderStatus = inject<(id: string, patch: Partial<OrderStatusSetting>) => void>('updateOrderStatus')!
const onStatusDragStart = inject<(id: string) => void>('onStatusDragStart')!
const onStatusDrop = inject<(id: string) => void>('onStatusDrop')!
const statusModal = inject<Ref<boolean>>('statusModal')!

// ─── Color picker state ───
const activeColorPicker = ref<string | null>(null)

function toggleColorPicker(id: string) {
  activeColorPicker.value = activeColorPicker.value === id ? null : id
}

function handleHexInput(id: string, event: Event) {
  const raw = (event.target as HTMLInputElement).value
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) {
    updateOrderStatus(id, { color: raw })
  }
}

// ─── Warehouse toggle handlers ───
function handleReserveToggle(stId: string, checked: boolean) {
  if (checked) {
    // Rule 2: Only one status can reserve — clear any other that has it
    for (const s of settings.orderStatuses) {
      if (s.id !== stId && s.reserveOnTransition) {
        updateOrderStatus(s.id, { reserveOnTransition: false })
      }
    }
  }
  updateOrderStatus(stId, { reserveOnTransition: checked })
}

function handleWriteOffToggle(stId: string, checked: boolean) {
  if (checked) {
    // Rule 2: Only one status can write off — clear any other that has it
    for (const s of settings.orderStatuses) {
      if (s.id !== stId && s.writeOffOnTransition) {
        updateOrderStatus(s.id, { writeOffOnTransition: false })
      }
    }
  }
  updateOrderStatus(stId, { writeOffOnTransition: checked })
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.color-popup') && !target.closest('.color-badge-pill')) {
    activeColorPicker.value = null
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <GlassPanel class="settings-panel">
    <div class="statuses-table-header">
      <h3>{{ t('settingsStatuses.title') }}</h3>
      <button
        class="btn btn-secondary"
        data-test="settings-status-add"
        @click="statusModal = true"
      >
        <SvgIcon name="plus-add" width="14" height="14" />
        {{ t('settingsStatuses.add_status') }}
      </button>
    </div>

    <div v-if="settings.orderStatuses.length" class="data-table-wrapper">
      <table class="data-table relaxed" data-test="settings-statuses-table">
        <thead>
          <tr>
            <th class="col-order">{{ t('settingsStatuses.order') }}</th>
            <th class="col-name">{{ t('settingsStatuses.name') }}</th>
            <th class="col-color">{{ t('settingsStatuses.color') }}</th>
            <th class="col-reserve">{{ t('settingsStatuses.col_reserve') }}</th>
            <th class="col-writeoff">{{ t('settingsStatuses.col_write_off') }}</th>
            <th class="col-actions">{{ t('settingsStatuses.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="st in settings.orderStatuses"
            :key="st.id"
            :draggable="true"
            @dragstart="onStatusDragStart(st.id)"
            @dragover.prevent
            @drop="onStatusDrop(st.id)"
            class="draggable-row"
          >
            <td class="col-order">
              <span class="drag-handle">
                <SvgIcon name="menu-bars" width="14" height="14" />
              </span>
              <span class="order-badge">{{ st.order + 1 }}</span>
            </td>

            <td class="col-name">
              <input
                class="glass-input status-name-input"
                :value="tf(st.name)"
                @input="
                  updateOrderStatus(st.id, {
                    name: { ...st.name, [locale]: ($event.target as HTMLInputElement).value },
                  })
                "
                :placeholder="t('settingsStatuses.edit_name')"
                data-test="settings-status-name"
              />
              <span
                v-if="st.system"
                class="system-badge"
                v-tooltip="t('settingsStatuses.system_hint')"
              >S</span>
            </td>

            <td class="col-color">
              <button
                class="color-badge-pill"
                :style="{ backgroundColor: st.color }"
                @click="toggleColorPicker(st.id)"
                :title="st.color"
              >
                <span class="color-badge-hex">{{ st.color }}</span>
              </button>

              <div v-if="activeColorPicker === st.id" class="color-popup" @click.stop>
                <div class="color-popup-header">
                  <span>{{ t('settingsStatuses.edit_color') }}</span>
                  <button class="color-popup-close" @click="activeColorPicker = null">
                    <SvgIcon name="x-close" width="12" height="12" />
                  </button>
                </div>

                <div class="spectral-picker-row">
                  <input
                    type="color"
                    class="color-input-native"
                    :value="st.color"
                    @input="updateOrderStatus(st.id, { color: ($event.target as HTMLInputElement).value })"
                  />
                  <div class="hex-input-wrap">
                    <input
                      class="glass-input hex-input"
                      type="text"
                      maxlength="7"
                      :value="st.color"
                      @input="handleHexInput(st.id, $event)"
                      :placeholder="t('settingsStatuses.color_hex_placeholder')"
                    />
                  </div>
                </div>
              </div>
            </td>

            <td class="col-reserve">
              <label
                class="toggle-row"
                :class="{ 'toggle-disabled': st.writeOffOnTransition }"
                v-tooltip="t('settingsStatuses.col_reserve_hint')"
              >
                <input
                  type="checkbox"
                  class="toggle-checkbox"
                  :checked="st.reserveOnTransition ?? false"
                  :disabled="st.writeOffOnTransition"
                  @change="handleReserveToggle(st.id, ($event.target as HTMLInputElement).checked)"
                />
                <span class="toggle-slider"></span>
              </label>
            </td>

            <td class="col-writeoff">
              <label
                class="toggle-row"
                :class="{ 'toggle-disabled': st.reserveOnTransition }"
                v-tooltip="t('settingsStatuses.col_write_off_hint')"
              >
                <input
                  type="checkbox"
                  class="toggle-checkbox"
                  :checked="st.writeOffOnTransition ?? false"
                  :disabled="st.reserveOnTransition"
                  @change="handleWriteOffToggle(st.id, ($event.target as HTMLInputElement).checked)"
                />
                <span class="toggle-slider"></span>
              </label>
            </td>

            <td class="col-actions">
              <button
                v-tooltip="t('btn.delete')"
                class="action-icon-btn"
                :class="{ 'action-danger': !st.system, 'action-disabled': st.system }"
                :disabled="st.system"
                data-test="settings-status-delete"
                @click="removeOrderStatus(st.id)"
              >
                <SvgIcon name="x-close" width="14" height="14" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="statuses-empty">
      {{ t('settingsStatuses.add_status') }}
    </div>
  </GlassPanel>
</template>

<style scoped>
/* ─── Table header ─── */
.statuses-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.statuses-table-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  color: rgba(255, 255, 255, 0.75);
}

/* ─── Empty state ─── */
.statuses-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted, #6B7280);
  font-size: 0.875rem;
}

/* ─── Spacious rows ─── */
.data-table.relaxed td {
  padding: 12px 16px;
  height: auto;
  vertical-align: middle;
}

/* ─── Column widths ─── */
.data-table .col-order {
  width: 100px;
}

.data-table .col-name {
  width: auto;
}

.data-table .col-color {
  width: 160px;
}

.data-table .col-reserve {
  width: 90px;
  text-align: center;
}

.data-table .col-writeoff {
  width: 90px;
  text-align: center;
}

.data-table .col-actions {
  width: 48px;
  text-align: right;
  padding-right: 8px;
}

/* ─── Order column: drag handle + badge ─── */
.col-order {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  color: rgba(255, 255, 255, 0.3);
  cursor: grab;
  flex-shrink: 0;
}

.drag-handle:active {
  cursor: grabbing;
}

.order-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.75rem;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}

/* ─── Status name input ─── */
.status-name-input {
  max-width: 260px;
  padding: 6px 10px;
  font-size: 13px;
  height: 32px;
  color: #ffffff !important;
}

/* ─── System badge ─── */
.system-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.15);
  color: #a78bfa;
  font-size: 0.625rem;
  font-weight: 700;
  margin-left: 6px;
  cursor: help;
  flex-shrink: 0;
}

/* ─── Color badge pill ─── */
.color-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px 4px 8px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  cursor: pointer;
  transition: all 0.2s;
  min-width: 72px;
  background: transparent;
  font-family: inherit;
  line-height: 1;
}
.color-badge-pill::before {
  content: '';
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: inherit;
  border: 2px solid rgba(255, 255, 255, 0.25);
  flex-shrink: 0;
}
.color-badge-pill:hover {
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
.color-badge-hex {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
  line-height: 1.2;
}

/* ─── Color popup ─── */
.col-color {
  position: relative;
}

.color-popup {
  position: absolute;
  z-index: 100;
  top: 100%;
  left: 0;
  margin-top: 8px;
  padding: 12px;
  background: rgba(30, 30, 40, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  min-width: 180px;
}

.color-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  font-weight: 500;
}

.color-popup-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  border-radius: 4px;
}

.color-popup-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.color-input-native {
  width: 44px;
  height: 44px;
  border: none;
  padding: 0;
  cursor: pointer;
  background: transparent;
  border-radius: 50%;
  flex-shrink: 0;
}

.color-input-native::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-input-native::-webkit-color-swatch {
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
}

/* ─── Spectral picker row: native color input + HEX text ─── */
.spectral-picker-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.hex-input-wrap {
  flex: 1;
}

.hex-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 0.8125rem;
  font-family: 'JetBrains Mono', monospace;
  height: 36px;
  color: #ffffff !important;
}

/* ─── Disabled action icon (system statuses) ─── */
.action-icon-btn.action-disabled {
  opacity: 0.25;
  cursor: not-allowed;
  pointer-events: none;
  border-color: transparent;
  background: transparent;
}

/* ─── Draggable row cursor ─── */
.draggable-row {
  cursor: grab;
}

.draggable-row:active {
  cursor: grabbing;
}

/* ─── Warehouse toggle switches in table ─── */
.col-reserve .toggle-row,
.col-writeoff .toggle-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  cursor: pointer;
  border-radius: 20px;
  background: transparent;
  transition: background 0.15s;
}

.col-reserve .toggle-row:hover,
.col-writeoff .toggle-row:hover {
  background: rgba(255, 255, 255, 0.06);
}

.col-reserve .toggle-row.toggle-disabled,
.col-writeoff .toggle-row.toggle-disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.col-reserve .toggle-checkbox,
.col-writeoff .toggle-checkbox {
  display: none;
}

.col-reserve .toggle-slider,
.col-writeoff .toggle-slider {
  position: relative;
  width: 32px;
  height: 18px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 9px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.col-reserve .toggle-slider::after,
.col-writeoff .toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.5);
  transition: all 0.2s;
}

.col-reserve .toggle-checkbox:checked + .toggle-slider,
.col-writeoff .toggle-checkbox:checked + .toggle-slider {
  background: #3b82f6;
}

.col-reserve .toggle-checkbox:checked + .toggle-slider::after,
.col-writeoff .toggle-checkbox:checked + .toggle-slider::after {
  left: 16px;
  background: #ffffff;
}
</style>
